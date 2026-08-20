/** Identity-constrained five-selector production cutover for ActKG v0.22. */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  envelopeByName,
  pointerIdentitiesForEnvelope,
} from '../../actkg-envelope/composite-envelope-registry';
import { V09_LOCAL_POINTER_HASHES, V018_HOST_POINTER_HASHES } from './v022-host-shadow';
import {
  V022_RUNTIME_RELEASE_CONTRACT,
  V022_SEALED_QUALIFICATION_SHA256,
} from './v022-runtime-release';
import { projectionCanonicalJson, projectionDigest } from '../hash';
import {
  V09_RELEASE_ID,
  asRecord,
} from '../qualify/v022-shared';
import { V022_NAMED_CONSUMERS } from '../qualify/v022-qualify-contract';
import { readFirstActivationJournal } from '../../knowledge-cutover/first-activation';

export const V022_CUTOVER_JOURNAL_CONTRACT = 'actkg-v022-production-cutover-journal/v1' as const;
export const V022_CUTOVER_RECEIPT_CONTRACT = 'actkg-v022-production-cutover-receipt/v1' as const;
export const V022_CUTOVER_PREFLIGHT_CONTRACT = 'actkg-v022-production-cutover-preflight/v1' as const;

export const V022_CUTOVER_COMPONENTS = [
  'authority',
  'projection',
  'prerequisite',
  'authority-domain-shards',
  'consumer-activation',
] as const;
export type V022CutoverComponent = (typeof V022_CUTOVER_COMPONENTS)[number];

const V022_ENVELOPE = envelopeByName('control-theory-engineering-v0.22');
const V09_ENVELOPE = envelopeByName('control-theory-engineering-v0.9');
export const V022_PRODUCTION_ACTIVATION_ID = V022_ENVELOPE.activationId;
export const V022_SHARD_SET_ID = V022_ENVELOPE.shardSetId;
export const V022_PROJECTION_ID = V022_ENVELOPE.projectionId;
export const V022_PUBLICATION_ID = V022_ENVELOPE.publicationId;
export const V022_SNAPSHOT = V022_ENVELOPE.authoritySnapshotId;

export const V018_FIRST_ACTIVATION_MARKER_RELATIVE =
  'course-content/runtime/knowledge/consumer-activation/first-activation-transactions/first-cutover-7f4cdd1084af419a3e837876.json';
export const V09_FIRST_ACTIVATION_TRANSACTION_ID = 'first-cutover-7f4cdd1084af419a3e837876';
export const V09_FIRST_ACTIVATION_JOURNAL_HASH =
  'fcb5822b4cced3bf6e76102f49bc6ceb89b53823ebca86d6766521c4b463f277';

export const V022_CUTOVER_POINTER_PATHS = {
  authority: 'course-content/authoring/knowledge/authority/current.json',
  projection: 'course-content/runtime/knowledge/projection/current.json',
  prerequisite: 'course-content/runtime/knowledge/prerequisites/current.json',
  'authority-domain-shards': 'course-content/runtime/knowledge/authority-domain-shards/current.json',
  'consumer-activation': 'course-content/runtime/knowledge/consumer-activation/current.json',
} as const;

function requiredHash(value: string | null, label: string): string {
  if (!value) throw new Error(`${label} hash is required`);
  return value;
}

const V09_POINTERS = pointerIdentitiesForEnvelope('control-theory-engineering-v0.9');
const V022_POINTERS = pointerIdentitiesForEnvelope('control-theory-engineering-v0.22');

export const V09_PREDECESSOR_IDENTITIES = {
  authority: { id: V09_POINTERS.authority.id, hash: requiredHash(V09_POINTERS.authority.hash, 'v0.9 authority') },
  projection: { id: V09_POINTERS.projection.id, hash: requiredHash(V09_POINTERS.projection.hash, 'v0.9 projection') },
  prerequisite: { id: V09_POINTERS.prerequisite.id, hash: requiredHash(V09_POINTERS.prerequisite.hash, 'v0.9 prerequisite') },
  'authority-domain-shards': { id: V09_POINTERS['authority-domain-shards'].id, hash: requiredHash(V09_POINTERS['authority-domain-shards'].hash, 'v0.9 shards') },
  'consumer-activation': { id: V09_POINTERS['consumer-activation'].id, hash: requiredHash(V09_POINTERS['consumer-activation'].hash, 'v0.9 activation') },
} as const;

export const V022_TARGET_IDENTITIES = {
  authority: { id: V022_POINTERS.authority.id, hash: requiredHash(V022_POINTERS.authority.hash, 'v0.22 authority') },
  projection: { id: V022_POINTERS.projection.id, hash: requiredHash(V022_POINTERS.projection.hash, 'v0.22 projection') },
  prerequisite: { id: V022_POINTERS.prerequisite.id, hash: requiredHash(V022_POINTERS.prerequisite.hash, 'v0.22 prerequisite') },
  'authority-domain-shards': { id: V022_POINTERS['authority-domain-shards'].id, hash: requiredHash(V022_POINTERS['authority-domain-shards'].hash, 'v0.22 shards') },
  'consumer-activation': { id: V022_POINTERS['consumer-activation'].id, hash: V022_POINTERS['consumer-activation'].hash },
} as const;

export class V022ProductionCutoverError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'V022ProductionCutoverError';
    this.code = code;
  }
}

export interface PointerIdentity {
  component: V022CutoverComponent;
  id: string;
  hash: string;
  fileSha256: string;
  bytes: Buffer;
}

export interface CutoverPointerBackend {
  read(component: V022CutoverComponent): PointerIdentity | null;
  apply(component: V022CutoverComponent, targetId: string): PointerIdentity;
  restore(component: V022CutoverComponent, predecessor: PointerIdentity): PointerIdentity;
}

export interface CutoverHostObservation {
  appImage?: string;
  appImageId?: string;
  workerImage?: string;
  workerImageId?: string;
  workerHealth?: string;
  readyz?: { app?: boolean; db?: boolean; redis?: boolean };
  predecessorFileHashes?: Partial<Record<V022CutoverComponent, string>>;
  firstActivationCommitted?: boolean;
  markerPresent?: boolean;
  lockHeld?: boolean;
}

export interface CutoverJournalStep {
  component: V022CutoverComponent;
  predecessor: { id: string; hash: string; fileSha256: string };
  target: { id: string; hash: string | null };
  status: 'PENDING' | 'STARTED' | 'APPLIED' | 'ROLLED_BACK';
}

export interface CutoverJournal {
  contract: typeof V022_CUTOVER_JOURNAL_CONTRACT;
  transactionId: string;
  createdAt: string;
  status: 'PREPARED' | 'COMMITTING' | 'COMMITTED' | 'ROLLING_BACK' | 'ROLLED_BACK' | 'BLOCKED_RECOVERY';
  prestate: string;
  ready: boolean;
  steps: CutoverJournalStep[];
  failure: string | null;
  journalHash: string;
}

export interface CutoverPreflight {
  contract: typeof V022_CUTOVER_PREFLIGHT_CONTRACT;
  status: 'READY' | 'BLOCKED';
  qualificationDigest: string | null;
  runtimeReceiptDigest: string | null;
  predecessorHashes: Record<string, string>;
  blockers: string[];
}

export interface CutoverReceipt {
  contract: typeof V022_CUTOVER_RECEIPT_CONTRACT;
  transactionId: string;
  status: 'READY' | 'BLOCKED' | 'ROLLED_BACK' | 'BLOCKED_RECOVERY';
  ready: boolean;
  journalHash: string;
  nextAction: 'retain-v09-rollback' | 'blocked' | 'operator-intervention';
  observations?: Record<string, unknown>;
  blockers: string[];
  receiptDigest: string;
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function sealCutoverValue<T extends Record<string, unknown>>(
  value: T,
  digestKey: 'journalHash' | 'receiptDigest',
): T {
  const { [digestKey]: _ignored, ...body } = value;
  return { ...value, [digestKey]: projectionDigest(body) };
}

function identityFields(component: V022CutoverComponent): [string, string] {
  switch (component) {
    case 'authority':
      return ['snapshotId', 'snapshotHash'];
    case 'projection':
      return ['projectionId', 'projectionHash'];
    case 'prerequisite':
      return ['publicationId', 'publicationHash'];
    case 'authority-domain-shards':
      return ['shardSetId', 'shardSetHash'];
    case 'consumer-activation':
      return ['activationId', 'activationHash'];
  }
}

export function pointerIdentityFromBytes(
  component: V022CutoverComponent,
  bytes: Buffer,
): PointerIdentity {
  const record = asRecord(JSON.parse(bytes.toString('utf8')));
  const [idField, hashField] = identityFields(component);
  const id = String(record[idField] ?? '');
  const hash = String(record[hashField] ?? '');
  if (!id || !/^[a-f0-9]{64}$/.test(hash)) {
    throw new V022ProductionCutoverError('pointer-identity-invalid', `${component} pointer identity is invalid`);
  }
  return { component, id, hash, fileSha256: sha256(bytes), bytes };
}

export function samePointer(left: PointerIdentity | null, right: { id: string; hash: string }): boolean {
  return Boolean(left && left.id === right.id && left.hash === right.hash);
}

export function expectedPredecessorHashes(
  source: 'host' | 'local',
  previousEnvelopeName = 'control-theory-engineering-v0.9',
): Record<V022CutoverComponent, string> {
  const hashes = source === 'host' && previousEnvelopeName === 'control-theory-engineering-v0.18'
    ? V018_HOST_POINTER_HASHES
    : V09_LOCAL_POINTER_HASHES;
  return {
    authority: hashes.authority,
    projection: hashes.projection,
    prerequisite: hashes.prerequisites,
    'authority-domain-shards': hashes.shards,
    'consumer-activation': hashes.activation,
  };
}

export function reviewedMembershipFromQualification(qualification: Record<string, unknown>): {
  membershipCount: number;
  domainCount: number;
} {
  const audit = asRecord(qualification.audit);
  const membershipCount = Number(audit.membershipCount ?? audit.releaseNodeCount ?? NaN);
  const domainCount = Number(audit.domainCount ?? NaN);
  if (!Number.isInteger(membershipCount) || membershipCount <= 0 || !Number.isInteger(domainCount) || domainCount <= 0) {
    throw new V022ProductionCutoverError('qualification-membership-missing', 'qualification evidence does not record reviewed membership');
  }
  return { membershipCount, domainCount };
}

function readJsonFile(filePath: string): Record<string, unknown> {
  return asRecord(JSON.parse(readFileSync(filePath, 'utf8')));
}

export function inspectSealedRuntimeReceipt(bytes: Buffer): {
  declared: string;
  actual: string;
  fileSha256: string;
  blockers: string[];
} {
  const blockers: string[] = [];
  const runtime = asRecord(JSON.parse(bytes.toString('utf8')));
  const declared = String(runtime.receiptDigest ?? '');
  const actual = projectionDigest((({ receiptDigest: _ignored, ...rest }) => rest)(runtime));
  const fileSha256 = sha256(bytes);
  if (!declared || declared !== actual) blockers.push('runtime-receipt-digest-mismatch');
  return { declared, actual, fileSha256, blockers };
}

export function inspectFirstActivationMarker(repoRoot: string): { blockers: string[] } {
  const blockers: string[] = [];
  const markerPath = path.join(repoRoot, V018_FIRST_ACTIVATION_MARKER_RELATIVE);
  if (!existsSync(markerPath)) {
    return { blockers: ['production-marker-missing'] };
  }
  try {
    const journal = readFirstActivationJournal(markerPath);
    if (journal.status !== 'COMMITTED') blockers.push('production-marker-not-committed');
    if (journal.transactionId !== V09_FIRST_ACTIVATION_TRANSACTION_ID) {
      blockers.push('production-marker-transaction-drift');
    }
    if (journal.journalHash !== V09_FIRST_ACTIVATION_JOURNAL_HASH) {
      blockers.push('production-marker-hash-drift');
    }
    if (journal.steps.length === 0 || journal.steps.some((step) => step.status !== 'APPLIED')) {
      blockers.push('production-marker-steps-incomplete');
    }
    for (const step of journal.steps) {
      const expected = V09_PREDECESSOR_IDENTITIES[step.component as keyof typeof V09_PREDECESSOR_IDENTITIES];
      if (!expected || step.target.id !== expected.id || step.target.hash !== expected.hash) {
        blockers.push(`production-marker-target-drift:${step.component}`);
      }
    }
  } catch {
    blockers.push('production-marker-invalid');
  }
  return { blockers };
}

export function preflightV022ProductionCutover(input: {
  repoRoot: string;
  observation: CutoverHostObservation;
  predecessorSource?: 'host' | 'local';
  requireFrozenImage?: boolean;
}): CutoverPreflight {
  const blockers: string[] = [];
  const qualificationPath = path.join(
    input.repoRoot,
    'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.22/qualification-readiness.json',
  );
  const runtimePath = path.join(
    input.repoRoot,
    'course-content/authoring/knowledge/cutover/runtime-releases/control-theory-engineering-v0.22/runtime-release-receipt.json',
  );
  const hostShadowPath = path.join(
    input.repoRoot,
    'course-content/authoring/knowledge/cutover/runtime-releases/control-theory-engineering-v0.22/host-shadow-verification.json',
  );

  let qualificationDigest: string | null = null;
  let runtimeReceiptDigest: string | null = null;
  if (!existsSync(qualificationPath)) blockers.push('qualification-missing');
  else {
    qualificationDigest = sha256(readFileSync(qualificationPath));
    if (qualificationDigest !== V022_SEALED_QUALIFICATION_SHA256) blockers.push('qualification-digest-drift');
    const qualification = readJsonFile(qualificationPath);
    if (qualification.status !== 'READY') blockers.push('qualification-not-ready');
    if (qualification.productionCutoverAuthorized === true) blockers.push('qualification-claimed-cutover');
  }
  if (!existsSync(runtimePath)) blockers.push('runtime-receipt-missing');
  else {
    const bytes = readFileSync(runtimePath);
    const runtime = asRecord(JSON.parse(bytes.toString('utf8')));
    const inspected = inspectSealedRuntimeReceipt(bytes);
    runtimeReceiptDigest = inspected.actual;
    blockers.push(...inspected.blockers);
    if (runtime.contract !== V022_RUNTIME_RELEASE_CONTRACT) blockers.push('runtime-receipt-contract');
    if (runtime.status !== 'READY') blockers.push('runtime-receipt-not-ready');
    if (runtime.productionCutoverAuthorized === true) blockers.push('runtime-claimed-cutover');
    if (runtime.qualificationDigest !== V022_SEALED_QUALIFICATION_SHA256) blockers.push('runtime-qualification-pin-drift');
  }
  if (existsSync(hostShadowPath)) {
    const host = readJsonFile(hostShadowPath);
    if (host.status !== 'READY') blockers.push('host-shadow-not-ready');
  }

  if (input.requireFrozenImage === true) {
    blockers.push('oci-image-not-sealed');
  }
  if (input.observation.readyz && (input.observation.readyz.app !== true || input.observation.readyz.db !== true || input.observation.readyz.redis !== true)) {
    blockers.push('readyz-not-ready');
  }
  if (input.observation.lockHeld) blockers.push('exclusive-lock-held');
  if (!input.observation.markerPresent && !input.observation.firstActivationCommitted) {
    blockers.push('production-marker-missing');
  } else {
    blockers.push(...inspectFirstActivationMarker(input.repoRoot).blockers);
  }

  const expected = expectedPredecessorHashes(
    input.predecessorSource ?? 'host',
    input.predecessorSource === 'host' ? 'control-theory-engineering-v0.18' : 'control-theory-engineering-v0.9',
  );
  const observed = input.observation.predecessorFileHashes ?? {};
  for (const component of V022_CUTOVER_COMPONENTS) {
    if (observed[component] !== expected[component]) blockers.push(`predecessor-hash-drift:${component}`);
  }

  const unique = [...new Set(blockers)].sort();
  return {
    contract: V022_CUTOVER_PREFLIGHT_CONTRACT,
    status: unique.length === 0 ? 'READY' : 'BLOCKED',
    qualificationDigest,
    runtimeReceiptDigest,
    predecessorHashes: expected,
    blockers: unique,
  };
}

function sealJournal(journal: Omit<CutoverJournal, 'journalHash'> & { journalHash?: string }): CutoverJournal {
  return sealCutoverValue({ ...journal, journalHash: '' }, 'journalHash') as CutoverJournal;
}

export function createPreparedJournal(input: {
  transactionId: string;
  createdAt?: string;
  predecessors: Record<V022CutoverComponent, PointerIdentity>;
  consumerActivationHash?: string | null;
  targetOverrides?: Partial<Record<V022CutoverComponent, { id: string; hash: string | null }>>;
}): CutoverJournal {
  return sealJournal({
    contract: V022_CUTOVER_JOURNAL_CONTRACT,
    transactionId: input.transactionId,
    createdAt: input.createdAt ?? new Date().toISOString(),
    status: 'PREPARED',
    prestate: input.predecessors.authority.id === V09_ENVELOPE.authoritySnapshotId
      ? 'control-theory-engineering-v0.9'
      : envelopeByName('control-theory-engineering-v0.18').name,
    ready: false,
    failure: null,
    steps: V022_CUTOVER_COMPONENTS.map((component) => ({
      component,
      predecessor: {
        id: input.predecessors[component].id,
        hash: input.predecessors[component].hash,
        fileSha256: input.predecessors[component].fileSha256,
      },
      target: input.targetOverrides?.[component] ?? {
        id: V022_TARGET_IDENTITIES[component].id,
        hash: component === 'consumer-activation'
          ? input.consumerActivationHash ?? null
          : V022_TARGET_IDENTITIES[component].hash,
      },
      status: 'PENDING',
    })),
  });
}

function withStep(
  journal: CutoverJournal,
  component: V022CutoverComponent,
  status: CutoverJournalStep['status'],
  extra: Partial<CutoverJournal> = {},
  patch: Partial<CutoverJournalStep> = {},
): CutoverJournal {
  return sealJournal({
    ...journal,
    ...extra,
    steps: journal.steps.map((step) => (
      step.component === component ? { ...step, ...patch, status } : step
    )),
  });
}

function consumerCommitted(journal: CutoverJournal): boolean {
  return journal.steps.every((step) => step.status === 'APPLIED')
    && journal.steps.at(-1)?.component === 'consumer-activation';
}

export function executeV022ProductionCutover(input: {
  backend: CutoverPointerBackend;
  journal: CutoverJournal;
  persistJournal: (journal: CutoverJournal) => CutoverJournal;
  predecessors?: Record<V022CutoverComponent, PointerIdentity>;
}): CutoverJournal {
  if (input.journal.status !== 'PREPARED') {
    throw new V022ProductionCutoverError('journal-not-prepared', `cannot execute from ${input.journal.status}`);
  }
  let journal = input.persistJournal(input.journal);
  if (journal.journalHash !== input.journal.journalHash) {
    throw new V022ProductionCutoverError('journal-reread-drift', 'prepared journal hash drifted');
  }

  try {
    for (const step of journal.steps) {
      const current = input.backend.read(step.component);
      if (!current || current.fileSha256 !== step.predecessor.fileSha256 || !samePointer(current, step.predecessor)) {
        throw new V022ProductionCutoverError('predecessor-cas-failed', `${step.component} is not the journaled predecessor`);
      }
      journal = input.persistJournal(withStep(journal, step.component, 'STARTED', {
        status: step.component === 'consumer-activation' ? 'COMMITTING' : 'PREPARED',
        ready: false,
      }));
      const applied = input.backend.apply(step.component, step.target.id);
      if (applied.id !== step.target.id) {
        throw new V022ProductionCutoverError('target-id-mismatch', `${step.component} did not advance to ${step.target.id}`);
      }
      if (step.target.hash && applied.hash !== step.target.hash) {
        throw new V022ProductionCutoverError('target-hash-mismatch', `${step.component} hash drifted`);
      }
      journal = input.persistJournal(withStep(
        journal,
        step.component,
        'APPLIED',
        {
          status: step.component === 'consumer-activation' ? 'COMMITTED' : 'COMMITTING',
          ready: step.component === 'consumer-activation',
        },
        { target: { id: step.target.id, hash: applied.hash } },
      ));
      if (step.component !== 'consumer-activation' && journal.ready) {
        throw new V022ProductionCutoverError('premature-ready', 'release set became READY before consumer activation');
      }
    }
    if (!consumerCommitted(journal) || !journal.ready) {
      throw new V022ProductionCutoverError('consumer-not-committed', 'consumer activation is the only READY commit point');
    }
    return journal;
  } catch (error) {
    const failure = error instanceof Error ? error.message : String(error);
    journal = input.persistJournal(sealJournal({ ...journal, failure, ready: false, status: journal.status === 'COMMITTED' ? 'COMMITTED' : 'ROLLING_BACK' }));
    if (input.predecessors) {
      journal = compensateV022ProductionCutover({
        backend: input.backend,
        journal,
        persistJournal: input.persistJournal,
        predecessors: input.predecessors,
      });
    }
    throw error instanceof V022ProductionCutoverError
      ? error
      : new V022ProductionCutoverError('execute-failed', failure);
  }
}

export function compensateV022ProductionCutover(input: {
  backend: CutoverPointerBackend;
  journal: CutoverJournal;
  persistJournal: (journal: CutoverJournal) => CutoverJournal;
  predecessors: Record<V022CutoverComponent, PointerIdentity>;
}): CutoverJournal {
  let journal = input.persistJournal(sealJournal({ ...input.journal, status: 'ROLLING_BACK', ready: false }));
  try {
    for (const step of [...journal.steps].reverse()) {
      if (step.status !== 'APPLIED' && step.status !== 'STARTED') continue;
      const current = input.backend.read(step.component);
      const predecessor = input.predecessors[step.component];
      const isTarget = Boolean(
        current
        && current.id === step.target.id
        && (!step.target.hash || current.hash === step.target.hash),
      );
      const isPredecessor = Boolean(current && current.fileSha256 === predecessor.fileSha256);
      if (current && !isTarget && !isPredecessor) {
        journal = sealJournal({
          ...journal,
          status: 'BLOCKED_RECOVERY',
          failure: `concurrent drift at ${step.component}`,
        });
        journal = input.persistJournal(journal);
        throw new V022ProductionCutoverError('concurrent-drift', `concurrent drift at ${step.component}; recovery stopped`);
      }
      if (!isPredecessor) {
        input.backend.restore(step.component, predecessor);
      }
      const restored = input.backend.read(step.component);
      if (!restored || restored.fileSha256 !== predecessor.fileSha256) {
        throw new V022ProductionCutoverError('restore-mismatch', `${step.component} did not restore predecessor bytes`);
      }
      journal = input.persistJournal(withStep(journal, step.component, 'ROLLED_BACK', { status: 'ROLLING_BACK', ready: false }));
    }
    journal = input.persistJournal(sealJournal({ ...journal, status: 'ROLLED_BACK', ready: false, failure: journal.failure }));
    return journal;
  } catch (error) {
    if (error instanceof V022ProductionCutoverError && error.code === 'concurrent-drift') throw error;
    journal = input.persistJournal(sealJournal({
      ...journal,
      status: 'BLOCKED_RECOVERY',
      failure: error instanceof Error ? error.message : String(error),
    }));
    throw error;
  }
}

export function exerciseV022RollbackPath(input: {
  live: CutoverPointerBackend;
  rehearsal: CutoverPointerBackend;
  persistJournal: (journal: CutoverJournal) => CutoverJournal;
  transactionId: string;
}): { restored: boolean; journal: CutoverJournal } {
  const predecessors = Object.fromEntries(
    V022_CUTOVER_COMPONENTS.map((component) => {
      const pointer = input.live.read(component);
      if (!pointer) throw new V022ProductionCutoverError('predecessor-missing', `${component} is missing`);
      input.rehearsal.restore(component, pointer);
      return [component, pointer];
    }),
  ) as Record<V022CutoverComponent, PointerIdentity>;
  const prepared = createPreparedJournal({
    transactionId: `${input.transactionId}-rehearsal`,
    predecessors,
  });
  let journal: CutoverJournal;
  try {
    journal = executeV022ProductionCutover({
      backend: input.rehearsal,
      journal: prepared,
      persistJournal: input.persistJournal,
    });
  } catch {
    journal = compensateV022ProductionCutover({
      backend: input.rehearsal,
      journal: prepared,
      persistJournal: input.persistJournal,
      predecessors,
    });
    return { restored: journal.status === 'ROLLED_BACK', journal };
  }
  journal = compensateV022ProductionCutover({
    backend: input.rehearsal,
    journal,
    persistJournal: input.persistJournal,
    predecessors,
  });
  const restored = V022_CUTOVER_COMPONENTS.every((component) => {
    const current = input.rehearsal.read(component);
    return Boolean(current && current.fileSha256 === predecessors[component].fileSha256);
  });
  return { restored, journal };
}

export function sealCutoverReceipt(input: {
  journal: CutoverJournal;
  observations?: Record<string, unknown>;
  blockers?: string[];
}): CutoverReceipt {
  const blockers = [...(input.blockers ?? [])].sort();
  const status = input.journal.status === 'COMMITTED' && blockers.length === 0
    ? 'READY'
    : input.journal.status === 'ROLLED_BACK'
      ? 'ROLLED_BACK'
      : input.journal.status === 'BLOCKED_RECOVERY'
        ? 'BLOCKED_RECOVERY'
        : 'BLOCKED';
  return sealCutoverValue({
    contract: V022_CUTOVER_RECEIPT_CONTRACT,
    transactionId: input.journal.transactionId,
    status,
    ready: status === 'READY',
    journalHash: input.journal.journalHash,
    nextAction: status === 'READY'
      ? 'retain-v09-rollback'
      : status === 'BLOCKED_RECOVERY'
        ? 'operator-intervention'
        : 'blocked',
    ...(input.observations ? { observations: input.observations } : {}),
    blockers,
    receiptDigest: '',
  }, 'receiptDigest') as CutoverReceipt;
}

export function assertNoLearnerVisibleSystemIdentifiers(values: readonly string[]): string[] {
  const leaks = values.filter((value) => /(?:snap-|proj-|ads-|ctr:release:|first-cutover-|v022-cutover-|sha256:|[a-f0-9]{64})/i.test(value));
  return leaks;
}

export { V022_NAMED_CONSUMERS, V09_RELEASE_ID, projectionCanonicalJson };
