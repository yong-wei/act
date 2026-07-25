import { describe, expect, it, vi } from 'vitest';

import type { SimulationTaskCatalogEntry } from '../simulation-task-catalog';
import { buildGovernedTaskEvidence } from '../simulation-task-evidence';
import {
  assertSimulationTaskInputIdentity,
  buildSimulationTaskInputIdentity,
  buildSimulationTaskInputIdentityFromFactJournal,
  computeSimulationTaskCatalogDigest,
  deriveHistoricalSimulationTaskPlanDigest,
  findSimulationTaskProjectionCandidateUserIds,
  projectSimulationTaskAttainment,
} from '../simulation-task-portrait-projection';

const catalog: SimulationTaskCatalogEntry[] = [
  {
    taskKey: 'arena:task-a',
    source: 'arena',
    sourceTaskId: 'task-a',
    displayName: 'Arena A',
    published: true,
    completionRule: {
      kind: 'arena-accepted-submission',
      predicateId: 'predicate-a',
    },
    displayGroup: 'Arena 挑战',
  },
  {
    taskKey: 'odyssey:level-a',
    source: 'odyssey',
    sourceTaskId: 'level-a',
    displayName: '奥德赛 A',
    published: true,
    completionRule: { kind: 'odyssey-persistent-clear' },
    displayGroup: '控制奥德赛',
  },
  {
    taskKey: 'virtual-simulation:sim-a',
    source: 'virtual-simulation',
    sourceTaskId: 'sim-a',
    displayName: '虚拟仿真 A',
    published: true,
    completionRule: { kind: 'distinct-valid-runs', requiredCount: 2 },
    displayGroup: '虚拟仿真',
  },
  {
    taskKey: 'control-workbench:retired',
    source: 'control-workbench',
    sourceTaskId: 'retired',
    displayName: '已下线任务',
    published: false,
    completionRule: { kind: 'distinct-valid-runs', requiredCount: 1 },
    displayGroup: '控制工作台',
  },
];

describe('simulation task portrait projection', () => {
  it('uses the global published catalog as an equal-weight denominator', () => {
    const result = projectSimulationTaskAttainment([
      fact(evidence('arena:task-a', 'arena', 'submission', 'arena-artifact')),
      fact(evidence('odyssey:level-a', 'odyssey', 'clear', 'odyssey-artifact')),
      fact(evidence('control-workbench:retired', 'control-workbench', 'run', 'retired-artifact')),
    ], catalog);

    expect(result).toMatchObject({
      state: 'EVIDENCE',
      score: 66.67,
      completedTaskCount: 2,
      relatedTaskCount: 3,
      evidenceAsOf: '2026-07-01T00:00:00.000Z',
      catalogDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(result.groupedTaskSummary.flatMap((group) => group.tasks))
      .not.toEqual(expect.arrayContaining([
        expect.objectContaining({ taskKey: 'control-workbench:retired' }),
      ]));
  });

  it('counts each task once and ignores duplicate or insufficient distinct runs', () => {
    const sameFingerprint = evidence(
      'virtual-simulation:sim-a',
      'virtual-simulation',
      'run',
      'run-a',
      'same',
    );
    const result = projectSimulationTaskAttainment([
      fact(sameFingerprint),
      fact(sameFingerprint),
      fact(evidence(
        'virtual-simulation:sim-a',
        'virtual-simulation',
        'run',
        'run-b',
        'same',
      )),
      fact(evidence('arena:task-a', 'arena', 'evaluation', 'arena-partial')),
      {
        id: 'legacy-param-change',
        contextJson: {
          eventType: 'param_change',
          simulationTaskEvidence: { taskKey: 'odyssey:level-a' },
        },
      },
    ], catalog);

    expect(result).toMatchObject({
      state: 'NO_EVIDENCE',
      score: null,
      completedTaskCount: 0,
      relatedTaskCount: 3,
      evidenceAsOf: null,
    });
    expect(result.limitations).toContain('simulation-task-no-attained-current-task');
  });

  it('selects the source-defined best result before tier and is order independent', () => {
    const lower = evidence('arena:task-a', 'arena', 'evaluation', 'same-artifact');
    const completed = evidence('arena:task-a', 'arena', 'submission', 'same-artifact');
    const forward = projectSimulationTaskAttainment(
      [fact(lower), fact(completed)],
      catalog,
    );
    const reversed = projectSimulationTaskAttainment(
      [fact(completed), fact(lower)],
      catalog,
    );

    expect(forward).toEqual(reversed);
    expect(forward).toMatchObject({
      state: 'EVIDENCE',
      completedTaskCount: 1,
      relatedTaskCount: 3,
      score: 33.33,
    });
  });

  it('does not treat source and tier alone as Arena completion authority', () => {
    const forged = evidence('arena:task-a', 'arena', 'submission', 'odyssey-clear');
    delete forged.completionAuthority;

    const result = projectSimulationTaskAttainment([fact(forged)], catalog);
    expect(result).toMatchObject({
      state: 'NO_EVIDENCE',
      completedTaskCount: 0,
    });
    expect(result.limitations).toContain('simulation-task-completion-authority-missing');
  });

  it('requires two unique semantic results for a two-run task', () => {
    const result = projectSimulationTaskAttainment([
      fact(evidence(
        'virtual-simulation:sim-a',
        'virtual-simulation',
        'run',
        'run-a',
        'fingerprint-a',
      )),
      fact(evidence(
        'virtual-simulation:sim-a',
        'virtual-simulation',
        'run',
        'run-b',
        'fingerprint-b',
      )),
      fact(evidence(
        'virtual-simulation:sim-a',
        'virtual-simulation',
        'evaluation',
        'run-b',
        'fingerprint-b',
      )),
    ], catalog);

    expect(result).toMatchObject({
      state: 'EVIDENCE',
      completedTaskCount: 1,
      relatedTaskCount: 3,
      score: 33.33,
    });
  });

  it('keeps an empty current catalog and a no-completion learner as no evidence', () => {
    expect(projectSimulationTaskAttainment([], [])).toMatchObject({
      state: 'NO_EVIDENCE',
      score: null,
      completedTaskCount: 0,
      relatedTaskCount: 0,
    });
    expect(projectSimulationTaskAttainment([], catalog)).toMatchObject({
      state: 'NO_EVIDENCE',
      score: null,
      completedTaskCount: 0,
      relatedTaskCount: 3,
    });
  });

  it('changes durable input identity on catalog-only or plan drift and fails closed', () => {
    const catalogDigest = computeSimulationTaskCatalogDigest(catalog);
    const first = buildSimulationTaskInputIdentity({
      factWatermark: BigInt(7),
      catalogDigest,
      historicalCandidatePlanDigest: 'plan-a',
    });
    const catalogDrift = buildSimulationTaskInputIdentity({
      factWatermark: BigInt(7),
      catalogDigest: computeSimulationTaskCatalogDigest(catalog.slice(0, 2)),
      historicalCandidatePlanDigest: 'plan-a',
    });
    const planDrift = buildSimulationTaskInputIdentity({
      factWatermark: BigInt(7),
      catalogDigest,
      historicalCandidatePlanDigest: 'plan-b',
    });

    expect(catalogDrift.inputDigest).not.toBe(first.inputDigest);
    expect(planDrift.inputDigest).not.toBe(first.inputDigest);
    expect(() => assertSimulationTaskInputIdentity(
      first.inputDigest,
      catalogDrift.inputDigest,
    )).toThrow('simulation-task-portrait-input-drift');
  });

  it('derives a stable historical plan identity from active fact context', () => {
    const planA = 'a'.repeat(64);
    const planB = 'b'.repeat(64);
    const forward = deriveHistoricalSimulationTaskPlanDigest([
      { contextJson: historicalContext(planB) },
      { contextJson: historicalContext(planA) },
      { contextJson: historicalContext(planA) },
    ]);
    const reversed = deriveHistoricalSimulationTaskPlanDigest([
      { contextJson: historicalContext(planA) },
      { contextJson: historicalContext(planB) },
    ]);

    expect(forward).toBe(reversed);
    expect(forward).toMatch(/^[0-9a-f]{64}$/u);
    expect(() => deriveHistoricalSimulationTaskPlanDigest([
      { contextJson: historicalContext('tampered') },
    ])).toThrow('historical-simulation-task-plan-lineage-invalid');
  });

  it('excludes a revoked historical plan fact from scheduling identity', () => {
    const historicalFact = {
      id: 'fact-historical-revoked',
      contextJson: historicalContext('a'.repeat(64)),
    };
    const active = buildSimulationTaskInputIdentityFromFactJournal({
      facts: [historicalFact],
      transitions: [{
        factId: historicalFact.id,
        sequence: BigInt(1),
        operation: 'UPSERT',
      }],
      catalogDigest: computeSimulationTaskCatalogDigest(),
    });
    const revoked = buildSimulationTaskInputIdentityFromFactJournal({
      facts: [historicalFact],
      transitions: [
        {
          factId: historicalFact.id,
          sequence: BigInt(1),
          operation: 'UPSERT',
        },
        {
          factId: historicalFact.id,
          sequence: BigInt(2),
          operation: 'REVOKE',
        },
      ],
      catalogDigest: computeSimulationTaskCatalogDigest(),
    });

    expect(active.historicalCandidatePlanDigest).not.toBe('none');
    expect(revoked.historicalCandidatePlanDigest).toBe('none');
  });

  it('selects learners with an existing projection or governed task evidence', async () => {
    const partialEvidenceFact = {
      id: 'fact-partial',
      userId: 'student-partial-current',
      contextJson: {
        simulationTaskEvidence: evidence(
          'virtual-simulation:sim-a',
          'virtual-simulation',
          'process',
          'partial-artifact',
        ),
      },
    };
    const partialTransitions = [{
      factId: partialEvidenceFact.id,
      sequence: BigInt(1),
      operation: 'UPSERT' as const,
    }];
    const partialTaskInput = buildSimulationTaskInputIdentityFromFactJournal({
      facts: [partialEvidenceFact],
      transitions: partialTransitions,
    });
    const result = await findSimulationTaskProjectionCandidateUserIds({
      learnerPortraitCurrentState: {
        findMany: vi.fn(async () => [
          {
            userId: 'student-projection',
            stateVersion: {
              snapshot: {
                payload: {
                  dimensions: [{
                    id: 'simulationValidationEvidence',
                    taskAttainment: {
                      calculationVersion: 'simulation-task-attainment-portrait.v1',
                    },
                  }],
                },
              },
            },
          },
          {
            userId: 'student-unrelated',
            stateVersion: { snapshot: { payload: { dimensions: [] } } },
          },
          {
            userId: 'student-current',
            stateVersion: {
              snapshot: {
                payload: {
                  dimensions: [{
                    id: 'simulationValidationEvidence',
                    taskAttainment: {
                      calculationVersion: 'simulation-task-attainment-portrait.v1',
                      catalogDigest: computeSimulationTaskCatalogDigest(),
                    },
                  }],
                },
              },
            },
          },
          {
            userId: 'student-partial-current',
            stateVersion: {
              stateKind: 'NO_EVIDENCE' as const,
              taskInputDigest: partialTaskInput.inputDigest,
              snapshot: null,
            },
          },
        ]),
      },
      learningFact: {
        findMany: vi.fn(async (args) => args.where?.userId === 'student-partial-current'
          ? [partialEvidenceFact]
          : [
              { userId: 'student-evidence' },
              { userId: 'student-projection' },
              { userId: 'student-current' },
              { userId: 'student-partial-current' },
            ]),
      },
      learnerFactTransition: {
        findMany: vi.fn(async ({ where }) =>
          where.userId === 'student-partial-current' ? partialTransitions : []),
      },
    });

    expect(result).toEqual(['student-evidence', 'student-projection']);
  });
});

function fact(simulationTaskEvidence: ReturnType<typeof evidence>) {
  return {
    id: simulationTaskEvidence.artifactKey,
    contextJson: { simulationTaskEvidence },
  };
}

function historicalContext(planDigest: string) {
  return {
    simulationTaskHistoricalCandidate: {
      schemaVersion: 'simulation-task-historical-candidate.v1',
      planDigest,
    },
  };
}

function evidence(
  taskKey: string,
  source: 'odyssey' | 'arena' | 'virtual-simulation' | 'control-workbench',
  tier: 'process' | 'run' | 'evaluation' | 'submission' | 'clear',
  normalizedSourceArtifactId: string,
  fingerprint = normalizedSourceArtifactId,
) {
  return buildGovernedTaskEvidence({
    studentUserId: 'student-1',
    taskKey,
    source,
    tier,
    occurredAt: '2026-07-01T00:00:00.000Z',
    normalizedSourceArtifactId,
    semanticFingerprint: { keyInputHash: fingerprint },
    summary: {
      sourceRef: normalizedSourceArtifactId,
      qualityBand: tier === 'clear' || tier === 'submission' ? 'full' : 'partial',
    },
    completionAuthority: source === 'arena'
      ? 'arena-accepted-submission'
      : source === 'odyssey'
        ? 'odyssey-persistent-clear'
        : 'validated-distinct-runs',
  });
}
