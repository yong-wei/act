/**
 * Stopped-service coordinated transaction and rollback (#1509, tasks 8.x).
 *
 * All successor Authority and Runtime lifecycle mutations run under one
 * outer exclusive lock and a durable write-ahead journal while every graph
 * and runtime consumer is stopped. The journal allocates an opaque unique
 * transaction ID before the first mutation and binds it to the coordinated
 * candidate receipt, the exact predecessor, the expected intermediate
 * states, and the compensation plan. Inner mutation receipts bind the
 * transaction ID and candidate receipt but never the later final active
 * receipt. A failure before public readiness restores every identity-matched
 * predecessor component; compensation fails closed on unknown state.
 */

import { randomUUID } from 'node:crypto';

import { projectionDigest } from '@/lib/teaching-projection/hash';

import {
  LatestAuthorityCutoverError,
  type CoordinatedActiveReceipt,
  type CoordinatedCandidateReceipt,
  type CutoverCompensationAction,
  type CutoverTransactionJournal,
  type JournaledMutationPlan,
  type SelectorMutationReceipt,
} from './contracts';

/** One selector/lifecycle store coordinated by the transaction. */
export interface CutoverSelectorStore {
  readonly selectorId: string;
  readIdentity(): Promise<string>;
  writeIdentity(nextIdentity: string): Promise<void>;
}

/** Durable write-ahead journal persistence. */
export interface CutoverJournalStore {
  append(journal: CutoverTransactionJournal): Promise<void>;
  load(): Promise<CutoverTransactionJournal | null>;
}

export interface StoppedConsumer {
  readonly consumerId: string;
  readonly stopped: boolean;
}

/** Every graph, application, worker, and Runtime consumer must be stopped. */
export function assertConsumersStopped(consumers: readonly StoppedConsumer[]): void {
  const running = consumers.filter((consumer) => !consumer.stopped).map((consumer) => consumer.consumerId);
  if (running.length > 0) {
    throw new LatestAuthorityCutoverError(
      'transaction-consumers-running',
      `Consumers must remain stopped during the coordinated transaction: ${running.join(', ')}`,
    );
  }
}

export interface OpenCutoverTransactionInput {
  readonly candidateReceipt: CoordinatedCandidateReceipt;
  readonly stores: readonly CutoverSelectorStore[];
  readonly orderedMutationPlans: readonly JournaledMutationPlan[];
  readonly journalStore: CutoverJournalStore;
  readonly consumers?: readonly StoppedConsumer[];
  readonly openedAt: string;
}

export interface OpenedCutoverTransaction {
  readonly journal: CutoverTransactionJournal;
}

/**
 * Open the stopped-service transaction: verify consumers are stopped, re-read
 * the complete predecessor from the live stores and require it to match the
 * candidate's sealed predecessor, allocate the transaction ID, seal the
 * journal, and durably append it before any mutation.
 */
export async function openCutoverTransaction(
  input: OpenCutoverTransactionInput,
): Promise<OpenedCutoverTransaction> {
  assertConsumersStopped(input.consumers ?? []);
  if (!input.openedAt || typeof input.openedAt !== 'string') {
    throw new LatestAuthorityCutoverError(
      'transaction-field-invalid',
      'The transaction needs an open timestamp.',
    );
  }
  if (input.orderedMutationPlans.length === 0) {
    throw new LatestAuthorityCutoverError(
      'transaction-plan-empty',
      'A coordinated transaction needs at least one ordered mutation.',
    );
  }
  const storesById = new Map(input.stores.map((store) => [store.selectorId, store]));
  const predecessor: { selectorId: string; identity: string }[] = [];
  for (const plan of input.orderedMutationPlans) {
    if (!storesById.has(plan.selectorId)) {
      throw new LatestAuthorityCutoverError(
        'transaction-store-missing',
        `No coordinated store exists for selector ${plan.selectorId}.`,
      );
    }
  }
  for (const store of input.stores) {
    predecessor.push({ selectorId: store.selectorId, identity: await store.readIdentity() });
  }
  // The live predecessor must re-read exactly as sealed in the candidate.
  const sealedPredecessor = new Map(
    input.candidateReceipt.predecessor.map((state) => [state.selectorId, state.identity]),
  );
  for (const state of predecessor) {
    const sealed = sealedPredecessor.get(state.selectorId);
    if (sealed === undefined) {
      throw new LatestAuthorityCutoverError(
        'transaction-predecessor-unknown-store',
        `Live selector ${state.selectorId} is absent from the candidate's sealed predecessor.`,
      );
    }
    if (sealed !== state.identity) {
      throw new LatestAuthorityCutoverError(
        'transaction-predecessor-drift',
        `Selector ${state.selectorId} drifted from the sealed predecessor (${sealed} -> ${state.identity}).`,
      );
    }
  }
  if (sealedPredecessor.size !== predecessor.length) {
    throw new LatestAuthorityCutoverError(
      'transaction-predecessor-incomplete',
      'The live selector set does not cover the complete sealed predecessor.',
    );
  }
  const compensationPlan: CutoverCompensationAction[] = predecessor.map((state) => ({
    selectorId: state.selectorId,
    restoreIdentity: state.identity,
  }));
  // The ordered mutations must chain exactly from the live predecessor: each
  // plan's expected identity is the selector's current identity or the
  // successor of its previous mutation.
  const lastIdentity = new Map(predecessor.map((state) => [state.selectorId, state.identity]));
  for (const plan of input.orderedMutationPlans) {
    const expected = lastIdentity.get(plan.selectorId);
    if (expected === undefined || expected !== plan.expectedPredecessorIdentity) {
      throw new LatestAuthorityCutoverError(
        'transaction-plan-chain-invalid',
        `Mutation plan for ${plan.selectorId} expects ${plan.expectedPredecessorIdentity}, but the chain state is ${expected ?? 'absent'}.`,
      );
    }
    lastIdentity.set(plan.selectorId, plan.successorIdentity);
  }
  const transactionId = `tx-${randomUUID()}`;
  const journalHash = projectionDigest({
    transactionId,
    openedAt: input.openedAt,
    candidateReceiptHash: input.candidateReceipt.receiptHash,
    predecessor,
    orderedMutations: input.orderedMutationPlans,
    compensationPlan,
  });
  const journal: CutoverTransactionJournal = {
    contract: 'cutover-transaction-journal/v1',
    transactionId,
    openedAt: input.openedAt,
    candidateReceiptHash: input.candidateReceipt.receiptHash,
    predecessor,
    orderedMutations: [...input.orderedMutationPlans],
    compensationPlan,
    journalHash,
  };
  await input.journalStore.append(journal);
  return { journal };
}

/**
 * Apply one journaled mutation. The write happens only when the current
 * identity matches the journal's expected state (the sealed predecessor or
 * the exact intermediate state produced by the preceding mutation); any
 * other identity fails closed.
 */
export async function applyJournaledMutation(
  journal: CutoverTransactionJournal,
  stepIndex: number,
  store: CutoverSelectorStore,
  appliedAt: string,
): Promise<SelectorMutationReceipt> {
  if (store.selectorId !== journal.orderedMutations[stepIndex]?.selectorId) {
    throw new LatestAuthorityCutoverError(
      'mutation-step-mismatch',
      `Step ${stepIndex} expects selector ${journal.orderedMutations[stepIndex]?.selectorId}, not ${store.selectorId}.`,
    );
  }
  const plan = journal.orderedMutations[stepIndex];
  const current = await store.readIdentity();
  const expected = expectedIdentityBefore(journal, stepIndex);
  if (current !== expected) {
    throw new LatestAuthorityCutoverError(
      'mutation-identity-unmatched',
      `Selector ${plan.selectorId} is ${current}; the journal expects ${expected}. Failing closed without overwriting.`,
    );
  }
  await store.writeIdentity(plan.successorIdentity);
  const after = await store.readIdentity();
  if (after !== plan.successorIdentity) {
    throw new LatestAuthorityCutoverError(
      'mutation-write-unverified',
      `Selector ${plan.selectorId} did not re-read as ${plan.successorIdentity}.`,
    );
  }
  const receiptHash = selectorMutationReceiptHash({
    transactionId: journal.transactionId,
    candidateReceiptHash: journal.candidateReceiptHash,
    selectorId: plan.selectorId,
    appliedAt,
    beforeIdentity: current,
    afterIdentity: after,
  });
  return {
    contract: 'cutover-selector-mutation-receipt/v1',
    receiptId: `mut-${receiptHash.slice(0, 24)}`,
    receiptHash,
    transactionId: journal.transactionId,
    candidateReceiptHash: journal.candidateReceiptHash,
    selectorId: plan.selectorId,
    appliedAt,
    beforeIdentity: current,
    afterIdentity: after,
  };
}

/** Content-addressed hash of a mutation receipt's full canonical payload.
 * The hash covers the contract discriminator and every business field; the
 * receiptId is derived from it and never part of it (being a truncation of
 * the hash itself). */
export function selectorMutationReceiptHash(payload: {
  transactionId: string;
  candidateReceiptHash: string;
  selectorId: string;
  appliedAt: string;
  beforeIdentity: string;
  afterIdentity: string;
}): string {
  return projectionDigest({
    contract: 'cutover-selector-mutation-receipt/v1',
    ...payload,
  });
}

/** Validate a receipt's discriminator, derived id, and full payload hash. */
export function assertSelectorMutationReceiptWellFormed(
  receipt: SelectorMutationReceipt,
): void {
  if (receipt.contract !== 'cutover-selector-mutation-receipt/v1') {
    throw new LatestAuthorityCutoverError(
      'mutation-receipt-contract-invalid',
      `Mutation receipt ${receipt.receiptId} uses an unsupported contract.`,
    );
  }
  const expectedHash = selectorMutationReceiptHash({
    transactionId: receipt.transactionId,
    candidateReceiptHash: receipt.candidateReceiptHash,
    selectorId: receipt.selectorId,
    appliedAt: receipt.appliedAt,
    beforeIdentity: receipt.beforeIdentity,
    afterIdentity: receipt.afterIdentity,
  });
  if (receipt.receiptHash !== expectedHash
    || receipt.receiptId !== `mut-${expectedHash.slice(0, 24)}`) {
    throw new LatestAuthorityCutoverError(
      'mutation-receipt-hash-mismatch',
      `Mutation receipt ${receipt.receiptId} does not match its own content-addressed hash.`,
    );
  }
}

function expectedIdentityBefore(journal: CutoverTransactionJournal, stepIndex: number): string {
  // The chain was validated at open time; the expected state of each step is
  // exactly the identity it declares.
  return journal.orderedMutations[stepIndex].expectedPredecessorIdentity;
}

export interface SealActiveReceiptInput {
  readonly journal: CutoverTransactionJournal;
  readonly candidateReceipt: CoordinatedCandidateReceipt;
  /** Live re-read of every successor selector after the last mutation. */
  readonly observedSelectors: readonly { selectorId: string; identity: string }[];
  readonly mutationReceipts: readonly SelectorMutationReceipt[];
  readonly runtimeActiveReceiptHash: string | null;
  readonly sealedAt: string;
}

/**
 * Write the outer coordinated active receipt only after every successor
 * selector and lifecycle identity re-reads exactly. The receipt closes over
 * the journal, the candidate receipt, the committed selectors, and the inner
 * mutation receipts; it is the commit marker consumers wait for.
 */
export function sealCoordinatedActiveReceipt(
  input: SealActiveReceiptInput,
): CoordinatedActiveReceipt {
  if (input.journal.candidateReceiptHash !== input.candidateReceipt.receiptHash) {
    throw new LatestAuthorityCutoverError(
      'active-receipt-candidate-mismatch',
      'The journal binds a different candidate receipt than the activation.',
    );
  }
  const expectations = new Map(
    input.candidateReceipt.successorSelectorExpectations.map((expectation) => [
      expectation.selectorId,
      expectation.expectedSuccessorIdentity,
    ]),
  );
  if (input.observedSelectors.length !== expectations.size) {
    throw new LatestAuthorityCutoverError(
      'active-receipt-observed-incomplete',
      'The observed selector set does not cover every successor expectation.',
    );
  }
  for (const observed of input.observedSelectors) {
    const expected = expectations.get(observed.selectorId);
    if (expected === undefined) {
      throw new LatestAuthorityCutoverError(
        'active-receipt-observed-unknown',
        `Observed selector ${observed.selectorId} is not part of the successor expectations.`,
      );
    }
    if (observed.identity !== expected) {
      throw new LatestAuthorityCutoverError(
        'active-receipt-identity-unmatched',
        `Successor selector ${observed.selectorId} re-reads ${observed.identity}, expected ${expected}.`,
      );
    }
  }
  // The mutation receipts must cover the journal plan exactly: one receipt
  // per planned step, in order, with matching selector and identities, and
  // every receipt must verify against its own full content-addressed hash.
  if (input.mutationReceipts.length !== input.journal.orderedMutations.length) {
    throw new LatestAuthorityCutoverError(
      'active-receipt-mutations-incomplete',
      `The activation binds ${input.mutationReceipts.length} mutation receipts for ${input.journal.orderedMutations.length} journaled steps.`,
    );
  }
  for (const [index, plan] of input.journal.orderedMutations.entries()) {
    const receipt = input.mutationReceipts[index];
    if (!receipt || receipt.selectorId !== plan.selectorId) {
      throw new LatestAuthorityCutoverError(
        'active-receipt-mutation-order-mismatch',
        `Mutation receipt at step ${index} covers ${receipt?.selectorId ?? 'nothing'} instead of ${plan.selectorId}.`,
      );
    }
    if (receipt.beforeIdentity !== plan.expectedPredecessorIdentity
      || receipt.afterIdentity !== plan.successorIdentity) {
      throw new LatestAuthorityCutoverError(
        'active-receipt-mutation-identity-mismatch',
        `Mutation receipt for ${plan.selectorId} does not bind the journaled before/after identities.`,
      );
    }
    if (receipt.transactionId !== input.journal.transactionId) {
      throw new LatestAuthorityCutoverError(
        'active-receipt-mutation-foreign-transaction',
        `Mutation receipt ${receipt.receiptId} belongs to a foreign transaction.`,
      );
    }
    if (receipt.candidateReceiptHash !== input.candidateReceipt.receiptHash) {
      throw new LatestAuthorityCutoverError(
        'active-receipt-mutation-foreign-candidate',
        `Mutation receipt ${receipt.receiptId} binds a different candidate.`,
      );
    }
    // Full payload verification: contract discriminator, derived id, and the
    // content-addressed hash must all be the ones applyJournaledMutation
    // actually produced.
    assertSelectorMutationReceiptWellFormed(receipt);
  }
  const receiptHash = projectionDigest({
    transactionId: input.journal.transactionId,
    journalHash: input.journal.journalHash,
    candidateReceiptHash: input.candidateReceipt.receiptHash,
    committedSelectors: input.observedSelectors,
    mutationReceiptHashes: input.mutationReceipts.map((receipt) => receipt.receiptHash),
    runtimeActiveReceiptHash: input.runtimeActiveReceiptHash,
  });
  return {
    contract: 'coordinated-active-receipt/v1',
    receiptId: `act-${receiptHash.slice(0, 24)}`,
    sealedAt: input.sealedAt,
    transactionId: input.journal.transactionId,
    journalHash: input.journal.journalHash,
    candidateReceiptHash: input.candidateReceipt.receiptHash,
    committedSelectors: [...input.observedSelectors],
    mutationReceiptHashes: input.mutationReceipts.map((receipt) => receipt.receiptHash),
    runtimeActiveReceiptHash: input.runtimeActiveReceiptHash,
    receiptHash,
  };
}

/** Readiness is exposed only from a valid outer active receipt. */
export function projectCoordinatedReadiness(
  activeReceipt: CoordinatedActiveReceipt | null,
): { ready: boolean; coherentCombination: boolean } {
  if (!activeReceipt) return { ready: false, coherentCombination: false };
  const valid =
    activeReceipt.contract === 'coordinated-active-receipt/v1'
    && /^[a-f0-9]{64}$/u.test(activeReceipt.receiptHash)
    && activeReceipt.committedSelectors.length > 0;
  return { ready: valid, coherentCombination: valid };
}

export interface CompensationResult {
  readonly restored: readonly { selectorId: string; restoredIdentity: string }[];
  readonly untouched: readonly { selectorId: string; identity: string }[];
}

/**
 * Restore the complete identity-matched predecessor combination. A store
 * whose current identity is neither the journaled predecessor nor an exact
 * intermediate/successor state of this transaction fails closed: the
 * coordinator never overwrites unknown external state.
 */
export async function compensateTransaction(
  journal: CutoverTransactionJournal,
  stores: readonly CutoverSelectorStore[],
): Promise<CompensationResult> {
  const restoreById = new Map(
    journal.compensationPlan.map((action) => [action.selectorId, action.restoreIdentity]),
  );
  const knownIdentities = new Map<string, Set<string>>();
  for (const plan of journal.orderedMutations) {
    const identities = knownIdentities.get(plan.selectorId) ?? new Set<string>();
    identities.add(plan.expectedPredecessorIdentity);
    identities.add(plan.successorIdentity);
    knownIdentities.set(plan.selectorId, identities);
  }
  const restored: { selectorId: string; restoredIdentity: string }[] = [];
  const untouched: { selectorId: string; identity: string }[] = [];
  for (const store of stores) {
    const current = await store.readIdentity();
    const restoreIdentity = restoreById.get(store.selectorId);
    if (restoreIdentity === undefined) {
      throw new LatestAuthorityCutoverError(
        'compensation-store-unknown',
        `Selector ${store.selectorId} is not covered by the journal compensation plan.`,
      );
    }
    if (current === restoreIdentity) {
      untouched.push({ selectorId: store.selectorId, identity: current });
      continue;
    }
    const known = knownIdentities.get(store.selectorId);
    if (!known || !known.has(current)) {
      throw new LatestAuthorityCutoverError(
        'compensation-unknown-state',
        `Selector ${store.selectorId} holds unknown identity ${current}; failing closed for explicit recovery.`,
      );
    }
    await store.writeIdentity(restoreIdentity);
    const after = await store.readIdentity();
    if (after !== restoreIdentity) {
      throw new LatestAuthorityCutoverError(
        'compensation-restore-unverified',
        `Selector ${store.selectorId} did not restore to ${restoreIdentity}.`,
      );
    }
    restored.push({ selectorId: store.selectorId, restoredIdentity: restoreIdentity });
  }
  return { restored, untouched };
}

/** Verify the complete predecessor combination after compensation. */
export async function assertPredecessorRestored(
  journal: CutoverTransactionJournal,
  stores: readonly CutoverSelectorStore[],
): Promise<void> {
  for (const action of journal.compensationPlan) {
    const store = stores.find((candidate) => candidate.selectorId === action.selectorId);
    if (!store) {
      throw new LatestAuthorityCutoverError(
        'compensation-store-missing',
        `Selector ${action.selectorId} disappeared during compensation.`,
      );
    }
    const current = await store.readIdentity();
    if (current !== action.restoreIdentity) {
      throw new LatestAuthorityCutoverError(
        'compensation-predecessor-unverified',
        `Selector ${action.selectorId} re-reads ${current}, expected the predecessor ${action.restoreIdentity}.`,
      );
    }
  }
}

/**
 * Release identities reachable from the journal: every predecessor and
 * successor Runtime identity stays protected from garbage collection until
 * the transaction evidence permits release.
 */
export function journalProtectedReleaseIdentities(
  journal: CutoverTransactionJournal,
  candidate: CoordinatedCandidateReceipt,
): readonly string[] {
  const identities = new Set<string>();
  for (const plan of journal.orderedMutations) {
    if (plan.selectorId.startsWith('runtime:')) {
      identities.add(plan.expectedPredecessorIdentity);
      identities.add(plan.successorIdentity);
    }
  }
  return [...identities].sort();
}
