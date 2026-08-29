/**
 * Digest-verified rollback archive for exact pre-delete bytes (#1592).
 */

import {
  RESOURCE_GOVERNANCE_RETIREMENT_ARCHIVE_CONTRACT,
  ResourceGovernanceRetirementGateError,
  type ResourceGovernanceRollbackArchive,
  type RollbackArchiveEntry,
} from './contracts';
import { isGitRevision, isSha256Hex, retirementDigest, retirementSha256 } from './hash';

export function buildRollbackArchive(input: {
  captureRevision: string;
  files: Readonly<Record<string, string>>;
  candidateIdsByPath?: Readonly<Record<string, string>>;
}): ResourceGovernanceRollbackArchive {
  if (!isGitRevision(input.captureRevision)) {
    throw new ResourceGovernanceRetirementGateError(
      'archive-revision-invalid',
      'rollback archive captureRevision must be a 40-char git sha',
    );
  }
  const entries: RollbackArchiveEntry[] = Object.keys(input.files)
    .sort()
    .map((path) => ({
      candidateId: input.candidateIdsByPath?.[path] ?? path,
      path,
      contentDigest: retirementSha256(input.files[path]!),
      immutable: true as const,
    }));
  const body = {
    contract: RESOURCE_GOVERNANCE_RETIREMENT_ARCHIVE_CONTRACT,
    captureRevision: input.captureRevision,
    entries,
  };
  return {
    ...body,
    archiveDigest: retirementDigest(body),
  };
}

export function verifyRollbackArchive(
  archive: ResourceGovernanceRollbackArchive,
  files: Readonly<Record<string, string>>,
): string[] {
  const reasons: string[] = [];
  const expected = retirementDigest({
    contract: archive.contract,
    captureRevision: archive.captureRevision,
    entries: archive.entries,
  });
  if (archive.archiveDigest !== expected) {
    reasons.push('archive-digest-tamper');
  }
  if (!isGitRevision(archive.captureRevision)) {
    reasons.push('archive-revision-invalid');
  }
  for (const entry of archive.entries) {
    if (entry.immutable !== true) {
      reasons.push(`archive-entry-not-immutable:${entry.path}`);
    }
    if (!isSha256Hex(entry.contentDigest)) {
      reasons.push(`archive-entry-digest-invalid:${entry.path}`);
    }
    const bytes = files[entry.path];
    if (bytes === undefined) {
      reasons.push(`archive-bytes-missing:${entry.path}`);
      continue;
    }
    if (retirementSha256(bytes) !== entry.contentDigest) {
      reasons.push(`archive-bytes-tamper:${entry.path}`);
    }
  }
  return reasons;
}

export function archiveCoverageReasons(
  archive: ResourceGovernanceRollbackArchive,
  archiveBytes: Readonly<Record<string, string>>,
  authorizedCandidates: readonly { id: string; sourcePath: string }[],
): string[] {
  const reasons: string[] = [];
  const entriesByPath = new Map(
    archive.entries.map((entry) => [entry.path.replace(/\\/gu, '/'), entry]),
  );
  for (const candidate of authorizedCandidates) {
    const sourcePath = candidate.sourcePath.replace(/\\/gu, '/');
    const entry = entriesByPath.get(sourcePath);
    if (!entry) {
      reasons.push(`rollback-missing-entry:${candidate.id}`);
      continue;
    }
    if (entry.candidateId !== candidate.id) {
      reasons.push(`rollback-entry-id-mismatch:${candidate.id}`);
    }
    const bytes = archiveBytes[sourcePath];
    if (bytes === undefined || bytes.length === 0) {
      reasons.push(`rollback-missing-bytes:${candidate.id}`);
      continue;
    }
    if (retirementSha256(bytes) !== entry.contentDigest) {
      reasons.push(`rollback-bytes-tamper:${candidate.id}`);
    }
  }
  return reasons;
}

export function restoreRollbackArchive(input: {
  archive: ResourceGovernanceRollbackArchive;
  files: Readonly<Record<string, string>>;
  writeFile: (path: string, content: string) => void;
  onlyPaths?: readonly string[];
}): { restored: readonly string[]; reasons: readonly string[] } {
  const reasons = verifyRollbackArchive(input.archive, input.files);
  if (reasons.length > 0) {
    throw new ResourceGovernanceRetirementGateError(
      'rollback-archive-invalid',
      'rollback restore refused until the archive digest matches exact bytes',
      reasons,
    );
  }
  const requested = input.onlyPaths === undefined
    ? input.archive.entries.map((entry) => entry.path)
    : [...new Set(input.onlyPaths.map((path) => path.replace(/\\/gu, '/')))];
  const archived = new Map(
    input.archive.entries.map((entry) => [entry.path.replace(/\\/gu, '/'), entry.path]),
  );
  const restored: string[] = [];
  for (const path of requested) {
    const archivedPath = archived.get(path);
    if (archivedPath === undefined) {
      throw new ResourceGovernanceRetirementGateError(
        'rollback-path-not-archived',
        `rollback path is not in the digest-verified archive: ${path}`,
        [`rollback-path-not-archived:${path}`],
      );
    }
    input.writeFile(archivedPath, input.files[archivedPath]!);
    restored.push(archivedPath);
  }
  return { restored, reasons: [] };
}
