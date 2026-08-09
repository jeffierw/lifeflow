import { useCallback, useRef } from 'react'

const audioContext = typeof window !== 'undefined' ? new (window.AudioContext || window.webkitAudioContext)() : null

export const useSound = () => {
  const lastPlayTime = useRef(0)

  const playClick = useCallback(() => {
    if (!audioContext) return
    
    const now = Date.now()
    if (now - lastPlayTime.current < 100) return
    lastPlayTime.current = now

    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.05)

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.05)
  }, [])

  const playSuccess = useCallback(() => {
    if (!audioContext) return

    const now = Date.now()
    if (now - lastPlayTime.current < 100) return
    lastPlayTime.current = now

    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime)
    oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1)
    oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2)

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.3)
  }, [])

  const playError = useCallback(() => {
    if (!audioContext) return

    const now = Date.now()
    if (now - lastPlayTime.current < 100) return
    lastPlayTime.current = now

    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.type = 'sawtooth'
    oscillator.frequency.setValueAtTime(200, audioContext.currentTime)
    oscillator.frequency.setValueAtTime(150, audioContext.currentTime + 0.1)

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.2)
  }, [])

  // 监听开始音效（轻柔上升音）
  const playListening = useCallback(() => {
    if (!audioContext) return
    const osc = audioContext.createOscillator()
    const gain = audioContext.createGain()
    osc.connect(gain)
    gain.connect(audioContext.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(400, audioContext.currentTime)
    osc.frequency.linearRampToValueAtTime(600, audioContext.currentTime + 0.15)
    gain.gain.setValueAtTime(0.08, audioContext.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2)
    osc.start(audioContext.currentTime)
    osc.stop(audioContext.currentTime + 0.2)
  }, [])

  // 步骤完成音效（清脆双音）
  const playStepComplete = useCallback(() => {
    if (!audioContext) return
    const osc = audioContext.createOscillator()
    const gain = audioContext.createGain()
    osc.connect(gain)
    gain.connect(audioContext.destination)
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(659.25, audioContext.currentTime)
    osc.frequency.setValueAtTime(880, audioContext.currentTime + 0.08)
    gain.gain.setValueAtTime(0.12, audioContext.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.25)
    osc.start(audioContext.currentTime)
    osc.stop(audioContext.currentTime + 0.25)
  }, [])

  // 紧急警报音效（急促三连音）
  const playEmergency = useCallback(() => {
    if (!audioContext) return
    for (let i = 0; i < 3; i++) {
      const osc = audioContext.createOscillator()
      const gain = audioContext.createGain()
      osc.connect(gain)
      gain.connect(audioContext.destination)
      osc.type = 'square'
      const t = audioContext.currentTime + i * 0.15
      osc.frequency.setValueAtTime(880, t)
      gain.gain.setValueAtTime(0.15, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
      osc.start(t)
      osc.stop(t + 0.1)
    }
  }, [])

  // 理解确认音效（短促单音）
  const playUnderstood = useCallback(() => {
    if (!audioContext) return
    const osc = audioContext.createOscillator()
    const gain = audioContext.createGain()
    osc.connect(gain)
    gain.connect(audioContext.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(800, audioContext.currentTime)
    gain.gain.setValueAtTime(0.06, audioContext.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.08)
    osc.start(audioContext.currentTime)
    osc.stop(audioContext.currentTime + 0.08)
  }, [])

  // 步骤打勾完成提示音（明亮叮声）
  const playDing = useCallback(() => {
    if (!audioContext) return
    const osc = audioContext.createOscillator()
    const gain = audioContext.createGain()
    osc.connect(gain)
    gain.connect(audioContext.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1200, audioContext.currentTime)
    gain.gain.setValueAtTime(0.1, audioContext.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.25)
    osc.start(audioContext.currentTime)
    osc.stop(audioContext.currentTime + 0.25)
  }, [])

  return { playClick, playSuccess, playError, playListening, playStepComplete, playEmergency, playUnderstood, playDing }
}

export default useSound
