import {
  evaluateAssessmentEvidenceSnapshotWithCurrentCatalogAuthority,
  type AssessmentEvidenceCatalogSnapshot,
} from '@/features/assessment/assessment-evidence-authority';
import {
  findAdaptiveAssessmentCatalogSnapshot,
  findGeneratedRuntimeQuestionById,
  type AdaptiveAssessmentCatalogSnapshot,
} from '@/features/assessment/adaptive-assessment-catalog-selector';
import { checkpointAuthoredQuestionRuntimeId } from '@/features/assessment/learning-goal-checkpoint-question-sets';
import { getAdaptiveQuestionById } from '@/features/assessment/adaptive-engine';
import { ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION } from '@/features/assessment/adaptive-mastery';

import {
  GIT_SHA,
  planMicroTutoringTeachingResourceSync,
  type MicroTutoringTeachingResourceSyncIssue,
  type MicroTutoringTeachingResourceSyncPlan,
  type TeachingResourceSyncRow,
} from './micro-tutoring-teaching-resource-sync';
import {
  MICRO_TUTORING_VALIDATION_REGISTRY_V2_VERSION,
  loadMicroTutoringValidationRegistry,
  microTutoringValidationQuestionIds,
  type MicroTutoringValidationRegistryEntry,
} from './micro-tutoring-validation-registry';
import type { RemediationValidationItemRow } from './remediation-orchestration';

export const MICRO_TUTORING_VALIDATION_ITEM_REF_SYNC_VERSION = 'micro-tutoring-validation-item-ref-sync.v1';

export type MicroTutoringValidationItemRefSyncIssueCode =
  | 'REGISTRY_INVALID'
  | 'CATALOG_MISSING'
  | 'CATALOG_AUTHORITY_UNAVAILABLE'
  | 'CONTENT_HASH_DRIFT'
  | 'VERSION_DRIFT'
  | 'ACCESS_REVOKED'
  | 'IDENTITY_CONFLICT'
  | 'GIT_DIRTY'
  | 'CAPTURE_REVISION_INVALID';

export interface ValidationItemRefSyncRow {
  id: string;
  questionId: string;
  contentHash: string;
  algorithmVersion: string;
  source: string;
  questionType: string;
  domains: string[];
  knowledgeTags: string[];
  difficulty: number;
  optionCount: number;
  metadata: unknown;
}

export interface MicroTutoringValidationItemRefSyncIssue {
  code: MicroTutoringValidationItemRefSyncIssueCode;
  ref: string;
}

export interface MicroTutoringValidationItemRefSyncEntry {
  action: 'create' | 'unchanged';
  id: string;
  sourceId: string;
  questionId: string;
  contentHash: string;
  itemRevision: string;
  catalogItemId: string;
  algorithmVersion: typeof ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION;
  source: string;
  questionType: string;
  domains: string[];
  knowledgeTags: string[];
  difficulty: number;
  optionCount: number;
  metadata: Record<string, unknown>;
}

export type MicroTutoringValidationItemRefSyncPlan =
  | {
    ok: true;
    captureRevision: string;
    projectionVersion: typeof MICRO_TUTORING_VALIDATION_REGISTRY_V2_VERSION;
    entries: MicroTutoringValidationItemRefSyncEntry[];
  }
  | {
    ok: false;
    issues: MicroTutoringValidationItemRefSyncIssue[];
  };

export type MicroTutoringV2DatabaseSyncPlan =
  | {
    ok: true;
    captureRevision: string;
    teaching: Extract<MicroTutoringTeachingResourceSyncPlan, { ok: true }>;
    validation: Extract<MicroTutoringValidationItemRefSyncPlan, { ok: true }>;
  }
  | {
    ok: false;
    teachingIssues: MicroTutoringTeachingResourceSyncIssue[];
    validationIssues: MicroTutoringValidationItemRefSyncIssue[];
  };

type CatalogLookup = (questionId: string) => AdaptiveAssessmentCatalogSnapshot | null;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim()))].sort();
}

function catalogVersion(snapshot: AdaptiveAssessmentCatalogSnapshot | null, stored?: unknown): string | null {
  const fromCatalog = snapshot?.versionRefs.adaptiveAssessmentSnapshotVersion;
  if (typeof fromCatalog === 'string' && fromCatalog.trim()) return fromCatalog.trim();
  if (typeof stored === 'string' && stored.trim()) return stored.trim();
  return null;
}

function catalogBackedItemRefMetadata(snapshot: AdaptiveAssessmentCatalogSnapshot): Record<string, unknown> {
  return {
    catalogBacked: true,
    snapshotVersion: snapshot.versionRefs.adaptiveAssessmentSnapshotVersion ?? 'adaptive-assessment-item-ref.v1',
    catalogItemId: snapshot.catalogItemId,
    sourceFamily: snapshot.sourceFamily,
    sourceId: snapshot.sourceId,
    sourceAnchor: snapshot.sourceAnchor,
    sourceLineage: snapshot.sourceLineage,
    contentHash: snapshot.contentHash,
    contentHashAlgorithm: snapshot.contentHashAlgorithm,
    reviewState: snapshot.reviewState,
    eligibilityState: snapshot.eligibilityState,
    allowedStages: snapshot.allowedStages,
    questionRefs: snapshot.questionRefs,
    semanticRefs: snapshot.semanticRefs,
    limitations: snapshot.limitations,
    reviewDecision: snapshot.reviewDecision,
    versionRefs: snapshot.versionRefs,
    relationship: snapshot.relationship,
    catalogUpdatesRewriteHistoricalAnswers: false,
  };
}

function catalogMastery(
  stored: Record<string, unknown> | null,
  current: AdaptiveAssessmentCatalogSnapshot | null,
): boolean {
  return evaluateAssessmentEvidenceSnapshotWithCurrentCatalogAuthority(
    stored as unknown as AssessmentEvidenceCatalogSnapshot,
    current as unknown as AssessmentEvidenceCatalogSnapshot,
    {},
  ).mastery;
}

function resolveQuestionFields(
  sourceId: string,
  snapshot: AdaptiveAssessmentCatalogSnapshot,
  entry: MicroTutoringValidationRegistryEntry,
) {
  const question = getAdaptiveQuestionById(sourceId)
    ?? getAdaptiveQuestionById(checkpointAuthoredQuestionRuntimeId(sourceId))
    ?? findGeneratedRuntimeQuestionById(sourceId);
  const catalogOptions = snapshot.questionRefs.options ?? [];
  const optionCount = question?.options.length
    ?? catalogOptions.filter((option) => typeof option.key === 'string' && option.key.trim().length > 0).length;
  return {
    source: snapshot.sourceFamily,
    questionType: question?.type ?? 'multi-criteria',
    domains: question?.domains ?? ['time'],
    knowledgeTags: uniqueSorted(question?.knowledgeTags ?? snapshot.semanticRefs.knowledgeTags ?? []),
    difficulty: question?.difficulty ?? snapshot.semanticRefs.difficulty ?? entry.difficulty,
    optionCount,
  };
}

function classifyExistingRow(input: {
  row: ValidationItemRefSyncRow;
  entry: MicroTutoringValidationRegistryEntry;
  findCatalogSnapshot: CatalogLookup;
}): MicroTutoringValidationItemRefSyncIssue | null {
  const metadata = asRecord(input.row.metadata);
  const stored = asRecord(metadata?.adaptiveAssessmentItemRef);
  const validation = asRecord(metadata?.remediationValidation);
  if (validation?.learnerVisible === false) {
    return { code: 'ACCESS_REVOKED', ref: input.entry.sourceId };
  }
  const current = input.findCatalogSnapshot(input.row.questionId)
    ?? input.findCatalogSnapshot(input.entry.sourceId);
  if (!current) {
    return { code: 'CATALOG_MISSING', ref: input.entry.sourceId };
  }
  if (current.contentHash !== input.entry.contentHash || input.row.contentHash !== input.entry.contentHash) {
    return { code: 'CONTENT_HASH_DRIFT', ref: input.entry.sourceId };
  }
  if (typeof stored?.contentHash === 'string' && stored.contentHash !== input.entry.contentHash) {
    return { code: 'CONTENT_HASH_DRIFT', ref: input.entry.sourceId };
  }
  const version = catalogVersion(current, stored?.snapshotVersion);
  if (version !== input.entry.snapshotVersion) {
    return { code: 'VERSION_DRIFT', ref: input.entry.sourceId };
  }
  if (!catalogMastery(stored, current)) {
    return { code: 'IDENTITY_CONFLICT', ref: input.entry.sourceId };
  }
  return null;
}

export function planMicroTutoringValidationItemRefSync(input: {
  existingRows: ValidationItemRefSyncRow[];
  captureRevision: string;
  dirty?: boolean;
  registry?: unknown;
  optionAttributions?: unknown;
  practiceBaseline?: unknown;
  findCatalogSnapshot?: CatalogLookup;
}): MicroTutoringValidationItemRefSyncPlan {
  if (input.dirty) {
    return { ok: false, issues: [{ code: 'GIT_DIRTY', ref: 'git-worktree' }] };
  }
  if (!GIT_SHA.test(input.captureRevision)) {
    return { ok: false, issues: [{ code: 'CAPTURE_REVISION_INVALID', ref: 'captureRevision' }] };
  }

  const loaded = loadMicroTutoringValidationRegistry(
    input.registry,
    input.optionAttributions,
    input.practiceBaseline,
  );
  if (!loaded.registry || loaded.issues.length > 0) {
    return {
      ok: false,
      issues: [{
        code: 'REGISTRY_INVALID',
        ref: loaded.issues[0]?.ref ?? 'registry',
      }],
    };
  }

  const findCatalogSnapshot = input.findCatalogSnapshot ?? findAdaptiveAssessmentCatalogSnapshot;
  const issues: MicroTutoringValidationItemRefSyncIssue[] = [];
  const entries: MicroTutoringValidationItemRefSyncEntry[] = [];

  for (const entry of loaded.registry.entries) {
    if (!entry.enabled) continue;
    const snapshot = findCatalogSnapshot(entry.sourceId);
    if (!snapshot) {
      issues.push({ code: 'CATALOG_MISSING', ref: entry.sourceId });
      continue;
    }
    if (snapshot.contentHash !== entry.contentHash || entry.studentQuestionRef.contentHash !== snapshot.contentHash) {
      issues.push({ code: 'CONTENT_HASH_DRIFT', ref: entry.sourceId });
      continue;
    }
    const version = catalogVersion(snapshot);
    if (version !== entry.snapshotVersion) {
      issues.push({ code: 'VERSION_DRIFT', ref: entry.sourceId });
      continue;
    }
    if (!catalogMastery(catalogBackedItemRefMetadata(snapshot), snapshot)) {
      issues.push({ code: 'CATALOG_AUTHORITY_UNAVAILABLE', ref: entry.sourceId });
      continue;
    }
    const fields = resolveQuestionFields(entry.sourceId, snapshot, entry);
    if (fields.optionCount < 1) {
      issues.push({ code: 'CATALOG_MISSING', ref: entry.sourceId });
      continue;
    }

    const identityIds = new Set(microTutoringValidationQuestionIds(entry.sourceId));
    const matches = input.existingRows.filter((row) =>
      row.algorithmVersion === ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION
      && identityIds.has(row.questionId)
      && row.contentHash === entry.contentHash);
    if (matches.length > 0) {
      const matchIssues = matches
        .map((row) => classifyExistingRow({ row, entry, findCatalogSnapshot }))
        .filter((issue): issue is MicroTutoringValidationItemRefSyncIssue => issue !== null);
      if (matchIssues.length > 0) {
        issues.push(matchIssues[0]!);
        continue;
      }
      const existing = matches[0]!;
      entries.push({
        action: 'unchanged',
        id: existing.id,
        sourceId: entry.sourceId,
        questionId: existing.questionId,
        contentHash: existing.contentHash,
        itemRevision: entry.itemRevision,
        catalogItemId: entry.catalogItemId,
        algorithmVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
        source: existing.source,
        questionType: existing.questionType,
        domains: [...existing.domains],
        knowledgeTags: [...existing.knowledgeTags],
        difficulty: existing.difficulty,
        optionCount: existing.optionCount,
        metadata: asRecord(existing.metadata) ?? {},
      });
      continue;
    }

    const metadata = {
      adaptiveAssessmentItemRef: catalogBackedItemRefMetadata(snapshot),
      remediationValidation: {
        learnerVisible: true,
        itemRevision: entry.itemRevision,
        estimatedMinutes: entry.estimatedMinutes,
        actionPath: entry.actionPath,
        captureRevision: input.captureRevision,
        projectionVersion: MICRO_TUTORING_VALIDATION_REGISTRY_V2_VERSION,
        syncVersion: MICRO_TUTORING_VALIDATION_ITEM_REF_SYNC_VERSION,
        knowledgeNodeId: entry.knowledgeNodeId,
        misconceptionTags: uniqueSorted(entry.relations.map((relation) => relation.misconceptionTag)),
      },
    };
    entries.push({
      action: 'create',
      id: `micro-tutoring-item-ref:${entry.sourceId}:${entry.contentHash}`,
      sourceId: entry.sourceId,
      questionId: entry.sourceId,
      contentHash: entry.contentHash,
      itemRevision: entry.itemRevision,
      catalogItemId: entry.catalogItemId,
      algorithmVersion: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
      source: fields.source,
      questionType: fields.questionType,
      domains: fields.domains,
      knowledgeTags: fields.knowledgeTags,
      difficulty: fields.difficulty,
      optionCount: fields.optionCount,
      metadata,
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return {
    ok: true,
    captureRevision: input.captureRevision,
    projectionVersion: MICRO_TUTORING_VALIDATION_REGISTRY_V2_VERSION,
    entries,
  };
}

export function applyMicroTutoringValidationItemRefSyncPlan(
  existingRows: ValidationItemRefSyncRow[],
  plan: Extract<MicroTutoringValidationItemRefSyncPlan, { ok: true }>,
): ValidationItemRefSyncRow[] {
  const rows = new Map(existingRows.map((row) => [row.id, {
    ...row,
    domains: [...row.domains],
    knowledgeTags: [...row.knowledgeTags],
  }]));
  for (const entry of plan.entries) {
    if (entry.action !== 'create') continue;
    rows.set(entry.id, {
      id: entry.id,
      questionId: entry.questionId,
      contentHash: entry.contentHash,
      algorithmVersion: entry.algorithmVersion,
      source: entry.source,
      questionType: entry.questionType,
      domains: [...entry.domains],
      knowledgeTags: [...entry.knowledgeTags],
      difficulty: entry.difficulty,
      optionCount: entry.optionCount,
      metadata: entry.metadata,
    });
  }
  return [...rows.values()].sort((left, right) => left.id.localeCompare(right.id));
}

export function toRemediationValidationItemRow(row: ValidationItemRefSyncRow): RemediationValidationItemRow {
  return {
    id: row.id,
    questionId: row.questionId,
    contentHash: row.contentHash,
    metadata: row.metadata,
  };
}

export function planMicroTutoringV2DatabaseSync(input: {
  teachingResourceRows: TeachingResourceSyncRow[];
  existingKnowledgeNodeIds?: Iterable<string>;
  validationItemRows: ValidationItemRefSyncRow[];
  captureRevision: string;
  dirty?: boolean;
}): MicroTutoringV2DatabaseSyncPlan {
  const teaching = planMicroTutoringTeachingResourceSync({
    existingRows: input.teachingResourceRows,
    existingKnowledgeNodeIds: input.existingKnowledgeNodeIds,
    captureRevision: input.captureRevision,
    dirty: input.dirty,
  });
  const validation = planMicroTutoringValidationItemRefSync({
    existingRows: input.validationItemRows,
    captureRevision: input.captureRevision,
    dirty: input.dirty,
  });
  if (!teaching.ok || !validation.ok) {
    return {
      ok: false,
      teachingIssues: teaching.ok ? [] : teaching.issues,
      validationIssues: validation.ok ? [] : validation.issues,
    };
  }
  return {
    ok: true,
    captureRevision: input.captureRevision,
    teaching,
    validation,
  };
}
