export const SOURCE_PACK_SCHEMA_VERSION = 'source-pack.v1';

export type SourcePackProfile =
  | 'lesson-authoring'
  | 'homework-authoring'
  | 'konling'
  | 'path-planning'
  | 'generic';

export type SourcePackSourceKind =
  | 'textbook'
  | 'reference'
  | 'runtime-lesson'
  | 'knowledge-card'
  | 'exercise'
  | 'learner-evidence'
  | 'simulation'
  | 'other';

export type SourcePackModality = 'text' | 'image' | 'video' | 'audio' | 'interactive' | 'mixed';

export type SourcePackAccessVisibility = 'public' | 'student' | 'teacher' | 'admin' | 'restricted';

export type SourcePackLimitationSeverity = 'info' | 'warning' | 'blocking';

export interface SourcePackQuery {
  queryId: string;
  text: string;
  profile: SourcePackProfile;
  caller?: string;
  locale?: string;
  topK?: number;
  filters?: Record<string, string | number | boolean | string[]>;
}

export interface SourcePackIndexRefs {
  corpusVersion?: string;
  graphVersion?: string;
  projectionVersion?: string;
  generatedAt: string;
}

export interface SourcePackScoreFields {
  relevance: number;
  graphAlignment?: number;
  authority?: number;
  eligibility?: number;
  freshness?: number;
  final: number;
}

export interface SourcePackAccessMetadata {
  visibility: SourcePackAccessVisibility;
  license?: string;
  aiUseAllowed: boolean;
  policyRef?: string;
}

export interface SourcePackCitation {
  citationTargetId: string;
  sourceId: string;
  displayTitle: string;
  href?: string;
  resolver?: string;
  verified: boolean;
}

export interface SourcePackItem {
  id: string;
  title: string;
  sourceKind: SourcePackSourceKind;
  modality: SourcePackModality;
  excerpt: string;
  inclusionRationale: string;
  resourceNodeId?: string;
  planningUnitId?: string;
  retrievalChunkId?: string;
  citationTargetId?: string;
  scores: SourcePackScoreFields;
  access: SourcePackAccessMetadata;
  citation?: SourcePackCitation;
  metadata?: Record<string, string | number | boolean | string[]>;
}

export interface SourcePackCoverage {
  requestedTopK: number;
  returnedItems: number;
  eligibleItems?: number;
  omittedItems?: number;
  coverageRatio?: number;
  notes?: string[];
}

export interface SourcePackLimitation {
  code: string;
  severity: SourcePackLimitationSeverity;
  message: string;
  source?: string;
  recoverable: boolean;
}

export interface SourcePackAudit {
  schemaVersion: typeof SOURCE_PACK_SCHEMA_VERSION;
  createdAt: string;
  builderId: string;
  profile: SourcePackProfile;
  queryHash: string;
  itemCount: number;
  limitationCount: number;
  citationTargetIds: string[];
  retrievalChunkIds: string[];
}

export interface SourcePack {
  packId: string;
  profile: SourcePackProfile;
  query: SourcePackQuery;
  indexRefs: SourcePackIndexRefs;
  coverage: SourcePackCoverage;
  items: SourcePackItem[];
  limitations: SourcePackLimitation[];
  audit: SourcePackAudit;
}
