import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertLatestAggregateAuthority,
  assertLatestAggregateProjectionIdentity,
  type LatestAggregateAuthorityInput,
  type LatestAggregateProjectionIdentityEvidence,
} from '../aggregate-governance/latest-aggregate-authority';

const RELEASE_SET = 'actkg-authoritative-candidate-r3';
const RELEASE_ID = 'ctr:release:control-theory-engineering-v0.8';
const RELEASE_VERSION = 'control-theory-engineering-v0.8';
const RELEASE_HASH = 'a'.repeat(64);
const SOURCE_DATASET_HASH = 'b'.repeat(64);
const BUNDLE_ID = 'ctb:control-theory-engineering-v0.8:r3';
const BUNDLE_DIGEST = 'c'.repeat(64);
const PROJECTION_ID = 'ctr:projection:control-theory-engineering-v0.8:runtime-v1';
const PROJECTION_DIGEST = 'f'.repeat(64);
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
      projectionId: PROJECTION_ID,
      projectionDigest: PROJECTION_DIGEST,
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
      projectionId: PROJECTION_ID,
      projectionDigest: PROJECTION_DIGEST,
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
      projectionId: PROJECTION_ID,
      projectionDigest: PROJECTION_DIGEST,
    },
    bundleReceipt: {
      id: BUNDLE_RECEIPT_ID,
      bundleId: BUNDLE_ID,
      bundleRevision: 3,
      bundleDigest: BUNDLE_DIGEST,
      runtimeProjectionId: PROJECTION_ID,
      runtimeProjectionDigest: PROJECTION_DIGEST,
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

function validProjectionIdentity(): LatestAggregateProjectionIdentityEvidence {
  return {
    releaseId: RELEASE_ID,
    projectionId: PROJECTION_ID,
    versionDigest: PROJECTION_DIGEST,
    sourceRelease: RELEASE_ID,
    sourceReleaseHash: RELEASE_HASH,
    sourceDatasetHash: SOURCE_DATASET_HASH,
  };
}

describe('latest Aggregate authority closure', () => {
  it('protects every repository evidence source before dynamic worklist generation', async () => {
    const source = await readFile(path.join(
      process.cwd(),
      'scripts/course-coverage/review-aggregate-coverage-baseline.ts',
    ), 'utf8');
    expect(source).toContain("'scripts/course-coverage/review-aggregate-coverage-baseline.ts'");
    expect(source).toContain("'course-content/authoring/knowledge/canonical-nodes.json'");
    expect(source).toContain("'course-content/syllabus-refactor/blueprint.md'");
    expect(source).toContain("'course-content/syllabus-refactor/main.md'");
    expect(source).toContain("'course-content/authoring/lessons'");
    expect(source).toContain("'course-content/authoring/knowledge/cards'");
    expect(source).toContain("['ls-files', '-z', '--', relativePath]");
    expect(source).not.toContain("readdir(cardRoot");
    expect(source.indexOf('resolveTrustedCaptureRevision({')).toBeLessThan(
      source.indexOf('const input = await resolveInputConfig('),
    );
  });

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

  it('rejects a stale Release projection identity', () => {
    const input = validInput();
    input.release.projectionDigest = '0'.repeat(64);
    expect(() => assertLatestAggregateAuthority(input)).toThrow(/Release\.projectionDigest mismatch/);
  });

  it('rejects a stale ImportReceipt projection identity', () => {
    const input = validInput();
    input.importReceipt.projectionId = 'ctr:projection:stale';
    expect(() => assertLatestAggregateAuthority(input)).toThrow(/ImportReceipt\.projectionId mismatch/);
  });

  it('rejects a stale BundleReceipt projection identity', () => {
    const input = validInput();
    input.bundleReceipt.runtimeProjectionDigest = '0'.repeat(64);
    expect(() => assertLatestAggregateAuthority(input)).toThrow(/BundleReceipt\.runtimeProjectionDigest mismatch/);
  });

  it('rejects a stale ProjectionIdentity row', () => {
    const input = validInput();
    const identity = validProjectionIdentity();
    identity.sourceReleaseHash = '0'.repeat(64);
    expect(() => assertLatestAggregateProjectionIdentity(
      identity,
      input.lock,
      input.bundleReceipt,
    )).toThrow(/ProjectionIdentity\.sourceReleaseHash mismatch/);
  });
});
