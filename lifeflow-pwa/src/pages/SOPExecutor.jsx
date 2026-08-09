import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Play, Pause, SkipBack, SkipForward,
  Clock, CheckCircle2, Circle, AlertTriangle,
  Repeat, Zap, Send, X, Bot, User, ChefHat, ShoppingBasket
} from 'lucide-react'
import Header from '../components/Header'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import VoiceOrb from '../components/VoiceOrb'
import AgentBadge from '../components/AgentBadge'
import EmergencyOverlay from '../components/EmergencyOverlay'
import ContextTips from '../components/ContextTips'
import sopStore from '../store/sopStore'
import authStore from '../store/authStore'
import { useVoiceAgent, detectAgentType } from '../hooks/useVoiceAgent'
import { useSound } from '../hooks/useSound'
import { sopAPI } from '../api'

// ==================== 食材识别 ====================
const INGREDIENT_CANDIDATES = [
  '鸡蛋', '番茄', '西红柿', '青椒', '土豆', '肉丝', '排骨', '鸡翅', '虾', '鱼',
  '葱', '姜', '蒜', '盐', '酱油', '生抽', '老抽', '料酒', '糖', '食用油', '油', '醋', '淀粉',
  '米饭', '米', '紫菜', '青菜', '蔬菜', '玉米', '黄瓜', '豆腐', '牛肉', '猪肉', '羊肉',
  '胡萝卜', '洋葱', '大蒜', '香菜', '辣椒', '花椒', '八角', '桂皮', '香叶', '豆瓣酱',
  '香油', '蚝油', '味精', '鸡精', '胡椒', '面粉', '面条', '饺子', '汤圆', '芝麻',
  '虾仁', '螃蟹', '贝类', '鱿鱼', '海带', '木耳', '香菇', '金针菇', '豆腐皮', '粉条'
]

function extractIngredients(sop) {
  if (!sop) return []
  const haystack = (
    (sop.title || '') + ' ' +
    (sop.goal || '') + ' ' +
    (sop.steps || []).map(s => (s.title || '') + ' ' + (s.description || '')).join(' ')
  ).toLowerCase()
  const found = []
  for (const c of INGREDIENT_CANDIDATES) {
    if (haystack.includes(c.toLowerCase()) && !found.includes(c)) found.push(c)
  }
  return found
}

// ==================== 主组件 ====================
export default function SOPExecutor() {
  const navigate = useNavigate()
  const params = useParams()
  const { currentSop, setCurrentSop, stepIndex, setStepIndex, nextStep, prevStep, updateStep, startExecution, stopExecution } = sopStore()
  const { speechKeywords, voiceSettings } = authStore()
  const [sop, setSop] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [currentStepTimer, setCurrentStepTimer] = useState(0)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [emergency, setEmergency] = useState(null)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [interactionMode, setInteractionMode] = useState('guided') // guided | free | idle

  // ===== AI 问答对话 =====
  const [chatMessages, setChatMessages] = useState([]) // [{id, role:'user'|'assistant', content, streaming}]
  const [chatInput, setChatInput] = useState('')
  const [chatOpen, setChatOpen] = useState(false) // 对话面板展开
  const chatFlightRef = useRef(null) // 单航班锁：当前请求句柄 { abort }
  const chatHistoryRef = useRef([]) // 给后端的对话历史 [{role,content}]
  const chatScrollRef = useRef(null)

  // ===== 遗漏食材主动提醒 =====
  const [ingredientsTip, setIngredientsTip] = useState(null) // {msg, ingredients}
  const tipShownRef = useRef(false)

  const timerRef = useRef(null)
  const stepTimerRef = useRef(null)
  const lastStepIndexRef = useRef(-1)
  const autoplayTriedRef = useRef(false)
  const { playClick, playSuccess, playError, playListening, playStepComplete, playEmergency, playUnderstood, playDing } = useSound()

  const detectedIngredients = useMemo(() => extractIngredients(sop), [sop])

  // ==================== 语音指令处理 ====================
  const handleCommand = useCallback((command, transcript) => {
    playUnderstood()
    switch (command) {
      case 'next':
        if (stepIndex < (sop?.steps?.length || 0) - 1) {
          if (sop?.steps?.[stepIndex]) {
            setSop(prev => {
              const newSteps = [...prev.steps]
              newSteps[stepIndex] = { ...newSteps[stepIndex], status: 'completed' }
              return { ...prev, steps: newSteps }
            })
            updateStep(stepIndex, { status: 'completed' })
          }
          nextStep()
          setCurrentStepTimer(0)
          playStepComplete()
        }
        break
      case 'prev':
        prevStep()
        setCurrentStepTimer(0)
        playClick()
        break
      case 'repeat':
        if (sop?.steps?.[stepIndex]) {
          const step = sop.steps[stepIndex]
          agentSpeak(`${step.title}。${step.description || ''}`)
        }
        break
      case 'pause':
        setIsPlaying(false)
        stopExecution()
        agentStopSpeaking()
        break
      case 'resume':
        setIsPlaying(true)
        startExecution()
        break
      case 'skip':
        if (stepIndex < (sop?.steps?.length || 0) - 1) {
          nextStep()
          setCurrentStepTimer(0)
          playClick()
        }
        break
    }
  }, [stepIndex, sop, nextStep, prevStep, updateStep, playUnderstood, playStepComplete, playClick])

  // ==================== 紧急情况处理 ====================
  const handleEmergency = useCallback((emergencyInfo) => {
    playEmergency()
    setEmergency(emergencyInfo)
    setIsPlaying(false)
    stopExecution()
    setTimeout(() => {
      agentSpeak(`注意！${emergencyInfo.instruction}`)
    }, 500)
  }, [playEmergency])

  // ==================== AI 问答（带单航班锁 + 流式） ====================
  const cancelChatFlight = useCallback(() => {
    if (chatFlightRef.current) {
      try { chatFlightRef.current.abort() } catch {}
      chatFlightRef.current = null
    }
  }, [])

  /**
   * 发送一条用户消息 → 调 /api/sop/chat → 流式显示 AI 回复 → 播报
   */
  const sendChatMessage = useCallback((rawText) => {
    const text = (rawText || '').trim()
    if (!text || !sop) return

    // 单航班锁：取消当前正在进行的请求
    cancelChatFlight()

    const userMsgId = Date.now()
    const aiMsgId = userMsgId + 1

    // 用户消息入队
    setChatMessages(prev => [...prev, { id: userMsgId, role: 'user', content: text, streaming: false }])
    // AI 占位消息（流式）
    setChatMessages(prev => [...prev, { id: aiMsgId, role: 'assistant', content: '', streaming: true }])
    // 更新历史（包含用户）
    chatHistoryRef.current = [...chatHistoryRef.current, { role: 'user', content: text }]
    setInteractionMode('free')

    const currentStep = sop.steps?.[stepIndex]
    const handle = sopAPI.chatStream(
      {
        sopId: sop.id,
        currentStepId: currentStep?.id,
        sop: { title: sop.title, goal: sop.goal, steps: sop.steps },
        message: text,
        history: chatHistoryRef.current.slice(-12),
        stream: true,
      },
      {
        onChunk: (delta, full) => {
          setChatMessages(prev => prev.map(m =>
            m.id === aiMsgId ? { ...m, content: full } : m
          ))
        },
        onDone: (full) => {
          const finalContent = full || '抱歉，我暂时无法回答这个问题哦～'
          setChatMessages(prev => prev.map(m =>
            m.id === aiMsgId ? { ...m, content: finalContent, streaming: false } : m
          ))
          chatHistoryRef.current = [...chatHistoryRef.current, { role: 'assistant', content: finalContent }]
          // 自动播报 AI 回复（短于 150 字才播，避免太长）
          if (finalContent.length <= 150) {
            agentSpeak(finalContent)
          }
          chatFlightRef.current = null
        },
        onError: (err) => {
          const isAbort = err?.message?.includes('取消')
          const msg = isAbort ? '' : (err?.message || 'AI 暂时有点累，稍后再试哦～')
          setChatMessages(prev => prev.map(m =>
            m.id === aiMsgId ? { ...m, content: msg, streaming: false } : m
          ))
          if (!isAbort && msg) agentSpeak(msg)
          chatFlightRef.current = null
        },
      }
    )
    chatFlightRef.current = handle
  }, [sop, stepIndex, cancelChatFlight])

  // 自由提问：语音过来的
  const handleQuestion = useCallback((transcript) => {
    if (!transcript) return
    // 打开对话面板并发送
    setChatOpen(true)
    sendChatMessage(transcript)
  }, [sendChatMessage])

  // ==================== 全双工语音 Agent ====================
  const {
    agentState, agentType, liveTranscript, isListening, isSpeaking,
    speak: agentSpeak, stopSpeaking: agentStopSpeaking,
    startListening, stopListening, updateAgentType, clearEmergency,
  } = useVoiceAgent({
    voiceSettings,
    speechKeywords,
    onCommand: handleCommand,
    onEmergency: handleEmergency,
    onQuestion: handleQuestion,
  })

  // ==================== 加载 SOP ====================
  useEffect(() => {
    if (params.id) {
      loadSop(params.id)
    } else if (currentSop) {
      setSop(currentSop)
      setLoading(false)
    }
  }, [params.id])

  const loadSop = async (id) => {
    setLoading(true)
    try {
      const response = await sopAPI.getById(id)
      if (response.sop) {
        setSop(response.sop)
        setCurrentSop(response.sop)
      }
    } catch (err) {
      console.error('加载SOP失败:', err)
    } finally {
      setLoading(false)
    }
  }

  // ==================== 总计时器 ====================
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => setTimerSeconds(prev => prev + 1), 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isPlaying])

  // ==================== 步骤计时器 ====================
  useEffect(() => {
    if (isPlaying) {
      stepTimerRef.current = setInterval(() => setCurrentStepTimer(prev => prev + 1), 1000)
    }
    return () => { if (stepTimerRef.current) clearInterval(stepTimerRef.current) }
  }, [isPlaying, stepIndex])

  // ==================== SOP 加载后：自动开始 + 播报第一步 + 主动提醒食材 ====================
  useEffect(() => {
    if (!sop || !sop.steps || loading || autoplayTriedRef.current) return
    autoplayTriedRef.current = true

    // 自动开始执行
    setIsPlaying(true)
    startExecution()

    // 延迟稍许，避免与初始化竞态
    const t = setTimeout(() => {
      const step = sop.steps[0]
      if (step) {
        lastStepIndexRef.current = 0
        agentSpeak(`开始执行啦～第1步：${step.title}。${step.description || ''}`)
      }

      // 主动识别遗漏食材（步骤1）
      if (detectedIngredients.length > 0 && !tipShownRef.current) {
        tipShownRef.current = true
        const tip = {
          msg: `检测到菜谱涉及 ${detectedIngredients.length} 种食材/调料，你都准备好了吗？`,
          ingredients: detectedIngredients,
        }
        setIngredientsTip(tip)
        // 打开对话面板，让用户可直接确认或提问
        setChatOpen(true)
        // 用聊天方式主动问
        const aiMsgId = Date.now()
        const promptText = `你好呀～我是你的厨房小助手！在开始第1步之前，我检测到这份菜谱可能需要用到：${detectedIngredients.join('、')}。
请问这些食材和调料你都准备好了吗？如果缺少哪样，我可以帮你想替代方案哦😊`
        setChatMessages(prev => [...prev, { id: aiMsgId, role: 'assistant', content: promptText, streaming: false }])
        chatHistoryRef.current = [{ role: 'assistant', content: promptText }]
        agentSpeak(promptText.length > 150 ? `你好呀！检测到这份菜谱需要用到 ${detectedIngredients.slice(0, 6).join('、')} 等食材调料，请问都准备好了吗？缺少的话我可以帮你想替代方案哦。` : promptText)
      }
    }, 400)

    return () => clearTimeout(t)
  }, [sop, loading, detectedIngredients])

  // ==================== 步骤变化：Agent类型 + 自动播报 ====================
  useEffect(() => {
    if (!sop?.steps?.[stepIndex]) return

    const currentStep = sop.steps[stepIndex]
    const stepText = `${currentStep.title} ${currentStep.description || ''}`
    updateAgentType(stepText)

    if (stepIndex !== lastStepIndexRef.current) {
      lastStepIndexRef.current = stepIndex
      // 无论是否播放状态，切换步骤都播报（用户点下一步/声控下一步都需要）
      const text = `第${stepIndex + 1}步：${currentStep.title}。${currentStep.description || ''}`
      agentSpeak(text)
    }
  }, [stepIndex, sop])

  // ==================== 自动滚动对话面板 ====================
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [chatMessages, chatOpen])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // ==================== UI 事件 ====================
  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false)
      stopExecution()
      agentStopSpeaking()
    } else {
      setIsPlaying(true)
      startExecution()
      playClick()
      if (sop?.steps?.[stepIndex]) {
        const step = sop.steps[stepIndex]
        agentSpeak(`继续～第${stepIndex + 1}步：${step.title}。${step.description || ''}`)
      }
    }
  }

  const handleNext = () => {
    if (stepIndex < (sop?.steps?.length || 0) - 1) {
      if (sop?.steps?.[stepIndex]) {
        setSop(prev => {
          const newSteps = [...prev.steps]
          newSteps[stepIndex] = { ...newSteps[stepIndex], status: 'completed' }
          return { ...prev, steps: newSteps }
        })
        updateStep(stepIndex, { status: 'completed' })
      }
      nextStep()
      setCurrentStepTimer(0)
      playStepComplete()
    }
  }

  const handlePrev = () => {
    prevStep()
    setCurrentStepTimer(0)
    playClick()
  }

  const handleCompleteStep = (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    if (sop?.steps?.[stepIndex]) {
      setSop(prev => {
        const newSteps = [...prev.steps]
        newSteps[stepIndex] = { ...newSteps[stepIndex], status: 'completed' }
        return { ...prev, steps: newSteps }
      })
      updateStep(stepIndex, { status: 'completed' })
      playStepComplete()
      playDing()
      if (stepIndex < sop.steps.length - 1) {
        nextStep()
        setCurrentStepTimer(0)
      }
    }
  }

  // 声控模式开关
  const handleToggleVoice = () => {
    if (voiceEnabled) {
      stopListening()
      setVoiceEnabled(false)
      setInteractionMode('idle')
    } else {
      playListening()
      startListening()
      setVoiceEnabled(true)
      setInteractionMode('guided')
    }
  }

  // 紧急关闭
  const handleEmergencyClose = () => {
    setEmergency(null)
    clearEmergency()
    setInteractionMode(voiceEnabled ? 'guided' : 'idle')
  }

  const handleFinish = () => setShowConfirmModal(true)

  const confirmFinish = () => {
    cancelChatFlight()
    stopExecution()
    setIsPlaying(false)
    agentStopSpeaking()
    stopListening()
    setVoiceEnabled(false)
    playSuccess()
    navigate('/sops')
  }

  // 用户通过输入框发送问答
  const handleChatSend = () => {
    if (!chatInput.trim()) return
    sendChatMessage(chatInput)
    setChatInput('')
  }

  const dismissIngredientsTip = () => {
    setIngredientsTip(null)
  }

  // 清理
  useEffect(() => {
    return () => {
      cancelChatFlight()
      stopListening()
      agentStopSpeaking()
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="text-center py-12">
          <p className="text-muted">加载中...</p>
        </div>
      </div>
    )
  }

  if (!sop) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="text-center py-12">
          <p className="text-muted mb-4">没有找到 SOP</p>
          <Button onClick={() => navigate('/generate')}>创建新 SOP</Button>
        </div>
      </div>
    )
  }

  const currentStep = sop.steps[stepIndex]
  const completedCount = sop.steps.filter(s => s.status === 'completed').length
  const progress = (completedCount / sop.steps.length) * 100
  const isLastStep = stepIndex === sop.steps.length - 1

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <div className="flex-1 max-w-lg mx-auto w-full px-4 sm:px-6 py-4 flex flex-col">

        {/* 顶部：标题 + 进度 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-base font-bold text-foreground truncate flex-1">{sop.title}</h1>
            <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
              <Clock size={14} className="text-muted" />
              <span className="text-xs font-semibold text-muted">{formatTime(timerSeconds)}</span>
            </div>
          </div>

          {/* 进度条 */}
          <div className="h-2 bg-secondary overflow-hidden rounded-full">
            <div
              className="h-full bg-accent transition-all duration-500 relative"
              style={{ width: `${progress}%` }}
            >
              {isPlaying && (
                <div className="absolute inset-0 animate-progress-stripe"
                  style={{
                    backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent)',
                    backgroundSize: '40px 40px',
                  }}
                />
              )}
            </div>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-muted">{completedCount}/{sop.steps.length} 步</span>
            <span className="text-[10px] text-muted">{Math.round(progress)}%</span>
          </div>
        </div>

        {/* 步骤指示器 */}
        <div className="flex justify-center gap-1.5 mb-4">
          {sop.steps.map((step, index) => (
            <button
              key={step.id || index}
              className={`h-1.5 transition-all rounded-full ${
                index === stepIndex ? 'w-6 bg-accent' :
                step.status === 'completed' ? 'w-1.5 bg-green-500' : 'w-1.5 bg-border'
              }`}
              onClick={() => { setStepIndex(index); setCurrentStepTimer(0) }}
            />
          ))}
        </div>

        {/* Agent 类型指示器 */}
        <div className="flex justify-center mb-3">
          <AgentBadge agentType={agentType} />
        </div>

        {/* 主动食材提醒 */}
        {ingredientsTip && (
          <div className="mb-3 animate-fade-in">
            <Card className="border-2 border-accent/60 bg-[#fff4e8] overflow-hidden">
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-full bg-accent/15 text-accent flex items-center justify-center flex-shrink-0">
                    <ShoppingBasket size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-1">
                      <ChefHat size={14} className="text-accent" />
                      <p className="text-xs font-bold text-[#3d3d3d]">小助手主动提醒</p>
                    </div>
                    <p className="text-xs text-[#5c5c5c] mb-2">{ingredientsTip.msg}</p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {ingredientsTip.ingredients.map((ing, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 bg-white border border-[#ffd4b8] text-[#3d3d3d] rounded-full">
                          {ing}
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 text-xs bg-accent hover:bg-[#e07a36] text-white"
                        onClick={() => { dismissIngredientsTip(); sendChatMessage('食材和调料我都已经备齐了，没问题！') }}>
                        都准备好了
                      </Button>
                      <Button size="sm" variant="secondary" className="h-7 text-xs"
                        onClick={() => { dismissIngredientsTip(); sendChatMessage('有些食材没准备，有什么替代方案吗？') }}>
                        缺少食材
                      </Button>
                      <button onClick={dismissIngredientsTip} className="ml-auto text-muted hover:text-[#3d3d3d]">
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 主步骤卡片 - 大字体高对比度 */}
        <Card className={`border-2 ${agentState === 'speaking' ? 'border-accent step-highlight' : 'border-[#ffd4b8]'} mb-3 transition-all`}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-accent text-accentForeground flex items-center justify-center text-sm font-bold rounded-lg">
                  {stepIndex + 1}
                </div>
                <span className="text-xs text-muted">
                  步骤 {stepIndex + 1} / {sop.steps.length}
                </span>
              </div>
              {currentStep.status === 'completed' ? (
                <CheckCircle2 size={24} className="text-green-600" />
              ) : (
                <Circle size={24} className="text-border" />
              )}
            </div>

            <h2 className="text-xl font-bold text-foreground mb-2 animate-step-enter" key={stepIndex}>
              {currentStep.title}
            </h2>

            {currentStep.description && (
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                {currentStep.description}
              </p>
            )}

            {currentStep.notes && (
              <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border-l-4 border-amber-400 px-3 py-2 mb-3 rounded">
                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                <span>{currentStep.notes}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-muted pt-2 border-t border-border">
              <span className="flex items-center gap-1">
                <Clock size={12} />
                预计 {currentStep.duration} 分钟
              </span>
              <span>已用 {formatTime(currentStepTimer)}</span>
            </div>
          </CardContent>
        </Card>

        {/* 上下文感知提示 */}
        <ContextTips
          sop={sop}
          stepIndex={stepIndex}
          currentStepTimer={currentStepTimer}
          formatTime={formatTime}
        />

        {/* 中间区域 */}
        <div className="flex-1 flex flex-col justify-end">

          {/* === AI 问答对话面板 === */}
          <div className="mb-3">
            <button
              onClick={() => setChatOpen(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 bg-white border-2 border-[#ffd4b8] hover:border-accent transition-all rounded-lg"
            >
              <div className="flex items-center gap-2">
                <Bot size={16} className="text-accent" />
                <span className="text-sm font-semibold text-[#3d3d3d]">
                  AI 小助手 {chatMessages.length > 0 ? `(${chatMessages.length})` : ''}
                </span>
              </div>
              <span className="text-xs text-muted">{chatOpen ? '收起' : '展开'}</span>
            </button>

            {chatOpen && (
              <div className="mt-2 border-2 border-[#ffd4b8] rounded-xl overflow-hidden bg-[#fffaf5] animate-fade-in">
                {/* 对话消息列表 */}
                <div
                  ref={chatScrollRef}
                  className="h-48 overflow-y-auto p-3 space-y-2"
                >
                  {chatMessages.length === 0 && (
                    <div className="text-center py-6 text-xs text-muted">
                      试试对小助手说："这个菜要炒多久？"、"盐放多少？"
                    </div>
                  )}
                  {chatMessages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                        msg.role === 'user' ? 'bg-accent text-white' : 'bg-[#ffe8d6] text-accent'
                      }`}>
                        {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                      </div>
                      <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-accent text-white rounded-br-sm'
                          : 'bg-white border border-[#ffd4b8] text-[#3d3d3d] rounded-bl-sm'
                      }`}>
                        <span>{msg.content || '...'}</span>
                        {msg.streaming && (
                          <span className="inline-block w-1.5 h-4 ml-1 bg-accent/60 animate-pulse align-middle" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {/* 输入框 */}
                <div className="flex gap-2 p-2 border-t border-[#ffd4b8] bg-white">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleChatSend() }
                    }}
                    placeholder="问点什么，比如：油温怎么判断？"
                    className="flex-1 h-9 border-2 border-[#ffd4b8] focus:border-accent focus:ring-2 focus:ring-accent/20"
                  />
                  <Button
                    onClick={handleChatSend}
                    disabled={!chatInput.trim() || !!chatFlightRef.current}
                    className="h-9 bg-accent hover:bg-[#e07a36] text-white"
                  >
                    {chatFlightRef.current ? (
                      <span className="flex items-center gap-1 text-xs">
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                        思考中
                      </span>
                    ) : <Send size={14} />}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* 语音指令快捷按钮 */}
          {voiceEnabled && (
            <div className="flex flex-wrap justify-center gap-2 mb-4 animate-fade-in">
              {[
                { label: '下一步', cmd: 'next', icon: SkipForward },
                { label: '重复', cmd: 'repeat', icon: Repeat },
                { label: '暂停', cmd: 'pause', icon: Pause },
                { label: '上一步', cmd: 'prev', icon: SkipBack },
              ].map(({ label, cmd, icon: Icon }) => (
                <button
                  key={cmd}
                  onClick={() => handleCommand(cmd)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white border border-[#ffd4b8] text-xs font-semibold text-[#3d3d3d] hover:border-accent hover:bg-[#fff8f0] transition-all active:scale-95 rounded-full"
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* 实时转写显示 */}
          {liveTranscript && (
            <div className="mb-3 px-4 py-2 bg-white/80 glass-effect border border-[#ffd4b8] text-center rounded-lg">
              <p className="text-sm text-[#6b6b6b] italic">"{liveTranscript}"</p>
            </div>
          )}

          {/* 底部：语音球 + 控制按钮 */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <button
              onClick={handlePrev}
              disabled={stepIndex === 0}
              className="w-11 h-11 flex items-center justify-center bg-white border-2 border-[#ffd4b8] text-[#3d3d3d] hover:border-accent disabled:opacity-30 transition-all active:scale-95 rounded-full"
            >
              <SkipBack size={18} />
            </button>

            <button
              onClick={togglePlay}
              className={`w-14 h-14 flex items-center justify-center text-white shadow-lg transition-all active:scale-95 rounded-full ${
                isPlaying ? 'bg-[#3d3d3d]' : 'bg-accent animate-glow'
              }`}
            >
              {isPlaying ? <Pause size={22} /> : <Play size={22} className="ml-1" />}
            </button>

            <div
              onClick={handleToggleVoice}
              className="cursor-pointer transition-transform active:scale-95"
            >
              <VoiceOrb
                state={voiceEnabled ? agentState : 'idle'}
                transcript={liveTranscript}
                size={voiceEnabled ? 92 : 72}
              />
            </div>

            <button
              onClick={handleNext}
              disabled={isLastStep}
              className="w-11 h-11 flex items-center justify-center bg-white border-2 border-[#ffd4b8] text-[#3d3d3d] hover:border-accent disabled:opacity-30 transition-all active:scale-95 rounded-full"
            >
              <SkipForward size={18} />
            </button>

            <button
              onClick={handleCompleteStep}
              disabled={currentStep.status === 'completed'}
              className="w-11 h-11 flex items-center justify-center bg-white border-2 border-[#ffd4b8] text-green-600 hover:border-green-500 disabled:opacity-30 transition-all active:scale-95 rounded-full"
            >
              <CheckCircle2 size={18} />
            </button>
          </div>

          {/* 底部操作栏 */}
          <div className="flex items-center justify-between pb-2">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/editor/${params.id}`)}>
              返回编辑
            </Button>

            {voiceEnabled && speechKeywords.length > 0 && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted">
                <Zap size={10} className="text-accent" />
                <span>说"</span>
                {speechKeywords.map((kw, i) => (
                  <span key={i} className="text-accent font-semibold">{kw}</span>
                ))}
                <span>"前进</span>
              </div>
            )}

            <Button variant="destructive" size="sm" onClick={handleFinish}>
              结束流程
            </Button>
          </div>
        </div>
      </div>

      {/* 紧急覆盖层 */}
      <EmergencyOverlay emergency={emergency} onClose={handleEmergencyClose} />

      {/* 确认结束模态框 */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="border border-border max-w-sm w-full mx-4">
            <CardContent className="p-6 text-center">
              <h3 className="text-lg font-bold text-foreground mb-2">确认结束流程？</h3>
              <p className="text-sm text-muted mb-6">
                当前进度：{completedCount}/{sop.steps.length} 步骤已完成
              </p>
              <div className="flex items-center justify-center gap-3">
                <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>
                  继续执行
                </Button>
                <Button variant="destructive" onClick={confirmFinish}>
                  确认结束
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
