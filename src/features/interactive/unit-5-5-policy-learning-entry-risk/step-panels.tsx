'use client';

import { useMemo, useState } from 'react';

import { createManifestContentModuleRegistry } from '@/features/interactive/shared/manifest-runtime/content-renderers';
import {
  createManifestStudentActivityRegistry,
  createManifestTeacherActivityRegistry,
  ManifestTeacherControls,
  renderStudentInteractiveActivity,
  renderTeacherInteractiveActivity,
  type ManifestStepResponse,
} from '@/features/interactive/shared/manifest-runtime/activity-renderers';
import {
  renderInteractiveManifestStep,
  type InteractiveModuleRegistry,
  type InteractiveRuntimeModuleManifest,
} from '@/features/interactive/shared/manifest-runtime/layout-renderer';
import type { InteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';
import {
  getUNIT_5_5ManifestStepFromManifest,
  type UNIT_5_5StepDefinition,
} from '@/lib/unit-5-5-course';
import {
  computeUnit55RlTraining,
  type Unit55ComparisonPoint,
  type Unit55RewardPoint,
  type Unit55RlTrainingResult,
  type Unit55RlTrainingType,
} from './rl-training-runtime';

type TeacherResponseItem = { studentName: string; response: ManifestStepResponse };
type ContentRegistryExtra = {
  revealProgress: number;
  allowInlineReveal: boolean;
  onInlineReveal?: () => void;
};
type TrainingPhase = 'idle' | 'training' | 'stopped';

const TRAINING_LABELS: Record<Unit55RlTrainingType, string> = {
  toy_rl: '学习策略',
  direct_rl: 'RL直接',
  safe_shell_rl: 'RL安全外壳',
  rl_pid_schedule: 'RL调度PID',
};

type NumericParameterControl = {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit?: string;
};

type HeadingTabSpec = {
  id: Exclude<Unit55RlTrainingType, 'toy_rl'>;
  label: string;
  parameterControls: string[];
};

const HEADING_PARAMETER_CONTROLS: Record<Exclude<Unit55RlTrainingType, 'toy_rl'>, NumericParameterControl[]> = {
  direct_rl: [
    { id: 'explorationDecay', label: '探索率衰减速度', min: 0.2, max: 0.85, step: 0.05, defaultValue: 0.5 },
    { id: 'actionStepDeg', label: '动作步长', min: 1, max: 5, step: 0.5, defaultValue: 2.5, unit: '°' },
    { id: 'errorPenaltyWeight', label: '误差惩罚权重', min: 0.6, max: 1.8, step: 0.1, defaultValue: 1.0 },
    { id: 'rudderRatePenaltyWeight', label: '舵角变化惩罚权重', min: 0.2, max: 1.2, step: 0.1, defaultValue: 0.5 },
  ],
  safe_shell_rl: [
    { id: 'safetyErrorThresholdDeg', label: '安全误差阈值', min: 5, max: 14, step: 1, defaultValue: 9, unit: '°' },
    { id: 'yawRateThreshold', label: '角速度阈值', min: 0.15, max: 0.65, step: 0.05, defaultValue: 0.35, unit: '°/s' },
    { id: 'rudderRateThreshold', label: '舵速阈值', min: 0.3, max: 1.2, step: 0.1, defaultValue: 0.7, unit: '°/s' },
    { id: 'safetyPenaltyWeight', label: '安全惩罚权重', min: 0.8, max: 2.4, step: 0.2, defaultValue: 1.4 },
    { id: 'fallbackSensitivity', label: '退化接管灵敏度', min: 0.3, max: 1, step: 0.05, defaultValue: 0.7 },
  ],
  rl_pid_schedule: [
    { id: 'parameterSetIndex', label: '参数档位集合', min: 1, max: 3, step: 1, defaultValue: 2 },
    { id: 'switchPenaltyWeight', label: '切换惩罚权重', min: 0.1, max: 1, step: 0.1, defaultValue: 0.4 },
    { id: 'disturbanceBias', label: '抗扰档位偏置', min: -0.4, max: 0.4, step: 0.1, defaultValue: 0.1 },
    { id: 'fastModeLimit', label: '快速档位使用限制', min: 0.2, max: 0.8, step: 0.1, defaultValue: 0.5 },
    { id: 'errorBandCount', label: '误差区间分档', min: 3, max: 7, step: 1, defaultValue: 5 },
  ],
};

function headingTabSpecsFromManifest(figureSpec: Record<string, unknown> | undefined): HeadingTabSpec[] {
  const tabs = Array.isArray(figureSpec?.tabs) ? figureSpec.tabs : [];
  return tabs
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const id = record.id;
      if (id !== 'direct_rl' && id !== 'safe_shell_rl' && id !== 'rl_pid_schedule') return null;
      const parameterControls = Array.isArray(record.parameter_controls)
        ? record.parameter_controls.map((control) => String(control)).filter(Boolean)
        : [];
      return {
        id,
        label: typeof record.label === 'string' && record.label.trim() ? record.label : TRAINING_LABELS[id],
        parameterControls,
      };
    })
    .filter((item): item is HeadingTabSpec => Boolean(item));
}

function controlsForHeadingTab(tab: Exclude<Unit55RlTrainingType, 'toy_rl'>, specs: HeadingTabSpec[]) {
  const defaults = HEADING_PARAMETER_CONTROLS[tab];
  const manifestLabels = specs.find((item) => item.id === tab)?.parameterControls.filter((label) => label !== '训练轮数档位') ?? [];
  if (!manifestLabels.length) return defaults;
  const byLabel = new Map(defaults.map((control) => [control.label, control]));
  return manifestLabels.map((label) => byLabel.get(label)).filter((item): item is NumericParameterControl => Boolean(item));
}

function defaultHeadingParameters(trainingType: Exclude<Unit55RlTrainingType, 'toy_rl'>) {
  return Object.fromEntries(HEADING_PARAMETER_CONTROLS[trainingType].map((control) => [control.id, control.defaultValue])) as Record<string, number>;
}

function requireUnit55Manifest(manifest: InteractiveRuntimeManifest | null | undefined) {
  if (!manifest) throw new Error('5-5 runtime manifest is required for page rendering.');
  return manifest;
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function panelId(module: InteractiveRuntimeModuleManifest) {
  return asString(module.payload.panel_id ?? module.payload.panelId, module.id);
}

function pathFrom(points: Array<{ x: number; y: number }>, scale: (point: { x: number; y: number }) => { x: number; y: number }) {
  return points.map((point, index) => {
    const scaled = scale(point);
    return `${index === 0 ? 'M' : 'L'} ${scaled.x.toFixed(1)} ${scaled.y.toFixed(1)}`;
  }).join(' ');
}

function SimpleLineChart({
  title,
  series,
  yDomain,
  xLabel,
  yLabel,
}: {
  title: string;
  series: Array<{ id: string; label: string; color: string; points: Array<{ x: number; y: number }>; dashed?: boolean }>;
  yDomain: [number, number];
  xLabel: string;
  yLabel: string;
}) {
  const allPoints = series.flatMap((item) => item.points);
  const maxX = Math.max(1, ...allPoints.map((point) => point.x));
  const [minY, maxY] = yDomain;
  const scale = (point: { x: number; y: number }) => ({
    x: 48 + (point.x / maxX) * 560,
    y: 300 - ((point.y - minY) / Math.max(1e-6, maxY - minY)) * 230,
  });

  return (
    <svg viewBox="0 0 640 350" className="h-[350px] w-full rounded-xl border border-border/70 bg-white" aria-label={title}>
      <text x="48" y="30" className="fill-slate-800 text-[15px] font-semibold">{title}</text>
      <line x1="48" y1="300" x2="608" y2="300" stroke="#cbd5e1" />
      <line x1="48" y1="70" x2="48" y2="300" stroke="#cbd5e1" />
      <text x="604" y="326" textAnchor="end" className="fill-slate-500 text-[10px]">{xLabel}</text>
      <text x="16" y="96" textAnchor="middle" className="fill-slate-500 text-[10px]" transform="rotate(-90 16 96)">{yLabel}</text>
      {series.map((item) => (
        <path key={item.id} d={pathFrom(item.points, scale)} fill="none" stroke={item.color} strokeWidth="2.5" strokeDasharray={item.dashed ? '6 5' : undefined} />
      ))}
      {series.map((item, index) => (
        <g key={item.id} transform={`translate(380, ${34 + index * 18})`}>
          <line x1="0" y1="0" x2="24" y2="0" stroke={item.color} strokeWidth="3" strokeDasharray={item.dashed ? '6 5' : undefined} />
          <text x="30" y="4" className="fill-slate-600 text-[11px]">{item.label}</text>
        </g>
      ))}
    </svg>
  );
}

function rewardSeries(points: Unit55RewardPoint[], visibleCount?: number) {
  const sliced = visibleCount ? points.slice(0, visibleCount) : points;
  return [
    { id: 'reward', label: '累计回报', color: '#0891b2', points: sliced.map((point) => ({ x: point.episode, y: point.reward })) },
    { id: 'average', label: '20 轮移动平均', color: '#f59e0b', points: sliced.map((point) => ({ x: point.episode, y: point.movingAverage })), dashed: true },
  ];
}

function headingSeries(trace: Unit55ComparisonPoint[]) {
  return [
    { id: 'reference', label: '目标航向', color: '#111827', points: trace.map((point) => ({ x: point.t, y: point.reference })), dashed: true },
    { id: 'pid', label: 'PID 基准', color: '#dc2626', points: trace.map((point) => ({ x: point.t, y: point.pid })) },
    { id: 'rl', label: '当前策略', color: '#2563eb', points: trace.map((point) => ({ x: point.t, y: point.rl })) },
  ];
}

function rudderSeries(trace: Unit55ComparisonPoint[]) {
  return [
    { id: 'pid-rudder', label: 'PID 舵角', color: '#dc2626', points: trace.map((point) => ({ x: point.t, y: point.rudderPid })) },
    { id: 'rl-rudder', label: '当前策略舵角', color: '#2563eb', points: trace.map((point) => ({ x: point.t, y: point.rudderRl })) },
  ];
}

function MetricGrid({ result }: { result: Unit55RlTrainingResult | null }) {
  const metrics = result?.metrics;
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">RMS 航向误差</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">{metrics ? `${metrics.rmsHeadingError.toFixed(2)}°` : '-'}</div></div>
      <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">最大超调</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">{metrics ? `${metrics.maxOvershoot.toFixed(2)}°` : '-'}</div></div>
      <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">调节时间</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">{metrics ? `${metrics.settlingTime.toFixed(0)} s` : '-'}</div></div>
      <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">平均舵角</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">{metrics ? `${metrics.averageRudder.toFixed(2)}°` : '-'}</div></div>
      <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">平均舵速</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">{metrics ? `${metrics.averageRudderRate.toFixed(2)}°/s` : '-'}</div></div>
      <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">安全退化次数</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">{result ? result.safetyFallbackCount : '-'}</div></div>
    </div>
  );
}

function ToyTrainingPanel({ onPanelSubmit }: { onPanelSubmit?: (response: ManifestStepResponse) => void }) {
  const [phase, setPhase] = useState<TrainingPhase>('idle');
  const [visibleCount, setVisibleCount] = useState(0);
  const [pendingResult, setPendingResult] = useState<Unit55RlTrainingResult | null>(null);
  const [result, setResult] = useState<Unit55RlTrainingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startTraining = async () => {
    setPhase('training');
    setVisibleCount(0);
    setPendingResult(null);
    setResult(null);
    setError(null);
    try {
      const next = await computeUnit55RlTraining({
        panelKind: 'rust_toy_training_panel',
        trainingType: 'toy_rl',
        seed: Date.now() % 100000,
        trainingEpisodes: 80,
        selectedParameters: { actionCost: 0.04, boundaryPenalty: 1.0 },
      });
      setPendingResult(next);
      setVisibleCount(next.rewardCurve.length);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setPhase('idle');
    }
  };
  const stopTraining = () => {
    if (pendingResult) {
      setResult(pendingResult);
      onPanelSubmit?.({
        stepId: 'step-08',
        submittedAt: Date.now(),
        answers: { __rl_training_result: JSON.stringify(pendingResult) },
      });
      setPhase('stopped');
    }
  };
  const rewardResult = phase === 'training' ? pendingResult : result;
  const evaluationResult = phase === 'stopped' ? result : null;

  return (
    <section className="premium-lesson-panel space-y-4" data-testid="unit-5-5-toy-rl-training-panel">
      <div><div className="premium-lesson-kicker">实时训练面板</div><h3 className="premium-lesson-title mt-1 text-lg font-semibold">横向误差修正实时训练</h3></div>
      {error ? <div className="premium-lesson-tone-block premium-tone-rose text-sm">{error}</div> : null}
      <div className="grid gap-4 xl:grid-cols-2">
        <SimpleLineChart title="训练动态回报曲线" series={rewardSeries(rewardResult?.rewardCurve ?? [], visibleCount)} yDomain={[-24, -3]} xLabel="训练轮次" yLabel="回报" />
        <SimpleLineChart title="同一起点误差收敛对比" series={evaluationResult ? headingSeries(evaluationResult.comparisonTrace) : []} yDomain={[-0.2, 1.4]} xLabel="步数" yLabel="横向误差" />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void startTraining()} className="premium-lesson-action-tone premium-tone-cyan">开始训练</button>
        <button type="button" onClick={stopTraining} disabled={!pendingResult || phase !== 'training'} className="premium-lesson-action-tone premium-tone-amber disabled:opacity-40">停止训练</button>
        <span className="premium-lesson-caption self-center text-xs">状态：{phase === 'idle' ? '未训练' : phase === 'training' ? '训练中，停止后生成评价曲线' : '已停止并记录结果'}</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border/70">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">方法</th><th className="px-3 py-2">末端绝对误差</th><th className="px-3 py-2">累计回报</th><th className="px-3 py-2">说明</th></tr></thead>
          <tbody>
            <tr><td className="px-3 py-2">随机动作</td><td className="px-3 py-2">0.08</td><td className="px-3 py-2">-21.96</td><td className="px-3 py-2">低质量基线</td></tr>
            <tr className="border-t"><td className="px-3 py-2">显式比例修正</td><td className="px-3 py-2">0.03</td><td className="px-3 py-2">-5.54</td><td className="px-3 py-2">直接利用误差结构</td></tr>
            <tr className="border-t bg-cyan-50/70"><td className="px-3 py-2">学习策略</td><td className="px-3 py-2">{evaluationResult ? evaluationResult.metrics.finalError.toFixed(3) : '停止后更新'}</td><td className="px-3 py-2">{rewardResult ? rewardResult.metrics.cumulativeReward.toFixed(2) : '-5.54'}</td><td className="px-3 py-2">停止训练后由最新模型更新</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HeadingRlTrainingPanel({
  released,
  figureSpec,
  onPanelSubmit,
}: {
  released: boolean;
  figureSpec?: Record<string, unknown>;
  onPanelSubmit?: (response: ManifestStepResponse) => void;
}) {
  const manifestTabs = useMemo(() => headingTabSpecsFromManifest(figureSpec), [figureSpec]);
  const tabs: Array<Exclude<Unit55RlTrainingType, 'toy_rl'>> = manifestTabs.length
    ? manifestTabs.map((tab) => tab.id)
    : ['direct_rl', 'safe_shell_rl', 'rl_pid_schedule'];
  const [activeTab, setActiveTab] = useState<Exclude<Unit55RlTrainingType, 'toy_rl'>>('direct_rl');
  const [phaseByTab, setPhaseByTab] = useState<Record<string, TrainingPhase>>({});
  const [pendingResults, setPendingResults] = useState<Partial<Record<Unit55RlTrainingType, Unit55RlTrainingResult>>>({});
  const [results, setResults] = useState<Partial<Record<Unit55RlTrainingType, Unit55RlTrainingResult>>>({});
  const [episodes, setEpisodes] = useState(140);
  const [parametersByTab, setParametersByTab] = useState<Record<Exclude<Unit55RlTrainingType, 'toy_rl'>, Record<string, number>>>({
    direct_rl: defaultHeadingParameters('direct_rl'),
    safe_shell_rl: defaultHeadingParameters('safe_shell_rl'),
    rl_pid_schedule: defaultHeadingParameters('rl_pid_schedule'),
  });
  const [error, setError] = useState<string | null>(null);
  const result = results[activeTab] ?? null;
  const pendingResult = pendingResults[activeTab] ?? null;
  const phase = phaseByTab[activeTab] ?? 'idle';
  const selectedParameters = parametersByTab[activeTab];
  const activeControls = controlsForHeadingTab(activeTab, manifestTabs);
  const tabLabel = manifestTabs.find((tab) => tab.id === activeTab)?.label ?? TRAINING_LABELS[activeTab];
  const startTraining = async () => {
    if (!released) return;
    setPhaseByTab((prev) => ({ ...prev, [activeTab]: 'training' }));
    setPendingResults((prev) => ({ ...prev, [activeTab]: undefined }));
    setResults((prev) => ({ ...prev, [activeTab]: undefined }));
    setError(null);
    try {
      const next = await computeUnit55RlTraining({
        panelKind: 'rust_heading_rl_training_panel',
        trainingType: activeTab,
        seed: Date.now() % 100000,
        trainingEpisodes: episodes,
        selectedParameters,
      });
      setPendingResults((prev) => ({ ...prev, [activeTab]: next }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setPhaseByTab((prev) => ({ ...prev, [activeTab]: 'idle' }));
    }
  };
  const stopTraining = () => {
    if (!pendingResult) return;
    setResults((prev) => ({ ...prev, [activeTab]: pendingResult }));
    setPhaseByTab((prev) => ({ ...prev, [activeTab]: 'stopped' }));
  };
  const submitResult = () => {
    if (!result) return;
    onPanelSubmit?.({
      stepId: 'step-15',
      submittedAt: Date.now(),
      answers: {
        [`rl_result:${activeTab}`]: JSON.stringify(result),
      },
    });
  };
  const updateActiveParameter = (parameterId: string, value: number) => {
    setParametersByTab((prev) => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        [parameterId]: value,
      },
    }));
  };
  const rewardResult = phase === 'training' ? pendingResult : result;
  const evaluationResult = phase === 'stopped' ? result : null;

  return (
    <section className="premium-lesson-panel space-y-4" data-testid="unit-5-5-heading-rl-training-panel">
      <div><div className="premium-lesson-kicker">三类航向策略训练</div><h3 className="premium-lesson-title mt-1 text-lg font-semibold">三类 RL 策略训练与 PID 基准评价</h3></div>
      {!released ? <div className="premium-lesson-tone-block premium-tone-amber text-sm">教师尚未发放训练与提交控制，当前可先阅读任务和评价口径。</div> : null}
      {error ? <div className="premium-lesson-tone-block premium-tone-rose text-sm">{error}</div> : null}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`premium-lesson-action-tone ${activeTab === tab ? 'premium-tone-cyan' : 'premium-tone-slate'}`}>{manifestTabs.find((item) => item.id === tab)?.label ?? TRAINING_LABELS[tab]}</button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="premium-lesson-control flex flex-col gap-2 px-4 py-3"><span>训练轮数档位</span><input type="range" min="80" max="240" step="20" value={episodes} onChange={(event) => setEpisodes(Number(event.target.value))} disabled={!released} /><span className="premium-lesson-caption text-xs">{episodes} 轮</span></label>
        <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">当前标签</div><div className="premium-lesson-title mt-1 text-lg font-semibold">{tabLabel}</div></div>
        <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">训练状态</div><div className="premium-lesson-title mt-1 text-lg font-semibold">{phase === 'idle' ? '未训练' : phase === 'training' ? '训练中' : '已停止'}</div></div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {activeControls.map((control) => (
          <label key={control.id} className="premium-lesson-control flex flex-col gap-2 px-4 py-3">
            <span>{control.label}</span>
            <input
              type="range"
              min={control.min}
              max={control.max}
              step={control.step}
              value={selectedParameters[control.id] ?? control.defaultValue}
              onChange={(event) => updateActiveParameter(control.id, Number(event.target.value))}
              disabled={!released || phase === 'training'}
            />
            <span className="premium-lesson-caption text-xs">
              {(selectedParameters[control.id] ?? control.defaultValue).toFixed(control.step < 1 ? 2 : 0)}{control.unit ?? ''}
            </span>
          </label>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <SimpleLineChart title="动态回报曲线" series={rewardSeries(rewardResult?.rewardCurve ?? [])} yDomain={[-26, -8]} xLabel="训练轮次" yLabel="回报" />
        <SimpleLineChart title="航向响应对比" series={evaluationResult ? headingSeries(evaluationResult.comparisonTrace) : []} yDomain={[-12, 18]} xLabel="时间 / s" yLabel="航向角 / deg" />
        <SimpleLineChart title="舵角输出对比" series={evaluationResult ? rudderSeries(evaluationResult.comparisonTrace) : []} yDomain={[-16, 16]} xLabel="时间 / s" yLabel="舵角 / deg" />
      </div>
      <MetricGrid result={evaluationResult} />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void startTraining()} disabled={!released || phase === 'training'} className="premium-lesson-action-tone premium-tone-cyan disabled:opacity-40">开始训练</button>
        <button type="button" onClick={stopTraining} disabled={!released || phase !== 'training' || !pendingResult} className="premium-lesson-action-tone premium-tone-amber disabled:opacity-40">停止训练</button>
        <button type="button" onClick={submitResult} disabled={!released || phase !== 'stopped' || !result} className="premium-lesson-action-primary disabled:opacity-40">提交结果</button>
      </div>
    </section>
  );
}

function SummaryStats({
  viewedStepIds,
  submittedCount,
  trainingSubmissionCount,
  postTestSubmitted,
}: {
  viewedStepIds: string[];
  submittedCount: number;
  trainingSubmissionCount: number;
  postTestSubmitted: boolean;
}) {
  return (
    <section className="premium-lesson-panel p-4" data-testid="unit-5-5-student-summary-stats">
      <div className="premium-lesson-kicker">个人课堂表现</div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">已浏览页面</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">{viewedStepIds.length}</div></div>
        <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">已提交互动</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">{submittedCount}</div></div>
        <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">训练结果提交</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">{trainingSubmissionCount}</div></div>
        <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">后测完成情况</div><div className="premium-lesson-title mt-1 text-sm font-semibold">{postTestSubmitted ? '已完成后测' : '尚未提交后测'}</div></div>
      </div>
    </section>
  );
}

function TeacherStats({
  submittedStudents,
  totalStudents,
  totalResponses,
  trainingCoverage,
  objectiveAccuracy,
  postTestCompletion,
}: {
  submittedStudents: number;
  totalStudents: number;
  totalResponses: number;
  trainingCoverage: number;
  objectiveAccuracy: number;
  postTestCompletion: number;
}) {
  return (
    <section className="premium-lesson-panel p-4" data-testid="unit-5-5-teacher-summary-stats">
      <div className="premium-lesson-kicker">班级课堂表现</div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">提交学生</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">{submittedStudents}/{totalStudents}</div></div>
        <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">训练覆盖</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">{trainingCoverage}%</div></div>
        <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">累计提交</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">{totalResponses}</div></div>
        <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">客观题正确率</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">{objectiveAccuracy}%</div></div>
        <div className="premium-lesson-surface-elevated px-4 py-3"><div className="premium-lesson-caption text-xs">后测完成率</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">{postTestCompletion}%</div></div>
      </div>
    </section>
  );
}

export function UNIT_5_5StepContentPanel({
  step,
  manifest,
  revealProgress = 0,
  allowInlineReveal = false,
  onInlineReveal,
  onPanelSubmit,
  activityReleased = true,
  viewedStepIds = [],
  submittedCount = 0,
  trainingSubmissionCount = 0,
  postTestSubmitted = false,
  submittedStudents = 0,
  totalStudents = 0,
  totalResponses = 0,
  trainingCoverage = 0,
  objectiveAccuracy = 0,
  postTestCompletion = 0,
  mode = 'student',
}: {
  step: UNIT_5_5StepDefinition;
  manifest: InteractiveRuntimeManifest | null | undefined;
  revealProgress?: number;
  allowInlineReveal?: boolean;
  onInlineReveal?: () => void;
  onPanelSubmit?: (response: ManifestStepResponse) => void;
  activityReleased?: boolean;
  viewedStepIds?: string[];
  submittedCount?: number;
  trainingSubmissionCount?: number;
  postTestSubmitted?: boolean;
  submittedStudents?: number;
  totalStudents?: number;
  totalResponses?: number;
  trainingCoverage?: number;
  objectiveAccuracy?: number;
  postTestCompletion?: number;
  mode?: 'student' | 'teacher';
}) {
  const activeManifest = requireUnit55Manifest(manifest);
  const stepManifest = getUNIT_5_5ManifestStepFromManifest(activeManifest, step.id);
  const baseRegistry = useMemo(() => createManifestContentModuleRegistry({ revealProgress, allowInlineReveal, onInlineReveal }), [allowInlineReveal, onInlineReveal, revealProgress]);
  const contentRegistry = useMemo<InteractiveModuleRegistry<ContentRegistryExtra>>(() => ({
    ...baseRegistry,
    'interactive-figure-panel': ({ module }) => {
      if (panelId(module) === 'rust_toy_rl_training_panel') {
        return <ToyTrainingPanel onPanelSubmit={onPanelSubmit} />;
      }
      if (panelId(module) === 'rust_heading_rl_training_panel') {
        return <HeadingRlTrainingPanel released={activityReleased || mode === 'teacher'} figureSpec={stepManifest.interactiveFigureSpec} onPanelSubmit={onPanelSubmit} />;
      }
      return baseRegistry['interactive-figure-panel']({ manifest: activeManifest, step: stepManifest, module, extra: { revealProgress, allowInlineReveal, onInlineReveal } });
    },
    'learning-stat-panel': () => mode === 'teacher'
      ? <TeacherStats submittedStudents={submittedStudents} totalStudents={totalStudents} totalResponses={totalResponses} trainingCoverage={trainingCoverage} objectiveAccuracy={objectiveAccuracy} postTestCompletion={postTestCompletion} />
      : <SummaryStats viewedStepIds={viewedStepIds} submittedCount={submittedCount} trainingSubmissionCount={trainingSubmissionCount} postTestSubmitted={postTestSubmitted} />,
  }), [activeManifest, activityReleased, allowInlineReveal, baseRegistry, mode, objectiveAccuracy, onInlineReveal, onPanelSubmit, postTestCompletion, postTestSubmitted, revealProgress, stepManifest, submittedCount, submittedStudents, totalResponses, totalStudents, trainingCoverage, trainingSubmissionCount, viewedStepIds]);

  return renderInteractiveManifestStep({
    manifest: activeManifest,
    step: stepManifest,
    moduleRegistry: contentRegistry,
    extra: { revealProgress, allowInlineReveal, onInlineReveal },
  });
}

export function UNIT_5_5StudentActivityForm({
  step,
  manifest,
  savedResponse,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onSubmit,
}: {
  step: UNIT_5_5StepDefinition;
  manifest: InteractiveRuntimeManifest | null | undefined;
  savedResponse?: ManifestStepResponse;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onSubmit: (response: ManifestStepResponse) => void;
}) {
  const activeManifest = requireUnit55Manifest(manifest);
  const stepManifest = getUNIT_5_5ManifestStepFromManifest(activeManifest, step.id);
  return renderStudentInteractiveActivity({
    registry: createManifestStudentActivityRegistry<UNIT_5_5StepDefinition>(),
    step,
    stepManifest,
    savedResponse,
    released,
    browseEnabled,
    answerVisible,
    revealProgress,
    onSubmit,
  });
}

function parseTrainingResult(value: string | undefined) {
  if (!value) return null;
  try {
    return JSON.parse(value) as Unit55RlTrainingResult;
  } catch {
    return null;
  }
}

function collectTrainingResults(response: ManifestStepResponse) {
  const entries = Object.entries(response.answers)
    .filter(([key]) => key.startsWith('rl_result:'))
    .map(([, value]) => parseTrainingResult(value))
    .filter(Boolean) as Unit55RlTrainingResult[];

  if (entries.length) return entries;
  const legacyResult = parseTrainingResult(response.answers.__rl_training_result);
  return legacyResult ? [legacyResult] : [];
}

function HeadingRlTeacherRanking({ responses }: { responses: TeacherResponseItem[] }) {
  const rows = responses
    .flatMap((item) => collectTrainingResults(item.response).map((result) => ({ studentName: item.studentName, result })))
    .sort((left, right) => left.result.metrics.rmsHeadingError - right.result.metrics.rmsHeadingError);

  return (
    <div className="premium-lesson-panel">
      <div className="premium-lesson-title text-base font-semibold leading-7">RMS 合并排名</div>
      <div className="mt-3 overflow-x-auto rounded-xl border border-border/70">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">排名</th><th className="px-3 py-2">学生</th><th className="px-3 py-2">训练类型</th><th className="px-3 py-2">RMS</th><th className="px-3 py-2">参数摘要</th><th className="px-3 py-2">安全退化</th></tr></thead>
          <tbody>
            {rows.length ? rows.map((row, index) => (
              <tr key={`${row.studentName}-${row.result.trainingType}-${row.result.seed}`} className="border-t">
                <td className="px-3 py-2">{index + 1}</td>
                <td className="px-3 py-2">{row.studentName}</td>
                <td className="px-3 py-2">{TRAINING_LABELS[row.result.trainingType]}</td>
                <td className="px-3 py-2">{row.result.metrics.rmsHeadingError.toFixed(2)}°</td>
                <td className="px-3 py-2">{Object.entries(row.result.selectedParameters).map(([key, value]) => `${key}=${value}`).join('，') || '-'}</td>
                <td className="px-3 py-2">{row.result.safetyFallbackCount}</td>
              </tr>
            )) : (
              <tr><td className="px-3 py-3 premium-lesson-muted" colSpan={6}>暂无训练结果提交。</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function UNIT_5_5TeacherActivitySummary({
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
  step: UNIT_5_5StepDefinition;
  manifest: InteractiveRuntimeManifest | null | undefined;
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
  const activeManifest = requireUnit55Manifest(manifest);
  const stepManifest = getUNIT_5_5ManifestStepFromManifest(activeManifest, step.id);
  if (stepManifest.interactionSpec.interactionKind === 'rust_heading_rl_training_panel') {
    return (
      <div className="space-y-4">
        <ManifestTeacherControls stepManifest={stepManifest} released={released} browseEnabled={browseEnabled} answerVisible={answerVisible} revealProgress={revealProgress} onToggleRelease={onToggleRelease} onToggleBrowse={onToggleBrowse} onToggleAnswerVisible={onToggleAnswerVisible} onAdvanceReveal={onAdvanceReveal} onResetReveal={onResetReveal} />
        <HeadingRlTeacherRanking responses={responses} />
      </div>
    );
  }

  return renderTeacherInteractiveActivity({
    registry: createManifestTeacherActivityRegistry<UNIT_5_5StepDefinition>(),
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
  });
}
