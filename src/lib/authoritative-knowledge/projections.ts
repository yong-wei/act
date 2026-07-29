import {
  AuthoritativeProjectionCache,
  buildProjectionCacheKey,
} from './cache';
import {
  CTKG_0_2_EVIDENCE_STATES,
  CTKG_0_2_PROJECTED_ENTITY_TYPES,
  CTKG_0_2_PROJECTION_DIRECTIONS,
  CTKG_0_2_RELATION_FAMILIES,
  CTKG_0_2_RELATION_SEMANTIC_CONTRACT,
  CTKG_0_2_RELATION_TYPES,
  CTKG_0_2_RELEASE_TIERS,
  CURRENT_AGGREGATE_RELEASE_SET_ID,
  HISTORICAL_ROOT_LOCUS_RELEASE_SET_ID,
  isAggregateReleaseProtocol,
  isExactAggregateReleaseProtocol,
  isStandardPublicBundleProtocol,
  type AuthoritySelector,
  type AuthoritativeKnowledgeSnapshot,
  type ConsumerSemanticSupport,
  type KnowledgeRole,
  type ProjectionIdentity,
  type RepositoryDiagnostic,
  type RepositoryUnavailableReason,
  type SemanticSupportMark,
} from './contracts';
import { AuthoritativeKnowledgeRepository } from './repository';

export const CANVAS_PROJECTION_VERSION = 'act.canvas.v2';
export const NODE_DETAIL_PROJECTION_VERSION = 'act.node-detail.v2';
export const MIGRATION_REVIEW_PROJECTION_VERSION = 'act.migration-review.v1';
export const CANDIDATE_RELEASE_LABEL = '控制理论工程聚合发布版';
export const HISTORICAL_RELEASE_LABEL = '根轨迹局部发布版';

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
  const base: ProjectionIdentity = {
    authorityState: snapshot.authorityState,
    releaseSetId: snapshot.releaseSet.id,
    releaseId: snapshot.release.id,
    productionAuthoritative: false,
    historical: snapshot.historical,
    releaseHash: snapshot.release.releaseHash,
    schemaVersion: snapshot.release.schemaVersion ?? null,
    projectionDigest: snapshot.release.projectionDigest ?? null,
    sourceDatasetHash: snapshot.release.sourceDatasetHash ?? null,
  };
  // Exact #1125 and historical CTKG 0.1 must not grow own-keys for the new
  // runtime Projection fields — response JSON and Object.keys must match pre-#1131.
  if (!isStandardPublicBundleProtocol(snapshot.release.protocol)) {
    return base;
  }
  const runtimeIdentity = (snapshot.projectionIdentities ?? []).find((row) => row.isRuntime)
    ?? null;
  return {
    ...base,
    runtimeProjectionId: runtimeIdentity?.projectionId
      ?? snapshot.bundleReceipt?.runtimeProjectionId
      ?? null,
    runtimeProjectionProfile: runtimeIdentity?.projectionProfile
      ?? snapshot.bundleReceipt?.runtimeProjectionProfile
      ?? null,
  };
}

function projectionCacheBinding(snapshot: AuthoritativeKnowledgeSnapshot): {
  releaseSetId: string;
  releaseId: string;
  releaseHash: string | null;
  sourceDatasetHash: string | null;
  projectionDigest: string | null;
  runtimeProjectionId?: string;
  runtimeProjectionProfile?: string;
} {
  const source = identity(snapshot);
  const binding: {
    releaseSetId: string;
    releaseId: string;
    releaseHash: string | null;
    sourceDatasetHash: string | null;
    projectionDigest: string | null;
    runtimeProjectionId?: string;
    runtimeProjectionProfile?: string;
  } = {
    releaseSetId: source.releaseSetId,
    releaseId: source.releaseId,
    releaseHash: source.releaseHash ?? null,
    sourceDatasetHash: source.sourceDatasetHash ?? null,
    projectionDigest: source.projectionDigest ?? null,
  };
  // Only standard candidates append runtime segments to cache keys.
  if (isStandardPublicBundleProtocol(snapshot.release.protocol)) {
    if (typeof source.runtimeProjectionId === 'string') {
      binding.runtimeProjectionId = source.runtimeProjectionId;
    }
    if (typeof source.runtimeProjectionProfile === 'string') {
      binding.runtimeProjectionProfile = source.runtimeProjectionProfile;
    }
  }
  return binding;
}

/**
 * Expected Artifact count for migration-review ingest.
 * Exact #1125: semantic import receipt.artifactCount (null → 0 for historical shape).
 * Standard Bundle: packaging BundleReceipt.artifactCount only. Missing accepted
 * Bundle receipt / non-numeric artifactCount is fail-closed — never invent 0
 * or sentinel negatives in governance responses.
 */
function expectedArtifactCountForMigrationReview(
  snapshot: AuthoritativeKnowledgeSnapshot,
): number {
  if (isStandardPublicBundleProtocol(snapshot.release.protocol)) {
    const count = snapshot.bundleReceipt?.artifactCount;
    if (!snapshot.bundleReceipt || typeof count !== 'number' || !Number.isFinite(count)) {
      throw new TypeError(
        'standard public Bundle migration-review requires an accepted Bundle receipt with numeric artifactCount',
      );
    }
    return count;
  }
  return snapshot.receipt?.artifactCount ?? 0;
}

function actualArtifactCount(snapshot: AuthoritativeKnowledgeSnapshot): number {
  if (isStandardPublicBundleProtocol(snapshot.release.protocol)) {
    return snapshot.bundleArtifacts?.length ?? 0;
  }
  return snapshot.releaseArtifacts?.length ?? 0;
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

export interface ProjectionFieldDeclaration {
  included: readonly string[];
  hidden: readonly string[];
}

/**
 * Fail-closed validation of the pinned GraphProjection V2 consumer contract.
 * Runtime direction repair is removed: any predicate, direction, family,
 * evidence state, tier, entity type, or endpoint that violates the pinned
 * vocabulary aborts candidate loading instead of being corrected on the fly.
 * Individually legal fields whose predicate → direction → relation_family
 * combination is absent from the pinned CTKG 0.2 semantic contract are
 * rejected the same way.
 */
export class AggregateProjectionContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'AggregateProjectionContractError';
  }
}

export function assertPinnedAggregateProjectionContract(
  snapshot: AuthoritativeKnowledgeSnapshot,
): void {
  const conflicts: string[] = [];
  const nodes = snapshot.projectionNodes ?? [];
  const links = snapshot.projectionLinks ?? [];
  const entityTypes = new Set<string>(CTKG_0_2_PROJECTED_ENTITY_TYPES);
  const tiers = new Set<string>(CTKG_0_2_RELEASE_TIERS);
  const relationTypes = new Set<string>(CTKG_0_2_RELATION_TYPES);
  const directions = new Set<string>(CTKG_0_2_PROJECTION_DIRECTIONS);
  const families = new Set<string>(CTKG_0_2_RELATION_FAMILIES);
  const evidenceStates = new Set<string>(CTKG_0_2_EVIDENCE_STATES);

  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (!entityTypes.has(node.entityType)) {
      conflicts.push(`node ${node.nodeId} declares unregistered entity_type ${node.entityType}`);
    }
    if (!tiers.has(node.releaseTier)) {
      conflicts.push(`node ${node.nodeId} declares unregistered release_tier ${node.releaseTier}`);
    }
    nodeIds.add(node.nodeId);
  }
  for (const link of links) {
    if (!relationTypes.has(link.relationType)) {
      conflicts.push(`link ${link.linkId} declares unregistered relation_type ${link.relationType}`);
    }
    if (!directions.has(link.direction)) {
      conflicts.push(`link ${link.linkId} declares unregistered direction ${link.direction}`);
    }
    if (!families.has(link.relationFamily)) {
      conflicts.push(`link ${link.linkId} declares unregistered relation_family ${link.relationFamily}`);
    }
    if (!evidenceStates.has(link.evidenceState)) {
      conflicts.push(`link ${link.linkId} declares unregistered evidence_state ${link.evidenceState}`);
    }
    const pinned: { direction: string; relationFamily: string } | undefined =
      CTKG_0_2_RELATION_SEMANTIC_CONTRACT[link.relationType as keyof typeof CTKG_0_2_RELATION_SEMANTIC_CONTRACT];
    if (!pinned || pinned.direction !== link.direction || pinned.relationFamily !== link.relationFamily) {
      conflicts.push(
        `link ${link.linkId} declares predicate combination ${link.relationType}/${link.direction}/${link.relationFamily} outside the pinned contract`,
      );
    }
    if (!nodeIds.has(link.sourceId) || !nodeIds.has(link.targetId)) {
      conflicts.push(`link ${link.linkId} has an endpoint outside the projection node set`);
    }
  }
  if (conflicts.length > 0) {
    const shown = conflicts.slice(0, 8).join('; ');
    const rest = conflicts.length > 8 ? `; … and ${conflicts.length - 8} more conflicts` : '';
    throw new AggregateProjectionContractError(
      `CTKG 0.2 projection violates the pinned consumer contract: ${shown}${rest}`,
    );
  }
}

/**
 * Structural fail-closed checks for standard public Bundle runtime Projections.
 * Registered contracts were enforced at import; unregistered but structurally
 * valid types/predicates remain available for generic read-only consumers.
 */
export function assertStandardRuntimeProjectionStructure(
  snapshot: AuthoritativeKnowledgeSnapshot,
): void {
  const conflicts: string[] = [];
  const nodes = snapshot.projectionNodes ?? [];
  const links = snapshot.projectionLinks ?? [];
  if (nodes.length === 0) {
    throw new AggregateProjectionContractError(
      'standard runtime Projection is empty or missing',
    );
  }
  if (
    !snapshot.release.projectionDigest
    || (snapshot.bundleReceipt
      && snapshot.bundleReceipt.runtimeProjectionDigest !== snapshot.release.projectionDigest)
  ) {
    throw new AggregateProjectionContractError(
      'standard runtime Projection digest is missing or disagrees with the accepted Bundle receipt',
    );
  }
  const nodeIds = new Set(nodes.map((node) => node.nodeId));
  for (const link of links) {
    if (!nodeIds.has(link.sourceId) || !nodeIds.has(link.targetId)) {
      conflicts.push(`link ${link.linkId} has an endpoint outside the projection node set`);
    }
  }
  if (conflicts.length > 0) {
    const shown = conflicts.slice(0, 8).join('; ');
    const rest = conflicts.length > 8 ? `; … and ${conflicts.length - 8} more conflicts` : '';
    throw new AggregateProjectionContractError(
      `standard runtime Projection is structurally invalid: ${shown}${rest}`,
    );
  }
}

function assertCandidateRuntimeProjection(snapshot: AuthoritativeKnowledgeSnapshot): void {
  if (isExactAggregateReleaseProtocol(snapshot.release.protocol)) {
    assertPinnedAggregateProjectionContract(snapshot);
    return;
  }
  assertStandardRuntimeProjectionStructure(snapshot);
}

function aggregateTierByEntityId(
  snapshot: AuthoritativeKnowledgeSnapshot,
): Map<string, string> {
  return new Map(
    (snapshot.releaseEntries ?? []).map((entry) => [entry.entityId, entry.releaseTier]),
  );
}

function displayTierFromReleaseTier(tier: string | null | undefined): string {
  if (tier === 'gold') return 'GOLD';
  if (tier === 'silver') return 'SILVER';
  return typeof tier === 'string' ? tier.toUpperCase() : 'UNCLASSIFIED';
}

function governanceTierFromReleaseTier(
  tier: string | null | undefined,
): 'CORE' | 'EXTENSION' | 'UNCLASSIFIED' {
  if (tier === 'gold') return 'CORE';
  if (tier === 'silver') return 'EXTENSION';
  return 'UNCLASSIFIED';
}

export interface CanvasProjection {
  projectionVersion: typeof CANVAS_PROJECTION_VERSION;
  source: ProjectionIdentity;
  release: {
    label: string;
    version: string;
    scope: string;
  };
  fields: ProjectionFieldDeclaration;
  coverage: {
    status: 'partial';
    objectCount: number;
    relationCount: number;
    goldRelationCount: number;
    silverRelationCount: number;
    sourceObjectCount: number;
    evidenceSegmentCount: number;
    // Aggregate release coverage; absent for historical CTKG 0.1 releases.
    releaseEntryCount?: number;
    goldNodeCount?: number;
    silverNodeCount?: number;
    upstreamRagReferenceCount?: number;
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
    // GraphProjection V2 public fields; absent for historical CTKG 0.1 nodes.
    releaseTier?: string;
    candidate?: boolean;
    semanticName?: string | null;
    sourceCoverageCount?: number;
    conceptKind?: string | null;
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
    // GraphProjection V2 public fields; absent for historical CTKG 0.1 links.
    relationFamily?: string;
    evidenceState?: string;
    releaseTier?: string | null;
    semanticSupport: SemanticSupportMark;
  }>;
}

const CANVAS_FIELDS: ProjectionFieldDeclaration = {
  included: [
    'node.id',
    'node.canonicalType',
    'node.label',
    'node.description',
    'node.governance',
    'node.releaseTier',
    'node.candidate',
    'node.semanticName',
    'node.sourceCoverageCount',
    'node.conceptKind',
    'relation.id',
    'relation.predicate',
    'relation.sourceId',
    'relation.targetId',
    'relation.direction',
    'relation.qualityTier',
    'relation.relationFamily',
    'relation.evidenceState',
    'relation.releaseTier',
  ],
  hidden: [
    'node.payload',
    'relation.payload',
    'releaseEntries.inclusionReason',
    'artifact.bytes',
  ],
};

export function buildCanvasProjection(
  snapshot: AuthoritativeKnowledgeSnapshot,
  support: ConsumerSemanticSupport,
): CanvasProjection {
  if (isAggregateReleaseProtocol(snapshot.release.protocol)) {
    return buildAggregateCanvasProjection(snapshot, support);
  }
  const supportedTypes = new Set(support.supportedObjectTypes);
  const supportedPredicates = new Set(support.supportedPredicates);
  return {
    projectionVersion: CANVAS_PROJECTION_VERSION,
    source: identity(snapshot),
    release: {
      label: HISTORICAL_RELEASE_LABEL,
      version: snapshot.release.releaseVersion,
      scope: snapshot.release.scope,
    },
    fields: CANVAS_FIELDS,
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

function buildAggregateCanvasProjection(
  snapshot: AuthoritativeKnowledgeSnapshot,
  support: ConsumerSemanticSupport,
): CanvasProjection {
  assertCandidateRuntimeProjection(snapshot);
  const supportedTypes = new Set(support.supportedObjectTypes);
  const supportedPredicates = new Set(support.supportedPredicates);
  const tierByEntityId = aggregateTierByEntityId(snapshot);
  const nodes = (snapshot.projectionNodes ?? []).map((row) => {
    const payload = object(row.payload);
    return {
      id: row.nodeId,
      canonicalType: row.entityType,
      label: row.displayName || row.semanticName || row.nodeId,
      description: stringOrNull(payload.description),
      governance: {
        reviewStatus: row.reviewStatus,
        publicationStatus: row.publicationStatus,
        lifecycleStatus: null,
      },
      releaseTier: row.releaseTier,
      candidate: row.candidate,
      semanticName: row.semanticName,
      sourceCoverageCount: row.sourceCoverageCount,
      conceptKind: stringOrNull(payload.concept_kind),
      semanticSupport: semanticSupport(supportedTypes.has(row.entityType)),
    };
  });
  const relations = (snapshot.projectionLinks ?? []).map((row) => {
    const releaseTier = tierByEntityId.get(row.relationId) ?? null;
    return {
      id: row.linkId,
      predicate: row.relationType,
      sourceId: row.sourceId,
      targetId: row.targetId,
      direction: row.direction,
      direct: null,
      qualityTier: displayTierFromReleaseTier(releaseTier),
      governance: {
        reviewStatus: null,
        publicationStatus: null,
      },
      relationFamily: row.relationFamily,
      evidenceState: row.evidenceState,
      releaseTier,
      semanticSupport: semanticSupport(supportedPredicates.has(row.relationType)),
    };
  });
  return {
    projectionVersion: CANVAS_PROJECTION_VERSION,
    source: identity(snapshot),
    release: {
      label: CANDIDATE_RELEASE_LABEL,
      version: snapshot.release.releaseVersion,
      scope: snapshot.release.scope,
    },
    fields: CANVAS_FIELDS,
    coverage: {
      status: 'partial',
      objectCount: nodes.length,
      relationCount: relations.length,
      goldRelationCount: relations.filter((row) => row.releaseTier === 'gold').length,
      silverRelationCount: relations.filter((row) => row.releaseTier === 'silver').length,
      sourceObjectCount: 0,
      evidenceSegmentCount: 0,
      releaseEntryCount: snapshot.releaseEntries?.length ?? 0,
      goldNodeCount: nodes.filter((row) => row.releaseTier === 'gold').length,
      silverNodeCount: nodes.filter((row) => row.releaseTier === 'silver').length,
      upstreamRagReferenceCount: snapshot.upstreamRagReferences?.length ?? 0,
    },
    teachingSemantics: {
      status: 'unavailable',
      message: '教学关系尚未发布',
    },
    nodes,
    relations,
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

export interface NodeAdjacencyEntry {
  relationId: string;
  predicate: string;
  direction: string | null;
  qualityTier: string;
  neighborId: string;
  traversal: 'outgoing' | 'incoming';
  readOnly: true;
  // GraphProjection V2 public fields; absent for historical CTKG 0.1 links.
  relationFamily?: string;
  evidenceState?: string;
  releaseTier?: string | null;
}

function adjacency(snapshot: AuthoritativeKnowledgeSnapshot, nodeId: string): NodeAdjacencyEntry[] {
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

function aggregateAdjacency(
  snapshot: AuthoritativeKnowledgeSnapshot,
  nodeId: string,
  tierByEntityId: Map<string, string>,
): NodeAdjacencyEntry[] {
  return (snapshot.projectionLinks ?? [])
    .filter((link) => link.sourceId === nodeId || link.targetId === nodeId)
    .map((link) => {
      const releaseTier = tierByEntityId.get(link.relationId) ?? null;
      return {
        relationId: link.relationId,
        predicate: link.relationType,
        direction: link.direction,
        qualityTier: displayTierFromReleaseTier(releaseTier),
        neighborId: link.sourceId === nodeId ? link.targetId : link.sourceId,
        traversal: link.sourceId === nodeId ? 'outgoing' as const : 'incoming' as const,
        readOnly: true as const,
        relationFamily: link.relationFamily,
        evidenceState: link.evidenceState,
        releaseTier,
      };
    });
}

export interface StudentNodeDetailProjection {
  projectionVersion: typeof NODE_DETAIL_PROJECTION_VERSION;
  source: ProjectionIdentity;
  role: 'STUDENT';
  fields: ProjectionFieldDeclaration;
  node: {
    id: string;
    canonicalType: string;
    label: string;
    description: string | null;
    adjacency: NodeAdjacencyEntry[];
    sources: Array<{
      sourceEditionId: string;
      sectionId: string;
    }>;
    semanticSupport: SemanticSupportMark;
    /** GraphProjection V2 release tier; absent for historical CTKG 0.1 nodes. */
    releaseTier?: string;
  };
}

export interface TeacherNodeDetailProjection {
  projectionVersion: typeof NODE_DETAIL_PROJECTION_VERSION;
  source: ProjectionIdentity;
  role: 'TEACHER';
  fields: ProjectionFieldDeclaration;
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
      /** GraphProjection V2 upstream source coverage; CTKG 0.2 only. */
      sourceCoverageCount?: number;
      /** Opaque upstream RAG references for this entity; CTKG 0.2 only. */
      upstreamRagReferenceCount?: number;
    };
    governanceTier: 'CORE' | 'EXTENSION' | 'UNCLASSIFIED';
    /** GraphProjection V2 candidate flag; CTKG 0.2 only. */
    candidate?: boolean;
    /** Opaque upstream RAG crosswalk identifiers; CTKG 0.2 only. */
    upstreamRagReferences?: Array<{
      retrievalChunkId: string;
      citationTargetId: string;
    }>;
  };
}

export interface AdminNodeDetailProjection {
  projectionVersion: typeof NODE_DETAIL_PROJECTION_VERSION;
  source: ProjectionIdentity & { controlledPath: string };
  role: 'ADMIN';
  fields: ProjectionFieldDeclaration;
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
    sourceRun: string | null;
    sourceImplementationCommit: string | null;
    captureRevision: string;
    lockRawHash: string;
    /** Aggregate release lineage; present for CTKG 0.2 receipts only. */
    schemaVersion?: string | null;
    projectionId?: string | null;
    projectionDigest?: string | null;
    sourceDatasetHash?: string | null;
  } | null;
  diagnostics: RepositoryDiagnostic[];
  activeConsumerRebinding: 'not-started';
}

export type NodeDetailProjection =
  | StudentNodeDetailProjection
  | TeacherNodeDetailProjection
  | AdminNodeDetailProjection;

const NODE_DETAIL_FIELDS: Record<KnowledgeRole, ProjectionFieldDeclaration> = {
  STUDENT: {
    included: [
      'node.id',
      'node.canonicalType',
      'node.label',
      'node.description',
      'node.adjacency',
      'node.sources',
      'node.releaseTier',
    ],
    hidden: [
      'node.payload',
      'node.aliases',
      'node.teachingFields',
      'node.governance',
      'node.coverage',
      'node.upstreamRagReferences',
      'receipt',
      'diagnostics',
    ],
  },
  TEACHER: {
    included: [
      'node.id',
      'node.canonicalType',
      'node.label',
      'node.description',
      'node.adjacency',
      'node.sources',
      'node.releaseTier',
      'node.aliases',
      'node.teachingFields',
      'node.governance',
      'node.coverage',
      'node.governanceTier',
      'node.candidate',
      'node.upstreamRagReferences',
    ],
    hidden: [
      'node.payload',
      'node.sourceMappings',
      'node.sourceStubs',
      'node.evidence',
      'receipt',
      'diagnostics',
    ],
  },
  ADMIN: {
    included: [
      'node.id',
      'node.canonicalType',
      'node.label',
      'node.description',
      'node.adjacency',
      'node.sources',
      'node.releaseTier',
      'node.aliases',
      'node.teachingFields',
      'node.governance',
      'node.coverage',
      'node.governanceTier',
      'node.candidate',
      'node.upstreamRagReferences',
      'node.payload',
      'node.sourceMappings',
      'node.sourceStubs',
      'node.evidence',
      'receipt',
      'diagnostics',
    ],
    hidden: ['artifact.bytes'],
  },
};

export interface CanonicalSearchProjection {
  projectionVersion: 'act.canonical-search.v1';
  source: ProjectionIdentity;
  role: KnowledgeRole;
  query: string;
  results: Array<{
    id: string;
    canonicalType: string;
    label: string;
    description: string | null;
    governanceTier: 'CORE' | 'EXTENSION' | 'UNCLASSIFIED';
    semanticSupport: SemanticSupportMark;
    /** GraphProjection V2 release tier; absent for historical CTKG 0.1 reads. */
    releaseTier?: string;
  }>;
}

export interface BoundedNeighborProjection {
  projectionVersion: 'act.bounded-neighbors.v1';
  source: ProjectionIdentity;
  role: KnowledgeRole;
  nodeId: string;
  limit: number;
  truncated: boolean;
  neighbors: Array<{
    relationId: string;
    predicate: string;
    direction: string | null;
    qualityTier: string;
    traversal: 'outgoing' | 'incoming';
    neighbor: {
      id: string;
      canonicalType: string;
      label: string;
    };
    governance: {
      reviewStatus: string | null;
      publicationStatus: string | null;
    };
    readOnly: true;
    /** GraphProjection V2 public fields; absent for historical CTKG 0.1 links. */
    relationFamily?: string;
    evidenceState?: string;
    releaseTier?: string | null;
  }>;
}

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
  if (isAggregateReleaseProtocol(snapshot.release.protocol)) {
    return buildAggregateNodeDetailProjection(snapshot, role, nodeId, support, diagnostics);
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
  if (role === 'STUDENT') {
    return { ...base, role, fields: NODE_DETAIL_FIELDS.STUDENT, node: baseNode };
  }

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
  if (role === 'TEACHER') {
    return { ...base, role, fields: NODE_DETAIL_FIELDS.TEACHER, node: teacherNode };
  }

  const mappedSourceIds = new Set(mappings.map((mapping) => mapping.sourceObjectId));
  return {
    ...base,
    source: { ...base.source, controlledPath: snapshot.releaseSet.controlledPath },
    role,
    fields: NODE_DETAIL_FIELDS.ADMIN,
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

function buildAggregateNodeDetailProjection(
  snapshot: AuthoritativeKnowledgeSnapshot,
  role: KnowledgeRole,
  nodeId: string,
  support: ConsumerSemanticSupport,
  diagnostics: RepositoryDiagnostic[],
): NodeDetailProjection | null {
  assertCandidateRuntimeProjection(snapshot);
  const row = (snapshot.projectionNodes ?? []).find((item) => item.nodeId === nodeId);
  if (!row) return null;
  const payload = object(row.payload);
  const tierByEntityId = aggregateTierByEntityId(snapshot);
  const ragReferences = (snapshot.upstreamRagReferences ?? [])
    .filter((reference) => reference.publishedEntityId === row.entityId)
    .map((reference) => ({
      retrievalChunkId: reference.retrievalChunkId,
      citationTargetId: reference.citationTargetId,
    }));
  const baseNode: StudentNodeDetailProjection['node'] = {
    id: row.nodeId,
    canonicalType: row.entityType,
    label: row.displayName || row.semanticName || row.nodeId,
    description: stringOrNull(payload.description),
    adjacency: aggregateAdjacency(snapshot, row.nodeId, tierByEntityId),
    sources: [],
    semanticSupport: semanticSupport(support.supportedObjectTypes.includes(row.entityType)),
    releaseTier: row.releaseTier,
  };
  const base = {
    projectionVersion: NODE_DETAIL_PROJECTION_VERSION,
    source: identity(snapshot),
  } as const;
  if (role === 'STUDENT') {
    return { ...base, role, fields: NODE_DETAIL_FIELDS.STUDENT, node: baseNode };
  }

  const teacherNode: TeacherNodeDetailProjection['node'] = {
    ...baseNode,
    aliases: [],
    teachingFields: teachingFields(payload),
    governance: {
      reviewStatus: row.reviewStatus,
      publicationStatus: row.publicationStatus,
      lifecycleStatus: null,
    },
    coverage: {
      sourceMappingCount: 0,
      evidenceCount: 0,
      sourceCoverageCount: row.sourceCoverageCount,
      upstreamRagReferenceCount: ragReferences.length,
    },
    governanceTier: governanceTierFromReleaseTier(row.releaseTier),
    candidate: row.candidate,
    upstreamRagReferences: ragReferences,
  };
  if (role === 'TEACHER') {
    return { ...base, role, fields: NODE_DETAIL_FIELDS.TEACHER, node: teacherNode };
  }

  return {
    ...base,
    source: { ...base.source, controlledPath: snapshot.releaseSet.controlledPath },
    role,
    fields: NODE_DETAIL_FIELDS.ADMIN,
    node: {
      ...teacherNode,
      payload: row.payload,
      sourceMappings: [],
      sourceStubs: [],
      evidence: [],
    },
    receipt: snapshot.receipt ? {
      id: snapshot.receipt.id,
      sourceRun: snapshot.receipt.sourceRun,
      sourceImplementationCommit: snapshot.receipt.sourceImplementationCommit,
      captureRevision: snapshot.receipt.captureRevision,
      lockRawHash: snapshot.receipt.lockRawHash,
      schemaVersion: snapshot.receipt.schemaVersion ?? null,
      projectionId: snapshot.receipt.projectionId ?? null,
      projectionDigest: snapshot.receipt.projectionDigest ?? null,
      sourceDatasetHash: snapshot.receipt.sourceDatasetHash ?? null,
    } : null,
    diagnostics,
    activeConsumerRebinding: 'not-started',
  };
}

export interface MigrationReviewProjection {
  projectionVersion: typeof MIGRATION_REVIEW_PROJECTION_VERSION;
  source: ProjectionIdentity & { controlledPath: string };
  role: 'ADMIN';
  fields: ProjectionFieldDeclaration;
  /** True when the reviewed ReleaseSet is not the pinned aggregate ReleaseSet. */
  historical: boolean;
  ingest: {
    receipt: AuthoritativeKnowledgeSnapshot['receipt'];
    expectedCounts: Record<string, number> | null;
    actualCounts: Record<string, number>;
    drift: RepositoryDiagnostic[];
  };
  /**
   * Deterministic stale declaration for outputs bound to the prior root-locus
   * ReleaseSet. Their audit records are preserved, but they never count
   * towards current readiness.
   */
  staleShadowOutputs: Array<{
    output: 'inventory' | 'crosswalk' | 'candidate' | 'decision' | 'binding';
    boundReleaseSetId: string;
    disposition: 'stale';
    currentReleaseSetId: string;
  }>;
  legacyArchive: 'not-ready';
  activeConsumerRebinding: 'not-started';
  readOnly: true;
}

const STALE_SHADOW_OUTPUT_KINDS = [
  'inventory',
  'crosswalk',
  'candidate',
  'decision',
  'binding',
] as const;

const MIGRATION_REVIEW_FIELDS: ProjectionFieldDeclaration = {
  included: [
    'ingest.receipt',
    'ingest.expectedCounts',
    'ingest.actualCounts',
    'ingest.drift',
    'staleShadowOutputs',
    'legacyArchive',
    'activeConsumerRebinding',
  ],
  hidden: ['artifact.bytes'],
};

export function buildMigrationReviewProjection(
  snapshot: AuthoritativeKnowledgeSnapshot,
  diagnostics: RepositoryDiagnostic[],
): MigrationReviewProjection {
  const receipt = snapshot.receipt;
  const aggregate = isAggregateReleaseProtocol(snapshot.release.protocol);
  const expectedArtifacts = expectedArtifactCountForMigrationReview(snapshot);
  return {
    projectionVersion: MIGRATION_REVIEW_PROJECTION_VERSION,
    source: { ...identity(snapshot), controlledPath: snapshot.releaseSet.controlledPath },
    role: 'ADMIN',
    fields: MIGRATION_REVIEW_FIELDS,
    historical: snapshot.historical,
    ingest: {
      receipt,
      expectedCounts: receipt
        ? aggregate
          ? {
              releaseEntries: receipt.releaseEntryCount ?? 0,
              projectionNodes: receipt.projectionNodeCount ?? 0,
              projectionLinks: receipt.projectionLinkCount ?? 0,
              upstreamRagReferences: receipt.upstreamRagReferenceCount ?? 0,
              artifacts: expectedArtifacts,
              components: receipt.componentCount ?? 0,
            }
          : {
              objects: receipt.objectCount,
              sourceMappings: receipt.sourceMappingCount,
              goldRelations: receipt.goldRelationCount,
              silverRelations: receipt.silverRelationCount,
              sourceObjects: receipt.sourceObjectCount,
              evidence: receipt.evidenceSegmentCount,
            }
        : null,
      actualCounts: aggregate
        ? {
            releaseEntries: snapshot.releaseEntries?.length ?? 0,
            projectionNodes: snapshot.projectionNodes?.length ?? 0,
            projectionLinks: snapshot.projectionLinks?.length ?? 0,
            upstreamRagReferences: snapshot.upstreamRagReferences?.length ?? 0,
            artifacts: actualArtifactCount(snapshot),
            components: snapshot.releaseComponents?.length ?? 0,
          }
        : {
            objects: snapshot.objects.length,
            sourceMappings: snapshot.sourceMappings.length,
            goldRelations: snapshot.relations.filter((row) => row.qualityTier === 'GOLD').length,
            silverRelations: snapshot.relations.filter((row) => row.qualityTier === 'SILVER').length,
            sourceObjects: snapshot.sourceObjects.length,
            evidence: snapshot.evidence.length,
          },
      drift: diagnostics,
    },
    staleShadowOutputs: STALE_SHADOW_OUTPUT_KINDS.map((output) => ({
      output,
      boundReleaseSetId: HISTORICAL_ROOT_LOCUS_RELEASE_SET_ID,
      disposition: 'stale' as const,
      currentReleaseSetId: CURRENT_AGGREGATE_RELEASE_SET_ID,
    })),
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
      ...projectionCacheBinding(result.snapshot),
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
      ...projectionCacheBinding(result.snapshot),
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

  async canonicalSearch(
    selector: AuthoritySelector,
    role: KnowledgeRole,
    query: string,
    support: ConsumerSemanticSupport,
    options: {
      limit?: number;
      canonicalType?: string | null;
      governance?: 'CORE' | 'EXTENSION';
    } = {},
  ): Promise<ProjectionResult<CanonicalSearchProjection>> {
    const result = await this.snapshot(selector);
    if (result.status === 'unavailable') return result;
    if (result.status === 'drift') {
      return { status: 'drift', selector: result.selector, diagnostics: result.diagnostics };
    }
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const limit = Math.min(Math.max(options.limit ?? 8, 1), 20);
    const supportedTypes = new Set(support.supportedObjectTypes);
    if (isAggregateReleaseProtocol(result.snapshot.release.protocol)) {
      assertCandidateRuntimeProjection(result.snapshot);
      const results = (result.snapshot.projectionNodes ?? [])
        .filter((row) => !options.canonicalType || row.entityType === options.canonicalType)
        .filter((row) => options.governance !== 'CORE' || row.releaseTier === 'gold')
        .filter((row) => {
          if (!normalizedQuery) return true;
          const payload = object(row.payload);
          return [
            row.nodeId,
            row.semanticName,
            row.displayName,
            stringOrNull(payload.description),
          ].some((value) => value?.toLocaleLowerCase().includes(normalizedQuery));
        })
        .slice(0, limit)
        .map((row) => {
          const payload = object(row.payload);
          return {
            id: row.nodeId,
            canonicalType: row.entityType,
            label: row.displayName || row.semanticName || row.nodeId,
            description: stringOrNull(payload.description),
            governanceTier: governanceTierFromReleaseTier(row.releaseTier),
            // Unregistered types remain available for generic read-only use.
            semanticSupport: semanticSupport(supportedTypes.has(row.entityType)),
            releaseTier: row.releaseTier,
          };
        });
      return {
        status: 'available',
        diagnostics: result.diagnostics,
        projection: {
          projectionVersion: 'act.canonical-search.v1',
          source: identity(result.snapshot),
          role,
          query,
          results,
        },
      };
    }
    const relationTierByNode = new Map<string, 'CORE' | 'EXTENSION'>();
    result.snapshot.relations.forEach((relation) => {
      const tier = relation.qualityTier === 'GOLD' ? 'CORE' : 'EXTENSION';
      [relation.sourceId, relation.targetId].forEach((nodeId) => {
        if (relationTierByNode.get(nodeId) !== 'CORE') relationTierByNode.set(nodeId, tier);
      });
    });
    const results = result.snapshot.objects
      .filter((row) => !options.canonicalType || row.canonicalType === options.canonicalType)
      .filter((row) => options.governance !== 'CORE' || relationTierByNode.get(row.canonicalId) === 'CORE')
      .filter((row) => {
        if (!normalizedQuery) return true;
        const payload = object(row.payload);
        return [
          row.canonicalId,
          row.semanticName,
          safeLabel(payload, row.semanticName ?? row.canonicalId),
          stringOrNull(payload.description),
        ].some((value) => value?.toLocaleLowerCase().includes(normalizedQuery));
      })
      .slice(0, limit)
      .map((row) => {
        const payload = object(row.payload);
        return {
          id: row.canonicalId,
          canonicalType: row.canonicalType,
          label: safeLabel(payload, row.semanticName ?? row.canonicalId),
          description: stringOrNull(payload.description),
          governanceTier: relationTierByNode.get(row.canonicalId) ?? 'UNCLASSIFIED' as const,
          semanticSupport: semanticSupport(supportedTypes.has(row.canonicalType)),
        };
      });
    return {
      status: 'available',
      diagnostics: result.diagnostics,
      projection: {
        projectionVersion: 'act.canonical-search.v1',
        source: identity(result.snapshot),
        role,
        query,
        results,
      },
    };
  }

  async boundedNeighbors(
    selector: AuthoritySelector,
    role: KnowledgeRole,
    nodeId: string,
    support: ConsumerSemanticSupport,
    options: {
      limit?: number;
      governance?: 'CORE' | 'EXTENSION';
      predicate?: string | null;
    } = {},
  ): Promise<ProjectionResult<BoundedNeighborProjection>> {
    const result = await this.snapshot(selector);
    if (result.status === 'unavailable') return result;
    if (result.status === 'drift') {
      return { status: 'drift', selector: result.selector, diagnostics: result.diagnostics };
    }
    if (isAggregateReleaseProtocol(result.snapshot.release.protocol)) {
      assertCandidateRuntimeProjection(result.snapshot);
      const nodes = result.snapshot.projectionNodes ?? [];
      if (!nodes.some((row) => row.nodeId === nodeId)) {
        return { status: 'unavailable', reason: 'node-not-found', selector, diagnostics: result.diagnostics };
      }
      const tierByEntityId = aggregateTierByEntityId(result.snapshot);
      const limit = Math.min(Math.max(options.limit ?? 12, 1), 20);
      const matches = (result.snapshot.projectionLinks ?? []).filter((link) => (
        (link.sourceId === nodeId || link.targetId === nodeId)
        && (!options.predicate || link.relationType === options.predicate)
        && (options.governance !== 'CORE' || tierByEntityId.get(link.relationId) === 'gold')
      ));
      const neighbors = matches.slice(0, limit).flatMap((link) => {
        const neighborId = link.sourceId === nodeId ? link.targetId : link.sourceId;
        const neighbor = nodes.find((row) => row.nodeId === neighborId);
        if (!neighbor) return [];
        const releaseTier = tierByEntityId.get(link.relationId) ?? null;
        return [{
          relationId: link.relationId,
          predicate: link.relationType,
          direction: link.direction,
          qualityTier: displayTierFromReleaseTier(releaseTier),
          traversal: link.sourceId === nodeId ? 'outgoing' as const : 'incoming' as const,
          neighbor: {
            id: neighbor.nodeId,
            canonicalType: neighbor.entityType,
            label: neighbor.displayName || neighbor.semanticName || neighbor.nodeId,
          },
          governance: {
            reviewStatus: null,
            publicationStatus: null,
          },
          readOnly: true as const,
          relationFamily: link.relationFamily,
          evidenceState: link.evidenceState,
          releaseTier,
        }];
      });
      return {
        status: 'available',
        diagnostics: result.diagnostics,
        projection: {
          projectionVersion: 'act.bounded-neighbors.v1',
          source: identity(result.snapshot),
          role,
          nodeId,
          limit,
          truncated: matches.length > limit,
          neighbors,
        },
      };
    }
    if (!result.snapshot.objects.some((row) => row.canonicalId === nodeId)) {
      return { status: 'unavailable', reason: 'node-not-found', selector, diagnostics: result.diagnostics };
    }
    const limit = Math.min(Math.max(options.limit ?? 12, 1), 20);
    const matches = result.snapshot.relations.filter((relation) => (
      (relation.sourceId === nodeId || relation.targetId === nodeId)
      && (!options.predicate || relation.relationType === options.predicate)
      && (options.governance !== 'CORE' || relation.qualityTier === 'GOLD')
    ));
    const neighbors = matches.slice(0, limit).flatMap((relation) => {
      const neighborId = relation.sourceId === nodeId ? relation.targetId : relation.sourceId;
      const neighbor = result.snapshot.objects.find((row) => row.canonicalId === neighborId);
      if (!neighbor) return [];
      const payload = object(relation.payload);
      return [{
        relationId: relation.relationId,
        predicate: relation.relationType,
        direction: stringOrNull(payload.direction),
        qualityTier: relation.qualityTier,
        traversal: relation.sourceId === nodeId ? 'outgoing' as const : 'incoming' as const,
        neighbor: {
          id: neighbor.canonicalId,
          canonicalType: neighbor.canonicalType,
          label: safeLabel(object(neighbor.payload), neighbor.semanticName ?? neighbor.canonicalId),
        },
        governance: {
          reviewStatus: relation.reviewStatus,
          publicationStatus: relation.publicationStatus,
        },
        readOnly: true as const,
      }];
    });
    return {
      status: 'available',
      diagnostics: result.diagnostics,
      projection: {
        projectionVersion: 'act.bounded-neighbors.v1',
        source: identity(result.snapshot),
        role,
        nodeId,
        limit,
        truncated: matches.length > limit,
        neighbors,
      },
    };
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
      ...projectionCacheBinding(result.snapshot),
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
