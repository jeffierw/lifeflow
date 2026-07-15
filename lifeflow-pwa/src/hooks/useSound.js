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

  return { playClick, playSuccess, playError }
}

export default useSound
