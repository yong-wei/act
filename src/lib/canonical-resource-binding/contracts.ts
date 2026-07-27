export const CANONICAL_RESOURCE_BINDING_ROLES = [
  'EXPLAINS',
  'PRACTICES',
  'ASSESSES',
  'REFERENCES',
] as const;

export type CanonicalResourceBindingRole =
  (typeof CANONICAL_RESOURCE_BINDING_ROLES)[number];

export type ResourceInventoryDisposition = 'INCLUDED' | 'EXCLUDED' | 'UNRESOLVED';

export type ResourcePositiveSignal =
  | 'published'
  | 'recommendable'
  | 'pathEligible'
  | 'evidenceProducing'
  | 'currentlyDelivered';

export type ResourceExclusionSignal =
  | 'draft'
  | 'disabled'
  | 'archived'
  | 'auditOnly'
  | 'nonTeaching';

export interface ResourceInventoryObservation {
  sourceObservationId: string;
  sourceKind: string;
  sourceAvailable: boolean;
  captureRevision: string;
  capturedAt: string;
  dbWatermark: string;
  atomicResourceId: string;
  resourceId: string;
  structuralUnitId: string;
  segmentId: string;
  resourceSegmentHash: string;
  positiveSignals?: Partial<Record<ResourcePositiveSignal, boolean>>;
  exclusionSignals?: Partial<Record<ResourceExclusionSignal, boolean>>;
  teacherOnly?: boolean;
  dispositionDeclared?: boolean;
  placementRefs?: string[];
  publicationRevision?: {
    id: string;
    revisionNumber: number;
    manifestHash: string;
    contentHash: string;
  } | null;
  conflictReasonCodes?: string[];
}

export interface ResourceInventoryItem {
  atomicResourceId: string;
  resourceId: string;
  structuralUnitId: string;
  segmentId: string;
  resourceSegmentHash: string;
  disposition: ResourceInventoryDisposition;
  reasonCodes: string[];
  sourceObservations: Array<{
    sourceObservationId: string;
    sourceKind: string;
    sourceAvailable: boolean;
    observedIdentityDigest: string;
    positiveSignals: string[];
    exclusionSignals: string[];
    teacherOnly: boolean;
    dispositionDeclared: boolean;
    placementRefs: string[];
    publicationRevisionDigest: string | null;
  }>;
  observationDigest: string;
}

export interface ResourceBindingInventory {
  schemaVersion: 'canonical-resource-binding-inventory/v1';
  runId: string;
  captureRevision: string;
  capturedAt: string;
  dbWatermark: string;
  sourceHash: string;
  complete: boolean;
  cutoverReady: boolean;
  authorityState: 'SHADOW';
  summary: {
    itemCount: number;
    includedCount: number;
    excludedCount: number;
    unresolvedCount: number;
  };
  items: ResourceInventoryItem[];
}

export interface EvidenceStructuralUnitCrosswalk {
  id: string;
  releaseId: string;
  evidenceId: string;
  sourceEditionId: string;
  sourceVersion: string;
  evidenceContentHash: string;
  structuralUnitId: string;
  structuralUnitVersion: string;
  structuralUnitHash: string;
  inventoryRunId: string;
  atomicResourceId: string;
  resourceId: string;
  segmentId: string;
  resourceSegmentHash: string;
  captureRevision: string;
  canonicalId: string;
  validationState: 'VALIDATED';
  validationDigest: string;
}

export interface AuthoritativeEvidenceAlignment {
  releaseId: string;
  evidenceId: string;
  canonicalId: string;
}

export interface CanonicalCandidateIdentity {
  releaseSetId: string;
  releaseId: string;
  canonicalId: string;
  objectRevision: string;
  resourceId: string;
  structuralUnitId: string;
  segmentId: string;
  resourceSegmentHash: string;
}

export interface CanonicalObjectIndexEntry {
  releaseSetId: string;
  releaseId: string;
  canonicalId: string;
  objectRevision: string;
  canonicalType: string;
}

export interface ResourceSegmentIndexEntry {
  resourceId: string;
  structuralUnitId: string;
  segmentId: string;
  resourceSegmentHash: string;
  candidateCanonicalIds: string[];
  deterministicRole: CanonicalResourceBindingRole | null;
  evidenceIds: string[];
}

export interface CanonicalResourceBindingCandidate extends CanonicalCandidateIdentity {
  id: string;
  pairId: string;
  trigger: 'CANONICAL_CHANGE' | 'RESOURCE_CHANGE';
  proposedRole: CanonicalResourceBindingRole | null;
  evidenceIds: string[];
  generatorPromptVersion: string;
  generatorCacheKey: string;
}

export interface CandidateGenerationOutput {
  candidates: CanonicalResourceBindingCandidate[];
  reusedDecisionIds: string[];
}

export type CanonicalBindingReviewState =
  | 'NOT_REQUIRED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'DISPUTED'
  | 'REVIEW_RETRYABLE'
  | 'HUMAN_REQUIRED';

export type CanonicalBindingPublicationState =
  | 'CANDIDATE'
  | 'REVIEW_RETRYABLE'
  | 'HUMAN_REQUIRED'
  | 'SHADOW_PUBLISHED';

export type CanonicalBindingLifecycleState = 'CURRENT' | 'SUPERSEDED';

export const CANONICAL_BINDING_HIGH_IMPACT_POLICY_VERSION = 'binding-impact/v1';
export const CANONICAL_BINDING_HIGH_IMPACT_REASONS = [
  'fixture-review-not-authoritative',
  'review-disputed',
  'crosswalk-not-unique',
  'crosswalk-endpoint-mismatch',
  'evidence-alignment-not-unique',
  'canonical-endpoint-or-revision-mismatch',
  'invalid-teaching-role',
  'binding-role-not-unique',
] as const;
export type CanonicalBindingHighImpactReason =
  (typeof CANONICAL_BINDING_HIGH_IMPACT_REASONS)[number];

export interface GeneratorDecisionCacheRecord {
  candidateId: string;
  generatorCacheKey: string;
  proposedRole: CanonicalResourceBindingRole;
  evidenceDigest: string;
  evidenceIds: string[];
  highImpactReasons: CanonicalBindingHighImpactReason[];
}

export interface ReviewerInput {
  candidateIdentity: CanonicalCandidateIdentity;
  canonicalProfile: {
    canonicalId: string;
    canonicalType: string;
    semanticProfile: string;
  };
  resourceSegment: {
    structuralUnitId: string;
    segmentId: string;
    contentHash: string;
    content: string;
  };
  proposedRole: CanonicalResourceBindingRole;
  evidenceIds: string[];
  evidenceDigest: string;
}

export interface ReviewerDecision {
  outcome: 'ACCEPT' | 'REJECT' | 'DISPUTE';
  provider: 'GPT' | 'FIXTURE';
  reviewerPromptVersion: string;
  reviewerCacheKey: string;
}

export interface CanonicalResourceBindingDecision
  extends CanonicalResourceBindingCandidate {
  role: CanonicalResourceBindingRole;
  evidenceId: string | null;
  evidenceDigest: string;
  reviewerPromptVersion: string;
  reviewerCacheKey: string;
  reviewerRole: 'INDEPENDENT_REVIEWER';
  reviewerInputDigest: string;
  candidateDigest: string;
  reviewProvider: 'GPT' | 'FIXTURE' | 'HUMAN' | 'NONE';
  reviewState: CanonicalBindingReviewState;
  publicationState: CanonicalBindingPublicationState;
  highImpactPolicyVersion: typeof CANONICAL_BINDING_HIGH_IMPACT_POLICY_VERSION;
  highImpactReasons: CanonicalBindingHighImpactReason[];
  attemptSequence: number;
  lifecycleState: CanonicalBindingLifecycleState;
  supersedesDecisionId: string | null;
  crosswalkId: string | null;
  validationDigest: string | null;
}

export interface PublicationGateContext {
  canonicalObjects: CanonicalObjectIndexEntry[];
  crosswalks: EvidenceStructuralUnitCrosswalk[];
  evidenceAlignments: AuthoritativeEvidenceAlignment[];
  existingPublished: CanonicalResourceBindingDecision[];
}

export type ResourceKnowledgeAuthoritySelector =
  | {
      consumer: 'FORMAL_RECOMMENDATION' | 'FORMAL_PATH' | 'FORMAL_EVIDENCE';
      authority: 'LEGACY';
      canonicalBindingsVisible: false;
    }
  | {
      consumer: 'SHADOW_AUDIT';
      authority: 'CANONICAL_SHADOW';
      canonicalBindingsVisible: true;
    };
