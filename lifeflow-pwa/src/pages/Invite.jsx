import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Send, CheckCircle, AlertCircle } from 'lucide-react'
import Header from '../components/Header'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card, CardContent } from '../components/ui/Card'
import { inviteAPI } from '../api'
import Toast from '../components/Toast'

export default function Invite() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null)
  const [message, setMessage] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [toast, setToast] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setStatus(null)
    setMessage('')

    try {
      const response = await inviteAPI.apply(email)
      setStatus('success')
      setMessage(response.message)
      setInviteCode(response.code)
    } catch (err) {
      setStatus('error')
      setMessage(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fff8f0]">
      <Header />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
        <Card className="border-2 border-[#ffd4b8] shadow-lg">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-[#ffe8d6] text-[#ff8c42] flex items-center justify-center mx-auto mb-4">
                <Mail size={32} />
              </div>
              <h1 className="text-2xl font-bold text-[#3d3d3d] mb-2">申请试用邀请码</h1>
              <p className="text-[#9a9a9a]">输入你的邮箱，邀请码会立即显示在页面上。每个邀请码包含 1000 万 token 额度。</p>
            </div>

            {status === 'success' && (
              <div className="bg-[#ffe8d6] border-2 border-[#ffd4b8] text-[#3d3d3d] p-6 mb-6 flex flex-col items-center gap-4">
                <CheckCircle size={24} className="text-[#ff8c42]" />
                <p className="text-center font-semibold">{message}</p>
                {inviteCode && (
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-sm font-semibold">您的邀请码：</p>
                    <div className="bg-white border-2 border-[#ffd4b8] px-6 py-3 text-xl font-bold tracking-wider text-[#ff8c42]">
                      {inviteCode}
                    </div>
                    <button
                      type="button"
                      className="text-sm text-[#ff8c42] hover:text-[#e07a36] flex items-center gap-1"
                      onClick={() => {
                        navigator.clipboard.writeText(inviteCode)
                        setToast({ message: '邀请码已复制到剪贴板！', type: 'success' })
                      }}
                    >
                      📋 复制邀请码
                    </button>
                  </div>
                )}
                <Button
                  size="sm"
                  onClick={() => navigate('/auth')}
                >
                  去注册
                </Button>
              </div>
            )}

            {status === 'error' && (
              <div className="bg-red-50 border border-red-200 text-red-600 p-4 mb-6 flex items-center gap-3">
                <AlertCircle size={20} />
                <p>{message}</p>
              </div>
            )}

            {!status && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[#3d3d3d]">邮箱地址</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="h-12 border-2 border-[#ffd4b8] bg-white focus:border-[#ff8c42] focus:ring-2 focus:ring-[#ff8c42]/20"
                  />
                </div>

                <Button type="submit" size="lg" className="w-full" loading={loading}>
                  <Send size={18} className="mr-2" />
                  提交申请
                </Button>
              </form>
            )}

            <div className="mt-6 pt-6 border-t-2 border-[#ffd4b8]">
              <h4 className="text-sm font-semibold text-[#3d3d3d] mb-3">试用说明</h4>
              <ul className="space-y-2">
                <li className="text-sm text-[#9a9a9a] flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-[#ff8c42] mt-1.5 flex-shrink-0" />
                  每个邀请码包含 1000 万 token 额度
                </li>
                <li className="text-sm text-[#9a9a9a] flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-[#ff8c42] mt-1.5 flex-shrink-0" />
                  额度可根据使用情况调整
                </li>
                <li className="text-sm text-[#9a9a9a] flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-[#ff8c42] mt-1.5 flex-shrink-0" />
                  邀请码仅用于注册验证
                </li>
                <li className="text-sm text-[#9a9a9a] flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-[#ff8c42] mt-1.5 flex-shrink-0" />
                  如有问题请联系客服
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
