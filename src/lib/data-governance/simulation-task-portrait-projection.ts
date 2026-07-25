import { createHash } from 'node:crypto';

import {
  getSimulationTaskCatalog,
  type SimulationTaskCatalogEntry,
  type SimulationTaskSource,
} from './simulation-task-catalog';
import { countDistinctValidRuns } from './simulation-task-completion';
import {
  isGovernedTaskEvidence,
  type GovernedTaskEvidenceContext,
  type TaskEvidenceTier,
} from './simulation-task-evidence';

export const SIMULATION_TASK_PORTRAIT_CALCULATION_VERSION =
  'simulation-task-attainment-portrait.v1';
export const NO_HISTORICAL_SIMULATION_TASK_PLAN_DIGEST = 'none';
const HISTORICAL_SIMULATION_TASK_PLAN_SET_VERSION =
  'simulation-task-historical-plan-set.v1';

export interface SimulationTaskBinarySummary {
  taskKey: string;
  displayName: string;
  completed: boolean;
}

export interface SimulationTaskGroupSummary {
  source: SimulationTaskSource;
  displayGroup: string;
  completedTaskCount: number;
  relatedTaskCount: number;
  tasks: SimulationTaskBinarySummary[];
}

export interface SimulationTaskAttainmentProjection {
  state: 'EVIDENCE' | 'NO_EVIDENCE';
  score: number | null;
  completedTaskCount: number;
  relatedTaskCount: number;
  groupedTaskSummary: SimulationTaskGroupSummary[];
  evidenceAsOf: string | null;
  sourceLineage: Array<{
    kind: 'evidence-family';
    ref: string;
    privacyScope: 'student-visible';
  }>;
  calculationVersion: typeof SIMULATION_TASK_PORTRAIT_CALCULATION_VERSION;
  catalogDigest: string;
  limitations: string[];
  hasGovernedTaskEvidence: boolean;
}

export interface SimulationTaskInputIdentity {
  factWatermark: string;
  catalogDigest: string;
  projectionCalculationVersion: typeof SIMULATION_TASK_PORTRAIT_CALCULATION_VERSION;
  historicalCandidatePlanDigest: string;
  inputDigest: string;
}

export interface SimulationTaskIdentityFact {
  id: string;
  contextJson?: unknown;
}

export interface SimulationTaskIdentityTransition {
  factId: string;
  sequence: bigint;
  operation?: 'UPSERT' | 'CORRECT' | 'REVOKE';
  transitionPayload?: unknown;
}

export class SimulationTaskInputDriftError extends Error {
  constructor(readonly actualInput: SimulationTaskInputIdentity) {
    super('simulation-task-portrait-input-drift');
    this.name = 'SimulationTaskInputDriftError';
  }
}

const TIER_ORDER: Record<TaskEvidenceTier, number> = {
  process: 0,
  run: 1,
  evaluation: 2,
  submission: 3,
  clear: 4,
};

export function computeSimulationTaskCatalogDigest(
  catalog: readonly SimulationTaskCatalogEntry[] = getSimulationTaskCatalog(),
): string {
  return hashJson(catalog
    .filter((entry) => entry.published)
    .map((entry) => ({
      taskKey: entry.taskKey,
      source: entry.source,
      sourceTaskId: entry.sourceTaskId,
      displayName: entry.displayName,
      completionRule: entry.completionRule,
      displayGroup: entry.displayGroup,
    }))
    .sort((left, right) => left.taskKey.localeCompare(right.taskKey)));
}

export function buildSimulationTaskInputIdentity(input: {
  factWatermark: bigint | number | string;
  catalogDigest: string;
  historicalCandidatePlanDigest?: string | null;
}): SimulationTaskInputIdentity {
  const identity: Omit<SimulationTaskInputIdentity, 'inputDigest'> = {
    factWatermark: String(input.factWatermark),
    catalogDigest: input.catalogDigest,
    projectionCalculationVersion: SIMULATION_TASK_PORTRAIT_CALCULATION_VERSION,
    historicalCandidatePlanDigest:
      input.historicalCandidatePlanDigest?.trim() ||
      NO_HISTORICAL_SIMULATION_TASK_PLAN_DIGEST,
  };
  return {
    ...identity,
    inputDigest: hashJson(identity),
  };
}

export function deriveHistoricalSimulationTaskPlanDigest(
  facts: ReadonlyArray<{ contextJson?: unknown }>,
): string {
  const planDigests = new Set<string>();
  for (const fact of facts) {
    const context = asRecord(fact.contextJson);
    if (context.simulationTaskHistoricalCandidate === undefined) continue;
    const historical = asRecord(context.simulationTaskHistoricalCandidate);
    if (
      historical.schemaVersion !== 'simulation-task-historical-candidate.v1'
      || typeof historical.planDigest !== 'string'
      || !/^[0-9a-f]{64}$/u.test(historical.planDigest)
    ) {
      throw new Error('historical-simulation-task-plan-lineage-invalid');
    }
    planDigests.add(historical.planDigest);
  }
  const sortedPlanDigests = [...planDigests].sort();
  if (sortedPlanDigests.length === 0) return NO_HISTORICAL_SIMULATION_TASK_PLAN_DIGEST;
  return hashJson({
    schemaVersion: HISTORICAL_SIMULATION_TASK_PLAN_SET_VERSION,
    planDigests: sortedPlanDigests,
  });
}

export function buildSimulationTaskInputIdentityFromFactJournal(input: {
  facts: readonly SimulationTaskIdentityFact[];
  transitions: readonly SimulationTaskIdentityTransition[];
  catalogDigest?: string;
}): SimulationTaskInputIdentity {
  const latestTransitionByFact = new Map<string, SimulationTaskIdentityTransition>();
  let currentWatermark = BigInt(0);
  for (const transition of input.transitions) {
    if (transition.sequence > currentWatermark) currentWatermark = transition.sequence;
    const current = latestTransitionByFact.get(transition.factId);
    if (!current || transition.sequence > current.sequence) {
      latestTransitionByFact.set(transition.factId, transition);
    }
  }
  const journaledFactIds = new Set(input.transitions.map((transition) => transition.factId));
  const missingFactCount = new Set(
    input.facts.filter((fact) => !journaledFactIds.has(fact.id)).map((fact) => fact.id),
  ).size;
  const activeFacts = input.facts.flatMap((fact) => {
    const transition = latestTransitionByFact.get(fact.id);
    if (transition?.operation === 'REVOKE') return [];
    if (transition?.operation === 'CORRECT') {
      const correction = asRecord(transition.transitionPayload);
      if (correction.contextJson !== undefined) {
        return [{ contextJson: correction.contextJson }];
      }
    }
    return [{ contextJson: fact.contextJson }];
  });
  return buildSimulationTaskInputIdentity({
    factWatermark: currentWatermark + BigInt(missingFactCount),
    catalogDigest: input.catalogDigest ?? computeSimulationTaskCatalogDigest(),
    historicalCandidatePlanDigest:
      deriveHistoricalSimulationTaskPlanDigest(activeFacts),
  });
}

export function assertSimulationTaskInputIdentity(
  expectedInputDigest: string | undefined,
  actualInput: string | SimulationTaskInputIdentity,
): void {
  const actualInputDigest = typeof actualInput === 'string'
    ? actualInput
    : actualInput.inputDigest;
  if (expectedInputDigest && expectedInputDigest !== actualInputDigest) {
    if (typeof actualInput === 'string') {
      throw new Error('simulation-task-portrait-input-drift');
    }
    throw new SimulationTaskInputDriftError(actualInput);
  }
}

export function projectSimulationTaskAttainment(
  facts: ReadonlyArray<{ id: string; contextJson: unknown }>,
  catalog: readonly SimulationTaskCatalogEntry[] = getSimulationTaskCatalog(),
): SimulationTaskAttainmentProjection {
  const publishedCatalog = catalog
    .filter((entry) => entry.published)
    .sort((left, right) => left.taskKey.localeCompare(right.taskKey));
  const catalogByKey = new Map(publishedCatalog.map((entry) => [entry.taskKey, entry]));
  const governedEvidence = facts.flatMap((fact) => {
    const context = asRecord(fact.contextJson);
    const evidence = context.simulationTaskEvidence;
    return isGovernedTaskEvidence(evidence) && isCompleteGovernedEvidence(evidence)
      ? [evidence]
      : [];
  });
  const selectedEvidence = selectEffectiveArtifactResults(
    governedEvidence.filter((evidence) =>
      catalogByKey.get(evidence.taskKey)?.source === evidence.source),
    catalogByKey,
  );
  const completedTaskKeys = new Set(publishedCatalog
    .filter((entry) =>
      isTaskAttained(
        entry,
        selectedEvidence.filter((evidence) => evidence.taskKey === entry.taskKey),
      ))
    .map((entry) => entry.taskKey));
  const contributingEvidence = selectedEvidence.filter((evidence) =>
    completedTaskKeys.has(evidence.taskKey));
  const evidenceAsOf = latestIso(contributingEvidence.map((evidence) => evidence.occurredAt));
  const groupedTaskSummary = buildGroupedSummary(publishedCatalog, completedTaskKeys);
  const completedTaskCount = completedTaskKeys.size;
  const relatedTaskCount = publishedCatalog.length;
  const catalogDigest = computeSimulationTaskCatalogDigest(catalog);

  if (relatedTaskCount === 0 || completedTaskCount === 0) {
    return {
      state: 'NO_EVIDENCE',
      score: null,
      completedTaskCount: 0,
      relatedTaskCount,
      groupedTaskSummary,
      evidenceAsOf: null,
      sourceLineage: [],
      calculationVersion: SIMULATION_TASK_PORTRAIT_CALCULATION_VERSION,
      catalogDigest,
      limitations: [
        relatedTaskCount === 0
          ? 'simulation-task-current-catalog-empty'
          : 'simulation-task-no-attained-current-task',
        ...(governedEvidence.some((evidence) => !evidence.completionAuthority)
          ? ['simulation-task-completion-authority-missing']
          : []),
        'simulation-task-partial-progress-does-not-contribute',
      ],
      hasGovernedTaskEvidence: governedEvidence.length > 0,
    };
  }

  return {
    state: 'EVIDENCE',
    score: round(completedTaskCount / relatedTaskCount * 100),
    completedTaskCount,
    relatedTaskCount,
    groupedTaskSummary,
    evidenceAsOf,
    sourceLineage: [
      {
        kind: 'evidence-family',
        ref: 'LearningFact',
        privacyScope: 'student-visible',
      },
    ],
    calculationVersion: SIMULATION_TASK_PORTRAIT_CALCULATION_VERSION,
    catalogDigest,
    limitations: [
      'simulation-task-attainment-is-binary-and-task-normalized',
      'simulation-task-partial-progress-does-not-contribute',
    ],
    hasGovernedTaskEvidence: governedEvidence.length > 0,
  };
}

function isTaskAttained(
  entry: SimulationTaskCatalogEntry,
  evidence: GovernedTaskEvidenceContext[],
): boolean {
  switch (entry.completionRule.kind) {
    case 'arena-accepted-submission':
      return evidence.some((item) =>
        item.completionAuthority === 'arena-accepted-submission'
        && item.tier === 'submission');
    case 'odyssey-persistent-clear':
      return evidence.some((item) =>
        item.completionAuthority === 'odyssey-persistent-clear'
        && item.tier === 'clear');
    case 'distinct-valid-runs':
      return countDistinctValidRuns(evidence.filter((item) =>
        item.completionAuthority === 'validated-distinct-runs'))
        >= entry.completionRule.requiredCount;
  }
}

export async function findSimulationTaskProjectionCandidateUserIds(
  db: {
    learnerPortraitCurrentState?: {
      findMany(args: Record<string, unknown>): Promise<Array<{
        userId: string;
        stateVersion?: {
          stateKind?: 'SNAPSHOT' | 'NO_EVIDENCE';
          taskInputDigest?: string;
          snapshot?: { payload?: unknown } | null;
        } | null;
      }>>;
    };
    learningFact: {
      findMany(args: Record<string, unknown>): Promise<Array<{
        id?: string;
        userId: string;
        contextJson?: unknown;
      }>>;
    };
    learnerFactTransition?: {
      findMany(args: Record<string, unknown>): Promise<Array<SimulationTaskIdentityTransition>>;
    };
  },
  options: { batchSize?: number } = {},
): Promise<string[]> {
  const batchSize = options.batchSize ?? 500;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5_000) {
    throw new Error('simulation-task-candidate-batch-size-invalid');
  }
  const candidates = new Set<string>();
  const currentProjectionByUser = new Map<string, boolean>();
  const noEvidenceTaskInputDigestByUser = new Map<string, string>();
  const currentCatalogDigest = computeSimulationTaskCatalogDigest();
  let offset = 0;
  while (db.learnerPortraitCurrentState) {
    const rows = await db.learnerPortraitCurrentState.findMany({
      select: {
        userId: true,
        stateVersion: {
          select: {
            stateKind: true,
            taskInputDigest: true,
            snapshot: { select: { payload: true } },
          },
        },
      },
      orderBy: { userId: 'asc' },
      skip: offset,
      take: batchSize,
    });
    for (const row of rows) {
      const persisted = readPersistedSimulationTaskProjection(
        row.stateVersion?.snapshot?.payload,
      );
      const isCurrent = persisted !== null
        && persisted.calculationVersion === SIMULATION_TASK_PORTRAIT_CALCULATION_VERSION
        && persisted.catalogDigest === currentCatalogDigest;
      currentProjectionByUser.set(row.userId, isCurrent);
      if (
        row.stateVersion?.stateKind === 'NO_EVIDENCE'
        && row.stateVersion.taskInputDigest?.trim()
      ) {
        noEvidenceTaskInputDigestByUser.set(
          row.userId,
          row.stateVersion.taskInputDigest,
        );
      }
      if (persisted && !isCurrent) {
        candidates.add(row.userId);
      }
    }
    if (rows.length < batchSize) break;
    offset += rows.length;
  }
  offset = 0;
  while (true) {
    const rows = await db.learningFact.findMany({
      where: {
        contextJson: {
          path: ['simulationTaskEvidence', 'schemaVersion'],
          equals: 'simulation-task-evidence.v1',
        },
      },
      select: { userId: true },
      distinct: ['userId'],
      orderBy: { userId: 'asc' },
      skip: offset,
      take: batchSize,
    });
    for (const row of rows) {
      const tombstoneDigest = noEvidenceTaskInputDigestByUser.get(row.userId);
      const tombstoneIsCurrent = tombstoneDigest
        ? await hasCurrentNoEvidenceTaskInputIdentity(
            db,
            row.userId,
            tombstoneDigest,
            currentCatalogDigest,
          )
        : false;
      if (
        currentProjectionByUser.get(row.userId) !== true
        && !tombstoneIsCurrent
      ) {
        candidates.add(row.userId);
      }
    }
    if (rows.length < batchSize) break;
    offset += rows.length;
  }
  return [...candidates].sort();
}

async function hasCurrentNoEvidenceTaskInputIdentity(
  db: {
    learningFact: {
      findMany(args: Record<string, unknown>): Promise<Array<{
        id?: string;
        userId: string;
        contextJson?: unknown;
      }>>;
    };
    learnerFactTransition?: {
      findMany(args: Record<string, unknown>): Promise<Array<SimulationTaskIdentityTransition>>;
    };
  },
  userId: string,
  persistedTaskInputDigest: string,
  catalogDigest: string,
): Promise<boolean> {
  if (!db.learnerFactTransition) return false;
  const [facts, transitions] = await Promise.all([
    db.learningFact.findMany({
      where: { userId },
      select: { id: true, userId: true, contextJson: true },
    }),
    db.learnerFactTransition.findMany({
      where: { userId },
      select: {
        factId: true,
        sequence: true,
        operation: true,
        transitionPayload: true,
      },
    }),
  ]);
  if (facts.some((fact) => typeof fact.id !== 'string')) return false;
  const currentIdentity = buildSimulationTaskInputIdentityFromFactJournal({
    facts: facts as Array<SimulationTaskIdentityFact & { userId: string }>,
    transitions,
    catalogDigest,
  });
  return currentIdentity.inputDigest === persistedTaskInputDigest;
}

function selectEffectiveArtifactResults(
  evidenceList: readonly GovernedTaskEvidenceContext[],
  catalogByKey: Map<string, SimulationTaskCatalogEntry>,
): GovernedTaskEvidenceContext[] {
  const byArtifact = new Map<string, GovernedTaskEvidenceContext>();
  for (const evidence of evidenceList) {
    const entry = catalogByKey.get(evidence.taskKey);
    if (!entry || evidence.portraitWeight !== 0 || evidence.sourceValidity !== 'valid') continue;
    const existing = byArtifact.get(evidence.artifactKey);
    if (!existing || compareArtifactResult(evidence, existing, entry) > 0) {
      byArtifact.set(evidence.artifactKey, evidence);
    }
  }
  return [...byArtifact.values()].sort((left, right) =>
    left.taskKey.localeCompare(right.taskKey) ||
    left.artifactKey.localeCompare(right.artifactKey));
}

function compareArtifactResult(
  left: GovernedTaskEvidenceContext,
  right: GovernedTaskEvidenceContext,
  entry: SimulationTaskCatalogEntry,
): number {
  const resultDifference =
    sourceResultRank(left, entry) - sourceResultRank(right, entry);
  if (resultDifference !== 0) return resultDifference;
  const tierDifference = TIER_ORDER[left.tier] - TIER_ORDER[right.tier];
  if (tierDifference !== 0) return tierDifference;
  return stableJson(left).localeCompare(stableJson(right));
}

function sourceResultRank(
  evidence: GovernedTaskEvidenceContext,
  entry: SimulationTaskCatalogEntry,
): number {
  switch (entry.completionRule.kind) {
    case 'arena-accepted-submission':
      return evidence.completionAuthority === 'arena-accepted-submission'
        && evidence.tier === 'submission' ? 1 : 0;
    case 'odyssey-persistent-clear':
      return evidence.completionAuthority === 'odyssey-persistent-clear'
        && evidence.tier === 'clear' ? 1 : 0;
    case 'distinct-valid-runs':
      return evidence.completionAuthority === 'validated-distinct-runs'
        && evidence.sourceValidity === 'valid' ? 1 : 0;
  }
}

function buildGroupedSummary(
  catalog: readonly SimulationTaskCatalogEntry[],
  completedTaskKeys: Set<string>,
): SimulationTaskGroupSummary[] {
  const groups = new Map<string, SimulationTaskGroupSummary>();
  for (const entry of catalog) {
    const key = `${entry.source}\u001f${entry.displayGroup}`;
    const group = groups.get(key) ?? {
      source: entry.source,
      displayGroup: entry.displayGroup,
      completedTaskCount: 0,
      relatedTaskCount: 0,
      tasks: [],
    };
    const completed = completedTaskKeys.has(entry.taskKey);
    group.relatedTaskCount += 1;
    if (completed) group.completedTaskCount += 1;
    group.tasks.push({
      taskKey: entry.taskKey,
      displayName: entry.displayName,
      completed,
    });
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      tasks: group.tasks.sort((left, right) => left.taskKey.localeCompare(right.taskKey)),
    }))
    .sort((left, right) =>
      left.source.localeCompare(right.source) ||
      left.displayGroup.localeCompare(right.displayGroup));
}

function isCompleteGovernedEvidence(
  evidence: GovernedTaskEvidenceContext,
): boolean {
  return evidence.schemaVersion === 'simulation-task-evidence.v1' &&
    typeof evidence.taskKey === 'string' &&
    typeof evidence.artifactKey === 'string' &&
    typeof evidence.occurredAt === 'string' &&
    Number.isFinite(Date.parse(evidence.occurredAt)) &&
    typeof evidence.semanticFingerprint === 'string' &&
    evidence.portraitWeight === 0 &&
    evidence.portraitDimensionMapping === 'simulationValidationEvidence';
}

function readPersistedSimulationTaskProjection(
  value: unknown,
): { calculationVersion: unknown; catalogDigest: unknown } | null {
  const payload = asRecord(value);
  if (!Array.isArray(payload.dimensions)) return null;
  for (const item of payload.dimensions) {
    const dimension = asRecord(item);
    if (dimension.id !== 'simulationValidationEvidence') continue;
    const taskAttainment = asRecord(dimension.taskAttainment);
    if (Object.keys(taskAttainment).length === 0) return null;
    return {
      calculationVersion: taskAttainment.calculationVersion,
      catalogDigest: taskAttainment.catalogDigest,
    };
  }
  return null;
}

function latestIso(values: string[]): string | null {
  return values.reduce<string | null>((latest, value) =>
    latest === null || Date.parse(value) > Date.parse(latest) ? value : latest, null);
}

function hashJson(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
