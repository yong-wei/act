import { prisma } from '@/lib/prisma';
import path from 'node:path';

import { isGlobalCourseCoverageRuntimeSelectorPermitted } from '@/lib/legacy-knowledge-runtime-retirement';

import {
  DEFAULT_AUTHORITY_ROOT_RELATIVE,
} from './authority-snapshot';
import {
  resolveAuthorityStorePaths,
  type AuthorityStorePaths,
} from './authority-store';
import { readActiveAuthorityRepositoryResult } from './engineering-authority-consumers';
import {
  ACCEPTED_CANDIDATE_STATE,
  CURRENT_AGGREGATE_RELEASE_SET_ID,
  CTKG_0_2_SCHEMA_VERSION,
  STANDARD_PUBLIC_BUNDLE_PROTOCOL,
  isAggregateReleaseProtocol,
  isExactAggregateReleaseProtocol,
  isStandardPublicBundleProtocol,
  type AuthoritySelector,
  type AuthoritativeBundleArtifactRecord,
  type AuthoritativeBundleReceiptRecord,
  type AuthoritativeEvidenceRecord,
  type AuthoritativeImportReceiptRecord,
  type AuthoritativeKnowledgeSnapshot,
  type AuthoritativeObjectRecord,
  type AuthoritativeProjectionIdentityRecord,
  type AuthoritativeProjectionLinkMetadataRecord,
  type AuthoritativeProjectionLinkRecord,
  type AuthoritativeProjectionNodeRecord,
  type AuthoritativeRelationRecord,
  type AuthoritativeReleaseArtifactRecord,
  type AuthoritativeReleaseComponentRecord,
  type AuthoritativeReleaseEntryRecord,
  type AuthoritativeReleaseRecord,
  type AuthoritativeReleaseSetRecord,
  type AuthoritativeSourceMappingRecord,
  type AuthoritativeSourceObjectRecord,
  type AuthoritativeUpstreamRagReferenceRecord,
  type CourseCoverageAuditIdentity,
  type CourseCoverageDiagnostic,
  type CourseCoverageRecord,
  type CourseCoverageResult,
  type CourseCoverageRole,
  type CourseCoverageSelector,
  type RepositoryDiagnostic,
  type RepositoryResult,
} from './contracts';

interface Delegate {
  findUnique(args: unknown): Promise<unknown>;
  findFirst?(args: unknown): Promise<unknown>;
  findMany(args: unknown): Promise<unknown[]>;
}

export interface AuthoritativeKnowledgeTransaction {
  actkgReleaseSet: Delegate;
  actkgRelease: Delegate;
  actkgImportReceipt: Delegate;
  actkgAuthoritativeObject: Delegate;
  actkgAuthoritativeRelation: Delegate;
  actkgSourceMapping: Delegate;
  actkgSourceObject: Delegate;
  actkgEvidenceSegment: Delegate;
  actkgReleaseArtifact: Delegate;
  actkgReleaseComponent: Delegate;
  actkgReleaseEntry: Delegate;
  actkgProjectionNode: Delegate;
  actkgProjectionLink: Delegate;
  actkgUpstreamRagReference: Delegate;
  actkgBundleReceipt: Delegate;
  actkgBundleArtifact: Delegate;
  actkgProjectionIdentity: Delegate;
  actkgProjectionLinkMetadata: Delegate;
  courseCoverageOverlayVersion: Delegate;
  courseCoverageOverlayEntry: Delegate;
  courseCoverageImportReceipt: Delegate;
}

export interface AuthoritativeKnowledgeDatabase {
  $transaction<T>(
    callback: (transaction: AuthoritativeKnowledgeTransaction) => Promise<T>,
    options: { isolationLevel: 'RepeatableRead' },
  ): Promise<T>;
}

const SHA256 = /^[a-f0-9]{64}$/u;
const GIT_COMMIT = /^[a-f0-9]{40}$/u;
/** Reserved public package files that must appear on every accepted standard packaging receipt. */
const RESERVED_PUBLIC_BUNDLE_PATHS = ['bundle-manifest.json', 'SHA256SUMS'] as const;
/**
 * Order for "latest accepted packaging evidence" of one Release.
 *
 * Primary key is `importedAt desc`: the importer stamps a **strictly monotonic**
 * acceptance timestamp per releaseId under the release advisory lock
 * (`max(now, previousAccepted+1ms)`), so equal-ms wall-clock collisions do not
 * erase real acceptance order. Never rank by `bundleRevision` alone — re-packaging
 * may reset revision under a new bundleId (A@10 then B@2).
 *
 * `id desc` is only a deterministic fallback for pre-fix rows or other equal
 * `importedAt` values; it is **not** proof of acceptance order.
 */
export const LATEST_ACCEPTED_BUNDLE_RECEIPT_ORDER_BY: Array<
  { importedAt: 'desc' } | { id: 'desc' }
> = [
  { importedAt: 'desc' },
  { id: 'desc' },
];

function byOrdinalAndId<T extends { ordinal: number }>(
  rows: T[],
  identity: (row: T) => string,
): T[] {
  return [...rows].sort((left, right) => (
    left.ordinal - right.ordinal || identity(left).localeCompare(identity(right))
  ));
}

function compare(
  diagnostics: RepositoryDiagnostic[],
  input: {
    code: RepositoryDiagnostic['code'];
    field: string;
    expected: string | number;
    actual: string | number | null;
  },
): void {
  if (input.expected !== input.actual) diagnostics.push(input);
}

function compareNullable(
  diagnostics: RepositoryDiagnostic[],
  input: {
    code: RepositoryDiagnostic['code'];
    field: string;
    expected: string | number | null;
    actual: string | number | null;
  },
): void {
  if (input.expected !== input.actual) {
    diagnostics.push({
      code: input.code,
      field: input.field,
      expected: input.expected ?? '(missing)',
      actual: input.actual,
    });
  }
}

function diagnoseExactAggregateSnapshot(
  snapshot: AuthoritativeKnowledgeSnapshot,
  diagnostics: RepositoryDiagnostic[],
): void {
  const { release, receipt } = snapshot;
  compareNullable(diagnostics, {
    code: 'release-identity-mismatch',
    field: 'release.schemaVersion',
    expected: CTKG_0_2_SCHEMA_VERSION,
    actual: release.schemaVersion ?? null,
  });
  for (const [field, value] of [
    ['release.projectionDigest', release.projectionDigest],
    ['release.sourceDatasetHash', release.sourceDatasetHash],
  ] as const) {
    if (typeof value !== 'string' || !SHA256.test(value)) {
      diagnostics.push({
        code: 'hash-invalid',
        field,
        expected: '64 lowercase hexadecimal characters',
        actual: value ?? null,
      });
    }
  }
  for (const [field, value] of [
    ['release.upstreamPublicationCommit', release.upstreamPublicationCommit],
    ['release.upstreamClosedCommit', release.upstreamClosedCommit],
  ] as const) {
    if (typeof value !== 'string' || !GIT_COMMIT.test(value)) {
      diagnostics.push({
        code: 'capture-revision-invalid',
        field,
        expected: '40 lowercase hexadecimal characters',
        actual: value ?? null,
      });
    }
  }
  if (!receipt) return;
  compare(diagnostics, {
    code: 'candidate-state-mismatch',
    field: 'receipt.candidateState',
    expected: 'CANDIDATE',
    actual: receipt.candidateState,
  });
  for (const [field, expected, actual] of [
    ['receipt.schemaVersion', release.schemaVersion, receipt.schemaVersion],
    ['receipt.upstreamReleaseId', release.upstreamReleaseId, receipt.upstreamReleaseId],
    ['receipt.projectionId', release.projectionId, receipt.projectionId],
    ['receipt.projectionDigest', release.projectionDigest, receipt.projectionDigest],
    ['receipt.sourceDatasetHash', release.sourceDatasetHash, receipt.sourceDatasetHash],
    ['receipt.upstreamPublicationCommit', release.upstreamPublicationCommit, receipt.upstreamPublicationCommit],
    ['receipt.upstreamClosedCommit', release.upstreamClosedCommit, receipt.upstreamClosedCommit],
  ] as const) {
    compareNullable(diagnostics, {
      code: 'receipt-identity-mismatch',
      field,
      expected: expected ?? null,
      actual: actual ?? null,
    });
  }
  const aggregateCounts = {
    releaseEntryCount: snapshot.releaseEntries?.length ?? 0,
    projectionNodeCount: snapshot.projectionNodes?.length ?? 0,
    projectionLinkCount: snapshot.projectionLinks?.length ?? 0,
    upstreamRagReferenceCount: snapshot.upstreamRagReferences?.length ?? 0,
    artifactCount: snapshot.releaseArtifacts?.length ?? 0,
    componentCount: snapshot.releaseComponents?.length ?? 0,
  } as const;
  for (const [field, actual] of Object.entries(aggregateCounts)) {
    const expected = receipt[field as keyof typeof aggregateCounts];
    if (typeof expected === 'number') {
      compare(diagnostics, {
        code: 'receipt-count-mismatch',
        field: `receipt.${field}`,
        expected,
        actual,
      });
    } else {
      diagnostics.push({
        code: 'receipt-count-mismatch',
        field: `receipt.${field}`,
        expected: 'present',
        actual: null,
      });
    }
  }
  // #1125 exact path must not require later Manifest-only Bundle fields.
  if (snapshot.bundleReceipt) {
    diagnostics.push({
      code: 'mixed-candidate-snapshot',
      field: 'bundleReceipt',
      expected: 'absent for exact #1125 candidate',
      actual: snapshot.bundleReceipt.bundleDigest,
    });
  }
}

function diagnoseStandardBundleSnapshot(
  snapshot: AuthoritativeKnowledgeSnapshot,
  diagnostics: RepositoryDiagnostic[],
): void {
  const { release, receipt, bundleReceipt } = snapshot;
  for (const [field, value] of [
    ['release.projectionDigest', release.projectionDigest],
    ['release.sourceDatasetHash', release.sourceDatasetHash],
    ['release.schemaRawHash', release.schemaRawHash],
  ] as const) {
    if (typeof value !== 'string' || !SHA256.test(value)) {
      diagnostics.push({
        code: 'hash-invalid',
        field,
        expected: '64 lowercase hexadecimal characters',
        actual: value ?? null,
      });
    }
  }
  if (typeof release.schemaVersion !== 'string' || release.schemaVersion.length === 0) {
    diagnostics.push({
      code: 'release-identity-mismatch',
      field: 'release.schemaVersion',
      expected: 'persisted Schema version',
      actual: release.schemaVersion ?? null,
    });
  }
  if (!bundleReceipt) {
    diagnostics.push({
      code: 'bundle-receipt-missing',
      field: 'bundleReceipt',
      expected: ACCEPTED_CANDIDATE_STATE,
      actual: null,
    });
    return;
  }
  if (bundleReceipt.candidateState !== ACCEPTED_CANDIDATE_STATE) {
    diagnostics.push({
      code: 'candidate-state-mismatch',
      field: 'bundleReceipt.candidateState',
      expected: ACCEPTED_CANDIDATE_STATE,
      actual: bundleReceipt.candidateState,
    });
    return;
  }
  compare(diagnostics, {
    code: 'bundle-identity-mismatch',
    field: 'bundleReceipt.releaseSetId',
    expected: snapshot.releaseSet.id,
    actual: bundleReceipt.releaseSetId,
  });
  compare(diagnostics, {
    code: 'bundle-identity-mismatch',
    field: 'bundleReceipt.releaseId',
    expected: release.id,
    actual: bundleReceipt.releaseId,
  });
  compare(diagnostics, {
    code: 'bundle-identity-mismatch',
    field: 'bundleReceipt.releaseHash',
    expected: release.releaseHash,
    actual: bundleReceipt.releaseHash,
  });
  compare(diagnostics, {
    code: 'bundle-identity-mismatch',
    field: 'bundleReceipt.sourceDatasetHash',
    expected: release.sourceDatasetHash ?? '(missing)',
    actual: bundleReceipt.sourceDatasetHash,
  });
  compare(diagnostics, {
    code: 'bundle-identity-mismatch',
    field: 'bundleReceipt.runtimeProjectionId',
    expected: release.projectionId ?? '(missing)',
    actual: bundleReceipt.runtimeProjectionId,
  });
  compare(diagnostics, {
    code: 'bundle-identity-mismatch',
    field: 'bundleReceipt.runtimeProjectionDigest',
    expected: release.projectionDigest ?? '(missing)',
    actual: bundleReceipt.runtimeProjectionDigest,
  });
  // Packaging revisions may carry a later Git capture and lock hash on the
  // accepted Bundle receipt. Semantic ActkgRelease keeps the first-import
  // values, so compare receipt packaging identity only against its own contract
  // (format/integrity), not against the immutable Release snapshot.
  if (!GIT_COMMIT.test(bundleReceipt.captureRevision)) {
    diagnostics.push({
      code: 'capture-revision-invalid',
      field: 'bundleReceipt.captureRevision',
      expected: '40 lowercase hexadecimal characters',
      actual: bundleReceipt.captureRevision,
    });
  }
  if (!SHA256.test(bundleReceipt.lockRawSha256)) {
    diagnostics.push({
      code: 'hash-invalid',
      field: 'bundleReceipt.lockRawSha256',
      expected: '64 lowercase hexadecimal characters',
      actual: bundleReceipt.lockRawSha256,
    });
  }
  compare(diagnostics, {
    code: 'bundle-identity-mismatch',
    field: 'bundleReceipt.schemaRawSha256',
    expected: release.schemaRawHash,
    actual: bundleReceipt.schemaRawSha256,
  });
  compare(diagnostics, {
    code: 'bundle-identity-mismatch',
    field: 'bundleReceipt.bundleContractVersion',
    expected: STANDARD_PUBLIC_BUNDLE_PROTOCOL,
    actual: bundleReceipt.bundleContractVersion,
  });
  compare(diagnostics, {
    code: 'receipt-count-mismatch',
    field: 'bundleReceipt.artifactCount',
    expected: bundleReceipt.artifactCount,
    actual: snapshot.bundleArtifacts?.length ?? 0,
  });

  // Persisted Artifact contract identities for the latest accepted packaging.
  // Complete public packages always include reserved Manifest + SHA256SUMS bytes.
  for (const relativePath of RESERVED_PUBLIC_BUNDLE_PATHS) {
    const reserved = (snapshot.bundleArtifacts ?? []).find((row) => row.relativePath === relativePath);
    if (!reserved) {
      diagnostics.push({
        code: 'bundle-identity-mismatch',
        field: `bundleArtifacts.${relativePath}`,
        expected: 'present',
        actual: null,
      });
      continue;
    }
    if (!reserved.role || !reserved.contractVersion || !SHA256.test(reserved.sha256)) {
      diagnostics.push({
        code: 'bundle-identity-mismatch',
        field: `bundleArtifacts.${relativePath}.contract`,
        expected: 'role+contractVersion+sha256',
        actual: `${reserved.role ?? 'null'}/${reserved.contractVersion ?? 'null'}/${reserved.sha256}`,
      });
    }
  }
  const manifestArtifact = (snapshot.bundleArtifacts ?? []).find(
    (row) => row.relativePath === 'bundle-manifest.json',
  );
  if (manifestArtifact) {
    compare(diagnostics, {
      code: 'bundle-identity-mismatch',
      field: 'bundleArtifacts.bundle-manifest.json.sha256',
      expected: bundleReceipt.manifestRawSha256,
      actual: manifestArtifact.sha256,
    });
  }

  const requiredRoles = new Map<string, {
    role: string;
    sha256: string;
    contractVersion: string;
    required: boolean;
  }>();
  for (const artifact of snapshot.bundleArtifacts ?? []) {
    if (!artifact.role || !artifact.contractVersion || !SHA256.test(artifact.sha256)) {
      diagnostics.push({
        code: 'bundle-identity-mismatch',
        field: `bundleArtifacts.${artifact.relativePath}.contract`,
        expected: 'role+contractVersion+sha256',
        actual: `${artifact.role ?? 'null'}/${artifact.contractVersion ?? 'null'}/${artifact.sha256}`,
      });
      continue;
    }
    if (artifact.required) {
      requiredRoles.set(artifact.role, {
        role: artifact.role,
        sha256: artifact.sha256,
        contractVersion: artifact.contractVersion,
        required: artifact.required,
      });
    }
  }
  for (const role of ['release', 'projection', 'ctkg_schema', 'rag_crosswalk'] as const) {
    // projection role may appear multiple times (runtime/domain/review); require at least one.
    if (role === 'projection') {
      const hasProjection = (snapshot.bundleArtifacts ?? []).some((row) => row.role === 'projection');
      if (!hasProjection) {
        diagnostics.push({
          code: 'bundle-identity-mismatch',
          field: 'bundleArtifacts.projection',
          expected: 'present',
          actual: null,
        });
      }
      continue;
    }
    if (!requiredRoles.has(role) && !(snapshot.bundleArtifacts ?? []).some((row) => row.role === role)) {
      diagnostics.push({
        code: 'bundle-identity-mismatch',
        field: `bundleArtifacts.${role}`,
        expected: 'present',
        actual: null,
      });
    }
  }

  const runtimeArtifact = (snapshot.bundleArtifacts ?? []).find((row) => (
    row.role === 'projection'
    && (
      row.profile === 'runtime'
      || (typeof row.profile === 'string' && row.profile.toLowerCase().includes('runtime'))
      || row.relativePath.includes('.act-projection.')
    )
  ));
  if (runtimeArtifact) {
    compare(diagnostics, {
      code: 'projection-identity-mismatch',
      field: 'bundleArtifacts.runtime.sha256',
      expected: (
        (snapshot.projectionIdentities ?? []).find((row) => row.isRuntime)?.artifactSha256
        ?? runtimeArtifact.sha256
      ),
      actual: runtimeArtifact.sha256,
    });
  }

  const runtimeIdentity = (snapshot.projectionIdentities ?? []).find((row) => row.isRuntime);
  if (!runtimeIdentity) {
    diagnostics.push({
      code: 'projection-identity-mismatch',
      field: 'projectionIdentities.runtime',
      expected: 'present',
      actual: null,
    });
  } else {
    compare(diagnostics, {
      code: 'projection-identity-mismatch',
      field: 'projectionIdentities.runtime.projectionId',
      expected: bundleReceipt.runtimeProjectionId,
      actual: runtimeIdentity.projectionId,
    });
    compare(diagnostics, {
      code: 'projection-identity-mismatch',
      field: 'projectionIdentities.runtime.projectionProfile',
      expected: bundleReceipt.runtimeProjectionProfile,
      actual: runtimeIdentity.projectionProfile,
    });
    compare(diagnostics, {
      code: 'projection-identity-mismatch',
      field: 'projectionIdentities.runtime.versionDigest',
      expected: bundleReceipt.runtimeProjectionDigest,
      actual: runtimeIdentity.versionDigest,
    });
    compare(diagnostics, {
      code: 'projection-identity-mismatch',
      field: 'projectionIdentities.runtime.sourceReleaseHash',
      expected: release.releaseHash,
      actual: runtimeIdentity.sourceReleaseHash,
    });
    compare(diagnostics, {
      code: 'projection-identity-mismatch',
      field: 'projectionIdentities.runtime.sourceDatasetHash',
      expected: release.sourceDatasetHash ?? '(missing)',
      actual: runtimeIdentity.sourceDatasetHash,
    });
    compare(diagnostics, {
      code: 'receipt-count-mismatch',
      field: 'projectionIdentities.runtime.nodeCount',
      expected: runtimeIdentity.nodeCount,
      actual: snapshot.projectionNodes?.length ?? 0,
    });
    compare(diagnostics, {
      code: 'receipt-count-mismatch',
      field: 'projectionIdentities.runtime.linkCount',
      expected: runtimeIdentity.linkCount,
      actual: snapshot.projectionLinks?.length ?? 0,
    });
  }

  if (!receipt) {
    diagnostics.push({
      code: 'receipt-missing',
      field: 'receipt',
      expected: ACCEPTED_CANDIDATE_STATE,
      actual: null,
    });
    return;
  }
  compare(diagnostics, {
    code: 'candidate-state-mismatch',
    field: 'receipt.candidateState',
    expected: ACCEPTED_CANDIDATE_STATE,
    actual: receipt.candidateState,
  });
  // Semantic import receipt is written once per Release. Packaging Artifact
  // counts live only on ActkgBundleReceipt.artifactCount.
  for (const [field, expected, actual] of [
    ['receipt.schemaVersion', release.schemaVersion, receipt.schemaVersion],
    ['receipt.projectionId', release.projectionId, receipt.projectionId],
    ['receipt.projectionDigest', release.projectionDigest, receipt.projectionDigest],
    ['receipt.sourceDatasetHash', release.sourceDatasetHash, receipt.sourceDatasetHash],
    ['receipt.bundleContractVersion', STANDARD_PUBLIC_BUNDLE_PROTOCOL, receipt.bundleContractVersion],
  ] as const) {
    compareNullable(diagnostics, {
      code: 'receipt-identity-mismatch',
      field,
      expected: expected ?? null,
      actual: actual ?? null,
    });
  }
  const semanticCounts = {
    releaseEntryCount: snapshot.releaseEntries?.length ?? 0,
    projectionNodeCount: snapshot.projectionNodes?.length ?? 0,
    projectionLinkCount: snapshot.projectionLinks?.length ?? 0,
    upstreamRagReferenceCount: snapshot.upstreamRagReferences?.length ?? 0,
    componentCount: snapshot.releaseComponents?.length ?? 0,
  } as const;
  for (const [field, actual] of Object.entries(semanticCounts)) {
    const expected = receipt[field as keyof typeof semanticCounts];
    if (typeof expected === 'number') {
      compare(diagnostics, {
        code: 'receipt-count-mismatch',
        field: `receipt.${field}`,
        expected,
        actual,
      });
    } else {
      diagnostics.push({
        code: 'receipt-count-mismatch',
        field: `receipt.${field}`,
        expected: 'present',
        actual: null,
      });
    }
  }
}

function diagnoseSnapshot(snapshot: AuthoritativeKnowledgeSnapshot): RepositoryDiagnostic[] {
  const diagnostics: RepositoryDiagnostic[] = [];
  const { releaseSet, release, receipt } = snapshot;
  const exact = isExactAggregateReleaseProtocol(release.protocol);
  const standard = isStandardPublicBundleProtocol(release.protocol);
  const aggregate = isAggregateReleaseProtocol(release.protocol);

  compare(diagnostics, {
    code: 'candidate-state-mismatch',
    field: 'releaseSet.candidateState',
    expected: 'CANDIDATE',
    actual: releaseSet.candidateState,
  });
  compare(diagnostics, {
    code: 'release-set-identity-mismatch',
    field: 'release.releaseSetId',
    expected: releaseSet.id,
    actual: release.releaseSetId,
  });
  if (!GIT_COMMIT.test(release.captureRevision)) {
    diagnostics.push({
      code: 'capture-revision-invalid',
      field: 'release.captureRevision',
      expected: '40 lowercase hexadecimal characters',
      actual: release.captureRevision,
    });
  }
  for (const [field, value] of [
    ['release.contractHash', release.contractHash],
    ['release.releaseHash', release.releaseHash],
    ['release.schemaRawHash', release.schemaRawHash],
    ['release.releaseRawHash', release.releaseRawHash],
    ['release.notesRawHash', release.notesRawHash],
    ['release.lockRawHash', release.lockRawHash],
  ] as const) {
    if (!SHA256.test(value)) {
      diagnostics.push({
        code: 'hash-invalid',
        field,
        expected: '64 lowercase hexadecimal characters',
        actual: value,
      });
    }
  }

  if (!receipt && !standard) {
    diagnostics.push({
      code: 'receipt-missing',
      field: 'receipt',
      expected: 'present',
      actual: null,
    });
    if (exact) diagnoseExactAggregateSnapshot(snapshot, diagnostics);
    return diagnostics;
  }

  if (receipt) {
    compare(diagnostics, {
      code: 'receipt-identity-mismatch',
      field: 'receipt.releaseSetId',
      expected: releaseSet.id,
      actual: receipt.releaseSetId,
    });
    compare(diagnostics, {
      code: 'receipt-identity-mismatch',
      field: 'receipt.releaseId',
      expected: release.id,
      actual: receipt.releaseId,
    });
    compare(diagnostics, {
      code: 'capture-revision-mismatch',
      field: 'receipt.captureRevision',
      expected: release.captureRevision,
      actual: receipt.captureRevision,
    });
    compare(diagnostics, {
      code: 'lock-hash-mismatch',
      field: 'receipt.lockRawHash',
      expected: release.lockRawHash,
      actual: receipt.lockRawHash,
    });

    const actualCounts = {
      objectCount: snapshot.objects.length,
      sourceMappingCount: snapshot.sourceMappings.length,
      goldRelationCount: snapshot.relations.filter((row) => row.qualityTier === 'GOLD').length,
      silverRelationCount: snapshot.relations.filter((row) => row.qualityTier === 'SILVER').length,
      sourceObjectCount: snapshot.sourceObjects.length,
      evidenceSegmentCount: snapshot.evidence.length,
    };
    for (const [field, actual] of Object.entries(actualCounts)) {
      compare(diagnostics, {
        code: 'receipt-count-mismatch',
        field: `receipt.${field}`,
        expected: receipt[field as keyof typeof actualCounts],
        actual,
      });
    }
  }

  if (exact) {
    diagnoseExactAggregateSnapshot(snapshot, diagnostics);
  } else if (standard) {
    diagnoseStandardBundleSnapshot(snapshot, diagnostics);
  } else if (aggregate) {
    diagnostics.push({
      code: 'release-identity-mismatch',
      field: 'release.protocol',
      expected: 'exact or standard aggregate protocol',
      actual: release.protocol,
    });
  }
  return diagnostics;
}

export interface AuthoritativeKnowledgeRepositoryOptions {
  /**
   * Root directory for immutable Authority Snapshots and `current.json`.
   * Defaults to `course-content/authoring/knowledge/authority` under cwd.
   */
  authorityRoot?: string;
  /** Pre-resolved store paths (preferred in tests). */
  authorityStorePaths?: AuthorityStorePaths;
}

export class AuthoritativeKnowledgeRepository {
  private readonly authorityStorePaths: AuthorityStorePaths;

  constructor(
    private readonly database: AuthoritativeKnowledgeDatabase =
      prisma as unknown as AuthoritativeKnowledgeDatabase,
    options: AuthoritativeKnowledgeRepositoryOptions = {},
  ) {
    this.authorityStorePaths = options.authorityStorePaths
      ?? resolveAuthorityStorePaths(
        options.authorityRoot
          ?? path.resolve(process.cwd(), DEFAULT_AUTHORITY_ROOT_RELATIVE),
      );
  }

  /** Authority store paths used for active Engineering Authority resolution. */
  getAuthorityStorePaths(): AuthorityStorePaths {
    return this.authorityStorePaths;
  }

  async read(selector: AuthoritySelector): Promise<RepositoryResult> {
    if (selector.authorityState === 'active') {
      // Active Authority is resolved from the immutable filesystem pointer and
      // snapshot — never by falling back to an arbitrary candidate row set.
      return readActiveAuthorityRepositoryResult(this.authorityStorePaths);
    }
    if (selector.authorityState === 'legacy') {
      return {
        status: 'unavailable',
        selector,
        reason: 'legacy-outside-repository',
        diagnostics: [],
      };
    }

    return this.database.$transaction(async (transaction) => {
      const releaseSet = await transaction.actkgReleaseSet.findUnique({
        where: { id: selector.releaseSetId },
      }) as AuthoritativeReleaseSetRecord | null;
      const release = await transaction.actkgRelease.findUnique({
        where: { id: selector.releaseId },
      }) as AuthoritativeReleaseRecord | null;
      if (!releaseSet || !release || release.releaseSetId !== selector.releaseSetId) {
        return {
          status: 'unavailable',
          selector,
          reason: 'candidate-not-found',
          diagnostics: [],
        };
      }

      const historical = releaseSet.id !== CURRENT_AGGREGATE_RELEASE_SET_ID;

      if (isAggregateReleaseProtocol(release.protocol)) {
        // Aggregate branch: exact #1125 or standard public Bundle. Historical
        // CTKG 0.1 tables are never queried for these releases.
        const standard = isStandardPublicBundleProtocol(release.protocol);
        const [
          receipt,
          releaseArtifacts,
          releaseComponents,
          releaseEntries,
          projectionNodes,
          projectionLinks,
          upstreamRagReferences,
          bundleReceipt,
          projectionIdentities,
          linkMetadata,
        ] = await Promise.all([
          transaction.actkgImportReceipt.findUnique({ where: { releaseId: selector.releaseId } }),
          transaction.actkgReleaseArtifact.findMany({
            where: { releaseId: selector.releaseId },
            select: {
              releaseId: true,
              relativePath: true,
              ordinal: true,
              mediaType: true,
              sha256: true,
              byteLength: true,
              role: true,
              profile: true,
              contractVersion: true,
              required: true,
              recordCount: true,
            },
            orderBy: [{ ordinal: 'asc' }, { relativePath: 'asc' }],
          }),
          transaction.actkgReleaseComponent.findMany({
            where: { releaseId: selector.releaseId },
            orderBy: [{ ordinal: 'asc' }, { componentReleaseId: 'asc' }],
          }),
          transaction.actkgReleaseEntry.findMany({
            where: { releaseId: selector.releaseId },
            orderBy: [{ ordinal: 'asc' }, { entityId: 'asc' }],
          }),
          transaction.actkgProjectionNode.findMany({
            where: { releaseId: selector.releaseId },
            orderBy: [{ ordinal: 'asc' }, { nodeId: 'asc' }],
          }),
          transaction.actkgProjectionLink.findMany({
            where: { releaseId: selector.releaseId },
            orderBy: [{ ordinal: 'asc' }, { linkId: 'asc' }],
          }),
          transaction.actkgUpstreamRagReference.findMany({
            where: { releaseId: selector.releaseId },
            orderBy: [{ ordinal: 'asc' }, { publishedEntityId: 'asc' }],
          }),
          standard && transaction.actkgBundleReceipt.findFirst
            ? transaction.actkgBundleReceipt.findFirst({
                where: {
                  releaseId: selector.releaseId,
                  releaseSetId: selector.releaseSetId,
                  candidateState: ACCEPTED_CANDIDATE_STATE,
                },
                // Acceptance time (+ id) is the packaging-evidence order. Do not
                // rank by bundleRevision: distinct bundleIds may reset revision.
                orderBy: LATEST_ACCEPTED_BUNDLE_RECEIPT_ORDER_BY,
              })
            : Promise.resolve(null),
          standard
            ? transaction.actkgProjectionIdentity.findMany({
                where: { releaseId: selector.releaseId },
                orderBy: [{ ordinal: 'asc' }, { projectionId: 'asc' }],
              })
            : Promise.resolve([]),
          standard
            ? transaction.actkgProjectionLinkMetadata.findMany({
                where: { releaseId: selector.releaseId },
                orderBy: [{ ordinal: 'asc' }, { relationId: 'asc' }],
              })
            : Promise.resolve([]),
        ]);

        const typedBundleReceipt = bundleReceipt as AuthoritativeBundleReceiptRecord | null;
        const bundleArtifacts = typedBundleReceipt
          ? await transaction.actkgBundleArtifact.findMany({
              where: { bundleReceiptId: typedBundleReceipt.id },
              select: {
                bundleReceiptId: true,
                relativePath: true,
                ordinal: true,
                mediaType: true,
                sha256: true,
                byteLength: true,
                role: true,
                profile: true,
                contractVersion: true,
                required: true,
                recordCount: true,
              },
              orderBy: [{ ordinal: 'asc' }, { relativePath: 'asc' }],
            })
          : [];

        const snapshot: AuthoritativeKnowledgeSnapshot = {
          authorityState: 'candidate',
          productionAuthoritative: false,
          historical,
          releaseSet,
          release,
          receipt: receipt as AuthoritativeImportReceiptRecord | null,
          objects: [],
          relations: [],
          sourceMappings: [],
          sourceObjects: [],
          evidence: [],
          releaseArtifacts: byOrdinalAndId(
            releaseArtifacts as AuthoritativeReleaseArtifactRecord[],
            (row) => row.relativePath,
          ),
          releaseComponents: byOrdinalAndId(
            releaseComponents as AuthoritativeReleaseComponentRecord[],
            (row) => row.componentReleaseId,
          ),
          releaseEntries: byOrdinalAndId(
            releaseEntries as AuthoritativeReleaseEntryRecord[],
            (row) => row.entityId,
          ),
          projectionNodes: byOrdinalAndId(
            projectionNodes as AuthoritativeProjectionNodeRecord[],
            (row) => row.nodeId,
          ),
          projectionLinks: byOrdinalAndId(
            projectionLinks as AuthoritativeProjectionLinkRecord[],
            (row) => row.linkId,
          ),
          upstreamRagReferences: byOrdinalAndId(
            upstreamRagReferences as AuthoritativeUpstreamRagReferenceRecord[],
            (row) => `${row.publishedEntityId}${row.retrievalChunkId}${row.citationTargetId}`,
          ),
          ...(standard
            ? {
                bundleReceipt: typedBundleReceipt,
                bundleArtifacts: byOrdinalAndId(
                  bundleArtifacts as AuthoritativeBundleArtifactRecord[],
                  (row) => row.relativePath,
                ),
                projectionIdentities: byOrdinalAndId(
                  projectionIdentities as AuthoritativeProjectionIdentityRecord[],
                  (row) => row.projectionId,
                ),
                linkMetadata: byOrdinalAndId(
                  linkMetadata as AuthoritativeProjectionLinkMetadataRecord[],
                  (row) => row.relationId,
                ),
              }
            : {}),
        };
        const diagnostics = diagnoseSnapshot(snapshot);
        return diagnostics.length === 0
          ? { status: 'available', selector, snapshot, diagnostics: [] }
          : { status: 'drift', selector, snapshot, diagnostics };
      }

      const [
        receipt,
        objects,
        relations,
        sourceMappings,
        sourceObjects,
        evidence,
      ] = await Promise.all([
        transaction.actkgImportReceipt.findUnique({ where: { releaseId: selector.releaseId } }),
        transaction.actkgAuthoritativeObject.findMany({
          where: { releaseId: selector.releaseId },
          orderBy: [{ ordinal: 'asc' }, { canonicalId: 'asc' }],
        }),
        transaction.actkgAuthoritativeRelation.findMany({
          where: { releaseId: selector.releaseId },
          orderBy: [{ qualityTier: 'asc' }, { ordinal: 'asc' }, { relationId: 'asc' }],
        }),
        transaction.actkgSourceMapping.findMany({
          where: { releaseId: selector.releaseId },
          orderBy: [{ ordinal: 'asc' }, { mappingId: 'asc' }],
        }),
        transaction.actkgSourceObject.findMany({
          where: { releaseId: selector.releaseId },
          orderBy: [{ ordinal: 'asc' }, { sourceObjectId: 'asc' }],
        }),
        transaction.actkgEvidenceSegment.findMany({
          where: { releaseId: selector.releaseId },
          orderBy: [{ ordinal: 'asc' }, { evidenceId: 'asc' }],
        }),
      ]);

      const snapshot: AuthoritativeKnowledgeSnapshot = {
        authorityState: 'candidate',
        productionAuthoritative: false,
        historical,
        releaseSet,
        release,
        receipt: receipt as AuthoritativeImportReceiptRecord | null,
        objects: byOrdinalAndId(objects as AuthoritativeObjectRecord[], (row) => row.canonicalId),
        relations: byOrdinalAndId(relations as AuthoritativeRelationRecord[], (row) => (
          `${row.qualityTier}\u001f${row.relationId}`
        )),
        sourceMappings: byOrdinalAndId(
          sourceMappings as AuthoritativeSourceMappingRecord[],
          (row) => row.mappingId,
        ),
        sourceObjects: byOrdinalAndId(
          sourceObjects as AuthoritativeSourceObjectRecord[],
          (row) => row.sourceObjectId,
        ),
        evidence: byOrdinalAndId(evidence as AuthoritativeEvidenceRecord[], (row) => row.evidenceId),
      };
      const diagnostics = diagnoseSnapshot(snapshot);
      return diagnostics.length === 0
        ? { status: 'available', selector, snapshot, diagnostics: [] }
        : { status: 'drift', selector, snapshot, diagnostics };
    }, { isolationLevel: 'RepeatableRead' });
  }

  async readCourseCoverage(
    selector?: CourseCoverageSelector,
  ): Promise<CourseCoverageResult> {
    if (!selector) {
      return {
        status: 'unavailable',
        selector: null,
        reason: 'missing-selector',
        diagnostics: [],
        productionAuthoritative: false,
      };
    }

    // #1277: global CourseCoverage overlay is no longer a production runtime
    // selector after legacy retirement. Audit manifests remain readable via
    // the retained legacy-course-coverage-audit path.
    if (!isGlobalCourseCoverageRuntimeSelectorPermitted()) {
      return {
        status: 'unavailable',
        selector,
        reason: 'global-course-coverage-runtime-selector-retired',
        diagnostics: [],
        productionAuthoritative: false,
      };
    }

    return this.database.$transaction(async (transaction) => {
      const version = await transaction.courseCoverageOverlayVersion.findUnique({
        where: {
          overlayId_overlayVersion: {
            overlayId: selector.overlayId,
            overlayVersion: selector.overlayVersion,
          },
        },
      }) as (CourseCoverageAuditIdentity & {
        id: string;
        schemaVersion: string;
      }) | null;
      if (!version) {
        return {
          status: 'unavailable',
          selector,
          reason: 'coverage-not-found',
          diagnostics: [],
          productionAuthoritative: false,
        };
      }
      const [releaseSet, release, receipt, rawEntries] = await Promise.all([
        transaction.actkgReleaseSet.findUnique({ where: { id: version.releaseSetId } }),
        transaction.actkgRelease.findUnique({ where: { id: version.releaseId } }),
        transaction.courseCoverageImportReceipt.findUnique({
          where: { overlayVersionId: version.id },
        }),
        transaction.courseCoverageOverlayEntry.findMany({
          where: { overlayVersionId: version.id },
          orderBy: [{ ordinal: 'asc' }, { canonicalId: 'asc' }, { role: 'asc' }],
        }),
      ]);
      const entries = rawEntries as CourseCoverageRecord[];
      const coveredObjects = await transaction.actkgAuthoritativeObject.findMany({
        where: {
          releaseId: version.releaseId,
          canonicalId: { in: [...new Set(entries.map((entry) => entry.canonicalId))] },
        },
        orderBy: [{ ordinal: 'asc' }, { canonicalId: 'asc' }],
      }) as AuthoritativeObjectRecord[];
      const audit: CourseCoverageAuditIdentity = {
        courseId: version.courseId,
        overlayId: version.overlayId,
        overlayVersion: version.overlayVersion,
        overlayVersionId: version.id,
        authoringRevision: version.authoringRevision,
        captureRevision: version.captureRevision,
        sourceHash: version.sourceHash,
        releaseSetId: version.releaseSetId,
        releaseId: version.releaseId,
        releaseHash: version.releaseHash,
        lockRawHash: version.lockRawHash,
        productionAuthoritative: false,
      };
      const diagnostics: CourseCoverageDiagnostic[] = [];
      const compareCoverage = (
        code: CourseCoverageDiagnostic['code'],
        field: string,
        expected: string | number,
        actual: string | number | null,
      ): void => {
        if (expected !== actual) diagnostics.push({ code, field, expected, actual });
      };
      compareCoverage('selector-mismatch', 'courseId', selector.courseId, version.courseId);
      compareCoverage('selector-mismatch', 'overlayId', selector.overlayId, version.overlayId);
      compareCoverage('selector-mismatch', 'overlayVersion', selector.overlayVersion, version.overlayVersion);
      compareCoverage('selector-mismatch', 'releaseSetId', selector.releaseSetId, version.releaseSetId);
      compareCoverage('selector-mismatch', 'releaseId', selector.releaseId, version.releaseId);
      compareCoverage(
        'release-drift',
        'releaseSet.id',
        version.releaseSetId,
        (releaseSet as { id?: string } | null)?.id ?? null,
      );
      compareCoverage(
        'release-drift',
        'releaseSet.candidateState',
        'CANDIDATE',
        (releaseSet as { candidateState?: string } | null)?.candidateState ?? null,
      );
      compareCoverage(
        'release-drift',
        'release.releaseSetId',
        version.releaseSetId,
        (release as { releaseSetId?: string } | null)?.releaseSetId ?? null,
      );
      compareCoverage(
        'release-drift',
        'release.releaseHash',
        version.releaseHash,
        (release as { releaseHash?: string } | null)?.releaseHash ?? null,
      );
      compareCoverage(
        'release-drift',
        'release.lockRawHash',
        version.lockRawHash,
        (release as { lockRawHash?: string } | null)?.lockRawHash ?? null,
      );
      if (!receipt) {
        diagnostics.push({
          code: 'receipt-missing',
          field: 'receipt',
          expected: 'present',
          actual: null,
        });
      } else {
        const typedReceipt = receipt as {
          authoringRevision: string;
          captureRevision: string;
          sourceHash: string;
          releaseHash: string;
          lockRawHash: string;
          entryCount: number;
        };
        compareCoverage(
          'receipt-identity-mismatch',
          'receipt.authoringRevision',
          version.authoringRevision,
          typedReceipt.authoringRevision,
        );
        compareCoverage(
          'receipt-identity-mismatch',
          'receipt.sourceHash',
          version.sourceHash,
          typedReceipt.sourceHash,
        );
        compareCoverage(
          'receipt-identity-mismatch',
          'receipt.captureRevision',
          version.captureRevision,
          typedReceipt.captureRevision,
        );
        compareCoverage(
          'receipt-identity-mismatch',
          'receipt.releaseHash',
          version.releaseHash,
          typedReceipt.releaseHash,
        );
        compareCoverage(
          'receipt-identity-mismatch',
          'receipt.lockRawHash',
          version.lockRawHash,
          typedReceipt.lockRawHash,
        );
        compareCoverage(
          'receipt-count-mismatch',
          'receipt.entryCount',
          entries.length,
          typedReceipt.entryCount,
        );
      }
      compareCoverage(
        'covered-object-missing',
        'coveredObjectCount',
        new Set(entries.map((entry) => entry.canonicalId)).size,
        coveredObjects.length,
      );
      const allowedRoles = new Set<CourseCoverageRole>([
        'formal_objective',
        'necessary_prerequisite',
        'explicit_extension',
      ]);
      entries.forEach((entry) => {
        if (!allowedRoles.has(entry.role)) {
          diagnostics.push({
            code: 'unsupported-role',
            field: `entry.${entry.canonicalId}.role`,
            expected: 'registered CourseCoverageRole',
            actual: entry.role,
          });
        }
      });
      return diagnostics.length === 0
        ? {
            status: 'available',
            selector,
            audit,
            entries,
            diagnostics: [],
            productionAuthoritative: false,
          }
        : {
            status: 'drift',
            selector,
            audit,
            entries,
            diagnostics,
            productionAuthoritative: false,
          };
    }, { isolationLevel: 'RepeatableRead' });
  }
}
