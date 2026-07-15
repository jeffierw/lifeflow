import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Volume2, Mic, Save, ArrowLeft, RotateCcw, Loader2 } from 'lucide-react'
import Header from '../components/Header'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import authStore from '../store/authStore'
import { useSound } from '../hooks/useSound'
import { settingsAPI } from '../api'
import Toast from '../components/Toast'

export default function Settings() {
  const navigate = useNavigate()
  const { voiceSettings, setVoiceSettings, speechKeywords, setSpeechKeywords } = authStore()
  const { playClick, playSuccess } = useSound()
  const [voices, setVoices] = useState([])
  const [selectedVoice, setSelectedVoice] = useState(voiceSettings.voiceName || '')
  const [pitch, setPitch] = useState(voiceSettings.pitch)
  const [rate, setRate] = useState(voiceSettings.rate)
  const [keywords, setKeywords] = useState(speechKeywords.join('，'))
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

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

  const handleSave = async () => {
    playClick()
    setSaving(true)
    
    const newVoiceSettings = {
      voiceName: selectedVoice,
      pitch: parseFloat(pitch),
      rate: parseFloat(rate),
    }
    
    const keywordArray = keywords.split('，').map(k => k.trim()).filter(k => k)
    const newSpeechKeywords = keywordArray.length > 0 ? keywordArray : ['下一步', '哈吉米']
    
    try {
      await settingsAPI.saveSettings({
        voiceSettings: newVoiceSettings,
        speechKeywords: newSpeechKeywords,
      })
      
      setVoiceSettings(newVoiceSettings)
      setSpeechKeywords(newSpeechKeywords)
      
      setSaved(true)
      playSuccess()
      setToast({ message: '保存成功！', type: 'success' })
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error('保存失败:', error)
      setToast({ message: '保存失败，请重试', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handlePreview = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance('你好，这是语音预览')
      utterance.lang = 'zh-CN'
      utterance.pitch = parseFloat(pitch)
      utterance.rate = parseFloat(rate)
      
      const voice = voices.find(v => v.name === selectedVoice)
      if (voice) {
        utterance.voice = voice
      }
      
      window.speechSynthesis.speak(utterance)
    }
  }

  const handleReset = () => {
    playClick()
    setSelectedVoice('')
    setPitch(1.1)
    setRate(1)
    setKeywords('下一步，哈吉米')
  }

  return (
    <div className="min-h-screen bg-[#fff8f0]">
      <Header />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button 
            className="w-10 h-10 border-2 border-[#ffd4b8] bg-white flex items-center justify-center hover:border-[#ff8c42] transition-colors"
            onClick={() => {
              playClick()
              navigate(-1)
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-[#3d3d3d]">⚙️ 设置</h1>
        </div>

        <Card className="border-2 border-[#ffd4b8] shadow-lg mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Volume2 size={24} className="text-[#ff8c42]" />
              <h2 className="text-lg font-bold text-[#3d3d3d]">语音设置</h2>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[#3d3d3d]">选择音色</label>
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="w-full h-12 border-2 border-[#ffd4b8] bg-white px-3 text-[#3d3d3d] focus:border-[#ff8c42] focus:ring-2 focus:ring-[#ff8c42]/20 transition-all"
                >
                  <option value="">系统默认（甜美女声）</option>
                  {voices.map((voice) => (
                    <option key={voice.name} value={voice.name}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[#3d3d3d]">音调 (0.5-2.0)</label>
                  <Input
                    type="number"
                    value={pitch}
                    onChange={(e) => setPitch(e.target.value)}
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    className="h-12 border-2 border-[#ffd4b8] bg-white focus:border-[#ff8c42] focus:ring-2 focus:ring-[#ff8c42]/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[#3d3d3d]">语速 (0.5-2.0)</label>
                  <Input
                    type="number"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    className="h-12 border-2 border-[#ffd4b8] bg-white focus:border-[#ff8c42] focus:ring-2 focus:ring-[#ff8c42]/20"
                  />
                </div>
              </div>

              <Button variant="secondary" onClick={handlePreview} className="w-full">
                <Volume2 size={16} className="mr-2" />
                预览语音效果
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-[#ffd4b8] shadow-lg mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Mic size={24} className="text-[#ff8c42]" />
              <h2 className="text-lg font-bold text-[#3d3d3d]">语音控制关键词</h2>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
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
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" onClick={handleReset} className="flex-1">
            <RotateCcw size={16} className="mr-2" />
            重置
          </Button>
          <Button onClick={handleSave} className="flex-1" loading={saving}>
            {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
            {saved ? '已保存!' : '保存设置'}
          </Button>
        </div>
      </div>
    </div>
  )
}
