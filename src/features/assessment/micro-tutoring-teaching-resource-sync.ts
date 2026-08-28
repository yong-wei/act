import { getRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';
import { CORE_RESOURCE_PATH_READINESS_REVIEW_BATCH } from '@/lib/resource-node-path-readiness-review-batch';

import {
  MICRO_TUTORING_RESOURCE_PROJECTION_V2_VERSION,
  loadMicroTutoringResourceProjection,
  type MicroTutoringResourceProjectionEntry,
} from './micro-tutoring-resource-registry';

export const MICRO_TUTORING_TEACHING_RESOURCE_SYNC_VERSION = 'micro-tutoring-teaching-resource-sync.v1';
export const GIT_SHA = /^[0-9a-f]{40}$/i;

const reviewedSourceRefSet = new Set<string>(CORE_RESOURCE_PATH_READINESS_REVIEW_BATCH.reviewedSourceRefs);

export type MicroTutoringTeachingResourceSyncIssueCode =
  | 'PROJECTION_INVALID'
  | 'REGISTRY_UNKNOWN'
  | 'REGISTRY_NOT_REVIEWED'
  | 'DUPLICATE_REGISTRY_ID'
  | 'ACCESS_REVOKED'
  | 'GIT_DIRTY'
  | 'CAPTURE_REVISION_INVALID';

export interface TeachingResourceSyncRow {
  id: string;
  registryId: string | null;
  teacherOnly: boolean;
  title: string;
  displayName?: string | null;
  description?: string | null;
  type: string;
  category?: string | null;
  content?: string | null;
  config: unknown;
  knowledgeNodeIds: string[];
}

export interface MicroTutoringTeachingResourceSyncIssue {
  code: MicroTutoringTeachingResourceSyncIssueCode;
  ref: string;
}

export interface MicroTutoringTeachingResourceSyncEntry {
  action: 'create' | 'update' | 'unchanged';
  id: string;
  registryId: string;
  knowledgeNodeId: string;
  misconceptionTags: string[];
  resourceRevision: string;
  title: string;
  type: string;
  connectKnowledgeNodeId: string | null;
  nextConfig: Record<string, unknown>;
}

export type MicroTutoringTeachingResourceSyncPlan =
  | {
    ok: true;
    captureRevision: string;
    projectionVersion: typeof MICRO_TUTORING_RESOURCE_PROJECTION_V2_VERSION;
    entries: MicroTutoringTeachingResourceSyncEntry[];
  }
  | {
    ok: false;
    issues: MicroTutoringTeachingResourceSyncIssue[];
  };

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim()))].sort();
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return uniqueSorted(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0));
}

function isReviewedRegistryIdentity(registryId: string): boolean {
  return reviewedSourceRefSet.has(`registry:${registryId}|resource_registry:${registryId}|resource-node-registry.v1`)
    || reviewedSourceRefSet.has(`teaching-resource:${registryId}|teaching_resource:${registryId}|resource-node-registry.v1`);
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

function mergeMaterializedConfig(input: {
  existing: unknown;
  entry: MicroTutoringResourceProjectionEntry;
  captureRevision: string;
}): Record<string, unknown> {
  const config = asRecord(input.existing);
  const remediation = asRecord(config.remediation);
  const planning = asRecord(config.resourceNodePlanning);
  const readiness = asRecord(planning.readiness);
  const pathDisposition = asRecord(planning.pathDisposition);
  return {
    ...config,
    remediation: {
      ...remediation,
      prerequisiteKnowledgeNodeIds: uniqueSorted([
        ...stringList(remediation.prerequisiteKnowledgeNodeIds),
        input.entry.knowledgeNodeId,
      ]),
      misconceptionTags: uniqueSorted([
        ...stringList(remediation.misconceptionTags),
        ...input.entry.relations.map((relation) => relation.misconceptionTag),
      ]),
      projectionId: input.entry.id,
      resourceRevision: input.entry.resourceRevision,
      captureRevision: input.captureRevision,
      projectionVersion: MICRO_TUTORING_RESOURCE_PROJECTION_V2_VERSION,
      syncVersion: MICRO_TUTORING_TEACHING_RESOURCE_SYNC_VERSION,
    },
    resourceNodePlanning: {
      ...planning,
      estimatedTimeMinutes: input.entry.estimatedMinutes,
      privacyLevel: 'student-visible',
      availability: 'available',
      teacherPolicy: 'allowed',
      evidenceInstrumentation: stringList(planning.evidenceInstrumentation).length > 0
        ? stringList(planning.evidenceInstrumentation)
        : ['TeachingResource.interactionLogs'],
      knowledgeCoverage: uniqueSorted([
        ...stringList(planning.knowledgeCoverage),
        input.entry.knowledgeNodeId,
      ]),
      readiness: {
        minimumCompetency: asRecord(readiness.minimumCompetency),
        minimumEvidenceCount: typeof readiness.minimumEvidenceCount === 'number'
          && readiness.minimumEvidenceCount > 0
          ? readiness.minimumEvidenceCount
          : 1,
        requiredCompletedNodeIds: stringList(readiness.requiredCompletedNodeIds),
        requiredOutcomeRefs: stringList(readiness.requiredOutcomeRefs),
        unlockMessage: typeof readiness.unlockMessage === 'string' ? readiness.unlockMessage : 'Ready',
        fallbackNodeIds: stringList(readiness.fallbackNodeIds),
      },
      pathDisposition: {
        kind: 'path-plannable',
        reviewStatus: 'human-confirmed',
        rationale: pathDisposition.rationale
          ?? `Materialized from reviewed registry identity ${input.entry.registryId} in ${CORE_RESOURCE_PATH_READINESS_REVIEW_BATCH.id}.`,
        sourceFamily: typeof pathDisposition.sourceFamily === 'string'
          ? pathDisposition.sourceFamily
          : 'teaching-resource',
        stableSourceRef: typeof pathDisposition.stableSourceRef === 'string'
          ? pathDisposition.stableSourceRef
          : input.entry.registryId,
        sourceVersionRef: input.entry.resourceRevision,
        parentResourceNodeId: pathDisposition.parentResourceNodeId ?? null,
        reviewedAt: CORE_RESOURCE_PATH_READINESS_REVIEW_BATCH.reviewedAt,
        reviewerId: CORE_RESOURCE_PATH_READINESS_REVIEW_BATCH.reviewerId,
        reviewBatchId: CORE_RESOURCE_PATH_READINESS_REVIEW_BATCH.id,
      },
    },
  };
}

export function teachingResourceMatchesOrchestratorQuery(
  row: Pick<TeachingResourceSyncRow, 'teacherOnly' | 'config' | 'knowledgeNodeIds'>,
  knowledgeNodeId: string,
): boolean {
  if (row.teacherOnly) return false;
  if (row.knowledgeNodeIds.includes(knowledgeNodeId)) return true;
  return stringList(asRecord(asRecord(row.config).remediation).prerequisiteKnowledgeNodeIds)
    .includes(knowledgeNodeId);
}

export function planMicroTutoringTeachingResourceSync(input: {
  existingRows: TeachingResourceSyncRow[];
  existingKnowledgeNodeIds?: Iterable<string>;
  captureRevision: string;
  dirty?: boolean;
  projection?: unknown;
  optionAttributions?: unknown;
}): MicroTutoringTeachingResourceSyncPlan {
  if (input.dirty) {
    return { ok: false, issues: [{ code: 'GIT_DIRTY', ref: 'git-worktree' }] };
  }
  if (!GIT_SHA.test(input.captureRevision)) {
    return { ok: false, issues: [{ code: 'CAPTURE_REVISION_INVALID', ref: 'captureRevision' }] };
  }

  const loaded = loadMicroTutoringResourceProjection(input.projection, input.optionAttributions);
  if (!loaded.projection || loaded.issues.length > 0) {
    return {
      ok: false,
      issues: [{ code: 'PROJECTION_INVALID', ref: loaded.issues[0]?.ref ?? 'projection' }],
    };
  }

  const existingByRegistryId = new Map<string, TeachingResourceSyncRow[]>();
  for (const row of input.existingRows) {
    const registryId = row.registryId?.trim() || (row.id ? row.id : '');
    if (!registryId) continue;
    const current = existingByRegistryId.get(registryId) ?? [];
    current.push(row);
    existingByRegistryId.set(registryId, current);
  }

  const existingKnowledgeNodeIds = new Set(input.existingKnowledgeNodeIds ?? []);
  const issues: MicroTutoringTeachingResourceSyncIssue[] = [];
  const entries: MicroTutoringTeachingResourceSyncEntry[] = [];

  for (const entry of loaded.projection.entries) {
    if (!entry.enabled) {
      continue;
    }
    if (!getRegisteredResourceMetadata(entry.registryId)) {
      issues.push({ code: 'REGISTRY_UNKNOWN', ref: entry.registryId });
      continue;
    }
    if (!isReviewedRegistryIdentity(entry.registryId)) {
      issues.push({ code: 'REGISTRY_NOT_REVIEWED', ref: entry.registryId });
      continue;
    }
    const matches = existingByRegistryId.get(entry.registryId) ?? [];
    if (matches.length > 1) {
      issues.push({ code: 'DUPLICATE_REGISTRY_ID', ref: entry.registryId });
      continue;
    }
    const existing = matches[0];
    if (existing?.teacherOnly) {
      issues.push({ code: 'ACCESS_REVOKED', ref: entry.registryId });
      continue;
    }
    const metadata = getRegisteredResourceMetadata(entry.registryId)!;
    const id = existing?.id ?? entry.registryId;
    const nextConfig = mergeMaterializedConfig({
      existing: existing?.config,
      entry,
      captureRevision: input.captureRevision,
    });
    const action = !existing
      ? 'create'
      : stableJson(existing.config) === stableJson(nextConfig)
        && existing.registryId === entry.registryId
        && existing.teacherOnly === false
        ? 'unchanged'
        : 'update';
    entries.push({
      action,
      id,
      registryId: entry.registryId,
      knowledgeNodeId: entry.knowledgeNodeId,
      misconceptionTags: uniqueSorted(entry.relations.map((relation) => relation.misconceptionTag)),
      resourceRevision: entry.resourceRevision,
      title: existing?.title ?? metadata.label,
      type: existing?.type ?? metadata.type,
      connectKnowledgeNodeId: existingKnowledgeNodeIds.has(entry.knowledgeNodeId)
        ? entry.knowledgeNodeId
        : null,
      nextConfig,
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return {
    ok: true,
    captureRevision: input.captureRevision,
    projectionVersion: MICRO_TUTORING_RESOURCE_PROJECTION_V2_VERSION,
    entries,
  };
}

export function applyMicroTutoringTeachingResourceSyncPlan(
  existingRows: TeachingResourceSyncRow[],
  plan: Extract<MicroTutoringTeachingResourceSyncPlan, { ok: true }>,
): TeachingResourceSyncRow[] {
  const rows = new Map(existingRows.map((row) => [row.id, { ...row, knowledgeNodeIds: [...row.knowledgeNodeIds] }]));
  for (const entry of plan.entries) {
    const previous = rows.get(entry.id);
    const knowledgeNodeIds = uniqueSorted([
      ...(previous?.knowledgeNodeIds ?? []),
      ...(entry.connectKnowledgeNodeId ? [entry.connectKnowledgeNodeId] : []),
    ]);
    rows.set(entry.id, {
      id: entry.id,
      registryId: entry.registryId,
      teacherOnly: false,
      title: previous?.title ?? entry.title,
      displayName: previous?.displayName ?? entry.title,
      description: previous?.description ?? entry.title,
      type: previous?.type ?? entry.type,
      category: previous?.category ?? null,
      content: previous?.content ?? null,
      config: entry.nextConfig,
      knowledgeNodeIds,
    });
  }
  return [...rows.values()].sort((left, right) => left.id.localeCompare(right.id));
}

export function toRemediationResourceRow(row: TeachingResourceSyncRow) {
  return {
    id: row.id,
    title: row.title,
    displayName: row.displayName ?? null,
    description: row.description ?? null,
    type: row.type,
    registryId: row.registryId,
    content: row.content ?? null,
    category: row.category ?? null,
    teacherOnly: row.teacherOnly,
    config: row.config,
    knowledgeNodes: row.knowledgeNodeIds.map((id) => ({
      id,
      name: id,
      resources: [],
      tags: [],
    })),
  };
}
