import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Send, Loader2, MessageCircle, ArrowRight } from 'lucide-react'
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

export default function SOPGenerator() {
  const navigate = useNavigate()
  const { setCurrentSop } = sopStore()
  const { playClick, playSuccess, playError } = useSound()
  const [goal, setGoal] = useState('')
  const [phase, setPhase] = useState('input')
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [answers, setAnswers] = useState({})
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const chatRef = useRef(null)

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
    setMessages([
      {
        id: 1,
        role: 'system',
        content: `好的！我来帮你规划「${goal}」的详细流程。`,
      },
    ])
    setError('')
    askQuestion()
  }

  const askQuestion = () => {
    setLoading(true)

    const conversationHistory = []
    let lastQuestion = null
    messages.filter(m => m.role === 'user' || m.role === 'assistant').forEach((msg) => {
      if (msg.role === 'assistant') {
        lastQuestion = msg.content
      } else if (msg.role === 'user' && lastQuestion) {
        conversationHistory.push({
          question: lastQuestion,
          answer: msg.content,
        })
        lastQuestion = null
      }
    })

    const thinkingMessageId = Date.now()
    setMessages(prev => [...prev, {
      id: thinkingMessageId,
      role: 'assistant',
      content: '思考中...',
      isStreaming: true,
    }])

    sopAPI.askStream(
      goal,
      currentQuestion ? [currentQuestion] : [],
      answers,
      conversationHistory,
      {
        onChunk: (_chunk, fullContent) => {
          // 实时显示累积的 AI 输出（本地/无 API key 时可能是 JSON 文本）
          setMessages(prev => prev.map(msg =>
            msg.id === thinkingMessageId
              ? { ...msg, content: fullContent }
              : msg
          ))
        },
        onDone: (response) => {
          const followUpQuestions = response.questions || []

          if (followUpQuestions.length > 0) {
            const question = followUpQuestions[0]
            setCurrentQuestion({
              id: Date.now(),
              text: question.text,
              type: question.type || 'input',
              options: question.options || [],
            })

            setMessages(prev => prev.map(msg =>
              msg.id === thinkingMessageId
                ? {
                    ...msg,
                    content: question.text,
                    options: question.options || [],
                    isStreaming: false,
                  }
                : msg
            ))
          } else {
            setMessages(prev => prev.filter(msg => msg.id !== thinkingMessageId))
            setMessages(prev => [...prev, {
              id: Date.now(),
              role: 'system',
              content: '信息已足够！正在为你生成详细的 SOP...',
            }])
            setPhase('generating')
            handleGenerate()
          }

          setLoading(false)
          setInputValue('')
        },
        onError: (err) => {
          setMessages(prev => prev.filter(msg => msg.id !== thinkingMessageId))
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
    if (!finalAnswer) {
      playError()
      return
    }
    playClick()
    
    setMessages(prev => [...prev, {
      id: Date.now(),
      role: 'user',
      content: finalAnswer,
    }])
    
    if (currentQuestion) {
      setAnswers(prev => ({ ...prev, [currentQuestion.id]: finalAnswer }))
    }
    
    setInputValue('')
    await askQuestion()
  }

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const response = await sopAPI.generate(goal, {})
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

  const handleExampleClick = (ex) => {
    playClick()
    setGoal(ex)
  }

  const handleBack = () => {
    playClick()
    setPhase('input')
    setMessages([])
    setAnswers({})
    setCurrentQuestion(null)
  }

  return (
    <div className="min-h-screen bg-[#fff8f0]">
      <Header />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {phase === 'input' && (
          <Card className="border-2 border-[#ffd4b8] shadow-lg">
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-[#3d3d3d] mb-2">✨ 创建生活 SOP ✨</h1>
                <p className="text-sm text-[#9a9a9a]">描述你的生活目标，AI 会帮你拆解成可执行的步骤</p>
              </div>

              {error && (
                <div className="bg-red-50 border-2 border-red-200 text-red-600 px-4 py-3 text-sm mb-6 flex items-center gap-2">
                  <span>⚠️</span>
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

                <div className="bg-[#ffe8d6] p-4 border-2 border-dashed border-[#ffd4b8]">
                  <p className="text-xs font-semibold text-[#ff8c42] mb-3">💡 试试这些例子：</p>
                  <div className="flex flex-wrap gap-2">
                    {exampleGoals.map((ex, i) => (
                      <button
                        key={i}
                        onClick={() => handleExampleClick(ex)}
                        className="border-2 border-[#ffd4b8] px-3 py-1.5 text-xs text-[#3d3d3d] hover:border-[#ff8c42] hover:bg-white transition-all active:scale-95"
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
          <div className="border-2 border-[#ffd4b8] shadow-lg rounded-xl h-[calc(100vh-200px)] flex flex-col bg-white overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#ffd4b8] bg-[#fff8f0]">
              <div className="flex items-center gap-2">
                <MessageCircle size={18} className="text-[#ff8c42]" />
                <span className="font-semibold text-[#3d3d3d]">AI 规划助手</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleBack}>
                返回
              </Button>
            </div>

            <div 
              ref={chatRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 bg-white"
            >
              {messages.map((message, index) => {
                const isLatestAssistant = message.role === 'assistant' && index === messages.length - 1 && !loading
                return (
                  <div 
                    key={message.id} 
                    className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <div className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full ${
                      message.role === 'user' 
                        ? 'bg-[#ff8c42] text-white' 
                        : message.role === 'system' 
                          ? 'bg-[#ffe8d6] text-[#ff8c42]'
                          : 'bg-[#f0f0f0] text-[#3d3d3d]'
                    }`}>
                      {message.role === 'user' ? '👤' : message.role === 'system' ? '🤖' : '🤔'}
                    </div>
                    <div className={`max-w-[75%] ${message.role === 'user' ? 'text-right' : ''}`}>
                      <div className={`px-4 py-2 rounded-2xl ${
                        message.role === 'user' 
                          ? 'bg-[#ff8c42] text-white rounded-br-md' 
                          : message.role === 'system'
                            ? 'bg-[#ffe8d6] text-[#3d3d3d] rounded-bl-md'
                            : 'bg-[#f0f0f0] text-[#3d3d3d] rounded-bl-md'
                      }`}>
                        <p className="text-sm">{message.content}</p>
                        {isLatestAssistant && message.options && message.options.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3 justify-start">
                            {message.options.map((option, i) => (
                              <button
                                key={i}
                                onClick={() => handleSend(option)}
                                className="px-3 py-1 text-xs rounded-full border-2 border-[#ffd4b8] bg-white text-[#3d3d3d] hover:border-[#ff8c42] hover:bg-[#fff8f0] transition-all active:scale-95"
                              >
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
                  <div className="bg-[#f0f0f0] text-[#3d3d3d] px-4 py-2 rounded-2xl rounded-bl-md">
                    <div className="flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      <span className="text-sm">思考中...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {phase === 'chat' && !loading && currentQuestion?.type !== 'choice' && (
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
                    placeholder="输入你的回答..."
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
                  <span className="text-sm font-semibold text-[#ff8c42]">正在生成详细的 SOP 流程...</span>
                </div>
                <p className="text-xs text-center text-[#9a9a9a] mt-2">请稍候，AI 正在为你规划最佳步骤</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}