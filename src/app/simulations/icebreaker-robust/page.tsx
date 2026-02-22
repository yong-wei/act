'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';
import { AICompanionPanel } from '@/features/ai/companion/ai-companion-panel';

const IcebreakerSimulation = dynamic(() => import('@/resources/simulations/simulations/icebreaker-simulation'), {
  ssr: false,
  loading: () => <div className="h-[640px] rounded-xl bg-slate-900/70 p-6 text-slate-300">正在加载破冰船鲁棒仿真...</div>,
});

interface RobustResponse {
  robustnessMetrics: {
    disturbanceRejection: number;
    parameterSensitivity: number;
    stabilityMargin: number;
  };
  scenarioResults: Array<{
    name: string;
    intensity: number;
    disturbanceRejection: number;
    parameterSensitivity: number;
    stabilityMargin: number;
  }>;
  recommendation: string;
}

export default function IcebreakerRobustPage() {
  const [uncertainty, setUncertainty] = useState({ paramKMin: 0.7, paramKMax: 1.2, paramTMin: 0.8, paramTMax: 1.3 });
  const [disturbance, setDisturbance] = useState([
    { name: '轻度冰阻', intensity: 1.2 },
    { name: '中度冰阻', intensity: 2.4 },
    { name: '强冲击冰阻', intensity: 3.8 },
  ]);
  const [analysis, setAnalysis] = useState<RobustResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/simulation/icebreaker-robust-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uncertaintyRange: {
            paramK: [uncertainty.paramKMin, uncertainty.paramKMax],
            paramT: [uncertainty.paramTMin, uncertainty.paramTMax],
          },
          disturbanceScenarios: disturbance,
          sampleCount: 120,
        }),
      });
      if (!response.ok) {
        throw new Error('鲁棒分析失败');
      }
      setAnalysis((await response.json()) as RobustResponse);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/95 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Icebreaker Robust Control</p>
            <h1 className="text-2xl font-semibold">破冰船鲁棒控制场景</h1>
          </div>
          <Link className="text-sm text-slate-300 hover:text-white" href="/simulations/icebreaker">
            返回破冰仿真
          </Link>
        </div>
      </header>

      <IcebreakerSimulation />

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-lg font-medium">鲁棒控制评估面板</h2>

          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ['K 最小', 'paramKMin'],
              ['K 最大', 'paramKMax'],
              ['T 最小', 'paramTMin'],
              ['T 最大', 'paramTMax'],
            ].map(([label, key]) => (
              <label key={key} className="text-xs text-slate-400">
                {label}
                <input
                  type="number"
                  step={0.05}
                  value={uncertainty[key as keyof typeof uncertainty]}
                  onChange={(event) =>
                    setUncertainty((prev) => ({
                      ...prev,
                      [key]: Number(event.target.value),
                    }))
                  }
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                />
              </label>
            ))}
          </div>

          <div className="space-y-2">
            {disturbance.map((item, index) => (
              <div key={item.name} className="grid grid-cols-[1fr_120px] items-center gap-2 rounded bg-slate-950 p-2 text-sm">
                <span>{item.name}</span>
                <input
                  type="number"
                  step={0.1}
                  value={item.intensity}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setDisturbance((prev) => prev.map((target, i) => (i === index ? { ...target, intensity: value } : target)));
                  }}
                  className="rounded border border-slate-700 bg-slate-900 px-2 py-1"
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void runAnalysis()}
            disabled={loading}
            className="rounded bg-cyan-600 px-4 py-2 text-sm font-medium hover:bg-cyan-500 disabled:opacity-60"
          >
            {loading ? '评估中...' : '执行鲁棒性评估'}
          </button>

          {analysis ? (
            <div className="space-y-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3">
              <div className="grid gap-2 text-sm sm:grid-cols-3">
                <div className="rounded bg-slate-950 px-2 py-1">扰动抑制: {analysis.robustnessMetrics.disturbanceRejection}</div>
                <div className="rounded bg-slate-950 px-2 py-1">参数敏感: {analysis.robustnessMetrics.parameterSensitivity}</div>
                <div className="rounded bg-slate-950 px-2 py-1">稳定裕度: {analysis.robustnessMetrics.stabilityMargin}</div>
              </div>

              <div className="space-y-1 text-sm text-slate-200">
                {analysis.scenarioResults.map((item) => (
                  <div key={item.name} className="rounded bg-slate-900/70 px-2 py-1">
                    {item.name} | 抑制 {item.disturbanceRejection} | 裕度 {item.stabilityMargin} | 敏感 {item.parameterSensitivity}
                  </div>
                ))}
              </div>

              <div className="rounded bg-slate-950 px-2 py-1 text-sm text-cyan-100">建议：{analysis.recommendation}</div>
            </div>
          ) : null}
        </div>

        <AICompanionPanel title="破冰船鲁棒控制" sessionId="icebreaker-robust-session" />
      </section>
    </div>
  );
}
