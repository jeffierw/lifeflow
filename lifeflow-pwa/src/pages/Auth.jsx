import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Mail, Lock, User, ArrowRight, Eye, EyeOff } from 'lucide-react'
import Header from '../components/Header'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card, CardContent } from '../components/ui/Card'
import { authAPI } from '../api'
import authStore from '../store/authStore'

export default function Auth() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = authStore()
  const [isLogin, setIsLogin] = useState(location.state?.mode !== 'register')
  const [email, setEmail] = useState(location.state?.email || '')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isLogin) {
        const response = await authAPI.login({ email, password })
        login(response.user, response.token)
        navigate('/')
      } else {
        await authAPI.register({ email, password, inviteCode })
        const response = await authAPI.login({ email, password })
        login(response.user, response.token)
        navigate('/onboarding')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fff8f0]">
      <Header />
      
      <div className="max-w-md mx-auto px-4 sm:px-6 py-8">
        <Card className="border-2 border-[#ffd4b8] shadow-lg">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <div className="w-14 h-14 bg-[#ff8c42] text-white flex items-center justify-center mx-auto mb-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 12 Q12 8 16 12 Q12 16 8 12" strokeLinecap="round" />
                  <circle cx="14" cy="12" r="2" fill="currentColor" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-[#3d3d3d] mb-2">{isLogin ? '欢迎回来' : '创建账号'}</h1>
              <p className="text-[#9a9a9a]">{isLogin ? '登录你的 LifeFlow 账号' : '开始你的生活编排之旅'}</p>
            </div>

            {error && (
              <div className="bg-red-50 border-2 border-red-200 text-red-600 px-4 py-3 text-sm mb-6">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-[#3d3d3d]">
                  <Mail size={16} />
                  <span>邮箱地址</span>
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="h-12 border-2 border-[#ffd4b8] bg-white focus:border-[#ff8c42] focus:ring-2 focus:ring-[#ff8c42]/20"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-[#3d3d3d]">
                  <Lock size={16} />
                  <span>密码</span>
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="至少 6 个字符"
                    required
                    className="h-12 border-2 border-[#ffd4b8] bg-white focus:border-[#ff8c42] focus:ring-2 focus:ring-[#ff8c42]/20 pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9a9a9a] hover:text-[#ff8c42] transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {!isLogin && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm font-semibold text-[#3d3d3d]">
                      <User size={16} />
                      <span>邀请码</span>
                    </label>
                    <button
                      type="button"
                      className="text-xs text-[#ff8c42] font-semibold border-b border-[#ff8c42] pb-0.5 hover:text-[#e07a36] transition-colors"
                      onClick={() => navigate('/invite')}
                    >
                      申请邀请码
                    </button>
                  </div>
                  <Input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="输入邀请码"
                    required
                    className="h-12 border-2 border-[#ffd4b8] bg-white focus:border-[#ff8c42] focus:ring-2 focus:ring-[#ff8c42]/20"
                  />
                </div>
              )}

              <Button type="submit" size="lg" className="w-full" loading={loading}>
                {isLogin ? '登录' : '注册'}
                <ArrowRight size={18} className="ml-2" />
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t-2 border-[#ffd4b8] text-center">
              {isLogin ? (
                <p className="text-sm text-[#9a9a9a]">
                  还没有账号？
                  <button 
                    className="text-[#ff8c42] font-semibold ml-1 hover:underline"
                    onClick={() => setIsLogin(false)}
                  >
                    立即注册
                  </button>
                </p>
              ) : (
                <p className="text-sm text-[#9a9a9a]">
                  已有账号？
                  <button 
                    className="text-[#ff8c42] font-semibold ml-1 hover:underline"
                    onClick={() => setIsLogin(true)}
                  >
                    立即登录
                  </button>
                </p>
              )}
            </div>

            {!isLogin && (
              <div className="mt-4 bg-[#ffe8d6] p-4">
                <p className="text-sm text-[#9a9a9a] text-center mb-2">需要邀请码？</p>
                <button 
                  className="w-full bg-[#ff8c42] text-white py-2 text-sm font-semibold hover:bg-[#e07a36] transition-colors"
                  onClick={() => navigate('/invite')}
                >
                  申请试用邀请码
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
