export const RESOURCE_ELIGIBILITY_CONTRACT = 'resource-eligibility/v1';

export const RESOURCE_ELIGIBILITY_DIMENSIONS = [
  'retrievalReadiness',
  'pathEligibility',
  'formalBinding',
  'launchAvailability',
  'formalReleaseQualification',
  'teachingProjectionActivation',
  'consumerActivation',
] as const;

export type ResourceEligibilityDimensionId = (typeof RESOURCE_ELIGIBILITY_DIMENSIONS)[number];

export type ResourceEligibilityRole = 'student' | 'teacher' | 'admin';

export type ResourceEligibilityPurpose =
  | 'browse'
  | 'recommend'
  | 'path'
  | 'formal-bind'
  | 'launch'
  | 'named-consumer';

export type ResourceEligibilityDimensionStatus =
  | 'available'
  | 'degraded'
  | 'unavailable'
  | 'blocked'
  | 'not-applicable';

export interface ResourceEligibilityLauncherContract {
  contractClass: string;
  contractVersion: string;
}

export interface ResourceEligibilityContext {
  role: ResourceEligibilityRole;
  userId?: string;
  courseId?: string;
  scope: string;
  purpose: ResourceEligibilityPurpose;
  stage?: string;
  authorityId?: string;
  resourceIndexIdentity: string;
  requestedRevision?: string;
  captureRevision?: string;
  projectionId?: string;
  projectionHash?: string;
  launcherContract?: ResourceEligibilityLauncherContract;
  consumerId?: string;
  engineeringOnly?: boolean;
}

export interface ResourceEligibilityDimensionResult {
  id: ResourceEligibilityDimensionId;
  status: ResourceEligibilityDimensionStatus;
  eligibleForContext: boolean;
  evidenceIds: readonly string[];
  reason: string;
}

export interface ResourceEligibilitySnapshot {
  contract: typeof RESOURCE_ELIGIBILITY_CONTRACT;
  contextHash: string;
  resourceIdentityKey: string;
  eligibleForContext: boolean;
  dimensions: Record<ResourceEligibilityDimensionId, ResourceEligibilityDimensionResult>;
}

export type FormalDisposition = 'INCLUDED' | 'EXCLUDED' | 'OPTIONAL' | 'NONE' | 'REQUIRED';

export interface ResourceEligibilityEvidence {
  indexIdentityMatches: boolean;
  revisionMatches: boolean;
  scopeMatches: boolean;
  authorizedForRole: boolean;
  retired: boolean;
  retrievalAvailable: boolean;
  retrievalDegraded: boolean;
  retrievalEvidenceIds: readonly string[];
  pathAudited: boolean;
  pathEvidenceIds: readonly string[];
  formalBindingValid: boolean;
  formalDisposition?: FormalDisposition;
  formalEvidenceIds: readonly string[];
  launchAuthorized: boolean;
  launcherMatches: boolean;
  launchEvidenceIds: readonly string[];
  releaseQualified: boolean;
  releaseEvidenceIds: readonly string[];
  teachingProjectionStatus: 'READY' | 'NOT_PROJECTED' | 'PINNED_PREVIOUS' | 'BLOCKED' | 'NOT_APPLICABLE';
  teachingProjectionEvidenceIds: readonly string[];
  consumerActivationStatus: 'READY' | 'PINNED_PREVIOUS' | 'BLOCKED' | 'NOT_APPLICABLE';
  consumerActivationEvidenceIds: readonly string[];
}
