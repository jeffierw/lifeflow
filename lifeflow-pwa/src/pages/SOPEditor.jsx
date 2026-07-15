import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { 
  Edit3, Trash2, Plus, Save, Clock, AlertTriangle, ChevronRight,
  CheckCircle2, Circle, GripVertical, Undo2, Trash
} from 'lucide-react'
import Header from '../components/Header'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { sopAPI } from '../api'
import sopStore from '../store/sopStore'

export default function SOPEditor() {
  const navigate = useNavigate()
  const params = useParams()
  const { setCurrentSop } = sopStore()
  const [sop, setSop] = useState(null)
  const [editingStep, setEditingStep] = useState(null)
  const [editingField, setEditingField] = useState(null)
  const [loading, setLoading] = useState(false)
  const [deletedSteps, setDeletedSteps] = useState([])
  const [dragIndex, setDragIndex] = useState(null)
  const [touchStartY, setTouchStartY] = useState(null)
  const [touchStartIndex, setTouchStartIndex] = useState(null)

  useEffect(() => {
    if (params.id) {
      loadSop(params.id)
    } else if (sopStore.getState().currentSop) {
      setSop(sopStore.getState().currentSop)
    }
  }, [params.id])

  const loadSop = async (id) => {
    setLoading(true)
    try {
      const response = await sopAPI.getById(id)
      setSop(response.sop)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!sop) return
    setLoading(true)
    try {
      await sopAPI.save(sop)
      setCurrentSop(sop)
      setDeletedSteps([])
      navigate('/sops')
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleEditStep = (stepIndex, field = 'title') => {
    setEditingStep(stepIndex)
    setEditingField(field)
  }

  const handleUpdateStep = (stepIndex, field, value) => {
    const newSop = { ...sop }
    newSop.steps[stepIndex] = { ...newSop.steps[stepIndex], [field]: value }
    setSop(newSop)
  }

  const handleAddStep = () => {
    const newStep = {
      id: Date.now(),
      title: '新步骤',
      duration: 5,
      description: '',
      status: 'pending',
      dependencies: [],
    }
    const newSop = { ...sop, steps: [...sop.steps, newStep] }
    setSop(newSop)
  }

  const handleRemoveStep = (stepIndex) => {
    const step = sop.steps[stepIndex]
    setDeletedSteps(prev => [...prev, { step, index: stepIndex }])
    
    const newSop = { 
      ...sop, 
      steps: sop.steps.filter((_, i) => i !== stepIndex)
    }
    setSop(newSop)
    
    if (editingStep === stepIndex) {
      setEditingStep(null)
    }
  }

  const handleRestoreStep = (deletedIndex) => {
    const deletedItem = deletedSteps[deletedIndex]
    const newSteps = [...sop.steps]
    newSteps.splice(deletedItem.index, 0, deletedItem.step)
    const newSop = { ...sop, steps: newSteps }
    setSop(newSop)
    
    setDeletedSteps(prev => prev.filter((_, i) => i !== deletedIndex))
  }

  const handleClearTrash = () => {
    setDeletedSteps([])
  }

  const handleDragStart = (e, index) => {
    setDragIndex(index)
    if (e.type === 'touchstart') {
      setTouchStartY(e.touches[0].clientY)
      setTouchStartIndex(index)
    }
  }

  const handleTouchMove = (e) => {
    if (touchStartY === null || touchStartIndex === null) return
    
    const touchY = e.touches[0].clientY
    const deltaY = touchY - touchStartY
    const threshold = 50
    
    if (Math.abs(deltaY) > threshold) {
      const direction = deltaY > 0 ? 'down' : 'up'
      handleReorder(touchStartIndex, direction)
      setTouchStartY(null)
      setTouchStartIndex(null)
    }
  }

  const handleTouchEnd = () => {
    setTouchStartY(null)
    setTouchStartIndex(null)
    setDragIndex(null)
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
  }

  const handleDrop = (e, toIndex) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === toIndex) return
    
    const newSteps = [...sop.steps]
    const [removed] = newSteps.splice(dragIndex, 1)
    newSteps.splice(toIndex, 0, removed)
    
    const newSop = { ...sop, steps: newSteps }
    setSop(newSop)
    setDragIndex(null)
  }

  const handleDragEnd = () => {
    setDragIndex(null)
  }

  const handleReorder = (fromIndex, direction) => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1
    if (toIndex < 0 || toIndex >= sop.steps.length) return
    
    const newSteps = [...sop.steps]
    const [removed] = newSteps.splice(fromIndex, 1)
    newSteps.splice(toIndex, 0, removed)
    
    const newSop = { ...sop, steps: newSteps }
    setSop(newSop)
  }

  const handleStartExecution = () => {
    if (!sop) return
    setCurrentSop(sop)
    navigate(`/execute/${sop.id || 'temp'}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="text-center py-12 text-muted">加载中...</div>
      </div>
    )
  }

  if (!sop) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="text-center py-12">
          <p className="text-muted mb-4">没有找到 SOP</p>
          <Button onClick={() => navigate('/generate')}>创建新 SOP</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">编辑 SOP</h1>
            <p className="text-sm text-muted mt-1">{sop.goal}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" loading={loading} onClick={handleSave}>
              <Save size={16} className="mr-2" />
              保存
            </Button>
            <Button size="lg" onClick={handleStartExecution}>
              开始执行
              <ChevronRight size={16} className="ml-2" />
            </Button>
          </div>
        </div>

        <Card className="border border-border mb-6">
          <CardContent className="p-4 bg-gradient-to-r from-orange-50 to-teal-50">
            <h3 className="text-lg font-semibold text-foreground mb-3">{sop.title}</h3>
            <div className="flex items-center gap-2 text-sm text-muted mb-3">
              <Clock size={14} />
              <span>预计总时长：{sop.estimatedTotalTime || 60} 分钟</span>
            </div>
            {sop.constraints && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(sop.constraints).map(([key, value]) => (
                  <span key={key} className="bg-white px-3 py-1 text-xs text-accent border border-border">
                    {value}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {deletedSteps.length > 0 && (
          <Card className="border border-red-200 bg-red-50 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Trash size={18} className="text-red-500" />
                  <span className="font-semibold text-red-600">已删除 ({deletedSteps.length})</span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleClearTrash} className="text-red-500">
                  清空
                </Button>
              </div>
              <div className="space-y-2">
                {deletedSteps.map((item, index) => (
                  <div key={index} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-red-100">
                    <span className="text-sm text-gray-600 line-through">{item.step.title}</span>
                    <button 
                      onClick={() => handleRestoreStep(index)}
                      className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700"
                    >
                      <Undo2 size={14} />
                      恢复
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">步骤列表</h2>
          <Button variant="ghost" size="sm" onClick={handleAddStep}>
            <Plus size={14} className="mr-1" />
            添加步骤
          </Button>
        </div>

        <div className="space-y-3 mb-8">
          {sop.steps.map((step, index) => (
            <Card 
              key={step.id || index} 
              className={`border border-border transition-all duration-200 ${
                step.status === 'completed' ? 'opacity-60' : ''
              } ${dragIndex === index ? 'opacity-50' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              onTouchStart={(e) => handleDragStart(e, index)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <CardContent className="p-4 flex gap-4">
                <div className="flex-shrink-0 pt-1">
                  <GripVertical size={20} className="text-muted cursor-grab touch-none" />
                </div>

                <div className="flex-shrink-0 pt-1">
                  {step.status === 'completed' ? (
                    <CheckCircle2 size={20} className="text-green-600" />
                  ) : (
                    <Circle size={20} className="text-border" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-5 h-5 bg-secondary text-accent flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </span>
                    {editingStep === index && editingField === 'title' ? (
                      <div className="flex-1 flex gap-2">
                        <Input
                          type="text"
                          value={step.title}
                          onChange={(e) => handleUpdateStep(index, 'title', e.target.value)}
                          className="flex-1 border-accent"
                          autoFocus
                        />
                        <button 
                          className="p-2 text-accent hover:text-accent/80"
                          onClick={() => { setEditingStep(null); setEditingField(null) }}
                        >
                          <CheckCircle2 size={18} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-between">
                        <h4 className="font-semibold text-foreground cursor-pointer hover:text-accent transition-colors" onClick={() => handleEditStep(index, 'title')}>
                          {step.title}
                        </h4>
                        <button 
                          className="p-1 text-muted hover:text-accent transition-colors"
                          onClick={() => handleEditStep(index, 'title')}
                        >
                          <Edit3 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted mb-2">
                    <Clock size={12} />
                    <Input
                      type="number"
                      value={step.duration}
                      onChange={(e) => handleUpdateStep(index, 'duration', parseInt(e.target.value) || 0)}
                      className="w-16 h-6 border border-input bg-background text-center"
                    />
                    <span>分钟</span>
                  </div>

                  <div className="mb-2">
                    {editingStep === index && editingField === 'description' ? (
                      <div className="flex flex-col gap-2">
                        <Textarea
                          value={step.description}
                          onChange={(e) => handleUpdateStep(index, 'description', e.target.value)}
                          rows={3}
                          className="border-accent resize-none"
                          autoFocus
                          placeholder="输入步骤描述..."
                        />
                        <div className="flex justify-end">
                          <button 
                            className="px-3 py-1 text-sm text-accent hover:text-accent/80"
                            onClick={() => { setEditingStep(null); setEditingField(null) }}
                          >
                            完成
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between">
                        {step.description ? (
                          <p className="text-sm text-muted flex-1 mr-2">{step.description}</p>
                        ) : (
                          <p className="text-sm text-muted/50 flex-1 mr-2 italic">点击编辑描述...</p>
                        )}
                        <button 
                          className="p-1 text-muted hover:text-accent transition-colors flex-shrink-0"
                          onClick={() => handleEditStep(index, 'description')}
                        >
                          <Edit3 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {step.notes && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-amber-700 bg-amber-50 px-2 py-1">
                      <AlertTriangle size={12} />
                      <span>{step.notes}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <button 
                    className="w-7 h-7 border border-border flex items-center justify-center text-muted hover:border-red-400 hover:text-red-500 transition-colors"
                    onClick={() => handleRemoveStep(index)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3 pt-6 border-t border-border">
          <Button variant="secondary" onClick={() => navigate('/sops')}>
            返回列表
          </Button>
          <Button size="lg" onClick={handleStartExecution}>
            开始执行
            <ChevronRight size={16} className="ml-2" />
          </Button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-muted">💡 提示：在移动端可以上下滑动步骤卡片来调整顺序</p>
        </div>
      </div>
    </div>
  )
}