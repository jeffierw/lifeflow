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

// ===== 性能埋点工具 =====
function createTimer(label) {
  const start = Date.now()
  const marks = {}
  return {
    mark(name) { marks[name] = Date.now() - start },
    done() {
      const total = Date.now() - start
      const parts = Object.entries(marks).map(([k, v]) => `${k}=${v}ms`).join(' ')
      console.log(`[PERF][${label}] total=${total}ms ${parts}`)
      return total
    }
  }
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
    if (this.path === '/api/sop/chat' && this.method === 'POST') {
      return this.chat()
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

  // ===================== 统一 AI 请求封装 =====================
  /**
   * 带超时、遥测和 AbortController 的 OpenAI 请求封装
   * 统一用于 ask / generate / chat
   * @returns {Promise<{response: Response, elapsed: number}>}
   */
  async callChatCompletion(messages, options = {}) {
    const tStart = Date.now()
    const baseUrl = this.env.OPENAI_BASE_URL || 'https://api.openai.com'
    const apiKey = this.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('API key not configured')

    const {
      temperature = 0.5,
      maxTokens = 800,
      stream = false,
      label = 'chat',
      timeoutMs = 30000,
      model = null,
    } = options

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null

    try {
      const modelName = model || this.env.MODEL_NAME || 'gpt-4o-mini'
      const approxInputTokens = messages.reduce((s, m) => s + Math.ceil((m.content || '').length / 4), 0)
      console.log(`[AI][${label}] → start model=${modelName} msgs=${messages.length} inTokens≈${approxInputTokens} maxTokens=${maxTokens} stream=${stream}`)

      const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream,
        }),
        signal: controller ? controller.signal : undefined,
      })

      if (!resp.ok) {
        const errText = await resp.text().catch(() => 'n/a')
        console.error(`[AI][${label}] ✗ HTTP ${resp.status}: ${errText.slice(0, 300)}`)
        throw new Error(`AI API HTTP ${resp.status}`)
      }

      const elapsed = Date.now() - tStart
      if (stream) {
        console.log(`[AI][${label}] ✓ stream established in ${elapsed}ms`)
      } else {
        console.log(`[AI][${label}] ✓ completed in ${elapsed}ms`)
      }
      return { response: resp, elapsed }
    } catch (err) {
      const elapsed = Date.now() - tStart
      const reason = (err && err.name === 'AbortError')
        ? `timeout after ${timeoutMs}ms`
        : (err?.message || String(err))
      console.error(`[AI][${label}] ✗ failed in ${elapsed}ms: ${reason}`)
      throw new Error(`AI call failed: ${reason}`)
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }

  /**
   * 从非流式响应中安全提取 JSON 内容
   */
  async extractJsonFromResponse(response, label = 'extract') {
    const t = Date.now()
    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('No response from AI')

    // 优先提取被 ```json 包裹的块
    let jsonStr = content
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenced) jsonStr = fenced[1]
    const bracketMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (bracketMatch) jsonStr = bracketMatch[0]

    try {
      const result = JSON.parse(jsonStr)
      console.log(`[AI][${label}] parse ok in ${Date.now() - t}ms`)
      return result
    } catch (e) {
      console.error(`[AI][${label}] parse failed, raw=${JSON.stringify(content).slice(0, 200)}`)
      throw new Error('Failed to parse AI response JSON')
    }
  }

  // ===================== SOP 质量把关 Gatekeeper（7 维度） =====================
  /**
   * 按 Skill 定义的 7 维度做强制评审。
   * 若 readyForSOP=false，则 generate 必须被拦截，改走 ask 追问。
   */
  async runQualityGatekeeper(goal, constraints, opts = {}) {
    const history = constraints?.conversationHistory || []
    const answers = constraints?.answers || {}
    const historyText = history.map((item, i) =>
      `${i + 1}. Q: ${item.question}\n   A: ${item.answer}`
    ).join('\n')
    const answersText = Object.entries(answers).map(([, v]) => `- ${v}`).join('\n')
    const dateHdr = this.request.headers?.get('date') || new Date().toUTCString()

    const systemPrompt = `你是 SOP 信息收集 Agent。任务：一次性列出当前还缺失的所有关键信息（不要分轮），以自然的问题形式返回。目标是在信息完整之前绝不放行生成 SOP。

【关键维度】
1. 在哪执行：场景（家庭厨房/宿舍/户外/办公室）+ 基础设施（燃气灶/电磁炉/蒸锅/烤箱/电饭煲/微波炉/冰箱/水槽）
2. 执行条件：人数、时间硬约束（最早开始+Deadline）、预算、食材/工具现状、忌口/口味偏好
3. 做什么：具体产出物清单（如四菜一汤必须列出具体菜名+分量）
4. 怎么做：核心烹饪方法，是否与设备匹配
5. 多久做完：每步时长与关键路径总时长；总时长是否超过可用时间

【规则】
- 只返回还缺失或未明确的维度问题；已明确的维度不要问。
- 如果缺失项很多，合并为 1-3 个自然问题一起问出，不要一次只问一个。
- 所有问题的 type 统一为 "input"，options 为空数组（前端始终允许自定义输入）。
- 不要给出 7 维度报告、评分、修改建议、可行性分析等额外信息。
- 菜单未确定时，可以顺带推荐 3 套方案让用户选择或修改，但仍然以 input 问题形式呈现。
- 信息足够时返回空 questions 数组。` 

    const userPrompt = `【目标】${goal}
【服务器当前时间参考】${dateHdr}
【用户已确认的问答对】
${historyText || '暂无'}
【用户的答案清单】
${answersText || '暂无'}

请判断还有哪些关键信息缺失。若缺失，只输出自然的问题；若已足够，输出空 questions。输出格式（严格纯 JSON）：
{"questions":[{"id":"string","text":"问题内容","type":"input","options":[]}],"message":""}`

    const messages = [{ role: 'system', content: systemPrompt }]
    for (const item of history) {
      messages.push({ role: 'assistant', content: item.question })
      messages.push({ role: 'user', content: item.answer })
    }
    messages.push({ role: 'user', content: userPrompt })

    try {
      const { response } = await this.callChatCompletion(messages, {
        label: 'gatekeeper',
        temperature: 0.2,
        maxTokens: 700,
        timeoutMs: 30000,
        ...opts,
      })
      const result = await this.extractJsonFromResponse(response, 'gatekeeper-parse')
      if (!Array.isArray(result.questions)) result.questions = []
      // 强制所有问题允许自定义输入：type=input，options 清空
      result.questions = result.questions.map((q) => ({
        id: q.id || generateId(),
        text: q.text,
        type: 'input',
        options: [],
      }))
      return result
    } catch (err) {
      console.error('[Gatekeeper] AI call failed:', err.message)
      return {
        questions: [{
          id: generateId(),
          text: '请补充说明执行场景、用餐人数、时间约束、具体菜品或食材准备情况，方便我继续规划。',
          type: 'input',
          options: [],
        }],
        message: '',
        _error: err.message,
      }
    }
  }

  /**
   * 从 gatekeeper 结果抽取维度摘要，注入 generate prompt，避免 AI 生成泛化步骤。
   */
  static summarizeGatekeeper(gate) {
    if (!gate || Array.isArray(gate.questions)) {
      // 新版 gatekeeper 只返回 questions；把当前已经明确的问答摘要给 generate
      const constraints = gate?._sourceConstraints || {}
      const history = constraints?.conversationHistory || []
      if (!history.length) return ''
      return '【用户已确认信息】\n' + history.map((h, i) => `${i + 1}. ${h.question} → ${h.answer}`).join('\n')
    }
    if (!gate?.dimensions) return ''
    const d = gate.dimensions
    const lines = []
    lines.push(`【把关确认摘要】readyForSOP=${gate.readyForSOP}`)
    for (const [k, v] of Object.entries(d)) if (v?.ok && v?.detail) lines.push(`- ${k}: ${v.detail}`)
    if (gate.D6_feasibility) lines.push(`- 可行性评分: ${gate.D6_feasibility.score}/100，风险提示: ${gate.D6_feasibility.risk || '无'}`)
    return lines.join('\n')
  }

  // ===================== generate 接口 =====================
  async generate() {
    const timer = createTimer('sop.generate')
    const user = await extractUser(this.request, this.env)
    timer.mark('auth')
    if (!user) return createError('未授权', 401)
    if (user.quota_used >= user.quota_total) return createError('Token 配额已用完', 403)

    const body = await parseBody(this.request)
    timer.mark('parseBody')
    const { goal, constraints } = body
    if (!goal) return createError('缺少目标参数', 400)

    // ===== [STEP 1] 先走 Gatekeeper 质量把关 =====
    const gatekeeper = await this.runQualityGatekeeper(goal, constraints || {})
    timer.mark('gatekeeper')
    const hasQuestions = Array.isArray(gatekeeper.questions) && gatekeeper.questions.length > 0
    console.log(`[Gatekeeper] goal=${goal.slice(0, 30)}… questions=${gatekeeper.questions?.length || 0}`)

    // 信息不足 → 不生成 SOP，一次性把缺失的问题全部返回，继续收集
    if (hasQuestions) {
      const enrichedConstraints = { ...(constraints || {}), _gatekeeper: gatekeeper }
      const followupQuestions = gatekeeper.questions.map((q) => ({
        id: q.id || generateId(),
        text: q.text,
        type: 'input',
        options: [],
      }))
      timer.done()
      return createResponse({
        blocked: true,
        reason: '',
        followupQuestions,
        constraints: enrichedConstraints,
      }, 200)
    }

    // ===== [STEP 2] 通过 → 生成真正可落地的 SOP =====
    const gateSummary = SOPHandler.summarizeGatekeeper({ ...gatekeeper, _sourceConstraints: constraints })
    let sopData
    try {
      sopData = await this.callAIAPIGenerate(goal, constraints, gateSummary)
      timer.mark('aiCall')
    } catch (error) {
      console.error('AI API call failed, fallback to mock:', error.message)
      sopData = { ...mockSOP, title: goal }
    }

    // 二次校验：不允许"第1步叫 确定菜单"这种泛化步骤 — 把这些找出来并拦截
    const badTitles = ['确定', '核对', '核对现有', '选择', '计划', '安排']
    const hasBadFirstStep = sopData?.steps?.[0] &&
      badTitles.some(k => (sopData.steps[0].title || '').includes(k))
    if (hasBadFirstStep) {
      console.warn('[Gatekeeper] Post-generate check failed: steps are still generic. Blocking.', sopData.steps.map(s => s.title))
      timer.done()
      return createResponse({
        blocked: true,
        reason: '',
        followupQuestions: [{
          id: generateId(),
          text: '当前目标过于泛化，请把要做的事情具体化（例如"四菜一汤"请列出四菜一汤的具体菜名）。',
          type: 'input',
          options: [],
        }],
        constraints: { ...(constraints || {}), _gatekeeper: { questions: [] } },
      }, 200)
    }

    const sopId = generateId()
    const enrichedConstraints = { ...(constraints || {}), _gatekeeper: gatekeeper }
    const sop = {
      ...sopData,
      id: sopId,
      goal,
      constraints: enrichedConstraints,
      createdAt: new Date().toISOString(),
    }

    await this.env.DB.prepare(
      'INSERT INTO sops (id, user_id, title, goal, constraints, steps, estimated_total_time) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      sopId, user.id, sop.title, goal,
      JSON.stringify(enrichedConstraints),
      JSON.stringify(sop.steps),
      sop.estimatedTotalTime
    ).run()
    timer.mark('dbInsert')

    const tokensUsed = calculateTokens(JSON.stringify(sop))
    await this.updateQuota(user.id, tokensUsed, 'generate')
    timer.mark('quota')

    timer.done()
    return createResponse({ sop, gatekeeper })
  }

  /**
   * 生成 SOP 的 AI 调用 —— 注入 Gatekeeper 摘要，强制输出可落地步骤
   */
  async callAIAPIGenerate(goal, constraints, gateSummary = '') {
    const historyText = (constraints?.conversationHistory || []).map((item, i) =>
      `${i + 1}. 问：${item.question}\n   答：${item.answer}`
    ).join('\n')

    const answersText = Object.entries(constraints?.answers || {})
      .map(([, v]) => `- ${v}`).join('\n')

    const systemPrompt = `你是资深生活任务规划师。用户已通过质量把关，你必须根据把关摘要输出一份能立即执行、不含"规划/确认/核对/选择/安排"等元动作泛化步骤的 SOP。
【严格红线】
- 不得编造/替换用户已确认的菜品、食材、做法。
- 步骤 title 必须是具体动作（例"洗排骨并焯水"✅），不是"确定菜单/核对食材/安排顺序"❌。
- 每步 description 必须是具体操作指令，≤80字。
- dependencies 只填前置步骤 id（关键路径），总时长按关键路径求 max。`

    const userPrompt = `【目标】${goal}
${gateSummary ? gateSummary + '\n' : ''}
【用户已确认信息】
${answersText || '暂无'}

【对话记录】
${historyText || '暂无'}

【产出要求】
1. title：一句话具体的 SOP 标题（如"7点前完成：蒜蓉西兰花+香煎鸡胸+凉拌黄瓜+菌菇豆腐+番茄蛋汤 2人份"）
2. steps：5-12 步，每步 id 从 1 递增；title 是具体动作；description 是具体操作；duration 是整数分钟
3. estimatedTotalTime：关键路径总时长（不能是各步骤简单相加，并行步骤只取最长）
4. 只输出纯 JSON，不含其他文字、markdown或解释

【JSON格式】
{"title":"标题","steps":[{"id":1,"title":"","duration":5,"description":"","status":"pending","dependencies":[]}],"estimatedTotalTime":60}`.trim()

    const messages = [{ role: 'system', content: systemPrompt }]
    for (const item of constraints?.conversationHistory || []) {
      messages.push({ role: 'assistant', content: item.question })
      messages.push({ role: 'user', content: item.answer })
    }
    messages.push({ role: 'user', content: userPrompt })

    const { response } = await this.callChatCompletion(messages, {
      label: 'generate',
      temperature: 0.35,
      maxTokens: 900,
      timeoutMs: 45000,
    })

    const sop = await this.extractJsonFromResponse(response, 'generate-parse')
    if (!sop.steps || !Array.isArray(sop.steps)) sop.steps = mockSOP.steps
    // 统一字段名兼容（estimated_total_time / estimatedTotalTime）
    const et = sop.estimated_total_time || sop.estimatedTotalTime
    if (!et) {
      // 按关键路径求 max，而不是累加（并行步骤修正）
      const n = sop.steps.length
      const end = new Array(n + 1).fill(0)
      for (const step of sop.steps) {
        const id = step.id
        const deps = step.dependencies || []
        const base = deps.length ? Math.max(...deps.map(d => end[d] || 0)) : 0
        end[id] = base + (step.duration || 0)
      }
      sop.estimatedTotalTime = Math.max(...Object.values(end), 5)
    } else {
      sop.estimatedTotalTime = et
    }
    delete sop.estimated_total_time
    // status 归一
    sop.steps = sop.steps.map(s => ({ ...s, status: s.status || 'pending' }))
    return sop
  }

  // ===================== ask 接口（流式） =====================
  async ask() {
    const timer = createTimer('sop.ask')
    const user = await extractUser(this.request, this.env)
    timer.mark('auth')
    if (!user) return createError('未授权', 401)
    if (user.quota_used >= user.quota_total) return createError('Token 配额已用完', 403)

    const body = await parseBody(this.request)
    timer.mark('parseBody')
    const { goal, questions, answers, conversationHistory } = body
    if (!goal) return createError('缺少目标参数', 400)

    const apiKey = this.env.OPENAI_API_KEY
    if (!apiKey) {
      return this.streamAskResponse({ questions: [], message: '信息已足够，可以生成 SOP' })
    }

    // 快速退出：已达7轮 → 直接结束
    const historyLen = conversationHistory?.length || 0
    if (historyLen >= 7) {
      const resp = this.streamAskResponse({ questions: [], message: '信息已足够，可以生成 SOP' })
      timer.mark('fastExit')
      timer.done()
      await this.updateQuota(user.id, calculateTokens(goal), 'ask')
      return resp
    }

    try {
      const historyText = (conversationHistory || []).map((item, index) =>
        `${index + 1}. Q: ${item.question}\n   A: ${item.answer}`
      ).join('\n')

      const remainingQuestions = Math.max(0, 7 - historyLen)

      const systemPrompt = `你是SOP信息收集助手，通过提问收集信息。规则：
1. 绝不重复已问过的问题（包括换说法问相似内容）
2. 如果用户回答已提供某信息，不要追问
3. 最多再问 ${remainingQuestions} 个，每轮只问1个
4. 信息足够时直接返回空questions数组
5. 只输出JSON，不含其他内容`

      const userPrompt = `【目标】${goal}

【已问过的问题和回答】
${historyText || '暂无（这是第一个问题）'}

【还可问】${remainingQuestions} 个

【任务】回顾已有信息，判断是否足够生成SOP。
- 足够：{"questions":[],"message":"信息已足够，可以生成 SOP"}
- 不足：只问1个新问题，格式：
  {"questions":[{"text":"问题","type":"choice|input","options":["是","否"]}]}

type规则：是否题用choice+是/否；选择题用choice(≤4个选项)；填空题用input+[]`

      const messages = [{ role: 'system', content: systemPrompt }]
      for (const item of conversationHistory || []) {
        messages.push({ role: 'assistant', content: item.question })
        messages.push({ role: 'user', content: item.answer })
      }
      messages.push({ role: 'user', content: userPrompt })

      const { response, elapsed } = await this.callChatCompletion(messages, {
        label: 'ask',
        temperature: 0.2,
        maxTokens: 250,
        stream: true,
        timeoutMs: 30000,
      })
      timer.mark(`aiStream(${elapsed}ms)`)

      const tokensUsed = calculateTokens(goal + JSON.stringify(answers || {}))
      await this.updateQuota(user.id, tokensUsed, 'ask')
      timer.mark('quota')
      timer.done()

      return new Response(response.body, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    } catch (error) {
      console.error('AI ask failed:', error.message)
      timer.mark('error')
      timer.done()
    }

    return this.streamAskResponse({
      questions: [],
      message: '信息已足够，可以生成 SOP',
    })
  }

  streamAskResponse(result) {
    const encoder = new TextEncoder()
    const content = JSON.stringify(result)
    const stream = new ReadableStream({
      async start(controller) {
        // 单次直接发送，避免人为分块延迟
        const chunk = JSON.stringify({ choices: [{ delta: { content } }] })
        controller.enqueue(encoder.encode(`data: ${chunk}\n\n`))
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

  // ===================== chat 接口（SOP执行场景智能问答） =====================
  /**
   * 面向 SOP 执行场景的 AI 对话接口：
   * - 结合步骤上下文回答用户疑问
   * - 检测步骤1是否遗漏食材并主动提醒
   * - 支持流式输出
   */
  async chat() {
    const timer = createTimer('sop.chat')
    const user = await extractUser(this.request, this.env)
    timer.mark('auth')
    if (!user) return createError('未授权', 401)
    if (user.quota_used >= user.quota_total) return createError('Token 配额已用完', 403)

    const body = await parseBody(this.request)
    timer.mark('parseBody')
    const {
      sopId,
      currentStepId,
      sop,          // 完整 SOP 对象（{title, steps:[...]}）
      message,      // 用户当前提问
      history = [], // 本轮对话历史 [{role,content}]
      stream = true,
    } = body

    if (!message) return createError('缺少 message 参数', 400)

    try {
      // 构造步骤上下文
      let stepContext = ''
      let missingIngredientsHint = ''
      if (sop && Array.isArray(sop.steps) && sop.steps.length > 0) {
        const currentIdx = sop.steps.findIndex(s => s.id === currentStepId)
        const current = currentIdx >= 0 ? sop.steps[currentIdx] : sop.steps[0]
        const prevSteps = currentIdx > 0 ? sop.steps.slice(0, currentIdx) : []
        const nextSteps = currentIdx >= 0 ? sop.steps.slice(currentIdx + 1, currentIdx + 3) : sop.steps.slice(1, 3)

        stepContext = `【SOP标题】${sop.title || ''}
【当前步骤】#${current.id} ${current.title}
  - 耗时：${current.duration || 0}分钟
  - 说明：${current.description || ''}
【已完成步骤】${prevSteps.map(s => `#${s.id} ${s.title}`).join('、') || '无'}
【后续步骤预览】${nextSteps.map(s => `#${s.id} ${s.title}(${s.duration}min)`).join(' → ') || '无'}`

        // 步骤1（准备/备菜阶段）：提取步骤描述中的食材关键词，若用户未提"食材已备齐"类表述，主动提醒
        if (currentIdx <= 0 || /准备|备料|备菜|食材|清洗|处理/.test(current.title)) {
          const desc = (sop.steps.map(s => s.description).join(' ') + ' ' + (sop.title || '')).toLowerCase()
          const ingredients = []
          const candidates = ['鸡蛋', '番茄', '西红柿', '青椒', '土豆', '肉丝', '排骨', '鸡翅', '虾', '鱼',
            '葱', '姜', '蒜', '盐', '酱油', '生抽', '老抽', '料酒', '糖', '食用油', '油', '醋', '淀粉',
            '米饭', '米', '紫菜', '青菜', '蔬菜', '玉米', '黄瓜', '豆腐', '牛肉', '猪肉', '羊肉']
          for (const c of candidates) {
            if (desc.includes(c.toLowerCase())) ingredients.push(c)
          }
          if (ingredients.length > 0) {
            missingIngredientsHint = `【系统检测】当前处于备菜/准备阶段。菜谱涉及食材：${ingredients.join('、')}。
请在回答开头先确认用户是否已备齐上述食材，若用户表示缺少某食材，则建议替代方案或快速采购提示。`
          }
        }
      }

      const systemPrompt = `你是厨房里的贴心烹饪助手Lumi。用户正在按SOP做菜，你需要：
1. 只回答与烹饪/步骤/食材/厨具/安全相关的问题，其他问题礼貌告知无法回答
2. 回答简明扼要，通常不超过80字；复杂问题不超过150字
3. 使用中文，语气亲切可爱（如"好哒～"、"没问题哦"）
4. 不确定时如实告知，不要编造做法
5. 绝对不要生成SOP步骤列表，只回答用户当前问题
${missingIngredientsHint}`

      const messages = [{ role: 'system', content: systemPrompt }]
      if (stepContext) messages.push({ role: 'system', content: stepContext })

      // 注入历史对话（最近6轮，避免token爆炸）
      const recentHistory = history.slice(-12)
      for (const h of recentHistory) {
        if (h && h.role && h.content) messages.push({ role: h.role, content: h.content })
      }
      messages.push({ role: 'user', content: message })

      const { response } = await this.callChatCompletion(messages, {
        label: 'chat',
        temperature: 0.6,
        maxTokens: stream ? 500 : 300,
        stream: !!stream,
        timeoutMs: 25000,
      })
      timer.mark('aiCall')

      const tokensUsed = calculateTokens(message + stepContext)
      await this.updateQuota(user.id, tokensUsed, 'chat')
      timer.mark('quota')
      timer.done()

      if (stream) {
        return new Response(response.body, {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        })
      } else {
        const data = await response.json()
        const content = data.choices?.[0]?.message?.content || ''
        return createResponse({ reply: content })
      }
    } catch (error) {
      console.error('AI chat failed:', error.message)
      timer.mark('error')
      timer.done()
      if (stream) {
        return this.streamAskResponse({ reply: '抱歉，我暂时有点迷糊，请稍后再试哦～' })
      }
      return createError('AI 对话失败', 502)
    }
  }

  // ===================== CRUD =====================
  async list() {
    const user = await extractUser(this.request, this.env)
    if (!user) return createError('未授权', 401)

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
    if (!user) return createError('未授权', 401)

    const sopId = this.path.split('/').pop()
    const result = await this.env.DB.prepare(
      'SELECT id, title, goal, constraints, steps, estimated_total_time, status, created_at FROM sops WHERE id = ? AND user_id = ?'
    ).bind(sopId, user.id).run()

    if (!result.results?.[0]) return createError('SOP 不存在', 404)

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
    if (!user) return createError('未授权', 401)

    const body = await parseBody(this.request)
    const { id, title, goal, constraints, steps, estimatedTotalTime } = body
    if (!id) return createError('缺少 ID 参数', 400)

    const existing = await this.env.DB.prepare(
      'SELECT id FROM sops WHERE id = ? AND user_id = ?'
    ).bind(id, user.id).run()
    if (!existing.results?.[0]) return createError('SOP 不存在', 404)

    await this.env.DB.prepare(
      'UPDATE sops SET title = ?, goal = ?, constraints = ?, steps = ?, estimated_total_time = ?, updated_at = ? WHERE id = ?'
    ).bind(
      title, goal,
      JSON.stringify(constraints || {}),
      JSON.stringify(steps || []),
      estimatedTotalTime || 60,
      Date.now(), id
    ).run()

    return createResponse({ message: '保存成功' })
  }

  async delete() {
    const user = await extractUser(this.request, this.env)
    if (!user) return createError('未授权', 401)

    const sopId = this.path.split('/').pop()
    const existing = await this.env.DB.prepare(
      'SELECT id FROM sops WHERE id = ? AND user_id = ?'
    ).bind(sopId, user.id).run()
    if (!existing.results?.[0]) return createError('SOP 不存在', 404)

    await this.env.DB.prepare('DELETE FROM sops WHERE id = ?').bind(sopId).run()
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
