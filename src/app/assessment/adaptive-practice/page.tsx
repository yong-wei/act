'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

interface DiagnosticResponse {
  knowledgeDimensions: {
    computational: number;
    crossDomain: number;
    design: number;
  };
  weakAreas: string[];
  recommendedFocus: string[];
}

interface PracticeQuestion {
  id: string;
  stem: string;
  domains: string[];
  type: string;
  difficulty: number;
  knowledgeTags: string[];
  options: Array<{
    label: string;
    text: string;
    explanation: string;
  }>;
}

interface NextQuestionResponse {
  question: PracticeQuestion;
  estimatedAbility: number;
  confidenceInterval: [number, number];
}

interface SubmitAnswerResponse {
  isCorrect: boolean;
  correctOption: string;
  explanation: string;
  estimatedAbility: number;
  recommendedFocus: string[];
}

function percentLabel(value: number): string {
  return `${Math.round(value)}%`;
}

export default function AdaptivePracticePage() {
  const sessionId = useMemo(() => `practice-${Math.random().toString(36).slice(2, 10)}`, []);

  const [diagnostic, setDiagnostic] = useState<DiagnosticResponse | null>(null);
  const [questionState, setQuestionState] = useState<NextQuestionResponse | null>(null);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [feedback, setFeedback] = useState<SubmitAnswerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [questionStartAt, setQuestionStartAt] = useState<number>(Date.now());
  const [error, setError] = useState<string | null>(null);

  const loadDiagnostic = useCallback(async () => {
    const response = await fetch('/api/assessment/diagnostic');
    if (!response.ok) {
      throw new Error('诊断加载失败');
    }
    const data = (await response.json()) as DiagnosticResponse;
    setDiagnostic(data);
  }, []);

  const loadNextQuestion = useCallback(async () => {
    const response = await fetch('/api/assessment/next-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });

    if (!response.ok) {
      throw new Error('下一题加载失败');
    }

    const data = (await response.json()) as NextQuestionResponse;
    setQuestionState(data);
    setSelectedOption('');
    setFeedback(null);
    setQuestionStartAt(Date.now());
  }, [sessionId]);

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([loadDiagnostic(), loadNextQuestion()]);
      } catch (bootstrapError) {
        setError(bootstrapError instanceof Error ? bootstrapError.message : '初始化失败');
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  }, [loadDiagnostic, loadNextQuestion]);

  const submitCurrentAnswer = async () => {
    if (!questionState || !selectedOption) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/assessment/submit-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          questionId: questionState.question.id,
          selectedOption,
          timeSpent: Math.max(1, Math.round((Date.now() - questionStartAt) / 1000)),
        }),
      });

      if (!response.ok) {
        throw new Error('提交失败');
      }

      const data = (await response.json()) as SubmitAnswerResponse;
      setFeedback(data);
      await loadDiagnostic();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '提交失败');
    } finally {
      setLoading(false);
    }
  };

  const generateQuestion = async () => {
    if (!diagnostic) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/assessment/generate-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetKnowledgeTags: diagnostic.weakAreas,
          difficultyTarget: 0.6,
          domains: ['time', 'frequency', 'complex'],
        }),
      });

      if (!response.ok) {
        throw new Error('生成题目失败');
      }

      await loadNextQuestion();
    } catch (genError) {
      setError(genError instanceof Error ? genError.message : '生成失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs uppercase tracking-[0.28em] text-emerald-400">Adaptive Practice</p>
          <h1 className="mt-1 text-2xl font-semibold">自适应跨域题库</h1>
          <p className="mt-2 text-sm text-slate-400">
            基于答题历史动态估计能力值，针对薄弱知识点推荐下一题，并支持即时生成跨域题目。
          </p>
        </header>

        <section className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <aside className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-lg font-medium">能力诊断</h2>

            <div className="space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                  <span>计算型知识</span>
                  <span>{percentLabel(diagnostic?.knowledgeDimensions.computational ?? 0)}</span>
                </div>
                <div className="h-2 rounded bg-slate-800">
                  <div
                    className="h-2 rounded bg-cyan-400"
                    style={{ width: `${diagnostic?.knowledgeDimensions.computational ?? 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                  <span>跨域型知识</span>
                  <span>{percentLabel(diagnostic?.knowledgeDimensions.crossDomain ?? 0)}</span>
                </div>
                <div className="h-2 rounded bg-slate-800">
                  <div
                    className="h-2 rounded bg-emerald-400"
                    style={{ width: `${diagnostic?.knowledgeDimensions.crossDomain ?? 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                  <span>设计型知识</span>
                  <span>{percentLabel(diagnostic?.knowledgeDimensions.design ?? 0)}</span>
                </div>
                <div className="h-2 rounded bg-slate-800">
                  <div
                    className="h-2 rounded bg-violet-400"
                    style={{ width: `${diagnostic?.knowledgeDimensions.design ?? 0}%` }}
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs text-slate-400">薄弱知识点</p>
              <div className="flex flex-wrap gap-2">
                {(diagnostic?.weakAreas ?? []).map((item) => (
                  <span key={item} className="rounded bg-rose-500/20 px-2 py-1 text-xs text-rose-300">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs text-slate-400">推荐训练方向</p>
              <ul className="space-y-2 text-sm text-slate-300">
                {(diagnostic?.recommendedFocus ?? []).map((item) => (
                  <li key={item} className="rounded bg-slate-950 px-2 py-1">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              onClick={generateQuestion}
              disabled={loading}
              className="w-full rounded bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-60"
            >
              AI 即时生成题目
            </button>
          </aside>

          <main className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium">自适应练习区</h2>
              <div className="text-sm text-slate-300">
                能力值 θ: <span className="font-semibold text-emerald-300">{questionState?.estimatedAbility ?? 0}</span>
                <span className="ml-2 text-slate-400">
                  CI: [{questionState?.confidenceInterval?.[0] ?? 0}, {questionState?.confidenceInterval?.[1] ?? 0}]
                </span>
              </div>
            </div>

            {questionState ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                  <div className="mb-2 flex flex-wrap gap-2">
                    {questionState.question.domains.map((domain) => (
                      <span key={domain} className="rounded bg-cyan-500/20 px-2 py-1 text-xs text-cyan-300">
                        {domain}
                      </span>
                    ))}
                    <span className="rounded bg-violet-500/20 px-2 py-1 text-xs text-violet-300">
                      难度 {questionState.question.difficulty}
                    </span>
                  </div>

                  <p className="text-base leading-7 text-slate-100">{questionState.question.stem}</p>

                  <div className="mt-4 space-y-2">
                    {questionState.question.options.map((option) => {
                      const active = selectedOption === option.label;
                      return (
                        <button
                          key={option.label}
                          type="button"
                          onClick={() => setSelectedOption(option.label)}
                          className={`w-full rounded border px-3 py-2 text-left text-sm transition ${
                            active
                              ? 'border-emerald-400 bg-emerald-500/10 text-emerald-100'
                              : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500'
                          }`}
                        >
                          {option.label}. {option.text}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={submitCurrentAnswer}
                    disabled={loading || !selectedOption}
                    className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-60"
                  >
                    提交答案
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadNextQuestion()}
                    disabled={loading}
                    className="rounded bg-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-600 disabled:opacity-60"
                  >
                    下一题
                  </button>
                </div>

                {feedback ? (
                  <div className={`rounded-xl border p-4 ${feedback.isCorrect ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-rose-500/40 bg-rose-500/10'}`}>
                    <div className="text-sm font-medium">
                      {feedback.isCorrect ? '回答正确' : `回答错误，正确选项：${feedback.correctOption}`}
                    </div>
                    <p className="mt-2 text-sm text-slate-200">{feedback.explanation}</p>
                    <div className="mt-2 text-xs text-slate-300">
                      最新能力估计 θ: <span className="text-emerald-300">{feedback.estimatedAbility}</span>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-slate-300">
                      {feedback.recommendedFocus.map((item) => (
                        <li key={item} className="rounded bg-slate-900/70 px-2 py-1">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-center text-sm text-slate-400">
                正在加载练习题...
              </div>
            )}

            <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-400">
              {loading ? '系统正在评估并更新题目推荐...' : error ? `操作失败：${error}` : '提示：答错后会触发跨域解释与后续补强建议。'}
            </div>
          </main>
        </section>
      </div>
    </div>
  );
}
