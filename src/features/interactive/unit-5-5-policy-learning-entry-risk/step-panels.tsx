'use client';

import { useEffect, useMemo, useState } from 'react';

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
  type Unit55RlTrainingState,
  type Unit55RlTrainingType,
} from './rl-training-runtime';

type TeacherResponseItem = { studentName: string; response: ManifestStepResponse };
type ContentRegistryExtra = {
  revealProgress: number;
  allowInlineReveal: boolean;
  onInlineReveal?: () => void;
};
type TrainingPhase = 'idle' | 'training' | 'stopped';
type ChartOverlay = { from: number; to: number; label: string; color: string };

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
  const manifestLabels = specs.find((item) => item.id === tab)?.parameterControls.filter((label) => !label.includes('训练轮数')) ?? [];
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

function tickValues(min: number, max: number, count = 5) {
  if (count <= 1) return [min];
  return Array.from({ length: count }, (_, index) => min + ((max - min) * index) / (count - 1));
}

function formatTick(value: number) {
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1).replace(/\.0$/, '');
  return value.toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
}

function renderOverlays({
  overlays,
  scaleX,
  plotTop,
  plotBottom,
}: {
  overlays: ChartOverlay[];
  scaleX: (value: number) => number;
  plotTop: number;
  plotBottom: number;
}) {
  return overlays.map((overlay) => {
    const x1 = scaleX(overlay.from);
    const x2 = scaleX(overlay.to);
    return (
      <g key={`${overlay.label}-${overlay.from}-${overlay.to}`}>
        <rect x={x1} y={plotTop} width={Math.max(1, x2 - x1)} height={plotBottom - plotTop} fill={overlay.color} opacity="0.12" />
        <text x={x1 + 4} y={plotTop + 14} className="fill-slate-500 text-[9px]">{overlay.label}</text>
      </g>
    );
  });
}

function SimpleLineChart({
  title,
  series,
  yDomain,
  xLabel,
  yLabel,
  overlays = [],
}: {
  title: string;
  series: Array<{ id: string; label: string; color: string; points: Array<{ x: number; y: number }>; dashed?: boolean }>;
  yDomain: [number, number];
  xLabel: string;
  yLabel: string;
  overlays?: ChartOverlay[];
}) {
  const allPoints = series.flatMap((item) => item.points);
  const maxX = Math.max(1, ...allPoints.map((point) => point.x));
  const minX = Math.min(0, ...allPoints.map((point) => point.x));
  const [minY, maxY] = yDomain;
  const plotLeft = 54;
  const plotRight = 616;
  const plotTop = 48;
  const plotBottom = 286;
  const scaleX = (value: number) => plotLeft + ((value - minX) / Math.max(1e-6, maxX - minX)) * (plotRight - plotLeft);
  const scaleY = (value: number) => plotBottom - ((value - minY) / Math.max(1e-6, maxY - minY)) * (plotBottom - plotTop);
  const scale = (point: { x: number; y: number }) => ({
    x: scaleX(point.x),
    y: scaleY(point.y),
  });
  const xTicks = tickValues(minX, maxX, 5);
  const yTicks = tickValues(minY, maxY, 5);

  return (
    <div className="rounded-xl border border-border/70 bg-white px-3 pb-3 pt-2" aria-label={title}>
      <svg viewBox="0 0 640 330" className="h-[330px] w-full">
        <text x={plotLeft} y="28" className="fill-slate-800 text-[15px] font-semibold">{title}</text>
        {renderOverlays({ overlays, scaleX, plotTop, plotBottom })}
        {yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line x1={plotLeft} y1={scaleY(tick)} x2={plotRight} y2={scaleY(tick)} stroke="#e2e8f0" />
            <text x={plotLeft - 8} y={scaleY(tick) + 3} textAnchor="end" className="fill-slate-500 text-[10px]">{formatTick(tick)}</text>
          </g>
        ))}
        {xTicks.map((tick) => (
          <g key={`x-${tick}`}>
            <line x1={scaleX(tick)} y1={plotTop} x2={scaleX(tick)} y2={plotBottom} stroke="#f1f5f9" />
            <text x={scaleX(tick)} y={plotBottom + 17} textAnchor="middle" className="fill-slate-500 text-[10px]">{formatTick(tick)}</text>
          </g>
        ))}
        <line x1={plotLeft} y1={plotBottom} x2={plotRight} y2={plotBottom} stroke="#94a3b8" />
        <line x1={plotLeft} y1={plotTop} x2={plotLeft} y2={plotBottom} stroke="#94a3b8" />
        <text x={plotRight} y="324" textAnchor="end" className="fill-slate-500 text-[10px]">{xLabel}</text>
        <text x="16" y={plotTop + 38} textAnchor="middle" className="fill-slate-500 text-[10px]" transform={`rotate(-90 16 ${plotTop + 38})`}>{yLabel}</text>
        {series.map((item) => (
          <path key={item.id} d={pathFrom(item.points, scale)} fill="none" stroke={item.color} strokeWidth="2.5" strokeDasharray={item.dashed ? '6 5' : undefined} />
        ))}
      </svg>
      <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 border-t border-slate-100 pt-2">
        {series.map((item) => (
          <div key={item.id} className="inline-flex items-center gap-2 text-[11px] text-slate-600">
            <span className="h-[3px] w-6 rounded-full" style={{ backgroundColor: item.color, opacity: item.dashed ? 0.75 : 1 }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function rewardSeries(points: Unit55RewardPoint[], visibleCount?: number) {
  const sliced = visibleCount ? points.slice(0, visibleCount) : points;
  return [
    { id: 'reward', label: '累计回报', color: '#0891b2', points: sliced.map((point) => ({ x: point.episode, y: point.reward })) },
    { id: 'average', label: '20 轮移动平均', color: '#f59e0b', points: sliced.map((point) => ({ x: point.episode, y: point.movingAverage })), dashed: true },
  ];
}

function rewardHistoryWithMovingAverage(points: Unit55RewardPoint[]) {
  return points.map((point, index) => {
    const window = points.slice(Math.max(0, index - 19), index + 1);
    return {
      ...point,
      movingAverage: window.reduce((sum, item) => sum + item.reward, 0) / window.length,
    };
  });
}

function resultWithRewardHistory(result: Unit55RlTrainingResult, history: Unit55RewardPoint[]) {
  const rewardCurve = rewardHistoryWithMovingAverage(history);
  const cumulativeReward = rewardCurve.at(-1)?.movingAverage ?? result.metrics.cumulativeReward;
  return {
    ...result,
    rewardCurve,
    metrics: {
      ...result.metrics,
      cumulativeReward,
    },
  };
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

function overlayRanges(trace: Unit55ComparisonPoint[]): ChartOverlay[] {
  const ranges: ChartOverlay[] = [];
  const appendRange = (from: number, to: number, label: string, color: string) => {
    if (to <= from) return;
    const previous = ranges[ranges.length - 1];
    if (previous?.label === label && Math.abs(previous.to - from) < 1e-6) {
      previous.to = to;
      return;
    }
    ranges.push({ from, to, label, color });
  };

  for (let index = 0; index < trace.length; index += 1) {
    const current = trace[index];
    const next = trace[index + 1] ?? current;
    if (Math.abs(current.disturbance ?? 0) > 0.01) {
      appendRange(current.t, next.t, '扰动作用', '#f97316');
    }
    if ((current.edgeScenario ?? 0) > 0.5) {
      appendRange(current.t, next.t, '边缘场景', '#7c3aed');
    }
  }

  return ranges;
}

function MetricGrid({ result }: { result: Unit55RlTrainingResult | null }) {
  const metrics = result?.metrics;
  const rows = [
    ['RMS 航向误差', metrics ? `${metrics.rmsHeadingError.toFixed(2)}°` : '-'],
    ['最大超调', metrics ? `${metrics.maxOvershoot.toFixed(2)}°` : '-'],
    ['调节时间', metrics ? `${metrics.settlingTime.toFixed(0)} s` : '-'],
    ['平均舵角', metrics ? `${metrics.averageRudder.toFixed(2)}°` : '-'],
    ['平均舵速', metrics ? `${metrics.averageRudderRate.toFixed(2)}°/s` : '-'],
    ['末端误差', metrics ? `${metrics.finalError.toFixed(2)}°` : '-'],
    ['移动平均回报', metrics ? metrics.cumulativeReward.toFixed(2) : '-'],
    ['安全退化次数', result ? String(result.safetyFallbackCount) : '-'],
  ];
  return (
    <div className="premium-lesson-surface-elevated h-full px-4 py-3">
      <div className="premium-lesson-title text-base font-semibold leading-7">数据面板</div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="border-b border-slate-100 pb-1">
            <div className="premium-lesson-caption text-[11px]">{label}</div>
            <div className="premium-lesson-title text-base font-semibold">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ToyTrainingPanel({ onPanelSubmit }: { onPanelSubmit?: (response: ManifestStepResponse) => void }) {
  const [phase, setPhase] = useState<TrainingPhase>('idle');
  const [episodeCount, setEpisodeCount] = useState(0);
  const [seed, setSeed] = useState(5505);
  const [trainingState, setTrainingState] = useState<Unit55RlTrainingState | null>(null);
  const [rewardHistory, setRewardHistory] = useState<Unit55RewardPoint[]>([]);
  const [pendingResult, setPendingResult] = useState<Unit55RlTrainingResult | null>(null);
  const [result, setResult] = useState<Unit55RlTrainingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chunkSize = 4;

  useEffect(() => {
    if (phase !== 'training') return undefined;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const nextEpisode = episodeCount + chunkSize;
      void computeUnit55RlTraining({
        panelKind: 'rust_toy_training_panel',
        trainingType: 'toy_rl',
        seed,
        trainingEpisodes: nextEpisode,
        episodeChunk: chunkSize,
        evaluate: false,
        trainingState,
        selectedParameters: { actionCost: 0.04, boundaryPenalty: 1.0 },
      }).then((next) => {
        if (cancelled) return;
        setTrainingState(next.trainingState);
        setRewardHistory((previous) => {
          const mergedHistory = rewardHistoryWithMovingAverage([...previous, ...next.rewardChunk]);
          setPendingResult(resultWithRewardHistory(next, mergedHistory));
          setEpisodeCount(mergedHistory.length);
          return mergedHistory;
        });
      }).catch((reason) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : String(reason));
        setPhase('idle');
      });
    }, episodeCount === 0 ? 0 : 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [episodeCount, phase, seed, trainingState]);

  const startTraining = async () => {
    setSeed(Date.now() % 100000);
    setPhase('training');
    setEpisodeCount(0);
    setTrainingState(null);
    setRewardHistory([]);
    setPendingResult(null);
    setResult(null);
    setError(null);
  };
  const stopTraining = async () => {
    if (!pendingResult || !trainingState) return;
    setPhase('stopped');
    try {
      const finalResult = await computeUnit55RlTraining({
        panelKind: 'rust_toy_training_panel',
        trainingType: 'toy_rl',
        seed,
        trainingEpisodes: episodeCount,
        episodeChunk: 0,
        evaluate: true,
        trainingState,
        selectedParameters: { actionCost: 0.04, boundaryPenalty: 1.0 },
      });
      const completedResult = resultWithRewardHistory(finalResult, rewardHistory);
      setTrainingState(finalResult.trainingState);
      setResult(completedResult);
      onPanelSubmit?.({
        stepId: 'step-08',
        submittedAt: Date.now(),
        answers: { __rl_training_result: JSON.stringify(completedResult) },
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setPhase('idle');
    }
  };
  const rewardResult = phase === 'training' ? pendingResult : result;
  const evaluationResult = phase === 'stopped' ? result : null;

  return (
    <section className="premium-lesson-panel space-y-4" data-testid="unit-5-5-toy-rl-training-panel">
      <div><div className="premium-lesson-kicker">实时训练面板</div><h3 className="premium-lesson-title mt-1 text-lg font-semibold">横向误差修正实时训练</h3></div>
      {error ? <div className="premium-lesson-tone-block premium-tone-rose text-sm">{error}</div> : null}
      <div className="grid gap-4 xl:grid-cols-2">
        <SimpleLineChart title="训练动态回报曲线" series={rewardSeries(rewardResult?.rewardCurve ?? [], episodeCount)} yDomain={[-24, -3]} xLabel="训练轮次" yLabel="回报" />
        <SimpleLineChart title="同一起点误差收敛对比" series={evaluationResult ? headingSeries(evaluationResult.comparisonTrace) : []} yDomain={[-0.2, 1.4]} xLabel="步数" yLabel="横向误差" />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void startTraining()} disabled={phase === 'training'} className="premium-lesson-action-tone premium-tone-cyan disabled:opacity-40">开始训练</button>
        <button type="button" onClick={() => void stopTraining()} disabled={!pendingResult || !trainingState || phase !== 'training'} className="premium-lesson-action-tone premium-tone-amber disabled:opacity-40">停止训练</button>
        <span className="premium-lesson-caption self-center text-xs">状态：{phase === 'idle' ? '未训练' : phase === 'training' ? `训练中，第 ${episodeCount} 轮` : '已停止并记录结果'}</span>
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
  const [episodeCountByTab, setEpisodeCountByTab] = useState<Record<string, number>>({});
  const [seedByTab, setSeedByTab] = useState<Record<string, number>>({});
  const [trainingStateByTab, setTrainingStateByTab] = useState<Partial<Record<Unit55RlTrainingType, Unit55RlTrainingState>>>({});
  const [rewardHistoryByTab, setRewardHistoryByTab] = useState<Partial<Record<Unit55RlTrainingType, Unit55RewardPoint[]>>>({});
  const [pendingResults, setPendingResults] = useState<Partial<Record<Unit55RlTrainingType, Unit55RlTrainingResult>>>({});
  const [results, setResults] = useState<Partial<Record<Unit55RlTrainingType, Unit55RlTrainingResult>>>({});
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
  const episodeCount = episodeCountByTab[activeTab] ?? 0;
  const activeSeed = seedByTab[activeTab] ?? 5515;
  const trainingState = trainingStateByTab[activeTab] ?? null;
  const rewardHistory = rewardHistoryByTab[activeTab] ?? [];
  const chunkSize = 3;

  useEffect(() => {
    if (!released || phase !== 'training') return undefined;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const nextEpisode = episodeCount + chunkSize;
      void computeUnit55RlTraining({
        panelKind: 'rust_heading_rl_training_panel',
        trainingType: activeTab,
        seed: activeSeed,
        trainingEpisodes: nextEpisode,
        episodeChunk: chunkSize,
        evaluate: false,
        trainingState,
        selectedParameters,
      }).then((next) => {
        if (cancelled) return;
        setTrainingStateByTab((prev) => ({ ...prev, [activeTab]: next.trainingState ?? undefined }));
        setRewardHistoryByTab((previousByTab) => {
          const previousHistory = previousByTab[activeTab] ?? [];
          const mergedHistory = rewardHistoryWithMovingAverage([...previousHistory, ...next.rewardChunk]);
          setPendingResults((prev) => ({ ...prev, [activeTab]: resultWithRewardHistory(next, mergedHistory) }));
          setEpisodeCountByTab((prev) => ({ ...prev, [activeTab]: mergedHistory.length }));
          return { ...previousByTab, [activeTab]: mergedHistory };
        });
      }).catch((reason) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : String(reason));
        setPhaseByTab((prev) => ({ ...prev, [activeTab]: 'idle' }));
      });
    }, episodeCount === 0 ? 0 : 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeSeed, activeTab, episodeCount, phase, released, selectedParameters, trainingState]);

  const startTraining = async () => {
    if (!released) return;
    const nextSeed = Date.now() % 100000;
    setSeedByTab((prev) => ({ ...prev, [activeTab]: nextSeed }));
    setEpisodeCountByTab((prev) => ({ ...prev, [activeTab]: 0 }));
    setTrainingStateByTab((prev) => ({ ...prev, [activeTab]: undefined }));
    setRewardHistoryByTab((prev) => ({ ...prev, [activeTab]: [] }));
    setPhaseByTab((prev) => ({ ...prev, [activeTab]: 'training' }));
    setPendingResults((prev) => ({ ...prev, [activeTab]: undefined }));
    setResults((prev) => ({ ...prev, [activeTab]: undefined }));
    setError(null);
  };
  const stopTraining = async () => {
    if (!pendingResult || !trainingState) return;
    setPhaseByTab((prev) => ({ ...prev, [activeTab]: 'stopped' }));
    try {
      const finalResult = await computeUnit55RlTraining({
        panelKind: 'rust_heading_rl_training_panel',
        trainingType: activeTab,
        seed: activeSeed,
        trainingEpisodes: episodeCount,
        episodeChunk: 0,
        evaluate: true,
        trainingState,
        selectedParameters,
      });
      const completedResult = resultWithRewardHistory(finalResult, rewardHistory);
      setTrainingStateByTab((prev) => ({ ...prev, [activeTab]: finalResult.trainingState ?? undefined }));
      setResults((prev) => ({ ...prev, [activeTab]: completedResult }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setPhaseByTab((prev) => ({ ...prev, [activeTab]: 'idle' }));
    }
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
  const overlays = evaluationResult ? overlayRanges(evaluationResult.comparisonTrace) : [];

  return (
    <section className="premium-lesson-panel space-y-4" data-testid="unit-5-5-heading-rl-training-panel">
      <div><div className="premium-lesson-kicker">三类航向策略训练</div><h3 className="premium-lesson-title mt-1 text-lg font-semibold">三类 RL 策略训练与 PID 基准评价</h3></div>
      {!released ? <div className="premium-lesson-tone-block premium-tone-amber text-sm">教师尚未发放训练与提交控制，当前可先阅读任务和评价口径。</div> : null}
      {error ? <div className="premium-lesson-tone-block premium-tone-rose text-sm">{error}</div> : null}
      <div className="grid gap-4 xl:grid-cols-2">
        <SimpleLineChart title="动态回报曲线" series={rewardSeries(rewardResult?.rewardCurve ?? [])} yDomain={[-240, -20]} xLabel="训练轮次" yLabel="回报" />
        <SimpleLineChart title="航向响应对比" series={evaluationResult ? headingSeries(evaluationResult.comparisonTrace) : []} yDomain={[-12, 18]} xLabel="时间 / s" yLabel="航向角 / deg" overlays={overlays} />
        <SimpleLineChart title="舵角输出对比" series={evaluationResult ? rudderSeries(evaluationResult.comparisonTrace) : []} yDomain={[-16, 16]} xLabel="时间 / s" yLabel="舵角 / deg" overlays={overlays} />
        <MetricGrid result={evaluationResult} />
      </div>
      <div className="premium-lesson-surface-elevated space-y-3 px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((tab) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`premium-lesson-action-tone px-3 py-1.5 text-sm ${activeTab === tab ? 'premium-tone-cyan' : 'premium-tone-slate'}`}>{manifestTabs.find((item) => item.id === tab)?.label ?? TRAINING_LABELS[tab]}</button>
          ))}
          <span className="premium-lesson-caption text-xs">当前：{tabLabel} · {phase === 'idle' ? '未训练' : phase === 'training' ? `训练中，第 ${episodeCount} 轮` : '已停止'}</span>
          <button type="button" onClick={() => void startTraining()} disabled={!released || phase === 'training'} className="premium-lesson-action-tone premium-tone-cyan px-3 py-1.5 text-sm disabled:opacity-40">开始训练</button>
          <button type="button" onClick={() => void stopTraining()} disabled={!released || phase !== 'training' || !pendingResult || !trainingState} className="premium-lesson-action-tone premium-tone-amber px-3 py-1.5 text-sm disabled:opacity-40">停止训练</button>
          <button type="button" onClick={submitResult} disabled={!released || phase !== 'stopped' || !result} className="premium-lesson-action-primary px-3 py-1.5 text-sm disabled:opacity-40">提交结果</button>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {activeControls.map((control) => (
            <label key={control.id} className="premium-lesson-control flex flex-col gap-1 px-3 py-2 text-sm">
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
