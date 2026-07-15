import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Play, Edit, Trash2, Clock, Calendar, AlertCircle } from 'lucide-react'
import Header from '../components/Header'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import { sopAPI } from '../api'
import sopStore from '../store/sopStore'

export default function SOPList() {
  const navigate = useNavigate()
  const { sops, updateSops, setCurrentSop } = sopStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadSops()
  }, [])

  const loadSops = async () => {
    setLoading(true)
    try {
      const response = await sopAPI.getList()
      updateSops(response.sops || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('确定要删除这个 SOP 吗？')) return
    try {
      await sopAPI.delete(id)
      loadSops()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleExecute = (sop) => {
    setCurrentSop(sop)
    navigate(`/execute/${sop.id}`)
  }

  const handleEdit = (sop) => {
    setCurrentSop(sop)
    navigate(`/editor/${sop.id}`)
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const getCompletedCount = (sop) => {
    return sop.steps?.filter(s => s.status === 'completed').length || 0
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">我的 SOP</h1>
            <p className="text-sm text-muted mt-1">管理和执行你的生活流程</p>
          </div>
          <Button size="lg" onClick={() => navigate('/generate')}>
            <Plus size={18} className="mr-2" />
            创建新 SOP
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 text-sm mb-6 flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-muted">加载中...</div>
        ) : sops.length === 0 ? (
          <Card className="border border-border">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-secondary text-muted flex items-center justify-center mx-auto mb-4">
                <Calendar size={32} />
              </div>
              <p className="text-muted mb-4">还没有创建任何 SOP</p>
              <Button onClick={() => navigate('/generate')}>
                <Plus size={16} className="mr-2" />
                创建第一个 SOP
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sops.map((sop) => (
              <Card key={sop.id} className="border border-border hover:border-accent transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-base font-semibold text-foreground">{sop.title}</h3>
                    <span className={`text-xs font-semibold px-2 py-1 ${
                      getCompletedCount(sop) === sop.steps?.length 
                        ? 'bg-green-100 text-green-700' 
                        : getCompletedCount(sop) > 0 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-secondary text-accent'
                    }`}>
                      {getCompletedCount(sop) === sop.steps?.length 
                        ? '已完成' 
                        : getCompletedCount(sop) > 0 
                          ? '进行中' 
                          : '待执行'
                      }
                    </span>
                  </div>
                  
                  <p className="text-sm text-muted mb-3 line-clamp-2">{sop.goal}</p>

                  <div className="flex gap-4 mb-3">
                    <span className="flex items-center gap-1 text-xs text-muted">
                      <Clock size={12} />
                      {sop.estimatedTotalTime || 60} 分钟
                    </span>
                    <span className="text-xs text-muted">
                      {sop.steps?.length || 0} 步骤
                    </span>
                  </div>

                  <div className="h-1 bg-secondary mb-2">
                    <div 
                      className="h-full bg-accent transition-all" 
                      style={{ width: `${(getCompletedCount(sop) / (sop.steps?.length || 1)) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted mb-4">
                    {getCompletedCount(sop)}/{sop.steps?.length} 已完成
                  </p>

                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <span className="text-xs text-muted">{formatDate(sop.createdAt)}</span>
                    <div className="flex gap-2">
                      <button 
                        className="w-7 h-7 border border-border flex items-center justify-center text-muted hover:border-accent hover:text-accent transition-colors"
                        onClick={() => handleEdit(sop)}
                      >
                        <Edit size={14} />
                      </button>
                      <button 
                        className="w-7 h-7 bg-accent text-accentForeground flex items-center justify-center hover:bg-accent/90 transition-colors"
                        onClick={() => handleExecute(sop)}
                      >
                        <Play size={14} />
                      </button>
                      <button 
                        className="w-7 h-7 border border-border flex items-center justify-center text-muted hover:border-red-400 hover:text-red-500 transition-colors"
                        onClick={() => handleDelete(sop.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
