import type { Drift, Json } from '../input-inventory/types';

export type { Drift, Json };

export interface SourceConcept {
  source_concept_id: string;
  identity_namespace: string;
  normalized_name: string;
  source_locator: string;
}

export interface ReviewedAlias {
  left: string;
  right: string;
  decision: 'ACCEPT';
  review_id: string;
  evidence_digest: string;
}

export interface NearSimilarInput {
  left: string;
  right: string;
  review_id: string;
  evidence_digest: string;
  algorithm_version: string;
}

export interface PendingSplitInput {
  source_concept_id: string;
  review_id: string;
  evidence_digest: string;
  alternatives: Array<{ alternative_id: string; proposed_member_ids: string[] }>;
}

export interface HistoryAmbiguityInput {
  source_concept_id: string;
  history_locator: string;
  review_id: string;
  candidate_alternative_ids: string[];
}

export interface IdentityCandidateInput {
  schema_version: 'knowledge-identity-candidate-input/v1';
  expected_inventory_digest: string;
  concepts: SourceConcept[];
  reviewed_aliases: ReviewedAlias[];
  near_similar: NearSimilarInput[];
  pending_splits: PendingSplitInput[];
  history_ambiguities: HistoryAmbiguityInput[];
  anchor_bindings: Array<{ source_concept_id: string; anchor_id: string }>;
  expected: {
    concept_count: number;
    reviewed_alias_count: number;
    near_similar_count: number;
  };
}

export interface InventoryAnchor {
  anchor_id: string;
  anchor_scope: 'course' | 'module' | 'lesson';
  anchor_type: 'formal_objective' | 'necessary_prerequisite' | 'explicit_extension';
  course_id: string;
  module_id: string | null;
  lesson_id: string | null;
  source_locator: string;
  text_digest: string;
}

export interface AuthoritativeIdentityCandidateRecord {
  concept_key: string;
  source_concept_id: string;
  identity_namespace: string;
  normalized_name: string;
  source_locator: string;
  record_digest: string;
}

export interface AuthoritativeIdentityCandidateRecordSet {
  records: AuthoritativeIdentityCandidateRecord[];
  count: number;
  set_digest: string;
}

export interface InventoryManifest {
  schema_version: string;
  normalization_profile: string;
  source_digests: Json[];
  database_source_digests?: Json[];
  governance_contract_digest: string;
  source_snapshot_digest: string;
  snapshot_digest: string;
  readiness: boolean;
  anchors: { records: InventoryAnchor[] };
  identity_candidate_records?: AuthoritativeIdentityCandidateRecordSet;
}
