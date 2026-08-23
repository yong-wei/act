/**
 * Execution-time Authority capture and adapter compatibility (#1509, tasks 2.x).
 *
 * The capture seals one execution-time latest complete formal ActKG composite
 * (commit, tags, component identities, hashes, publication state, lineage,
 * and public-contract identity) into an immutable receipt. Bytes are
 * materialized from the sealed Git tree by the caller (existing intake path);
 * a dirty worktree, an incomplete component closure, or hash drift fails
 * closed. A newer upstream release after the seal does not mutate the
 * in-flight capture.
 */

import { randomUUID } from 'node:crypto';

import { projectionDigest } from '@/lib/teaching-projection/hash';

import {
  AUTHORITY_COMPONENT_KINDS,
  AUTHORITY_COMPATIBILITY_CLASSIFICATIONS,
  LatestAuthorityCutoverError,
  type AuthorityCaptureReceipt,
  type AuthorityCompatibility,
  type AuthorityComponentIdentity,
  type CapturedPublicContract,
  type SupportedPublicContract,
} from './contracts';

export interface AuthorityCaptureInput {
  readonly capturedAt: string;
  readonly actkgMainCommit: string;
  readonly sourceCommit: string;
  readonly sourceTag: string;
  readonly packagingCommit: string;
  readonly stableTag: string;
  readonly releaseId: string;
  readonly releaseVersion: string;
  readonly bundleId: string;
  readonly bundleDigest: string;
  readonly manifestSha256: string;
  readonly sha256sumsSha256: string;
  readonly validationReportSha256: string;
  /** Must be false: bytes must come from the sealed Git tree, never the working tree. */
  readonly actkgWorktreeDirty: boolean;
  readonly componentIdentities: readonly AuthorityComponentIdentity[];
  readonly predecessorBundleId: string | null;
  readonly candidateChain: readonly string[];
  readonly capturedPublicContract: CapturedPublicContract;
  readonly adapterContractVersion: string;
  readonly supportedPublicContract: SupportedPublicContract;
}

function assertNonEmpty(value: string, label: string): void {
  if (typeof value !== 'string' || value.length === 0) {
    throw new LatestAuthorityCutoverError(
      'capture-field-invalid',
      `${label} must be a non-empty string.`,
    );
  }
}

function assertSha256(value: string, label: string): void {
  if (!/^[a-f0-9]{64}$/u.test(value)) {
    throw new LatestAuthorityCutoverError(
      'capture-hash-invalid',
      `${label} must be a lowercase SHA-256 hex digest.`,
    );
  }
}

/**
 * Validate the captured public contract against the adapter's supported
 * surface. Compatibility is never inferred from a version string alone: the
 * pinned schema identity, contract version, required members, profiles, and a
 * complete representative parse must all pass.
 */
export function validateCapturedPublicContract(
  captured: CapturedPublicContract,
  supported: SupportedPublicContract,
): AuthorityCompatibility {
  const incompatibleReasons: string[] = [];
  const expectedSchemaSha = supported.schemaIdentities[captured.schemaVersion];
  if (expectedSchemaSha === undefined) {
    incompatibleReasons.push(`unsupported schema version: ${captured.schemaVersion}`);
  } else if (expectedSchemaSha !== captured.schemaSha256) {
    incompatibleReasons.push(
      `schema identity drift for ${captured.schemaVersion}: expected ${expectedSchemaSha}, captured ${captured.schemaSha256}`,
    );
  }
  if (!supported.contractVersions.includes(captured.contractVersion)) {
    incompatibleReasons.push(`unsupported contract version: ${captured.contractVersion}`);
  }
  for (const member of supported.requiredMembers) {
    if (!captured.requiredMembers.includes(member)) {
      incompatibleReasons.push(`missing required member: ${member}`);
    }
  }
  for (const profile of captured.profiles) {
    if (!supported.profiles.includes(profile)) {
      incompatibleReasons.push(`unsupported projection profile: ${profile}`);
    }
  }
  if (captured.representativeParse !== 'COMPLETE') {
    incompatibleReasons.push('representative adapter parse did not complete');
  }
  return {
    contract: 'authority-adapter-compatibility/v1',
    adapterContractVersion: supported.contractVersions[0] ?? 'unknown-adapter-contract',
    classification: incompatibleReasons.length === 0 ? 'COMPATIBLE' : 'ADAPTATION_REQUIRED',
    incompatibleReasons,
    captured,
  };
}

/** Seal one immutable Authority capture receipt from verified inputs. */
export function sealAuthorityCaptureReceipt(input: AuthorityCaptureInput): AuthorityCaptureReceipt {
  assertNonEmpty(input.capturedAt, 'capturedAt');
  assertNonEmpty(input.actkgMainCommit, 'actkgMainCommit');
  assertNonEmpty(input.sourceCommit, 'sourceCommit');
  assertNonEmpty(input.sourceTag, 'sourceTag');
  assertNonEmpty(input.packagingCommit, 'packagingCommit');
  assertNonEmpty(input.stableTag, 'stableTag');
  assertNonEmpty(input.releaseId, 'releaseId');
  assertNonEmpty(input.releaseVersion, 'releaseVersion');
  assertNonEmpty(input.bundleId, 'bundleId');
  assertSha256(input.bundleDigest, 'bundleDigest');
  assertSha256(input.manifestSha256, 'manifestSha256');
  assertSha256(input.sha256sumsSha256, 'sha256sumsSha256');
  assertSha256(input.validationReportSha256, 'validationReportSha256');
  if (input.actkgWorktreeDirty) {
    throw new LatestAuthorityCutoverError(
      'capture-worktree-dirty',
      'The ActKG worktree is dirty; captured inputs must be materialized from the sealed Git tree.',
    );
  }
  if (input.componentIdentities.length === 0) {
    throw new LatestAuthorityCutoverError(
      'capture-components-incomplete',
      'The captured aggregate declares no component identities.',
    );
  }
  const seenKinds = new Set<string>();
  for (const component of input.componentIdentities) {
    if (!AUTHORITY_COMPONENT_KINDS.includes(component.kind)) {
      throw new LatestAuthorityCutoverError(
        'capture-component-kind-invalid',
        `Unknown component kind: ${component.kind}`,
      );
    }
    assertNonEmpty(component.componentId, `${component.kind}.componentId`);
    assertNonEmpty(component.version, `${component.kind}.version`);
    assertSha256(component.sha256, `${component.kind}.sha256`);
    if (seenKinds.has(component.kind)) {
      throw new LatestAuthorityCutoverError(
        'capture-component-duplicate',
        `Component kind declared more than once: ${component.kind}`,
      );
    }
    seenKinds.add(component.kind);
  }
  for (const kind of AUTHORITY_COMPONENT_KINDS) {
    if (!seenKinds.has(kind)) {
      throw new LatestAuthorityCutoverError(
        'capture-components-incomplete',
        `Component closure is missing the declared ${kind} component.`,
      );
    }
  }
  const compatibility = validateCapturedPublicContract(
    input.capturedPublicContract,
    input.supportedPublicContract,
  );
  if (compatibility.classification === 'ADAPTATION_REQUIRED') {
    // The capture receipt is still sealed (it is the fail-closed evidence),
    // but see assertCaptureCompatible: no candidate may be generated from it.
  }
  const captureId = `cap-${randomUUID()}`;
  const captureHash = projectionDigest({
    captureId,
    capturedAt: input.capturedAt,
    actkgMainCommit: input.actkgMainCommit,
    sourceCommit: input.sourceCommit,
    sourceTag: input.sourceTag,
    packagingCommit: input.packagingCommit,
    stableTag: input.stableTag,
    releaseId: input.releaseId,
    releaseVersion: input.releaseVersion,
    bundleId: input.bundleId,
    bundleDigest: input.bundleDigest,
    manifestSha256: input.manifestSha256,
    sha256sumsSha256: input.sha256sumsSha256,
    validationReportSha256: input.validationReportSha256,
    publicationState: 'PUBLISHED_COMPLETE',
    componentIdentities: [...input.componentIdentities].sort((a, b) => a.kind.localeCompare(b.kind)),
    predecessorBundleId: input.predecessorBundleId,
    candidateChain: [...input.candidateChain],
    compatibility: {
      classification: compatibility.classification,
      incompatibleReasons: [...compatibility.incompatibleReasons],
      captured: input.capturedPublicContract,
    },
  });
  return {
    contract: 'authority-capture-receipt/v2',
    captureId,
    capturedAt: input.capturedAt,
    actkgMainCommit: input.actkgMainCommit,
    sourceCommit: input.sourceCommit,
    sourceTag: input.sourceTag,
    packagingCommit: input.packagingCommit,
    stableTag: input.stableTag,
    releaseId: input.releaseId,
    releaseVersion: input.releaseVersion,
    bundleId: input.bundleId,
    bundleDigest: input.bundleDigest,
    manifestSha256: input.manifestSha256,
    sha256sumsSha256: input.sha256sumsSha256,
    validationReportSha256: input.validationReportSha256,
    publicationState: 'PUBLISHED_COMPLETE',
    componentIdentities: [...input.componentIdentities].sort((a, b) => a.kind.localeCompare(b.kind)),
    predecessorBundleId: input.predecessorBundleId,
    candidateChain: [...input.candidateChain],
    compatibility,
    captureHash,
  };
}

/**
 * A capture that is not compatible emits no selectable artifacts. The
 * coordinated candidate path must stop here and require a separate
 * adaptation change.
 */
export function assertCaptureCompatible(receipt: AuthorityCaptureReceipt): void {
  if (receipt.compatibility.classification !== 'COMPATIBLE') {
    throw new LatestAuthorityCutoverError(
      'adaptation-required',
      `The captured Authority requires a schema adaptation: ${receipt.compatibility.incompatibleReasons.join('; ')}`,
    );
  }
}

/** Re-verify a sealed capture receipt against its own hash. */
export function reopenAuthorityCaptureReceipt(receipt: AuthorityCaptureReceipt): AuthorityCaptureReceipt {
  const expected = sealAuthorityCaptureReceipt({
    capturedAt: receipt.capturedAt,
    actkgMainCommit: receipt.actkgMainCommit,
    sourceCommit: receipt.sourceCommit,
    sourceTag: receipt.sourceTag,
    packagingCommit: receipt.packagingCommit,
    stableTag: receipt.stableTag,
    releaseId: receipt.releaseId,
    releaseVersion: receipt.releaseVersion,
    bundleId: receipt.bundleId,
    bundleDigest: receipt.bundleDigest,
    manifestSha256: receipt.manifestSha256,
    sha256sumsSha256: receipt.sha256sumsSha256,
    validationReportSha256: receipt.validationReportSha256,
    actkgWorktreeDirty: false,
    componentIdentities: receipt.componentIdentities,
    predecessorBundleId: receipt.predecessorBundleId,
    candidateChain: receipt.candidateChain,
    capturedPublicContract: receipt.compatibility.captured,
    adapterContractVersion: receipt.compatibility.adapterContractVersion,
    supportedPublicContract: supportedFromCaptured(receipt.compatibility.captured),
  });
  // sealAuthorityCaptureReceipt derives its own captureId; compare the hash
  // over the shared body instead of the id itself.
  const bodyHash = (value: AuthorityCaptureReceipt): string => {
    const { captureId: _ignored, ...body } = value;
    return projectionDigest(body);
  };
  if (bodyHash(receipt) !== bodyHash(expected)) {
    throw new LatestAuthorityCutoverError(
      'capture-receipt-tampered',
      'The reopened capture receipt does not match its sealed hash.',
    );
  }
  return receipt;
}

function supportedFromCaptured(captured: CapturedPublicContract): SupportedPublicContract {
  // Reopening verifies structural integrity, not adapter support; the
  // original compatibility verdict travels inside the receipt.
  return {
    schemaIdentities: { [captured.schemaVersion]: captured.schemaSha256 },
    contractVersions: [captured.contractVersion],
    requiredMembers: [...captured.requiredMembers],
    profiles: [...captured.profiles],
  };
}

/**
 * Post-capture upstream stability: a newer release published after the seal
 * must not mutate or invalidate the in-flight capture. Re-observing the
 * upstream checkout yields a fresh capture instance (new captureId and
 * timestamp), so stability compares the immutable release identity chain —
 * any difference means a newer release that requires a new incremental
 * capture rather than mutating the in-flight candidate.
 */
export function assertCaptureStable(
  sealed: AuthorityCaptureReceipt,
  observed: Pick<
    AuthorityCaptureReceipt,
    | 'actkgMainCommit'
    | 'sourceCommit'
    | 'sourceTag'
    | 'packagingCommit'
    | 'stableTag'
    | 'releaseId'
    | 'bundleId'
    | 'bundleDigest'
    | 'manifestSha256'
    | 'sha256sumsSha256'
    | 'validationReportSha256'
  >,
): void {
  const identityFields = [
    'actkgMainCommit',
    'sourceCommit',
    'sourceTag',
    'packagingCommit',
    'stableTag',
    'releaseId',
    'bundleId',
    'bundleDigest',
    'manifestSha256',
    'sha256sumsSha256',
    'validationReportSha256',
  ] as const;
  for (const field of identityFields) {
    if (sealed[field] !== observed[field]) {
      throw new LatestAuthorityCutoverError(
        'capture-mutated-after-seal',
        `The observed upstream release differs from the sealed capture (${field}: ${String(sealed[field])} -> ${String(observed[field])}); the newer release requires a new incremental capture.`,
      );
    }
  }
}

export function isAuthorityCompatibilityClassification(
  value: string,
): value is (typeof AUTHORITY_COMPATIBILITY_CLASSIFICATIONS)[number] {
  return AUTHORITY_COMPATIBILITY_CLASSIFICATIONS.includes(value as 'COMPATIBLE');
}
