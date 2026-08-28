import { sha256Canonical } from '../resource-index/canonical';
import type { IndexedResourceEntry, RegistryIndex } from '../resource-index/types';

import {
  RESOURCE_ELIGIBILITY_CONTRACT,
  RESOURCE_ELIGIBILITY_DIMENSIONS,
  type ResourceEligibilityContext,
  type ResourceEligibilityDimensionId,
  type ResourceEligibilityDimensionResult,
  type ResourceEligibilityDimensionStatus,
  type ResourceEligibilityEvidence,
  type ResourceEligibilityPurpose,
  type ResourceEligibilitySnapshot,
} from './types';

function dimension(
  id: ResourceEligibilityDimensionId,
  status: ResourceEligibilityDimensionStatus,
  reason: string,
  evidenceIds: readonly string[],
  eligibleForContext: boolean,
): ResourceEligibilityDimensionResult {
  return { id, status, eligibleForContext, evidenceIds, reason };
}

function purposeEligible(
  purpose: ResourceEligibilityPurpose,
  dimensions: ResourceEligibilitySnapshot['dimensions'],
): boolean {
  switch (purpose) {
    case 'browse':
      return dimensions.retrievalReadiness.eligibleForContext;
    case 'recommend':
      return dimensions.retrievalReadiness.eligibleForContext;
    case 'path':
      return dimensions.pathEligibility.eligibleForContext;
    case 'formal-bind':
      return dimensions.formalBinding.eligibleForContext;
    case 'launch':
      return dimensions.launchAvailability.eligibleForContext;
    case 'named-consumer':
      return dimensions.consumerActivation.eligibleForContext;
    default: {
      const exhaustive: never = purpose;
      return exhaustive;
    }
  }
}

function optionalSoftAllowed(purpose: ResourceEligibilityPurpose): boolean {
  return purpose === 'browse' || purpose === 'recommend';
}

export function hashResourceEligibilityContext(context: ResourceEligibilityContext): string {
  return sha256Canonical({
    role: context.role,
    userId: context.userId ?? null,
    courseId: context.courseId ?? null,
    scope: context.scope,
    purpose: context.purpose,
    stage: context.stage ?? null,
    authorityId: context.authorityId ?? null,
    resourceIndexIdentity: context.resourceIndexIdentity,
    requestedRevision: context.requestedRevision ?? null,
    projectionId: context.projectionId ?? null,
    projectionHash: context.projectionHash ?? null,
    launcherContract: context.launcherContract ?? null,
    consumerId: context.consumerId ?? null,
    engineeringOnly: context.engineeringOnly === true,
  });
}

export function evaluateResourceEligibility(input: {
  context: ResourceEligibilityContext;
  entry: IndexedResourceEntry;
  index: RegistryIndex;
  evidence: ResourceEligibilityEvidence;
}): ResourceEligibilitySnapshot {
  const { context, entry, evidence, index } = input;
  const identityKey = entry.descriptor.identity.key;
  const hardIdentityFailure = !evidence.indexIdentityMatches
    || context.resourceIndexIdentity !== index.identity
    || !evidence.revisionMatches
    || !evidence.scopeMatches;
  const closed = evidence.retired || !evidence.authorizedForRole || hardIdentityFailure;
  const softOk = optionalSoftAllowed(context.purpose) && !entry.required;
  const optionalDisposition =
    evidence.formalDisposition === 'OPTIONAL' || evidence.formalDisposition === 'NONE';

  const retrievalStatus: ResourceEligibilityDimensionStatus = closed
    ? 'unavailable'
    : evidence.retrievalDegraded
      ? 'degraded'
      : evidence.retrievalAvailable
        ? 'available'
        : 'unavailable';
  const retrievalEligible =
    retrievalStatus === 'available' || (retrievalStatus === 'degraded' && softOk);

  const pathStatus: ResourceEligibilityDimensionStatus = closed
    ? 'blocked'
    : evidence.pathAudited
      ? 'available'
      : 'unavailable';

  const formalStatus: ResourceEligibilityDimensionStatus = closed || optionalDisposition
    ? closed
      ? 'blocked'
      : 'unavailable'
    : evidence.formalBindingValid
      ? 'available'
      : 'unavailable';

  const launchStatus: ResourceEligibilityDimensionStatus = closed
    ? 'blocked'
    : evidence.launchAuthorized && evidence.launcherMatches
      ? 'available'
      : 'unavailable';

  const releaseStatus: ResourceEligibilityDimensionStatus = closed || optionalDisposition
    ? 'blocked'
    : evidence.releaseQualified
      ? 'available'
      : 'unavailable';

  const projectionNotApplicable = evidence.teachingProjectionStatus === 'NOT_APPLICABLE';
  const projectionStatus: ResourceEligibilityDimensionStatus = projectionNotApplicable
    ? 'not-applicable'
    : closed || evidence.teachingProjectionStatus !== 'READY'
      ? evidence.teachingProjectionStatus === 'PINNED_PREVIOUS'
        ? 'blocked'
        : 'unavailable'
      : 'available';

  const consumerNotApplicable = evidence.consumerActivationStatus === 'NOT_APPLICABLE';
  const consumerStatus: ResourceEligibilityDimensionStatus = consumerNotApplicable
    ? 'not-applicable'
    : closed || evidence.consumerActivationStatus !== 'READY'
      ? 'blocked'
      : 'available';

  const dimensions = {
    retrievalReadiness: dimension(
      'retrievalReadiness',
      retrievalStatus,
      closed ? 'identity-or-authorization-closed' : retrievalStatus === 'available' ? 'retrieval-ready' : retrievalStatus === 'degraded' ? 'retrieval-degraded' : 'retrieval-unavailable',
      evidence.retrievalEvidenceIds,
      retrievalEligible,
    ),
    pathEligibility: dimension(
      'pathEligibility',
      pathStatus,
      closed ? 'path-fail-closed' : evidence.pathAudited ? 'path-audited' : 'path-not-audited',
      evidence.pathEvidenceIds,
      pathStatus === 'available',
    ),
    formalBinding: dimension(
      'formalBinding',
      formalStatus,
      optionalDisposition ? 'optional-or-none-does-not-bind' : closed ? 'formal-fail-closed' : evidence.formalBindingValid ? 'formal-binding-valid' : 'formal-binding-missing',
      evidence.formalEvidenceIds,
      formalStatus === 'available',
    ),
    launchAvailability: dimension(
      'launchAvailability',
      launchStatus,
      closed ? 'launch-fail-closed' : evidence.launchAuthorized && evidence.launcherMatches ? 'launcher-authorized' : 'launcher-unavailable',
      evidence.launchEvidenceIds,
      launchStatus === 'available',
    ),
    formalReleaseQualification: dimension(
      'formalReleaseQualification',
      releaseStatus,
      optionalDisposition ? 'optional-or-none-does-not-qualify' : closed ? 'release-fail-closed' : evidence.releaseQualified ? 'release-qualified' : 'release-not-qualified',
      evidence.releaseEvidenceIds,
      releaseStatus === 'available',
    ),
    teachingProjectionActivation: dimension(
      'teachingProjectionActivation',
      projectionStatus,
      projectionNotApplicable ? 'engineering-only-no-projection-required' : closed || evidence.teachingProjectionStatus !== 'READY' ? 'projection-not-ready' : 'projection-ready',
      evidence.teachingProjectionEvidenceIds,
      projectionStatus === 'available',
    ),
    consumerActivation: dimension(
      'consumerActivation',
      consumerStatus,
      consumerNotApplicable ? 'consumer-not-applicable' : closed || evidence.consumerActivationStatus !== 'READY' ? 'consumer-not-ready' : 'consumer-ready',
      evidence.consumerActivationEvidenceIds,
      consumerStatus === 'available',
    ),
  } satisfies ResourceEligibilitySnapshot['dimensions'];

  for (const id of RESOURCE_ELIGIBILITY_DIMENSIONS) {
    if (!dimensions[id]) {
      throw new Error(`Resource eligibility snapshot omitted ${id}.`);
    }
  }

  return {
    contract: RESOURCE_ELIGIBILITY_CONTRACT,
    contextHash: hashResourceEligibilityContext(context),
    resourceIdentityKey: identityKey,
    eligibleForContext: purposeEligible(context.purpose, dimensions),
    dimensions,
  };
}
