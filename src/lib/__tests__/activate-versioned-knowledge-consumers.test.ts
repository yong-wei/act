/**
 * Versioned knowledge consumer activation (#1276).
 *
 * Readiness, staged materialization, atomic pointer, shadow, and rollback.
 */

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
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
  resolveEngineeringGraphProductionSelection,
  resolveKonlingActivation,
  resolveLearningPathActivation,
  resolveLearningPathProductionSelection,
  resolveCourseRuntimeProductionSelection,
  resolveKonlingProductionSelection,
  resolveEngineeringRagProductionSelection,
  resolveTeachingResourceRagProductionSelection,
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

function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

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

function tempArtifactRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'act-activation-artifacts-'));
  tempRoots.push(root);
  return root;
}

function writeArtifact(
  root: string,
  relativeName: string,
  content: string,
): { path: string; hash: string } {
  const filePath = path.join(root, relativeName);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
  return { path: filePath, hash: sha256(content) };
}

/**
 * Build a complete artifact set backed by real staged files whose digests
 * match artifactHashes (required for stage validation after P1-2).
 */
function completeArtifacts(
  overrides: Partial<StagedActivationArtifactSet> = {},
  options: { artifactRoot?: string; withFiles?: boolean } = {},
): StagedActivationArtifactSet {
  const withFiles = options.withFiles !== false;
  const artifactRoot = options.artifactRoot ?? (withFiles ? tempArtifactRoot() : '');

  const authorityFiles = withFiles
    ? {
        'manifest.json': writeArtifact(
          artifactRoot,
          'authority/manifest.json',
          JSON.stringify({ releaseId: 'ctr:release:eng-v1', snapshotId: 'snap-eng-1' }),
        ),
        'engineering.json': writeArtifact(
          artifactRoot,
          'authority/engineering.json',
          JSON.stringify({ objects: [], relations: [] }),
        ),
      }
    : null;
  const projectionFiles = withFiles
    ? {
        'projection-manifest.json': writeArtifact(
          artifactRoot,
          'projection/projection-manifest.json',
          JSON.stringify({ projectionId: 'proj-1' }),
        ),
        'resources.jsonl': writeArtifact(
          artifactRoot,
          'projection/resources.jsonl',
          '{"resourceId":"r1"}\n',
        ),
        'bindings.jsonl': writeArtifact(
          artifactRoot,
          'projection/bindings.jsonl',
          '{"bindingId":"b1"}\n',
        ),
        'cards-index.json': writeArtifact(
          artifactRoot,
          'projection/cards-index.json',
          JSON.stringify({ cards: [] }),
        ),
        'prerequisites.jsonl': writeArtifact(
          artifactRoot,
          'projection/prerequisites.jsonl',
          '{"edgeId":"e1"}\n',
        ),
        'impact-report.json': writeArtifact(
          artifactRoot,
          'projection/impact-report.json',
          JSON.stringify({ impact: true }),
        ),
      }
    : null;

  const hashA = authorityFiles
    ? authorityFiles['manifest.json'].hash
    : 'a'.repeat(64);
  // Keep stable secondary digests for prior pins in tests without files.
  const hashF = projectionFiles
    ? projectionFiles['resources.jsonl'].hash
    : 'f'.repeat(64);
  const hashE = projectionFiles
    ? projectionFiles['projection-manifest.json'].hash
    : 'e'.repeat(64);
  const hashD = projectionFiles
    ? projectionFiles['impact-report.json'].hash
    : 'd'.repeat(64);
  const hashC = authorityFiles
    ? authorityFiles['engineering.json'].hash
    : 'c'.repeat(64);
  const hashB = projectionFiles
    ? projectionFiles['cards-index.json'].hash
    : 'b'.repeat(64);

  void hashA;
  void hashF;

  const base: StagedActivationArtifactSet = {
    captureRevision: commitA,
    authority: {
      present: true,
      releaseId: 'ctr:release:eng-v1',
      snapshotId: 'snap-eng-1',
      snapshotHash: authorityFiles
        ? sha256('snap-eng-1')
        : 'a'.repeat(64),
      captureRevision: commitA,
      artifactHashes: {
        'manifest.json': authorityFiles
          ? authorityFiles['manifest.json'].hash
          : 'b'.repeat(64),
        'engineering.json': authorityFiles
          ? authorityFiles['engineering.json'].hash
          : 'c'.repeat(64),
      },
      artifactPaths: authorityFiles
        ? {
            'manifest.json': authorityFiles['manifest.json'].path,
            'engineering.json': authorityFiles['engineering.json'].path,
          }
        : undefined,
    },
    projection: {
      present: true,
      projectionId: 'proj-1',
      projectionHash: projectionFiles
        ? projectionFiles['projection-manifest.json'].hash
        : 'd'.repeat(64),
      authorityReleaseId: 'ctr:release:eng-v1',
      captureRevision: commitA,
      gatePassed: true,
      artifactHashes: {
        'projection-manifest.json': projectionFiles
          ? projectionFiles['projection-manifest.json'].hash
          : 'e'.repeat(64),
        'resources.jsonl': projectionFiles
          ? projectionFiles['resources.jsonl'].hash
          : 'f'.repeat(64),
        'bindings.jsonl': projectionFiles
          ? projectionFiles['bindings.jsonl'].hash
          : 'a'.repeat(64),
        'cards-index.json': projectionFiles
          ? projectionFiles['cards-index.json'].hash
          : 'b'.repeat(64),
        'prerequisites.jsonl': projectionFiles
          ? projectionFiles['prerequisites.jsonl'].hash
          : 'c'.repeat(64),
        'impact-report.json': projectionFiles
          ? projectionFiles['impact-report.json'].hash
          : 'd'.repeat(64),
      },
      artifactPaths: projectionFiles
        ? {
            'projection-manifest.json':
              projectionFiles['projection-manifest.json'].path,
            'resources.jsonl': projectionFiles['resources.jsonl'].path,
            'bindings.jsonl': projectionFiles['bindings.jsonl'].path,
            'cards-index.json': projectionFiles['cards-index.json'].path,
            'prerequisites.jsonl': projectionFiles['prerequisites.jsonl'].path,
            'impact-report.json': projectionFiles['impact-report.json'].path,
          }
        : undefined,
      hasResources: true,
      hasCardsIndex: true,
      hasPrerequisites: true,
      hasImpactReport: true,
    },
  };

  // When overrides replace authority/projection, merge fields but do not
  // reintroduce omitted artifactHashes keys (missing-artifact fixtures).
  // Custom artifactHashes without matching paths intentionally drop base paths
  // so callers can build deliberate invalid-hash fixtures; staging then fails
  // closed on path-missing / hash-mismatch as required by P1-2.
  const authority =
    overrides.authority === undefined
      ? base.authority
      : overrides.authority === null
        ? null
        : {
            ...base.authority!,
            ...overrides.authority,
            artifactHashes:
              overrides.authority.artifactHashes
              ?? base.authority!.artifactHashes,
            artifactPaths:
              overrides.authority.artifactPaths
              ?? (overrides.authority.artifactHashes
                || overrides.authority.present === false
                ? undefined
                : base.authority?.artifactPaths),
          };
  const projection =
    overrides.projection === undefined
      ? base.projection
      : overrides.projection === null
        ? null
        : {
            ...base.projection!,
            ...overrides.projection,
            artifactHashes:
              overrides.projection.artifactHashes
              ?? base.projection!.artifactHashes,
            artifactPaths:
              overrides.projection.artifactPaths
              ?? (overrides.projection.artifactHashes
                || overrides.projection.present === false
                ? undefined
                : base.projection?.artifactPaths),
          };

  void hashB;
  void hashC;
  void hashD;
  void hashE;

  return {
    ...base,
    ...overrides,
    authority,
    projection,
  };
}

/** Prior pins use fixed digests independent of staged file content. */
const hashA = 'a'.repeat(64);
const hashB = 'b'.repeat(64);
const hashC = 'c'.repeat(64);
const hashD = 'd'.repeat(64);
const hashE = 'e'.repeat(64);
const hashF = 'f'.repeat(64);

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
    const base = completeArtifacts();
    const staged = stageConsumerActivation(paths, {
      artifacts: {
        ...base,
        projection: {
          ...base.projection!,
          gatePassed: false,
        },
      },
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

    // Second staged set uses different real files so digests differ.
    const v2Root = tempArtifactRoot();
    const v2Manifest = writeArtifact(
      v2Root,
      'authority/manifest.json',
      JSON.stringify({ releaseId: 'ctr:release:eng-v2', snapshotId: 'snap-eng-2' }),
    );
    const v2Engineering = writeArtifact(
      v2Root,
      'authority/engineering.json',
      JSON.stringify({ objects: [{ id: 'n2' }], relations: [] }),
    );
    const v2ProjManifest = writeArtifact(
      v2Root,
      'projection/projection-manifest.json',
      JSON.stringify({ projectionId: 'proj-2' }),
    );
    const v2Resources = writeArtifact(v2Root, 'projection/resources.jsonl', '{"resourceId":"r2"}\n');
    const v2Bindings = writeArtifact(v2Root, 'projection/bindings.jsonl', '{"bindingId":"b2"}\n');
    const v2Cards = writeArtifact(
      v2Root,
      'projection/cards-index.json',
      JSON.stringify({ cards: [{ id: 'c2' }] }),
    );
    const v2Prereq = writeArtifact(v2Root, 'projection/prerequisites.jsonl', '{"edgeId":"e2"}\n');
    const v2Impact = writeArtifact(
      v2Root,
      'projection/impact-report.json',
      JSON.stringify({ impact: 'v2' }),
    );
    const v2Artifacts: StagedActivationArtifactSet = {
      captureRevision: commitA,
      authority: {
        present: true,
        releaseId: 'ctr:release:eng-v2',
        snapshotId: 'snap-eng-2',
        snapshotHash: sha256('snap-eng-2'),
        captureRevision: commitA,
        artifactHashes: {
          'manifest.json': v2Manifest.hash,
          'engineering.json': v2Engineering.hash,
        },
        artifactPaths: {
          'manifest.json': v2Manifest.path,
          'engineering.json': v2Engineering.path,
        },
      },
      projection: {
        present: true,
        projectionId: 'proj-2',
        projectionHash: v2ProjManifest.hash,
        authorityReleaseId: 'ctr:release:eng-v2',
        captureRevision: commitA,
        gatePassed: true,
        artifactHashes: {
          'projection-manifest.json': v2ProjManifest.hash,
          'resources.jsonl': v2Resources.hash,
          'bindings.jsonl': v2Bindings.hash,
          'cards-index.json': v2Cards.hash,
          'prerequisites.jsonl': v2Prereq.hash,
          'impact-report.json': v2Impact.hash,
        },
        artifactPaths: {
          'projection-manifest.json': v2ProjManifest.path,
          'resources.jsonl': v2Resources.path,
          'bindings.jsonl': v2Bindings.path,
          'cards-index.json': v2Cards.path,
          'prerequisites.jsonl': v2Prereq.path,
          'impact-report.json': v2Impact.path,
        },
        hasResources: true,
        hasCardsIndex: true,
        hasPrerequisites: true,
        hasImpactReport: true,
      },
    };
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

    // Non-prior staged release must not be a valid rollback target (P2).
    const notPrior = rollbackConsumerActivation(paths, {
      toActivationId: 'activation-v2',
      toActivationHash: v2.activationHash,
      rollbackReceiptId: 'rollback-not-prior',
    });
    expect(notPrior.status).toBe('failed');
    expect(notPrior.receipt.reasons).toContain('rollback-target-not-prior');

    // Omitting toActivationHash still only allows the recorded prior.
    const ok = rollbackConsumerActivation(paths, {
      toActivationId: 'activation-v1',
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

    // P1-3: shadowReport alone (no explicit shadowConsumerIds) auto-blocks.
    const paths = tempActivationRoot();
    const staged = stageConsumerActivation(paths, {
      artifacts: completeArtifacts(),
      shadowReport: report,
      stagedAt: '2026-08-04T05:01:00.000Z',
      activationId: 'activation-shadow-staged',
    });
    const shadowRows = staged.manifest.consumers.filter((c) =>
      blocked.includes(c.consumerId),
    );
    expect(shadowRows.every((c) => c.status === 'SHADOW')).toBe(true);
    expect(staged.manifest.impact.shadowConsumerIds.length).toBeGreaterThan(0);
    expect(
      staged.manifest.consumers
        .filter((c) => blocked.includes(c.consumerId))
        .every((c) => c.status !== 'READY'),
    ).toBe(true);
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

  it('treats corrupted activation pointer as unavailable not absent', () => {
    const prev = process.env.ACT_CONSUMER_ACTIVATION_ROOT;
    const paths = tempActivationRoot();
    process.env.ACT_CONSUMER_ACTIVATION_ROOT = paths.root;
    try {
      // Corrupt current.json present → unavailable (fail closed), not absent.
      mkdirSync(paths.root, { recursive: true });
      writeFileSync(paths.currentPointer, '{not-json', 'utf8');
      const selection = resolveEngineeringGraphProductionSelection();
      expect(selection.mode).toBe('unavailable');
      expect(selection.mode).not.toBe('absent');
    } finally {
      if (prev === undefined) delete process.env.ACT_CONSUMER_ACTIVATION_ROOT;
      else process.env.ACT_CONSUMER_ACTIVATION_ROOT = prev;
    }
  });

  it('rejects activation whose prior does not match the current pointer (P2)', () => {
    const paths = tempActivationRoot();
    const v1 = stageConsumerActivation(paths, {
      artifacts: completeArtifacts(),
      stagedAt: '2026-08-04T09:00:00.000Z',
      activationId: 'activation-prior-v1',
    });
    activateConsumerActivation(paths, {
      activationId: v1.activationId,
      activationReceiptId: 'receipt-prior-v1',
    });

    // Stage v2 claiming a non-current prior.
    const v2 = stageConsumerActivation(paths, {
      artifacts: completeArtifacts(),
      priorActivationId: 'activation-someone-else',
      priorActivationHash: hashA,
      stagedAt: '2026-08-04T09:10:00.000Z',
      activationId: 'activation-prior-v2',
    });
    const failed = activateConsumerActivation(paths, {
      activationId: v2.activationId,
      activationReceiptId: 'receipt-prior-v2',
    });
    expect(failed.status).toBe('failed');
    expect(failed.receipt.reasons).toContain('prior-activation-mismatch');
    expect(readCurrentConsumerActivationPointer(paths)?.activationId).toBe(
      'activation-prior-v1',
    );
  });

  it('rejects invented digests without real staged artifact files (P1-2)', () => {
    const fake = completeArtifacts(
      {
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
          // Intentionally no artifactPaths
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
          },
          hasResources: true,
          hasCardsIndex: true,
          hasPrerequisites: true,
          hasImpactReport: false,
        },
      },
      { withFiles: false },
    );
    const validation = validateStagedArtifactSet(fake);
    expect(validation.ok).toBe(false);
    expect(
      validation.reasons.some(
        (r) => r.includes('path-missing') || r.includes('hash-mismatch'),
      ),
    ).toBe(true);
    const built = buildStagedActivationManifest({ artifacts: fake });
    expect(built.status).toBe('failed');
  });

  it('rejects tampered staged files whose digests no longer match (P1-2)', () => {
    const artifacts = completeArtifacts();
    const manifestPath = artifacts.authority!.artifactPaths!['manifest.json'];
    writeFileSync(manifestPath, '{"tampered":true}\n', 'utf8');
    const validation = validateStagedArtifactSet(artifacts);
    expect(validation.ok).toBe(false);
    expect(validation.reasons.some((r) => r.includes('hash-mismatch'))).toBe(
      true,
    );
  });

  it('real consumer entry points import activation production selections (P1-1)', () => {
    const eng = readFileSync(
      path.resolve(
        process.cwd(),
        'src/lib/authoritative-knowledge/engineering-authority-consumers.ts',
      ),
      'utf8',
    );
    expect(eng).toContain('resolveEngineeringGraphProductionSelection');
    expect(eng).toContain('resolveEngineeringRagProductionSelection');
    expect(eng).toContain('loadStagedAuthoritySnapshot');

    const course = readFileSync(
      path.resolve(process.cwd(), 'src/lib/layered-graph/course-page-context.ts'),
      'utf8',
    );
    expect(course).toContain('resolveCourseRuntimeProductionSelection');

    const konling = readFileSync(
      path.resolve(
        process.cwd(),
        'src/lib/konling-teaching-projection-binding.ts',
      ),
      'utf8',
    );
    expect(konling).toContain('resolveKonlingProductionSelection');

    const rag = readFileSync(
      path.resolve(process.cwd(), 'src/lib/canonical-rag/domain-composition.ts'),
      'utf8',
    );
    expect(rag).toContain('resolveEngineeringRagProductionSelection');
    expect(rag).toContain('resolveTeachingResourceRagProductionSelection');
    expect(rag).toContain('applyEngineeringRagConsumerActivation');
    expect(rag).toContain('applyTeachingResourceRagConsumerActivation');

    const pathPlanner = readFileSync(
      path.resolve(
        process.cwd(),
        'src/lib/act-prerequisite-path-planner/planner.ts',
      ),
      'utf8',
    );
    expect(pathPlanner).toContain('resolveLearningPathProductionSelection');
    expect(pathPlanner).toContain('applyLearningPathConsumerActivation');
  });

  it('production selection modes follow the active activation pointer', () => {
    const prev = process.env.ACT_CONSUMER_ACTIVATION_ROOT;
    const paths = tempActivationRoot();
    process.env.ACT_CONSUMER_ACTIVATION_ROOT = paths.root;
    try {
      const base = completeArtifacts();
      const engFirst = stageConsumerActivation(paths, {
        artifacts: {
          ...base,
          projection: {
            ...base.projection!,
            gatePassed: false,
          },
        },
        priorConsumers: priorTeachingPins(),
        stagedAt: '2026-08-04T08:00:00.000Z',
        activationId: 'activation-selection',
      });
      activateConsumerActivation(paths, {
        activationId: engFirst.activationId,
        activationReceiptId: 'receipt-selection',
      });

      expect(resolveEngineeringGraphProductionSelection().mode).toBe(
        'use-combination',
      );
      expect(resolveEngineeringRagProductionSelection().mode).toBe(
        'use-combination',
      );
      expect(resolveCourseRuntimeProductionSelection().mode).toBe(
        'pin-combination',
      );
      expect(resolveKonlingProductionSelection().mode).toBe('pin-combination');
      expect(resolveTeachingResourceRagProductionSelection().mode).toBe(
        'pin-combination',
      );
      expect(resolveLearningPathProductionSelection().mode).toBe(
        'pin-combination',
      );
      expect(
        resolveCourseRuntimeProductionSelection().combination?.projectionId,
      ).toBe('proj-old');
    } finally {
      if (prev === undefined) delete process.env.ACT_CONSUMER_ACTIVATION_ROOT;
      else process.env.ACT_CONSUMER_ACTIVATION_ROOT = prev;
    }
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
