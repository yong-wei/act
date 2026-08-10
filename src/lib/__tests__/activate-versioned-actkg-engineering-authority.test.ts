import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  renameSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  AUTHORITY_SNAPSHOT_CONTRACT,
  AuthoritySnapshotError,
  AuthoritativeKnowledgeRepository,
  activateAuthoritySnapshot,
  activateEngineeringAuthority,
  authorityCanonicalJson,
  authorityDigest,
  emptyTeachingSelectorFingerprint,
  loadStagedAuthoritySnapshot,
  materializeAuthoritySnapshot,
  proveEmptyTeachingProjectionActivation,
  readCurrentAuthorityPointer,
  resolveActiveAuthoritySnapshot,
  resolveAuthorityStorePaths,
  resolveEngineeringGraphAuthority,
  resolveEngineeringRagAuthority,
  rollbackAuthorityPointer,
  authorityStoreFs,
  shouldStageAuthorityAfterDelta,
  stageAuthorityAfterValidatedBundleImport,
  stageAuthoritySnapshot,
  stageAuthoritySnapshotArtifacts,
  stagedSnapshotNormalizedBytes,
  type AuthoritativeKnowledgeSnapshot,
  type AuthorityStorePaths,
  type TeachingSelectorFingerprint,
} from '../authoritative-knowledge';

const hash = 'a'.repeat(64);
const commit = 'b'.repeat(40);

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

function tempAuthorityRoot(): AuthorityStorePaths {
  const root = mkdtempSync(path.join(tmpdir(), 'actkg-authority-'));
  tempRoots.push(root);
  return resolveAuthorityStorePaths(root);
}

function baseSnapshot(overrides: Partial<AuthoritativeKnowledgeSnapshot> = {}): AuthoritativeKnowledgeSnapshot {
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
      id: 'ctr:release:control-theory-engineering-v0.12',
      releaseSetId: 'set-eng-1',
      releaseVersion: 'v0.12',
      releaseStatus: 'RELEASED',
      protocol: 'actkg-public-bundle/1',
      authority: 'ActKG',
      scope: 'engineering',
      contractHash: hash,
      releaseHash: hash,
      schemaRawHash: hash,
      releaseRawHash: hash,
      notesRawHash: hash,
      captureRevision: commit,
      lockRawHash: hash,
      schemaVersion: '0.2.0',
      projectionId: 'proj-runtime-1',
      projectionDigest: 'c'.repeat(64),
      sourceDatasetHash: 'd'.repeat(64),
    },
    receipt: {
      id: 'receipt:eng-1',
      releaseSetId: 'set-eng-1',
      releaseId: 'ctr:release:control-theory-engineering-v0.12',
      sourceRun: null,
      sourceImplementationCommit: null,
      captureRevision: commit,
      lockRawHash: hash,
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
        releaseId: 'ctr:release:control-theory-engineering-v0.12',
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
        releaseId: 'ctr:release:control-theory-engineering-v0.12',
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
        releaseId: 'ctr:release:control-theory-engineering-v0.12',
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
        releaseId: 'ctr:release:control-theory-engineering-v0.12',
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
        releaseId: 'ctr:release:control-theory-engineering-v0.12',
        ordinal: 0,
        publishedEntityId: 'node-a',
        retrievalChunkId: 'chunk-stability-1',
        citationTargetId: 'cite-stability-1',
      },
    ],
    releaseComponents: [
      {
        releaseId: 'ctr:release:control-theory-engineering-v0.12',
        ordinal: 0,
        componentReleaseId: 'ctr:component:core-v0.12',
        releaseVersion: 'v0.12',
        protocol: 'actkg-component/1',
        controlledPath: 'components/core',
        releaseHash: hash,
        releaseRawSha256: hash,
        sha256sumsSha256: hash,
        referenceKind: 'aggregate-member',
        componentRole: 'core',
        componentBundleId: 'bundle-core',
        componentBundleDigest: hash,
        componentManifestSha256: hash,
        payload: { role: 'core' },
      },
    ],
    projectionIdentities: [
      {
        releaseId: 'ctr:release:control-theory-engineering-v0.12',
        projectionId: 'proj-runtime-1',
        ordinal: 0,
        profile: 'runtime',
        projectionProfile: 'runtime',
        versionDigest: 'c'.repeat(64),
        sourceRelease: 'ctr:release:control-theory-engineering-v0.12',
        sourceReleaseHash: hash,
        sourceDatasetHash: 'd'.repeat(64),
        nodeCount: 2,
        linkCount: 1,
        artifactPath: 'projections/runtime.jsonl',
        artifactSha256: hash,
        isRuntime: true,
        bundleReceiptId: null,
      },
    ],
    linkMetadata: [
      {
        releaseId: 'ctr:release:control-theory-engineering-v0.12',
        relationId: 'rel-1',
        ordinal: 0,
        releaseTier: 'core',
        sourceRelease: 'ctr:release:control-theory-engineering-v0.12',
        sourceReleaseHash: hash,
        evidenceRefs: [{ kind: 'predicate', id: 'ev-1' }],
        sourceComponentRelease: 'ctr:component:core-v0.12',
        targetComponentRelease: 'ctr:component:core-v0.12',
        relationComponentRelease: 'ctr:component:core-v0.12',
        profiles: ['runtime'],
        payload: { strength: 1 },
        bundleReceiptId: null,
      },
    ],
    ...overrides,
  };
}

describe('Authority Snapshot materialization (#1266)', () => {
  it('materializes deterministic snapshotHash and identical bytes for identical input', () => {
    const first = materializeAuthoritySnapshot({
      snapshot: baseSnapshot(),
      deltaReceiptIds: ['delta-receipt:aaa', 'delta-receipt:bbb'],
      predecessorReleaseId: 'ctr:release:control-theory-engineering-v0.11',
    });
    const second = materializeAuthoritySnapshot({
      snapshot: baseSnapshot(),
      deltaReceiptIds: ['delta-receipt:bbb', 'delta-receipt:aaa'],
      predecessorReleaseId: 'ctr:release:control-theory-engineering-v0.11',
    });

    expect(first.snapshotHash).toBe(second.snapshotHash);
    expect(first.snapshotId).toBe(second.snapshotId);
    expect(first.manifestBytes).toBe(second.manifestBytes);
    expect(first.engineeringBytes).toBe(second.engineeringBytes);
    expect(first.manifest.contract).toBe(AUTHORITY_SNAPSHOT_CONTRACT);
    expect(first.manifest.objectCount).toBe(2);
    expect(first.manifest.relationCount).toBe(1);
    expect(first.manifest.deltaReceiptIds).toEqual([
      'delta-receipt:aaa',
      'delta-receipt:bbb',
    ]);
    expect(first.engineering.relations[0]?.relationType).toBe('has_formula');
    expect(first.engineering.relations[0]?.sourceId).toBe('node-a');
    expect(first.engineering.relations[0]?.targetId).toBe('node-b');
  });

  it('fails closed on duplicate IDs, missing endpoints, and lossy omission', () => {
    expect(() => materializeAuthoritySnapshot({
      snapshot: baseSnapshot({
        objects: [
          ...baseSnapshot().objects,
          {
            ...baseSnapshot().objects[0]!,
            ordinal: 2,
          },
        ],
      }),
    })).toThrow(AuthoritySnapshotError);

    expect(() => materializeAuthoritySnapshot({
      snapshot: baseSnapshot({
        relations: [
          {
            ...baseSnapshot().relations[0]!,
            targetId: 'missing-node',
          },
        ],
      }),
    })).toThrow(/endpoint missing|missing-endpoint|missing endpoint/i);

    expect(() => materializeAuthoritySnapshot({
      snapshot: baseSnapshot({
        relations: [
          {
            ...baseSnapshot().relations[0]!,
            relationType: '',
          },
        ],
      }),
    })).toThrow(AuthoritySnapshotError);
  });

  it('stages candidate-only without moving current pointer', () => {
    const paths = tempAuthorityRoot();
    const staged = stageAuthoritySnapshot(paths, {
      snapshot: baseSnapshot(),
      deltaReceiptIds: ['delta-receipt:1'],
    });

    expect(staged.reused).toBe(false);
    expect(staged.stageReceipt.status).toBe('staged');
    expect(staged.stageReceipt.selectorsChanged).toBe(0);
    expect(staged.stageReceipt.engineeringAuthorityAdvanced).toBe(false);
    expect(staged.stageReceipt.teachingSelectorsAdvanced).toBe(false);
    expect(readCurrentAuthorityPointer(paths)).toBeNull();

    const again = stageAuthoritySnapshot(paths, {
      snapshot: baseSnapshot(),
      deltaReceiptIds: ['delta-receipt:1'],
    });
    expect(again.reused).toBe(true);
    expect(again.snapshotId).toBe(staged.snapshotId);
    expect(readCurrentAuthorityPointer(paths)).toBeNull();
  });

  it('binds delta receipt chain and reuses snapshot identity for same inputs', () => {
    const paths = tempAuthorityRoot();
    const a = stageAuthoritySnapshot(paths, {
      snapshot: baseSnapshot(),
      deltaReceiptIds: ['delta-receipt:x'],
    });
    const b = stageAuthoritySnapshot(paths, {
      snapshot: baseSnapshot(),
      deltaReceiptIds: ['delta-receipt:x'],
    });
    expect(a.snapshotId).toBe(b.snapshotId);
    expect(a.manifest.deltaReceiptIds).toEqual(['delta-receipt:x']);
    // No teaching review item created — only stage receipt.
    expect(a.stageReceipt.teachingSelectorsAdvanced).toBe(false);
  });

  it('stages a separately validated materialization without reconstructing its source snapshot', () => {
    const sourcePaths = tempAuthorityRoot();
    const materialized = stageAuthoritySnapshot(sourcePaths, {
      snapshot: baseSnapshot(),
      deltaReceiptIds: ['delta-receipt:artifact-stage'],
    });
    const targetPaths = tempAuthorityRoot();

    const staged = stageAuthoritySnapshotArtifacts(targetPaths, {
      manifest: materialized.manifest,
      engineering: materialized.engineering,
    });

    expect(staged.snapshotId).toBe(materialized.snapshotId);
    expect(staged.snapshotHash).toBe(materialized.snapshotHash);
    expect(staged.stageReceipt.reasons).toContain('staged-from-validated-artifacts');
    expect(readCurrentAuthorityPointer(targetPaths)).toBeNull();
  });
});

describe('Authority activation and rollback (#1266)', () => {
  it('activates only through explicit transaction with distinct receipts', () => {
    const paths = tempAuthorityRoot();
    const teaching: TeachingSelectorFingerprint = {
      courseSelector: 'legacy-course-v1',
      kaqSelector: 'legacy-kaq-v1',
      pathSelector: 'legacy-path-v1',
      teachingResourceRagSelector: 'legacy-teaching-rag-v1',
      legacySelector: 'legacy-active',
    };

    const staged = stageAuthoritySnapshot(paths, { snapshot: baseSnapshot() });
    expect(resolveActiveAuthoritySnapshot(paths).status).toBe('unavailable');

    const activation = activateAuthoritySnapshot(paths, {
      snapshotId: staged.snapshotId,
      teachingSelectors: teaching,
      activationReceiptId: 'activation-test-1',
    });

    expect(activation.status).toBe('activated');
    expect(activation.receipt.contract).toContain('activation-receipt');
    expect(activation.receipt.engineeringConsumersAdvanced).toEqual([
      'engineering-graph',
      'engineering-rag',
    ]);
    expect(activation.receipt.teachingSelectorsAdvanced).toBe(false);
    expect(activation.receipt.teachingProjectionRequired).toBe(false);
    expect(activation.receipt.courseCoverageRequired).toBe(false);
    expect(activation.receipt.teachingSelectorFingerprintBefore).toEqual(teaching);
    expect(activation.receipt.teachingSelectorFingerprintAfter).toEqual(teaching);
    expect(activation.pointer?.snapshotId).toBe(staged.snapshotId);

    const pointer = readCurrentAuthorityPointer(paths);
    expect(pointer?.snapshotHash).toBe(staged.snapshotHash);
    expect(existsSync(path.join(paths.activationsDir, 'activation-test-1.json'))).toBe(true);
    expect(staged.stageReceipt.receiptId).not.toBe(activation.receipt.receiptId);
  });

  it('fails closed on missing/mismatched activation target and leaves prior pointer unchanged', () => {
    const paths = tempAuthorityRoot();
    const staged = stageAuthoritySnapshot(paths, { snapshot: baseSnapshot() });
    const first = activateAuthoritySnapshot(paths, {
      snapshotId: staged.snapshotId,
      activationReceiptId: 'activation-ok',
    });
    expect(first.status).toBe('activated');
    const before = readCurrentAuthorityPointer(paths);

    const failed = activateAuthoritySnapshot(paths, {
      snapshotId: 'snap-missing-does-not-exist',
      activationReceiptId: 'activation-fail',
    });
    expect(failed.status).toBe('failed');
    expect(failed.receipt.reasons.join(' ')).toMatch(/incomplete|missing/i);
    expect(readCurrentAuthorityPointer(paths)).toEqual(before);

    // Corrupt staged engineering digest after staging another candidate-like dir
    // is not reachable without writing; simulate pointer mismatch by writing a
    // bad pointer and verifying resolve fails closed without candidate fallback.
    writeFileSync(
      paths.currentPointer,
      `${JSON.stringify({
        contract: 'actkg-engineering-authority-current/v1',
        snapshotId: staged.snapshotId,
        snapshotHash: 'f'.repeat(64),
        releaseId: staged.manifest.releaseId,
        releaseSetId: staged.manifest.releaseSetId,
        activationReceiptId: 'bad',
        activatedAt: new Date().toISOString(),
      }, null, 2)}\n`,
    );
    const resolved = resolveActiveAuthoritySnapshot(paths);
    expect(resolved.status).toBe('unavailable');
    if (resolved.status === 'unavailable') {
      expect(resolved.reason).toBe('active-pointer-unavailable');
    }
  });

  it('never exposes a partial snapshot during interrupted stage write', () => {
    const paths = tempAuthorityRoot();
    const snapshotId = 'snap-partial-test';
    const releasePath = path.join(paths.releasesDir, snapshotId);
    mkdirSync(releasePath, { recursive: true });
    // Only engineering.json written (partial) — load must fail closed.
    writeFileSync(path.join(releasePath, 'engineering.json'), '{}\n');
    expect(() => loadStagedAuthoritySnapshot(paths, snapshotId)).toThrow();
    const active = resolveActiveAuthoritySnapshot(paths);
    expect(active.status).toBe('unavailable');
  });

  it('supports digest-checked one-pointer rollback preserving prior snapshot', () => {
    const paths = tempAuthorityRoot();
    const first = stageAuthoritySnapshot(paths, { snapshot: baseSnapshot() });
    activateAuthoritySnapshot(paths, { snapshotId: first.snapshotId });

    const secondSnapshot = baseSnapshot({
      objects: [
        ...baseSnapshot().objects,
        {
          releaseId: 'ctr:release:control-theory-engineering-v0.12',
          canonicalId: 'node-c',
          ordinal: 2,
          canonicalType: 'SystemModel',
          semanticName: 'Plant',
          reviewStatus: 'approved',
          publicationStatus: 'published',
          lifecycleStatus: 'active',
          payload: { model: 'Nomoto' },
        },
      ],
      receipt: {
        ...baseSnapshot().receipt!,
        objectCount: 3,
      },
    });
    const second = stageAuthoritySnapshot(paths, { snapshot: secondSnapshot });
    expect(second.snapshotId).not.toBe(first.snapshotId);
    activateAuthoritySnapshot(paths, { snapshotId: second.snapshotId });
    expect(readCurrentAuthorityPointer(paths)?.snapshotId).toBe(second.snapshotId);

    const rollback = rollbackAuthorityPointer(paths, {
      toSnapshotId: first.snapshotId,
      toSnapshotHash: first.snapshotHash,
    });
    expect(rollback.status).toBe('rolled-back');
    expect(rollback.receipt.priorSnapshotPreserved).toBe(true);
    expect(readCurrentAuthorityPointer(paths)?.snapshotId).toBe(first.snapshotId);

    // Prior (second) snapshot directory remains loadable.
    const preserved = loadStagedAuthoritySnapshot(paths, second.snapshotId);
    expect(preserved.snapshotHash).toBe(second.snapshotHash);
    expect(preserved.engineering.objects).toHaveLength(3);

    const badRollback = rollbackAuthorityPointer(paths, {
      toSnapshotId: first.snapshotId,
      toSnapshotHash: 'e'.repeat(64),
    });
    expect(badRollback.status).toBe('failed');
    expect(readCurrentAuthorityPointer(paths)?.snapshotId).toBe(first.snapshotId);
  });
});

describe('Engineering consumers and Repository active resolution (#1266)', () => {
  it('resolves Engineering Graph/RAG via active pointer with empty teaching projection', () => {
    const paths = tempAuthorityRoot();
    const teaching = emptyTeachingSelectorFingerprint();
    const proof = proveEmptyTeachingProjectionActivation({
      paths,
      repositorySnapshot: baseSnapshot(),
      teachingSelectors: teaching,
      deltaReceiptIds: ['delta-receipt:packaging-only'],
    });

    expect(proof.activation.status).toBe('activated');
    expect(proof.teachingSelectorsUnchanged).toBe(true);
    expect(proof.engineeringGraph.status).toBe('ready');
    expect(proof.engineeringRag.status).toBe('ready');
    expect(proof.engineeringGraph.objectCount).toBe(2);
    expect(proof.engineeringGraph.relationCount).toBe(1);
    expect(proof.engineeringGraph.teachingProjectionRequired).toBe(false);
    expect(proof.activation.receipt.teachingSelectorsAdvanced).toBe(false);
  });

  it('Repository active selector returns snapshot objects only from current pointer', async () => {
    const paths = tempAuthorityRoot();
    const repository = new AuthoritativeKnowledgeRepository(
      { $transaction: async () => {
        throw new Error('active path must not query database');
      } } as never,
      { authorityStorePaths: paths },
    );

    await expect(repository.read({ authorityState: 'active' })).resolves.toMatchObject({
      status: 'unavailable',
      reason: 'active-pointer-unavailable',
    });

    const staged = stageAuthoritySnapshot(paths, { snapshot: baseSnapshot() });
    // Staged only — still unavailable for active.
    await expect(repository.read({ authorityState: 'active' })).resolves.toMatchObject({
      status: 'unavailable',
      reason: 'active-pointer-unavailable',
    });

    activateEngineeringAuthority(paths, { snapshotId: staged.snapshotId });
    const active = await repository.read({ authorityState: 'active' });
    expect(active.status).toBe('available');
    if (active.status === 'available') {
      expect(active.selector.authorityState).toBe('active');
      expect(active.snapshot.authorityState).toBe('active');
      expect(active.snapshot.productionAuthoritative).toBe(false);
      expect(active.snapshot.objects.map((row) => row.canonicalId).sort()).toEqual([
        'node-a',
        'node-b',
      ]);
      expect(active.snapshot.relations[0]?.relationType).toBe('has_formula');
    }
  });

  it('successful activation advances only engineering consumers', () => {
    const paths = tempAuthorityRoot();
    const teaching: TeachingSelectorFingerprint = {
      courseSelector: 'course-pin-1',
      kaqSelector: 'kaq-pin-1',
      pathSelector: 'path-pin-1',
      teachingResourceRagSelector: 'teaching-rag-pin-1',
      legacySelector: 'legacy-pin-1',
    };
    const staged = stageAuthoritySnapshot(paths, { snapshot: baseSnapshot() });
    const activation = activateEngineeringAuthority(paths, {
      snapshotId: staged.snapshotId,
      teachingSelectors: teaching,
    });
    expect(activation.status).toBe('activated');
    expect(activation.receipt.engineeringConsumersAdvanced).toEqual([
      'engineering-graph',
      'engineering-rag',
    ]);
    expect(activation.receipt.teachingSelectorsAdvanced).toBe(false);
    expect(activation.receipt.teachingSelectorFingerprintAfter).toEqual(teaching);

    expect(resolveEngineeringGraphAuthority(paths).status).toBe('ready');
    expect(resolveEngineeringRagAuthority(paths).status).toBe('ready');
  });

  it('capture-drift and schema drift fail closed before activation', () => {
    const paths = tempAuthorityRoot();
    const staged = stageAuthoritySnapshot(paths, { snapshot: baseSnapshot() });
    const manifestPath = path.join(paths.releasesDir, staged.snapshotId, 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
    manifest.snapshotHash = '0'.repeat(64);
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const activation = activateAuthoritySnapshot(paths, {
      snapshotId: staged.snapshotId,
    });
    expect(activation.status).toBe('failed');
    expect(readCurrentAuthorityPointer(paths)).toBeNull();
  });

  it('normalized bytes are stable across stage loads', () => {
    const paths = tempAuthorityRoot();
    const staged = stageAuthoritySnapshot(paths, {
      snapshot: baseSnapshot(),
      deltaReceiptIds: ['delta-receipt:stable'],
    });
    const loaded = loadStagedAuthoritySnapshot(paths, staged.snapshotId);
    const bytesA = stagedSnapshotNormalizedBytes(loaded);
    const bytesB = stagedSnapshotNormalizedBytes(
      loadStagedAuthoritySnapshot(paths, staged.snapshotId),
    );
    expect(bytesA).toBe(bytesB);
    expect(authorityDigest(JSON.parse(authorityCanonicalJson({
      x: 1,
      a: 2,
    })))).toBe(authorityDigest({ a: 2, x: 1 }));
  });
});

describe('Codex review remediation (#1279)', () => {
  it('P1-1: post-import helper stages snapshot without activating pointer', () => {
    const paths = tempAuthorityRoot();
    const staged = stageAuthorityAfterValidatedBundleImport({
      paths,
      repositorySnapshot: baseSnapshot(),
      deltaReceiptIds: ['delta-receipt:post-import'],
      captureRevision: commit,
    });

    expect(staged.snapshotId).toMatch(/^snap-[a-f0-9]{64}$/);
    expect(existsSync(path.join(paths.releasesDir, staged.snapshotId, 'manifest.json'))).toBe(true);
    expect(existsSync(path.join(paths.releasesDir, staged.snapshotId, 'engineering.json'))).toBe(true);
    expect(readCurrentAuthorityPointer(paths)).toBeNull();
    expect(staged.stageReceipt.engineeringAuthorityAdvanced).toBe(false);
    expect(staged.manifest.deltaReceiptIds).toEqual(['delta-receipt:post-import']);
    expect(resolveActiveAuthoritySnapshot(paths).status).toBe('unavailable');
  });

  it('P1-1: import script wires the post-import staging helper', () => {
    const scriptPath = path.resolve(
      process.cwd(),
      'scripts/db/import-compatible-actkg-public-bundle.ts',
    );
    const source = readFileSync(scriptPath, 'utf8');
    expect(source).toMatch(/stageAuthorityAfterValidatedBundleImport/);
    expect(source).toMatch(/authorityStage/);
    // Import path must stage only; activation remains a separate transaction.
    expect(source).not.toMatch(/activateAuthoritySnapshot|activateEngineeringAuthority/);
  });

  it('P1-2: full engineering semantic sets survive stage → load active round-trip', () => {
    const paths = tempAuthorityRoot();
    const staged = stageAuthoritySnapshot(paths, { snapshot: baseSnapshot() });
    expect(staged.engineering.upstreamRagReferences).toHaveLength(1);
    expect(staged.engineering.linkMetadata).toHaveLength(1);
    expect(staged.engineering.releaseEntries).toHaveLength(1);
    expect(staged.engineering.releaseComponents).toHaveLength(1);
    expect(staged.engineering.projectionIdentities).toHaveLength(1);
    expect(staged.manifest.provenance.upstreamRagReferenceCount).toBe(1);
    expect(staged.manifest.provenance.linkMetadataCount).toBe(1);
    expect(staged.manifest.provenance.releaseEntryCount).toBe(1);
    expect(staged.manifest.provenance.releaseComponentCount).toBe(1);
    expect(staged.manifest.provenance.projectionIdentityCount).toBe(1);

    activateAuthoritySnapshot(paths, { snapshotId: staged.snapshotId });
    const active = resolveActiveAuthoritySnapshot(paths);
    expect(active.status).toBe('available');
    if (active.status !== 'available') return;

    expect(active.snapshot.engineering.upstreamRagReferences[0]).toMatchObject({
      publishedEntityId: 'node-a',
      retrievalChunkId: 'chunk-stability-1',
      citationTargetId: 'cite-stability-1',
    });
    expect(active.snapshot.engineering.linkMetadata[0]).toMatchObject({
      relationId: 'rel-1',
      evidenceRefs: [{ kind: 'predicate', id: 'ev-1' }],
    });
    expect(active.snapshot.engineering.releaseEntries[0]?.entityId).toBe('node-a');
    expect(active.snapshot.engineering.releaseComponents[0]?.componentReleaseId)
      .toBe('ctr:component:core-v0.12');
    expect(active.snapshot.engineering.projectionIdentities[0]?.projectionId)
      .toBe('proj-runtime-1');

    // Repository active view must re-surface the same semantic sets.
    const repository = new AuthoritativeKnowledgeRepository(
      { $transaction: async () => {
        throw new Error('active path must not query database');
      } } as never,
      { authorityStorePaths: paths },
    );
    return repository.read({ authorityState: 'active' }).then((result) => {
      expect(result.status).toBe('available');
      if (result.status !== 'available') return;
      expect(result.snapshot.upstreamRagReferences?.[0]?.retrievalChunkId)
        .toBe('chunk-stability-1');
      expect(result.snapshot.linkMetadata?.[0]?.relationId).toBe('rel-1');
      expect(result.snapshot.releaseEntries?.[0]?.entityId).toBe('node-a');
      expect(result.snapshot.releaseComponents?.[0]?.componentReleaseId)
        .toBe('ctr:component:core-v0.12');
      expect(result.snapshot.projectionIdentities?.[0]?.isRuntime).toBe(true);
    });
  });

  it('P1-3: capture revision mismatch fails closed before staging', () => {
    expect(() => materializeAuthoritySnapshot({
      snapshot: baseSnapshot({
        receipt: {
          ...baseSnapshot().receipt!,
          captureRevision: 'c'.repeat(40),
        },
      }),
      captureRevision: commit,
    })).toThrow(/capture revision|capture-revision/i);

    expect(() => materializeAuthoritySnapshot({
      snapshot: baseSnapshot({
        release: {
          ...baseSnapshot().release!,
          captureRevision: 'd'.repeat(40),
        },
      }),
    })).toThrow(/capture revision|capture-revision/i);

    // Caller override must not silently win over a differing receipt revision.
    expect(() => stageAuthoritySnapshot(tempAuthorityRoot(), {
      snapshot: baseSnapshot(),
      captureRevision: 'e'.repeat(40),
    })).toThrow(/capture revision|capture-revision/i);
  });

  it('P1-4: restores prior pointer when activation receipt write fails', () => {
    const paths = tempAuthorityRoot();
    const first = stageAuthoritySnapshot(paths, { snapshot: baseSnapshot() });
    const activated = activateAuthoritySnapshot(paths, {
      snapshotId: first.snapshotId,
      activationReceiptId: 'activation-prior',
    });
    expect(activated.status).toBe('activated');
    const prior = readCurrentAuthorityPointer(paths);

    const secondSnapshot = baseSnapshot({
      objects: [
        ...baseSnapshot().objects,
        {
          releaseId: 'ctr:release:control-theory-engineering-v0.12',
          canonicalId: 'node-receipt-fail',
          ordinal: 2,
          canonicalType: 'DomainConcept',
          semanticName: 'Receipt fail',
          reviewStatus: 'approved',
          publicationStatus: 'published',
          lifecycleStatus: 'active',
          payload: {},
        },
      ],
      receipt: {
        ...baseSnapshot().receipt!,
        objectCount: 3,
      },
    });
    const second = stageAuthoritySnapshot(paths, { snapshot: secondSnapshot });

    // Occupy the receipt destination so atomic rename after pointer write fails.
    const activationReceiptId = 'activation-should-fail';
    mkdirSync(path.join(paths.activationsDir, `${activationReceiptId}.json`), {
      recursive: true,
    });

    const failed = activateAuthoritySnapshot(paths, {
      snapshotId: second.snapshotId,
      activationReceiptId,
    });
    expect(failed.status).toBe('failed');
    expect(failed.receipt.reasons.join(' ')).toMatch(/receipt-write-failed|pointer-restored/i);
    expect(readCurrentAuthorityPointer(paths)).toEqual(prior);
  });

  it('P1-4: restores prior pointer when rollback receipt write fails', () => {
    const paths = tempAuthorityRoot();
    const first = stageAuthoritySnapshot(paths, { snapshot: baseSnapshot() });
    activateAuthoritySnapshot(paths, { snapshotId: first.snapshotId });

    const secondSnapshot = baseSnapshot({
      objects: [
        ...baseSnapshot().objects,
        {
          releaseId: 'ctr:release:control-theory-engineering-v0.12',
          canonicalId: 'node-rb',
          ordinal: 2,
          canonicalType: 'DomainConcept',
          semanticName: 'Rollback',
          reviewStatus: 'approved',
          publicationStatus: 'published',
          lifecycleStatus: 'active',
          payload: {},
        },
      ],
      receipt: {
        ...baseSnapshot().receipt!,
        objectCount: 3,
      },
    });
    const second = stageAuthoritySnapshot(paths, { snapshot: secondSnapshot });
    activateAuthoritySnapshot(paths, { snapshotId: second.snapshotId });
    expect(readCurrentAuthorityPointer(paths)?.snapshotId).toBe(second.snapshotId);

    // Preserve uses `${id}-from.json`; final receipt uses `${id}.json`. Occupy
    // only the final receipt path so pointer write can succeed then fail closed.
    const rollbackReceiptId = 'rollback-should-fail';
    mkdirSync(path.join(paths.rollbacksDir, `${rollbackReceiptId}.json`), {
      recursive: true,
    });

    const failed = rollbackAuthorityPointer(paths, {
      toSnapshotId: first.snapshotId,
      toSnapshotHash: first.snapshotHash,
      rollbackReceiptId,
    });
    expect(failed.status).toBe('failed');
    expect(failed.receipt.reasons.join(' ')).toMatch(/receipt-write-failed|pointer-restored/i);
    expect(readCurrentAuthorityPointer(paths)?.snapshotId).toBe(second.snapshotId);
  });

  it('P2-1: published snapshot manifests stay immutable after activation', () => {
    const paths = tempAuthorityRoot();
    const first = stageAuthoritySnapshot(paths, { snapshot: baseSnapshot() });
    const firstManifestPath = path.join(paths.releasesDir, first.snapshotId, 'manifest.json');
    const firstManifestBefore = readFileSync(firstManifestPath, 'utf8');
    activateAuthoritySnapshot(paths, { snapshotId: first.snapshotId });

    const secondSnapshot = baseSnapshot({
      objects: [
        ...baseSnapshot().objects,
        {
          releaseId: 'ctr:release:control-theory-engineering-v0.12',
          canonicalId: 'node-immutable',
          ordinal: 2,
          canonicalType: 'DomainConcept',
          semanticName: 'Immutable',
          reviewStatus: 'approved',
          publicationStatus: 'published',
          lifecycleStatus: 'active',
          payload: {},
        },
      ],
      receipt: {
        ...baseSnapshot().receipt!,
        objectCount: 3,
      },
    });
    const second = stageAuthoritySnapshot(paths, { snapshot: secondSnapshot });
    const secondManifestPath = path.join(paths.releasesDir, second.snapshotId, 'manifest.json');
    const secondManifestBefore = readFileSync(secondManifestPath, 'utf8');
    activateAuthoritySnapshot(paths, { snapshotId: second.snapshotId });

    expect(readFileSync(firstManifestPath, 'utf8')).toBe(firstManifestBefore);
    expect(readFileSync(secondManifestPath, 'utf8')).toBe(secondManifestBefore);
    expect(JSON.parse(firstManifestBefore).lifecycle).toBe('staged');
    expect(JSON.parse(secondManifestBefore).lifecycle).toBe('staged');
    // Active vs superseded is derived from the pointer, not rewritten manifests.
    expect(readCurrentAuthorityPointer(paths)?.snapshotId).toBe(second.snapshotId);
    expect(loadStagedAuthoritySnapshot(paths, first.snapshotId).manifest.lifecycle).toBe('staged');
  });

  it('P2-2: concurrent stage rename conflict reuses identical published snapshot', () => {
    const paths = tempAuthorityRoot();
    const input = { snapshot: baseSnapshot(), deltaReceiptIds: ['delta-receipt:race'] as const };
    const first = stageAuthoritySnapshot(paths, input);
    const releasePath = path.join(paths.releasesDir, first.snapshotId);
    const parked = `${releasePath}.parked`;
    renameSync(releasePath, parked);

    const originalRename = authorityStoreFs.renameSync;
    authorityStoreFs.renameSync = ((from: string, to: string) => {
      // Simulate another process publishing the same snapshotId first.
      if (
        path.resolve(to) === path.resolve(releasePath)
        && String(from).includes('.staging-')
        && existsSync(parked)
      ) {
        originalRename(parked, releasePath);
      }
      return originalRename(from, to);
    }) as typeof authorityStoreFs.renameSync;

    try {
      const concurrent = stageAuthoritySnapshot(paths, input);
      expect(concurrent.reused).toBe(true);
      expect(concurrent.snapshotId).toBe(first.snapshotId);
      expect(concurrent.snapshotHash).toBe(first.snapshotHash);
      expect(readCurrentAuthorityPointer(paths)).toBeNull();
    } finally {
      authorityStoreFs.renameSync = originalRename;
      if (existsSync(parked)) {
        try {
          renameSync(parked, releasePath);
        } catch {
          rmSync(parked, { recursive: true, force: true });
        }
      }
    }
  });

  it('P2-2: concurrent rename conflict with mismatched content fails closed', () => {
    const paths = tempAuthorityRoot();
    const first = stageAuthoritySnapshot(paths, { snapshot: baseSnapshot() });
    const releasePath = path.join(paths.releasesDir, first.snapshotId);
    const parked = `${releasePath}.parked-mismatch`;
    renameSync(releasePath, parked);

    // Corrupt the parked published snapshot so digest no longer matches.
    const engineeringPath = path.join(parked, 'engineering.json');
    const engineering = JSON.parse(readFileSync(engineeringPath, 'utf8')) as {
      objects: Array<{ canonicalId: string }>;
    };
    engineering.objects[0]!.canonicalId = 'tampered-node';
    writeFileSync(engineeringPath, `${JSON.stringify(engineering, null, 2)}\n`);

    const originalRename = authorityStoreFs.renameSync;
    authorityStoreFs.renameSync = ((from: string, to: string) => {
      if (
        path.resolve(to) === path.resolve(releasePath)
        && String(from).includes('.staging-')
        && existsSync(parked)
      ) {
        originalRename(parked, releasePath);
      }
      return originalRename(from, to);
    }) as typeof authorityStoreFs.renameSync;

    try {
      // Mismatched published content must fail closed (digest/count/endpoint).
      expect(() => stageAuthoritySnapshot(paths, { snapshot: baseSnapshot() })).toThrow(
        AuthoritySnapshotError,
      );
      expect(readCurrentAuthorityPointer(paths)).toBeNull();
    } finally {
      authorityStoreFs.renameSync = originalRename;
      if (existsSync(parked)) {
        rmSync(parked, { recursive: true, force: true });
      }
    }
  });

  it('fails closed when current pointer lacks a matching activation receipt', () => {
    const paths = tempAuthorityRoot();
    const staged = stageAuthoritySnapshot(paths, { snapshot: baseSnapshot() });
    // Forge a pointer without writing an activation receipt.
    writeFileSync(
      paths.currentPointer,
      `${JSON.stringify({
        contract: 'actkg-engineering-authority-current/v1',
        snapshotId: staged.snapshotId,
        snapshotHash: staged.snapshotHash,
        releaseId: staged.manifest.releaseId,
        releaseSetId: staged.manifest.releaseSetId,
        activationReceiptId: 'activation-missing-receipt',
        activatedAt: new Date().toISOString(),
      }, null, 2)}\n`,
    );
    const resolved = resolveActiveAuthoritySnapshot(paths);
    expect(resolved.status).toBe('unavailable');
    if (resolved.status === 'unavailable') {
      expect(resolved.detail).toMatch(/no matching activation\/rollback receipt/);
    }
  });

  it('does not replace the pointer when activation receipt write fails first', () => {
    const paths = tempAuthorityRoot();
    const staged = stageAuthoritySnapshot(paths, { snapshot: baseSnapshot() });
    // Inject write failure via FS seam (works even when process is root).
    // Track temp paths opened under activations/ and fail only those writes.
    const openPathByFd = new Map<number, string>();
    const originalOpenSync = authorityStoreFs.openSync;
    const originalWriteSync = authorityStoreFs.writeSync;
    const originalCloseSync = authorityStoreFs.closeSync;
    authorityStoreFs.openSync = ((filePath: string, flags: string) => {
      const fd = originalOpenSync(filePath, flags);
      openPathByFd.set(fd, filePath);
      return fd;
    }) as typeof authorityStoreFs.openSync;
    authorityStoreFs.writeSync = ((
      fd: number,
      buffer: string | NodeJS.ArrayBufferView,
      offset?: number,
      encoding?: BufferEncoding,
    ) => {
      const opened = openPathByFd.get(fd) ?? '';
      if (opened.includes(`${path.sep}activations${path.sep}`) && opened.endsWith('.tmp')) {
        throw Object.assign(new Error('ENOSPC simulated activation receipt'), {
          code: 'ENOSPC',
        });
      }
      return (originalWriteSync as (
        fd: number,
        buffer: string | NodeJS.ArrayBufferView,
        offset?: number,
        encoding?: BufferEncoding,
      ) => number)(fd, buffer, offset, encoding);
    }) as typeof authorityStoreFs.writeSync;
    authorityStoreFs.closeSync = ((fd: number) => {
      openPathByFd.delete(fd);
      return originalCloseSync(fd);
    }) as typeof authorityStoreFs.closeSync;
    try {
      const result = activateAuthoritySnapshot(paths, { snapshotId: staged.snapshotId });
      expect(result.status).toBe('failed');
      expect(result.receipt.reasons.some((r) => r.includes('activation-receipt-write-failed'))).toBe(true);
      expect(result.receipt.reasons).toContain('prior-pointer-untouched');
      expect(readCurrentAuthorityPointer(paths)).toBeNull();
    } finally {
      authorityStoreFs.openSync = originalOpenSync;
      authorityStoreFs.writeSync = originalWriteSync;
      authorityStoreFs.closeSync = originalCloseSync;
    }
  });

  it('stages after validated import only when Delta authorization is ACCEPTED', () => {
    // Gate used by the real import script: rejected Delta must not stage.
    expect(shouldStageAuthorityAfterDelta('ACCEPTED')).toBe(true);
    expect(shouldStageAuthorityAfterDelta('REJECTED_UPSTREAM')).toBe(false);
    expect(shouldStageAuthorityAfterDelta('REJECTED_IDENTITY')).toBe(false);

    const paths = tempAuthorityRoot();
    if (shouldStageAuthorityAfterDelta('REJECTED_UPSTREAM')) {
      stageAuthorityAfterValidatedBundleImport({
        paths,
        repositorySnapshot: baseSnapshot(),
        deltaReceiptIds: ['delta-rejected'],
      });
    }
    expect(readCurrentAuthorityPointer(paths)).toBeNull();
    expect(existsSync(paths.releasesDir) ? readdirSync(paths.releasesDir) : []).toEqual([]);
  });
});
