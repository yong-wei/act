import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildControlWorkbenchComparisonRequests,
  buildControlWorkbenchValidationSnapshot,
  controlRequestGain,
  isControlWorkbenchSubmissionReady,
} from '@/features/interactive/shared/manifest-runtime/control-workbench-comparison';
import { tryBeginControlWorkbenchSubmission } from '@/features/interactive/shared/manifest-runtime/content-renderers';
import {
  mergeManifestTablePrefill,
  resolveManifestTablePrefill,
} from '@/features/interactive/shared/manifest-runtime/response-prefill';
import type { ControlAnalysisRequest, ControlAnalysisResult } from '@/resources/control-system/analysis/types';
import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';

const baseRequest: ControlAnalysisRequest = {
  runtimeMode: 'analysis',
  caseId: 'comparison-test',
  plant: {
    numerator: [1],
    denominator: [1, 7, 6, 0],
    coefficientOrder: 'descending',
  },
  structures: [
    { kind: 'gain', enabled: true, params: { k: 12 }, label: 'K' },
  ],
  outputs: ['step_response', 'root_locus', 'bode'],
  responseType: 'step',
  timeRange: { start: 0, end: 20, samples: 120 },
  frequencyRange: { min: 0.03, max: 20, samples: 120 },
  rootLocus: { minGain: 0, maxGain: 46, samples: 120, currentGain: 12 },
};

describe('control workbench submission lock', () => {
  it('rejects a second submit in the same render before React state catches up', () => {
    const lock = { current: false };
    expect(tryBeginControlWorkbenchSubmission(lock)).toBe(true);
    expect(tryBeginControlWorkbenchSubmission(lock)).toBe(false);
    lock.current = false;
    expect(tryBeginControlWorkbenchSubmission(lock)).toBe(true);
  });
});

function response(stepId: string, k: number, extra: Record<string, unknown> = {}) {
  return {
    stepId,
    submittedAt: 100,
    answers: {
      evidence: JSON.stringify({
        schemaVersion: 'control-workbench-evidence-v1',
        payload: {
          parameterSnapshot: { k },
          answerPayload: {
            validationSnapshot: {
              validationStatus: 'validated',
              dominantPoles: '-1+j2',
              overshootPercent: 12,
              riseTime10To90Seconds: 0.8,
              settlingTime5PercentSeconds: 4.2,
              gainCrossoverRadPerSec: 1.3,
              phaseMarginDeg: 35,
              gainMarginDb: 8,
              derivedSystemState: '稳定',
            },
            ...extra,
          },
        },
      }),
    },
  };
}

describe('shared control workbench comparison and response prefill', () => {
  it('applies fixed and dynamic K to the sole enabled gain and root-locus cursor', () => {
    const comparisons = buildControlWorkbenchComparisonRequests({
      baseRequest,
      payload: {
        comparisonMode: 'fixed_baseline_plus_dynamic',
        comparisonRequests: [
          { id: 'k3', label: 'K=3', role: 'baseline', fixedKOverride: { field: 'k', value: 3 } },
          { id: 'dynamic', label: '当前', role: 'current', request: { gainField: 'k' } },
        ],
      },
      values: { k: 36 },
    });

    expect(comparisons.map((item) => controlRequestGain(item.request))).toEqual([3, 36]);
    expect(comparisons.map((item) => item.request.rootLocus.currentGain)).toEqual([3, 36]);
    expect(baseRequest.structures[0].params.k).toBe(12);
  });

  it('keeps a request unchanged when more than one gain structure is enabled', () => {
    const ambiguous = {
      ...baseRequest,
      structures: [
        ...baseRequest.structures,
        { kind: 'gain' as const, enabled: true, params: { k: 2 }, label: 'second' },
      ],
    };
    const [comparison] = buildControlWorkbenchComparisonRequests({
      baseRequest: ambiguous,
      payload: {
        comparisonMode: 'fixed',
        comparisonRequests: [{ id: 'k3', fixedKOverride: { field: 'k', value: 3 } }],
      },
      values: {},
    });

    expect(comparison.request.structures.map((structure) => structure.params.k)).toEqual([12, 2]);
    expect(comparison.request.rootLocus.currentGain).toBe(12);
  });

  it('serializes only the dominant conjugate pole pair', () => {
    const result = {
      isFallback: false,
      rootLocus: {
        currentPoles: [
          { re: -8, im: 0 },
          { re: -0.25, im: -2 },
          { re: -0.25, im: 2 },
        ],
      },
      metrics: {
        overshootPct: 12,
        riseTimeSec: 0.8,
        settlingTimeSec: 4.2,
        gainCrossoverRadPerSec: 1.3,
        phaseMarginDeg: 35,
        gainMarginDb: 8,
      },
    } as ControlAnalysisResult;

    expect(buildControlWorkbenchValidationSnapshot(result)).toMatchObject({
      validationStatus: 'validated',
      validationScope: 'engine_result_only',
    });
    expect(buildControlWorkbenchValidationSnapshot(result).dominantPoles)
      .toBe('-0.250+j2.000，-0.250-j2.000');
  });

  it('rejects stale main results and partial comparison sets after a request switch', () => {
    const result = { isFallback: false } as ControlAnalysisResult;
    const snapshot = { comparisonRequestId: 'baseline' } as never;
    const base = {
      currentRequestKey: 'request-b',
      comparisonRequestKey: 'comparisons-b',
      comparisonCount: 2,
      submitPending: false,
    };
    expect(isControlWorkbenchSubmissionReady({
      ...base,
      currentResultEntry: { requestKey: 'request-a', result },
      comparisonState: { requestKey: 'comparisons-b', snapshots: [snapshot, snapshot], ready: true },
    })).toBe(false);
    expect(isControlWorkbenchSubmissionReady({
      ...base,
      currentResultEntry: { requestKey: 'request-b', result },
      comparisonState: { requestKey: 'comparisons-b', snapshots: [snapshot], ready: false },
    })).toBe(false);
    expect(isControlWorkbenchSubmissionReady({
      ...base,
      currentResultEntry: { requestKey: 'request-b', result },
      comparisonState: { requestKey: 'comparisons-b', snapshots: [snapshot, snapshot], ready: true },
    })).toBe(true);
    expect(isControlWorkbenchSubmissionReady({
      ...base,
      submitPending: true,
      currentResultEntry: { requestKey: 'request-b', result },
      comparisonState: { requestKey: 'comparisons-b', snapshots: [snapshot, snapshot], ready: true },
    })).toBe(false);
  });

  it('selects the latest matching validated attempt from immutable step history', () => {
    const manifest = normalizeInteractiveRuntimeManifest(JSON.parse(readFileSync(
      join(process.cwd(), 'course-content/runtime/lessons/1-5/interactive-manifest.json'),
      'utf8',
    )))!;
    const step9 = manifest.steps.find((step) => step.id === 'step-09')!;
    const k3 = response('step-05', 3);
    const k4 = { ...response('step-05', 4), submittedAt: 200 };
    const rows = resolveManifestTablePrefill({
      stepManifest: step9,
      responseHistory: { 'step-05': [k3, k4] },
    });
    expect(rows.k3.k).toBe('3');
  });

  it('prefills only exact validated selectors and preserves student edits', () => {
    const manifest = normalizeInteractiveRuntimeManifest(JSON.parse(readFileSync(
      join(process.cwd(), 'course-content/runtime/lessons/1-5/interactive-manifest.json'),
      'utf8',
    )))!;
    const step9 = manifest.steps.find((step) => step.id === 'step-09')!;
    const comparisonSnapshots = [{
      comparisonRequestId: 'k24-baseline',
      parameterSnapshot: { k: 24 },
      validationSnapshot: {
        validationStatus: 'validated',
        dominantPoles: '-0.1+j2',
        overshootPercent: 45,
        riseTime10To90Seconds: 0.4,
        settlingTime5PercentSeconds: 20,
        gainCrossoverRadPerSec: 2.1,
        phaseMarginDeg: 12,
        gainMarginDb: 4,
        derivedSystemState: '稳定',
      },
    }];
    const rows = resolveManifestTablePrefill({
      stepManifest: step9,
      responseHistory: {
        'step-05': response('step-05', 3),
        'step-06': response('step-06', 13),
        'step-07': response('step-07', 36, { comparisonSnapshots }),
        'step-08': response('step-08', 42),
      },
    });

    expect(rows.k3.k).toBe('3');
    expect(rows.k12).toBeUndefined();
    expect(rows.k24.k).toBe('24');
    expect(rows.k36.k).toBe('36');
    expect(rows.k42.k).toBe('42');

    const merged = JSON.parse(mergeManifestTablePrefill(
      JSON.stringify({ rows: { k3: { phase_margin_deg: '学生修订值' } } }),
      rows,
    ));
    expect(merged.rows.k3.phase_margin_deg).toBe('学生修订值');
    expect(merged.rows.k3.dominant_poles).toBe('-1+j2');
  });
});
