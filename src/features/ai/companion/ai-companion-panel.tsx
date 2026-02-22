'use client';

import { useMemo, useState } from 'react';

interface AttemptInput {
  kp: number;
  ki: number;
  kd: number;
  overshoot: number;
  settlingTime: number;
  comfortIndex: number;
  stabilityMargin: number;
  isSuccessful: boolean;
}

interface InterventionDecision {
  shouldIntervene: boolean;
  reason: string;
  interventionType?: string;
}

interface InterventionPayload {
  feedbackType: string;
  content: string;
  suggestedNextSteps: string[];
  relatedConcepts: string[];
  highlightParams: string[];
  showTrendPrediction: boolean;
}

interface GenerateResponse {
  decision: InterventionDecision;
  intervention: InterventionPayload;
  interventionId: string;
}

export function AICompanionPanel({
  title,
  sessionId,
}: {
  title: string;
  sessionId: string;
}) {
  const [attempts, setAttempts] = useState<Array<{
    attemptNumber: number;
    params: { kp: number; ki: number; kd: number };
    result: { overshoot: number; settlingTime: number; comfortIndex: number; stabilityMargin: number };
    isSuccessful: boolean;
  }>>([]);

  const [current, setCurrent] = useState<AttemptInput>({
    kp: 1.2,
    ki: 0.1,
    kd: 0.4,
    overshoot: 22,
    settlingTime: 35,
    comfortIndex: 18,
    stabilityMargin: 32,
    isSuccessful: false,
  });

  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const studentState = useMemo(
    () => ({
      currentTask: title,
      attemptHistory: attempts,
      currentAttempt: attempts.length + 1,
      timeSinceLastAttempt: 60,
    }),
    [attempts, title]
  );

  const addAttempt = () => {
    setAttempts((prev) => [
      ...prev,
      {
        attemptNumber: prev.length + 1,
        params: { kp: current.kp, ki: current.ki, kd: current.kd },
        result: {
          overshoot: current.overshoot,
          settlingTime: current.settlingTime,
          comfortIndex: current.comfortIndex,
          stabilityMargin: current.stabilityMargin,
        },
        isSuccessful: current.isSuccessful,
      },
    ]);
  };

  const requestIntervention = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/ai/intervention/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentState }),
      });

      if (!response.ok) {
        throw new Error('介入生成失败');
      }

      const data = (await response.json()) as GenerateResponse;
      setResult(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  const sendFeedback = async (wasHelpful: boolean) => {
    if (!result) return;

    await fetch('/api/ai/intervention/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        interventionId: result.interventionId,
        wasHelpful,
      }),
    });
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900/70 p-4 text-slate-100">
      <h3 className="text-base font-semibold text-cyan-300">AI伴随探究</h3>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {[
          ['Kp', 'kp'],
          ['Ki', 'ki'],
          ['Kd', 'kd'],
          ['超调%', 'overshoot'],
          ['调节时间(s)', 'settlingTime'],
          ['舒适指数', 'comfortIndex'],
          ['稳定裕度°', 'stabilityMargin'],
        ].map(([label, key]) => (
          <label key={key} className="block text-slate-400">
            {label}
            <input
              type="number"
              value={current[key as keyof AttemptInput] as number}
              onChange={(event) =>
                setCurrent((prev) => ({
                  ...prev,
                  [key]: Number(event.target.value),
                }))
              }
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
            />
          </label>
        ))}
      </div>

      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={current.isSuccessful}
          onChange={(event) => setCurrent((prev) => ({ ...prev, isSuccessful: event.target.checked }))}
        />
        本次尝试是否成功
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={addAttempt}
          className="flex-1 rounded bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600"
        >
          记录尝试
        </button>
        <button
          type="button"
          onClick={requestIntervention}
          disabled={loading || attempts.length === 0}
          className="flex-1 rounded bg-cyan-600 px-3 py-2 text-sm hover:bg-cyan-500 disabled:opacity-60"
        >
          生成介入建议
        </button>
      </div>

      <div className="rounded bg-slate-950 p-2 text-xs text-slate-400">
        已记录尝试次数：{attempts.length}
      </div>

      {result ? (
        <div className="space-y-2 rounded border border-cyan-500/30 bg-cyan-500/10 p-3">
          <div className="text-sm font-medium">
            介入判定：{result.decision.shouldIntervene ? '需要介入' : '暂不介入'} ({result.decision.reason})
          </div>
          <p className="text-sm text-slate-200">{result.intervention.content}</p>
          <ul className="space-y-1 text-xs text-slate-300">
            {result.intervention.suggestedNextSteps.map((item) => (
              <li key={item} className="rounded bg-slate-900/70 px-2 py-1">
                {item}
              </li>
            ))}
          </ul>
          <div className="text-xs text-slate-300">
            建议重点参数：{result.intervention.highlightParams.join(', ')}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void sendFeedback(true)}
              className="rounded bg-emerald-600 px-2 py-1 text-xs hover:bg-emerald-500"
            >
              建议有帮助
            </button>
            <button
              type="button"
              onClick={() => void sendFeedback(false)}
              className="rounded bg-rose-600 px-2 py-1 text-xs hover:bg-rose-500"
            >
              建议需改进
            </button>
          </div>
        </div>
      ) : null}

      {error ? <div className="text-xs text-rose-300">{error}</div> : null}
    </div>
  );
}
