'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ClipboardCheck, Gauge, RotateCcw, Ship, SlidersHorizontal } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TransferFunctionModel } from '@/lib/simulation';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import {
  SimChip,
  SimField,
  SimNotice,
  SimPanelSection,
  SimPanelStack,
  SimReadout,
  SimReadoutGrid,
  SimSegmented,
  type SimTone,
} from '@/resources/simulations/components/simulation-panels';
import { simulationUi } from '@/resources/simulations/components/simulation-ui';
import {
  preloadInteractiveSimulationRuntime,
  runPidBatchSimulation,
  type PidBatchSimulationResult,
} from '@/resources/interactive-learning/rust/interactive-simulation-runtime';
import { assessPidResponse } from '@/resources/interactive-learning/pid-simulator/pid-response-assessment';

type ModelKey = 'motor' | 'ship' | 'usv' | 'dps' | 'dredger' | 'fin';

const MODEL_CONFIG: Record<
  ModelKey,
  { title: string; description: string; tag: string }
> = {
  motor: {
    title: '电动机速度调节',
    description: '一阶惯性对象，适合观察 PID 对响应速度与稳态误差的影响。',
    tag: '电机控制',
  },
  ship: {
    title: '船舶航向调节',
    description: '二阶系统近似，关注超调与阻尼比的变化。',
    tag: '航向控制',
  },
  usv: {
    title: '水下无人艇深度',
    description: '积分型过程，考察积分项对稳态偏差的修正。',
    tag: '深度控制',
  },
  dps: {
    title: '船舶动力定位',
    description: '慢响应系统，适合观察 Kp/Kd 的稳态与振荡折中。',
    tag: '定位控制',
  },
  dredger: {
    title: '挖泥船动力分配',
    description: '多扰动系统的简化模型，重点关注鲁棒性。',
    tag: '作业控制',
  },
  fin: {
    title: '减摇鳍调节',
    description: '弱阻尼系统，适合观察微分项抑制振荡的效果。',
    tag: '减摇控制',
  },
};

const MODEL_KEYS = Object.keys(MODEL_CONFIG) as ModelKey[];

const getPlantModel = (key: ModelKey): TransferFunctionModel => {
  switch (key) {
    case 'motor':
      return { type: 'transfer_function', numerator: [1], denominator: [1, 0.5] };
    case 'ship':
      return { type: 'transfer_function', numerator: [0.5], denominator: [0, 0.12, 1] };
    case 'usv':
      return { type: 'transfer_function', numerator: [0.12], denominator: [0, 1] };
    case 'dps':
      return { type: 'transfer_function', numerator: [1], denominator: [1, 3.2, 1] };
    case 'dredger':
      return { type: 'transfer_function', numerator: [0.8], denominator: [1, 1.96, 1] };
    case 'fin':
      return { type: 'transfer_function', numerator: [0.35], denominator: [1, 0.126, 1] };
    default:
      return { type: 'transfer_function', numerator: [1], denominator: [1, 0.8, 1] };
  }
};

const SIMULATION_STEP_SECONDS = 0.02;
const PREVIEW_DEBOUNCE_MS = 150;
const MAX_CHART_POINTS = 800;

type DurationOption = '10' | '20' | '40';
const DURATION_OPTIONS = [
  { value: '10', label: '10 秒' },
  { value: '20', label: '20 秒' },
  { value: '40', label: '40 秒' },
] as const satisfies readonly { value: DurationOption; label: string }[];

interface GainRange {
  min: number;
  max: number;
  step: number;
}

const KP_RANGE: GainRange = { min: 0, max: 10, step: 0.05 };
const KI_RANGE: GainRange = { min: 0, max: 2, step: 0.01 };
const KD_RANGE: GainRange = { min: 0, max: 5, step: 0.05 };
const REFERENCE_RANGE: GainRange = { min: 0.2, max: 2, step: 0.1 };

/** 课程配置的初值超出默认上限时扩展上限，避免钳制教师设定的参数。 */
function rangeFor(range: GainRange, initial: number): GainRange {
  return Number.isFinite(initial) && initial > range.max ? { ...range, max: initial } : range;
}

function toModelKey(value: string | undefined): ModelKey {
  return value && value in MODEL_CONFIG ? (value as ModelKey) : 'ship';
}

interface ChartPoint {
  t: number;
  response: number | null;
  setpoint: number;
}

function buildChartPoints(result: PidBatchSimulationResult): ChartPoint[] {
  const stride = Math.max(1, Math.ceil(result.times.length / MAX_CHART_POINTS));
  const points: ChartPoint[] = [];
  for (let index = 0; index < result.times.length; index += stride) {
    const value = result.response[index];
    points.push({
      t: result.times[index],
      response: Number.isFinite(value) ? value : null,
      setpoint: result.setpoint[index],
    });
  }
  return points;
}

function formatMetric(value: number, digits: number) {
  return Number.isFinite(value) ? value.toFixed(digits) : '—';
}

interface PidSimulatorComponentProps {
  kp?: number;
  ki?: number;
  kd?: number;
  model?: string; // string type to allow dynamic input
  /** 兼容旧调用；导航由外层外壳提供。 */
  showBackLink?: boolean;
  /** Embedded mode - hide navigation */
  embedded?: boolean;
  /** Callback when state changes (for AI context) */
  onStateChange?: (state: {
    phase: string;
    progress: number;
    data: Record<string, unknown>;
    timestamp: number;
  }) => void;
  /** Callback when simulation completes */
  onComplete?: (result?: { success: boolean; score?: number; data?: Record<string, unknown> }) => void;
}

interface PidRun {
  result: PidBatchSimulationResult;
  params: { kp: number; ki: number; kd: number; model: ModelKey; reference: number };
}

export function PidSimulatorComponent({
  kp: initialKp = 1.2,
  ki: initialKi = 0.1,
  kd: initialKd = 0.25,
  model: initialModel = 'ship',
  embedded = false,
  onStateChange,
  onComplete,
}: PidSimulatorComponentProps) {
  const initialModelKey = toModelKey(initialModel);
  const [modelKey, setModelKey] = useState<ModelKey>(initialModelKey);
  const [kp, setKp] = useState(initialKp);
  const [ki, setKi] = useState(initialKi);
  const [kd, setKd] = useState(initialKd);
  const [reference, setReference] = useState(1);
  const [duration, setDuration] = useState<DurationOption>('20');
  const [runtimeState, setRuntimeState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [run, setRun] = useState<PidRun | null>(null);
  const [recordedAt, setRecordedAt] = useState<number | null>(null);
  const latestRun = useRef<PidRun | null>(null);
  const hasPreviewed = useRef(false);

  const kpRange = useMemo(() => rangeFor(KP_RANGE, initialKp), [initialKp]);
  const kiRange = useMemo(() => rangeFor(KI_RANGE, initialKi), [initialKi]);
  const kdRange = useMemo(() => rangeFor(KD_RANGE, initialKd), [initialKd]);
  const modelInfo = MODEL_CONFIG[modelKey];
  const canRecord = Boolean(onStateChange || onComplete);

  useEffect(() => {
    let cancelled = false;
    preloadInteractiveSimulationRuntime()
      .then(() => {
        if (!cancelled) setRuntimeState('ready');
      })
      .catch(() => {
        if (!cancelled) setRuntimeState('failed');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (runtimeState !== 'ready') return;
    const simulate = () => {
      try {
        const params = { kp, ki, kd, model: modelKey, reference };
        const result = runPidBatchSimulation({
          model: getPlantModel(modelKey),
          dt: SIMULATION_STEP_SECONDS,
          duration: Number(duration),
          reference,
          kp,
          ki,
          kd,
        });
        const next = { result, params };
        latestRun.current = next;
        setRun(next);
        setRecordedAt(null);
      } catch {
        setRuntimeState('failed');
      }
    };
    if (!hasPreviewed.current) {
      hasPreviewed.current = true;
      simulate();
      return;
    }
    const timer = window.setTimeout(simulate, PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [runtimeState, kp, ki, kd, modelKey, reference, duration]);

  const recordResult = useCallback(() => {
    const current = latestRun.current;
    if (!current) return;
    const { finalValue, steadyStateError, overshootPercent } = current.result.metrics;
    onStateChange?.({
      phase: 'simulation-complete',
      progress: 100,
      data: {
        ...current.params,
        finalValue,
        steadyStateError,
        overshootPercent: Math.max(0, overshootPercent),
      },
      timestamp: Date.now(),
    });
    onComplete?.({
      success: true,
      score: steadyStateError < 0.05 && overshootPercent < 20 ? 100 : 70,
      data: { steadyStateError, overshootPercent },
    });
    setRecordedAt(Date.now());
  }, [onComplete, onStateChange]);

  const handleReset = () => {
    setModelKey(initialModelKey);
    setKp(initialKp);
    setKi(initialKi);
    setKd(initialKd);
    setReference(1);
    setDuration('20');
  };

  const assessment = useMemo(
    () => (run ? assessPidResponse(run.result.response, run.params.reference) : null),
    [run],
  );
  const chartPoints = useMemo(() => (run ? buildChartPoints(run.result) : []), [run]);
  const diverged = assessment?.diverged ?? false;
  const clampChart = assessment?.clampChart ?? false;
  const yDomain: [number | string, number | string] = clampChart && run
    ? [-2 * Math.abs(run.params.reference), 3 * Math.abs(run.params.reference)]
    : ['auto', 'auto'];

  const metrics = run?.result.metrics;
  const overshoot = metrics ? Math.max(0, metrics.overshootPercent) : Number.NaN;
  const steadyStateError = metrics ? Math.abs(metrics.steadyStateError) : Number.NaN;
  const overshootTone: SimTone = diverged ? 'danger' : overshoot > 20 ? 'warning' : 'success';
  const errorTone: SimTone = diverged ? 'danger' : steadyStateError > 0.05 ? 'warning' : 'success';

  const actionButtons = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleReset}
        className={cn('inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs', simulationUi.buttonOutline)}
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        重置
      </button>
      {canRecord ? (
        <button
          type="button"
          onClick={recordResult}
          disabled={!run || diverged}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50',
            simulationUi.buttonPrimary,
          )}
        >
          <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {recordedAt ? '已记录' : '记录本次结果'}
        </button>
      ) : null}
    </div>
  );

  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-col text-platform-fg-primary',
        embedded ? 'h-full bg-platform-canvas' : 'min-h-0',
      )}
      data-pid-simulator={embedded ? 'embedded' : 'standalone'}
    >
      {embedded ? (
        <div className="flex flex-none items-center justify-between border-b border-platform-border px-4 py-2">
          <span className="text-sm font-medium text-platform-fg-secondary">PID 控制仿真器</span>
          {actionButtons}
        </div>
      ) : null}

      <div
        className={cn(
          'grid min-h-0 flex-1 gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]',
          embedded ? 'overflow-y-auto p-4' : 'w-full',
        )}
      >
        <aside className="simulation-light-panel p-4">
          <SimPanelStack>
            <SimPanelSection title="对象模型" icon={Ship} aside={<SimChip tone="accent">{modelInfo.tag}</SimChip>}>
              <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="对象模型">
                {MODEL_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={key === modelKey}
                    onClick={() => setModelKey(key)}
                    className={cn(
                      'min-h-9 rounded-md border px-2 py-1.5 text-left text-xs leading-4 transition',
                      key === modelKey
                        ? 'border-platform-action-primary/70 bg-platform-action-primary/12 font-semibold text-platform-action-primary'
                        : 'border-platform-border bg-platform-canvas/40 text-platform-fg-secondary hover:border-platform-action-primary/40 hover:text-platform-fg-primary',
                    )}
                  >
                    {MODEL_CONFIG[key].title}
                  </button>
                ))}
              </div>
              <p className="mt-2.5 text-xs leading-5 text-platform-fg-secondary">{modelInfo.description}</p>
            </SimPanelSection>

            <SimPanelSection title="PID 参数" icon={SlidersHorizontal}>
              <div className="space-y-3">
                <SimField label="比例增益 Kp" value={kp.toFixed(2)}>
                  <Slider
                    aria-label="比例增益 Kp"
                    className={simulationUi.slider}
                    value={[kp]}
                    {...kpRange}
                    onValueChange={([value]) => setKp(value)}
                  />
                </SimField>
                <SimField label="积分增益 Ki" value={ki.toFixed(2)}>
                  <Slider
                    aria-label="积分增益 Ki"
                    className={simulationUi.slider}
                    value={[ki]}
                    {...kiRange}
                    onValueChange={([value]) => setKi(value)}
                  />
                </SimField>
                <SimField label="微分增益 Kd" value={kd.toFixed(2)}>
                  <Slider
                    aria-label="微分增益 Kd"
                    className={simulationUi.slider}
                    value={[kd]}
                    {...kdRange}
                    onValueChange={([value]) => setKd(value)}
                  />
                </SimField>
                <SimField label="目标值" value={reference.toFixed(1)}>
                  <Slider
                    aria-label="目标值"
                    className={simulationUi.slider}
                    value={[reference]}
                    {...REFERENCE_RANGE}
                    onValueChange={([value]) => setReference(value)}
                  />
                </SimField>
              </div>
            </SimPanelSection>

            <SimPanelSection title="仿真时长" icon={Gauge}>
              <SimSegmented
                ariaLabel="仿真时长"
                options={DURATION_OPTIONS}
                value={duration}
                onChange={setDuration}
              />
            </SimPanelSection>
          </SimPanelStack>
        </aside>

        <section className="simulation-light-panel flex min-h-[30rem] min-w-0 flex-col p-4">
          <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-platform-fg-primary">阶跃响应</h2>
              <p className="mt-0.5 text-xs text-platform-fg-secondary">
                {modelInfo.title} · 调整参数后曲线自动刷新
              </p>
            </div>
            {embedded ? null : actionButtons}
          </header>

          <SimReadoutGrid columns={3} className="mb-3">
            <SimReadout label="超调量" value={formatMetric(overshoot, 1)} unit="%" tone={run ? overshootTone : 'neutral'} size="lg" />
            <SimReadout label="稳态误差" value={formatMetric(steadyStateError, 3)} tone={run ? errorTone : 'neutral'} size="lg" />
            <SimReadout label="终值" value={formatMetric(metrics?.finalValue ?? Number.NaN, 3)} size="lg" />
          </SimReadoutGrid>

          {runtimeState === 'failed' ? (
            <SimNotice tone="danger" title="仿真暂不可用" className="mb-3">请刷新页面后重试。</SimNotice>
          ) : diverged ? (
            <SimNotice tone="danger" title="当前参数使闭环发散" className="mb-3">
              减小 Kp 或 Ki，或适当增大 Kd 后再观察响应。
            </SimNotice>
          ) : null}

          <div className="relative min-h-[18rem] flex-1" data-pid-response-chart="">
            {run ? (
              <div className="absolute inset-0">
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 320 }}>
                  <LineChart data={chartPoints} margin={{ top: 8, right: 16, bottom: 20, left: 0 }}>
                    <CartesianGrid stroke="hsl(var(--platform-border))" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="t"
                      type="number"
                      domain={[0, 'dataMax']}
                      tickCount={6}
                      tick={{ fill: 'hsl(var(--platform-fg-secondary))', fontSize: 11 }}
                      stroke="hsl(var(--platform-border-strong))"
                      label={{ value: '时间 (s)', position: 'insideBottom', offset: -12, fill: 'hsl(var(--platform-fg-secondary))', fontSize: 11 }}
                    />
                    <YAxis
                      domain={yDomain}
                      allowDataOverflow={clampChart}
                      width={48}
                      tickFormatter={(value: number) => value.toFixed(2)}
                      tick={{ fill: 'hsl(var(--platform-fg-secondary))', fontSize: 11 }}
                      stroke="hsl(var(--platform-border-strong))"
                    />
                    <Tooltip
                      formatter={(value, name) => [typeof value === 'number' ? value.toFixed(3) : String(value ?? '—'), name]}
                      labelFormatter={(label) => `t = ${Number(label).toFixed(2)} s`}
                      contentStyle={{
                        background: 'hsl(var(--platform-surface-overlay))',
                        border: '1px solid hsl(var(--platform-border))',
                        borderRadius: 8,
                        color: 'hsl(var(--platform-fg-primary))',
                        fontSize: 12,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="setpoint"
                      name="设定值"
                      stroke="hsl(var(--platform-chart-4))"
                      strokeWidth={1.5}
                      strokeDasharray="6 4"
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="response"
                      name="系统输出"
                      stroke="hsl(var(--platform-chart-1))"
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : runtimeState === 'loading' ? (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-xs text-platform-fg-secondary">
                <Activity className="h-4 w-4 animate-pulse" aria-hidden="true" />
                正在准备仿真…
              </div>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-platform-fg-secondary" aria-hidden="true">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-5 rounded-full bg-[hsl(var(--platform-chart-1))]" />
              系统输出
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0 w-5 border-t-2 border-dashed border-[hsl(var(--platform-chart-4))]" />
              设定值
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
