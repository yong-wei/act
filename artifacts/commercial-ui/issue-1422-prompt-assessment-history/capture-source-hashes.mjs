import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function gitBlob(repositoryRoot, captureRevision, sourcePath) {
  return execFileSync('git', ['show', `${captureRevision}:${sourcePath}`], {
    cwd: repositoryRoot,
    encoding: 'buffer',
  });
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function normalizeText(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/\r\n?/g, '\n');
  } catch {
    return null;
  }
}

function bytesMatchRevision(worktreeBytes, revisionBytes) {
  if (worktreeBytes.equals(revisionBytes)) {
    return true;
  }

  const worktreeText = normalizeText(worktreeBytes);
  const revisionText = normalizeText(revisionBytes);
  return worktreeText !== null && revisionText !== null && worktreeText === revisionText;
}

export function readCaptureSourceHashes({ repositoryRoot, captureRevision, sourcePaths }) {
  return Object.fromEntries(sourcePaths.map((sourcePath) => [
    sourcePath,
    sha256(gitBlob(repositoryRoot, captureRevision, sourcePath)),
  ]));
}

export function assertCaptureSourcesMatchRevision({ repositoryRoot, captureRevision, sourcePaths }) {
  for (const sourcePath of sourcePaths) {
    const revisionBytes = gitBlob(repositoryRoot, captureRevision, sourcePath);
    const worktreeBytes = readFileSync(join(repositoryRoot, sourcePath));
    if (!bytesMatchRevision(worktreeBytes, revisionBytes)) {
      throw new Error(`Capture source ${sourcePath} differs from capture revision ${captureRevision}`);
    }
  }

  return readCaptureSourceHashes({ repositoryRoot, captureRevision, sourcePaths });
}
