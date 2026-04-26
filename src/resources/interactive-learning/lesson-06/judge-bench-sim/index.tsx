'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Award, Clock, Gauge, Sparkles, TrendingUp } from 'lucide-react';
import { JUDGE_THRESHOLDS } from '../types';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';
import {
  preloadInteractiveSimulationRuntime,
  runSecondOrderStepResponse,
} from '@/resources/interactive-learning/rust/interactive-simulation-runtime';

interface SimulationMetrics {
  riseTime: number | null;
  peakTime: number | null;
  settlingTime: number | null;
  overshoot: number;
  steadyStateError: number;
  peakValue: number;
}

interface SimulationResult {
  times: number[];
  values: number[];
  metrics: SimulationMetrics;
}

const TARGET = 1;

const EMPTY_RESULT: SimulationResult = {
  times: [0],
  values: [0],
  metrics: {
    riseTime: null,
    peakTime: null,
    settlingTime: null,
    overshoot: 0,
    steadyStateError: 1,
    peakValue: 0,
  },
};

const formatValue = (value: number | null, unit: string) =>
  value === null || Number.isNaN(value) ? '--' : `${value.toFixed(2)}${unit}`;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function simulateStepResponse(zeta: number, omega: number, duration: number, dt: number): SimulationResult {
  return runSecondOrderStepResponse({ zeta, omega, duration, dt });
}

function buildPath(values: number[], width: number, height: number) {
  const maxValue = Math.max(...values, TARGET * 1.1);
  const minValue = Math.min(...values, 0);
  const range = maxValue - minValue || 1;

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - minValue) / range) * height;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

function computeScore(metrics: SimulationMetrics) {
  const overshootPenalty = clamp(metrics.overshoot / JUDGE_THRESHOLDS.overshoot, 0, 2) * 20;
  const settlePenalty = clamp((metrics.settlingTime ?? 0) / JUDGE_THRESHOLDS.settlingTime, 0, 2) * 25;
  const risePenalty = clamp((metrics.riseTime ?? 0) / JUDGE_THRESHOLDS.riseTime, 0, 2) * 20;
  const steadyPenalty = clamp(metrics.steadyStateError / JUDGE_THRESHOLDS.steadyStateError, 0, 2) * 35;
  return Math.round(clamp(100 - (overshootPenalty + settlePenalty + risePenalty + steadyPenalty), 0, 100));
}

function buildAdvice(metrics: SimulationMetrics) {
  const advices: string[] = [];
  if (metrics.overshoot > JUDGE_THRESHOLDS.overshoot) {
    advices.push('超调偏大：增大阻尼比 ζ，减少“冲过头”。');
  }
  if ((metrics.settlingTime ?? 0) > JUDGE_THRESHOLDS.settlingTime) {
    advices.push('调节时间偏长：提高 ω_n 或适度降低阻尼比以加快响应。');
  }
  if ((metrics.riseTime ?? 0) > JUDGE_THRESHOLDS.riseTime) {
    advices.push('上升时间偏长：提高 ω_n，提升系统反应速度。');
  }
  if (metrics.steadyStateError > JUDGE_THRESHOLDS.steadyStateError) {
    advices.push('稳态误差偏大：需要更高系统增益或引入积分补偿。');
  }
  return advices.length ? advices : ['指标表现均衡，判分优秀。保持当前策略。'];
}

interface JudgeBenchSimProps extends BaseWidgetProps {}

export default function JudgeBenchSim({ onComplete, onStateChange }: JudgeBenchSimProps) {
  const interactive = useOptionalInteractiveContext();
  const [zeta, setZeta] = useState(0.45);
  const [omega, setOmega] = useState(4.5);
  const [duration, setDuration] = useState(6);
  const [result, setResult] = useState<SimulationResult>(EMPTY_RESULT);

  const score = useMemo(() => computeScore(result.metrics), [result.metrics]);
  const advices = useMemo(() => buildAdvice(result.metrics), [result.metrics]);

  const handleRun = useCallback(async () => {
    await preloadInteractiveSimulationRuntime();
    const nextResult = simulateStepResponse(zeta, omega, duration, 0.01);
    setResult(nextResult);
    interactive?.tracking.emit('submit', {
      zeta,
      omega,
      duration,
      metrics: nextResult.metrics,
    });
  }, [zeta, omega, duration, interactive]);

  useEffect(() => {
    let cancelled = false;
    preloadInteractiveSimulationRuntime().then(() => {
      if (!cancelled) {
        setResult(simulateStepResponse(zeta, omega, duration, 0.01));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [duration, omega, zeta]);

  const pass = result.metrics.overshoot <= JUDGE_THRESHOLDS.overshoot
    && (result.metrics.settlingTime ?? 0) <= JUDGE_THRESHOLDS.settlingTime
    && result.metrics.steadyStateError <= JUDGE_THRESHOLDS.steadyStateError;

  const chartPath = useMemo(() => buildPath(result.values, 520, 260), [result.values]);

  useEffect(() => {
    const snapshot = {
      progress: score,
      data: {
        zeta,
        omega,
        duration,
        pass,
        metrics: result.metrics,
      },
      timestamp: Date.now(),
    };
    onStateChange?.(snapshot);
    interactive?.progress.setProgress(score);

    if (pass && !interactive?.progress.isComplete) {
      const completion: WidgetResult = {
        success: true,
        score,
        data: snapshot.data,
      };
      interactive?.progress.markComplete(completion);
      onComplete?.(completion);
    }
  }, [result, score, pass, zeta, omega, duration, interactive, onComplete, onStateChange]);

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">裁判席计分器</h2>
          <p className="text-sm text-slate-500">通过调节阻尼比与响应速度，达成裁判指标标准</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${pass ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
            {pass ? '判定：达标' : '判定：待改进'}
          </span>
          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
            得分 {score}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">裁判参数</h3>
            <div className="space-y-4">
              <label className="block">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>阻尼比 ζ</span>
                  <span className="font-mono">{zeta.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.2"
                  step="0.05"
                  value={zeta}
                  onChange={(e) => setZeta(parseFloat(e.target.value))}
                  className="mt-2 w-full accent-emerald-500"
                />
              </label>
              <label className="block">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>自然频率 ω_n</span>
                  <span className="font-mono">{omega.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="8"
                  step="0.1"
                  value={omega}
                  onChange={(e) => setOmega(parseFloat(e.target.value))}
                  className="mt-2 w-full accent-blue-500"
                />
              </label>
              <label className="block">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>观测时长 (s)</span>
                  <span className="font-mono">{duration.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="10"
                  step="0.5"
                  value={duration}
                  onChange={(e) => setDuration(parseFloat(e.target.value))}
                  className="mt-2 w-full accent-slate-600"
                />
              </label>
            </div>
            <button
              onClick={handleRun}
              className="mt-4 w-full rounded-lg bg-slate-900 py-2 text-sm font-semibold text-white"
            >
              重新判分
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">裁判标准</h3>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>超调量 ≤ {JUDGE_THRESHOLDS.overshoot}%</span>
                <span className={result.metrics.overshoot <= JUDGE_THRESHOLDS.overshoot ? 'text-emerald-600' : 'text-rose-600'}>
                  {result.metrics.overshoot.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>调节时间 ≤ {JUDGE_THRESHOLDS.settlingTime}s</span>
                <span className={(result.metrics.settlingTime ?? 0) <= JUDGE_THRESHOLDS.settlingTime ? 'text-emerald-600' : 'text-rose-600'}>
                  {formatValue(result.metrics.settlingTime, 's')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>上升时间 ≤ {JUDGE_THRESHOLDS.riseTime}s</span>
                <span className={(result.metrics.riseTime ?? 0) <= JUDGE_THRESHOLDS.riseTime ? 'text-emerald-600' : 'text-rose-600'}>
                  {formatValue(result.metrics.riseTime, 's')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>稳态误差 ≤ {JUDGE_THRESHOLDS.steadyStateError}</span>
                <span className={result.metrics.steadyStateError <= JUDGE_THRESHOLDS.steadyStateError ? 'text-emerald-600' : 'text-rose-600'}>
                  {result.metrics.steadyStateError.toFixed(3)}
                </span>
              </div>
            </div>
          </div>
        </aside>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">响应曲线</h3>
              <p className="text-xs text-slate-500">标准二阶阶跃响应（目标值 = 1）</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <TrendingUp className="h-4 w-4" />
              峰值 {result.metrics.peakValue.toFixed(2)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-950/90 p-4">
            <svg viewBox="0 0 520 260" className="w-full h-[260px]">
              <rect width="520" height="260" fill="#0b1120" rx="12" />
              <line x1="0" y1="180" x2="520" y2="180" stroke="#1f2937" strokeDasharray="6 6" />
              <path d={chartPath} stroke="#38bdf8" strokeWidth="3" fill="none" />
            </svg>
          </div>

          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricBadge label="上升时间" value={formatValue(result.metrics.riseTime, 's')} icon={TrendingUp} />
            <MetricBadge label="峰值时间" value={formatValue(result.metrics.peakTime, 's')} icon={Clock} />
            <MetricBadge label="调节时间" value={formatValue(result.metrics.settlingTime, 's')} icon={Gauge} />
            <MetricBadge label="超调量" value={`${result.metrics.overshoot.toFixed(1)}%`} icon={Award} />
          </div>

          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Sparkles className="h-4 w-4 text-amber-500" />
              AI 裁判建议
            </div>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {advices.map((advice) => (
                <li key={advice}>• {advice}</li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricBadge({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Award;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

export { JudgeBenchSim };
