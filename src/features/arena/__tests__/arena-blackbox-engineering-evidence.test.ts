import { describe, expect, it } from 'vitest';

import { runArenaBlackBoxExperiment } from '../blackbox/experiment';
import {
  buildBlackBoxExperimentBudgetCoverageEvidence,
  buildBlackBoxNominalModelConfidenceEvidence,
} from '../blackbox/engineering-evidence';
import type { ArenaVirtualSimulationPreviewRun } from '../blackbox/controller-preview';

describe('arena black-box engineering evidence', () => {
  it('summarizes experiment budget usage and coverage from dataset records', () => {
    const dataset = runArenaBlackBoxExperiment({
      taskId: 'task-cruise-roll-blackbox-identification',
      input: {
        signalType: 'prbs',
        amplitude: 1.2,
        duration: 16,
        sampleTime: 0.2,
        initialRoll: 0.05,
        disturbanceLevel: 0.2,
      },
      now: '2026-05-22T08:00:00.000Z',
    });

    const evidence = buildBlackBoxExperimentBudgetCoverageEvidence(dataset, {
      limit: 20,
      used: 8,
      remaining: 12,
    });

    expect(evidence.budgetUsed).toBe(8);
    expect(evidence.latestCost).toBe(dataset.budgetCost);
    expect(evidence.sampleCount).toBe(dataset.samples.length);
    expect(evidence.coverageScore).toBeGreaterThan(0.6);
    expect(evidence.summary).toContain('预算 8/20');
    expect(evidence.summary).toContain('覆盖');
  });

  it('keeps nominal-model confidence and preview mismatch evidence aggregate', () => {
    const dataset = runArenaBlackBoxExperiment({
      taskId: 'task-cruise-roll-blackbox-identification',
      input: {
        signalType: 'sine',
        amplitude: 0.9,
        duration: 12,
        sampleTime: 0.2,
        initialRoll: 0,
        disturbanceLevel: 0.35,
      },
      now: '2026-05-22T08:10:00.000Z',
    });
    const preview: ArenaVirtualSimulationPreviewRun = {
      taskId: dataset.taskId,
      datasetHash: dataset.datasetHash,
      controllerHash: 'artifact-preview',
      scenarioId: 'cruise-roll-controller-preview',
      trace: [],
      summary: {
        trackingError: 0.18,
        maxDeviation: 0.42,
        controlEnergy: 5.8,
        safetyViolations: 0,
        smoothness: 0.74,
      },
      createdAt: '2026-05-22T08:12:00.000Z',
    };

    const evidence = buildBlackBoxNominalModelConfidenceEvidence({
      dataset,
      preview,
      budget: { limit: 20, used: 10, remaining: 10 },
    });

    expect(evidence.confidenceScore).toBeGreaterThan(0);
    expect(evidence.previewMismatchLevel).not.toBe('none');
    expect(evidence.boundaryNote).toContain('不代表官方隐藏对象');
    expect(evidence.summary).toContain('名义模型');
    expect(JSON.stringify(evidence)).not.toContain('official-hidden');
    expect(JSON.stringify(evidence)).not.toContain('hiddenTrace');
  });
});
