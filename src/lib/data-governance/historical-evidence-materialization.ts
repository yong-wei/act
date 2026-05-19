import type { Prisma } from '@prisma/client';

import {
  classifyEvidenceRow,
  getEvidenceSourceCatalog,
  type EvidenceCoverageRow,
  type EvidenceEligibility,
  type EvidenceProvenance,
  type EvidenceSourceId,
  type EvidenceValueLevel,
} from './evidence-source-catalog';
import {
  deriveFactOutcome,
  deriveFactScore,
  deriveFactTimeSpent,
  mapActionTypeToFactType,
  resolveCompetencyContribution,
} from './event-normalization';

type LearningFactCreateManyDelegate = {
  createMany(args: {
    data: Prisma.LearningFactCreateManyInput[];
    skipDuplicates?: boolean;
  }): Promise<{ count: number }>;
};

export type HistoricalEvidenceConfidence = 'high' | 'low';

export interface HistoricalEvidenceMaterializationCandidate {
  sourceId: EvidenceSourceId;
  sourceRecordId: string;
  stableSourceIdentity: string;
  evidenceSubtype: string;
  traceReference: string;
  userId: string;
  occurredAt: string;
  provenance: EvidenceProvenance;
  valueLevel: EvidenceValueLevel;
  eligibility: EvidenceEligibility;
  confidence: HistoricalEvidenceConfidence;
  alreadyMaterialized: boolean;
  canonicalEventType?: string;
  fact: Prisma.LearningFactCreateManyInput;
}

export interface HistoricalEvidenceMaterializationSkip {
  sourceId: EvidenceSourceId;
  sourceRecordId: string;
  traceReference: string;
  reason: string;
  provenance: EvidenceProvenance;
  eligibility: EvidenceEligibility;
  valueLevel: EvidenceValueLevel;
  userId?: string;
  canonicalEventType?: string;
}

export interface HistoricalEvidenceMaterializationSourceSummary {
  sourceId: EvidenceSourceId;
  totalRows: number;
  candidateRows: number;
  newFactRows: number;
  alreadyMaterializedRows: number;
  excludedRows: number;
  unsupportedRows: number;
  lowConfidenceRows: number;
  affectedUsers: number;
  firstObservedAt: string | null;
  lastObservedAt: string | null;
  sampleTraceReferences: string[];
}

export interface HistoricalEvidenceMaterializationPlan {
  generatedAt: string;
  mode: 'dry-run';
  candidates: HistoricalEvidenceMaterializationCandidate[];
  skipped: HistoricalEvidenceMaterializationSkip[];
  sources: HistoricalEvidenceMaterializationSourceSummary[];
  totals: {
    totalRows: number;
    candidateRows: number;
    newFactRows: number;
    alreadyMaterializedRows: number;
    excludedRows: number;
    unsupportedRows: number;
    lowConfidenceRows: number;
    affectedUsers: number;
  };
}

export interface BuildHistoricalEvidenceMaterializationPlanInput {
  generatedAt?: string;
  existingSourceEventIds?: Set<string>;
  rowsBySource: Partial<Record<EvidenceSourceId, EvidenceCoverageRow[]>>;
}

export interface HistoricalEvidenceMaterializationApplyResult {
  candidateRows: number;
  alreadyMaterializedRows: number;
  requestedCreateRows: number;
  createdRows: number;
  skippedRows: number;
  affectedUsers: number;
}

const SOURCE_ACTION_TYPES: Partial<Record<EvidenceSourceId, string>> = {
  StudentStepResponse: 'lesson_submit',
  SimulationLog: 'simulation_finish',
  UserAnswer: 'answer_submit',
  AbilityAssessment: 'assessment_complete',
  PromptAssessment: 'prompt_assessed',
  DesignSession: 'design_session_complete',
  ArenaSubmission: 'arena_submit',
};

const EVIDENCE_SUBTYPES: Partial<Record<EvidenceSourceId, string>> = {
  StudentStepResponse: 'student_step_response',
  SimulationLog: 'simulation_attempt',
  UserAnswer: 'question_answer',
  AbilityAssessment: 'ability_assessment',
  PromptAssessment: 'prompt_assessment',
  DesignSession: 'design_session',
  ArenaSubmission: 'arena_submission',
  ArenaEvaluationRun: 'arena_evaluation_run',
  LearningFact: 'existing_learning_fact',
};

const MATERIALIZATION_SOURCE_PRIORITY: Partial<Record<EvidenceSourceId, number>> = {
  StudentStepResponse: 0,
  InteractionLog: 1,
};

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function compactJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Prisma.InputJsonObject;
}

function normalizeDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function buildTraceReference(sourceId: EvidenceSourceId, rowId: string) {
  return `${sourceId}:${rowId}`;
}

function resolveEvidenceSubtype(
  sourceId: EvidenceSourceId,
  canonicalEventType: string | undefined,
) {
  if (sourceId === 'InteractionLog') {
    return canonicalEventType ?? 'interaction_event';
  }
  return EVIDENCE_SUBTYPES[sourceId] ?? 'historical_evidence';
}

function resolveActionType(sourceId: EvidenceSourceId, evidenceSubtype: string) {
  if (sourceId === 'InteractionLog') {
    return evidenceSubtype;
  }
  return SOURCE_ACTION_TYPES[sourceId] ?? evidenceSubtype;
}

function getMaterializationSources() {
  return getEvidenceSourceCatalog()
    .map((source, index) => ({ source, index }))
    .sort((left, right) => (
      (MATERIALIZATION_SOURCE_PRIORITY[left.source.id] ?? 100 + left.index)
      - (MATERIALIZATION_SOURCE_PRIORITY[right.source.id] ?? 100 + right.index)
    ))
    .map(({ source }) => source);
}

function buildStableSourceIdentity(
  row: EvidenceCoverageRow,
  sourceId: EvidenceSourceId,
  evidenceSubtype: string,
  actionType: string,
) {
  const payload = readRecord(row.eventData);

  if (sourceId === 'StudentStepResponse') {
    const sourceLogId = readString(payload.sourceLogId);
    if (sourceLogId) {
      return `historical:InteractionLog:${sourceLogId}:${actionType}`;
    }
  }

  return `historical:${sourceId}:${row.id}:${evidenceSubtype}`;
}

function resolveTimeSpent(payload: Record<string, unknown>) {
  const durationSeconds = readNumber(payload.durationSeconds);
  if (durationSeconds !== undefined) return Math.round(durationSeconds);
  return deriveFactTimeSpent(payload);
}

function buildFactInput(
  row: EvidenceCoverageRow,
  sourceId: EvidenceSourceId,
  stableSourceIdentity: string,
  evidenceSubtype: string,
  actionType: string,
  traceReference: string,
  originalTimestamp: string,
  provenance: EvidenceProvenance,
  valueLevel: EvidenceValueLevel,
  confidence: HistoricalEvidenceConfidence,
  canonicalEventType: string | undefined,
): Prisma.LearningFactCreateManyInput | null {
  const userId = readString(row.userId);
  if (!userId) return null;

  const payload = readRecord(row.eventData);
  const score = deriveFactScore(payload);
  const contextJson = compactJsonObject({
    historicalMaterialization: compactJsonObject({
      sourceId,
      sourceRecordId: row.id,
      stableSourceIdentity,
      evidenceSubtype,
      canonicalEventType,
      originalTimestamp,
      traceReference,
      provenance,
      valueLevel,
      confidence,
    }),
  });

  return {
    userId,
    factType: mapActionTypeToFactType(actionType),
    moduleId: readString(payload.moduleId) ?? readString(payload.taskId) ?? readString(payload.stepId),
    sessionId: readString(payload.sessionId),
    startedAt: new Date(originalTimestamp),
    finishedAt: new Date(originalTimestamp),
    outcome: deriveFactOutcome(actionType, payload),
    score,
    timeSpent: resolveTimeSpent(payload),
    competencyContribution: resolveCompetencyContribution(actionType, payload) as Prisma.InputJsonValue,
    sourceEventId: stableSourceIdentity,
    sourceLogId: sourceId === 'InteractionLog' ? row.id : readString(payload.sourceLogId),
    courseId: readString(payload.courseId),
    lessonId: readString(payload.lessonId) ?? readString(payload.lessonKey),
    contextJson,
  };
}

function classifySkipReason(
  classification: ReturnType<typeof classifyEvidenceRow>,
) {
  if (classification.provenance === 'unknown') return 'unknown_provenance';
  return classification.exclusionReason ?? classification.eligibility;
}

function shouldTreatAsUnsupported(classification: ReturnType<typeof classifyEvidenceRow>) {
  return classification.eligibility === 'unsupported'
    || classification.materializationReadiness === 'future'
    || classification.sourceId === 'LearningFact';
}

export function buildHistoricalEvidenceMaterializationPlan(
  input: BuildHistoricalEvidenceMaterializationPlanInput,
): HistoricalEvidenceMaterializationPlan {
  const existingSourceEventIds = input.existingSourceEventIds ?? new Set<string>();
  const candidates: HistoricalEvidenceMaterializationCandidate[] = [];
  const skipped: HistoricalEvidenceMaterializationSkip[] = [];
  const sources: HistoricalEvidenceMaterializationSourceSummary[] = [];
  const seenStableSourceIdentities = new Set<string>();

  for (const source of getMaterializationSources()) {
    const rows = input.rowsBySource[source.id] ?? [];
    const sourceCandidates: HistoricalEvidenceMaterializationCandidate[] = [];
    const sourceSkipped: HistoricalEvidenceMaterializationSkip[] = [];
    const affectedUsers = new Set<string>();
    const timestamps: string[] = [];
    const samples: string[] = [];

    for (const row of rows) {
      const traceReference = buildTraceReference(source.id, row.id);
      if (samples.length < 5) samples.push(traceReference);

      const timestamp = normalizeDate(row.occurredAt);
      if (timestamp) timestamps.push(timestamp);

      const classification = classifyEvidenceRow({ ...row, sourceId: source.id });
      const userId = readString(row.userId);
      const skipBase = {
        sourceId: source.id,
        sourceRecordId: row.id,
        traceReference,
        provenance: classification.provenance,
        eligibility: classification.eligibility,
        valueLevel: classification.valueLevel,
        userId,
        canonicalEventType: classification.canonicalEventType,
      };

      if (shouldTreatAsUnsupported(classification)) {
        sourceSkipped.push({
          ...skipBase,
          reason: source.id === 'LearningFact'
            ? 'already_materialized_source'
            : classification.exclusionReason ?? 'source_not_profile_ready',
        });
        continue;
      }

      if (classification.eligibility !== 'eligible') {
        sourceSkipped.push({
          ...skipBase,
          reason: classification.exclusionReason ?? classification.eligibility,
        });
        continue;
      }

      if (classification.provenance === 'unknown') {
        sourceSkipped.push({
          ...skipBase,
          reason: classifySkipReason(classification),
        });
        continue;
      }

      if (!userId || !timestamp) {
        sourceSkipped.push({
          ...skipBase,
          reason: !userId ? 'missing_user_id' : 'missing_source_timestamp',
        });
        continue;
      }

      const evidenceSubtype = resolveEvidenceSubtype(source.id, classification.canonicalEventType);
      const actionType = resolveActionType(source.id, evidenceSubtype);
      const stableSourceIdentity = buildStableSourceIdentity(
        row,
        source.id,
        evidenceSubtype,
        actionType,
      );

      if (seenStableSourceIdentities.has(stableSourceIdentity)) {
        sourceSkipped.push({
          ...skipBase,
          reason: 'duplicate_canonical_source',
        });
        continue;
      }

      const fact = buildFactInput(
        row,
        source.id,
        stableSourceIdentity,
        evidenceSubtype,
        actionType,
        traceReference,
        timestamp,
        classification.provenance,
        classification.valueLevel,
        'high',
        classification.canonicalEventType,
      );

      if (!fact) {
        sourceSkipped.push({
          ...skipBase,
          reason: 'missing_fact_input',
        });
        continue;
      }

      seenStableSourceIdentities.add(stableSourceIdentity);

      const candidate: HistoricalEvidenceMaterializationCandidate = {
        sourceId: source.id,
        sourceRecordId: row.id,
        stableSourceIdentity,
        evidenceSubtype,
        traceReference,
        userId,
        occurredAt: timestamp,
        provenance: classification.provenance,
        valueLevel: classification.valueLevel,
        eligibility: classification.eligibility,
        confidence: 'high',
        alreadyMaterialized: existingSourceEventIds.has(stableSourceIdentity),
        canonicalEventType: classification.canonicalEventType,
        fact,
      };
      sourceCandidates.push(candidate);
      affectedUsers.add(userId);
    }

    candidates.push(...sourceCandidates);
    skipped.push(...sourceSkipped);

    const sortedTimestamps = [...timestamps].sort();
    sources.push({
      sourceId: source.id,
      totalRows: rows.length,
      candidateRows: sourceCandidates.length,
      newFactRows: sourceCandidates.filter((candidate) => !candidate.alreadyMaterialized).length,
      alreadyMaterializedRows: sourceCandidates.filter((candidate) => candidate.alreadyMaterialized).length,
      excludedRows: sourceSkipped.filter((entry) => entry.reason !== 'unknown_provenance' && entry.eligibility !== 'unsupported').length,
      unsupportedRows: sourceSkipped.filter((entry) => entry.eligibility === 'unsupported').length,
      lowConfidenceRows: sourceSkipped.filter((entry) => entry.reason === 'unknown_provenance').length,
      affectedUsers: affectedUsers.size,
      firstObservedAt: sortedTimestamps[0] ?? null,
      lastObservedAt: sortedTimestamps[sortedTimestamps.length - 1] ?? null,
      sampleTraceReferences: samples,
    });
  }

  const allAffectedUsers = new Set(candidates.map((candidate) => candidate.userId));
  const totals = sources.reduce(
    (accumulator, source) => ({
      totalRows: accumulator.totalRows + source.totalRows,
      candidateRows: accumulator.candidateRows + source.candidateRows,
      newFactRows: accumulator.newFactRows + source.newFactRows,
      alreadyMaterializedRows: accumulator.alreadyMaterializedRows + source.alreadyMaterializedRows,
      excludedRows: accumulator.excludedRows + source.excludedRows,
      unsupportedRows: accumulator.unsupportedRows + source.unsupportedRows,
      lowConfidenceRows: accumulator.lowConfidenceRows + source.lowConfidenceRows,
      affectedUsers: allAffectedUsers.size,
    }),
    {
      totalRows: 0,
      candidateRows: 0,
      newFactRows: 0,
      alreadyMaterializedRows: 0,
      excludedRows: 0,
      unsupportedRows: 0,
      lowConfidenceRows: 0,
      affectedUsers: 0,
    },
  );

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    mode: 'dry-run',
    candidates,
    skipped,
    sources,
    totals,
  };
}

export async function applyHistoricalEvidenceMaterializationPlan(
  db: { learningFact: LearningFactCreateManyDelegate },
  plan: HistoricalEvidenceMaterializationPlan,
): Promise<HistoricalEvidenceMaterializationApplyResult> {
  const factsToCreate = plan.candidates
    .filter((candidate) => !candidate.alreadyMaterialized)
    .map((candidate) => candidate.fact);

  const result = factsToCreate.length > 0
    ? await db.learningFact.createMany({
        data: factsToCreate,
        skipDuplicates: true,
      })
    : { count: 0 };

  return {
    candidateRows: plan.totals.candidateRows,
    alreadyMaterializedRows: plan.totals.alreadyMaterializedRows,
    requestedCreateRows: factsToCreate.length,
    createdRows: result.count,
    skippedRows: plan.totals.excludedRows + plan.totals.unsupportedRows + plan.totals.lowConfidenceRows,
    affectedUsers: plan.totals.affectedUsers,
  };
}
