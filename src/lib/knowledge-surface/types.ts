import type { KnowledgeRole } from '@/lib/authoritative-knowledge/contracts';

export const KNOWLEDGE_SURFACE_CONTRACT = 'act-knowledge-surface/v1' as const;

export const KNOWLEDGE_SURFACE_MODES = ['active', 'legacy', 'candidate'] as const;
export type KnowledgeSurfaceMode = (typeof KNOWLEDGE_SURFACE_MODES)[number];

export const KNOWLEDGE_SURFACE_KINDS = [
  'root',
  'domain',
  'family',
  'neighborhood',
  'detail',
  'search',
  'candidate-diagnostic',
] as const;
export type KnowledgeSurfaceKind = (typeof KNOWLEDGE_SURFACE_KINDS)[number];

export const KNOWLEDGE_SURFACE_BLOCK_STATUSES = [
  'available',
  'unavailable',
  'identity-mismatch',
  'version-drift',
  'omitted',
  'not-applicable',
  'missing',
] as const;
export type KnowledgeSurfaceBlockStatus = (typeof KNOWLEDGE_SURFACE_BLOCK_STATUSES)[number];

export type KnowledgeSurfaceRole = KnowledgeRole | 'NONE';

export interface KnowledgeSurfaceAuthorityIdentity {
  snapshotId: string | null;
  snapshotHash: string | null;
  releaseId: string;
  releaseSetId: string;
  activationId?: string | null;
  activationHash?: string | null;
  releaseHash?: string | null;
  sourceDatasetHash?: string | null;
  projectionDigest?: string | null;
}

export interface KnowledgeSurfaceTeachingIdentity {
  projectionId: string;
  projectionHash: string;
  scopeId?: string | null;
  cacheFamily?: string | null;
  captureRevision?: string | null;
}

export interface KnowledgeSurfaceRegistryIndexIdentity {
  contract: string;
  identity: string;
  digest: string;
  captureRevision?: string | null;
}

export interface KnowledgeSurfaceMathIdentity {
  owner: 'governed-rich-text-math-presentation';
  releaseId: string;
  releaseHash: string;
  locale: string;
}

export interface KnowledgeSurfaceBlock {
  status: KnowledgeSurfaceBlockStatus;
  reason?: string;
}

export interface KnowledgeSurfaceBlocks {
  engineering: KnowledgeSurfaceBlock;
  teaching: KnowledgeSurfaceBlock;
  resources: KnowledgeSurfaceBlock;
  learningContent: KnowledgeSurfaceBlock;
  math: KnowledgeSurfaceBlock;
}

export interface KnowledgeSurfaceResponse {
  contractVersion: typeof KNOWLEDGE_SURFACE_CONTRACT;
  surface: {
    kind: KnowledgeSurfaceKind;
    id: string;
  };
  mode: KnowledgeSurfaceMode;
  role: KnowledgeSurfaceRole;
  locale: string;
  authority: KnowledgeSurfaceAuthorityIdentity;
  teaching: KnowledgeSurfaceTeachingIdentity | null;
  registryIndex: KnowledgeSurfaceRegistryIndexIdentity | null;
  math: KnowledgeSurfaceMathIdentity | null;
  blocks: KnowledgeSurfaceBlocks;
}

export interface KnowledgeSurfaceReadRequest {
  mode: KnowledgeSurfaceMode;
  kind: KnowledgeSurfaceKind;
  role: KnowledgeSurfaceRole;
  locale?: string;
  surfaceKey: string;
  searchParams?: URLSearchParams | Record<string, string | undefined | null>;
  authority: KnowledgeSurfaceAuthorityIdentity;
  teaching?: KnowledgeSurfaceTeachingIdentity | null;
  teachingMatch?: boolean | null;
  registryIndex?: KnowledgeSurfaceRegistryIndexIdentity | null;
  math?: KnowledgeSurfaceMathIdentity | null;
  includeTeachingContent?: boolean;
  includeResourceContent?: boolean;
  learningContentStatus?: KnowledgeSurfaceBlockStatus;
}

export type KnowledgeSurfaceReadResult =
  | { status: 'selector-rejected'; parameter: string }
  | { status: 'identity-unavailable'; reason: string }
  | { status: 'ok'; knowledgeSurface: KnowledgeSurfaceResponse; cacheKey: string };
