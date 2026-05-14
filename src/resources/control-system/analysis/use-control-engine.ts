'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { ControlAnalysisRequest, ControlAnalysisResult, ControlEngineState } from './types';

interface WorkerSuccessMessage {
  id: string;
  ok: true;
  resultJson: string;
}

interface WorkerFailureMessage {
  id: string;
  ok: false;
  error: string;
}

type WorkerMessage = WorkerSuccessMessage | WorkerFailureMessage;

async function computeAnalysisOnMainThread(requestJson: string): Promise<string> {
  const controlEngine = await import('../wasm/control_engine/index.js');
  await controlEngine.default();
  const request = JSON.parse(requestJson) as { runtimeMode?: string };
  const nonlinearCompute = (controlEngine as typeof controlEngine & {
    compute_nonlinear_analysis?: (request: string) => string;
  }).compute_nonlinear_analysis;
  return request.runtimeMode === 'nonlinear_analysis' && typeof nonlinearCompute === 'function'
    ? nonlinearCompute(requestJson)
    : controlEngine.compute_analysis(requestJson);
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
  const [state, setState] = useState<ControlEngineState>({
    result: fallbackResult ?? null,
    isLoading: false,
    error: null,
    isFallback: Boolean(fallbackResult?.isFallback),
  });

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    if (typeof window === 'undefined') {
      setState({
        result: fallbackResult ?? null,
        isLoading: false,
        error: fallbackResult ? null : '控制分析引擎只在浏览器环境可用。',
        isFallback: Boolean(fallbackResult),
      });
      return undefined;
    }

    if (cacheRef.current.has(requestKey)) {
      const cached = cacheRef.current.get(requestKey)!;
      setState({
        result: cached,
        isLoading: false,
        error: null,
        isFallback: Boolean(cached.isFallback),
      });
      return undefined;
    }

    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('./control-analysis.worker.ts', import.meta.url),
        { type: 'module' },
      );
    }

    const worker = workerRef.current;
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    latestRequestIdRef.current = requestId;
    let settled = false;
    setState((prev) => ({
      result: prev.result ?? fallbackResult ?? null,
      isLoading: true,
      error: null,
      isFallback: Boolean(prev.result?.isFallback ?? fallbackResult?.isFallback),
    }));

    const finishWithResult = (resultJson: string) => {
      const result = JSON.parse(resultJson) as ControlAnalysisResult;
      cacheRef.current.set(requestKey, result);
      setState({
        result,
        isLoading: false,
        error: null,
        isFallback: Boolean(result.isFallback),
      });
    };

    const finishWithError = (error: string) => {
      setState({
        result: fallbackResult ?? null,
        isLoading: false,
        error,
        isFallback: Boolean(fallbackResult),
      });
    };

    const runMainThreadFallback = () => {
      if (settled) {
        return;
      }
      void computeAnalysisOnMainThread(requestKey)
        .then((resultJson) => {
          if (settled || latestRequestIdRef.current !== requestId) {
            return;
          }
          settled = true;
          finishWithResult(resultJson);
        })
        .catch((error) => {
          if (settled || latestRequestIdRef.current !== requestId) {
            return;
          }
          settled = true;
          finishWithError(error instanceof Error ? error.message : '控制分析引擎执行失败。');
        });
    };

    const mainThreadFallbackTimer = window.setTimeout(runMainThreadFallback, 4000);

    const handleMessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.id !== latestRequestIdRef.current) {
        return;
      }
      if (settled) {
        return;
      }

      if (message.ok) {
        settled = true;
        window.clearTimeout(mainThreadFallbackTimer);
        finishWithResult(message.resultJson);
        return;
      }

      window.clearTimeout(mainThreadFallbackTimer);
      runMainThreadFallback();
    };

    const handleError = () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      window.clearTimeout(mainThreadFallbackTimer);
      runMainThreadFallback();
    };

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);
    worker.postMessage({ id: requestId, requestJson: requestKey });

    return () => {
      settled = true;
      window.clearTimeout(mainThreadFallbackTimer);
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

  return state;
}
