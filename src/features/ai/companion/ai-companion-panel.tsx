'use client';

import { useMemo, useState } from 'react';
import {
  attemptOutcomeToSuccess,
  canRecordAttempt,
  getFeedbackStatusMessage,
  type AttemptOutcome,
  type FeedbackSubmissionState,
} from './attempt-feedback-state';

interface AttemptInput {
  kp: number;
  ki: number;
  kd: number;
  overshoot: number;
  settlingTime: number;
  comfortIndex: number;
  stabilityMargin: number;
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
  });

  const [attemptOutcome, setAttemptOutcome] = useState<AttemptOutcome>(null);
  const [attemptNotice, setAttemptNotice] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackState, setFeedbackState] = useState<FeedbackSubmissionState>({ status: 'idle' });

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
    const isSuccessful = attemptOutcomeToSuccess(attemptOutcome);
    if (isSuccessful === null) {
      setAttemptNotice('请选择本次尝试结果后再记录');
      return;
    }

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
        isSuccessful,
      },
    ]);
    setAttemptOutcome(null);
    setAttemptNotice(null);
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
      setFeedbackState({ status: 'idle' });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  const sendFeedback = async (wasHelpful: boolean) => {
    if (!result) return;
    if (feedbackState.status === 'submitting' || feedbackState.status === 'success') return;

    setFeedbackState({ status: 'submitting' });
    try {
      const response = await fetch('/api/ai/intervention/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          interventionId: result.interventionId,
          wasHelpful,
        }),
      });

      if (!response.ok) {
        throw new Error('反馈提交失败');
      }

      setFeedbackState({ status: 'success' });
    } catch (feedbackError) {
      setFeedbackState({
        status: 'error',
        message: feedbackError instanceof Error ? feedbackError.message : '反馈提交失败',
      });
    }
  };

  const feedbackStatusMessage = getFeedbackStatusMessage(feedbackState);
  const feedbackButtonsDisabled =
    feedbackState.status === 'submitting' || feedbackState.status === 'success';
  const recordAttemptDisabled = !canRecordAttempt(attemptOutcome);

  return (
    <div className="space-y-3 rounded-xl border border-slate-300 bg-white/95 p-3 text-slate-900">
      <h3 className="text-sm font-semibold text-slate-900">AI伴随探究</h3>

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
          <label key={key} className="block text-slate-700">
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
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-slate-900"
            />
          </label>
        ))}
      </div>

      <fieldset className="space-y-2 text-xs text-slate-700">
        <legend className="font-medium text-slate-800">本次尝试是否成功</legend>
        <div className="grid grid-cols-2 gap-2">
          {([
            ['success', '成功'],
            ['failure', '失败'],
          ] as const).map(([value, label]) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center justify-center gap-2 rounded border px-3 py-2 transition ${
                attemptOutcome === value
                  ? 'border-sky-600 bg-sky-50 text-sky-800'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="attempt-outcome"
                value={value}
                checked={attemptOutcome === value}
                onChange={() => setAttemptOutcome(value)}
                className="accent-sky-700"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      {attemptNotice || recordAttemptDisabled ? (
        <div className="text-xs text-amber-700">请选择本次尝试结果后再记录</div>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={addAttempt}
          disabled={recordAttemptDisabled}
          className="flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          记录尝试
        </button>
        <button
          type="button"
          onClick={requestIntervention}
          disabled={loading || attempts.length === 0}
          className="flex-1 rounded border border-transparent bg-sky-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-600 disabled:opacity-60"
        >
          生成介入建议
        </button>
      </div>

      <div className="rounded border border-slate-300 bg-slate-50 p-2 text-xs text-slate-700">
        已记录尝试次数：{attempts.length}
      </div>

      {result ? (
        <div className="space-y-2 rounded border border-slate-300 bg-white p-3">
          <div className="text-sm font-medium">
            介入判定：{result.decision.shouldIntervene ? '需要介入' : '暂不介入'} ({result.decision.reason})
          </div>
          <p className="text-sm text-slate-800">{result.intervention.content}</p>
          <ul className="space-y-1 text-xs text-slate-700">
            {result.intervention.suggestedNextSteps.map((item) => (
              <li key={item} className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                {item}
              </li>
            ))}
          </ul>
          <div className="text-xs text-slate-700">
            建议重点参数：{result.intervention.highlightParams.join(', ')}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void sendFeedback(true)}
              disabled={feedbackButtonsDisabled}
              className="rounded border border-transparent bg-sky-700 px-2 py-1 text-xs text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              建议有帮助
            </button>
            <button
              type="button"
              onClick={() => void sendFeedback(false)}
              disabled={feedbackButtonsDisabled}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              建议需改进
            </button>
          </div>
          {feedbackStatusMessage ? (
            <div
              role="status"
              className={`text-xs ${
                feedbackState.status === 'error' ? 'text-red-700' : 'text-emerald-700'
              }`}
            >
              {feedbackStatusMessage}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <div className="text-xs text-red-700">{error}</div> : null}
    </div>
  );
}
