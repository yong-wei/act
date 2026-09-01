import type {
  PersonalizedPathDecisionEvidence,
  PersonalizedPathDecisionImpact,
  PersonalizedPathDecisionSnapshot,
} from '@/features/personalization/path-planning/public-api';

export const PERSONALIZED_PATH_EFFECT_EVALUATION_VERSION = 'personalized-path-effect-evaluation.v1';
export const PERSONALIZED_PATH_EFFECT_MIN_SAMPLE_SIZE = 5;

export type PersonalizedPathEffectCohort = 'personalized' | 'baseline' | 'insufficient';
export type PersonalizedPathEffectConclusion = 'observational' | 'insufficient-data';

export interface PersonalizedPathEffectRecord {
  pathId: string;
  userId: string;
  goalId: string;
  pathStatus: string;
  plannerVersion: string | null;
  candidateBatchId?: string | null;
  policyFamily?: string | null;
  nodeCount: number;
  createdAt: string;
  decisionEvidence?: PersonalizedPathDecisionEvidence | null;
  pathImpacts?: PersonalizedPathDecisionImpact[];
  executions: Array<{
    nodeId: string;
    status: string;
    resourceType: string;
    completedAt?: string | null;
  }>;
  competencyLift?: number | null;
}

export interface PersonalizedPathEffectMetric {
  id: 'adoption' | 'completion' | 'checkpoint' | 'competencyLift';
  label: string;
  value: number | null;
  numerator: number;
  denominator: number;
  sampleSize: number;
}

export interface PersonalizedPathEffectCohortSummary {
  id: PersonalizedPathEffectCohort;
  sampleSize: number;
  limitations: string[];
  metrics: PersonalizedPathEffectMetric[];
}

export interface PersonalizedPathEffectEvaluation {
  version: typeof PERSONALIZED_PATH_EFFECT_EVALUATION_VERSION;
  classId: string;
  goalId: string;
  evaluatedAt: string;
  evidenceWindow: { start: string | null; end: string | null };
  minSampleSize: number;
  conclusion: PersonalizedPathEffectConclusion;
  limitations: string[];
  cohorts: PersonalizedPathEffectCohortSummary[];
}

const ADOPTED_STATUSES = new Set(['active', 'completed']);
const COMPLETED_STATUSES = new Set(['completed']);
const INSUFFICIENT_REASONS = new Set([
  'insufficient-evidence',
  'stale-evidence',
  'partial-evidence',
  'missing-evidence',
  'preference-untrusted',
]);

function snapshotOf(record: PersonalizedPathEffectRecord): PersonalizedPathDecisionSnapshot | null {
  return record.decisionEvidence?.snapshot ?? null;
}

function impactsOf(record: PersonalizedPathEffectRecord): PersonalizedPathDecisionImpact[] {
  if (record.pathImpacts !== undefined) return record.pathImpacts;
  return [];
}

export function classifyPersonalizedPathEffectCohort(
  record: PersonalizedPathEffectRecord,
): PersonalizedPathEffectCohort {
  const snapshot = snapshotOf(record);
  if (!snapshot) return 'insufficient';
  if (snapshot.freshness === 'missing' || snapshot.freshness === 'stale' || snapshot.freshness === 'partial') {
    return 'insufficient';
  }
  if (snapshot.degradationReasons.some((reason) => INSUFFICIENT_REASONS.has(reason))) {
    return 'insufficient';
  }
  const personalized = impactsOf(record).some((impact) => impact.source === 'profile');
  return personalized ? 'personalized' : 'baseline';
}

function rateMetric(
  id: PersonalizedPathEffectMetric['id'],
  label: string,
  numerator: number,
  denominator: number,
  sampleSize: number,
): PersonalizedPathEffectMetric {
  return {
    id,
    label,
    value: denominator > 0 ? numerator / denominator : null,
    numerator,
    denominator,
    sampleSize,
  };
}

function cohortMetrics(records: PersonalizedPathEffectRecord[]): PersonalizedPathEffectMetric[] {
  const adopted = records.filter((record) => ADOPTED_STATUSES.has(record.pathStatus));
  const completed = records.filter((record) => COMPLETED_STATUSES.has(record.pathStatus));
  const checkpointDenominator = adopted.reduce((sum, record) => sum + Math.max(record.nodeCount, 0), 0);
  const checkpointNumerator = adopted.reduce((sum, record) => (
    sum + record.executions.filter((execution) => execution.status === 'completed').length
  ), 0);
  const liftSamples = adopted.filter((record) => typeof record.competencyLift === 'number');
  const liftTotal = liftSamples.reduce((sum, record) => sum + (record.competencyLift ?? 0), 0);
  return [
    rateMetric('adoption', '路径采纳率', adopted.length, records.length, records.length),
    rateMetric('completion', '路径完成率', completed.length, adopted.length, adopted.length),
    rateMetric('checkpoint', '检查点完成率', checkpointNumerator, checkpointDenominator, adopted.length),
    rateMetric('competencyLift', '能力变化', liftTotal, liftSamples.length, liftSamples.length),
  ];
}

function latestRecordByLearner(records: PersonalizedPathEffectRecord[]): PersonalizedPathEffectRecord[] {
  const latest = new Map<string, PersonalizedPathEffectRecord>();
  for (const record of records) {
    const current = latest.get(record.userId);
    if (!current || Date.parse(record.createdAt) >= Date.parse(current.createdAt)) {
      latest.set(record.userId, record);
    }
  }
  return [...latest.values()];
}

function uniqueLearners(records: PersonalizedPathEffectRecord[]): number {
  return new Set(records.map((record) => record.userId)).size;
}

function competencyLiftFromSnapshots(
  // portrait-v2-legacy-compatibility-adapter: competencyVector remains non-authoritative lift input.
  snapshots: Array<{ snapshotAt?: Date | string; competencyVector?: unknown }>,
  pathCreatedAt: string,
  executions: Array<{ completedAt?: string | null }>,
): number | null {
  const createdAt = Date.parse(pathCreatedAt);
  const windowEnd = executions
    .map((execution) => execution.completedAt ? Date.parse(execution.completedAt) : Number.NaN)
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => right - left)[0];
  if (!Number.isFinite(createdAt) || windowEnd === undefined) return null;
  const previous = snapshots
    .filter((snapshot) => Date.parse(String(snapshot.snapshotAt)) <= createdAt)
    .sort((left, right) => Date.parse(String(right.snapshotAt)) - Date.parse(String(left.snapshotAt)))[0];
  const latest = snapshots
    .filter((snapshot) => {
      const at = Date.parse(String(snapshot.snapshotAt));
      return at > createdAt && at <= windowEnd;
    })
    .sort((left, right) => Date.parse(String(right.snapshotAt)) - Date.parse(String(left.snapshotAt)))[0];
  // portrait-v2-legacy-compatibility-adapter: competencyVector remains non-authoritative lift input.
  const latestScore = averageCompetency(latest?.competencyVector);
  const previousScore = averageCompetency(previous?.competencyVector);
  if (latestScore === null || previousScore === null) return null;
  return latestScore - previousScore;
}

function averageCompetency(vector: unknown): number | null {
  if (!vector || typeof vector !== 'object' || Array.isArray(vector)) return null;
  const scores = Object.values(vector as Record<string, unknown>)
    .map((item) => {
      if (typeof item === 'number') return item;
      if (item && typeof item === 'object' && !Array.isArray(item) && typeof (item as { score?: unknown }).score === 'number') {
        return (item as { score: number }).score;
      }
      return null;
    })
    .filter((value): value is number => value !== null);
  return scores.length > 0 ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null;
}

function cohortLimitations(id: PersonalizedPathEffectCohort, records: PersonalizedPathEffectRecord[]): string[] {
  if (id !== 'insufficient') return [];
  return [...new Set(records.flatMap((record) => snapshotOf(record)?.limitations ?? ['当前没有足够的有效学习证据支持个性化判断。']))];
}

export function evaluatePersonalizedPathEffects(input: {
  classId: string;
  goalId: string;
  evaluatedAt: string;
  records: PersonalizedPathEffectRecord[];
  minSampleSize?: number;
}): PersonalizedPathEffectEvaluation {
  const minSampleSize = input.minSampleSize ?? PERSONALIZED_PATH_EFFECT_MIN_SAMPLE_SIZE;
  const grouped: Record<PersonalizedPathEffectCohort, PersonalizedPathEffectRecord[]> = {
    personalized: [],
    baseline: [],
    insufficient: [],
  };
  const latestByLearner = latestRecordByLearner(
    input.records.filter((item) => item.goalId === input.goalId),
  );
  for (const record of latestByLearner) {
    grouped[classifyPersonalizedPathEffectCohort(record)].push(record);
  }

  const capturedTimes = latestByLearner
    .map((record) => snapshotOf(record)?.capturedAt)
    .filter((value): value is string => Boolean(value))
    .sort();
  const comparisonReady = uniqueLearners(grouped.personalized) >= minSampleSize
    && uniqueLearners(grouped.baseline) >= minSampleSize;
  const limitations = [
    ...(comparisonReady ? [] : ['可信个性化或基准样本不足，不能给出个性化提升结论。']),
    ...cohortLimitations('insufficient', grouped.insufficient),
  ];

  return {
    version: PERSONALIZED_PATH_EFFECT_EVALUATION_VERSION,
    classId: input.classId,
    goalId: input.goalId,
    evaluatedAt: input.evaluatedAt,
    evidenceWindow: {
      start: capturedTimes[0] ?? null,
      end: capturedTimes.at(-1) ?? null,
    },
    minSampleSize,
    conclusion: comparisonReady ? 'observational' : 'insufficient-data',
    limitations,
    cohorts: (['personalized', 'baseline', 'insufficient'] as const).map((id) => ({
      id,
      sampleSize: grouped[id].length,
      limitations: cohortLimitations(id, grouped[id]),
      metrics: cohortMetrics(grouped[id]),
    })),
  };
}

export function decisionEvidenceFromUnknown(value: unknown): PersonalizedPathDecisionEvidence | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<PersonalizedPathDecisionEvidence>;
  if (!candidate.snapshot || typeof candidate.snapshot !== 'object') return null;
  if (candidate.snapshot.version !== 'personalized-path-decision-evidence.v1') return null;
  return {
    snapshot: candidate.snapshot,
    paths: Array.isArray(candidate.paths) ? candidate.paths : [],
  };
}

function recordFromUnknown(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function nodeCountFromPath(path: { nodeIds?: unknown; pathPayload?: unknown }): number {
  if (Array.isArray(path.nodeIds)) return path.nodeIds.length;
  const payload = recordFromUnknown(path.pathPayload);
  return Array.isArray(payload.planNodes) ? payload.planNodes.length : 0;
}

export function recordsFromPathAndBatchSources(input: {
  paths: Array<{
    id: string;
    userId: string;
    goalId: string | null;
    pathStatus: string;
    plannerVersion: string | null;
    nodeIds?: unknown;
    pathPayload?: unknown;
    createdAt: Date | string;
    executions?: Array<{
      nodeId: string;
      status: string;
      resourceType: string;
      completedAt?: Date | string | null;
    }>;
  }>;
  batches: Array<{
    id: string;
    userId: string;
    goalId: string;
    sourcePathId?: string | null;
    createdAt: Date | string;
    metadata?: unknown;
    candidates?: Array<{ snapshot?: unknown }>;
  }>;
  competencySnapshots?: Array<{
    userId: string;
    snapshotAt: Date | string;
    // portrait-v2-legacy-compatibility-adapter: competencyVector is non-authoritative.
    competencyVector?: unknown;
  }>;
}): PersonalizedPathEffectRecord[] {
  return input.paths.flatMap((path) => {
    if (!path.goalId) return [];
    const payload = recordFromUnknown(path.pathPayload);
    const batch = input.batches
      .filter((item) => item.sourcePathId === path.id)
      .sort((left, right) => Date.parse(String(right.createdAt)) - Date.parse(String(left.createdAt)))[0];
    const decisionEvidence = decisionEvidenceFromUnknown(payload.decisionEvidence)
      ?? decisionEvidenceFromUnknown(recordFromUnknown(batch?.metadata).decisionEvidence);
    const selectedOptionId = typeof payload.selectedOptionId === 'string' ? payload.selectedOptionId : null;
    const candidateSnapshot = selectedOptionId
      ? batch?.candidates
        ?.map((candidate) => recordFromUnknown(candidate.snapshot))
        .find((snapshot) => snapshot.optionId === selectedOptionId)
      : undefined;
    const selectedPathEvidence = selectedOptionId
      ? decisionEvidence?.paths.find((item) => item.optionId === selectedOptionId)
      : undefined;
    const pathImpacts = Array.isArray(payload.decisionImpacts)
      ? payload.decisionImpacts as PersonalizedPathDecisionImpact[]
      : Array.isArray(recordFromUnknown(candidateSnapshot?.decisionEvidence).impacts)
        ? recordFromUnknown(candidateSnapshot?.decisionEvidence).impacts as PersonalizedPathDecisionImpact[]
        : selectedPathEvidence?.impacts;
    const createdAt = typeof path.createdAt === 'string' ? path.createdAt : path.createdAt.toISOString();
    const executions = (path.executions ?? []).map((execution) => ({
      nodeId: execution.nodeId,
      status: execution.status,
      resourceType: execution.resourceType,
      completedAt: execution.completedAt
        ? (typeof execution.completedAt === 'string' ? execution.completedAt : execution.completedAt.toISOString())
        : null,
    }));
    const snapshots = (input.competencySnapshots ?? [])
      .filter((snapshot) => snapshot.userId === path.userId);
    return [{
      pathId: path.id,
      userId: path.userId,
      goalId: path.goalId,
      pathStatus: path.pathStatus,
      plannerVersion: path.plannerVersion,
      candidateBatchId: batch?.id ?? null,
      policyFamily: typeof payload.selectedPolicyFamily === 'string'
        ? payload.selectedPolicyFamily
        : (typeof payload.policyFamily === 'string' ? payload.policyFamily : null),
      nodeCount: nodeCountFromPath(path),
      createdAt,
      decisionEvidence,
      pathImpacts,
      executions,
      competencyLift: competencyLiftFromSnapshots(snapshots, createdAt, executions),
    }];
  });
}
