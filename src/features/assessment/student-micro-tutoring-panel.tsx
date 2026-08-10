'use client';

import { useCallback, useRef, useState } from 'react';
import { BookOpenCheck, CheckCircle2, ExternalLink, RefreshCw, Sparkles } from 'lucide-react';

type UnavailableResult = {
  status: 'UNAVAILABLE';
  unavailableReason: string;
  manualPracticePath?: string;
};

type OrchestrationResult = {
  id: string;
  status: 'AVAILABLE';
  task: {
    goal: string;
    estimatedMinutes: number;
    resources: Array<{
      id: string;
      title: string;
      estimatedMinutes: number;
      actionPath: string;
    }>;
  };
} | UnavailableResult;

type InterventionResult = {
  id: string;
  status: 'STARTED' | 'COMPLETED' | 'VALIDATED';
  startedAt: string;
  progress: {
    resourceUseCount: number;
    hintCount: number;
    completedAt: string | null;
    durationSeconds: number | null;
  };
  validation: { isCorrect: boolean; submittedAt: string } | null;
  recommendation: Recommendation | null;
} | UnavailableResult;

type Recommendation = {
  kind: 'TRANSFER_PRACTICE' | 'TRANSFER_PRACTICE_UNAVAILABLE';
  basisSummary: string;
  actions: Array<{ title: string; actionPath: string }>;
} | {
  kind: 'PREREQUISITE_SPLIT';
  basisSummary: string;
  prerequisiteNodes: Array<{ name: string }>;
} | {
  kind: 'ADJUST_TUTORING_STRATEGY';
  basisSummary: string;
  manualPracticePath: string;
};

type ValidationQuestion = {
  id: string;
  prompt: string;
  options: Array<{ label: string; text: string }>;
};

type RetryAction = (() => Promise<void>) | null;

function isUnavailable(result: unknown): result is UnavailableResult {
  return Boolean(result && typeof result === 'object' && (result as { status?: string }).status === 'UNAVAILABLE');
}

function eventKey(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `micro-tutoring-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function humanizeUnavailable(reason: string): string {
  if (reason === 'ATTRIBUTION_UNCERTAIN') return '当前错因证据不足，暂不能生成可靠的微辅导任务。';
  if (reason === 'ACCESS_REVOKED') return '当前任务的访问条件已变化，无法继续本次微辅导。';
  if (reason === 'REFERENCE_DRIFT') return '任务内容已更新，请返回练习后重新开始。';
  return '当前没有可安全执行的微辅导任务。';
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => null) as T | { error?: string } | null;
  if (!response.ok && !isUnavailable(payload)) {
    throw new Error(payload && typeof payload === 'object' && 'error' in payload && payload.error
      ? payload.error
      : 'REQUEST_FAILED');
  }
  return payload as T;
}

function elapsedSeconds(startedAt: string): number {
  const started = Date.parse(startedAt);
  return Number.isFinite(started) ? Math.max(1, Math.round((Date.now() - started) / 1000)) : 1;
}

function isPlatformRelativePath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//');
}

export function StudentMicroTutoringPanel({
  answerId,
  onRequestHint,
}: {
  answerId: string;
  onRequestHint: () => Promise<void>;
}) {
  const [orchestration, setOrchestration] = useState<OrchestrationResult | null>(null);
  const [intervention, setIntervention] = useState<InterventionResult | null>(null);
  const [question, setQuestion] = useState<ValidationQuestion | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const retryAction = useRef<RetryAction>(null);
  const eventKeys = useRef(new Map<string, string>());
  const hintEventRecorded = useRef(false);

  const setUnavailable = useCallback((result: UnavailableResult) => {
    setOrchestration(result);
    setIntervention(result);
    setQuestion(null);
    setSelectedOption(null);
  }, []);

  const execute = useCallback(async (label: string, action: () => Promise<void>) => {
    setPending(label);
    setError(null);
    retryAction.current = action;
    try {
      await action();
      retryAction.current = null;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '请求失败，请重试。');
    } finally {
      setPending(null);
    }
  }, []);

  const createOrchestration = useCallback(async () => {
    const result = await requestJson<OrchestrationResult>('/api/assessment/remediation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answerId }),
    });
    if (isUnavailable(result)) {
      setUnavailable(result);
      return;
    }
    setOrchestration(result);
  }, [answerId, setUnavailable]);

  const startIntervention = useCallback(async () => {
    if (!orchestration || isUnavailable(orchestration)) return;
    const key = eventKeys.current.get('start') ?? eventKey();
    eventKeys.current.set('start', key);
    const result = await requestJson<InterventionResult>('/api/assessment/remediation/interventions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ remediationResultId: orchestration.id, startEventKey: key }),
    });
    if (isUnavailable(result)) {
      setUnavailable(result);
      return;
    }
    eventKeys.current.delete('start');
    setIntervention(result);
  }, [orchestration, setUnavailable]);

  const recordEvent = useCallback(async (
    eventType: 'RESOURCE_USED' | 'HINT_REQUESTED' | 'COMPLETED',
    resourceId?: string,
  ): Promise<InterventionResult | null> => {
    if (!intervention || isUnavailable(intervention)) return null;
    const identity = `${eventType}:${resourceId ?? 'task'}`;
    const key = eventKeys.current.get(identity) ?? eventKey();
    eventKeys.current.set(identity, key);
    const result = await requestJson<InterventionResult>('/api/assessment/remediation/interventions/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        interventionId: intervention.id,
        eventKey: key,
        eventType,
        resourceId,
        durationSeconds: eventType === 'COMPLETED' ? elapsedSeconds(intervention.startedAt) : undefined,
      }),
    });
    if (isUnavailable(result)) {
      setUnavailable(result);
      return null;
    }
    eventKeys.current.delete(identity);
    setIntervention(result);
    return result;
  }, [intervention, setUnavailable]);

  const openResource = useCallback(async (resource: { id: string; actionPath: string }) => {
    if (!isPlatformRelativePath(resource.actionPath)) {
      throw new Error('RESOURCE_TARGET_UNAVAILABLE');
    }
    const resourceWindow = window.open('', '_blank');
    if (resourceWindow) resourceWindow.opener = null;
    const result = await recordEvent('RESOURCE_USED', resource.id);
    if (!result) {
      resourceWindow?.close();
      return;
    }
    if (resourceWindow) resourceWindow.location.replace(resource.actionPath);
    else window.location.assign(resource.actionPath);
  }, [recordEvent]);

  const requestHint = useCallback(async () => {
    if (!hintEventRecorded.current) {
      const result = await recordEvent('HINT_REQUESTED');
      if (!result) return;
      hintEventRecorded.current = true;
    }
    await onRequestHint();
    hintEventRecorded.current = false;
  }, [onRequestHint, recordEvent]);

  const loadQuestion = useCallback(async () => {
    if (!intervention || isUnavailable(intervention)) return;
    const result = await requestJson<ValidationQuestion | UnavailableResult>(
      `/api/assessment/remediation/interventions/validation?interventionId=${encodeURIComponent(intervention.id)}`,
    );
    if (isUnavailable(result)) {
      setUnavailable(result);
      return;
    }
    setQuestion(result);
    setSelectedOption(null);
  }, [intervention, setUnavailable]);

  const submitValidation = useCallback(async () => {
    if (!intervention || isUnavailable(intervention) || !question || !selectedOption) return;
    const key = eventKeys.current.get('validation') ?? eventKey();
    eventKeys.current.set('validation', key);
    const result = await requestJson<InterventionResult>('/api/assessment/remediation/interventions/validation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        interventionId: intervention.id,
        eventKey: key,
        questionId: question.id,
        selectedOption,
        durationSeconds: elapsedSeconds(intervention.startedAt),
      }),
    });
    if (isUnavailable(result)) {
      setUnavailable(result);
      return;
    }
    eventKeys.current.delete('validation');
    setIntervention(result);
    setQuestion(null);
  }, [intervention, question, selectedOption, setUnavailable]);

  const unavailable = (isUnavailable(intervention) && intervention) || (isUnavailable(orchestration) && orchestration);
  const available = orchestration && !isUnavailable(orchestration) ? orchestration : null;
  const active = intervention && !isUnavailable(intervention) ? intervention : null;

  return (
    <section className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3" data-student-micro-tutoring="panel">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">错题微辅导</p>
          <p className="mt-1 text-xs leading-5 text-subtle">根据这次错答的有效证据生成针对性练习；不会改动正式学习路径。</p>
        </div>
        {!orchestration ? (
          <button
            type="button"
            onClick={() => void execute('create', createOrchestration)}
            disabled={pending !== null}
            className="inline-flex items-center gap-2 rounded-lg border border-primary px-3 py-2 text-xs font-semibold text-primary disabled:opacity-60"
          >
            {pending === 'create' ? <RefreshCw className="size-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="size-3.5" aria-hidden="true" />}
            开始微辅导
          </button>
        ) : null}
      </div>

      {unavailable ? (
        <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5 text-foreground" role="status">
          {humanizeUnavailable(unavailable.unavailableReason)}
          {unavailable.manualPracticePath ? (
            <a className="ml-2 font-semibold text-primary hover:underline" href={unavailable.manualPracticePath}>进入常规练习</a>
          ) : null}
        </div>
      ) : null}

      {available && !active ? (
        <div className="mt-3 rounded border border-border bg-background/70 p-3">
          <p className="text-sm font-medium text-foreground">目标：{available.task.goal}</p>
          <p className="mt-1 text-xs text-subtle">预计 {available.task.estimatedMinutes} 分钟，含资源学习与一道验证题。</p>
          <button
            type="button"
            onClick={() => void execute('start', startIntervention)}
            disabled={pending !== null}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            {pending === 'start' ? <RefreshCw className="size-3.5 animate-spin" aria-hidden="true" /> : <BookOpenCheck className="size-3.5" aria-hidden="true" />}
            开始本次辅导
          </button>
        </div>
      ) : null}

      {available && active && active.status !== 'VALIDATED' ? (
        <div className="mt-3 space-y-3">
          <div className="rounded border border-border bg-background/70 p-3 text-xs text-subtle">
            已使用 {active.progress.resourceUseCount} 项资源，已请求 {active.progress.hintCount} 次提示。
          </div>
          {active.status === 'STARTED' ? (
            <>
              <div className="grid gap-2">
                {available.task.resources.map((resource) => (
                  <button
                    key={resource.id}
                    type="button"
                    onClick={() => void execute(`resource:${resource.id}`, () => openResource(resource))}
                    disabled={pending !== null}
                    className="flex items-center justify-between rounded border border-border bg-background px-3 py-2 text-left text-xs font-medium text-foreground disabled:opacity-60"
                  >
                    <span>{resource.title}（约 {resource.estimatedMinutes} 分钟）</span>
                    <ExternalLink className="size-3.5 text-primary" aria-hidden="true" />
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void execute('hint', requestHint)} disabled={pending !== null} className="rounded border border-border px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-60">请求提示</button>
                <button type="button" onClick={() => void execute('complete', () => recordEvent('COMPLETED').then(() => undefined))} disabled={pending !== null} className="rounded bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60">完成学习，进入验证</button>
              </div>
            </>
          ) : null}
          {active.status === 'COMPLETED' && !question ? (
            <button type="button" onClick={() => void execute('question', loadQuestion)} disabled={pending !== null} className="inline-flex items-center gap-2 rounded bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60">
              {pending === 'question' ? <RefreshCw className="size-3.5 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="size-3.5" aria-hidden="true" />}
              获取验证题
            </button>
          ) : null}
          {active.status === 'COMPLETED' && question ? (
            <fieldset className="rounded border border-border bg-background/70 p-3">
              <legend className="px-1 text-sm font-medium text-foreground">{question.prompt}</legend>
              <div className="mt-2 grid gap-2">
                {question.options.map((option) => (
                  <label key={option.label} className="flex gap-2 rounded border border-border p-2 text-xs text-foreground">
                    <input type="radio" name="micro-tutoring-validation" value={option.label} checked={selectedOption === option.label} onChange={() => setSelectedOption(option.label)} />
                    <span>{option.label}. {option.text}</span>
                  </label>
                ))}
              </div>
              <button type="button" onClick={() => void execute('validation', submitValidation)} disabled={!selectedOption || pending !== null} className="mt-3 rounded bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60">提交验证</button>
            </fieldset>
          ) : null}
        </div>
      ) : null}

      {active?.status === 'VALIDATED' ? (
        <div className="mt-3 rounded border border-border bg-background/70 p-3 text-xs leading-5 text-foreground" role="status">
          <p className="font-semibold">{active.validation?.isCorrect ? '验证通过' : '验证未通过'}</p>
          {active.recommendation ? <p className="mt-1 text-subtle">{active.recommendation.basisSummary}</p> : null}
          {active.recommendation?.kind === 'TRANSFER_PRACTICE' && active.recommendation.actions.map((action) => (
            <a key={action.actionPath} href={action.actionPath} className="mt-2 block font-semibold text-primary hover:underline">{action.title}</a>
          ))}
          {active.recommendation?.kind === 'PREREQUISITE_SPLIT' ? <p className="mt-2 text-subtle">建议先复习：{active.recommendation.prerequisiteNodes.map((node) => node.name).join('、')}</p> : null}
          {active.recommendation?.kind === 'ADJUST_TUTORING_STRATEGY' ? <a href={active.recommendation.manualPracticePath} className="mt-2 inline-block font-semibold text-primary hover:underline">进入常规练习</a> : null}
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-destructive" role="alert">
          请求未完成，请重试。
          <button type="button" onClick={() => retryAction.current && void execute('retry', retryAction.current)} className="font-semibold underline">重试</button>
        </div>
      ) : null}
    </section>
  );
}
