/**
 * Per-consumer Authority/Projection combinations (#1267).
 *
 * Emits activation records without changing existing selectors.
 * Engineering-only consumers may omit Projection; teaching consumers require it.
 */

import {
  TEACHING_PROJECTION_ACTIVATION_CONTRACT,
  type TeachingProjectionActivationManifest,
  type TeachingProjectionConsumerActivation,
  type TeachingProjectionConsumerKind,
  type TeachingProjectionManifest,
} from './contracts';
import { projectionDigest } from './hash';

export interface ConsumerCombinationInput {
  consumerId: string;
  consumerKind: TeachingProjectionConsumerKind;
  authorityReleaseId: string;
  /** Prior pin when new projection is blocked or unavailable. */
  pinnedProjectionId?: string | null;
  pinnedProjectionHash?: string | null;
  /** When true, consumer does not need a Teaching Projection. */
  engineeringOnly?: boolean;
}

export interface BuildActivationManifestInput {
  consumers: readonly ConsumerCombinationInput[];
  /**
   * Currently available / newly built projection (may be null when none exists).
   * Empty projections with a valid manifest are allowed.
   */
  projection: TeachingProjectionManifest | null;
  /**
   * When projection gate failed, teaching consumers must not become READY on it.
   */
  projectionGatePassed?: boolean;
  activationId?: string;
}

function readinessFor(input: {
  consumer: ConsumerCombinationInput;
  projection: TeachingProjectionManifest | null;
  projectionGatePassed: boolean;
}): Pick<TeachingProjectionConsumerActivation, 'readiness' | 'projectionId' | 'projectionHash' | 'reasons'> {
  const reasons: string[] = [];
  const engineeringOnly =
    input.consumer.engineeringOnly === true
    || input.consumer.consumerKind === 'engineering-graph'
    || input.consumer.consumerKind === 'engineering-rag';

  if (engineeringOnly) {
    reasons.push('engineering-only-no-projection-required');
    return {
      readiness: 'READY',
      projectionId: null,
      projectionHash: null,
      reasons,
    };
  }

  // Teaching consumers require a projection.
  if (!input.projection) {
    if (input.consumer.pinnedProjectionId) {
      reasons.push('projection-missing-pin-previous');
      return {
        readiness: 'PINNED_PREVIOUS',
        projectionId: input.consumer.pinnedProjectionId,
        projectionHash: input.consumer.pinnedProjectionHash ?? null,
        reasons,
      };
    }
    reasons.push('projection-not-available');
    return {
      readiness: 'NOT_PROJECTED',
      projectionId: null,
      projectionHash: null,
      reasons,
    };
  }

  if (!input.projectionGatePassed) {
    reasons.push('projection-gate-failed');
    if (input.consumer.pinnedProjectionId) {
      reasons.push('pin-previous-after-gate-failure');
      return {
        readiness: 'PINNED_PREVIOUS',
        projectionId: input.consumer.pinnedProjectionId,
        projectionHash: input.consumer.pinnedProjectionHash ?? null,
        reasons,
      };
    }
    return {
      readiness: 'BLOCKED_LOCAL_DEPENDENCY',
      projectionId: input.projection.projectionId,
      projectionHash: input.projection.projectionHash,
      reasons,
    };
  }

  // Authority release mismatch: consumer pins Authority independently; when the
  // projection was built for a different release, treat as local dependency block
  // unless the consumer intentionally uses the projection's release.
  if (
    input.consumer.authorityReleaseId
    && input.projection.authorityReleaseId
    && input.consumer.authorityReleaseId !== input.projection.authorityReleaseId
  ) {
    reasons.push('authority-projection-release-mismatch');
    if (input.consumer.pinnedProjectionId) {
      return {
        readiness: 'PINNED_PREVIOUS',
        projectionId: input.consumer.pinnedProjectionId,
        projectionHash: input.consumer.pinnedProjectionHash ?? null,
        reasons,
      };
    }
    return {
      readiness: 'BLOCKED_LOCAL_DEPENDENCY',
      projectionId: input.projection.projectionId,
      projectionHash: input.projection.projectionHash,
      reasons,
    };
  }

  reasons.push('projection-ready');
  return {
    readiness: 'READY',
    projectionId: input.projection.projectionId,
    projectionHash: input.projection.projectionHash,
    reasons,
  };
}

/**
 * Build an activation manifest mapping each consumer to an explicit
 * Authority/Projection combination. Does not mutate existing selectors.
 */
export function buildTeachingProjectionActivationManifest(
  input: BuildActivationManifestInput,
): TeachingProjectionActivationManifest {
  // Manifest gate is the authority. An external flag may only tighten to fail,
  // never override a failed manifest gate into READY.
  const manifestGatePassed = input.projection?.gatePassed === true;
  const projectionGatePassed =
    manifestGatePassed && input.projectionGatePassed !== false;

  const consumers: TeachingProjectionConsumerActivation[] = [...input.consumers]
    .map((consumer) => {
      const engineeringOnly =
        consumer.engineeringOnly === true
        || consumer.consumerKind === 'engineering-graph'
        || consumer.consumerKind === 'engineering-rag';
      const resolved = readinessFor({
        consumer,
        projection: input.projection,
        projectionGatePassed,
      });
      return {
        consumerId: consumer.consumerId,
        consumerKind: consumer.consumerKind,
        authorityReleaseId: consumer.authorityReleaseId,
        projectionId: resolved.projectionId,
        projectionHash: resolved.projectionHash,
        requiresProjection: !engineeringOnly,
        readiness: resolved.readiness,
        reasons: resolved.reasons,
      };
    })
    .sort((a, b) => {
      if (a.consumerId < b.consumerId) return -1;
      if (a.consumerId > b.consumerId) return 1;
      return 0;
    });

  const body = {
    contract: TEACHING_PROJECTION_ACTIVATION_CONTRACT,
    consumers,
  };
  const activationHash = projectionDigest(body);
  const activationId = input.activationId ?? `activation-${activationHash.slice(0, 24)}`;

  return {
    contract: TEACHING_PROJECTION_ACTIVATION_CONTRACT,
    activationId,
    activationHash,
    consumers,
  };
}

/**
 * Default consumer set used by fixture tests: engineering-first activation
 * with teaching consumers optionally projected.
 */
export function defaultConsumerCombinationInputs(input: {
  authorityReleaseId: string;
  pinnedProjectionId?: string | null;
  pinnedProjectionHash?: string | null;
}): ConsumerCombinationInput[] {
  return [
    {
      consumerId: 'engineering-graph',
      consumerKind: 'engineering-graph',
      authorityReleaseId: input.authorityReleaseId,
      engineeringOnly: true,
    },
    {
      consumerId: 'engineering-rag',
      consumerKind: 'engineering-rag',
      authorityReleaseId: input.authorityReleaseId,
      engineeringOnly: true,
    },
    {
      consumerId: 'teaching-resource-rag',
      consumerKind: 'teaching-resource-rag',
      authorityReleaseId: input.authorityReleaseId,
      pinnedProjectionId: input.pinnedProjectionId,
      pinnedProjectionHash: input.pinnedProjectionHash,
    },
    {
      consumerId: 'course-package:automatic-control',
      consumerKind: 'course-package',
      authorityReleaseId: input.authorityReleaseId,
      pinnedProjectionId: input.pinnedProjectionId,
      pinnedProjectionHash: input.pinnedProjectionHash,
    },
    {
      consumerId: 'learning-path',
      consumerKind: 'learning-path',
      authorityReleaseId: input.authorityReleaseId,
      pinnedProjectionId: input.pinnedProjectionId,
      pinnedProjectionHash: input.pinnedProjectionHash,
    },
    {
      consumerId: 'konling',
      consumerKind: 'konling',
      authorityReleaseId: input.authorityReleaseId,
      pinnedProjectionId: input.pinnedProjectionId,
      pinnedProjectionHash: input.pinnedProjectionHash,
    },
  ];
}
