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
