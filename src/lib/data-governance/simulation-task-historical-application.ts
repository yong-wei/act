import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';

import { requestCumulativeLearnerReconciliation } from './cumulative-snapshot-jobs';
import { getSimulationTaskByKey } from './simulation-task-catalog';
import type {
  HistoricalCandidate,
  HistoricalDryRunResult,
} from './simulation-task-historical-dryrun';
import { persistSimulationTaskEvidence } from './simulation-task-learning-fact';
import {
  computeSimulationTaskCatalogDigest,
} from './simulation-task-portrait-projection';
import { readSimulationTaskInputIdentityForScheduling } from './simulation-task-reconciliation';
import type { GovernedTaskEvidenceContext } from './simulation-task-evidence';

export const HISTORICAL_SIMULATION_TASK_PLAN_VERSION =
  'historical-simulation-task-evidence-plan.v1';

export interface HistoricalSimulationTaskPlanCandidate extends HistoricalCandidate {
  sourceRef: string;
  decision: 'accepted';
}

export interface HistoricalSimulationTaskPlan {
  schemaVersion: typeof HISTORICAL_SIMULATION_TASK_PLAN_VERSION;
  generatedAt: string;
  catalogVersion: string;
  catalogDigest: string;
  candidateDigest: string;
  candidates: HistoricalSimulationTaskPlanCandidate[];
  planDigest: string;
}

interface HistoricalSimulationTaskApplyDb {
  $transaction<T>(
    operation: (tx: HistoricalSimulationTaskApplyTransaction) => Promise<T>,
    options?: { timeout?: number },
  ): Promise<T>;
}

interface HistoricalSimulationTaskApplyTransaction {
  $executeRaw?(query: Prisma.Sql): Promise<unknown>;
  learningFact: {
    createMany(args: Record<string, unknown>): Promise<{ count: number }>;
    findMany(args: Record<string, unknown>): Promise<Array<{ id: string; userId: string }>>;
  };
  learnerFactTransition: {
    findMany(args: Record<string, unknown>): Promise<Array<{ factId: string; sequence: bigint }>>;
  };
}

export function buildHistoricalSimulationTaskPlan(
  dryRun: HistoricalDryRunResult,
): HistoricalSimulationTaskPlan {
  const candidates = canonicalCandidates(dryRun.candidates.map((candidate) => ({
    ...candidate,
    sourceRef: candidate.recordId,
    decision: 'accepted' as const,
  })));
  const catalogDigest = computeSimulationTaskCatalogDigest();
  const candidateDigest = digestJson(candidates);
  const unsigned: Omit<HistoricalSimulationTaskPlan, 'planDigest'> = {
    schemaVersion: HISTORICAL_SIMULATION_TASK_PLAN_VERSION,
    generatedAt: dryRun.generatedAt,
    catalogVersion: dryRun.catalogVersion,
    catalogDigest,
    candidateDigest,
    candidates,
  };
  return {
    ...unsigned,
    planDigest: digestJson(unsigned),
  };
}

export function validateHistoricalSimulationTaskPlan(
  plan: HistoricalSimulationTaskPlan,
  expectedPlanDigest: string,
): HistoricalSimulationTaskPlan {
  if (plan.schemaVersion !== HISTORICAL_SIMULATION_TASK_PLAN_VERSION) {
    throw new Error('historical-simulation-task-plan-version-invalid');
  }
  if (
    !Array.isArray(plan.candidates) ||
    plan.candidates.some((candidate) =>
      candidate.decision !== 'accepted' ||
      !candidate.userId?.trim() ||
      !candidate.sourceRef?.trim() ||
      !candidate.recordId?.trim() ||
      !candidate.artifactKey?.trim() ||
      !candidate.taskKey?.trim() ||
      !isCandidateAuthorityConsistent(candidate))
  ) {
    throw new Error('historical-simulation-task-plan-candidate-invalid');
  }
  const candidates = canonicalCandidates(plan.candidates);
  const candidateDigest = digestJson(candidates);
  if (candidateDigest !== plan.candidateDigest) {
    throw new Error('historical-simulation-task-candidate-tamper');
  }
  const catalogDigest = computeSimulationTaskCatalogDigest();
  if (catalogDigest !== plan.catalogDigest) {
    throw new Error('historical-simulation-task-catalog-drift');
  }
  const planDigest = digestJson({
    schemaVersion: plan.schemaVersion,
    generatedAt: plan.generatedAt,
    catalogVersion: plan.catalogVersion,
    catalogDigest: plan.catalogDigest,
    candidateDigest: plan.candidateDigest,
    candidates,
  });
  if (planDigest !== plan.planDigest || planDigest !== expectedPlanDigest) {
    throw new Error('historical-simulation-task-plan-drift');
  }
  return { ...plan, candidates, planDigest };
}

function isCandidateAuthorityConsistent(
  candidate: HistoricalSimulationTaskPlanCandidate,
): boolean {
  const task = getSimulationTaskByKey(candidate.taskKey);
  if (!task || task.source !== candidate.source) return false;
  if (task.completionRule.kind === 'arena-accepted-submission') {
    return candidate.source === 'arena' && candidate.tier === 'submission';
  }
  if (task.completionRule.kind === 'odyssey-persistent-clear') {
    return candidate.source === 'odyssey' && candidate.tier === 'clear';
  }
  return candidate.source === 'virtual-simulation'
    || candidate.source === 'control-workbench';
}

export async function applyHistoricalSimulationTaskPlan(
  db: HistoricalSimulationTaskApplyDb,
  input: {
    plan: HistoricalSimulationTaskPlan;
    expectedPlanDigest: string;
    now?: Date;
  },
): Promise<{
  planDigest: string;
  candidateCount: number;
  affectedLearners: number;
  created: number;
  targetGenerations: Array<{ userId: string; generation: number }>;
}> {
  const plan = validateHistoricalSimulationTaskPlan(input.plan, input.expectedPlanDigest);
  const candidatesByUser = new Map<string, HistoricalSimulationTaskPlanCandidate[]>();
  for (const candidate of plan.candidates) {
    const candidates = candidatesByUser.get(candidate.userId) ?? [];
    candidates.push(candidate);
    candidatesByUser.set(candidate.userId, candidates);
  }

  let created = 0;
  const targetGenerations: Array<{ userId: string; generation: number }> = [];
  for (const [userId, candidates] of [...candidatesByUser].sort(([left], [right]) =>
    left.localeCompare(right))) {
    const result = await db.$transaction(async (tx) => {
      if (typeof tx.$executeRaw === 'function') {
        await tx.$executeRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${'portrait-v2:' + userId}))`,
        );
      }
      let learnerCreated = 0;
      for (const candidate of candidates) {
        const persisted = await persistSimulationTaskEvidence(tx as never, {
          userId,
          evidence: evidenceFromCandidate(candidate),
          sourceLogId: candidate.sourceRef,
          historicalCandidatePlanDigest: plan.planDigest,
        });
        learnerCreated += persisted.created;
      }
      const simulationTaskInput = await readSimulationTaskInputIdentityForScheduling(tx, {
        userId,
      });
      const generation = await requestCumulativeLearnerReconciliation(tx as never, {
        userId,
        reason: 'historical-simulation-task-evidence-apply',
        now: input.now,
        simulationTaskInput,
      });
      return { learnerCreated, generation, simulationTaskInput };
    }, { timeout: 120_000 });
    created += result.learnerCreated;
    targetGenerations.push({ userId, generation: result.generation });
  }

  return {
    planDigest: plan.planDigest,
    candidateCount: plan.candidates.length,
    affectedLearners: candidatesByUser.size,
    created,
    targetGenerations,
  };
}

function evidenceFromCandidate(
  candidate: HistoricalSimulationTaskPlanCandidate,
): GovernedTaskEvidenceContext {
  return {
    schemaVersion: 'simulation-task-evidence.v1',
    taskKey: candidate.taskKey,
    artifactKey: candidate.artifactKey,
    source: candidate.source,
    tier: candidate.tier,
    occurredAt: candidate.occurredAt,
    semanticFingerprint: candidate.semanticFingerprint,
    summary: {
      sourceRef: candidate.sourceRef,
      qualityBand: candidate.tier === 'clear' || candidate.tier === 'submission'
        ? 'full'
        : candidate.tier === 'process' ? 'minimal' : 'partial',
      label: 'Accepted historical simulation task evidence',
    },
    sourceValidity: 'valid',
    completionAuthority: completionAuthorityForCandidate(candidate),
    portraitWeight: 0,
    portraitDimensionMapping: 'simulationValidationEvidence',
    capabilityMappingTags: [],
  };
}

function completionAuthorityForCandidate(
  candidate: HistoricalSimulationTaskPlanCandidate,
): GovernedTaskEvidenceContext['completionAuthority'] {
  if (candidate.source === 'arena') return 'arena-accepted-submission';
  if (candidate.source === 'odyssey') return 'odyssey-persistent-clear';
  return 'validated-distinct-runs';
}

function canonicalCandidates<T extends HistoricalSimulationTaskPlanCandidate>(
  candidates: readonly T[],
): T[] {
  return [...candidates].sort((left, right) =>
    left.userId.localeCompare(right.userId) ||
    left.artifactKey.localeCompare(right.artifactKey) ||
    left.tier.localeCompare(right.tier) ||
    left.recordId.localeCompare(right.recordId));
}

function digestJson(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
