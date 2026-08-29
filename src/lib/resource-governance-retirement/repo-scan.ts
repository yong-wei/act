/**
 * Live repository scan used to freeze and later verify the caller denominator.
 * Production verification still consumes an injected graph; this walker is the
 * closed census used by contract tests so FROZEN_CALLERS cannot drift.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

import { FROZEN_CANDIDATES } from './candidates';
import type { GraphCaller, GraphFile, RetirementCandidate } from './contracts';
import {
  RETIREMENT_SCAN_EXTENSIONS,
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
