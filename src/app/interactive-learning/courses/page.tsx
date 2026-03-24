import Link from 'next/link';
import { ArrowRight, ChevronDown } from 'lucide-react';

import { UnifiedTopBar } from '@/components/shared/unified-top-bar';
import { LEGACY_LESSONS, PREMIUM_LESSONS } from '@/features/interactive/learning-catalog';

export default function InteractiveCoursesPage() {
  return (
    <div className="interactive-course-hub-shell">
      <UnifiedTopBar title="互动课程" backHref="/interactive-learning" backLabel="返回互动学习" subtitle="Interactive Courses" className="pb-2" />

      <main className="mx-auto max-w-[1280px] px-6 py-10">
        <header className="interactive-course-hub-hero">
          <h1 className="interactive-course-hub-title text-3xl font-semibold">互动课程</h1>
          <p className="interactive-course-hub-muted mt-2 text-sm">
            按章节组织的互动课程入口，每节课均为独立路由页面。
          </p>
        </header>

        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between">
                <h2 className="interactive-course-hub-section-title text-xl font-semibold">精品课程</h2>
            <span className="interactive-course-hub-chip">优先推荐</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {PREMIUM_LESSONS.map((lesson) => (
              <Link
                key={lesson.id}
                href={lesson.href}
                className="interactive-course-hub-premium-card"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="interactive-course-hub-premium-badge">{lesson.badge}</span>
                  <span className="interactive-course-hub-premium-meta">{lesson.duration}</span>
                </div>
                <h2 className="interactive-course-hub-premium-title mt-4 text-xl font-semibold">{lesson.title}</h2>
                <p className="interactive-course-hub-premium-desc mt-2 text-sm">{lesson.description}</p>
                <div className="interactive-course-hub-link mt-4 inline-flex items-center text-xs">
                  进入课堂实录流程
                  <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <details className="interactive-course-hub-legacy-shell group" open={false}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <div>
                <h2 className="interactive-course-hub-section-title text-xl font-semibold">归档课程</h2>
                <p className="interactive-course-hub-muted mt-1 text-sm">
                  `legacy` 来源课与旧版 `lessonXX` 系列默认收起，保留为归档入口。
                </p>
              </div>
              <div className="interactive-course-hub-legacy-toggle">
                展开归档课程
                <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
              </div>
            </summary>

            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {LEGACY_LESSONS.map((lesson) => (
                <Link
                  key={lesson.id}
                  href={lesson.href}
                  className="interactive-course-hub-legacy-card"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="interactive-course-hub-legacy-badge">{lesson.badge}</span>
                    <span className="interactive-course-hub-legacy-meta">{lesson.duration}</span>
                  </div>
                  <h2 className="interactive-course-hub-legacy-title mt-4 text-lg font-semibold">{lesson.title}</h2>
                  <p className="interactive-course-hub-legacy-desc mt-2 text-sm">{lesson.description}</p>
                  <div className="interactive-course-hub-link mt-4 inline-flex items-center text-xs">
                    进入课程
                    <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              ))}
            </div>
          </details>
        </section>
      </main>
    </div>
  );
}
