/**
 * Live repository scan used to freeze and later verify the caller denominator.
 * Production verification still consumes an injected graph; this walker is the
 * closed census used by contract tests so FROZEN_CALLERS cannot drift.
 */

import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, openSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

import { FROZEN_CANDIDATES } from './candidates';
import type { DeletionReceipt, GraphCaller, GraphFile, RetirementCandidate } from './contracts';
import {
  deleteRetiredResourceGovernanceEntrypoints,
  type DeleteRetiredEntrypointsInput,
  type RetirementWorktreeLock,
  type RetirementWorktreeSnapshot,
} from './delete';
import {
  RETIREMENT_SCAN_EXTENSIONS,
  RETIREMENT_SCAN_ROOT_FILES,
  RETIREMENT_SCAN_ROOTS,
  entrypointLiteralNeedles,
  fileDigest,
  pathExcluded,
  scanCandidateCallers,
} from './scan';

const SCAN_EXTENSIONS = new Set<string>(RETIREMENT_SCAN_EXTENSIONS);

function walkFiles(absDir: string, repoRoot: string, acc: string[]): void {
  let names: string[];
  try {
    names = readdirSync(absDir);
  } catch {
    return;
  }
  for (const name of names) {
    const abs = join(absDir, name);
    const rel = relative(repoRoot, abs).replace(/\\/gu, '/');
    let stats: ReturnType<typeof statSync>;
    try {
      stats = statSync(abs);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      if (
        name === 'node_modules'
        || name === '.git'
        || name === '.next'
        || name === 'dist'
        || name === 'coverage'
      ) {
        continue;
      }
      if (pathExcluded(`${rel}/placeholder.ts`)) continue;
      walkFiles(abs, repoRoot, acc);
      continue;
    }
    if (!stats.isFile()) continue;
    if (!SCAN_EXTENSIONS.has(extname(name).toLowerCase())) continue;
    if (pathExcluded(rel)) continue;
    acc.push(rel);
  }
}

export function listRetirementScanFiles(repoRoot: string): string[] {
  const files: string[] = [];
  for (const root of RETIREMENT_SCAN_ROOTS) {
    const abs = join(repoRoot, root);
    if (!existsSync(abs)) continue;
    walkFiles(abs, repoRoot, files);
  }
  for (const rootFile of RETIREMENT_SCAN_ROOT_FILES) {
    const abs = join(repoRoot, rootFile);
    if (!existsSync(abs)) continue;
    if (pathExcluded(rootFile)) continue;
    files.push(rootFile);
  }
  return [...new Set(files)].sort();
}

function pathBelongsToScan(rel: string): boolean {
  if (pathExcluded(rel)) return false;
  if ((RETIREMENT_SCAN_ROOT_FILES as readonly string[]).includes(rel)) return true;
  const inRoot = RETIREMENT_SCAN_ROOTS.some(
    (root) => rel === root || rel.startsWith(`${root}/`),
  );
  if (!inRoot) return false;
  return SCAN_EXTENSIONS.has(extname(rel).toLowerCase());
}

const GIT_CAT_FILE_MAX_FILES = 400;
const GIT_CAT_FILE_MAX_BYTES = 8 * 1024 * 1024;

function spawnGitBuffer(
  repoRoot: string,
  args: readonly string[],
  input?: Buffer,
  maxBuffer = 32 * 1024 * 1024,
): Buffer {
  const result = spawnSync('git', [...args], {
    cwd: repoRoot,
    input,
    encoding: null,
    maxBuffer,
  });
  if (result.status !== 0 || result.stdout === null) {
    const detail = result.stderr
      ? result.stderr.toString('utf8')
      : result.error
        ? String(result.error)
        : 'unknown';
    throw new Error(`git ${args.join(' ')} failed: ${detail}`);
  }
  return result.stdout;
}

function parseNulPaths(buf: Buffer): string[] {
  return buf.toString('utf8').split('\0').flatMap((line) => {
    const path = line.replace(/\\/gu, '/').trim();
    return path ? [path] : [];
  });
}

export function listRetirementScanFilesAtRevision(
  repoRoot: string,
  revision: string,
): string[] {
  const stdout = spawnGitBuffer(repoRoot, [
    'ls-tree',
    '-r',
    '--name-only',
    '-z',
    revision,
    '--',
    ...RETIREMENT_SCAN_ROOTS,
    ...RETIREMENT_SCAN_ROOT_FILES,
  ]);
  return [...new Set(parseNulPaths(stdout).filter((path) => pathBelongsToScan(path)))].sort();
}

function loadGitTextFileBatch(
  repoRoot: string,
  revision: string,
  paths: readonly string[],
): GraphFile[] {
  if (paths.length === 0) return [];
  const input = Buffer.from(`${paths.map((path) => `${revision}:${path}`).join('\n')}\n`, 'utf8');
  const buf = spawnGitBuffer(repoRoot, ['cat-file', '--batch'], input, 128 * 1024 * 1024);
  const files: GraphFile[] = [];
  let offset = 0;
  for (const path of paths) {
    const nl = buf.indexOf(0x0a, offset);
    if (nl === -1) {
      throw new Error(`git-cat-file-truncated:${path}`);
    }
    const header = buf.subarray(offset, nl).toString('utf8');
    offset = nl + 1;
    if (header.endsWith(' missing')) {
      throw new Error(`git-object-missing:${path}`);
    }
    const sizePart = header.split(' ')[2];
    const size = Number(sizePart);
    if (!Number.isFinite(size) || size < 0) {
      throw new Error(`git-cat-file-size-invalid:${path}`);
    }
    const content = buf.subarray(offset, offset + size).toString('utf8');
    offset += size;
    if (buf[offset] === 0x0a) offset += 1;
    files.push({ path, content, digest: fileDigest(content) });
  }
  return files;
}

function gitBlobSizesAtRevision(
  repoRoot: string,
  revision: string,
  paths: readonly string[],
): Array<{ path: string; size: number }> {
  if (paths.length === 0) return [];
  const input = Buffer.from(`${paths.map((path) => `${revision}:${path}`).join('\n')}\n`, 'utf8');
  const buf = spawnGitBuffer(repoRoot, ['cat-file', '--batch-check'], input);
  const sizes: Array<{ path: string; size: number }> = [];
  let offset = 0;
  for (const path of paths) {
    const nl = buf.indexOf(0x0a, offset);
    if (nl === -1) {
      throw new Error(`git-cat-file-check-truncated:${path}`);
    }
    const header = buf.subarray(offset, nl).toString('utf8');
    offset = nl + 1;
    if (header.endsWith(' missing')) {
      throw new Error(`git-object-missing:${path}`);
    }
    const sizePart = header.split(' ')[2];
    const size = Number(sizePart);
    if (!Number.isFinite(size) || size < 0) {
      throw new Error(`git-cat-file-size-invalid:${path}`);
    }
    sizes.push({ path, size });
  }
  return sizes;
}

function partitionGitLoadBatches(
  sized: readonly { path: string; size: number }[],
): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let bytes = 0;
  for (const row of sized) {
    const nextFiles = current.length + 1;
    const nextBytes = bytes + row.size;
    if (
      current.length > 0
      && (nextFiles > GIT_CAT_FILE_MAX_FILES || nextBytes > GIT_CAT_FILE_MAX_BYTES)
    ) {
      batches.push(current);
      current = [];
      bytes = 0;
    }
    current.push(row.path);
    bytes += row.size;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

export function loadGitTextFilesAtRevision(
  repoRoot: string,
  revision: string,
  paths: readonly string[],
): GraphFile[] {
  const unique = [...new Set(paths.map((path) => path.replace(/\\/gu, '/')))]
    .filter((path) => pathBelongsToScan(path))
    .sort();
  const files: GraphFile[] = [];
  const checkChunk = 1000;
  for (let index = 0; index < unique.length; index += checkChunk) {
    const sized = gitBlobSizesAtRevision(
      repoRoot,
      revision,
      unique.slice(index, index + checkChunk),
    );
    for (const batch of partitionGitLoadBatches(sized)) {
      files.push(...loadGitTextFileBatch(repoRoot, revision, batch));
    }
  }
  return files;
}

function gitGrepLiteralPaths(
  repoRoot: string,
  revision: string,
  needles: readonly string[],
): string[] {
  if (needles.length === 0) return [];
  const args = ['grep', '-l', '-F', '-z'];
  for (const needle of needles) {
    args.push('-e', needle);
  }
  args.push(revision, '--', ...RETIREMENT_SCAN_ROOTS, ...RETIREMENT_SCAN_ROOT_FILES);
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: null,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0 && result.status !== 1) {
    const detail = result.stderr
      ? result.stderr.toString('utf8')
      : result.error
        ? String(result.error)
        : 'unknown';
    throw new Error(`git grep failed: ${detail}`);
  }
  if (!result.stdout) return [];
  const prefix = `${revision}:`;
  return [...new Set(
    result.stdout.toString('utf8').split('\0').flatMap((line) => {
      if (!line) return [];
      const path = line.startsWith(prefix) ? line.slice(prefix.length) : line;
      const normalized = path.replace(/\\/gu, '/');
      return pathBelongsToScan(normalized) ? [normalized] : [];
    }),
  )].sort();
}

export function scanRetirementCandidatesAtRevision(
  repoRoot: string,
  revision: string,
  candidates: readonly RetirementCandidate[] = FROZEN_CANDIDATES,
): Readonly<Record<string, readonly GraphCaller[]>> {
  const needles = [...new Set(
    candidates.flatMap((candidate) => (
      entrypointLiteralNeedles(candidate.sourcePath, candidate.exportName)
    )),
  )];
  const files = loadGitTextFilesAtRevision(
    repoRoot,
    revision,
    gitGrepLiteralPaths(repoRoot, revision, needles),
  );
  return Object.fromEntries(
    candidates.map((candidate) => [
      candidate.id,
      scanCandidateCallers({ candidate, files }),
    ]),
  );
}

export function frozenCallerPathsMissingFromRevision(
  repoRoot: string,
  revision: string,
  callers: Readonly<Record<string, readonly GraphCaller[]>>,
): string[] {
  const paths = [...new Set(
    Object.values(callers).flatMap((hits) => hits.map((hit) => hit.path.replace(/\\/gu, '/'))),
  )];
  return paths.filter((path) => {
    const result = spawnSync('git', ['cat-file', '-e', `${revision}:${path}`], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    return result.status !== 0;
  }).sort();
}

export function loadRetirementScanFiles(repoRoot: string): GraphFile[] {
  return listRetirementScanFiles(repoRoot).map((path) => {
    const content = readFileSync(join(repoRoot, path), 'utf8');
    return { path, content, digest: fileDigest(content) };
  });
}

export function scanRetirementCandidatesFromRepo(
  repoRoot: string,
  candidates: readonly RetirementCandidate[] = FROZEN_CANDIDATES,
): Readonly<Record<string, readonly GraphCaller[]>> {
  const files = loadRetirementScanFiles(repoRoot);
  return Object.fromEntries(
    candidates.map((candidate) => [
      candidate.id,
      scanCandidateCallers({ candidate, files }),
    ]),
  );
}

function gitText(repoRoot: string, args: readonly string[]): string {
  const result = spawnSync('git', [...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout || 'unknown'}`);
  }
  return result.stdout;
}

function unquoteGitPath(path: string): string {
  const trimmed = path.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/gu, '"');
  }
  return trimmed;
}

function parseGitPorcelainPath(line: string): string[] {
  if (!line) return [];
  const rest = line.length >= 3 ? line.slice(3) : line;
  if (rest.includes(' -> ')) {
    return rest.split(' -> ').map(unquoteGitPath);
  }
  return [unquoteGitPath(rest)];
}

/**
 * Exclusive lock covering final worktree recapture through unlink.
 * Fail closed if another retirement deletion already holds the lock.
 * Uses `git rev-parse --absolute-git-dir` so linked worktrees lock the real
 * Git directory instead of a `.git` gitfile.
 */
export function holdRetirementWorktreeLock(repoRoot: string): RetirementWorktreeLock {
  let gitDir: string;
  try {
    gitDir = gitText(repoRoot, ['rev-parse', '--absolute-git-dir']).trim();
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown';
    throw new Error(`worktree-lock-git-dir:${detail}`);
  }
  if (!gitDir) {
    throw new Error('worktree-lock-git-dir-empty');
  }
  const lockPath = join(gitDir, 'resource-governance-retirement.lock');
  let fd: number;
  try {
    fd = openSync(lockPath, 'wx');
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: string }).code ?? '')
      : '';
    if (code === 'EEXIST') {
      throw new Error('worktree-lock-busy');
    }
    throw new Error(`worktree-lock-open-failed:${code || 'unknown'}`);
  }
  writeFileSync(fd, `${process.pid}\n`);
  let released = false;
  return {
    release() {
      if (released) return;
      released = true;
      closeSync(fd);
      try {
        unlinkSync(lockPath);
      } catch {
        // Best-effort lockfile cleanup; absence is not a deletion failure.
      }
    },
  };
}

/** Recapture HEAD, dirty paths, and scan-root files from the live worktree. */
export function captureRetirementWorktree(repoRoot: string): RetirementWorktreeSnapshot {
  const headBefore = gitText(repoRoot, ['rev-parse', 'HEAD']).trim();
  const dirtyBefore = gitText(repoRoot, ['status', '--porcelain', '-uall']);
  const files = loadRetirementScanFiles(repoRoot);
  const headAfter = gitText(repoRoot, ['rev-parse', 'HEAD']).trim();
  const dirtyAfter = gitText(repoRoot, ['status', '--porcelain', '-uall']);
  const dirtyPaths = [...new Set(
    `${dirtyBefore}\n${dirtyAfter}`.split('\n').flatMap(parseGitPorcelainPath).filter(Boolean),
  )].sort();
  if (headBefore !== headAfter) {
    dirtyPaths.push(`head-drift:${headBefore}->${headAfter}`);
  }
  return {
    headRevision: headAfter,
    dirtyPaths,
    files,
  };
}

/**
 * Production deletion entry: binds a live worktree capture and exclusive lock.
 * Do not re-export this from the package barrel; web graph must not pull the
 * filesystem walker into the Next.js production graph.
 */
export function deleteRetiredResourceGovernanceEntrypointsFromRepo(
  repoRoot: string,
  input: Omit<DeleteRetiredEntrypointsInput, 'captureWorktree' | 'holdWorktreeLock'>,
): DeletionReceipt {
  return deleteRetiredResourceGovernanceEntrypoints({
    ...input,
    captureWorktree: () => captureRetirementWorktree(repoRoot),
    holdWorktreeLock: () => holdRetirementWorktreeLock(repoRoot),
  });
}

export function frozenCallerCoverageGaps(
  frozen: Readonly<Record<string, readonly GraphCaller[]>>,
  live: Readonly<Record<string, readonly GraphCaller[]>>,
): string[] {
  const reasons: string[] = [];
  for (const [id, liveHits] of Object.entries(live)) {
    const frozenPaths = new Set(
      (frozen[id] ?? []).map((hit) => hit.path.replace(/\\/gu, '/')),
    );
    for (const hit of liveHits) {
      const path = hit.path.replace(/\\/gu, '/');
      if (!frozenPaths.has(path)) {
        reasons.push(`${id}:${path}`);
      }
    }
  }
  return reasons.sort();
}
