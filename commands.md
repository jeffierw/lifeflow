# LifeFlow 命令手册

## 📁 项目结构

```
trae-project/
├── lifeflow-pwa/          # 前端 PWA 项目
└── lifeflow-worker/       # 后端 Cloudflare Worker
```

---

## 🚀 本地开发

### 前端开发

```bash
# 进入前端目录
cd lifeflow-pwa

# 安装依赖（首次）
npm install

# 启动开发服务器
npm run dev
# 默认地址: http://localhost:5173

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

### 后端开发

```bash
# 进入后端目录
cd lifeflow-worker

# 安装依赖（首次）
npm install

# 设置本地敏感环境变量（仅需首次）
npx wrangler secret put JWT_SECRET
npx wrangler secret put OPENAI_API_KEY

# 启动本地开发服务器（含 D1 模拟数据库）
npx wrangler dev
# 默认地址: http://localhost:8787

# 初始化数据库表（首次启动自动初始化）
# 无需手动执行，代码会自动创建表

# 查看 Worker 日志
# 日志会实时显示在终端中
```

---

## 🔧 API 测试命令

### 邀请码管理

```bash
# 申请邀请码
curl -X POST http://localhost:8787/api/invite/apply \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com"}'

# 验证邀请码
curl -X POST http://localhost:8787/api/invite/validate \
  -H "Content-Type: application/json" \
  -d '{"code":"INVITE_CODE"}'
```

### 用户认证

```bash
# 注册账号（需要邀请码）
curl -X POST http://localhost:8787/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "password":"123456",
    "inviteCode":"INVITE_CODE"
  }'

# 登录账号
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456"}'

# 获取用户信息（需要 Token）
curl -X GET http://localhost:8787/api/auth/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### SOP 管理

```bash
# 生成 SOP（需要 Token）
curl -X POST http://localhost:8787/api/sop/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"goal":"周末家庭大扫除"}'

# 获取 SOP 列表（需要 Token）
curl -X GET http://localhost:8787/api/sop/list \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 获取单个 SOP（需要 Token）
curl -X GET http://localhost:8787/api/sop/SOP_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 保存 SOP（需要 Token）
curl -X POST http://localhost:8787/api/sop/save \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "id":"SOP_ID",
    "title":"新标题",
    "goal":"目标",
    "steps":[...]
  }'

# 删除 SOP（需要 Token）
curl -X DELETE http://localhost:8787/api/sop/SOP_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 配额查询

```bash
# 查询配额状态（需要 Token）
curl -X GET http://localhost:8787/api/quota/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## ☁️ 生产部署

### 1. 安装 Wrangler CLI

```bash
# 安装最新版本
npm install -g wrangler
```

### 2. 登录 Cloudflare

```bash
wrangler login
# 会打开浏览器进行认证
```

### 3. 创建 D1 数据库

```bash
# 创建数据库
wrangler d1 create lifeflow-db

# 记录返回的 database_id
# 示例: database_id = "1a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p"
```

### 4. 更新 wrangler.toml

编辑 `lifeflow-worker/wrangler.toml`，将生产 D1 数据库 ID 填入：

```toml
[[d1_databases]]
binding = "DB"
database_name = "lifeflow-db"
database_id = "YOUR_DATABASE_ID"  # 替换为实际 ID
```

> 注意：`JWT_SECRET` 与 `OPENAI_API_KEY` 等敏感信息已通过 `wrangler secret put` 设置，不应写入 `wrangler.toml`。

### 5. 初始化生产数据库

```bash
# 执行 SQL 文件初始化表
wrangler d1 execute lifeflow-db --file=schema.sql
```

### 6. 更新环境变量

```bash
# 更新 JWT_SECRET（生产环境必须更换）
wrangler secret put JWT_SECRET
# 输入安全的密钥（建议使用: node -e "console.log(crypto.randomBytes(32).toString('base64'))"）

# 更新 OPENAI_API_KEY
wrangler secret put OPENAI_API_KEY
```

### 7. 部署到 Cloudflare

```bash
# 部署 Worker
wrangler deploy

# 部署成功后会显示 Worker 地址
# 示例: https://lifeflow-worker.your-account.workers.dev
```

### 8. 更新前端 API 地址

```bash
# 修改 lifeflow-pwa/.env 文件
VITE_API_BASE=https://lifeflow-worker.your-account.workers.dev
```

### 9. 前端部署

```bash
# 构建前端
cd lifeflow-pwa
npm run build

# 部署到静态托管（Cloudflare Pages / Vercel / Netlify）
# 或上传 dist 目录到任意静态托管服务
```

---

## 🤖 GitHub Actions 自动部署（推荐）

项目已配置两套工作流，推送到 `main` 分支时自动部署：

| 工作流 | 路径 | 目标 | 触发条件 |
|---|---|---|---|
| `deploy-worker.yml` | `.github/workflows/deploy-worker.yml` | Cloudflare Workers | `lifeflow-worker/**` 变更 |
| `deploy-pwa.yml` | `.github/workflows/deploy-pwa.yml` | Vercel | `lifeflow-pwa/**` 变更 |

### 1. 准备 Cloudflare 凭据

在 GitHub 仓库 **Settings → Secrets and variables → Actions** 中添加：

| Secret / Variable | 说明 | 获取方式 |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token | [Create Token](https://dash.cloudflare.com/profile/api-tokens)，权限：`Cloudflare Workers:Edit`、`Account:Read` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID | Cloudflare 仪表盘右侧或 Worker 域名页面 |
| `JWT_SECRET` | JWT 签名密钥 | 建议使用 `node -e "console.log(crypto.randomBytes(32).toString('base64'))"` 生成 |
| `OPENAI_API_KEY` | 中转站 OpenAI API Key | 从中转站后台获取 |

### 2. 准备 Vercel 凭据

| Secret / Variable | 说明 | 获取方式 |
|---|---|---|
| `VERCEL_TOKEN` | Vercel Access Token | [Vercel Settings → Tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | Vercel Organization ID | 运行 `vercel login` 后查看本地 `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | Vercel Project ID | 同上 |
| `VITE_API_BASE` (Repository Variable) | 生产 Worker 地址 | 例如 `https://lifeflow-worker.your-account.workers.dev` |

本地获取 Vercel 项目信息：

```bash
cd lifeflow-pwa
npx vercel login
npx vercel link
# 根据提示创建/选择项目，完成后查看 .vercel/project.json
cat .vercel/project.json
```

将 `orgId` 和 `projectId` 填入 GitHub Secrets。

### 3. 首次触发部署

```bash
# 确认 main 分支已包含最新代码
git add .
git commit -m "chore: add auto deploy workflows"
git push origin main
```

推送后，在 GitHub 仓库 **Actions** 标签页可查看部署进度。

### 4. 手动触发

两个工作流均支持 `workflow_dispatch`，可在 GitHub Actions 页面手动运行。

### 5. 安全提示

- `wrangler.toml` 中不再存放 `JWT_SECRET` 与 `OPENAI_API_KEY`；如你之前已将旧版本提交到 GitHub，建议立即更换这两个密钥。
- `lifeflow-pwa/.env` 已加入 `.gitignore`，请勿将生产 API 地址写入该文件，应通过 GitHub Repository Variables 注入。

---

## 📊 环境变量配置

### 前端环境变量 (.env)

```bash
VITE_API_BASE=http://localhost:8787  # 本地开发
VITE_API_BASE=https://your-worker.workers.dev  # 生产环境
```

### 后端环境变量 (wrangler.toml / secrets)

```toml
[vars]
# 非敏感变量可写在 wrangler.toml
OPENAI_BASE_URL = "https://your-proxy.site"
MODEL_NAME = "gpt-5.5"

[[d1_databases]]
binding = "DB"
database_name = "lifeflow-db"
database_id = "your-database-id"
```

敏感变量通过 `wrangler secret put` 设置，不会进入仓库：

```bash
wrangler secret put JWT_SECRET
wrangler secret put OPENAI_API_KEY
```

---

## 🐛 故障排查

### 常见问题

```bash
# 检查 Worker 状态
wrangler tail

# 查看 Worker 日志
wrangler logs

# 测试 API 连通性
curl -v http://localhost:8787/api/invite/apply

# 检查数据库表
wrangler d1 execute lifeflow-db --command="SELECT name FROM sqlite_master WHERE type='table'"
```

### 重置本地数据库

```bash
# 删除本地模拟数据库缓存
rm -rf .wrangler/state/v3/d1/DB
```

---

## 📋 完整测试流程

```bash
# 1. 启动服务
cd lifeflow-pwa && npm run dev &
cd lifeflow-worker && npx wrangler dev &

# 2. 申请邀请码
curl -X POST http://localhost:8787/api/invite/apply \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# 3. 注册用户（使用上一步返回的邀请码）
curl -X POST http://localhost:8787/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "password":"123456",
    "inviteCode":"CODE_FROM_STEP_2"
  }'

# 4. 登录（获取 Token）
TOKEN=$(curl -s -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456"}' | jq -r '.token')

# 5. 生成 SOP
curl -X POST http://localhost:8787/api/sop/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"goal":"准备生日派对"}'

# 6. 查询配额
curl -X GET http://localhost:8787/api/quota/status \
  -H "Authorization: Bearer $TOKEN"
```
