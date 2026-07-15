import { 
  generateId, 
  generateInviteCode, 
  parseBody, 
  createResponse, 
  createError 
} from './utils'

export class InviteHandler {
  constructor(request, env) {
    this.request = request
    this.env = env
    this.url = new URL(request.url)
    this.path = this.url.pathname
    this.method = request.method
  }

  async handle() {
    if (this.path === '/api/invite/apply' && this.method === 'POST') {
      return this.apply()
    }
    if (this.path === '/api/invite/validate' && this.method === 'POST') {
      return this.validate()
    }
    if (this.path === '/api/invite/generate' && this.method === 'POST') {
      return this.generate()
    }
    return createError('Not found', 404)
  }

  async apply() {
    try {
      const body = await parseBody(this.request)
      console.log('Invite apply body:', body)
      const { email } = body

      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return createError('请输入有效的邮箱地址', 400)
      }

      const existingInvites = await this.env.DB.prepare(
        'SELECT * FROM invites WHERE email = ? ORDER BY created_at DESC'
      ).bind(email).run()

      const invites = existingInvites.results || []
      const unusedInvite = invites.find(invite => !invite.is_used)
      const usedInvite = invites.find(invite => invite.is_used)

      if (usedInvite) {
        return createError('该邮箱已使用邀请码注册', 400)
      }

      if (unusedInvite) {
        return createResponse({
          message: '您已申请过邀请码，请保存使用',
          code: unusedInvite.code,
        })
      }

      const inviteCode = generateInviteCode()
      const inviteId = generateId()

      await this.env.DB.prepare(
        'INSERT INTO invites (id, code, email, quota_allocated) VALUES (?, ?, ?, ?)'
      ).bind(inviteId, inviteCode, email, 10000000).run()

      return createResponse({
        message: '邀请码申请成功，请保存使用',
        code: inviteCode,
      }, 201)
    } catch (error) {
      console.error('Invite apply error:', error)
      return createError('服务器内部错误', 500)
    }
  }

  async validate() {
    const body = await parseBody(this.request)
    const { code } = body

    if (!code) {
      return createError('缺少邀请码参数', 400)
    }

    const inviteResult = await this.env.DB.prepare(
      'SELECT * FROM invites WHERE code = ? AND is_used = 0'
    ).bind(code.toUpperCase()).run()

    if (!inviteResult.results?.[0]) {
      return createError('无效的邀请码', 400)
    }

    return createResponse({
      valid: true,
      quota: inviteResult.results[0].quota_allocated,
    })
  }

  async generate() {
    const code = generateInviteCode()
    const inviteId = generateId()

    await this.env.DB.prepare(
      'INSERT INTO invites (id, code, quota_allocated) VALUES (?, ?, ?)'
    ).bind(inviteId, code, 10000000).run()

    return createResponse({ code }, 201)
  }
}
