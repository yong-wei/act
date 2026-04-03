import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { UnifiedTopBar } from '@/components/shared/unified-top-bar';
import { INTERACTIVE_COURSE_MODULES, PREMIUM_LESSONS } from '@/features/interactive/learning-catalog';

export default function InteractiveCoursesPage() {
  return (
    <div className="interactive-course-hub-shell">
      <UnifiedTopBar title="互动课程" backHref="/interactive-learning" backLabel="返回互动学习" subtitle="Interactive Courses" className="pb-2" />

      <main className="mx-auto max-w-[1280px] px-6 py-10">
        <header className="interactive-course-hub-hero">
          <h1 className="interactive-course-hub-title text-3xl font-semibold">互动课程</h1>
          <p className="interactive-course-hub-muted mt-2 text-sm">
            按新课程模块组织互动课程入口，当前仅展示已经建成并可直接进入的单元。
          </p>
        </header>

        <div className="space-y-8">
          <section className="interactive-course-hub-module-shell">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="interactive-course-hub-section-title text-xl font-semibold">精品课程</h2>
                <p className="interactive-course-hub-muted mt-1 text-sm">优先开放完整教师端/学生端链路的精品互动课。</p>
              </div>
              <span className="interactive-course-hub-chip">优先推荐</span>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {PREMIUM_LESSONS.map((lesson) => (
                <Link
                  key={lesson.id}
                  href={lesson.href}
                  className="interactive-course-hub-module-card"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="interactive-course-hub-module-badge">{lesson.badge}</span>
                    </div>
                    <span className="interactive-course-hub-module-meta text-xs">{lesson.duration}</span>
                  </div>

                  <h2 className="interactive-course-hub-module-title mt-4 text-lg font-semibold">{lesson.title}</h2>
                  <p className="interactive-course-hub-module-desc mt-2 text-sm">{lesson.description}</p>

                  <div className="interactive-course-hub-link mt-4 inline-flex items-center text-xs">
                    进入课程
                    <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {INTERACTIVE_COURSE_MODULES.map((module) => (
            <section key={module.id} className="interactive-course-hub-module-shell">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="interactive-course-hub-section-title text-xl font-semibold">{module.title}</h2>
                  <p className="interactive-course-hub-muted mt-1 text-sm">{module.description}</p>
                </div>
                <span className="interactive-course-hub-chip">{module.chipLabel}</span>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {module.lessons.map((lesson) => (
                <Link
                  key={lesson.id}
                  href={lesson.href}
                  className="interactive-course-hub-module-card"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="interactive-course-hub-unit-badge">{lesson.unitLabel}</span>
                      <span className="interactive-course-hub-module-badge">{lesson.badge}</span>
                    </div>
                    <span className="interactive-course-hub-module-meta text-xs">{lesson.duration}</span>
                  </div>

                  <h2 className="interactive-course-hub-module-title mt-4 text-lg font-semibold">{lesson.title}</h2>
                  <p className="interactive-course-hub-module-desc mt-2 text-sm">{lesson.description}</p>

                  {lesson.legacySourceLabel ? (
                    <p className="interactive-course-hub-module-note mt-3 text-xs">{lesson.legacySourceLabel}</p>
                  ) : null}

                  <div className="interactive-course-hub-link mt-4 inline-flex items-center text-xs">
                    进入课程
                    <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
