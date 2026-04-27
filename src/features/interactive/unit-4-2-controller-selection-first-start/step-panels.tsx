'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

import {
  createManifestStudentActivityRegistry,
  createManifestTeacherActivityRegistry,
  renderStudentInteractiveActivity,
  renderTeacherInteractiveActivity,
  type StudentInteractiveActivityRegistry,
  type TeacherInteractiveActivityRegistry,
} from '@/features/interactive/shared/manifest-runtime/activity-renderers';
import {
  createManifestContentModuleRegistry,
} from '@/features/interactive/shared/manifest-runtime/content-renderers';
import {
  renderInteractiveManifestStep,
  type InteractiveModuleRegistry,
} from '@/features/interactive/shared/manifest-runtime/layout-renderer';
import { SubmissionStatus } from '@/features/interactive/shared/submission-status';
import type {
  InteractiveRuntimeManifest,
  InteractiveRuntimeModuleManifest,
  InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';
import {
  type UNIT_4_2StepDefinition,
  type UNIT_4_2StepResponse,
} from '@/lib/unit-4-2-course';
import { getUnit42FallbackResult } from '@/resources/control-system/analysis/unit-4-2-fixtures';
import { buildUnit42AnalysisRequest } from '@/resources/control-system/analysis/unit-4-2-request-builder';
import { useControlEngine } from '@/resources/control-system/analysis/use-control-engine';
import { ControlFigureWorkspace } from '@/resources/control-system/charts/control-figure-workspace';
import type { WorkspaceParameterChange } from './workspace';

type TeacherResponseItem = {
  studentName: string;
  response: UNIT_4_2StepResponse;
};

type Unit42ManifestExtra = {
  revealProgress: number;
  allowInlineReveal: boolean;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
};

type NativeCasePanelId = 'ship' | 'platform';

const CASE_PANEL_CONFIG = {
  ship: {
    requestCaseId: 'ship' as const,
    layout: 'quad' as const,
    sliderKey: 'K_h',
    baseline: 2.25,
    min: 1.2,
    max: 4.4,
    step: 0.05,
    label: '客船航向保持共享增益',
    summaryTitle: '客船原生统一面板',
  },
  platform: {
    requestCaseId: 'platform' as const,
    layout: 'platform' as const,
    sliderKey: 'K_p',
    baseline: 5,
    min: 2,
    max: 10,
    step: 0.1,
    label: '稳定平台共享增益',
    summaryTitle: '平台原生统一面板',
  },
} as const;

const UNIT_4_2_SHARED_STUDENT_ACTIVITY_REGISTRY = createManifestStudentActivityRegistry<UNIT_4_2StepDefinition>() as unknown as StudentInteractiveActivityRegistry<
  UNIT_4_2StepDefinition,
  UNIT_4_2StepResponse
>;

const UNIT_4_2_SHARED_TEACHER_ACTIVITY_REGISTRY = createManifestTeacherActivityRegistry<UNIT_4_2StepDefinition>() as unknown as TeacherInteractiveActivityRegistry<
  UNIT_4_2StepDefinition,
  TeacherResponseItem
>;

function fallbackManifestStep(step: UNIT_4_2StepDefinition): InteractiveRuntimeStepManifest {
  return {
    id: step.id,
    title: step.title,
    layout: { template: 'stacked_regions', regions: [{ id: 'content', width: 'full', order: 1 }] },
    modules: [],
    contentBlocks: {},
    evidenceSequence: [],
    interactionSpec: { interactionKind: step.pageType === 'display' ? 'none' : step.pageType },
    teacherControls: {
      releaseActivity: 'not_applicable',
      openBrowse: 'not_applicable',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'not_applicable',
    },
    studentAccess: {},
    teacherInsightSpec: { widgets: [] },
    telemetrySpec: { summaryFields: [], misconceptionTags: [] },
    aiContextSpec: { pageGoal: step.hint, deliveryMode: 'hidden_page_context' },
    interactiveFigureSpec: {},
    previewContract: { demoPath: '' },
    acceptanceChecks: [],
  };
}

function getManifestStep(
  manifest: InteractiveRuntimeManifest | null | undefined,
  step: UNIT_4_2StepDefinition,
) {
  return manifest?.steps.find((item) => item.id === step.id) ?? fallbackManifestStep(step);
}

function panelIdFromModule(module: InteractiveRuntimeModuleManifest): NativeCasePanelId | null {
  return module.payload.panel_id === 'ship' || module.payload.panel_id === 'platform'
    ? module.payload.panel_id
    : null;
}

function formatMetric(value: number | null | undefined, digits = 2, suffix = '') {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return `${value.toFixed(digits)}${suffix}`;
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="premium-lesson-surface-elevated rounded-2xl px-3 py-3 text-sm">
      <div className="premium-lesson-kicker">{label}</div>
      <div className="premium-lesson-title mt-1 text-base font-semibold">{value}</div>
    </div>
  );
}

function CaseNativeWorkspace({
  panelId,
  onWorkspaceParameterChange,
}: {
  panelId: NativeCasePanelId;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const config = CASE_PANEL_CONFIG[panelId];
  const [value, setValue] = useState<number>(config.baseline);
  const deferredValue = useDeferredValue(value);
  const request = useMemo(
    () =>
      buildUnit42AnalysisRequest(config.requestCaseId, {
        gain: deferredValue,
        structures: [{ kind: 'gain', enabled: true, params: { k: deferredValue }, label: config.label }],
      }),
    [config.label, config.requestCaseId, deferredValue],
  );
  const fallbackResult = useMemo(() => getUnit42FallbackResult(config.requestCaseId), [config.requestCaseId]);
  const { result } = useControlEngine(request, fallbackResult);

  return (
    <div className="premium-lesson-surface-elevated rounded-[28px] px-4 py-4">
      <div className="premium-lesson-title text-sm font-semibold">{config.summaryTitle}</div>
      <div className="premium-lesson-muted mt-2 text-sm">
        四面板板式、底部增益控件和性能指标由同一组 Rust/WASM 分析结果驱动；本页不绘制可行域。
      </div>
      <ControlFigureWorkspace request={request} fallbackResult={fallbackResult} layout={config.layout} />
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricPill label="Mp" value={formatMetric(result?.metrics.overshootPct, 2, '%')} />
        <MetricPill label="t_s" value={formatMetric(result?.metrics.settlingTimeSec, panelId === 'ship' ? 2 : 3, ' s')} />
        <MetricPill label="ω_c" value={formatMetric(result?.metrics.gainCrossoverRadPerSec, 4, ' rad/s')} />
        <MetricPill label="PM" value={formatMetric(result?.metrics.phaseMarginDeg, 2, '°')} />
      </div>
      <div className="mt-4 rounded-2xl border border-border/50 bg-background/60 px-4 py-3">
        <div className="premium-lesson-title text-sm font-medium">控件栏</div>
        <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <div className="text-sm">
              当前调节：<InlineMath math={`${config.sliderKey}=${value.toFixed(panelId === 'ship' ? 2 : 1)}`} />
            </div>
            <input
              type="range"
              min={config.min}
              max={config.max}
              step={config.step}
              value={value}
              onChange={(event) => {
                const nextValue = Number(event.target.value);
                setValue(nextValue);
                onWorkspaceParameterChange?.({ key: config.sliderKey, value: nextValue, source: 'slider' });
              }}
              className="mt-3 w-full"
            />
          </div>
          <div className="premium-lesson-tone-block premium-tone-cyan">
            {panelId === 'ship'
              ? '客船先看低频保持能力与慢扰动抑制是否站稳，再看速度与储备代价。'
              : '平台先看截止频率附近的相位、阻尼和超调是否整理得更可接受。'}
          </div>
        </div>
      </div>
    </div>
  );
}

export function UNIT_4_2KnowledgeMapVisual() {
  return (
    <section className="premium-lesson-panel-soft mb-4 px-4 py-4">
      <div className="premium-lesson-kicker">结构选型判断链</div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {['主矛盾', '结构语义', '收益与代价'].map((item) => (
          <div key={item} className="premium-lesson-surface-elevated rounded-2xl px-4 py-3 text-center text-sm font-semibold">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

export function UNIT_4_2StepContentPanel({
  step,
  manifest,
  revealProgress,
  allowInlineReveal,
  onWorkspaceParameterChange,
}: {
  step: UNIT_4_2StepDefinition;
  manifest?: InteractiveRuntimeManifest | null;
  mediaSrc?: string | null;
  mediaAlt?: string;
  revealProgress: number;
  allowInlineReveal: boolean;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const stepManifest = getManifestStep(manifest, step);
  const sharedRegistry = createManifestContentModuleRegistry({ revealProgress, allowInlineReveal });
  const moduleRegistry: InteractiveModuleRegistry<Unit42ManifestExtra> = {
    ...sharedRegistry,
    'rust-analysis-panel': ({ module }) => {
      const panelId = panelIdFromModule(module);
      if (panelId) {
        return (
          <CaseNativeWorkspace
            panelId={panelId}
            onWorkspaceParameterChange={onWorkspaceParameterChange}
          />
        );
      }
      return sharedRegistry['rust-analysis-panel']?.({
        manifest: manifest ?? {
          lessonId: '4-2',
          courseTitle: '',
          courseRouteSegment: '',
          previewMode: {},
          mediaPolicy: {},
          telemetryStrategy: '',
          teacherInsightStrategy: '',
          requiredStepFields: [],
          stepOrder: [],
          steps: [stepManifest],
        },
        step: stepManifest,
        module,
        extra: { revealProgress, allowInlineReveal },
      }) ?? null;
    },
  };

  return (
    <section className="space-y-4">
      {renderInteractiveManifestStep({
        manifest: manifest ?? {
          lessonId: '4-2',
          courseTitle: '',
          courseRouteSegment: '',
          previewMode: {},
          mediaPolicy: {},
          telemetryStrategy: '',
          teacherInsightStrategy: '',
          requiredStepFields: [],
          stepOrder: [],
          steps: [stepManifest],
        },
        step: stepManifest,
        moduleRegistry,
        extra: { revealProgress, allowInlineReveal, onWorkspaceParameterChange },
      })}
    </section>
  );
}

export function UNIT_4_2StudentActivityForm({
  step,
  manifest,
  savedResponse,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onSubmit,
}: {
  step: UNIT_4_2StepDefinition;
  manifest?: InteractiveRuntimeManifest | null;
  savedResponse?: UNIT_4_2StepResponse;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onSubmit: (response: UNIT_4_2StepResponse) => void;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const stepManifest = getManifestStep(manifest, step);
  return (
    <>
      {renderStudentInteractiveActivity({
        registry: UNIT_4_2_SHARED_STUDENT_ACTIVITY_REGISTRY,
        step,
        stepManifest,
        savedResponse,
        released,
        browseEnabled,
        answerVisible,
        revealProgress,
        onSubmit,
      })}
    </>
  );
}

export function UNIT_4_2TeacherActivitySummary({
  step,
  manifest,
  responses,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onToggleRelease,
  onToggleBrowse,
  onToggleAnswerVisible,
  onAdvanceReveal,
  onResetReveal,
}: {
  step: UNIT_4_2StepDefinition;
  manifest?: InteractiveRuntimeManifest | null;
  responses: TeacherResponseItem[];
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onToggleRelease: () => void;
  onToggleBrowse: () => void;
  onToggleAnswerVisible: () => void;
  onAdvanceReveal: () => void;
  onResetReveal: () => void;
}) {
  const stepManifest = getManifestStep(manifest, step);
  return (
    <>
      {renderTeacherInteractiveActivity({
        registry: UNIT_4_2_SHARED_TEACHER_ACTIVITY_REGISTRY,
        step,
        stepManifest,
        responses,
        released,
        browseEnabled,
        answerVisible,
        revealProgress,
        onToggleRelease,
        onToggleBrowse,
        onToggleAnswerVisible,
        onAdvanceReveal,
        onResetReveal,
      })}
    </>
  );
}

export function UNIT_4_2StudentSummaryPanel({
  responses,
}: {
  responses: Record<string, UNIT_4_2StepResponse>;
}) {
  const completed = Object.keys(responses).length;

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-lg font-semibold">学习收束</div>
      <div className="premium-lesson-muted mt-2 text-sm">
        你已经提交了 {completed} 个环节。4-2 结束时应固定“先看主矛盾，再选结构，再补方向、收益和代价”的判断链。
      </div>
      <div className="mt-4">
        <SubmissionStatus
          submitted={completed > 0}
          submittedText="已有课堂作答记录。"
          idleText="本页只做收束，不额外提交。"
        />
      </div>
    </section>
  );
}

export function UNIT_4_2StepAiAssistant({
  step: _step,
  onAiEvent: _onAiEvent,
}: {
  step: UNIT_4_2StepDefinition;
  onAiEvent?: (eventType: string, data?: Record<string, unknown>) => void;
}) {
  return null;
}
