import { describe, expect, it } from 'vitest';

import { buildSimulationAgentEvidenceMaterialization } from '../simulation-agent-evidence-materialization';

const completedAt = new Date('2026-07-25T04:00:00.000Z');

function completedRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run-preview-1',
    ownerUserId: 'student-1',
    runKind: 'arena_preview',
    sourceDomain: 'arena_virtual_preview',
    taskSpecId: 'task-spec-1',
    status: 'completed',
    summary: {
      arenaTraining: {
        taskId: 'task-cruise-roll-blackbox-identification',
        scenarioId: 'cruise-roll-controller-preview',
        evaluationVisibility: 'preview',
        officialEligible: false,
      },
      trackingError: 0.1,
      maxDeviation: 0.5,
      controlEnergy: 0.2,
      safetyViolations: 0,
      smoothness: 0.8,
      samples: [{ t: 0, y: 0 }],
    },
    protocolVersion: 'simulation-run-v1',
    completedAt,
    ...overrides,
  };
}

const trace = {
  id: 'trace-1',
  protocolVersion: 'trace-v1',
  checksum: 'checksum-1',
  sampleCount: 240,
  sampleCadence: 0.016,
};

describe('Arena preview learning evidence', () => {
  it('keeps task attribution and applies a bounded preview contribution', () => {
    const previewResult = buildSimulationAgentEvidenceMaterialization({
      simulationRuns: [{ run: completedRun(), trace }],
      now: completedAt,
    });
    const standardResult = buildSimulationAgentEvidenceMaterialization({
      simulationRuns: [{
        run: completedRun({
          id: 'run-standard-1',
          runKind: 'guided_simulation',
          sourceDomain: 'simulation',
          summary: {
            trackingError: 0.1,
            maxDeviation: 0.5,
            controlEnergy: 0.2,
            safetyViolations: 0,
            smoothness: 0.8,
          },
        }),
        trace,
      }],
      now: completedAt,
    });

    const previewFact = previewResult.learningFacts[0] as Record<string, any>;
    const standardFact = standardResult.learningFacts[0] as Record<string, any>;

    expect(previewFact).toMatchObject({
      moduleId: 'task-cruise-roll-blackbox-identification',
      contextJson: {
        simulation: {
          taskId: 'task-cruise-roll-blackbox-identification',
          scenarioId: 'cruise-roll-controller-preview',
          evaluationVisibility: 'preview',
          preview: true,
          officialEligible: false,
          arenaTraining: {
            taskId: 'task-cruise-roll-blackbox-identification',
            scenarioId: 'cruise-roll-controller-preview',
            evaluationVisibility: 'preview',
            officialEligible: false,
          },
        },
      },
    });
    expect(Math.abs(previewFact.competencyContribution.parameterDesign)).toBeCloseTo(
      Math.abs(standardFact.competencyContribution.parameterDesign) * 0.33,
      2,
    );
    expect(JSON.stringify(previewFact.contextJson)).not.toContain('samples');
  });

  it('forces preview provenance closed when an input summary contradicts the run boundary', () => {
    const result = buildSimulationAgentEvidenceMaterialization({
      simulationRuns: [{
        run: completedRun({
          summary: {
            arenaTraining: {
              taskId: 'task-cruise-roll-blackbox-identification',
              scenarioId: 'cruise-roll-controller-preview',
              evaluationVisibility: 'official',
              officialEligible: true,
            },
            trackingError: 0.1,
            maxDeviation: 0.5,
            controlEnergy: 0.2,
            safetyViolations: 0,
            smoothness: 0.8,
          },
        }),
        trace,
      }],
      now: completedAt,
    });

    expect(result.drafts[0]).toMatchObject({
      provenance: { preview: true, official: false },
      summary: {
        evaluationVisibility: 'preview',
        officialEligible: false,
        arenaTraining: {
          evaluationVisibility: 'preview',
          officialEligible: false,
        },
      },
    });
    expect(result.learningFacts[0]).toMatchObject({
      contextJson: {
        simulation: {
          evaluationVisibility: 'preview',
          officialEligible: false,
          preview: true,
        },
      },
    });
  });

  it('keeps incomplete preview evidence context-only without competency contribution', () => {
    const result = buildSimulationAgentEvidenceMaterialization({
      simulationRuns: [{
        run: completedRun({
          summary: {
            arenaTraining: {
              taskId: 'task-cruise-roll-blackbox-identification',
              scenarioId: 'cruise-roll-controller-preview',
              evaluationVisibility: 'preview',
              officialEligible: false,
            },
            trackingError: 0.1,
            maxDeviation: 0.5,
            controlEnergy: 0.2,
            safetyViolations: 0,
            smoothness: 0.8,
          },
        }),
        trace: { id: 'trace-missing-checksum', protocolVersion: 'trace-v1' },
      }],
      now: completedAt,
    });

    expect(result.learningFacts[0]).toMatchObject({
      competencyContribution: {
        parameterDesign: 0,
        systemAnalysis: 0,
      },
      contextJson: {
        simulation: {
          taskId: 'task-cruise-roll-blackbox-identification',
          preview: true,
          officialEligible: false,
        },
      },
    });
  });
});
