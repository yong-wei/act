import { describe, expect, it } from 'vitest';

import type {
  CoordinatedCandidateReceipt,
  CoordinationAllocationRecord,
  JournaledMutationPlan,
} from '@/lib/latest-authority-oss-cutover/contracts';
import {
  assertCandidateNonSelectable,
  assertInnerPayloadHasNoOuterReference,
  bindInnerArtifact,
  reopenAndVerifyCandidate,
  sealCoordinatedCandidateReceipt,
  sealCoordinationAllocationRecord,
} from '@/lib/latest-authority-oss-cutover/envelope';
import {
  applyJournaledMutation,
  assertConsumersStopped,
  assertPredecessorRestored,
  compensateTransaction,
  journalProtectedReleaseIdentities,
  openCutoverTransaction,
  projectCoordinatedReadiness,
  sealCoordinatedActiveReceipt,
  type CutoverJournalStore,
  type CutoverSelectorStore,
} from '@/lib/latest-authority-oss-cutover/transaction';
import {
  assertRuntimeSuccessorAuthorizedByGraphReceipt,
  buildCoordinatedRuntimeActiveReceiptBinding,
  buildCoordinatedRuntimeManifestExtension,
  projectCoordinatedRuntimeReadiness,
} from '@/lib/latest-authority-oss-cutover/runtime-binding';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);
const HASH_D = 'd'.repeat(64);

function allocation(): CoordinationAllocationRecord {
  return sealCoordinationAllocationRecord({
    sealedAt: '2026-08-23T00:00:00.000Z',
    capture: {
      captureHash: HASH_A,
      compatibility: {
        contract: 'authority-adapter-compatibility/v1',
        adapterContractVersion: 'existing-act-adapter',
        classification: 'COMPATIBLE',
        incompatibleReasons: [],
        captured: {
          schemaVersion: '0.3.0',
          schemaSha256: HASH_A,
          contractVersion: 'actkg-public-bundle/2',
          requiredMembers: ['release'],
          profiles: ['runtime'],
          representativeParse: 'COMPLETE',
        },
      },
    },
    scopeHash: HASH_B,
    denominatorHash: HASH_C,
    policyVersions: { continuity: 'v1' },
    implementationIdentities: { builder: 'b1' },
  });
}

function candidateInput(allocationRecord: CoordinationAllocationRecord) {
  const inner = [
    bindInnerArtifact({
      allocation: allocationRecord,
      artifactId: 'teaching-projection',
      artifactKind: 'teaching-projection',
      dependsOn: [{ artifactId: 'allocation', artifactHash: allocationRecord.allocationHash }],
      artifactHash: HASH_A,
    }),
    bindInnerArtifact({
      allocation: allocationRecord,
      artifactId: 'successor-runtime-binding',
      artifactKind: 'coordinated-runtime-manifest-extension',
      dependsOn: [{ artifactId: 'allocation', artifactHash: allocationRecord.allocationHash }],
      artifactHash: HASH_B,
    }),
  ];
  return {
    sealedAt: '2026-08-23T00:00:00.000Z',
    allocation: allocationRecord,
    authorityCaptureHash: HASH_A,
    localeQualificationHash: HASH_D,
    teachingProjectionHash: HASH_A,
    teachingClosureReceiptHash: HASH_D,
    formalResourceEnvelopeHash: HASH_C,
    continuityReceiptHash: HASH_B,
    derivationReceiptHash: HASH_D,
    successorRuntimeManifestHash: HASH_B,
    successorRuntimeMaterializationHash: HASH_C,
    domainShardCatalogHash: HASH_A,
    domainShardSetHash: HASH_B,
    prerequisitePublicationHash: HASH_C,
    consumerActivationHash: HASH_D,
    predecessor: [
      { selectorId: 'authority:current', identity: 'auth-old' },
      { selectorId: 'runtime:desired', identity: 'runtime-old' },
    ],
    predecessorRuntimeLifecycleGeneration: 7,
    successorSelectorExpectations: [
      { selectorId: 'authority:current', expectedSuccessorIdentity: 'auth-new' },
      { selectorId: 'runtime:desired', expectedSuccessorIdentity: 'runtime-new' },
    ],
    transactionImplementationIdentity: 'cutover-tx/v1',
    rollbackPlanHash: HASH_A,
    verificationPolicyHash: HASH_B,
    innerBindings: inner,
  };
}

describe('coordinated candidate envelope', () => {
  it('seals one outer receipt over the exact inner hashes without rewriting inner artifacts', () => {
    const allocationRecord = allocation();
    const receipt = sealCoordinatedCandidateReceipt(candidateInput(allocationRecord));
    expect(receipt.selectable).toBe(false);
    expect(receipt.receiptHash).toMatch(/^[a-f0-9]{64}$/);
    expect(() => assertCandidateNonSelectable(receipt)).not.toThrow();
    // Deterministic construction: same inputs produce the same body hash.
    const again = sealCoordinatedCandidateReceipt(candidateInput(allocationRecord));
    expect(again.predecessor).toEqual(receipt.predecessor);
    expect(again.successorSelectorExpectations).toEqual(receipt.successorSelectorExpectations);
  });

  it('rejects inner artifacts that reference an outer receipt hash or a foreign allocation', () => {
    const allocationRecord = allocation();
    const foreign = allocation();
    const strayHash = '9'.repeat(64);
    expect(() => bindInnerArtifact({
      allocation: allocationRecord,
      artifactId: 'bad-inner',
      artifactKind: 'teaching-projection',
      dependsOn: [{ artifactId: 'allocation', artifactHash: allocationRecord.allocationHash }],
      artifactHash: strayHash,
      forbiddenReferenceValues: [strayHash],
    })).toThrow(/must not reference an outer receipt hash/);
    expect(() => bindInnerArtifact({
      allocation: allocationRecord,
      artifactId: 'foreign-inner',
      artifactKind: 'teaching-projection',
      dependsOn: [{ artifactId: 'allocation', artifactHash: foreign.allocationHash }],
      artifactHash: HASH_A,
    })).toThrow(/foreign allocation/);
    expect(() => assertInnerPayloadHasNoOuterReference(
      { candidateReceiptHash: HASH_B } as Record<string, unknown>,
      'bad-inner',
    )).toThrow(/forbidden outer-reference field/);
  });

  it('fails on missing predecessor state and cross-envelope inner bindings', () => {
    const allocationRecord = allocation();
    const foreign = allocation();
    const noPredecessor = candidateInput(allocationRecord);
    noPredecessor.predecessor = [];
    expect(() => sealCoordinatedCandidateReceipt(noPredecessor)).toThrow(/complete predecessor/);
    const mixed = candidateInput(allocationRecord);
    // A hand-crafted binding from a foreign envelope must fail the outer
    // seal even though the constructor itself refuses to produce one.
    mixed.innerBindings = [
      ...mixed.innerBindings,
      {
        artifactId: 'stray-inner',
        artifactKind: 'teaching-projection',
        allocationHash: foreign.allocationHash,
        dependsOn: [{ artifactId: 'allocation', artifactHash: foreign.allocationHash }],
        artifactHash: HASH_C,
      },
    ];
    expect(() => sealCoordinatedCandidateReceipt(mixed)).toThrow(/different coordination envelope/);
  });

  it('reopens and hash-verifies every referenced artifact, failing on tampering', async () => {
    const allocationRecord = allocation();
    const receipt = sealCoordinatedCandidateReceipt(candidateInput(allocationRecord));
    type ReopenValue = { artifactHash: string; allocationHash?: string };
    const reopenEntries: [string, ReopenValue][] = [
        ['authority-capture', { artifactHash: receipt.authorityCaptureHash, allocationHash: allocationRecord.allocationHash }],
        ['locale-qualification', { artifactHash: receipt.localeQualificationHash }],
        ['teaching-projection', { artifactHash: receipt.teachingProjectionHash, allocationHash: allocationRecord.allocationHash }],
        ['teaching-closure-receipt', { artifactHash: receipt.teachingClosureReceiptHash }],
        ['formal-resource-envelope', { artifactHash: receipt.formalResourceEnvelopeHash }],
        ['continuity-receipt', { artifactHash: receipt.continuityReceiptHash }],
        ['derivation-receipt', { artifactHash: receipt.derivationReceiptHash }],
        ['successor-runtime-manifest', { artifactHash: receipt.successorRuntimeManifestHash }],
        ['successor-runtime-materialization', { artifactHash: receipt.successorRuntimeMaterializationHash }],
        ['authority-domain-shard-catalog', { artifactHash: receipt.domainShardCatalogHash }],
        ['authority-domain-shard-set', { artifactHash: receipt.domainShardSetHash }],
        ['prerequisite-publication', { artifactHash: receipt.prerequisitePublicationHash }],
        ['consumer-activation', { artifactHash: receipt.consumerActivationHash }],
    ];
    const reopenMap = new Map<string, ReopenValue>(reopenEntries);
    await expect(reopenAndVerifyCandidate(receipt, async (id) => reopenMap.get(id) as { artifactHash: string }))
      .resolves.toBeUndefined();
    const tampered = new Map(reopenMap);
    tampered.set('teaching-projection', { artifactHash: HASH_D });
    await expect(reopenAndVerifyCandidate(receipt, async (id) => {
      const observed = tampered.get(id);
      if (!observed) throw new Error(`missing ${id}`);
      return observed;
    })).rejects.toThrow(/hashes to/);
    const foreignEnvelope = new Map(reopenMap);
    foreignEnvelope.set('consumer-activation', { artifactHash: receipt.consumerActivationHash, allocationHash: HASH_D });
    await expect(reopenAndVerifyCandidate(receipt, async (id) => {
      const observed = foreignEnvelope.get(id) as { artifactHash: string; allocationHash?: string };
      return observed;
    })).rejects.toThrow(/different coordination envelope/);
  });
});

class MemorySelectorStore implements CutoverSelectorStore {
  identity: string;

  constructor(
    readonly selectorId: string,
    initialIdentity: string,
    private readonly failOnWrite = false,
  ) {
    this.identity = initialIdentity;
  }

  async readIdentity(): Promise<string> {
    return this.identity;
  }

  async writeIdentity(nextIdentity: string): Promise<void> {
    if (this.failOnWrite) throw new Error(`simulated write failure on ${this.selectorId}`);
    this.identity = nextIdentity;
  }
}

class MemoryJournalStore implements CutoverJournalStore {
  journals: string[] = [];

  async append(): Promise<void> {
    this.journals.push('journal');
  }

  async load() {
    return null;
  }
}

function transactionStores(options: { failRuntimeWrite?: boolean } = {}) {
  return [
    new MemorySelectorStore('authority:current', 'auth-old'),
    new MemorySelectorStore('teaching:active', 'teach-old'),
    new MemorySelectorStore('runtime:desired', 'runtime-old', options.failRuntimeWrite ?? false),
  ];
}

function mutationPlans(): JournaledMutationPlan[] {
  return [
    { selectorId: 'authority:current', expectedPredecessorIdentity: 'auth-old', successorIdentity: 'auth-new' },
    { selectorId: 'teaching:active', expectedPredecessorIdentity: 'teach-old', successorIdentity: 'teach-new' },
    { selectorId: 'runtime:desired', expectedPredecessorIdentity: 'runtime-old', successorIdentity: 'runtime-new' },
  ];
}

function fullCandidate(): CoordinatedCandidateReceipt {
  const allocationRecord = allocation();
  const input = candidateInput(allocationRecord);
  input.predecessor = [
    { selectorId: 'authority:current', identity: 'auth-old' },
    { selectorId: 'teaching:active', identity: 'teach-old' },
    { selectorId: 'runtime:desired', identity: 'runtime-old' },
  ];
  input.successorSelectorExpectations = [
    { selectorId: 'authority:current', expectedSuccessorIdentity: 'auth-new' },
    { selectorId: 'teaching:active', expectedSuccessorIdentity: 'teach-new' },
    { selectorId: 'runtime:desired', expectedSuccessorIdentity: 'runtime-new' },
  ];
  return sealCoordinatedCandidateReceipt(input);
}

describe('stopped-service coordinated transaction', () => {
  it('commits the complete successor and exposes readiness only from the active receipt', async () => {
    const candidate = fullCandidate();
    const stores = transactionStores();
    const journalStore = new MemoryJournalStore();
    const opened = await openCutoverTransaction({
      candidateReceipt: candidate,
      stores,
      orderedMutationPlans: mutationPlans(),
      journalStore,
      consumers: [{ consumerId: 'app', stopped: true }, { consumerId: 'worker', stopped: true }],
      openedAt: '2026-08-23T00:00:00.000Z',
    });
    expect(journalStore.journals).toHaveLength(1);
    const receipts = [];
    for (const [index] of opened.journal.orderedMutations.entries()) {
      const store = stores.find((candidate2) => candidate2.selectorId === opened.journal.orderedMutations[index].selectorId) as MemorySelectorStore;
      receipts.push(await applyJournaledMutation(opened.journal, index, store, '2026-08-23T00:01:00.000Z'));
    }
    // Inner mutation receipts bind the transaction id and candidate but never
    // a final active receipt hash.
    for (const receipt of receipts) {
      expect(receipt.transactionId).toBe(opened.journal.transactionId);
      expect(receipt.candidateReceiptHash).toBe(candidate.receiptHash);
      expect(Object.hasOwn(receipt, 'activeReceiptHash')).toBe(false);
    }
    const activeReceipt = sealCoordinatedActiveReceipt({
      journal: opened.journal,
      candidateReceipt: candidate,
      observedSelectors: stores.map((store) => ({ selectorId: store.selectorId, identity: store.identity })),
      mutationReceipts: receipts,
      runtimeActiveReceiptHash: null,
      sealedAt: '2026-08-23T00:02:00.000Z',
    });
    expect(projectCoordinatedReadiness(activeReceipt)).toEqual({ ready: true, coherentCombination: true });
    expect(journalProtectedReleaseIdentities(opened.journal, candidate))
      .toEqual(['runtime-new', 'runtime-old']);
  });

  it('refuses to open while consumers run or the predecessor drifted', async () => {
    const candidate = fullCandidate();
    await expect(openCutoverTransaction({
      candidateReceipt: candidate,
      stores: transactionStores(),
      orderedMutationPlans: mutationPlans(),
      journalStore: new MemoryJournalStore(),
      consumers: [{ consumerId: 'app', stopped: false }],
      openedAt: '2026-08-23T00:00:00.000Z',
    })).rejects.toThrow(/Consumers must remain stopped/);
    expect(() => assertConsumersStopped([{ consumerId: 'graph', stopped: true }, { consumerId: 'worker', stopped: false }]))
      .toThrow(/Consumers must remain stopped/);
    const drifted = transactionStores();
    (drifted[0] as MemorySelectorStore).identity = 'auth-drifted';
    await expect(openCutoverTransaction({
      candidateReceipt: candidate,
      stores: drifted,
      orderedMutationPlans: mutationPlans(),
      journalStore: new MemoryJournalStore(),
      openedAt: '2026-08-23T00:00:00.000Z',
    })).rejects.toThrow(/drifted from the sealed predecessor/);
  });

  it('fails closed when a selector identity does not match the journal state', async () => {
    const candidate = fullCandidate();
    const stores = transactionStores();
    const opened = await openCutoverTransaction({
      candidateReceipt: candidate,
      stores,
      orderedMutationPlans: mutationPlans(),
      journalStore: new MemoryJournalStore(),
      openedAt: '2026-08-23T00:00:00.000Z',
    });
    (stores[1] as MemorySelectorStore).identity = 'external-state';
    await expect(applyJournaledMutation(opened.journal, 1, stores[1], '2026-08-23T00:01:00.000Z'))
      .rejects.toThrow(/Failing closed without overwriting/);
    expect((stores[1] as MemorySelectorStore).identity).toBe('external-state');
  });

  it('restores the complete predecessor after a selector write failure', async () => {
    const candidate = fullCandidate();
    const stores = transactionStores({ failRuntimeWrite: true });
    const opened = await openCutoverTransaction({
      candidateReceipt: candidate,
      stores,
      orderedMutationPlans: mutationPlans(),
      journalStore: new MemoryJournalStore(),
      openedAt: '2026-08-23T00:00:00.000Z',
    });
    await applyJournaledMutation(opened.journal, 0, stores[0], '2026-08-23T00:01:00.000Z');
    await expect(applyJournaledMutation(opened.journal, 2, stores[2], '2026-08-23T00:01:01.000Z'))
      .rejects.toThrow(/simulated write failure/);
    const result = await compensateTransaction(opened.journal, stores);
    expect(result.restored.map((entry) => entry.selectorId)).toContain('authority:current');
    await assertPredecessorRestored(opened.journal, stores);
    expect(projectCoordinatedReadiness(null)).toEqual({ ready: false, coherentCombination: false });
  });

  it('fails closed when compensation meets unknown external state', async () => {
    const candidate = fullCandidate();
    const stores = transactionStores();
    const opened = await openCutoverTransaction({
      candidateReceipt: candidate,
      stores,
      orderedMutationPlans: mutationPlans(),
      journalStore: new MemoryJournalStore(),
      openedAt: '2026-08-23T00:00:00.000Z',
    });
    (stores[0] as MemorySelectorStore).identity = 'unknown-external';
    await expect(compensateTransaction(opened.journal, stores))
      .rejects.toThrow(/unknown identity unknown-external/);
  });

  it('refuses the active receipt when a successor identity does not re-read exactly', async () => {
    const candidate = fullCandidate();
    const stores = transactionStores();
    const opened = await openCutoverTransaction({
      candidateReceipt: candidate,
      stores,
      orderedMutationPlans: mutationPlans(),
      journalStore: new MemoryJournalStore(),
      openedAt: '2026-08-23T00:00:00.000Z',
    });
    const receipts = [
      await applyJournaledMutation(opened.journal, 0, stores[0], '2026-08-23T00:01:00.000Z'),
    ];
    expect(() => sealCoordinatedActiveReceipt({
      journal: opened.journal,
      candidateReceipt: candidate,
      observedSelectors: [
        { selectorId: 'authority:current', identity: 'auth-new' },
        { selectorId: 'teaching:active', identity: 'teach-old' },
        { selectorId: 'runtime:desired', identity: 'runtime-old' },
      ],
      mutationReceipts: receipts,
      runtimeActiveReceiptHash: null,
      sealedAt: '2026-08-23T00:02:00.000Z',
    })).toThrow(/re-reads teach-old, expected teach-new/);
  });
});

describe('Runtime and readiness integration', () => {
  it('builds the coordinated runtime binding and binds activation to the transaction', () => {
    const allocationRecord = allocation();
    const { extensionHash } = buildCoordinatedRuntimeManifestExtension({
      successorManifest: { releaseId: 'runtime-new', manifestSha256: HASH_A, treeSha256: HASH_B },
      materializationReceiptHash: HASH_C,
      denominatorHash: HASH_C,
      captureHash: HASH_A,
      teachingProjectionHash: HASH_A,
      teachingClosureReceiptHash: HASH_D,
      formalResourceEnvelopeHash: HASH_C,
      continuityReceiptHash: HASH_B,
      domainShardSetHash: HASH_B,
      prerequisitePublicationHash: HASH_C,
      consumerActivationHash: HASH_D,
      allocationHash: allocationRecord.allocationHash,
      predecessorRuntimeReleaseId: 'runtime-old',
      predecessorRuntimeManifestSha256: HASH_D,
      predecessorLifecycleGeneration: 7,
    });
    expect(extensionHash).toMatch(/^[a-f0-9]{64}$/);
    const binding = buildCoordinatedRuntimeActiveReceiptBinding({
      transactionId: 'tx-abc',
      candidateReceiptHash: HASH_A,
      runtimeRelease: { releaseId: 'runtime-new', manifestSha256: HASH_A, treeSha256: HASH_B },
      materializationReceiptHash: HASH_C,
    });
    expect(() => buildCoordinatedRuntimeActiveReceiptBinding({
      transactionId: 'not-a-tx',
      candidateReceiptHash: HASH_A,
      runtimeRelease: { releaseId: 'runtime-new', manifestSha256: HASH_A, treeSha256: HASH_B },
      materializationReceiptHash: HASH_C,
    })).toThrow(/preallocated transaction id/);
    expect(Object.hasOwn(binding, 'finalCoordinatedActiveReceiptHash')).toBe(false);
  });

  it('rejects ordinary runtime activation without the matching committed graph receipt', () => {
    const binding = buildCoordinatedRuntimeActiveReceiptBinding({
      transactionId: 'tx-abc',
      candidateReceiptHash: HASH_A,
      runtimeRelease: { releaseId: 'runtime-new', manifestSha256: HASH_A, treeSha256: HASH_B },
      materializationReceiptHash: HASH_C,
    });
    expect(() => assertRuntimeSuccessorAuthorizedByGraphReceipt(binding, null))
      .toThrow(/no committed coordinated graph receipt/);
    const committed = {
      contract: 'coordinated-active-receipt/v1' as const,
      receiptId: 'act-x',
      sealedAt: '2026-08-23T00:00:00.000Z',
      transactionId: 'tx-other',
      journalHash: HASH_B,
      candidateReceiptHash: HASH_A,
      committedSelectors: [{ selectorId: 'authority:current', identity: 'auth-new' }],
      mutationReceiptHashes: ['mut-x'],
      runtimeActiveReceiptHash: binding.bindingHash,
      receiptHash: HASH_D,
    };
    expect(() => assertRuntimeSuccessorAuthorizedByGraphReceipt(binding, committed))
      .toThrow(/different transaction/);
  });

  it('keeps projecting the prior active identity for an independently newer candidate', () => {
    const priorActive = { releaseId: 'runtime-old', manifestSha256: HASH_D, treeSha256: HASH_C };
    const candidate = { releaseId: 'runtime-new', manifestSha256: HASH_A, treeSha256: HASH_B };
    const projection = projectCoordinatedRuntimeReadiness({
      activeRuntimeIdentity: priorActive,
      candidateRuntimeIdentity: candidate,
      committedGraphActiveReceipt: null,
    });
    expect(projection.ready).toBe(true);
    expect(projection.activeRuntimeIdentity).toEqual(priorActive);
    expect(projection.candidateIdentity).toBeNull();
  });
});
