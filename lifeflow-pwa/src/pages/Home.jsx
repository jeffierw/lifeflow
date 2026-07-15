import { useNavigate } from 'react-router-dom'
import { ChefHat, Home as HomeIcon, Plane, Baby, Heart, Sparkles, ChevronRight, Play, Clock, Users } from 'lucide-react'
import Header from '../components/Header'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'

const templates = [
  { 
    id: 'dinner', 
    title: 'Family Dinner', 
    desc: '家庭晚餐编排', 
    icon: ChefHat, 
    bg: 'bg-orange-50',
    text: 'text-orange-600',
    example: '今晚做四菜一汤'
  },
  { 
    id: 'cleaning', 
    title: 'Weekend Cleaning', 
    desc: '周末全屋清洁', 
    icon: HomeIcon, 
    bg: 'bg-teal-50',
    text: 'text-teal-600',
    example: '周六上午完成全屋清洁'
  },
  { 
    id: 'packing', 
    title: 'Trip Packing', 
    desc: '旅行前行李准备', 
    icon: Plane, 
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    example: '明天带孩子出门露营'
  },
  { 
    id: 'bedtime', 
    title: 'Baby Bedtime', 
    desc: '亲子睡前流程', 
    icon: Baby, 
    bg: 'bg-rose-50',
    text: 'text-rose-600',
    example: '孩子睡前流程'
  },
  { 
    id: 'care', 
    title: 'Caregiving', 
    desc: '居家照护', 
    icon: Heart, 
    bg: 'bg-purple-50',
    text: 'text-purple-600',
    example: '老人照护安排'
  },
  { 
    id: 'party', 
    title: 'Party Prep', 
    desc: '聚会准备', 
    icon: Sparkles, 
    bg: 'bg-orange-50',
    text: 'text-orange-600',
    example: '家庭聚会准备'
  },
]

const features = [
  { title: '自然语言输入', desc: '描述你的生活目标，AI 帮你拆解' },
  { title: '智能追问', desc: '自动识别关键约束，完善任务信息' },
  { title: '自动编排', desc: '生成步骤清单、时间轴和依赖关系' },
  { title: '执行模式', desc: '一步步提醒，减少信息干扰' },
  { title: '语音播报', desc: '声控推进，解放双手' },
  { title: '中断恢复', desc: '任务被打断后智能重新编排' },
]

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <section className="bg-gradient-to-br from-orange-50 via-background to-teal-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 md:py-16">
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant="default" className="bg-accent text-accentForeground">生活娱乐赛道</Badge>
            <Badge variant="secondary" className="bg-teal-600 text-white">社会公益附加赛题</Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4">
            LifeFlow：<span className="text-accent">AI 生活 SOP 编排器</span>
          </h1>
          <p className="text-lg text-muted max-w-xl mb-8">
            把复杂生活任务变成可执行流程，让你知道现在最应该做哪一步。
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={() => navigate('/generate')}>
              <Sparkles size={20} className="mr-2" />
              开始编排
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/invite')}>
              申请试用邀请码
            </Button>
          </div>
        </div>
      </section>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        <section className="mb-12">
          <h2 className="text-xl font-bold text-foreground mb-2">从模板开始</h2>
          <p className="text-sm text-muted mb-6">选择一个生活场景，快速创建你的第一个 SOP</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => {
              const Icon = template.icon
              return (
                <Card key={template.id} className="border border-border overflow-hidden group hover:border-accent transition-colors">
                  <CardContent className="p-4">
                    <button 
                      className="w-full text-left"
                      onClick={() => navigate('/generate')}
                    >
                      <div className={`w-11 h-11 ${template.bg} ${template.text} flex items-center justify-center mb-3`}>
                        <Icon size={24} />
                      </div>
                      <h4 className="font-bold text-foreground mb-1">{template.title}</h4>
                      <p className="text-sm text-muted mb-2">{template.desc}</p>
                      <p className="text-sm text-accent italic mb-3">{template.example}</p>
                      <ChevronRight size={18} className="text-muted group-hover:text-accent group-hover:translate-x-1 transition-all" />
                    </button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-xl font-bold text-foreground mb-6">核心功能</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature, index) => (
              <Card key={index} className="border border-border">
                <CardContent className="p-4 flex gap-4">
                  <div className="w-9 h-9 bg-orange-50 text-accent flex items-center justify-center flex-shrink-0 font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground mb-1">{feature.title}</h4>
                    <p className="text-sm text-muted">{feature.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-12 bg-gradient-to-br from-orange-50 via-background to-teal-50 p-6 md:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-xl font-bold text-foreground mb-4">为什么需要 LifeFlow？</h2>
              <p className="text-muted mb-6">
                很多生活任务并不难，但真正执行时会变得混乱。LifeFlow 把项目管理里的 SOP、依赖关系、资源编排和时间轴，转化为普通人也能直接使用的生活工具。
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-foreground">
                  <Clock size={16} className="text-accent" />
                  <span className="text-sm">少记一点：不用记住所有步骤</span>
                </li>
                <li className="flex items-center gap-3 text-foreground">
                  <Users size={16} className="text-accent" />
                  <span className="text-sm">少慌一点：多人协作不混乱</span>
                </li>
                <li className="flex items-center gap-3 text-foreground">
                  <Play size={16} className="text-accent" />
                  <span className="text-sm">少漏一点：一步一步提醒</span>
                </li>
              </ul>
            </div>
            <div>
              <div className="space-y-3">
                <div className="bg-accent text-accentForeground px-4 py-3 font-semibold text-sm relative pl-8">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 bg-accentForeground" />
                  输入目标
                </div>
                <div className="bg-card border border-border px-4 py-3 font-semibold text-sm text-muted relative pl-8">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 bg-border" />
                  AI 追问
                </div>
                <div className="bg-card border border-border px-4 py-3 font-semibold text-sm text-muted relative pl-8">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 bg-border" />
                  生成 SOP
                </div>
                <div className="bg-card border border-border px-4 py-3 font-semibold text-sm text-muted relative pl-8">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 bg-border" />
                  编辑确认
                </div>
                <div className="bg-card border border-border px-4 py-3 font-semibold text-sm text-muted relative pl-8">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 bg-border" />
                  执行模式
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-xl font-bold text-foreground mb-6">用户示例</h2>
          <div className="bg-secondary border-l-4 border-accent p-6">
            <blockquote className="text-foreground italic mb-3">
              "我今晚要做番茄炒蛋、清蒸鲈鱼、青椒肉丝、炒青菜和玉米排骨汤。家里有 2 个灶、1 个电饭煲、1 个蒸锅，只有我一个人做，希望 1 小时内完成。"
            </blockquote>
            <cite className="text-accent font-semibold text-sm">— 用户输入示例（家庭晚餐场景）</cite>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-6">
        <p className="text-center text-sm text-muted">
          LifeFlow — AI 生活 SOP 编排器 | 生活娱乐 × 社会公益
        </p>
      </footer>
    </div>
  )
}
