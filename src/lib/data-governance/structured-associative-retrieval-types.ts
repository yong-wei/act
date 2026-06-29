export type SarEventType =
  | 'graph-node'
  | 'resource-node'
  | 'corpus-chunk-summary'
  | 'learning-fact-summary'
  | 'grading-artifact'
  | 'simulation-summary'
  | 'arena-summary'
  | 'path-summary'
  | 'diagnosis-summary'
  | 'teacher-report'
  | 'konling-memory-summary'
  | 'prep-pack-item';

export type SarEntityType =
  | 'learning-goal'
  | 'kaq-objective'
  | 'graph-node'
  | 'portrait-dimension'
  | 'resource-node'
  | 'planning-unit'
  | 'path-node'
  | 'learning-fact'
  | 'rubric-criterion'
  | 'citation-target'
  | 'student'
  | 'class';

export type SarAuthorityLevel =
  | 'platform-verified'
  | 'teacher-approved'
  | 'metadata-projected'
  | 'llm-extracted';

export type SarRelationRole =
  | 'about'
  | 'supports'
  | 'requires'
  | 'evidence-for'
  | 'generated-from'
  | 'candidate-for'
  | 'rejects';

export type SarRelationProvenance =
  | 'deterministic-id'
  | 'metadata-projection'
  | 'teacher-approval'
  | 'llm-extraction';

export type SarPrivacyScope =
  | 'student-visible'
  | 'teacher-scoped'
  | 'admin-scoped'
  | 'audit-only'
  | 'system-internal';

export interface SarSourceRef {
  id: string;
  /** Source owner required by the SAR contract, nested with the source ref. */
  owner: string;
  ownerUserId?: string | null;
  classId?: string | null;
  authorityLevel: SarAuthorityLevel;
  freshness: string;
  contentHash?: string;
}

export interface SarRetrievalEvent {
  id: string;
  eventType: SarEventType;
  title: string;
  safeSummary: string;
  sourceRef: SarSourceRef;
  privacyScope: SarPrivacyScope;
  metadata?: Record<string, unknown>;
}

export interface SarRetrievalEntity {
  id: string;
  entityType: SarEntityType;
  canonicalRef: string;
  label: string;
  aliases: string[];
  privacyScope: SarPrivacyScope;
  extraction: 'platform-stable-id' | 'llm-candidate';
}

export interface SarRetrievalEventEntity {
  eventId: string;
  entityId: string;
  role: SarRelationRole;
  confidence: number;
  provenance: SarRelationProvenance;
  source: string;
}

export interface SarTraceHop {
  fromEntityId: string;
  toEntityId: string;
  viaEventId?: string;
  relationRole: SarRelationRole;
  confidence: number;
}

export interface SarRetrievalTrace {
  id: string;
  seedEntityIds: string[];
  expansionHops: SarTraceHop[];
  selectedRefs: string[];
  rejectedRefs: Array<{ ref: string; reason: string }>;
  limitations: string[];
  versionRefs: string[];
}

export interface SarRetrievalResult {
  id: string;
  trace: SarRetrievalTrace;
  events: SarRetrievalEvent[];
  entities: SarRetrievalEntity[];
  relations: SarRetrievalEventEntity[];
  citationTargetRefs: string[];
  retrievalChunkRefs: string[];
  limitations: string[];
}
