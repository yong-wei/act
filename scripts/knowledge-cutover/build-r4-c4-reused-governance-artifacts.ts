#!/usr/bin/env tsx
/**
 * Bind verified historical resource and teaching-governance evidence into the
 * current r4-c4 allocation. This is a one-time baseline closure operation,
 * not a reviewer queue: every source artifact is reopened and the semantic
 * cache must prove the Authority surface is unchanged before reuse.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { ActTeachingFamilyDisposition } from '@/lib/act-canonical-teaching-relations/contracts';
import {
  reopenResourceEnvelope,
  type RemediationResourceEnvelope,
} from '@/lib/formal-resource-remediation/envelope';
import type { ResourceProcessingRecord } from '@/lib/formal-resource-remediation/contracts';
import {
  reopenAuthorityCaptureReceipt,
} from '@/lib/latest-authority-oss-cutover/capture';
import {
  assertAllocationRecordSealed,
  sealCoordinationAllocationRecord,
  type CoordinationAllocationRecord,
} from '@/lib/latest-authority-oss-cutover/envelope';
import { evaluateTeachingClosure } from '@/lib/latest-authority-oss-cutover/teaching-closure';
import { projectionDigest } from '@/lib/teaching-projection/hash';

const ROOT = process.cwd();
const CANDIDATE_ROOT = 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c4';
const REMEDIATION_ROOT = 'course-content/authoring/knowledge/formal-resource-remediation';
const RECORD_PATHS = [
  `${REMEDIATION_ROOT}/resource-layer/text/text-processing-records.json`,
  `${REMEDIATION_ROOT}/20260823-asr-batch/asr-processing-records.json`,
  `${REMEDIATION_ROOT}/resource-layer/exercises/exercise-processing-records.json`,
  `${REMEDIATION_ROOT}/resource-layer/intro-videos/intro-video-processing-records.json`,
  `${REMEDIATION_ROOT}/resource-layer/simulations/simulation-processing-records.json`,
  `${REMEDIATION_ROOT}/resource-layer/handout-exercises/handout-exercise-processing-records.json`,
] as const;
const DOMAINS = [
  'root-locus',
  'robustness-sensitivity-analysis',
  'stability-analysis',
  'nonlinear-system-analysis',
  'time-domain-analysis',
  'system-modeling',
  'classical-control-design',
  'frequency-domain-analysis',
  'state-space-control-analysis-and-design',
  'robust-control-analysis-and-design',
  'discrete-time-control-analysis',
  'discrete-time-control-design',
  'optimal-control-foundations-and-linear-quadratic-design',
  'lyapunov-stability',
  'nonlinear-control-design',
] as const;

interface SemanticCache {
  readonly contract: 'authority-semantic-cache/v1';
  readonly summary: { readonly recomputedCount: number; readonly retiredCount: number };
  readonly cacheHash: string;
}

interface BaselineClassification {
  readonly baseline: {
    readonly activeRelease: {
      readonly releaseId: string;
      readonly manifestSha256: string;
      readonly treeSha256: string;
      readonly activeReceiptHash: string;
      readonly lifecycleGeneration: number;
    };
    readonly entries: readonly unknown[];
    readonly baselineHash: string;
  };
}

interface DeltaArtifact {
  readonly orderedInputs: readonly unknown[];
  readonly combinedDenominator: { readonly denominatorHash: string };
}

interface ScopeArtifact {
  readonly scopeHash: string;
  readonly members: readonly { readonly canonicalId: string }[];
}

interface LedgerRow {
  readonly canonicalId: string;
  readonly family: 'containment' | 'prerequisite' | 'association';
  readonly disposition: 'COURSE_ROOT' | 'NO_RELATION' | 'PUBLISHED_EDGE';
  readonly edgeId: string | null;
  readonly evidenceRefs: readonly string[];
}

function absolute(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(absolute(filePath), 'utf8')) as T;
}

function sha256File(filePath: string): string {
  return sha256(readFileSync(absolute(filePath)));
}

function immutableWrite(filePath: string, value: unknown): 'created' | 'verified' {
  const target = absolute(filePath);
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  mkdirSync(path.dirname(target), { recursive: true });
  if (existsSync(target)) {
    if (!readFileSync(target).equals(bytes)) throw new Error(`refusing to overwrite immutable artifact ${filePath}`);
    return 'verified';
  }
  writeFileSync(target, bytes);
  return 'created';
}

function allocationFor(input: {
  readonly capturePath: string;
  readonly scopeHash: string;
  readonly denominatorHash: string;
  readonly transactionImplementationIdentity: string;
}): CoordinationAllocationRecord {
  const allocationPath = `${CANDIDATE_ROOT}/allocation.json`;
  const capture = reopenAuthorityCaptureReceipt(readJson(input.capturePath));
  if (existsSync(absolute(allocationPath))) {
    const allocation = readJson<CoordinationAllocationRecord>(allocationPath);
    assertAllocationRecordSealed(allocation);
    if (allocation.captureHash !== capture.captureHash
      || allocation.scopeHash !== input.scopeHash
      || allocation.denominatorHash !== input.denominatorHash
      || allocation.implementationIdentities.transaction !== input.transactionImplementationIdentity) {
      throw new Error('existing c4 allocation does not bind the current capture, scope, denominator, and transaction implementation');
    }
    return allocation;
  }
  const allocation = sealCoordinationAllocationRecord({
    sealedAt: new Date().toISOString(),
    capture: { captureHash: capture.captureHash, compatibility: capture.compatibility },
    scopeHash: input.scopeHash,
    denominatorHash: input.denominatorHash,
    policyVersions: {
      continuity: 'resource-continuity/v1',
      teachingClosure: 'coordinated-teaching-closure/v1',
      rollback: 'coordinated-cutover-rollback/v1',
    },
    implementationIdentities: {
      builder: 'latest-authority-oss-cutover-builder/v1',
      transaction: input.transactionImplementationIdentity,
    },
  });
  immutableWrite(allocationPath, allocation);
  return allocation;
}

function sourceEnvelope(): {
  readonly envelope: RemediationResourceEnvelope;
  readonly sourceEnvelopeSha256: string;
  readonly processingRecords: readonly ResourceProcessingRecord[];
} {
  const envelopePath = `${REMEDIATION_ROOT}/resource-envelope.json`;
  const envelope = readJson<RemediationResourceEnvelope>(envelopePath);
  const processingRecords = RECORD_PATHS.flatMap((recordPath) => readJson<ResourceProcessingRecord[]>(recordPath));
  const reopened = reopenResourceEnvelope({
    envelope,
    processingRecords,
    artifactSha256: sha256File,
  });
  if (reopened.state !== 'SEALED') {
    throw new Error(`historical formal resource envelope did not reopen: ${reopened.checks.filter((check) => !check.passed).map((check) => check.name).join(', ')}`);
  }
  return { envelope, sourceEnvelopeSha256: sha256File(envelopePath), processingRecords };
}

function teachingDispositions(scope: ScopeArtifact): readonly ActTeachingFamilyDisposition[] {
  const memberIds = new Set(scope.members.map((member) => member.canonicalId));
  if (memberIds.size !== scope.members.length) throw new Error('c4 scope repeats a Canonical member');
  const rows = DOMAINS.flatMap((domain) => readJson<{ readonly rows: readonly LedgerRow[] }>(
    `${REMEDIATION_ROOT}/${domain}-closure/final-ledger.json`,
  ).rows.map((row) => ({ domain, row })));
  if (rows.length !== scope.members.length * 3) {
    throw new Error(`historical teaching ledgers have ${rows.length} rows, expected ${scope.members.length * 3}`);
  }
  const results = rows.map(({ domain, row }) => {
    if (!memberIds.has(row.canonicalId)) throw new Error(`historical teaching ledger member is absent from c4 scope: ${row.canonicalId}`);
    if (row.disposition === 'PUBLISHED_EDGE' && (!row.edgeId || row.evidenceRefs.length === 0)) {
      throw new Error(`historical published teaching relation is incomplete: ${row.canonicalId}/${row.family}`);
    }
    if (row.disposition === 'NO_RELATION' && row.evidenceRefs.length === 0) {
      throw new Error(`historical no-relation decision lacks evidence: ${row.canonicalId}/${row.family}`);
    }
    return {
      scopeHash: scope.scopeHash,
      canonicalId: row.canonicalId,
      family: row.family,
      kind: row.disposition,
      edgeId: row.edgeId,
      evidenceRefs: row.evidenceRefs,
      rationale: `reopened three-family ledger:${domain}`,
    } satisfies ActTeachingFamilyDisposition;
  }).sort((left, right) => (
    left.canonicalId.localeCompare(right.canonicalId)
    || left.family.localeCompare(right.family)
  ));
  const keys = new Set(results.map((row) => `${row.canonicalId}\u0000${row.family}`));
  if (keys.size !== results.length) throw new Error('historical teaching ledgers repeat a member/family disposition');
  return results;
}

function main(): void {
  const semanticCache = readJson<SemanticCache>(`${CANDIDATE_ROOT}/authority-semantic-cache.json`);
  if (semanticCache.contract !== 'authority-semantic-cache/v1'
    || semanticCache.summary.recomputedCount !== 0
    || semanticCache.summary.retiredCount !== 0) {
    throw new Error('r4 semantic cache cannot support historical governance reuse');
  }
  const classification = readJson<BaselineClassification>(`${CANDIDATE_ROOT}/active-baseline/active-baseline-classification.json`);
  const delta = readJson<DeltaArtifact>(`${CANDIDATE_ROOT}/active-baseline/explicit-successor-delta.json`);
  const scope = readJson<ScopeArtifact>(`${CANDIDATE_ROOT}/domain-catalog/scope.json`);
  if (!/^[a-f0-9]{64}$/u.test(scope.scopeHash) || !/^[a-f0-9]{64}$/u.test(delta.combinedDenominator.denominatorHash)) {
    throw new Error('c4 scope or denominator is not sealed');
  }
  const transactionImplementationIdentity = sha256File('scripts/knowledge-cutover/production-cutover.ts');
  const allocation = allocationFor({
    capturePath: `${CANDIDATE_ROOT}/authority-capture/authority-capture.json`,
    scopeHash: scope.scopeHash,
    denominatorHash: delta.combinedDenominator.denominatorHash,
    transactionImplementationIdentity,
  });
  const capture = reopenAuthorityCaptureReceipt(readJson(`${CANDIDATE_ROOT}/authority-capture/authority-capture.json`));
  const source = sourceEnvelope();
  const resourceEnvelope = {
    contract: 'coordinated-formal-resource-envelope-reuse/v1',
    allocationHash: allocation.allocationHash,
    authorityCaptureHash: capture.captureHash,
    scopeHash: scope.scopeHash,
    semanticCacheHash: semanticCache.cacheHash,
    sourceEnvelope: {
      contract: source.envelope.contract,
      allocationHash: source.envelope.allocationHash,
      envelopeHash: source.envelope.envelopeHash,
      envelopeSha256: source.sourceEnvelopeSha256,
      resourceCount: source.envelope.resourceCount,
      atomCount: source.envelope.atomCount,
      bindingCount: source.envelope.bindingCount,
      artifactCount: source.envelope.artifacts.length,
    },
    envelopeHash: '',
  };
  const { envelopeHash: ignoredResourceEnvelopeHash, ...resourceEnvelopeHashInput } = resourceEnvelope;
  void ignoredResourceEnvelopeHash;
  const formalResourceEnvelope = {
    ...resourceEnvelope,
    envelopeHash: projectionDigest(resourceEnvelopeHashInput),
  };
  immutableWrite(`${CANDIDATE_ROOT}/formal-resource-envelope.json`, formalResourceEnvelope);

  const dispositions = teachingDispositions(scope);
  const closure = evaluateTeachingClosure({
    scopeHash: scope.scopeHash,
    authorityCaptureHash: capture.captureHash,
    members: scope.members,
    dispositions,
    candidates: [],
    decisions: [],
  });
  if (closure.status !== 'COMPLETE') {
    throw new Error(`c4 teaching closure is incomplete: ${closure.familyCounts.map((row) => `${row.family}:${row.unresolvedCount}`).join(', ')}`);
  }
  immutableWrite(`${CANDIDATE_ROOT}/teaching-dispositions.json`, {
    contract: 'coordinated-teaching-disposition-reuse/v1',
    allocationHash: allocation.allocationHash,
    authorityCaptureHash: capture.captureHash,
    scopeHash: scope.scopeHash,
    semanticCacheHash: semanticCache.cacheHash,
    sourceTotalClosureSha256: sha256File(`${REMEDIATION_ROOT}/total-closure-receipt.json`),
    dispositions,
    dispositionHash: projectionDigest(dispositions),
  });
  immutableWrite(`${CANDIDATE_ROOT}/teaching-closure-preflight.json`, closure);
  const derivation = {
    contract: 'coordinated-baseline-derivation-receipt/v1',
    allocationHash: allocation.allocationHash,
    semanticCacheHash: semanticCache.cacheHash,
    resourceEnvelopeHash: formalResourceEnvelope.envelopeHash,
    dispositionHash: projectionDigest(dispositions),
    reusedAuthorityRecordCount: semanticCache.summary.recomputedCount === 0
      ? source.processingRecords.length + dispositions.length
      : 0,
    recomputedAuthorityRecordCount: semanticCache.summary.recomputedCount,
    receiptHash: '',
  };
  const { receiptHash: ignoredDerivationReceiptHash, ...derivationHashInput } = derivation;
  void ignoredDerivationReceiptHash;
  const derivationReceipt = {
    ...derivation,
    receiptHash: projectionDigest(derivationHashInput),
  };
  immutableWrite(`${CANDIDATE_ROOT}/derivation-receipt.json`, derivationReceipt);
  process.stdout.write(`${JSON.stringify({
    allocationHash: allocation.allocationHash,
    formalResourceEnvelopeHash: formalResourceEnvelope.envelopeHash,
    teachingClosure: closure.status,
    teachingClosureReceiptHash: closure.receiptHash,
    resourceRecordCount: source.processingRecords.length,
    teachingDispositionCount: dispositions.length,
    derivationReceiptHash: derivationReceipt.receiptHash,
    baselineHash: classification.baseline.baselineHash,
    denominatorHash: delta.combinedDenominator.denominatorHash,
  }, null, 2)}\n`);
}

main();
