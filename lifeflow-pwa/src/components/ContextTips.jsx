import { useMemo } from 'react'
import { Lightbulb, Clock, ChefHat, AlertCircle } from 'lucide-react'

/**
 * 上下文感知预测建议组件
 * 根据当前步骤、进度、历史提供预测性提示
 */
export default function ContextTips({ sop, stepIndex, currentStepTimer, formatTime }) {
  const tips = useMemo(() => {
    if (!sop?.steps) return []
    const result = []
    const currentStep = sop.steps[stepIndex]
    const nextStep = sop.steps[stepIndex + 1]

    // 1. 预告下一步
    if (nextStep) {
      result.push({
        type: 'preview',
        icon: ChefHat,
        color: '#ff8c42',
        text: `下一步：${nextStep.title}`,
        sub: nextStep.duration ? `预计 ${nextStep.duration} 分钟` : '',
      })
    }

    // 2. 时间提醒
    if (currentStep?.duration && currentStepTimer !== undefined) {
      const elapsed = currentStepTimer
      const expected = currentStep.duration * 60
      if (elapsed > expected && elapsed < expected + 30) {
        result.push({
          type: 'timing',
          icon: Clock,
          color: '#ff9800',
          text: `本步骤预计 ${currentStep.duration} 分钟，已超时`,
          sub: '说"下一步"继续，或继续当前操作',
        })
      } else if (elapsed > expected * 0.8 && elapsed < expected) {
        result.push({
          type: 'timing',
          icon: Clock,
          color: '#4caf50',
          text: `即将完成（已用 ${formatTime(elapsed)}）`,
          sub: '准备进入下一步',
        })
      }
    }

    // 3. 并行任务建议
    if (currentStep?.dependencies && currentStep.dependencies.length > 1) {
      result.push({
        type: 'parallel',
        icon: Lightbulb,
        color: '#2196f3',
        text: '此步骤可并行处理多个前置任务',
        sub: '合理安排顺序可节省时间',
      })
    }

    // 4. 安全提醒（检测步骤关键词）
    if (currentStep?.description) {
      const desc = currentStep.description
      const safetyKeywords = ['油', '火', '烫', '刀', '热', '高温', '蒸汽']
      if (safetyKeywords.some(kw => desc.includes(kw))) {
        result.push({
          type: 'safety',
          icon: AlertCircle,
          color: '#f44336',
          text: '注意安全：本步骤涉及高温或锋利工具',
          sub: '说"帮助"获取安全建议',
        })
      }
    }

    // 5. 进度鼓励
    const progress = ((stepIndex + 1) / sop.steps.length * 100)
    if (progress >= 75 && progress < 100) {
      result.push({
        type: 'encourage',
        icon: Lightbulb,
        color: '#4caf50',
        text: '即将完成！已到最后阶段',
        sub: `已完成 ${stepIndex}/${sop.steps.length} 步`,
      })
    }

    return result.slice(0, 3) // 最多显示 3 条
  }, [sop, stepIndex, currentStepTimer, formatTime])

  if (tips.length === 0) return null

  return (
    <div className="space-y-2">
      {tips.map((tip, i) => {
        const Icon = tip.icon
        return (
          <div
            key={i}
            className="flex items-start gap-2.5 px-3 py-2 bg-white/60 border-l-2 animate-slide-in"
            style={{
              borderLeftColor: tip.color,
              animationDelay: `${i * 0.08}s`,
            }}
          >
            <Icon size={16} style={{ color: tip.color }} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#3d3d3d] truncate">{tip.text}</p>
              {tip.sub && <p className="text-[10px] text-[#9a9a9a] truncate">{tip.sub}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
