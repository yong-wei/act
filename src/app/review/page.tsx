import Link from 'next/link'
import { ArrowUpRight, ClipboardCheck } from 'lucide-react'
import { UnifiedTopBar } from '@/components/shared/unified-top-bar'

type ReviewEntry = {
  title: string
  href: string
}

const reviewEntries: ReviewEntry[] = [
  {
    title: '课外教学展示聚合入口',
    href: '/review/extracurricular-showcase',
  },
  {
    title: '自适应测评报告配图工作台',
    href: '/review/adaptive-assessment-figures',
  },
  {
    title: '综合仿真工作台',
    href: '/interactive-learning/control-workbench?mode=explore&preset=classic-four-view',
  },
  {
    title: '自适应跨域题库系统',
    href: '/assessment/adaptive-practice',
  },
  {
    title: '元提示词评价与过程一致性',
    href: '/evaluation/prompt-assessment',
  },
  {
    title: '邮轮舒适度控制场景（已合并）',
    href: '/simulations/cruise',
  },
  {
    title: '破冰船鲁棒控制场景（已合并）',
    href: '/simulations/icebreaker',
  },
]

export default function ReviewPage() {
  return (
    <main className="surface-page">
      <UnifiedTopBar title="评审入口" backHref="/" backLabel="返回首页" subtitle="Review Hub" />
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <header className="surface-card mb-8 p-6">
          <h1 className="flex items-center gap-3 text-3xl font-semibold text-foreground">
            <ClipboardCheck className="h-7 w-7 text-primary" />
            评审入口
          </h1>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {reviewEntries.map((entry) => (
            <Link
              key={entry.href}
              href={entry.href}
              prefetch={entry.href.startsWith('/simulations') ? false : undefined}
              className="surface-card-soft group p-5 transition hover:-translate-y-0.5 hover:border-primary/50"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold text-foreground">{entry.title}</h2>
                <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
              </div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  )
}
