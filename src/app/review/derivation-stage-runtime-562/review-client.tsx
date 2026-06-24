'use client';

import { useEffect, useMemo } from 'react';

import fixtureManifest from '../../../../artifacts/interactive-learning/derivation-stage-runtime-562/derivation-stage-fixture.interactive-manifest.json';
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

function activeRevealStepFor(reviewState: ReviewState) {
  if (reviewState === 'student-released') return 'step-upper-right';
  if (reviewState === 'teacher-reveal' || reviewState === 'teacher-answer-reveal' || reviewState === 'teacher-diagnostics') {
    return 'step-middle-block';
  }
  return 'step-lower-left';
}

export function ReviewDerivationStageRuntime562({
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
        activeRevealStepId: activeRevealStepFor(reviewState),
        answerVisible: reviewState === 'teacher-answer-reveal',
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
    return registry['visual.derivationStage']({
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
        data-derivation-stage-review="issue-562"
        data-review-role={reviewRole}
        data-review-state={reviewState}
        data-review-theme={reviewTheme}
      >
        <div className="mx-auto grid w-full max-w-7xl gap-4">
          <header className="premium-lesson-panel grid gap-2">
            <p className="premium-lesson-caption">推导舞台验收</p>
            <h1 className="premium-lesson-title text-2xl">闭环表达非线性显影</h1>
            <p className="premium-lesson-body text-sm">
              同一二维舞台承载公式、公式块、说明和关联线，用于检查 LaTeX 渲染、显影跳转、学生状态和教师诊断。
            </p>
          </header>
          {node}
          {reviewState === 'student-submitted' ? (
            <section className="premium-lesson-panel" data-derivation-stage-submission-state="submitted">
              <p className="premium-lesson-body text-sm">已按当前显影步骤提交判断，答案保留公式块上下文。</p>
            </section>
          ) : null}
          {reviewState === 'teacher-answer-reveal' ? (
            <section className="premium-lesson-panel" data-derivation-stage-answer-reveal="visible">
              <h2 className="premium-lesson-title text-lg">参考解释</h2>
              <p className="premium-lesson-body text-sm leading-6">
                关键不是背诵分式，而是把分母项与闭环极点条件对应起来。
              </p>
            </section>
          ) : null}
          {reviewRole === 'teacher' || reviewState === 'teacher-diagnostics' ? (
            <section className="premium-lesson-panel" data-derivation-stage-teacher-diagnostics="visible">
              <h2 className="premium-lesson-title text-lg">教师诊断</h2>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="premium-lesson-card">
                  <p className="premium-lesson-caption">查看人数</p>
                  <p className="premium-lesson-title text-xl">2 / 3</p>
                </div>
                <div className="premium-lesson-card">
                  <p className="premium-lesson-caption">当前显影</p>
                  <p className="premium-lesson-title text-xl">{activeRevealStepFor(reviewState)}</p>
                </div>
                <div className="premium-lesson-card">
                  <p className="premium-lesson-caption">公式块关注</p>
                  <p className="premium-lesson-title text-xl">cancel-term</p>
                </div>
                <div className="premium-lesson-card">
                  <p className="premium-lesson-caption">提交人数</p>
                  <p className="premium-lesson-title text-xl">1 / 3</p>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </ThemeProvider>
  );
}
