import { useState, useEffect, useRef, useCallback } from 'react'

// Agent 类型定义：根据步骤内容关键词匹配专业 Agent
export const AGENT_TYPES = {
  ingredient: {
    name: '食材准备',
    icon: '🥬',
    color: '#4caf50',
    keywords: ['洗', '切', '备料', '食材', '准备', '腌制', '解冻', '去皮', '切块', '切丝', '剁', '泡'],
  },
  cooking: {
    name: '烹饪技巧',
    icon: '🍳',
    color: '#ff8c42',
    keywords: ['炒', '煮', '蒸', '煎', '炸', '炖', '烤', '焖', '烧', '拌', '焯', '收汁', '翻炒'],
  },
  equipment: {
    name: '厨房设备',
    icon: '🔥',
    color: '#2196f3',
    keywords: ['锅', '烤箱', '微波炉', '电饭煲', '蒸锅', '砧板', '刀具', '火', '温度', '火力', '档位', '旋钮'],
  },
  timing: {
    name: '时间管理',
    icon: '⏰',
    color: '#9c27b0',
    keywords: ['分钟', '等待', '计时', '同时', '趁热', '立即', '提前', '浸泡', '静置'],
  },
  safety: {
    name: '安全提醒',
    icon: '⚠️',
    color: '#f44336',
    keywords: ['小心', '注意', '烫', '刀', '火', '危险', '防烫', '防滑', '通风', '断电'],
  },
  plating: {
    name: '摆盘装饰',
    icon: '🍽️',
    color: '#ff9800',
    keywords: ['摆盘', '装饰', '装盘', '盛', '点缀', '上桌', '完成'],
  },
}

// 紧急关键词
const EMERGENCY_KEYWORDS = [
  { keywords: ['着火', '起火', '火灾'], type: 'fire', instruction: '立即关闭炉灶！用锅盖盖住起火锅具，切勿用水浇灭！如火势无法控制，立即拨打119并撤离。' },
  { keywords: ['烫伤', '烫到', '烫了'], type: 'burn', instruction: '立即用流动冷水冲洗烫伤部位15-20分钟。不要涂抹牙膏或酱油。如起泡或面积较大，立即就医。' },
  { keywords: ['切到', '割伤', '流血', '出血'], type: 'cut', instruction: '用清洁纱布按压伤口止血，用流动水冲洗。伤口较深或无法止血时，立即就医。' },
  { keywords: ['救命', '帮忙', '不行了'], type: 'general', instruction: '请保持冷静。如情况严重，请立即拨打120急救电话。' },
]

// 语音指令
const VOICE_COMMANDS = [
  { keywords: ['下一步', '下一个', '继续', '好了', '完成了', '完了'], command: 'next' },
  { keywords: ['上一步', '上一个', '回去', '退回'], command: 'prev' },
  { keywords: ['重复', '再说一遍', '再说', '重听'], command: 'repeat' },
  { keywords: ['暂停', '停一下', '等一下', '停下来'], command: 'pause' },
  { keywords: ['继续播放', '继续说', '接着说'], command: 'resume' },
  { keywords: ['跳过', '不要这步'], command: 'skip' },
]

// 根据步骤文本匹配 Agent 类型
export function detectAgentType(stepText) {
  if (!stepText) return null
  const text = stepText.toLowerCase()
  let bestMatch = null
  let maxScore = 0

  for (const [key, agent] of Object.entries(AGENT_TYPES)) {
    const score = agent.keywords.reduce((sum, kw) => {
      return sum + (text.includes(kw) ? 1 : 0)
    }, 0)
    if (score > maxScore) {
      maxScore = score
      bestMatch = key
    }
  }
  return bestMatch
}

// 检测紧急情况
function detectEmergency(transcript) {
  for (const emergency of EMERGENCY_KEYWORDS) {
    if (emergency.keywords.some(kw => transcript.includes(kw))) {
      return emergency
    }
  }
  return null
}

// 检测语音指令
function detectCommand(transcript) {
  for (const cmd of VOICE_COMMANDS) {
    if (cmd.keywords.some(kw => transcript.includes(kw))) {
      return cmd.command
    }
  }
  return null
}

/**
 * 全双工语音 Agent 钩子
 * - 持续监听，支持打断 AI 播报
 * - 自动 Agent 调度
 * - 紧急情况检测
 * - 语音指令识别
 */
export function useVoiceAgent(options = {}) {
  const {
    voiceSettings = {},
    speechKeywords = [],
    onCommand,
    onEmergency,
    onQuestion,
  } = options

  // 状态
  const [agentState, setAgentState] = useState('idle') // idle | listening | speaking | processing | emergency
  const [agentType, setAgentType] = useState(null)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)

  // Refs
  const recognitionRef = useRef(null)
  const listeningRef = useRef(false)
  const speakingRef = useRef(false)
  const restartTimerRef = useRef(null)
  const onResultRef = useRef(null)
  const onErrorRef = useRef(null)
  const onCommandRef = useRef(onCommand)
  const onEmergencyRef = useRef(onEmergency)
  const onQuestionRef = useRef(onQuestion)
  const allKeywordsRef = useRef([...speechKeywords])
  const lastTranscriptRef = useRef('')
  const lastCommandTimeRef = useRef(0)

  // 更新 refs
  onCommandRef.current = onCommand
  onEmergencyRef.current = onEmergency
  onQuestionRef.current = onQuestion
  allKeywordsRef.current = [...speechKeywords, ...VOICE_COMMANDS.flatMap(c => c.keywords)]

  // TTS
  const [voices, setVoices] = useState([])
  const selectedVoiceRef = useRef(null)

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis?.getVoices() || []
      setVoices(availableVoices)
      const zhVoices = availableVoices.filter(v => v.lang.includes('zh'))
      if (zhVoices.length > 0) {
        selectedVoiceRef.current = zhVoices.find(v =>
          v.name.includes('Female') || v.name.includes('Lili') ||
          v.name.includes('Xiaoxiao') || v.name.includes('Mei')
        ) || zhVoices[0]
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

  // 语音合成：播报文本，播报期间暂停识别避免回声
  const speak = useCallback((text) => {
    if (!('speechSynthesis' in window) || !text) return

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = voiceSettings.rate || 1
    utterance.pitch = voiceSettings.pitch || 1.1
    utterance.volume = 1

    const availableVoices = window.speechSynthesis.getVoices()
    if (voiceSettings.voiceName) {
      const v = availableVoices.find(v => v.name === voiceSettings.voiceName)
      if (v) utterance.voice = v
    } else if (selectedVoiceRef.current) {
      utterance.voice = selectedVoiceRef.current
    }

    speakingRef.current = true
    setIsSpeaking(true)
    setAgentState('speaking')

    utterance.onstart = () => {
      speakingRef.current = true
      setIsSpeaking(true)
      setAgentState('speaking')
    }

    utterance.onend = () => {
      speakingRef.current = false
      setIsSpeaking(false)
      if (listeningRef.current) {
        setAgentState('listening')
      } else {
        setAgentState('idle')
      }
    }

    utterance.onerror = () => {
      speakingRef.current = false
      setIsSpeaking(false)
      if (listeningRef.current) {
        setAgentState('listening')
      } else {
        setAgentState('idle')
      }
    }

    window.speechSynthesis.speak(utterance)
  }, [voiceSettings])

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    speakingRef.current = false
    setIsSpeaking(false)
  }, [])

  // 语音识别处理
  const handleTranscript = useCallback((transcript) => {
    if (!transcript || transcript === lastTranscriptRef.current) return
    lastTranscriptRef.current = transcript

    // 1. 紧急检测（最高优先级）
    const emergency = detectEmergency(transcript)
    if (emergency) {
      stopSpeaking()
      setAgentState('emergency')
      onEmergencyRef.current?.(emergency, transcript)
      return
    }

    // 2. 语音指令检测
    const command = detectCommand(transcript)
    if (command) {
      const now = Date.now()
      if (now - lastCommandTimeRef.current > 800) {
        lastCommandTimeRef.current = now
        // 打断当前播报
        if (speakingRef.current) {
          stopSpeaking()
        }
        onCommandRef.current?.(command, transcript)
      }
      return
    }

    // 3. 关键词检测（用户自定义关键词，如"下一步"、"哈吉米"）
    if (speechKeywords.length > 0) {
      const matchedKeyword = speechKeywords.find(kw => transcript.includes(kw))
      if (matchedKeyword) {
        const now = Date.now()
        if (now - lastCommandTimeRef.current > 800) {
          lastCommandTimeRef.current = now
          if (speakingRef.current) stopSpeaking()
          onCommandRef.current?.('next', transcript)
        }
        return
      }
    }

    // 4. 自由提问（非指令、非紧急的语音输入）
    onQuestionRef.current?.(transcript)
  }, [speechKeywords, stopSpeaking])

  // 更新回调 ref
  onResultRef.current = handleTranscript
  onErrorRef.current = (error) => {
    // 忽略常见非致命错误
    if (error === 'no-speech' || error === 'aborted') return
    if (error === 'not-allowed' || error === 'service-not-allowed') {
      listeningRef.current = false
      setIsListening(false)
      setAgentState('idle')
    }
  }

  // 启动持续监听
  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      return
    }

    // 先停止已有实例
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
      recognitionRef.current = null
    }
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()

    recognition.lang = 'zh-CN'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      let interimTranscript = ''
      let finalTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0].transcript
        } else {
          interimTranscript += result[0].transcript
        }
      }

      // 实时显示临时识别文本
      if (interimTranscript) {
        setLiveTranscript(interimTranscript)
        // 打断检测：如果 AI 正在说话，用户开始说话，立即停止 AI
        if (speakingRef.current && interimTranscript.length > 1) {
          stopSpeaking()
        }
      }

      // 最终结果处理
      if (finalTranscript) {
        setLiveTranscript('')
        onResultRef.current?.(finalTranscript.trim())
      }
    }

    recognition.onerror = (event) => {
      onErrorRef.current?.(event.error)
    }

    recognition.onend = () => {
      if (listeningRef.current) {
        try {
          recognition.start()
        } catch {
          restartTimerRef.current = setTimeout(() => {
            if (listeningRef.current && recognitionRef.current === recognition) {
              try { recognition.start() } catch {}
            }
          }, 300)
        }
      }
    }

    recognitionRef.current = recognition
    listeningRef.current = true
    setIsListening(true)
    setAgentState('listening')

    try {
      recognition.start()
    } catch (e) {
      listeningRef.current = false
      setIsListening(false)
    }
  }, [stopSpeaking])

  const stopListening = useCallback(() => {
    listeningRef.current = false
    setIsListening(false)
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
      recognitionRef.current = null
    }
    if (!speakingRef.current) {
      setAgentState('idle')
    }
  }, [])

  // 更新 Agent 类型
  const updateAgentType = useCallback((stepText) => {
    const type = detectAgentType(stepText)
    setAgentType(type)
  }, [])

  // 紧急处理
  const triggerEmergency = useCallback((emergency) => {
    stopSpeaking()
    setAgentState('emergency')
    onEmergencyRef.current?.(emergency)
  }, [stopSpeaking])

  // 清除紧急状态
  const clearEmergency = useCallback(() => {
    if (listeningRef.current) {
      setAgentState('listening')
    } else {
      setAgentState('idle')
    }
  }, [])

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      listeningRef.current = false
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch {}
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  return {
    agentState,
    agentType,
    liveTranscript,
    isListening,
    isSpeaking,
    voices,
    speak,
    stopSpeaking,
    startListening,
    stopListening,
    updateAgentType,
    triggerEmergency,
    clearEmergency,
    setAgentState,
  }
}

export default useVoiceAgent
