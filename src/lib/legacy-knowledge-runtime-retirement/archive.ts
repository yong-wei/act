/**
 * Digest-verified archive of legacy audit, crosswalk, snapshots, and rollback
 * artifacts (#1277 task 2.1). Does not delete historical evidence.
 */

import {
  LEGACY_AUDIT_EXPECTED_COUNTS,
  LEGACY_COURSE_COVERAGE_AUDIT_MANIFEST_DIGEST,
  readLegacyCourseCoverageAudit,
} from '@/lib/aggregate-governance/legacy-course-coverage-audit';

import {
  LEGACY_RETIREMENT_ARCHIVE_CONTRACT,
  LEGACY_RETIREMENT_BUILDER_VERSION,
  LegacyRetirementGateError,
  RETAINED_HISTORICAL_ARTIFACTS,
  type RetirementArchive,
  type RetirementArchiveEntry,
  type RetainedHistoricalArtifact,
} from './contracts';
import { isSha256Hex, retirementDigest, retirementSha256 } from './hash';

export interface ArchiveArtifactInput {
  artifactId: RetainedHistoricalArtifact | string;
  path?: string | null;
  /** Raw bytes or canonical string of the archived content. */
  content: string | Buffer;
}

/**
 * Validate the frozen 34-batch / 4,891-member legacy audit manifest and return
 * its published digest. Tamper → fail closed.
 */
export function archiveLegacyAuditManifest(manifest: unknown): {
  digest: string;
  batches: number;
  members: number;
} {
  const provenance = readLegacyCourseCoverageAudit(manifest);
  if (provenance.manifestDigest !== LEGACY_COURSE_COVERAGE_AUDIT_MANIFEST_DIGEST) {
    throw new LegacyRetirementGateError(
      'legacy-audit-digest-mismatch',
      'archived legacy audit digest does not match frozen published digest',
      [
        `expected:${LEGACY_COURSE_COVERAGE_AUDIT_MANIFEST_DIGEST}`,
        `actual:${provenance.manifestDigest}`,
      ],
    );
  }
  if (
    provenance.counts.batches !== LEGACY_AUDIT_EXPECTED_COUNTS.batches
    || provenance.counts.members !== LEGACY_AUDIT_EXPECTED_COUNTS.members
  ) {
    throw new LegacyRetirementGateError(
      'legacy-audit-counts-drift',
      'archived legacy audit counts drifted from 34 batches / 4891 members',
      [
        `batches:${provenance.counts.batches}`,
        `members:${provenance.counts.members}`,
      ],
    );
  }
  return {
    digest: provenance.manifestDigest,
    batches: provenance.counts.batches,
    members: provenance.counts.members,
  };
}

/**
 * Build an immutable retirement archive with digests for every retained
 * historical artifact. Missing required artifacts fail closed.
 */
export function buildRetirementArchive(input: {
  captureRevision?: string | null;
  legacyAuditManifestDigest: string;
  artifacts: readonly ArchiveArtifactInput[];
}): RetirementArchive {
  if (!isSha256Hex(input.legacyAuditManifestDigest)) {
    throw new LegacyRetirementGateError(
      'invalid-legacy-audit-digest',
      'legacyAuditManifestDigest must be sha256 hex',
    );
  }
  if (
    input.legacyAuditManifestDigest
    !== LEGACY_COURSE_COVERAGE_AUDIT_MANIFEST_DIGEST
  ) {
    throw new LegacyRetirementGateError(
      'legacy-audit-digest-not-frozen',
      'legacyAuditManifestDigest must equal the frozen published digest',
      [
        `expected:${LEGACY_COURSE_COVERAGE_AUDIT_MANIFEST_DIGEST}`,
        `actual:${input.legacyAuditManifestDigest}`,
      ],
    );
  }

  const entries: RetirementArchiveEntry[] = input.artifacts.map((artifact) => ({
    artifactId: artifact.artifactId,
    path: artifact.path ?? null,
    contentDigest: retirementSha256(artifact.content),
    immutable: true as const,
  }));

  entries.sort((a, b) =>
    a.artifactId < b.artifactId ? -1 : a.artifactId > b.artifactId ? 1 : 0,
  );

  const present = new Set(entries.map((e) => e.artifactId));
  const missing = RETAINED_HISTORICAL_ARTIFACTS.filter((id) => !present.has(id));
  if (missing.length > 0) {
    throw new LegacyRetirementGateError(
      'retirement-archive-incomplete',
      `retirement archive missing retained artifacts: ${missing.join(', ')}`,
      missing.map((id) => `missing-artifact:${id}`),
    );
  }

  const body = {
    contract: LEGACY_RETIREMENT_ARCHIVE_CONTRACT,
    builderVersion: LEGACY_RETIREMENT_BUILDER_VERSION,
    captureRevision: input.captureRevision ?? null,
    legacyAuditManifestDigest: input.legacyAuditManifestDigest,
    entries,
  };

  return {
    ...body,
    archiveDigest: retirementDigest(body),
  };
}

/**
 * Verify archive digests still match (tamper detection before removal).
 */
export function verifyRetirementArchive(
  archive: RetirementArchive,
  artifacts: readonly ArchiveArtifactInput[],
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const byId = new Map(
    artifacts.map((a) => [a.artifactId, retirementSha256(a.content)]),
  );

  for (const entry of archive.entries) {
    const actual = byId.get(entry.artifactId);
    if (!actual) {
      reasons.push(`archive-entry-missing:${entry.artifactId}`);
      continue;
    }
    if (actual !== entry.contentDigest) {
      reasons.push(`archive-entry-tamper:${entry.artifactId}`);
    }
  }

  const expected = retirementDigest({
    contract: archive.contract,
    builderVersion: archive.builderVersion,
    captureRevision: archive.captureRevision,
    legacyAuditManifestDigest: archive.legacyAuditManifestDigest,
    entries: archive.entries,
  });
  if (expected !== archive.archiveDigest) {
    reasons.push('archive-digest-tamper');
  }

  return { ok: reasons.length === 0, reasons };
}

export function assertRetirementArchiveIntact(
  archive: RetirementArchive,
  artifacts: readonly ArchiveArtifactInput[],
): void {
  const result = verifyRetirementArchive(archive, artifacts);
  if (!result.ok) {
    throw new LegacyRetirementGateError(
      'retirement-archive-tamper',
      'archived rollback/history bytes or digests differ from retirement archive',
      result.reasons,
    );
  }
}
