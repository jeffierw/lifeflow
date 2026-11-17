import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Play, Pause, Check, SkipForward, Timer, X, Mic, MicOff, Volume2, RefreshCw, Send, Square } from 'lucide-react'
import Header from '../components/Header'
import { Button } from '../components/ui/Button'
import EmergencyOverlay from '../components/EmergencyOverlay'
import PlanChangePreview from '../components/PlanChangePreview'
import { useVoiceAgent } from '../hooks/useVoiceAgent'
import authStore from '../store/authStore'
import { executionAPI } from '../api'

const labels = { pending: '未开始', running: '进行中', completed: '已完成', skipped: '已跳过' }
const statusStyles = { pending: 'text-gray-600', running: 'text-teal-700', completed: 'text-green-700', skipped: 'text-gray-500' }

function clock(seconds) {
  const absolute = Math.abs(seconds)
  return `${Math.floor(absolute / 60)}:${String(absolute % 60).padStart(2, '0')}`
}

export default function SOPExecutor() {
  const { id: sopId } = useParams()
  const navigate = useNavigate()
  const { voiceSettings, speechKeywords } = authStore()
  const [execution, setExecution] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pendingEvent, setPendingEvent] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [now, setNow] = useState(Date.now())
  const [timerMinutes, setTimerMinutes] = useState(5)
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [emergency, setEmergency] = useState(null)
  const executionRef = useRef(null)
  const lock = useRef(false)
  const alive = useRef(true)
  const agentFlight = useRef(null)
  const startRequest = useRef(crypto.randomUUID())
  const routeRef = useRef(sopId)
  if (routeRef.current !== sopId) {
    routeRef.current = sopId
    startRequest.current = crypto.randomUUID()
  }

  const accept = useCallback(snapshot => {
    if (!alive.current || snapshot.sopId !== routeRef.current) return
    if (executionRef.current?.id === snapshot.id && executionRef.current.revision > snapshot.revision) return
    executionRef.current = snapshot
    setExecution(snapshot)
    setSelectedId(previous => snapshot.steps.some(step => step.id === previous) ? previous
      : (snapshot.steps.find(step => step.status === 'running') || snapshot.steps.find(step => step.status === 'pending') || snapshot.steps[0]).id)
  }, [])

  const refresh = useCallback(async () => {
    const current = executionRef.current
    if (current) {
      const response = await executionAPI.get(current.id)
      accept(response.execution)
    }
  }, [accept])

  useEffect(() => {
    let cancelled = false
    alive.current = true
    executionRef.current = null
    setExecution(null)
    setLoading(true)
    executionAPI.start(sopId, startRequest.current)
      .then(response => { if (!cancelled) accept(response.execution) })
      .catch(failure => { if (!cancelled) setError(failure.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => {
      cancelled = true
      alive.current = false
      agentFlight.current?.abort()
    }
  }, [sopId, accept])

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    const sync = () => refresh().catch(failure => { if (alive.current) setError(failure.message) })
    window.addEventListener('focus', sync)
    window.addEventListener('online', sync)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', sync)
      window.removeEventListener('online', sync)
    }
  }, [refresh])

  const mutate = useCallback(async (type, payload = {}, retry = null) => {
    if (lock.current || !executionRef.current) return
    if (pendingEvent && !retry) { setError('上一操作结果尚未确认，请先重试同步。'); return }
    lock.current = true
    setBusy(true)
    setError('')
    const current = executionRef.current
    const event = retry || { type, payload, requestId: crypto.randomUUID(), expectedRevision: current.revision }
    setPendingEvent(event)
    try {
      const response = await executionAPI.event(current.id, event)
      accept(response.execution)
      setPendingEvent(null)
      return response.execution
    } catch (failure) {
      if (alive.current) {
        setError(failure.message)
        if (failure.status && failure.status < 500) setPendingEvent(null)
        await refresh().catch(() => {})
      }
    } finally {
      lock.current = false
      if (alive.current) setBusy(false)
    }
  }, [accept, pendingEvent, refresh])

  const sendMessage = useCallback(async text => {
    const message = text.trim()
    if (!message || lock.current || pendingEvent || !executionRef.current) return
    lock.current = true
    setBusy(true)
    setError('')
    setInput('')
    setMessages(previous => [...previous, { role: 'user', content: message }])
    const controller = new AbortController()
    agentFlight.current = controller
    const timeout = setTimeout(() => controller.abort(), 70000)
    try {
      const response = await executionAPI.agent(executionRef.current.id, message, messages.slice(-12), controller.signal)
      if (!alive.current) return
      accept(response.execution)
      setMessages(previous => [...previous, { role: 'assistant', content: response.reply }])
    } catch (failure) {
      if (alive.current) {
        setError(failure.name === 'AbortError' ? '请求已中断，请检查最新进度和已有草案。' : failure.message)
        await refresh().catch(() => {})
      }
    } finally {
      clearTimeout(timeout)
      agentFlight.current = null
      lock.current = false
      if (alive.current) setBusy(false)
    }
  }, [accept, messages, pendingEvent, refresh])

  const currentStep = execution?.steps.find(step => step.id === selectedId)
  const onCommand = command => {
    if (command === 'repeat' && currentStep) {
      agent.speak(`${currentStep.title}。${currentStep.description}`)
    } else if (command === 'pause') {
      agent.stopSpeaking()
      mutate('pause')
    } else if (command === 'resume') {
      mutate('resume')
    } else if (command === 'next') {
      setError('请确认当前步骤的实际状态，再点击“确认完成”。')
    } else if (command === 'skip') {
      setError('请在步骤列表中确认跳过；依赖此步骤的任务不会自动放行。')
    } else if (command === 'prev' && execution) {
      const index = execution.steps.findIndex(step => step.id === selectedId)
      setSelectedId(execution.steps[Math.max(0, index - 1)].id)
    }
  }
  const agent = useVoiceAgent({
    voiceSettings, speechKeywords, onCommand,
    onQuestion: sendMessage,
    onEmergency: info => {
      setEmergency(info)
      agentFlight.current?.abort()
      if (executionRef.current?.status === 'active' && !lock.current) mutate('pause')
    },
  })
  const { stopListening, stopSpeaking } = agent
  useEffect(() => {
    if (execution?.status === 'finished') {
      stopListening()
      stopSpeaking()
    }
  }, [execution?.status, stopListening, stopSpeaking])

  const blocked = busy || !!pendingEvent || execution?.status === 'finished'
  const proposals = execution?.proposals.filter(proposal => proposal.status === 'pending') || []
  const canListen = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Header />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-teal-700">厨房执行助手</p>
            <h1 className="text-xl font-semibold break-words">{execution?.title || '执行流程'}</h1>
            {execution && <p className="text-sm text-gray-600 mt-1">版本 {execution.revision} · {execution.status === 'paused' ? '已暂停' : execution.status === 'finished' ? '已结束' : '执行中'} · 已完成 {execution.steps.filter(step => step.status === 'completed').length}/{execution.steps.length}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" title="同步进度" aria-label="同步进度" disabled={busy || !execution} onClick={() => refresh().catch(failure => setError(failure.message))}><RefreshCw size={18} /></Button>
            <Button variant="secondary" disabled={blocked || !execution} onClick={() => mutate(execution.status === 'paused' ? 'resume' : 'pause')}>
              {execution?.status === 'paused' ? <Play size={16} className="mr-2" /> : <Pause size={16} className="mr-2" />}{execution?.status === 'paused' ? '恢复' : '暂停'}
            </Button>
            <Button variant="secondary" disabled={blocked || !execution} onClick={() => setConfirmFinish(true)}><Square size={16} className="mr-2" />结束</Button>
          </div>
        </div>
        {error && <div role="alert" className="border-l-4 border-red-600 bg-red-50 p-3 text-red-800 break-words">
          {error}
          {pendingEvent && <Button variant="secondary" disabled={busy} onClick={() => mutate(null, {}, pendingEvent)}>重试同步</Button>}
          {!execution && !loading && <Button variant="secondary" onClick={() => window.location.reload()}>重新加载</Button>}
        </div>}
        {loading && <p role="status">正在恢复执行进度…</p>}
        {execution && <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,1fr)] gap-6">
          <section aria-label="执行步骤" className="min-w-0 space-y-3">
            <h2 className="font-semibold">执行步骤</h2>
            {execution.steps.map(step => {
              const ready = step.dependencies.every(id => execution.steps.find(item => item.id === id)?.status === 'completed')
              const timer = execution.timers.find(item => item.stepId === step.id && item.status === 'active')
              const remaining = timer ? Math.ceil((timer.deadline - now) / 1000) : 0
              return <article key={step.id} className={`border rounded-lg bg-white p-4 space-y-3 ${step.id === selectedId ? 'border-teal-600' : 'border-gray-200'}`}>
                <div className="flex items-start gap-3">
                  <button className="text-left flex-1 min-w-0" onClick={() => setSelectedId(step.id)} aria-pressed={step.id === selectedId}>
                    <h3 className="text-base font-semibold break-words">{step.id}. {step.title}</h3>
                    <p className={`text-sm mt-1 ${statusStyles[step.status]}`}>{labels[step.status]} · 预计 {step.duration} 分钟</p>
                  </button>
                  <button className="p-2 shrink-0" title="播报步骤" aria-label={`播报 ${step.title}`} onClick={() => { setSelectedId(step.id); agent.speak(`${step.title}。${step.description}`) }}><Volume2 size={18} /></button>
                </div>
                <p className="text-sm leading-relaxed break-words">{step.description}</p>
                {!!step.dependencies.length && <p className="text-xs text-gray-600">前置步骤：{step.dependencies.join('、')}{!ready && step.status === 'pending' ? '（尚未完成）' : ''}</p>}
                {step.startedAt && <p className="text-xs text-gray-600">开始于 {new Date(step.startedAt).toLocaleTimeString('zh-CN')}</p>}
                {timer && <div className={`flex flex-wrap items-center gap-2 text-sm ${remaining <= 0 ? 'text-red-700' : 'text-teal-800'}`}>
                  <Timer size={16} /><span className="tabular-nums">{remaining <= 0 ? '已到时，超时 ' : '剩余 '}{clock(remaining)}</span>
                  <button disabled={blocked} onClick={() => mutate('cancel_timer', { timerId: timer.id })} title="取消计时" aria-label={`取消步骤 ${step.id} 计时`} className="p-2"><X size={16} /></button>
                </div>}
                <div className="flex flex-wrap gap-2">
                  {step.status === 'pending' && <>
                    <Button size="sm" disabled={blocked || execution.status !== 'active' || !ready} onClick={() => { setSelectedId(step.id); mutate('start_step', { stepId: step.id }) }}><Play size={14} className="mr-1" />开始</Button>
                    <Button size="sm" variant="secondary" disabled={blocked || execution.status !== 'active'} onClick={() => mutate('skip_step', { stepId: step.id })}><SkipForward size={14} className="mr-1" />跳过</Button>
                  </>}
                  {step.status === 'running' && <>
                    <Button size="sm" disabled={blocked || execution.status !== 'active'} onClick={() => mutate('complete_step', { stepId: step.id })}><Check size={14} className="mr-1" />确认完成</Button>
                    {!timer && <div className="flex items-center gap-1">
                      <input aria-label={`步骤 ${step.id} 计时分钟`} className="w-16 border border-gray-300 rounded px-2 py-1 text-base" type="number" min="1" max="1440" value={timerMinutes} onChange={event => setTimerMinutes(event.target.value)} />
                      <span className="text-sm">分钟</span>
                      <Button size="sm" variant="secondary" disabled={blocked || execution.status !== 'active' || !Number.isInteger(Number(timerMinutes)) || Number(timerMinutes) < 1 || Number(timerMinutes) > 1440} onClick={() => mutate('create_timer', { stepId: step.id, seconds: Number(timerMinutes) * 60 })}><Timer size={14} className="mr-1" />计时</Button>
                    </div>}
                  </>}
                </div>
              </article>
            })}
          </section>
          <section aria-label="执行助手" className="min-w-0 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">执行助手</h2>
              <Button variant="secondary" title={agent.isListening ? '关闭麦克风' : '开启麦克风'} aria-label={agent.isListening ? '关闭麦克风' : '开启麦克风'} disabled={!canListen || execution.status === 'finished'} onClick={() => agent.isListening ? agent.stopListening() : agent.startListening()}>
                {agent.isListening ? <Mic size={18} /> : <MicOff size={18} />}
              </Button>
            </div>
            {agent.liveTranscript && <p className="text-sm text-gray-600 break-words">{agent.liveTranscript}</p>}
            {proposals.map(proposal => <PlanChangePreview key={proposal.id} proposal={proposal} revision={execution.revision} disabled={blocked}
              onApprove={() => mutate('approve_proposal', { proposalId: proposal.id })}
              onReject={() => mutate('reject_proposal', { proposalId: proposal.id })} />)}
            <div aria-live="polite" className="space-y-3">
              {!messages.length && <p className="text-sm text-gray-600">食材或时间有变化吗？</p>}
              {messages.map((message, index) => <div key={index} className={`border-l-2 pl-3 ${message.role === 'user' ? 'border-gray-300' : 'border-teal-600'}`}>
                <p className="text-xs text-gray-600 mb-1">{message.role === 'user' ? '你' : 'LifeFlow'}</p>
                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
              </div>)}
            </div>
            <form onSubmit={event => { event.preventDefault(); sendMessage(input) }} className="flex items-start gap-2">
              <textarea aria-label="给执行助手的消息" rows={3} maxLength={2000} value={input} onChange={event => setInput(event.target.value)} placeholder="例如：鸡肉没解冻，但有豆腐，只剩25分钟" disabled={execution.status === 'finished'} className="min-w-0 flex-1 border border-gray-300 rounded-lg p-3 text-base bg-white" />
              <Button type="submit" disabled={blocked || !input.trim()} aria-label="发送消息" title="发送消息"><Send size={18} /></Button>
            </form>
            {busy && <p role="status" className="text-sm text-teal-800">正在处理…</p>}
            {execution.status === 'finished' && <Button onClick={() => navigate('/sops')}>返回流程列表</Button>}
          </section>
        </div>}
      </main>
      {confirmFinish && <div role="dialog" aria-modal="true" aria-labelledby="finish-title" className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-6 max-w-sm w-full space-y-4">
          <h2 id="finish-title" className="font-semibold text-lg">结束本次执行？</h2>
          <p className="text-sm">未完成步骤不会被标记为完成，所有计时器将停止。</p>
          <div className="flex gap-2">
            <Button disabled={busy} onClick={async () => { const result = await mutate('finish'); if (result) setConfirmFinish(false) }}>确认结束</Button>
            <Button variant="secondary" onClick={() => setConfirmFinish(false)}>取消</Button>
          </div>
        </div>
      </div>}
      <EmergencyOverlay emergency={emergency} onClose={() => { setEmergency(null); agent.clearEmergency() }} />
    </div>
  )
}
