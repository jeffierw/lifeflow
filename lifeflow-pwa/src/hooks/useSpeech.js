import { useCallback, useRef, useState, useEffect } from 'react'

export const useSpeech = (voiceSettings = {}) => {
  const utteranceRef = useRef(null)
  const [voices, setVoices] = useState([])
  const [selectedVoice, setSelectedVoice] = useState(null)

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices()
      setVoices(availableVoices)
      
      const zhVoices = availableVoices.filter(v => v.lang.includes('zh'))
      if (zhVoices.length > 0) {
        const femaleVoice = zhVoices.find(v => 
          v.name.includes('Female') || 
          v.name.includes('Lili') || 
          v.name.includes('Xiaoxiao') ||
          v.name.includes('Mei') ||
          v.name.includes('Yunxi')
        ) || zhVoices[0]
        setSelectedVoice(femaleVoice)
      }
    }

    if ('speechSynthesis' in window) {
      loadVoices()
      window.speechSynthesis.onvoiceschanged = loadVoices
    }

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const speak = useCallback((text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'zh-CN'
      utterance.rate = voiceSettings.rate || 1
      utterance.pitch = voiceSettings.pitch || 1.1
      utterance.volume = 1
      
      const availableVoices = window.speechSynthesis.getVoices()
      
      if (voiceSettings.voiceName) {
        const configuredVoice = availableVoices.find(v => v.name === voiceSettings.voiceName)
        if (configuredVoice) {
          utterance.voice = configuredVoice
        }
      } else if (selectedVoice) {
        utterance.voice = selectedVoice
      } else {
        const zhVoices = availableVoices.filter(v => v.lang.includes('zh'))
        if (zhVoices.length > 0) {
          const femaleVoice = zhVoices.find(v => 
            v.name.includes('Female') || 
            v.name.includes('Lili') || 
            v.name.includes('Xiaoxiao') ||
            v.name.includes('Mei') ||
            v.name.includes('Yunxi') ||
            v.name.includes('Google')
          ) || zhVoices[0]
          utterance.voice = femaleVoice
        }
      }
      
      utteranceRef.current = utterance
      window.speechSynthesis.speak(utterance)
    }
  }, [selectedVoice, voiceSettings])

  const stop = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }, [])

  return { speak, stop, voices, selectedVoice, setSelectedVoice }
}

export const useSpeechRecognition = (onResult, onError) => {
  const recognitionRef = useRef(null)
  const listeningRef = useRef(false)

  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      onError?.('您的浏览器不支持语音识别')
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    
    recognition.lang = 'zh-CN'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join('')
      onResult?.(transcript)
    }

    recognition.onerror = (event) => {
      onError?.(event.error)
    }

    recognition.onend = () => {
      if (listeningRef.current) {
        recognition.start()
      }
    }

    recognitionRef.current = recognition
    listeningRef.current = true
    recognition.start()
  }, [onResult, onError])

  const stopListening = useCallback(() => {
    listeningRef.current = false
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
  }, [])

  return { startListening, stopListening }
}

export default useSpeech
