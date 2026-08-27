#!/usr/bin/env tsx
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { isMixedWorktree } from '../src/lib/architecture-census/identity';
import {
  COHORT_ID,
  DELIVERY_BUCKET,
  SIMULATION_MODELS,
  buildManifest,
  optimizerConfigDigest,
  planPublication,
  qualifyRouting,
  resolveSimulationModel,
} from '../src/lib/browser-delivery';
import { hashFile } from '../src/lib/browser-delivery/manifest';
import { readGitIdentity } from './typescript-graphs/contracts';
import type { SimulationModelId } from '../src/lib/browser-delivery/types';

function git(repoRoot: string, args: string[]): string {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

function gitBlobOid(repoRoot: string, path: string): string {
  const output = git(repoRoot, ['ls-tree', 'HEAD', path]);
  const match = /^100644 blob ([a-f0-9]{40})\t/u.exec(output);
  if (!match) throw new Error(`missing-git-blob:${path}`);
  return match[1];
}

function loadJson(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

function capture(repoRoot: string) {
  const identity = readGitIdentity(repoRoot);
  return {
    ...identity,
    mixedWorktree: isMixedWorktree(repoRoot),
    capturedAt: new Date().toISOString(),
  };
}

function optimizerIdentity(repoRoot: string) {
  const pkg = JSON.parse(readFileSync(join(repoRoot, 'tools/glb-model-optimizer/package.json'), 'utf8')) as { version?: string };
  const script = readFileSync(join(repoRoot, 'tools/glb-model-optimizer/optimize-models.mjs'), 'utf8');
  return {
    name: '@act/glb-model-optimizer' as const,
    version: pkg.version ?? 'unknown',
    configDigest: optimizerConfigDigest(script),
  };
}

function build(repoRoot: string) {
  const gitIdentity = capture(repoRoot);
  const sources = {} as Record<SimulationModelId, {
    sourceGitBlob: string;
    sourceSha256: string;
    sourceBytes: number;
    outputSha256: string | null;
    outputBytes: number | null;
  }>;
  for (const model of SIMULATION_MODELS) {
    const sourcePath = join(repoRoot, 'public/assets', model.basename);
    const optimizedPath = join(repoRoot, 'public/assets/models-opt', model.basename);
    if (!existsSync(sourcePath)) throw new Error(`missing-source-file:${model.basename}`);
    const optimizedExists = existsSync(optimizedPath) && statSync(optimizedPath).isFile();
    sources[model.logicalId] = {
      sourceGitBlob: gitBlobOid(repoRoot, `public/assets/${model.basename}`),
      sourceSha256: hashFile(sourcePath),
      sourceBytes: statSync(sourcePath).size,
      outputSha256: optimizedExists ? hashFile(optimizedPath) : null,
      outputBytes: optimizedExists ? statSync(optimizedPath).size : null,
    };
  }
  const manifest = buildManifest({
    ...gitIdentity,
    optimizer: optimizerIdentity(repoRoot),
    sources,
  });
  const publication = planPublication(manifest);
  const esa = loadJson(join(repoRoot, 'docs/operations/static-esa-delivery/baseline/qualification.json'));
  const traffic = loadJson(join(repoRoot, 'docs/operations/runtime-traffic-cost/baseline/observation.json'));
  const routing = qualifyRouting({
    sourceCommit: gitIdentity.sourceCommit,
    sourceTree: gitIdentity.sourceTree,
    capturedAt: gitIdentity.capturedAt,
    dirty: gitIdentity.dirty,
    mixedWorktree: gitIdentity.mixedWorktree,
    manifest,
    publication,
    esaQualified: esa?.status === 'qualified',
    trafficQualified: traffic?.status === 'qualified',
  });
  return { manifest, publication, routing };
}

function writeBaseline(repoRoot: string, payload: ReturnType<typeof build>): void {
  const dir = join(repoRoot, 'docs/operations/browser-delivery/baseline');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify(payload.manifest, null, 2)}\n`);
  writeFileSync(join(dir, 'publication.json'), `${JSON.stringify(payload.publication, null, 2)}\n`);
  writeFileSync(join(dir, 'routing.json'), `${JSON.stringify(payload.routing, null, 2)}\n`);
  writeFileSync(join(dir, 'summary.md'), [
    '# browser Delivery cohort',
    '',
    `- cohort: \`${COHORT_ID}\``,
    `- routing: \`${payload.routing.status}\``,
    `- esaFirst: ${payload.routing.esaFirst}`,
    `- included: ${payload.manifest.includedCount}`,
    `- excluded: ${payload.manifest.excludedCount}`,
    `- publication applied: ${payload.publication.applied}`,
    '',
    'Missing evidence:',
    ...(payload.routing.missingEvidence.length
      ? payload.routing.missingEvidence.map((item) => `- ${item}`)
      : ['- none']),
    '',
    'This receipt does not change Runtime selectors, private media, or add GitHub PR CI.',
    '',
  ].join('\n'));
}

function main(): void {
  const repoRoot = process.cwd();
  const action = process.argv[2] ?? 'inventory';
  if (action === 'inventory') {
    process.stdout.write(`${JSON.stringify({
      cohortId: COHORT_ID,
      deliveryBucket: DELIVERY_BUCKET,
      models: SIMULATION_MODELS,
    }, null, 2)}\n`);
    return;
  }
  if (action === 'manifest' || action === 'plan' || action === 'qualify-routing' || action === 'write-baseline') {
    const payload = build(repoRoot);
    if (action === 'write-baseline') writeBaseline(repoRoot, payload);
    const selected = action === 'plan' ? payload.publication : action === 'qualify-routing' ? payload.routing : payload.manifest;
    process.stdout.write(`${JSON.stringify(action === 'write-baseline' ? payload.routing : selected, null, 2)}\n`);
    return;
  }
  if (action === 'resolve') {
    const payload = build(repoRoot);
    const models = SIMULATION_MODELS.map((model) => resolveSimulationModel(model.logicalId, payload.manifest, payload.routing));
    process.stdout.write(`${JSON.stringify(models, null, 2)}\n`);
    return;
  }
  throw new Error(`unknown-browser-delivery-action:${action}`);
}

main();
