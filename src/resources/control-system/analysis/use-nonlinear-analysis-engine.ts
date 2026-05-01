'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type {
  NonlinearAnalysisEngineState,
  NonlinearAnalysisRequest,
  NonlinearAnalysisResult,
} from './nonlinear-analysis-types';

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

function fallbackLine(points = 80): NonlinearAnalysisResult {
  const data = Array.from({ length: points }, (_, index) => {
    const x = -2 + (4 * index) / Math.max(1, points - 1);
    return { x, y: Math.sin(x) };
  });
  return {
    characteristic: {
      curve: data,
      sineEnvelope: data.map((point) => ({ x: point.x, y: Math.max(-1, Math.min(1, point.x)) })),
      describingFunction: { re: 1, im: 0 },
    },
    summary: {
      outcome: '浏览器端使用备用曲线，等待 Rust/WASM 非线性分析引擎返回结果。',
      metrics: ['备用曲线仅用于保持页面可读。'],
    },
    isFallback: true,
    fallbackMessage: 'Rust/WASM 非线性分析引擎暂不可用。',
  };
}

function fallbackCharacteristic(request: NonlinearAnalysisRequest): NonlinearAnalysisResult {
  const k = Number(request.parameters?.k ?? 1);
  const a = Number(request.parameters?.a ?? 1);
  const delta = Number(request.parameters?.Delta ?? 0.5);
  const relayM = Number(request.parameters?.M ?? 1);
  const deadband = Number(request.parameters?.d ?? 0.5);
  const h = Number(request.parameters?.h ?? 0.5);
  const b = Number(request.parameters?.b ?? 0.5);
  const range = Array.from({ length: request.timeRange.samples }, (_, index) => {
    const x = request.timeRange.start + ((request.timeRange.end - request.timeRange.start) * index) / Math.max(1, request.timeRange.samples - 1);
    return x;
  });
  const valueFor = (x: number) => {
    if (request.modelId === 'deadzone') return Math.abs(x) <= delta ? 0 : Math.sign(x) * k * (Math.abs(x) - delta);
    if (request.modelId === 'deadzone_saturation') return Math.abs(x) <= delta ? 0 : Math.sign(x) * k * Math.min(Math.abs(x) - delta, Math.max(0.01, a - delta));
    if (request.modelId === 'relay') return x >= 0 ? relayM : -relayM;
    if (request.modelId === 'deadzone_relay') return Math.abs(x) <= deadband ? 0 : Math.sign(x) * relayM;
    return Math.max(-k * a, Math.min(k * a, k * x));
  };
  const curve = request.modelId === 'hysteresis_relay'
    ? [
      ...range.map((x) => ({ x, y: x >= h ? relayM : -relayM })),
      ...range.slice().reverse().map((x) => ({ x, y: x <= -h ? -relayM : relayM })),
    ]
    : request.modelId === 'backlash'
      ? [
        ...range.map((x) => ({ x, y: k * (x - b) })),
        ...range.slice().reverse().map((x) => ({ x, y: k * (x + b) })),
      ]
      : range.map((x) => ({ x, y: valueFor(x) }));
  const ys = curve.map((point) => point.y);
  const amplitude = Number(request.parameters?.A ?? 2);
  return {
    characteristic: {
      curve,
      sineEnvelope: [
        { x: -amplitude, y: Math.min(...ys) },
        { x: -amplitude, y: Math.max(...ys) },
        { x: amplitude, y: Math.max(...ys) },
        { x: amplitude, y: Math.min(...ys) },
      ],
      describingFunction: { re: request.modelId.includes('relay') ? relayM / Math.max(amplitude, 0.05) : k, im: request.modelId === 'hysteresis_relay' || request.modelId === 'backlash' ? -0.2 : 0 },
    },
    summary: {
      outcome: '浏览器端使用备用非线性特性曲线，等待 Rust/WASM 非线性分析引擎返回结果。',
      metrics: [`当前标签 ${request.modelId}`],
    },
    isFallback: true,
    fallbackMessage: 'Rust/WASM 非线性分析引擎暂不可用。',
  };
}

export function createFallbackNonlinearAnalysisResult(request: NonlinearAnalysisRequest): NonlinearAnalysisResult {
  if (request.analysisKind === 'phase_plane') {
    const points = Array.from({ length: request.timeRange.samples }, (_, index) => {
      const t = index / Math.max(1, request.timeRange.samples - 1);
      const theta = t * Math.PI * 4;
      return { x: Math.cos(theta) * (1 + 0.2 * t), y: Math.sin(theta) * (1 + 0.2 * t) };
    });
    return {
      phasePlane: {
        vectorField: [],
        trajectories: [{ id: 'fallback', points }],
      },
      summary: {
        outcome: '趋向闭合轨道',
        metrics: ['备用相轨迹用于离线预览。'],
      },
      isFallback: true,
      fallbackMessage: 'Rust/WASM 非线性分析引擎暂不可用。',
    };
  }

  if (request.analysisKind === 'negative_inverse_family') {
    const points = Array.from({ length: request.timeRange.samples }, (_, index) => {
      const progress = index / Math.max(1, request.timeRange.samples - 1);
      return { re: -0.2 - progress * 4, im: request.modelId.includes('hysteresis') ? -0.2 - progress : 0 };
    });
    return {
      negativeInverse: {
        curves: [{ id: request.modelId, label: request.modelId, points, marks: { direction: 'arrow_for_increasing_A' } }],
      },
      summary: {
        outcome: '负倒曲线随 A 增大向远离起点方向移动',
        metrics: ['备用负倒曲线用于离线预览。'],
      },
      isFallback: true,
      fallbackMessage: 'Rust/WASM 非线性分析引擎暂不可用。',
    };
  }

  if (request.analysisKind === 'harmonic_lowpass') {
    const samples = request.timeRange.samples;
    const amplitude = Number(request.parameters?.A ?? 2);
    const omega = Number(request.parameters?.omega ?? 1);
    const cutoff = Number(request.parameters?.omega_c ?? 2);
    const relayM = Number(request.parameters?.M ?? 1);
    const attenuation = cutoff / Math.sqrt(cutoff * cutoff + omega * omega);
    const time = Array.from({ length: samples }, (_, index) => request.timeRange.start + ((request.timeRange.end - request.timeRange.start) * index) / Math.max(1, samples - 1));
    return {
      harmonic: {
        input: time.map((x) => ({ x, y: amplitude * Math.sin(omega * x) })),
        relayOutput: time.map((x) => ({ x, y: Math.sin(omega * x) >= 0 ? relayM : -relayM })),
        filteredOutput: time.map((x) => ({ x, y: attenuation * (4 * relayM / Math.PI) * Math.sin(omega * x) })),
        describingFunctionApproximation: time.map((x) => ({ x, y: (4 * relayM / Math.PI) * Math.sin(omega * x) })),
        spectrum: [
          { harmonic: 1, amplitude: 4 * relayM / Math.PI },
          { harmonic: 3, amplitude: 4 * relayM / (3 * Math.PI) },
          { harmonic: 5, amplitude: 4 * relayM / (5 * Math.PI) },
        ],
      },
      summary: {
        outcome: '低通截止频率越低，高次谐波越被衰减',
        metrics: [`备用基波衰减系数 ${attenuation.toFixed(2)}`],
      },
      isFallback: true,
      fallbackMessage: 'Rust/WASM 非线性分析引擎暂不可用。',
    };
  }

  if (request.analysisKind === 'characteristic') {
    return fallbackCharacteristic(request);
  }

  return fallbackLine(request.timeRange.samples);
}

export function useNonlinearAnalysisEngine(
  request: NonlinearAnalysisRequest,
  fallbackResult?: NonlinearAnalysisResult,
): NonlinearAnalysisEngineState {
  const requestKey = useMemo(() => JSON.stringify(request), [request]);
  const cacheRef = useRef<Map<string, NonlinearAnalysisResult>>(new Map());
  const workerRef = useRef<Worker | null>(null);
  const latestRequestIdRef = useRef<string | null>(null);
  const [state, setState] = useState<NonlinearAnalysisEngineState>({
    result: fallbackResult ?? createFallbackNonlinearAnalysisResult(request),
    isLoading: true,
    error: null,
    isFallback: Boolean(fallbackResult?.isFallback ?? true),
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      const result = fallbackResult ?? createFallbackNonlinearAnalysisResult(request);
      setState({
        result,
        isLoading: false,
        error: null,
        isFallback: Boolean(result.isFallback),
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
      workerRef.current = new Worker(new URL('./control-analysis.worker.ts', import.meta.url), { type: 'module' });
    }

    const worker = workerRef.current;
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    latestRequestIdRef.current = requestId;
    setState((prev) => ({
      result: prev.result ?? fallbackResult ?? createFallbackNonlinearAnalysisResult(request),
      isLoading: true,
      error: null,
      isFallback: Boolean(prev.result?.isFallback ?? fallbackResult?.isFallback ?? true),
    }));

    const handleMessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.id !== latestRequestIdRef.current) return;
      if (message.ok) {
        const result = JSON.parse(message.resultJson) as NonlinearAnalysisResult;
        cacheRef.current.set(requestKey, result);
        setState({
          result,
          isLoading: false,
          error: null,
          isFallback: Boolean(result.isFallback),
        });
        return;
      }

      const result = fallbackResult ?? createFallbackNonlinearAnalysisResult(request);
      setState({
        result,
        isLoading: false,
        error: message.error,
        isFallback: true,
      });
    };

    const handleError = () => {
      const result = fallbackResult ?? createFallbackNonlinearAnalysisResult(request);
      setState({
        result,
        isLoading: false,
        error: '控制分析 Worker 加载失败。',
        isFallback: true,
      });
    };

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);
    worker.postMessage({ id: requestId, requestJson: requestKey });

    return () => {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
    };
  }, [fallbackResult, request, requestKey]);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  return state;
}
