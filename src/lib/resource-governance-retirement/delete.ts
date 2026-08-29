/**
 * Exact-path deletion command for resource-governance retirement (#1592).
 *
 * Deletes only listed source entrypoints after the gate passes. Directory or
 * glob targets, unknown callers, and post-scan races fail closed.
 */

import {
  RESOURCE_GOVERNANCE_RETIREMENT_DELETION_RECEIPT_CONTRACT,
  ResourceGovernanceRetirementGateError,
  type DeletionReceipt,
  type ResourceGovernanceGraph,
  type ResourceGovernanceRetirementManifest,
} from './contracts';
import { looksLikeDirectoryOrGlob, scanCandidateCallers } from './scan';
import { retirementDigest } from './hash';
import { assertManifestReadyForDeletion } from './manifest';
import { verifyResourceGovernanceRetirement } from './verify';
import { restoreRollbackArchive } from './archive';

export interface RetirementFileSystem {
  exists(path: string): boolean;
  isDirectory(path: string): boolean;
  read(path: string): string;
  unlink(path: string): void;
  write(path: string, content: string): void;
}

export function deleteRetiredResourceGovernanceEntrypoints(input: {
  receiptId: string;
  manifest: ResourceGovernanceRetirementManifest;
  graph: ResourceGovernanceGraph;
  listedPaths: readonly string[];
  fs: RetirementFileSystem;
  deletedAt: string;
}): DeletionReceipt {
  const blocked = (reasons: readonly string[]): DeletionReceipt => {
    const body = {
      contract: RESOURCE_GOVERNANCE_RETIREMENT_DELETION_RECEIPT_CONTRACT,
      receiptId: input.receiptId,
      retirementId: input.manifest.retirementId,
      manifestDigest: input.manifest.manifestDigest,
      deletedPaths: [] as string[],
      deletedAt: input.deletedAt,
      postDeleteZeroCaller: false,
      postDeleteImportBuild: false,
      status: 'blocked' as const,
      reasons: [...reasons],
    };
    return { ...body, receiptDigest: retirementDigest(body) };
  };

  try {
    assertManifestReadyForDeletion(input.manifest);
  } catch (error) {
    const reasons = error instanceof ResourceGovernanceRetirementGateError
      ? error.reasons.length > 0
        ? error.reasons
        : [error.code]
      : [error instanceof Error ? error.message : 'gate-failed'];
    return blocked(reasons);
  }

  const verdict = verifyResourceGovernanceRetirement(input.manifest, input.graph);
  if (verdict.status !== 'ready-for-deletion') {
    return blocked([
      `verdict-not-ready:${verdict.status}`,
      ...verdict.reasons,
    ]);
  }

  const authorizedPaths = new Set(
    input.graph.candidates
      .filter((candidate) => verdict.deletionsAuthorized.includes(candidate.id))
      .map((candidate) => candidate.sourcePath.replace(/\\/gu, '/')),
  );

  for (const listed of input.listedPaths) {
    if (looksLikeDirectoryOrGlob(listed) || input.fs.isDirectory(listed)) {
      return blocked([`directory-or-glob-deletion:${listed}`]);
    }
    const normalized = listed.replace(/\\/gu, '/');
    if (!authorizedPaths.has(normalized)) {
      return blocked([`unlisted-or-unauthorized-path:${normalized}`]);
    }
    if (!input.fs.exists(normalized)) {
      return blocked([`entrypoint-missing:${normalized}`]);
    }
  }

  for (const candidate of input.graph.candidates) {
    if (!verdict.deletionsAuthorized.includes(candidate.id)) continue;
    const liveHits = scanCandidateCallers({
      candidate,
      files: input.graph.files,
      excludedFrameworkFiles: input.graph.excludedFrameworkFiles,
    });
    if (liveHits.length > 0) {
      return blocked([`zero-caller-race:${candidate.id}`]);
    }
  }

  const deletedPaths: string[] = [];
  for (const listed of input.listedPaths) {
    const normalized = listed.replace(/\\/gu, '/');
    input.fs.unlink(normalized);
    deletedPaths.push(normalized);
  }

  const remainingFiles = input.graph.files.filter(
    (file) => !deletedPaths.includes(file.path.replace(/\\/gu, '/')),
  );
  let postDeleteZeroCaller = true;
  for (const candidate of input.graph.candidates) {
    if (!verdict.deletionsAuthorized.includes(candidate.id)) continue;
    const hits = scanCandidateCallers({
      candidate: { ...candidate, sourcePath: candidate.sourcePath },
      files: remainingFiles,
      excludedFrameworkFiles: input.graph.excludedFrameworkFiles,
    });
    if (hits.length > 0) {
      postDeleteZeroCaller = false;
    }
  }

  const remainingImportsDeletedPath = remainingFiles.some((file) =>
    deletedPaths.some((deleted) => file.content.includes(deleted)),
  );
  const postDeleteImportBuild = !remainingImportsDeletedPath && postDeleteZeroCaller;

  const body = {
    contract: RESOURCE_GOVERNANCE_RETIREMENT_DELETION_RECEIPT_CONTRACT,
    receiptId: input.receiptId,
    retirementId: input.manifest.retirementId,
    manifestDigest: input.manifest.manifestDigest,
    deletedPaths,
    deletedAt: input.deletedAt,
    postDeleteZeroCaller,
    postDeleteImportBuild,
    status: 'deleted' as const,
    reasons: [] as string[],
  };
  return { ...body, receiptDigest: retirementDigest(body) };
}

export function rollbackRetiredEntrypoints(input: {
  graph: ResourceGovernanceGraph;
  fs: RetirementFileSystem;
}): { restored: readonly string[] } {
  return restoreRollbackArchive({
    archive: input.graph.rollbackArchive,
    files: input.graph.archiveBytes,
    writeFile: input.fs.write,
  });
}
