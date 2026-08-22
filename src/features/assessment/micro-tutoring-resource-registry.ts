import { createHash } from 'node:crypto';

import { getRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';

import {
  MICRO_TUTORING_LEARNING_ACTION_VERSION,
  parseMicroTutoringLearningAction,
  type MicroTutoringLearningAction,
} from './micro-tutoring-learning-actions';
import { loadMicroTutoringRuntimeSource } from './micro-tutoring-runtime-source';

export const MICRO_TUTORING_RESOURCE_PROJECTION_VERSION = 'micro-tutoring-resource-projection.v1';
export const MICRO_TUTORING_RESOURCE_PROJECTION_SOURCE = 'micro-tutoring-option-attributions.v2';

export type MicroTutoringResourceProjectionIssueCode =
  | 'PROJECTION_MALFORMED'
  | 'VERSION_DRIFT'
  | 'SOURCE_DRIFT'
  | 'REGISTRY_UNKNOWN'
  | 'REGISTRY_NOT_STUDENT_VISIBLE'
  | 'NODE_DOMAIN_INVALID'
  | 'DUPLICATE_RESOURCE'
  | 'DUPLICATE_RELATION'
  | 'RELATION_UNKNOWN'
  | 'LAUNCH_TARGET_INVALID'
  | 'ACTION_INVALID'
  | 'DURATION_INVALID';

export interface MicroTutoringResourceRelation {
  misconceptionTag: string;
  rationale: string;
}

export interface MicroTutoringResourceProjectionEntry {
  id: string;
  registryId: string;
  teachingResourceRef: string;
  resourceRevision: string;
  knowledgeNodeId: string;
  launchTarget: string;
  estimatedMinutes: number;
  privacyLevel: 'student-visible';
  enabled: boolean;
  action: MicroTutoringLearningAction;
  relations: MicroTutoringResourceRelation[];
  sourceRefs: string[];
}

export interface MicroTutoringResourceProjection {
  version: string;
  source: string;
  actionVersion: string;
  entries: MicroTutoringResourceProjectionEntry[];
}

export interface MicroTutoringResourceProjectionIssue {
  code: MicroTutoringResourceProjectionIssueCode;
  ref: string;
}

export interface LoadedMicroTutoringResourceProjection {
  projection: MicroTutoringResourceProjection | null;
  issues: MicroTutoringResourceProjectionIssue[];
}

export interface MicroTutoringGovernedResource {
  id: string;
  registryId: string;
  version: string;
  estimatedMinutes: number;
  actionPath: string;
  actionId: string;
  actionVersion: string;
}

export interface MicroTutoringResourceAuthorityRow {
  id: string;
  registryId: string | null;
  teacherOnly: boolean;
  config?: unknown;
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

export function microTutoringResourceAuthorityAllowsStudentUse(
  row: MicroTutoringResourceAuthorityRow,
  captureRevision?: string | null,
): boolean {
  if (row.teacherOnly) return false;
  const planning = record(record(row.config)?.resourceNodePlanning);
  const privacy = typeof planning?.privacyLevel === 'string' ? planning.privacyLevel : null;
  const availability = typeof planning?.availability === 'string' ? planning.availability : null;
  const teacherPolicy = typeof planning?.teacherPolicy === 'string' ? planning.teacherPolicy : null;
  if (privacy === 'teacher-scoped') return false;
  if (availability === 'archived' || availability === 'teacher_only') return false;
  if (teacherPolicy === 'blocked' || teacherPolicy === 'teacher-only') return false;
  if (captureRevision) {
    const captured = record(record(row.config)?.remediation)?.captureRevision;
    if (typeof captured !== 'string' || captured.trim() !== captureRevision) return false;
  }
  return true;
}

export function microTutoringResourceAuthorityDigest(registryId: string): string {
  const metadata = getRegisteredResourceMetadata(registryId);
  if (!metadata) return '';
  const planning = metadata.planningOverride;
  return JSON.stringify({
    label: metadata.label,
    type: metadata.type,
    launchTarget: metadata.launchTarget ?? null,
    renderTarget: metadata.renderTarget ?? null,
    sourceVersionRef: planning?.pathDisposition?.sourceVersionRef ?? 'resource-node-registry.v1',
    estimatedTimeMinutes: planning?.estimatedTimeMinutes ?? null,
    privacyLevel: planning?.privacyLevel ?? null,
    availability: planning?.availability ?? null,
    teacherPolicy: planning?.teacherPolicy ?? null,
    evidenceInstrumentation: planning?.evidenceInstrumentation ?? [],
  });
}

export function microTutoringResourceRevision(input: {
  registryId: string;
  knowledgeNodeId: string;
  launchTarget: string;
}): string {
  return `sha256:${createHash('sha256')
    .update([
      input.registryId,
      input.knowledgeNodeId,
      input.launchTarget,
      microTutoringResourceAuthorityDigest(input.registryId),
    ].join('\0'))
    .digest('hex')}`;
}

export function microTutoringResourceRelationSourceRef(input: {
  knowledgeNodeId: string;
  misconceptionTag: string;
}): string {
  const digest = createHash('sha256')
    .update(`${input.knowledgeNodeId}\0${input.misconceptionTag}`)
    .digest('hex');
  return `${MICRO_TUTORING_RESOURCE_PROJECTION_SOURCE}#node:${input.knowledgeNodeId}#tag:${input.misconceptionTag}#sha256:${digest}`;
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
  relations: MicroTutoringResourceRelation[];
  issues: MicroTutoringResourceProjectionIssue[];
} {
  if (!Array.isArray(value) || value.length === 0) {
    return { relations: [], issues: [{ code: 'PROJECTION_MALFORMED', ref: `${ref}:relations` }] };
  }
  const issues: MicroTutoringResourceProjectionIssue[] = [];
  const relations: MicroTutoringResourceRelation[] = [];
  const seen = new Set<string>();
  for (const [index, candidate] of value.entries()) {
    const row = record(candidate);
    const relationRef = `${ref}:relation:${index}`;
    if (!row || !nonEmptyString(row.misconceptionTag) || !nonEmptyString(row.rationale)) {
      issues.push({ code: 'PROJECTION_MALFORMED', ref: relationRef });
      continue;
    }
    if (seen.has(row.misconceptionTag)) {
      issues.push({ code: 'DUPLICATE_RELATION', ref: `${ref}:${row.misconceptionTag}` });
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

export function loadMicroTutoringResourceProjection(
  source: unknown = loadMicroTutoringRuntimeSource('micro-tutoring-resource-projection.json'),
  optionAttributions: unknown = loadMicroTutoringRuntimeSource('micro-tutoring-option-attributions.json'),
): LoadedMicroTutoringResourceProjection {
  const value = record(source);
  const issues: MicroTutoringResourceProjectionIssue[] = [];
  if (
    !value ||
    !nonEmptyString(value.version) ||
    !nonEmptyString(value.source) ||
    !nonEmptyString(value.actionVersion) ||
    !Array.isArray(value.entries)
  ) {
    return { projection: null, issues: [{ code: 'PROJECTION_MALFORMED', ref: 'projection' }] };
  }
  if (value.version !== MICRO_TUTORING_RESOURCE_PROJECTION_VERSION) {
    issues.push({ code: 'VERSION_DRIFT', ref: 'projection-version' });
  }
  if (value.source !== MICRO_TUTORING_RESOURCE_PROJECTION_SOURCE) {
    issues.push({ code: 'SOURCE_DRIFT', ref: 'projection-source' });
  }
  if (value.actionVersion !== MICRO_TUTORING_LEARNING_ACTION_VERSION) {
    issues.push({ code: 'VERSION_DRIFT', ref: 'action-version' });
  }

  const requiredPairs = optionAttributionPairs(optionAttributions);
  const coveredPairs = new Set<string>();
  const entries: MicroTutoringResourceProjectionEntry[] = [];
  const seenIds = new Set<string>();
  const seenRegistryNodes = new Set<string>();

  for (const [index, candidate] of value.entries.entries()) {
    const row = record(candidate);
    const ref = nonEmptyString(row?.id) ? row.id : `entry:${index}`;
    if (
      !row ||
      !nonEmptyString(row.id) ||
      !nonEmptyString(row.registryId) ||
      !nonEmptyString(row.teachingResourceRef) ||
      !nonEmptyString(row.resourceRevision) ||
      !nonEmptyString(row.knowledgeNodeId) ||
      !nonEmptyString(row.launchTarget) ||
      row.privacyLevel !== 'student-visible' ||
      typeof row.enabled !== 'boolean'
    ) {
      issues.push({ code: 'PROJECTION_MALFORMED', ref });
      continue;
    }
    if (seenIds.has(row.id) || seenRegistryNodes.has(`${row.registryId}\0${row.knowledgeNodeId}`)) {
      issues.push({ code: 'DUPLICATE_RESOURCE', ref: row.id });
      continue;
    }
    seenIds.add(row.id);
    seenRegistryNodes.add(`${row.registryId}\0${row.knowledgeNodeId}`);
    if (!row.knowledgeNodeId.startsWith('kn:')) {
      issues.push({ code: 'NODE_DOMAIN_INVALID', ref: row.id });
      continue;
    }
    if (
      typeof row.estimatedMinutes !== 'number' ||
      !Number.isInteger(row.estimatedMinutes) ||
      row.estimatedMinutes < 1 ||
      row.estimatedMinutes > 8
    ) {
      issues.push({ code: 'DURATION_INVALID', ref: row.id });
      continue;
    }
    if (!row.launchTarget.startsWith('/') || row.launchTarget.startsWith('//') || row.launchTarget.includes('://')) {
      issues.push({ code: 'LAUNCH_TARGET_INVALID', ref: row.id });
      continue;
    }
    const metadata = getRegisteredResourceMetadata(row.registryId);
    if (!metadata) {
      issues.push({ code: 'REGISTRY_UNKNOWN', ref: row.registryId });
      continue;
    }
    const availability = metadata.planningOverride?.availability;
    const privacy = metadata.planningOverride?.privacyLevel;
    const teacherPolicy = metadata.planningOverride?.teacherPolicy;
    if (
      availability === 'archived' ||
      availability === 'teacher_only' ||
      privacy === 'teacher-scoped' ||
      teacherPolicy === 'blocked' ||
      teacherPolicy === 'teacher-only'
    ) {
      issues.push({ code: 'REGISTRY_NOT_STUDENT_VISIBLE', ref: row.registryId });
      continue;
    }
    const expectedLaunch = metadata.launchTarget ?? metadata.renderTarget ?? `/interactive-learning/resources/${row.registryId}`;
    if (row.launchTarget !== expectedLaunch) {
      issues.push({ code: 'LAUNCH_TARGET_INVALID', ref: `${row.id}:launch` });
      continue;
    }
    if (row.teachingResourceRef !== `registry:${row.registryId}`) {
      issues.push({ code: 'SOURCE_DRIFT', ref: `${row.id}:teaching-resource` });
      continue;
    }
    const expectedRevision = microTutoringResourceRevision({
      registryId: row.registryId,
      knowledgeNodeId: row.knowledgeNodeId,
      launchTarget: row.launchTarget,
    });
    if (row.resourceRevision !== expectedRevision) {
      issues.push({ code: 'SOURCE_DRIFT', ref: `${row.id}:revision` });
      continue;
    }
    const parsedAction = parseMicroTutoringLearningAction(row.action, `${row.id}:action`);
    if (!parsedAction.action || parsedAction.action.estimatedMinutes !== row.estimatedMinutes) {
      issues.push(...parsedAction.issues.map((issue) => ({
        code: 'ACTION_INVALID' as const,
        ref: issue.ref,
      })));
      if (parsedAction.action && parsedAction.action.estimatedMinutes !== row.estimatedMinutes) {
        issues.push({ code: 'DURATION_INVALID', ref: `${row.id}:action-duration` });
      }
      continue;
    }
    const parsedRelations = parseRelations(row.relations, row.id);
    issues.push(...parsedRelations.issues);
    if (parsedRelations.relations.length === 0) continue;
    const knowledgeNodeId = row.knowledgeNodeId.trim();
    const sourceRefs = uniqueSorted(
      parsedRelations.relations.map((relation) => microTutoringResourceRelationSourceRef({
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
    for (const relation of parsedRelations.relations) {
      const pair = `${knowledgeNodeId}\0${relation.misconceptionTag}`;
      if (!requiredPairs.has(pair)) {
        issues.push({ code: 'RELATION_UNKNOWN', ref: `${row.id}:${relation.misconceptionTag}` });
        continue;
      }
      coveredPairs.add(pair);
    }
    entries.push({
      id: row.id.trim(),
      registryId: row.registryId.trim(),
      teachingResourceRef: row.teachingResourceRef.trim(),
      resourceRevision: row.resourceRevision.trim(),
      knowledgeNodeId,
      launchTarget: row.launchTarget.trim(),
      estimatedMinutes: row.estimatedMinutes,
      privacyLevel: 'student-visible',
      enabled: row.enabled,
      action: parsedAction.action,
      relations: parsedRelations.relations,
      sourceRefs,
    });
  }

  for (const pair of requiredPairs) {
    if (!coveredPairs.has(pair)) {
      const [knowledgeNodeId, misconceptionTag] = pair.split('\0');
      issues.push({
        code: 'RELATION_UNKNOWN',
        ref: `missing:${knowledgeNodeId}:${misconceptionTag}`,
      });
    }
  }

  if (issues.length > 0) {
    return { projection: null, issues };
  }
  return {
    projection: {
      version: MICRO_TUTORING_RESOURCE_PROJECTION_VERSION,
      source: MICRO_TUTORING_RESOURCE_PROJECTION_SOURCE,
      actionVersion: MICRO_TUTORING_LEARNING_ACTION_VERSION,
      entries,
    },
    issues: [],
  };
}

export function listMicroTutoringGovernedResources(input: {
  knowledgeNodeId: string;
  misconceptionTag: string;
  projection?: unknown;
  optionAttributions?: unknown;
  authorityRows?: MicroTutoringResourceAuthorityRow[];
  captureRevision?: string | null;
}): MicroTutoringGovernedResource[] {
  const loaded = loadMicroTutoringResourceProjection(input.projection, input.optionAttributions);
  if (!loaded.projection) return [];
  const matches = loaded.projection.entries
    .filter((entry) =>
      entry.enabled &&
      entry.knowledgeNodeId === input.knowledgeNodeId &&
      entry.relations.some((relation) => relation.misconceptionTag === input.misconceptionTag))
    .map((entry) => ({
      id: entry.id,
      registryId: entry.registryId,
      version: entry.resourceRevision,
      estimatedMinutes: entry.estimatedMinutes,
      actionPath: entry.launchTarget,
      actionId: entry.action.id,
      actionVersion: entry.action.version,
    }))
    .sort((left, right) =>
      left.version.localeCompare(right.version) || left.id.localeCompare(right.id));
  if (!input.authorityRows) return matches;
  const usable = input.authorityRows.filter((row) =>
    microTutoringResourceAuthorityAllowsStudentUse(row, input.captureRevision));
  const authorityByRegistryId = new Map(
    usable
      .filter((row) => nonEmptyString(row.registryId))
      .map((row) => [row.registryId as string, row]),
  );
  const authorityById = new Map(usable.map((row) => [row.id, row]));
  return matches.filter((resource) =>
    authorityByRegistryId.has(resource.registryId) || authorityById.has(resource.registryId));
}
