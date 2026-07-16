const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787'

const request = async (path, options = {}) => {
  const token = localStorage.getItem('lifeflow_token')
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
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
  generate: (goal, constraints = {}) => request('/api/sop/generate', { method: 'POST', body: JSON.stringify({ goal, constraints }) }),
  ask: (goal, questions, answers, conversationHistory) => request('/api/sop/ask', { method: 'POST', body: JSON.stringify({ goal, questions, answers, conversationHistory }) }),
  askStream: (goal, questions, answers, conversationHistory, callbacks = {}) => {
    const { onChunk, onDone, onError } = callbacks
    const token = localStorage.getItem('lifeflow_token')
    const headers = {
      'Content-Type': 'application/json',
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    fetch(`${API_BASE}/api/sop/ask`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ goal, questions, answers, conversationHistory }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: '请求失败' }))
          throw new Error(error.error || error.message || '请求失败')
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
              // ignore malformed chunks
            }
          }
        }

        try {
          const jsonMatch = fullContent.match(/\{[\s\S]*\}/)
          const result = jsonMatch
            ? JSON.parse(jsonMatch[0])
            : { questions: [], message: '信息已足够，可以生成 SOP' }
          onDone?.(result)
        } catch (err) {
          onError?.(new Error('解析 AI 回复失败'))
        }
      })
      .catch((err) => {
        onError?.(err)
      })
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
