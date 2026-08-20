import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { envelopeByName } from '@/lib/actkg-envelope/composite-envelope-registry';
import { createV022MapPointerBackend } from '../teaching-projection/publish/v022-production-cutover-backend';
import {
  assertNoLearnerVisibleSystemIdentifiers,
  createPreparedJournal,
  executeV022ProductionCutover,
  exerciseV022RollbackPath,
  pointerIdentityFromBytes,
  reviewedMembershipFromQualification,
  V022_CUTOVER_COMPONENTS,
  V022_PRODUCTION_ACTIVATION_ID,
  V022_TARGET_IDENTITIES,
  V09_PREDECESSOR_IDENTITIES,
  type V022CutoverComponent,
} from '../teaching-projection/publish/v022-production-cutover';
import { publishActKgV022CutoverRuntime } from '../teaching-projection/publish/v022-runtime-release';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

function predecessorPointer(component: V022CutoverComponent) {
  const identity = V09_PREDECESSOR_IDENTITIES[component];
  const v09 = envelopeByName('control-theory-engineering-v0.9');
  const body = component === 'authority'
    ? {
      contract: 'actkg-engineering-authority-current/v1',
      snapshotId: identity.id,
      snapshotHash: identity.hash,
      releaseId: v09.authorityReleaseId,
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
            releaseId: v09.authorityReleaseId,
          }
          : {
            contract: 'act-versioned-knowledge-consumer-activation-current/v1',
            activationId: identity.id,
            activationHash: identity.hash,
          };
  return pointerIdentityFromBytes(component, Buffer.from(`${JSON.stringify(body)}\n`, 'utf8'));
}

function predecessorSet() {
  return Object.fromEntries(
    V022_CUTOVER_COMPONENTS.map((component) => [component, predecessorPointer(component)]),
  ) as Record<V022CutoverComponent, ReturnType<typeof predecessorPointer>>;
}

describe('v0.22 production cutover protocol', () => {
  it('advances all five selectors and only becomes READY at consumer activation', () => {
    const predecessors = predecessorSet();
    const backend = createV022MapPointerBackend(
      Object.fromEntries(V022_CUTOVER_COMPONENTS.map((component) => [component, predecessors[component].bytes])),
    );
    const journals: string[] = [];
    const journal = executeV022ProductionCutover({
      backend,
      journal: createPreparedJournal({
        transactionId: 'test-v022-cutover',
        predecessors,
      }),
      persistJournal: (next) => {
        journals.push(next.status);
        return next;
      },
      predecessors,
    });
    expect(journal.status).toBe('COMMITTED');
    expect(journal.ready).toBe(true);
    expect(journal.steps.at(-1)?.component).toBe('consumer-activation');
    expect(backend.read('authority')?.id).toBe(V022_TARGET_IDENTITIES.authority.id);
    expect(backend.read('projection')?.id).toBe(V022_TARGET_IDENTITIES.projection.id);
    expect(backend.read('consumer-activation')?.id).toBe(V022_PRODUCTION_ACTIVATION_ID);
    expect(journals.includes('COMMITTING')).toBe(true);
  });

  it('rolls the five-selector snapshot back as one unit', () => {
    const predecessors = predecessorSet();
    const live = createV022MapPointerBackend(
      Object.fromEntries(V022_CUTOVER_COMPONENTS.map((component) => [component, predecessors[component].bytes])),
    );
    const rehearsal = createV022MapPointerBackend();
    const result = exerciseV022RollbackPath({
      live,
      rehearsal,
      persistJournal: (journal) => journal,
      transactionId: 'test-v022-rollback',
    });
    expect(result.restored).toBe(true);
    expect(result.journal.status).toBe('ROLLED_BACK');
    for (const component of V022_CUTOVER_COMPONENTS) {
      expect(rehearsal.read(component)?.fileSha256).toBe(predecessors[component].fileSha256);
    }
  });

  it('hides internal identifiers from learner-visible text', () => {
    expect(assertNoLearnerVisibleSystemIdentifiers(['根轨迹', '系统建模'])).toEqual([]);
    expect(assertNoLearnerVisibleSystemIdentifiers(['snap-abc', 'ctr:release:x'])).not.toEqual([]);
  });

  it('reads reviewed membership from qualification evidence instead of a compiled count', () => {
    const qualification = JSON.parse(readFileSync(path.join(
      REPO_ROOT,
      'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.22/qualification-readiness.json',
    ), 'utf8')) as Record<string, unknown>;
    const membership = reviewedMembershipFromQualification(qualification);
    expect(membership.domainCount).toBeGreaterThan(1);
    expect(membership.membershipCount).toBeGreaterThan(membership.domainCount);
  });

  it('restores all five selectors when one apply fails', () => {
    const predecessors = predecessorSet();
    const inner = createV022MapPointerBackend(
      Object.fromEntries(V022_CUTOVER_COMPONENTS.map((component) => [component, predecessors[component].bytes])),
    );
    const backend = {
      read: inner.read.bind(inner),
      restore: inner.restore.bind(inner),
      apply(component: V022CutoverComponent, targetId: string) {
        if (component === 'prerequisite') throw new Error('forced-selector-failure');
        return inner.apply(component, targetId);
      },
    };
    expect(() => executeV022ProductionCutover({
      backend,
      journal: createPreparedJournal({
        transactionId: 'test-v022-abort',
        predecessors,
      }),
      persistJournal: (next) => next,
      predecessors,
    })).toThrow(/forced-selector-failure/);
    for (const component of V022_CUTOVER_COMPONENTS) {
      expect(backend.read(component)?.fileSha256).toBe(predecessors[component].fileSha256);
    }
  });
});

describe('v0.22 runtime release', () => {
  it('keeps production selectors on the current envelope and does not authorize cutover', () => {
    const outputRoot = mkdtempSync(path.join(tmpdir(), 'act-v022-runtime-'));
    roots.push(outputRoot);
    const result = publishActKgV022CutoverRuntime({
      repoRoot: REPO_ROOT,
      outputRoot,
      boundEnvelopeName: 'control-theory-engineering-v0.9',
      hostShadowRequired: false,
      requireReleaseGates: false,
      readGitStatus: () => '',
    });
    expect(result.status).toBe('READY');
    expect(result.blockers).toEqual([]);
    const receipt = JSON.parse(readFileSync(path.join(outputRoot, 'runtime-release-receipt.json'), 'utf8')) as {
      productionCutoverAuthorized: boolean;
      boundEnvelopeName: string;
      selectorConsumption: boolean;
    };
    expect(receipt.productionCutoverAuthorized).toBe(false);
    expect(receipt.selectorConsumption).toBe(false);
    expect(receipt.boundEnvelopeName).toBe('control-theory-engineering-v0.9');
    const authority = JSON.parse(readFileSync(path.join(REPO_ROOT, 'course-content/authoring/knowledge/authority/current.json'), 'utf8')) as { releaseId: string };
    expect(authority.releaseId).toBe('ctr:release:control-theory-engineering-v0.9');
  });

  it('stays BLOCKED until host shadow verification exists', () => {
    const outputRoot = mkdtempSync(path.join(tmpdir(), 'act-v022-runtime-host-'));
    roots.push(outputRoot);
    const result = publishActKgV022CutoverRuntime({
      repoRoot: REPO_ROOT,
      outputRoot,
      boundEnvelopeName: 'control-theory-engineering-v0.9',
      requireReleaseGates: false,
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('host-shadow-verification-incomplete');
    expect(result.blockers).not.toContain('qualification-not-ready');
  });

  it('fails closed on a dirty worktree or unattested release gates', () => {
    const outputRoot = mkdtempSync(path.join(tmpdir(), 'act-v022-runtime-dirty-'));
    roots.push(outputRoot);
    const dirty = publishActKgV022CutoverRuntime({
      repoRoot: REPO_ROOT,
      outputRoot,
      boundEnvelopeName: 'control-theory-engineering-v0.9',
      hostShadowRequired: false,
      requireReleaseGates: false,
      readGitStatus: () => ' M src/lib/actkg-envelope/composite-envelope-registry.ts',
    });
    expect(dirty.status).toBe('BLOCKED');
    expect(dirty.blockers).toContain('working-tree-dirty');
    const unattested = publishActKgV022CutoverRuntime({
      repoRoot: REPO_ROOT,
      outputRoot,
      boundEnvelopeName: 'control-theory-engineering-v0.9',
      hostShadowRequired: false,
      readGitStatus: () => '',
    });
    expect(unattested.status).toBe('BLOCKED');
    expect(unattested.blockers).toContain('release-gates-unattested');
  });
});
