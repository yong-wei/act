'use client';

import { useEffect, useMemo, useState } from 'react';

import fixtureManifest from '@/lib/qa-evidence/fixtures/structure-diagram-fixture.interactive-manifest.json';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { createManifestContentModuleRegistry } from '@/features/interactive/shared/manifest-runtime/content-renderers';
import {
  buildStructureDiagramTeacherDiagnostics,
  canViewStructureDiagramTeacherDiagnostics,
  type StructureDiagramDiagnosticEvent,
} from '@/features/interactive/shared/manifest-runtime/structure-diagram-evidence';
import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';

type ReviewRole = 'student' | 'teacher' | 'admin' | 'guest';
type ReviewTheme = 'light' | 'dark';
type ReviewState =
  | 'student-unreleased'
  | 'student-released'
  | 'graph-constructed'
  | 'student-constructed'
  | 'student-submitted'
  | 'teacher-reveal'
  | 'teacher-answer-reveal'
  | 'diagnostic-aggregation'
  | 'student-read'
  | 'student-highlight'
  | 'student-construct'
  | 'teacher-paths'
  | 'teacher-loops'
  | 'teacher-diagnostics'
  | 'guest-readonly';
type StructureSubmission = {
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
  if (
    value === 'student-read'
    || value === 'student-unreleased'
    || value === 'student-released'
    || value === 'graph-constructed'
    || value === 'student-constructed'
    || value === 'student-submitted'
    || value === 'teacher-reveal'
    || value === 'teacher-answer-reveal'
    || value === 'diagnostic-aggregation'
    || value === 'student-construct'
    || value === 'teacher-paths'
    || value === 'teacher-loops'
    || value === 'teacher-diagnostics'
    || value === 'guest-readonly'
  ) {
    return value;
  }
  return 'student-highlight';
}

function blockRevealFor(reviewState: ReviewState) {
  if (reviewState === 'student-read' || reviewState === 'student-unreleased' || reviewState === 'guest-readonly') return 'forward-path';
  return 'feedback-loop';
}

function signalRevealFor(reviewState: ReviewState) {
  if (reviewState === 'teacher-loops' || reviewState === 'teacher-diagnostics' || reviewState === 'diagnostic-aggregation') return 'loop-reveal';
  if (reviewState === 'teacher-paths' || reviewState === 'teacher-reveal') return 'path-reveal';
  return 'formula-reveal';
}

function modeFor(reviewState: ReviewState) {
  if (reviewState === 'student-construct' || reviewState === 'student-constructed' || reviewState === 'graph-constructed' || reviewState === 'student-submitted') return 'construct';
  if (reviewState === 'teacher-diagnostics' || reviewState === 'diagnostic-aggregation') return 'diagnose';
  if (reviewState === 'student-read' || reviewState === 'student-unreleased' || reviewState === 'guest-readonly') return 'read';
  return 'highlight';
}

const diagnosticEvents: StructureDiagramDiagnosticEvent[] = [
  {
    actorId: 'student-a',
    actorRole: 'student',
    lessonKey: 'structure-diagram-runtime-fixture',
    stepId: 'step-04',
    moduleId: 'signal-flow-graph',
    graphId: 'closed-loop-signal-flow',
    viewed: true,
    submitted: true,
    activeRevealState: 'path-reveal',
    selectedNodeIds: ['theta'],
    selectedPathIds: ['forward-path-1'],
    selectedLoopIds: [],
    connectionDifferences: [],
    teachingLabels: {
      theta: '中间变量 θ',
      'forward-path-1': '前向路径 P1',
    },
    misconceptionTagIds: [],
    attemptKey: 'student-a:1',
    clientEventId: 'structure-event-a',
    serverRecordedAt: '2026-06-18T00:00:01.000Z',
  },
  {
    actorId: 'student-b',
    actorRole: 'student',
    lessonKey: 'structure-diagram-runtime-fixture',
    stepId: 'step-04',
    moduleId: 'signal-flow-graph',
    graphId: 'closed-loop-signal-flow',
    viewed: true,
    submitted: true,
    activeRevealState: 'loop-reveal',
    selectedNodeIds: ['theta'],
    selectedPathIds: ['forward-path-1'],
    selectedLoopIds: ['feedback-loop-1'],
    connectionDifferences: [
      { kind: 'missing', from: 'output-branch', to: 'sensor', label: '漏连反馈支路' },
    ],
    teachingLabels: {
      theta: '中间变量 θ',
      'forward-path-1': '前向路径 P1',
      'feedback-loop-1': '反馈环路 L1',
    },
    misconceptionTagIds: ['missed-feedback-branch'],
    attemptKey: 'student-b:1',
    clientEventId: 'structure-event-b',
    serverRecordedAt: '2026-06-18T00:00:02.000Z',
  },
  {
    actorId: 'student-c',
    actorRole: 'student',
    lessonKey: 'structure-diagram-runtime-fixture',
    stepId: 'step-04',
    moduleId: 'signal-flow-graph',
    graphId: 'closed-loop-signal-flow',
    viewed: true,
    submitted: false,
    activeRevealState: 'formula-reveal',
    selectedNodeIds: ['output'],
    selectedPathIds: [],
    selectedLoopIds: ['feedback-loop-1'],
    connectionDifferences: [
      { kind: 'wrongGain', from: 'output', to: 'theta', label: '反馈增益符号错误' },
    ],
    teachingLabels: {
      output: '输出量 Y',
      'feedback-loop-1': '反馈环路 L1',
    },
    misconceptionTagIds: ['wrong-feedback-sign'],
    attemptKey: 'student-c:1',
    clientEventId: 'structure-event-c',
    serverRecordedAt: '2026-06-18T00:00:03.000Z',
  },
];

export function ReviewStructureDiagramRuntime563({
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
  const [lastSubmission, setLastSubmission] = useState<StructureSubmission | null>(null);
  const canViewTeacherDiagnostics = canViewStructureDiagramTeacherDiagnostics(reviewRole);
  const canSubmitEvidence = reviewRole !== 'guest';
  const diagnostics = useMemo(() => (
    buildStructureDiagramTeacherDiagnostics(diagnosticEvents, ['path-reveal', 'loop-reveal', 'formula-reveal'])
  ), []);

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
    });
    return step.modules
      .filter((runtimeModule) => runtimeModule.kind === 'visual.blockDiagram' || runtimeModule.kind === 'visual.signalFlowGraph')
      .map((runtimeModule) => {
        const isBlockDiagram = runtimeModule.kind === 'visual.blockDiagram';
        const moduleWithState = {
          ...runtimeModule,
          payload: {
            ...runtimeModule.payload,
            mode: modeFor(reviewState),
            activeRevealState: isBlockDiagram ? blockRevealFor(reviewState) : signalRevealFor(reviewState),
          },
        };
        return registry[runtimeModule.kind]({
          manifest: normalized,
          step: { ...step, modules: step.modules.map((item) => (item.id === runtimeModule.id ? moduleWithState : item)) },
          module: moduleWithState,
          extra: { revealProgress: 1, allowInlineReveal: true },
        });
      });
  }, [canSubmitEvidence, reviewState, setLastSubmission]);

  return (
    <ThemeProvider defaultTheme={reviewTheme}>
      <main
        className="min-h-screen overflow-x-hidden bg-[var(--platform-page-bg)] px-4 py-6 text-[var(--platform-text-primary)] md:px-8"
        data-structure-diagram-review="issue-563"
        data-review-role={reviewRole}
        data-review-state={reviewState}
        data-review-theme={reviewTheme}
      >
        <div className="mx-auto grid w-full max-w-7xl gap-4">
          <header className="premium-lesson-panel grid gap-2">
            <p className="premium-lesson-caption">结构图验收</p>
            <h1 className="premium-lesson-title text-2xl">控制结构与信号流映射</h1>
            <p className="premium-lesson-body text-sm">
              同一 manifest runtime 渲染方框图与信号流图，检查节点、支路、回路、Mason 公式和教师诊断证据。
            </p>
          </header>
          <section className="grid gap-4 xl:grid-cols-2" data-structure-diagram-module-pair="visible">
            {nodes.map((node, index) => (
              <div key={index}>{node}</div>
            ))}
          </section>
          {reviewState === 'student-construct' || reviewState === 'student-constructed' || reviewState === 'graph-constructed' || reviewState === 'student-submitted' ? (
            <section className="premium-lesson-panel" data-structure-diagram-construct-state="submitted">
              <p className="premium-lesson-body text-sm">学生已提交构图状态，连接差异保留为结构化证据。</p>
            </section>
          ) : null}
          {lastSubmission ? (
            <section className="premium-lesson-panel" data-structure-diagram-last-submission="visible">
              <p className="premium-lesson-caption">最近提交</p>
              <p className="premium-lesson-body text-sm">
                {lastSubmission.stepId} · {Object.keys(lastSubmission.answers).join(', ')}
              </p>
            </section>
          ) : null}
          {reviewState === 'teacher-answer-reveal' ? (
            <section className="premium-lesson-panel" data-structure-diagram-answer-reveal="visible">
              <h2 className="premium-lesson-title text-lg">参考结构</h2>
              <p className="premium-lesson-body text-sm leading-6">
                Mason 公式中的前向路径和反馈回路必须能回到图中对应支路。
              </p>
            </section>
          ) : null}
          {canViewTeacherDiagnostics && (reviewState === 'teacher-diagnostics' || reviewState === 'diagnostic-aggregation' || reviewRole === 'teacher') ? (
            <section className="premium-lesson-panel" data-structure-diagram-teacher-diagnostics="visible">
              <h2 className="premium-lesson-title text-lg">教师诊断</h2>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="premium-lesson-card">
                  <p className="premium-lesson-caption">查看人数</p>
                  <p className="premium-lesson-title text-xl">{diagnostics.viewedCount} / 3</p>
                </div>
                <div className="premium-lesson-card">
                  <p className="premium-lesson-caption">当前回路</p>
                  <p className="premium-lesson-title text-xl">{diagnostics.selectedLoopDistribution[0]?.label ?? signalRevealFor(reviewState)}</p>
                </div>
                <div className="premium-lesson-card">
                  <p className="premium-lesson-caption">常见误差</p>
                  <p className="premium-lesson-title text-xl">{diagnostics.connectionDifferenceDistribution[0]?.label ?? '暂无'}</p>
                </div>
                <div className="premium-lesson-card">
                  <p className="premium-lesson-caption">提交人数</p>
                  <p className="premium-lesson-title text-xl">{diagnostics.submittedCount} / 3</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-4">
                <div className="premium-lesson-card" data-structure-diagram-diagnostic-nodes="visible">
                  <p className="premium-lesson-caption">节点选择</p>
                  {diagnostics.selectedNodeDistribution.map((item) => (
                    <p key={item.nodeId} className="premium-lesson-body text-sm">{item.label} · {item.count}</p>
                  ))}
                </div>
                <div className="premium-lesson-card" data-structure-diagram-diagnostic-paths="visible">
                  <p className="premium-lesson-caption">路径选择</p>
                  {diagnostics.selectedPathDistribution.map((item) => (
                    <p key={item.pathId} className="premium-lesson-body text-sm">{item.label} · {item.count}</p>
                  ))}
                </div>
                <div className="premium-lesson-card" data-structure-diagram-diagnostic-loops="visible">
                  <p className="premium-lesson-caption">回路选择</p>
                  {diagnostics.selectedLoopDistribution.map((item) => (
                    <p key={item.loopId} className="premium-lesson-body text-sm">{item.label} · {item.count}</p>
                  ))}
                </div>
                <div className="premium-lesson-card" data-structure-diagram-diagnostic-differences="visible">
                  <p className="premium-lesson-caption">构图差异</p>
                  {diagnostics.connectionDifferenceDistribution.map((item) => (
                    <p key={`${item.kind}:${item.label}`} className="premium-lesson-body text-sm">{item.label} · {item.count}</p>
                  ))}
                </div>
              </div>
            </section>
          ) : null}
          {!canViewTeacherDiagnostics && (reviewState === 'teacher-diagnostics' || reviewState === 'diagnostic-aggregation') ? (
            <section className="premium-lesson-panel" data-structure-diagram-diagnostics-access="teacher-only">
              <p className="premium-lesson-body text-sm">诊断聚合仅对教师角色开放。</p>
            </section>
          ) : null}
        </div>
      </main>
    </ThemeProvider>
  );
}
