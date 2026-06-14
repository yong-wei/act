import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { InteractiveLearningShell } from '@/features/interactive/interactive-learning-shell';
import { INTERACTIVE_COURSE_MODULES, PREMIUM_LESSONS } from '@/features/interactive/learning-catalog';

export default function InteractiveCoursesPage() {
  return (
    <InteractiveLearningShell
      activeHref="/interactive-learning/courses"
      title="互动课程"
      subtitle="Interactive Courses"
    >
      <section
        className="w-full px-4 py-8 sm:px-6 lg:px-8"
        data-commercial-workspace="interactive-learning"
        data-commercial-student-entry-route="/interactive-learning/courses"
        data-commercial-entry-intent="learn"
        data-interactive-atlas-workspace="course-catalog"
        data-learning-entry-map="course-module-progression"
      >
        <header
          className="mb-8 border-b border-border/60 pb-6"
          data-entry-current-context="course-catalog"
          data-entry-current-work-priority="recommended-course"
        >
          <h1 className="text-3xl font-semibold text-foreground">互动课程</h1>
          <p className="mt-2 text-sm text-subtle">
            优先进入已经建成并可直接学习的课程，再按模块查看完整目录。
          </p>
          <div className="mt-4 grid gap-3 text-xs md:grid-cols-3" data-commercial-entry-intent-map="course-launch">
            <span className="rounded-full border border-border/70 px-3 py-1 text-primary">模块进阶</span>
            <span className="rounded-full border border-border/70 px-3 py-1 text-primary">课程类型</span>
            <span className="rounded-full border border-border/70 px-3 py-1 text-primary">启动动作</span>
          </div>
        </header>

        <div className="space-y-8">
          <section className="border-b border-border/60 pb-7" data-course-progression-section="premium">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-foreground">精品课程</h2>
                <p className="mt-1 text-sm text-subtle">优先开放完整教师端/学生端链路的精品互动课。</p>
              </div>
              <span className="rounded-full border border-border/70 px-3 py-1 text-xs text-primary">优先推荐</span>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {PREMIUM_LESSONS.map((lesson) => (
                <Link
                  key={lesson.id}
                  href={lesson.href}
                  className="surface-card-soft group rounded-lg p-5 transition hover:border-primary/40"
                  data-course-entry-card={lesson.id}
                  data-course-entry-action="launch"
                  data-course-runtime-status={lesson.runtimeCardMetadata.statusLabel}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">{lesson.courseKind}</span>
                      <span className="rounded-full bg-muted px-2 py-1 text-subtle">{lesson.unitLabel}</span>
                    </div>
                    <span className="text-xs text-subtle">{lesson.runtimeCardMetadata.durationLabel}</span>
                  </div>

                  <h2 className="mt-4 text-lg font-semibold text-foreground">{lesson.title}</h2>
                  <p className="mt-2 text-sm text-subtle">{lesson.description}</p>

                  <div className="mt-4 inline-flex items-center text-xs text-primary">
                    进入课程
                    <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {INTERACTIVE_COURSE_MODULES.map((module) => (
            <section key={module.id} className="border-b border-border/60 pb-7" data-course-progression-section={module.id}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">{module.title}</h2>
                  <p className="mt-1 text-sm text-subtle">{module.description}</p>
                </div>
                <span className="rounded-full border border-border/70 px-3 py-1 text-xs text-primary">{module.chipLabel}</span>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {module.lessons.map((lesson) => (
                  <Link
                    key={lesson.id}
                    href={lesson.href}
                    className="surface-card-soft group rounded-lg p-5 transition hover:border-primary/40"
                    data-course-entry-card={lesson.id}
                    data-course-entry-action="launch"
                    data-course-runtime-status={lesson.runtimeCardMetadata.statusLabel}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">{lesson.unitLabel}</span>
                        <span className="rounded-full bg-muted px-2 py-1 text-subtle">{lesson.courseKind}</span>
                      </div>
                      <span className="text-xs text-subtle">{lesson.runtimeCardMetadata.durationLabel}</span>
                    </div>

                    <h2 className="mt-4 text-lg font-semibold text-foreground">{lesson.title}</h2>
                    <p className="mt-2 text-sm text-subtle">{lesson.description}</p>

                    {lesson.legacySourceLabel ? (
                      <p
                        className="mt-3 text-xs text-subtle"
                        data-secondary-implementation-links="legacy-source-labels"
                      >
                        {lesson.legacySourceLabel}
                      </p>
                    ) : null}

                    <div className="mt-4 inline-flex items-center text-xs text-primary">
                      进入课程
                      <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </InteractiveLearningShell>
  );
}
