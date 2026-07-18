// @vitest-environment jsdom

import { act } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ControlAnalysisRequest, ControlAnalysisResult } from '@/resources/control-system/analysis/types';

vi.mock('@/resources/control-system/charts/control-analysis-panels', () => ({
  BodePanel: ResultPanel,
  ControlPerformanceBar: ResultPanel,
  MagnitudePanel: ResultPanel,
  NyquistPanel: ResultPanel,
  PhasePanel: ResultPanel,
  RootLocusPanel: ResultPanel,
  StepResponsePanel: ResultPanel,
  TimeDomainPanel: ResultPanel,
  formatFrequencyResponseReading: () => 'frequency reading',
}));

import { ControlFigureWorkspace } from '@/resources/control-system/charts/control-figure-workspace';

function ResultPanel({ result }: { result: ControlAnalysisResult }) {
  return <div data-testid={`result-${result.metrics.finalValue}`}>{result.metrics.finalValue}</div>;
}

const REQUEST_A: ControlAnalysisRequest = {
  runtimeMode: 'analysis',
  caseId: 'request-a',
  plant: { numerator: [1], denominator: [1, 1], coefficientOrder: 'descending' },
  structures: [],
  outputs: ['step_response'],
  timeRange: { start: 0, end: 1, samples: 8 },
  frequencyRange: { min: 0.1, max: 10, samples: 8 },
  rootLocus: { minGain: 0, maxGain: 2, samples: 2, currentGain: 1 },
};

const REQUEST_B: ControlAnalysisRequest = {
  ...REQUEST_A,
  caseId: 'request-b',
};

function result(finalValue: number, isFallback = false): ControlAnalysisResult {
  return {
    metrics: {
      overshootPct: 0,
      riseTimeSec: null,
      settlingTimeSec: null,
      peakTimeSec: null,
      finalValue,
      phaseMarginDeg: null,
      gainMarginDb: null,
      gainCrossoverRadPerSec: null,
      phaseCrossoverRadPerSec: null,
      bandwidthRadPerSec: null,
    },
    stepResponse: { points: [] },
    magnitude: { points: [] },
    phase: { points: [] },
    nyquist: { mode: 'full', points: [] },
    rootLocus: { branches: [], currentPoles: [], openLoopPoles: [], openLoopZeros: [] },
    isFallback,
  };
}

type WorkerListener = (event: MessageEvent) => void;

class MockWorker {
  static instances: MockWorker[] = [];

  postedMessages: Array<{ id: string; requestJson: string }> = [];
  private listeners = new Map<string, Set<WorkerListener>>();

  constructor() {
    MockWorker.instances.push(this);
  }

  addEventListener(type: string, listener: WorkerListener) {
    const listeners = this.listeners.get(type) ?? new Set<WorkerListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: WorkerListener) {
    this.listeners.get(type)?.delete(listener);
  }

  postMessage(message: { id: string; requestJson: string }) {
    this.postedMessages.push(message);
  }

  terminate() {}

  finish(index: number, analysisResult: ControlAnalysisResult) {
    const request = this.postedMessages[index];
    const event = { data: { id: request.id, ok: true, resultJson: JSON.stringify(analysisResult) } } as MessageEvent;
    this.listeners.get('message')?.forEach((listener) => listener(event));
  }
}

describe('shared control engine rerenders', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    MockWorker.instances = [];
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal('Worker', MockWorker);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('does not expose completed request A during the first render for request B', async () => {
    await act(async () => root.render(
      <ControlFigureWorkspace request={REQUEST_A} layout="platform" />,
    ));

    const worker = MockWorker.instances[0];
    await act(async () => worker.finish(0, result(101)));
    expect(container.querySelector('[data-testid="result-101"]')).not.toBeNull();

    act(() => {
      flushSync(() => root.render(
        <ControlFigureWorkspace request={REQUEST_B} layout="platform" />,
      ));
      expect(container.querySelector('[data-testid="result-101"]')).toBeNull();
      expect(container.textContent).toContain('正在计算当前控制分析请求');
    });

    expect(worker.postedMessages).toHaveLength(2);
    expect(container.querySelector('[data-testid="result-101"]')).toBeNull();

    await act(async () => worker.finish(1, result(202)));
    expect(container.querySelector('[data-testid="result-202"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="result-101"]')).toBeNull();
  });

  it('keeps the current fallback panel visible while the initial request is loading', async () => {
    await act(async () => root.render(
      <ControlFigureWorkspace
        request={REQUEST_A}
        fallbackResult={result(303, true)}
        layout="platform"
      />,
    ));

    expect(container.querySelector('[data-testid="result-303"]')).not.toBeNull();
    expect(container.textContent).toContain('正在计算当前控制分析请求');
  });
});
