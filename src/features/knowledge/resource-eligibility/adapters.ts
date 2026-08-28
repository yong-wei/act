import { canonicalStringify } from '../resource-index/canonical';
import { canRevealIndexedResource } from '../resource-index/resolve';
import type { IndexedResourceEntry, RegistryIndex } from '../resource-index/types';

import type {
  FormalDisposition,
  ResourceEligibilityContext,
  ResourceEligibilityEvidence,
} from './types';

export interface IndexedEligibilityObservation {
  pathAudited?: boolean;
  formalBindingValid?: boolean;
  formalDisposition?: FormalDisposition;
  requiresProjection?: boolean;
  teachingProjectionStatus?: ResourceEligibilityEvidence['teachingProjectionStatus'];
  teachingProjectionEvidenceIds?: readonly string[];
  teachingProjectionIdentity?: {
    consumerId: string;
    authorityReleaseId: string;
    projectionId: string | null;
    projectionHash: string | null;
  };
  consumerId?: string;
  consumerCombination?: {
    authorityReleaseId?: string | null;
    projectionId?: string | null;
    projectionHash?: string | null;
    scopeId?: string | null;
    captureRevision?: string | null;
  };
  consumerActivationStatus?: ResourceEligibilityEvidence['consumerActivationStatus'];
  consumerActivationEvidenceIds?: readonly string[];
  releaseQualified?: boolean;
  releasePackageId?: string | null;
  releaseCaptureRevision?: string | null;
  releaseEvidenceIds?: readonly string[];
}

function indexedEntryFingerprint(entry: IndexedResourceEntry): string {
  return canonicalStringify({
    descriptor: entry.descriptor,
    access: entry.access,
    required: entry.required,
  });
}

function indexedEntryBelongsToIndex(index: RegistryIndex, entry: IndexedResourceEntry): boolean {
  const fingerprint = indexedEntryFingerprint(entry);
  return index.entries.some((candidate) => indexedEntryFingerprint(candidate) === fingerprint);
}

function indexCaptureMatchesContext(
  index: RegistryIndex,
  context: ResourceEligibilityContext,
): boolean {
  if (!context.captureRevision) return true;
  const revisions = index.captures
    .map((capture) => capture.sharedRevision)
    .filter((revision): revision is string => Boolean(revision));
  if (revisions.length === 0) return false;
  return revisions.every((revision) => revision === context.captureRevision);
}

function ownerEngineeringOnly(
  context: ResourceEligibilityContext,
  observation: IndexedEligibilityObservation | undefined,
): boolean {
  if (observation?.requiresProjection !== false) return false;
  const ownerConsumerId = observation.teachingProjectionIdentity?.consumerId ?? observation.consumerId;
  if (context.consumerId && ownerConsumerId && ownerConsumerId !== context.consumerId) return false;
  return true;
}

function namedConsumerPinsPresent(
  context: ResourceEligibilityContext,
  observation: IndexedEligibilityObservation | undefined,
): boolean {
  if (!context.consumerId || !context.authorityId || !context.requestedRevision || !context.captureRevision) {
    return false;
  }
  if (ownerEngineeringOnly(context, observation)) return true;
  return Boolean(context.projectionId && context.projectionHash);
}

function consumerActivationMatchesContext(
  context: ResourceEligibilityContext,
  observation: IndexedEligibilityObservation | undefined,
): boolean {
  if (context.purpose === 'named-consumer' && !namedConsumerPinsPresent(context, observation)) return false;
  const status = observation?.consumerActivationStatus ?? 'NOT_APPLICABLE';
  if (status === 'NOT_APPLICABLE' && !observation?.consumerId) return true;
  if (observation?.consumerId && context.consumerId && observation.consumerId !== context.consumerId) {
    return false;
  }
  if (status !== 'READY' && status !== 'PINNED_PREVIOUS') return true;
  const combination = observation?.consumerCombination;
  if (!combination) return false;
  if (context.authorityId && combination.authorityReleaseId !== context.authorityId) return false;
  if (context.captureRevision && combination.captureRevision !== context.captureRevision) return false;
  if (context.purpose === 'named-consumer') {
    const requestedScope = context.courseId ?? context.scope;
    if (combination.scopeId !== requestedScope) return false;
  } else if (context.courseId && combination.scopeId !== context.courseId) {
    return false;
  }
  if (context.projectionId && combination.projectionId !== context.projectionId) return false;
  if (context.projectionHash && combination.projectionHash !== context.projectionHash) return false;
  return true;
}

function teachingProjectionMatchesContext(
  context: ResourceEligibilityContext,
  observation: IndexedEligibilityObservation | undefined,
): boolean {
  if (ownerEngineeringOnly(context, observation)) return true;
  if (context.engineeringOnly === true) return false;
  const status = observation?.teachingProjectionStatus;
  if (status !== 'READY' && status !== 'PINNED_PREVIOUS') return true;
  const identity = observation?.teachingProjectionIdentity;
  if (!identity) return false;
  if (context.consumerId && identity.consumerId !== context.consumerId) return false;
  if (context.authorityId && identity.authorityReleaseId !== context.authorityId) return false;
  if (context.projectionId && identity.projectionId !== context.projectionId) return false;
  if (context.projectionHash && identity.projectionHash !== context.projectionHash) return false;
  return true;
}

function releaseQualifiedForContext(
  context: ResourceEligibilityContext,
  observation: IndexedEligibilityObservation | undefined,
): boolean {
  if (observation?.releaseQualified !== true) return false;
  if (context.courseId && observation.releasePackageId !== context.courseId) return false;
  if (
    context.captureRevision
    && observation.releaseCaptureRevision
    && observation.releaseCaptureRevision !== context.captureRevision
  ) {
    return false;
  }
  return true;
}

export function evidenceFromIndexedEntry(input: {
  index: RegistryIndex;
  entry: IndexedResourceEntry;
  context: ResourceEligibilityContext;
  observation?: IndexedEligibilityObservation;
}): ResourceEligibilityEvidence {
  const { index, entry, context, observation } = input;
  const identity = entry.descriptor.identity;
  const launcher = entry.descriptor.launcher;
  const retired = entry.access.sourceAvailability === 'archived' || entry.access.teacherPolicy === 'blocked';
  const authorizedForRole = canRevealIndexedResource(entry.access, context.role);
  const launcherMatches = Boolean(
    launcher
    && (
      !context.launcherContract
      || (
        launcher.contractClass === context.launcherContract.contractClass
        && launcher.contractVersion === context.launcherContract.contractVersion
      )
    ),
  );
  const pathAudited = observation?.pathAudited === true;
  const formalBindingValid = observation?.formalBindingValid === true;
  const engineeringOnly = ownerEngineeringOnly(context, observation);
  const engineeringConflict = context.engineeringOnly === true && !engineeringOnly;
  const consumerMatches = consumerActivationMatchesContext(context, observation);
  const projectionMatches = teachingProjectionMatchesContext(context, observation);

  return {
    indexIdentityMatches:
      context.resourceIndexIdentity === index.identity
      && indexedEntryBelongsToIndex(index, entry)
      && indexCaptureMatchesContext(index, context),
    revisionMatches: !context.requestedRevision || context.requestedRevision === identity.sourceVersion,
    scopeMatches: identity.scope === context.scope || (!!context.courseId && identity.scope === context.courseId),
    authorizedForRole,
    retired,
    retrievalAvailable: entry.descriptor.availability === 'available',
    retrievalDegraded: entry.descriptor.availability === 'degraded',
    retrievalEvidenceIds: [`descriptor:${identity.key}`],
    pathAudited,
    pathEvidenceIds: pathAudited && entry.descriptor.foreignRefs.resourceNodeId
      ? [`resource-node:${entry.descriptor.foreignRefs.resourceNodeId}`]
      : [],
    formalBindingValid,
    formalDisposition: observation?.formalDisposition,
    formalEvidenceIds: [
      ...(entry.descriptor.foreignRefs.formalBindingIds ?? []).map((id) => `formal-binding:${id}`),
      ...(entry.descriptor.foreignRefs.canonicalIds ?? []).map((id) => `canonical:${id}`),
    ],
    launchAuthorized: authorizedForRole && !retired && Boolean(launcher),
    launcherMatches,
    launchEvidenceIds: launcher ? [`launcher:${launcher.contractClass}:${launcher.contractVersion}`] : [],
    releaseQualified: releaseQualifiedForContext(context, observation),
    releaseEvidenceIds: observation?.releaseEvidenceIds ?? [],
    teachingProjectionStatus: engineeringConflict
      ? 'BLOCKED'
      : engineeringOnly
        ? 'NOT_APPLICABLE'
        : projectionMatches
          ? observation?.teachingProjectionStatus ?? 'NOT_PROJECTED'
          : 'BLOCKED',
    teachingProjectionEvidenceIds: observation?.teachingProjectionEvidenceIds ?? [],
    consumerActivationStatus: consumerMatches
      ? observation?.consumerActivationStatus ?? 'NOT_APPLICABLE'
      : 'BLOCKED',
    consumerActivationEvidenceIds: observation?.consumerActivationEvidenceIds ?? [],
  };
}
