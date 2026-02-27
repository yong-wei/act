import Link from 'next/link';
import { ArrowRight, Compass, Ship, Sparkles, Workflow } from 'lucide-react';

const ENTRY_ROUTES = [
  {
    title: '跨域探索',
    description:
      '跨域问题驱动探索：根轨迹、Bode、Nyquist 与时域响应联动，聚焦“结构可见”能力。',
    href: '/interactive-learning/cross-domain-exploration',
    badge: 'Cross-Domain',
    accent: 'text-fuchsia-300 border-fuchsia-400/40 bg-fuchsia-500/10',
  },
  {
    title: '互动课程',
    description: '进入各章节 90 分钟互动课程入口，按 BOPPPS 路径开展课堂活动与课后复盘。',
    href: '/interactive-learning/courses',
    badge: 'Course Hub',
    accent: 'text-cyan-300 border-cyan-400/40 bg-cyan-500/10',
  },
  {
    title: '各章节互动组件',
    description: '按章节维度查看互动组件库，点击章节后展示对应组件并进入资源页面。',
    href: '/interactive-learning/chapter-components',
    badge: 'Component Hub',
    accent: 'text-amber-300 border-amber-400/40 bg-amber-500/10',
  },
] as const;

export default function InteractiveLearningPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <nav className="border-b border-white/10">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
              <Ship className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide text-white">AI-OBE船舶智控平台</div>
              <div className="text-xs text-white/50">Mission Control for Maritime Education</div>
            </div>
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
          >
            进入驾驶舱
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-[1200px] px-6 py-12">
        <header className="mb-10 rounded-2xl border border-white/10 bg-slate-900/60 p-6">
          <h1 className="mb-3 text-3xl font-bold text-white md:text-4xl">互动学习</h1>
          <p className="text-base text-slate-300">
            入口已按学习意图拆分为独立路由：先选择学习模式，再进入对应课程与组件。
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
            <span className="rounded-full border border-white/10 px-3 py-1">跨域探索</span>
            <span className="rounded-full border border-white/10 px-3 py-1">互动课程</span>
            <span className="rounded-full border border-white/10 px-3 py-1">各章节互动组件</span>
          </div>
        </header>

        <section className="grid gap-5 md:grid-cols-3">
          {ENTRY_ROUTES.map((entry) => (
            <Link
              key={entry.href}
              href={entry.href}
              className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-6 transition hover:-translate-y-0.5 hover:border-white/30"
            >
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/5 blur-2xl" />
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${entry.accent}`}>{entry.badge}</span>
              <h2 className="mt-4 text-xl font-semibold text-white">{entry.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{entry.description}</p>
              <div className="mt-6 inline-flex items-center text-sm text-slate-200">
                进入入口
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-fuchsia-500/15 text-fuchsia-300">
              <Sparkles className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-white">跨域问题驱动</h3>
            <p className="mt-2 text-xs text-slate-400">聚焦跨表征关系，建立“模型-图形-响应”联动直觉。</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
              <Workflow className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-white">课程链路清晰</h3>
            <p className="mt-2 text-xs text-slate-400">按章节快速进入互动课程，支持课堂演示与学生自学切换。</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300">
              <Compass className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-white">组件按章归集</h3>
            <p className="mt-2 text-xs text-slate-400">章节入口与组件展示分离，路由独立，方便评审与课堂组织。</p>
          </div>
        </section>
      </main>
    </div>
  );
}
