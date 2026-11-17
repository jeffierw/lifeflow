export function validatePlan(plan) {
  if (!plan || typeof plan.title !== 'string' || !plan.title.trim() || plan.title.length > 200 ||
      !Array.isArray(plan.steps) || plan.steps.length < 1 || plan.steps.length > 40) {
    throw new Error('流程必须包含标题和 1–40 个步骤')
  }
  const steps = plan.steps.map(step => {
    if (!step || !Number.isSafeInteger(step.id) || step.id < 1 ||
        typeof step.title !== 'string' || !step.title.trim() || step.title.length > 200 ||
        typeof step.description !== 'string' || step.description.length > 2000 ||
        !Number.isInteger(step.duration) || step.duration < 1 || step.duration > 1440 ||
        !Array.isArray(step.dependencies) ||
        !step.dependencies.every(Number.isSafeInteger) ||
        new Set(step.dependencies).size !== step.dependencies.length ||
        !['pending', 'running', 'completed', 'skipped'].includes(step.status || 'pending')) {
      throw new Error('步骤字段、时长或状态无效')
    }
    return {
      id: step.id, title: step.title.trim(), description: step.description,
      duration: step.duration, dependencies: [...step.dependencies],
      status: step.status || 'pending',
    }
  })
  const byId = new Map(steps.map(step => [step.id, step]))
  if (byId.size !== steps.length) throw new Error('步骤 ID 不能重复')
  const visiting = new Set()
  const ends = new Map()
  const visit = id => {
    if (!byId.has(id)) throw new Error('前置步骤不存在')
    if (visiting.has(id)) throw new Error('步骤依赖不能成环')
    if (ends.has(id)) return ends.get(id)
    visiting.add(id)
    const step = byId.get(id)
    const end = Math.max(0, ...step.dependencies.map(visit)) + step.duration
    visiting.delete(id)
    ends.set(id, end)
    return end
  }
  return { title: plan.title.trim(), steps, estimatedTotalTime: Math.max(...steps.map(step => visit(step.id))) }
}
