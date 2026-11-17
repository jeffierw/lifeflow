import { Check, X, Plus, Minus, ArrowRight } from 'lucide-react'
import { Button } from './ui/Button'

export default function PlanChangePreview({ proposal, revision, disabled, onApprove, onReject }) {
  const stale = proposal.baseRevision !== revision
  const { added, removed, changed, beforeMinutes, afterMinutes } = proposal.summary
  return (
    <section aria-label="计划变更预览" className="border border-teal-300 rounded-lg p-4 bg-white space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-base">待确认调整</h3>
        <span className="text-xs text-gray-600">版本 {proposal.baseRevision}</span>
      </div>
      <p className="text-sm break-words">{proposal.rationale}</p>
      {added.map(step => <div key={`add-${step.id}`} className="text-sm flex items-start gap-2">
        <Plus size={16} className="text-teal-700 shrink-0 mt-1" /><div className="min-w-0 break-words"><strong>新增：{step.title}</strong><p>{step.description}</p><span>{step.duration} 分钟 · 前置：{step.dependencies.join('、') || '无'}</span></div>
      </div>)}
      {removed.map(step => <div key={`remove-${step.id}`} className="text-sm flex gap-2">
        <Minus size={16} className="text-red-700 shrink-0 mt-1" /><span className="break-words">移除：{step.title}</span>
      </div>)}
      {changed.map(({ before, after }) => <div key={`change-${after.id}`} className="text-sm border-l-2 border-teal-500 pl-3 space-y-1 break-words">
        <p className="text-gray-600">原：{before.title} · {before.duration} 分钟</p>
        <p className="text-gray-600">{before.description}</p>
        <p className="text-gray-600">前置：{before.dependencies.join('、') || '无'}</p>
        <p className="font-semibold">改为：{after.title} · {after.duration} 分钟</p>
        <p>{after.description}</p>
        <p>前置：{after.dependencies.join('、') || '无'}</p>
      </div>)}
      <p className="text-sm text-gray-600 flex flex-wrap items-center gap-2">原计划关键路径估时 {beforeMinutes}<ArrowRight size={14} />{afterMinutes} 分钟</p>
      {stale && <p role="status" className="text-sm text-amber-800">执行进度已变化，此草案已过期。请重新提出调整。</p>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={onApprove} disabled={disabled || stale}><Check size={16} className="mr-2" />确认调整</Button>
        <Button variant="secondary" onClick={onReject} disabled={disabled}><X size={16} className="mr-2" />拒绝</Button>
      </div>
    </section>
  )
}
