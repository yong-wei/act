#!/usr/bin/env tsx
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { isMixedWorktree } from '../src/lib/architecture-census/identity';
import {
  INVENTORY,
  observeTraffic,
  summarizeObservation,
  type ObservationWindow,
} from '../src/lib/runtime-traffic-cost';
import { readGitIdentity } from './typescript-graphs/contracts';

function argument(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function defaultWindow(): ObservationWindow {
  return {
    start: argument('--window-start') ?? '2026-08-01T00:00:00.000Z',
    end: argument('--window-end') ?? '2026-08-28T00:00:00.000Z',
    timezone: argument('--timezone') ?? 'UTC',
  };
}

function loadExports(inputDir: string | null): unknown[] {
  if (!inputDir) return [];
  return readdirSync(inputDir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(inputDir, name), 'utf8')) as unknown);
}

function writeBaseline(repoRoot: string): void {
  const identity = readGitIdentity(repoRoot);
  const mixedWorktree = isMixedWorktree(repoRoot);
  const requestedCommit = argument('--source-commit');
  const requestedTree = argument('--source-tree');
  const identityDrift = (requestedCommit !== null && requestedCommit !== identity.sourceCommit)
    || (requestedTree !== null && requestedTree !== identity.sourceTree);
  const observation = observeTraffic({
    sourceCommit: identity.sourceCommit,
    sourceTree: identity.sourceTree,
    dirty: identity.dirty || identityDrift,
    mixedWorktree,
    environment: argument('--environment') ?? 'production-and-workstation',
    window: defaultWindow(),
    capturedAt: argument('--captured-at') ?? new Date().toISOString(),
    exports: loadExports(argument('--input-dir')),
  });
  const outputDir = argument('--output-dir') ?? join(repoRoot, 'docs/operations/runtime-traffic-cost/observations', observation.observationId);
  const observationPath = join(outputDir, 'observation.json');
  const summaryPath = join(outputDir, 'summary.md');
  if (existsSync(observationPath) || existsSync(summaryPath)) {
    throw new Error(`observation-artifact-exists:${outputDir}`);
  }
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(observationPath, `${JSON.stringify(observation, null, 2)}\n`);
  writeFileSync(summaryPath, summarizeObservation(observation));
  console.log(JSON.stringify({
    observationId: observation.observationId,
    status: observation.status,
    missingSources: observation.missingSources.map((item) => item.sourceType),
  }));
}

function main(): void {
  const repoRoot = process.cwd();
  const action = process.argv[2] ?? 'inventory';
  if (action === 'inventory') {
    console.log(JSON.stringify({ routes: INVENTORY }, null, 2));
    return;
  }
  if (action === 'observe' || action === 'write-baseline') {
    writeBaseline(repoRoot);
    return;
  }
  throw new Error(`unknown-runtime-traffic-cost-action:${action}`);
}

main();
