import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { projectionDigest } from '@/lib/teaching-projection/hash';

import { resolveLiveLatestKnowledgeCutover } from '../latest-cutover-live';

const SUCCESSOR_RUNTIME = {
  releaseId: 'runtime-150a505ac26b2130278fa269f41830f83a9d97658db4afd0aedddde',
  manifestSha256: 'a'.repeat(64),
  treeSha256: 'b'.repeat(64),
};

const PREDECESSOR_RUNTIME = {
  releaseId: 'runtime-bb309e6a7e1ded281038c4689c98d24e78e5f46db29f7cd2ee50057',
  manifestSha256: '11c8185de8d28768ef8b247039907d50228b28475f989619c1c22eb9bf04ea7b',
  treeSha256: 'c'.repeat(64),
};

function sha256File(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function coordinatedReceiptHash(value: Record<string, unknown>): string {
  return projectionDigest({
    transactionId: value.transactionId ?? null,
    journalHash: value.journalHash ?? null,
    candidateReceiptHash: value.candidateReceiptHash ?? null,
    committedSelectors: value.committedSelectors ?? null,
    mutationReceiptHashes: value.mutationReceiptHashes ?? null,
    runtimeActiveReceiptHash: value.runtimeActiveReceiptHash ?? null,
    runtimeActiveIdentity: value.runtimeActiveIdentity ?? null,
  });
}

function sealReceipt(value: Record<string, unknown>): Record<string, unknown> {
  return { ...value, receiptHash: coordinatedReceiptHash(value) };
}

function digestCandidate(body: Record<string, unknown>): string {
  return projectionDigest({
    candidateId: body.candidateId,
    sealedAt: body.sealedAt,
    allocationHash: body.allocationHash,
    authorityCaptureHash: body.authorityCaptureHash,
    localeQualificationHash: body.localeQualificationHash,
    teachingProjectionHash: body.teachingProjectionHash,
    teachingClosureReceiptHash: body.teachingClosureReceiptHash,
    composedDomainFragmentManifestHash: body.composedDomainFragmentManifestHash,
    domainFragmentSetHash: body.domainFragmentSetHash,
    formalResourceEnvelopeHash: body.formalResourceEnvelopeHash,
    continuityReceiptHash: body.continuityReceiptHash,
    derivationReceiptHash: body.derivationReceiptHash,
    successorRuntimeManifestHash: body.successorRuntimeManifestHash,
    successorRuntimeMaterializationHash: body.successorRuntimeMaterializationHash,
    domainShardCatalogHash: body.domainShardCatalogHash,
    domainShardSetHash: body.domainShardSetHash,
    prerequisitePublicationHash: body.prerequisitePublicationHash,
    consumerActivationHash: body.consumerActivationHash,
    predecessor: body.predecessor,
    predecessorRuntimeLifecycleGeneration: body.predecessorRuntimeLifecycleGeneration,
    successorSelectorExpectations: body.successorSelectorExpectations,
    transactionImplementationIdentity: body.transactionImplementationIdentity,
    rollbackPlanHash: body.rollbackPlanHash,
    verificationPolicyHash: body.verificationPolicyHash,
  });
}

function writeRuntimeReceipt(filePath: string, identity: {
  releaseId: string;
  manifestSha256: string;
  treeSha256?: string | null;
}, generation = 44) {
  writeJson(filePath, {
    schemaVersion: 'runtime-release-active-receipt.v1',
    healthCheck: 'readyz',
    selection: {
      schemaVersion: 'runtime-release-selection.v1',
      generation,
      releaseId: identity.releaseId,
      manifestSha256: identity.manifestSha256,
      treeSha256: identity.treeSha256,
    },
  });
}

const GIT_CANDIDATE = 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c5';

describe('live latest knowledge cutover resolver', () => {
  it('fails closed when the coordinated active receipt is absent', () => {
    const repoRoot = mkdtempSync(path.join(os.tmpdir(), 'latest-cutover-missing-'));
    try {
      expect(resolveLiveLatestKnowledgeCutover({
        repoRoot,
        receiptPath: path.join(repoRoot, 'missing-receipt.json'),
      })).toMatchObject({
        ready: false,
        combination: 'unknown',
        reasons: expect.arrayContaining(['unknown-state']),
      });
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('fails closed when the independent runtime receipt is absent', () => {
    const repoRoot = process.cwd();
    const work = mkdtempSync(path.join(os.tmpdir(), 'latest-cutover-no-runtime-'));
    try {
      const authoritySha = sha256File(
        path.join(repoRoot, 'course-content/authoring/knowledge/authority/current.json'),
      );
      const receiptPath = path.join(work, 'coordinated-active-receipt.json');
      writeJson(receiptPath, sealReceipt({
        contract: 'coordinated-active-receipt/v1',
        receiptId: 'test-missing-runtime',
        transactionId: 'tx-test-missing-runtime',
        journalHash: '1'.repeat(64),
        candidateReceiptHash: '2'.repeat(64),
        committedSelectors: [{ selectorId: 'authority:current', identity: authoritySha }],
        mutationReceiptHashes: [],
        runtimeActiveReceiptHash: '3'.repeat(64),
        runtimeActiveIdentity: SUCCESSOR_RUNTIME,
      }));
      expect(resolveLiveLatestKnowledgeCutover({
        repoRoot,
        receiptPath,
        runtimeReceiptPath: path.join(work, 'missing-runtime-receipt.json'),
      })).toMatchObject({
        ready: false,
        combination: 'unknown',
        reasons: expect.arrayContaining(['unknown-state']),
      });
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });

  it('qualifies the Git successor envelope against an identity-matched receipt', () => {
    const repoRoot = process.cwd();
    const work = mkdtempSync(path.join(os.tmpdir(), 'latest-cutover-successor-'));
    try {
      const authoritySha = sha256File(
        path.join(repoRoot, 'course-content/authoring/knowledge/authority/current.json'),
      );
      const receiptPath = path.join(work, 'coordinated-active-receipt.json');
      const runtimePath = path.join(work, 'act-runtime-active-receipt.json');
      const candidateReceipt = JSON.parse(readFileSync(
        path.join(repoRoot, GIT_CANDIDATE, 'candidate-receipt.json'),
        'utf8',
      )) as { receiptHash: string };
      writeJson(receiptPath, sealReceipt({
        contract: 'coordinated-active-receipt/v1',
        receiptId: 'test-successor',
        transactionId: 'tx-test-successor',
        journalHash: '1'.repeat(64),
        candidateReceiptHash: candidateReceipt.receiptHash,
        committedSelectors: [{ selectorId: 'authority:current', identity: authoritySha }],
        mutationReceiptHashes: [],
        runtimeActiveReceiptHash: '3'.repeat(64),
        runtimeActiveIdentity: SUCCESSOR_RUNTIME,
      }));
      writeRuntimeReceipt(runtimePath, SUCCESSOR_RUNTIME);

      const result = resolveLiveLatestKnowledgeCutover({
        repoRoot,
        receiptPath,
        runtimeReceiptPath: runtimePath,
      });
      expect(result.combination).toBe('successor');
      expect(result.ready).toBe(true);
      expect(result.reasons).toEqual([]);
      // #1738: the resealed fifteen-domain shard set stays qualified while
      // the sealed predecessor set remains in the runtime closure; the
      // drift marker stays observable until the authorized release reseals.
      expect(result.drift).toContain('domain-shard-set-resealed');
      expect(result.identities.authorityCurrentSha256).toBe(authoritySha);
      expect(JSON.stringify(result)).not.toMatch(/\/Users|X-Amz|credential/iu);
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }, 30_000);

  it('keeps an identity-matched predecessor truthful but not latest-ready', () => {
    const work = mkdtempSync(path.join(os.tmpdir(), 'latest-cutover-predecessor-'));
    try {
      const authorityPath = path.join(work, 'authority-current.json');
      writeJson(authorityPath, { predecessor: true });
      const authoritySha = sha256File(authorityPath);
      const candidateDir = path.join(work, 'candidate');
      mkdirSync(candidateDir, { recursive: true });
      writeJson(path.join(candidateDir, 'successor-runtime-manifest-extension.json'), {
        contract: 'coordinated-runtime-manifest-extension/v1',
        predecessorRuntimeReleaseId: PREDECESSOR_RUNTIME.releaseId,
        predecessorRuntimeManifestSha256: PREDECESSOR_RUNTIME.manifestSha256,
        predecessorLifecycleGeneration: 38,
      });
      const candidateBody = {
        contract: 'coordinated-candidate-receipt/v1',
        builderVersion: 'latest-authority-oss-cutover-builder/v1',
        candidateId: 'cand-predecessor-test',
        sealedAt: '2026-08-30T00:00:00.000Z',
        selectable: false,
        allocationHash: 'a'.repeat(64),
        authorityCaptureHash: 'b'.repeat(64),
        localeQualificationHash: 'c'.repeat(64),
        teachingProjectionHash: 'd'.repeat(64),
        teachingClosureReceiptHash: 'e'.repeat(64),
        composedDomainFragmentManifestHash: 'f'.repeat(64),
        domainFragmentSetHash: '1'.repeat(64),
        formalResourceEnvelopeHash: '2'.repeat(64),
        continuityReceiptHash: '3'.repeat(64),
        derivationReceiptHash: '4'.repeat(64),
        successorRuntimeManifestHash: '5'.repeat(64),
        successorRuntimeMaterializationHash: '6'.repeat(64),
        domainShardCatalogHash: '7'.repeat(64),
        domainShardSetHash: '8'.repeat(64),
        prerequisitePublicationHash: '9'.repeat(64),
        consumerActivationHash: '0'.repeat(64),
        predecessor: [{ selectorId: 'authority:current', identity: authoritySha }],
        predecessorRuntimeLifecycleGeneration: 38,
        successorSelectorExpectations: [{
          selectorId: 'authority:current',
          expectedSuccessorIdentity: 'e'.repeat(64),
        }],
        transactionImplementationIdentity: 'a1'.repeat(32),
        rollbackPlanHash: 'b1'.repeat(32),
        verificationPolicyHash: 'c1'.repeat(32),
      };
      const candidateHash = digestCandidate(candidateBody);
      writeJson(path.join(candidateDir, 'candidate-receipt.json'), {
        ...candidateBody,
        receiptHash: candidateHash,
      });
      const receiptPath = path.join(work, 'coordinated-active-receipt.json');
      const runtimePath = path.join(work, 'act-runtime-active-receipt.json');
      writeJson(receiptPath, sealReceipt({
        contract: 'coordinated-active-receipt/v1',
        receiptId: 'test-predecessor',
        transactionId: 'tx-test-predecessor',
        journalHash: '1'.repeat(64),
        candidateReceiptHash: candidateHash,
        committedSelectors: [{ selectorId: 'authority:current', identity: 'e'.repeat(64) }],
        mutationReceiptHashes: [],
        runtimeActiveReceiptHash: '3'.repeat(64),
        runtimeActiveIdentity: SUCCESSOR_RUNTIME,
      }));
      writeRuntimeReceipt(runtimePath, PREDECESSOR_RUNTIME, 38);

      expect(resolveLiveLatestKnowledgeCutover({
        repoRoot: work,
        receiptPath,
        runtimeReceiptPath: runtimePath,
        authorityCurrentPath: authorityPath,
        candidateRoot: candidateDir,
      })).toMatchObject({
        ready: false,
        combination: 'predecessor',
      });
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }, 30_000);

  it('fails closed when the live Runtime reuses the predecessor release under a drifted generation', () => {
    const work = mkdtempSync(path.join(os.tmpdir(), 'latest-cutover-generation-drift-'));
    try {
      const authorityPath = path.join(work, 'authority-current.json');
      writeJson(authorityPath, { predecessor: true });
      const authoritySha = sha256File(authorityPath);
      const candidateDir = path.join(work, 'candidate');
      mkdirSync(candidateDir, { recursive: true });
      writeJson(path.join(candidateDir, 'successor-runtime-manifest-extension.json'), {
        contract: 'coordinated-runtime-manifest-extension/v1',
        predecessorRuntimeReleaseId: PREDECESSOR_RUNTIME.releaseId,
        predecessorRuntimeManifestSha256: PREDECESSOR_RUNTIME.manifestSha256,
        predecessorLifecycleGeneration: 38,
      });
      const candidateBody = {
        contract: 'coordinated-candidate-receipt/v1',
        builderVersion: 'latest-authority-oss-cutover-builder/v1',
        candidateId: 'cand-generation-drift',
        sealedAt: '2026-08-30T00:00:00.000Z',
        selectable: false,
        allocationHash: 'a'.repeat(64),
        authorityCaptureHash: 'b'.repeat(64),
        localeQualificationHash: 'c'.repeat(64),
        teachingProjectionHash: 'd'.repeat(64),
        teachingClosureReceiptHash: 'e'.repeat(64),
        composedDomainFragmentManifestHash: 'f'.repeat(64),
        domainFragmentSetHash: '1'.repeat(64),
        formalResourceEnvelopeHash: '2'.repeat(64),
        continuityReceiptHash: '3'.repeat(64),
        derivationReceiptHash: '4'.repeat(64),
        successorRuntimeManifestHash: '5'.repeat(64),
        successorRuntimeMaterializationHash: '6'.repeat(64),
        domainShardCatalogHash: '7'.repeat(64),
        domainShardSetHash: '8'.repeat(64),
        prerequisitePublicationHash: '9'.repeat(64),
        consumerActivationHash: '0'.repeat(64),
        predecessor: [{ selectorId: 'authority:current', identity: authoritySha }],
        predecessorRuntimeLifecycleGeneration: 38,
        successorSelectorExpectations: [{
          selectorId: 'authority:current',
          expectedSuccessorIdentity: 'e'.repeat(64),
        }],
        transactionImplementationIdentity: 'a1'.repeat(32),
        rollbackPlanHash: 'b1'.repeat(32),
        verificationPolicyHash: 'c1'.repeat(32),
      };
      const candidateHash = digestCandidate(candidateBody);
      writeJson(path.join(candidateDir, 'candidate-receipt.json'), {
        ...candidateBody,
        receiptHash: candidateHash,
      });
      const receiptPath = path.join(work, 'coordinated-active-receipt.json');
      const runtimePath = path.join(work, 'act-runtime-active-receipt.json');
      writeJson(receiptPath, sealReceipt({
        contract: 'coordinated-active-receipt/v1',
        receiptId: 'test-generation-drift',
        transactionId: 'tx-test-generation-drift',
        journalHash: '1'.repeat(64),
        candidateReceiptHash: candidateHash,
        committedSelectors: [{ selectorId: 'authority:current', identity: 'e'.repeat(64) }],
        mutationReceiptHashes: [],
        runtimeActiveReceiptHash: '3'.repeat(64),
        runtimeActiveIdentity: SUCCESSOR_RUNTIME,
      }));
      writeRuntimeReceipt(runtimePath, PREDECESSOR_RUNTIME, 44);

      expect(resolveLiveLatestKnowledgeCutover({
        repoRoot: work,
        receiptPath,
        runtimeReceiptPath: runtimePath,
        authorityCurrentPath: authorityPath,
        candidateRoot: candidateDir,
      })).toMatchObject({
        ready: false,
        combination: 'unknown',
        reasons: expect.arrayContaining(['unknown-state']),
      });
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }, 30_000);

  it('fails closed when the runtime receipt is not the sealed active-receipt schema', () => {
    const repoRoot = process.cwd();
    const work = mkdtempSync(path.join(os.tmpdir(), 'latest-cutover-stub-runtime-'));
    try {
      const receiptPath = path.join(work, 'coordinated-active-receipt.json');
      const runtimePath = path.join(work, 'act-runtime-active-receipt.json');
      writeJson(receiptPath, sealReceipt({
        contract: 'coordinated-active-receipt/v1',
        receiptId: 'test-stub-runtime',
        transactionId: 'tx-test-stub-runtime',
        journalHash: '1'.repeat(64),
        candidateReceiptHash: '2'.repeat(64),
        committedSelectors: [{ selectorId: 'authority:current', identity: 'e'.repeat(64) }],
        mutationReceiptHashes: [],
        runtimeActiveReceiptHash: '3'.repeat(64),
        runtimeActiveIdentity: SUCCESSOR_RUNTIME,
      }));
      writeJson(runtimePath, { runtimeActiveIdentity: SUCCESSOR_RUNTIME });
      expect(resolveLiveLatestKnowledgeCutover({
        repoRoot,
        receiptPath,
        runtimeReceiptPath: runtimePath,
      })).toMatchObject({
        ready: false,
        combination: 'unknown',
      });
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });

  it('wires the v0.37 candidate into the image fallback and production mount', () => {
    const repoRoot = process.cwd();
    const dockerignore = readFileSync(path.join(repoRoot, '.dockerignore'), 'utf8');
    const dockerfile = readFileSync(path.join(repoRoot, 'Dockerfile'), 'utf8');
    const deploy = readFileSync(path.join(repoRoot, 'deploy/podman/deploy.sh'), 'utf8');
    expect(dockerignore).toContain(
      'cutover/candidates/control-theory-engineering-v0.37-r4-c5/**',
    );
    expect(dockerfile).toContain(
      'cutover/candidates/control-theory-engineering-v0.37-r4-c5',
    );
    expect(deploy).toContain('ACT_LATEST_CUTOVER_CANDIDATE_ROOT');
    expect(deploy).toContain('LATEST_CUTOVER_CANDIDATE_DIR');
    expect(deploy).toContain(
      'LATEST_CUTOVER_CANDIDATE_DIR}:${ACT_LATEST_CUTOVER_CANDIDATE_ROOT}',
    );
  });
});
