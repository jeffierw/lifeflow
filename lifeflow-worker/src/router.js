export class Router {
  constructor(request, env) {
    this.request = request
    this.env = env
    this.url = new URL(request.url)
    this.path = this.url.pathname
    this.method = request.method
  }

  async handle() {
    const tStart = Date.now()
    const method = this.method
    const path = this.path

    if (method === 'OPTIONS') {
      console.log(`[REQ] ${method} ${path} → 204 preflight (${Date.now() - tStart}ms)`)
      return this.corsResponse()
    }

    let promise
    if (path.startsWith('/api/executions')) {
      promise = import('./execution.js').then(({ ExecutionHandler }) => new ExecutionHandler(this.request, this.env).handle())
    } else if (path.startsWith('/api/auth')) {
      promise = this.handleAuth()
    } else if (path.startsWith('/api/invite')) {
      promise = this.handleInvite()
    } else if (path.startsWith('/api/sop')) {
      promise = this.handleSOP()
    } else if (path.startsWith('/api/quota')) {
      promise = this.handleQuota()
    } else if (path.startsWith('/api/settings')) {
      promise = this.handleSettings()
    } else {
      promise = this.notFound()
    }

    const wrapped = promise.then(resp => {
      const dur = Date.now() - tStart
      console.log(`[REQ] ${method} ${path} → ${resp?.status || 0} (${dur}ms)`)
      return resp
    }).catch(err => {
      const dur = Date.now() - tStart
      console.error(`[REQ] ${method} ${path} → ERROR (${dur}ms):`, err?.message || err)
      throw err
    })

    return this.withCors(wrapped)
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
