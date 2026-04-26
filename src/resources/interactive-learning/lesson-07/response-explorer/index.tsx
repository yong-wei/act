'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Activity, Gauge, Target, RefreshCw } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';
import {
  isInteractiveSimulationRuntimeReady,
  preloadInteractiveSimulationRuntime,
  runSecondOrderAnalyticResponse,
} from '@/resources/interactive-learning/rust/interactive-simulation-runtime';

interface Challenge {
  id: string;
  title: string;
  description: string;
  targetOvershoot: number;
  targetSettling: number;
}

const CHALLENGES: Challenge[] = [
  {
    id: 'stable',
    title: '挑战 1：稳而不过冲',
    description: '请将超调量控制在 10% 以内，同时调节时间不超过 5 秒。',
    targetOvershoot: 10,
    targetSettling: 5,
  },
  {
    id: 'fast',
    title: '挑战 2：快速收敛',
    description: '请让系统在 3 秒内进入 2% 误差带，并保持超调量低于 20%。',
    targetOvershoot: 20,
    targetSettling: 3,
  },
];

interface ResponseExplorerProps extends BaseWidgetProps {}

function computeResponse(zeta: number, wn: number, runtimeReady = isInteractiveSimulationRuntimeReady()) {
  const safeZeta = Math.min(0.95, Math.max(0.05, zeta));
  const safeWn = Math.max(0.05, wn);
  if (!runtimeReady) {
    return {
      points: [
        { t: 0, y: 0 },
        { t: 6, y: 0 },
      ],
      tMax: 6,
      overshoot: 0,
      peakTime: 0,
      settlingTime: 0,
      riseTime: 0,
      wd: 0,
    };
  }
  return runSecondOrderAnalyticResponse({ zeta: safeZeta, wn: safeWn, steps: 120 });
}

export default function ResponseExplorer({ onComplete, onStateChange }: ResponseExplorerProps) {
  const interactive = useOptionalInteractiveContext();
  const [zeta, setZeta] = useState(0.35);
  const [wn, setWn] = useState(2.0);
  const [completed, setCompleted] = useState<string[]>([]);
  const [runtimeReady, setRuntimeReady] = useState(isInteractiveSimulationRuntimeReady());

  useEffect(() => {
    let cancelled = false;
    preloadInteractiveSimulationRuntime().then(() => {
      if (!cancelled) {
        setRuntimeReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const response = useMemo(() => computeResponse(zeta, wn, runtimeReady), [zeta, wn, runtimeReady]);

  const maxY = useMemo(() => Math.max(1.2, ...response.points.map((p) => p.y)) + 0.1, [response.points]);

  const progressValue = Math.round((completed.length / CHALLENGES.length) * 100);

  const handleCompleteChallenge = useCallback(
    (challengeId: string) => {
      if (completed.includes(challengeId)) return;
      const next = [...completed, challengeId];
      setCompleted(next);
      const nextProgress = Math.round((next.length / CHALLENGES.length) * 100);
      const snapshot = {
        progress: nextProgress,
        data: { action: 'complete-challenge', challengeId },
        timestamp: Date.now(),
      };
      onStateChange?.(snapshot);
      interactive?.progress.setProgress(nextProgress);
      interactive?.tracking.emit('complete', snapshot.data);

      if (next.length === CHALLENGES.length) {
        const result: WidgetResult = {
          success: true,
          score: 100,
          data: { completed: next },
        };
        interactive?.progress.markComplete(result);
        onComplete?.(result);
      }
    },
    [completed, interactive, onComplete, onStateChange]
  );

  const handleReset = useCallback(() => {
    setZeta(0.35);
    setWn(2.0);
    setCompleted([]);
    onStateChange?.({
      progress: 0,
      data: { action: 'reset' },
      timestamp: Date.now(),
    });
    interactive?.progress.setProgress(0);
    interactive?.tracking.emit('interact', { action: 'reset' });
  }, [interactive, onStateChange]);

  const handleParamChange = useCallback(
    (nextZeta: number, nextWn: number) => {
      const snapshot = {
        progress: progressValue,
        data: { zeta: nextZeta, wn: nextWn },
        timestamp: Date.now(),
      };
      onStateChange?.(snapshot);
      interactive?.tracking.emit('param_change', snapshot.data);
    },
    [interactive, onStateChange, progressValue]
  );

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">参与式学习 · 衰减振荡实验室</p>
            <h2 className="text-2xl font-bold text-slate-900">响应曲线实时探索</h2>
            <p className="mt-2 text-sm text-slate-600">拖动阻尼比与自然频率，观察响应变化并完成挑战。</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            已完成挑战 {completed.length}/{CHALLENGES.length}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <svg viewBox="0 0 500 260" className="w-full h-64">
              <rect width="500" height="260" rx="16" fill="#0f172a" />
              <line x1="40" y1="210" x2="470" y2="210" stroke="#1f2937" strokeWidth="2" />
              <line x1="40" y1="40" x2="40" y2="210" stroke="#1f2937" strokeWidth="2" />
              <line x1="40" y1={210 - (1 / maxY) * 150} x2="470" y2={210 - (1 / maxY) * 150} stroke="#334155" strokeDasharray="6 6" />
              <path
                d={response.points
                  .map((point, idx) => {
                    const x = 40 + (point.t / response.tMax) * 430;
                    const y = 210 - (point.y / maxY) * 150;
                    return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                  })
                  .join(' ')}
                stroke="#38bdf8"
                strokeWidth="3"
                fill="none"
              />
              <text x="52" y="28" fill="#94a3b8" fontSize="12">单位阶跃响应</text>
              <text x="430" y="232" fill="#64748b" fontSize="10">时间</text>
              <text x="10" y="52" fill="#64748b" fontSize="10">幅值</text>
            </svg>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-600">
              <div className="rounded-lg border border-slate-100 bg-white px-3 py-2">
                <div className="flex items-center gap-2 text-slate-700 font-medium">
                  <Target className="h-4 w-4 text-emerald-500" />
                  超调量
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{response.overshoot.toFixed(1)}%</div>
              </div>
              <div className="rounded-lg border border-slate-100 bg-white px-3 py-2">
                <div className="flex items-center gap-2 text-slate-700 font-medium">
                  <Gauge className="h-4 w-4 text-sky-500" />
                  调节时间
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{response.settlingTime.toFixed(2)} s</div>
              </div>
              <div className="rounded-lg border border-slate-100 bg-white px-3 py-2">
                <div className="flex items-center gap-2 text-slate-700 font-medium">
                  <Activity className="h-4 w-4 text-amber-500" />
                  峰值时间
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{response.peakTime.toFixed(2)} s</div>
              </div>
              <div className="rounded-lg border border-slate-100 bg-white px-3 py-2">
                <div className="flex items-center gap-2 text-slate-700 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-violet-500" />
                  上升时间
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{response.riseTime.toFixed(2)} s</div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-100 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-700">参数控制</h3>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="text-xs text-slate-500">阻尼比 ζ: {zeta.toFixed(2)}</label>
                  <input
                    type="range"
                    min={0.05}
                    max={0.9}
                    step={0.01}
                    value={zeta}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      setZeta(next);
                      handleParamChange(next, wn);
                    }}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">自然频率 ω_n: {wn.toFixed(2)} rad/s</label>
                  <input
                    type="range"
                    min={0.6}
                    max={4.5}
                    step={0.05}
                    value={wn}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      setWn(next);
                      handleParamChange(zeta, next);
                    }}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {CHALLENGES.map((challenge) => {
              const isDone = completed.includes(challenge.id);
              const meetsOvershoot = response.overshoot <= challenge.targetOvershoot + 0.5;
              const meetsSettling = response.settlingTime <= challenge.targetSettling + 0.3;
              const isReady = meetsOvershoot && meetsSettling;

              return (
                <div key={challenge.id} className="rounded-xl border border-slate-100 bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-slate-700">{challenge.title}</h4>
                    {isDone && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" />
                        已完成
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{challenge.description}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                    <div className={`rounded-lg border px-2 py-1 ${meetsOvershoot ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50'}`}>
                      超调 ≤ {challenge.targetOvershoot}%
                    </div>
                    <div className={`rounded-lg border px-2 py-1 ${meetsSettling ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50'}`}>
                      t_s ≤ {challenge.targetSettling}s
                    </div>
                  </div>
                  <button
                    onClick={() => handleCompleteChallenge(challenge.id)}
                    disabled={!isReady || isDone}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white transition disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    完成挑战
                  </button>
                </div>
              );
            })}

            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-500 hover:border-slate-400"
            >
              <RefreshCw className="h-4 w-4" />
              重置参数
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
