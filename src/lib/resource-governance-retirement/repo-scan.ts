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
 */
export function holdRetirementWorktreeLock(repoRoot: string): RetirementWorktreeLock {
  const lockPath = join(repoRoot, '.git', 'resource-governance-retirement.lock');
  let fd: number;
  try {
    fd = openSync(lockPath, 'wx');
  } catch {
    throw new Error('worktree-lock-busy');
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
