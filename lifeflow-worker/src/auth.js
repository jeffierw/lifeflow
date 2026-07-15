import { 
  generateId, 
  hashPassword, 
  generateToken, 
  parseBody, 
  createResponse, 
  createError,
  extractUser 
} from './utils'

export class AuthHandler {
  constructor(request, env) {
    this.request = request
    this.env = env
    this.url = new URL(request.url)
    this.path = this.url.pathname
    this.method = request.method
  }

  async handle() {
    if (this.path === '/api/auth/register' && this.method === 'POST') {
      return this.register()
    }
    if (this.path === '/api/auth/login' && this.method === 'POST') {
      return this.login()
    }
    if (this.path === '/api/auth/profile' && this.method === 'GET') {
      return this.profile()
    }
    if (this.path === '/api/auth/profile' && this.method === 'PUT') {
      return this.updateProfile()
    }
    return createError('Not found', 404)
  }

  async register() {
    if (!this.env.JWT_SECRET) {
      console.error('JWT_SECRET not configured')
      return createError('服务器配置错误：缺少 JWT_SECRET', 500)
    }

    const body = await parseBody(this.request)
    const { email, password, inviteCode } = body

    if (!email || !password || !inviteCode) {
      return createError('缺少必要参数', 400)
    }

    const inviteResult = await this.env.DB.prepare(
      'SELECT * FROM invites WHERE code = ? AND is_used = 0'
    ).bind(inviteCode).run()

    if (!inviteResult.results?.[0]) {
      return createError('无效的邀请码', 400)
    }

    const invite = inviteResult.results[0]

    const existingUser = await this.env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).run()

    if (existingUser.results?.[0]) {
      return createError('邮箱已被注册', 400)
    }

    const passwordHash = await hashPassword(password)
    const userId = generateId()

    await this.env.DB.prepare(
      'INSERT INTO users (id, email, password_hash, quota_total) VALUES (?, ?, ?, ?)'
    ).bind(userId, email, passwordHash, invite.quota_allocated).run()

    await this.env.DB.prepare(
      'UPDATE invites SET is_used = 1, user_id = ?, used_at = ? WHERE id = ?'
    ).bind(userId, Date.now(), invite.id).run()

    const token = await generateToken({ userId }, this.env.JWT_SECRET)

    return createResponse({
      user: { id: userId, email },
      token,
    }, 201)
  }

  async login() {
    if (!this.env.JWT_SECRET) {
      console.error('JWT_SECRET not configured')
      return createError('服务器配置错误：缺少 JWT_SECRET', 500)
    }

    const body = await parseBody(this.request)
    const { email, password } = body

    if (!email || !password) {
      return createError('缺少必要参数', 400)
    }

    const userResult = await this.env.DB.prepare(
      'SELECT id, email, password_hash FROM users WHERE email = ?'
    ).bind(email).run()

    if (!userResult.results?.[0]) {
      return createError('邮箱或密码错误', 401)
    }

    const user = userResult.results[0]
    const passwordHash = await hashPassword(password)

    if (user.password_hash !== passwordHash) {
      return createError('邮箱或密码错误', 401)
    }

    const token = await generateToken({ userId: user.id }, this.env.JWT_SECRET)

    return createResponse({
      user: { id: user.id, email: user.email },
      token,
    })
  }

  async profile() {
    const user = await extractUser(this.request, this.env)
    if (!user) {
      return createError('未授权', 401)
    }
    return createResponse({
      id: user.id,
      email: user.email,
      nickname: user.nickname || '',
      avatar: user.avatar || '',
      quota_total: user.quota_total,
      quota_used: user.quota_used,
      quota_remaining: Math.max(0, user.quota_total - user.quota_used),
    })
  }

  async updateProfile() {
    const user = await extractUser(this.request, this.env)
    if (!user) {
      return createError('未授权', 401)
    }

    const body = await parseBody(this.request)
    const { nickname, avatar } = body

    await this.env.DB.prepare(
      'UPDATE users SET nickname = ?, avatar = ?, updated_at = ? WHERE id = ?'
    ).bind(nickname || '', avatar || '', Date.now(), user.id).run()

    const updatedUser = await this.env.DB.prepare(
      'SELECT id, email, nickname, avatar, quota_total, quota_used FROM users WHERE id = ?'
    ).bind(user.id).run()

    const result = updatedUser.results?.[0]
    return createResponse({
      id: result.id,
      email: result.email,
      nickname: result.nickname || '',
      avatar: result.avatar || '',
      quota_total: result.quota_total,
      quota_used: result.quota_used,
      quota_remaining: Math.max(0, result.quota_total - result.quota_used),
    })
  }
}
