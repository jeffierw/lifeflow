import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Menu, X, Home, LogOut, Settings, ChevronRight, User } from 'lucide-react'
import authStore from '../store/authStore'
import { Button } from './ui/Button'

const navItems = [
  { path: '/', label: '首页', icon: Home },
  { path: '/generate', label: '生成 SOP' },
  { path: '/sops', label: '我的 SOP' },
]

export default function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, user, logout } = authStore()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/auth')
    setMenuOpen(false)
  }

  return (
    <header className="sticky top-0 z-50 bg-[#fff8f0]/95 backdrop-blur-sm border-b-2 border-[#ffd4b8]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          <button 
            className="flex items-center gap-3 text-[#3d3d3d]"
            onClick={() => navigate('/')}
          >
            <div className="w-8 h-8 bg-[#ff8c42] text-white flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12 Q12 8 16 12 Q12 16 8 12" strokeLinecap="round" />
                <circle cx="14" cy="12" r="2" fill="currentColor" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight">LifeFlow</span>
          </button>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <button
                  key={item.path}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'bg-[#ff8c42] text-white' : 'text-[#9a9a9a] hover:text-[#3d3d3d] hover:bg-[#ffe8d6]'
                  }`}
                  onClick={() => navigate(item.path)}
                >
                  {Icon && <Icon size={18} />}
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <button 
                  className="w-9 h-9 bg-[#ffe8d6] text-[#ff8c42] font-semibold text-sm flex items-center justify-center hover:bg-[#ffd4b8] transition-colors"
                  onClick={() => navigate('/settings')}
                >
                  <Settings size={18} />
                </button>
                <button 
                  className="w-9 h-9 bg-[#ffe8d6] text-[#3d3d3d] font-semibold text-sm flex items-center justify-center hover:bg-[#ffd4b8] transition-colors"
                  onClick={() => navigate('/profile')}
                >
                  {user?.avatar ? (
                    <img src={user.avatar} alt="avatar" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    user?.nickname?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'
                  )}
                </button>
                <button 
                  className="p-2 text-[#9a9a9a] hover:text-[#ff8c42] hover:bg-[#ffe8d6] transition-colors"
                  onClick={handleLogout}
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <Button variant="default" size="sm" onClick={() => navigate('/auth')}>
                登录
                <ChevronRight size={16} />
              </Button>
            )}
          </div>

          <button 
            className="md:hidden p-2 text-[#3d3d3d]"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t-2 border-[#ffd4b8] bg-[#fff8f0]">
          <div className="px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <button
                  key={item.path}
                  className={`flex items-center gap-3 w-full px-4 py-3 text-base ${
                    isActive ? 'bg-[#ff8c42] text-white' : 'text-[#9a9a9a] hover:text-[#3d3d3d] hover:bg-[#ffe8d6]'
                  }`}
                  onClick={() => {
                    navigate(item.path)
                    setMenuOpen(false)
                  }}
                >
                  {Icon && <Icon size={20} />}
                  <span>{item.label}</span>
                </button>
              )
            })}
            {isAuthenticated && (
              <>
                <button 
                  className="flex items-center gap-3 w-full px-4 py-3 text-base text-[#ff8c42] hover:bg-[#ffe8d6]"
                  onClick={() => {
                    navigate('/profile')
                    setMenuOpen(false)
                  }}
                >
                  <User size={20} />
                  <span>个人信息</span>
                </button>
                <button 
                  className="flex items-center gap-3 w-full px-4 py-3 text-base text-[#ff8c42] hover:bg-[#ffe8d6]"
                  onClick={() => {
                    navigate('/settings')
                    setMenuOpen(false)
                  }}
                >
                  <Settings size={20} />
                  <span>设置</span>
                </button>
                <button 
                  className="flex items-center gap-3 w-full px-4 py-3 text-base text-[#ff8c42] hover:bg-[#ffe8d6] mt-2"
                  onClick={handleLogout}
                >
                  <LogOut size={20} />
                  <span>退出登录</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
