#!/usr/bin/env tsx
/**
 * Rebind the already-complete r4 teaching closure to the c6 presentation
 * snapshot. The only permitted change is the sealed scope hash: the C6
 * semantic cache must prove that every Authority object and relation remains
 * reusable, and the complete three-family ledger is reopened afterward.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { ActTeachingFamilyDisposition } from '@/lib/act-canonical-teaching-relations/contracts';
import { evaluateTeachingClosure } from '@/lib/latest-authority-oss-cutover/teaching-closure';
import { projectionDigest } from '@/lib/teaching-projection/hash';

const ROOT = process.cwd();
const BASELINE_ROOT = 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c4';
const SUCCESSOR_ROOT = 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c6-presentation-evidence';

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (value !== undefined && (!value || value.startsWith('--'))) {
    throw new Error(`reclose-r4-c6-teaching-governance: missing ${name}`);
  }
  return value ?? fallback;
}

function absolute(value: string): string {
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function readJson<T>(value: string): T {
  return JSON.parse(readFileSync(absolute(value), 'utf8')) as T;
}

function sha256File(value: string): string {
  return createHash('sha256').update(readFileSync(absolute(value))).digest('hex');
}

function immutableWrite(value: string, body: unknown): void {
  const target = absolute(value);
  const wire = Buffer.from(`${JSON.stringify(body, null, 2)}\n`);
  mkdirSync(path.dirname(target), { recursive: true });
  if (existsSync(target) && !readFileSync(target).equals(wire)) {
    throw new Error(`reclose-r4-c6-teaching-governance: refusing to overwrite ${value}`);
  }
  if (!existsSync(target)) writeFileSync(target, wire);
}

function requireDigest(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new Error(`reclose-r4-c6-teaching-governance: ${label} must be a SHA-256 digest`);
  }
}

type Scope = {
  readonly scopeHash: string;
  readonly members: readonly { readonly canonicalId: string }[];
  readonly authority: { readonly snapshotId: string; readonly snapshotHash: string; readonly releaseId: string; readonly releaseSetId: string };
};

type SemanticCache = {
  readonly contract: string;
  readonly entries: readonly unknown[];
  readonly summary: { readonly reusedCount: number; readonly recomputedCount: number; readonly retiredCount: number; readonly objectCount: number; readonly relationCount: number };
  readonly cacheHash: string;
  readonly successor: { readonly manifest: Scope['authority'] };
};

type DispositionArtifact = {
  readonly contract: string;
  readonly authorityCaptureHash: string;
  readonly scopeHash: string;
  readonly dispositionHash: string;
  readonly dispositions: readonly ActTeachingFamilyDisposition[];
};

function sortedMembers(scope: Scope, label: string): readonly string[] {
  const members = scope.members.map((member) => member.canonicalId).sort();
  if (new Set(members).size !== members.length) {
    throw new Error(`reclose-r4-c6-teaching-governance: ${label} scope repeats a Canonical member`);
  }
  return members;
}

function main(): void {
  const baselineRoot = option('--baseline-root', BASELINE_ROOT);
  const successorRoot = option('--successor-root', SUCCESSOR_ROOT);
  const sourceScope = readJson<Scope>(path.join(baselineRoot, 'domain-catalog/scope.json'));
  const successorScope = readJson<Scope>(path.join(successorRoot, 'domain-catalog/scope.json'));
  requireDigest(sourceScope.scopeHash, 'baseline scope');
  requireDigest(successorScope.scopeHash, 'successor scope');
  const baselineMembers = sortedMembers(sourceScope, 'baseline');
  const successorMembers = sortedMembers(successorScope, 'successor');
  if (JSON.stringify(baselineMembers) !== JSON.stringify(successorMembers)) {
    throw new Error('reclose-r4-c6-teaching-governance: successor scope changes Canonical membership');
  }

  const cache = readJson<SemanticCache>(path.join(successorRoot, 'authority-semantic-cache.json'));
  const expectedCacheHash = projectionDigest({ contract: cache.contract, entries: cache.entries, summary: cache.summary });
  if (
    cache.contract !== 'authority-semantic-cache/v1'
    || cache.cacheHash !== expectedCacheHash
    || cache.summary.recomputedCount !== 0
    || cache.summary.retiredCount !== 0
    || cache.summary.reusedCount !== cache.entries.length
    || cache.summary.objectCount !== successorMembers.length
    || cache.successor.manifest.snapshotId !== successorScope.authority.snapshotId
    || cache.successor.manifest.snapshotHash !== successorScope.authority.snapshotHash
    || cache.successor.manifest.releaseId !== successorScope.authority.releaseId
    || cache.successor.manifest.releaseSetId !== successorScope.authority.releaseSetId
  ) {
    throw new Error('reclose-r4-c6-teaching-governance: successor semantic cache cannot prove scope-only reclosure');
  }

  const sourcePath = path.join(baselineRoot, 'teaching-dispositions.json');
  const source = readJson<DispositionArtifact>(sourcePath);
  if (
    source.contract !== 'coordinated-teaching-disposition-reuse/v1'
    || source.scopeHash !== sourceScope.scopeHash
    || source.dispositionHash !== projectionDigest(source.dispositions)
  ) {
    throw new Error('reclose-r4-c6-teaching-governance: baseline teaching disposition artifact is invalid');
  }
  const memberSet = new Set(successorMembers);
  const sourceKeys = new Set<string>();
  for (const disposition of source.dispositions) {
    if (disposition.scopeHash !== sourceScope.scopeHash || !memberSet.has(disposition.canonicalId)) {
      throw new Error('reclose-r4-c6-teaching-governance: baseline disposition is outside the closed scope');
    }
    const key = `${disposition.canonicalId}\u0000${disposition.family}`;
    if (sourceKeys.has(key)) throw new Error(`reclose-r4-c6-teaching-governance: repeated disposition ${key}`);
    sourceKeys.add(key);
  }
  if (sourceKeys.size !== successorMembers.length * 3) {
    throw new Error('reclose-r4-c6-teaching-governance: baseline does not close all successor member/family pairs');
  }

  const dispositions = source.dispositions.map((disposition) => ({
    ...disposition,
    scopeHash: successorScope.scopeHash,
  }));
  const closure = evaluateTeachingClosure({
    scopeHash: successorScope.scopeHash,
    authorityCaptureHash: source.authorityCaptureHash,
    members: successorScope.members,
    dispositions,
    candidates: [],
    decisions: [],
  });
  if (closure.status !== 'COMPLETE' || !closure.zeroUnresolved) {
    throw new Error(`reclose-r4-c6-teaching-governance: reclosed teaching governance is ${closure.status}`);
  }

  const dispositionPath = path.join(successorRoot, 'teaching-dispositions.json');
  const artifact = {
    contract: 'coordinated-teaching-disposition-scope-reclosure/v1',
    authorityCaptureHash: source.authorityCaptureHash,
    scopeHash: successorScope.scopeHash,
    semanticCacheHash: cache.cacheHash,
    source: {
      candidateRoot: BASELINE_ROOT,
      scopeHash: sourceScope.scopeHash,
      dispositionHash: source.dispositionHash,
      dispositionSha256: sha256File(sourcePath),
    },
    dispositionHash: projectionDigest(dispositions),
    dispositions,
  };
  immutableWrite(dispositionPath, artifact);
  const receipt = {
    contract: 'r4-c6-teaching-governance-reclosure/v1',
    status: 'COMPLETE',
    sourceDispositionSha256: artifact.source.dispositionSha256,
    sourceScopeHash: sourceScope.scopeHash,
    successorScopeHash: successorScope.scopeHash,
    successorSnapshotHash: successorScope.authority.snapshotHash,
    semanticCacheHash: cache.cacheHash,
    dispositionHash: artifact.dispositionHash,
    closureReceiptHash: closure.receiptHash,
    changedFields: ['scopeHash'],
    reclosedDispositionCount: dispositions.length,
    receiptHash: '',
  };
  const { receiptHash: ignoredReceiptHash, ...receiptHashInput } = receipt;
  void ignoredReceiptHash;
  immutableWrite(path.join(successorRoot, 'teaching-reclosure-receipt.json'), {
    ...receipt,
    receiptHash: projectionDigest(receiptHashInput),
  });
  immutableWrite(path.join(successorRoot, 'teaching-closure-preflight.json'), closure);
  process.stdout.write(`${JSON.stringify({ scopeHash: successorScope.scopeHash, closure: closure.status, dispositionHash: artifact.dispositionHash }, null, 2)}\n`);
}

main();
