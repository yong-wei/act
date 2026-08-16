/** Identity-constrained five-selector production cutover for ActKG v0.18. */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  V018_FROZEN_IMAGE_TAG,
  V018_SEALED_IMAGE_CONFIG_SHA256,
  V09_HOST_POINTER_HASHES,
} from './v018-host-shadow';
import {
  V018_SEALED_QUALIFICATION_SHA256,
  V018_RUNTIME_RELEASE_CONTRACT,
} from './v018-runtime-release';
import { projectionCanonicalJson, projectionDigest } from '../hash';
import {
  V018_SNAPSHOT,
  V09_ACTIVATION,
  V09_PREREQUISITE,
  V09_PROJECTION,
  V09_RELEASE_ID,
  V09_SHARD_SET,
  V09_SNAPSHOT,
  asRecord,
} from '../qualify/v018-shared';
import { V018_NAMED_CONSUMERS } from '../qualify/v018-qualify-contract';

export const V018_CUTOVER_JOURNAL_CONTRACT = 'actkg-v018-production-cutover-journal/v1' as const;
export const V018_CUTOVER_RECEIPT_CONTRACT = 'actkg-v018-production-cutover-receipt/v1' as const;
export const V018_CUTOVER_PREFLIGHT_CONTRACT = 'actkg-v018-production-cutover-preflight/v1' as const;

export const V018_CUTOVER_COMPONENTS = [
  'authority',
  'projection',
  'prerequisite',
  'authority-domain-shards',
  'consumer-activation',
] as const;
export type V018CutoverComponent = (typeof V018_CUTOVER_COMPONENTS)[number];

export const V018_PRODUCTION_ACTIVATION_ID = 'v018-cutover-1b64a853dda5-17f00f669b22';
export const V018_SHARD_SET_ID = 'ads-184769ba66b3cc57fa7b33156d2edc4e39cdd7a456f150d9b355bef332dcf911';
export const V018_PROJECTION_ID = 'proj-17f00f669b22c25126ca4c562e1e019c074a7738502825d2d109a77c47202ba9';
export const V018_PUBLICATION_ID = 'proj-0bdda82e1bc922fd8b910a9782dffbb147c64aed176b11d772b43f89eb8b3cf7';
export const V018_EXPECTED_OBJECT_COUNT = 6843;
export const V018_EXPECTED_RELATION_COUNT = 2811;

export const V018_CUTOVER_POINTER_PATHS = {
  authority: 'course-content/authoring/knowledge/authority/current.json',
  projection: 'course-content/runtime/knowledge/projection/current.json',
  prerequisite: 'course-content/runtime/knowledge/prerequisites/current.json',
  'authority-domain-shards': 'course-content/runtime/knowledge/authority-domain-shards/current.json',
  'consumer-activation': 'course-content/runtime/knowledge/consumer-activation/current.json',
} as const;

export const V09_PREDECESSOR_IDENTITIES = {
  authority: { id: V09_SNAPSHOT, hash: V09_SNAPSHOT.replace(/^snap-/, '') },
  projection: { id: V09_PROJECTION, hash: V09_PROJECTION.replace(/^proj-/, '') },
  prerequisite: { id: V09_PREREQUISITE, hash: V09_PREREQUISITE.replace(/^proj-/, '') },
  'authority-domain-shards': { id: V09_SHARD_SET, hash: V09_SHARD_SET.replace(/^ads-/, '') },
  'consumer-activation': { id: V09_ACTIVATION, hash: 'e1d353fd1b544b3115dec62f8206b027784e0f50b1c66406c8556049d9e7ecb5' },
} as const;

export const V018_TARGET_IDENTITIES = {
  authority: { id: V018_SNAPSHOT, hash: V018_SNAPSHOT.replace(/^snap-/, '') },
  projection: { id: V018_PROJECTION_ID, hash: V018_PROJECTION_ID.replace(/^proj-/, '') },
  prerequisite: { id: V018_PUBLICATION_ID, hash: V018_PUBLICATION_ID.replace(/^proj-/, '') },
  'authority-domain-shards': { id: V018_SHARD_SET_ID, hash: V018_SHARD_SET_ID.replace(/^ads-/, '') },
  'consumer-activation': { id: V018_PRODUCTION_ACTIVATION_ID, hash: null },
} as const;

export class V018ProductionCutoverError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'V018ProductionCutoverError';
    this.code = code;
  }
}

export interface PointerIdentity {
  component: V018CutoverComponent;
  id: string;
  hash: string;
  fileSha256: string;
  bytes: Buffer;
}

export interface CutoverPointerBackend {
  read(component: V018CutoverComponent): PointerIdentity | null;
  apply(component: V018CutoverComponent, targetId: string): PointerIdentity;
  restore(component: V018CutoverComponent, predecessor: PointerIdentity): PointerIdentity;
}

export interface CutoverHostObservation {
  appImage?: string;
  appImageId?: string;
  workerImage?: string;
  workerImageId?: string;
  workerHealth?: string;
  readyz?: { app?: boolean; db?: boolean; redis?: boolean };
  predecessorFileHashes?: Partial<Record<V018CutoverComponent, string>>;
  firstActivationCommitted?: boolean;
  markerPresent?: boolean;
  lockHeld?: boolean;
}

export interface CutoverJournalStep {
  component: V018CutoverComponent;
  predecessor: { id: string; hash: string; fileSha256: string };
  target: { id: string; hash: string | null };
  status: 'PENDING' | 'STARTED' | 'APPLIED' | 'ROLLED_BACK';
}

export interface CutoverJournal {
  contract: typeof V018_CUTOVER_JOURNAL_CONTRACT;
  transactionId: string;
  createdAt: string;
  status: 'PREPARED' | 'COMMITTING' | 'COMMITTED' | 'ROLLING_BACK' | 'ROLLED_BACK' | 'BLOCKED_RECOVERY';
  prestate: 'V09_COMPLETE_SET';
  ready: boolean;
  steps: CutoverJournalStep[];
  failure: string | null;
  journalHash: string;
}

export interface CutoverPreflight {
  contract: typeof V018_CUTOVER_PREFLIGHT_CONTRACT;
  status: 'READY' | 'BLOCKED';
  qualificationDigest: string | null;
  runtimeReceiptDigest: string | null;
  predecessorHashes: Record<string, string>;
  blockers: string[];
}

export interface CutoverReceipt {
  contract: typeof V018_CUTOVER_RECEIPT_CONTRACT;
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

function identityFields(component: V018CutoverComponent): [string, string] {
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
  component: V018CutoverComponent,
  bytes: Buffer,
): PointerIdentity {
  const record = asRecord(JSON.parse(bytes.toString('utf8')));
  const [idField, hashField] = identityFields(component);
  const id = String(record[idField] ?? '');
  const hash = String(record[hashField] ?? '');
  if (!id || !/^[a-f0-9]{64}$/.test(hash)) {
    throw new V018ProductionCutoverError('pointer-identity-invalid', `${component} pointer identity is invalid`);
  }
  return { component, id, hash, fileSha256: sha256(bytes), bytes };
}

export function samePointer(left: PointerIdentity | null, right: { id: string; hash: string }): boolean {
  return Boolean(left && left.id === right.id && left.hash === right.hash);
}

export function expectedPredecessorHashes(
  source: 'host' | 'local',
): Record<V018CutoverComponent, string> {
  if (source === 'local') {
    return {
      authority: '086f14793fbf2aa3afc8fba471503042242645122425c3018b6526e8ab2835f2',
      projection: V09_HOST_POINTER_HASHES.projection,
      prerequisite: V09_HOST_POINTER_HASHES.prerequisites,
      'authority-domain-shards': V09_HOST_POINTER_HASHES.shards,
      'consumer-activation': V09_HOST_POINTER_HASHES.activation,
    };
  }
  return {
    authority: V09_HOST_POINTER_HASHES.authority,
    projection: V09_HOST_POINTER_HASHES.projection,
    prerequisite: V09_HOST_POINTER_HASHES.prerequisites,
    'authority-domain-shards': V09_HOST_POINTER_HASHES.shards,
    'consumer-activation': V09_HOST_POINTER_HASHES.activation,
  };
}

function readJsonFile(filePath: string): Record<string, unknown> {
  return asRecord(JSON.parse(readFileSync(filePath, 'utf8')));
}

export function preflightV018ProductionCutover(input: {
  repoRoot: string;
  observation: CutoverHostObservation;
  predecessorSource?: 'host' | 'local';
  requireFrozenImage?: boolean;
}): CutoverPreflight {
  const blockers: string[] = [];
  const qualificationPath = path.join(
    input.repoRoot,
    'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.18/qualification-readiness.json',
  );
  const runtimePath = path.join(
    input.repoRoot,
    'course-content/authoring/knowledge/cutover/runtime-releases/control-theory-engineering-v0.18/runtime-release-receipt.json',
  );
  const hostShadowPath = path.join(
    input.repoRoot,
    'course-content/authoring/knowledge/cutover/runtime-releases/control-theory-engineering-v0.18/host-shadow-verification.json',
  );

  let qualificationDigest: string | null = null;
  let runtimeReceiptDigest: string | null = null;
  if (!existsSync(qualificationPath)) blockers.push('qualification-missing');
  else {
    qualificationDigest = sha256(readFileSync(qualificationPath));
    if (qualificationDigest !== V018_SEALED_QUALIFICATION_SHA256) blockers.push('qualification-digest-drift');
    const qualification = readJsonFile(qualificationPath);
    if (qualification.status !== 'READY') blockers.push('qualification-not-ready');
    if (qualification.productionCutoverAuthorized === true) blockers.push('qualification-claimed-cutover');
  }
  if (!existsSync(runtimePath)) blockers.push('runtime-receipt-missing');
  else {
    const bytes = readFileSync(runtimePath);
    const runtime = asRecord(JSON.parse(bytes.toString('utf8')));
    runtimeReceiptDigest = String(runtime.receiptDigest ?? '');
    if (runtime.contract !== V018_RUNTIME_RELEASE_CONTRACT) blockers.push('runtime-receipt-contract');
    if (runtime.status !== 'READY') blockers.push('runtime-receipt-not-ready');
    if (runtime.productionCutoverAuthorized === true) blockers.push('runtime-claimed-cutover');
    if (runtime.qualificationDigest !== V018_SEALED_QUALIFICATION_SHA256) blockers.push('runtime-qualification-pin-drift');
  }
  if (!existsSync(hostShadowPath)) blockers.push('host-shadow-missing');
  else {
    const host = readJsonFile(hostShadowPath);
    if (host.status !== 'READY') blockers.push('host-shadow-not-ready');
  }

  if (input.requireFrozenImage !== false) {
    if (input.observation.appImage !== V018_FROZEN_IMAGE_TAG || input.observation.workerImage !== V018_FROZEN_IMAGE_TAG) {
      blockers.push('oci-image-tag-drift');
    }
    const config = input.observation.appImageId?.replace(/^sha256:/, '');
    const workerConfig = input.observation.workerImageId?.replace(/^sha256:/, '');
    if (config !== V018_SEALED_IMAGE_CONFIG_SHA256 || workerConfig !== V018_SEALED_IMAGE_CONFIG_SHA256) {
      blockers.push('oci-image-digest-drift');
    }
  }
  if (input.observation.readyz && (input.observation.readyz.app !== true || input.observation.readyz.db !== true || input.observation.readyz.redis !== true)) {
    blockers.push('readyz-not-ready');
  }
  if (input.observation.lockHeld) blockers.push('exclusive-lock-held');
  if (!input.observation.markerPresent && !input.observation.firstActivationCommitted) {
    blockers.push('production-marker-missing');
  }

  const expected = expectedPredecessorHashes(input.predecessorSource ?? 'host');
  const observed = input.observation.predecessorFileHashes ?? {};
  for (const component of V018_CUTOVER_COMPONENTS) {
    if (observed[component] !== expected[component]) blockers.push(`predecessor-hash-drift:${component}`);
  }

  const unique = [...new Set(blockers)].sort();
  return {
    contract: V018_CUTOVER_PREFLIGHT_CONTRACT,
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
  predecessors: Record<V018CutoverComponent, PointerIdentity>;
  consumerActivationHash?: string | null;
  targetOverrides?: Partial<Record<V018CutoverComponent, { id: string; hash: string | null }>>;
}): CutoverJournal {
  return sealJournal({
    contract: V018_CUTOVER_JOURNAL_CONTRACT,
    transactionId: input.transactionId,
    createdAt: input.createdAt ?? new Date().toISOString(),
    status: 'PREPARED',
    prestate: 'V09_COMPLETE_SET',
    ready: false,
    failure: null,
    steps: V018_CUTOVER_COMPONENTS.map((component) => ({
      component,
      predecessor: {
        id: input.predecessors[component].id,
        hash: input.predecessors[component].hash,
        fileSha256: input.predecessors[component].fileSha256,
      },
      target: input.targetOverrides?.[component] ?? {
        id: V018_TARGET_IDENTITIES[component].id,
        hash: component === 'consumer-activation'
          ? input.consumerActivationHash ?? null
          : V018_TARGET_IDENTITIES[component].hash,
      },
      status: 'PENDING',
    })),
  });
}

function withStep(
  journal: CutoverJournal,
  component: V018CutoverComponent,
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

export function executeV018ProductionCutover(input: {
  backend: CutoverPointerBackend;
  journal: CutoverJournal;
  persistJournal: (journal: CutoverJournal) => CutoverJournal;
  predecessors?: Record<V018CutoverComponent, PointerIdentity>;
}): CutoverJournal {
  if (input.journal.status !== 'PREPARED') {
    throw new V018ProductionCutoverError('journal-not-prepared', `cannot execute from ${input.journal.status}`);
  }
  let journal = input.persistJournal(input.journal);
  if (journal.journalHash !== input.journal.journalHash) {
    throw new V018ProductionCutoverError('journal-reread-drift', 'prepared journal hash drifted');
  }

  try {
    for (const step of journal.steps) {
      const current = input.backend.read(step.component);
      if (!current || current.fileSha256 !== step.predecessor.fileSha256 || !samePointer(current, step.predecessor)) {
        throw new V018ProductionCutoverError('predecessor-cas-failed', `${step.component} is not the journaled v0.9 predecessor`);
      }
      journal = input.persistJournal(withStep(journal, step.component, 'STARTED', {
        status: step.component === 'consumer-activation' ? 'COMMITTING' : 'PREPARED',
        ready: false,
      }));
      const applied = input.backend.apply(step.component, step.target.id);
      if (applied.id !== step.target.id) {
        throw new V018ProductionCutoverError('target-id-mismatch', `${step.component} did not advance to ${step.target.id}`);
      }
      if (step.target.hash && applied.hash !== step.target.hash) {
        throw new V018ProductionCutoverError('target-hash-mismatch', `${step.component} hash drifted`);
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
        throw new V018ProductionCutoverError('premature-ready', 'release set became READY before consumer activation');
      }
    }
    if (!consumerCommitted(journal) || !journal.ready) {
      throw new V018ProductionCutoverError('consumer-not-committed', 'consumer activation is the only READY commit point');
    }
    return journal;
  } catch (error) {
    const failure = error instanceof Error ? error.message : String(error);
    journal = input.persistJournal(sealJournal({ ...journal, failure, ready: false, status: journal.status === 'COMMITTED' ? 'COMMITTED' : 'ROLLING_BACK' }));
    if (input.predecessors) {
      journal = compensateV018ProductionCutover({
        backend: input.backend,
        journal,
        persistJournal: input.persistJournal,
        predecessors: input.predecessors,
      });
    }
    throw error instanceof V018ProductionCutoverError
      ? error
      : new V018ProductionCutoverError('execute-failed', failure);
  }
}

export function compensateV018ProductionCutover(input: {
  backend: CutoverPointerBackend;
  journal: CutoverJournal;
  persistJournal: (journal: CutoverJournal) => CutoverJournal;
  predecessors: Record<V018CutoverComponent, PointerIdentity>;
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
        throw new V018ProductionCutoverError('concurrent-drift', `concurrent drift at ${step.component}; recovery stopped`);
      }
      if (!isPredecessor) {
        input.backend.restore(step.component, predecessor);
      }
      const restored = input.backend.read(step.component);
      if (!restored || restored.fileSha256 !== predecessor.fileSha256) {
        throw new V018ProductionCutoverError('restore-mismatch', `${step.component} did not restore v0.9 bytes`);
      }
      journal = input.persistJournal(withStep(journal, step.component, 'ROLLED_BACK', { status: 'ROLLING_BACK', ready: false }));
    }
    journal = input.persistJournal(sealJournal({ ...journal, status: 'ROLLED_BACK', ready: false, failure: journal.failure }));
    return journal;
  } catch (error) {
    if (error instanceof V018ProductionCutoverError && error.code === 'concurrent-drift') throw error;
    journal = input.persistJournal(sealJournal({
      ...journal,
      status: 'BLOCKED_RECOVERY',
      failure: error instanceof Error ? error.message : String(error),
    }));
    throw error;
  }
}

export function exerciseV018RollbackPath(input: {
  live: CutoverPointerBackend;
  rehearsal: CutoverPointerBackend;
  persistJournal: (journal: CutoverJournal) => CutoverJournal;
  transactionId: string;
}): { restored: boolean; journal: CutoverJournal } {
  const predecessors = Object.fromEntries(
    V018_CUTOVER_COMPONENTS.map((component) => {
      const pointer = input.live.read(component);
      if (!pointer) throw new V018ProductionCutoverError('predecessor-missing', `${component} is missing`);
      input.rehearsal.restore(component, pointer);
      return [component, pointer];
    }),
  ) as Record<V018CutoverComponent, PointerIdentity>;
  const prepared = createPreparedJournal({
    transactionId: `${input.transactionId}-rehearsal`,
    predecessors,
  });
  let journal: CutoverJournal;
  try {
    journal = executeV018ProductionCutover({
      backend: input.rehearsal,
      journal: prepared,
      persistJournal: input.persistJournal,
    });
  } catch {
    journal = compensateV018ProductionCutover({
      backend: input.rehearsal,
      journal: prepared,
      persistJournal: input.persistJournal,
      predecessors,
    });
    return { restored: journal.status === 'ROLLED_BACK', journal };
  }
  journal = compensateV018ProductionCutover({
    backend: input.rehearsal,
    journal,
    persistJournal: input.persistJournal,
    predecessors,
  });
  const restored = V018_CUTOVER_COMPONENTS.every((component) => {
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
    contract: V018_CUTOVER_RECEIPT_CONTRACT,
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
  const leaks = values.filter((value) => /(?:snap-|proj-|ads-|ctr:release:|first-cutover-|v018-cutover-|sha256:|[a-f0-9]{64})/i.test(value));
  return leaks;
}

export { V018_NAMED_CONSUMERS, V09_RELEASE_ID, projectionCanonicalJson };
