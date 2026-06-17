'use client';

import { useEffect, useMemo, useState } from 'react';

import fixtureManifest from '../../../../artifacts/interactive-learning/control-workbench-reuse-560/shared-control-workbench-fixture.interactive-manifest.json';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { createManifestContentModuleRegistry } from '@/features/interactive/shared/manifest-runtime/content-renderers';
import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';

type ReviewRole = 'student' | 'teacher';
type ReviewState = 'unreleased' | 'released' | 'fallback' | 'diagnostics';
type ReviewTheme = 'light' | 'dark';

function normalizeRole(value: string): ReviewRole {
  return value === 'teacher' ? 'teacher' : 'student';
}

function normalizeState(value: string): ReviewState {
  if (value === 'unreleased' || value === 'fallback' || value === 'diagnostics') return value;
  return 'released';
}

function normalizeTheme(value: string): ReviewTheme {
  return value === 'dark' ? 'dark' : 'light';
}

export function ReviewControlWorkbenchReuse560({
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
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);

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
        releaseState: reviewState === 'unreleased' ? 'locked' : 'released',
        fallbackState: reviewState === 'fallback' ? 'fallback' : 'supported',
      },
    };
    const runtimeStep = {
      ...step,
      modules: [runtimeModule, ...step.modules.slice(1)],
    };
    const registry = createManifestContentModuleRegistry({
      revealProgress: reviewState === 'unreleased' ? 0 : 1,
      allowInlineReveal: reviewState !== 'unreleased',
      onPanelSubmit: reviewState === 'unreleased'
        ? undefined
        : (response) => setSubmittedAt(response.submittedAt),
    });

    return registry['compute.panel']({
      manifest: normalized,
      step: runtimeStep,
      module: runtimeModule,
      extra: {
        revealProgress: reviewState === 'unreleased' ? 0 : 1,
        allowInlineReveal: reviewState !== 'unreleased',
      },
    });
  }, [reviewState]);

  return (
    <ThemeProvider>
      <main
        className="min-h-screen bg-[var(--platform-page-bg)] px-4 py-6 text-[var(--platform-text-primary)] md:px-8"
        data-control-workbench-review="issue-560"
        data-review-role={reviewRole}
        data-review-state={reviewState}
        data-review-theme={reviewTheme}
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
          <header className="premium-lesson-panel space-y-2">
            <p className="premium-lesson-caption">Issue 560 acceptance surface</p>
            <h1 className="premium-lesson-title text-2xl">Shared control workbench embedded review</h1>
            <p className="premium-lesson-body text-sm">
              This route reproduces the shared compute panel with the issue fixture and records role, release, fallback, and diagnostics states for visual QA.
            </p>
          </header>
          {node}
          {submittedAt ? (
            <section className="premium-lesson-panel" data-review-submission-state="submitted">
              <p className="premium-lesson-body text-sm">Submission captured at {submittedAt}.</p>
            </section>
          ) : null}
          {reviewRole === 'teacher' || reviewState === 'diagnostics' ? (
            <section className="premium-lesson-panel" data-control-workbench-teacher-diagnostics="visible">
              <h2 className="premium-lesson-title text-lg">Teacher diagnostics</h2>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="premium-lesson-card">
                  <p className="premium-lesson-caption">Exploration coverage</p>
                  <p className="premium-lesson-title text-xl">2 / 3</p>
                </div>
                <div className="premium-lesson-card">
                  <p className="premium-lesson-caption">Submitted judgment</p>
                  <p className="premium-lesson-title text-xl">safe-margin</p>
                </div>
                <div className="premium-lesson-card">
                  <p className="premium-lesson-caption">Fallback state</p>
                  <p className="premium-lesson-title text-xl">{reviewState === 'fallback' ? 'fallback' : 'supported'}</p>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </ThemeProvider>
  );
}
