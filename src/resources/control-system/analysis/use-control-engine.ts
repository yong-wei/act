'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { computeAnalysisBrowser } from '@/lib/control-engine/client';
import { ControlEngineFailure, WORKER_RETRY_MS } from '@/lib/control-engine';
import type { ControlEngineEnvelope } from '@/lib/control-engine';

import type { ControlAnalysisRequest, ControlAnalysisResult, ControlEngineState } from './types';

interface WorkerSuccessMessage {
  id: string;
  ok: true;
  resultJson: string;
  envelope?: ControlEngineEnvelope<ControlAnalysisResult>;
}

interface WorkerFailureMessage {
  id: string;
  ok: false;
  error: string;
  state?: 'error' | 'timeout' | 'unavailable';
}

type WorkerMessage = WorkerSuccessMessage | WorkerFailureMessage;

type KeyedControlEngineState = ControlEngineState & {
  requestKey: string;
};

function asFallbackPresentation(result?: ControlAnalysisResult): ControlAnalysisResult | null {
  if (!result) return null;
  return {
    ...result,
    isFallback: true,
    source: 'fallback',
    isAuthoritative: false,
    runtimeIdentity: null,
  };
}

function asRuntimePresentation(
  result: ControlAnalysisResult,
  envelope?: ControlEngineEnvelope<ControlAnalysisResult>,
): ControlAnalysisResult {
  return {
    ...result,
    isFallback: false,
    source: 'runtime',
    isAuthoritative: true,
    runtimeIdentity: envelope?.runtimeIdentity ?? null,
  };
}

export function useControlEngine(
  request: ControlAnalysisRequest,
  fallbackResult?: ControlAnalysisResult,
  enabled = true,
): ControlEngineState {
  const requestKey = useMemo(() => JSON.stringify(request), [request]);
  const cacheRef = useRef<Map<string, ControlAnalysisResult>>(new Map());
  const workerRef = useRef<Worker | null>(null);
  const latestRequestIdRef = useRef<string | null>(null);
  const [state, setState] = useState<KeyedControlEngineState>(() => ({
    requestKey,
    result: enabled ? asFallbackPresentation(fallbackResult) : null,
    isLoading: enabled,
    error: null,
    isFallback: !enabled || Boolean(fallbackResult),
    lifecycle: enabled ? 'loading' : 'idle',
    isAuthoritative: false,
    source: fallbackResult ? 'fallback' : undefined,
    runtimeIdentity: null,
  }));

  useEffect(() => {
    if (!enabled) {
      setState({
        requestKey,
        result: null,
        isLoading: false,
        error: null,
        isFallback: true,
        lifecycle: 'idle',
        isAuthoritative: false,
        source: 'fallback',
        runtimeIdentity: null,
      });
      return undefined;
    }

    if (typeof window === 'undefined') {
      setState({
        requestKey,
        result: asFallbackPresentation(fallbackResult),
        isLoading: false,
        error: fallbackResult ? null : '控制分析引擎只在浏览器环境可用。',
        isFallback: true,
        lifecycle: fallbackResult ? 'unavailable' : 'unavailable',
        isAuthoritative: false,
        source: fallbackResult ? 'fallback' : undefined,
        runtimeIdentity: null,
      });
      return undefined;
    }

    if (cacheRef.current.has(requestKey)) {
      const cached = cacheRef.current.get(requestKey)!;
      setState({
        requestKey,
        result: cached,
        isLoading: false,
        error: null,
        isFallback: false,
        lifecycle: 'ready',
        isAuthoritative: cached.isAuthoritative !== false,
        source: 'runtime',
        runtimeIdentity: cached.runtimeIdentity ?? null,
      });
      return undefined;
    }

    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../../../lib/control-engine/analysis.worker.ts', import.meta.url),
        { type: 'module' },
      );
    }

    const worker = workerRef.current;
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    latestRequestIdRef.current = requestId;
    let settled = false;
    setState({
      requestKey,
      result: asFallbackPresentation(fallbackResult),
      isLoading: true,
      error: null,
      isFallback: Boolean(fallbackResult),
      lifecycle: 'loading',
      isAuthoritative: false,
      source: fallbackResult ? 'fallback' : undefined,
      runtimeIdentity: null,
    });

    const finishWithEnvelope = (result: ControlAnalysisResult, envelope?: ControlEngineEnvelope<ControlAnalysisResult>) => {
      const presented = asRuntimePresentation(result, envelope);
      cacheRef.current.set(requestKey, presented);
      setState({
        requestKey,
        result: presented,
        isLoading: false,
        error: null,
        isFallback: false,
        lifecycle: 'ready',
        isAuthoritative: true,
        source: 'runtime',
        runtimeIdentity: envelope?.runtimeIdentity ?? presented.runtimeIdentity,
        executor: envelope?.executor,
        authoritySource: envelope?.authoritySource,
      });
    };

    const finishWithFailure = (error: unknown) => {
      const failure = error instanceof ControlEngineFailure
        ? error
        : new ControlEngineFailure({
          state: 'error',
          category: 'execution-error',
          message: error instanceof Error ? error.message : '控制分析引擎执行失败。',
          retryable: false,
        });
      setState({
        requestKey,
        result: asFallbackPresentation(fallbackResult),
        isLoading: false,
        error: failure.message,
        isFallback: Boolean(fallbackResult),
        lifecycle: failure.state,
        isAuthoritative: false,
        source: fallbackResult ? 'fallback' : undefined,
        runtimeIdentity: null,
      });
    };

    const runBrowserFacade = () => {
      if (settled) return;
      void computeAnalysisBrowser(JSON.parse(requestKey) as ControlAnalysisRequest, {
        executor: 'browser',
        requestId,
      }).then((envelope) => {
        if (settled || latestRequestIdRef.current !== requestId) return;
        settled = true;
        finishWithEnvelope(envelope.result, envelope);
      }).catch((error) => {
        if (settled || latestRequestIdRef.current !== requestId) return;
        settled = true;
        finishWithFailure(error);
      });
    };

    const workerRetryTimer = window.setTimeout(runBrowserFacade, WORKER_RETRY_MS);

    const handleMessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.id !== latestRequestIdRef.current || settled) return;
      if (message.ok) {
        settled = true;
        window.clearTimeout(workerRetryTimer);
        const result = JSON.parse(message.resultJson) as ControlAnalysisResult;
        finishWithEnvelope(result, message.envelope);
        return;
      }
      window.clearTimeout(workerRetryTimer);
      runBrowserFacade();
    };

    const handleError = () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      window.clearTimeout(workerRetryTimer);
      runBrowserFacade();
    };

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);
    worker.postMessage({ id: requestId, requestJson: requestKey });

    return () => {
      settled = true;
      window.clearTimeout(workerRetryTimer);
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
    };
  }, [enabled, fallbackResult, requestKey]);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  if (state.requestKey !== requestKey) {
    return {
      result: enabled ? asFallbackPresentation(fallbackResult) : null,
      isLoading: enabled,
      error: null,
      isFallback: !enabled || Boolean(fallbackResult),
      lifecycle: enabled ? 'loading' : 'idle',
      isAuthoritative: false,
      source: fallbackResult ? 'fallback' : undefined,
      runtimeIdentity: null,
    };
  }

  return state;
}
