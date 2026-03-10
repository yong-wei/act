'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

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

interface PromptHistoryEntry {
  userId: string;
  sessionId: string;
  promptContent: string;
  assessment: AssessResponse;
  consistency?: ConsistencyResponse;
  version: number;
  createdAt: number;
}

interface PromptHistoryApiResponse {
  history: PromptHistoryEntry[];
  total: number;
}

interface AbilityReportResponse {
  userId: string;
  estimatedAbility: number;
  confidenceInterval: [number, number];
  timeline: Array<{ timestamp: number; theta: number; accuracy: number }>;
  dimensions: {
    computationalTheta: number;
    crossDomainTheta: number;
    designTheta: number;
  };
}

const DEMO_USER_ID = 'demo-user';
const DEMO_SESSION_ID = 'report-demo-session';
const DEMO_AUTOFILL_STRUCTURED = {
  'control-object': '邮轮航向控制系统',
  'performance-goals': '超调 < 15%，调节时间 < 20s，稳态误差 < 2%',
  constraints: '稳定裕度 > 30°，满足舒适度约束',
  'design-context': '风浪扰动 + 参数不确定条件',
};
const DEMO_AUTOFILL_TEXT = '按“约束优先-跨域映射-参数迭代”的顺序输出调参方案与验证指标。';

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

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

export default function PromptAssessmentPage() {
  const searchParams = useSearchParams();
  const autoDemo = searchParams.get('autodemo') === '1';
  const [autoSeeded, setAutoSeeded] = useState(false);

  const [structured, setStructured] = useState<Record<string, string>>({
    'control-object': '',
    'performance-goals': '',
    constraints: '',
    'design-context': '',
  });
  const [freeText, setFreeText] = useState('');
  const [assessment, setAssessment] = useState<AssessResponse | null>(null);
  const [consistency, setConsistency] = useState<ConsistencyResponse | null>(null);
  const [historyRecords, setHistoryRecords] = useState<PromptHistoryEntry[]>([]);
  const [abilityReport, setAbilityReport] = useState<AbilityReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [trendLoading, setTrendLoading] = useState(false);
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

  const latestHistory = useMemo(() => historyRecords.slice(-6), [historyRecords]);
  const latestRecord = latestHistory[latestHistory.length - 1] ?? null;
  const consistencyScores = latestHistory
    .map((record) => record.consistency?.consistencyScore)
    .filter((score): score is number => typeof score === 'number');

  const loadTrendData = useCallback(async () => {
    setTrendLoading(true);

    try {
      const [historyResponse, abilityResponse] = await Promise.all([
        fetch(`/api/evaluation/prompt-history/${encodeURIComponent(DEMO_USER_ID)}`),
        fetch(`/api/assessment/ability-report/${encodeURIComponent(DEMO_USER_ID)}`),
      ]);

      if (!historyResponse.ok || !abilityResponse.ok) {
        throw new Error('趋势数据拉取失败');
      }

      const historyJson = (await historyResponse.json()) as PromptHistoryApiResponse;
      const abilityJson = (await abilityResponse.json()) as AbilityReportResponse;

      setHistoryRecords(historyJson.history ?? []);
      setAbilityReport(abilityJson);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '趋势数据加载失败');
    } finally {
      setTrendLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTrendData();
  }, [loadTrendData]);

  const doAssessment = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/evaluation/assess-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: DEMO_USER_ID,
          sessionId: DEMO_SESSION_ID,
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
      await loadTrendData();
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
          userId: DEMO_USER_ID,
          designSessionId: DEMO_SESSION_ID,
          promptVersion: latestRecord?.version ?? 1,
          promptContent: compiledPrompt,
          designActions: [
            { timestamp: Date.now() - 42000, action: 'adjust_kp', params: { kp: 1.6, kd: 0.18 } },
            { timestamp: Date.now() - 30000, action: 'adjust_bandwidth', params: { kp: 1.25, kd: 0.5 } },
            { timestamp: Date.now() - 18000, action: 'adjust_ki', params: { kp: 1.08, ki: 0.18, kd: 0.58 } },
            { timestamp: Date.now() - 7000, action: 'validate_margin', params: { kp: 1.05, ki: 0.21, kd: 0.6 } },
          ],
          finalResult: {
            overshoot: 14,
            settlingTime: 18,
            stabilityMargin: 36,
            comfortIndex: 1.5,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('一致性校验失败');
      }

      const data = (await response.json()) as ConsistencyResponse;
      setConsistency(data);
      await loadTrendData();
    } catch (consistencyError) {
      setError(consistencyError instanceof Error ? consistencyError.message : '一致性校验失败');
    } finally {
      setLoading(false);
    }
  };

  const seedDemoHistory = useCallback(async () => {
    setLoading(true);
    setError(null);

    const demoCases = [
      {
        structuredData: {
          'control-object': '邮轮航向控制系统',
          'performance-goals': '超调 < 18%，调节时间 < 25s',
          constraints: '相位裕度 > 30°，MSI 风险受限',
          'design-context': '横浪工况 + 参数摄动 20%',
        },
        freeText: '先建立极点-频域-时域映射，再给出 PID 与带宽协同调参步骤。',
      },
      {
        structuredData: {
          'control-object': '破冰船航向保持回路',
          'performance-goals': '超调 < 15%，稳态误差 < 2%',
          constraints: '推进器功率限制，鲁棒性优先',
          'design-context': '冰阻力周期扰动 + 传感噪声',
        },
        freeText: '比较两组参数并输出稳定裕度与抗扰结果。',
      },
      {
        structuredData: {
          'control-object': '动力定位侧推系统',
          'performance-goals': '定位偏差 < 0.4m，响应平稳',
          constraints: '扰动峰值不超过阈值，控制能耗受限',
          'design-context': '风浪流耦合环境',
        },
        freeText: '给出多目标权衡策略，明确输入、步骤和输出。',
      },
    ];

    try {
      let lastAssessment: AssessResponse | null = null;
      let lastConsistency: ConsistencyResponse | null = null;

      for (let index = 0; index < demoCases.length; index += 1) {
        const item = demoCases[index];
        const prompt = [
          `控制对象：${item.structuredData['control-object']}`,
          `性能目标：${item.structuredData['performance-goals']}`,
          `约束条件：${item.structuredData.constraints}`,
          `设计背景：${item.structuredData['design-context']}`,
          `补充说明：${item.freeText}`,
        ].join('\n');

        const assessResponse = await fetch('/api/evaluation/assess-prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: DEMO_USER_ID,
            sessionId: DEMO_SESSION_ID,
            prompt,
            structuredData: item.structuredData,
            context: { taskType: 'controller-design', difficulty: 'intermediate' },
          }),
        });

        if (!assessResponse.ok) {
          throw new Error(`演示评价失败（样本 ${index + 1}）`);
        }
        lastAssessment = (await assessResponse.json()) as AssessResponse;

        const trackResponse = await fetch('/api/evaluation/track-consistency', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: DEMO_USER_ID,
            designSessionId: DEMO_SESSION_ID,
            promptVersion: index + 1,
            promptContent: prompt,
            designActions: [
              { timestamp: Date.now() - 40000, action: 'adjust_kp', params: { kp: 1.3 + index * 0.1, kd: 0.2 } },
              { timestamp: Date.now() - 25000, action: 'adjust_kd', params: { kp: 1.15, kd: 0.45 + index * 0.08 } },
              { timestamp: Date.now() - 10000, action: 'adjust_ki', params: { kp: 1.05, ki: 0.15 + index * 0.05, kd: 0.52 } },
            ],
            finalResult: {
              overshoot: 19 - index * 3,
              settlingTime: 24 - index * 2,
              stabilityMargin: 31 + index * 2,
              comfortIndex: 1.8 - index * 0.15,
            },
          }),
        });

        if (!trackResponse.ok) {
          throw new Error(`演示一致性失败（样本 ${index + 1}）`);
        }
        lastConsistency = (await trackResponse.json()) as ConsistencyResponse;
      }

      const finalCase = demoCases[demoCases.length - 1];
      setStructured(finalCase.structuredData);
      setFreeText(finalCase.freeText);
      setAssessment(lastAssessment);
      setConsistency(lastConsistency);
      await loadTrendData();
    } catch (seedError) {
      setError(seedError instanceof Error ? seedError.message : '生成演示轨迹失败');
    } finally {
      setLoading(false);
    }
  }, [loadTrendData]);

  useEffect(() => {
    if (!autoDemo || autoSeeded) {
      return;
    }

    setAutoSeeded(true);
    setStructured(DEMO_AUTOFILL_STRUCTURED);
    setFreeText(DEMO_AUTOFILL_TEXT);
    void seedDemoHistory();
  }, [autoDemo, autoSeeded, seedDemoHistory]);

  return (
    <div className="surface-page px-4 py-6 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="surface-card bg-gradient-to-br from-card via-card to-accent/35 p-5">
          <p className="text-xs uppercase tracking-[0.28em] text-amber-400">Structure Evaluated</p>
          <h1 className="mt-1 text-2xl font-semibold">元提示词评价与过程一致性</h1>
          <p className="mt-2 text-sm text-slate-400">
            先评估提示词质量，再追踪“提示结构-设计行为-结果达成”的一致性，支持过程化反馈。
          </p>
        </header>

        <section className="grid gap-4 lg:grid-cols-[380px_1fr]">
          <aside className="surface-card space-y-4 p-4">
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
                  className="mt-1 w-full rounded border border-border/70 bg-background/70 px-2 py-1 text-sm"
                />
              </label>
            ))}

            <label className="block text-xs text-slate-400">
              额外说明
              <textarea
                value={freeText}
                onChange={(event) => setFreeText(event.target.value)}
                rows={4}
                className="mt-1 w-full rounded border border-border/70 bg-background/70 px-2 py-1 text-sm"
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
              <button
                type="button"
                onClick={seedDemoHistory}
                disabled={loading}
                className="w-full rounded bg-violet-600 px-3 py-2 text-sm font-medium hover:bg-violet-500 disabled:opacity-60"
              >
                生成常态化演示轨迹
              </button>
            </div>
          </aside>

          <main className="space-y-4">
            <div className="surface-card p-4">
              <h3 className="mb-2 text-base font-medium">提示词预览</h3>
              <pre className="whitespace-pre-wrap rounded bg-slate-950 p-3 text-sm leading-6 text-slate-200">{compiledPrompt}</pre>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <section className="surface-card p-4">
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

              <section className="surface-card p-4">
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

            <section className="surface-card p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-medium">常态化训练量化追踪</h3>
                <button
                  type="button"
                  onClick={() => void loadTrendData()}
                  className="btn-ghost-themed rounded px-3 py-1.5 text-xs font-medium"
                  disabled={trendLoading}
                >
                  刷新趋势数据
                </button>
              </div>

              {trendLoading ? (
                <div className="rounded bg-slate-950 p-4 text-sm text-slate-400">趋势数据加载中...</div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded bg-slate-950 p-3">
                      <div className="text-xs text-slate-400">提示词版本数</div>
                      <div className="mt-1 text-xl font-semibold text-violet-300">{historyRecords.length}</div>
                    </div>
                    <div className="rounded bg-slate-950 p-3">
                      <div className="text-xs text-slate-400">最近提示词得分</div>
                      <div className="mt-1 text-xl font-semibold text-amber-300">{latestRecord?.assessment.overallScore ?? '-'}</div>
                    </div>
                    <div className="rounded bg-slate-950 p-3">
                      <div className="text-xs text-slate-400">一致性均值</div>
                      <div className="mt-1 text-xl font-semibold text-cyan-300">{consistencyScores.length > 0 ? mean(consistencyScores) : '-'}</div>
                    </div>
                    <div className="rounded bg-slate-950 p-3">
                      <div className="text-xs text-slate-400">能力值 θ</div>
                      <div className="mt-1 text-xl font-semibold text-emerald-300">{abilityReport ? abilityReport.estimatedAbility.toFixed(2) : '-'}</div>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded border border-slate-800 bg-slate-950/70 p-3">
                      <div className="mb-2 text-sm text-slate-300">提示词质量版本轨迹</div>
                      {latestHistory.length === 0 ? (
                        <div className="text-sm text-slate-500">暂无历史记录，点击“生成常态化演示轨迹”。</div>
                      ) : (
                        <div className="space-y-2">
                          {latestHistory.map((record) => (
                            <div key={record.version} className="rounded bg-slate-900/70 p-2">
                              <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                                <span>V{record.version}</span>
                                <span>{formatDateTime(record.createdAt)}</span>
                              </div>
                              <div className="text-xs text-slate-300">综合评分：{record.assessment.overallScore}</div>
                              <div className="mt-1 h-1.5 rounded bg-slate-800">
                                <div className="h-1.5 rounded bg-amber-400" style={{ width: `${record.assessment.overallScore}%` }} />
                              </div>
                              <div className="mt-1 text-xs text-slate-300">一致性：{record.consistency?.consistencyScore ?? '未评估'}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded border border-slate-800 bg-slate-950/70 p-3">
                      <div className="mb-2 text-sm text-slate-300">跨域能力成长轨迹</div>
                      {abilityReport && abilityReport.timeline.length > 0 ? (
                        <div className="space-y-2">
                          {abilityReport.timeline.slice(-8).map((point) => (
                            <div key={point.timestamp} className="rounded bg-slate-900/70 p-2">
                              <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                                <span>{formatDateTime(point.timestamp)}</span>
                                <span>θ {point.theta}</span>
                              </div>
                              <div className="h-1.5 rounded bg-slate-800">
                                <div className="h-1.5 rounded bg-emerald-400" style={{ width: `${Math.min(100, Math.max(0, (point.accuracy || 0) * 100))}%` }} />
                              </div>
                              <div className="mt-1 text-xs text-slate-300">准确率：{Math.round((point.accuracy || 0) * 100)}%</div>
                            </div>
                          ))}
                          <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                            <div className="rounded bg-cyan-500/10 px-2 py-1 text-cyan-300">计算 θ {abilityReport.dimensions.computationalTheta}</div>
                            <div className="rounded bg-emerald-500/10 px-2 py-1 text-emerald-300">跨域 θ {abilityReport.dimensions.crossDomainTheta}</div>
                            <div className="rounded bg-violet-500/10 px-2 py-1 text-violet-300">设计 θ {abilityReport.dimensions.designTheta}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500">暂无能力轨迹，先完成一次“自适应跨域题库”练习。</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <div className="surface-card-soft rounded-lg px-4 py-3 text-sm text-slate-400">
              {loading
                ? '正在计算评价结果...'
                : trendLoading
                  ? '正在同步趋势数据...'
                  : error
                    ? `操作失败：${error}`
                    : '提示：建议每次修改提示词后再次评价，形成版本迭代轨迹。'}
            </div>
          </main>
        </section>
      </div>
    </div>
  );
}
