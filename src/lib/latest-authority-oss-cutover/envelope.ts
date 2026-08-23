/**
 * Coordinated candidate envelope: the one-way identity graph (#1509, tasks 7.x).
 *
 * Before any dependent artifact exists, the coordinator seals an immutable
 * allocation record with an opaque unique coordination run ID. Inner
 * artifacts may bind the allocation-record hash and earlier immutable
 * dependencies, but never the hash of the outer candidate or active receipt
 * computed from them. After the inner artifacts are immutable, one outer
 * coordinated candidate receipt closes over their exact hashes, the complete
 * predecessor state, ordered successor selector expectations, the
 * transaction implementation, the rollback plan, and the verification
 * policy. The candidate is non-selectable: generation grants no production
 * authority.
 */

import { randomUUID } from 'node:crypto';

import { projectionDigest } from '@/lib/teaching-projection/hash';

import {
  LatestAuthorityCutoverError,
  type AuthorityCaptureReceipt,
  type CoordinatedCandidateReceipt,
  type CoordinationAllocationRecord,
  type InnerArtifactBinding,
} from './contracts';

export interface SealAllocationInput {
  readonly sealedAt: string;
  readonly capture: Pick<
    AuthorityCaptureReceipt,
    'captureHash' | 'compatibility'
  >;
  readonly scopeHash: string;
  readonly denominatorHash: string;
  readonly policyVersions: Readonly<Record<string, string>>;
  readonly implementationIdentities: Readonly<Record<string, string>>;
}

/**
 * Seal the immutable coordination allocation record. It is the common
 * namespace for every inner artifact of this run.
 */
export function sealCoordinationAllocationRecord(
  input: SealAllocationInput,
): CoordinationAllocationRecord {
  if (!input.sealedAt || typeof input.sealedAt !== 'string') {
    throw new LatestAuthorityCutoverError(
      'allocation-field-invalid',
      'The allocation record needs a seal timestamp.',
    );
  }
  if (!/^[a-f0-9]{64}$/u.test(input.capture.captureHash)) {
    throw new LatestAuthorityCutoverError(
      'allocation-capture-invalid',
      'The allocation record must bind a sealed Authority capture hash.',
    );
  }
  if (!/^[a-f0-9]{64}$/u.test(input.scopeHash)) {
    throw new LatestAuthorityCutoverError(
      'allocation-scope-invalid',
      'The allocation record must bind the sealed course scope hash.',
    );
  }
  if (!/^[a-f0-9]{64}$/u.test(input.denominatorHash)) {
    throw new LatestAuthorityCutoverError(
      'allocation-denominator-invalid',
      'The allocation record must bind the combined denominator hash.',
    );
  }
  if (Object.keys(input.policyVersions).length === 0) {
    throw new LatestAuthorityCutoverError(
      'allocation-policies-missing',
      'The allocation record must pin its policy versions.',
    );
  }
  if (Object.keys(input.implementationIdentities).length === 0) {
    throw new LatestAuthorityCutoverError(
      'allocation-implementation-missing',
      'The allocation record must pin its implementation identities.',
    );
  }
  const coordinationRunId = `coord-${randomUUID()}`;
  const allocationHash = projectionDigest({
    coordinationRunId,
    sealedAt: input.sealedAt,
    captureHash: input.capture.captureHash,
    compatibilityClassification: input.capture.compatibility.classification,
    scopeHash: input.scopeHash,
    denominatorHash: input.denominatorHash,
    policyVersions: input.policyVersions,
    implementationIdentities: input.implementationIdentities,
  });
  return {
    contract: 'coordination-allocation-record/v1',
    coordinationRunId,
    sealedAt: input.sealedAt,
    captureHash: input.capture.captureHash,
    compatibilityClassification: input.capture.compatibility.classification,
    scopeHash: input.scopeHash,
    denominatorHash: input.denominatorHash,
    policyVersions: input.policyVersions,
    implementationIdentities: input.implementationIdentities,
    allocationHash,
  };
}

export interface BindInnerArtifactInput {
  readonly allocation: CoordinationAllocationRecord;
  readonly artifactId: string;
  readonly artifactKind: string;
  readonly dependsOn: readonly { artifactId: string; artifactHash: string }[];
  readonly artifactHash: string;
  /**
   * Raw inner payload keys; the binder rejects any attempt to thread an
   * outer candidate or active receipt hash through an inner artifact.
   */
  readonly forbiddenReferenceValues?: readonly string[];
}

/**
 * Bind one inner artifact onto the allocation record and earlier immutable
 * dependencies. An inner artifact must never bind the hash of a candidate or
 * active receipt computed from itself.
 */
export function bindInnerArtifact(input: BindInnerArtifactInput): InnerArtifactBinding {
  if (!input.artifactId || typeof input.artifactId !== 'string') {
    throw new LatestAuthorityCutoverError(
      'inner-artifact-invalid',
      'An inner artifact needs a stable artifactId.',
    );
  }
  if (!input.artifactKind || typeof input.artifactKind !== 'string') {
    throw new LatestAuthorityCutoverError(
      'inner-artifact-invalid',
      `Inner artifact ${input.artifactId} needs a kind.`,
    );
  }
  if (!/^[a-f0-9]{64}$/u.test(input.artifactHash)) {
    throw new LatestAuthorityCutoverError(
      'inner-artifact-invalid',
      `Inner artifact ${input.artifactId} needs a SHA-256 artifact hash.`,
    );
  }
  if (!/^[a-f0-9]{64}$/u.test(input.allocation.allocationHash)) {
    throw new LatestAuthorityCutoverError(
      'inner-artifact-invalid',
      `Inner artifact ${input.artifactId} must bind a sealed allocation record.`,
    );
  }
  for (const dependency of input.dependsOn) {
    if (dependency.artifactId === 'allocation') {
      if (dependency.artifactHash !== input.allocation.allocationHash) {
        throw new LatestAuthorityCutoverError(
          'inner-dependency-mismatch',
          `Inner artifact ${input.artifactId} binds a foreign allocation record.`,
        );
      }
      continue;
    }
    if (!/^[a-f0-9]{64}$/u.test(dependency.artifactHash)) {
      throw new LatestAuthorityCutoverError(
        'inner-dependency-invalid',
        `Inner artifact ${input.artifactId} has a malformed dependency hash for ${dependency.artifactId}.`,
      );
    }
  }
  for (const forbidden of input.forbiddenReferenceValues ?? []) {
    if (forbidden === input.artifactHash) {
      throw new LatestAuthorityCutoverError(
        'inner-outer-circular-reference',
        `Inner artifact ${input.artifactId} must not reference an outer receipt hash.`,
      );
    }
  }
  return {
    artifactId: input.artifactId,
    artifactKind: input.artifactKind,
    allocationHash: input.allocation.allocationHash,
    dependsOn: [...input.dependsOn],
    artifactHash: input.artifactHash,
  };
}

/** Field names an inner artifact payload may never carry. */
const INNER_FORBIDDEN_FIELDS = [
  'candidateReceiptHash',
  'coordinatedActiveReceiptHash',
  'activeReceiptHash',
] as const;

/** Reject any inner payload that threads an outer receipt reference. */
export function assertInnerPayloadHasNoOuterReference(
  payload: Record<string, unknown>,
  artifactId: string,
): void {
  for (const field of INNER_FORBIDDEN_FIELDS) {
    if (field in payload) {
      throw new LatestAuthorityCutoverError(
        'inner-outer-circular-reference',
        `Inner artifact ${artifactId} carries the forbidden outer-reference field ${field}.`,
      );
    }
  }
}

export interface SealCandidateReceiptInput {
  readonly sealedAt: string;
  readonly allocation: CoordinationAllocationRecord;
  readonly authorityCaptureHash: string;
  readonly localeQualificationHash: string;
  readonly teachingProjectionHash: string;
  readonly teachingClosureReceiptHash: string;
  readonly formalResourceEnvelopeHash: string;
  readonly continuityReceiptHash: string;
  readonly derivationReceiptHash: string;
  readonly successorRuntimeManifestHash: string;
  readonly successorRuntimeMaterializationHash: string;
  readonly domainShardCatalogHash: string;
  readonly domainShardSetHash: string;
  readonly prerequisitePublicationHash: string;
  readonly consumerActivationHash: string;
  readonly predecessor: readonly { selectorId: string; identity: string }[];
  readonly predecessorRuntimeLifecycleGeneration: number;
  readonly successorSelectorExpectations: readonly { selectorId: string; expectedSuccessorIdentity: string }[];
  readonly transactionImplementationIdentity: string;
  readonly rollbackPlanHash: string;
  readonly verificationPolicyHash: string;
  readonly innerBindings: readonly InnerArtifactBinding[];
}

/**
 * Seal the outer coordinated candidate receipt over the exact inner hashes.
 * The receipt is immutable, non-selectable, and the only content-addressed
 * outer closure over the inner artifacts.
 */
export function sealCoordinatedCandidateReceipt(
  input: SealCandidateReceiptInput,
): CoordinatedCandidateReceipt {
  if (!input.sealedAt || typeof input.sealedAt !== 'string') {
    throw new LatestAuthorityCutoverError(
      'candidate-field-invalid',
      'The candidate receipt needs a seal timestamp.',
    );
  }
  const hashFields = [
    'authorityCaptureHash',
    'localeQualificationHash',
    'teachingProjectionHash',
    'teachingClosureReceiptHash',
    'formalResourceEnvelopeHash',
    'continuityReceiptHash',
    'derivationReceiptHash',
    'successorRuntimeManifestHash',
    'successorRuntimeMaterializationHash',
    'domainShardCatalogHash',
    'domainShardSetHash',
    'prerequisitePublicationHash',
    'consumerActivationHash',
    'rollbackPlanHash',
    'verificationPolicyHash',
  ] as const;
  for (const field of hashFields) {
    if (!/^[a-f0-9]{64}$/u.test(input[field])) {
      throw new LatestAuthorityCutoverError(
        'candidate-field-invalid',
        `The candidate receipt field ${field} must be a lowercase SHA-256 hex digest.`,
      );
    }
  }
  if (input.authorityCaptureHash !== input.allocation.captureHash) {
    throw new LatestAuthorityCutoverError(
      'candidate-capture-mismatch',
      'The candidate capture hash differs from the allocation record.',
    );
  }
  if (input.predecessor.length === 0) {
    throw new LatestAuthorityCutoverError(
      'candidate-predecessor-missing',
      'The candidate must bind the complete predecessor selector state.',
    );
  }
  if (input.successorSelectorExpectations.length === 0) {
    throw new LatestAuthorityCutoverError(
      'candidate-expectations-missing',
      'The candidate must bind the ordered successor selector expectations.',
    );
  }
  if (!input.transactionImplementationIdentity || typeof input.transactionImplementationIdentity !== 'string') {
    throw new LatestAuthorityCutoverError(
      'candidate-field-invalid',
      'The candidate must bind the transaction implementation identity.',
    );
  }
  if (!Number.isInteger(input.predecessorRuntimeLifecycleGeneration)
    || input.predecessorRuntimeLifecycleGeneration < 1) {
    throw new LatestAuthorityCutoverError(
      'candidate-field-invalid',
      'The predecessor Runtime lifecycle generation must be a positive integer.',
    );
  }
  // Every inner binding must belong to this allocation; a foreign envelope
  // component invalidates the complete candidate.
  for (const binding of input.innerBindings) {
    if (binding.allocationHash !== input.allocation.allocationHash) {
      throw new LatestAuthorityCutoverError(
        'candidate-cross-envelope',
        `Inner artifact ${binding.artifactId} belongs to a different coordination envelope.`,
      );
    }
  }
  const candidateId = `cand-${randomUUID()}`;
  const receiptHash = projectionDigest({
    candidateId,
    sealedAt: input.sealedAt,
    allocationHash: input.allocation.allocationHash,
    authorityCaptureHash: input.authorityCaptureHash,
    localeQualificationHash: input.localeQualificationHash,
    teachingProjectionHash: input.teachingProjectionHash,
    teachingClosureReceiptHash: input.teachingClosureReceiptHash,
    formalResourceEnvelopeHash: input.formalResourceEnvelopeHash,
    continuityReceiptHash: input.continuityReceiptHash,
    derivationReceiptHash: input.derivationReceiptHash,
    successorRuntimeManifestHash: input.successorRuntimeManifestHash,
    successorRuntimeMaterializationHash: input.successorRuntimeMaterializationHash,
    domainShardCatalogHash: input.domainShardCatalogHash,
    domainShardSetHash: input.domainShardSetHash,
    prerequisitePublicationHash: input.prerequisitePublicationHash,
    consumerActivationHash: input.consumerActivationHash,
    predecessor: input.predecessor,
    predecessorRuntimeLifecycleGeneration: input.predecessorRuntimeLifecycleGeneration,
    successorSelectorExpectations: input.successorSelectorExpectations,
    transactionImplementationIdentity: input.transactionImplementationIdentity,
    rollbackPlanHash: input.rollbackPlanHash,
    verificationPolicyHash: input.verificationPolicyHash,
  });
  return {
    contract: 'coordinated-candidate-receipt/v1',
    builderVersion: 'latest-authority-oss-cutover-builder/v1',
    candidateId,
    sealedAt: input.sealedAt,
    selectable: false,
    allocationHash: input.allocation.allocationHash,
    authorityCaptureHash: input.authorityCaptureHash,
    localeQualificationHash: input.localeQualificationHash,
    teachingProjectionHash: input.teachingProjectionHash,
    teachingClosureReceiptHash: input.teachingClosureReceiptHash,
    formalResourceEnvelopeHash: input.formalResourceEnvelopeHash,
    continuityReceiptHash: input.continuityReceiptHash,
    derivationReceiptHash: input.derivationReceiptHash,
    successorRuntimeManifestHash: input.successorRuntimeManifestHash,
    successorRuntimeMaterializationHash: input.successorRuntimeMaterializationHash,
    domainShardCatalogHash: input.domainShardCatalogHash,
    domainShardSetHash: input.domainShardSetHash,
    prerequisitePublicationHash: input.prerequisitePublicationHash,
    consumerActivationHash: input.consumerActivationHash,
    predecessor: [...input.predecessor],
    predecessorRuntimeLifecycleGeneration: input.predecessorRuntimeLifecycleGeneration,
    successorSelectorExpectations: [...input.successorSelectorExpectations],
    transactionImplementationIdentity: input.transactionImplementationIdentity,
    rollbackPlanHash: input.rollbackPlanHash,
    verificationPolicyHash: input.verificationPolicyHash,
    receiptHash,
  };
}

export interface ReopenArtifactFn {
  (artifactId: string): Promise<{ artifactHash: string; allocationHash?: string }>;
}

/**
 * Reopen and hash-verify every referenced artifact before coordinated
 * qualification. Any reopened hash that differs from the receipt, or any
 * artifact that names a different allocation, invalidates the candidate.
 */
export async function reopenAndVerifyCandidate(
  receipt: CoordinatedCandidateReceipt,
  reopen: ReopenArtifactFn,
): Promise<void> {
  const references: readonly { artifactId: string; artifactHash: string }[] = [
    { artifactId: 'authority-capture', artifactHash: receipt.authorityCaptureHash },
    { artifactId: 'locale-qualification', artifactHash: receipt.localeQualificationHash },
    { artifactId: 'teaching-projection', artifactHash: receipt.teachingProjectionHash },
    { artifactId: 'teaching-closure-receipt', artifactHash: receipt.teachingClosureReceiptHash },
    { artifactId: 'formal-resource-envelope', artifactHash: receipt.formalResourceEnvelopeHash },
    { artifactId: 'continuity-receipt', artifactHash: receipt.continuityReceiptHash },
    { artifactId: 'derivation-receipt', artifactHash: receipt.derivationReceiptHash },
    { artifactId: 'successor-runtime-manifest', artifactHash: receipt.successorRuntimeManifestHash },
    { artifactId: 'successor-runtime-materialization', artifactHash: receipt.successorRuntimeMaterializationHash },
    { artifactId: 'authority-domain-shard-catalog', artifactHash: receipt.domainShardCatalogHash },
    { artifactId: 'authority-domain-shard-set', artifactHash: receipt.domainShardSetHash },
    { artifactId: 'prerequisite-publication', artifactHash: receipt.prerequisitePublicationHash },
    { artifactId: 'consumer-activation', artifactHash: receipt.consumerActivationHash },
  ];
  for (const reference of references) {
    const observed = await reopen(reference.artifactId);
    if (observed.artifactHash !== reference.artifactHash) {
      throw new LatestAuthorityCutoverError(
        'candidate-artifact-drift',
        `Reopened artifact ${reference.artifactId} hashes to ${observed.artifactHash}, expected ${reference.artifactHash}.`,
      );
    }
    if (observed.allocationHash !== undefined && observed.allocationHash !== receipt.allocationHash) {
      throw new LatestAuthorityCutoverError(
        'candidate-cross-envelope',
        `Reopened artifact ${reference.artifactId} belongs to a different coordination envelope.`,
      );
    }
  }
}

/**
 * A qualified candidate without activation authority stays non-selectable:
 * no desired, active, Authority, Teaching, shard, prerequisite, consumer, or
 * Runtime selector may be written from generation alone.
 */
export function assertCandidateNonSelectable(
  receipt: CoordinatedCandidateReceipt,
): void {
  if (receipt.selectable !== false) {
    throw new LatestAuthorityCutoverError(
      'candidate-selectable-field-invalid',
      'A coordinated candidate must be sealed non-selectable.',
    );
  }
}
