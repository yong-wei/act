import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const REVISION_PROBE_PATH = '/api/internal/local-qa/revision';

function gitOutput(repoRoot, args, options = {}) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: options.encoding ?? 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function normalizeStatusPath(value) {
  return value.replaceAll('\\', '/').replace(/^"|"$/gu, '');
}

function pathIsWithin(relativePath, parentPath) {
  return relativePath === parentPath || relativePath.startsWith(`${parentPath}/`);
}

export function dirtyStatusPaths(repoRoot, allowedOutputPaths = []) {
  const raw = gitOutput(repoRoot, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  const entries = raw.split('\0').filter(Boolean);
  const dirtyPaths = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const status = entry.slice(0, 2);
    dirtyPaths.push(normalizeStatusPath(entry.slice(3)));
    if (status.includes('R') || status.includes('C')) {
      index += 1;
      if (entries[index]) dirtyPaths.push(normalizeStatusPath(entries[index]));
    }
  }
  return dirtyPaths.filter((candidate) => !allowedOutputPaths.some((allowed) => pathIsWithin(candidate, allowed)));
}

export async function sha256File(repoRoot, relativePath) {
  return createHash('sha256')
    .update(await readFile(path.join(repoRoot, relativePath)))
    .digest('hex');
}

function sha256Buffer(value) {
  return createHash('sha256').update(value).digest('hex');
}

export async function sourceFingerprint(repoRoot, sourceFiles) {
  const hash = createHash('sha256');
  for (const sourceFile of [...sourceFiles].sort()) {
    hash.update(sourceFile);
    hash.update('\0');
    hash.update(await readFile(path.join(repoRoot, sourceFile)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

async function assertSourceFilesMatchRevision(repoRoot, revision, sourceFiles) {
  for (const sourceFile of sourceFiles) {
    const worktreeDigest = await sha256File(repoRoot, sourceFile);
    const gitBytes = gitOutput(repoRoot, ['show', `${revision}:${sourceFile}`], { encoding: 'buffer' });
    const revisionDigest = sha256Buffer(gitBytes);
    if (worktreeDigest !== revisionDigest) {
      throw new Error(`Runtime input ${sourceFile} differs from declared revision ${revision}.`);
    }
  }
}

function assertFullSha(value, label) {
  if (!/^[0-9a-f]{40}$/u.test(value)) {
    throw new Error(`${label} must be a full 40-character Git SHA.`);
  }
}

export async function computeLocalProvenance({
  repoRoot,
  declaredRevision,
  sourceFiles,
  allowedOutputPaths = [],
}) {
  const resolvedRevision = gitOutput(repoRoot, ['rev-parse', '--verify', `${declaredRevision}^{commit}`]).trim();
  const headRevision = gitOutput(repoRoot, ['rev-parse', '--verify', 'HEAD^{commit}']).trim();
  assertFullSha(resolvedRevision, 'Declared revision');
  assertFullSha(headRevision, 'HEAD revision');
  if (resolvedRevision !== declaredRevision) {
    throw new Error(`Declared revision must be canonical: ${declaredRevision} resolved to ${resolvedRevision}.`);
  }
  if (headRevision !== declaredRevision) {
    throw new Error(`HEAD ${headRevision} differs from declared revision ${declaredRevision}.`);
  }
  const dirtyPaths = dirtyStatusPaths(repoRoot, allowedOutputPaths);
  if (dirtyPaths.length > 0) {
    throw new Error(`Capture worktree is dirty outside allowed evidence outputs: ${dirtyPaths.join(', ')}`);
  }
  await assertSourceFilesMatchRevision(repoRoot, declaredRevision, sourceFiles);
  return {
    commitSha: headRevision,
    treeSha: gitOutput(repoRoot, ['rev-parse', '--verify', `${declaredRevision}^{tree}`]).trim(),
    sourceFingerprint: await sourceFingerprint(repoRoot, sourceFiles),
    clean: true,
  };
}

export async function fetchRuntimeProvenance(baseUrl) {
  const response = await fetch(`${baseUrl}${REVISION_PROBE_PATH}`, {
    cache: 'no-store',
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(
      `Runtime revision probe failed closed with HTTP ${response.status}. `
      + 'Start the development service with ACT_LOCAL_QA_BRIDGE=1 from the clean capture worktree.',
    );
  }
  return response.json();
}

export async function assertCaptureProvenance({
  repoRoot,
  declaredRevision,
  sourceFiles,
  baseUrl,
  allowedOutputPaths = [],
  expectedProof,
  phase,
}) {
  const localProof = await computeLocalProvenance({
    repoRoot,
    declaredRevision,
    sourceFiles,
    allowedOutputPaths,
  });
  const runtimeProof = await fetchRuntimeProvenance(baseUrl);
  for (const field of ['commitSha', 'treeSha', 'sourceFingerprint', 'clean']) {
    if (runtimeProof[field] !== localProof[field]) {
      throw new Error(
        `${phase}: runtime ${field} ${String(runtimeProof[field])} differs from local ${String(localProof[field])}.`,
      );
    }
    if (expectedProof && localProof[field] !== expectedProof[field]) {
      throw new Error(
        `${phase}: local ${field} drifted from capture start (${String(expectedProof[field])} -> ${String(localProof[field])}).`,
      );
    }
  }
  return localProof;
}
