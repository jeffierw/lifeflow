import { ExecutionError } from './executionEngine.js'

const stepSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    id: { type: 'integer', minimum: 1 },
    title: { type: 'string', maxLength: 200 },
    description: { type: 'string', maxLength: 2000 },
    duration: { type: 'integer', minimum: 1, maximum: 1440 },
    dependencies: { type: 'array', items: { type: 'integer' } },
  },
  required: ['id', 'title', 'description', 'duration', 'dependencies'],
}

export const agentTools = [
  {
    type: 'function', function: {
      name: 'read_execution', description: '读取当前执行事实、版本和待确认草案。',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function', function: {
      name: 'propose_plan_change',
      description: '提出全部未开始步骤的新方案，保留未变步骤的 ID。只存草案，不执行；已开始或完成步骤不能传入。用户必须在界面确认。',
      parameters: {
        type: 'object', additionalProperties: false,
        properties: { rationale: { type: 'string', maxLength: 2000 }, steps: { type: 'array', items: stepSchema, maxItems: 40 } },
        required: ['rationale', 'steps'],
      },
    },
  },
  {
    type: 'function', function: {
      name: 'create_timer',
      description: '仅在本条用户消息明确为“给第N步计时M分钟”或“给第N步计时M秒”时创建对应计时器。普通建议不代表授权。',
      parameters: {
        type: 'object', additionalProperties: false,
        properties: { stepId: { type: 'integer' }, seconds: { type: 'integer', minimum: 1, maximum: 86400 } },
        required: ['stepId', 'seconds'],
      },
    },
  },
]

export function timerAuthorization(message) {
  const match = message.trim().match(/^(?:请)?给第(\d+)步计时(\d+)(分钟|秒)[。！!]?$/)
  return match ? { stepId: Number(match[1]), seconds: Number(match[2]) * (match[3] === '分钟' ? 60 : 1) } : null
}

export async function executeAgentTool({ name, args, repository, userId, executionId, revision, requestId, authorization }) {
  const tool = agentTools.find(item => item.function.name === name)
  if (!tool) throw new ExecutionError('工具不存在')
  const schema = tool.function.parameters
  if (!args || typeof args !== 'object' || Array.isArray(args) ||
      Object.keys(args).some(key => !(key in schema.properties)) ||
      (schema.required || []).some(key => !(key in args))) throw new ExecutionError('工具参数无效')
  if (name === 'read_execution') return { execution: await repository.getExecution(userId, executionId) }
  if (name === 'propose_plan_change') {
    const result = await repository.saveProposal(userId, executionId, {
      id: requestId, expectedRevision: revision, rationale: args.rationale, steps: args.steps,
    })
    return { execution: result.execution, proposalId: requestId, applied: false }
  }
  if (!authorization || authorization.stepId !== args.stepId || authorization.seconds !== args.seconds) {
    throw new ExecutionError('未获得该计时操作的明确授权，请使用计时按钮或明确指定步骤和时长')
  }
  const result = await repository.applyEvent(userId, executionId, {
    requestId, expectedRevision: revision, type: 'create_timer', payload: args,
  })
  return { execution: result.execution, timerCreated: true }
}
