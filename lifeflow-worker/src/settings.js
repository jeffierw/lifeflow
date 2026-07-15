import { 
  parseBody, 
  createResponse, 
  createError,
  extractUser
} from './utils'

export class SettingsHandler {
  constructor(request, env) {
    this.request = request
    this.env = env
    this.url = new URL(request.url)
    this.path = this.url.pathname
    this.method = request.method
  }

  async handle() {
    if (this.path === '/api/settings' && this.method === 'GET') {
      return this.getSettings()
    }
    if (this.path === '/api/settings' && this.method === 'POST') {
      return this.saveSettings()
    }
    return createError('Not found', 404)
  }

  async ensureSettingsColumns() {
    try {
      await this.env.DB.prepare(
        "PRAGMA table_info(users)"
      ).run()
      
      await this.env.DB.prepare(
        "ALTER TABLE users ADD COLUMN voice_settings TEXT DEFAULT '{}'"
      ).run().catch(() => {})
      await this.env.DB.prepare(
        "ALTER TABLE users ADD COLUMN speech_keywords TEXT DEFAULT '[\"下一步\", \"哈吉米\"]'"
      ).run().catch(() => {})
      await this.env.DB.prepare(
        "ALTER TABLE users ADD COLUMN nickname TEXT DEFAULT ''"
      ).run().catch(() => {})
      await this.env.DB.prepare(
        "ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT ''"
      ).run().catch(() => {})
      await this.env.DB.prepare(
        "ALTER TABLE users ADD COLUMN updated_at INTEGER DEFAULT 0"
      ).run().catch(() => {})
    } catch (error) {
      console.error('Failed to ensure columns:', error)
    }
  }

  async getSettings() {
    const user = await extractUser(this.request, this.env)
    if (!user) {
      return createError('未授权', 401)
    }

    await this.ensureSettingsColumns()

    const result = await this.env.DB.prepare(
      'SELECT voice_settings, speech_keywords FROM users WHERE id = ?'
    ).bind(user.id).run()

    const userData = result.results?.[0]

    return createResponse({
      voiceSettings: userData?.voice_settings ? JSON.parse(userData.voice_settings) : { voiceName: '', pitch: 1.1, rate: 1 },
      speechKeywords: userData?.speech_keywords ? JSON.parse(userData.speech_keywords) : ['下一步', '哈吉米'],
    })
  }

  async saveSettings() {
    const user = await extractUser(this.request, this.env)
    if (!user) {
      return createError('未授权', 401)
    }

    await this.ensureSettingsColumns()

    const body = await parseBody(this.request)
    const { voiceSettings, speechKeywords } = body

    await this.env.DB.prepare(
      'UPDATE users SET voice_settings = ?, speech_keywords = ?, updated_at = ? WHERE id = ?'
    ).bind(
      JSON.stringify(voiceSettings || {}),
      JSON.stringify(speechKeywords || []),
      Date.now(),
      user.id
    ).run()

    return createResponse({ message: '保存成功' })
  }
}