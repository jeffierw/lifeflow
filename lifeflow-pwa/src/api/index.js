const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787'

function commonHeaders() {
  const headers = { 'Content-Type': 'application/json' }
  const token = localStorage.getItem('lifeflow_token')
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

const request = async (path, options = {}) => {
  const headers = { ...commonHeaders(), ...(options.headers || {}) }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: '请求失败' }))
    throw new Error(error.error || error.message || '请求失败')
  }

  return response.json()
}

/**
 * 通用 SSE 读取器
 * @param {Promise<Response> | Response} responsePromise
 * @param {{ onChunk?: (delta: string, full: string) => void, onDone?: (full: string) => void, onError?: (e: Error) => void }} callbacks
 * @param {AbortController} controller
 */
async function readSSE(response, callbacks, controller) {
  const { onChunk, onDone, onError } = callbacks
  try {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: '请求失败' }))
      throw new Error(error.error || error.message || `HTTP ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') continue
        try {
          const json = JSON.parse(data)
          const content = json.choices?.[0]?.delta?.content
          if (content) {
            fullContent += content
            onChunk?.(content, fullContent)
          }
        } catch {
          // ignore
        }
      }
    }
    onDone?.(fullContent)
  } catch (err) {
    if (err?.name === 'AbortError') {
      onError?.(new Error('请求已取消'))
    } else {
      onError?.(err instanceof Error ? err : new Error(String(err)))
    }
  }
}

export const authAPI = {
  register: (data) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  getProfile: () => request('/api/auth/profile'),
  updateProfile: (data) => request('/api/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
  refreshToken: () => request('/api/auth/refresh'),
}

export const inviteAPI = {
  apply: (email) => request('/api/invite/apply', { method: 'POST', body: JSON.stringify({ email }) }),
  validate: (code) => request('/api/invite/validate', { method: 'POST', body: JSON.stringify({ code }) }),
}

export const sopAPI = {
  generate: (goal, constraints = {}) =>
    request('/api/sop/generate', { method: 'POST', body: JSON.stringify({ goal, constraints }) }),

  ask: (goal, questions, answers, conversationHistory) =>
    request('/api/sop/ask', {
      method: 'POST',
      body: JSON.stringify({ goal, questions, answers, conversationHistory }),
    }),

  /**
   * 流式 ask，返回可取消句柄 { abort }
   */
  askStream: (goal, questions, answers, conversationHistory, callbacks = {}) => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    const abort = () => controller?.abort()

    const run = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/sop/ask`, {
          method: 'POST',
          headers: commonHeaders(),
          body: JSON.stringify({ goal, questions, answers, conversationHistory }),
          signal: controller?.signal,
        })
        await readSSE(response, {
          onChunk: callbacks.onChunk,
          onError: callbacks.onError,
          onDone: (fullContent) => {
            try {
              const jsonMatch = fullContent.match(/\{[\s\S]*\}/)
              if (!jsonMatch) throw new Error('无效的 AI 回复')
              const result = JSON.parse(jsonMatch[0])
              if (!Array.isArray(result.questions)) throw new Error('无效的追问结果')
              callbacks.onDone?.(result)
            } catch (err) {
              callbacks.onError?.(new Error('解析 AI 回复失败'))
            }
          },
        }, controller)
      } catch (err) {
        if (err?.name === 'AbortError') {
          callbacks.onError?.(new Error('请求已取消'))
        } else {
          callbacks.onError?.(err instanceof Error ? err : new Error(String(err)))
        }
      }
    }
    run()
    return { abort }
  },

  /**
   * SOP 执行场景智能问答（流式，返回可取消句柄）
   * @param {{ sopId?: any, currentStepId?: any, sop: object, message: string, history?: Array, stream?: boolean }} payload
   */
  chatStream: (payload, callbacks = {}) => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    const abort = () => controller?.abort()

    const run = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/sop/chat`, {
          method: 'POST',
          headers: commonHeaders(),
          body: JSON.stringify({ stream: true, ...payload }),
          signal: controller?.signal,
        })
        await readSSE(response, callbacks, controller)
      } catch (err) {
        if (err?.name === 'AbortError') {
          callbacks.onError?.(new Error('请求已取消'))
        } else {
          callbacks.onError?.(err instanceof Error ? err : new Error(String(err)))
        }
      }
    }
    run()
    return { abort }
  },

  getList: () => request('/api/sop/list'),
  getById: (id) => request(`/api/sop/${id}`),
  save: (sop) => request('/api/sop/save', { method: 'POST', body: JSON.stringify(sop) }),
  delete: (id) => request(`/api/sop/${id}`, { method: 'DELETE' }),
}

export const quotaAPI = {
  getStatus: () => request('/api/quota/status'),
}

export const settingsAPI = {
  getSettings: () => request('/api/settings'),
  saveSettings: (data) => request('/api/settings', { method: 'POST', body: JSON.stringify(data) }),
}

export default request
