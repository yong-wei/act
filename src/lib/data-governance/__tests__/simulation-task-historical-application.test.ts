import { describe, expect, it, vi } from 'vitest';

import {
  applyHistoricalSimulationTaskPlan,
  buildHistoricalSimulationTaskPlan,
  type HistoricalSimulationTaskPlan,
} from '../simulation-task-historical-application';
import type {
  HistoricalCandidate,
  HistoricalDryRunResult,
} from '../simulation-task-historical-dryrun';
import { scheduleSimulationTaskCatalogRefresh } from '../simulation-task-reconciliation';

const fence = {
  calculationVersion: 'portrait-v2.cumulative.v2',
  learnerGeneration: BigInt(3),
  classGeneration: BigInt(5),
  queueGeneration: BigInt(7),
  fence: BigInt(11),
  activeMigrationRunId: 'migration-989',
};

describe('historical simulation task plan and apply', () => {
  it('produces the same canonical plan digest regardless of candidate order', () => {
    const candidates = [candidate('student-b', 'artifact-b'), candidate('student-a', 'artifact-a')];
    const first = buildHistoricalSimulationTaskPlan(dryRun(candidates));
    const second = buildHistoricalSimulationTaskPlan(dryRun([...candidates].reverse()));

    expect(first.candidateDigest).toBe(second.candidateDigest);
    expect(first.planDigest).toBe(second.planDigest);
    expect(first.candidates.map((item) => item.userId)).toEqual(['student-a', 'student-b']);
  });

  it.each([
    {
      name: 'candidate tamper',
      mutate: (plan: HistoricalSimulationTaskPlan) => {
        plan.candidates[0].userId = 'student-tampered';
      },
      error: 'historical-simulation-task-candidate-tamper',
    },
    {
      name: 'catalog drift',
      mutate: (plan: HistoricalSimulationTaskPlan) => {
        plan.catalogDigest = '0'.repeat(64);
      },
      error: 'historical-simulation-task-catalog-drift',
    },
  ])('fails closed before writes on $name', async ({ mutate, error }) => {
    const plan = structuredClone(buildHistoricalSimulationTaskPlan(
      dryRun([candidate('student-1', 'artifact-1')]),
    ));
    const expectedPlanDigest = plan.planDigest;
    mutate(plan);
    const fixture = applyDb();

    await expect(applyHistoricalSimulationTaskPlan(fixture.db, {
      plan,
      expectedPlanDigest,
    })).rejects.toThrow(error);
    expect(fixture.transaction).not.toHaveBeenCalled();
    expect(fixture.factCount()).toBe(0);
  });

  it('writes idempotent facts and requests one generation per learner', async () => {
    const plan = buildHistoricalSimulationTaskPlan(dryRun([
      candidate('student-1', 'artifact-1'),
      candidate('student-1', 'artifact-2'),
    ]));
    const fixture = applyDb();

    const first = await applyHistoricalSimulationTaskPlan(fixture.db, {
      plan,
      expectedPlanDigest: plan.planDigest,
    });
    const second = await applyHistoricalSimulationTaskPlan(fixture.db, {
      plan,
      expectedPlanDigest: plan.planDigest,
    });

    expect(first).toMatchObject({ created: 2, affectedLearners: 1 });
    expect(second).toMatchObject({ created: 0, affectedLearners: 1 });
    expect(first.targetGenerations).toEqual([{ userId: 'student-1', generation: 1 }]);
    expect(second.targetGenerations).toEqual([{ userId: 'student-1', generation: 2 }]);
    expect(fixture.transaction).toHaveBeenCalledTimes(2);
    expect(fixture.factCount()).toBe(2);
    expect(fixture.factContexts()).toEqual([
      expect.objectContaining({
        simulationTaskHistoricalCandidate: {
          schemaVersion: 'simulation-task-historical-candidate.v1',
          planDigest: plan.planDigest,
        },
      }),
      expect.objectContaining({
        simulationTaskHistoricalCandidate: {
          schemaVersion: 'simulation-task-historical-candidate.v1',
          planDigest: plan.planDigest,
        },
      }),
    ]);
    expect(fixture.requestFor('student-1')?.simulationTaskInput)
      .toMatchObject({
        historicalCandidatePlanDigest: expect.stringMatching(/^[0-9a-f]{64}$/u),
      });
    expect(fixture.requestFor('student-1')?.simulationTaskInput
      .historicalCandidatePlanDigest).not.toBe('none');
  });

  it('does not create or request more than once for a repeated candidate', async () => {
    const repeated = candidate('student-1', 'artifact-1');
    const plan = buildHistoricalSimulationTaskPlan(dryRun([repeated, repeated]));
    const fixture = applyDb();

    await expect(applyHistoricalSimulationTaskPlan(fixture.db, {
      plan,
      expectedPlanDigest: plan.planDigest,
    })).resolves.toMatchObject({
      candidateCount: 2,
      affectedLearners: 1,
      created: 1,
      targetGenerations: [{ userId: 'student-1', generation: 1 }],
    });
    expect(fixture.transaction).toHaveBeenCalledTimes(1);
  });

  it('rolls back learner facts when the durable request fails', async () => {
    const plan = buildHistoricalSimulationTaskPlan(
      dryRun([candidate('student-1', 'artifact-1')]),
    );
    const fixture = applyDb({ failRequest: true });

    await expect(applyHistoricalSimulationTaskPlan(fixture.db, {
      plan,
      expectedPlanDigest: plan.planDigest,
    })).rejects.toThrow('request-failed');
    expect(fixture.factCount()).toBe(0);
  });
});

describe('simulation task catalog refresh scheduling', () => {
  it('schedules only projection/evidence learners without creating facts', async () => {
    const fixture = applyDb();
    fixture.currentRows.push({
      userId: 'student-projection',
      stateVersion: {
        snapshot: {
          payload: {
            dimensions: [{
              id: 'simulationValidationEvidence',
              taskAttainment: { calculationVersion: 'simulation-task-attainment-portrait.v1' },
            }],
          },
        },
      },
    });
    fixture.evidenceUserIds.push('student-evidence');

    const result = await scheduleSimulationTaskCatalogRefresh(fixture.db as never);

    expect(result.candidateLearners).toBe(2);
    expect(result.scheduledLearners).toBe(2);
    expect(result.targetGenerations).toEqual([
      { userId: 'student-evidence', generation: 1 },
      { userId: 'student-projection', generation: 1 },
    ]);
    expect(fixture.createMany).not.toHaveBeenCalled();
    expect(fixture.factCount()).toBe(0);
  });

  it('does not advance generation for a current no-evidence partial-task tombstone', async () => {
    const plan = buildHistoricalSimulationTaskPlan(
      dryRun([candidate('student-partial', 'artifact-partial')]),
    );
    const fixture = applyDb();
    await applyHistoricalSimulationTaskPlan(fixture.db, {
      plan,
      expectedPlanDigest: plan.planDigest,
    });
    const request = fixture.requestFor('student-partial')!;
    fixture.currentRows.push({
      userId: 'student-partial',
      stateVersion: {
        stateKind: 'NO_EVIDENCE',
        taskInputDigest: request.simulationTaskInput.inputDigest,
        snapshot: null,
      },
    });
    fixture.evidenceUserIds.push('student-partial');

    await expect(scheduleSimulationTaskCatalogRefresh(fixture.db as never))
      .resolves.toMatchObject({
        candidateLearners: 0,
        scheduledLearners: 0,
        targetGenerations: [],
      });
    expect(fixture.requestFor('student-partial')?.generation).toBe(1);
  });
});

function candidate(userId: string, artifactKey: string): HistoricalCandidate {
  return {
    recordId: `SimulationRun:${artifactKey}`,
    taskKey: 'virtual-simulation:generic',
    source: 'virtual-simulation',
    artifactKey,
    tier: 'run',
    semanticFingerprint: `${artifactKey}|||`,
    occurredAt: '2026-07-25T00:00:00.000Z',
    userId,
  };
}

function dryRun(candidates: HistoricalCandidate[]): HistoricalDryRunResult {
  return {
    generatedAt: '2026-07-25T01:00:00.000Z',
    catalogVersion: 'simulation-task-catalog.v1',
    totalRecords: candidates.length,
    candidates,
    skips: [],
    affectedStudents: new Set(candidates.map((item) => item.userId)).size,
    candidateCountByTask: { 'virtual-simulation:generic': candidates.length },
    skipCountByReason: {},
  };
}

function applyDb(options: { failRequest?: boolean } = {}) {
  let facts: Array<{
    id: string;
    userId: string;
    sourceEventId: string;
    contextJson: unknown;
  }> = [];
  const requests = new Map<string, Record<string, any>>();
  const generations = new Map<string, number>();
  const currentRows: any[] = [];
  const evidenceUserIds: string[] = [];
  const createMany = vi.fn(async ({ data }: any) => {
    let count = 0;
    for (const item of data) {
      if (facts.some((fact) => fact.sourceEventId === item.sourceEventId)) continue;
      facts.push({
        id: `fact-${facts.length + 1}`,
        userId: item.userId,
        sourceEventId: item.sourceEventId,
        contextJson: item.contextJson,
      });
      count += 1;
    }
    return { count };
  });
  const tx: any = {
    $executeRaw: vi.fn(async () => undefined),
    cumulativePortraitCutoverFence: {
      findUnique: vi.fn(async () => fence),
    },
    learnerPortraitCurrentState: {
      findMany: vi.fn(async () => currentRows),
    },
    learningFact: {
      createMany,
      findMany: vi.fn(async (args: any) => {
        if (args.distinct) return evidenceUserIds.map((userId) => ({ userId }));
        const userId = args.where?.userId;
        return facts
          .filter((fact) => !userId || fact.userId === userId)
          .map((fact) => ({
            id: fact.id,
            userId: fact.userId,
            contextJson: fact.contextJson,
          }));
      }),
    },
    learnerFactTransition: {
      findMany: vi.fn(async () => []),
    },
    learningMaterializationGeneration: {
      upsert: vi.fn(async ({ where }: any) => {
        const generation = (generations.get(where.userId) ?? 0) + 1;
        generations.set(where.userId, generation);
        return { generation };
      }),
    },
    learningMaterializationRebuildRequest: {
      findUnique: vi.fn(async ({ where }: any) => requests.get(where.userId) ?? null),
      create: vi.fn(async ({ data }: any) => {
        if (options.failRequest) throw new Error('request-failed');
        requests.set(data.userId, data);
        return data;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        if (options.failRequest) throw new Error('request-failed');
        const current = requests.get(where.userId);
        if (!current || current.generation !== where.generation) return { count: 0 };
        requests.set(where.userId, { ...current, ...data });
        return { count: 1 };
      }),
    },
  };
  const transaction = vi.fn(async (operation: (client: any) => Promise<unknown>) => {
    const beforeFacts = structuredClone(facts);
    const beforeRequests = structuredClone([...requests]);
    const beforeGenerations = structuredClone([...generations]);
    try {
      return await operation(tx);
    } catch (error) {
      facts = beforeFacts;
      requests.clear();
      for (const [key, value] of beforeRequests) requests.set(key, value);
      generations.clear();
      for (const [key, value] of beforeGenerations) generations.set(key, value);
      throw error;
    }
  });
  return {
    db: { ...tx, $transaction: transaction },
    transaction,
    createMany,
    currentRows,
    evidenceUserIds,
    factCount: () => facts.length,
    factContexts: () => facts.map((fact) => fact.contextJson),
    requestFor: (userId: string) => requests.get(userId),
  };
}
