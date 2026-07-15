import { useEffect } from 'react'
import { CheckCircle, X, AlertCircle, Info } from 'lucide-react'

export default function Toast({ message, type = 'success', onClose, duration = 3000 }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, duration)
    return () => clearTimeout(timer)
  }, [onClose, duration])

  const icons = {
    success: <CheckCircle size={18} className="text-green-600" />,
    error: <AlertCircle size={18} className="text-red-600" />,
    info: <Info size={18} className="text-blue-600" />,
  }

  const colors = {
    success: 'bg-green-50 border-green-200 text-green-700',
    error: 'bg-red-50 border-red-200 text-red-700',
    info: 'bg-blue-50 border-blue-200 text-blue-700',
  }

  return (
    <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-[100] px-4 py-3 rounded-lg border-2 shadow-lg flex items-center gap-3 ${colors[type]} animate-fade-in`}>
      {icons[type]}
      <span className="text-sm font-medium">{message}</span>
      <button 
        onClick={onClose}
        className="text-current hover:opacity-70 transition-opacity"
      >
        <X size={16} />
      </button>
    </div>
  )
}