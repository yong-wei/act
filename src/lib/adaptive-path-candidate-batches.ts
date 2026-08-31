import { createHash } from 'node:crypto';

import {
  buildSerializablePathOptions,
  type AdaptiveLearningPathPlan,
} from '@/features/personalization/path-planning/public-api';

export interface AdaptivePathCandidateSnapshot {
  id: string;
  fingerprint: string;
  ordinal: number;
  styleId: string;
  policyFamily: string | null;
  label: string;
  snapshot: Record<string, unknown>;
}

export interface AdaptivePathCandidateBatchView {
  id: string;
  userId: string;
  goalId: string;
  classId: string | null;
  generationRequestId: string;
  sourcePathId: string;
  plannerVersion: string | null;
  status: 'succeeded';
  createdAt: string;
  metadata: Record<string, unknown>;
  candidates: AdaptivePathCandidateSnapshot[];
}

export interface AdaptivePathCandidateBatchDerivation {
  kind: 'adjustment';
  sourceBatchId: string;
  sourceCandidateId: string;
  sourceCandidateFingerprint: string;
  activeProgressVersion: string;
  requestSnapshot: Record<string, unknown>;
  differenceSummary: AdaptivePathCandidateDifferenceSummary;
}

export interface AdaptivePathCandidateBatchPersistenceInput {
  generationRequestId: string;
  plan: AdaptiveLearningPathPlan;
  classId?: string | null;
  derivation?: AdaptivePathCandidateBatchDerivation;
}

export interface AdaptivePathCandidateDifferenceSummary {
  sourceCandidateId: string;
  sourceCandidateFingerprint: string;
  material: boolean;
  candidates: Array<{
    ordinal: number;
    styleId: string;
    changedFields: string[];
  }>;
}

export type AdaptivePathCandidateSelectionResolution =
  | { status: 'selected'; batchId: string; candidateId: string; candidate: AdaptivePathCandidateSnapshot }
  | { status: 'clarification_required'; batchId: string; alternatives: Array<{ candidateId: string; label: string }>; question: string }
  | { status: 'unresolved'; batchId: string }
  | { status: 'unavailable' };

interface CandidateBatchRecord {
  id: string;
  userId: string;
  goalId: string;
  classId: string | null;
  generationRequestId: string;
  sourcePathId: string;
  plannerVersion: string | null;
  status: string;
  createdAt: Date;
  metadata: unknown;
  candidates: Array<{
    id: string;
    ordinal: number;
    styleId: string;
    policyFamily: string | null;
    label: string;
    snapshot: unknown;
  }>;
}

export interface AdaptivePathCandidateBatchDb {
  adaptivePathCandidateBatch: {
    findUnique(args: unknown): Promise<CandidateBatchRecord | null>;
    findFirst(args: unknown): Promise<CandidateBatchRecord | null>;
    create(args: unknown): Promise<CandidateBatchRecord>;
  };
  $transaction?<T>(callback: (tx: AdaptivePathCandidateBatchDb) => Promise<T>): Promise<T>;
}

export class AdaptivePathCandidateBatchConflictError extends Error {}
export class AdaptivePathCandidateBatchValidationError extends Error {}

export async function persistAdaptivePathCandidateBatch(
  db: AdaptivePathCandidateBatchDb,
  input: AdaptivePathCandidateBatchPersistenceInput,
): Promise<AdaptivePathCandidateBatchView> {
  validatePersistenceInput(input.generationRequestId, input.plan);
  const existing = await findByGenerationRequest(db, input.generationRequestId);
  if (existing) return assertMatchingExisting(existing, input);

  const create = async (tx: AdaptivePathCandidateBatchDb) => {
    const raced = await findByGenerationRequest(tx, input.generationRequestId);
    if (raced) return assertMatchingExisting(raced, input);
    const batchId = stableId('path-candidate-batch', input.generationRequestId);
    const gated = buildGatedCandidateSnapshots(input.plan, batchId);
    const candidates = gated.candidates;
    const record = await tx.adaptivePathCandidateBatch.create({
      data: {
        id: batchId,
        userId: input.plan.userId,
        goalId: input.plan.goal.id,
        classId: input.classId ?? null,
        generationRequestId: input.generationRequestId,
        sourcePathId: input.plan.id,
        plannerVersion: input.plan.stage,
        status: 'succeeded',
        candidateCount: candidates.length,
        metadata: jsonSnapshot({
          planStatus: input.plan.status,
          stage: input.plan.stage,
          policyFamily: input.plan.policyFamily,
          confidence: input.plan.confidence,
          excludedPolicyFamilies: input.plan.excludedPolicyFamilies,
          decisionEvidence: input.plan.policyBundle?.decisionEvidence ?? null,
          diversityLimitations: gated.limitations,
          ...(input.derivation ? {
            derivation: {
              ...input.derivation,
              requestSnapshot: jsonSnapshot(input.derivation.requestSnapshot),
              requestFingerprint: fingerprintAdjustmentRequestSnapshot(input.derivation.requestSnapshot),
            },
          } : {}),
        }),
        candidates: {
          create: candidates.map((candidate) => ({
            id: candidate.id,
            ordinal: candidate.ordinal,
            styleId: candidate.styleId,
            policyFamily: candidate.policyFamily,
            label: candidate.label,
            snapshot: candidate.snapshot,
          })),
        },
      },
      include: { candidates: { orderBy: { ordinal: 'asc' } } },
    });
    return toBatchView(record);
  };

  try {
    return db.$transaction ? await db.$transaction(create) : await create(db);
  } catch (error) {
    const raced = await findByGenerationRequest(db, input.generationRequestId);
    if (raced) return assertMatchingExisting(raced, input);
    throw error;
  }
}

export function buildCandidateSnapshots(
  plan: AdaptiveLearningPathPlan,
  batchId: string,
): AdaptivePathCandidateSnapshot[] {
  return buildGatedCandidateSnapshots(plan, batchId).candidates;
}

export function buildGatedCandidateSnapshots(
  plan: AdaptiveLearningPathPlan,
  batchId: string,
): { candidates: AdaptivePathCandidateSnapshot[]; limitations: string[] } {
  const serializedCandidates = buildSerializablePathOptions(plan)
    .filter((candidate) => candidate.nodeIds.length > 0);
  const executableCandidates = serializedCandidates.length > 0
    ? serializedCandidates
    : buildSerializablePathOptions({ ...plan, policyBundle: undefined });
  const candidates = executableCandidates
    .map((candidate) => ({
      styleId: candidate.styleId,
      policyFamily: candidate.policyFamily,
      label: candidate.label,
      snapshot: candidate as unknown as Record<string, unknown>,
    }));
  if (candidates.length === 0) {
    throw new AdaptivePathCandidateBatchValidationError('Candidate batch requires at least one executable candidate');
  }
  const ungated = candidates.map((candidate, ordinal) => {
    const snapshot = candidate.snapshot as Record<string, unknown>;
    return {
      id: stableId('path-candidate', `${batchId}:${candidate.styleId}:${ordinal}`),
      fingerprint: fingerprintAdaptivePathCandidateSnapshot(snapshot),
      ordinal,
      styleId: candidate.styleId,
      policyFamily: candidate.policyFamily,
      label: candidate.label,
      snapshot: jsonSnapshot({
        ...snapshot,
        optionId: typeof snapshot.optionId === 'string'
          ? snapshot.optionId
          : `path-option-${ordinal + 1}`,
      }),
    };
  });
  return gateMateriallyDistinctCandidates(ungated);
}

export function gateMateriallyDistinctCandidates(
  candidates: AdaptivePathCandidateSnapshot[],
): { candidates: AdaptivePathCandidateSnapshot[]; limitations: string[] } {
  const seen = new Set<string>();
  const kept: AdaptivePathCandidateSnapshot[] = [];
  let duplicateCount = 0;
  for (const candidate of candidates) {
    if (seen.has(candidate.fingerprint)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(candidate.fingerprint);
    kept.push({
      ...candidate,
      ordinal: kept.length,
    });
  }
  const limitations = limitationsForReduction(duplicateCount, candidates.length, kept.length);
  return {
    candidates: kept.map((candidate) => ({
      ...candidate,
      snapshot: {
        ...candidate.snapshot,
        limitations: uniqueStrings([
          ...stringArray(candidate.snapshot.limitations),
          ...limitations,
        ]),
      },
    })),
    limitations,
  };
}

function limitationsForReduction(duplicateCount: number, originalCount: number, keptCount: number): string[] {
  const limitations: string[] = [];
  if (duplicateCount > 0) limitations.push('title-or-score-only-duplicates-removed');
  if (keptCount < 2) limitations.push('insufficient-distinct-resources');
  if (originalCount > 0 && keptCount < originalCount && !limitations.includes('title-or-score-only-duplicates-removed')) {
    limitations.push('insufficient-distinct-resources');
  }
  return limitations;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function toBatchView(record: CandidateBatchRecord): AdaptivePathCandidateBatchView {
  if (record.status !== 'succeeded') {
    throw new AdaptivePathCandidateBatchValidationError('Only successful candidate batches can be projected');
  }
  return {
    id: record.id,
    userId: record.userId,
    goalId: record.goalId,
    classId: record.classId,
    generationRequestId: record.generationRequestId,
    sourcePathId: record.sourcePathId,
    plannerVersion: record.plannerVersion,
    status: 'succeeded',
    createdAt: record.createdAt.toISOString(),
    metadata: jsonSnapshot(record.metadata),
    candidates: [...record.candidates]
      .sort((left, right) => left.ordinal - right.ordinal)
      .map((candidate) => ({
        id: candidate.id,
        fingerprint: fingerprintAdaptivePathCandidateSnapshot(candidate.snapshot),
        ordinal: candidate.ordinal,
        styleId: candidate.styleId,
        policyFamily: candidate.policyFamily,
        label: candidate.label,
        snapshot: jsonSnapshot(candidate.snapshot),
      })),
  };
}

export function fingerprintAdaptivePathCandidateSnapshot(snapshot: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(readMaterialCandidateFacts(snapshot)))
    .digest('hex');
}

export function buildAdaptivePathCandidateDifferenceSummary(
  sourceCandidate: AdaptivePathCandidateSnapshot,
  plan: AdaptiveLearningPathPlan,
): AdaptivePathCandidateDifferenceSummary {
  const sourceFacts = readMaterialCandidateFacts(sourceCandidate.snapshot);
  const candidates = buildCandidateSnapshots(plan, 'adjustment-preview').map((candidate) => {
    const candidateFacts = readMaterialCandidateFacts(candidate.snapshot);
    const changedFields = (Object.keys(sourceFacts) as Array<keyof typeof sourceFacts>)
      .filter((field) => JSON.stringify(sourceFacts[field]) !== JSON.stringify(candidateFacts[field]));
    return {
      ordinal: candidate.ordinal,
      styleId: candidate.styleId,
      changedFields,
    };
  });
  return {
    sourceCandidateId: sourceCandidate.id,
    sourceCandidateFingerprint: sourceCandidate.fingerprint,
    material: candidates.some((candidate) => candidate.changedFields.length > 0),
    candidates,
  };
}

async function findByGenerationRequest(
  db: AdaptivePathCandidateBatchDb,
  generationRequestId: string,
): Promise<CandidateBatchRecord | null> {
  return db.adaptivePathCandidateBatch.findUnique({
    where: { generationRequestId },
    include: { candidates: { orderBy: { ordinal: 'asc' } } },
  });
}

export async function readAdaptivePathCandidateBatch(
  db: AdaptivePathCandidateBatchDb,
  batchId: string,
): Promise<AdaptivePathCandidateBatchView | null> {
  const record = await db.adaptivePathCandidateBatch.findUnique({
    where: { id: batchId },
    include: { candidates: { orderBy: { ordinal: 'asc' } } },
  });
  return record ? toBatchView(record) : null;
}

export async function readAdaptivePathCandidateBatchByGenerationRequest(
  db: AdaptivePathCandidateBatchDb,
  generationRequestId: string,
): Promise<AdaptivePathCandidateBatchView | null> {
  const record = await findByGenerationRequest(db, generationRequestId);
  return record ? toBatchView(record) : null;
}

export async function readLatestAdaptivePathCandidateBatch(
  db: AdaptivePathCandidateBatchDb,
  input: { userId: string; goalId: string; classId?: string | null },
): Promise<AdaptivePathCandidateBatchView | null> {
  const record = await db.adaptivePathCandidateBatch.findFirst({
    where: {
      userId: input.userId,
      goalId: input.goalId,
      status: 'succeeded',
      ...(input.classId ? { classId: input.classId } : {}),
    },
    include: { candidates: { orderBy: { ordinal: 'asc' } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  return record ? toBatchView(record) : null;
}

export function resolveAdaptivePathCandidateSelection(
  batch: AdaptivePathCandidateBatchView | null,
  input: { candidateId?: string | null; naturalLanguageIntent?: string | null },
): AdaptivePathCandidateSelectionResolution {
  if (!batch) return { status: 'unavailable' };
  if (input.candidateId) {
    const candidate = batch.candidates.find((item) => item.id === input.candidateId);
    return candidate
      ? { status: 'selected', batchId: batch.id, candidateId: candidate.id, candidate }
      : { status: 'unresolved', batchId: batch.id };
  }

  const intent = normalizeSelectionText(input.naturalLanguageIntent);
  if (!intent) return { status: 'unresolved', batchId: batch.id };
  const matches = batch.candidates.filter((candidate) => {
    const label = normalizeSelectionText(candidate.label);
    return Boolean(label && (intent === label || intent.includes(label)));
  });
  if (matches.length === 1) {
    const candidate = matches[0]!;
    return { status: 'selected', batchId: batch.id, candidateId: candidate.id, candidate };
  }
  if (matches.length > 1 || isAmbiguousSelectionIntent(intent)) {
    return {
      status: 'clarification_required',
      batchId: batch.id,
      alternatives: batch.candidates.map((candidate) => ({ candidateId: candidate.id, label: candidate.label })),
      question: '你想选择哪一条学习路径？',
    };
  }
  return { status: 'unresolved', batchId: batch.id };
}

function normalizeSelectionText(value: string | null | undefined): string {
  return value?.normalize('NFKC').trim().toLocaleLowerCase().replace(/[\s，。！？、,.!?]/gu, '') ?? '';
}

function isAmbiguousSelectionIntent(value: string): boolean {
  return [
    '这个', '那个', '这条', '那条', '推荐的', '你推荐的', '就它', '就这个', '选一个',
    '选第一个', '随便哪一个', '选你推荐的那条', '我都可以',
  ].includes(value);
}

function assertMatchingExisting(
  record: CandidateBatchRecord,
  input: AdaptivePathCandidateBatchPersistenceInput,
): AdaptivePathCandidateBatchView {
  assertAdaptivePathCandidateBatchMatchesInput(record, input);
  return toBatchView(record);
}

export function assertAdaptivePathCandidateBatchMatchesInput(
  record: Pick<
    AdaptivePathCandidateBatchView,
    'userId' | 'goalId' | 'classId' | 'generationRequestId' | 'sourcePathId'
  > & { metadata: unknown },
  input: AdaptivePathCandidateBatchPersistenceInput,
): void {
  if (
    record.generationRequestId !== input.generationRequestId ||
    record.userId !== input.plan.userId ||
    record.goalId !== input.plan.goal.id ||
    record.classId !== (input.classId ?? null) ||
    record.sourcePathId !== input.plan.id
  ) {
    throw new AdaptivePathCandidateBatchConflictError(
      'Generation request identity is already bound to another candidate batch',
    );
  }
  const existing = jsonSnapshot(jsonSnapshot(record.metadata).derivation);
  if (!input.derivation && Object.keys(existing).length === 0) return;
  const requestFingerprint = input.derivation
    ? fingerprintAdjustmentRequestSnapshot(input.derivation.requestSnapshot)
    : null;
  const existingRequestFingerprint = typeof existing.requestFingerprint === 'string'
    ? existing.requestFingerprint
    : null;
  const existingSnapshotFingerprint = fingerprintAdjustmentRequestSnapshot(existing.requestSnapshot);
  if (
    !input.derivation ||
    existing.kind !== input.derivation.kind ||
    existing.sourceBatchId !== input.derivation.sourceBatchId ||
    existing.sourceCandidateId !== input.derivation.sourceCandidateId ||
    existing.sourceCandidateFingerprint !== input.derivation.sourceCandidateFingerprint ||
    existing.activeProgressVersion !== input.derivation.activeProgressVersion ||
    !existingRequestFingerprint ||
    existingRequestFingerprint !== existingSnapshotFingerprint ||
    existingRequestFingerprint !== requestFingerprint
  ) {
    throw new AdaptivePathCandidateBatchConflictError(
      'Adjustment request identity is already bound to another candidate source or request',
    );
  }
}

function fingerprintAdjustmentRequestSnapshot(snapshot: unknown): string {
  return createHash('sha256').update(stableJson(snapshot)).digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function validatePersistenceInput(generationRequestId: string, plan: AdaptiveLearningPathPlan): void {
  if (!generationRequestId || generationRequestId.length > 160) {
    throw new AdaptivePathCandidateBatchValidationError('Generation request identity is invalid');
  }
  if (!plan.id || !plan.userId || !plan.goal?.id || plan.mainPath.length === 0) {
    throw new AdaptivePathCandidateBatchValidationError('Planner output is not persistable');
  }
}

function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash('sha256').update(value).digest('hex').slice(0, 24)}`;
}

function jsonSnapshot(value: unknown): Record<string, unknown> {
  const serialized = JSON.stringify(value);
  if (!serialized) return {};
  const normalized = JSON.parse(serialized) as unknown;
  return normalized && typeof normalized === 'object' && !Array.isArray(normalized)
    ? normalized as Record<string, unknown>
    : {};
}

function readMaterialCandidateFacts(value: unknown) {
  const snapshot = jsonSnapshot(value);
  return {
    nodeIds: stringArray(snapshot.nodeIds),
    estimatedMinutes: finiteNumber(snapshot.estimatedMinutes),
    resourceMix: sortedNumberRecord(snapshot.resourceMix),
    checkpointNodeIds: stringArray(snapshot.checkpointNodeIds),
    terminalValidationNodeIds: stringArray(snapshot.terminalValidationNodeIds),
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function sortedNumberRecord(value: unknown): Record<string, number> {
  const record = jsonSnapshot(value);
  return Object.fromEntries(Object.entries(record)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]))
    .sort(([left], [right]) => left.localeCompare(right)));
}
