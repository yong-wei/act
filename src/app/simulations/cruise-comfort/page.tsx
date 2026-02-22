'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';
import { AICompanionPanel } from '@/features/ai/companion/ai-companion-panel';

const CruiseSimulation = dynamic(() => import('@/resources/simulations/simulations/cruise-simulation'), {
  ssr: false,
  loading: () => <div className="h-[640px] rounded-xl bg-slate-900/70 p-6 text-slate-300">正在加载邮轮舒适度仿真...</div>,
});

interface CruiseAnalysisResponse {
  objectiveScores: {
    comfort: number;
    performance: number;
    energy: number;
  };
  blendedScore: number;
  advice: string[];
  currentDesign: {
    comfort: number;
    performance: number;
  };
}

export default function CruiseComfortPage() {
  const [weights, setWeights] = useState({ comfortWeight: 0.5, performanceWeight: 0.35, energyWeight: 0.15 });
  const [metrics, setMetrics] = useState({ msi: 12, settlingTime: 28, overshoot: 16, finPower: 220 });
  const [analysis, setAnalysis] = useState<CruiseAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/simulation/cruise-comfort-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectives: weights, metrics }),
      });
      if (!response.ok) {
        throw new Error('分析失败');
      }
      setAnalysis((await response.json()) as CruiseAnalysisResponse);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/95 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-violet-300">Cruise Comfort Control</p>
            <h1 className="text-2xl font-semibold">邮轮舒适度控制场景</h1>
          </div>
          <Link className="text-sm text-slate-300 hover:text-white" href="/simulations/cruise">
            返回邮轮仿真
          </Link>
        </div>
      </header>

      <CruiseSimulation />

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-lg font-medium">多目标权衡面板（舒适度 vs 操控性 vs 能耗）</h2>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['舒适权重', 'comfortWeight'],
              ['性能权重', 'performanceWeight'],
              ['能耗权重', 'energyWeight'],
            ].map(([label, key]) => (
              <label key={key} className="text-xs text-slate-400">
                {label}
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={weights[key as keyof typeof weights]}
                  onChange={(event) =>
                    setWeights((prev) => ({
                      ...prev,
                      [key]: Number(event.target.value),
                    }))
                  }
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                />
              </label>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ['MSI', 'msi'],
              ['调节时间(s)', 'settlingTime'],
              ['超调(%)', 'overshoot'],
              ['减摇鳍功率(kW)', 'finPower'],
            ].map(([label, key]) => (
              <label key={key} className="text-xs text-slate-400">
                {label}
                <input
                  type="number"
                  step={1}
                  value={metrics[key as keyof typeof metrics]}
                  onChange={(event) =>
                    setMetrics((prev) => ({
                      ...prev,
                      [key]: Number(event.target.value),
                    }))
                  }
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                />
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void runAnalysis()}
            disabled={loading}
            className="rounded bg-violet-600 px-4 py-2 text-sm font-medium hover:bg-violet-500 disabled:opacity-60"
          >
            {loading ? '分析中...' : '计算权衡得分'}
          </button>

          {analysis ? (
            <div className="space-y-3 rounded-xl border border-violet-500/30 bg-violet-500/10 p-3">
              <div className="text-sm">
                综合评分：<span className="text-xl font-semibold text-violet-200">{analysis.blendedScore}</span>
              </div>
              <div className="grid gap-2 text-sm sm:grid-cols-3">
                <div className="rounded bg-slate-950 px-2 py-1">舒适: {analysis.objectiveScores.comfort}</div>
                <div className="rounded bg-slate-950 px-2 py-1">性能: {analysis.objectiveScores.performance}</div>
                <div className="rounded bg-slate-950 px-2 py-1">能耗: {analysis.objectiveScores.energy}</div>
              </div>
              <ul className="space-y-1 text-sm text-slate-200">
                {analysis.advice.map((item) => (
                  <li key={item} className="rounded bg-slate-900/70 px-2 py-1">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <AICompanionPanel title="邮轮舒适度控制" sessionId="cruise-comfort-session" />
      </section>
    </div>
  );
}
