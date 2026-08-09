import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Send, Loader2, MessageCircle, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'
import Header from '../components/Header'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import { Textarea } from '../components/ui/Textarea'
import { sopAPI } from '../api'
import sopStore from '../store/sopStore'
import { useSound } from '../hooks/useSound'

const exampleGoals = [
  '今晚 7 点前准备四菜一汤',
  '周六上午完成全屋清洁',
  '明天带孩子出门露营，需要准备行李',
  '孩子睡前流程',
]

const mockSOP = {
  id: 'mock-' + Date.now(),
  title: '家庭晚餐：四菜一汤',
  goal: '今晚 7 点前准备四菜一汤',
  constraints: {},
  steps: [
    { id: 1, title: '准备工作', duration: 5, description: '洗手、系围裙、准备好所有厨具', status: 'pending', dependencies: [] },
    { id: 2, title: '处理食材', duration: 15, description: '洗净蔬菜、切配肉类', status: 'pending', dependencies: [] },
    { id: 3, title: '烹饪主菜', duration: 30, description: '依次烹饪四道菜', status: 'pending', dependencies: [2] },
    { id: 4, title: '煮汤', duration: 20, description: '准备汤品', status: 'pending', dependencies: [2] },
    { id: 5, title: '出锅摆盘', duration: 5, description: '所有菜品装盘', status: 'pending', dependencies: [3, 4] },
  ],
  estimatedTotalTime: 75,
  createdAt: new Date().toISOString(),
}

const MAX_QUESTIONS = 7

// 归一化文本：去除标点和空格，用于去重比较
const normalizeText = (text) => (text || '').replace(/[？?！!，,。.\s()（）""''""'']/g, '').toLowerCase()

// 检查新问题是否与历史问题重复
const isDuplicateQuestion = (newQuestion, history) => {
  const normalizedNew = normalizeText(newQuestion)
  if (!normalizedNew || normalizedNew.length < 2) return false
  return history.some(item => {
    const normalizedOld = normalizeText(item.question)
    if (normalizedNew === normalizedOld) return true
    const shorter = normalizedNew.length < normalizedOld.length ? normalizedNew : normalizedOld
    const longer = normalizedNew.length < normalizedOld.length ? normalizedOld : normalizedNew
    if (shorter.length > 4 && longer.includes(shorter)) return true
    return false
  })
}


export default function SOPGenerator() {
  const navigate = useNavigate()
  const { setCurrentSop } = sopStore()
  const { playClick, playSuccess, playError } = useSound()
  const [goal, setGoal] = useState('')
  const [phase, setPhase] = useState('input') // input | chat | generating
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [answers, setAnswers] = useState({})
  const [currentQuestion, setCurrentQuestion] = useState(null)
  // gatekeeper 仅用于内部追问处理，前端不再展示 7 维度/报告/失败通知
  const [gatekeeper, setGatekeeper] = useState(null)
  const [blockReason, setBlockReason] = useState('')
  const [thinkingSteps, setThinkingSteps] = useState([])
  const [showThinking, setShowThinking] = useState(false)
  const chatRef = useRef(null)

  const conversationHistoryRef = useRef([])
  const answersRef = useRef({})
  const constraintsRef = useRef({})  // 保留后端 enrich 后的 _gatekeeper

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages])

  const handleStartChat = () => {
    if (!goal.trim()) {
      setError('请输入生活目标')
      playError()
      return
    }
    playClick()
    setPhase('chat')
    setGatekeeper(null)
    setBlockReason('')
    setThinkingSteps([])
    setShowThinking(false)
    setMessages([
      {
        id: 1,
        role: 'system',
        content: `好的！我来帮你规划「${goal}」的详细流程。我会通过几个问题逐步了解你的需求，然后生成可落地的 SOP。`,
      },
    ])
    setError('')
    conversationHistoryRef.current = []
    answersRef.current = {}
    constraintsRef.current = {}
    askQuestion()
  }

  const appendThinking = (step) => {
    setThinkingSteps(prev => {
      if (prev[prev.length - 1]?.pending) {
        return [...prev.slice(0, -1), { ...prev[prev.length - 1], text: step }]
      }
      return [...prev, { text: step, pending: true }]
    })
  }

  const finalizeThinking = (finalStep) => {
    setThinkingSteps(prev => {
      if (prev.length === 0) return [{ text: finalStep, pending: false }]
      return [...prev.slice(0, -1), { text: finalStep, pending: false }]
    })
    setTimeout(() => setShowThinking(false), 800)
  }

  const askQuestion = () => {
    setLoading(true)
    appendThinking('正在分析已收集的信息…')
    const history = conversationHistoryRef.current
    const currentAnswers = answersRef.current

    sopAPI.askStream(
      goal,
      [],
      currentAnswers,
      history,
      {
        onChunk: () => {
          // ask 阶段不再显示中间流式内容，统一使用"思考中"加载态，避免两个思考中
        },
        onDone: (response) => {
          const followUpQuestions = response.questions || []
          if (followUpQuestions.length > 0) {
            const question = followUpQuestions[0]
            if (isDuplicateQuestion(question.text, history)) {
              finalizeThinking('发现重复问题，继续追问…')
              askQuestion()
              setLoading(false)
              setInputValue('')
              return
            }
            setCurrentQuestion({
              id: Date.now(),
              text: question.text,
              type: question.type || 'input',
              options: question.options || [],
            })
            setMessages(prev => [...prev, {
              id: Date.now(),
              role: 'assistant',
              content: question.text,
              options: question.options || [],
              isStreaming: false,
            }])
            finalizeThinking('已确定下一个需要确认的问题')
          } else {
            appendThinking('信息看起来已足够，正在提交最终审核…')
            setPhase('generating')
            handleGenerate()
          }
          setLoading(false)
          setInputValue('')
        },
        onError: (err) => {
          setError(err.message)
          playError()
          setCurrentSop(mockSOP)
          navigate('/editor')
          setLoading(false)
        },
      }
    )
  }

  const handleSend = async (answer = null) => {
    const finalAnswer = answer || inputValue.trim()
    if (!finalAnswer) { playError(); return }
    playClick()
    if (currentQuestion) {
      conversationHistoryRef.current = [
        ...conversationHistoryRef.current,
        { question: currentQuestion.text, answer: finalAnswer },
      ]
      answersRef.current = {
        ...answersRef.current,
        [currentQuestion.id]: finalAnswer,
      }
    }
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: finalAnswer }])
    setAnswers(prev => ({ ...prev, [currentQuestion?.id]: finalAnswer }))
    setInputValue('')
    askQuestion()
  }

  /**
   * 提交 generate。后端会先跑 Gatekeeper；信息不足时返回 blocked + followupQuestions，
   * 前端不跳转 /editor，而是继续在 chat 阶段把缺失问题问完。
   */
  const handleGenerate = async () => {
    setLoading(true)
    setError('')
    appendThinking('正在做最终信息完整性审核…')
    try {
      const constraints = {
        ...(constraintsRef.current || {}),
        conversationHistory: conversationHistoryRef.current,
        answers: answersRef.current,
      }
      const response = await sopAPI.generate(goal, constraints)

      // ===== 信息不足拦截 =====
      if (response.blocked) {
        setGatekeeper(response.gatekeeper || null)
        setBlockReason(response.reason || '')
        if (response.constraints) constraintsRef.current = response.constraints

        const fqs = (response.followupQuestions || []).filter(q => q && q.text)
        if (fqs.length > 0) {
          const firstQ = fqs[0]
          if (!isDuplicateQuestion(firstQ.text, conversationHistoryRef.current)) {
            const qid = firstQ.id || Date.now()
            const normQ = { id: qid, text: firstQ.text, type: 'input', options: [] }
            setCurrentQuestion(normQ)
            setMessages(prev => [...prev, {
              id: qid,
              role: 'assistant',
              content: normQ.text,
              options: [],
              isStreaming: false,
            }])
          } else {
            _enqueueGatekeeperFollowups(fqs.slice(1))
          }
        }
        finalizeThinking('信息还需补充，继续提问')
        setPhase('chat')
        setLoading(false)
        return
      }

      // ===== 通过，正常生成 =====
      finalizeThinking('信息完整，正在生成 SOP')
      setMessages(prev => [...prev, { id: Date.now(), role: 'system', content: '信息完整！正在生成你的 SOP…' }])
      setGatekeeper(null)
      setBlockReason('')

      const sop = response.sop || mockSOP
      setCurrentSop(sop)
      playSuccess()
      navigate('/editor')
    } catch (err) {
      setError(err.message)
      playError()
      setCurrentSop(mockSOP)
      navigate('/editor')
    } finally {
      setLoading(false)
    }
  }

  /**
   * 如果第一个 followup 重复了，继续尝试后续 followup
   */
  const _enqueueGatekeeperFollowups = (remaining) => {
    const history = conversationHistoryRef.current
    for (const q of remaining) {
      if (!isDuplicateQuestion(q.text, history)) {
        const qid = q.id || Date.now()
        const normQ = { id: qid, text: q.text, type: 'input', options: [] }
        setCurrentQuestion(normQ)
        setMessages(prev => [...prev, {
          id: qid, role: 'assistant', content: normQ.text, options: [], isStreaming: false,
        }])
        return
      }
    }
    // 所有 followup 都重复了，重新触发 generate
    setTimeout(() => {
      setPhase('generating')
      handleGenerate()
    }, 200)
  }

  const handleBack = () => {
    playClick()
    setPhase('input')
    setMessages([])
    setAnswers({})
    setCurrentQuestion(null)
    setGatekeeper(null)
    setBlockReason('')
    conversationHistoryRef.current = []
    answersRef.current = {}
    constraintsRef.current = {}
  }

  return (
    <div className="min-h-screen bg-[#fff8f0]">
      <Header />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        {phase === 'input' && (
          <Card className="border-2 border-[#ffd4b8] shadow-lg">
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-[#3d3d3d] mb-2">✨ 创建生活 SOP ✨</h1>
                <p className="text-sm text-[#9a9a9a]">描述你的生活目标，AI 会帮你拆解成可执行的步骤</p>
              </div>

              {error && (
                <div className="bg-red-50 border-2 border-red-200 text-red-600 px-4 py-3 text-sm mb-6 flex items-center gap-2 rounded-lg">
                  {error}
                </div>
              )}

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[#3d3d3d]">🎯 生活目标</label>
                  <Textarea
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="例如：今晚 7 点前准备四菜一汤..."
                    rows={4}
                    className="h-32 border-2 border-[#ffd4b8] bg-white focus:border-[#ff8c42] focus:ring-2 focus:ring-[#ff8c42]/20 transition-all resize-none"
                  />
                </div>

                <div className="bg-[#ffe8d6] p-4 border-2 border-dashed border-[#ffd4b8] rounded-xl">
                  <p className="text-xs font-semibold text-[#ff8c42] mb-3">💡 试试这些例子：</p>
                  <div className="flex flex-wrap gap-2">
                    {exampleGoals.map((ex, i) => (
                      <button
                        key={i}
                        onClick={() => { playClick(); setGoal(ex) }}
                        className="border-2 border-[#ffd4b8] px-3 py-1.5 text-xs text-[#3d3d3d] hover:border-[#ff8c42] hover:bg-white transition-all active:scale-95 rounded-full bg-white/80"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>

                              <Button size="lg" className="w-full bg-[#ff8c42] hover:bg-[#e07a36] text-white shadow-lg" onClick={handleStartChat}>
                  <Sparkles size={18} className="mr-2" />
                  开始规划
                  <ArrowRight size={18} className="ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {(phase === 'chat' || phase === 'generating') && (
          <div className="space-y-4">
            {/* 质量评估与报告输出已移入后端，前端不再展示；仅保留用于内部追问的 followup 处理。 */}

            {/* ========== 对话区 ========== */}
            <div className="border-2 border-[#ffd4b8] shadow-lg rounded-xl h-[calc(100vh-260px)] min-h-[460px] flex flex-col bg-white overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#ffd4b8] bg-[#fff8f0]">
                <div className="flex items-center gap-2">
                  <MessageCircle size={18} className="text-[#ff8c42]" />
                  <span className="font-semibold text-[#3d3d3d]">AI 规划助手</span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleBack}>
                  返回
                </Button>
              </div>

              <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
                {messages.map((message, index) => {
                  const isLatestAssistant = (message.role === 'assistant' || message.role === 'system') && index === messages.length - 1 && !loading
                  return (
                    <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full text-sm ${
                        message.role === 'user' ? 'bg-[#ff8c42] text-white'
                          : message.role === 'system' ? 'bg-[#ffe8d6] text-[#ff8c42]'
                          : 'bg-[#f0f0f0] text-[#3d3d3d]'
                      }`}>
                        {message.role === 'user' ? '👤' : message.role === 'system' ? '✨' : '🤔'}
                      </div>
                      <div className={`max-w-[82%] ${message.role === 'user' ? 'text-right' : ''}`}>
                        <div className={`px-4 py-2 rounded-2xl whitespace-pre-wrap ${
                          message.role === 'user' ? 'bg-[#ff8c42] text-white rounded-br-md'
                            : message.role === 'system' ? 'bg-[#ffe8d6] text-[#3d3d3d] rounded-bl-md'
                            : 'bg-[#f0f0f0] text-[#3d3d3d] rounded-bl-md'
                        }`}>
                          <p className="text-sm leading-relaxed">{message.content}</p>
                          {isLatestAssistant && message.options && message.options.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3 justify-start">
                              {message.options.map((option, i) => (
                                <button key={i} onClick={() => handleSend(option)}
                                  className="px-3 py-1 text-xs rounded-full border-2 border-[#ffd4b8] bg-white text-[#3d3d3d] hover:border-[#ff8c42] hover:bg-[#fff8f0] transition-all active:scale-95">
                                  {option}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {loading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-[#f0f0f0] text-[#3d3d3d]">
                      🤔
                    </div>
                    <div className="bg-[#f0f0f0] text-[#3d3d3d] px-4 py-2 rounded-2xl rounded-bl-md max-w-[82%]">
                      <div className="flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin" />
                        <span className="text-sm">思考中…</span>
                      </div>
                      {thinkingSteps.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-[#e0e0e0]">
                          <button
                            onClick={() => setShowThinking(v => !v)}
                            className="flex items-center gap-1 text-[11px] text-[#6b6b6b] hover:text-[#ff8c42] transition-colors"
                          >
                            {showThinking ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            {showThinking ? '收起思考过程' : '查看思考过程'}
                          </button>
                          {showThinking && (
                            <ol className="mt-2 space-y-1 text-[11px] text-[#6b6b6b] leading-snug list-decimal list-inside">
                              {thinkingSteps.map((step, i) => (
                                <li key={i} className={step.pending ? 'text-[#ff8c42] font-medium' : ''}>
                                  {step.text}
                                </li>
                              ))}
                            </ol>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {phase === 'chat' && !loading && currentQuestion && (
                <div className="p-4 border-t border-[#ffd4b8] bg-[#fff8f0]">
                  <div className="flex gap-2">
                    <Textarea
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleSend()
                        }
                      }}
                      placeholder={currentQuestion?.options?.length > 0 ? '可选择上方选项，也可以直接输入你的回答...' : '输入你的回答...'}
                      rows={1}
                      className="flex-1 h-10 border-2 border-[#ffd4b8] bg-white focus:border-[#ff8c42] focus:ring-2 focus:ring-[#ff8c42]/20 resize-none"
                    />
                    <Button onClick={() => handleSend()} disabled={!inputValue.trim() || loading}>
                      <Send size={16} className="mr-1" />
                      发送
                    </Button>
                  </div>
                </div>
              )}

              {phase === 'generating' && (
                <div className="p-4 border-t border-[#ffd4b8] bg-[#ffe8d6]">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 size={20} className="animate-spin text-[#ff8c42]" />
                    <span className="text-sm font-semibold text-[#ff8c42]">正在生成你的 SOP...</span>
                  </div>
                  <p className="text-xs text-center text-[#9a9a9a] mt-2">请稍候，AI 正在为你规划最佳步骤</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
