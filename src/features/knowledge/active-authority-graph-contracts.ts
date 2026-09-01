/**
 * Browser-safe contracts for the active Engineering Authority workspace.
 *
 * Keep this file free of server resolvers, filesystem access, Prisma, and
 * Node-built-in imports.  The API serializes the existing authoritative
 * projection fields and adds a small, role-safe activation provenance block.
 */

import type { AuthorityNodeLearningContent } from '@/lib/authority-domain-shards/contracts';
import type {
  GovernedFormulaProjection,
  GovernedRichTextProjection,
} from '@/lib/governed-math';

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
  typeLabel?: string | null;
  richTitle?: GovernedRichTextProjection;
  richDescription?: GovernedRichTextProjection;
  searchText?: string;
  accessibleName?: string;
  /** Bounded governed formula projection for materialized Formula nodes (#1740). */
  mathematics?: GovernedFormulaProjection;
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
  predicateLabel?: string | null;
  directionLabel?: string | null;
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

export type ActiveNodeMathematics =
  | {
    state: 'available';
    expression: string;
    display: 'block' | 'inline';
    accessibleLabel?: string;
    copyLatex?: string;
    renderKey?: string;
    macroProfileId?: string;
    macroProfileHash?: string;
  }
  | { state: 'unavailable'; message: string }
  | { state: 'missing' };

export function projectGovernedFormulaToActiveMathematics(
  projection: GovernedFormulaProjection | null | undefined,
): ActiveNodeMathematics | null {
  if (!projection || projection.state === 'missing') return null;
  if (projection.state === 'registered-unavailable') {
    return { state: 'unavailable', message: projection.fallbackText };
  }
  return {
    state: 'available',
    expression: projection.latex,
    display: projection.display,
    accessibleLabel: projection.accessibleLabel,
    copyLatex: projection.copyLatex,
    renderKey: projection.renderKey,
    macroProfileId: projection.macroProfileId,
    macroProfileHash: projection.macroProfileHash,
  };
}

export const ACTIVE_RESOURCE_BINDING_ROLES = ['讲解', '练习', '评价', '引用'] as const;
export type ActiveResourceBindingRole = (typeof ACTIVE_RESOURCE_BINDING_ROLES)[number];

export interface ActiveResourceLaunchDescriptor {
  kind: 'direct-route' | 'registry-resource' | 'unavailable';
  href: string | null;
}

export interface ActiveResourceBinding {
  title: string;
  bindingRole: ActiveResourceBindingRole;
  resourceKind: string;
  availability: 'available' | 'unavailable';
  launch: ActiveResourceLaunchDescriptor;
}

export type ActiveNodeResourceBindings =
  | { state: 'available'; items: ActiveResourceBinding[] }
  | { state: 'empty'; message: string }
  | { state: 'unavailable'; message: string };

export function projectActiveNodeMathematics(
  teachingFields: Record<string, unknown> | null | undefined,
): ActiveNodeMathematics {
  const expression = teachingFields?.formula_latex;
  if (typeof expression !== 'string' || expression.trim().length === 0) {
    return { state: 'missing' };
  }
  return {
    state: 'available',
    expression: expression.trim(),
    display: 'block',
  };
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
    typeLabel?: string | null;
    adjacency: ActiveNodeAdjacency[];
    sources: Array<{ sourceEditionId: string; sectionId: string; label?: string | null }>;
    semanticSupport: { supported: boolean; readOnly: true };
    releaseTier?: string;
    aliases?: string[];
    teachingFields?: Record<string, unknown>;
    richTitle?: GovernedRichTextProjection;
    richDescription?: GovernedRichTextProjection;
    searchText?: string;
    accessibleName?: string;
    mathematics?: ActiveNodeMathematics;
    resourceBindings?: ActiveNodeResourceBindings;
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
