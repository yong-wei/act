'use client';

import { useEffect, useMemo, useState } from 'react';

import type { ControllerMethod } from '@/features/arena/types';
import {
  getArenaCompanionAllowedMethods,
  resolveArenaCompanionContext,
  type ArenaCompanionContext,
} from './arena-companion-context';
import {
  attemptOutcomeToSuccess,
  canRecordAttempt,
  getFeedbackStatusMessage,
  type AttemptOutcome,
  type FeedbackSubmissionState,
} from './attempt-feedback-state';
import type { StudentState } from './intervention-engine';

interface InputField {
  id: string;
  label: string;
  initialValue: number;
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
  canSubmitFeedback?: boolean;
}

const legacyParameterFields: InputField[] = [
  { id: 'kp', label: 'Kp', initialValue: 1.2 },
  { id: 'ki', label: 'Ki', initialValue: 0.1 },
  { id: 'kd', label: 'Kd', initialValue: 0.4 },
];

const legacyMetricFields: InputField[] = [
  { id: 'overshoot', label: '超调%', initialValue: 22 },
  { id: 'settlingTime', label: '调节时间(s)', initialValue: 35 },
  { id: 'comfortIndex', label: '舒适指数', initialValue: 18 },
  { id: 'stabilityMargin', label: '稳定裕度°', initialValue: 32 },
];

function initialValues(fields: InputField[]) {
  return Object.fromEntries(fields.map((field) => [field.id, field.initialValue]));
}

function fieldsForContext(context: ArenaCompanionContext | null) {
  if (!context) {
    return {
      parameters: legacyParameterFields,
      metrics: legacyMetricFields,
    };
  }

  return {
    parameters: context.parameters,
    metrics: context.metrics.map((metric) => ({
      id: metric.id,
      label: `${metric.label}${metric.unit ? `(${metric.unit})` : ''}`,
      initialValue: metric.idealValue,
    })),
  };
}

function resolveContext(taskId: string | undefined, method: ControllerMethod | null) {
  if (!taskId || !method) return { context: null, error: null };
  try {
    return { context: resolveArenaCompanionContext(taskId, method), error: null };
  } catch (error) {
    return {
      context: null,
      error: error instanceof Error ? error.message : '无法解析竞技场学习场景',
    };
  }
}

export function AICompanionPanel({
  title,
  sessionId,
  arenaTaskId,
  method,
}: {
  title: string;
  sessionId: string;
  arenaTaskId?: string;
  method?: ControllerMethod;
}) {
  const availableMethods = useMemo(() => {
    if (!arenaTaskId) return [];
    try {
      return getArenaCompanionAllowedMethods(arenaTaskId);
    } catch {
      return [];
    }
  }, [arenaTaskId]);
  const [selectedMethod, setSelectedMethod] = useState<ControllerMethod | null>(
    method ?? (availableMethods.length === 1 ? availableMethods[0]! : null),
  );
  const activeMethod = method ?? selectedMethod;
  const resolved = useMemo(
    () => resolveContext(arenaTaskId, activeMethod),
    [activeMethod, arenaTaskId],
  );
  const context = resolved.context;
  const fields = useMemo(() => fieldsForContext(context), [context]);
  const fieldKey = useMemo(
    () => [...fields.parameters, ...fields.metrics].map((field) => field.id).join(':'),
    [fields],
  );
  const [attempts, setAttempts] = useState<StudentState['attemptHistory']>([]);
  const [current, setCurrent] = useState<Record<string, number>>(
    () => initialValues([...fields.parameters, ...fields.metrics]),
  );
  const [attemptOutcome, setAttemptOutcome] = useState<AttemptOutcome>(null);
  const [attemptNotice, setAttemptNotice] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackState, setFeedbackState] = useState<FeedbackSubmissionState>({ status: 'idle' });

  useEffect(() => {
    setCurrent(initialValues([...fields.parameters, ...fields.metrics]));
    setAttempts([]);
    setAttemptOutcome(null);
    setAttemptNotice(null);
    setResult(null);
  }, [fieldKey, fields.metrics, fields.parameters]);

  const studentState = useMemo<StudentState>(
    () => ({
      currentTask: title,
      attemptHistory: attempts,
      currentAttempt: attempts.length + 1,
      timeSinceLastAttempt: 60,
    }),
    [attempts, title],
  );
  const interventionScope = useMemo(
    () => ({
      courseId: 'simulation-companion',
      pageId: sessionId,
      resourceId: sessionId,
      pathNodeId: `ai-companion:${sessionId}`,
    }),
    [sessionId],
  );

  const addAttempt = () => {
    const isSuccessful = attemptOutcomeToSuccess(attemptOutcome);
    if (isSuccessful === null) {
      setAttemptNotice('请选择本次尝试结果后再记录');
      return;
    }

    setAttempts((previous) => [
      ...previous,
      {
        attemptNumber: previous.length + 1,
        params: Object.fromEntries(fields.parameters.map((field) => [field.id, current[field.id] ?? field.initialValue])),
        result: Object.fromEntries(fields.metrics.map((field) => [field.id, current[field.id] ?? field.initialValue])),
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
        body: JSON.stringify({
          studentState,
          ...interventionScope,
          ...(context ? { arenaTaskId: context.taskId, method: context.method } : {}),
        }),
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
    if (!result?.canSubmitFeedback || !result.interventionId) return;
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
          ...interventionScope,
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
  const feedbackButtonsDisabled = feedbackState.status === 'submitting' || feedbackState.status === 'success';
  const recordAttemptDisabled = !canRecordAttempt(attemptOutcome);
  const requiresMethodSelection = Boolean(arenaTaskId) && !context;

  return (
    <section className="space-y-3 rounded-lg border border-slate-300 bg-white/95 p-3 text-slate-900" aria-label="AI伴随探究">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">AI伴随探究</h3>
        {context ? <p className="mt-1 text-xs text-slate-600">{context.methodLabel}练习记录</p> : null}
      </div>

      {arenaTaskId && !method && availableMethods.length > 1 ? (
        <label className="block text-xs text-slate-700">
          当前控制方法
          <select
            value={selectedMethod ?? ''}
            onChange={(event) => setSelectedMethod(event.target.value as ControllerMethod || null)}
            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-slate-900"
          >
            <option value="">请选择已允许的方法</option>
            {availableMethods.map((availableMethod) => (
              <option key={availableMethod} value={availableMethod}>{availableMethod}</option>
            ))}
          </select>
        </label>
      ) : null}

      {resolved.error ? <p className="text-xs text-red-700">{resolved.error}</p> : null}
      {requiresMethodSelection ? (
        <p className="text-xs text-slate-600">选择当前任务允许的控制方法后记录练习。</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {fields.parameters.map((field) => (
              <label key={field.id} className="block text-slate-700">
                {field.label}
                <input
                  type="number"
                  value={current[field.id] ?? field.initialValue}
                  onChange={(event) => setCurrent((previous) => ({ ...previous, [field.id]: Number(event.target.value) }))}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-slate-900"
                />
              </label>
            ))}
            {fields.metrics.map((field) => (
              <label key={field.id} className="block text-slate-700">
                {field.label}
                <input
                  type="number"
                  value={current[field.id] ?? field.initialValue}
                  onChange={(event) => setCurrent((previous) => ({ ...previous, [field.id]: Number(event.target.value) }))}
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
                    name={`attempt-outcome:${sessionId}`}
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
              记录练习
            </button>
            <button
              type="button"
              onClick={requestIntervention}
              disabled={loading || attempts.length === 0}
              className="flex-1 rounded border border-transparent bg-sky-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              生成介入建议
            </button>
          </div>

          <div className="rounded border border-slate-300 bg-slate-50 p-2 text-xs text-slate-700">
            已记录练习次数：{attempts.length}
          </div>
        </>
      )}

      {result ? (
        <div className="space-y-2 rounded border border-slate-300 bg-white p-3">
          <div className="text-sm font-medium">
            介入判定：{result.decision.shouldIntervene ? '需要介入' : '暂不介入'} ({result.decision.reason})
          </div>
          <p className="text-sm text-slate-800">{result.intervention.content}</p>
          <ul className="space-y-1 text-xs text-slate-700">
            {result.intervention.suggestedNextSteps.map((item) => (
              <li key={item} className="rounded border border-slate-200 bg-slate-50 px-2 py-1">{item}</li>
            ))}
          </ul>
          <div className="text-xs text-slate-700">建议重点参数：{result.intervention.highlightParams.join(', ')}</div>
          {result.canSubmitFeedback && result.interventionId ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => void sendFeedback(true)} disabled={feedbackButtonsDisabled} className="rounded border border-transparent bg-sky-700 px-2 py-1 text-xs text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60">建议有帮助</button>
              <button type="button" onClick={() => void sendFeedback(false)} disabled={feedbackButtonsDisabled} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">建议需改进</button>
            </div>
          ) : null}
          {feedbackStatusMessage ? (
            <div role="status" className={`text-xs ${feedbackState.status === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>
              {feedbackStatusMessage}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <div className="text-xs text-red-700">{error}</div> : null}
    </section>
  );
}
