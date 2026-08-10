/**
 * Write-ahead, identity-constrained protocol for a local all-ABSENT first
 * activation. Component stores retain their own activation receipts; this
 * coordinator only records ordering and compensates a failed first switch.
 */

import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
} from 'node:fs';
import path from 'node:path';

import { activationCanonicalJson } from '@/lib/versioned-knowledge-activation/hash';
import { atomicWriteFile } from '@/lib/versioned-knowledge-activation/store';

export const FIRST_ACTIVATION_JOURNAL_CONTRACT =
  'actkg-to-act-first-activation-journal/v1' as const;

export const FIRST_ACTIVATION_COMPONENTS = [
  'authority',
  'projection',
  'prerequisite',
  'consumer-activation',
] as const;

export type FirstActivationComponent =
  (typeof FIRST_ACTIVATION_COMPONENTS)[number];

export interface FirstActivationPointerIdentity {
  component: FirstActivationComponent;
  id: string;
  hash: string;
}

export interface FirstActivationStep {
  component: FirstActivationComponent;
  pointerPath: string;
  target: FirstActivationPointerIdentity;
  activate: () => void;
}

interface FirstActivationJournalStep {
  component: FirstActivationComponent;
  pointerPath: string;
  target: FirstActivationPointerIdentity;
  status: 'PENDING' | 'STARTED' | 'APPLIED' | 'ROLLED_BACK';
}

export interface FirstActivationJournal {
  contract: typeof FIRST_ACTIVATION_JOURNAL_CONTRACT;
  transactionId: string;
  repoRoot: string;
  createdAt: string;
  status: 'PREPARED' | 'COMMITTED' | 'ROLLING_BACK' | 'ROLLED_BACK' | 'ROLLBACK_FAILED';
  prestate: 'ALL_POINTERS_ABSENT';
  steps: FirstActivationJournalStep[];
  failure: string | null;
  journalHash: string;
}

export class FirstActivationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FirstActivationError';
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function sealJournal(
  body: Omit<FirstActivationJournal, 'journalHash'>,
): FirstActivationJournal {
  return {
    ...body,
    journalHash: sha256(activationCanonicalJson(body)),
  };
}

function writeJournal(journalPath: string, journal: FirstActivationJournal): void {
  mkdirSync(path.dirname(journalPath), { recursive: true });
  atomicWriteFile(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
}

export function readFirstActivationJournal(journalPath: string): FirstActivationJournal {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(journalPath, 'utf8')) as unknown;
  } catch (error) {
    throw new FirstActivationError(
      `cannot read first-activation journal: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new FirstActivationError('first-activation journal is not an object');
  }
  const journal = value as FirstActivationJournal;
  const { journalHash, ...body } = journal;
  if (
    journal.contract !== FIRST_ACTIVATION_JOURNAL_CONTRACT
    || typeof journalHash !== 'string'
    || journalHash !== sha256(activationCanonicalJson(body))
  ) {
    throw new FirstActivationError('first-activation journal hash or contract mismatch');
  }
  return journal;
}

export function readFirstActivationPointerIdentity(input: {
  component: FirstActivationComponent;
  pointerPath: string;
}): FirstActivationPointerIdentity | null {
  if (!existsSync(input.pointerPath)) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(input.pointerPath, 'utf8')) as unknown;
  } catch {
    throw new FirstActivationError(`pointer is unreadable: ${input.pointerPath}`);
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new FirstActivationError(`pointer is malformed: ${input.pointerPath}`);
  }
  const value = raw as Record<string, unknown>;
  const fields = {
    authority: ['snapshotId', 'snapshotHash'],
    projection: ['projectionId', 'projectionHash'],
    prerequisite: ['publicationId', 'publicationHash'],
    'consumer-activation': ['activationId', 'activationHash'],
  } as const;
  const [idField, hashField] = fields[input.component];
  const id = value[idField];
  const hash = value[hashField];
  if (typeof id !== 'string' || !id || typeof hash !== 'string' || !/^[a-f0-9]{64}$/u.test(hash)) {
    throw new FirstActivationError(`pointer identity is invalid: ${input.pointerPath}`);
  }
  return { component: input.component, id, hash };
}

function sameIdentity(
  left: FirstActivationPointerIdentity | null,
  right: FirstActivationPointerIdentity,
): boolean {
  return Boolean(
    left
    && left.component === right.component
    && left.id === right.id
    && left.hash === right.hash,
  );
}

function assertPlan(input: {
  repoRoot: string;
  steps: readonly FirstActivationStep[];
}): void {
  if (input.steps.length !== FIRST_ACTIVATION_COMPONENTS.length) {
    throw new FirstActivationError('first activation requires exactly four component steps');
  }
  for (const [index, component] of FIRST_ACTIVATION_COMPONENTS.entries()) {
    const step = input.steps[index];
    if (!step || step.component !== component || step.target.component !== component) {
      throw new FirstActivationError(`first activation step order must be ${FIRST_ACTIVATION_COMPONENTS.join(' → ')}`);
    }
    const relative = path.relative(input.repoRoot, step.pointerPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new FirstActivationError(`pointer path escapes repository root: ${step.pointerPath}`);
    }
  }
}

function acquireLock(lockPath: string): number {
  mkdirSync(path.dirname(lockPath), { recursive: true });
  try {
    return openSync(lockPath, 'wx');
  } catch {
    throw new FirstActivationError('another first-activation transaction is already running');
  }
}

function releaseLock(lockPath: string, descriptor: number): void {
  closeSync(descriptor);
  try {
    unlinkSync(lockPath);
  } catch {
    // The lock is advisory. A stale lock requires an explicit operator check.
  }
}

function asJournal(input: {
  transactionId: string;
  repoRoot: string;
  createdAt: string;
  status: FirstActivationJournal['status'];
  steps: FirstActivationJournalStep[];
  failure?: string | null;
}): FirstActivationJournal {
  return sealJournal({
    contract: FIRST_ACTIVATION_JOURNAL_CONTRACT,
    transactionId: input.transactionId,
    repoRoot: input.repoRoot,
    createdAt: input.createdAt,
    status: input.status,
    prestate: 'ALL_POINTERS_ABSENT',
    steps: input.steps,
    failure: input.failure ?? null,
  });
}

function compensate(input: {
  journalPath: string;
  journal: FirstActivationJournal;
}): FirstActivationJournal {
  let journal = asJournal({
    ...input.journal,
    status: 'ROLLING_BACK',
    steps: input.journal.steps.map((step) => ({ ...step })),
  });
  writeJournal(input.journalPath, journal);

  try {
    for (const step of [...journal.steps].reverse()) {
      if (step.status !== 'STARTED' && step.status !== 'APPLIED') continue;
      const current = readFirstActivationPointerIdentity({
        component: step.component,
        pointerPath: step.pointerPath,
      });
      if (current && !sameIdentity(current, step.target)) {
        throw new FirstActivationError(`rollback drift at ${step.component}`);
      }
      if (current) unlinkSync(step.pointerPath);
      step.status = 'ROLLED_BACK';
      journal = asJournal({ ...journal, steps: journal.steps.map((row) => ({ ...row })) });
      writeJournal(input.journalPath, journal);
    }
    journal = asJournal({ ...journal, status: 'ROLLED_BACK' });
    writeJournal(input.journalPath, journal);
    return journal;
  } catch (error) {
    journal = asJournal({
      ...journal,
      status: 'ROLLBACK_FAILED',
      failure: error instanceof Error ? error.message : String(error),
    });
    writeJournal(input.journalPath, journal);
    throw error;
  }
}

export function executeFirstActivation(input: {
  repoRoot: string;
  journalPath: string;
  lockPath: string;
  steps: readonly FirstActivationStep[];
  transactionId?: string;
  createdAt?: string;
  beforeActivate?: (component: FirstActivationComponent) => void;
  postCommit?: () => void;
}): FirstActivationJournal {
  const repoRoot = path.resolve(input.repoRoot);
  assertPlan({ repoRoot, steps: input.steps });
  const descriptor = acquireLock(input.lockPath);
  let journal = asJournal({
    transactionId: input.transactionId ?? `first-activation-${randomUUID()}`,
    repoRoot,
    createdAt: input.createdAt ?? new Date().toISOString(),
    status: 'PREPARED',
    steps: input.steps.map((step) => ({
      component: step.component,
      pointerPath: step.pointerPath,
      target: step.target,
      status: 'PENDING',
    })),
  });

  try {
    for (const step of input.steps) {
      if (readFirstActivationPointerIdentity(step) !== null) {
        throw new FirstActivationError(`first activation requires absent pointer: ${step.component}`);
      }
    }
    writeJournal(input.journalPath, journal);

    for (const step of input.steps) {
      input.beforeActivate?.(step.component);
      const journalStep = journal.steps.find((row) => row.component === step.component);
      if (!journalStep) throw new FirstActivationError(`journal step missing: ${step.component}`);
      journalStep.status = 'STARTED';
      journal = asJournal({ ...journal, steps: journal.steps.map((row) => ({ ...row })) });
      writeJournal(input.journalPath, journal);
      step.activate();
      const current = readFirstActivationPointerIdentity(step);
      if (!sameIdentity(current, step.target)) {
        throw new FirstActivationError(`post-write identity mismatch: ${step.component}`);
      }
      journalStep.status = 'APPLIED';
      journal = asJournal({ ...journal, steps: journal.steps.map((row) => ({ ...row })) });
      writeJournal(input.journalPath, journal);
    }

    input.postCommit?.();
    journal = asJournal({ ...journal, status: 'COMMITTED' });
    writeJournal(input.journalPath, journal);
    return journal;
  } catch (error) {
    const failure = error instanceof Error ? error.message : String(error);
    journal = asJournal({ ...journal, failure });
    writeJournal(input.journalPath, journal);
    try {
      compensate({ journalPath: input.journalPath, journal });
    } catch (rollbackError) {
      throw new FirstActivationError(
        `${failure}; compensation failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
      );
    }
    throw error;
  } finally {
    releaseLock(input.lockPath, descriptor);
  }
}

export function rollbackCommittedFirstActivation(input: {
  journalPath: string;
  lockPath: string;
}): FirstActivationJournal {
  const descriptor = acquireLock(input.lockPath);
  try {
    const journal = readFirstActivationJournal(input.journalPath);
    if (journal.status !== 'COMMITTED') {
      throw new FirstActivationError(`cannot rollback first activation from ${journal.status}`);
    }
    return compensate({ journalPath: input.journalPath, journal });
  } finally {
    releaseLock(input.lockPath, descriptor);
  }
}
