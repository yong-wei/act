#!/usr/bin/env tsx
/**
 * Build the immutable c5 input for the existing coordinated candidate
 * compiler. r4 semantic governance is reused only when the freshly observed
 * v0.22 predecessor still equals the frozen c4 baseline; this is the normal
 * incremental path after the one-time historical baseline closure.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { projectionDigest } from '@/lib/teaching-projection/hash';
import {
  buildActiveBaseline,
  buildCombinedDenominator,
  buildExplicitDelta,
  type ActiveBaselineEntry,
  type ExplicitDeltaInput,
} from '@/lib/latest-authority-oss-cutover/denominator';
import { reopenAuthorityCaptureReceipt } from '@/lib/latest-authority-oss-cutover/capture';
import {
  assertAllocationRecordSealed,
  sealCoordinationAllocationRecord,
} from '@/lib/latest-authority-oss-cutover/envelope';

const ROOT = process.cwd();
const C4 = 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c4';

function fail(message: string): never {
  throw new Error(`build-r4-c5-cutover-input: ${message}`);
}

function option(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (!value || value.startsWith('--')) fail(`missing ${name}`);
  return value;
}

function absolute(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(absolute(filePath), 'utf8')) as T;
}

function sha256File(filePath: string): string {
  return createHash('sha256').update(readFileSync(absolute(filePath))).digest('hex');
}

function requireDigest(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) fail(`${label} must be a SHA-256 digest`);
}

function requireTimestamp(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) {
    fail('--sealed-at must be a millisecond RFC3339 UTC timestamp');
  }
}

function immutableWrite(filePath: string, value: unknown): void {
  const target = absolute(filePath);
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  mkdirSync(path.dirname(target), { recursive: true });
  if (existsSync(target) && !readFileSync(target).equals(bytes)) fail(`refusing to overwrite ${filePath}`);
  if (!existsSync(target)) writeFileSync(target, bytes);
}

function main(): void {
  const prestage = process.argv.includes('--prestage');
  const predecessor = readJson<{
    contract: string;
    runtime: { releaseId: string; manifestSha256: string; treeSha256: string; activeReceiptHash: string; lifecycleGeneration: number };
    stagedDesired: { releaseId: string; manifestSha256: string; treeSha256: string } | null;
    selectors: { authority: { sha256: string; value: Record<string, unknown> } };
    observationHash: string;
  }>(option('--predecessor'));
  const out = option('--out');
  const sealedAt = option('--sealed-at');
  requireTimestamp(sealedAt);
  const runtimeStage = prestage ? null : readJson<{
    contract: string;
    runtimeRelease: { releaseId: string; manifestSha256: string; treeSha256: string };
    materializationReceiptSha256: string;
  }>(option('--runtime-stage'));
  if (runtimeStage !== null && runtimeStage.contract !== 'coordinated-runtime-stage/v1') {
    fail('runtime stage contract is invalid');
  }
  for (const value of [
    ...(runtimeStage === null ? [] : [
      runtimeStage.runtimeRelease.manifestSha256,
      runtimeStage.runtimeRelease.treeSha256,
      runtimeStage.materializationReceiptSha256,
    ]),
    predecessor.runtime.manifestSha256,
    predecessor.runtime.treeSha256,
    predecessor.runtime.activeReceiptHash,
    predecessor.selectors.authority.sha256,
    predecessor.observationHash,
  ]) requireDigest(value, 'stage/predecessor identity');
  if (predecessor.contract !== 'r4-production-predecessor-observation/v1'
    || !Number.isInteger(predecessor.runtime.lifecycleGeneration)
    || predecessor.runtime.lifecycleGeneration < 1) fail('production predecessor is invalid');
  if (prestage && predecessor.stagedDesired !== null) {
    fail('prestage reuse must begin from an idle Runtime lifecycle');
  }
  if (runtimeStage !== null && JSON.stringify(predecessor.stagedDesired) !== JSON.stringify(runtimeStage.runtimeRelease)) {
    fail('fresh predecessor observation is not the expected staged Runtime lifecycle');
  }

  const classification = readJson<{
    activeRelease: { releaseId: string; manifestSha256: string; treeSha256: string; lifecycleGeneration: number };
    entries: unknown[];
  }>(`${C4}/active-baseline/active-baseline-classification.json`);
  const obligations = readJson<{ entries: { disposition: unknown }[] }>(`${C4}/active-baseline/baseline-continuity-obligations.json`);
  const delta = readJson<{ orderedInputs: unknown[]; combinedDenominator: { denominatorHash: string } }>(`${C4}/active-baseline/explicit-successor-delta.json`);
  const teaching = readJson<{ dispositions: unknown[] }>(`${C4}/teaching-dispositions.json`);
  const scope = readJson<{ scopeHash: string; members: { canonicalId: string }[] }>(`${C4}/domain-catalog/scope.json`);
  const semanticCache = readJson<{ contract: string; cacheHash: string; summary: { recomputedCount: number; retiredCount: number } }>(`${C4}/authority-semantic-cache.json`);
  const capture = reopenAuthorityCaptureReceipt(readJson(`${C4}/authority-capture/authority-capture.json`));
  const resourceEnvelope = readJson<{ envelopeHash: string }>(`${C4}/formal-resource-envelope.json`);
  const derivation = readJson<{ receiptHash: string }>(`${C4}/derivation-receipt.json`);
  const selectors = readJson<{
    selectors: {
      projection: { projectionHash: string };
      prerequisite: { publicationHash: string };
      catalog: { catalogHash: string };
      shards: { shardSetHash: string };
      consumerActivation: { activationHash: string };
    };
  }>(`${C4}/runtime-selector-set.json`);
  if (semanticCache.contract !== 'authority-semantic-cache/v1'
    || semanticCache.summary.recomputedCount !== 0
    || semanticCache.summary.retiredCount !== 0) fail('r4 semantic cache is not reusable');
  for (const value of [scope.scopeHash, semanticCache.cacheHash, capture.captureHash, resourceEnvelope.envelopeHash, derivation.receiptHash,
    selectors.selectors.projection.projectionHash, selectors.selectors.prerequisite.publicationHash,
    selectors.selectors.catalog.catalogHash, selectors.selectors.shards.shardSetHash, selectors.selectors.consumerActivation.activationHash]) {
    requireDigest(value, 'frozen r4 identity');
  }
  const baseline = classification.activeRelease;
  if (baseline.releaseId !== predecessor.runtime.releaseId
    || baseline.manifestSha256 !== predecessor.runtime.manifestSha256
    || baseline.treeSha256 !== predecessor.runtime.treeSha256
    || baseline.activeReceiptHash !== predecessor.runtime.activeReceiptHash) {
    fail('fresh production predecessor drifted from the frozen c4 baseline; rebuild the affected increment instead of reusing it');
  }
  const authority = predecessor.selectors.authority.value;
  if (authority.snapshotId !== 'snap-9c4b2c1c2c976b4903bb979889d8b74a8dd306bc718cd4c9d06ac97b14172151'
    || authority.releaseId !== 'ctr:release:control-theory-engineering-v0.22') {
    fail('Authority predecessor does not match the expected v0.22 activation');
  }
  const transactionImplementationIdentity = sha256File('scripts/knowledge-cutover/remote-activate-r4-coordinated-cutover.sh');
  const rebuiltBaseline = buildActiveBaseline({
    // The c4 denominator is a frozen semantic resource inventory. A
    // non-selectable Runtime stage increments lifecycle generation without
    // changing that inventory, so lifecycle fencing remains separate below.
    activeRelease: baseline,
    entries: classification.entries as ActiveBaselineEntry[],
  });
  const rebuiltDelta = buildExplicitDelta(delta.orderedInputs as ExplicitDeltaInput[]);
  const rebuiltDenominator = buildCombinedDenominator(rebuiltBaseline, rebuiltDelta);
  if (rebuiltDenominator.denominatorHash !== delta.combinedDenominator.denominatorHash) {
    fail('reopened c4 baseline and delta do not reproduce the frozen denominator');
  }
  const allocationPath = path.join(out, 'allocation.json');
  const allocation = prestage
    ? sealCoordinationAllocationRecord({
      sealedAt,
      capture: { captureHash: capture.captureHash, compatibility: capture.compatibility },
      scopeHash: scope.scopeHash,
      denominatorHash: rebuiltDenominator.denominatorHash,
      policyVersions: {
        continuity: 'resource-continuity/v1',
        teachingClosure: 'coordinated-teaching-closure/v1',
        rollback: 'coordinated-cutover-rollback/v1',
      },
      implementationIdentities: {
        builder: 'latest-authority-oss-cutover-builder/v1',
        transaction: transactionImplementationIdentity,
      },
    })
    : readJson<ReturnType<typeof sealCoordinationAllocationRecord>>(allocationPath);
  assertAllocationRecordSealed(allocation);
  if (allocation.captureHash !== capture.captureHash
    || allocation.scopeHash !== scope.scopeHash
    || allocation.denominatorHash !== rebuiltDenominator.denominatorHash
    || allocation.implementationIdentities.transaction !== transactionImplementationIdentity) {
    fail('presealed c5 allocation does not bind the reopened baseline and transaction implementation');
  }
  const formalResourceEnvelope = {
    contract: 'coordinated-formal-resource-envelope-incremental-reuse/v1',
    allocationHash: allocation.allocationHash,
    authorityCaptureHash: capture.captureHash,
    scopeHash: scope.scopeHash,
    semanticCacheHash: semanticCache.cacheHash,
    priorEnvelopeHash: resourceEnvelope.envelopeHash,
    envelopeHash: '',
  };
  const { envelopeHash: ignoredFormalEnvelopeHash, ...formalEnvelopeHashInput } = formalResourceEnvelope;
  void ignoredFormalEnvelopeHash;
  const c5FormalResourceEnvelope = {
    ...formalResourceEnvelope,
    envelopeHash: projectionDigest(formalEnvelopeHashInput),
  };
  const c5Derivation = {
    contract: 'coordinated-baseline-derivation-incremental-reuse/v1',
    allocationHash: allocation.allocationHash,
    semanticCacheHash: semanticCache.cacheHash,
    priorDerivationReceiptHash: derivation.receiptHash,
    formalResourceEnvelopeHash: c5FormalResourceEnvelope.envelopeHash,
    reusedBaselineEntries: classification.entries.length,
    receiptHash: '',
  };
  const { receiptHash: ignoredDerivationHash, ...derivationHashInput } = c5Derivation;
  void ignoredDerivationHash;
  const c5DerivationReceipt = { ...c5Derivation, receiptHash: projectionDigest(derivationHashInput) };
  if (prestage) {
    immutableWrite(allocationPath, allocation);
    immutableWrite(path.join(out, 'formal-resource-envelope.json'), c5FormalResourceEnvelope);
    immutableWrite(path.join(out, 'derivation-receipt.json'), c5DerivationReceipt);
    immutableWrite(path.join(out, 'prestage-predecessor-observation.json'), predecessor);
    immutableWrite(path.join(out, 'prestage-reuse-receipt.json'), {
      contract: 'r4-c5-prestage-incremental-reuse/v1',
      allocationHash: allocation.allocationHash,
      c4SemanticCacheHash: semanticCache.cacheHash,
      predecessorObservationHash: predecessor.observationHash,
      formalResourceEnvelopeHash: c5FormalResourceEnvelope.envelopeHash,
      derivationReceiptHash: c5DerivationReceipt.receiptHash,
      reusedBaselineEntries: classification.entries.length,
      reusedContinuityObligations: obligations.entries.length,
      reusedTeachingDispositions: teaching.dispositions.length,
      recomputedAuthorityEntries: 0,
    });
    process.stdout.write(`${path.resolve(ROOT, out)}\n`);
    return;
  }
  const persistedFormalEnvelope = readJson<typeof c5FormalResourceEnvelope>(path.join(out, 'formal-resource-envelope.json'));
  const persistedDerivation = readJson<typeof c5DerivationReceipt>(path.join(out, 'derivation-receipt.json'));
  if (persistedFormalEnvelope.envelopeHash !== c5FormalResourceEnvelope.envelopeHash
    || persistedDerivation.receiptHash !== c5DerivationReceipt.receiptHash) {
    fail('prestage formal reuse artifacts do not match the reopened allocation');
  }
  const successorAuthority = {
    contract: 'actkg-engineering-authority-current/v1',
    snapshotId: 'snap-0d9014eb9041af5b339084c3ceb7a64b007ef852519386e4c2239ed4aee7fd1a',
    snapshotHash: '0d9014eb9041af5b339084c3ceb7a64b007ef852519386e4c2239ed4aee7fd1a',
    releaseId: 'ctr:release:control-theory-engineering-v0.37',
    releaseSetId: 'actkg-authoritative-candidate-control-theory-engineering-v0.37-r4',
    activationReceiptId: 'coordinated-r4-c5-authority',
    activatedAt: sealedAt,
  };
  const successorAuthorityPath = path.join(out, 'authority-current.json');
  immutableWrite(successorAuthorityPath, successorAuthority);
  const successorAuthorityIdentity = sha256File(successorAuthorityPath);
  const rollbackPlanHash = projectionDigest({
    authorityBefore: predecessor.selectors.authority.sha256,
    authorityAfter: successorAuthorityIdentity,
    runtimeBefore: predecessor.runtime,
    runtimeAfter: runtimeStage.runtimeRelease,
  });
  const verificationPolicyHash = projectionDigest({
    contract: 'r4-c5-coordinated-production-verification/v1',
    semanticCacheHash: semanticCache.cacheHash,
    requireFinalReceiptBeforeConsumerRestart: true,
    sourceRevisionMustBeIntegrationAncestor: true,
  });
  const input = {
    activeRelease: baseline,
    runtimePredecessorForBinding: predecessor.runtime,
    entries: classification.entries,
    delta: delta.orderedInputs,
    dispositions: obligations.entries.map((entry) => entry.disposition),
    scope,
    teaching: { dispositions: teaching.dispositions, candidates: [], decisions: [] },
    inner: {
      localeQualificationHash: sha256File('course-content/authoring/knowledge/releases/control-theory-engineering-v0.37-r4/locale-manifest.json'),
      teachingProjectionHash: selectors.selectors.projection.projectionHash,
      formalResourceEnvelopeHash: persistedFormalEnvelope.envelopeHash,
      derivationReceiptHash: persistedDerivation.receiptHash,
      successorRuntimeManifest: runtimeStage.runtimeRelease,
      successorRuntimeMaterializationHash: runtimeStage.materializationReceiptSha256,
      domainShardCatalogHash: selectors.selectors.catalog.catalogHash,
      domainShardSetHash: selectors.selectors.shards.shardSetHash,
      prerequisitePublicationHash: selectors.selectors.prerequisite.publicationHash,
      consumerActivationHash: selectors.selectors.consumerActivation.activationHash,
    },
    predecessor: [{ selectorId: 'authority:current', identity: predecessor.selectors.authority.sha256 }],
    predecessorRuntimeLifecycleGeneration: predecessor.runtime.lifecycleGeneration,
    successorSelectorExpectations: [{ selectorId: 'authority:current', expectedSuccessorIdentity: successorAuthorityIdentity }],
    transactionImplementationIdentity,
    rollbackPlanHash,
    verificationPolicyHash,
    allocation,
  };
  immutableWrite(path.join(out, 'prepare-input.json'), input);
  immutableWrite(path.join(out, 'predecessor-observation.json'), predecessor);
  immutableWrite(path.join(out, 'runtime-stage.json'), runtimeStage);
  immutableWrite(path.join(out, 'reuse-receipt.json'), {
    contract: 'r4-c5-incremental-reuse/v1',
    c4SemanticCacheHash: semanticCache.cacheHash,
    predecessorObservationHash: predecessor.observationHash,
    reusedBaselineEntries: classification.entries.length,
    reusedContinuityObligations: obligations.entries.length,
    reusedTeachingDispositions: teaching.dispositions.length,
    recomputedAuthorityEntries: 0,
    receiptHash: projectionDigest({
      c4SemanticCacheHash: semanticCache.cacheHash,
      predecessorObservationHash: predecessor.observationHash,
      runtimeRelease: runtimeStage.runtimeRelease,
      authoritySuccessorIdentity: successorAuthorityIdentity,
    }),
  });
  process.stdout.write(`${path.resolve(ROOT, out)}\n`);
}

main();
