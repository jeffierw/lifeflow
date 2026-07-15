export function generateId() {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
}

export function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export function hashPassword(password) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
    .then(hash => {
      return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
    })
}

async function base64UrlEncode(str) {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

async function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) {
    str += '='
  }
  return atob(str)
}

async function signHmacSHA256(data, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)))
}

async function verifyHmacSHA256(data, signature, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )
  const sigBuffer = new Uint8Array([...(await base64UrlDecode(signature))].map(c => c.charCodeAt(0)))
  return crypto.subtle.verify('HMAC', key, sigBuffer, new TextEncoder().encode(data))
}

export async function generateToken(payload, secret, expiresIn = '7d') {
  const now = Math.floor(Date.now() / 1000)
  const expires = now + (parseInt(expiresIn) * 24 * 60 * 60)
  
  const header = await base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payloadStr = await base64UrlEncode(JSON.stringify({ ...payload, exp: expires }))
  const signature = await signHmacSHA256(`${header}.${payloadStr}`, secret)
  
  return `${header}.${payloadStr}.${signature}`
}

export async function verifyToken(token, secret) {
  try {
    const [header, payloadStr, signature] = token.split('.')
    const isValid = await verifyHmacSHA256(`${header}.${payloadStr}`, signature, secret)
    
    if (!isValid) {
      return null
    }
    
    const payload = JSON.parse(await base64UrlDecode(payloadStr))
    const now = Math.floor(Date.now() / 1000)
    
    if (payload.exp && payload.exp < now) {
      return null
    }
    
    return payload
  } catch {
    return null
  }
}

export async function parseBody(request) {
  try {
    return await request.json()
  } catch {
    return {}
  }
}

export function createResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function createError(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function extractUser(request, env) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  const token = authHeader.substring(7)
  const decoded = await verifyToken(token, env.JWT_SECRET)
  if (!decoded || !decoded.userId) {
    return null
  }
  
  const result = await env.DB.prepare(
    'SELECT id, email, nickname, avatar, quota_total, quota_used FROM users WHERE id = ?'
  ).bind(decoded.userId).run()
  
  return result.results?.[0] || null
}

export function calculateTokens(text) {
  return Math.ceil(text.length / 4)
}
