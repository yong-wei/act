import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ControlAnalysisResult } from '@/resources/control-system/analysis/types';
import {
  DEFAULT_CORRECTION_STATE,
  correctionToStructures,
  correctionToRootHandles,
  doesRootLocusMatchPoleZeroSet,
} from '@/features/interactive/multi-representation-linkage/model';
import {
  adaptLinkageAnalysisResult,
  buildLinkageAnalysisRequest,
  buildCorrectionStructure,
  buildFrequencyTurnCorrection,
  buildPidCorrection,
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
      currentGain: 2,
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

  it('keeps closed-loop pole drag committed only from the corrected root locus', () => {
    const pageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/multi-representation-linkage/page-client.tsx'),
      'utf8',
    );

    expect(pageSource).toContain("onClosedLoopGainCommit={selectedRootLocusSource?.id === 'corrected-root-locus' ? model.setGain : undefined}");
    expect(pageSource).not.toContain('onClosedLoopGainCommit={model.setClosedLoopGain}');
  });

  it('builds baseline, corrected, and correction-device requests without restoring the legacy linkage api', () => {
    const correction = buildPidCorrection({
      enabled: true,
      kp: 1.8,
      ki: 0.6,
      kd: 0.24,
      derivativeFilterEnabled: true,
      tf: 0.04,
    });
    const baseline = buildLinkageAnalysisRequest({
      poles: [{ re: -1, im: 0 }],
      zeros: [],
      gain: 2,
      responseType: 'step',
    });
    const corrected = buildLinkageAnalysisRequest({
      poles: [{ re: -1, im: 0 }],
      zeros: [],
      gain: 2,
      correctionStructures: [correction],
      responseType: 'step',
    });
    const device = buildLinkageAnalysisRequest({
      poles: [],
      zeros: [],
      gain: 1,
      correctionStructures: [correction],
      outputs: ['magnitude', 'phase', 'bode'],
      includeOpenLoopGain: false,
      plantLabel: '校正装置 C(s)',
      responseType: 'step',
    });
    const workerSource = readFileSync(
      join(repoRoot, 'src/resources/control-system/analysis/control-analysis.worker.ts'),
      'utf8',
    );

    expect(baseline.structures).toEqual([
      { kind: 'gain', enabled: true, params: { k: 2 }, label: 'K' },
    ]);
    expect(corrected.structures).toEqual([
      { kind: 'gain', enabled: true, params: { k: 2 }, label: 'K' },
      correction,
    ]);
    expect(device.plant).toMatchObject({ numerator: [1], denominator: [1], label: '校正装置 C(s)' });
    expect(device.structures).toEqual([correction]);
    expect(workerSource).not.toContain('/api/linkage');
  });

  it('converts PID direct gains and time constants bidirectionally', () => {
    const fromDirectGains = buildPidCorrection({
      enabled: true,
      kp: 2,
      ki: 0.5,
      kd: 0.6,
      derivativeFilterEnabled: false,
      tf: 0.03,
    });
    const fromTimeConstants = buildPidCorrection({
      enabled: true,
      kp: 2,
      ti: 4,
      td: 0.3,
      derivativeFilterEnabled: true,
      tf: 0.05,
    });

    expect(fromDirectGains.params).toMatchObject({
      kp: 2,
      ki: 0.5,
      kd: 0.6,
      ti: 4,
      td: 0.3,
    });
    expect(fromDirectGains.params).not.toHaveProperty('tf');
    expect(fromTimeConstants.params).toMatchObject({
      kp: 2,
      ki: 0.5,
      kd: 0.6,
      ti: 4,
      td: 0.3,
      tf: 0.05,
    });
  });

  it('derives filtered PD correction root handles from the engine transfer function', () => {
    const handles = correctionToRootHandles({
      ...DEFAULT_CORRECTION_STATE,
      enabled: true,
      kind: 'pd',
      kp: 1,
      ki: 0,
      kd: 0.2,
      derivativeFilterEnabled: true,
      tf: 0.04,
    }, false);
    const zero = handles.find((handle) => handle.kind === 'zero');
    const filterPole = handles.find((handle) => handle.id === 'pid-filter-pole');

    expect(zero?.point.re).toBeCloseTo(-1 / (1 * 0.04 + 0.2), 10);
    expect(zero?.point.re).not.toBeCloseTo(-1 / 0.2, 10);
    expect(filterPole?.point.re).toBeCloseTo(-25, 10);
  });

  it('uses turn frequencies as the editing surface for lead, lag, and lead-lag correction', () => {
    const lead = buildFrequencyTurnCorrection({
      kind: 'lead',
      enabled: true,
      zeroFrequency: 1,
      poleFrequency: 5,
    });
    const lag = buildFrequencyTurnCorrection({
      kind: 'lag',
      enabled: true,
      zeroFrequency: 0.2,
      poleFrequency: 0.05,
    });
    const leadLag = buildFrequencyTurnCorrection({
      kind: 'lead_lag',
      enabled: true,
      leadZeroFrequency: 1,
      leadPoleFrequency: 6,
      lagZeroFrequency: 0.2,
      lagPoleFrequency: 0.05,
    });

    expect(lead.params).toMatchObject({ tau: 1, alpha: 0.2 });
    expect(lag.params).toMatchObject({ tau: 5, beta: 4 });
    expect(leadLag.params.tauLead).toBe(1);
    expect(leadLag.params.alphaLead).toBeCloseTo(1 / 6, 10);
    expect(leadLag.params.tauLag).toBe(5);
    expect(leadLag.params.betaLag).toBe(4);
  });

  it('stores controller gain inside correction structures for PID, lead, and lag modes', () => {
    expect(correctionToStructures({
      ...DEFAULT_CORRECTION_STATE,
      enabled: true,
      kind: 'pid',
      controllerGain: 3,
      kp: 2,
      ki: 0.5,
      kd: 0.1,
    }, false)[0]?.params).toMatchObject({ kp: 6, ki: 1.5, kd: 0.3 });

    expect(correctionToStructures({
      ...DEFAULT_CORRECTION_STATE,
      enabled: true,
      kind: 'lead',
      controllerGain: 2.5,
      leadZeroFrequency: 2,
      leadPoleFrequency: 8,
    }, false)[0]?.params).toMatchObject({ k: 2.5, tau: 0.5, alpha: 0.25 });

    expect(correctionToStructures({
      ...DEFAULT_CORRECTION_STATE,
      enabled: true,
      kind: 'lag',
      controllerGain: 0.4,
      lagZeroFrequency: 0.5,
      lagPoleFrequency: 0.125,
    }, false)[0]?.params).toMatchObject({ k: 0.4, tau: 2, beta: 4 });
  });

  it('can keep controller gain as the explicit root-locus gain for corrected workbench requests', () => {
    const correctionShape = correctionToStructures({
      ...DEFAULT_CORRECTION_STATE,
      enabled: true,
      kind: 'lead',
      controllerGain: 2.5,
      leadZeroFrequency: 2,
      leadPoleFrequency: 8,
    }, false, { includeControllerGain: false });
    const request = buildLinkageAnalysisRequest({
      poles: [{ re: -1, im: 0 }],
      zeros: [],
      gain: 2.5,
      rootLocusGain: 2.5,
      correctionStructures: correctionShape,
      responseType: 'step',
    });

    expect(request.structures).toEqual([
      { kind: 'gain', enabled: true, params: { k: 2.5 }, label: 'K' },
      { kind: 'lead', enabled: true, params: { k: 1, tau: 0.5, alpha: 0.25 }, label: 'C(s)' },
    ]);
    expect(request.rootLocus.currentGain).toBe(2.5);
  });

  it('keeps correction controls out of course embed mode', () => {
    const drawerSource = readFileSync(
      join(repoRoot, 'src/features/interactive/multi-representation-linkage/parameter-drawer.tsx'),
      'utf8',
    );
    const modelSource = readFileSync(
      join(repoRoot, 'src/features/interactive/multi-representation-linkage/model.ts'),
      'utf8',
    );

    expect(drawerSource).toContain('disabled={isCourseMode}');
    expect(drawerSource).toContain('校正');
    expect(modelSource).toContain('correctionEnabled: !isCourseMode');
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

    expect(modelSource).toContain('correctedLinkageRequest');
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
    expect(pageSource).toContain('BodeComparisonPanel');
    expect(pageSource).toContain('TimeDomainComparisonPanel');
    expect(pageSource).toContain('校正后开环');
    expect(pageSource).not.toContain('校正后 G(s)C(s)K');
    expect(pageSource).toContain('onRefreshRange={model.refreshFrequencyRange}');
    expect(pageSource).toContain('onRefreshRange={model.refreshTimeRange}');
    expect(pageSource).toContain("nyquistOptions.has('uncorrected-open-loop')");
    expect(pageSource).toContain("nyquistOptions.has('corrected-open-loop')");
    expect(pageSource).toContain('ClassicSourceSwitch');
    expect(pageSource).toContain('rootLocusSourceOptions');
    expect(pageSource).toContain('nyquistSourceOptions');
    expect(pageSource).toContain("selectedRootLocusSource?.id === 'corrected-root-locus' ? model.correctionRootHandles : []");
    expect(pageSource).toContain('selectedNyquistSource ? <NyquistPanel result={selectedNyquistSource.result} />');
    expect(pageSource).not.toContain('<NyquistPanel result={panel.result} />');
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
    expect(modelSource).toContain('lastValidCorrectedResultRef');
    expect(modelSource).toContain('lastVisibleAnalysisResultRef');
    expect(modelSource).toContain('visibleBaselineAnalysisResult');
    expect(modelSource).toContain('correctionHandlesToPoleZeroSet');
    expect(modelSource).toContain("renderAs: 'correction-zero'");
    expect(modelSource).toContain("renderAs: 'correction-pole'");
    expect(modelSource).toContain('setFrequencyRange');
    expect(modelSource).toContain('setTimeRange');
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

  it('keeps parameter drawer tabs bounded, theme-aware, and semantically unchanged', () => {
    const drawerSource = readFileSync(
      join(repoRoot, 'src/features/interactive/multi-representation-linkage/parameter-drawer.tsx'),
      'utf8',
    );

    expect(drawerSource).toContain('const drawerTabBaseClass =');
    expect(drawerSource).toContain('w-full min-w-0');
    expect(drawerSource).toContain('overflow-hidden');
    expect(drawerSource).toContain('transition-colors');
    expect(drawerSource).toContain('const drawerTabActiveClass =');
    expect(drawerSource).toContain('bg-cyan-100 text-cyan-950');
    expect(drawerSource).toContain('dark:bg-cyan-300/20 dark:text-cyan-50');
    expect(drawerSource).toContain('const drawerTabInactiveClass =');
    expect(drawerSource).toContain('hover:bg-cyan-50 hover:text-cyan-900');
    expect(drawerSource).toContain('dark:hover:bg-cyan-300/10 dark:hover:text-cyan-50');
    expect(drawerSource).toContain('data-testid="parameter-drawer-object-tab"');
    expect(drawerSource).toContain('data-testid="parameter-drawer-correction-tab"');
    expect(drawerSource).toContain("data-state={activeTab === 'plant' ? 'active' : 'inactive'}");
    expect(drawerSource).toContain("data-state={activeTab === 'correction' ? 'active' : 'inactive'}");
    expect(drawerSource).toContain('className="block max-w-full truncate" title="对象"');
    expect(drawerSource).toContain('className="block max-w-full truncate" title="校正"');
    expect(drawerSource).toContain('disabled={isCourseMode || Boolean(isLockedOrCourse)}');
    expect(drawerSource).toContain('disabled={disabled || !state.enabled}');
  });
});
