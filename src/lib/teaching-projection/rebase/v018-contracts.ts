/**
 * Dedicated v0.18 Authority → ACT Teaching Projection rebase contracts.
 *
 * This is intentionally separate from the generic incremental rebase.  The
 * v0.18 candidate is an inactive Authority snapshot, therefore this contract
 * only permits a capture-bound, identity-only rebuild and never an activation.
 */

import type {
  AuthorityNodeIndexEntry,
  TeachingProjectionArtifacts,
  TeachingProjectionAuthoringInput,
} from '../contracts';
import type { PrerequisitePublicationArtifacts } from '../prerequisites/contracts';

export const ACT_V018_REBASE_CONTRACT =
  'act-teaching-projection-rebase-v018/v1' as const;
export const ACT_V018_REBASE_POLICY = 'identity-only/v1' as const;
export const ACT_V018_CANDIDATE_MODE = 'local-disposable-non-activation' as const;
export const ACT_V018_AUTHORITY_RELEASE_ID =
  'ctr:release:control-theory-engineering-v0.18' as const;
export const ACT_V018_AUTHORITY_SNAPSHOT_ID =
  'snap-1b64a853dda5668d83d0d2f09cadf72937330ced6aa49611f8027a9d5ec008ed' as const;

export const V018_CURRENT_POINTER_PATHS = [
  'course-content/authoring/knowledge/authority/current.json',
  'course-content/runtime/knowledge/projection/current.json',
  'course-content/runtime/knowledge/prerequisites/current.json',
  'course-content/runtime/knowledge/authority-domain-shards/current.json',
  'course-content/runtime/knowledge/consumer-activation/current.json',
  'course-content/runtime/knowledge/production-cutover-transactions/current.json',
] as const;

export const V018_REFERENCE_KINDS = [
  'course',
  'package',
  'resource',
  'card',
  'infograph',
  'textbook',
  'textbook-chapter',
  'textbook-section',
  'prerequisite',
  'path',
  'konling',
  'rag',
  'domain-fragment',
] as const;
export type V018ReferenceKind = (typeof V018_REFERENCE_KINDS)[number];

export interface V018AuthorityBinding {
  releaseId: string;
  releaseSetId: string;
  releaseHash: string;
  snapshotId: string;
  snapshotHash: string;
  captureRevision: string;
  bundleDigest: string;
  admissionReceiptId: string;
  admissionReceiptDigest: string;
  candidateReceiptDigest: string;
}

export interface V018AuthorityNodeRecord extends AuthorityNodeIndexEntry {
  canonicalType: string;
  semanticName?: string | null;
  publicationStatus?: string | null;
}

export interface V018ReferenceRecord {
  referenceId: string;
  kind: V018ReferenceKind;
  sourcePath: string;
  sourceDigest: string;
  scopeId: string;
  resourceId?: string | null;
  canonicalIds: string[];
  active: true;
  captureRevision: string;
  /** These records are produced from the capture-bound denominator only. */
  captureEvidence: string[];
}

export interface V018CaptureFile {
  path: string;
  blobSha256: string;
  mode: string;
  required: true;
}

export interface V018CaptureCollection {
  collectionId: string;
  root: string;
  prefixes: string[];
  membershipDigest: string;
  executionDigest: string;
}

export interface V018CaptureManifest {
  contract: 'act-teaching-projection-capture-bound-inputs/v2';
  captureRevision: string;
  policy: 'file-membership-execution-bound/v2';
  files: V018CaptureFile[];
  collections: V018CaptureCollection[];
  inputDigest: string;
}

export interface V018CaptureReceipt {
  contract: 'act-teaching-projection-capture-receipt/v1';
  captureRevision: string;
  manifestDigest: string;
  inventoryDigest: string;
  denominatorDigest: string;
  referenceCount: number;
  excludedHistoricalCount: number;
  excludedUnreferencedCount: number;
  fileMembershipExecutionBound: true;
}

export interface V018DatabaseObservation {
  contract: 'actkg-v018-candidate-admission-db-observation/v1';
  mode: 'disposable-read-only-candidate-admission';
  schemaIdentity: string;
  environmentIdentity: string;
  queryContractHash: string;
  parameters: Record<string, string | number | boolean | null>;
  objectRows: Array<{ canonicalId: string; canonicalType: string; snapshotId: string }>;
  prerequisiteRows: Array<{
    sourceCanonicalId: string;
    targetCanonicalId: string;
    relationType: string;
    snapshotId: string;
  }>;
  resultDigest: string;
  objectRowCount: number;
  prerequisiteRowCount: number;
  readOnly: true;
  disposable: true;
}

export interface V018DatabaseObservationCheck {
  available: boolean;
  accepted: boolean;
  findingCodes: string[];
  observationDigest: string | null;
}

export type V018MappingDisposition =
  | 'CARRY_FORWARD'
  | 'REVIEW_REQUIRED'
  | 'NEW_UNREFERENCED';

export interface V018MappingRecord {
  sourceCanonicalId: string;
  sourceCanonicalType: string;
  targetCanonicalId: string | null;
  targetCanonicalType: string | null;
  disposition: V018MappingDisposition;
  reason:
    | 'IDENTICAL_CANONICAL_ID_AND_TYPE'
    | 'MISSING_TARGET'
    | 'TYPE_DRIFT'
    | 'SOURCE_NOT_ACTIVE'
    | 'DUPLICATE_TARGET'
    | 'UNREFERENCED_NEW_NODE'
    | 'EXPLICIT_REVIEWED_MAPPING';
  evidence: string[];
}

export interface V018ImpactEvidence {
  contract: 'act-teaching-projection-v018-impact-evidence/v1';
  directAuthorityDeltaStatus: 'REJECTED_UPSTREAM';
  denominatorKind: 'capture-bound-active-act-teaching-refs';
  carriedForwardCount: number;
  reviewRequiredCount: number;
  unreferencedNewNodeCount: number;
  excludedHistoricalCount: number;
  excludedUnreferencedCount: number;
  records: V018MappingRecord[];
  upstreamImpactEvidence?: {
    status: 'REJECTED_UPSTREAM';
    path: string;
    digest: string;
  };
  digest: string;
}

export interface V018PointerSnapshot {
  path: string;
  sha256: string;
  bytes: number;
  content: string;
}

export interface V018DualBuildIdentity {
  firstProjectionId: string;
  firstProjectionHash: string;
  secondProjectionId: string;
  secondProjectionHash: string;
  firstPrerequisitePublicationId: string;
  firstPrerequisitePublicationHash: string;
  secondPrerequisitePublicationId: string;
  secondPrerequisitePublicationHash: string;
  byteEquivalent: true;
}

export interface V018RebaseReceipt {
  contract: typeof ACT_V018_REBASE_CONTRACT;
  policy: typeof ACT_V018_REBASE_POLICY;
  status: 'READY' | 'BLOCKED';
  mode: typeof ACT_V018_CANDIDATE_MODE;
  unqualified: true;
  nonActivation: true;
  selectorConsumption: false;
  authority: V018AuthorityBinding;
  capture: V018CaptureReceipt;
  databaseObservation: V018DatabaseObservationCheck;
  denominator: {
    referenceCount: number;
    resourceCount: number;
    bindingCount: number;
    prerequisiteCount: number;
    coreNodeCount: number;
    cardCount: number;
    digest: string;
    referenceKindCounts: Record<V018ReferenceKind, number>;
  };
  mapping: V018ImpactEvidence;
  projection: {
    projectionId: string | null;
    projectionHash: string | null;
    gateStatus: string;
    gatePassed: boolean;
  };
  prerequisite: {
    publicationId: string | null;
    publicationHash: string | null;
    gateStatus: string;
    gatePassed: boolean;
  };
  pointersBefore: V018PointerSnapshot[];
  pointersAfter: V018PointerSnapshot[];
  pointerBytesUnchanged: true;
  dualBuild: V018DualBuildIdentity | null;
  blockers: string[];
  receiptDigest: string;
}

export interface V018RebaseArtifacts {
  authoring: TeachingProjectionAuthoringInput;
  projection: TeachingProjectionArtifacts;
  prerequisite: PrerequisitePublicationArtifacts;
  prerequisiteInput?: {
    coreNodes: readonly import('../prerequisites/contracts').CoreNodeAuthoringRow[];
    edges: readonly import('../prerequisites/contracts').PrerequisiteEdgeAuthoring[];
    decisions: readonly import('../prerequisites/contracts').PrerequisiteAuthorDecision[];
    candidates: readonly import('../prerequisites/contracts').PrerequisiteCandidateRecord[];
  };
  references: V018ReferenceRecord[];
  capture: V018CaptureReceipt;
  mapping: V018ImpactEvidence;
}
