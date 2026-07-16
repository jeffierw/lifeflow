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

    const { conversationHistory, answers } = constraints || {}

    const historyText = conversationHistory && conversationHistory.length > 0
      ? conversationHistory.map((item, index) => `Q${index + 1}: ${item.question}\nA${index + 1}: ${item.answer}`).join('\n')
      : ''

    const answersText = answers && Object.keys(answers).length > 0
      ? Object.values(answers).map((v, i) => `${i + 1}. ${v}`).join('\n')
      : ''

    const prompt = `
你是一个专业的生活任务规划师。请根据用户的目标和已有对话信息生成一个详细的 SOP（标准操作程序）。

用户目标：${goal}

【用户已确认的信息】
${answersText || '暂无'}

【对话记录】
${historyText || '暂无'}

【重要要求】
1. 必须严格使用用户在对话中确认的信息（如菜单、食材、时间等），绝对不能自行编造或替换
2. 如果用户提到了具体菜品/食材/方案，SOP 中必须使用这些内容
3. 只输出 JSON，不要包含其他文本

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

请确保步骤之间有合理的依赖关系，时间估算合理。
    `.trim()

    const messages = [
      {
        role: 'system',
        content: '你是一个专业的生活任务规划师，擅长将复杂任务分解为清晰的步骤流程。你必须严格遵循用户提供的信息，不得编造。'
      }
    ]

    if (conversationHistory && conversationHistory.length > 0) {
      for (const item of conversationHistory) {
        messages.push({ role: 'assistant', content: item.question })
        messages.push({ role: 'user', content: item.answer })
      }
    }

    messages.push({ role: 'user', content: prompt })

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.env.MODEL_NAME || 'gpt-5.5',
        messages,
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
      return this.streamAskResponse({ questions: [], message: '信息已足够，可以生成 SOP' })
    }

    let followUpQuestions = []

    try {
      const historyText = conversationHistory && conversationHistory.length > 0
        ? conversationHistory.map((item, index) => `${index + 1}. 问：${item.question}\n   答：${item.answer}`).join('\n')
        : ''

      const prompt = `
用户目标：${goal}

【已经问过的问题和用户回答（绝对不能重复这些问题）】
${historyText || '暂无'}

请仔细阅读以上对话记录。你已经问过的任何问题绝对不能再次提问，即使用不同的表述方式也不行。

【任务】
1. 分析已有信息，判断是否已足够生成 SOP
2. 如果信息足够，返回：{"questions": [], "message": "信息已足够，可以生成 SOP"}
3. 如果还需要信息，只问1个新的问题（不能与上面任何问题重复或相似）

【提问格式】
- 是否题：type="choice", options=["是", "否"]
- 选择题：type="choice", options不超过4个
- 填空题：type="input", options=[]

只输出 JSON：
{"questions": [{"text": "问题文本", "type": "choice", "options": ["是", "否"]}]}
      `.trim()

      const messages = [
        {
          role: 'system',
          content: '你是一个专业的生活任务规划师，通过提问收集信息来创建SOP。你绝不重复已问过的问题。如果用户已经回答了某个问题，你不能再以任何形式再次提问相同或相似的内容。'
        }
      ]

      if (conversationHistory && conversationHistory.length > 0) {
        for (const item of conversationHistory) {
          messages.push({ role: 'assistant', content: item.question })
          messages.push({ role: 'user', content: item.answer })
        }
      }

      messages.push({ role: 'user', content: prompt })

      const openaiResponse = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.env.MODEL_NAME || 'gpt-5.5',
          messages,
          temperature: 0.3,
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

    return this.streamAskResponse({
      questions: followUpQuestions.slice(0, 1),
      message: followUpQuestions.length > 0 ? '需要更多信息' : '信息已足够，可以生成 SOP',
    })
  }

  streamAskResponse(result) {
    const encoder = new TextEncoder()
    const content = JSON.stringify(result)
    const stream = new ReadableStream({
      async start(controller) {
        // 分块发送，模拟流式输出
        const chunkSize = 5
        for (let i = 0; i < content.length; i += chunkSize) {
          const piece = content.slice(i, i + chunkSize)
          const chunk = JSON.stringify({ choices: [{ delta: { content: piece } }] })
          controller.enqueue(encoder.encode(`data: ${chunk}\n\n`))
          await new Promise(resolve => setTimeout(resolve, 30))
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    })

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
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
