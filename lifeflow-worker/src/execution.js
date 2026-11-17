import { extractUser, createResponse, createError } from './utils.js'
import { ExecutionRepository } from './executionRepository.js'

const publicEvents = new Set([
  'start_step', 'complete_step', 'skip_step', 'pause', 'resume', 'create_timer',
  'cancel_timer', 'approve_proposal', 'reject_proposal', 'finish',
])

export class ExecutionHandler {
  constructor(request, env) {
    this.request = request
    this.env = env
    this.repository = new ExecutionRepository(env.DB)
  }

  async handle() {
    try {
      const user = await extractUser(this.request, this.env)
      if (!user) return createError('未授权', 401)
      const path = new URL(this.request.url).pathname
      const match = path.match(/^\/api\/executions\/([a-zA-Z0-9_-]+)(?:\/(events|agent))?$/)
      if (this.request.method === 'GET' && match && !match[2]) {
        return createResponse({ execution: await this.repository.getExecution(user.id, match[1]) })
      }
      if (this.request.method !== 'POST') return createError('Not found', 404)
      const text = await this.request.text()
      if (text.length > 40000) return createError('请求过大', 413)
      let body
      try { body = JSON.parse(text) } catch { return createError('无效 JSON', 400) }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return createError('无效请求', 400)
      if (path === '/api/executions') {
        return createResponse({ execution: await this.repository.start(user.id, body.sopId, body.requestId) })
      }
      if (match?.[2] === 'events') {
        if (!publicEvents.has(body.type)) return createError('不允许的操作', 400)
        return createResponse(await this.repository.applyEvent(user.id, match[1], body))
      }
      return createError('Not found', 404)
    } catch (error) {
      console.error('[execution]', error.message)
      return createError(error.status ? error.message : '执行服务失败，请稍后重试', error.status || 500)
    }
  }
}
