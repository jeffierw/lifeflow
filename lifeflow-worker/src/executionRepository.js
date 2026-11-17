import { createExecution, transition, ExecutionError } from './executionEngine.js'

function requireRequestId(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(value)) {
    throw new ExecutionError('无效的请求标识')
  }
}

export class ExecutionRepository {
  constructor(db) {
    this.db = db
  }

  async getExecution(userId, id) {
    const row = await this.db.prepare('SELECT snapshot FROM executions WHERE id = ? AND user_id = ?').bind(id, userId).first()
    if (!row) throw new ExecutionError('执行记录不存在', 404)
    return JSON.parse(row.snapshot)
  }

  async start(userId, sopId, requestId) {
    requireRequestId(requestId)
    if (typeof sopId !== 'string' || sopId.length > 100) throw new ExecutionError('无效的流程')
    const replay = await this.db.prepare('SELECT sop_id, snapshot FROM executions WHERE user_id = ? AND request_id = ?')
      .bind(userId, requestId).first()
    if (replay) {
      if (replay.sop_id !== sopId) throw new ExecutionError('请求标识已用于其他流程', 409)
      return JSON.parse(replay.snapshot)
    }
    const active = await this.db.prepare("SELECT snapshot FROM executions WHERE user_id = ? AND sop_id = ? AND status != 'finished'")
      .bind(userId, sopId).first()
    if (active) return JSON.parse(active.snapshot)
    const sop = await this.db.prepare('SELECT * FROM sops WHERE id = ? AND user_id = ?').bind(sopId, userId).first()
    if (!sop) throw new ExecutionError('流程不存在，请先保存', 404)
    const state = createExecution({ ...sop, steps: JSON.parse(sop.steps), constraints: JSON.parse(sop.constraints || '{}') }, crypto.randomUUID())
    try {
      await this.db.prepare('INSERT INTO executions (id, user_id, sop_id, request_id, revision, status, snapshot, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(state.id, userId, sopId, requestId, 0, state.status, JSON.stringify(state), state.createdAt).run()
      return state
    } catch (error) {
      const winner = await this.db.prepare("SELECT snapshot FROM executions WHERE user_id = ? AND sop_id = ? AND status != 'finished'")
        .bind(userId, sopId).first()
      if (winner) return JSON.parse(winner.snapshot)
      throw error
    }
  }

  async applyEvent(userId, id, event) {
    requireRequestId(event.requestId)
    if (!Number.isSafeInteger(event.expectedRevision) || event.expectedRevision < 0 ||
        typeof event.type !== 'string' || !event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) {
      throw new ExecutionError('无效的操作参数')
    }
    const current = await this.getExecution(userId, id)
    const replay = async () => {
      const previous = await this.db.prepare('SELECT type, payload, result FROM execution_events WHERE execution_id = ? AND request_id = ? AND user_id = ?')
        .bind(id, event.requestId, userId).first()
      if (!previous) return null
      if (previous.type !== event.type || previous.payload !== JSON.stringify(event.payload)) {
        throw new ExecutionError('请求标识已用于其他操作', 409)
      }
      return { execution: await this.getExecution(userId, id), result: JSON.parse(previous.result), replayed: true }
    }
    const previous = await replay()
    if (previous) return previous
    const result = transition(current, event)
    try {
      await this.db.prepare('INSERT INTO execution_events (execution_id, request_id, user_id, expected_revision, type, payload, result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(id, event.requestId, userId, event.expectedRevision, event.type, JSON.stringify(event.payload), JSON.stringify(result), Date.now()).run()
    } catch (error) {
      const duplicate = await replay()
      if (duplicate) return duplicate
      if (String(error.message).includes('execution_conflict')) throw new ExecutionError('进度已更新，请刷新后重试', 409)
      throw error
    }
    return { execution: result, result, replayed: false }
  }

  async saveProposal(userId, id, proposal) {
    return this.applyEvent(userId, id, {
      requestId: proposal.id, expectedRevision: proposal.expectedRevision,
      type: 'propose_plan', payload: { rationale: proposal.rationale, steps: proposal.steps },
    })
  }
}
