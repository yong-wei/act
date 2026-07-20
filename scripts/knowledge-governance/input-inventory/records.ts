import { canonicalJson, compareCodePoints, taggedDigest } from './normalize';
import type { Drift, Json } from './types';

export interface TypedRecord {
  item_kind: string;
  identity_namespace: string;
  source_id: string;
  source_locator: string;
  [key: string]: Json;
}

export function typedDedupe(records: TypedRecord[]): { records: TypedRecord[]; drift: Drift[] } {
  const seen = new Map<string, TypedRecord>();
  const drift: Drift[] = [];
  for (const record of records) {
    const key = canonicalJson([record.item_kind, record.identity_namespace, record.source_id] as Json);
    const existing = seen.get(key);
    if (existing && canonicalJson(existing as unknown as Json) !== canonicalJson(record as unknown as Json)) drift.push({ code: 'TYPED_RECORD_COLLISION', scope: `${record.item_kind}/${record.identity_namespace}/${record.source_id}` });
    else seen.set(key, record);
  }
  return {
    records: [...seen.values()].sort((a, b) => compareCodePoints([a.item_kind, a.identity_namespace, a.source_id, a.source_locator].join('\0'), [b.item_kind, b.identity_namespace, b.source_id, b.source_locator].join('\0'))),
    drift,
  };
}

export interface AnchorRecord {
  anchor_id: string;
  anchor_scope: 'course' | 'module' | 'lesson';
  anchor_type: 'formal_objective' | 'necessary_prerequisite' | 'explicit_extension';
  course_id: string;
  module_id: string | null;
  lesson_id: string | null;
  source_locator: string;
  text_digest: string;
}

export type AnchorType = AnchorRecord['anchor_type'];
export type AnchorScope = AnchorRecord['anchor_scope'];

export interface AnchorSourceEvidence {
  source_root: string;
  logical_path: string;
  repository_revision: string;
  source_digest: string;
  heading_locator: string;
  row_locator: string;
  quote_normalized: string;
  quote_digest: string;
}

export interface AnchorCandidate {
  candidate_digest: string;
  anchor_scope: AnchorScope;
  anchor_type: AnchorType;
  course_id: string;
  module_id: string | null;
  lesson_id: string | null;
  identity_basis: {
    course_name: string;
    course_number: string | null;
    module_number: string | null;
    lesson_number: string | null;
  };
  source: AnchorSourceEvidence;
  contract_version: string;
  model_version: string;
  rule_version: string;
  extraction_run: string;
}

export interface AnchorReviewEvidence {
  provenance: string;
  type: string;
  scope: string;
  fidelity: string;
}

export interface AnchorReviewDecision {
  decision_digest: string;
  candidate_digest: string;
  decision: 'ACCEPT' | 'REJECT';
  evidence: AnchorReviewEvidence;
  reason: string;
  review_run: string;
}

export interface AdmittedAnchor extends AnchorRecord {
  candidate_digest: string;
  review_decision_digest: string;
  extraction_run: string;
  review_run: string;
}

export function makeAnchor(input: Omit<AnchorRecord, 'anchor_id'>): AnchorRecord {
  const valid = input.course_id !== '' && input.source_locator !== '' && input.text_digest.startsWith('sha256:');
  const matrix = input.anchor_scope === 'course'
    ? input.module_id === null && input.lesson_id === null
    : input.anchor_scope === 'module'
      ? Boolean(input.module_id) && input.lesson_id === null
      : Boolean(input.module_id) && Boolean(input.lesson_id);
  if (!valid || !matrix || input.module_id === '' || input.lesson_id === '') throw new Error('invalid nullable anchor scope');
  return { anchor_id: taggedDigest('course-scope-anchor/v1', canonicalJson(input as unknown as Json)), ...input };
}
