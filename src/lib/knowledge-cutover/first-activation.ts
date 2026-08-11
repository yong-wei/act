/**
 * Write-ahead, identity-constrained protocol for a local all-ABSENT first
 * activation. Component stores retain their own activation receipts; this
 * coordinator only records ordering and compensates a failed first switch.
 */

import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
} from 'node:fs';
import path from 'node:path';

import { activationCanonicalJson } from '@/lib/versioned-knowledge-activation/hash';
import { atomicWriteFile } from '@/lib/versioned-knowledge-activation/store';

export const FIRST_ACTIVATION_JOURNAL_CONTRACT =
  'actkg-to-act-first-activation-journal/v2' as const;

const LEGACY_FIRST_ACTIVATION_JOURNAL_CONTRACT =
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

export interface FirstActivationPointerLocator {
  kind: 'repo-relative';
  path: string;
}

interface FirstActivationJournalStep {
  component: FirstActivationComponent;
  pointer: FirstActivationPointerLocator;
  target: FirstActivationPointerIdentity;
  status: 'PENDING' | 'STARTED' | 'APPLIED' | 'ROLLED_BACK';
}

type FirstActivationJournalStatus =
  | 'PREPARED'
  | 'COMMITTED'
  | 'ROLLING_BACK'
  | 'ROLLED_BACK'
  | 'ROLLBACK_FAILED';

type FirstActivationJournalStepStatus = FirstActivationJournalStep['status'];

export interface FirstActivationJournal {
  contract: typeof FIRST_ACTIVATION_JOURNAL_CONTRACT;
  transactionId: string;
  createdAt: string;
  status: 'PREPARED' | 'COMMITTED' | 'ROLLING_BACK' | 'ROLLED_BACK' | 'ROLLBACK_FAILED';
  prestate: 'ALL_POINTERS_ABSENT';
  steps: FirstActivationJournalStep[];
  failure: string | null;
  journalHash: string;
}

interface LegacyFirstActivationJournal {
  contract: typeof LEGACY_FIRST_ACTIVATION_JOURNAL_CONTRACT;
  transactionId: string;
  repoRoot: string;
  createdAt: string;
  status: FirstActivationJournal['status'];
  prestate: 'ALL_POINTERS_ABSENT';
  steps: Array<{
    component: FirstActivationComponent;
    pointerPath: string;
    target: FirstActivationPointerIdentity;
    status: FirstActivationJournalStep['status'];
  }>;
  failure: string | null;
  journalHash: string;
}

export interface FirstActivationJournalMigrationReceipt {
  contract: 'actkg-to-act-first-activation-journal-migration/v1';
  transactionId: string;
  legacyJournalHash: string;
  journalHash: string;
  migratedAt: string;
}

export interface FirstActivationJournalStateCorrectionReceipt {
  contract: 'actkg-to-act-first-activation-journal-state-correction/v1';
  transactionId: string;
  beforeJournalHash: string;
  afterJournalHash: string;
  correctedAt: string;
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

function isJournalStatus(value: unknown): value is FirstActivationJournalStatus {
  return value === 'PREPARED'
    || value === 'COMMITTED'
    || value === 'ROLLING_BACK'
    || value === 'ROLLED_BACK'
    || value === 'ROLLBACK_FAILED';
}

function isJournalStepStatus(value: unknown): value is FirstActivationJournalStepStatus {
  return value === 'PENDING'
    || value === 'STARTED'
    || value === 'APPLIED'
    || value === 'ROLLED_BACK';
}

function assertTargetIdentity(
  value: unknown,
  component: FirstActivationComponent,
): asserts value is FirstActivationPointerIdentity {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || (value as FirstActivationPointerIdentity).component !== component
    || typeof (value as FirstActivationPointerIdentity).id !== 'string'
    || (value as FirstActivationPointerIdentity).id.length === 0
    || typeof (value as FirstActivationPointerIdentity).hash !== 'string'
    || !/^[a-f0-9]{64}$/u.test((value as FirstActivationPointerIdentity).hash)
  ) {
    throw new FirstActivationError('first-activation journal target identity is invalid');
  }
}

function normalizeLocatorPath(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new FirstActivationError('journal pointer locator path is missing');
  }
  if (
    value.includes('\\')
    || value.startsWith('//')
    || /^[A-Za-z]:/u.test(value)
    || path.posix.isAbsolute(value)
  ) {
    throw new FirstActivationError('journal pointer locator must be repo-relative');
  }
  const normalized = path.posix.normalize(value);
  if (
    normalized === '.'
    || normalized === '..'
    || normalized.startsWith('../')
    || normalized !== value
  ) {
    throw new FirstActivationError('journal pointer locator escapes repository root');
  }
  return normalized;
}

function assertNoSymlinkAncestor(repoRoot: string, targetPath: string): void {
  const relative = path.relative(repoRoot, targetPath);
  let current = repoRoot;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) {
      throw new FirstActivationError(`pointer locator crosses a symbolic link: ${relative}`);
    }
  }
}

function locatorForPointerPath(
  repoRoot: string,
  pointerPath: string,
): FirstActivationPointerLocator {
  const targetPath = path.resolve(pointerPath);
  const relative = path.relative(repoRoot, targetPath).split(path.sep).join('/');
  const normalized = normalizeLocatorPath(relative);
  assertNoSymlinkAncestor(repoRoot, targetPath);
  return { kind: 'repo-relative', path: normalized };
}

function resolvePointerLocator(
  repoRoot: string,
  locator: FirstActivationPointerLocator,
): string {
  if (locator.kind !== 'repo-relative') {
    throw new FirstActivationError('journal pointer locator kind is invalid');
  }
  const normalized = normalizeLocatorPath(locator.path);
  const targetPath = path.resolve(repoRoot, ...normalized.split('/'));
  const relative = path.relative(repoRoot, targetPath);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new FirstActivationError('journal pointer locator resolves outside repository root');
  }
  assertNoSymlinkAncestor(repoRoot, targetPath);
  return targetPath;
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
    || !isJournalStatus(journal.status)
    || journal.prestate !== 'ALL_POINTERS_ABSENT'
    || typeof journal.transactionId !== 'string'
    || journal.transactionId.length === 0
    || typeof journal.createdAt !== 'string'
    || journal.createdAt.length === 0
    || (journal.failure !== null && typeof journal.failure !== 'string')
    || typeof journalHash !== 'string'
    || journalHash !== sha256(activationCanonicalJson(body))
  ) {
    throw new FirstActivationError('first-activation journal hash or contract mismatch');
  }
  if (!Array.isArray(journal.steps) || journal.steps.length !== FIRST_ACTIVATION_COMPONENTS.length) {
    throw new FirstActivationError('first-activation journal steps are invalid');
  }
  for (const [index, component] of FIRST_ACTIVATION_COMPONENTS.entries()) {
    const step = journal.steps[index];
    if (!step || step.component !== component) {
      throw new FirstActivationError('first-activation journal step order is invalid');
    }
    assertTargetIdentity(step.target, component);
    if (!isJournalStepStatus(step.status)) {
      throw new FirstActivationError('first-activation journal step status is invalid');
    }
    if (!step.pointer || step.pointer.kind !== 'repo-relative') {
      throw new FirstActivationError('first-activation journal pointer locator is invalid');
    }
    normalizeLocatorPath(step.pointer.path);
  }
  const pointerLocators = journal.steps.map((step) => step.pointer.path);
  if (new Set(pointerLocators).size !== FIRST_ACTIVATION_COMPONENTS.length) {
    throw new FirstActivationError('first-activation journal pointer locators must be unique');
  }
  return journal;
}

function readLegacyFirstActivationJournal(
  journalPath: string,
): LegacyFirstActivationJournal {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(journalPath, 'utf8')) as unknown;
  } catch (error) {
    throw new FirstActivationError(
      `cannot read legacy first-activation journal: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new FirstActivationError('legacy first-activation journal is not an object');
  }
  const journal = value as LegacyFirstActivationJournal;
  const { journalHash, ...body } = journal;
  if (
    journal.contract !== LEGACY_FIRST_ACTIVATION_JOURNAL_CONTRACT
    || !isJournalStatus(journal.status)
    || journal.prestate !== 'ALL_POINTERS_ABSENT'
    || typeof journalHash !== 'string'
    || journalHash !== sha256(activationCanonicalJson(body))
  ) {
    throw new FirstActivationError('legacy first-activation journal hash or contract mismatch');
  }
  return journal;
}

/**
 * One-time conversion of the predecessor journal format. Runtime readers only
 * accept v2; this explicit operation removes historical local paths after
 * checking every legacy path against the supplied repository root.
 */
export function migrateLegacyFirstActivationJournal(input: {
  repoRoot: string;
  journalPath: string;
  lockPath: string;
  migratedAt?: string;
}): FirstActivationJournalMigrationReceipt {
  const repoRoot = path.resolve(input.repoRoot);
  const descriptor = acquireLock(input.lockPath);
  try {
    const legacy = readLegacyFirstActivationJournal(input.journalPath);
    if (!path.isAbsolute(legacy.repoRoot) || path.resolve(legacy.repoRoot) !== repoRoot) {
      throw new FirstActivationError('legacy journal repository root does not match migration root');
    }
    if (
      !Array.isArray(legacy.steps)
      || legacy.steps.length !== FIRST_ACTIVATION_COMPONENTS.length
    ) {
      throw new FirstActivationError('legacy first-activation journal steps are invalid');
    }
    const steps: FirstActivationJournalStep[] = legacy.steps.map((step, index) => {
      const component = FIRST_ACTIVATION_COMPONENTS[index];
      if (
        !component
        || step.component !== component
        || !path.isAbsolute(step.pointerPath)
      ) {
        throw new FirstActivationError('legacy first-activation journal step is invalid');
      }
      assertTargetIdentity(step.target, component);
      if (!isJournalStepStatus(step.status)) {
        throw new FirstActivationError('legacy first-activation journal step status is invalid');
      }
      return {
        component,
        pointer: locatorForPointerPath(repoRoot, step.pointerPath),
        target: step.target,
        status:
          legacy.status === 'COMMITTED'
            ? 'APPLIED'
            : legacy.status === 'ROLLED_BACK'
              ? 'ROLLED_BACK'
              : step.status,
      };
    });
    const journal = asJournal({
      transactionId: legacy.transactionId,
      createdAt: legacy.createdAt,
      status: legacy.status,
      steps,
      failure: legacy.failure,
    });
    writeJournal(input.journalPath, journal);
    return {
      contract: 'actkg-to-act-first-activation-journal-migration/v1',
      transactionId: journal.transactionId,
      legacyJournalHash: legacy.journalHash,
      journalHash: journal.journalHash,
      migratedAt: input.migratedAt ?? new Date().toISOString(),
    };
  } finally {
    releaseLock(input.lockPath, descriptor);
  }
}

/**
 * Repair a migrated v2 journal whose terminal status is authoritative but
 * whose per-step statuses were persisted from stale object references.
 *
 * This operation never touches pointer artifacts. It only normalizes all four
 * step statuses when the terminal journal status determines the result, and
 * returns both hashes so the caller can retain an auditable correction record.
 */
export function repairMigratedFirstActivationJournal(input: {
  journalPath: string;
  lockPath: string;
  correctedAt?: string;
}): FirstActivationJournalStateCorrectionReceipt {
  const descriptor = acquireLock(input.lockPath);
  try {
    const before = readFirstActivationJournal(input.journalPath);
    const stepStatus =
      before.status === 'COMMITTED'
        ? 'APPLIED'
        : before.status === 'ROLLED_BACK'
          ? 'ROLLED_BACK'
          : null;
    if (!stepStatus) {
      throw new FirstActivationError(
        `cannot repair first-activation journal from ${before.status}`,
      );
    }
    const after = asJournal({
      ...before,
      steps: before.steps.map((step) => ({ ...step, status: stepStatus })),
    });
    writeJournal(input.journalPath, after);
    return {
      contract: 'actkg-to-act-first-activation-journal-state-correction/v1',
      transactionId: before.transactionId,
      beforeJournalHash: before.journalHash,
      afterJournalHash: after.journalHash,
      correctedAt: input.correctedAt ?? new Date().toISOString(),
    };
  } finally {
    releaseLock(input.lockPath, descriptor);
  }
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
  const pointerPaths = new Set<string>();
  for (const [index, component] of FIRST_ACTIVATION_COMPONENTS.entries()) {
    const step = input.steps[index];
    if (!step || step.component !== component || step.target.component !== component) {
      throw new FirstActivationError(`first activation step order must be ${FIRST_ACTIVATION_COMPONENTS.join(' → ')}`);
    }
    assertTargetIdentity(step.target, component);
    const pointerPath = locatorForPointerPath(input.repoRoot, step.pointerPath).path;
    if (pointerPaths.has(pointerPath)) {
      throw new FirstActivationError('first activation pointer locators must be unique');
    }
    pointerPaths.add(pointerPath);
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
  createdAt: string;
  status: FirstActivationJournal['status'];
  steps: FirstActivationJournalStep[];
  failure?: string | null;
}): FirstActivationJournal {
  return sealJournal({
    contract: FIRST_ACTIVATION_JOURNAL_CONTRACT,
    transactionId: input.transactionId,
    createdAt: input.createdAt,
    status: input.status,
    prestate: 'ALL_POINTERS_ABSENT',
    steps: input.steps,
    failure: input.failure ?? null,
  });
}

function withStepStatus(
  journal: FirstActivationJournal,
  component: FirstActivationComponent,
  status: FirstActivationJournalStepStatus,
): FirstActivationJournal {
  return asJournal({
    ...journal,
    steps: journal.steps.map((step) =>
      step.component === component ? { ...step, status } : { ...step }),
  });
}

function resolveJournalPointerPaths(
  repoRoot: string,
  journal: FirstActivationJournal,
): string[] {
  const pointerPaths = journal.steps.map((step) => resolvePointerLocator(repoRoot, step.pointer));
  if (new Set(pointerPaths).size !== FIRST_ACTIVATION_COMPONENTS.length) {
    throw new FirstActivationError('first-activation journal pointer locators must be unique');
  }
  return pointerPaths;
}

function assertInitialJournalMatches(
  expected: FirstActivationJournal,
  persisted: FirstActivationJournal,
): void {
  if (
    persisted.transactionId !== expected.transactionId
    || persisted.createdAt !== expected.createdAt
    || persisted.status !== expected.status
    || persisted.prestate !== expected.prestate
    || persisted.failure !== expected.failure
    || persisted.journalHash !== expected.journalHash
    || persisted.steps.length !== expected.steps.length
  ) {
    throw new FirstActivationError(
      'first-activation initial journal write could not be confirmed',
    );
  }

  for (const [index, expectedStep] of expected.steps.entries()) {
    const persistedStep = persisted.steps[index];
    if (
      !persistedStep
      || persistedStep.component !== expectedStep.component
      || persistedStep.pointer.kind !== expectedStep.pointer.kind
      || persistedStep.pointer.path !== expectedStep.pointer.path
      || persistedStep.status !== expectedStep.status
      || !sameIdentity(persistedStep.target, expectedStep.target)
    ) {
      throw new FirstActivationError(
        'first-activation initial journal identity could not be confirmed',
      );
    }
  }
}

function compensate(input: {
  repoRoot: string;
  journalPath: string;
  journal: FirstActivationJournal;
  pointerPaths?: readonly string[];
  failureStatus: 'ROLLBACK_FAILED' | 'ROLLING_BACK';
}): FirstActivationJournal {
  const pointerPaths = input.pointerPaths ?? resolveJournalPointerPaths(input.repoRoot, input.journal);
  let journal = asJournal({
    ...input.journal,
    status: 'ROLLING_BACK',
    steps: input.journal.steps.map((step) => ({ ...step })),
  });
  writeJournal(input.journalPath, journal);

  try {
    for (const index of [...journal.steps.keys()].reverse()) {
      const step = journal.steps[index];
      const pointerPath = pointerPaths[index];
      if (!step || !pointerPath) {
        throw new FirstActivationError('first-activation journal step or pointer is missing');
      }
      const current = readFirstActivationPointerIdentity({
        component: step.component,
        pointerPath,
      });
      if (current && !sameIdentity(current, step.target)) {
        throw new FirstActivationError(`rollback drift at ${step.component}`);
      }
      if (current) unlinkSync(pointerPath);
      journal = withStepStatus(journal, step.component, 'ROLLED_BACK');
      writeJournal(input.journalPath, journal);
    }
    for (const [index, step] of journal.steps.entries()) {
      const pointerPath = pointerPaths[index];
      if (!step || !pointerPath) {
        throw new FirstActivationError('first-activation journal step or pointer is missing');
      }
      if (readFirstActivationPointerIdentity({
        component: step.component,
        pointerPath,
      }) !== null) {
        throw new FirstActivationError(`rollback did not remove ${step.component}`);
      }
    }
    journal = asJournal({ ...journal, status: 'ROLLED_BACK' });
    writeJournal(input.journalPath, journal);
    return journal;
  } catch (error) {
    journal = asJournal({
      ...journal,
      status: input.failureStatus,
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

  try {
    if (existsSync(input.journalPath)) {
      const existing = readFirstActivationJournal(input.journalPath);
      resolveJournalPointerPaths(repoRoot, existing);
      throw new FirstActivationError(
        `first-activation journal already exists with status ${existing.status}; execute cannot overwrite it (non-terminal journals require explicit recovery); explicit operator action is required`,
      );
    }

    for (const step of input.steps) {
      if (readFirstActivationPointerIdentity(step) !== null) {
        throw new FirstActivationError(`first activation requires absent pointer: ${step.component}`);
      }
    }

    let journal = asJournal({
      transactionId: input.transactionId ?? `first-activation-${randomUUID()}`,
      createdAt: input.createdAt ?? new Date().toISOString(),
      status: 'PREPARED',
      steps: input.steps.map((step) => ({
        component: step.component,
        pointer: locatorForPointerPath(repoRoot, step.pointerPath),
        target: step.target,
        status: 'PENDING',
      })),
    });

    try {
      writeJournal(input.journalPath, journal);
    } catch (error) {
      throw new FirstActivationError(
        `first-activation initial journal write failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    let persistedJournal: FirstActivationJournal;
    try {
      persistedJournal = readFirstActivationJournal(input.journalPath);
    } catch (error) {
      throw new FirstActivationError(
        `first-activation initial journal write could not be confirmed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    assertInitialJournalMatches(journal, persistedJournal);
    journal = persistedJournal;

    try {
      for (const step of input.steps) {
        input.beforeActivate?.(step.component);
        if (!journal.steps.some((row) => row.component === step.component)) {
          throw new FirstActivationError(`journal step missing: ${step.component}`);
        }
        journal = withStepStatus(journal, step.component, 'STARTED');
        writeJournal(input.journalPath, journal);
        step.activate();
        const current = readFirstActivationPointerIdentity(step);
        if (!sameIdentity(current, step.target)) {
          throw new FirstActivationError(`post-write identity mismatch: ${step.component}`);
        }
        journal = withStepStatus(journal, step.component, 'APPLIED');
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
        compensate({
          repoRoot,
          journalPath: input.journalPath,
          journal,
          failureStatus: 'ROLLBACK_FAILED',
        });
      } catch (rollbackError) {
        throw new FirstActivationError(
          `${failure}; compensation failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
        );
      }
      throw error;
    }
  } finally {
    releaseLock(input.lockPath, descriptor);
  }
}

export function recoverInterruptedFirstActivation(input: {
  repoRoot: string;
  journalPath: string;
  lockPath: string;
}): FirstActivationJournal {
  const repoRoot = path.resolve(input.repoRoot);
  const descriptor = acquireLock(input.lockPath);
  try {
    const journal = readFirstActivationJournal(input.journalPath);
    const pointerPaths = resolveJournalPointerPaths(repoRoot, journal);
    if (journal.status !== 'PREPARED' && journal.status !== 'ROLLING_BACK') {
      throw new FirstActivationError(`cannot recover first activation from ${journal.status}`);
    }
    return compensate({
      repoRoot,
      journalPath: input.journalPath,
      journal,
      pointerPaths,
      failureStatus: 'ROLLING_BACK',
    });
  } finally {
    releaseLock(input.lockPath, descriptor);
  }
}

export function rollbackCommittedFirstActivation(input: {
  repoRoot: string;
  journalPath: string;
  lockPath: string;
}): FirstActivationJournal {
  const descriptor = acquireLock(input.lockPath);
  try {
    const journal = readFirstActivationJournal(input.journalPath);
    const pointerPaths = resolveJournalPointerPaths(path.resolve(input.repoRoot), journal);
    if (journal.status !== 'COMMITTED') {
      throw new FirstActivationError(`cannot rollback first activation from ${journal.status}`);
    }
    return compensate({
      repoRoot: path.resolve(input.repoRoot),
      journalPath: input.journalPath,
      journal,
      pointerPaths,
      failureStatus: 'ROLLBACK_FAILED',
    });
  } finally {
    releaseLock(input.lockPath, descriptor);
  }
}
