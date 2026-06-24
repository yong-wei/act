'use client';

import { useEffect, useMemo } from 'react';

import fixtureManifest from '../../../../artifacts/interactive-learning/visual-stage-runtime-561/visual-stage-fixture.interactive-manifest.json';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { createManifestContentModuleRegistry } from '@/features/interactive/shared/manifest-runtime/content-renderers';
import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';

type ReviewRole = 'student' | 'teacher' | 'guest';
type ReviewTheme = 'light' | 'dark';
type ReviewState =
  | 'student-unreleased'
  | 'student-released'
  | 'student-submitted'
  | 'teacher-reveal'
  | 'teacher-answer-reveal'
  | 'teacher-diagnostics'
  | 'guest-unavailable';

function normalizeRole(value: string): ReviewRole {
  if (value === 'teacher' || value === 'guest') return value;
  return 'student';
}

function normalizeTheme(value: string): ReviewTheme {
  return value === 'dark' ? 'dark' : 'light';
}

function normalizeState(value: string): ReviewState {
  if (
    value === 'student-unreleased'
    || value === 'student-submitted'
    || value === 'teacher-reveal'
    || value === 'teacher-answer-reveal'
    || value === 'teacher-diagnostics'
    || value === 'guest-unavailable'
  ) {
    return value;
  }
  return 'student-released';
}

function releaseStateFor(reviewState: ReviewState) {
  if (reviewState === 'guest-unavailable') return 'unavailable';
  if (reviewState === 'student-unreleased') return 'unreleased';
  if (reviewState === 'teacher-reveal' || reviewState === 'teacher-answer-reveal' || reviewState === 'teacher-diagnostics') {
    return 'revealed';
  }
  return 'released';
}

function activeRevealStateFor(reviewState: ReviewState) {
  if (reviewState === 'teacher-reveal' || reviewState === 'teacher-answer-reveal' || reviewState === 'teacher-diagnostics') {
    return 'answer';
  }
  return 'intro';
}

export function ReviewVisualStageRuntime561({
  role,
  state,
  theme,
}: {
  role: string;
  state: string;
  theme: string;
}) {
  const reviewRole = normalizeRole(role);
  const reviewState = normalizeState(state);
  const reviewTheme = normalizeTheme(theme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', reviewTheme === 'dark');
    document.documentElement.classList.toggle('light', reviewTheme === 'light');
    document.documentElement.style.colorScheme = reviewTheme;
  }, [reviewTheme]);

  const node = useMemo(() => {
    const normalized = normalizeInteractiveRuntimeManifest(fixtureManifest);
    if (!normalized) return null;
    const step = normalized.steps[0];
    const runtimeModuleSource = step?.modules[0];
    if (!step || !runtimeModuleSource) return null;
    const runtimeModule = {
      ...runtimeModuleSource,
      payload: {
        ...runtimeModuleSource.payload,
        releaseState: releaseStateFor(reviewState),
        activeRevealState: activeRevealStateFor(reviewState),
      },
    };
    const runtimeStep = {
      ...step,
      modules: [runtimeModule, ...step.modules.slice(1)],
    };
    const registry = createManifestContentModuleRegistry({
      revealProgress: reviewState === 'student-unreleased' ? 0 : 1,
      allowInlineReveal: reviewState !== 'student-unreleased',
    });
    return registry['visual.stage']({
      manifest: normalized,
      step: runtimeStep,
      module: runtimeModule,
      extra: {
        revealProgress: reviewState === 'student-unreleased' ? 0 : 1,
        allowInlineReveal: reviewState !== 'student-unreleased',
      },
    });
  }, [reviewState]);

  return (
    <ThemeProvider defaultTheme={reviewTheme}>
      <main
        className="min-h-screen overflow-x-hidden bg-[var(--platform-page-bg)] px-4 py-6 text-[var(--platform-text-primary)] md:px-8"
        data-visual-stage-review="issue-561"
        data-review-role={reviewRole}
        data-review-state={reviewState}
        data-review-theme={reviewTheme}
      >
        <div className="mx-auto grid w-full max-w-7xl gap-4">
          <header className="premium-lesson-panel grid gap-2">
            <p className="premium-lesson-caption">视觉舞台验收</p>
            <h1 className="premium-lesson-title text-2xl">根轨迹阅读舞台</h1>
            <p className="premium-lesson-body text-sm">
              同一画布承载对象、公式、标注与活动锚点，用于检查角色、主题、视口和显影状态。
            </p>
          </header>
          {node}
          {reviewState === 'student-submitted' ? (
            <section className="premium-lesson-panel" data-visual-stage-submission-state="submitted">
              <p className="premium-lesson-body text-sm">已记录稳定性观察，活动锚点进入本步骤证据。</p>
            </section>
          ) : null}
          {reviewRole === 'teacher' || reviewState === 'teacher-diagnostics' ? (
            <section className="premium-lesson-panel" data-visual-stage-teacher-diagnostics="visible">
              <h2 className="premium-lesson-title text-lg">教师诊断</h2>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="premium-lesson-card">
                  <p className="premium-lesson-caption">查看人数</p>
                  <p className="premium-lesson-title text-xl">2 / 3</p>
                </div>
                <div className="premium-lesson-card">
                  <p className="premium-lesson-caption">发放状态</p>
                  <p className="premium-lesson-title text-xl">已发放</p>
                </div>
                <div className="premium-lesson-card">
                  <p className="premium-lesson-caption">当前显影</p>
                  <p className="premium-lesson-title text-xl">{activeRevealStateFor(reviewState)}</p>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </ThemeProvider>
  );
}
