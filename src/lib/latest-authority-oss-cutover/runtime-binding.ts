/**
 * Runtime, readiness, and consumer integration for the coordinated cutover
 * (#1509, tasks 9.x).
 *
 * The successor Runtime Release v2 binding closes over the coordinated
 * envelope (resource denominator, formal binding envelope, captured
 * Authority, complete Teaching Projection, domain shards, prerequisite
 * publication, shared consumer activation, coordination allocation record,
 * and the complete predecessor Runtime and graph identities) by binding the
 * successor manifest's content-addressed identity. During activation the
 * Runtime active-receipt binding carries the preallocated transaction ID and
 * the coordinated candidate receipt; it never refers to the later final
 * coordinated active receipt. Ordinary Runtime lifecycle activation rejects
 * a successor whose committed coordinated graph receipt is absent or
 * mismatched, and readiness projects only the committed coherent
 * combination.
 */

import { projectionDigest } from '@/lib/teaching-projection/hash';

import {
  LatestAuthorityCutoverError,
  type CoordinatedActiveReceipt,
  type CoordinatedRuntimeAuthorization,
  type CoordinatedRuntimeManifestExtension,
} from './contracts';
import { assertCoordinatedRuntimeAuthorizationWellFormed } from './transaction';

export interface RuntimeReleaseIdentity {
  readonly releaseId: string;
  readonly manifestSha256: string;
  readonly treeSha256: string;
}

/** Exact Runtime v2 lifecycle identity, including the manifest wire binding. */
export interface RuntimeLifecycleIdentity extends RuntimeReleaseIdentity {
  readonly schemaVersion: 'runtime-blob-release-identity.v1';
  readonly manifestVersion: 'act-runtime-release.v2';
  readonly manifestWireSha256: string;
  readonly manifestWireSizeBytes: number;
}

function assertRuntimeIdentity(identity: RuntimeReleaseIdentity): void {
  if (!identity.releaseId || typeof identity.releaseId !== 'string') {
    throw new LatestAuthorityCutoverError(
      'runtime-binding-invalid',
      'A Runtime binding needs the successor release id.',
    );
  }
  for (const field of ['manifestSha256', 'treeSha256'] as const) {
    if (!/^[a-f0-9]{64}$/u.test(identity[field])) {
      throw new LatestAuthorityCutoverError(
        'runtime-binding-invalid',
        `Runtime binding field ${field} must be a lowercase SHA-256 hex digest.`,
      );
    }
  }
}

function assertRuntimeLifecycleIdentity(identity: RuntimeLifecycleIdentity): void {
  assertRuntimeIdentity(identity);
  if (identity.schemaVersion !== 'runtime-blob-release-identity.v1'
    || identity.manifestVersion !== 'act-runtime-release.v2'
    || !/^[a-f0-9]{64}$/u.test(identity.manifestWireSha256)
    || !Number.isInteger(identity.manifestWireSizeBytes)
    || identity.manifestWireSizeBytes < 1) {
    throw new LatestAuthorityCutoverError(
      'runtime-active-binding-invalid',
      'The Runtime active binding must carry the complete v2 lifecycle identity.',
    );
  }
}

/**
 * Build the coordinated Runtime manifest extension. The extension binds the
 * coordinated envelope onto the successor manifest's content-addressed
 * identity; the later outer candidate receipt then binds this extension's
 * hash, so the manifest extension itself never references the outer receipt
 * (one-directional closure).
 */
export function buildCoordinatedRuntimeManifestExtension(input: {
  successorManifest: RuntimeReleaseIdentity;
  materializationReceiptHash: string;
  denominatorHash: string;
  captureHash: string;
  teachingProjectionHash: string;
  teachingClosureReceiptHash: string;
  formalResourceEnvelopeHash: string;
  continuityReceiptHash: string;
  domainShardSetHash: string;
  prerequisitePublicationHash: string;
  consumerActivationHash: string;
  allocationHash: string;
  predecessorRuntimeReleaseId: string;
  predecessorRuntimeManifestSha256: string;
  predecessorLifecycleGeneration: number;
}): { extension: CoordinatedRuntimeManifestExtension; extensionHash: string } {
  assertRuntimeIdentity(input.successorManifest);
  for (const field of [
    'materializationReceiptHash',
    'denominatorHash',
    'captureHash',
    'teachingProjectionHash',
    'teachingClosureReceiptHash',
    'formalResourceEnvelopeHash',
    'continuityReceiptHash',
    'domainShardSetHash',
    'prerequisitePublicationHash',
    'consumerActivationHash',
    'allocationHash',
  ] as const) {
    if (!/^[a-f0-9]{64}$/u.test(input[field])) {
      throw new LatestAuthorityCutoverError(
        'runtime-binding-invalid',
        `Runtime manifest extension field ${field} must be a lowercase SHA-256 hex digest.`,
      );
    }
  }
  if (!input.predecessorRuntimeReleaseId || typeof input.predecessorRuntimeReleaseId !== 'string') {
    throw new LatestAuthorityCutoverError(
      'runtime-binding-invalid',
      'The Runtime manifest extension must bind the predecessor release id.',
    );
  }
  if (!/^[a-f0-9]{64}$/u.test(input.predecessorRuntimeManifestSha256)) {
    throw new LatestAuthorityCutoverError(
      'runtime-binding-invalid',
      'The predecessor manifest digest must be a lowercase SHA-256 hex digest.',
    );
  }
  if (!Number.isInteger(input.predecessorLifecycleGeneration) || input.predecessorLifecycleGeneration < 1) {
    throw new LatestAuthorityCutoverError(
      'runtime-binding-invalid',
      'The predecessor lifecycle generation must be a positive integer.',
    );
  }
  const extension: CoordinatedRuntimeManifestExtension = {
    contract: 'coordinated-runtime-manifest-extension/v1',
    allocationHash: input.allocationHash,
    denominatorHash: input.denominatorHash,
    captureHash: input.captureHash,
    teachingProjectionHash: input.teachingProjectionHash,
    teachingClosureReceiptHash: input.teachingClosureReceiptHash,
    formalResourceEnvelopeHash: input.formalResourceEnvelopeHash,
    continuityReceiptHash: input.continuityReceiptHash,
    domainShardSetHash: input.domainShardSetHash,
    prerequisitePublicationHash: input.prerequisitePublicationHash,
    consumerActivationHash: input.consumerActivationHash,
    predecessorRuntimeReleaseId: input.predecessorRuntimeReleaseId,
    predecessorRuntimeManifestSha256: input.predecessorRuntimeManifestSha256,
    predecessorLifecycleGeneration: input.predecessorLifecycleGeneration,
  };
  const extensionHash = projectionDigest({
    successorManifest: input.successorManifest,
    materializationReceiptHash: input.materializationReceiptHash,
    extension,
  });
  return { extension, extensionHash };
}

export interface CoordinatedRuntimeActiveReceiptBinding {
  readonly contract: 'coordinated-runtime-active-receipt-binding/v1';
  readonly transactionId: string;
  readonly candidateReceiptHash: string;
  readonly runtimeRelease: RuntimeLifecycleIdentity;
  readonly materializationReceiptHash: string;
  readonly bindingHash: string;
}

/**
 * During activation, the Runtime active receipt binds the preallocated
 * transaction ID and the coordinated candidate receipt. The later outer
 * coordinated active receipt binds this immutable Runtime binding hash.
 */
export function buildCoordinatedRuntimeActiveReceiptBinding(input: {
  transactionId: string;
  candidateReceiptHash: string;
  runtimeRelease: RuntimeLifecycleIdentity;
  materializationReceiptHash: string;
}): CoordinatedRuntimeActiveReceiptBinding {
  if (!input.transactionId?.startsWith('tx-')) {
    throw new LatestAuthorityCutoverError(
      'runtime-active-binding-invalid',
      'The Runtime active binding must carry the preallocated transaction id.',
    );
  }
  if (!/^[a-f0-9]{64}$/u.test(input.candidateReceiptHash)) {
    throw new LatestAuthorityCutoverError(
      'runtime-active-binding-invalid',
      'The Runtime active binding must carry the coordinated candidate receipt hash.',
    );
  }
  assertRuntimeLifecycleIdentity(input.runtimeRelease);
  if (!/^[a-f0-9]{64}$/u.test(input.materializationReceiptHash)) {
    throw new LatestAuthorityCutoverError(
      'runtime-active-binding-invalid',
      'The Runtime active binding must carry the materialization receipt hash.',
    );
  }
  const bindingHash = projectionDigest({
    transactionId: input.transactionId,
    candidateReceiptHash: input.candidateReceiptHash,
    runtimeRelease: input.runtimeRelease,
    materializationReceiptHash: input.materializationReceiptHash,
  });
  return {
    contract: 'coordinated-runtime-active-receipt-binding/v1',
    transactionId: input.transactionId,
    candidateReceiptHash: input.candidateReceiptHash,
    runtimeRelease: input.runtimeRelease,
    materializationReceiptHash: input.materializationReceiptHash,
    bindingHash,
  };
}

/**
 * Ordinary Runtime lifecycle activation must reject a successor that lacks
 * the matching pre-activation coordinated Runtime authorization.
 */
export function assertRuntimeSuccessorAuthorizedByAuthorization(
  runtimeBinding: CoordinatedRuntimeActiveReceiptBinding,
  authorization: CoordinatedRuntimeAuthorization | null,
): void {
  if (!authorization) {
    throw new LatestAuthorityCutoverError(
      'runtime-activation-unauthorized',
      'The successor Runtime Release has no coordinated Runtime authorization.',
    );
  }
  assertCoordinatedRuntimeAuthorizationWellFormed(authorization);
  if (authorization.candidateReceiptHash !== runtimeBinding.candidateReceiptHash) {
    throw new LatestAuthorityCutoverError(
      'runtime-activation-unauthorized',
      'The Runtime authorization binds a different candidate than the Runtime successor.',
    );
  }
  if (authorization.transactionId !== runtimeBinding.transactionId) {
    throw new LatestAuthorityCutoverError(
      'runtime-activation-unauthorized',
      'The Runtime authorization belongs to a different transaction than the Runtime successor.',
    );
  }
  if (authorization.runtimeBindingHash !== runtimeBinding.bindingHash) {
    throw new LatestAuthorityCutoverError(
      'runtime-activation-unauthorized',
      'The Runtime authorization does not close over this Runtime active receipt binding.',
    );
  }
}

export interface CoordinatedRuntimeReadinessProjection {
  readonly ready: boolean;
  readonly activeRuntimeIdentity: RuntimeReleaseIdentity | null;
  readonly candidateIdentity: RuntimeReleaseIdentity | null;
}

/**
 * Readiness projects only the committed coherent combination: a verified
 * successor Runtime Release without a matching committed coordinated graph
 * combination stays non-active and readiness keeps projecting the prior
 * active Runtime identity.
 */
export function projectCoordinatedRuntimeReadiness(input: {
  activeRuntimeIdentity: RuntimeReleaseIdentity | null;
  candidateRuntimeIdentity: RuntimeReleaseIdentity | null;
  committedGraphActiveReceipt: CoordinatedActiveReceipt | null;
}): CoordinatedRuntimeReadinessProjection {
  const candidateIsActive = input.candidateRuntimeIdentity !== null
    && input.committedGraphActiveReceipt !== null
    && input.activeRuntimeIdentity !== null
    && input.activeRuntimeIdentity.releaseId === input.candidateRuntimeIdentity.releaseId
    && input.activeRuntimeIdentity.manifestSha256 === input.candidateRuntimeIdentity.manifestSha256;
  if (candidateIsActive) {
    return {
      ready: true,
      activeRuntimeIdentity: input.activeRuntimeIdentity,
      candidateIdentity: input.candidateRuntimeIdentity,
    };
  }
  return {
    ready: input.activeRuntimeIdentity !== null,
    activeRuntimeIdentity: input.activeRuntimeIdentity,
    candidateIdentity: null,
  };
}
