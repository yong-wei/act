import Link from 'next/link'
import { ArrowUpRight, ClipboardCheck, Ship, Sparkles } from 'lucide-react'

type ReviewEntry = {
  title: string
  href: string
  description: string
  source: string
}

const reviewEntries: ReviewEntry[] = [
  {
    title: '自适应测评报告配图工作台',
    href: '/review/adaptive-assessment-figures',
    description: '三图聚合预览与一键导出入口（题库稳定性 / 差异化生成 / 常态化评价）。',
    source: 'src/app/review/adaptive-assessment-figures/page.tsx',
  },
  {
    title: '多表征联动可视化引擎',
    href: '/interactive-learning/multi-representation-linkage',
    description: '开环极点/零点、根轨迹、Bode、Nyquist 与时域响应跨域联动。',
    source: 'src/app/interactive-learning/multi-representation-linkage/page.tsx',
  },
  {
    title: '自适应跨域题库系统',
    href: '/assessment/adaptive-practice',
    description: '能力诊断 + 动态出题 + 过程评估的跨域练习闭环。',
    source: 'src/app/assessment/adaptive-practice/page.tsx',
  },
  {
    title: '元提示词评价与过程一致性',
    href: '/evaluation/prompt-assessment',
    description: '提示词质量评价与过程一致性校验页面。',
    source: 'src/app/evaluation/prompt-assessment/page.tsx',
  },
  {
    title: '邮轮舒适度控制场景（已合并）',
    href: '/simulations/cruise',
    description: '已并入邮轮主仿真右侧“控制/评估/AI伴学”面板。',
    source: 'src/resources/simulations/simulations/cruise-simulation.tsx',
  },
  {
    title: '破冰船鲁棒控制场景（已合并）',
    href: '/simulations/icebreaker',
    description: '已并入破冰船主仿真右侧“控制/评估/AI伴学”面板。',
    source: 'src/resources/simulations/simulations/icebreaker-simulation.tsx',
  },
]

export default function ReviewPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <header className="mb-8 rounded-2xl border border-white/10 bg-slate-900/70 p-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-300">
            <Sparkles className="h-3.5 w-3.5" />
            DevelopmentPlan 对齐入口
          </div>
          <h1 className="mt-4 flex items-center gap-3 text-3xl font-semibold text-white">
            <ClipboardCheck className="h-7 w-7 text-amber-400" />
            评审入口
          </h1>
          <p className="mt-3 text-sm text-slate-300">
            汇总本分支已完成并可演示的页面入口，按 `docs/DevelopmentPlan.md` 用户备注整理。
          </p>
          <div className="mt-5">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-amber-400/60 hover:text-white"
            >
              <Ship className="h-4 w-4 text-amber-400" />
              返回首页
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {reviewEntries.map((entry) => (
            <Link
              key={entry.href}
              href={entry.href}
              className="group rounded-xl border border-white/10 bg-slate-900/60 p-5 transition hover:-translate-y-0.5 hover:border-amber-400/50"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold text-white">{entry.title}</h2>
                <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-amber-300" />
              </div>
              <p className="mt-2 text-sm text-slate-300">{entry.description}</p>
              <p className="mt-3 break-all text-xs text-slate-500">来源：{entry.source}</p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  )
}
