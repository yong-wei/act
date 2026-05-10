import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ControlAnalysisResult } from '@/resources/control-system/analysis/types';
import { doesRootLocusMatchPoleZeroSet } from '@/features/interactive/multi-representation-linkage/model';
import {
  adaptLinkageAnalysisResult,
  buildLinkageAnalysisRequest,
} from '@/resources/control-system/analysis/multi-representation-linkage-analysis';

const repoRoot = process.cwd();

function makeAnalysisResult(overrides: Partial<ControlAnalysisResult> = {}): ControlAnalysisResult {
  return {
    metrics: {
      overshootPct: 18,
      riseTimeSec: 0.8,
      settlingTimeSec: 2.4,
      peakTimeSec: 1.1,
      finalValue: 0.92,
      phaseMarginDeg: 32,
      gainMarginDb: 8.5,
      gainCrossoverRadPerSec: 2,
      phaseCrossoverRadPerSec: 4,
      bandwidthRadPerSec: 5.2,
    },
    stepResponse: {
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0.7 },
        { x: 2, y: 0.92 },
      ],
    },
    magnitude: {
      points: [
        { x: 1, y: 6 },
        { x: 2, y: 0 },
        { x: 4, y: -8 },
      ],
    },
    phase: {
      points: [
        { x: 1, y: -120 },
        { x: 2, y: -148 },
        { x: 4, y: -180 },
      ],
    },
    nyquist: {
      mode: 'full',
      points: [
        { re: -0.2, im: 0.4 },
        { re: -0.9, im: 0.15 },
        { re: -1.4, im: -0.05 },
        { re: -0.9, im: -0.15 },
        { re: -0.2, im: -0.4 },
      ],
      positivePoints: [
        { re: -0.2, im: 0.4 },
        { re: -0.9, im: 0.15 },
        { re: -1.4, im: -0.05 },
      ],
      negativePoints: [
        { re: -1.4, im: 0.05 },
        { re: -0.9, im: -0.15 },
        { re: -0.2, im: -0.4 },
      ],
      infinityClosure: {
        points: [
          { re: -1.4, im: -0.05 },
          { re: -1.4, im: 0.05 },
        ],
        lineStyle: 'dashed',
      },
      keyPoints: [
        { kind: 'unit_circle_crossing', point: { re: -0.95, im: 0.1 }, frequency: 2.1 },
      ],
      asymptotes: [{ end: 'high_frequency', kind: 'zero', angleDeg: -90 }],
      encirclements: 0,
      criterion: { n: 0, p: 0, z: 0, relation: 'Z = P + N', isConsistent: true },
    },
    rootLocus: {
      branches: [
        [
          { re: -0.8, im: 1.1, gain: 0 },
          { re: -1.2, im: 1.6, gain: 2 },
        ],
        [
          { re: -0.8, im: -1.1, gain: 0 },
          { re: -1.2, im: -1.6, gain: 2 },
        ],
      ],
      currentPoles: [
        { re: -1.2, im: 1.6 },
        { re: -1.2, im: -1.6 },
      ],
      openLoopPoles: [
        { re: -0.5, im: 1.4 },
        { re: -0.5, im: -1.4 },
      ],
      openLoopZeros: [],
    },
    ...overrides,
  };
}

describe('multi representation linkage analysis adapter', () => {
  it('builds a shared control-engine request from editable poles, zeros, gain, and response type', () => {
    const request = buildLinkageAnalysisRequest({
      poles: [
        { re: -1, im: 2 },
        { re: -1, im: -2 },
      ],
      zeros: [{ re: -3, im: 0 }],
      gain: 0,
      responseType: 'ramp',
    });

    expect(request.runtimeMode).toBe('analysis');
    expect(request.responseType).toBe('ramp');
    expect(request.plant.numerator).toEqual([1, 3]);
    expect(request.plant.denominator).toEqual([1, 2, 5]);
    expect(request.structures).toEqual([
      { kind: 'gain', enabled: true, params: { k: 0 }, label: 'K' },
    ]);
    expect(request.nyquist).toEqual({ mode: 'full', samplingMode: 'adaptive' });
    expect(request.rootLocus.currentGain).toBe(0);
  });

  it('can build a time-domain-only request for closed-loop pole selection', () => {
    const request = buildLinkageAnalysisRequest({
      poles: [{ re: -1, im: 0 }],
      zeros: [],
      gain: 4.5,
      rootLocusGain: 4.5,
      outputs: ['step_response'],
      responseType: 'step',
    });

    expect(request.outputs).toEqual(['step_response']);
    expect(request.structures).toEqual([
      { kind: 'gain', enabled: true, params: { k: 4.5 }, label: 'K' },
    ]);
    expect(request.rootLocus.currentGain).toBe(4.5);
  });

  it('builds a unit numerator when no zero is present', () => {
    const request = buildLinkageAnalysisRequest({
      poles: [
        { re: -2.2, im: 0 },
        { re: -0.7, im: 0 },
      ],
      zeros: [],
      gain: 1.25,
      responseType: 'step',
    });

    expect(request.plant.numerator).toEqual([1]);
    expect(request.plant.denominator).toEqual([1, 2.9, 1.54]);
  });

  it('derives legacy page view data from shared analysis results and preserves root-locus gain metadata', () => {
    const adapted = adaptLinkageAnalysisResult(makeAnalysisResult());

    expect(adapted.timeDomain.metrics).toEqual({
      overshoot: 18,
      settlingTime: 2.4,
      riseTime: 0.8,
      steadyStateError: 0.08,
    });
    expect(adapted.frequencyDomain.marginPoints.gainCrossover?.frequency).toBe(2);
    expect(adapted.frequencyDomain.marginPoints.phaseCrossover?.frequency).toBe(4);
    expect(adapted.frequencyDomain.nyquistKeyPoints[0].kind).toBe('unit_circle_crossing');
    expect(adapted.frequencyDomain.nyquistEncirclements).toBe(0);
    expect(adapted.frequencyDomain.nyquistCriterion).toEqual({
      n: 0,
      p: 0,
      z: 0,
      relation: 'Z = P + N',
      isConsistent: true,
    });
    expect(adapted.stability.isStable).toBe(true);
    expect(adapted.stability.rootLocus.branches[0][1].gain).toBe(2);
    expect(adapted.stability.hints.length).toBeGreaterThan(0);
  });

  it('fills stability defaults when margins are absent and closed-loop poles cross into the right half plane', () => {
    const adapted = adaptLinkageAnalysisResult(
      makeAnalysisResult({
        metrics: {
          overshootPct: 0,
          riseTimeSec: null,
          settlingTimeSec: null,
          peakTimeSec: null,
          finalValue: 1.4,
          phaseMarginDeg: null,
          gainMarginDb: null,
          gainCrossoverRadPerSec: null,
          phaseCrossoverRadPerSec: null,
          bandwidthRadPerSec: null,
        },
        rootLocus: {
          branches: [[{ re: 0.25, im: 0, gain: 1.5 }]],
          currentPoles: [{ re: 0.25, im: 0 }],
          openLoopPoles: [{ re: -1.5, im: 0 }],
          openLoopZeros: [],
        },
      }),
    );

    expect(adapted.frequencyDomain.marginPoints).toEqual({});
    expect(adapted.stability.stabilityMargins.gainMargin.isInfinite).toBe(true);
    expect(adapted.stability.stabilityMargins.phaseMargin.frequency).toBe(0);
    expect(adapted.stability.isStable).toBe(false);
    expect(adapted.stability.polesInRHP).toBe(1);
    expect(adapted.stability.dampingRatios[0]).toBeLessThan(0);
    expect(adapted.stability.hints.some((hint) => hint.includes('不稳定'))).toBe(true);
  });

  it('keeps root-locus data from the open-loop analysis when merging closed-loop selection results', () => {
    const modelSource = readFileSync(
      join(repoRoot, 'src/features/interactive/multi-representation-linkage/model.ts'),
      'utf8',
    );

    expect(modelSource).toContain("outputs: ['step_response']");
    expect(modelSource).toContain('openLoopResult.rootLocus.branches');
    expect(modelSource).toContain('pointDistance < bestDistance ? point : best');
    expect(modelSource).not.toContain('currentPoles: selectedResult.rootLocus.currentPoles');
  });

  it('rejects stale root-locus results after the editable pole-zero set changes', () => {
    const oldResult = makeAnalysisResult({
      rootLocus: {
        ...makeAnalysisResult().rootLocus,
        openLoopPoles: [
          { re: -0.5, im: 1.4 },
          { re: -0.5, im: -1.4 },
        ],
        openLoopZeros: [],
        imaginaryAxisCrossings: [{ re: 0, im: 1.2, gain: 4 }],
      },
    });

    expect(doesRootLocusMatchPoleZeroSet(oldResult, oldResult.rootLocus.openLoopPoles, [])).toBe(true);
    expect(doesRootLocusMatchPoleZeroSet(oldResult, [{ re: -2.2, im: 0 }], [])).toBe(false);
  });

  it('keeps Bode and Nyquist panels bound to the open-loop analysis result', () => {
    const pageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/multi-representation-linkage/page-client.tsx'),
      'utf8',
    );

    expect(pageSource).toContain('const frequencyResult = (model.frequencyAnalysisResult ?? result)!;');
    expect(pageSource).toContain('<BodePanel result={frequencyResult} showMargins={model.showMargins} />');
    expect(pageSource).toContain('<NyquistPanel result={frequencyResult} />');
  });

  it('keeps the previous visible chart result while a new analysis request is pending', () => {
    const modelSource = readFileSync(
      join(repoRoot, 'src/features/interactive/multi-representation-linkage/model.ts'),
      'utf8',
    );
    const pageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/multi-representation-linkage/page-client.tsx'),
      'utf8',
    );

    expect(modelSource).toContain('lastValidOpenLoopResultRef');
    expect(modelSource).toContain('lastVisibleAnalysisResultRef');
    expect(modelSource).toContain('visibleOpenLoopAnalysisResult');
    expect(modelSource).toContain('visibleAnalysisResult');
    expect(pageSource).not.toContain('{!result ?');
  });

  it('keeps the parameter drawer as a non-modal floating side panel', () => {
    const pageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/multi-representation-linkage/page-client.tsx'),
      'utf8',
    );
    const drawerSource = readFileSync(
      join(repoRoot, 'src/features/interactive/multi-representation-linkage/parameter-drawer.tsx'),
      'utf8',
    );

    expect(pageSource).toContain('fixed bottom-36 right-6');
    expect(pageSource).not.toContain('参数抽屉</button>');
    expect(drawerSource).toContain('DialogPrimitive.Portal');
    expect(drawerSource).toContain('overscroll-contain');
    expect(drawerSource).toContain('onWheelCapture={(event) => containDrawerWheel(event, event.currentTarget)}');
    expect(drawerSource).toContain("window.addEventListener('wheel', handleWheel, { passive: false, capture: true })");
    expect(drawerSource).not.toContain('DialogContent');
    expect(drawerSource).not.toContain('DialogOverlay');
  });
});
