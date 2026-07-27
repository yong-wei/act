import {
  AuthoritativeProjectionCache,
  buildProjectionCacheKey,
} from './cache';
import type {
  AuthoritySelector,
  AuthoritativeKnowledgeSnapshot,
  ConsumerSemanticSupport,
  KnowledgeRole,
  ProjectionIdentity,
  RepositoryDiagnostic,
  RepositoryUnavailableReason,
  SemanticSupportMark,
} from './contracts';
import { AuthoritativeKnowledgeRepository } from './repository';

export const CANVAS_PROJECTION_VERSION = 'act.canvas.v2';
export const NODE_DETAIL_PROJECTION_VERSION = 'act.node-detail.v2';
export const MIGRATION_REVIEW_PROJECTION_VERSION = 'act.migration-review.v1';
export const CANDIDATE_RELEASE_LABEL = '根轨迹局部发布版';

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function identity(snapshot: AuthoritativeKnowledgeSnapshot): ProjectionIdentity {
  return {
    authorityState: snapshot.authorityState,
    releaseSetId: snapshot.releaseSet.id,
    releaseId: snapshot.release.id,
    productionAuthoritative: false,
  };
}

function safeLabel(payload: JsonObject, fallback: string): string {
  const preferredLabels = Array.isArray(payload.preferred_labels)
    ? payload.preferred_labels.map(object)
    : [];
  const preferred = preferredLabels.find((label) => (
    label.language === 'zh-CN' && typeof label.text === 'string'
  )) ?? preferredLabels.find((label) => typeof label.text === 'string');
  return typeof preferred?.text === 'string' ? preferred.text : fallback;
}

function semanticSupport(supported: boolean): SemanticSupportMark {
  return { supported, readOnly: true };
}

export interface CanvasProjection {
  projectionVersion: typeof CANVAS_PROJECTION_VERSION;
  source: ProjectionIdentity;
  release: {
    label: typeof CANDIDATE_RELEASE_LABEL;
    version: string;
    scope: string;
  };
  coverage: {
    status: 'partial';
    objectCount: number;
    relationCount: number;
    goldRelationCount: number;
    silverRelationCount: number;
    sourceObjectCount: number;
    evidenceSegmentCount: number;
  };
  teachingSemantics: {
    status: 'unavailable';
    message: '教学关系尚未发布';
  };
  nodes: Array<{
    id: string;
    canonicalType: string;
    label: string;
    description: string | null;
    governance: {
      reviewStatus: string | null;
      publicationStatus: string | null;
      lifecycleStatus: string | null;
    };
    semanticSupport: SemanticSupportMark;
  }>;
  relations: Array<{
    id: string;
    predicate: string;
    sourceId: string;
    targetId: string;
    direction: string | null;
    direct: boolean | null;
    qualityTier: string;
    governance: {
      reviewStatus: string | null;
      publicationStatus: string | null;
    };
    semanticSupport: SemanticSupportMark;
  }>;
}

export function buildCanvasProjection(
  snapshot: AuthoritativeKnowledgeSnapshot,
  support: ConsumerSemanticSupport,
): CanvasProjection {
  const supportedTypes = new Set(support.supportedObjectTypes);
  const supportedPredicates = new Set(support.supportedPredicates);
  return {
    projectionVersion: CANVAS_PROJECTION_VERSION,
    source: identity(snapshot),
    release: {
      label: CANDIDATE_RELEASE_LABEL,
      version: snapshot.release.releaseVersion,
      scope: snapshot.release.scope,
    },
    coverage: {
      status: 'partial',
      objectCount: snapshot.objects.length,
      relationCount: snapshot.relations.length,
      goldRelationCount: snapshot.relations.filter((row) => row.qualityTier === 'GOLD').length,
      silverRelationCount: snapshot.relations.filter((row) => row.qualityTier === 'SILVER').length,
      sourceObjectCount: snapshot.sourceObjects.length,
      evidenceSegmentCount: snapshot.evidence.length,
    },
    teachingSemantics: {
      status: 'unavailable',
      message: '教学关系尚未发布',
    },
    nodes: snapshot.objects.map((row) => {
      const payload = object(row.payload);
      return {
        id: row.canonicalId,
        canonicalType: row.canonicalType,
        label: safeLabel(payload, row.semanticName ?? row.canonicalId),
        description: stringOrNull(payload.description),
        governance: {
          reviewStatus: row.reviewStatus,
          publicationStatus: row.publicationStatus,
          lifecycleStatus: row.lifecycleStatus,
        },
        semanticSupport: semanticSupport(supportedTypes.has(row.canonicalType)),
      };
    }),
    relations: snapshot.relations.map((row) => {
      const payload = object(row.payload);
      return {
        id: row.relationId,
        predicate: row.relationType,
        sourceId: row.sourceId,
        targetId: row.targetId,
        direction: stringOrNull(payload.direction),
        direct: row.direct,
        qualityTier: row.qualityTier,
        governance: {
          reviewStatus: row.reviewStatus,
          publicationStatus: row.publicationStatus,
        },
        semanticSupport: semanticSupport(supportedPredicates.has(row.relationType)),
      };
    }),
  };
}

const TEACHING_FIELD_NAMES = [
  'concept_kind',
  'formula_latex',
  'formula_role',
  'statement_type',
  'model_kind',
  'temporal_domain',
  'linearity',
  'time_variance',
  'stochasticity',
  'representation_type',
  'represents_model',
] as const;

function teachingFields(payload: JsonObject): JsonObject {
  return Object.fromEntries(
    TEACHING_FIELD_NAMES
      .filter((field) => payload[field] !== undefined && payload[field] !== null)
      .map((field) => [field, payload[field]]),
  );
}

function adjacency(snapshot: AuthoritativeKnowledgeSnapshot, nodeId: string) {
  return snapshot.relations
    .filter((relation) => relation.sourceId === nodeId || relation.targetId === nodeId)
    .map((relation) => {
      const payload = object(relation.payload);
      return {
        relationId: relation.relationId,
        predicate: relation.relationType,
        direction: stringOrNull(payload.direction),
        qualityTier: relation.qualityTier,
        neighborId: relation.sourceId === nodeId ? relation.targetId : relation.sourceId,
        traversal: relation.sourceId === nodeId ? 'outgoing' as const : 'incoming' as const,
        readOnly: true as const,
      };
    });
}

export interface StudentNodeDetailProjection {
  projectionVersion: typeof NODE_DETAIL_PROJECTION_VERSION;
  source: ProjectionIdentity;
  role: 'STUDENT';
  node: {
    id: string;
    canonicalType: string;
    label: string;
    description: string | null;
    adjacency: ReturnType<typeof adjacency>;
    sources: Array<{
      sourceEditionId: string;
      sectionId: string;
    }>;
    semanticSupport: SemanticSupportMark;
  };
}

export interface TeacherNodeDetailProjection {
  projectionVersion: typeof NODE_DETAIL_PROJECTION_VERSION;
  source: ProjectionIdentity;
  role: 'TEACHER';
  node: StudentNodeDetailProjection['node'] & {
    aliases: string[];
    teachingFields: JsonObject;
    governance: {
      reviewStatus: string | null;
      publicationStatus: string | null;
      lifecycleStatus: string | null;
    };
    coverage: {
      sourceMappingCount: number;
      evidenceCount: number;
    };
    governanceTier: 'CORE' | 'EXTENSION' | 'UNCLASSIFIED';
  };
}

export interface AdminNodeDetailProjection {
  projectionVersion: typeof NODE_DETAIL_PROJECTION_VERSION;
  source: ProjectionIdentity & { controlledPath: string };
  role: 'ADMIN';
  node: TeacherNodeDetailProjection['node'] & {
    payload: unknown;
    sourceMappings: Array<{
      mappingId: string;
      sourceObjectId: string;
      mappingType: string;
      reviewStatus: string | null;
      payload: unknown;
    }>;
    sourceStubs: Array<{
      sourceObjectId: string;
      sourceId: string | null;
      sectionId: string | null;
      nodeType: string | null;
      reviewStatus: string | null;
      payload: unknown;
    }>;
    evidence: Array<{
      evidenceId: string;
      sourceEditionId: string;
      sectionId: string;
      segmentOrdinal: number;
      segmentType: string;
      contentHash: string;
      payload: unknown;
    }>;
  };
  receipt: {
    id: string;
    sourceRun: string;
    sourceImplementationCommit: string;
    captureRevision: string;
    lockRawHash: string;
  } | null;
  diagnostics: RepositoryDiagnostic[];
  activeConsumerRebinding: 'not-started';
}

export type NodeDetailProjection =
  | StudentNodeDetailProjection
  | TeacherNodeDetailProjection
  | AdminNodeDetailProjection;

export function buildNodeDetailProjection(
  snapshot: AuthoritativeKnowledgeSnapshot,
  role: KnowledgeRole,
  nodeId: string,
  support: ConsumerSemanticSupport,
  diagnostics: RepositoryDiagnostic[] = [],
): NodeDetailProjection | null {
  if (role !== 'STUDENT' && role !== 'TEACHER' && role !== 'ADMIN') {
    throw new TypeError(`Unsupported authoritative knowledge role: ${String(role)}`);
  }
  const row = snapshot.objects.find((item) => item.canonicalId === nodeId);
  if (!row) return null;
  const payload = object(row.payload);
  const evidenceIds = new Set(strings(payload.evidence_segment_ids));
  const baseNode: StudentNodeDetailProjection['node'] = {
    id: row.canonicalId,
    canonicalType: row.canonicalType,
    label: safeLabel(payload, row.semanticName ?? row.canonicalId),
    description: stringOrNull(payload.description),
    adjacency: adjacency(snapshot, row.canonicalId),
    sources: snapshot.evidence
      .filter((item) => evidenceIds.has(item.evidenceId))
      .map((item) => ({
        sourceEditionId: item.sourceEditionId,
        sectionId: item.sectionId,
      })),
    semanticSupport: semanticSupport(support.supportedObjectTypes.includes(row.canonicalType)),
  };
  const base = {
    projectionVersion: NODE_DETAIL_PROJECTION_VERSION,
    source: identity(snapshot),
  } as const;
  if (role === 'STUDENT') return { ...base, role, node: baseNode };

  const mappings = snapshot.sourceMappings.filter((mapping) => mapping.canonicalId === row.canonicalId);
  const adjacentRelations = snapshot.relations.filter((relation) => (
    relation.sourceId === row.canonicalId || relation.targetId === row.canonicalId
  ));
  const teacherNode: TeacherNodeDetailProjection['node'] = {
    ...baseNode,
    aliases: strings(payload.aliases),
    teachingFields: teachingFields(payload),
    governance: {
      reviewStatus: row.reviewStatus,
      publicationStatus: row.publicationStatus,
      lifecycleStatus: row.lifecycleStatus,
    },
    coverage: {
      sourceMappingCount: mappings.length,
      evidenceCount: snapshot.evidence.filter((item) => evidenceIds.has(item.evidenceId)).length,
    },
    governanceTier: adjacentRelations.some((relation) => relation.qualityTier === 'GOLD')
      ? 'CORE'
      : adjacentRelations.some((relation) => relation.qualityTier === 'SILVER')
        ? 'EXTENSION'
        : 'UNCLASSIFIED',
  };
  if (role === 'TEACHER') return { ...base, role, node: teacherNode };

  const mappedSourceIds = new Set(mappings.map((mapping) => mapping.sourceObjectId));
  return {
    ...base,
    source: { ...base.source, controlledPath: snapshot.releaseSet.controlledPath },
    role,
    node: {
      ...teacherNode,
      payload: row.payload,
      sourceMappings: mappings.map((mapping) => ({
        mappingId: mapping.mappingId,
        sourceObjectId: mapping.sourceObjectId,
        mappingType: mapping.mappingType,
        reviewStatus: mapping.reviewStatus,
        payload: mapping.payload,
      })),
      sourceStubs: snapshot.sourceObjects
        .filter((source) => mappedSourceIds.has(source.sourceObjectId))
        .map((source) => ({
          sourceObjectId: source.sourceObjectId,
          sourceId: source.sourceId,
          sectionId: source.sectionId,
          nodeType: source.nodeType,
          reviewStatus: source.reviewStatus,
          payload: source.payload,
        })),
      evidence: snapshot.evidence
        .filter((item) => evidenceIds.has(item.evidenceId))
        .map((item) => ({
          evidenceId: item.evidenceId,
          sourceEditionId: item.sourceEditionId,
          sectionId: item.sectionId,
          segmentOrdinal: item.segmentOrdinal,
          segmentType: item.segmentType,
          contentHash: item.contentHash,
          payload: item.payload,
        })),
    },
    receipt: snapshot.receipt ? {
      id: snapshot.receipt.id,
      sourceRun: snapshot.receipt.sourceRun,
      sourceImplementationCommit: snapshot.receipt.sourceImplementationCommit,
      captureRevision: snapshot.receipt.captureRevision,
      lockRawHash: snapshot.receipt.lockRawHash,
    } : null,
    diagnostics,
    activeConsumerRebinding: 'not-started',
  };
}

export interface MigrationReviewProjection {
  projectionVersion: typeof MIGRATION_REVIEW_PROJECTION_VERSION;
  source: ProjectionIdentity & { controlledPath: string };
  role: 'ADMIN';
  ingest: {
    receipt: AuthoritativeKnowledgeSnapshot['receipt'];
    expectedCounts: Record<string, number> | null;
    actualCounts: Record<string, number>;
    drift: RepositoryDiagnostic[];
  };
  legacyArchive: 'not-ready';
  activeConsumerRebinding: 'not-started';
  readOnly: true;
}

export function buildMigrationReviewProjection(
  snapshot: AuthoritativeKnowledgeSnapshot,
  diagnostics: RepositoryDiagnostic[],
): MigrationReviewProjection {
  const receipt = snapshot.receipt;
  return {
    projectionVersion: MIGRATION_REVIEW_PROJECTION_VERSION,
    source: { ...identity(snapshot), controlledPath: snapshot.releaseSet.controlledPath },
    role: 'ADMIN',
    ingest: {
      receipt,
      expectedCounts: receipt ? {
        objects: receipt.objectCount,
        sourceMappings: receipt.sourceMappingCount,
        goldRelations: receipt.goldRelationCount,
        silverRelations: receipt.silverRelationCount,
        sourceObjects: receipt.sourceObjectCount,
        evidence: receipt.evidenceSegmentCount,
      } : null,
      actualCounts: {
        objects: snapshot.objects.length,
        sourceMappings: snapshot.sourceMappings.length,
        goldRelations: snapshot.relations.filter((row) => row.qualityTier === 'GOLD').length,
        silverRelations: snapshot.relations.filter((row) => row.qualityTier === 'SILVER').length,
        sourceObjects: snapshot.sourceObjects.length,
        evidence: snapshot.evidence.length,
      },
      drift: diagnostics,
    },
    legacyArchive: 'not-ready',
    activeConsumerRebinding: 'not-started',
    readOnly: true,
  };
}

export type ProjectionResult<T> =
  | { status: 'available'; projection: T; diagnostics: RepositoryDiagnostic[] }
  | {
      status: 'drift';
      selector: AuthoritySelector;
      diagnostics: RepositoryDiagnostic[];
    }
  | {
      status: 'unavailable';
      reason: RepositoryUnavailableReason;
      selector: AuthoritySelector;
      diagnostics: RepositoryDiagnostic[];
    };

export class AuthoritativeKnowledgeProjectionService {
  constructor(
    private readonly repository = new AuthoritativeKnowledgeRepository(),
    private readonly cache = new AuthoritativeProjectionCache(),
  ) {}

  private async snapshot(selector: AuthoritySelector) {
    return this.repository.read(selector);
  }

  async canvas(
    selector: AuthoritySelector,
    support: ConsumerSemanticSupport,
  ): Promise<ProjectionResult<CanvasProjection>> {
    const result = await this.snapshot(selector);
    if (result.status === 'unavailable') return result;
    if (result.status === 'drift') {
      return { status: 'drift', selector: result.selector, diagnostics: result.diagnostics };
    }
    const key = buildProjectionCacheKey({
      projectionVersion: CANVAS_PROJECTION_VERSION,
      authorityState: selector.authorityState,
      releaseSetId: result.snapshot.releaseSet.id,
      releaseId: result.snapshot.release.id,
      role: 'NONE',
      support,
    });
    const cached = this.cache.get<CanvasProjection>(key);
    if (cached) return { status: 'available', projection: cached, diagnostics: result.diagnostics };
    const projection = buildCanvasProjection(result.snapshot, support);
    this.cache.set(key, projection);
    return { status: 'available', projection, diagnostics: result.diagnostics };
  }

  async nodeDetail(
    selector: AuthoritySelector,
    role: KnowledgeRole,
    nodeId: string,
    support: ConsumerSemanticSupport,
  ): Promise<ProjectionResult<NodeDetailProjection>> {
    const result = await this.snapshot(selector);
    if (result.status === 'unavailable') return result;
    if (result.status === 'drift') {
      return { status: 'drift', selector: result.selector, diagnostics: result.diagnostics };
    }
    const key = buildProjectionCacheKey({
      projectionVersion: NODE_DETAIL_PROJECTION_VERSION,
      authorityState: selector.authorityState,
      releaseSetId: result.snapshot.releaseSet.id,
      releaseId: result.snapshot.release.id,
      role,
      nodeId,
      support,
    });
    const cached = this.cache.get<NodeDetailProjection>(key);
    if (cached) return { status: 'available', projection: cached, diagnostics: result.diagnostics };
    const projection = buildNodeDetailProjection(result.snapshot, role, nodeId, support, result.diagnostics);
    if (!projection) {
      return { status: 'unavailable', reason: 'node-not-found', selector, diagnostics: result.diagnostics };
    }
    this.cache.set(key, projection);
    return { status: 'available', projection, diagnostics: result.diagnostics };
  }

  async migrationReview(
    selector: AuthoritySelector,
    role: KnowledgeRole,
    support: ConsumerSemanticSupport,
  ): Promise<ProjectionResult<MigrationReviewProjection>> {
    if (role !== 'ADMIN') {
      return { status: 'unavailable', reason: 'role-forbidden', selector, diagnostics: [] };
    }
    const result = await this.snapshot(selector);
    if (result.status === 'unavailable') return result;
    const key = buildProjectionCacheKey({
      projectionVersion: MIGRATION_REVIEW_PROJECTION_VERSION,
      authorityState: selector.authorityState,
      releaseSetId: result.snapshot.releaseSet.id,
      releaseId: result.snapshot.release.id,
      role,
      support,
    });
    const cached = this.cache.get<MigrationReviewProjection>(key);
    if (cached) return { status: 'available', projection: cached, diagnostics: result.diagnostics };
    const projection = buildMigrationReviewProjection(result.snapshot, result.diagnostics);
    this.cache.set(key, projection);
    return { status: 'available', projection, diagnostics: result.diagnostics };
  }
}
