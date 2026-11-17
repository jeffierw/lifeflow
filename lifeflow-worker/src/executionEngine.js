import { validatePlan } from './planValidation.js'

export class ExecutionError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

export function createExecution(sop, id, now = Date.now()) {
  const plan = validatePlan(sop)
  return {
    id, sopId: sop.id, title: plan.title, goal: sop.goal || plan.title,
    constraints: sop.constraints || {}, revision: 0, status: 'active',
    createdAt: now, updatedAt: now, estimatedTotalTime: plan.estimatedTotalTime,
    steps: plan.steps.map(step => ({ ...step, status: 'pending' })),
    timers: [], proposals: [],
  }
}

export function validatePlanChange(execution, candidate) {
  if (!Array.isArray(candidate)) throw new ExecutionError('变更必须包含未开始的步骤')
  const frozen = execution.steps.filter(step => step.status !== 'pending')
  const frozenIds = new Set(frozen.map(step => step.id))
  if (candidate.some(step => !step || frozenIds.has(step.id) || (step.status && step.status !== 'pending'))) {
    throw new ExecutionError('不能修改已开始、已完成或已跳过的步骤')
  }
  const plan = validatePlan({ title: execution.title, steps: [...frozen, ...candidate] })
  const frozenById = new Map(frozen.map(step => [step.id, step]))
  const steps = plan.steps.map(step => frozenById.get(step.id) || step)
  const oldPending = execution.steps.filter(step => step.status === 'pending')
  const nextPending = steps.filter(step => step.status === 'pending')
  const before = new Map(oldPending.map(step => [step.id, step]))
  const after = new Map(nextPending.map(step => [step.id, step]))
  const comparable = step => JSON.stringify([step.title, step.description, step.duration, step.dependencies])
  const summary = {
    added: nextPending.filter(step => !before.has(step.id)),
    removed: oldPending.filter(step => !after.has(step.id)),
    changed: nextPending.filter(step => before.has(step.id) && comparable(step) !== comparable(before.get(step.id)))
      .map(step => ({ before: before.get(step.id), after: step })),
    beforeMinutes: execution.estimatedTotalTime,
    afterMinutes: plan.estimatedTotalTime,
  }
  if (!summary.added.length && !summary.removed.length && !summary.changed.length) {
    throw new ExecutionError('草案没有实际修改')
  }
  return { steps, estimatedTotalTime: plan.estimatedTotalTime, summary }
}

export function transition(execution, event, now = Date.now()) {
  if (event.expectedRevision !== execution.revision) throw new ExecutionError('进度已更新，请刷新后重试', 409)
  if (execution.status === 'finished') throw new ExecutionError('流程已经结束', 409)
  const state = structuredClone(execution)
  const payload = event.payload || {}
  const step = state.steps.find(item => item.id === payload.stepId)
  const requireActive = () => {
    if (state.status !== 'active') throw new ExecutionError('请先恢复流程')
  }
  const requireStep = () => {
    if (!step) throw new ExecutionError('步骤不存在')
  }
  switch (event.type) {
    case 'start_step':
      requireActive()
      requireStep()
      if (step.status !== 'pending') throw new ExecutionError('只能开始待执行步骤')
      if (step.dependencies.some(id => state.steps.find(item => item.id === id)?.status !== 'completed')) {
        throw new ExecutionError('请先完成所有前置步骤')
      }
      step.status = 'running'
      step.startedAt = now
      break
    case 'complete_step':
      requireActive()
      requireStep()
      if (step.status !== 'running') throw new ExecutionError('只能完成正在执行的步骤')
      step.status = 'completed'
      step.completedAt = now
      state.timers = state.timers.map(timer => timer.stepId === step.id && timer.status === 'active'
        ? { ...timer, status: 'cancelled' } : timer)
      break
    case 'skip_step':
      requireActive()
      requireStep()
      if (step.status !== 'pending') throw new ExecutionError('只能跳过尚未开始的步骤')
      step.status = 'skipped'
      step.skippedAt = now
      break
    case 'pause':
      requireActive()
      state.status = 'paused'
      break
    case 'resume':
      if (state.status !== 'paused') throw new ExecutionError('流程未暂停')
      state.status = 'active'
      break
    case 'create_timer':
      requireActive()
      requireStep()
      if (step.status !== 'running') throw new ExecutionError('请先开始该步骤')
      if (!Number.isInteger(payload.seconds) || payload.seconds < 1 || payload.seconds > 86400) {
        throw new ExecutionError('计时范围为 1 秒至 24 小时')
      }
      if (state.timers.some(timer => timer.stepId === step.id && timer.status === 'active')) {
        throw new ExecutionError('该步骤已有计时器')
      }
      state.timers = state.timers.filter(timer => timer.status === 'active')
      state.timers.push({ id: event.requestId, stepId: step.id, deadline: now + payload.seconds * 1000, status: 'active' })
      break
    case 'cancel_timer': {
      const timer = state.timers.find(item => item.id === payload.timerId)
      if (!timer || timer.status !== 'active') throw new ExecutionError('计时器不存在或已结束')
      timer.status = 'cancelled'
      break
    }
    case 'propose_plan': {
      if (typeof payload.rationale !== 'string' || !payload.rationale.trim() || payload.rationale.length > 2000) {
        throw new ExecutionError('请说明调整原因')
      }
      const change = validatePlanChange(state, payload.steps)
      state.proposals = state.proposals.map(proposal => proposal.status === 'pending'
        ? { ...proposal, status: 'superseded' } : proposal).slice(-19)
      state.proposals.push({
        id: event.requestId, baseRevision: state.revision + 1, status: 'pending',
        rationale: payload.rationale, steps: change.steps.filter(item => item.status === 'pending'),
        summary: change.summary, createdAt: now,
      })
      break
    }
    case 'approve_proposal':
    case 'reject_proposal': {
      const proposal = state.proposals.find(item => item.id === payload.proposalId)
      if (!proposal || proposal.status !== 'pending') throw new ExecutionError('草案已处理或不存在', 409)
      if (event.type === 'approve_proposal') {
        if (proposal.baseRevision !== state.revision) throw new ExecutionError('草案已过期，请重新提出调整', 409)
        const change = validatePlanChange(state, proposal.steps)
        state.steps = change.steps
        state.estimatedTotalTime = change.estimatedTotalTime
        proposal.status = 'approved'
      } else proposal.status = 'rejected'
      break
    }
    case 'finish':
      state.status = 'finished'
      state.finishedAt = now
      state.timers = state.timers.map(timer => ({ ...timer, status: 'cancelled' }))
      break
    default:
      throw new ExecutionError('不支持的操作')
  }
  state.revision++
  state.updatedAt = now
  return state
}
