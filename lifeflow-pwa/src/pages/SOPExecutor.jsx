import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Mic, MicOff, Clock, CheckCircle2, Circle, AlertTriangle,
  ChevronRight
} from 'lucide-react'
import Header from '../components/Header'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import sopStore from '../store/sopStore'
import { useSpeech, useSpeechRecognition } from '../hooks/useSpeech'
import authStore from '../store/authStore'
import { sopAPI } from '../api'

export default function SOPExecutor() {
  const navigate = useNavigate()
  const params = useParams()
  const { currentSop, setCurrentSop, stepIndex, setStepIndex, nextStep, prevStep, updateStep, startExecution, stopExecution } = sopStore()
  const { speechKeywords, voiceSettings } = authStore()
  const [sop, setSop] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [showTimer, setShowTimer] = useState(false)
  const [currentStepTimer, setCurrentStepTimer] = useState(0)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [recognitionError, setRecognitionError] = useState('')
  const [loading, setLoading] = useState(true)
  
  const timerRef = useRef(null)
  const stepTimerRef = useRef(null)
  const { speak, stop: stopSpeech } = useSpeech(voiceSettings)
  
  const handleSpeechResult = (transcript) => {
    const lowerTranscript = transcript.toLowerCase()
    const matchedKeyword = speechKeywords.find(keyword => 
      lowerTranscript.includes(keyword.toLowerCase())
    )
    
    if (matchedKeyword && stepIndex < (sop?.steps?.length || 0) - 1) {
      nextStep()
      setCurrentStepTimer(0)
    }
  }
  
  const handleSpeechError = (error) => {
    setRecognitionError(error)
    setIsListening(false)
  }
  
  const { startListening, stopListening } = useSpeechRecognition(handleSpeechResult, handleSpeechError)

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

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(prev => prev + 1)
      }, 1000)
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [isPlaying])

  useEffect(() => {
    if (isPlaying) {
      stepTimerRef.current = setInterval(() => {
        setCurrentStepTimer(prev => prev + 1)
      }, 1000)
    }
    return () => {
      if (stepTimerRef.current) {
        clearInterval(stepTimerRef.current)
      }
    }
  }, [isPlaying, stepIndex])

  useEffect(() => {
    if (isPlaying && sop && sop.steps[stepIndex]) {
      const currentStep = sop.steps[stepIndex]
      const text = `${currentStep.title}。${currentStep.description || ''}`
      setIsSpeaking(true)
      speak(text)
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.onend = () => setIsSpeaking(false)
    }
  }, [stepIndex, isPlaying, sop, speak])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false)
      stopExecution()
      stopSpeech()
      if (stepTimerRef.current) clearInterval(stepTimerRef.current)
    } else {
      setIsPlaying(true)
      startExecution()
    }
  }

  const handleNext = () => {
    if (stepIndex < (sop?.steps?.length || 0) - 1) {
      nextStep()
      setCurrentStepTimer(0)
    }
  }

  const handlePrev = () => {
    if (stepIndex > 0) {
      prevStep()
      setCurrentStepTimer(0)
    }
  }

  const handleCompleteStep = (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    if (sop && sop.steps[stepIndex]) {
      setSop(prev => {
        const newSteps = [...prev.steps]
        newSteps[stepIndex] = { ...newSteps[stepIndex], status: 'completed' }
        return { ...prev, steps: newSteps }
      })
      updateStep(stepIndex, { status: 'completed' })
      if (stepIndex < sop.steps.length - 1) {
        nextStep()
        setCurrentStepTimer(0)
      }
    }
  }

  const handleToggleListening = () => {
    if (isListening) {
      stopListening()
      setIsListening(false)
    } else {
      setRecognitionError('')
      startListening()
      setIsListening(true)
    }
  }

  const handleToggleTimer = () => {
    setShowTimer(!showTimer)
  }

  const handleFinish = () => {
    setShowConfirmModal(true)
  }

  const confirmFinish = () => {
    stopExecution()
    setIsPlaying(false)
    stopSpeech()
    navigate('/sops')
  }

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

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-foreground mb-1">{sop.title}</h1>
          <p className="text-sm text-muted">{sop.goal}</p>
        </div>

        <div className="mb-6">
          <div className="h-1 bg-secondary">
            <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted">
            <span>{completedCount}/{sop.steps.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>

        <div className="flex justify-center mb-6">
          <button 
            onClick={handleToggleTimer}
            className="flex items-center gap-2 bg-secondary px-4 py-2 text-sm font-semibold text-accent hover:bg-secondary/80 transition-colors"
          >
            <Clock size={16} />
            <span>{formatTime(timerSeconds)}</span>
          </button>
        </div>

        <div className="flex justify-center gap-2 mb-8">
          {sop.steps.map((step, index) => (
            <button
              key={step.id || index}
              className={`w-2 h-2 transition-all ${
                index === stepIndex ? 'bg-accent scale-125' : 
                step.status === 'completed' ? 'bg-green-500' : 'bg-border'
              }`}
              onClick={() => {
                setStepIndex(index)
                setCurrentStepTimer(0)
              }}
            />
          ))}
        </div>

        <Card className="border-2 border-accent mb-6">
          <CardContent className="p-6 flex gap-4">
            <div className="w-10 h-10 bg-accent text-accentForeground flex items-center justify-center flex-shrink-0 text-lg font-bold">
              {stepIndex + 1}
            </div>

            <div className="flex-1">
              <h2 className="text-lg font-bold text-foreground mb-2">{currentStep.title}</h2>
              
              {currentStep.description && (
                <p className="text-sm text-muted mb-3">{currentStep.description}</p>
              )}

              {currentStep.notes && (
                <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-2 mb-3">
                  <AlertTriangle size={14} />
                  <span>{currentStep.notes}</span>
                </div>
              )}

              <div className="flex items-center gap-4 text-xs text-muted">
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {currentStep.duration} 分钟
                </span>
                {showTimer && (
                  <span>已用: {formatTime(currentStepTimer)}</span>
                )}
              </div>
            </div>

            <div className="flex-shrink-0 pt-1">
              {currentStep.status === 'completed' ? (
                <CheckCircle2 size={28} className="text-green-600" />
              ) : (
                <Circle size={28} className="text-border" />
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-center gap-4">
            <Button variant="ghost" size="sm" onClick={handlePrev} disabled={stepIndex === 0}>
              <SkipBack size={16} />
              上一步
            </Button>

            <Button 
              size="icon" 
              variant={isPlaying ? 'secondary' : 'default'}
              onClick={togglePlay}
              className="w-16 h-16 flex items-center justify-center text-white"
            >
              {isPlaying ? <Pause size={28} className="text-[#3d3d3d]" /> : <Play size={28} />}
            </Button>

            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleNext} 
              disabled={stepIndex === sop.steps.length - 1}
            >
              下一步
              <SkipForward size={16} />
            </Button>
          </div>

          <div className="flex items-center justify-center gap-3">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={handleCompleteStep}
              disabled={currentStep.status === 'completed'}
            >
              <CheckCircle2 size={14} className="mr-1" />
              完成此步骤
            </Button>

            <Button 
              variant="secondary" 
              size="sm"
              onClick={() => {
                if (isSpeaking) {
                  stopSpeech()
                  setIsSpeaking(false)
                } else if (currentStep) {
                  setIsSpeaking(true)
                  speak(`${currentStep.title}。${currentStep.description || ''}`)
                }
              }}
            >
              {isSpeaking ? <VolumeX size={14} className="mr-1" /> : <Volume2 size={14} className="mr-1" />}
              {isSpeaking ? '停止播报' : '语音播报'}
            </Button>

            <Button 
              variant={isListening ? 'default' : 'secondary'} 
              size="sm"
              onClick={handleToggleListening}
            >
              {isListening ? <MicOff size={14} className="mr-1" /> : <Mic size={14} className="mr-1" />}
              {isListening ? '停止声控' : '声控模式'}
            </Button>
          </div>
        </div>

        {isListening && (
          <div className="mt-6 bg-green-50 px-4 py-3 animate-pulse">
            <div className="flex items-center justify-center gap-2 text-sm text-green-700 mb-2">
              <Mic size={16} />
              <span>🎤 正在听... 说以下关键词推进流程</span>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {speechKeywords.map((keyword, i) => (
                <span key={i} className="bg-white px-3 py-1 text-sm text-green-600 border border-green-300">
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {recognitionError && (
          <div className="mt-6 flex items-center justify-center gap-2 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle size={16} />
            <span>{recognitionError}</span>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between pt-6 border-t border-border">
          <Button variant="secondary" size="sm" onClick={() => navigate(`/editor/${params.id}`)}>
            返回编辑
          </Button>
          <Button variant="destructive" size="sm" onClick={handleFinish}>
            结束流程
          </Button>
        </div>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="border border-border max-w-sm w-full mx-4">
            <CardContent className="p-6 text-center">
              <h3 className="text-lg font-bold text-foreground mb-2">确认结束流程？</h3>
              <p className="text-sm text-muted mb-6">当前进度：{completedCount}/{sop.steps.length} 步骤已完成</p>
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
