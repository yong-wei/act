/**
 * Exact-path deletion command for resource-governance retirement (#1592).
 *
 * Deletes only listed source entrypoints after the gate passes. Directory or
 * glob targets, unknown callers, and post-scan races fail closed.
 *
 * Production callers must pass `captureRetirementWorktree(repoRoot)` from
 * `./repo-scan` so HEAD, dirty paths, file digests, and callers are recaptured
 * from the live worktree immediately before unlink. `postDeleteImportBuild` is
 * bound only to injected import/build and test command results, never to a
 * remaining-file string scan.
 */

import {
  RESOURCE_GOVERNANCE_RETIREMENT_DELETION_RECEIPT_CONTRACT,
  ResourceGovernanceRetirementGateError,
  type DeletionReceipt,
  type ResourceGovernanceGraph,
  type ResourceGovernanceRetirementManifest,
} from './contracts';
import { looksLikeDirectoryOrGlob, scanCandidateCallers, fileDigest } from './scan';
import { retirementDigest } from './hash';
import { assertManifestReadyForDeletion } from './manifest';
import { verifyResourceGovernanceRetirement } from './verify';
import { restoreRollbackArchive } from './archive';
import type { GraphFile } from './contracts';

export interface RetirementFileSystem {
  exists(path: string): boolean;
  isDirectory(path: string): boolean;
  read(path: string): string;
  unlink(path: string): void;
  write(path: string, content: string): void;
}

export interface RetirementWorktreeSnapshot {
  headRevision: string;
  dirtyPaths: readonly string[];
  files: readonly GraphFile[];
}

export interface PostDeleteCommandResult {
  ok: boolean;
  command: string;
}

export interface PostDeleteVerification {
  runImportBuild(): PostDeleteCommandResult;
  runTests(): PostDeleteCommandResult;
}

export function deleteRetiredResourceGovernanceEntrypoints(input: {
  receiptId: string;
  manifest: ResourceGovernanceRetirementManifest;
  graph: ResourceGovernanceGraph;
  listedPaths: readonly string[];
  fs: RetirementFileSystem;
  captureWorktree: () => RetirementWorktreeSnapshot;
  postDeleteVerification: PostDeleteVerification;
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

  let worktree: RetirementWorktreeSnapshot;
  try {
    worktree = input.captureWorktree();
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown';
    return blocked([`worktree-capture-failed:${detail}`]);
  }
  if (worktree.headRevision !== input.graph.headRevision) {
    return blocked(['worktree-head-mismatch']);
  }
  if (worktree.headRevision !== input.graph.captureRevision) {
    return blocked(['worktree-mixed-revision']);
  }
  if (worktree.dirtyPaths.length > 0) {
    return blocked([`worktree-dirty:${worktree.dirtyPaths[0]}`]);
  }

  for (const candidate of input.graph.candidates) {
    if (!verdict.deletionsAuthorized.includes(candidate.id)) continue;
    const sourcePath = candidate.sourcePath.replace(/\\/gu, '/');
    const liveFile = worktree.files.find((file) => file.path.replace(/\\/gu, '/') === sourcePath);
    if (!liveFile) {
      return blocked([`worktree-candidate-missing:${candidate.id}`]);
    }
    const liveDigest = fileDigest(liveFile.content);
    if (liveFile.digest !== liveDigest) {
      return blocked([`worktree-file-digest-mismatch:${candidate.id}`]);
    }
    const archived = input.graph.archiveBytes[sourcePath];
    if (archived === undefined || liveDigest !== fileDigest(archived)) {
      return blocked([`worktree-candidate-digest-drift:${candidate.id}`]);
    }
    const liveHits = scanCandidateCallers({
      candidate,
      files: worktree.files,
      excludedFrameworkFiles: input.graph.excludedFrameworkFiles,
    });
    if (liveHits.length > 0) {
      return blocked([`zero-caller-race:${candidate.id}`]);
    }
  }

  const deletedPaths: string[] = [];
  const restoreDeleted = (): void => {
    for (const path of deletedPaths) {
      const archived = input.graph.archiveBytes[path];
      if (archived !== undefined) {
        input.fs.write(path, archived);
      }
    }
  };

  for (const listed of input.listedPaths) {
    const normalized = listed.replace(/\\/gu, '/');
    input.fs.unlink(normalized);
    deletedPaths.push(normalized);
  }

  const remainingFiles = worktree.files.filter(
    (file) => !deletedPaths.includes(file.path.replace(/\\/gu, '/')),
  );
  for (const candidate of input.graph.candidates) {
    if (!verdict.deletionsAuthorized.includes(candidate.id)) continue;
    const hits = scanCandidateCallers({
      candidate,
      files: remainingFiles,
      excludedFrameworkFiles: input.graph.excludedFrameworkFiles,
    });
    if (hits.length > 0) {
      restoreDeleted();
      return blocked([`post-delete-zero-caller-failed:${candidate.id}`]);
    }
  }

  const importBuild = input.postDeleteVerification.runImportBuild();
  const tests = input.postDeleteVerification.runTests();
  if (!importBuild.command) {
    restoreDeleted();
    return blocked(['post-delete-import-build-command-missing']);
  }
  if (!importBuild.ok) {
    restoreDeleted();
    return blocked([`post-delete-import-build-failed:${importBuild.command}`]);
  }
  if (!tests.command) {
    restoreDeleted();
    return blocked(['post-delete-tests-command-missing']);
  }
  if (!tests.ok) {
    restoreDeleted();
    return blocked([`post-delete-tests-failed:${tests.command}`]);
  }

  const body = {
    contract: RESOURCE_GOVERNANCE_RETIREMENT_DELETION_RECEIPT_CONTRACT,
    receiptId: input.receiptId,
    retirementId: input.manifest.retirementId,
    manifestDigest: input.manifest.manifestDigest,
    deletedPaths,
    deletedAt: input.deletedAt,
    postDeleteZeroCaller: true,
    postDeleteImportBuild: true,
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
