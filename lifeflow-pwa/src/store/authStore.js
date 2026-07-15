import { create } from 'zustand'

const authStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('lifeflow_token') || null,
  isAuthenticated: !!localStorage.getItem('lifeflow_token'),
  
  voiceSettings: JSON.parse(localStorage.getItem('lifeflow_voice_settings') || '{"voiceName": "", "pitch": 1.1, "rate": 1}'),
  
  speechKeywords: JSON.parse(localStorage.getItem('lifeflow_speech_keywords') || '["下一步", "哈吉米"]'),
  
  showOnboarding: !!localStorage.getItem('lifeflow_first_login') === false,
  
  login: (user, token) => {
    localStorage.setItem('lifeflow_token', token)
    set({ user, token, isAuthenticated: true })
  },
  
  logout: () => {
    localStorage.removeItem('lifeflow_token')
    set({ user: null, token: null, isAuthenticated: false })
  },
  
  setUser: (user) => {
    set({ user })
  },
  
  setVoiceSettings: (settings) => {
    localStorage.setItem('lifeflow_voice_settings', JSON.stringify(settings))
    set({ voiceSettings: settings })
  },
  
  setSpeechKeywords: (keywords) => {
    localStorage.setItem('lifeflow_speech_keywords', JSON.stringify(keywords))
    set({ speechKeywords: keywords })
  },
  
  completeOnboarding: () => {
    localStorage.setItem('lifeflow_first_login', 'true')
    set({ showOnboarding: false })
  },
}))

export default authStore
