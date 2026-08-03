/**
 * Versioned knowledge consumer activation (#1276).
 *
 * Readiness, staged materialization, atomic pointer, shadow, and rollback.
 */

import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  CONSUMER_ACTIVATION_CONTRACT,
  CONSUMER_ACTIVATION_IDS,
  activateConsumerActivation,
  assertShadowNoWriteInvariants,
  buildStagedActivationManifest,
  consumersBlockedByShadow,
  evaluateConsumerReadiness,
  isConsumerProductionReady,
  loadStagedConsumerActivation,
  readCurrentConsumerActivationPointer,
  resolveActiveConsumerActivation,
  resolveConsumerActivation,
  resolveConsumerActivationStorePaths,
  resolveEngineeringGraphActivation,
  resolveKonlingActivation,
  resolveLearningPathActivation,
  rollbackConsumerActivation,
  runConsumerActivationShadow,
  shadowViewsFromManifest,
  stageConsumerActivation,
  validateStagedArtifactSet,
  type ConsumerActivationStorePaths,
  type PriorConsumerState,
  type ShadowConsumerView,
  type StagedActivationArtifactSet,
} from '../versioned-knowledge-activation';

const hashA = 'a'.repeat(64);
const hashB = 'b'.repeat(64);
const hashC = 'c'.repeat(64);
const hashD = 'd'.repeat(64);
const hashE = 'e'.repeat(64);
const hashF = 'f'.repeat(64);
const commitA = '1'.repeat(40);
const commitB = '2'.repeat(40);

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

function tempActivationRoot(): ConsumerActivationStorePaths {
  const root = mkdtempSync(path.join(tmpdir(), 'act-consumer-activation-'));
  tempRoots.push(root);
  return resolveConsumerActivationStorePaths(root);
}

function completeArtifacts(
  overrides: Partial<StagedActivationArtifactSet> = {},
): StagedActivationArtifactSet {
  const base: StagedActivationArtifactSet = {
    captureRevision: commitA,
    authority: {
      present: true,
      releaseId: 'ctr:release:eng-v1',
      snapshotId: 'snap-eng-1',
      snapshotHash: hashA,
      captureRevision: commitA,
      artifactHashes: {
        'manifest.json': hashB,
        'engineering.json': hashC,
      },
    },
    projection: {
      present: true,
      projectionId: 'proj-1',
      projectionHash: hashD,
      authorityReleaseId: 'ctr:release:eng-v1',
      captureRevision: commitA,
      gatePassed: true,
      artifactHashes: {
        'projection-manifest.json': hashE,
        'resources.jsonl': hashF,
        'bindings.jsonl': hashA,
        'cards-index.json': hashB,
        'prerequisites.jsonl': hashC,
        'impact-report.json': hashD,
      },
      hasResources: true,
      hasCardsIndex: true,
      hasPrerequisites: true,
      hasImpactReport: true,
    },
  };
  return {
    ...base,
    ...overrides,
    authority:
      overrides.authority === undefined
        ? base.authority
        : overrides.authority,
    projection:
      overrides.projection === undefined
        ? base.projection
        : overrides.projection,
  };
}

function priorTeachingPins(): PriorConsumerState[] {
  return [
    {
      consumerId: 'course-runtime',
      combination: {
        authorityReleaseId: 'ctr:release:eng-v0',
        authoritySnapshotId: 'snap-old',
        authoritySnapshotHash: hashF,
        projectionId: 'proj-old',
        projectionHash: hashE,
        scopeId: null,
        captureRevision: commitB,
      },
    },
    {
      consumerId: 'konling',
      combination: {
        authorityReleaseId: 'ctr:release:eng-v0',
        authoritySnapshotId: 'snap-old',
        authoritySnapshotHash: hashF,
        projectionId: 'proj-old',
        projectionHash: hashE,
        scopeId: null,
        captureRevision: commitB,
      },
    },
    {
      consumerId: 'teaching-resource-rag',
      combination: {
        authorityReleaseId: 'ctr:release:eng-v0',
        authoritySnapshotId: 'snap-old',
        authoritySnapshotHash: hashF,
        projectionId: 'proj-old',
        projectionHash: hashE,
        scopeId: null,
        captureRevision: commitB,
      },
    },
    {
      consumerId: 'learning-path',
      combination: {
        authorityReleaseId: 'ctr:release:eng-v0',
        authoritySnapshotId: 'snap-old',
        authoritySnapshotHash: hashF,
        projectionId: 'proj-old',
        projectionHash: hashE,
        scopeId: null,
        captureRevision: commitB,
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// 1. Readiness manifest
// ---------------------------------------------------------------------------

describe('Consumer readiness (#1276)', () => {
  it('defines all named consumers and known statuses only', () => {
    expect(CONSUMER_ACTIVATION_IDS).toEqual([
      'engineering-graph',
      'engineering-rag',
      'course-runtime',
      'konling',
      'teaching-resource-rag',
      'learning-path',
    ]);
    const records = evaluateConsumerReadiness({
      artifacts: completeArtifacts(),
    });
    expect(records.map((r) => r.consumerId).sort()).toEqual(
      [...CONSUMER_ACTIVATION_IDS].sort(),
    );
    for (const row of records) {
      expect(['READY', 'PINNED_PREVIOUS', 'BLOCKED_LOCAL_DEPENDENCY', 'SHADOW']).toContain(
        row.status,
      );
    }
  });

  it('marks engineering READY when Authority passes and teaching binding is unresolved', () => {
    const records = evaluateConsumerReadiness({
      artifacts: completeArtifacts({
        projection: {
          present: false,
          projectionId: null,
          projectionHash: null,
          authorityReleaseId: null,
          captureRevision: null,
          gatePassed: false,
          artifactHashes: {},
          hasResources: false,
          hasCardsIndex: false,
          hasPrerequisites: false,
          hasImpactReport: false,
        },
      }),
      priorConsumers: priorTeachingPins(),
    });
    const eng = records.filter(
      (r) => r.consumerId === 'engineering-graph' || r.consumerId === 'engineering-rag',
    );
    expect(eng.every((r) => r.status === 'READY')).toBe(true);
    const teaching = records.filter(
      (r) => r.consumerId !== 'engineering-graph' && r.consumerId !== 'engineering-rag',
    );
    expect(teaching.every((r) => r.status === 'PINNED_PREVIOUS')).toBe(true);
    expect(
      teaching.every((r) => r.combination.projectionId === 'proj-old'),
    ).toBe(true);
  });

  it('blocks consumer on missing artifact without claiming active', () => {
    const records = evaluateConsumerReadiness({
      artifacts: completeArtifacts({
        projection: {
          present: true,
          projectionId: 'proj-1',
          projectionHash: hashD,
          authorityReleaseId: 'ctr:release:eng-v1',
          captureRevision: commitA,
          gatePassed: true,
          artifactHashes: {
            'projection-manifest.json': hashE,
            // cards-index intentionally missing
            'resources.jsonl': hashF,
            'bindings.jsonl': hashA,
            'prerequisites.jsonl': hashC,
          },
          hasResources: true,
          hasCardsIndex: false,
          hasPrerequisites: true,
          hasImpactReport: false,
        },
      }),
      preferPinOnBlock: false,
    });
    const konling = records.find((r) => r.consumerId === 'konling');
    const teachingRag = records.find((r) => r.consumerId === 'teaching-resource-rag');
    expect(konling?.status).toBe('BLOCKED_LOCAL_DEPENDENCY');
    expect(teachingRag?.status).toBe('BLOCKED_LOCAL_DEPENDENCY');
    expect(konling?.reasons.some((r) => r.includes('cards'))).toBe(true);
    const eng = records.find((r) => r.consumerId === 'engineering-graph');
    expect(eng?.status).toBe('READY');
  });

  it('blocks learning-path when prerequisites are missing', () => {
    const records = evaluateConsumerReadiness({
      artifacts: completeArtifacts({
        projection: {
          present: true,
          projectionId: 'proj-1',
          projectionHash: hashD,
          authorityReleaseId: 'ctr:release:eng-v1',
          captureRevision: commitA,
          gatePassed: true,
          artifactHashes: {
            'projection-manifest.json': hashE,
            'resources.jsonl': hashF,
            'bindings.jsonl': hashA,
            'cards-index.json': hashB,
          },
          hasResources: true,
          hasCardsIndex: true,
          hasPrerequisites: false,
          hasImpactReport: false,
        },
      }),
      preferPinOnBlock: false,
    });
    const path = records.find((r) => r.consumerId === 'learning-path');
    expect(path?.status).toBe('BLOCKED_LOCAL_DEPENDENCY');
    expect(path?.reasons).toContain('prerequisites-missing');
  });

  it('fails mixed-capture / identity-drift fixtures closed', () => {
    const mixed = completeArtifacts({
      captureRevision: commitA,
      projection: {
        present: true,
        projectionId: 'proj-1',
        projectionHash: hashD,
        authorityReleaseId: 'ctr:release:OTHER',
        captureRevision: commitB,
        gatePassed: true,
        artifactHashes: {
          'projection-manifest.json': hashE,
          'resources.jsonl': hashF,
          'bindings.jsonl': hashA,
          'cards-index.json': hashB,
          'prerequisites.jsonl': hashC,
        },
        hasResources: true,
        hasCardsIndex: true,
        hasPrerequisites: true,
        hasImpactReport: true,
      },
      identityDriftReasons: ['fixture-identity-drift'],
    });
    const validation = validateStagedArtifactSet(mixed);
    expect(validation.ok).toBe(false);
    expect(validation.reasons.some((r) => r.includes('mismatch') || r.includes('drift'))).toBe(
      true,
    );

    const built = buildStagedActivationManifest({ artifacts: mixed });
    expect(built.status).toBe('failed');
    expect(built.manifest).toBeNull();
  });

  it('blocks on route/resource smoke failure', () => {
    const records = evaluateConsumerReadiness({
      artifacts: completeArtifacts({
        routeSmoke: {
          'course-runtime': {
            ok: false,
            reasons: ['resource-route-404'],
          },
        },
      }),
      preferPinOnBlock: false,
    });
    const course = records.find((r) => r.consumerId === 'course-runtime');
    expect(course?.status).toBe('BLOCKED_LOCAL_DEPENDENCY');
    expect(course?.reasons).toContain('route-smoke-failed');
  });
});

// ---------------------------------------------------------------------------
// 2. Staged activation + atomic pointer + rollback
// ---------------------------------------------------------------------------

describe('Staged activation and atomic pointer (#1276)', () => {
  it('materializes complete staged manifest with deterministic hashes', () => {
    const paths = tempActivationRoot();
    const first = stageConsumerActivation(paths, {
      artifacts: completeArtifacts(),
      stagedAt: '2026-08-04T00:00:00.000Z',
      activationId: 'activation-fixed-1',
    });
    expect(first.reused).toBe(false);
    expect(first.manifest.contract).toBe(CONSUMER_ACTIVATION_CONTRACT);
    expect(first.manifest.activationHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.manifest.consumers).toHaveLength(6);
    expect(first.manifest.impact.readyConsumerIds).toEqual(
      expect.arrayContaining([
        'engineering-graph',
        'engineering-rag',
        'course-runtime',
        'konling',
        'teaching-resource-rag',
        'learning-path',
      ]),
    );

    const second = stageConsumerActivation(paths, {
      artifacts: completeArtifacts(),
      stagedAt: '2026-08-04T00:00:00.000Z',
      activationId: 'activation-fixed-1',
    });
    expect(second.reused).toBe(true);
    expect(second.activationHash).toBe(first.activationHash);

    const loaded = loadStagedConsumerActivation(paths, first.activationId);
    expect(loaded.activationHash).toBe(first.activationHash);
  });

  it('activates engineering-first while pinning affected teaching consumers', () => {
    const paths = tempActivationRoot();
    const staged = stageConsumerActivation(paths, {
      artifacts: completeArtifacts({
        projection: {
          present: true,
          projectionId: 'proj-1',
          projectionHash: hashD,
          authorityReleaseId: 'ctr:release:eng-v1',
          captureRevision: commitA,
          gatePassed: false,
          artifactHashes: {
            'projection-manifest.json': hashE,
            'resources.jsonl': hashF,
            'bindings.jsonl': hashA,
            'cards-index.json': hashB,
            'prerequisites.jsonl': hashC,
          },
          hasResources: true,
          hasCardsIndex: true,
          hasPrerequisites: true,
          hasImpactReport: true,
        },
      }),
      priorConsumers: priorTeachingPins(),
      stagedAt: '2026-08-04T01:00:00.000Z',
      activationId: 'activation-eng-first',
    });

    const eng = staged.manifest.consumers.filter(
      (c) =>
        c.consumerId === 'engineering-graph' || c.consumerId === 'engineering-rag',
    );
    const teaching = staged.manifest.consumers.filter(
      (c) =>
        c.consumerId !== 'engineering-graph' && c.consumerId !== 'engineering-rag',
    );
    expect(eng.every((c) => c.status === 'READY')).toBe(true);
    expect(teaching.every((c) => c.status === 'PINNED_PREVIOUS')).toBe(true);
    expect(staged.manifest.impact.readyConsumerIds).toEqual(
      expect.arrayContaining(['engineering-graph', 'engineering-rag']),
    );
    expect(staged.manifest.impact.pinnedConsumerIds.length).toBe(4);

    const activation = activateConsumerActivation(paths, {
      activationId: staged.activationId,
      activatedAt: '2026-08-04T01:00:01.000Z',
      activationReceiptId: 'receipt-eng-first',
    });
    expect(activation.status).toBe('activated');
    expect(activation.receipt.advancedConsumerIds).toEqual(
      expect.arrayContaining(['engineering-graph', 'engineering-rag']),
    );
    expect(activation.receipt.pinnedConsumerIds).toEqual(
      expect.arrayContaining([
        'course-runtime',
        'konling',
        'teaching-resource-rag',
        'learning-path',
      ]),
    );

    const active = resolveActiveConsumerActivation(paths);
    expect(active.status).toBe('available');
    expect(active.manifest?.activationId).toBe(staged.activationId);

    const konling = resolveKonlingActivation(paths);
    expect(konling.status).toBe('pinned');
    expect(konling.combination?.projectionId).toBe('proj-old');
    expect(isConsumerProductionReady(konling)).toBe(false);

    const engGraph = resolveEngineeringGraphActivation(paths);
    expect(engGraph.status).toBe('ready');
    expect(isConsumerProductionReady(engGraph)).toBe(true);
  });

  it('keeps current pointer unchanged when staged set is mixed/missing', () => {
    const paths = tempActivationRoot();
    const good = stageConsumerActivation(paths, {
      artifacts: completeArtifacts(),
      stagedAt: '2026-08-04T02:00:00.000Z',
      activationId: 'activation-good',
    });
    const first = activateConsumerActivation(paths, {
      activationId: good.activationId,
      activationReceiptId: 'receipt-good',
      activatedAt: '2026-08-04T02:00:01.000Z',
    });
    expect(first.status).toBe('activated');
    const pointerBefore = readCurrentConsumerActivationPointer(paths);

    expect(() =>
      stageConsumerActivation(paths, {
        artifacts: completeArtifacts({
          authority: {
            present: true,
            releaseId: 'ctr:release:eng-v1',
            snapshotId: 'snap-eng-1',
            snapshotHash: 'not-a-hash',
            captureRevision: commitA,
            artifactHashes: {
              'manifest.json': hashB,
              'engineering.json': hashC,
            },
          },
        }),
        activationId: 'activation-bad',
      }),
    ).toThrow(/stage-failed|invalid|hash/i);

    const pointerAfter = readCurrentConsumerActivationPointer(paths);
    expect(pointerAfter).toEqual(pointerBefore);
  });

  it('retains prior manifest and supports digest-checked rollback', () => {
    const paths = tempActivationRoot();
    const v1 = stageConsumerActivation(paths, {
      artifacts: completeArtifacts(),
      stagedAt: '2026-08-04T03:00:00.000Z',
      activationId: 'activation-v1',
    });
    const a1 = activateConsumerActivation(paths, {
      activationId: v1.activationId,
      activationReceiptId: 'receipt-v1',
      activatedAt: '2026-08-04T03:00:01.000Z',
    });
    expect(a1.status).toBe('activated');

    // Slightly different capture markers via different stagedAt + authority snapshot.
    const v2Artifacts = completeArtifacts({
      authority: {
        present: true,
        releaseId: 'ctr:release:eng-v2',
        snapshotId: 'snap-eng-2',
        snapshotHash: hashF,
        captureRevision: commitA,
        artifactHashes: {
          'manifest.json': hashA,
          'engineering.json': hashB,
        },
      },
      projection: {
        present: true,
        projectionId: 'proj-2',
        projectionHash: hashC,
        authorityReleaseId: 'ctr:release:eng-v2',
        captureRevision: commitA,
        gatePassed: true,
        artifactHashes: {
          'projection-manifest.json': hashD,
          'resources.jsonl': hashE,
          'bindings.jsonl': hashF,
          'cards-index.json': hashA,
          'prerequisites.jsonl': hashB,
          'impact-report.json': hashC,
        },
        hasResources: true,
        hasCardsIndex: true,
        hasPrerequisites: true,
        hasImpactReport: true,
      },
    });
    const v2 = stageConsumerActivation(paths, {
      artifacts: v2Artifacts,
      priorActivationId: v1.activationId,
      priorActivationHash: v1.activationHash,
      stagedAt: '2026-08-04T03:10:00.000Z',
      activationId: 'activation-v2',
    });
    const a2 = activateConsumerActivation(paths, {
      activationId: v2.activationId,
      activationReceiptId: 'receipt-v2',
      activatedAt: '2026-08-04T03:10:01.000Z',
    });
    expect(a2.status).toBe('activated');
    expect(readCurrentConsumerActivationPointer(paths)?.activationId).toBe(
      'activation-v2',
    );

    // v1 release still immutable on disk.
    expect(
      existsSync(path.join(paths.releasesDir, 'activation-v1', 'activation.json')),
    ).toBe(true);
    expect(
      existsSync(path.join(paths.releasesDir, 'activation-v2', 'activation.json')),
    ).toBe(true);

    const bad = rollbackConsumerActivation(paths, {
      toActivationId: 'activation-v1',
      toActivationHash: hashA,
      rollbackReceiptId: 'rollback-bad-hash',
    });
    expect(bad.status).toBe('failed');
    expect(bad.receipt.reasons).toContain('rollback-target-digest-mismatch');
    expect(readCurrentConsumerActivationPointer(paths)?.activationId).toBe(
      'activation-v2',
    );

    const ok = rollbackConsumerActivation(paths, {
      toActivationId: 'activation-v1',
      toActivationHash: v1.activationHash,
      rollbackReceiptId: 'rollback-ok',
      rolledBackAt: '2026-08-04T03:20:00.000Z',
    });
    expect(ok.status).toBe('rolled-back');
    expect(ok.pointer?.activationId).toBe('activation-v1');
    expect(ok.pointer?.activationHash).toBe(v1.activationHash);

    const active = resolveActiveConsumerActivation(paths);
    expect(active.status).toBe('available');
    expect(active.manifest?.activationId).toBe('activation-v1');

    // Snapshots not deleted.
    expect(
      existsSync(path.join(paths.releasesDir, 'activation-v2', 'activation.json')),
    ).toBe(true);
  });

  it('does not let readers observe a partial pointer write', () => {
    const paths = tempActivationRoot();
    const staged = stageConsumerActivation(paths, {
      artifacts: completeArtifacts(),
      stagedAt: '2026-08-04T04:00:00.000Z',
      activationId: 'activation-partial',
    });
    const activation = activateConsumerActivation(paths, {
      activationId: staged.activationId,
      activationReceiptId: 'receipt-partial',
    });
    expect(activation.status).toBe('activated');

    // Tamper pointer hash → resolve fail closed.
    const pointerPath = paths.currentPointer;
    const raw = JSON.parse(readFileSync(pointerPath, 'utf8')) as {
      activationHash: string;
    };
    raw.activationHash = '0'.repeat(64);
    writeFileSync(pointerPath, `${JSON.stringify(raw, null, 2)}\n`);

    const resolved = resolveActiveConsumerActivation(paths);
    expect(resolved.status).toBe('unavailable');
  });
});

// ---------------------------------------------------------------------------
// 3. Shadow validation
// ---------------------------------------------------------------------------

describe('Shadow validation (#1276)', () => {
  it('records discrepancies without writing learning/teaching/upstream state', () => {
    const previousViews: ShadowConsumerView[] = [
      {
        consumerId: 'engineering-graph',
        status: 'READY',
        authorityReleaseId: 'ctr:release:eng-v0',
        authoritySnapshotId: 'snap-old',
        authoritySnapshotHash: hashA,
        projectionId: null,
        projectionHash: null,
        scopeId: null,
        captureRevision: commitB,
      },
      {
        consumerId: 'konling',
        status: 'PINNED_PREVIOUS',
        authorityReleaseId: 'ctr:release:eng-v0',
        authoritySnapshotId: 'snap-old',
        authoritySnapshotHash: hashA,
        projectionId: 'proj-old',
        projectionHash: hashE,
        scopeId: 'course-package:1-1',
        captureRevision: commitB,
        citationIdentity: 'cite-old',
        cardIdentity: 'card-old',
      },
      {
        consumerId: 'learning-path',
        status: 'READY',
        authorityReleaseId: 'ctr:release:eng-v0',
        authoritySnapshotId: 'snap-old',
        authoritySnapshotHash: hashA,
        projectionId: 'proj-old',
        projectionHash: hashE,
        scopeId: null,
        captureRevision: commitB,
        pathReadiness: 'pathEligible',
        prerequisiteIdentity: 'prereq-old',
      },
    ];
    const nextViews: ShadowConsumerView[] = [
      {
        consumerId: 'engineering-graph',
        status: 'READY',
        authorityReleaseId: 'ctr:release:eng-v1',
        authoritySnapshotId: 'snap-new',
        authoritySnapshotHash: hashB,
        projectionId: null,
        projectionHash: null,
        scopeId: null,
        captureRevision: commitA,
      },
      {
        consumerId: 'konling',
        status: 'READY',
        authorityReleaseId: 'ctr:release:eng-v1',
        authoritySnapshotId: 'snap-new',
        authoritySnapshotHash: hashB,
        projectionId: 'proj-new',
        projectionHash: hashD,
        scopeId: 'course-package:1-1',
        captureRevision: commitA,
        citationIdentity: 'cite-new',
        cardIdentity: 'card-new',
      },
      {
        consumerId: 'learning-path',
        status: 'READY',
        authorityReleaseId: 'ctr:release:eng-v1',
        authoritySnapshotId: 'snap-new',
        authoritySnapshotHash: hashB,
        projectionId: 'proj-new',
        projectionHash: hashD,
        scopeId: null,
        captureRevision: commitA,
        pathReadiness: 'pathEligible',
        prerequisiteIdentity: 'prereq-new',
      },
    ];

    const report = runConsumerActivationShadow({
      activationId: 'activation-shadow-1',
      previousActivationId: 'activation-prev',
      previous: previousViews,
      next: nextViews,
      comparedAt: '2026-08-04T05:00:00.000Z',
    });

    assertShadowNoWriteInvariants(report);
    expect(report.writesLearningFact).toBe(false);
    expect(report.writesTeachingDecision).toBe(false);
    expect(report.writesUpstreamRelation).toBe(false);
    expect(report.mutatesSelectorOutsideActivationPointer).toBe(false);
    expect(report.discrepancies.length).toBeGreaterThan(0);
    expect(
      report.samples.next.some((s) => s.kind === 'card' || s.kind === 'prerequisite'),
    ).toBe(true);

    const blocked = consumersBlockedByShadow(report);
    expect(blocked).toEqual(
      expect.arrayContaining(['engineering-graph', 'konling', 'learning-path']),
    );

    // Stage with shadow-blocked consumers forced to SHADOW.
    const paths = tempActivationRoot();
    const staged = stageConsumerActivation(paths, {
      artifacts: completeArtifacts(),
      shadowConsumerIds: blocked.filter(
        (id): id is typeof CONSUMER_ACTIVATION_IDS[number] =>
          (CONSUMER_ACTIVATION_IDS as readonly string[]).includes(id),
      ),
      shadowReport: report,
      stagedAt: '2026-08-04T05:01:00.000Z',
      activationId: 'activation-shadow-staged',
    });
    const shadowRows = staged.manifest.consumers.filter((c) =>
      blocked.includes(c.consumerId),
    );
    expect(shadowRows.every((c) => c.status === 'SHADOW')).toBe(true);
    expect(staged.manifest.impact.shadowConsumerIds.length).toBeGreaterThan(0);
  });

  it('shadowViewsFromManifest maps readiness identities', () => {
    const built = buildStagedActivationManifest({
      artifacts: completeArtifacts(),
      stagedAt: '2026-08-04T06:00:00.000Z',
      activationId: 'activation-views',
    });
    expect(built.manifest).not.toBeNull();
    const views = shadowViewsFromManifest(built.manifest!);
    expect(views).toHaveLength(6);
    expect(views.every((v) => v.authorityReleaseId === 'ctr:release:eng-v1')).toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// 4. Consumer wiring + non-goals
// ---------------------------------------------------------------------------

describe('Consumer wiring and scope guards (#1276)', () => {
  it('wires named resolvers to the active activation pointer', () => {
    const paths = tempActivationRoot();
    const staged = stageConsumerActivation(paths, {
      artifacts: completeArtifacts(),
      stagedAt: '2026-08-04T07:00:00.000Z',
      activationId: 'activation-wire',
    });
    activateConsumerActivation(paths, {
      activationId: staged.activationId,
      activationReceiptId: 'receipt-wire',
    });

    expect(resolveConsumerActivation(paths, 'engineering-graph').status).toBe(
      'ready',
    );
    expect(resolveConsumerActivation(paths, 'course-runtime').status).toBe(
      'ready',
    );
    expect(resolveLearningPathActivation(paths).combination?.projectionId).toBe(
      'proj-1',
    );
    expect(resolveConsumerActivation(paths, 'not-a-consumer').status).toBe(
      'unavailable',
    );
    expect(
      resolveConsumerActivation(paths, 'not-a-consumer').reasons[0],
    ).toMatch(/unknown-consumer/);
  });

  it('ships consumer-activation schema without remote deploy or legacy deletion hooks', () => {
    const schemaPath = path.resolve(
      process.cwd(),
      'course-content/authoring/knowledge/teaching-projection/schemas/consumer-activation.schema.json',
    );
    expect(existsSync(schemaPath)).toBe(true);
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as {
      $id: string;
    };
    expect(schema.$id).toBe('act-versioned-knowledge-consumer-activation/v1');

    // Source package must not export deploy/migration/delete-legacy entrypoints.
    const indexSource = readFileSync(
      path.resolve(process.cwd(), 'src/lib/versioned-knowledge-activation/index.ts'),
      'utf8',
    );
    expect(indexSource).not.toMatch(/deploy|legacy.?delet|migration/i);
  });
});
