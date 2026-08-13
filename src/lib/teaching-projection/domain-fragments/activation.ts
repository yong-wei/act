/**
 * Teaching Projection activation independent of Engineering Authority (#1370).
 *
 * Teaching-layer caches invalidate by projection identity only.
 * Authority selection and engineering facts are never reactivated or rewritten.
 * Expected identity must be supplied independently; production must not derive
 * it from the candidate artifact under activation.
 */

import { projectionDigest } from '../hash';
import {
  DOMAIN_TEACHING_ACTIVATION_CONTRACT,
  DOMAIN_TEACHING_CURRENT_CONTRACT,
  type DomainTeachingActivationExpectedIdentity,
  type DomainTeachingComposedArtifacts,
  type DomainTeachingComposedManifest,
  type DomainTeachingCurrentPointer,
  type DomainTeachingProjectionActivation,
  type TeachingCoverageState,
} from './contracts';
import { composeDomainTeachingProjection } from './compose';
import {
  assertExpectedAuthority,
  assertPublishedAuthoritySelection,
  authorityBindingMismatchFields,
  authoritySelectionMismatchFields,
} from './validate';
import {
  authorityActivationBlockedByTeachingCoverage,
  engineeringBrowsingAllowed,
} from './coverage';

export interface TeachingCacheFamilyState {
  teachingCacheFamily: string;
  projectionId: string;
  projectionHash: string;
}

export class DomainTeachingActivationError extends Error {
  readonly code: string;
  readonly previousPointer: DomainTeachingCurrentPointer | null;

  constructor(
    code: string,
    message: string,
    previousPointer: DomainTeachingCurrentPointer | null = null,
  ) {
    super(message);
    this.name = 'DomainTeachingActivationError';
    this.code = code;
    this.previousPointer = previousPointer;
  }
}

/**
 * Stable teaching cache family for a composed projection.
 * Authority activation identity is intentionally excluded.
 */
export function teachingCacheFamilyFor(
  projection: Pick<DomainTeachingComposedManifest, 'projectionId' | 'projectionHash'>,
): string {
  return `teaching-domain-proj:${projection.projectionId}:${projection.projectionHash.slice(0, 16)}`;
}

/**
 * Whether a teaching-layer cache entry must invalidate after a new projection.
 * Independent of Authority selection identity.
 */
export function shouldInvalidateTeachingLayerCache(input: {
  previous: TeachingCacheFamilyState | null | undefined;
  next: TeachingCacheFamilyState;
}): boolean {
  if (!input.previous) return true;
  return (
    input.previous.teachingCacheFamily !== input.next.teachingCacheFamily
    || input.previous.projectionId !== input.next.projectionId
    || input.previous.projectionHash !== input.next.projectionHash
  );
}

/**
 * Engineering Authority selection must not be reactivated when teaching advances.
 */
export function teachingActivationRequiresAuthorityReactivation(): false {
  return false;
}

function failActivation(
  code: string,
  message: string,
  previousPointer: DomainTeachingCurrentPointer | null,
): never {
  throw new DomainTeachingActivationError(code, message, previousPointer);
}

function requireExpectedIdentity(
  expectedIdentity: DomainTeachingActivationExpectedIdentity | null | undefined,
  previousPointer: DomainTeachingCurrentPointer | null,
): Required<DomainTeachingActivationExpectedIdentity> & {
  authority: ReturnType<typeof assertExpectedAuthority>;
} {
  if (!expectedIdentity || typeof expectedIdentity !== 'object') {
    failActivation(
      'activation-expectation-missing',
      'cannot activate domain teaching projection: independently supplied expected identity is required',
      previousPointer,
    );
  }
  if (
    typeof expectedIdentity.projectionId !== 'string'
    || expectedIdentity.projectionId.trim().length === 0
    || typeof expectedIdentity.projectionHash !== 'string'
    || expectedIdentity.projectionHash.trim().length === 0
    || typeof expectedIdentity.sourceInventoryDigest !== 'string'
    || expectedIdentity.sourceInventoryDigest.trim().length === 0
  ) {
    failActivation(
      'activation-expectation-incomplete',
      'cannot activate domain teaching projection: expected identity must include projectionId, projectionHash and sourceInventoryDigest',
      previousPointer,
    );
  }
  try {
    const authority = assertExpectedAuthority(
      expectedIdentity.authority,
      'expectedIdentity.authority',
    );
    return {
      authority,
      projectionId: expectedIdentity.projectionId.trim(),
      projectionHash: expectedIdentity.projectionHash.trim(),
      sourceInventoryDigest: expectedIdentity.sourceInventoryDigest.trim(),
    };
  } catch (error) {
    if (error instanceof DomainTeachingActivationError) throw error;
    failActivation(
      error instanceof Error && 'code' in error
        ? String((error as { code: string }).code)
        : 'activation-expectation-incomplete',
      error instanceof Error
        ? error.message
        : 'cannot activate domain teaching projection: expected identity is invalid',
      previousPointer,
    );
  }
}

function assertActivationArtifacts(input: {
  artifacts: DomainTeachingComposedArtifacts;
  expectedIdentity: DomainTeachingActivationExpectedIdentity;
  previousPointer: DomainTeachingCurrentPointer | null;
}): DomainTeachingComposedManifest {
  const previousPointer = input.previousPointer;
  const expected = requireExpectedIdentity(input.expectedIdentity, previousPointer);
  const expectedSelection = assertPublishedAuthoritySelection(
    {
      authorityBinding: expected.authority.binding,
      sourceDatasetHash: expected.authority.sourceDatasetHash,
      captureRevision: expected.authority.captureRevision,
      nodeIndexDigest: expected.authority.nodeIndexDigest,
    },
    expected.authority.binding,
    expected.authority.captureRevision,
    'activation.expectedIdentity.authority',
  );

  const manifestSelection = assertPublishedAuthoritySelection(
    input.artifacts.manifest.authoritySelection,
    input.artifacts.manifest.authorityBinding,
    input.artifacts.manifest.authoritySelection.captureRevision,
    'activation.manifest.authoritySelection',
  );
  const selectionMismatch = authoritySelectionMismatchFields(
    expectedSelection,
    manifestSelection,
  );
  if (selectionMismatch.length > 0) {
    failActivation(
      'authority-selection-mismatch',
      `cannot activate domain teaching projection: Authority selection mismatch on ${selectionMismatch.join(', ')}`,
      previousPointer,
    );
  }
  const bindingMismatch = authorityBindingMismatchFields(
    expectedSelection.authorityBinding,
    input.artifacts.manifest.authorityBinding,
  );
  if (bindingMismatch.length > 0) {
    failActivation(
      'authority-binding-mismatch',
      `cannot activate domain teaching projection: Authority binding mismatch on ${bindingMismatch.join(', ')}`,
      previousPointer,
    );
  }

  const rebuilt = composeDomainTeachingProjection({
    fragments: input.artifacts.fragments,
    authoringRevision: expected.authority.authoringRevision,
    authoritySelection: expectedSelection,
  });
  if (!rebuilt.manifest.gatePassed) {
    failActivation(
      'activation-gate-failed',
      `cannot activate domain teaching projection ${rebuilt.manifest.projectionId}: recomputed gate not passed`,
      previousPointer,
    );
  }
  if (
    rebuilt.manifest.projectionId !== input.artifacts.manifest.projectionId
    || rebuilt.manifest.projectionHash !== input.artifacts.manifest.projectionHash
    || rebuilt.manifest.sourceInventoryDigest !== input.artifacts.manifest.sourceInventoryDigest
    || rebuilt.manifest.authorityDigest !== input.artifacts.manifest.authorityDigest
    || rebuilt.manifest.coreNodeCount !== input.artifacts.manifest.coreNodeCount
    || rebuilt.manifest.relationCount !== input.artifacts.manifest.relationCount
    || rebuilt.manifest.coreNodeCount !== rebuilt.coreNodes.length
    || rebuilt.manifest.relationCount !== rebuilt.relations.length
    || input.artifacts.coreNodes.length !== rebuilt.coreNodes.length
    || input.artifacts.relations.length !== rebuilt.relations.length
    || projectionDigest(rebuilt.coreNodes) !== projectionDigest(input.artifacts.coreNodes)
    || projectionDigest(rebuilt.relations) !== projectionDigest(input.artifacts.relations)
    || projectionDigest(rebuilt.coverage) !== projectionDigest(input.artifacts.coverage)
  ) {
    failActivation(
      'artifact-identity-drift',
      'cannot activate domain teaching projection: candidate artifacts drift from recomputed composition',
      previousPointer,
    );
  }
  if (
    rebuilt.manifest.projectionId !== expected.projectionId
    || rebuilt.manifest.projectionHash !== expected.projectionHash
    || rebuilt.manifest.sourceInventoryDigest !== expected.sourceInventoryDigest
    || rebuilt.manifest.authorityDigest !== expected.authority.authorityDigest
  ) {
    failActivation(
      'activation-expectation-mismatch',
      'cannot activate domain teaching projection: independently supplied identity mismatch',
      previousPointer,
    );
  }
  return rebuilt.manifest;
}

export function activateDomainTeachingProjection(input: {
  artifacts: DomainTeachingComposedArtifacts;
  expectedIdentity: DomainTeachingActivationExpectedIdentity;
  previousPointer?: DomainTeachingCurrentPointer | null;
  priorPointer?: DomainTeachingCurrentPointer | null;
  activatedAt?: string;
  activationId?: string;
}): DomainTeachingProjectionActivation {
  const previousPointer = input.previousPointer ?? input.priorPointer ?? null;
  const manifest = assertActivationArtifacts({
    artifacts: input.artifacts,
    expectedIdentity: input.expectedIdentity,
    previousPointer,
  });

  const teachingCacheFamily = teachingCacheFamilyFor(manifest);
  const activatedAt = input.activatedAt ?? new Date(0).toISOString();
  const body = {
    contract: DOMAIN_TEACHING_ACTIVATION_CONTRACT,
    projectionId: manifest.projectionId,
    projectionHash: manifest.projectionHash,
    authorityReleaseId: manifest.authorityBinding.releaseId,
    authorityDigest: manifest.authorityDigest,
    teachingCacheFamily,
    authoritySelectionUnchanged: true as const,
  };
  const activationHash = projectionDigest(body);
  const activationId =
    input.activationId ?? `dt-activation-${activationHash.slice(0, 24)}`;

  return {
    ...body,
    activationId,
    activationHash,
    activatedAt,
  };
}

export function toDomainTeachingCurrentPointer(
  activation: DomainTeachingProjectionActivation,
): DomainTeachingCurrentPointer {
  return {
    contract: DOMAIN_TEACHING_CURRENT_CONTRACT,
    projectionId: activation.projectionId,
    projectionHash: activation.projectionHash,
    authorityReleaseId: activation.authorityReleaseId,
    authorityDigest: activation.authorityDigest,
    teachingCacheFamily: activation.teachingCacheFamily,
    activatedAt: activation.activatedAt,
  };
}

export function activateDomainTeachingProjectionFailClosed(input: {
  artifacts: DomainTeachingComposedArtifacts;
  expectedIdentity: DomainTeachingActivationExpectedIdentity;
  previousPointer?: DomainTeachingCurrentPointer | null;
  priorPointer?: DomainTeachingCurrentPointer | null;
  activatedAt?: string;
  activationId?: string;
}): {
  ok: boolean;
  activation: DomainTeachingProjectionActivation | null;
  pointer: DomainTeachingCurrentPointer | null;
  previousPointer: DomainTeachingCurrentPointer | null;
  pointerUnchanged: boolean;
  errorCode?: string;
  errorMessage?: string;
} {
  const previousPointer = input.previousPointer ?? input.priorPointer ?? null;
  try {
    const activation = activateDomainTeachingProjection(input);
    return {
      ok: true,
      activation,
      pointer: toDomainTeachingCurrentPointer(activation),
      previousPointer,
      pointerUnchanged: false,
    };
  } catch (error) {
    const activationError =
      error instanceof DomainTeachingActivationError ? error : null;
    return {
      ok: false,
      activation: null,
      pointer: previousPointer,
      previousPointer,
      pointerUnchanged: true,
      errorCode: activationError?.code ?? 'activation-failed',
      errorMessage: error instanceof Error ? error.message : 'unknown failure',
    };
  }
}

/**
 * Layered domain response helper: engineering remains usable for every
 * teaching coverage state, including unavailable.
 */
export function layeredDomainTeachingStatus(input: {
  teachingCoverage: TeachingCoverageState;
  engineeringReady: boolean;
}): {
  engineeringReady: boolean;
  teachingCoverage: TeachingCoverageState;
  engineeringBrowsingAllowed: true;
  authorityBlockedByTeaching: false;
  teachingLayerPresent: boolean;
} {
  return {
    engineeringReady: input.engineeringReady,
    teachingCoverage: input.teachingCoverage,
    engineeringBrowsingAllowed: engineeringBrowsingAllowed(input.teachingCoverage),
    authorityBlockedByTeaching: authorityActivationBlockedByTeachingCoverage(
      input.teachingCoverage,
    ),
    teachingLayerPresent:
      input.teachingCoverage === 'available'
      || input.teachingCoverage === 'partial',
  };
}
