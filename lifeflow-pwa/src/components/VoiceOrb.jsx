import { useEffect, useRef } from 'react'

/**
 * GPT-Live 风格语音可视化球体
 * 状态：idle | listening | speaking | processing | emergency
 */
export default function VoiceOrb({ state = 'idle', transcript = '', size = 120 }) {
  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  const stateRef = useRef(state)
  const transcriptRef = useRef(transcript)

  stateRef.current = state
  transcriptRef.current = transcript

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    let time = 0
    const particles = []
    const numParticles = 40

    // 初始化粒子
    for (let i = 0; i < numParticles; i++) {
      particles.push({
        angle: (Math.PI * 2 * i) / numParticles,
        radius: size * 0.3,
        baseRadius: size * 0.3,
        speed: 0.5 + Math.random() * 0.5,
        offset: Math.random() * Math.PI * 2,
      })
    }

    const colors = {
      idle: { primary: '#ffd4b8', secondary: '#ffe8d6', glow: 'rgba(255, 140, 66, 0.15)' },
      listening: { primary: '#4caf50', secondary: '#81c784', glow: 'rgba(76, 175, 80, 0.3)' },
      speaking: { primary: '#ff8c42', secondary: '#ffb74d', glow: 'rgba(255, 140, 66, 0.35)' },
      processing: { primary: '#2196f3', secondary: '#64b5f6', glow: 'rgba(33, 150, 243, 0.3)' },
      emergency: { primary: '#f44336', secondary: '#ef5350', glow: 'rgba(244, 67, 54, 0.4)' },
    }

    const draw = () => {
      const currentState = stateRef.current
      const color = colors[currentState] || colors.idle
      const cx = size / 2
      const cy = size / 2

      ctx.clearRect(0, 0, size, size)

      // 外层光晕
      const glowRadius = size * 0.45 + Math.sin(time * 0.05) * 5
      const glowGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius)
      glowGradient.addColorStop(0, color.glow)
      glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = glowGradient
      ctx.beginPath()
      ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2)
      ctx.fill()

      // 粒子环
      const intensity = currentState === 'listening' ? 1.5 : currentState === 'speaking' ? 2 : 0.5
      const transcriptBoost = transcriptRef.current.length > 0 ? 1.3 : 1

      particles.forEach((p, i) => {
        const wave = Math.sin(time * 0.03 * p.speed + p.offset) * 15 * intensity * transcriptBoost
        p.radius = p.baseRadius + wave

        const px = cx + Math.cos(p.angle + time * 0.005) * p.radius
        const py = cy + Math.sin(p.angle + time * 0.005) * p.radius

        const particleSize = 2 + Math.sin(time * 0.05 + p.offset) * 1.5
        ctx.fillStyle = i % 2 === 0 ? color.primary : color.secondary
        ctx.globalAlpha = 0.6 + Math.sin(time * 0.05 + p.offset) * 0.3
        ctx.beginPath()
        ctx.arc(px, py, particleSize, 0, Math.PI * 2)
        ctx.fill()
      })
      ctx.globalAlpha = 1

      // 中心球体
      const coreRadius = size * 0.18 + Math.sin(time * 0.04) * 3
      const coreGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius)
      coreGradient.addColorStop(0, color.secondary)
      coreGradient.addColorStop(0.7, color.primary)
      coreGradient.addColorStop(1, color.primary)
      ctx.fillStyle = coreGradient
      ctx.beginPath()
      ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2)
      ctx.fill()

      // 内层波纹（仅 speaking/listening 状态）
      if (currentState === 'listening' || currentState === 'speaking') {
        for (let r = 0; r < 3; r++) {
          const rippleRadius = coreRadius + ((time * 0.5 + r * 20) % 40)
          const alpha = 1 - (rippleRadius - coreRadius) / 40
          if (alpha > 0) {
            ctx.strokeStyle = color.primary
            ctx.globalAlpha = alpha * 0.3
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.arc(cx, cy, rippleRadius, 0, Math.PI * 2)
            ctx.stroke()
          }
        }
        ctx.globalAlpha = 1
      }

      // 紧急状态闪烁
      if (currentState === 'emergency') {
        const flash = Math.sin(time * 0.15) * 0.5 + 0.5
        ctx.fillStyle = `rgba(244, 67, 54, ${flash * 0.2})`
        ctx.fillRect(0, 0, size, size)
      }

      time++
      animationRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [size])

  const stateLabels = {
    idle: '',
    listening: '正在听...',
    speaking: '播报中...',
    processing: '思考中...',
    emergency: '⚠️ 紧急',
  }

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <canvas
          ref={canvasRef}
          style={{ width: size, height: size }}
        />
        {/* 中心图标 */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-2xl">
            {state === 'emergency' ? '⚠️' :
             state === 'listening' ? '🎤' :
             state === 'speaking' ? '🔊' :
             state === 'processing' ? '🤔' : '✨'}
          </span>
        </div>
      </div>
      {stateLabels[state] && (
        <span className={`text-sm font-semibold ${
          state === 'emergency' ? 'text-red-600' :
          state === 'listening' ? 'text-green-600' :
          state === 'speaking' ? 'text-[#ff8c42]' :
          state === 'processing' ? 'text-blue-600' : 'text-[#9a9a9a]'
        }`}>
          {stateLabels[state]}
        </span>
      )}
      {transcript && (
        <span className="text-xs text-[#6b6b6b] max-w-[200px] text-center truncate">
          "{transcript}"
        </span>
      )}
    </div>
  )
}
