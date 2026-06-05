import Link from 'next/link';
import { ArrowRight, Compass, Sparkles, Workflow } from 'lucide-react';
import { UnifiedTopBar } from '@/components/shared/unified-top-bar';
import { getCommercialStudentEntryIntentGroups } from '@/lib/platform-role-navigation';

const ENTRY_ROUTES = [
  {
    title: '跨域探索',
    description:
      '跨域问题驱动探索：根轨迹、Bode、Nyquist 与时域响应联动，聚焦“结构可见”能力。',
    href: '/interactive-learning/cross-domain-exploration',
    badge: 'Cross-Domain',
    accent: 'border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300',
  },
  {
    title: '互动课程',
    description: '进入各章节 90 分钟互动课程入口，按 BOPPPS 路径开展课堂活动与课后复盘。',
    href: '/interactive-learning/courses',
    badge: 'Course Hub',
    accent: 'border-cyan-400/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  },
  {
    title: '各章节互动组件',
    description: '按章节维度查看互动组件库，点击章节后展示对应组件并进入资源页面。',
    href: '/interactive-learning/chapter-components',
    badge: 'Component Hub',
    accent: 'border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
] as const;

export default function InteractiveLearningPage() {
  const entryIntents = getCommercialStudentEntryIntentGroups();
  return (
    <div
      className="surface-page"
      data-commercial-workspace="interactive-learning"
      data-commercial-student-entry-route="/interactive-learning"
      data-commercial-entry-intent="learn"
      data-learning-entry-map="student-intent"
    >
      <UnifiedTopBar title="互动学习" backHref="/" backLabel="返回首页" subtitle="Interactive Learning" />

      <main className="mx-auto max-w-[1200px] px-6 py-12">
        <header
          className="surface-card mb-6 p-6"
          data-entry-current-context="interactive-learning"
          data-entry-current-work-priority="active-learning-context"
        >
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.24em] text-primary">商业入口 · 学习</p>
          <h1 className="mb-3 text-3xl font-bold text-foreground md:text-4xl">互动学习</h1>
          <p className="text-base text-subtle">
            先继续当前学习路径，再进入课程、练习、挑战或实验。组件库保留为次级资料入口。
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-subtle">
            <span className="rounded-full border border-border/60 px-3 py-1">当前课程</span>
            <span className="rounded-full border border-border/60 px-3 py-1">下一次练习</span>
            <span className="rounded-full border border-border/60 px-3 py-1">证据复盘</span>
          </div>
        </header>

        <section className="mb-6 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]" data-current-learning-path="student-control">
          <Link href="/interactive-learning/courses" className="surface-card group p-5 transition hover:border-primary/40">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-primary">当前路径</span>
            <h2 className="mt-3 text-xl font-semibold text-foreground">继续互动课程</h2>
            <p className="mt-2 text-sm leading-6 text-subtle">
              从课程目录进入已开放单元，优先处理当前课堂、当前课次和下一次练习。
            </p>
            <span className="mt-4 inline-flex items-center text-sm text-foreground">
              进入课程
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
          <Link href="/profile/evidence" className="surface-card-soft p-5 transition hover:border-primary/40">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-primary">学习证据</span>
            <h2 className="mt-3 text-base font-semibold text-foreground">查看证据复盘</h2>
            <p className="mt-2 text-sm leading-6 text-subtle">完成课程、练习或挑战后回到证据时间线。</p>
          </Link>
        </section>

        <section className="mb-6 grid gap-3 md:grid-cols-3" data-commercial-entry-intent-map="learn-practice-challenge">
          {entryIntents.filter((intent) => ['learn', 'practice', 'challenge'].includes(intent.intent)).map((intent) => (
            <Link key={intent.intent} href={intent.hrefs[0] ?? '/dashboard'} className="surface-card-soft rounded-lg p-4 text-sm transition hover:border-primary/40">
              <span className="text-xs font-medium text-primary">{intent.label}</span>
              <span className="mt-1 block text-subtle">{intent.summary}</span>
            </Link>
          ))}
        </section>

        <section className="grid gap-5 md:grid-cols-2" data-learning-map-surface="module-paths">
          {ENTRY_ROUTES.filter((entry) => entry.href !== '/interactive-learning/chapter-components').map((entry) => (
            <Link
              key={entry.href}
              href={entry.href}
              className="surface-card group relative overflow-hidden p-6 transition hover:-translate-y-0.5 hover:border-primary/40"
            >
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${entry.accent}`}>{entry.badge}</span>
              <h2 className="mt-4 text-xl font-semibold text-foreground">{entry.title}</h2>
              <p className="mt-3 text-sm leading-6 text-subtle">{entry.description}</p>
              <div className="mt-6 inline-flex items-center text-sm text-foreground/90">
                进入入口
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </section>

        <section className="mt-6 surface-card-soft p-4" data-secondary-implementation-links="component-library">
          {ENTRY_ROUTES.filter((entry) => entry.href === '/interactive-learning/chapter-components').map((entry) => (
            <Link key={entry.href} href={entry.href} className="flex items-center justify-between gap-4 text-sm text-foreground">
              <span>
                <span className="block font-medium">{entry.title}</span>
                <span className="mt-1 block text-xs text-subtle">{entry.description}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-primary" />
            </Link>
          ))}
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="surface-card-soft p-4">
            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-fuchsia-500/15 text-fuchsia-300">
              <Sparkles className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">跨域问题驱动</h3>
            <p className="mt-2 text-xs text-subtle">聚焦跨表征关系，建立“模型-图形-响应”联动直觉。</p>
          </div>
          <div className="surface-card-soft p-4">
            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
              <Workflow className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">课程链路清晰</h3>
            <p className="mt-2 text-xs text-subtle">按章节快速进入互动课程，支持课堂演示与学生自学切换。</p>
          </div>
          <div className="surface-card-soft p-4">
            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300">
              <Compass className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">组件按章归集</h3>
            <p className="mt-2 text-xs text-subtle">章节入口与组件展示分离，路由独立，方便评审与课堂组织。</p>
          </div>
        </section>
      </main>
    </div>
  );
}
