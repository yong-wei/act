// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ControlAnalysisResult } from '@/resources/control-system/analysis/types';

const ANALYSIS_RESULT: ControlAnalysisResult = {
  metrics: {
    overshootPct: 0,
    riseTimeSec: null,
    settlingTimeSec: null,
    peakTimeSec: null,
    finalValue: 1,
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
};

vi.mock('@/resources/control-system/charts/control-figure-workspace', async () => {
  const { useEffect } = await import('react');
  return {
    ControlFigureWorkspace: ({ request, onResult }: {
      request: Record<string, unknown>;
      onResult?: (result: ControlAnalysisResult, requestKey: string) => void;
    }) => {
      const requestKey = JSON.stringify(request);
      useEffect(() => onResult?.(ANALYSIS_RESULT, requestKey), [onResult, requestKey]);
      return <div data-testid="control-workbench-result">计算完成</div>;
    },
  };
});

import {
  UNIT_1_4StepContentPanel,
  UNIT_1_4StudentActivityForm,
} from '@/features/interactive/unit-1-4-time-frequency-views/step-panels';
import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';
import { UNIT_1_4_LESSON_STEPS } from '@/lib/unit-1-4-course';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((next, fail) => {
    resolve = next;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function setFormValue(element: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype = element instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}

describe('unit 1-4 shared control-workbench submission', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('keeps blank number and select fields empty, locks a deferred submit, and retries after failure', async () => {
    const firstAttempt = deferred<void>();
    const retryAttempt = deferred<void>();
    const onPanelSubmit = vi.fn()
      .mockImplementationOnce(() => firstAttempt.promise)
      .mockImplementationOnce(() => retryAttempt.promise);
    const manifest = normalizeInteractiveRuntimeManifest(JSON.parse(readFileSync(
      join(process.cwd(), 'course-content/runtime/lessons/1-4/interactive-manifest.json'),
      'utf8',
    )))!;
    const step = UNIT_1_4_LESSON_STEPS.find((item) => item.id === 'step-07')!;

    await act(async () => root.render(
      <UNIT_1_4StepContentPanel
        step={step}
        manifest={manifest}
        onPanelSubmit={onPanelSubmit}
        showFrequencyReadings={false}
      />,
    ));

    const magnitude = container.querySelector<HTMLInputElement>('input[name="magnitude_db"]')!;
    const phase = container.querySelector<HTMLInputElement>('input[name="phase_deg"]')!;
    const quadrant = container.querySelector<HTMLSelectElement>('select[name="nyquist_quadrant"]')!;
    const submit = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('提交当前观察'))!;

    expect(magnitude.value).toBe('');
    expect(phase.value).toBe('');
    expect(quadrant.value).toBe('');
    expect(submit.disabled).toBe(true);

    await act(async () => {
      setFormValue(magnitude, '-19.1');
      setFormValue(phase, '-116.5');
      setFormValue(quadrant, '第三象限');
    });

    expect(submit.disabled).toBe(false);
    await act(async () => {
      submit.click();
      submit.click();
    });
    expect(onPanelSubmit).toHaveBeenCalledTimes(1);
    expect(submit.disabled).toBe(true);
    expect(submit.textContent).toContain('提交中');

    await act(async () => firstAttempt.reject(new Error('保存失败')));
    expect(container.textContent).toContain('保存失败');
    expect(container.textContent).toContain('当前结果仍保留，可再次提交');
    expect(submit.disabled).toBe(false);

    await act(async () => {
      submit.click();
      submit.click();
    });
    expect(onPanelSubmit).toHaveBeenCalledTimes(2);
    expect(submit.disabled).toBe(true);

    await act(async () => retryAttempt.resolve());
    expect(submit.disabled).toBe(false);
    expect(container.textContent).not.toContain('保存失败');
  });

  it.each(['step-05', 'step-07'])('keeps %s compute-owned response on one submit surface before and after persistence', async (stepId) => {
    const manifest = normalizeInteractiveRuntimeManifest(JSON.parse(readFileSync(
      join(process.cwd(), 'course-content/runtime/lessons/1-4/interactive-manifest.json'),
      'utf8',
    )))!;
    const step = UNIT_1_4_LESSON_STEPS.find((item) => item.id === stepId)!;
    const renderSurface = (saved: boolean) => (
      <>
        <UNIT_1_4StepContentPanel
          step={step}
          manifest={manifest}
          onPanelSubmit={async () => undefined}
          showFrequencyReadings={saved}
        />
        <UNIT_1_4StudentActivityForm
          step={step}
          manifest={manifest}
          savedResponse={saved ? { stepId, submittedAt: 1, answers: { persisted: 'true' } } : undefined}
          released
          browseEnabled
          answerVisible={false}
          revealProgress={0}
          onSubmit={async () => undefined}
        />
      </>
    );

    await act(async () => root.render(renderSurface(false)));
    expect(Array.from(container.querySelectorAll('button')).filter((button) => button.textContent?.includes('提交'))).toHaveLength(1);

    await act(async () => root.render(renderSurface(true)));
    expect(Array.from(container.querySelectorAll('button')).filter((button) => button.textContent?.includes('提交'))).toHaveLength(1);
    expect(container.textContent).not.toContain('独立提交本卡');
  });

  it('keeps the step-06 definition judgment on the generic activity surface', async () => {
    const manifest = normalizeInteractiveRuntimeManifest(JSON.parse(readFileSync(
      join(process.cwd(), 'course-content/runtime/lessons/1-4/interactive-manifest.json'),
      'utf8',
    )))!;
    const step = UNIT_1_4_LESSON_STEPS.find((item) => item.id === 'step-06')!;

    await act(async () => root.render(
      <UNIT_1_4StudentActivityForm
        step={step}
        manifest={manifest}
        released
        browseEnabled
        answerVisible={false}
        revealProgress={0}
        onSubmit={async () => undefined}
      />,
    ));

    expect(container.textContent).toContain('闭环带宽与环路增益穿越频率的定义相同');
    expect(Array.from(container.querySelectorAll('button')).some((button) => button.textContent === '提交答案')).toBe(true);
  });
});
