'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Loader2, PanelRightClose, Route } from 'lucide-react';

import { AppShell, PlatformSurface, type AppBreadcrumbItem } from '@/components/platform/app-shell';
import { resolveAdaptivePathLaunchReturnContext } from '@/features/adaptive/adaptive-learning-center-contracts';
import { formatLessonStepMenuLabel } from '@/features/interactive/shared/course-step-labels';

export type LessonRuntimeMode = 'student' | 'guest' | 'teacher' | 'invalid';

export interface LessonRuntimeStep {
  id: string;
  title: string;
  stage: string;
  duration?: string;
  hint?: string;
}

export interface LessonRuntimeShellProps {
  mode: LessonRuntimeMode;
  title: string;
  subtitle?: string;
  routeSegment: string;
  sessionId?: string;
  steps: readonly LessonRuntimeStep[];
  activeIndex: number;
  onIndexChange?: (index: number) => void;
  stageLabel?: Record<string, string>;
  notice?: ReactNode;
  topActions?: ReactNode;
  localTools?: ReactNode;
  toolsDefaultState?: 'collapsed' | 'expanded';
  statusSlot?: ReactNode;
  children?: ReactNode;
  invalidTitle?: string;
  invalidDescription?: string;
  runtimeAttributes?: Record<string, string | undefined>;
}

function getRuntimeHref(routeSegment: string, mode: LessonRuntimeMode, sessionId?: string) {
  if (mode === 'teacher') return `/interactive-learning/courses/${routeSegment}/teacher/${sessionId ?? 'session'}`;
  if (mode === 'student') return `/interactive-learning/courses/${routeSegment}/student/${sessionId ?? 'session'}`;
  return `/interactive-learning/courses/${routeSegment}`;
}

function getViewerRole(mode: LessonRuntimeMode) {
  return mode === 'teacher' ? 'teacher' : 'student';
}

function getModeLabel(mode: LessonRuntimeMode) {
  if (mode === 'teacher') return '教师投影';
  if (mode === 'guest') return '访客演示';
  if (mode === 'invalid') return '课堂不可用';
  return '学生课堂';
}

export function LessonRuntimeShell({
  mode,
  title,
  subtitle,
  routeSegment,
  sessionId,
  steps,
  activeIndex,
  onIndexChange,
  stageLabel,
  notice,
  topActions,
  localTools,
  toolsDefaultState = 'collapsed',
  statusSlot,
  children,
  invalidTitle = '课堂暂不可用',
  invalidDescription = '请返回课程入口重新加入课堂，或联系教师确认课堂状态。',
  runtimeAttributes,
}: LessonRuntimeShellProps) {
  const searchParams = useSearchParams();
  const pathLaunchContext = resolveAdaptivePathLaunchReturnContext(searchParams);
  const [toolsOpen, setToolsOpen] = useState(toolsDefaultState === 'expanded');
  const hasSteps = steps.length > 0;
  const safeActiveIndex = hasSteps ? Math.min(Math.max(activeIndex, 0), steps.length - 1) : 0;
  const currentStep = steps[safeActiveIndex];
  const activeHref = getRuntimeHref(routeSegment, mode, sessionId);
  const courseHref = `/interactive-learning/courses/${routeSegment}`;
  const runtimeReturnHref = pathLaunchContext?.returnHref ?? courseHref;
  const runtimeReturnLabel = pathLaunchContext ? '返回学习路径' : '返回课程入口';
  const breadcrumbs: readonly AppBreadcrumbItem[] = pathLaunchContext
    ? [
        { label: '学习', href: '/dashboard' },
        { label: '互动学习', href: '/interactive-learning' },
        { label: runtimeReturnLabel, href: runtimeReturnHref },
        { label: title },
        { label: getModeLabel(mode) },
      ]
    : [
        { label: '学习', href: '/dashboard' },
        { label: '互动学习', href: '/interactive-learning' },
        { label: '互动课程', href: '/interactive-learning/courses' },
        { label: title, href: courseHref },
        { label: getModeLabel(mode) },
      ];
  const canGoPrevious = hasSteps && safeActiveIndex > 0;
  const canGoNext = hasSteps && safeActiveIndex < steps.length - 1;
  const currentStageLabel = currentStep ? stageLabel?.[currentStep.stage] ?? currentStep.stage : '未开始';

  return (
    <AppShell
      viewerRole={getViewerRole(mode)}
      title={title}
      subtitle={subtitle}
      breadcrumbs={breadcrumbs}
      activeHref={activeHref}
      sidebarMode="collapsible"
      routeMetadata={{
        frame: 'mission-workspace',
        themeSupport: ['light', 'dark'],
        mobileNavigation: 'workspace-command-surface',
        desktopNavigation: 'collapsible',
        navigationLayers: ['global-product', 'contextual-workspace', 'local-tool'],
        floatingDock: 'collapsed',
        contextualReturn: {
          sourceContext: pathLaunchContext ? 'adaptive-learning' : 'interactive-learning',
          targetHint: pathLaunchContext
            ? 'Return to the adaptive path execution workspace from the lesson runtime.'
            : 'Return to the course entry page from the lesson runtime.',
          fallbackHref: runtimeReturnHref,
        },
      }}
      actions={topActions}
      className="surface-page"
    >
      <section
        className="grid min-h-[calc(100vh-8rem)] min-w-0 grid-cols-[minmax(0,1fr)] gap-4 pb-24"
        data-lesson-runtime-shell="unified"
        data-lesson-runtime-mode={mode}
        data-commercial-workspace="interactive-learning"
        data-task-workspace-archetype="lesson-runtime"
        {...runtimeAttributes}
      >
        {mode === 'invalid' ? (
          <PlatformSurface
            className="flex min-h-[52vh] w-full flex-col items-center justify-center px-6 py-12 text-center"
            data-lesson-runtime-invalid-session
          >
            <BookOpen className="h-10 w-10 text-platform-action-primary" />
            <h1 className="mt-5 text-2xl font-semibold text-platform-fg-primary">{invalidTitle}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-platform-fg-secondary">{invalidDescription}</p>
            <Link
              href={runtimeReturnHref}
              className="mt-6 inline-flex h-10 items-center rounded-md bg-platform-action-primary px-4 text-sm font-medium text-platform-action-primary-fg"
            >
              {runtimeReturnLabel}
            </Link>
          </PlatformSurface>
        ) : (
          <>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,280px)]">
              <div className="min-w-0 space-y-4" data-lesson-runtime-primary-column>
                <PlatformSurface className="px-4 py-3" variant="muted" data-lesson-runtime-context-strip>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-medium uppercase text-platform-fg-tertiary">{getModeLabel(mode)}</div>
                      <div className="mt-1 truncate text-base font-semibold text-platform-fg-primary">
                        {currentStep?.title ?? title}
                      </div>
                      {notice || currentStep?.hint ? (
                        <div className="mt-1 text-sm text-platform-fg-secondary">{notice ?? currentStep?.hint}</div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-platform-fg-secondary">
                      <span className="rounded-full border border-platform-border px-2.5 py-1">{currentStageLabel}</span>
                      {hasSteps ? (
                        <span className="rounded-full border border-platform-border px-2.5 py-1">
                          {safeActiveIndex + 1} / {steps.length}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </PlatformSurface>

                {statusSlot}

                <div className="min-w-0" data-lesson-runtime-content>
                  {children}
                </div>
              </div>

              <aside className="min-w-0" data-lesson-runtime-local-tools={toolsDefaultState}>
                <details
                  className="group rounded-lg border border-platform-border bg-platform-surface/80 p-3"
                  open={toolsOpen}
                  onToggle={(event) => setToolsOpen(event.currentTarget.open)}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-platform-fg-primary">
                    <span className="inline-flex items-center gap-2">
                      <PanelRightClose className="h-4 w-4" />
                      本页工具
                    </span>
                    <span className="text-xs text-platform-fg-tertiary">默认折叠</span>
                  </summary>
                  <div className="mt-3 space-y-3 text-sm text-platform-fg-secondary">
                    {localTools ?? <span>本页暂无额外工具。</span>}
                  </div>
                </details>
              </aside>
            </div>

            {hasSteps ? (
              <nav
                className="relative z-10 mt-4 flex w-full items-center justify-between gap-2 rounded-lg border border-platform-border bg-platform-surface/95 px-3 py-2 shadow-lg backdrop-blur"
                data-lesson-runtime-bottom-navigation
              >
                <button
                  type="button"
                  disabled={!canGoPrevious || !onIndexChange}
                  onClick={() => onIndexChange?.(Math.max(0, safeActiveIndex - 1))}
                  className="inline-flex h-9 items-center gap-1 rounded-md border border-platform-border px-3 text-sm text-platform-fg-primary disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  上一页
                </button>
                <label className="flex min-w-0 flex-1 items-center justify-center gap-2 text-xs text-platform-fg-secondary">
                  <Route className="h-4 w-4" />
                  <span className="hidden sm:inline">{currentStageLabel}</span>
                  <select
                    aria-label="跳转课程页"
                    value={currentStep?.id ?? ''}
                    disabled={!onIndexChange}
                    onChange={(event) => {
                      const nextIndex = steps.findIndex((step) => step.id === event.target.value);
                      if (nextIndex >= 0) onIndexChange?.(nextIndex);
                    }}
                    className="min-w-0 max-w-[12rem] rounded-md border border-platform-border bg-platform-surface px-2 py-1.5 text-sm text-platform-fg-primary"
                    data-lesson-runtime-page-jump
                  >
                    {steps.map((step, index) => (
                      <option key={step.id} value={step.id}>
                        {formatLessonStepMenuLabel(index, steps.length, step.title)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={!canGoNext || !onIndexChange}
                  onClick={() => onIndexChange?.(Math.min(steps.length - 1, safeActiveIndex + 1))}
                  className="inline-flex h-9 items-center gap-1 rounded-md bg-platform-action-primary px-3 text-sm font-medium text-platform-action-primary-fg disabled:opacity-40"
                >
                  下一页
                  <ChevronRight className="h-4 w-4" />
                </button>
              </nav>
            ) : null}
          </>
        )}
      </section>
    </AppShell>
  );
}

export function LessonRuntimeLoadingShell({
  title,
  subtitle,
  routeSegment,
  mode,
}: Pick<LessonRuntimeShellProps, 'title' | 'subtitle' | 'routeSegment' | 'mode'>) {
  return (
    <LessonRuntimeShell
      mode={mode}
      title={title}
      subtitle={subtitle}
      routeSegment={routeSegment}
      steps={[]}
      activeIndex={0}
      statusSlot={
        <PlatformSurface className="flex min-h-[52vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-platform-action-primary" />
        </PlatformSurface>
      }
    />
  );
}
