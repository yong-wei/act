#!/usr/bin/env tsx
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { isMixedWorktree } from '../src/lib/architecture-census/identity';
import {
  DEFAULT_SOURCE_PATH,
  DELIVERY_BUCKET,
  STATIC_HOSTNAME,
  planObject,
  qualifyDelivery,
  summarizeQualification,
  type DnsReceipt,
  type QualificationEnvelope,
} from '../src/lib/static-esa-delivery';
import { DNS_SCHEMA } from '../src/lib/static-esa-delivery/types';
import { readGitIdentity } from './typescript-graphs/contracts';

function argument(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function loadJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function loadNamed(inputDir: string | null, name: string): unknown {
  if (!inputDir) return undefined;
  const path = join(inputDir, name);
  return existsSync(path) ? loadJson(path) : undefined;
}

function intercepted(value: string): boolean {
  return /^(?:198\.18\.|127\.|0\.0\.0\.0$)/u.test(value.trim());
}

function observeDns(): DnsReceipt {
  try {
    const output = execFileSync('dig', ['+short', STATIC_HOSTNAME], {
      encoding: 'utf8',
      timeout: 5000,
    }).trim();
    const lines = output.split('\n').map((line) => line.trim()).filter(Boolean);
    const cname = lines.find((line) => line.endsWith('.' ) && /[A-Za-z]/.test(line)) ?? null;
    const addresses = lines.filter((line) => /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(line));
    const interceptedLookup = addresses.some(intercepted) || (cname !== null && intercepted(cname));
    return {
      schemaVersion: DNS_SCHEMA,
      hostname: STATIC_HOSTNAME,
      recordType: interceptedLookup ? 'intercepted' : cname ? 'CNAME' : addresses.length ? 'A' : 'absent',
      priorValue: interceptedLookup ? null : cname ?? addresses[0] ?? null,
      priorTtlSeconds: null,
      desiredValue: null,
      assignedValue: null,
      observedValue: interceptedLookup ? null : cname ?? addresses[0] ?? null,
      applied: false,
      namesChanged: [],
    };
  } catch {
    return {
      schemaVersion: DNS_SCHEMA,
      hostname: STATIC_HOSTNAME,
      recordType: 'absent',
      priorValue: null,
      priorTtlSeconds: null,
      desiredValue: null,
      assignedValue: null,
      observedValue: null,
      applied: false,
      namesChanged: [],
    };
  }
}

function writeEnvelope(repoRoot: string, envelope: QualificationEnvelope, outputDir: string): void {
  const qualificationPath = join(outputDir, 'qualification.json');
  const summaryPath = join(outputDir, 'summary.md');
  if (existsSync(qualificationPath) || existsSync(summaryPath)) {
    throw new Error(`qualification-artifact-exists:${outputDir}`);
  }
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(qualificationPath, `${JSON.stringify(envelope, null, 2)}\n`);
  writeFileSync(summaryPath, summarizeQualification(envelope));
  process.stdout.write(`${JSON.stringify({
    qualificationId: envelope.qualificationId,
    status: envelope.status,
    blockingReasons: envelope.blockingReasons,
    missingEvidence: envelope.missingEvidence,
  })}\n`);
}

function capture(repoRoot: string) {
  const identity = readGitIdentity(repoRoot);
  const mixedWorktree = isMixedWorktree(repoRoot);
  const requestedCommit = argument('--source-commit');
  const requestedTree = argument('--source-tree');
  const identityDrift = (requestedCommit !== null && requestedCommit !== identity.sourceCommit)
    || (requestedTree !== null && requestedTree !== identity.sourceTree);
  return {
    sourceCommit: identity.sourceCommit,
    sourceTree: identity.sourceTree,
    dirty: identity.dirty || identityDrift,
    mixedWorktree,
    capturedAt: argument('--captured-at') ?? new Date().toISOString(),
  };
}

function qualifyFromInputs(repoRoot: string): QualificationEnvelope {
  const inputDir = argument('--input-dir');
  const sourcePath = argument('--source') ?? DEFAULT_SOURCE_PATH;
  const sourceAbs = join(repoRoot, sourcePath);
  const uploaded = loadNamed(inputDir, 'object.json');
  const object = uploaded !== undefined
    ? uploaded
    : existsSync(sourceAbs)
      ? planObject(sourcePath, readFileSync(sourceAbs))
      : undefined;
  return qualifyDelivery({
    ...capture(repoRoot),
    originBucket: argument('--origin-bucket') ?? DELIVERY_BUCKET,
    serviceRole: loadNamed(inputDir, 'service-role.json'),
    object,
    dns: loadNamed(inputDir, 'dns.json') ?? observeDns(),
    transport: loadNamed(inputDir, 'transport.json'),
    isolation: loadNamed(inputDir, 'isolation.json'),
    cost: loadNamed(inputDir, 'cost.json'),
    logs: loadNamed(inputDir, 'logs.json'),
  });
}

function defaultOutputDir(repoRoot: string, envelope: QualificationEnvelope): string {
  return argument('--output-dir') ?? join(repoRoot, 'docs/operations/static-esa-delivery/observations', envelope.qualificationId);
}

function main(): void {
  const repoRoot = process.cwd();
  const action = process.argv[2] ?? 'inventory';
  if (action === 'inventory') {
    process.stdout.write(`${JSON.stringify({
      hostname: STATIC_HOSTNAME,
      deliveryBucket: DELIVERY_BUCKET,
      defaultSourcePath: DEFAULT_SOURCE_PATH,
      cacheRule: '/assets/*',
    }, null, 2)}\n`);
    return;
  }
  if (action === 'plan-object') {
    const sourcePath = argument('--source') ?? DEFAULT_SOURCE_PATH;
    const planned = planObject(sourcePath, readFileSync(join(repoRoot, sourcePath)));
    process.stdout.write(`${JSON.stringify(planned, null, 2)}\n`);
    return;
  }
  if (action === 'preflight' || action === 'qualify' || action === 'write-baseline') {
    const envelope = qualifyFromInputs(repoRoot);
    const outputDir = action === 'write-baseline'
      ? join(repoRoot, 'docs/operations/static-esa-delivery/baseline')
      : defaultOutputDir(repoRoot, envelope);
    writeEnvelope(repoRoot, envelope, outputDir);
    return;
  }
  if (action === 'validate') {
    const inputDir = argument('--input-dir');
    if (!inputDir) throw new Error('missing-input-dir');
    const files = readdirSync(inputDir).filter((name) => name.endsWith('.json')).sort();
    const digest = createHash('sha256');
    for (const name of files) digest.update(readFileSync(join(inputDir, name)));
    process.stdout.write(`${JSON.stringify({ ok: true, files, fingerprint: digest.digest('hex') })}\n`);
    return;
  }
  throw new Error(`unknown-static-esa-delivery-action:${action}`);
}

main();
