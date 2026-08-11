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
import { activationDigest } from '../versioned-knowledge-activation/hash';

import {
  stageAuthoritySnapshot,
  resolveAuthorityStorePaths,
  resolveEngineeringAuthorityConsumer,
  type AuthoritativeKnowledgeSnapshot,
} from '../authoritative-knowledge';
import {
  applyEngineeringRagConsumerActivation,
  applyTeachingResourceRagConsumerActivation,
  runEngineeringRagQuery,
} from '../canonical-rag/domain-composition';
import { applyLearningPathConsumerActivation } from '../act-prerequisite-path-planner/planner';
import {
  buildCoursePackageLayeredScope,
  resolveCoursePageLayeredGraphContext,
} from '../layered-graph';
import {
  stageTeachingProjection,
  resolveTeachingProjectionStorePaths,
} from '../teaching-projection';
import type { TeachingProjectionAuthoringInput } from '../teaching-projection/contracts';
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
const fixedHash = 'a'.repeat(64);

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

function tempAuthorityStore() {
  const root = mkdtempSync(path.join(tmpdir(), 'act-consumer-authority-'));
  tempRoots.push(root);
  return resolveAuthorityStorePaths(root);
}

function tempProjectionStore() {
  const root = mkdtempSync(path.join(tmpdir(), 'act-consumer-projection-'));
  tempRoots.push(root);
  return resolveTeachingProjectionStorePaths(root);
}

function fileSha(filePath: string): string {
  return sha256(readFileSync(filePath));
}

function baseAuthoritySnapshot(
  releaseId = 'ctr:release:eng-v1',
): AuthoritativeKnowledgeSnapshot {
  return {
    authorityState: 'candidate',
    productionAuthoritative: false,
    historical: false,
    releaseSet: {
      id: 'set-eng-1',
      controlledPath: 'course-content/authoring/knowledge/releases/lock.json',
      lockVersion: 'actkg-release-set-lock/v1',
      candidateState: 'ACCEPTED_CANDIDATE',
    },
    release: {
      id: releaseId,
      releaseSetId: 'set-eng-1',
      releaseVersion: 'v0.12',
      releaseStatus: 'RELEASED',
      protocol: 'actkg-public-bundle/1',
      authority: 'ActKG',
      scope: 'engineering',
      contractHash: fixedHash,
      releaseHash: fixedHash,
      schemaRawHash: fixedHash,
      releaseRawHash: fixedHash,
      notesRawHash: fixedHash,
      captureRevision: commitA,
      lockRawHash: fixedHash,
      schemaVersion: '0.2.0',
      projectionId: 'proj-runtime-1',
      projectionDigest: 'c'.repeat(64),
      sourceDatasetHash: 'd'.repeat(64),
    },
    receipt: {
      id: 'receipt:eng-1',
      releaseSetId: 'set-eng-1',
      releaseId,
      sourceRun: null,
      sourceImplementationCommit: null,
      captureRevision: commitA,
      lockRawHash: fixedHash,
      ctkgDatasetAvailability: 'UNAVAILABLE',
      ctkgDatasetHash: null,
      ctkgDatasetPublicationIdentity: null,
      ctkgDatasetResolvableLocation: null,
      revisionRegistryAvailability: 'UNAVAILABLE',
      revisionRegistryVersion: null,
      revisionRegistryHash: null,
      objectCount: 2,
      sourceMappingCount: 0,
      goldRelationCount: 1,
      silverRelationCount: 0,
      sourceObjectCount: 0,
      evidenceSegmentCount: 0,
      candidateState: 'ACCEPTED_CANDIDATE',
      importedAt: new Date('2026-08-03T00:00:00.000Z'),
    },
    objects: [
      {
        releaseId,
        canonicalId: 'node-a',
        ordinal: 0,
        canonicalType: 'DomainConcept',
        semanticName: 'Stability',
        reviewStatus: 'approved',
        publicationStatus: 'published',
        lifecycleStatus: 'active',
        payload: { formula: 'Routh-Hurwitz' },
      },
      {
        releaseId,
        canonicalId: 'node-b',
        ordinal: 1,
        canonicalType: 'Formula',
        semanticName: 'Characteristic equation',
        reviewStatus: 'approved',
        publicationStatus: 'published',
        lifecycleStatus: 'active',
        payload: { latex: '1+G(s)H(s)=0' },
      },
    ],
    relations: [
      {
        releaseId,
        relationId: 'rel-1',
        ordinal: 0,
        qualityTier: 'GOLD',
        sourceId: 'node-a',
        targetId: 'node-b',
        relationType: 'has_formula',
        reviewStatus: 'approved',
        publicationStatus: 'published',
        direct: true,
        payload: { note: 'exact-predicate' },
      },
    ],
    sourceMappings: [],
    sourceObjects: [],
    evidence: [],
    releaseEntries: [
      {
        releaseId,
        entityId: 'node-a',
        ordinal: 0,
        releaseTier: 'core',
        entityRole: 'concept',
        inclusionReason: 'aggregate-membership',
        payload: { source: 'release-entry' },
      },
    ],
    upstreamRagReferences: [
      {
        releaseId,
        ordinal: 0,
        publishedEntityId: 'node-a',
        retrievalChunkId: 'chunk-stability-1',
        citationTargetId: 'cite-stability-1',
      },
    ],
    releaseComponents: [
      {
        releaseId,
        ordinal: 0,
        componentReleaseId: 'ctr:component:core-v0.12',
        releaseVersion: 'v0.12',
        protocol: 'actkg-component/1',
        controlledPath: 'components/core',
        releaseHash: fixedHash,
        releaseRawSha256: fixedHash,
        sha256sumsSha256: fixedHash,
        referenceKind: 'aggregate-member',
        componentRole: 'core',
        componentBundleId: 'bundle-core',
        componentBundleDigest: fixedHash,
        componentManifestSha256: fixedHash,
        payload: { role: 'core' },
      },
    ],
    projectionIdentities: [
      {
        releaseId,
        projectionId: 'proj-runtime-1',
        ordinal: 0,
        profile: 'runtime',
        projectionProfile: 'runtime',
        versionDigest: 'c'.repeat(64),
        sourceRelease: releaseId,
        sourceReleaseHash: fixedHash,
        sourceDatasetHash: 'd'.repeat(64),
        nodeCount: 2,
        linkCount: 1,
        artifactPath: 'projections/runtime.jsonl',
        artifactSha256: fixedHash,
        isRuntime: true,
        bundleReceiptId: null,
      },
    ],
    linkMetadata: [
      {
        releaseId,
        relationId: 'rel-1',
        ordinal: 0,
        releaseTier: 'core',
        sourceRelease: releaseId,
        sourceReleaseHash: fixedHash,
        evidenceRefs: [{ kind: 'predicate', id: 'ev-1' }],
        sourceComponentRelease: 'ctr:component:core-v0.12',
        targetComponentRelease: 'ctr:component:core-v0.12',
        relationComponentRelease: 'ctr:component:core-v0.12',
        profiles: ['runtime'],
        payload: { strength: 1 },
        bundleReceiptId: null,
      },
    ],
  };
}

function baseTeachingAuthoring(
  authorityReleaseId: string,
  authoritySnapshotHash: string,
  authoritySnapshotId?: string | null,
): TeachingProjectionAuthoringInput {
  return {
    contract: 'act-teaching-projection-authoring/v1',
    scopeId: 'course-package:fixture',
    authoringRevision: commitA,
    authorityReleaseId,
    authorityReleaseSetId: 'set-eng-1',
    authoritySnapshotId: authoritySnapshotId ?? null,
    authoritySnapshotHash,
    resources: [
      {
        resourceType: 'step',
        lessonKey: 'lesson-02',
        stepId: 'practice-1',
        projectionMode: 'REQUIRED',
        scopeId: 'course-package:fixture',
        title: 'Practice step',
        sourcePath: 'authoring/lessons/lesson-02/steps/practice-1.json',
      },
      {
        resourceType: 'lesson',
        lessonKey: 'lesson-02',
        projectionMode: 'OPTIONAL',
        scopeId: 'course-package:fixture',
      },
    ],
    bindings: [
      {
        resourceId: 'act:step:lesson-02:practice-1',
        canonicalId: 'node-a',
        role: 'PRACTICES',
        scopeId: 'course-package:fixture',
        sourcePath: 'authoring/lessons/lesson-02/steps/practice-1.json',
        primary: true,
      },
    ],
    prerequisites: [
      {
        sourceCanonicalId: 'node-b',
        targetCanonicalId: 'node-a',
        strength: 'REQUIRED',
        scopeId: 'course-package:fixture',
      },
    ],
    coreNodes: [
      {
        canonicalId: 'node-a',
        pathEligible: true,
        cardPolicy: 'optional',
        scopeId: 'course-package:fixture',
      },
      {
        canonicalId: 'node-b',
        pathEligible: true,
        cardPolicy: 'optional',
        scopeId: 'course-package:fixture',
      },
    ],
    cards: [
      {
        cardId: 'card-a',
        canonicalId: 'node-a',
        active: true,
        required: false,
      },
    ],
    authorityNodes: [
      { canonicalId: 'node-a', lifecycleStatus: 'active', successorCanonicalId: null },
      { canonicalId: 'node-b', lifecycleStatus: 'active', successorCanonicalId: null },
    ],
  };
}

/**
 * Build a complete artifact set backed by real Authority/Projection releases
 * that pass the full verifiers used by staging validation.
 */
function completeArtifacts(
  overrides: Partial<StagedActivationArtifactSet> = {},
  options: { withFiles?: boolean; releaseId?: string } = {},
): StagedActivationArtifactSet {
  const withFiles = options.withFiles !== false;
  if (!withFiles) {
    const fakeAuthority = {
      present: true as const,
      releaseId: 'ctr:release:eng-v1',
      snapshotId: 'snap-eng-1',
      snapshotHash: 'a'.repeat(64),
      captureRevision: commitA,
      artifactHashes: {
        'manifest.json': 'b'.repeat(64),
        'engineering.json': 'c'.repeat(64),
      },
    };
    const fakeProjection = {
      present: true as const,
      projectionId: 'proj-1',
      projectionHash: 'd'.repeat(64),
      authorityReleaseId: 'ctr:release:eng-v1',
      captureRevision: commitA,
      gatePassed: true,
      artifactHashes: {
        'projection-manifest.json': 'e'.repeat(64),
        'resources.jsonl': 'f'.repeat(64),
        'bindings.jsonl': 'a'.repeat(64),
        'cards-index.json': 'b'.repeat(64),
        'prerequisites.jsonl': 'c'.repeat(64),
      },
      hasResources: true,
      hasCardsIndex: true,
      hasPrerequisites: true,
      hasImpactReport: false,
    };
    return {
      captureRevision: commitA,
      ...overrides,
      authority:
        overrides.authority === undefined ? fakeAuthority : overrides.authority,
      projection:
        overrides.projection === undefined
          ? fakeProjection
          : overrides.projection,
    };
  }

  const releaseId = options.releaseId ?? 'ctr:release:eng-v1';
  const authRoot = mkdtempSync(path.join(tmpdir(), 'act-auth-'));
  const projRoot = mkdtempSync(path.join(tmpdir(), 'act-proj-'));
  tempRoots.push(authRoot, projRoot);

  const authPaths = resolveAuthorityStorePaths(authRoot);
  const stagedAuth = stageAuthoritySnapshot(authPaths, {
    snapshot: baseAuthoritySnapshot(releaseId),
    captureRevision: commitA,
  }, {
    stagedAt: '2026-08-04T00:00:00.000Z',
  });

  const projPaths = resolveTeachingProjectionStorePaths(projRoot);
  const stagedProj = stageTeachingProjection(
    projPaths,
    baseTeachingAuthoring(
      releaseId,
      stagedAuth.snapshotHash,
      stagedAuth.snapshotId,
    ),
  );
  const projDir = stagedProj.releaseDir;

  const authorityFiles = {
    'manifest.json': stagedAuth.manifestPath,
    'engineering.json': stagedAuth.engineeringPath,
  };
  const projectionFiles = {
    'projection-manifest.json': path.join(projDir, 'projection-manifest.json'),
    'resources.jsonl': path.join(projDir, 'resources.jsonl'),
    'bindings.jsonl': path.join(projDir, 'bindings.jsonl'),
    'cards-index.json': path.join(projDir, 'cards-index.json'),
    'prerequisites.jsonl': path.join(projDir, 'prerequisites.jsonl'),
    'core-nodes.json': path.join(projDir, 'core-nodes.json'),
    'impact-report.json': path.join(projDir, 'impact-report.json'),
    'gate.json': path.join(projDir, 'gate.json'),
  };

  const base: StagedActivationArtifactSet = {
    captureRevision: commitA,
    authority: {
      present: true,
      releaseId: stagedAuth.manifest.releaseId,
      snapshotId: stagedAuth.snapshotId,
      snapshotHash: stagedAuth.snapshotHash,
      captureRevision: stagedAuth.manifest.captureRevision ?? commitA,
      artifactHashes: {
        'manifest.json': fileSha(authorityFiles['manifest.json']),
        'engineering.json': fileSha(authorityFiles['engineering.json']),
      },
      artifactPaths: authorityFiles,
    },
    projection: {
      present: true,
      projectionId: stagedProj.projectionId,
      projectionHash: stagedProj.projectionHash,
      authorityReleaseId: stagedProj.artifacts.manifest.authorityReleaseId,
      captureRevision: commitA,
      gatePassed: stagedProj.artifacts.manifest.gatePassed === true,
      artifactHashes: Object.fromEntries(
        Object.entries(projectionFiles).map(([name, filePath]) => [
          name,
          fileSha(filePath),
        ]),
      ),
      artifactPaths: projectionFiles,
      hasResources: true,
      hasCardsIndex: true,
      hasPrerequisites: true,
      hasImpactReport: true,
    },
  };

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

    // Second staged set uses a different Authority release so digests differ.
    const v2 = stageConsumerActivation(paths, {
      artifacts: completeArtifacts({}, { releaseId: 'ctr:release:eng-v2' }),
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
  it('accepts the expected absence of predecessors during a first activation', () => {
    const report = runConsumerActivationShadow({
      activationId: 'activation-first-shadow',
      previous: [],
      next: [{
        consumerId: 'engineering-graph',
        status: 'READY',
        authorityReleaseId: 'ctr:release:eng-v1',
        authoritySnapshotId: 'snap-first',
        authoritySnapshotHash: fixedHash,
        projectionId: null,
        projectionHash: null,
        scopeId: null,
        captureRevision: commitA,
      }],
      allowInitialAbsentPrevious: true,
      comparedAt: '2026-08-10T15:00:00.000Z',
    });
    expect(report.discrepancies).toEqual([]);
    expect(report.samples.previous).toEqual([]);
    expect(report.samples.next).toHaveLength(1);
  });

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
    expect(
      resolveLearningPathActivation(paths).combination?.projectionId,
    ).toMatch(/^proj-/);
    expect(resolveConsumerActivation(paths, 'not-a-consumer').status).toBe(
      'unavailable',
    );
    expect(
      resolveConsumerActivation(paths, 'not-a-consumer').reasons[0],
    ).toMatch(/unknown-consumer/);
  });

  it('fails authority-absent staging unless every consumer pins prior', () => {
    const paths = tempActivationRoot();
    // Only one prior → not full pin map → stage must fail.
    expect(() =>
      stageConsumerActivation(paths, {
        artifacts: completeArtifacts({
          authority: {
            present: false,
            releaseId: null,
            snapshotId: null,
            snapshotHash: null,
            captureRevision: null,
            artifactHashes: {},
          },
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
        priorConsumers: priorTeachingPins().slice(0, 1),
        stagedAt: '2026-08-04T10:00:00.000Z',
        activationId: 'activation-partial-prior',
      }),
    ).toThrow(/authority-absent-requires-full-prior-pins|stage-failed/i);

    // Full prior map for all six consumers → pin-only stage succeeds.
    const fullPriors: PriorConsumerState[] = CONSUMER_ACTIVATION_IDS.map(
      (consumerId) => ({
        consumerId,
        combination: {
          authorityReleaseId: 'ctr:release:eng-v0',
          authoritySnapshotId: 'snap-old',
          authoritySnapshotHash: hashF,
          projectionId: consumerId.startsWith('engineering') ? null : 'proj-old',
          projectionHash: consumerId.startsWith('engineering') ? null : hashE,
          scopeId: null,
          captureRevision: commitB,
        },
      }),
    );
    const staged = stageConsumerActivation(paths, {
      artifacts: completeArtifacts({
        authority: {
          present: false,
          releaseId: null,
          snapshotId: null,
          snapshotHash: null,
          captureRevision: null,
          artifactHashes: {},
        },
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
      priorConsumers: fullPriors,
      stagedAt: '2026-08-04T10:01:00.000Z',
      activationId: 'activation-full-prior-pins',
    });
    expect(staged.manifest.consumers.every((c) => c.status === 'PINNED_PREVIOUS')).toBe(
      true,
    );
  });

    it('refuses activate when only a partial prior-pin set is staged', () => {
    const paths = tempActivationRoot();
    // Craft a staged release that skipped stage-time checks (defense in depth).
    const partialPriors: PriorConsumerState[] = priorTeachingPins().slice(0, 1);
    // Stage a normal ready activation first so we have a baseline pointer optional.
    const fullPriors: PriorConsumerState[] = CONSUMER_ACTIVATION_IDS.map(
      (consumerId) => ({
        consumerId,
        combination: {
          authorityReleaseId: 'ctr:release:eng-v0',
          authoritySnapshotId: 'snap-old',
          authoritySnapshotHash: hashF,
          projectionId: consumerId.startsWith('engineering') ? null : 'proj-old',
          projectionHash: consumerId.startsWith('engineering') ? null : hashE,
          scopeId: null,
          captureRevision: commitB,
        },
      }),
    );
    const pinOnly = stageConsumerActivation(paths, {
      artifacts: completeArtifacts({
        authority: {
          present: false,
          releaseId: null,
          snapshotId: null,
          snapshotHash: null,
          captureRevision: null,
          artifactHashes: {},
        },
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
      priorConsumers: fullPriors,
      stagedAt: '2026-08-04T11:00:00.000Z',
      activationId: 'activation-full-pins-for-activate',
    });
    // Mutate on-disk manifest to a partial pin set (simulates bypass/tamper).
    const releaseDir = path.join(paths.releasesDir, pinOnly.activationId);
    const manifestPath = path.join(releaseDir, 'activation.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.consumers = manifest.consumers.map((row: { consumerId: string; status: string }, idx: number) =>
      idx === 0
        ? { ...row, status: 'PINNED_PREVIOUS' }
        : { ...row, status: 'BLOCKED_LOCAL_DEPENDENCY' },
    );
    manifest.impact = {
      readyConsumerIds: [],
      // Duplicate the same id six times to attempt to fake a full pin set by length.
      pinnedConsumerIds: Array.from({ length: 6 }, () => manifest.consumers[0].consumerId),
      blockedConsumerIds: manifest.consumers.slice(1).map((c: { consumerId: string }) => c.consumerId),
      shadowConsumerIds: [],
    };
    // Re-digest after mutation so verifyActivationManifest accepts the file.
    const { activationHash: _drop, ...body } = manifest;
    manifest.activationHash = activationDigest(body);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    const result = activateConsumerActivation(paths, {
      activationId: pinOnly.activationId,
    });
    expect(result.status).toBe('failed');
    expect(result.receipt.reasons.join(' ')).toMatch(
      /partial-prior-pin-forbidden|authority-absent-requires-full-prior-pins/,
    );
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

  it('falls back to absent for every named consumer when activation current is missing', () => {
    const prev = process.env.ACT_CONSUMER_ACTIVATION_ROOT;
    const paths = tempActivationRoot();
    process.env.ACT_CONSUMER_ACTIVATION_ROOT = paths.root;
    try {
      const selectors = [
        resolveEngineeringGraphProductionSelection,
        resolveEngineeringRagProductionSelection,
        resolveCourseRuntimeProductionSelection,
        resolveKonlingProductionSelection,
        resolveTeachingResourceRagProductionSelection,
        resolveLearningPathProductionSelection,
      ];
      for (const select of selectors) {
        const selection = select();
        expect(selection.mode).toBe('absent');
        expect(selection.mode).not.toBe('use-combination');
        expect(selection.reasons).toContain('current-pointer-missing');
      }

      const authorityPaths = tempAuthorityStore();
      const graph = resolveEngineeringAuthorityConsumer(
        authorityPaths,
        'engineering-graph',
        { activationSelection: resolveEngineeringGraphProductionSelection() },
      );
      const engineeringRag = resolveEngineeringAuthorityConsumer(
        authorityPaths,
        'engineering-rag',
        { activationSelection: resolveEngineeringRagProductionSelection() },
      );
      expect(graph.status).toBe('unavailable');
      expect(graph.activationMode).toBe('absent');
      expect(engineeringRag.status).toBe('unavailable');
      expect(engineeringRag.activationMode).toBe('absent');

      const ragQuery = {
        domain: 'engineering' as const,
        query: '稳定性',
        authorityReleaseId: null,
        mode: 'production' as const,
      };
      const appliedRagQuery = applyEngineeringRagConsumerActivation(ragQuery, {
        activationSelection: resolveEngineeringRagProductionSelection(),
      });
      expect(appliedRagQuery.activationMode).toBe('absent');
      expect(appliedRagQuery.authorityReleaseId).toBeNull();
      const ragResult = runEngineeringRagQuery({
        query: ragQuery,
        corpus: [
          {
            canonicalId: 'legacy-node',
            label: 'legacy',
            predicates: [],
            relationIds: [],
            authorityReleaseId: 'first-cutover',
          },
        ],
        activationSelection: resolveEngineeringRagProductionSelection(),
      });
      expect(ragResult.metadata.availability).toBe('unavailable');

      const teachingRagQuery = {
        domain: 'teaching-resource' as const,
        query: '稳定性',
        projectionId: 'legacy-projection',
        projectionHash: 'legacy-projection-hash',
        authorityReleaseId: 'legacy-authority',
        scopeId: 'legacy-scope',
        mode: 'production' as const,
      };
      const teachingRag = applyTeachingResourceRagConsumerActivation(
        teachingRagQuery,
        { activationSelection: resolveTeachingResourceRagProductionSelection() },
      );
      expect(teachingRag.activationMode).toBe('absent');
      expect(teachingRag.projectionId).toBe('legacy-projection');
      expect(teachingRag.projectionHash).toBe('legacy-projection-hash');
      expect(teachingRag.authorityReleaseId).toBe('legacy-authority');

      const legacyPathProjection = {
        authorityReleaseId: 'legacy-authority',
        projectionId: 'legacy-projection',
        projectionHash: 'legacy-projection-hash',
        scopeId: 'legacy-scope',
      };
      const learningPath = applyLearningPathConsumerActivation(
        legacyPathProjection,
        { activationSelection: resolveLearningPathProductionSelection() },
      );
      expect(learningPath.activationMode).toBe('absent');
      expect(learningPath.projection).toEqual(legacyPathProjection);
      expect(learningPath.reasons).not.toContain(
        'learning-path-activation-forced-pin',
      );

      const legacyContext = resolveCoursePageLayeredGraphContext({
        scope: buildCoursePackageLayeredScope({
          packageCanonicalId: 'legacy-lesson',
          lessonKey: 'legacy-lesson',
        }),
        authorityPaths,
        projectionPaths: tempProjectionStore(),
        consumerActivationSelection: resolveCourseRuntimeProductionSelection(),
        lessonRuntime: {
          lesson: { lesson_id: 'legacy-lesson' },
          graphOverlay: {
            lesson_id: 'legacy-lesson',
            focus_node_ids: ['legacy-node'],
            card_order: [],
            groups: [],
            nodes: [{ id: 'legacy-node' }],
            links: [],
          },
        } as never,
        allowLegacyFallback: true,
      });
      expect(legacyContext.payload.teachingResources.identity.status).toBe(
        'fallback',
      );
      expect(legacyContext.payload.fallback?.adapterId).toBe(
        'legacy-runtime-projection',
      );
      expect(legacyContext.payload.teachingResources.identity.projectionId).toMatch(
        /^legacy-runtime-graph-overlay:/,
      );
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
