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

/**
 * Type-aware validation of archived artifact bytes. Placeholder
 * `{"artifactId":...,"retained":true}` documents fail closed.
 */
export function verifyArchiveArtifactContents(
  artifacts: readonly ArchiveArtifactInput[],
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const byId = new Map(artifacts.map((a) => [a.artifactId, a]));

  for (const required of RETAINED_HISTORICAL_ARTIFACTS) {
    if (!byId.has(required)) {
      reasons.push(`archive-content-missing:${required}`);
    }
  }

  for (const artifact of artifacts) {
    const text =
      typeof artifact.content === 'string'
        ? artifact.content
        : artifact.content.toString('utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      reasons.push(`archive-content-not-json:${artifact.artifactId}`);
      continue;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      reasons.push(`archive-content-not-object:${artifact.artifactId}`);
      continue;
    }
    const record = parsed as Record<string, unknown>;

    // Reject the trivial placeholder used only as a negative test fixture shape.
    if (
      record.retained === true
      && record.artifactId === artifact.artifactId
      && Object.keys(record).length <= 2
    ) {
      reasons.push(`archive-content-placeholder:${artifact.artifactId}`);
      continue;
    }

    switch (artifact.artifactId) {
      case 'legacy-course-coverage-audit-manifest': {
        try {
          const result = archiveLegacyAuditManifest(parsed);
          if (result.digest !== LEGACY_COURSE_COVERAGE_AUDIT_MANIFEST_DIGEST) {
            reasons.push('archive-content-audit-digest-mismatch');
          }
        } catch (error) {
          reasons.push(
            error instanceof Error
              ? `archive-content-audit:${error.message}`
              : 'archive-content-audit-failed',
          );
        }
        break;
      }
      case 'old-to-canonical-crosswalk': {
        if (
          typeof record.contract !== 'string'
          || !record.contract.includes('crosswalk')
        ) {
          reasons.push('archive-content-crosswalk-contract-missing');
        }
        if (!Array.isArray(record.entries) || record.entries.length === 0) {
          reasons.push('archive-content-crosswalk-entries-missing');
          break;
        }
        for (const [index, raw] of record.entries.entries()) {
          if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            reasons.push(`archive-content-crosswalk-entry-invalid:${index}`);
            continue;
          }
          const entry = raw as Record<string, unknown>;
          if (
            typeof entry.legacyId !== 'string'
            || entry.legacyId.trim().length === 0
          ) {
            reasons.push(`archive-content-crosswalk-legacyId-missing:${index}`);
          }
          if (
            typeof entry.canonicalId !== 'string'
            || entry.canonicalId.trim().length === 0
            || entry.canonicalId.includes(' ')
          ) {
            reasons.push(
              `archive-content-crosswalk-canonicalId-missing:${index}`,
            );
          }
        }
        break;
      }
      case 'historical-authority-projection-snapshots': {
        if (!Array.isArray(record.snapshots) || record.snapshots.length === 0) {
          reasons.push('archive-content-snapshots-missing');
          break;
        }
        const normalized: Array<Record<string, string>> = [];
        for (const [index, raw] of record.snapshots.entries()) {
          if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            reasons.push(`archive-content-snapshot-invalid:${index}`);
            continue;
          }
          const snap = raw as Record<string, unknown>;
          const snapshotId =
            typeof snap.snapshotId === 'string' ? snap.snapshotId.trim() : '';
          const projectionId =
            typeof snap.projectionId === 'string' ? snap.projectionId.trim() : '';
          const digest =
            typeof snap.digest === 'string' ? snap.digest.trim() : '';
          if (!snapshotId) {
            reasons.push(`archive-content-snapshotId-missing:${index}`);
          }
          if (!projectionId) {
            reasons.push(`archive-content-projectionId-missing:${index}`);
          }
          if (!isSha256Hex(digest)) {
            reasons.push(`archive-content-snapshot-digest-invalid:${index}`);
          }
          normalized.push({ snapshotId, projectionId, digest });
        }
        const expectedSetDigest = retirementDigest({ snapshots: normalized });
        if (record.snapshotSetDigest !== expectedSetDigest) {
          reasons.push('archive-content-snapshots-digest-mismatch');
        }
        break;
      }
      case 'learning-fact-revision-metadata': {
        if (!Array.isArray(record.revisions) || record.revisions.length === 0) {
          reasons.push('archive-content-revisions-missing');
          break;
        }
        for (const [index, raw] of record.revisions.entries()) {
          if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            reasons.push(`archive-content-revision-invalid:${index}`);
            continue;
          }
          const rev = raw as Record<string, unknown>;
          if (
            typeof rev.knowledgeRevisionRef !== 'string'
            || rev.knowledgeRevisionRef.trim().length === 0
          ) {
            reasons.push(
              `archive-content-revision-ref-missing:${index}`,
            );
          }
          if (
            rev.identityNamespace !== 'LEGACY'
            && rev.identityNamespace !== 'LEGACY_UNVERSIONED'
            && rev.identityNamespace !== 'CANONICAL'
          ) {
            reasons.push(
              `archive-content-revision-namespace-invalid:${index}`,
            );
          }
        }
        break;
      }
      case 'digest-verified-rollback-archive': {
        if (!Array.isArray(record.targets) || record.targets.length === 0) {
          reasons.push('archive-content-rollback-targets-missing');
          break;
        }
        const targets: Array<Record<string, string>> = [];
        for (const [index, raw] of record.targets.entries()) {
          if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            reasons.push(`archive-content-rollback-target-invalid:${index}`);
            continue;
          }
          const target = raw as Record<string, unknown>;
          const activationId =
            typeof target.activationId === 'string'
              ? target.activationId.trim()
              : '';
          const activationHash =
            typeof target.activationHash === 'string'
              ? target.activationHash.trim()
              : '';
          if (!activationId) {
            reasons.push(
              `archive-content-rollback-activationId-missing:${index}`,
            );
          }
          if (!isSha256Hex(activationHash)) {
            reasons.push(
              `archive-content-rollback-activationHash-invalid:${index}`,
            );
          }
          targets.push({ activationId, activationHash });
        }
        const expectedRollbackDigest = retirementDigest({ targets });
        if (record.rollbackArchiveDigest !== expectedRollbackDigest) {
          reasons.push('archive-content-rollback-digest-mismatch');
        }
        break;
      }
      case 'historical-learning-fact-crosswalk-adapter': {
        if (record.adapter !== 'historical-learning-fact-crosswalk') {
          reasons.push('archive-content-adapter-id-missing');
        }
        if (record.mutatesFacts !== false) {
          reasons.push('archive-content-adapter-mutatesFacts-not-false');
        }
        if (record.createsActiveSelector !== false) {
          reasons.push(
            'archive-content-adapter-createsActiveSelector-not-false',
          );
        }
        break;
      }
      default:
        // Unknown retained ids still need non-placeholder JSON.
        break;
    }
  }

  return { ok: reasons.length === 0, reasons };
}
