import { createHash } from 'node:crypto';

import {
  checkpointAuthoredQuestionRuntimeId,
  sourceIdFromCheckpointAuthoredQuestionRuntimeId,
} from '@/features/adaptive-assessment/learning-goal-checkpoint-question-sets';

import { resolveMicroTutoringGoalNode } from './micro-tutoring-goal-node-catalog';
import { loadMicroTutoringRuntimeSource } from './micro-tutoring-runtime-source';

export const MICRO_TUTORING_VALIDATION_REGISTRY_VERSION = 'micro-tutoring-validation-registry.v1';
export const MICRO_TUTORING_VALIDATION_REGISTRY_SOURCE =
  'micro-tutoring-practice-baseline.v1+micro-tutoring-option-attributions.v2';
export const MICRO_TUTORING_VALIDATION_ESTIMATED_MINUTES = 2;
export const MICRO_TUTORING_VALIDATION_ACTION_PATH = '/assessment/adaptive-practice';
const GIT_REVISION = /^[a-f0-9]{40}$/u;

export type MicroTutoringValidationRegistryIssueCode =
  | 'REGISTRY_MALFORMED'
  | 'VERSION_DRIFT'
  | 'SOURCE_DRIFT'
  | 'BASELINE_DRIFT'
  | 'NODE_DOMAIN_INVALID'
  | 'DUPLICATE_ITEM'
  | 'DUPLICATE_CONTENT'
  | 'RELATION_UNKNOWN'
  | 'PURPOSE_INVALID'
  | 'DURATION_INVALID'
  | 'PRIVACY_INVALID'
  | 'INDEPENDENCE_INSUFFICIENT';

export interface MicroTutoringValidationRelation {
  misconceptionTag: string;
  rationale: string;
}

export interface MicroTutoringValidationPurposeDecision {
  kind: 'micro-tutoring-validation';
  reviewerId: string;
  reviewerRole: string;
  reviewedAt: string;
  reviewBatchId: string;
  independenceRationale: string;
  purposeRationale: string;
}

export interface MicroTutoringValidationStudentQuestionRef {
  catalogItemId: string;
  sourceId: string;
  contentHash: string;
  snapshotVersion: string;
}

export interface MicroTutoringValidationRegistryEntry {
  id: string;
  catalogItemId: string;
  sourceId: string;
  contentHash: string;
  itemRevision: string;
  learningGoalId: string;
  knowledgeNodeId: string;
  difficulty: number;
  estimatedMinutes: number;
  actionPath: string;
  privacyLevel: 'student-visible';
  enabled: boolean;
  snapshotVersion: string;
  itemReviewSourceHash: string;
  purposeDecision: MicroTutoringValidationPurposeDecision;
  studentQuestionRef: MicroTutoringValidationStudentQuestionRef;
  relations: MicroTutoringValidationRelation[];
  sourceRefs: string[];
}

export interface MicroTutoringValidationRegistry {
  version: string;
  source: string;
  sourceRevision: string;
  entries: MicroTutoringValidationRegistryEntry[];
}

export interface MicroTutoringValidationRegistryIssue {
  code: MicroTutoringValidationRegistryIssueCode;
  ref: string;
}

export interface LoadedMicroTutoringValidationRegistry {
  registry: MicroTutoringValidationRegistry | null;
  issues: MicroTutoringValidationRegistryIssue[];
}

export interface MicroTutoringGovernedValidationItem {
  id: string;
  questionId: string;
  contentHash: string;
  version: string;
  itemRevision: string;
  estimatedMinutes: number;
  actionPath: string;
}

export interface MicroTutoringValidationAuthorityRow {
  id: string;
  questionId: string;
  contentHash: string;
  metadata?: unknown;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function canonicalMicroTutoringQuestionId(questionId: string): string {
  const trimmed = questionId.trim();
  return sourceIdFromCheckpointAuthoredQuestionRuntimeId(trimmed) ?? trimmed;
}

export function microTutoringValidationQuestionIds(sourceId: string): string[] {
  const canonical = canonicalMicroTutoringQuestionId(sourceId);
  return uniqueSorted([canonical, checkpointAuthoredQuestionRuntimeId(canonical)]);
}

export function microTutoringValidationRelationSourceRef(input: {
  knowledgeNodeId: string;
  misconceptionTag: string;
}): string {
  const digest = sha256Hex(`${input.knowledgeNodeId}\0${input.misconceptionTag}`);
  return `micro-tutoring-option-attributions.v2#node:${input.knowledgeNodeId}#tag:${input.misconceptionTag}#sha256:${digest}`;
}

export function microTutoringValidationItemRevision(input: {
  catalogItemId: string;
  sourceId: string;
  contentHash: string;
  learningGoalId: string;
  knowledgeNodeId: string;
  difficulty: number;
  estimatedMinutes: number;
  snapshotVersion: string;
  itemReviewSourceHash: string;
  purposeDecision: MicroTutoringValidationPurposeDecision;
  relations: MicroTutoringValidationRelation[];
}): string {
  return `sha256:${sha256Hex([
    input.catalogItemId,
    input.sourceId,
    input.contentHash,
    input.learningGoalId,
    input.knowledgeNodeId,
    String(input.difficulty),
    String(input.estimatedMinutes),
    input.snapshotVersion,
    input.itemReviewSourceHash,
    input.purposeDecision.reviewerId,
    input.purposeDecision.reviewerRole,
    input.purposeDecision.reviewedAt,
    input.purposeDecision.reviewBatchId,
    input.purposeDecision.independenceRationale,
    input.purposeDecision.purposeRationale,
    input.relations.map((relation) => `${relation.misconceptionTag}\0${relation.rationale}`).join('\n'),
  ].join('\0'))}`;
}

function baselinePairs(source: unknown): Map<string, string> {
  const value = record(source);
  const entries = Array.isArray(value?.entries) ? value.entries : [];
  const pairs = new Map<string, string>();
  for (const entry of entries) {
    const row = record(entry);
    if (!row || !nonEmptyString(row.catalogItemId) || !nonEmptyString(row.contentHash)) continue;
    pairs.set(row.catalogItemId, row.contentHash);
  }
  return pairs;
}

function optionAttributionPairs(source: unknown): Set<string> {
  const value = record(source);
  const entries = Array.isArray(value?.entries) ? value.entries : [];
  const pairs = new Set<string>();
  for (const entry of entries) {
    const row = record(entry);
    if (!row || !nonEmptyString(row.knowledgeNodeId) || !nonEmptyString(row.misconceptionTag)) continue;
    pairs.add(`${row.knowledgeNodeId}\0${row.misconceptionTag}`);
  }
  return pairs;
}

function parseRelations(value: unknown, ref: string): {
  relations: MicroTutoringValidationRelation[];
  issues: MicroTutoringValidationRegistryIssue[];
} {
  if (!Array.isArray(value) || value.length === 0) {
    return { relations: [], issues: [{ code: 'REGISTRY_MALFORMED', ref: `${ref}:relations` }] };
  }
  const issues: MicroTutoringValidationRegistryIssue[] = [];
  const relations: MicroTutoringValidationRelation[] = [];
  const seen = new Set<string>();
  for (const [index, candidate] of value.entries()) {
    const row = record(candidate);
    const relationRef = `${ref}:relation:${index}`;
    if (!row || !nonEmptyString(row.misconceptionTag) || !nonEmptyString(row.rationale)) {
      issues.push({ code: 'REGISTRY_MALFORMED', ref: relationRef });
      continue;
    }
    if (seen.has(row.misconceptionTag)) {
      issues.push({ code: 'DUPLICATE_ITEM', ref: `${ref}:${row.misconceptionTag}` });
      continue;
    }
    seen.add(row.misconceptionTag);
    relations.push({
      misconceptionTag: row.misconceptionTag.trim(),
      rationale: row.rationale.trim(),
    });
  }
  return { relations, issues };
}

function parsePurposeDecision(value: unknown, ref: string): {
  purposeDecision: MicroTutoringValidationPurposeDecision | null;
  issues: MicroTutoringValidationRegistryIssue[];
} {
  const row = record(value);
  if (
    !row ||
    row.kind !== 'micro-tutoring-validation' ||
    !nonEmptyString(row.reviewerId) ||
    !nonEmptyString(row.reviewerRole) ||
    !nonEmptyString(row.reviewedAt) ||
    !nonEmptyString(row.reviewBatchId) ||
    !nonEmptyString(row.independenceRationale) ||
    !nonEmptyString(row.purposeRationale)
  ) {
    return { purposeDecision: null, issues: [{ code: 'PURPOSE_INVALID', ref }] };
  }
  return {
    purposeDecision: {
      kind: 'micro-tutoring-validation',
      reviewerId: row.reviewerId.trim(),
      reviewerRole: row.reviewerRole.trim(),
      reviewedAt: row.reviewedAt.trim(),
      reviewBatchId: row.reviewBatchId.trim(),
      independenceRationale: row.independenceRationale.trim(),
      purposeRationale: row.purposeRationale.trim(),
    },
    issues: [],
  };
}

function parseStudentQuestionRef(
  value: unknown,
  expected: MicroTutoringValidationStudentQuestionRef,
  ref: string,
): MicroTutoringValidationRegistryIssue[] {
  const row = record(value);
  if (
    !row ||
    row.catalogItemId !== expected.catalogItemId ||
    row.sourceId !== expected.sourceId ||
    row.contentHash !== expected.contentHash ||
    row.snapshotVersion !== expected.snapshotVersion
  ) {
    return [{ code: 'SOURCE_DRIFT', ref }];
  }
  return [];
}

export function loadMicroTutoringValidationRegistry(
  source: unknown = loadMicroTutoringRuntimeSource('micro-tutoring-validation-registry.json'),
  optionAttributions: unknown = loadMicroTutoringRuntimeSource('micro-tutoring-option-attributions.json'),
  practiceBaseline: unknown = loadMicroTutoringRuntimeSource('micro-tutoring-practice-baseline.json'),
): LoadedMicroTutoringValidationRegistry {
  const value = record(source);
  const issues: MicroTutoringValidationRegistryIssue[] = [];
  if (
    !value ||
    !nonEmptyString(value.version) ||
    !nonEmptyString(value.source) ||
    !nonEmptyString(value.sourceRevision) ||
    !Array.isArray(value.entries)
  ) {
    return { registry: null, issues: [{ code: 'REGISTRY_MALFORMED', ref: 'registry' }] };
  }
  if (value.version !== MICRO_TUTORING_VALIDATION_REGISTRY_VERSION) {
    issues.push({ code: 'VERSION_DRIFT', ref: 'registry-version' });
  }
  if (value.source !== MICRO_TUTORING_VALIDATION_REGISTRY_SOURCE) {
    issues.push({ code: 'SOURCE_DRIFT', ref: 'registry-source' });
  }
  if (!GIT_REVISION.test(value.sourceRevision)) {
    issues.push({ code: 'SOURCE_DRIFT', ref: 'registry-source-revision' });
  }

  const requiredPairs = optionAttributionPairs(optionAttributions);
  const baseline = baselinePairs(practiceBaseline);
  const pairCoverage = new Map<string, number>();
  const entries: MicroTutoringValidationRegistryEntry[] = [];
  const seenIds = new Set<string>();
  const seenCatalogIds = new Set<string>();
  const seenSourceIds = new Set<string>();
  const seenHashes = new Set<string>();

  for (const [index, candidate] of value.entries.entries()) {
    const row = record(candidate);
    const ref = nonEmptyString(row?.id) ? row.id : `entry:${index}`;
    if (
      !row ||
      !nonEmptyString(row.id) ||
      !nonEmptyString(row.catalogItemId) ||
      !nonEmptyString(row.sourceId) ||
      !nonEmptyString(row.contentHash) ||
      !nonEmptyString(row.itemRevision) ||
      !nonEmptyString(row.learningGoalId) ||
      !nonEmptyString(row.knowledgeNodeId) ||
      !nonEmptyString(row.snapshotVersion) ||
      !nonEmptyString(row.itemReviewSourceHash) ||
      !nonEmptyString(row.actionPath) ||
      typeof row.enabled !== 'boolean'
    ) {
      issues.push({ code: 'REGISTRY_MALFORMED', ref });
      continue;
    }
    if (
      seenIds.has(row.id) ||
      seenCatalogIds.has(row.catalogItemId) ||
      seenSourceIds.has(row.sourceId)
    ) {
      issues.push({ code: 'DUPLICATE_ITEM', ref: row.id });
      continue;
    }
    if (seenHashes.has(row.contentHash)) {
      issues.push({ code: 'DUPLICATE_CONTENT', ref: row.id });
      continue;
    }
    seenIds.add(row.id);
    seenCatalogIds.add(row.catalogItemId);
    seenSourceIds.add(row.sourceId);
    seenHashes.add(row.contentHash);
    if (!row.knowledgeNodeId.startsWith('kn:')) {
      issues.push({ code: 'NODE_DOMAIN_INVALID', ref: row.id });
      continue;
    }
    if (row.privacyLevel !== 'student-visible') {
      issues.push({ code: 'PRIVACY_INVALID', ref: row.id });
      continue;
    }
    if (
      typeof row.estimatedMinutes !== 'number' ||
      row.estimatedMinutes !== MICRO_TUTORING_VALIDATION_ESTIMATED_MINUTES
    ) {
      issues.push({ code: 'DURATION_INVALID', ref: row.id });
      continue;
    }
    if (
      typeof row.difficulty !== 'number' ||
      !Number.isFinite(row.difficulty) ||
      row.difficulty < 0 ||
      row.difficulty > 1
    ) {
      issues.push({ code: 'REGISTRY_MALFORMED', ref: `${row.id}:difficulty` });
      continue;
    }
    if (!/^[a-f0-9]{64}$/.test(row.contentHash) || !/^sha256:[a-f0-9]{64}$/.test(row.itemReviewSourceHash)) {
      issues.push({ code: 'REGISTRY_MALFORMED', ref: `${row.id}:hash` });
      continue;
    }
    if (row.actionPath !== MICRO_TUTORING_VALIDATION_ACTION_PATH) {
      issues.push({ code: 'SOURCE_DRIFT', ref: `${row.id}:action-path` });
      continue;
    }
    const expectedHash = baseline.get(row.catalogItemId);
    if (!expectedHash) {
      issues.push({ code: 'BASELINE_DRIFT', ref: row.catalogItemId });
      continue;
    }
    if (expectedHash !== row.contentHash) {
      issues.push({ code: 'BASELINE_DRIFT', ref: `${row.id}:content-hash` });
      continue;
    }
    const goalNode = resolveMicroTutoringGoalNode(row.learningGoalId);
    if (!goalNode.ok || goalNode.knowledgeNodeId !== row.knowledgeNodeId) {
      issues.push({ code: 'NODE_DOMAIN_INVALID', ref: `${row.id}:goal-node` });
      continue;
    }
    const parsedPurpose = parsePurposeDecision(row.purposeDecision, `${row.id}:purpose`);
    issues.push(...parsedPurpose.issues);
    if (!parsedPurpose.purposeDecision) continue;
    const parsedRelations = parseRelations(row.relations, row.id);
    issues.push(...parsedRelations.issues);
    if (parsedRelations.relations.length === 0) continue;
    const knowledgeNodeId = row.knowledgeNodeId.trim();
    const sourceRefs = uniqueSorted(
      parsedRelations.relations.map((relation) => microTutoringValidationRelationSourceRef({
        knowledgeNodeId,
        misconceptionTag: relation.misconceptionTag,
      })),
    );
    const declaredRefs = Array.isArray(row.sourceRefs) && row.sourceRefs.every(nonEmptyString)
      ? uniqueSorted(row.sourceRefs)
      : [];
    if (declaredRefs.join('\n') !== sourceRefs.join('\n')) {
      issues.push({ code: 'SOURCE_DRIFT', ref: `${row.id}:source-refs` });
      continue;
    }
    const studentQuestionRef = {
      catalogItemId: row.catalogItemId.trim(),
      sourceId: row.sourceId.trim(),
      contentHash: row.contentHash.trim(),
      snapshotVersion: row.snapshotVersion.trim(),
    };
    issues.push(...parseStudentQuestionRef(row.studentQuestionRef, studentQuestionRef, `${row.id}:student-ref`));
    const expectedRevision = microTutoringValidationItemRevision({
      catalogItemId: studentQuestionRef.catalogItemId,
      sourceId: studentQuestionRef.sourceId,
      contentHash: studentQuestionRef.contentHash,
      learningGoalId: row.learningGoalId.trim(),
      knowledgeNodeId,
      difficulty: row.difficulty,
      estimatedMinutes: row.estimatedMinutes,
      snapshotVersion: studentQuestionRef.snapshotVersion,
      itemReviewSourceHash: row.itemReviewSourceHash.trim(),
      purposeDecision: parsedPurpose.purposeDecision,
      relations: parsedRelations.relations,
    });
    if (row.itemRevision !== expectedRevision) {
      issues.push({ code: 'SOURCE_DRIFT', ref: `${row.id}:revision` });
      continue;
    }
    for (const relation of parsedRelations.relations) {
      const pair = `${knowledgeNodeId}\0${relation.misconceptionTag}`;
      if (!requiredPairs.has(pair)) {
        issues.push({ code: 'RELATION_UNKNOWN', ref: `${row.id}:${relation.misconceptionTag}` });
        continue;
      }
      pairCoverage.set(pair, (pairCoverage.get(pair) ?? 0) + (row.enabled ? 1 : 0));
    }
    entries.push({
      id: row.id.trim(),
      catalogItemId: studentQuestionRef.catalogItemId,
      sourceId: studentQuestionRef.sourceId,
      contentHash: studentQuestionRef.contentHash,
      itemRevision: row.itemRevision.trim(),
      learningGoalId: row.learningGoalId.trim(),
      knowledgeNodeId,
      difficulty: row.difficulty,
      estimatedMinutes: row.estimatedMinutes,
      actionPath: MICRO_TUTORING_VALIDATION_ACTION_PATH,
      privacyLevel: 'student-visible',
      enabled: row.enabled,
      snapshotVersion: studentQuestionRef.snapshotVersion,
      itemReviewSourceHash: row.itemReviewSourceHash.trim(),
      purposeDecision: parsedPurpose.purposeDecision,
      studentQuestionRef,
      relations: parsedRelations.relations,
      sourceRefs,
    });
  }

  if (baseline.size !== entries.length) {
    issues.push({ code: 'BASELINE_DRIFT', ref: `count:${entries.length}:${baseline.size}` });
  }
  for (const pair of requiredPairs) {
    const coverage = pairCoverage.get(pair) ?? 0;
    if (coverage < 2) {
      const [knowledgeNodeId, misconceptionTag] = pair.split('\0');
      issues.push({
        code: coverage === 0 ? 'RELATION_UNKNOWN' : 'INDEPENDENCE_INSUFFICIENT',
        ref: `missing:${knowledgeNodeId}:${misconceptionTag}`,
      });
    }
  }

  if (issues.length > 0) {
    return { registry: null, issues };
  }
  return {
    registry: {
      version: MICRO_TUTORING_VALIDATION_REGISTRY_VERSION,
      source: MICRO_TUTORING_VALIDATION_REGISTRY_SOURCE,
      sourceRevision: value.sourceRevision.trim(),
      entries,
    },
    issues: [],
  };
}

export function microTutoringValidationAuthorityAllowsStudentUse(
  row: MicroTutoringValidationAuthorityRow,
  captureRevision?: string | null,
): boolean {
  const metadata = record(row.metadata);
  const validation = record(metadata?.remediationValidation);
  if (validation?.learnerVisible === false) return false;
  if (!captureRevision) return true;
  const captured = nonEmptyString(validation?.captureRevision)
    ? validation.captureRevision.trim()
    : nonEmptyString(record(metadata?.adaptiveAssessmentItemRef)?.captureRevision)
      ? String(record(metadata?.adaptiveAssessmentItemRef)?.captureRevision).trim()
      : null;
  if (captured && captured !== captureRevision) return false;
  return true;
}

export function projectMicroTutoringValidationForLearner(
  item: MicroTutoringGovernedValidationItem,
): MicroTutoringGovernedValidationItem {
  return {
    id: item.id,
    questionId: item.questionId,
    contentHash: item.contentHash,
    version: item.version,
    itemRevision: item.itemRevision,
    estimatedMinutes: item.estimatedMinutes,
    actionPath: item.actionPath,
  };
}

export function findMicroTutoringGovernedValidationBinding(input: {
  knowledgeNodeId: string;
  misconceptionTag: string;
  questionId: string;
  contentHash: string;
  itemRevision: string;
  registry?: unknown;
  optionAttributions?: unknown;
  practiceBaseline?: unknown;
}): MicroTutoringGovernedValidationItem | null {
  const loaded = loadMicroTutoringValidationRegistry(
    input.registry,
    input.optionAttributions,
    input.practiceBaseline,
  );
  if (!loaded.registry || !input.itemRevision) return null;
  const questionId = canonicalMicroTutoringQuestionId(input.questionId);
  const match = loaded.registry.entries.find((entry) =>
    entry.enabled &&
    entry.knowledgeNodeId === input.knowledgeNodeId &&
    entry.relations.some((relation) => relation.misconceptionTag === input.misconceptionTag) &&
    canonicalMicroTutoringQuestionId(entry.sourceId) === questionId &&
    entry.contentHash === input.contentHash &&
    entry.itemRevision === input.itemRevision);
  return match
    ? projectMicroTutoringValidationForLearner({
      id: match.id,
      questionId: match.sourceId,
      contentHash: match.contentHash,
      version: match.snapshotVersion,
      itemRevision: match.itemRevision,
      estimatedMinutes: match.estimatedMinutes,
      actionPath: match.actionPath,
    })
    : null;
}

export function listMicroTutoringGovernedValidationItems(input: {
  knowledgeNodeId: string;
  misconceptionTag: string;
  sourceQuestionId: string;
  sourceContentHash: string;
  registry?: unknown;
  optionAttributions?: unknown;
  practiceBaseline?: unknown;
  authorityRows?: MicroTutoringValidationAuthorityRow[];
  captureRevision?: string | null;
}): MicroTutoringGovernedValidationItem[] {
  const loaded = loadMicroTutoringValidationRegistry(
    input.registry,
    input.optionAttributions,
    input.practiceBaseline,
  );
  if (!loaded.registry) return [];
  const sourceQuestionId = canonicalMicroTutoringQuestionId(input.sourceQuestionId);
  const matches = loaded.registry.entries
    .filter((entry) =>
      entry.enabled &&
      entry.knowledgeNodeId === input.knowledgeNodeId &&
      entry.relations.some((relation) => relation.misconceptionTag === input.misconceptionTag) &&
      canonicalMicroTutoringQuestionId(entry.sourceId) !== sourceQuestionId &&
      entry.contentHash !== input.sourceContentHash)
    .map((entry) => projectMicroTutoringValidationForLearner({
      id: entry.id,
      questionId: entry.sourceId,
      contentHash: entry.contentHash,
      version: entry.snapshotVersion,
      itemRevision: entry.itemRevision,
      estimatedMinutes: entry.estimatedMinutes,
      actionPath: entry.actionPath,
    }))
    .sort((left, right) =>
      left.version.localeCompare(right.version) || left.id.localeCompare(right.id));
  if (!input.authorityRows) return matches;
  const usable = input.authorityRows.filter((row) =>
    microTutoringValidationAuthorityAllowsStudentUse(row, input.captureRevision));
  const authorityByQuestion = new Map<string, MicroTutoringValidationAuthorityRow[]>();
  for (const row of usable) {
    for (const questionId of microTutoringValidationQuestionIds(row.questionId)) {
      const current = authorityByQuestion.get(questionId) ?? [];
      current.push(row);
      authorityByQuestion.set(questionId, current);
    }
  }
  return matches.filter((item) =>
    (authorityByQuestion.get(item.questionId) ?? []).some((row) => row.contentHash === item.contentHash));
}
