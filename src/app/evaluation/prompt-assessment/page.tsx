'use client';

import { useMemo, useState } from 'react';

interface AssessResponse {
  overallScore: number;
  dimensionScores: {
    completeness: number;
    precision: number;
    structurization: number;
    executability: number;
  };
  suggestions: Array<{
    dimension: string;
    issue: string;
    suggestion: string;
    example?: string;
  }>;
  metaPromptAnalysis: {
    detectedIntent: string;
    missingElements: string[];
    improvementPotential: number;
  };
}

interface ConsistencyResponse {
  consistencyScore: number;
  alignmentAnalysis: {
    statedGoals: string[];
    actualOptimization: string[];
    mismatches: string[];
  };
  processQuality: {
    iterationCount: number;
    convergencePattern: 'steady' | 'oscillating' | 'diverging';
    explorationBreadth: number;
  };
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
        <span>{label}</span>
        <span>{Math.round(value)}</span>
      </div>
      <div className="h-2 rounded bg-slate-800">
        <div className="h-2 rounded" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export default function PromptAssessmentPage() {
  const [structured, setStructured] = useState<Record<string, string>>({
    'control-object': '',
    'performance-goals': '',
    constraints: '',
    'design-context': '',
  });
  const [freeText, setFreeText] = useState('');
  const [assessment, setAssessment] = useState<AssessResponse | null>(null);
  const [consistency, setConsistency] = useState<ConsistencyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compiledPrompt = useMemo(() => {
    const sections = [
      `控制对象：${structured['control-object'] || '未填写'}`,
      `性能目标：${structured['performance-goals'] || '未填写'}`,
      `约束条件：${structured.constraints || '未填写'}`,
      `设计背景：${structured['design-context'] || '未填写'}`,
      freeText ? `补充说明：${freeText}` : '',
    ].filter(Boolean);
    return sections.join('\n');
  }, [structured, freeText]);

  const doAssessment = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/evaluation/assess-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: compiledPrompt,
          structuredData: structured,
          context: {
            taskType: 'controller-design',
            difficulty: 'intermediate',
          },
        }),
      });

      if (!response.ok) {
        throw new Error('评价失败');
      }

      const data = (await response.json()) as AssessResponse;
      setAssessment(data);
    } catch (evaluateError) {
      setError(evaluateError instanceof Error ? evaluateError.message : '评价失败');
    } finally {
      setLoading(false);
    }
  };

  const doConsistencyCheck = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/evaluation/track-consistency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'demo-user',
          designSessionId: 'demo-session',
          promptVersion: 1,
          promptContent: compiledPrompt,
          designActions: [
            { timestamp: Date.now() - 30000, action: 'adjust_kp', params: { kp: 1.4, kd: 0.2 } },
            { timestamp: Date.now() - 20000, action: 'adjust_kd', params: { kp: 1.2, kd: 0.6 } },
            { timestamp: Date.now() - 10000, action: 'adjust_ki', params: { kp: 1.1, ki: 0.2, kd: 0.55 } },
          ],
          finalResult: {
            overshoot: 16,
            settlingTime: 22,
            stabilityMargin: 34,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('一致性校验失败');
      }

      const data = (await response.json()) as ConsistencyResponse;
      setConsistency(data);
    } catch (consistencyError) {
      setError(consistencyError instanceof Error ? consistencyError.message : '一致性校验失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs uppercase tracking-[0.28em] text-amber-400">Structure Evaluated</p>
          <h1 className="mt-1 text-2xl font-semibold">元提示词评价与过程一致性</h1>
          <p className="mt-2 text-sm text-slate-400">
            先评估提示词质量，再追踪“提示结构-设计行为-结果达成”的一致性，支持过程化反馈。
          </p>
        </header>

        <section className="grid gap-4 lg:grid-cols-[380px_1fr]">
          <aside className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-lg font-medium">结构化提示词编辑器</h2>

            {[
              { key: 'control-object', label: '控制对象', required: true },
              { key: 'performance-goals', label: '性能目标', required: true },
              { key: 'constraints', label: '约束条件', required: true },
              { key: 'design-context', label: '设计背景', required: false },
            ].map((field) => (
              <label key={field.key} className="block text-xs text-slate-400">
                {field.label} {field.required ? <span className="text-rose-300">*</span> : null}
                <textarea
                  value={structured[field.key] ?? ''}
                  onChange={(event) => setStructured((prev) => ({ ...prev, [field.key]: event.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                />
              </label>
            ))}

            <label className="block text-xs text-slate-400">
              额外说明
              <textarea
                value={freeText}
                onChange={(event) => setFreeText(event.target.value)}
                rows={4}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
              />
            </label>

            <div className="space-y-2">
              <button
                type="button"
                onClick={doAssessment}
                disabled={loading}
                className="w-full rounded bg-amber-600 px-3 py-2 text-sm font-medium hover:bg-amber-500 disabled:opacity-60"
              >
                评价提示词质量
              </button>
              <button
                type="button"
                onClick={doConsistencyCheck}
                disabled={loading}
                className="w-full rounded bg-cyan-600 px-3 py-2 text-sm font-medium hover:bg-cyan-500 disabled:opacity-60"
              >
                过程一致性校验
              </button>
            </div>
          </aside>

          <main className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <h3 className="mb-2 text-base font-medium">提示词预览</h3>
              <pre className="whitespace-pre-wrap rounded bg-slate-950 p-3 text-sm leading-6 text-slate-200">{compiledPrompt}</pre>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <h3 className="mb-2 text-base font-medium">提示词质量仪表盘</h3>
                {assessment ? (
                  <div className="space-y-3">
                    <div className="rounded bg-slate-950 p-3 text-sm">
                      综合得分：
                      <span className="ml-2 text-xl font-semibold text-amber-300">{assessment.overallScore}</span>
                    </div>
                    <ScoreBar label="完整性" value={assessment.dimensionScores.completeness} color="#22c55e" />
                    <ScoreBar label="精确性" value={assessment.dimensionScores.precision} color="#0ea5e9" />
                    <ScoreBar label="结构化" value={assessment.dimensionScores.structurization} color="#a855f7" />
                    <ScoreBar label="可执行性" value={assessment.dimensionScores.executability} color="#f59e0b" />

                    <div className="space-y-2">
                      <div className="text-xs text-slate-400">改进建议</div>
                      {assessment.suggestions.length === 0 ? (
                        <div className="rounded bg-emerald-500/10 px-2 py-1 text-sm text-emerald-300">当前提示词质量较高。</div>
                      ) : (
                        assessment.suggestions.map((item) => (
                          <div key={`${item.dimension}-${item.issue}`} className="rounded bg-slate-950 px-2 py-1 text-sm text-slate-200">
                            <div className="font-medium text-slate-100">[{item.dimension}] {item.issue}</div>
                            <div>{item.suggestion}</div>
                            {item.example ? <div className="mt-1 text-xs text-slate-400">示例：{item.example}</div> : null}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded bg-slate-950 p-4 text-sm text-slate-400">尚未执行评价。</div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <h3 className="mb-2 text-base font-medium">一致性报告</h3>
                {consistency ? (
                  <div className="space-y-3 text-sm">
                    <div className="rounded bg-slate-950 p-3">
                      一致性得分：
                      <span className="ml-2 text-xl font-semibold text-cyan-300">{consistency.consistencyScore}</span>
                    </div>

                    <div>
                      <div className="mb-1 text-xs text-slate-400">声明目标</div>
                      <div className="flex flex-wrap gap-2">
                        {consistency.alignmentAnalysis.statedGoals.map((goal) => (
                          <span key={goal} className="rounded bg-emerald-500/20 px-2 py-1 text-xs text-emerald-300">{goal}</span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="mb-1 text-xs text-slate-400">实际优化方向</div>
                      <div className="flex flex-wrap gap-2">
                        {consistency.alignmentAnalysis.actualOptimization.map((goal) => (
                          <span key={goal} className="rounded bg-cyan-500/20 px-2 py-1 text-xs text-cyan-300">{goal}</span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="mb-1 text-xs text-slate-400">不一致项</div>
                      {consistency.alignmentAnalysis.mismatches.length === 0 ? (
                        <div className="rounded bg-emerald-500/10 px-2 py-1 text-emerald-300">未发现明显不一致。</div>
                      ) : (
                        consistency.alignmentAnalysis.mismatches.map((item) => (
                          <div key={item} className="rounded bg-rose-500/10 px-2 py-1 text-rose-300">
                            {item}
                          </div>
                        ))
                      )}
                    </div>

                    <div className="rounded bg-slate-950 p-3 text-xs text-slate-300">
                      迭代次数：{consistency.processQuality.iterationCount}；
                      收敛形态：{consistency.processQuality.convergencePattern}；
                      探索广度：{consistency.processQuality.explorationBreadth}
                    </div>
                  </div>
                ) : (
                  <div className="rounded bg-slate-950 p-4 text-sm text-slate-400">尚未执行一致性校验。</div>
                )}
              </section>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-400">
              {loading ? '正在计算评价结果...' : error ? `操作失败：${error}` : '提示：建议每次修改提示词后再次评价，形成版本迭代轨迹。'}
            </div>
          </main>
        </section>
      </div>
    </div>
  );
}
