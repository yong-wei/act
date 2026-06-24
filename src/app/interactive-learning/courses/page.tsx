import Link from 'next/link';
import { ArrowRight, Search, X } from 'lucide-react';

import { InteractiveLearningShell } from '@/features/interactive/interactive-learning-shell';
import { INTERACTIVE_COURSE_MODULES, PREMIUM_LESSONS } from '@/features/interactive/learning-catalog';

interface InteractiveCoursesPageProps {
  searchParams?: Promise<{ q?: string | string[] }>;
}

function normalizeSearchQuery(value: string | string[] | undefined) {
  const firstValue = Array.isArray(value) ? value[0] : value;
  return firstValue?.trim() ?? '';
}

function moduleMatchesQuery(module: (typeof INTERACTIVE_COURSE_MODULES)[number], query: string) {
  if (!query) return true;
  const haystack = [
    module.title,
    module.description,
    module.chipLabel,
  ].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(query);
}

function courseMatchesQuery(
  lesson: (typeof PREMIUM_LESSONS)[number],
  query: string,
  moduleMatched = false,
) {
  if (!query) return true;
  if (moduleMatched) return true;
  const haystack = [
    lesson.title,
    lesson.description,
    lesson.unitLabel,
    lesson.courseKind,
    lesson.legacySourceLabel,
    lesson.runtimeCardMetadata.statusLabel,
  ].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(query);
}

export default async function InteractiveCoursesPage({ searchParams }: InteractiveCoursesPageProps) {
  const params = await searchParams;
  const searchQuery = normalizeSearchQuery(params?.q);
  const normalizedQuery = searchQuery.toLowerCase();
  const premiumLessons = PREMIUM_LESSONS.filter((lesson) => courseMatchesQuery(lesson, normalizedQuery));
  const modules = INTERACTIVE_COURSE_MODULES
    .map((module) => {
      const moduleMatched = moduleMatchesQuery(module, normalizedQuery);
      return {
        ...module,
        lessons: module.lessons.filter((lesson) => courseMatchesQuery(lesson, normalizedQuery, moduleMatched)),
      };
    })
    .filter((module) => module.lessons.length > 0 || !normalizedQuery);
  const visibleLessonCount = premiumLessons.length + modules.reduce((sum, module) => sum + module.lessons.length, 0);

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
          <form action="/interactive-learning/courses" className="mt-5 flex flex-wrap items-center gap-3">
            <label className="relative min-w-[16rem] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <input
                aria-label="搜索互动课程"
                name="q"
                defaultValue={searchQuery}
                placeholder="搜索课程标题、模块或类型"
                className="h-10 w-full rounded-lg border border-border/70 bg-background pl-10 pr-10 text-sm text-foreground outline-none focus:border-primary"
              />
              {searchQuery ? (
                <Link
                  href="/interactive-learning/courses"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-foreground"
                  aria-label="清除课程搜索"
                >
                  <X className="h-4 w-4" />
                </Link>
              ) : null}
            </label>
            <button type="submit" className="rounded-lg border border-border/70 px-4 py-2 text-sm text-primary hover:border-primary/60">
              搜索
            </button>
            <span className="text-sm text-subtle" aria-live="polite">
              显示 {visibleLessonCount} 个课程入口
            </span>
          </form>
        </header>

        <div className="space-y-8">
          {visibleLessonCount === 0 ? (
            <section className="rounded-lg border border-border/70 p-8 text-center text-subtle">
              没有匹配“{searchQuery}”的互动课程。请清除搜索或换用模块编号、课程标题检索。
            </section>
          ) : null}

          {premiumLessons.length > 0 && (
          <section className="border-b border-border/60 pb-7" data-course-progression-section="premium">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-foreground">精品课程</h2>
                <p className="mt-1 text-sm text-subtle">优先开放完整教师端/学生端链路的精品互动课。</p>
              </div>
              <span className="rounded-full border border-border/70 px-3 py-1 text-xs text-primary">优先推荐</span>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {premiumLessons.map((lesson) => (
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
          )}

          {modules.map((module) => (
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
