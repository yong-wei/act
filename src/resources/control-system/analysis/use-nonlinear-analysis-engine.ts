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
      signalComparison: {
        input: data,
        output: data.map((point) => ({ x: point.x, y: Math.max(-1, Math.min(1, point.y)) })),
      },
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
  const omega = Number(request.parameters?.omega ?? 1);
  const signalTime = Array.from({ length: Math.min(160, Math.max(40, request.timeRange.samples)) }, (_, index) => {
    const end = Math.PI * 2 / Math.max(omega, 0.05);
    return (end * index) / Math.max(1, Math.min(160, Math.max(40, request.timeRange.samples)) - 1);
  });
  return {
    characteristic: {
      curve,
      sineEnvelope: [
        { x: -amplitude, y: Math.min(...ys) },
        { x: -amplitude, y: Math.max(...ys) },
        { x: amplitude, y: Math.max(...ys) },
        { x: amplitude, y: Math.min(...ys) },
      ],
      signalComparison: {
        input: signalTime.map((x) => ({ x, y: amplitude * Math.sin(omega * x) })),
        output: signalTime.map((x) => {
          const input = amplitude * Math.sin(omega * x);
          return { x, y: valueFor(input) };
        }),
      },
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
    const yRange = request.modelId === 'van_der_pol' ? [-4, 4] : [-3, 3];
    const points = Array.from({ length: request.timeRange.samples }, (_, index) => {
      const t = index / Math.max(1, request.timeRange.samples - 1);
      const theta = t * Math.PI * 4;
      return { x: Math.cos(theta) * (1 + 0.2 * t), y: Math.sin(theta) * (1 + 0.2 * t) };
    });
    const vectorField = Array.from({ length: 13 }, (_, ix) => (
      Array.from({ length: 13 }, (_, iy) => {
        const x = -3 + ix * 0.5;
        const y = yRange[0] + (iy * (yRange[1] - yRange[0])) / 12;
        return { x, y, dx: y, dy: -x };
      })
    )).flat();
    return {
      phasePlane: {
        vectorField,
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
    const selectedAmplitude = Number(request.parameters?.A ?? 2);
    const points = Array.from({ length: request.timeRange.samples }, (_, index) => {
      const progress = index / Math.max(1, request.timeRange.samples - 1);
      return { re: -0.2 - progress * 4, im: request.modelId.includes('hysteresis') ? -0.2 - progress : 0 };
    });
    return {
      negativeInverse: {
        curves: [{
          id: request.modelId,
          label: request.modelId,
          points,
          selectedPoint: { re: -Math.max(selectedAmplitude, 0.05), im: request.modelId.includes('hysteresis') ? -0.4 : 0, amplitude: selectedAmplitude },
          marks: { direction: 'arrow_for_increasing_A' },
        }],
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

  if (request.analysisKind === 'turning_radius') {
    const radius = Number(request.parameters?.R_m ?? 140);
    const samples = request.timeRange.samples;
    const time = Array.from({ length: samples }, (_, index) => request.timeRange.start + ((request.timeRange.end - request.timeRange.start) * index) / Math.max(1, samples - 1));
    const vMps = 4;
    const shipLengthM = 34;
    const obstacleCenter = { x: 145, y: -5 };
    const obstacleRadius = 25;
    const clearanceRadius = 41;
    const deltaMaxRad = 18 * Math.PI / 180;
    const deltaDeg = Math.atan(34 / Math.max(radius, 1)) * 180 / Math.PI;
    const deltaNeededRad = Math.atan(shipLengthM / Math.max(radius, 1));
    const dStart = Math.sqrt(clearanceRadius * (2 * radius + clearanceRadius));
    const rateLimit = 12 * Math.PI / 180;
    const dt = (request.timeRange.end - request.timeRange.start) / Math.max(1, samples - 1);
    let deltaCommand = 0;
    let heading = 0;
    let x = 0;
    let y = 0;
    let active = false;
    let maxDeltaRad = 0;
    let minDistance = Number.POSITIVE_INFINITY;
    const actualDelta = [];
    const targetDelta = [];
    const actualPath = [];
    const nominalPath = [];
    for (const t of time) {
      if (actualPath.length > 0) {
        const previousDistance = Math.hypot(obstacleCenter.x - x, obstacleCenter.y - y);
        if (!active && previousDistance <= dStart) active = true;
        const target = active && heading < 45 * Math.PI / 180 ? Math.min(deltaNeededRad, deltaMaxRad) : 0;
        const step = Math.max(-rateLimit * dt, Math.min(rateLimit * dt, target - deltaCommand));
        deltaCommand += step;
        heading += dt * (vMps / shipLengthM) * Math.tan(deltaCommand);
        x += dt * vMps * Math.cos(heading);
        y += dt * vMps * Math.sin(heading);
      }
      const distance = Math.hypot(obstacleCenter.x - x, obstacleCenter.y - y);
      minDistance = Math.min(minDistance, distance);
      maxDeltaRad = Math.max(maxDeltaRad, Math.abs(deltaCommand));
      const progress = Math.max(0, Math.min(1, heading / (45 * Math.PI / 180)));
      const nominalTheta = progress * 45 * Math.PI / 180;
      actualDelta.push({ x: t, y: deltaCommand * 180 / Math.PI });
      targetDelta.push({ x: t, y: active && heading < 45 * Math.PI / 180 ? deltaDeg : 0 });
      actualPath.push({ x, y });
      nominalPath.push({
        x: obstacleCenter.x - dStart + radius * Math.sin(nominalTheta),
        y: radius * (1 - Math.cos(nominalTheta)),
      });
    }
    const collisionActive = minDistance < obstacleRadius;
    const safetyConstraintSatisfied = minDistance >= clearanceRadius;
    return {
      turningRadius: {
        dStartM: dStart,
        deltaDDeg: deltaDeg,
        maxDeltaDeg: maxDeltaRad * 180 / Math.PI,
        saturationActive: deltaDeg > 18,
        minDistanceM: minDistance,
        collisionActive,
        safetyConstraintSatisfied,
        headingCurves: [
          { id: 'delta', label: '实际舵角', points: actualDelta },
          { id: 'delta_target', label: '目标舵角', points: targetDelta },
        ],
        path: {
          actual: actualPath,
          nominal: nominalPath,
          obstacleCenter,
          obstacleRadius,
          clearanceRadius,
        },
      },
      summary: {
        outcome: '浏览器端使用备用转弯半径曲线，等待 Rust/WASM 非线性分析引擎返回结果。',
        metrics: [`R=${radius.toFixed(0)} m`, `delta_d=${deltaDeg.toFixed(2)} deg`],
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
    requestKey,
    resultRequestKey: requestKey,
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      const result = fallbackResult ?? createFallbackNonlinearAnalysisResult(request);
      setState({
        result,
        isLoading: false,
        error: null,
        isFallback: Boolean(result.isFallback),
        requestKey,
        resultRequestKey: requestKey,
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
        requestKey,
        resultRequestKey: requestKey,
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
      requestKey,
      resultRequestKey: prev.resultRequestKey,
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
          requestKey,
          resultRequestKey: requestKey,
        });
        return;
      }

      const result = fallbackResult ?? createFallbackNonlinearAnalysisResult(request);
      setState({
        result,
        isLoading: false,
        error: message.error,
        isFallback: true,
        requestKey,
        resultRequestKey: requestKey,
      });
    };

    const handleError = () => {
      const result = fallbackResult ?? createFallbackNonlinearAnalysisResult(request);
      setState({
        result,
        isLoading: false,
        error: '控制分析 Worker 加载失败。',
        isFallback: true,
        requestKey,
        resultRequestKey: requestKey,
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
