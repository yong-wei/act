import { describe, expect, it } from 'vitest';

import {
  assertLatestAggregateAuthority,
  type LatestAggregateAuthorityInput,
} from '../aggregate-governance/latest-aggregate-authority';

const RELEASE_SET = 'actkg-authoritative-candidate-r3';
const RELEASE_ID = 'ctr:release:control-theory-engineering-v0.8';
const RELEASE_VERSION = 'control-theory-engineering-v0.8';
const RELEASE_HASH = 'a'.repeat(64);
const SOURCE_DATASET_HASH = 'b'.repeat(64);
const BUNDLE_ID = 'ctb:control-theory-engineering-v0.8:r3';
const BUNDLE_DIGEST = 'c'.repeat(64);
const LOCK_HASH = 'd'.repeat(64);
const DELTA_ID = 'delta-receipt:r3';
const CAPTURE = 'e'.repeat(40);
const IMPORT_ID = 'receipt:r3';
const BUNDLE_RECEIPT_ID = 'bundle-receipt:r3';

function validInput(): LatestAggregateAuthorityInput {
  return {
    lock: {
      lockPath: 'course-content/authoring/knowledge/r3.lock.json',
      lockRawSha256: LOCK_HASH,
      releaseSetId: RELEASE_SET,
      releaseId: RELEASE_ID,
      releaseVersion: RELEASE_VERSION,
      releaseHash: RELEASE_HASH,
      sourceDatasetHash: SOURCE_DATASET_HASH,
      bundleControlledPath: 'course-content/authoring/knowledge/r3',
      bundleId: BUNDLE_ID,
      bundleRevision: 3,
      bundleDigest: BUNDLE_DIGEST,
    },
    expectedDeltaReceiptId: DELTA_ID,
    expectedCaptureRevision: CAPTURE,
    releaseSet: {
      id: RELEASE_SET,
      controlledPath: 'course-content/authoring/knowledge/r3',
      lockVersion: 'actkg-release-set-lock/v3',
      candidateState: 'CANDIDATE',
    },
    release: {
      id: RELEASE_ID,
      releaseSetId: RELEASE_SET,
      releaseVersion: RELEASE_VERSION,
      releaseHash: RELEASE_HASH,
      sourceDatasetHash: SOURCE_DATASET_HASH,
      captureRevision: CAPTURE,
      lockRawHash: LOCK_HASH,
    },
    importReceipt: {
      id: IMPORT_ID,
      releaseSetId: RELEASE_SET,
      releaseId: RELEASE_ID,
      candidateState: 'ACCEPTED_CANDIDATE',
      captureRevision: CAPTURE,
      lockRawHash: LOCK_HASH,
      bundleId: null,
      bundleDigest: null,
    },
    bundleReceipt: {
      id: BUNDLE_RECEIPT_ID,
      bundleId: BUNDLE_ID,
      bundleRevision: 3,
      bundleDigest: BUNDLE_DIGEST,
      candidateState: 'ACCEPTED_CANDIDATE',
      releaseSetId: RELEASE_SET,
      releaseId: RELEASE_ID,
      releaseHash: RELEASE_HASH,
      sourceDatasetHash: SOURCE_DATASET_HASH,
      controlledPath: 'course-content/authoring/knowledge/r3',
      lockVersion: 'actkg-release-set-lock/v3',
      lockPath: 'course-content/authoring/knowledge/r3.lock.json',
      lockRawSha256: LOCK_HASH,
      captureRevision: CAPTURE,
    },
    delta: {
      id: DELTA_ID,
      authorizationState: 'ACCEPTED',
      candidateEvidenceKind: 'standard_bundle',
      candidateReleaseSetId: RELEASE_SET,
      candidateReleaseId: RELEASE_ID,
      candidateReleaseVersion: RELEASE_VERSION,
      candidateReleaseHash: RELEASE_HASH,
      candidateSourceDatasetHash: SOURCE_DATASET_HASH,
      candidateImportReceiptId: IMPORT_ID,
      candidateBundleReceiptId: BUNDLE_RECEIPT_ID,
      candidateBundleId: BUNDLE_ID,
      candidateBundleDigest: BUNDLE_DIGEST,
      candidateEvidenceCaptureRevision: CAPTURE,
      identityViolations: [],
    },
  };
}

describe('latest Aggregate authority closure', () => {
  it('accepts a lock, import, Bundle receipt, and Delta with one identity', () => {
    expect(() => assertLatestAggregateAuthority(validInput())).not.toThrow();
  });

  it('rejects a caller-selected ReleaseSet that is not the lock and DB identity', () => {
    const input = validInput();
    input.releaseSet.id = 'caller-selected-release-set';
    expect(() => assertLatestAggregateAuthority(input)).toThrow(/ReleaseSet\.id mismatch/);
  });

  it('rejects a Delta receipt from another candidate release', () => {
    const input = validInput();
    input.delta.candidateReleaseId = 'ctr:release:other';
    expect(() => assertLatestAggregateAuthority(input)).toThrow(/Delta\.candidateReleaseId mismatch/);
  });

  it('rejects mixed Release/Projection/Lock identity', () => {
    const input = validInput();
    input.release.releaseHash = 'f'.repeat(64);
    expect(() => assertLatestAggregateAuthority(input)).toThrow(/Release\.releaseHash mismatch/);
  });

  it('rejects a non-accepted Bundle receipt or non-empty Delta identity violations', () => {
    const input = validInput();
    input.bundleReceipt.candidateState = 'STAGED';
    expect(() => assertLatestAggregateAuthority(input)).toThrow(/BundleReceipt\.candidateState mismatch/);

    const invalidDelta = validInput();
    invalidDelta.delta.identityViolations = ['releaseHash'];
    expect(() => assertLatestAggregateAuthority(invalidDelta)).toThrow(/identityViolations/);
  });
});
