/**
 * Browser-safe contracts for the active Engineering Authority workspace.
 *
 * Keep this file free of server resolvers, filesystem access, Prisma, and
 * Node-built-in imports.  The API serializes the existing authoritative
 * projection fields and adds a small, role-safe activation provenance block.
 */

import type { AuthorityNodeLearningContent } from '@/lib/authority-domain-shards/contracts';

export interface ActiveAuthoritySource {
  authorityState: 'active';
  releaseSetId: string;
  releaseId: string;
  productionAuthoritative: false;
  historical: false;
  releaseHash?: string | null;
  schemaVersion?: string | null;
  /** Engineering graph has no applicable Teaching Projection. */
  projectionDigest: null;
  sourceDatasetHash?: string | null;
}

export interface ActiveAuthorityProvenance {
  authority: {
    consumerId: 'engineering-graph';
    snapshotId: string;
    snapshotHash: string;
    releaseId: string;
    releaseSetId: string;
  };
  activation: {
    mode: 'use-combination';
    status: 'READY';
    activationId: string;
    activationHash: string;
  };
  projection: {
    status: 'not-applicable';
    projectionId: null;
    projectionHash: null;
  };
}

export interface ActiveCanvasNode {
  id: string;
  canonicalType: string;
  label: string;
  aliases?: readonly string[];
  description: string | null;
  governance: {
    reviewStatus: string | null;
    publicationStatus: string | null;
    lifecycleStatus: string | null;
  };
  releaseTier?: string;
  candidate?: boolean;
  semanticName?: string | null;
  sourceCoverageCount?: number;
  conceptKind?: string | null;
  semanticSupport: { supported: boolean; readOnly: true };
}

export interface ActiveCanvasRelation {
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
  relationFamily?: string;
  /** Presentation grammar only; never rendered as a raw product string. */
  layer?: 'ENGINEERING' | 'ACT_TEACHING';
  evidenceState?: string;
  releaseTier?: string | null;
  semanticSupport: { supported: boolean; readOnly: true };
}

export interface ActiveCanvasResponse {
  projectionVersion: 'act.canvas.v2';
  source: ActiveAuthoritySource;
  release: {
    label: string;
    version: string;
    scope: string;
  };
  fields: {
    included: readonly string[];
    hidden: readonly string[];
  };
  coverage: {
    status: 'partial';
    objectCount: number;
    relationCount: number;
    goldRelationCount: number;
    silverRelationCount: number;
    sourceObjectCount: number;
    evidenceSegmentCount: number;
    releaseEntryCount?: number;
    goldNodeCount?: number;
    silverNodeCount?: number;
    upstreamRagReferenceCount?: number;
  };
  teachingSemantics: {
    status: 'unavailable';
    message: '教学关系尚未发布';
  };
  nodes: ActiveCanvasNode[];
  relations: ActiveCanvasRelation[];
  provenance: ActiveAuthorityProvenance;
}

export interface ActiveNodeAdjacency {
  relationId: string;
  predicate: string;
  direction: string | null;
  qualityTier: string;
  neighborId: string;
  traversal: 'outgoing' | 'incoming';
  readOnly: true;
  relationFamily?: string;
  evidenceState?: string;
  releaseTier?: string | null;
}

export interface ActiveNodeDetailResponse {
  projectionVersion: 'act.node-detail.v2';
  source: ActiveAuthoritySource;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
  fields: {
    included: readonly string[];
    hidden: readonly string[];
  };
  node: {
    id: string;
    canonicalType: string;
    label: string;
    description: string | null;
    adjacency: ActiveNodeAdjacency[];
    sources: Array<{ sourceEditionId: string; sectionId: string }>;
    semanticSupport: { supported: boolean; readOnly: true };
    releaseTier?: string;
    aliases?: string[];
    teachingFields?: Record<string, unknown>;
    governance?: {
      reviewStatus: string | null;
      publicationStatus: string | null;
      lifecycleStatus: string | null;
    };
    learningContent?: AuthorityNodeLearningContent;
    coverage?: {
      sourceMappingCount: number;
      evidenceCount: number;
      sourceCoverageCount?: number;
      upstreamRagReferenceCount?: number;
    };
    governanceTier?: 'CORE' | 'EXTENSION' | 'UNCLASSIFIED';
    candidate?: boolean;
    upstreamRagReferences?: Array<{
      retrievalChunkId: string;
      citationTargetId: string;
    }>;
  };
  provenance: ActiveAuthorityProvenance;
}
