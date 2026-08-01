import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  FIRST_STAGED_BUNDLE_ID,
  FIRST_STAGED_RELEASE_ID,
  ADMISSION_PROTOCOL,
  admitLatestActkgAggregate,
  buildAdmissionPlan,
  compareSelectorGateSnapshots,
  parseBinding,
  type ChainAdmissionLock,
  type ChainAdmissionReceipt,
  type SelectorGateSnapshot,
} from '../../../scripts/knowledge-cutover/admit-latest-actkg-aggregate';
import type { LatestStableAggregateBinding } from '../../../scripts/actkg-release/latest-stable-aggregate';

const digest = (char: string): string => char.repeat(64);

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function binding(candidateChain: string[], admittedEndpoint?: string): LatestStableAggregateBinding {
  return {
    protocol: 'act-latest-stable-aggregate-binding/1',
    selectionPolicy: 'LATEST_STABLE_AGGREGATE',
    actkgMainCommit: 'a'.repeat(40),
    sourceCommit: 'b'.repeat(40),
    sourceTag: 'v0.3',
    packagingCommit: 'c'.repeat(40),
    stableTag: 'v0.3',
    releaseId: FIRST_STAGED_RELEASE_ID,
    releaseVersion: 'control-theory-engineering-v0.3',
    bundleRevision: 2,
    releaseHash: digest('1'),
    sourceDatasetHash: digest('2'),
    bundleId: FIRST_STAGED_BUNDLE_ID,
    bundleDigest: digest('3'),
    manifestSha256: digest('4'),
    sha256sumsSha256: digest('5'),
    validationReportSha256: digest('6'),
    schemaVersion: '0.2.0',
    schemaSha256: digest('7'),
    predecessorBundleId: null,
    candidateChain,
    candidateChainEndpoints: candidateChain,
    statistics: {},
    bundlePath: 'releases/control-theory-engineering-v0.3-r2',
    predecessorRootClosure: null,
    resolutionDigest: digest('8'),
    ...(admittedEndpoint ? { admittedEndpoint: { bundleId: admittedEndpoint } } : {}),
  } as LatestStableAggregateBinding;
}

function lock(entry: {
  bundleId: string;
  bundleDigest: string;
  releaseId: string;
  releaseVersion: string;
  releaseHash: string;
}): ChainAdmissionLock {
  return {
    lock_version: 'actkg-release-set-lock/v3',
    release_set_id: 'actkg-authoritative-candidate-v2',
    bundle: {
      controlled_path: `releases/${entry.bundleId}`,
      bundle_id: entry.bundleId,
      bundle_revision: 2,
      bundle_digest: entry.bundleDigest,
      manifest_raw_sha256: digest('9'),
    },
    release: {
      release_id: entry.releaseId,
      release_version: entry.releaseVersion,
      release_hash: entry.releaseHash,
      source_dataset_hash: digest('a'),
    },
    compatibility: {
      bundle_contract_version: 'actkg-public-bundle/1',
      schema_version: '0.2.0',
      schema_sha256: digest('b'),
    },
    source_revision: { commit: 'd'.repeat(40), tag: 'v0.3' },
    components: [],
  };
}

function receipt(entries: ChainAdmissionReceipt['chain']): ChainAdmissionReceipt {
  return {
    protocol: 'act-latest-stable-aggregate-chain-intake/1',
    outputRoot: 'tmp/chain',
    bindingPath: 'tmp/chain/metadata/latest-stable-aggregate-binding.json',
    predecessorClosurePath: 'tmp/chain/metadata/predecessor-closure.json',
    predecessorClosureArtifactHash: digest('c'),
    resolutionDigest: digest('8'),
    chain: entries,
  };
}

function manifest(bundleId: string, bundleDigest: string, releaseId: string, previous: Record<string, unknown> | null): Record<string, unknown> {
  return {
    bundle_id: bundleId,
    bundle_digest: bundleDigest,
    release: { release_id: releaseId },
    previous_bundle: previous,
  };
}

describe('latest ActKG Aggregate admission plan', () => {
  it('binds the first Delta to exact v0.2 and each later Delta to its explicit predecessor', () => {
    const first = {
      order: 1,
      lockPath: 'tmp/chain/lock-1.json',
      lockSha256: digest('d'),
      releaseSetId: 'actkg-authoritative-candidate-v2',
      releaseId: FIRST_STAGED_RELEASE_ID,
      releaseVersion: 'control-theory-engineering-v0.3',
      releaseHash: digest('e'),
      bundleId: FIRST_STAGED_BUNDLE_ID,
      bundleDigest: digest('f'),
    };
    const second = {
      ...first,
      order: 2,
      lockPath: 'tmp/chain/lock-2.json',
      releaseId: 'ctr:release:control-theory-engineering-v0.4',
      releaseVersion: 'control-theory-engineering-v0.4',
      bundleId: 'ctb:control-theory-engineering-v0.4:r2',
      bundleDigest: digest('0'),
    };
    const plan = buildAdmissionPlan({
      repoRoot: '/repo',
      binding: binding([first.bundleId, second.bundleId]),
      receipt: receipt([first, second]),
      locks: [lock(first), lock(second)],
      manifests: [
        manifest(first.bundleId, first.bundleDigest, first.releaseId, {
          bundle_id: 'ctb:control-theory-engineering-v0.3:r1',
          kind: 'legacy_exact',
          sha256sums_sha256: digest('1'),
        }),
        manifest(second.bundleId, second.bundleDigest, second.releaseId, {
          bundle_id: first.bundleId,
          kind: 'legacy_exact',
          sha256sums_sha256: digest('2'),
        }),
      ],
    });
    expect(plan.hops.map((hop) => hop.base.kind)).toEqual(['exact_import', 'standard_bundle']);
    expect(plan.hops[1]?.base.bundleId).toBe(first.bundleId);
  });

  it('rejects missing or reordered chain evidence instead of inferring a base', () => {
    const first = {
      order: 1,
      lockPath: 'tmp/chain/lock-1.json',
      lockSha256: digest('d'),
      releaseSetId: 'actkg-authoritative-candidate-v2',
      releaseId: FIRST_STAGED_RELEASE_ID,
      releaseVersion: 'control-theory-engineering-v0.3',
      releaseHash: digest('e'),
      bundleId: FIRST_STAGED_BUNDLE_ID,
      bundleDigest: digest('f'),
    };
    expect(() => buildAdmissionPlan({
      repoRoot: '/repo',
      binding: binding([first.bundleId, 'ctb:control-theory-engineering-v0.4:r2']),
      receipt: receipt([first]),
      locks: [lock(first)],
      manifests: [manifest(first.bundleId, first.bundleDigest, first.releaseId, {
        bundle_id: 'ctb:control-theory-engineering-v0.3:r1',
        kind: 'legacy_exact',
        sha256sums_sha256: digest('1'),
      })],
    })).toThrow(/candidate order differs/u);
  });

  it('rejects a tampered lock identity before any import can be attempted', () => {
    const candidate = {
      order: 1,
      lockPath: 'tmp/chain/lock-1.json',
      lockSha256: digest('d'),
      releaseSetId: 'actkg-authoritative-candidate-v2',
      releaseId: FIRST_STAGED_RELEASE_ID,
      releaseVersion: 'control-theory-engineering-v0.3',
      releaseHash: digest('e'),
      bundleId: FIRST_STAGED_BUNDLE_ID,
      bundleDigest: digest('f'),
    };
    const tampered = lock({
      ...candidate,
      bundleDigest: digest('0'),
    });
    expect(() => buildAdmissionPlan({
      repoRoot: '/repo',
      binding: binding([candidate.bundleId]),
      receipt: receipt([candidate]),
      locks: [tampered],
      manifests: [manifest(candidate.bundleId, candidate.bundleDigest, candidate.releaseId, {
        bundle_id: 'ctb:control-theory-engineering-v0.3:r1',
        kind: 'legacy_exact',
        sha256sums_sha256: digest('1'),
      })],
    })).toThrow(/lock identity drift/u);
  });

  it('accepts the exact admitted endpoint when it has no package bundleId', () => {
    const first = {
      order: 1,
      lockPath: 'tmp/chain/lock-1.json',
      lockSha256: digest('d'),
      releaseSetId: 'actkg-authoritative-candidate-v2',
      releaseId: FIRST_STAGED_RELEASE_ID,
      releaseVersion: 'control-theory-engineering-v0.3',
      releaseHash: digest('e'),
      bundleId: FIRST_STAGED_BUNDLE_ID,
      bundleDigest: digest('f'),
    };
    const parsed = parseBinding({
      ...binding([first.bundleId]),
      admittedEndpoint: {
        releaseSetId: 'actkg-authoritative-candidate-v2',
        releaseId: 'control-theory-engineering-v0.2',
        releaseVersion: 'control-theory-engineering-v0.2',
        releaseHash: digest('1'),
        sourceDatasetHash: digest('2'),
      },
    });
    expect(parsed.admittedEndpoint).not.toHaveProperty('bundleId');
  });
});

describe('admission selector gates', () => {
  const snapshot: SelectorGateSnapshot = {
    productionAuthority: 'LEGACY',
    productionCanonicalWriterEnabled: false,
    graphRagAuthority: 'LEGACY',
    graphRagCanonicalExpansionVisible: false,
    canonicalWriterFenceDigest: digest('4'),
  };

  it('returns zero-change gates for an unchanged selector snapshot', () => {
    expect(compareSelectorGateSnapshots(snapshot, { ...snapshot })).toMatchObject({
      PRODUCTION_SELECTOR_CHANGE: 0,
      GRAPH_RAG_SELECTOR_CHANGE: 0,
      CANONICAL_LEARNING_FACT_WRITER_FENCE_CHANGE: 0,
    });
  });

  it('fails closed when a selector or writer fence drifts', () => {
    expect(() => compareSelectorGateSnapshots(snapshot, {
      ...snapshot,
      canonicalWriterFenceDigest: digest('5'),
    })).toThrow(/selector.*changed/u);
  });

  it('cleans up after an injected mid-chain failure without mutating the gate snapshot', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'actkg-admission-test-'));
    const outputRoot = path.join(root, 'final-admission');
    const first = {
      order: 1,
      lockPath: 'admission/lock-1.json',
      lockSha256: '',
      releaseSetId: 'actkg-authoritative-candidate-v2',
      releaseId: FIRST_STAGED_RELEASE_ID,
      releaseVersion: 'control-theory-engineering-v0.3',
      releaseHash: digest('e'),
      bundleId: FIRST_STAGED_BUNDLE_ID,
      bundleDigest: digest('f'),
    };
    const second = {
      ...first,
      order: 2,
      lockPath: 'admission/lock-2.json',
      releaseId: 'ctr:release:control-theory-engineering-v0.4',
      releaseVersion: 'control-theory-engineering-v0.4',
      bundleId: 'ctb:control-theory-engineering-v0.4:r2',
      bundleDigest: digest('0'),
    };
    const lockBytes: Buffer[] = [];
    const manifests = [
      manifest(first.bundleId, first.bundleDigest, first.releaseId, {
        bundle_id: 'ctb:control-theory-engineering-v0.3:r1', kind: 'legacy_exact', sha256sums_sha256: digest('1'),
      }),
      manifest(second.bundleId, second.bundleDigest, second.releaseId, {
        bundle_id: first.bundleId, kind: 'legacy_exact', sha256sums_sha256: digest('2'),
      }),
    ];
    await mkdir(path.join(root, 'admission', 'metadata'), { recursive: true });
    await mkdir(path.join(root, 'releases', first.bundleId), { recursive: true });
    await mkdir(path.join(root, 'releases', second.bundleId), { recursive: true });
    for (const [index, entry] of [first, second].entries()) {
      const manifestBytes = Buffer.from(JSON.stringify(manifests[index]));
      await writeFile(path.join(root, 'releases', entry.bundleId, 'bundle-manifest.json'), manifestBytes);
      const stagedLock = lock(entry);
      stagedLock.bundle.manifest_raw_sha256 = sha256(manifestBytes);
      const bytes = Buffer.from(`${JSON.stringify(stagedLock, null, 2)}\n`);
      lockBytes.push(bytes);
      await writeFile(path.join(root, entry.lockPath), bytes);
    }
    first.lockSha256 = sha256(lockBytes[0]!);
    second.lockSha256 = sha256(lockBytes[1]!);
    const bindingJson = binding([first.bundleId, second.bundleId]);
    const receiptJson = {
      ...receipt([first, second]),
      outputRoot: 'admission',
      bindingPath: 'admission/metadata/latest-stable-aggregate-binding.json',
    };
    await writeFile(path.join(root, receiptJson.bindingPath), `${JSON.stringify(bindingJson, null, 2)}\n`);
    const chainReceiptPath = path.join(root, 'admission/chain-intake-receipt.json');
    await writeFile(chainReceiptPath, `${JSON.stringify(receiptJson, null, 2)}\n`);
    const stable = { ...snapshot };
    let selectorCalls = 0;
    const fakeEvidence = (releaseId: string, bundleId: string | null) => ({
      evidence: {
        kind: bundleId ? 'standard_bundle' : 'exact_import',
        releaseSetId: 'actkg-authoritative-candidate-v2',
        releaseId,
        releaseVersion: releaseId.endsWith('v0.3') ? first.releaseVersion : second.releaseVersion,
        releaseHash: digest('e'),
        sourceDatasetHash: digest('2'),
        importReceiptId: bundleId ? 'import-1' : 'exact-import',
        bundleReceiptId: bundleId ? 'bundle-receipt-1' : null,
        bundleId,
        bundleRevision: bundleId ? 2 : null,
        bundleDigest: bundleId ? first.bundleDigest : null,
        runtimeProjectionId: null,
        runtimeProjectionDigest: null,
        evidenceCaptureRevision: 'a'.repeat(40),
        protocol: bundleId ? 'actkg-public-bundle/1' : 'ctkg-0.2-aggregate-engineering-release-v1',
        acceptedAt: null,
        semanticSnapshotDigest: digest('3'),
      },
      snapshot: {},
    });
    const fakeDb = {
      actkgBundleReceipt: {
        findUnique: async () => ({ id: 'bundle-receipt-1', candidateState: 'ACCEPTED_CANDIDATE' }),
      },
    } as never;
    const fakeValidated = (entry: typeof first) => ({
      captureRevision: 'a'.repeat(40),
      bundleIdentity: { bundleId: entry.bundleId, bundleDigest: entry.bundleDigest },
      releaseIdentity: { releaseId: entry.releaseId },
      releaseSetIdentity: { releaseSetId: entry.releaseSetId },
    }) as never;
    try {
      await expect(admitLatestActkgAggregate({
        repoRoot: root,
        bindingPath: path.join(root, receiptJson.bindingPath),
        chainReceiptPath,
        outputRoot,
        captureRevision: 'a'.repeat(40),
        db: fakeDb,
        selectorSnapshot: () => {
          selectorCalls += 1;
          return stable;
        },
        loadAggregate: async () => ({
          lock: { release_set_id: 'actkg-authoritative-candidate-v2' },
          entry: { release_id: 'control-theory-engineering-v0.2' },
        }) as never,
        importAggregate: async () => undefined as never,
        importBundle: async () => undefined as never,
        loadExact: async () => fakeEvidence('control-theory-engineering-v0.2', null) as never,
        loadStandard: async () => fakeEvidence(first.releaseId, first.bundleId) as never,
        loadUpstream: async () => ({ required: false, raw: null, parseError: null }),
        loadBundle: async (options) => {
          if (options?.lockPath === second.lockPath) throw new Error('injected second-hop failure');
          return fakeValidated(first);
        },
        computeDelta: () => ({
          classification: 'SEMANTIC_CONTENT_UPDATE',
          authorizationState: 'ACCEPTED',
          inputDigest: digest('1'),
          outputDigest: digest('2'),
          naturalKey: 'delta-1',
          upstream: { status: 'NOT_REQUIRED', details: {} },
          summary: {},
          identityViolations: [],
          captureRevision: 'a'.repeat(40),
          baseEvidence: fakeEvidence('control-theory-engineering-v0.2', null).evidence,
          candidateEvidence: fakeEvidence(first.releaseId, first.bundleId).evidence,
        }) as never,
        persistDelta: async () => ({ mode: 'created', receiptId: 'delta-1', classification: 'SEMANTIC_CONTENT_UPDATE', authorizationState: 'ACCEPTED', inputDigest: digest('1'), outputDigest: digest('2'), naturalKey: 'delta-1', signalCount: 0, upstreamCrosscheckStatus: 'NOT_REQUIRED', selectorsUnchanged: true }),
        verifyDelta: async (_db, computed) => ({ mode: 'verify-only', receiptId: 'delta-1', classification: computed.classification, authorizationState: computed.authorizationState, inputDigest: computed.inputDigest, outputDigest: computed.outputDigest, naturalKey: computed.naturalKey, signalCount: 0, upstreamCrosscheckStatus: 'NOT_REQUIRED', selectorsUnchanged: true }),
      })).rejects.toThrow('injected second-hop failure');
      await expect(stat(outputRoot)).rejects.toMatchObject({ code: 'ENOENT' });
      expect(selectorCalls).toBe(1);
      expect(stable).toEqual(snapshot);
      expect(await readdir(path.dirname(outputRoot))).not.toContain('.admission.tmp-');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
