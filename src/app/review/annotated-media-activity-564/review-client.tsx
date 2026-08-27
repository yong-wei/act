'use client';

import { useEffect, useMemo, useState } from 'react';

import fixtureManifest from '@/lib/qa-evidence/fixtures/annotated-media-fixture.interactive-manifest.json';
import { ThemeProvider } from '@/components/providers/theme-provider';
import {
  buildAnnotatedMediaTeacherDiagnostics,
  canViewAnnotatedMediaTeacherDiagnostics,
  type AnnotatedMediaDiagnosticEvent,
} from '@/features/interactive/shared/manifest-runtime/annotated-media-evidence';
import { createManifestContentModuleRegistry } from '@/features/interactive/shared/manifest-runtime/content-renderers';
import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';

type ReviewRole = 'student' | 'teacher' | 'admin' | 'guest';
type ReviewTheme = 'light' | 'dark';
type ReviewState =
  | 'student-unreleased'
  | 'student-released'
  | 'hotspot-selected'
  | 'student-submitted'
  | 'teacher-reveal'
  | 'teacher-answer-reveal'
  | 'teacher-diagnostics'
  | 'guest-readonly';
type ReviewSubmission = {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
};

function normalizeRole(value: string): ReviewRole {
  if (value === 'teacher' || value === 'admin' || value === 'guest') return value;
  return 'student';
}

function normalizeTheme(value: string): ReviewTheme {
  return value === 'dark' ? 'dark' : 'light';
}

function normalizeState(value: string): ReviewState {
  if (value === 'selected-hotspot') return 'hotspot-selected';
  if (
    value === 'student-unreleased'
    || value === 'student-released'
    || value === 'hotspot-selected'
    || value === 'student-submitted'
    || value === 'teacher-reveal'
    || value === 'teacher-answer-reveal'
    || value === 'teacher-diagnostics'
    || value === 'guest-readonly'
  ) return value;
  return 'student-released';
}

function revealFor(reviewState: ReviewState) {
  if (reviewState === 'student-unreleased' || reviewState === 'guest-readonly') return 'evidence-reveal';
  if (reviewState === 'teacher-answer-reveal') return 'answer-reveal';
  return 'diagnostic-reveal';
}

function initialSelectedAnnotationIdsFor(reviewState: ReviewState) {
  if (reviewState === 'hotspot-selected' || reviewState === 'student-submitted') return ['input-hotspot', 'output-hotspot'];
  return [];
}

const diagnosticEvents: AnnotatedMediaDiagnosticEvent[] = [
  {
    actorId: 'student-a',
    actorRole: 'student',
    lessonKey: 'annotated-media-activity-fixture',
    stepId: 'step-05',
    moduleId: 'annotated-media',
    mediaId: 'closed-loop-media',
    viewed: true,
    submitted: true,
    activeRevealState: 'evidence-reveal',
    selectedAnnotationIds: ['input-hotspot', 'output-hotspot'],
    omittedRequiredAnnotationIds: ['risk-hotspot'],
    evidenceRoles: { 'input-hotspot': 'input', 'output-hotspot': 'output' },
    teachingLabels: {
      'input-hotspot': '输入信号',
      'output-hotspot': '输出响应',
      'risk-hotspot': '反馈风险',
    },
    misconceptionTagIds: ['missed-risk-hotspot'],
    attemptKey: 'student-a:1',
    clientEventId: 'annotated-media-event-a',
    serverRecordedAt: '2026-06-18T01:00:01.000Z',
  },
  {
    actorId: 'student-b',
    actorRole: 'student',
    lessonKey: 'annotated-media-activity-fixture',
    stepId: 'step-05',
    moduleId: 'annotated-media',
    mediaId: 'closed-loop-media',
    viewed: true,
    submitted: true,
    activeRevealState: 'diagnostic-reveal',
    selectedAnnotationIds: ['output-hotspot', 'risk-hotspot'],
    omittedRequiredAnnotationIds: ['input-hotspot'],
    evidenceRoles: { 'output-hotspot': 'output', 'risk-hotspot': 'risk' },
    teachingLabels: {
      'input-hotspot': '输入信号',
      'output-hotspot': '输出响应',
      'risk-hotspot': '反馈风险',
    },
    misconceptionTagIds: ['missed-input-hotspot'],
    attemptKey: 'student-b:1',
    clientEventId: 'annotated-media-event-b',
    serverRecordedAt: '2026-06-18T01:00:02.000Z',
  },
];

export function ReviewAnnotatedMediaActivity564({
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
  const canSubmitEvidence = reviewRole === 'student' && (
    reviewState === 'student-released'
    || reviewState === 'hotspot-selected'
    || reviewState === 'student-submitted'
  );
  const canViewDiagnostics = canViewAnnotatedMediaTeacherDiagnostics(reviewRole);
  const [lastSubmission, setLastSubmission] = useState<ReviewSubmission | null>(null);
  const diagnostics = useMemo(() => buildAnnotatedMediaTeacherDiagnostics(diagnosticEvents), []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', reviewTheme === 'dark');
    document.documentElement.classList.toggle('light', reviewTheme === 'light');
    document.documentElement.style.colorScheme = reviewTheme;
  }, [reviewTheme]);

  const nodes = useMemo(() => {
    const normalized = normalizeInteractiveRuntimeManifest(fixtureManifest);
    if (!normalized) return [];
    const step = normalized.steps[0];
    if (!step) return [];
    const registry = createManifestContentModuleRegistry({
      revealProgress: 1,
      allowInlineReveal: true,
      onPanelSubmit: canSubmitEvidence ? setLastSubmission : undefined,
      interactionMode: canSubmitEvidence ? 'active' : 'readonly',
    });
    return step.modules
      .filter((runtimeModule) => runtimeModule.kind === 'visual.annotatedMedia' || runtimeModule.kind === 'visual.embedded-activity')
      .map((runtimeModule) => {
        const moduleWithState = runtimeModule.kind === 'visual.annotatedMedia'
          ? {
            ...runtimeModule,
            payload: {
              ...runtimeModule.payload,
              activeRevealState: revealFor(reviewState),
              initialSelectedAnnotationIds: initialSelectedAnnotationIdsFor(reviewState),
            },
          }
          : runtimeModule;
        return registry[runtimeModule.kind]({
          manifest: normalized,
          step: { ...step, modules: step.modules.map((item) => (item.id === runtimeModule.id ? moduleWithState : item)) },
          module: moduleWithState,
          extra: { revealProgress: 1, allowInlineReveal: true, onPanelSubmit: canSubmitEvidence ? setLastSubmission : undefined },
        });
      });
  }, [canSubmitEvidence, reviewState]);

  return (
    <ThemeProvider defaultTheme={reviewTheme}>
      <main
        className="min-h-screen overflow-x-hidden bg-[var(--platform-page-bg)] px-4 py-6 text-[var(--platform-text-primary)] md:px-8"
        data-annotated-media-review="issue-564"
        data-review-role={reviewRole}
        data-review-state={reviewState}
        data-review-theme={reviewTheme}
      >
        <div className="mx-auto grid w-full max-w-7xl gap-4">
          <header className="premium-lesson-panel grid gap-2">
            <p className="premium-lesson-caption">注释媒体验收</p>
            <h1 className="premium-lesson-title text-2xl">图上证据与嵌入式任务</h1>
            <p className="premium-lesson-body text-sm">同一 manifest runtime 渲染媒体热点和图上活动，检查选择、提交、诊断和只读状态。</p>
          </header>
          <section className="grid gap-4 xl:grid-cols-2" data-annotated-media-module-pair="visible">
            {nodes.map((node, index) => (
              <div key={index}>{node}</div>
            ))}
          </section>
          {lastSubmission ? (
            <section className="premium-lesson-panel" data-annotated-media-last-submission="visible">
              <p className="premium-lesson-caption">最近提交</p>
              <p className="premium-lesson-body text-sm">{lastSubmission.stepId} · {Object.keys(lastSubmission.answers).join(', ')}</p>
            </section>
          ) : null}
          {canViewDiagnostics && reviewState === 'teacher-diagnostics' ? (
            <section className="premium-lesson-panel" data-annotated-media-teacher-diagnostics="visible">
              <h2 className="premium-lesson-title text-lg">教师诊断</h2>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="premium-lesson-card">
                  <p className="premium-lesson-caption">提交人数</p>
                  <p className="premium-lesson-title text-xl">{diagnostics.submittedCount} / 2</p>
                </div>
                <div className="premium-lesson-card" data-annotated-media-diagnostic-selected="visible">
                  <p className="premium-lesson-caption">高频热点</p>
                  {diagnostics.selectedAnnotationDistribution.map((item) => (
                    <p key={item.annotationId} className="premium-lesson-body text-sm">{item.label} · {item.count}</p>
                  ))}
                </div>
                <div className="premium-lesson-card" data-annotated-media-diagnostic-omitted="visible">
                  <p className="premium-lesson-caption">遗漏热点</p>
                  {diagnostics.omittedRequiredAnnotationDistribution.map((item) => (
                    <p key={item.annotationId} className="premium-lesson-body text-sm">{item.label} · {item.count}</p>
                  ))}
                </div>
                <div className="premium-lesson-card" data-annotated-media-diagnostic-roles="visible">
                  <p className="premium-lesson-caption">证据角色</p>
                  {diagnostics.evidenceRoleConfusionDistribution.map((item) => (
                    <p key={item.evidenceRole} className="premium-lesson-body text-sm">{item.label} · {item.count}</p>
                  ))}
                </div>
              </div>
            </section>
          ) : null}
          {!canViewDiagnostics && reviewState === 'teacher-diagnostics' ? (
            <section className="premium-lesson-panel" data-annotated-media-diagnostics-access="teacher-only">
              <p className="premium-lesson-body text-sm">诊断聚合仅对教师角色开放。</p>
            </section>
          ) : null}
        </div>
      </main>
    </ThemeProvider>
  );
}
