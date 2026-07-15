import { Router } from './router'

export default {
  async fetch(request, env) {
    await initDB(env)
    const router = new Router(request, env)
    return router.handle()
  },
}

let dbInitialized = false

async function initDB(env) {
  if (dbInitialized) return
  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        nickname TEXT DEFAULT '',
        avatar TEXT DEFAULT '',
        voice_settings TEXT DEFAULT '{}',
        speech_keywords TEXT DEFAULT '["下一步", "哈吉米"]',
        quota_total INTEGER DEFAULT 10000000,
        quota_used INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT 0
      )
    `).run()

    // 为已存在的老表补齐字段（已存在时 ALTER 会报错，忽略即可）
    const addColumn = async (sql) => {
      try {
        await env.DB.prepare(sql).run()
      } catch (error) {
        if (!error.message?.includes('duplicate column')) {
          console.error('Add column failed:', sql, error)
        }
      }
    }

    await addColumn("ALTER TABLE users ADD COLUMN nickname TEXT DEFAULT ''")
    await addColumn("ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT ''")
    await addColumn("ALTER TABLE users ADD COLUMN voice_settings TEXT DEFAULT '{}'")
    await addColumn(`ALTER TABLE users ADD COLUMN speech_keywords TEXT DEFAULT '["下一步", "哈吉米"]'`)
    await addColumn("ALTER TABLE users ADD COLUMN updated_at INTEGER DEFAULT 0")

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS invites (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        email TEXT,
        quota_allocated INTEGER DEFAULT 10000000,
        is_used INTEGER DEFAULT 0,
        user_id TEXT,
        used_at INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `).run()

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS sops (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        goal TEXT NOT NULL,
        constraints TEXT DEFAULT '{}',
        steps TEXT DEFAULT '[]',
        estimated_total_time INTEGER DEFAULT 60,
        status TEXT DEFAULT 'draft',
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER
      )
    `).run()

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS quota_usage (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        tokens_used INTEGER NOT NULL,
        operation TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `).run()

    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_invites_code ON invites(code)').run()
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email)').run()
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_sops_user ON sops(user_id)').run()
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_quota_user ON quota_usage(user_id)').run()

    dbInitialized = true
    console.log('Database initialized')
  } catch (error) {
    console.error('Failed to initialize database:', error)
  }
}
