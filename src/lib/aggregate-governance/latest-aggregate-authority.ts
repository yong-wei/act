/**
 * Authority closure for a dynamically selected Aggregate CourseCoverage input.
 *
 * The public Bundle loader proves the lock and on-disk package.  This helper
 * proves that the selected lock identity is the same identity persisted by ACT
 * import, Bundle acceptance, and the accepted Delta receipt.  It intentionally
 * accepts plain read-only records so the comparison is unit-testable without a
 * database or a caller-controlled JSON authority document.
 */

export interface LatestAggregateLockIdentity {
  lockPath: string;
  lockRawSha256: string;
  releaseSetId: string;
  releaseId: string;
  releaseVersion: string;
  releaseHash: string;
  sourceDatasetHash: string;
  bundleControlledPath: string;
  bundleId: string;
  bundleRevision: number;
  bundleDigest: string;
}

export interface LatestAggregateReleaseSetEvidence {
  id: string;
  controlledPath: string;
  lockVersion: string;
  candidateState: string;
}

export interface LatestAggregateReleaseEvidence {
  id: string;
  releaseSetId: string;
  releaseVersion: string;
  releaseHash: string;
  sourceDatasetHash: string | null;
  captureRevision: string;
  lockRawHash: string;
}

export interface LatestAggregateImportEvidence {
  id: string;
  releaseSetId: string;
  releaseId: string;
  candidateState: string;
  captureRevision: string;
  lockRawHash: string;
  bundleId: string | null;
  bundleDigest: string | null;
}

export interface LatestAggregateBundleEvidence {
  id: string;
  bundleId: string;
  bundleRevision: number;
  bundleDigest: string;
  candidateState: string;
  releaseSetId: string;
  releaseId: string;
  releaseHash: string;
  sourceDatasetHash: string;
  controlledPath: string;
  lockVersion: string;
  lockPath: string;
  lockRawSha256: string;
  captureRevision: string;
}

export interface LatestAggregateDeltaEvidence {
  id: string;
  authorizationState: string;
  candidateEvidenceKind: string;
  candidateReleaseSetId: string;
  candidateReleaseId: string;
  candidateReleaseVersion: string;
  candidateReleaseHash: string;
  candidateSourceDatasetHash: string;
  candidateImportReceiptId: string | null;
  candidateBundleReceiptId: string | null;
  candidateBundleId: string | null;
  candidateBundleDigest: string | null;
  candidateEvidenceCaptureRevision: string;
  identityViolations: unknown;
}

export interface LatestAggregateAuthorityInput {
  lock: LatestAggregateLockIdentity;
  expectedDeltaReceiptId: string;
  expectedCaptureRevision: string;
  releaseSet: LatestAggregateReleaseSetEvidence;
  release: LatestAggregateReleaseEvidence;
  importReceipt: LatestAggregateImportEvidence;
  bundleReceipt: LatestAggregateBundleEvidence;
  delta: LatestAggregateDeltaEvidence;
}

function reject(field: string, actual: unknown, expected: unknown): never {
  throw new Error(
    `Latest Aggregate authority rejected: ${field} mismatch `
    + `(actual=${String(actual)}, expected=${String(expected)})`,
  );
}

function equal(field: string, actual: unknown, expected: unknown): void {
  if (actual !== expected) reject(field, actual, expected);
}

function requiredAccepted(field: string, value: string, expected: string): void {
  equal(field, value, expected);
}

/**
 * Assert one immutable ReleaseSet/Bundle/Delta identity closure.
 *
 * This function does not accept a caller-provided JSON document as authority:
 * callers must first populate the evidence records from the ACT database and
 * the lock-validated public Bundle loader.
 */
export function assertLatestAggregateAuthority(
  input: LatestAggregateAuthorityInput,
): void {
  const { lock, releaseSet, release, importReceipt, bundleReceipt, delta } = input;

  equal('ReleaseSet.id', releaseSet.id, lock.releaseSetId);
  equal('ReleaseSet.controlledPath', releaseSet.controlledPath, lock.bundleControlledPath);
  requiredAccepted('ReleaseSet.candidateState', releaseSet.candidateState, 'CANDIDATE');
  equal('ReleaseSet.lockVersion', releaseSet.lockVersion, 'actkg-release-set-lock/v3');

  equal('Release.id', release.id, lock.releaseId);
  equal('Release.releaseSetId', release.releaseSetId, lock.releaseSetId);
  equal('Release.releaseVersion', release.releaseVersion, lock.releaseVersion);
  equal('Release.releaseHash', release.releaseHash, lock.releaseHash);
  equal('Release.sourceDatasetHash', release.sourceDatasetHash, lock.sourceDatasetHash);
  equal('Release.captureRevision', release.captureRevision, input.expectedCaptureRevision);
  equal('Release.lockRawHash', release.lockRawHash, lock.lockRawSha256);

  equal('ImportReceipt.releaseSetId', importReceipt.releaseSetId, lock.releaseSetId);
  equal('ImportReceipt.releaseId', importReceipt.releaseId, lock.releaseId);
  requiredAccepted('ImportReceipt.candidateState', importReceipt.candidateState, 'ACCEPTED_CANDIDATE');
  equal('ImportReceipt.captureRevision', importReceipt.captureRevision, input.expectedCaptureRevision);
  equal('ImportReceipt.lockRawHash', importReceipt.lockRawHash, lock.lockRawSha256);

  equal('BundleReceipt.bundleId', bundleReceipt.bundleId, lock.bundleId);
  equal('BundleReceipt.bundleRevision', bundleReceipt.bundleRevision, lock.bundleRevision);
  equal('BundleReceipt.bundleDigest', bundleReceipt.bundleDigest, lock.bundleDigest);
  requiredAccepted('BundleReceipt.candidateState', bundleReceipt.candidateState, 'ACCEPTED_CANDIDATE');
  equal('BundleReceipt.releaseSetId', bundleReceipt.releaseSetId, lock.releaseSetId);
  equal('BundleReceipt.releaseId', bundleReceipt.releaseId, lock.releaseId);
  equal('BundleReceipt.releaseHash', bundleReceipt.releaseHash, lock.releaseHash);
  equal('BundleReceipt.sourceDatasetHash', bundleReceipt.sourceDatasetHash, lock.sourceDatasetHash);
  equal('BundleReceipt.controlledPath', bundleReceipt.controlledPath, lock.bundleControlledPath);
  equal('BundleReceipt.lockVersion', bundleReceipt.lockVersion, 'actkg-release-set-lock/v3');
  equal('BundleReceipt.lockPath', bundleReceipt.lockPath, lock.lockPath);
  equal('BundleReceipt.lockRawSha256', bundleReceipt.lockRawSha256, lock.lockRawSha256);
  equal('BundleReceipt.captureRevision', bundleReceipt.captureRevision, input.expectedCaptureRevision);

  equal('Delta.id', delta.id, input.expectedDeltaReceiptId);
  requiredAccepted('Delta.authorizationState', delta.authorizationState, 'ACCEPTED');
  equal('Delta.candidateEvidenceKind', delta.candidateEvidenceKind, 'standard_bundle');
  equal('Delta.candidateReleaseSetId', delta.candidateReleaseSetId, lock.releaseSetId);
  equal('Delta.candidateReleaseId', delta.candidateReleaseId, lock.releaseId);
  equal('Delta.candidateReleaseVersion', delta.candidateReleaseVersion, lock.releaseVersion);
  equal('Delta.candidateReleaseHash', delta.candidateReleaseHash, lock.releaseHash);
  equal('Delta.candidateSourceDatasetHash', delta.candidateSourceDatasetHash, lock.sourceDatasetHash);
  equal('Delta.candidateImportReceiptId', delta.candidateImportReceiptId, importReceipt.id);
  equal('Delta.candidateBundleReceiptId', delta.candidateBundleReceiptId, bundleReceipt.id);
  equal('Delta.candidateBundleId', delta.candidateBundleId, lock.bundleId);
  equal('Delta.candidateBundleDigest', delta.candidateBundleDigest, lock.bundleDigest);
  equal(
    'Delta.candidateEvidenceCaptureRevision',
    delta.candidateEvidenceCaptureRevision,
    input.expectedCaptureRevision,
  );
  if (!Array.isArray(delta.identityViolations) || delta.identityViolations.length !== 0) {
    throw new Error('Latest Aggregate authority rejected: Delta.identityViolations is not empty');
  }
}
