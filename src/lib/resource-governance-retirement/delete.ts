/**
 * Exact-path deletion command for resource-governance retirement (#1592).
 *
 * Deletes only listed source entrypoints after the gate passes. Directory or
 * glob targets, unknown callers, and post-scan races fail closed.
 *
 * Production callers must use `deleteRetiredResourceGovernanceEntrypointsFromRepo`
 * in `./repo-scan`, which binds `captureRetirementWorktree` and a required
 * `holdRetirementWorktreeLock`. The lock covers the final recapture through
 * digest-checked unlink. Tests may inject a lock, but omitting it fails closed.
 * `postDeleteImportBuild` is bound only to injected import/build and test
 * command results.
 */

import {
  RESOURCE_GOVERNANCE_RETIREMENT_DELETION_RECEIPT_CONTRACT,
  ResourceGovernanceRetirementGateError,
  type DeletionReceipt,
  type ResourceGovernanceDeprecationLedger,
  type ResourceGovernanceGraph,
  type ResourceGovernanceRetirementManifest,
} from './contracts';
import { looksLikeDirectoryOrGlob, scanCandidateCallers, fileDigest } from './scan';
import { retirementDigest } from './hash';
import { compareLedgers, reduceLedgerAfterDeletion } from './ledger';
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

export interface RetirementWorktreeLock {
  release(): void;
}

function worktreeDeletionReasons(input: {
  worktree: RetirementWorktreeSnapshot;
  graph: ResourceGovernanceGraph;
  authorizedIds: readonly string[];
}): string[] {
  const reasons: string[] = [];
  if (input.worktree.headRevision !== input.graph.headRevision) {
    reasons.push('worktree-head-mismatch');
  }
  if (input.worktree.headRevision !== input.graph.captureRevision) {
    reasons.push('worktree-mixed-revision');
  }
  if (input.worktree.dirtyPaths.length > 0) {
    reasons.push(`worktree-dirty:${input.worktree.dirtyPaths[0]}`);
  }
  for (const candidate of input.graph.candidates) {
    if (!input.authorizedIds.includes(candidate.id)) continue;
    const sourcePath = candidate.sourcePath.replace(/\\/gu, '/');
    const liveFile = input.worktree.files.find((file) => file.path.replace(/\\/gu, '/') === sourcePath);
    if (!liveFile) {
      reasons.push(`worktree-candidate-missing:${candidate.id}`);
      continue;
    }
    const liveDigest = fileDigest(liveFile.content);
    if (liveFile.digest !== liveDigest) {
      reasons.push(`worktree-file-digest-mismatch:${candidate.id}`);
    }
    const archived = input.graph.archiveBytes[sourcePath];
    if (archived === undefined || liveDigest !== fileDigest(archived)) {
      reasons.push(`worktree-candidate-digest-drift:${candidate.id}`);
    }
    const liveHits = scanCandidateCallers({
      candidate,
      files: input.worktree.files,
      excludedFrameworkFiles: input.graph.excludedFrameworkFiles,
    });
    if (liveHits.length > 0) {
      reasons.push(`zero-caller-race:${candidate.id}`);
    }
  }
  return reasons;
}

export interface DeleteRetiredEntrypointsInput {
  receiptId: string;
  manifest: ResourceGovernanceRetirementManifest;
  graph: ResourceGovernanceGraph;
  listedPaths: readonly string[];
  fs: RetirementFileSystem;
  captureWorktree: () => RetirementWorktreeSnapshot;
  holdWorktreeLock: () => RetirementWorktreeLock;
  postDeleteVerification: PostDeleteVerification;
  deletedAt: string;
}

export function deleteRetiredResourceGovernanceEntrypoints(
  input: DeleteRetiredEntrypointsInput,
): DeletionReceipt {
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
      reducedLedger: null,
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

  if (input.listedPaths.length === 0) {
    return blocked(['listed-paths-empty']);
  }

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

  const readWorktree = (): RetirementWorktreeSnapshot | DeletionReceipt => {
    try {
      return input.captureWorktree();
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'unknown';
      return blocked([`worktree-capture-failed:${detail}`]);
    }
  };

  const firstCapture = readWorktree();
  if ('status' in firstCapture && firstCapture.status === 'blocked') {
    return firstCapture;
  }
  const worktree = firstCapture as RetirementWorktreeSnapshot;
  const firstReasons = worktreeDeletionReasons({
    worktree,
    graph: input.graph,
    authorizedIds: verdict.deletionsAuthorized,
  });
  if (firstReasons.length > 0) {
    return blocked(firstReasons);
  }

  if (typeof input.holdWorktreeLock !== 'function') {
    return blocked(['worktree-lock-required']);
  }

  let lockHandle: RetirementWorktreeLock;
  try {
    lockHandle = input.holdWorktreeLock();
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown';
    return blocked([`worktree-lock-failed:${detail}`]);
  }

  const deletedPaths: string[] = [];
  let reducedLedger: ResourceGovernanceDeprecationLedger | null = null;
  const restoreDeleted = (): void => {
    for (const path of deletedPaths) {
      const archived = input.graph.archiveBytes[path];
      if (archived !== undefined) {
        input.fs.write(path, archived);
      }
    }
  };

  try {
    const recapture = readWorktree();
    if ('status' in recapture && recapture.status === 'blocked') {
      return recapture;
    }
    const liveWorktree = recapture as RetirementWorktreeSnapshot;
    if (liveWorktree.headRevision !== worktree.headRevision) {
      return blocked(['worktree-unstable-head']);
    }
    const recaptureReasons = worktreeDeletionReasons({
      worktree: liveWorktree,
      graph: input.graph,
      authorizedIds: verdict.deletionsAuthorized,
    });
    if (recaptureReasons.length > 0) {
      return blocked(recaptureReasons);
    }

    for (const listed of input.listedPaths) {
      const normalized = listed.replace(/\\/gu, '/');
      const archived = input.graph.archiveBytes[normalized];
      if (archived === undefined) {
        return blocked([`pre-unlink-archive-missing:${normalized}`]);
      }
      const onDisk = input.fs.read(normalized);
      if (fileDigest(onDisk) !== fileDigest(archived)) {
        return blocked([`pre-unlink-digest-mismatch:${normalized}`]);
      }
      input.fs.unlink(normalized);
      deletedPaths.push(normalized);
    }

    const remainingFiles = liveWorktree.files.filter(
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

    let nextLedger: ResourceGovernanceDeprecationLedger;
    try {
      nextLedger = reduceLedgerAfterDeletion(input.graph.currentLedger, deletedPaths);
    } catch (error) {
      restoreDeleted();
      const reasons = error instanceof ResourceGovernanceRetirementGateError
        ? error.reasons
        : [`reduced-ledger-failed:${error instanceof Error ? error.message : 'unknown'}`];
      return blocked(reasons);
    }
    const ledgerReasons = compareLedgers(input.graph.currentLedger, nextLedger);
    const deletedEntries = nextLedger.entries.filter((entry) =>
      deletedPaths.includes(entry.sourcePath.replace(/\\/gu, '/')),
    );
    if (
      deletedPaths.length === 0
      || deletedEntries.length !== deletedPaths.length
      || ledgerReasons.length > 0
      || deletedEntries.some((entry) => entry.state !== 'deleted' || entry.consumers.length > 0)
    ) {
      restoreDeleted();
      return blocked([
        'reduced-ledger-not-monotonic',
        ...ledgerReasons,
        ...deletedEntries
          .filter((entry) => entry.state !== 'deleted' || entry.consumers.length > 0)
          .map((entry) => `reduced-ledger-entry-not-deleted:${entry.id}`),
      ]);
    }
    reducedLedger = nextLedger;
  } catch (error) {
    restoreDeleted();
    const detail = error instanceof Error ? error.message : 'unknown';
    return blocked([`post-delete-exception:${detail}`]);
  } finally {
    lockHandle.release();
  }

  if (reducedLedger === null) {
    restoreDeleted();
    return blocked(['reduced-ledger-missing']);
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
    reducedLedger,
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
