CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nickname TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  quota_total INTEGER DEFAULT 10000000,
  quota_used INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  email TEXT,
  is_used BOOLEAN DEFAULT 0,
  user_id TEXT,
  quota_allocated INTEGER DEFAULT 10000000,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  used_at INTEGER
);

CREATE TABLE IF NOT EXISTS sops (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  goal TEXT NOT NULL,
  constraints TEXT,
  steps TEXT,
  estimated_total_time INTEGER DEFAULT 60,
  status TEXT DEFAULT 'pending',
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS quota_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  sops_id TEXT,
  tokens_used INTEGER NOT NULL,
  operation TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (sops_id) REFERENCES sops(id)
);
