import type { CanonicalResourceCutoverReadiness } from '@/lib/canonical-resource-binding/authority';
import type { ResourceInventoryDisposition } from '@/lib/canonical-resource-binding/contracts';
import type {
  TeachingProjectionConsumerActivation,
  TeachingProjectionMode,
} from '@/lib/teaching-projection/contracts';
import type {
  ConsumerActivationRecord,
  ConsumerActivationStatus,
} from '@/lib/versioned-knowledge-activation/contracts';

import type { IndexedEligibilityObservation } from './adapters';
import type { FormalDisposition, ResourceEligibilityEvidence } from './types';

export function formalDispositionFromTeachingMode(
  mode: TeachingProjectionMode | undefined,
): FormalDisposition | undefined {
  if (mode === 'REQUIRED') return 'REQUIRED';
  if (mode === 'OPTIONAL') return 'OPTIONAL';
  if (mode === 'NONE') return 'NONE';
  return undefined;
}

export function formalDispositionFromInventory(
  disposition: ResourceInventoryDisposition | undefined,
): FormalDisposition | undefined {
  if (disposition === 'INCLUDED') return 'INCLUDED';
  if (disposition === 'EXCLUDED') return 'EXCLUDED';
  if (disposition === 'UNRESOLVED') return 'NONE';
  return undefined;
}

export function observationFromTeachingProjectionConsumer(
  consumer: Pick<
    TeachingProjectionConsumerActivation,
    'consumerId' | 'readiness' | 'requiresProjection' | 'authorityReleaseId' | 'projectionId' | 'projectionHash'
  >,
): Pick<
  IndexedEligibilityObservation,
  | 'requiresProjection'
  | 'teachingProjectionStatus'
  | 'teachingProjectionEvidenceIds'
  | 'teachingProjectionIdentity'
> {
  const teachingProjectionStatus: ResourceEligibilityEvidence['teachingProjectionStatus'] =
    consumer.requiresProjection === false
      ? 'NOT_APPLICABLE'
      : consumer.readiness === 'READY'
        ? 'READY'
        : consumer.readiness === 'PINNED_PREVIOUS'
          ? 'PINNED_PREVIOUS'
          : consumer.readiness === 'BLOCKED_LOCAL_DEPENDENCY'
            ? 'BLOCKED'
            : 'NOT_PROJECTED';
  return {
    requiresProjection: consumer.requiresProjection,
    teachingProjectionStatus,
    teachingProjectionEvidenceIds: [
      `teaching-projection:${consumer.consumerId}:${consumer.readiness}`,
    ],
    teachingProjectionIdentity: {
      consumerId: consumer.consumerId,
      authorityReleaseId: consumer.authorityReleaseId,
      projectionId: consumer.projectionId,
      projectionHash: consumer.projectionHash,
    },
  };
}

function consumerStatusFromActivation(
  status: ConsumerActivationStatus,
): ResourceEligibilityEvidence['consumerActivationStatus'] {
  if (status === 'READY') return 'READY';
  if (status === 'PINNED_PREVIOUS') return 'PINNED_PREVIOUS';
  return 'BLOCKED';
}

export function observationFromConsumerActivation(
  record: Pick<ConsumerActivationRecord, 'consumerId' | 'status' | 'combination'>,
): Pick<
  IndexedEligibilityObservation,
  | 'consumerId'
  | 'consumerCombination'
  | 'consumerActivationStatus'
  | 'consumerActivationEvidenceIds'
> {
  return {
    consumerId: record.consumerId,
    consumerCombination: {
      authorityReleaseId: record.combination.authorityReleaseId,
      authoritySnapshotId: record.combination.authoritySnapshotId,
      authoritySnapshotHash: record.combination.authoritySnapshotHash,
      projectionId: record.combination.projectionId,
      projectionHash: record.combination.projectionHash,
      scopeId: record.combination.scopeId,
      captureRevision: record.combination.captureRevision,
    },
    consumerActivationStatus: consumerStatusFromActivation(record.status),
    consumerActivationEvidenceIds: [
      `consumer-activation:${record.consumerId}:${record.status}`,
    ],
  };
}

export function observationFromFormalReleaseQualification(
  readiness: Pick<CanonicalResourceCutoverReadiness, 'ready' | 'scope'>,
  captureRevision?: string,
): Pick<
  IndexedEligibilityObservation,
  'releaseQualified' | 'releasePackageId' | 'releaseCaptureRevision' | 'releaseEvidenceIds'
> {
  return {
    releaseQualified: readiness.ready === true && readiness.scope.consumerState === 'READY',
    releasePackageId: readiness.scope.packageId,
    releaseCaptureRevision: captureRevision ?? null,
    releaseEvidenceIds: [
      `formal-release:${readiness.scope.packageId ?? 'unscoped'}:${readiness.scope.consumerState}`,
    ],
  };
}

export function mergeEligibilityObservations(
  ...parts: Array<IndexedEligibilityObservation | undefined>
): IndexedEligibilityObservation {
  const merged: IndexedEligibilityObservation = {};
  for (const part of parts) {
    if (!part) continue;
    if (part.pathAudited !== undefined) merged.pathAudited = part.pathAudited;
    if (part.formalBindingValid !== undefined) merged.formalBindingValid = part.formalBindingValid;
    if (part.formalDisposition) merged.formalDisposition = part.formalDisposition;
    if (part.requiresProjection !== undefined) merged.requiresProjection = part.requiresProjection;
    if (part.teachingProjectionStatus) {
      merged.teachingProjectionStatus = part.teachingProjectionStatus;
    }
    if (part.teachingProjectionEvidenceIds) {
      merged.teachingProjectionEvidenceIds = part.teachingProjectionEvidenceIds;
    }
    if (part.teachingProjectionIdentity) {
      merged.teachingProjectionIdentity = part.teachingProjectionIdentity;
    }
    if (part.consumerId) merged.consumerId = part.consumerId;
    if (part.consumerCombination) merged.consumerCombination = part.consumerCombination;
    if (part.consumerActivationStatus) {
      merged.consumerActivationStatus = part.consumerActivationStatus;
    }
    if (part.consumerActivationEvidenceIds) {
      merged.consumerActivationEvidenceIds = part.consumerActivationEvidenceIds;
    }
    if (part.releaseQualified !== undefined) merged.releaseQualified = part.releaseQualified;
    if (part.releasePackageId !== undefined) merged.releasePackageId = part.releasePackageId;
    if (part.releaseCaptureRevision !== undefined) {
      merged.releaseCaptureRevision = part.releaseCaptureRevision;
    }
    if (part.releaseEvidenceIds) merged.releaseEvidenceIds = part.releaseEvidenceIds;
  }
  return merged;
}
