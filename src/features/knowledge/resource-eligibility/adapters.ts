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
  teachingProjectionStatus?: ResourceEligibilityEvidence['teachingProjectionStatus'];
  teachingProjectionEvidenceIds?: readonly string[];
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
  releaseEvidenceIds?: readonly string[];
}

function consumerActivationMatchesContext(
  context: ResourceEligibilityContext,
  observation: IndexedEligibilityObservation | undefined,
): boolean {
  const status = observation?.consumerActivationStatus ?? 'NOT_APPLICABLE';
  if (status === 'NOT_APPLICABLE' && !observation?.consumerId) return true;
  if (context.consumerId && observation?.consumerId !== context.consumerId) return false;
  if (status !== 'READY' && status !== 'PINNED_PREVIOUS') return true;
  const combination = observation?.consumerCombination;
  if (!combination) return false;
  if (context.authorityId && combination.authorityReleaseId !== context.authorityId) return false;
  if (context.requestedRevision && combination.captureRevision !== context.requestedRevision) return false;
  if (context.courseId && combination.scopeId !== context.courseId) return false;
  if (context.projectionId && combination.projectionId !== context.projectionId) return false;
  if (context.projectionHash && combination.projectionHash !== context.projectionHash) return false;
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
  const engineeringOnly = context.engineeringOnly === true;
  const consumerMatches = consumerActivationMatchesContext(context, observation);

  return {
    indexIdentityMatches: context.resourceIndexIdentity === index.identity,
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
    releaseQualified: observation?.releaseQualified === true,
    releaseEvidenceIds: observation?.releaseEvidenceIds ?? [],
    teachingProjectionStatus: engineeringOnly
      ? 'NOT_APPLICABLE'
      : observation?.teachingProjectionStatus ?? 'NOT_PROJECTED',
    teachingProjectionEvidenceIds: observation?.teachingProjectionEvidenceIds ?? [],
    consumerActivationStatus: consumerMatches
      ? observation?.consumerActivationStatus ?? 'NOT_APPLICABLE'
      : 'BLOCKED',
    consumerActivationEvidenceIds: observation?.consumerActivationEvidenceIds ?? [],
  };
}
