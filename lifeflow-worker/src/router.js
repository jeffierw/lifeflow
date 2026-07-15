export class Router {
  constructor(request, env) {
    this.request = request
    this.env = env
    this.url = new URL(request.url)
    this.path = this.url.pathname
    this.method = request.method
  }

  async handle() {
    if (this.method === 'OPTIONS') {
      return this.corsResponse()
    }

    if (this.path.startsWith('/api/auth')) {
      return this.withCors(this.handleAuth())
    }
    if (this.path.startsWith('/api/invite')) {
      return this.withCors(this.handleInvite())
    }
    if (this.path.startsWith('/api/sop')) {
      return this.withCors(this.handleSOP())
    }
    if (this.path.startsWith('/api/quota')) {
      return this.withCors(this.handleQuota())
    }
    if (this.path.startsWith('/api/settings')) {
      return this.withCors(this.handleSettings())
    }
    return this.withCors(this.notFound())
  }

  async withCors(promise) {
    try {
      const response = await promise
      const headers = new Headers(response?.headers || {})
      headers.set('Access-Control-Allow-Origin', '*')
      headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      headers.set('Access-Control-Max-Age', '86400')
      return new Response(response?.body, {
        status: response?.status || 500,
        headers,
      })
    } catch (error) {
      console.error('CORS error:', error)
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      })
    }
  }

  corsResponse() {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  async handleAuth() {
    const auth = await import('./auth')
    const handler = new auth.AuthHandler(this.request, this.env)
    return handler.handle()
  }

  async handleInvite() {
    const invite = await import('./invite')
    const handler = new invite.InviteHandler(this.request, this.env)
    return handler.handle()
  }

  async handleSOP() {
    const sop = await import('./sop')
    const handler = new sop.SOPHandler(this.request, this.env)
    return handler.handle()
  }

  async handleQuota() {
    const quota = await import('./quota')
    const handler = new quota.QuotaHandler(this.request, this.env)
    return handler.handle()
  }

  async handleSettings() {
    const settings = await import('./settings')
    const handler = new settings.SettingsHandler(this.request, this.env)
    return handler.handle()
  }

  notFound() {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
