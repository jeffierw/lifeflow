import { createResponse, createError, extractUser } from './utils'

export class QuotaHandler {
  constructor(request, env) {
    this.request = request
    this.env = env
    this.url = new URL(request.url)
    this.path = this.url.pathname
    this.method = request.method
  }

  async handle() {
    if (this.path === '/api/quota/status' && this.method === 'GET') {
      return this.status()
    }
    return createError('Not found', 404)
  }

  async status() {
    const user = await extractUser(this.request, this.env)
    if (!user) {
      return createError('未授权', 401)
    }

    const result = await this.env.DB.prepare(
      'SELECT quota_total, quota_used FROM users WHERE id = ?'
    ).bind(user.id).run()

    if (!result.results?.[0]) {
      return createError('用户不存在', 404)
    }

    const quota = result.results[0]
    const remaining = quota.quota_total - quota.quota_used

    return createResponse({
      total: quota.quota_total,
      used: quota.quota_used,
      remaining,
      percentage: Math.round((quota.quota_used / quota.quota_total) * 100),
    })
  }
}
