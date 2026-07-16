import { 
  generateId, 
  parseBody, 
  createResponse, 
  createError,
  extractUser,
  calculateTokens
} from './utils'

const mockSOP = {
  title: '家庭晚餐：四菜一汤',
  steps: [
    { id: 1, title: '准备工作', duration: 5, description: '洗手、系围裙、准备好所有厨具', status: 'pending', dependencies: [] },
    { id: 2, title: '处理玉米排骨汤', duration: 45, description: '排骨焯水后放入电饭煲，加入玉米、姜片，加水炖煮', status: 'pending', dependencies: [] },
    { id: 3, title: '处理清蒸鲈鱼', duration: 10, description: '鲈鱼洗净，用料酒和姜片腌制 10 分钟', status: 'pending', dependencies: [2] },
    { id: 4, title: '切配食材', duration: 15, description: '番茄切块、青椒切丝、青菜洗净、肉丝备好', status: 'pending', dependencies: [2] },
    { id: 5, title: '蒸鲈鱼', duration: 8, description: '蒸锅水开后放入鲈鱼，蒸 8 分钟', status: 'pending', dependencies: [3] },
    { id: 6, title: '炒番茄炒蛋', duration: 6, description: '先炒蛋盛出，再炒番茄，最后混合', status: 'pending', dependencies: [4] },
    { id: 7, title: '炒青椒肉丝', duration: 8, description: '先炒肉丝盛出，再炒青椒，最后混合', status: 'pending', dependencies: [4] },
    { id: 8, title: '炒青菜', duration: 3, description: '快速翻炒青菜，加少许盐调味', status: 'pending', dependencies: [6, 7] },
    { id: 9, title: '出锅摆盘', duration: 5, description: '鲈鱼出锅淋上蒸鱼豉油，所有菜装盘', status: 'pending', dependencies: [5, 6, 7, 8] },
  ],
  estimatedTotalTime: 60,
}

export class SOPHandler {
  constructor(request, env) {
    this.request = request
    this.env = env
    this.url = new URL(request.url)
    this.path = this.url.pathname
    this.method = request.method
  }

  async handle() {
    if (this.path === '/api/sop/generate' && this.method === 'POST') {
      return this.generate()
    }
    if (this.path === '/api/sop/ask' && this.method === 'POST') {
      return this.ask()
    }
    if (this.path === '/api/sop/list' && this.method === 'GET') {
      return this.list()
    }
    if (this.path.match(/\/api\/sop\/[^/]+/) && this.method === 'GET') {
      return this.getById()
    }
    if (this.path === '/api/sop/save' && this.method === 'POST') {
      return this.save()
    }
    if (this.path.match(/\/api\/sop\/[^/]+/) && this.method === 'DELETE') {
      return this.delete()
    }
    return createError('Not found', 404)
  }

  async generate() {
    const user = await extractUser(this.request, this.env)
    if (!user) {
      return createError('未授权', 401)
    }

    if (user.quota_used >= user.quota_total) {
      return createError('Token 配额已用完', 403)
    }

    const body = await parseBody(this.request)
    const { goal, constraints } = body

    if (!goal) {
      return createError('缺少目标参数', 400)
    }

    let sopData
    
    try {
      sopData = await this.callAIAPI(goal, constraints)
    } catch (error) {
      console.error('AI API call failed:', error)
      sopData = { ...mockSOP, title: goal }
    }

    const sopId = generateId()
    
    const sop = {
      ...sopData,
      id: sopId,
      goal,
      constraints: constraints || {},
      createdAt: new Date().toISOString(),
    }

    await this.env.DB.prepare(
      'INSERT INTO sops (id, user_id, title, goal, constraints, steps, estimated_total_time) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      sopId,
      user.id,
      sop.title,
      goal,
      JSON.stringify(constraints || {}),
      JSON.stringify(sop.steps),
      sop.estimatedTotalTime
    ).run()

    const tokensUsed = calculateTokens(JSON.stringify(sop))
    await this.updateQuota(user.id, tokensUsed, 'generate')

    return createResponse({ sop })
  }

  async callAIAPI(goal, constraints) {
    const baseUrl = this.env.OPENAI_BASE_URL || 'https://api.openai.com'
    const apiKey = this.env.OPENAI_API_KEY
    
    if (!apiKey) {
      throw new Error('API key not configured')
    }

    const prompt = `
你是一个专业的生活任务规划师。请根据用户的目标生成一个详细的 SOP（标准操作程序）。

用户目标：${goal}
约束条件：${JSON.stringify(constraints || {})}

请输出一个 JSON 格式的 SOP，包含以下字段：
- title: SOP 的标题
- steps: 步骤数组，每个步骤包含：
  - id: 步骤序号（数字）
  - title: 步骤标题
  - duration: 预计耗时（分钟）
  - description: 详细描述
  - status: 默认 "pending"
  - dependencies: 依赖的步骤 ID 数组（可选）
- estimatedTotalTime: 总预计耗时（分钟）

请确保步骤之间有合理的依赖关系，时间估算合理。只输出 JSON，不要包含其他文本。
    `.trim()

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.env.MODEL_NAME || 'gpt-5.5',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的生活任务规划师，擅长将复杂任务分解为清晰的步骤流程。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('No response from AI')
    }

    let sop
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        sop = JSON.parse(jsonMatch[0])
      } else {
        sop = JSON.parse(content)
      }
    } catch {
      throw new Error('Failed to parse AI response')
    }

    if (!sop.steps) {
      sop.steps = mockSOP.steps
    }
    if (!sop.estimatedTotalTime) {
      sop.estimatedTotalTime = sop.steps.reduce((sum, step) => sum + (step.duration || 0), 0)
    }

    return sop
  }

  async ask() {
    const user = await extractUser(this.request, this.env)
    if (!user) {
      return createError('未授权', 401)
    }

    if (user.quota_used >= user.quota_total) {
      return createError('Token 配额已用完', 403)
    }

    const body = await parseBody(this.request)
    const { goal, questions, answers, conversationHistory } = body

    if (!goal) {
      return createError('缺少目标参数', 400)
    }

    const baseUrl = this.env.OPENAI_BASE_URL || 'https://api.openai.com'
    const apiKey = this.env.OPENAI_API_KEY

    if (!apiKey) {
      return createResponse({
        questions: [],
        message: '信息已足够，可以生成 SOP',
      })
    }

    let followUpQuestions = []

    try {
      const historyText = conversationHistory && conversationHistory.length > 0
        ? conversationHistory.map((item, index) => `Q${index + 1}: ${item.question}\nA${index + 1}: ${item.answer}`).join('\n\n')
        : ''

      const prompt = `
你是一个专业的生活任务规划师，正在帮助用户创建一个详细的 SOP。

用户目标：${goal}

【已有信息】
${JSON.stringify(answers || {})}

【历史对话】
${historyText || '暂无'}

【任务要求】
1. 首先仔细分析已有信息和历史对话，列出所有已经确认的信息点
2. 对比用户目标，找出真正缺失的关键信息
3. 如果已有信息足够详细可以生成完整SOP，返回空数组
4. 如果需要追问，每轮只问1个问题，优先使用是否题
5. 绝对禁止重复提问！即使问题表述略有不同但核心内容相同也不行

【重复提问判断标准】
- 相同主题的问题只问一次（例如：问过"户型"就不能再问"面积"）
- 已经得到明确答案的问题不能再问
- 用户回答中已经包含的信息不需要再确认

【已确认信息分析】
请在思考过程中确认以下信息是否已经明确：
${answers && Object.keys(answers).length > 0 
  ? Object.values(answers).map((v, i) => `${i + 1}. ${v}`).join('\n') 
  : '暂无'}

【提问策略】
- 是否题格式："xxx吗？"，options: ["是", "否"]
- 选择题格式："xxx？"，options: ["选项1", "选项2", "选项3", "选项4"]（不超过4个）
- 必须提问时才使用input类型

【输出格式】
请只输出 JSON 格式：
{
  "questions": [
    {
      "text": "问题文本",
      "type": "choice" | "input",
      "options": ["是", "否"]
    }
  ]
}
注意：questions数组最多包含1个问题，不需要追问时返回空数组
      `.trim()

      const openaiResponse = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.env.MODEL_NAME || 'gpt-5.5',
          messages: [
            {
              role: 'system',
              content: '你是一个专业的生活任务规划师，擅长通过简短的问题收集信息来完善任务规划。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.5,
          stream: true,
        }),
      })

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text().catch(() => 'AI request failed')
        console.error('AI ask failed:', openaiResponse.status, errorText)
        return createError('AI 请求失败', openaiResponse.status)
      }

      const tokensUsed = calculateTokens(goal + JSON.stringify(answers || {}))
      await this.updateQuota(user.id, tokensUsed, 'ask')

      return new Response(openaiResponse.body, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    } catch (error) {
      console.error('AI ask failed:', error)
    }

    return createResponse({
      questions: followUpQuestions.slice(0, 1),
      message: followUpQuestions.length > 0 ? '需要更多信息' : '信息已足够，可以生成 SOP',
    })
  }

  async list() {
    const user = await extractUser(this.request, this.env)
    if (!user) {
      return createError('未授权', 401)
    }

    const result = await this.env.DB.prepare(
      'SELECT id, title, goal, constraints, steps, estimated_total_time, status, created_at FROM sops WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(user.id).run()

    const sops = result.results?.map(row => ({
      ...row,
      constraints: row.constraints ? JSON.parse(row.constraints) : {},
      steps: row.steps ? JSON.parse(row.steps) : [],
      createdAt: new Date(row.created_at * 1000).toISOString(),
    })) || []

    return createResponse({ sops })
  }

  async getById() {
    const user = await extractUser(this.request, this.env)
    if (!user) {
      return createError('未授权', 401)
    }

    const sopId = this.path.split('/').pop()

    const result = await this.env.DB.prepare(
      'SELECT id, title, goal, constraints, steps, estimated_total_time, status, created_at FROM sops WHERE id = ? AND user_id = ?'
    ).bind(sopId, user.id).run()

    if (!result.results?.[0]) {
      return createError('SOP 不存在', 404)
    }

    const sop = result.results[0]
    return createResponse({
      sop: {
        ...sop,
        constraints: sop.constraints ? JSON.parse(sop.constraints) : {},
        steps: sop.steps ? JSON.parse(sop.steps) : [],
        createdAt: new Date(sop.created_at * 1000).toISOString(),
      },
    })
  }

  async save() {
    const user = await extractUser(this.request, this.env)
    if (!user) {
      return createError('未授权', 401)
    }

    const body = await parseBody(this.request)
    const { id, title, goal, constraints, steps, estimatedTotalTime } = body

    if (!id) {
      return createError('缺少 ID 参数', 400)
    }

    const existing = await this.env.DB.prepare(
      'SELECT id FROM sops WHERE id = ? AND user_id = ?'
    ).bind(id, user.id).run()

    if (!existing.results?.[0]) {
      return createError('SOP 不存在', 404)
    }

    await this.env.DB.prepare(
      'UPDATE sops SET title = ?, goal = ?, constraints = ?, steps = ?, estimated_total_time = ?, updated_at = ? WHERE id = ?'
    ).bind(
      title,
      goal,
      JSON.stringify(constraints || {}),
      JSON.stringify(steps || []),
      estimatedTotalTime || 60,
      Date.now(),
      id
    ).run()

    return createResponse({ message: '保存成功' })
  }

  async delete() {
    const user = await extractUser(this.request, this.env)
    if (!user) {
      return createError('未授权', 401)
    }

    const sopId = this.path.split('/').pop()

    const existing = await this.env.DB.prepare(
      'SELECT id FROM sops WHERE id = ? AND user_id = ?'
    ).bind(sopId, user.id).run()

    if (!existing.results?.[0]) {
      return createError('SOP 不存在', 404)
    }

    await this.env.DB.prepare(
      'DELETE FROM sops WHERE id = ?'
    ).bind(sopId).run()

    return createResponse({ message: '删除成功' })
  }

  async updateQuota(userId, tokensUsed, operation) {
    await this.env.DB.prepare(
      'UPDATE users SET quota_used = quota_used + ? WHERE id = ?'
    ).bind(tokensUsed, userId).run()

    await this.env.DB.prepare(
      'INSERT INTO quota_usage (id, user_id, tokens_used, operation) VALUES (?, ?, ?, ?)'
    ).bind(generateId(), userId, tokensUsed, operation).run()
  }
}
