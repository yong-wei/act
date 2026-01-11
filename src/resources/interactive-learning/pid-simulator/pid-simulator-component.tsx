
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Chart from 'chart.js/auto';
import { ArrowLeft, Play, RefreshCcw } from 'lucide-react';
import { createLinearPlant, type TransferFunctionModel } from '@/lib/simulation';

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

interface PidSimulatorComponentProps {
  kp?: number;
  ki?: number;
  kd?: number;
  model?: string; // string type to allow dynamic input
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

export function PidSimulatorComponent({
  kp: initialKp = 1.2,
  ki: initialKi = 0.1,
  kd: initialKd = 0.25,
  model: initialModel = 'ship',
  showBackLink = false,
  embedded = false,
  onStateChange,
  onComplete,
}: PidSimulatorComponentProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  const [modelKey, setModelKey] = useState<ModelKey>((initialModel as ModelKey) || 'ship');
  const [kp, setKp] = useState(initialKp);
  const [ki, setKi] = useState(initialKi);
  const [kd, setKd] = useState(initialKd);
  const [reference, setReference] = useState(1);
  const [stepSize, setStepSize] = useState(50);
  const [timeScale, setTimeScale] = useState(1);

  const modelInfo = useMemo(() => MODEL_CONFIG[modelKey] || MODEL_CONFIG['ship'], [modelKey]);

  useEffect(() => {
    if (!chartRef.current) return;
    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    chartInstance.current?.destroy();
    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: '系统响应',
            data: [],
            borderColor: '#38bdf8',
            borderWidth: 2,
            tension: 0.2,
            pointRadius: 0,
          },
          {
            label: '设定值',
            data: [],
            borderColor: '#f59e0b',
            borderDash: [6, 6],
            borderWidth: 2,
            tension: 0.2,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: {
            title: { display: true, text: '时间 (s)' },
            ticks: { color: '#94a3b8' },
            grid: { color: 'rgba(148,163,184,0.15)' },
          },
          y: {
            title: { display: true, text: '输出' },
            ticks: { color: '#94a3b8' },
            grid: { color: 'rgba(148,163,184,0.15)' },
          },
        },
        plugins: {
          legend: {
            labels: {
              color: '#e2e8f0',
            },
          },
        },
      },
    });
  }, []);

  const runSimulation = useCallback(() => {
    if (!chartInstance.current) return;

    const dt = Math.max(stepSize, 20) / 1000;
    const duration = 20 * timeScale;
    const steps = Math.floor(duration / dt);

    const plant = createLinearPlant(getPlantModel(modelKey), dt);
    let y = 0;
    let prevError = 0;
    let integral = 0;

    const responseData: number[] = [];
    const setpointData: number[] = [];
    const labels: string[] = [];

    for (let i = 0; i <= steps; i += 1) {
      const t = i * dt;
      const error = reference - y;
      integral += error * dt;
      const derivative = (error - prevError) / dt;

      const control = kp * error + ki * integral + kd * derivative;
      const plantStep = plant.step([control]);
      y = plantStep.output[0] ?? 0;

      prevError = error;

      responseData.push(y);
      setpointData.push(reference);
      labels.push(t.toFixed(2));
    }

    chartInstance.current.data.labels = labels;
    chartInstance.current.data.datasets[0].data = responseData;
    chartInstance.current.data.datasets[1].data = setpointData;
    chartInstance.current.update();

    // Calculate performance metrics
    const finalValue = responseData[responseData.length - 1] || 0;
    const steadyStateError = Math.abs(reference - finalValue);
    const maxOvershoot = Math.max(...responseData) - reference;
    const overshootPercent = reference !== 0 ? (maxOvershoot / reference) * 100 : 0;

    // Emit state change
    onStateChange?.({
      phase: 'simulation-complete',
      progress: 100,
      data: {
        kp,
        ki,
        kd,
        model: modelKey,
        reference,
        finalValue,
        steadyStateError,
        overshootPercent: Math.max(0, overshootPercent),
      },
      timestamp: Date.now(),
    });

    // Call onComplete if simulation ran successfully
    onComplete?.({
      success: true,
      score: steadyStateError < 0.05 && overshootPercent < 20 ? 100 : 70,
      data: { steadyStateError, overshootPercent },
    });
  }, [kd, ki, kp, modelKey, reference, stepSize, timeScale, onStateChange, onComplete]);

  const handleReset = () => {
    setModelKey((initialModel as ModelKey) || 'ship');
    setKp(initialKp);
    setKi(initialKi);
    setKd(initialKd);
    setReference(1);
    setStepSize(50);
    setTimeScale(1);
    if (chartInstance.current) {
      chartInstance.current.data.labels = [];
      chartInstance.current.data.datasets[0].data = [];
      chartInstance.current.data.datasets[1].data = [];
      chartInstance.current.update();
    }
  };

  return (
    <div className="h-full w-full bg-slate-950 text-slate-100 flex flex-col">
      {/* Header - hidden in embedded mode */}
      {!embedded && (
        <header className="border-b border-slate-800 flex-none">
          <div className="container mx-auto flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              {showBackLink && (
                  <Link
                  href="/interactive-learning"
                  className="flex items-center gap-2 text-slate-400 transition-colors hover:text-white"
                  >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="text-sm">返回</span>
                  </Link>
              )}
              {showBackLink && <div className="h-4 w-px bg-slate-700" />}
              <div>
                <h1 className="text-lg font-semibold text-white">PID 控制仿真器</h1>
                <p className="text-xs text-slate-400">多对象动态响应与参数调参</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800"
              >
                <RefreshCcw className="h-4 w-4" />
                重置
              </button>
              <button
                onClick={runSimulation}
                className="flex items-center gap-2 rounded-lg border border-cyan-500/60 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-100 transition hover:border-cyan-400"
              >
                <Play className="h-4 w-4" />
                运行仿真
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Embedded mode toolbar */}
      {embedded && (
        <div className="border-b border-slate-800 bg-slate-900/50 px-4 py-2 flex items-center justify-between">
          <span className="text-sm text-slate-400">PID 控制仿真器</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-800"
            >
              <RefreshCcw className="h-3 w-3" />
            </button>
            <button
              onClick={runSimulation}
              className="flex items-center gap-1 rounded bg-cyan-500/20 px-2 py-1 text-xs text-cyan-300 hover:bg-cyan-500/30"
            >
              <Play className="h-3 w-3" />
              运行
            </button>
          </div>
        </div>
      )}

      <main className="container mx-auto grid gap-6 px-6 py-6 lg:grid-cols-[320px_1fr] flex-1 min-h-0 overflow-y-auto">
        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">对象模型</h2>
                <p className="text-xs text-slate-400">选择模拟的控制对象</p>
              </div>
              <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-200">
                {modelInfo.tag}
              </span>
            </div>
            <select
              value={modelKey}
              onChange={(event) => setModelKey(event.target.value as ModelKey)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-400"
            >
              {Object.entries(MODEL_CONFIG).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.title}
                </option>
              ))}
            </select>
            <p className="mt-3 text-xs text-slate-400">{modelInfo.description}</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="text-sm font-semibold text-white">PID 参数</h2>
            <div className="mt-4 grid gap-3 text-sm">
              <label className="flex items-center justify-between gap-2">
                <span className="text-slate-400">Kp</span>
                <input
                  type="number"
                  value={kp}
                  step="0.1"
                  onChange={(event) => setKp(Number(event.target.value))}
                  className="w-24 rounded-lg border border-slate-700 bg-slate-950/70 px-2 py-1 text-right text-slate-100 outline-none focus:border-cyan-400"
                />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span className="text-slate-400">Ki</span>
                <input
                  type="number"
                  value={ki}
                  step="0.05"
                  onChange={(event) => setKi(Number(event.target.value))}
                  className="w-24 rounded-lg border border-slate-700 bg-slate-950/70 px-2 py-1 text-right text-slate-100 outline-none focus:border-cyan-400"
                />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span className="text-slate-400">Kd</span>
                <input
                  type="number"
                  value={kd}
                  step="0.05"
                  onChange={(event) => setKd(Number(event.target.value))}
                  className="w-24 rounded-lg border border-slate-700 bg-slate-950/70 px-2 py-1 text-right text-slate-100 outline-none focus:border-cyan-400"
                />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span className="text-slate-400">目标值</span>
                <input
                  type="number"
                  value={reference}
                  step="0.1"
                  onChange={(event) => setReference(Number(event.target.value))}
                  className="w-24 rounded-lg border border-slate-700 bg-slate-950/70 px-2 py-1 text-right text-slate-100 outline-none focus:border-cyan-400"
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="text-sm font-semibold text-white">仿真配置</h2>
            <div className="mt-4 grid gap-3 text-sm">
              <label className="flex items-center justify-between gap-2">
                <span className="text-slate-400">步长 (ms)</span>
                <input
                  type="number"
                  value={stepSize}
                  step="10"
                  min={20}
                  onChange={(event) => setStepSize(Number(event.target.value))}
                  className="w-24 rounded-lg border border-slate-700 bg-slate-950/70 px-2 py-1 text-right text-slate-100 outline-none focus:border-cyan-400"
                />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span className="text-slate-400">时间倍率</span>
                <input
                  type="number"
                  value={timeScale}
                  step="0.5"
                  min={0.5}
                  onChange={(event) => setTimeScale(Number(event.target.value))}
                  className="w-24 rounded-lg border border-slate-700 bg-slate-950/70 px-2 py-1 text-right text-slate-100 outline-none focus:border-cyan-400"
                />
              </label>
            </div>
          </div>
        </aside>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 flex flex-col min-h-0">
          <div className="flex items-center justify-between flex-none">
            <div>
              <h2 className="text-lg font-semibold text-white">响应曲线</h2>
              <p className="text-xs text-slate-400">
                观察系统输出与设定值的动态变化
              </p>
            </div>
            <div className="text-xs text-slate-500">
              当前模型：{modelInfo.title}
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3 flex-1 min-h-0 relative">
            <canvas ref={chartRef} className="absolute inset-0 w-full h-full" />
          </div>
        </section>
      </main>
    </div>
  );
}
