import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Mail, CreditCard, Save, ArrowLeft, Edit3, RefreshCw, Loader2, ImagePlus } from 'lucide-react'
import Header from '../components/Header'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import authStore from '../store/authStore'
import { authAPI } from '../api'
import { useSound } from '../hooks/useSound'
import Toast from '../components/Toast'

export default function Profile() {
  const navigate = useNavigate()
  const { user, logout, setUser } = authStore()
  const { playClick, playSuccess, playError } = useSound()
  const [profile, setProfile] = useState(user)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [nickname, setNickname] = useState(user?.nickname || '')
  const [avatar, setAvatar] = useState(user?.avatar || '')
  const [toast, setToast] = useState(null)
  const loadProfileRef = useRef(async () => {})

  loadProfileRef.current = async () => {
    setLoading(true)
    try {
      const response = await authAPI.getProfile()
      setProfile(response)
      setNickname(response.nickname || '')
      setAvatar(response.avatar || '')
      setUser(response)
    } catch (error) {
      console.error('加载个人信息失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    playClick()
    try {
      const response = await authAPI.updateProfile({ nickname, avatar })
      setUser(response)
      setProfile(response)
      setEditing(false)
      playSuccess()
      setToast({ message: '保存成功！', type: 'success' })
    } catch {
      playError()
      setToast({ message: '保存失败，请重试', type: 'error' })
    }
  }

  const handleLogout = () => {
    playClick()
    logout()
    navigate('/auth')
  }

  const formatQuota = (bytes) => {
    return bytes.toString()
  }

  const quotaPercentage = profile ? ((profile.quota_used / profile.quota_total) * 100).toFixed(1) : 0

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fff8f0]">
        <Header />
        <div className="text-center py-12">
          <Loader2 size={24} className="animate-spin mx-auto text-[#ff8c42]" />
          <p className="text-sm text-[#9a9a9a] mt-2">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fff8f0]">
      <Header />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button 
            className="w-10 h-10 border-2 border-[#ffd4b8] bg-white flex items-center justify-center hover:border-[#ff8c42] transition-colors"
            onClick={() => {
              playClick()
              navigate(-1)
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-[#3d3d3d]">👤 个人信息</h1>
        </div>

        <Card className="border-2 border-[#ffd4b8] shadow-lg mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col items-center">
              <div className="relative mb-4">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold ${
                  avatar 
                    ? 'bg-cover bg-center' 
                    : 'bg-[#ffe8d6] text-[#ff8c42]'
                }`}
                style={avatar ? { backgroundImage: `url(${avatar})` } : {}}
                >
                  {avatar ? null : (user?.nickname?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U')}
                </div>
                {editing && (
                  <button 
                    className="absolute bottom-0 right-0 w-8 h-8 bg-[#ff8c42] text-white rounded-full flex items-center justify-center hover:bg-[#e07a36] transition-colors"
                    onClick={() => {
                      const input = document.createElement('input')
                      input.type = 'file'
                      input.accept = 'image/*'
                      input.onchange = (e) => {
                        const file = e.target.files[0]
                        if (file) {
                          const reader = new FileReader()
                          reader.onload = (event) => {
                            setAvatar(event.target.result)
                          }
                          reader.readAsDataURL(file)
                        }
                      }
                      input.click()
                    }}
                  >
                    <ImagePlus size={16} />
                  </button>
                )}
              </div>

              {editing ? (
                <div className="w-full space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-[#3d3d3d]">昵称</label>
                    <Input
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="输入昵称"
                      className="border-2 border-[#ffd4b8] bg-white focus:border-[#ff8c42] focus:ring-2 focus:ring-[#ff8c42]/20"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setEditing(false)} className="flex-1">
                      取消
                    </Button>
                    <Button onClick={handleSave} className="flex-1">
                      <Save size={16} className="mr-2" />
                      保存
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-[#3d3d3d] mb-1">
                    {nickname || '未设置昵称'}
                  </h2>
                  <p className="text-sm text-[#9a9a9a] mb-4">{user?.email}</p>
                  <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                    <Edit3 size={14} className="mr-2" />
                    编辑资料
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-[#ffd4b8] shadow-lg mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <CreditCard size={24} className="text-[#ff8c42]" />
              <h2 className="text-lg font-bold text-[#3d3d3d]">Token 使用情况</h2>
              <button 
                type="button"
                className="ml-auto p-2 text-[#9a9a9a] hover:text-[#ff8c42] transition-colors"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  playClick()
                  loadProfileRef.current()
                }}
              >
                <RefreshCw size={16} />
              </button>
            </div>

            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-[#9a9a9a]">已使用</span>
                <span className="font-semibold text-[#3d3d3d]">{formatQuota(profile.quota_used)}</span>
              </div>
              <div className="flex justify-between text-sm mb-3">
                <span className="text-[#9a9a9a]">剩余</span>
                <span className="font-semibold text-[#3d3d3d]">{formatQuota(profile.quota_remaining)}</span>
              </div>
              <div className="h-3 bg-[#ffe8d6] rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${
                    parseFloat(quotaPercentage) > 90 ? 'bg-red-500' : 'bg-[#ff8c42]'
                  }`}
                  style={{ width: `${Math.min(100, quotaPercentage)}%` }}
                />
              </div>
              <p className="text-xs text-[#9a9a9a] mt-2 text-center">
                已使用 {quotaPercentage}%
              </p>
            </div>

            <div className="bg-[#fff3e6] p-4 rounded-lg">
              <p className="text-sm text-[#3d3d3d]">
                💡 每次生成 SOP 或提问都会消耗少量 Token。当 Token 用完后，将无法使用 AI 功能。
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-[#ffd4b8] shadow-lg">
          <CardContent className="p-6">
            <div className="space-y-3">
              <button 
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#ffe8d6] transition-colors rounded-lg"
                onClick={() => {
                  playClick()
                  navigate('/settings')
                }}
              >
                <div className="w-10 h-10 bg-[#ffe8d6] rounded-full flex items-center justify-center">
                  <Edit3 size={18} className="text-[#ff8c42]" />
                </div>
                <div>
                  <p className="font-semibold text-[#3d3d3d]">设置</p>
                  <p className="text-xs text-[#9a9a9a]">语音配置、语音控制关键词</p>
                </div>
              </button>

              <button 
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#ffe8d6] transition-colors rounded-lg"
                onClick={() => {
                  playClick()
                  navigate('/invite')
                }}
              >
                <div className="w-10 h-10 bg-[#ffe8d6] rounded-full flex items-center justify-center">
                  <Mail size={18} className="text-[#ff8c42]" />
                </div>
                <div>
                  <p className="font-semibold text-[#3d3d3d]">邀请好友</p>
                  <p className="text-xs text-[#9a9a9a]">获取更多 Token 配额</p>
                </div>
              </button>

              <button 
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#ffe8d6] transition-colors rounded-lg"
                onClick={handleLogout}
              >
                <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
                  <User size={18} className="text-red-500" />
                </div>
                <div>
                  <p className="font-semibold text-red-500">退出登录</p>
                  <p className="text-xs text-[#9a9a9a]">安全退出当前账号</p>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}