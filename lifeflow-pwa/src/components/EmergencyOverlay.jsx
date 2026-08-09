import { useState, useEffect } from 'react'
import { Phone, X, AlertTriangle } from 'lucide-react'

const EMERGENCY_INFO = {
  fire: {
    title: '🔥 火情紧急处理',
    steps: [
      '立即关闭炉灶燃气阀门',
      '用锅盖盖住起火锅具，隔绝空气',
      '切勿用水浇灭油火！',
      '如火势蔓延，立即撤离并拨打 119',
    ],
    hotline: '119',
    hotlineLabel: '火警',
  },
  burn: {
    title: '🔥 烫伤紧急处理',
    steps: [
      '立即用流动冷水冲洗烫伤部位 15-20 分钟',
      '不要涂抹牙膏、酱油、冰块',
      '如有水泡，不要挑破',
      '面积较大或程度严重，立即就医',
    ],
    hotline: '120',
    hotlineLabel: '急救',
  },
  cut: {
    title: '🩸 割伤紧急处理',
    steps: [
      '用清洁纱布或毛巾按压伤口止血',
      '用流动清水冲洗伤口',
      '用碘伏消毒，用创可贴或纱布包扎',
      '伤口较深或无法止血，立即就医',
    ],
    hotline: '120',
    hotlineLabel: '急救',
  },
  general: {
    title: '⚠️ 紧急情况',
    steps: [
      '请保持冷静',
      '如情况严重，请立即拨打急救电话',
      '如需帮助，请大声呼救',
    ],
    hotline: '120',
    hotlineLabel: '急救',
  },
}

/**
 * 紧急情况处理覆盖层
 * 全屏红色警告 + 急救步骤 + 快速拨打
 */
export default function EmergencyOverlay({ emergency, onClose }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (emergency) {
      setVisible(true)
      // 震动反馈（移动端）
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 200])
      }
    } else {
      setVisible(false)
    }
  }, [emergency])

  if (!emergency || !visible) return null

  const info = EMERGENCY_INFO[emergency.type] || EMERGENCY_INFO.general

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-red-600/95 animate-fade-in">
      {/* 闪烁背景 */}
      <div className="absolute inset-0 bg-red-500 animate-pulse-slow opacity-50" />

      <div className="relative z-10 max-w-md w-full mx-4 bg-white shadow-2xl">
        {/* 顶部警告条 */}
        <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={24} className="animate-pulse" />
            <span className="text-lg font-bold">紧急情况</span>
          </div>
          <button
            onClick={() => {
              setVisible(false)
              onClose?.()
            }}
            className="text-white/80 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6">
          <h2 className="text-xl font-bold text-red-600 mb-4">{info.title}</h2>

          <div className="space-y-3 mb-6">
            {info.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3 animate-slide-in" style={{ animationDelay: `${i * 0.1}s` }}>
                <span className="flex-shrink-0 w-6 h-6 bg-red-100 text-red-600 flex items-center justify-center text-sm font-bold rounded-full">
                  {i + 1}
                </span>
                <span className="text-sm text-[#3d3d3d] font-medium">{step}</span>
              </div>
            ))}
          </div>

          {/* 快速拨打 */}
          <a
            href={`tel:${info.hotline}`}
            className="flex items-center justify-center gap-2 w-full bg-red-600 text-white py-4 text-lg font-bold hover:bg-red-700 transition-colors active:scale-95"
          >
            <Phone size={24} />
            拨打 {info.hotline} ({info.hotlineLabel})
          </a>

          <button
            onClick={() => {
              setVisible(false)
              onClose?.()
            }}
            className="w-full mt-3 py-3 text-sm text-[#6b6b6b] hover:text-[#3d3d3d]"
          >
            已处理，继续烹饪
          </button>
        </div>
      </div>
    </div>
  )
}
