import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Volume2, Mic, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import authStore from '../store/authStore'
import { useSound } from '../hooks/useSound'

export default function Onboarding() {
  const navigate = useNavigate()
  const { setVoiceSettings, setSpeechKeywords, completeOnboarding } = authStore()
  const { playClick, playSuccess } = useSound()
  const [step, setStep] = useState(1)
  const [voices, setVoices] = useState([])
  const [selectedVoice, setSelectedVoice] = useState('')
  const [keywords, setKeywords] = useState('下一步，哈吉米')
  const [completedSteps, setCompletedSteps] = useState([])

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices()
      const zhVoices = availableVoices.filter(v => v.lang.includes('zh'))
      setVoices(zhVoices)
    }

    if ('speechSynthesis' in window) {
      loadVoices()
      window.speechSynthesis.onvoiceschanged = loadVoices
    }
  }, [])

  const handleNext = () => {
    playClick()
    if (step < 3) {
      setStep(step + 1)
      setCompletedSteps([...completedSteps, step])
    } else {
      handleFinish()
    }
  }

  const handleFinish = () => {
    playSuccess()
    
    setVoiceSettings({
      voiceName: selectedVoice,
      pitch: 1.1,
      rate: 1,
    })
    
    const keywordArray = keywords.split('，').map(k => k.trim()).filter(k => k)
    setSpeechKeywords(keywordArray.length > 0 ? keywordArray : ['下一步', '哈吉米'])
    
    completeOnboarding()
    navigate('/')
  }

  const handlePreview = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance('你好，欢迎来到 LifeFlow')
      utterance.lang = 'zh-CN'
      utterance.pitch = 1.1
      
      const voice = voices.find(v => v.name === selectedVoice)
      if (voice) {
        utterance.voice = voice
      }
      
      window.speechSynthesis.speak(utterance)
    }
  }

  return (
    <div className="min-h-screen bg-[#fff8f0] flex items-center justify-center">
      <div className="max-w-md mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 flex items-center justify-center text-sm font-bold transition-all ${
                completedSteps.includes(s) 
                  ? 'bg-[#ff8c42] text-white' 
                  : step === s 
                    ? 'bg-[#ff8c42] text-white animate-pulse'
                    : 'bg-[#ffd4b8] text-[#9a9a9a]'
              }`}>
                {completedSteps.includes(s) ? <CheckCircle2 size={16} /> : s}
              </div>
              {s < 3 && <div className={`w-8 h-1 ${step > s ? 'bg-[#ff8c42]' : 'bg-[#ffd4b8]'}`} />}
            </div>
          ))}
        </div>

        <Card className="border-2 border-[#ffd4b8] shadow-lg">
          <CardContent className="p-8">
            {step === 1 && (
              <div className="text-center space-y-6 animate-slide-in">
                <div className="w-20 h-20 bg-[#ffe8d6] text-[#ff8c42] flex items-center justify-center mx-auto">
                  <Sparkles size={40} className="animate-bounce" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-[#3d3d3d] mb-2">🎉 欢迎来到 LifeFlow!</h1>
                  <p className="text-sm text-[#9a9a9a]">让我们一起设置你的专属体验</p>
                </div>
                <div className="bg-[#ffe8d6] p-4 text-left">
                  <p className="text-sm text-[#3d3d3d]">
                    LifeFlow 是你的生活 SOP 编排器，帮助你把复杂的生活任务拆解成简单的步骤。无论是做饭、打扫还是旅行准备，都能轻松搞定！
                  </p>
                </div>
                <Button onClick={handleNext} className="w-full">
                  开始设置
                  <ArrowRight size={18} className="ml-2" />
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 animate-slide-in">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#ffe8d6] text-[#ff8c42] flex items-center justify-center">
                    <Volume2 size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#3d3d3d]">选择语音</h2>
                    <p className="text-sm text-[#9a9a9a]">设置你喜欢的播报音色</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-semibold text-[#3d3d3d]">选择音色</label>
                  <select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="w-full h-12 border-2 border-[#ffd4b8] bg-white px-3 text-[#3d3d3d] focus:border-[#ff8c42] focus:ring-2 focus:ring-[#ff8c42]/20"
                  >
                    <option value="">系统默认（甜美女声）</option>
                    {voices.map((voice) => (
                      <option key={voice.name} value={voice.name}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))}
                  </select>
                </div>

                <Button variant="secondary" onClick={handlePreview} className="w-full">
                  <Volume2 size={16} className="mr-2" />
                  试听语音效果
                </Button>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => {
                    playClick()
                    setStep(1)
                  }}>上一步</Button>
                  <Button onClick={handleNext}>下一步</Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6 animate-slide-in">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#ffe8d6] text-[#ff8c42] flex items-center justify-center">
                    <Mic size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#3d3d3d]">语音控制</h2>
                    <p className="text-sm text-[#9a9a9a]">设置声控关键词</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-semibold text-[#3d3d3d]">关键词（用中文逗号分隔）</label>
                  <Input
                    type="text"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder="例如：下一步，哈吉米，继续"
                    className="h-12 border-2 border-[#ffd4b8] bg-white focus:border-[#ff8c42] focus:ring-2 focus:ring-[#ff8c42]/20"
                  />
                  <p className="text-xs text-[#9a9a9a]">执行 SOP 时，说出这些关键词可以自动进入下一步</p>
                </div>

                <div className="bg-[#ffe8d6] p-4">
                  <p className="text-sm text-[#3d3d3d] font-semibold mb-2">当前关键词：</p>
                  <div className="flex flex-wrap gap-2">
                    {keywords.split('，').map((k, i) => (
                      <span key={i} className="bg-white px-3 py-1 text-sm text-[#ff8c42] border-2 border-[#ffd4b8]">
                        {k.trim()}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => {
                    playClick()
                    setStep(2)
                  }}>上一步</Button>
                  <Button onClick={handleFinish} className="flex-1">
                    <CheckCircle2 size={16} className="mr-2" />
                    完成设置
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
