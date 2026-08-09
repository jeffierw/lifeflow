import { AGENT_TYPES } from '../hooks/useVoiceAgent'

/**
 * 智能 Agent 类型指示器
 * 显示当前匹配的专业 Agent（食材准备/烹饪技巧/厨房设备等）
 */
export default function AgentBadge({ agentType, className = '' }) {
  if (!agentType || !AGENT_TYPES[agentType]) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 bg-[#ffe8d6] border border-[#ffd4b8] ${className}`}>
        <span className="text-sm">🤖</span>
        <span className="text-xs font-semibold text-[#3d3d3d]">通用助手</span>
      </div>
    )
  }

  const agent = AGENT_TYPES[agentType]

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1 border-2 animate-fade-in ${className}`}
      style={{
        backgroundColor: `${agent.color}15`,
        borderColor: `${agent.color}40`,
      }}
    >
      <span className="text-sm">{agent.icon}</span>
      <span className="text-xs font-semibold" style={{ color: agent.color }}>
        {agent.name} Agent
      </span>
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: agent.color }} />
    </div>
  )
}
