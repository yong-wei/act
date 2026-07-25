/**
 * Typed ActKG GraphProjection fixture.
 *
 * Vendored schema snapshot: `src/lib/knowledge-graph-actkg/ctkg-projection.schema.json`
 * (LinkML-generated JSON Schema, draft 2019-09, `$id` https://yong-wei.github.io/ActKG/ctkg/).
 * Pinned ActKG release: `3f7c58760aa70011990af28977cd03e51ba7c985` (2026-07-22, schema_version 0.1.0).
 */

export const ACTKG_FIXTURE_RELEASE_IDENTITY = 'actkg@3f7c58760aa70011990af28977cd03e51ba7c985';
export const ACTKG_FIXTURE_SOURCE_RELEASE = 'ctkg:release/3f7c58760aa70011990af28977cd03e51ba7c985';
export const ACTKG_FIXTURE_VERSION_DIGEST = 'sha256:fixture-digest-v1';

export type ActkgProjectionDirection = 'parent_to_child' | 'earlier_to_later' | 'unordered';
export type ActkgEvidenceState = 'available' | 'unavailable';
export type ActkgProjectedRelationType = 'contains' | 'prerequisite' | 'association';

export interface ActkgProjectedNode {
  id: string;
  concept_id: string;
  semantic_name: string;
  display_name: string;
  concept_kind: string;
  source_coverage_count: number;
  candidate: boolean;
  description?: string | null;
}

export interface ActkgProjectedLink {
  id: string;
  relation_id: string;
  source_id: string;
  target_id: string;
  relation_type: ActkgProjectedRelationType;
  relation_family: string;
  direction: ActkgProjectionDirection;
  evidence_state: ActkgEvidenceState;
}

export interface ActkgGraphProjectionDocument {
  id: string;
  projection_profile: string;
  source_dataset_hash: string;
  version_digest: string;
  schema_version: string;
  lifecycle_status: string;
  source_release?: string | null;
  nodes?: ActkgProjectedNode[] | null;
  links?: ActkgProjectedLink[] | null;
}

export const actkgGraphProjectionFixture: ActkgGraphProjectionDocument = {
  id: 'ctkg:projection/act-runtime-graph-fixture',
  projection_profile: 'ctkg:profile/act_runtime_graph',
  source_release: ACTKG_FIXTURE_SOURCE_RELEASE,
  source_dataset_hash: 'sha256:fixture-dataset',
  version_digest: ACTKG_FIXTURE_VERSION_DIGEST,
  schema_version: '0.1.0',
  lifecycle_status: 'accepted',
  nodes: [
    {
      id: 'ctc:C100001',
      concept_id: 'ctc:C100001',
      semantic_name: 'stability',
      display_name: '稳定性',
      concept_kind: 'system_property',
      source_coverage_count: 3,
      candidate: false,
      description: '系统在扰动后回到平衡态的性质。',
    },
    {
      id: 'ctc:C100002',
      concept_id: 'ctc:C100002',
      semantic_name: 'settling_time',
      display_name: '调节时间',
      concept_kind: 'performance_metric',
      source_coverage_count: 2,
      candidate: false,
      description: null,
    },
    {
      id: 'ctc:C100003',
      concept_id: 'ctc:C100003',
      semantic_name: 'damping_ratio',
      display_name: '阻尼比',
      concept_kind: 'dimensionless_parameter',
      source_coverage_count: 1,
      candidate: true,
    },
  ],
  links: [
    {
      id: 'ctl:L000001',
      relation_id: 'ctr:R000001',
      source_id: 'ctc:C100001',
      target_id: 'ctc:C100002',
      relation_type: 'contains',
      relation_family: 'child',
      direction: 'parent_to_child',
      evidence_state: 'available',
    },
    {
      id: 'ctl:L000002',
      relation_id: 'ctr:R000002',
      source_id: 'ctc:C100003',
      target_id: 'ctc:C100001',
      relation_type: 'prerequisite',
      relation_family: 'post-requisite',
      direction: 'earlier_to_later',
      evidence_state: 'unavailable',
    },
    {
      id: 'ctl:L000003',
      relation_id: 'ctr:R000003',
      source_id: 'ctc:C100002',
      target_id: 'ctc:C100003',
      relation_type: 'association',
      relation_family: 'association',
      direction: 'unordered',
      evidence_state: 'available',
    },
    {
      // Direction conflicts with the canonical contract (`contains` implies
      // `parent-to-child`); the contract table wins and the override is
      // recorded in link provenance.
      id: 'ctl:L000004',
      relation_id: 'ctr:R000004',
      source_id: 'ctc:C100001',
      target_id: 'ctc:C100003',
      relation_type: 'contains',
      relation_family: 'child',
      direction: 'unordered',
      evidence_state: 'unavailable',
    },
  ],
};

export function buildActkgProjectionDocument(
  overrides: Partial<ActkgGraphProjectionDocument> = {}
): ActkgGraphProjectionDocument {
  return { ...actkgGraphProjectionFixture, ...overrides };
}
