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

export function useControlEngine(
  request: ControlAnalysisRequest,
  fallbackResult?: ControlAnalysisResult,
): ControlEngineState {
  const requestKey = useMemo(() => JSON.stringify(request), [request]);
  const cacheRef = useRef<Map<string, ControlAnalysisResult>>(new Map());
  const workerRef = useRef<Worker | null>(null);
  const latestRequestIdRef = useRef<string | null>(null);
  const [state, setState] = useState<ControlEngineState>({
    result: fallbackResult ?? null,
    isLoading: true,
    error: null,
    isFallback: Boolean(fallbackResult?.isFallback),
  });

  useEffect(() => {
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
    setState((prev) => ({
      result: prev.result ?? fallbackResult ?? null,
      isLoading: true,
      error: null,
      isFallback: Boolean(prev.result?.isFallback ?? fallbackResult?.isFallback),
    }));

    const handleMessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.id !== latestRequestIdRef.current) {
        return;
      }

      if (message.ok) {
        const result = JSON.parse(message.resultJson) as ControlAnalysisResult;
        cacheRef.current.set(requestKey, result);
        setState({
          result,
          isLoading: false,
          error: null,
          isFallback: Boolean(result.isFallback),
        });
        return;
      }

      setState({
        result: fallbackResult ?? null,
        isLoading: false,
        error: message.error,
        isFallback: Boolean(fallbackResult),
      });
    };

    const handleError = () => {
      setState({
        result: fallbackResult ?? null,
        isLoading: false,
        error: '控制分析 Worker 加载失败。',
        isFallback: Boolean(fallbackResult),
      });
    };

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);
    worker.postMessage({ id: requestId, requestJson: requestKey });

    return () => {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
    };
  }, [fallbackResult, requestKey]);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  return state;
}
