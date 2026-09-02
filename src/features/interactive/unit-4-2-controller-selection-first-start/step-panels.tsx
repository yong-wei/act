'use client';

import { useDeferredValue, useMemo, useState, type ReactNode } from 'react';
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
  type InteractiveModuleRendererProps,
} from '@/features/interactive/shared/manifest-runtime/layout-renderer';
import { SubmissionStatus } from '@/features/interactive/shared/submission-status';
import type {
  InteractiveRuntimeManifest,
  InteractiveRuntimeModuleManifest,
} from '@/lib/interactive-lesson-manifest';
import {
  type UNIT_4_2StepDefinition,
  type UNIT_4_2StepResponse,
  getUNIT_4_2ManifestStepFromManifest,
} from '@/lib/unit-4-2-course';
import type {
  ControlAnalysisRequest,
  ControlAnalysisResult,
  StructureSpec,
} from '@/resources/control-system/analysis/types';
import { getUnit42FallbackResult } from '@/resources/control-system/analysis/unit-4-2-fixtures';
import { buildUnit42AnalysisRequest } from '@/resources/control-system/analysis/unit-4-2-request-builder';
import { useControlEngine } from '@/resources/control-system/analysis/use-control-engine';
import {
  BodePanel,
  ControlPerformanceBar,
  StepResponsePanel,
} from '@/resources/control-system/charts/control-analysis-panels';
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
type TuningPanelId =
  | 'unit42_example_pi'
  | 'unit42_example_lead'
  | 'unit42_example_lag'
  | 'unit42_example_pid_zn';
type Unit42InteractivePanelId = TuningPanelId | 'unit42_ship_candidate_compare';

type PanelControl = {
  id: string;
  label: string;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
};

type TuningPanelConfig = {
  title: string;
  note: string;
  controls: PanelControl[];
  request: (values: Record<string, number>) => ControlAnalysisRequest;
};

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
    summaryTitle: '客船低频保持能力联动观察',
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
    summaryTitle: '稳定平台中频动态品质联动观察',
  },
} as const;

const EXAMPLE_ROOT_LOCUS = { minGain: 0, maxGain: 10, samples: 96, currentGain: 1 };

function controlRequest(input: {
  caseId: string;
  plant: ControlAnalysisRequest['plant'];
  structures: StructureSpec[];
  timeRange: ControlAnalysisRequest['timeRange'];
  frequencyRange: ControlAnalysisRequest['frequencyRange'];
  currentGain: number;
}): ControlAnalysisRequest {
  return {
    runtimeMode: 'analysis',
    caseId: input.caseId,
    plant: input.plant,
    structures: input.structures,
    outputs: ['step_response', 'magnitude', 'phase', 'bode'],
    timeRange: input.timeRange,
    frequencyRange: input.frequencyRange,
    rootLocus: { ...EXAMPLE_ROOT_LOCUS, currentGain: input.currentGain },
    feasibleRegion: undefined,
    delay: undefined,
    discreteConfig: undefined,
    stateSpaceSpec: undefined,
    referenceProfile: undefined,
    disturbanceProfile: undefined,
  };
}

const TUNING_PANEL_CONFIG = {
  unit42_example_pi: {
    title: '频域 PI 参数复核面板',
    note: '拖动参数后同时复核阶跃响应和 Bode 裕度，观察积分消除静差时对裕度的影响。',
    controls: [
      { id: 'Ti', label: 'T_i', defaultValue: 4, min: 1, max: 8, step: 0.1 },
      { id: 'Kp', label: 'K_p', defaultValue: 1.372, min: 0.5, max: 2.5, step: 0.001 },
      { id: 'Ki', label: 'K_i', defaultValue: 0.343, min: 0.05, max: 0.8, step: 0.001 },
    ],
    request: (values) => controlRequest({
      caseId: 'unit42_example_pi',
      plant: { numerator: [1], denominator: [1, 1], coefficientOrder: 'descending', label: '例题 5.1 对象' },
      structures: [{
        kind: 'pid',
        enabled: true,
        params: { kp: values.Kp ?? 1.372, ki: values.Ki ?? 0.343, kd: 0, tf: 0 },
        label: 'PI 校正器',
      }],
      timeRange: { start: 0, end: 14, samples: 360 },
      frequencyRange: { min: 0.03, max: 30, samples: 360 },
      currentGain: values.Kp ?? 1.372,
    }),
  },
  unit42_example_lead: {
    title: '超前参数复核面板',
    note: '拖动 alpha、T 和 K_c，观察相位补偿改善与高频增益代价是否同时出现。',
    controls: [
      { id: 'alpha', label: 'alpha', defaultValue: 0.238, min: 0.1, max: 0.6, step: 0.001 },
      { id: 'T', label: 'T', defaultValue: 1.025, min: 0.4, max: 2.0, step: 0.001 },
      { id: 'Kc', label: 'K_c', defaultValue: 1.95, min: 0.8, max: 4.0, step: 0.01 },
    ],
    request: (values) => controlRequest({
      caseId: 'unit42_example_lead',
      plant: { numerator: [1.183], denominator: [1.072, 1, 0], coefficientOrder: 'descending', label: '例题 5.2 对象' },
      structures: [{
        kind: 'lead',
        enabled: true,
        params: { k: values.Kc ?? 1.95, tau: values.T ?? 1.025, alpha: values.alpha ?? 0.238 },
        label: '超前校正器',
      }],
      timeRange: { start: 0, end: 18, samples: 420 },
      frequencyRange: { min: 0.05, max: 80, samples: 420 },
      currentGain: values.Kc ?? 1.95,
    }),
  },
  unit42_example_lag: {
    title: '滞后参数复核面板',
    note: '拖动 beta、零点和极点后，复核低频改善是否以相角裕度和速度为代价。',
    controls: [
      { id: 'beta', label: 'beta', defaultValue: 2.5, min: 1.2, max: 5.0, step: 0.01 },
      { id: 'omega_z', label: 'omega_z', defaultValue: 0.1, min: 0.03, max: 0.3, step: 0.001 },
      { id: 'omega_p', label: 'omega_p', defaultValue: 0.04, min: 0.01, max: 0.12, step: 0.001 },
    ],
    request: (values) => {
      const omegaZ = values.omega_z ?? 0.1;
      const omegaP = values.omega_p ?? 0.04;
      const beta = values.beta ?? Math.max(omegaZ / Math.max(omegaP, 0.001), 1.2);
      return controlRequest({
        caseId: 'unit42_example_lag',
        plant: { numerator: [9], denominator: [1, 1], coefficientOrder: 'descending', label: '例题 5.3 对象' },
        structures: [{
          kind: 'lag',
          enabled: true,
          params: { k: beta, tau: 1 / Math.max(omegaZ, 0.001), beta },
          label: '滞后校正器',
        }],
        timeRange: { start: 0, end: 80, samples: 480 },
        frequencyRange: { min: 0.005, max: 20, samples: 420 },
        currentGain: beta,
      });
    },
  },
  unit42_example_pid_zn: {
    title: 'ZN PID 参数复核面板',
    note: '拖动 ZN 初值后，重点观察快速响应、超调和相角裕度是否同时可接受。',
    controls: [
      { id: 'Kp', label: 'K_p', defaultValue: 4.8, min: 2.0, max: 7.0, step: 0.01 },
      { id: 'Ti', label: 'T_i', defaultValue: 2.0, min: 0.8, max: 4.0, step: 0.01 },
      { id: 'Td', label: 'T_d', defaultValue: 0.5, min: 0.1, max: 1.2, step: 0.01 },
      { id: 'Ki', label: 'K_i', defaultValue: 2.4, min: 0.5, max: 5.0, step: 0.01 },
      { id: 'Kd', label: 'K_d', defaultValue: 2.4, min: 0.5, max: 5.0, step: 0.01 },
    ],
    request: (values) => controlRequest({
      caseId: 'unit42_example_pid_zn',
      plant: { numerator: [1], denominator: [1, 3.242, 2.467641, 0], coefficientOrder: 'descending', label: '例题 5.4 对象' },
      structures: [{
        kind: 'pid',
        enabled: true,
        params: {
          kp: values.Kp ?? 4.8,
          ki: values.Ki ?? 2.4,
          kd: values.Kd ?? 2.4,
          tf: 0.03,
        },
        label: 'ZN PID 初值',
      }],
      timeRange: { start: 0, end: 20, samples: 420 },
      frequencyRange: { min: 0.03, max: 80, samples: 420 },
      currentGain: values.Kp ?? 4.8,
    }),
  },
} satisfies Record<TuningPanelId, TuningPanelConfig>;

const SHIP_CANDIDATE_OPTIONS = [
  { id: 'P', label: 'P 基准', structures: [{ kind: 'gain', enabled: true, params: { k: 2.25 }, label: 'P 基准' }] },
  { id: 'lag', label: '滞后候选', structures: [{ kind: 'lag', enabled: true, params: { k: 2.5, tau: 83.333333, beta: 2.5 }, label: '滞后候选' }] },
  { id: 'PI', label: 'PI 候选', structures: [{ kind: 'pi', enabled: true, params: { k: 1.1635371, ti: 106.66667 }, label: 'PI 候选' }] },
  { id: 'lead', label: '超前候选', structures: [{ kind: 'lead', enabled: true, params: { k: 1.5758939, tau: 13.033356, alpha: 0.34833794 }, label: '超前候选' }] },
  {
    id: 'lead_lag',
    label: '超前-滞后候选',
    structures: [{
      kind: 'lead_lag',
      enabled: true,
      params: {
        k: 1.3377469,
        tauLead: 13.909233,
        alphaLead: 0.42717742,
        tauLag: 109.0909,
        betaLag: 1.8,
      },
      label: '超前-滞后候选',
    }],
  },
] satisfies Array<{ id: string; label: string; structures: StructureSpec[] }>;

const UNIT_4_2_SHARED_STUDENT_ACTIVITY_REGISTRY = createManifestStudentActivityRegistry<UNIT_4_2StepDefinition>() as unknown as StudentInteractiveActivityRegistry<
  UNIT_4_2StepDefinition,
  UNIT_4_2StepResponse
>;

const UNIT_4_2_SHARED_TEACHER_ACTIVITY_REGISTRY = createManifestTeacherActivityRegistry<UNIT_4_2StepDefinition>() as unknown as TeacherInteractiveActivityRegistry<
  UNIT_4_2StepDefinition,
  TeacherResponseItem
>;

function getManifestStep(
  manifest: InteractiveRuntimeManifest | null | undefined,
  step: UNIT_4_2StepDefinition,
) {
  return getUNIT_4_2ManifestStepFromManifest(manifest, step.id);
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
      <div className="premium-lesson-title text-base font-semibold leading-7 tracking-normal">{config.summaryTitle}</div>
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
            <input aria-label="控制器选择参数"
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

function resultFallbackNode(error: string | null, result: ControlAnalysisResult | null) {
  if (result) return null;
  return (
    <div className="premium-lesson-tone-block premium-tone-rose mt-4 text-sm">
      {error ?? '控制分析图暂时不可用。'}
    </div>
  );
}

function TimeFrequencyPairPanel({
  request,
  title,
  note,
  controls,
}: {
  request: ControlAnalysisRequest;
  title: string;
  note: string;
  controls: ReactNode;
}) {
  const { result, error } = useControlEngine(request);

  return (
    <div className="premium-lesson-surface-elevated rounded-[28px] px-4 py-4">
      <div className="premium-lesson-title text-base font-semibold leading-7 tracking-normal">{title}</div>
      <div className="premium-lesson-muted mt-2 text-sm">{note}</div>
      {error && result ? (
        <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">{error}</div>
      ) : null}
      {result ? (
        <div className="mt-4 grid gap-4">
          <ControlPerformanceBar result={result} />
          <div className="grid gap-4 xl:grid-cols-2">
            <StepResponsePanel result={result} caseId={request.caseId} />
            <BodePanel result={result} caseId={request.caseId} />
          </div>
        </div>
      ) : resultFallbackNode(error, result)}
      <div className="mt-4 rounded-2xl border border-border/50 bg-background/60 px-4 py-3">
        <div className="premium-lesson-title text-sm font-medium">控件栏</div>
        {controls}
      </div>
    </div>
  );
}

function Unit42ExampleTuningPanel({
  panelId,
  onWorkspaceParameterChange,
}: {
  panelId: TuningPanelId;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const config = TUNING_PANEL_CONFIG[panelId];
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(config.controls.map((control) => [control.id, control.defaultValue])),
  );
  const request = useMemo(() => config.request(values), [config, values]);

  return (
    <TimeFrequencyPairPanel
      request={request}
      title={config.title}
      note={config.note}
      controls={
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {config.controls.map((control) => {
            const value = values[control.id] ?? control.defaultValue;
            return (
              <label key={control.id} className="block text-sm">
                <span className="premium-lesson-title text-sm font-medium">
                  {control.label} = {value.toFixed(control.step < 0.01 ? 3 : control.step < 0.1 ? 2 : 1)}
                </span>
                <input
                  type="range"
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  value={value}
                  onChange={(event) => {
                    const nextValue = Number(event.target.value);
                    setValues((prev) => ({ ...prev, [control.id]: nextValue }));
                    onWorkspaceParameterChange?.({ key: control.id, value: nextValue, source: 'slider' });
                  }}
                  className="mt-2 w-full"
                />
              </label>
            );
          })}
        </div>
      }
    />
  );
}

function Unit42ShipCandidateComparePanel({
  onWorkspaceParameterChange,
}: {
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const [candidateId, setCandidateId] = useState(SHIP_CANDIDATE_OPTIONS[0].id);
  const candidate = SHIP_CANDIDATE_OPTIONS.find((item) => item.id === candidateId) ?? SHIP_CANDIDATE_OPTIONS[0];
  const request = useMemo(
    () =>
      buildUnit42AnalysisRequest('ship', {
        gain: Number(candidate.structures[0]?.params.k ?? 1),
        structures: candidate.structures,
      }),
    [candidate],
  );
  return (
    <TimeFrequencyPairPanel
      request={request}
      title="客船候选结构时域与频域复核面板"
      note="切换候选结构后，先看 Bode 裕度，再看阶跃响应是否以控制量、扰动和低频灵敏度为代价。"
      controls={
        <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <label className="block text-sm">
            <span className="premium-lesson-title text-sm font-medium">候选结构</span>
            <select
              value={candidateId}
              onChange={(event) => {
                const next = event.target.value;
                setCandidateId(next);
                onWorkspaceParameterChange?.({
                  key: 'candidate',
                  value: SHIP_CANDIDATE_OPTIONS.findIndex((item) => item.id === next),
                  source: 'select',
                });
              }}
              className="premium-lesson-select mt-2 w-full"
            >
              {SHIP_CANDIDATE_OPTIONS.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <div className="premium-lesson-tone-block premium-tone-cyan">
            当前复核：{candidate.label}。只凭一个超调数值不能定案，还要回到裕度、扰动峰值、低频灵敏度和控制量。
          </div>
        </div>
      }
    />
  );
}

function panelIdFromInteractiveModule(module: InteractiveRuntimeModuleManifest): Unit42InteractivePanelId | null {
  const panelId = module.payload.panel_id ?? module.payload.panelId;
  if (
    panelId === 'unit42_example_pi' ||
    panelId === 'unit42_example_lead' ||
    panelId === 'unit42_example_lag' ||
    panelId === 'unit42_example_pid_zn' ||
    panelId === 'unit42_ship_candidate_compare'
  ) {
    return panelId;
  }
  return null;
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
  const renderInteractiveFigurePanel = ({
    manifest: renderManifest,
    step: renderStep,
    module,
    extra,
  }: InteractiveModuleRendererProps<Unit42ManifestExtra>) => {
    const panelId = panelIdFromInteractiveModule(module);
    if (panelId === 'unit42_ship_candidate_compare') {
      return (
        <Unit42ShipCandidateComparePanel
          onWorkspaceParameterChange={extra.onWorkspaceParameterChange}
        />
      );
    }
    if (panelId) {
      return (
        <Unit42ExampleTuningPanel
          panelId={panelId}
          onWorkspaceParameterChange={extra.onWorkspaceParameterChange}
        />
      );
    }
    return sharedRegistry['interactive-figure-panel']?.({
      manifest: renderManifest,
      step: renderStep,
      module,
      extra,
    }) ?? null;
  };
  const moduleRegistry: InteractiveModuleRegistry<Unit42ManifestExtra> = {
    ...sharedRegistry,
    'compute.panel': (props) => {
      const legacyKind = typeof props.module.payload.legacyKind === 'string' ? props.module.payload.legacyKind : '';
      const capabilityRef = typeof props.module.payload.capabilityRef === 'string' ? props.module.payload.capabilityRef : '';
      if (legacyKind === 'rust-analysis-panel' || capabilityRef === 'rust-analysis') {
        const panelId = panelIdFromModule(props.module);
        if (panelId) {
          return (
            <CaseNativeWorkspace
              panelId={panelId}
              onWorkspaceParameterChange={onWorkspaceParameterChange}
            />
          );
        }
      }
      if (legacyKind === 'interactive-figure-panel') {
        return renderInteractiveFigurePanel(props);
      }
      return sharedRegistry['compute.panel']?.(props) ?? null;
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
  readOnly = false,
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
  readOnly?: boolean;
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
        readOnly,
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
