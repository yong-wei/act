/**
 * Live repository scan used to freeze and later verify the caller denominator.
 * Production verification still consumes an injected graph; this walker is the
 * closed census used by contract tests so FROZEN_CALLERS cannot drift.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

import { FROZEN_CANDIDATES } from './candidates';
import type { GraphCaller, GraphFile, RetirementCandidate } from './contracts';
import type { RetirementWorktreeSnapshot } from './delete';
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
 * Recapture HEAD, dirty paths, and the retirement scan-root file set from the
 * live worktree. Production deletion must use this immediately before unlink.
 */
export function captureRetirementWorktree(repoRoot: string): RetirementWorktreeSnapshot {
  const headRevision = gitText(repoRoot, ['rev-parse', 'HEAD']).trim();
  const porcelain = gitText(repoRoot, ['status', '--porcelain', '-uall']);
  const dirtyPaths = [...new Set(
    porcelain.split('\n').flatMap(parseGitPorcelainPath).filter(Boolean),
  )].sort();
  return {
    headRevision,
    dirtyPaths,
    files: loadRetirementScanFiles(repoRoot),
  };
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
