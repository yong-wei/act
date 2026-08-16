import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createMapPointerBackend } from '../teaching-projection/publish/v018-production-cutover-backend';
import {
  assertNoLearnerVisibleSystemIdentifiers,
  compensateV018ProductionCutover,
  createPreparedJournal,
  executeV018ProductionCutover,
  exerciseV018RollbackPath,
  expectedPredecessorHashes,
  inspectSealedRuntimeReceipt,
  pointerIdentityFromBytes,
  preflightV018ProductionCutover,
  sealCutoverReceipt,
  V018_CUTOVER_COMPONENTS,
  V018_CUTOVER_JOURNAL_CONTRACT,
  V018_PRODUCTION_ACTIVATION_ID,
  V018_TARGET_IDENTITIES,
  V09_PREDECESSOR_IDENTITIES,
  type CutoverJournal,
  type PointerIdentity,
  type V018CutoverComponent,
} from '../teaching-projection/publish/v018-production-cutover';
import {
  V018_FROZEN_IMAGE_TAG,
  V018_SEALED_IMAGE_CONFIG_SHA256,
} from '../teaching-projection/publish/v018-host-shadow';
import {
  V018_SEALED_QUALIFICATION_SHA256,
  V018_SEALED_RUNTIME_RECEIPT_DIGEST,
} from '../teaching-projection/publish/v018-runtime-release';

const REPO_ROOT = path.resolve(__dirname, '../../..');

function predecessorPointer(component: V018CutoverComponent): PointerIdentity {
  const identity = V09_PREDECESSOR_IDENTITIES[component];
  const body = component === 'authority'
    ? {
      contract: 'actkg-engineering-authority-current/v1',
      snapshotId: identity.id,
      snapshotHash: identity.hash,
      releaseId: 'ctr:release:control-theory-engineering-v0.9',
    }
    : component === 'projection'
      ? {
        contract: 'act-teaching-projection-current/v1',
        projectionId: identity.id,
        projectionHash: identity.hash,
      }
      : component === 'prerequisite'
        ? {
          contract: 'act-teaching-prerequisite-current/v1',
          publicationId: identity.id,
          publicationHash: identity.hash,
        }
        : component === 'authority-domain-shards'
          ? {
            contract: 'act-authority-domain-shard-current/v1',
            shardSetId: identity.id,
            shardSetHash: identity.hash,
            snapshotId: V09_PREDECESSOR_IDENTITIES.authority.id,
            snapshotHash: V09_PREDECESSOR_IDENTITIES.authority.hash,
            releaseId: 'ctr:release:control-theory-engineering-v0.9',
          }
          : {
            contract: 'act-versioned-knowledge-consumer-activation-current/v1',
            activationId: identity.id,
            activationHash: identity.hash,
          };
  return pointerIdentityFromBytes(component, Buffer.from(`${JSON.stringify(body)}\n`, 'utf8'));
}

function predecessorSet(): Record<V018CutoverComponent, PointerIdentity> {
  return Object.fromEntries(
    V018_CUTOVER_COMPONENTS.map((component) => [component, predecessorPointer(component)]),
  ) as Record<V018CutoverComponent, PointerIdentity>;
}

function persistStack(): { journals: CutoverJournal[]; persist: (journal: CutoverJournal) => CutoverJournal } {
  const journals: CutoverJournal[] = [];
  return { journals, persist: (journal) => { journals.push(journal); return journal; } };
}

function readyObservation() {
  const hashes = expectedPredecessorHashes('host');
  return {
    appImage: V018_FROZEN_IMAGE_TAG,
    appImageId: V018_SEALED_IMAGE_CONFIG_SHA256,
    workerImage: V018_FROZEN_IMAGE_TAG,
    workerImageId: V018_SEALED_IMAGE_CONFIG_SHA256,
    workerHealth: 'healthy',
    readyz: { app: true, db: true, redis: true },
    predecessorFileHashes: hashes,
    firstActivationCommitted: true,
    markerPresent: false,
    lockHeld: false,
  };
}

describe('activate-actkg-v018-production-cutover', () => {
  it('blocks transaction entry when a predecessor hash drifts', () => {
    const observation = readyObservation();
    observation.predecessorFileHashes = {
      ...observation.predecessorFileHashes,
      authority: '0'.repeat(64),
    };
    const report = preflightV018ProductionCutover({
      repoRoot: REPO_ROOT,
      observation,
      predecessorSource: 'host',
    });
    expect(report.status).toBe('BLOCKED');
    expect(report.blockers).toContain('predecessor-hash-drift:authority');
    expect(report.qualificationDigest).toBe(V018_SEALED_QUALIFICATION_SHA256);
  });

  it('accepts the sealed handoff when host identities and OCI pins match', () => {
    const report = preflightV018ProductionCutover({
      repoRoot: REPO_ROOT,
      observation: readyObservation(),
      predecessorSource: 'host',
    });
    expect(report.status).toBe('READY');
    expect(report.blockers).toEqual([]);
    expect(report.runtimeReceiptDigest).toBe(V018_SEALED_RUNTIME_RECEIPT_DIGEST);
  });

  it('blocks transaction entry when the production marker is absent', () => {
    const report = preflightV018ProductionCutover({
      repoRoot: REPO_ROOT,
      observation: {
        ...readyObservation(),
        firstActivationCommitted: false,
        markerPresent: false,
      },
      predecessorSource: 'host',
    });
    expect(report.status).toBe('BLOCKED');
    expect(report.blockers).toContain('production-marker-missing');
  });

  it('blocks a runtime receipt whose self-seal digest drifted', () => {
    const sealedPath = path.join(
      REPO_ROOT,
      'course-content/authoring/knowledge/cutover/runtime-releases/control-theory-engineering-v0.18/runtime-release-receipt.json',
    );
    const sealed = JSON.parse(readFileSync(sealedPath, 'utf8')) as Record<string, unknown>;
    const drifted = Buffer.from(`${JSON.stringify({ ...sealed, status: 'BLOCKED' }, null, 2)}\n`);
    const inspected = inspectSealedRuntimeReceipt(drifted);
    expect(inspected.blockers).toEqual(expect.arrayContaining([
      'runtime-receipt-digest-mismatch',
      'runtime-receipt-digest-drift',
      'runtime-receipt-bytes-drift',
    ]));
    expect(inspectSealedRuntimeReceipt(readFileSync(sealedPath)).blockers).toEqual([]);
  });

  it('does not report READY until consumer activation commits', () => {
    const predecessors = predecessorSet();
    const backend = createMapPointerBackend(
      Object.fromEntries(V018_CUTOVER_COMPONENTS.map((component) => [component, predecessors[component].bytes])),
    );
    const { journals, persist } = persistStack();
    const journal = executeV018ProductionCutover({
      backend,
      journal: createPreparedJournal({ transactionId: 'tx-ready', predecessors }),
      persistJournal: persist,
    });
    const beforeConsumer = journals.filter((row) => row.steps.some((step) => (
      step.component === 'authority-domain-shards' && step.status === 'APPLIED'
    )) && row.steps.find((step) => step.component === 'consumer-activation')?.status !== 'APPLIED');
    expect(beforeConsumer.length).toBeGreaterThan(0);
    expect(beforeConsumer.every((row) => row.ready === false && row.status !== 'COMMITTED')).toBe(true);
    expect(journal.status).toBe('COMMITTED');
    expect(journal.ready).toBe(true);
    expect(journal.contract).toBe(V018_CUTOVER_JOURNAL_CONTRACT);
    expect(backend.read('consumer-activation')?.id).toBe(V018_PRODUCTION_ACTIVATION_ID);
  });

  it('restores the complete v0.9 set when identities still match the journaled targets', () => {
    const predecessors = predecessorSet();
    const backend = createMapPointerBackend(
      Object.fromEntries(V018_CUTOVER_COMPONENTS.map((component) => [component, predecessors[component].bytes])),
    );
    const { persist } = persistStack();
    const committed = executeV018ProductionCutover({
      backend,
      journal: createPreparedJournal({ transactionId: 'tx-rollback', predecessors }),
      persistJournal: persist,
    });
    const rolled = compensateV018ProductionCutover({
      backend,
      journal: committed,
      persistJournal: persist,
      predecessors,
    });
    expect(rolled.status).toBe('ROLLED_BACK');
    expect(rolled.ready).toBe(false);
    for (const component of V018_CUTOVER_COMPONENTS) {
      expect(backend.read(component)?.fileSha256).toBe(predecessors[component].fileSha256);
    }
  });

  it('stops compensation when a pointer has an unexpected concurrent identity', () => {
    const predecessors = predecessorSet();
    const backend = createMapPointerBackend(
      Object.fromEntries(V018_CUTOVER_COMPONENTS.map((component) => [component, predecessors[component].bytes])),
    );
    const { persist } = persistStack();
    const committed = executeV018ProductionCutover({
      backend,
      journal: createPreparedJournal({ transactionId: 'tx-drift', predecessors }),
      persistJournal: persist,
    });
    backend.apply('projection', 'proj-concurrent-drift-000000000000000000000000000000000000000000000000');
    expect(() => compensateV018ProductionCutover({
      backend,
      journal: committed,
      persistJournal: persist,
      predecessors,
    })).toThrow(/concurrent drift/);
  });

  it('exercises rollback against a copy before any live mutation', () => {
    const predecessors = predecessorSet();
    const live = createMapPointerBackend(
      Object.fromEntries(V018_CUTOVER_COMPONENTS.map((component) => [component, predecessors[component].bytes])),
    );
    const rehearsal = createMapPointerBackend({});
    const { persist } = persistStack();
    const result = exerciseV018RollbackPath({
      live,
      rehearsal,
      persistJournal: persist,
      transactionId: 'tx-rehearse',
    });
    expect(result.restored).toBe(true);
    expect(result.journal.status).toBe('ROLLED_BACK');
    for (const component of V018_CUTOVER_COMPONENTS) {
      expect(live.read(component)?.fileSha256).toBe(predecessors[component].fileSha256);
    }
  });

  it('seals a successful receipt that retains v0.9 as rollback', () => {
    const predecessors = predecessorSet();
    const backend = createMapPointerBackend(
      Object.fromEntries(V018_CUTOVER_COMPONENTS.map((component) => [component, predecessors[component].bytes])),
    );
    const { persist } = persistStack();
    const journal = executeV018ProductionCutover({
      backend,
      journal: createPreparedJournal({ transactionId: 'tx-receipt', predecessors }),
      persistJournal: persist,
    });
    const receipt = sealCutoverReceipt({
      journal,
      observations: {
        objectCount: 6843,
        relationCount: 2811,
        consumers: ['course-runtime', 'engineering-graph', 'engineering-rag', 'konling', 'learning-path', 'teaching-resource-rag'],
      },
    });
    expect(receipt.status).toBe('READY');
    expect(receipt.nextAction).toBe('retain-v09-rollback');
    expect(receipt.receiptDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(assertNoLearnerVisibleSystemIdentifiers(['系统建模', '时域分析'])).toEqual([]);
    expect(assertNoLearnerVisibleSystemIdentifiers([V018_TARGET_IDENTITIES.authority.id])).not.toEqual([]);
    const blocked = sealCutoverReceipt({
      journal: { ...journal, status: 'ROLLING_BACK', ready: false },
      blockers: ['example'],
    });
    expect(blocked.status).toBe('BLOCKED');
    expect(blocked.observations).toBeUndefined();
  });
});
