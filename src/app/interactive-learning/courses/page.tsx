import Link from 'next/link';
import { ArrowRight, Ship } from 'lucide-react';

import { CHAPTER_LESSONS, PREMIUM_LESSONS } from '@/features/interactive/learning-catalog';

export default function InteractiveCoursesPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="border-b border-white/10">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4">
          <Link href="/interactive-learning" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400">
              <Ship className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide">互动学习</div>
              <div className="text-xs text-white/50">Interactive Courses</div>
            </div>
          </Link>
          <Link
            href="/interactive-learning"
            className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
          >
            返回入口
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-[1280px] px-6 py-10">
        <header className="mb-8 rounded-2xl border border-white/10 bg-slate-900/60 p-6">
          <h1 className="text-3xl font-semibold">互动课程</h1>
          <p className="mt-2 text-sm text-slate-300">按章节组织的互动课程入口，每节课均为独立路由页面。</p>
        </header>

        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">精品课程</h2>
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
              优先推荐
            </span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {PREMIUM_LESSONS.map((lesson) => (
              <Link
                key={lesson.id}
                href={lesson.href}
                className="group rounded-xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/10 to-slate-900/70 p-5 transition hover:-translate-y-0.5 hover:border-cyan-300"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-cyan-200">{lesson.badge}</span>
                  <span className="text-slate-300">{lesson.duration}</span>
                </div>
                <h2 className="mt-4 text-xl font-semibold text-white">{lesson.title}</h2>
                <p className="mt-2 text-sm text-slate-200">{lesson.description}</p>
                <div className="mt-4 inline-flex items-center text-xs text-cyan-100">
                  进入课堂实录流程
                  <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-white">章节课程</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {CHAPTER_LESSONS.map((lesson) => (
            <Link
              key={lesson.id}
              href={lesson.href}
              className="group rounded-xl border border-slate-800 bg-slate-900/60 p-5 transition hover:-translate-y-0.5 hover:border-cyan-400/40"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="rounded-full bg-cyan-500/15 px-3 py-1 text-cyan-300">{lesson.badge}</span>
                <span className="text-slate-400">{lesson.duration}</span>
              </div>
              <h2 className="mt-4 text-lg font-semibold text-white">{lesson.title}</h2>
              <p className="mt-2 text-sm text-slate-300">{lesson.description}</p>
              <div className="mt-4 inline-flex items-center text-xs text-cyan-200">
                进入课程
                <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
