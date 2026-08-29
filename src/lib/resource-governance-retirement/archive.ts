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

export function restoreRollbackArchive(input: {
  archive: ResourceGovernanceRollbackArchive;
  files: Readonly<Record<string, string>>;
  writeFile: (path: string, content: string) => void;
}): { restored: readonly string[]; reasons: readonly string[] } {
  const reasons = verifyRollbackArchive(input.archive, input.files);
  if (reasons.length > 0) {
    throw new ResourceGovernanceRetirementGateError(
      'rollback-archive-invalid',
      'rollback restore refused until the archive digest matches exact bytes',
      reasons,
    );
  }
  const restored: string[] = [];
  for (const entry of input.archive.entries) {
    input.writeFile(entry.path, input.files[entry.path]!);
    restored.push(entry.path);
  }
  return { restored, reasons: [] };
}
