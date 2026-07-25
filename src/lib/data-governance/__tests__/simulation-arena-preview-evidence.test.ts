import { describe, expect, it } from 'vitest';

import { buildSimulationAgentEvidenceMaterialization } from '../simulation-agent-evidence-materialization';

const completedAt = new Date('2026-07-25T04:00:00.000Z');

function completedRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run-1',
    ownerUserId: 'student-1',
    runKind: 'guided_simulation',
    sourceDomain: 'simulation',
    taskSpecId: 'task-spec-1',
    status: 'completed',
    summary: {
      trackingError: 0.1,
      maxDeviation: 0.5,
      controlEnergy: 0.2,
      safetyViolations: 0,
      smoothness: 0.8,
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
      simulationRuns: [
        {
          run: completedRun({
            runKind: 'arena_preview',
            sourceDomain: 'arena_virtual_preview',
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
          trace,
        },
      ],
      now: completedAt,
    });
    const standardResult = buildSimulationAgentEvidenceMaterialization({
      simulationRuns: [{ run: completedRun(), trace }],
      now: completedAt,
    });

    const previewFact = previewResult.learningFacts[0] as Record<string, any>;
    const standardFact = standardResult.learningFacts[0] as Record<string, any>;

    expect(previewFact).toMatchObject({
      moduleId: 'task-cruise-roll-blackbox-identification',
      contextJson: {
        simulation: {
          preview: true,
          officialEligible: false,
          taskId: 'task-cruise-roll-blackbox-identification',
          arenaTraining: {
            scenarioId: 'cruise-roll-controller-preview',
            evaluationVisibility: 'preview',
          },
        },
      },
    });
    expect(Math.abs(previewFact.competencyContribution.parameterDesign)).toBeLessThan(
      Math.abs(standardFact.competencyContribution.parameterDesign),
    );
    expect(JSON.stringify(previewFact.contextJson)).not.toContain('samples');
  });
});
