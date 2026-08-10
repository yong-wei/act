import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  ACCEPTED_CANDIDATE_STATE,
  AggregateProjectionContractError,
  AuthoritativeKnowledgeProjectionService,
  AuthoritativeKnowledgeRepository,
  AuthoritativeProjectionCache,
  buildCanvasProjection,
  buildMigrationReviewProjection,
  buildNodeDetailProjection,
  buildProjectionCacheKey,
  consumerSupportDigest,
  CANDIDATE_RELEASE_LABEL,
  CTKG_0_2_AGGREGATE_PROTOCOL,
  CTKG_0_2_SCHEMA_VERSION,
  CURRENT_AGGREGATE_RELEASE_ID,
  CURRENT_AGGREGATE_RELEASE_SET_ID,
  HISTORICAL_ROOT_LOCUS_RELEASE_SET_ID,
  LATEST_ACCEPTED_BUNDLE_RECEIPT_ORDER_BY,
  STANDARD_PUBLIC_BUNDLE_PROTOCOL,
  type AuthoritativeKnowledgeDatabase,
  type AuthoritativeKnowledgeSnapshot,
  type ConsumerSemanticSupport,
} from '../authoritative-knowledge';

const hash = 'a'.repeat(64);
const commit = 'b'.repeat(40);
const selector = {
  authorityState: 'candidate' as const,
  releaseSetId: 'set-1',
  releaseId: 'release-1',
};
const support: ConsumerSemanticSupport = {
  consumerId: 'preview',
  supportedObjectTypes: ['DomainConcept'],
  supportedPredicates: ['prerequisite_of'],
};

function fixture(): AuthoritativeKnowledgeSnapshot {
  return {
    authorityState: 'candidate',
    productionAuthoritative: false,
    historical: true,
    releaseSet: {
      id: 'set-1',
      controlledPath: 'course-content/authoring/knowledge/releases/release-set.lock.json',
      lockVersion: 'actkg-release-set-lock/v1',
      candidateState: 'CANDIDATE',
    },
    release: {
      id: 'release-1',
      releaseSetId: 'set-1',
      releaseVersion: 'v0.1',
      releaseStatus: 'RELEASED',
      protocol: 'protocol',
      authority: 'ActKG',
      scope: 'root-locus',
      contractHash: hash,
      releaseHash: hash,
      schemaRawHash: hash,
      releaseRawHash: hash,
      notesRawHash: hash,
      captureRevision: commit,
      lockRawHash: hash,
    },
    receipt: {
      id: 'receipt-1',
      releaseSetId: 'set-1',
      releaseId: 'release-1',
      sourceRun: 'run-private',
      sourceImplementationCommit: commit,
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
      sourceMappingCount: 1,
      goldRelationCount: 1,
      silverRelationCount: 0,
      sourceObjectCount: 1,
      evidenceSegmentCount: 1,
      candidateState: 'CANDIDATE',
      importedAt: new Date('2026-07-27T00:00:00.000Z'),
    },
    objects: [
      {
        releaseId: 'release-1',
        canonicalId: 'node-b',
        ordinal: 1,
        canonicalType: 'FutureSchemaType',
        semanticName: 'Generic type',
        reviewStatus: 'REVIEWED',
        publicationStatus: 'PUBLISHED',
        lifecycleStatus: 'ACTIVE',
        payload: {
          aliases: ['generic alias'],
          description: 'generic description',
          preferred_labels: [{ language: 'en', text: 'Generic label' }],
          evidence_segment_ids: [],
          controlledPath: '/must/not/leak',
        },
      },
      {
        releaseId: 'release-1',
        canonicalId: 'node-a',
        ordinal: 0,
        canonicalType: 'DomainConcept',
        semanticName: 'root_locus',
        reviewStatus: 'REVIEWED',
        publicationStatus: 'PUBLISHED',
        lifecycleStatus: 'ACTIVE',
        payload: {
          aliases: ['根轨迹'],
          concept_kind: 'engineering',
          description: '根轨迹描述',
          preferred_labels: [{ language: 'zh-CN', text: '根轨迹' }],
          evidence_segment_ids: ['evidence-1'],
          sourceRun: 'must-not-leak',
        },
      },
    ],
    relations: [{
      releaseId: 'release-1',
      relationId: 'relation-1',
      ordinal: 0,
      qualityTier: 'GOLD',
      sourceId: 'node-a',
      targetId: 'node-b',
      relationType: 'prerequisite_of',
      reviewStatus: 'REVIEWED',
      publicationStatus: 'PUBLISHED',
      direct: true,
      payload: { direction: null, evidence_segment_ids: ['evidence-1'] },
    }],
    sourceMappings: [{
      releaseId: 'release-1',
      mappingId: 'mapping-1',
      ordinal: 0,
      sourceObjectId: 'source-1',
      canonicalId: 'node-a',
      mappingType: 'EXACT',
      reviewStatus: 'REVIEWED',
      payload: { private: 'mapping payload' },
    }],
    sourceObjects: [{
      releaseId: 'release-1',
      sourceObjectId: 'source-1',
      ordinal: 0,
      sourceId: 'book',
      sectionId: 'section',
      nodeType: 'concept',
      reviewStatus: 'REVIEWED',
      payload: { machinePath: '/private/source' },
    }],
    evidence: [{
      releaseId: 'release-1',
      evidenceId: 'evidence-1',
      ordinal: 0,
      sourceEditionId: 'edition',
      sectionId: 'section',
      segmentOrdinal: 3,
      segmentType: 'paragraph',
      contentHash: hash,
      payload: { locator: '/private/evidence' },
    }],
  };
}

function mockDatabase(snapshot: AuthoritativeKnowledgeSnapshot, options: {
  /** Multiple accepted packaging receipts for latest-evidence selection tests. */
  acceptedBundleReceipts?: NonNullable<AuthoritativeKnowledgeSnapshot['bundleReceipt']>[];
} = {}): {
  database: AuthoritativeKnowledgeDatabase;
  transaction: ReturnType<typeof vi.fn>;
  legacyDelegates: Record<string, { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> }>;
  actkgBundleReceiptFindFirst: ReturnType<typeof vi.fn>;
} {
  const one = (value: unknown) => ({
    findUnique: vi.fn(async () => value),
    findFirst: vi.fn(async () => value),
    findMany: vi.fn(),
  });
  const many = (value: unknown[]) => ({
    findUnique: vi.fn(),
    findFirst: vi.fn(async () => value[0] ?? null),
    findMany: vi.fn(async () => value),
  });
  const legacyDelegates = {
    actkgAuthoritativeObject: many([...snapshot.objects].reverse()),
    actkgAuthoritativeRelation: many([...snapshot.relations].reverse()),
    actkgSourceMapping: many([...snapshot.sourceMappings].reverse()),
    actkgSourceObject: many([...snapshot.sourceObjects].reverse()),
    actkgEvidenceSegment: many([...snapshot.evidence].reverse()),
  };
  const acceptedBundleReceipts = options.acceptedBundleReceipts
    ?? (snapshot.bundleReceipt ? [snapshot.bundleReceipt] : []);
  const selectLatestBundleReceipt = (
    orderBy: ReadonlyArray<{ importedAt?: 'asc' | 'desc'; id?: 'asc' | 'desc' }> | undefined,
  ) => {
    if (acceptedBundleReceipts.length === 0) return null;
    const sorted = [...acceptedBundleReceipts].sort((left, right) => {
      for (const clause of orderBy ?? []) {
        if (clause.importedAt) {
          const delta = left.importedAt.getTime() - right.importedAt.getTime();
          if (delta !== 0) return clause.importedAt === 'desc' ? -delta : delta;
        }
        if (clause.id) {
          const cmp = left.id.localeCompare(right.id);
          if (cmp !== 0) return clause.id === 'desc' ? -cmp : cmp;
        }
      }
      return 0;
    });
    return sorted[0] ?? null;
  };
  const actkgBundleReceiptFindFirst = vi.fn(async (args?: {
    orderBy?: ReadonlyArray<{ importedAt?: 'asc' | 'desc'; id?: 'asc' | 'desc' }>;
  }) => selectLatestBundleReceipt(args?.orderBy));
  const selectedReceipt = selectLatestBundleReceipt(LATEST_ACCEPTED_BUNDLE_RECEIPT_ORDER_BY);
  const artifactsForSelected = selectedReceipt && snapshot.bundleArtifacts
    ? snapshot.bundleArtifacts.map((row) => ({
        ...row,
        bundleReceiptId: selectedReceipt.id,
      }))
    : (snapshot.bundleArtifacts ?? []);
  const tx = {
    actkgReleaseSet: one(snapshot.releaseSet),
    actkgRelease: one(snapshot.release),
    actkgImportReceipt: one(snapshot.receipt),
    ...legacyDelegates,
    actkgReleaseArtifact: many([...(snapshot.releaseArtifacts ?? [])].reverse()),
    actkgReleaseComponent: many([...(snapshot.releaseComponents ?? [])].reverse()),
    actkgReleaseEntry: many([...(snapshot.releaseEntries ?? [])].reverse()),
    actkgProjectionNode: many([...(snapshot.projectionNodes ?? [])].reverse()),
    actkgProjectionLink: many([...(snapshot.projectionLinks ?? [])].reverse()),
    actkgUpstreamRagReference: many([...(snapshot.upstreamRagReferences ?? [])].reverse()),
    actkgBundleReceipt: {
      findUnique: vi.fn(async () => selectedReceipt),
      findFirst: actkgBundleReceiptFindFirst,
      findMany: vi.fn(async () => acceptedBundleReceipts),
    },
    actkgBundleArtifact: many([...artifactsForSelected].reverse()),
    actkgProjectionIdentity: many([...(snapshot.projectionIdentities ?? [])].reverse()),
    actkgProjectionLinkMetadata: many([...(snapshot.linkMetadata ?? [])].reverse()),
  };
  const transaction = vi.fn(async (callback, options) => {
    expect(options).toEqual({ isolationLevel: 'RepeatableRead' });
    return callback(tx);
  });
  return {
    database: { $transaction: transaction },
    transaction,
    legacyDelegates,
    actkgBundleReceiptFindFirst,
  };
}

describe('AuthoritativeKnowledgeRepository', () => {
  it('reads one exact candidate from one repeatable-read database snapshot', async () => {
    const { database, transaction } = mockDatabase(fixture());
    const result = await new AuthoritativeKnowledgeRepository(database).read(selector);

    expect(result.status).toBe('available');
    expect(transaction).toHaveBeenCalledTimes(1);
    if (result.status === 'available') {
      expect(result.snapshot.objects.map((row) => row.canonicalId)).toEqual(['node-a', 'node-b']);
      expect(result.snapshot.productionAuthoritative).toBe(false);
    }
  });

  it('never queries candidate tables for active or legacy selectors', async () => {
    const { database, transaction } = mockDatabase(fixture());
    const repository = new AuthoritativeKnowledgeRepository(database);

    await expect(repository.read({ authorityState: 'active' })).resolves.toMatchObject({
      status: 'unavailable',
      reason: 'active-pointer-unavailable',
    });
    await expect(repository.read({ authorityState: 'legacy' })).resolves.toMatchObject({
      status: 'unavailable',
      reason: 'legacy-outside-repository',
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('returns unavailable for absent rows and drift for receipt/hash mismatches', async () => {
    const missing = mockDatabase(fixture());
    missing.database = {
      $transaction: vi.fn(async (callback) => callback({
        actkgReleaseSet: { findUnique: vi.fn(async () => null), findMany: vi.fn() },
        actkgRelease: { findUnique: vi.fn(async () => null), findMany: vi.fn() },
      } as never)),
    };
    await expect(new AuthoritativeKnowledgeRepository(missing.database).read(selector))
      .resolves.toMatchObject({ status: 'unavailable', reason: 'candidate-not-found' });

    const drifted = fixture();
    drifted.receipt = { ...drifted.receipt!, objectCount: 99, lockRawHash: 'c'.repeat(64) };
    drifted.release = { ...drifted.release, releaseHash: 'invalid' };
    const result = await new AuthoritativeKnowledgeRepository(mockDatabase(drifted).database).read(selector);
    expect(result.status).toBe('drift');
    if (result.status === 'drift') {
      expect(result.diagnostics.map((item) => item.code)).toEqual(expect.arrayContaining([
        'receipt-count-mismatch',
        'lock-hash-mismatch',
        'hash-invalid',
      ]));
    }
  });
});

describe('bounded authoritative projections', () => {
  it('keeps valid unsupported semantics generic and read-only on canvas', () => {
    const projection = buildCanvasProjection(fixture(), support);
    expect(projection.source.productionAuthoritative).toBe(false);
    expect(projection).toMatchObject({
      projectionVersion: 'act.canvas.v2',
      release: { label: '根轨迹局部发布版', version: 'v0.1', scope: 'root-locus' },
      coverage: {
        status: 'partial',
        objectCount: 2,
        relationCount: 1,
        goldRelationCount: 1,
        silverRelationCount: 0,
      },
      teachingSemantics: {
        status: 'unavailable',
        message: '教学关系尚未发布',
      },
    });
    expect(projection.nodes[0]).toMatchObject({
      id: 'node-b',
      canonicalType: 'FutureSchemaType',
      semanticSupport: { supported: false, readOnly: true },
    });
    expect(projection.relations[0]).toMatchObject({
      predicate: 'prerequisite_of',
      direction: null,
      qualityTier: 'GOLD',
      semanticSupport: { supported: true, readOnly: true },
    });
  });

  it('enforces student, teacher, and administrator detail boundaries', () => {
    const snapshot = fixture();
    const student = buildNodeDetailProjection(snapshot, 'STUDENT', 'node-a', support)!;
    const teacher = buildNodeDetailProjection(snapshot, 'TEACHER', 'node-a', support)!;
    const admin = buildNodeDetailProjection(snapshot, 'ADMIN', 'node-a', support)!;

    expect(student.role).toBe('STUDENT');
    expect(student.node).toEqual(expect.objectContaining({
      label: '根轨迹',
      description: '根轨迹描述',
      sources: [{ sourceEditionId: 'edition', sectionId: 'section' }],
    }));
    expect(student.node.adjacency[0]).toMatchObject({
      relationId: 'relation-1',
      qualityTier: 'GOLD',
    });
    expect(JSON.stringify(student)).not.toMatch(/"(aliases|payload|controlledPath|sourceRun|contentHash)":/);
    expect(teacher.role).toBe('TEACHER');
    expect(teacher.node).toEqual(expect.objectContaining({
      aliases: ['根轨迹'],
      teachingFields: { concept_kind: 'engineering' },
      coverage: { sourceMappingCount: 1, evidenceCount: 1 },
      governanceTier: 'CORE',
    }));
    expect(JSON.stringify(teacher)).not.toMatch(/"(payload|controlledPath|sourceRun|contentHash)":/);
    expect(admin.role).toBe('ADMIN');
    if (admin.role === 'ADMIN') {
      expect(admin.activeConsumerRebinding).toBe('not-started');
    }
    expect(JSON.stringify(admin)).toMatch(/controlledPath|sourceRun|contentHash|payload/);
    expect(() => buildNodeDetailProjection(
      snapshot,
      'SUPERUSER' as never,
      'node-a',
      support,
    )).toThrow(/Unsupported authoritative knowledge role/);
  });

  it('searches Canonical objects without Legacy mapping and returns bounded provenance-preserving neighbors', async () => {
    const snapshot = fixture();
    const repository = new AuthoritativeKnowledgeRepository(mockDatabase(snapshot).database);
    const service = new AuthoritativeKnowledgeProjectionService(repository);

    const search = await service.canonicalSearch(selector, 'STUDENT', '根轨迹', support, {
      limit: 5,
      governance: 'CORE',
    });
    expect(search).toMatchObject({
      status: 'available',
      projection: {
        source: {
          authorityState: 'candidate',
          releaseSetId: 'set-1',
          releaseId: 'release-1',
        },
        results: [{ id: 'node-a', canonicalType: 'DomainConcept' }],
      },
    });
    expect(JSON.stringify(search)).not.toMatch(/legacyId|KnowledgeNode|sourceMapping/);

    const neighbors = await service.boundedNeighbors(selector, 'STUDENT', 'node-a', support, {
      limit: 1,
    });
    expect(neighbors).toMatchObject({
      status: 'available',
      projection: {
        source: { releaseSetId: 'set-1', releaseId: 'release-1' },
        limit: 1,
        truncated: false,
        neighbors: [{
          predicate: 'prerequisite_of',
          direction: null,
          qualityTier: 'GOLD',
          traversal: 'outgoing',
          neighbor: { id: 'node-b' },
          readOnly: true,
        }],
      },
    });
  });

  it('produces an administrator-only, read-only migration review', async () => {
    const snapshot = fixture();
    const projection = buildMigrationReviewProjection(snapshot, []);
    expect(projection).toMatchObject({
      role: 'ADMIN',
      legacyArchive: 'not-ready',
      activeConsumerRebinding: 'not-started',
      readOnly: true,
      ingest: { actualCounts: { objects: 2 } },
    });

    const repository = new AuthoritativeKnowledgeRepository(mockDatabase(snapshot).database);
    const service = new AuthoritativeKnowledgeProjectionService(repository);
    await expect(service.migrationReview(selector, 'STUDENT', support)).resolves.toMatchObject({
      status: 'unavailable',
      reason: 'role-forbidden',
    });
  });
});

describe('projection cache and Legacy isolation', () => {
  it('does not cache drifted canvas or node detail projections while preserving admin audit access', async () => {
    const drifted = fixture();
    drifted.receipt = { ...drifted.receipt!, objectCount: 99 };
    const cache = new AuthoritativeProjectionCache();
    const repository = new AuthoritativeKnowledgeRepository(mockDatabase(drifted).database);
    const service = new AuthoritativeKnowledgeProjectionService(repository, cache);

    await expect(service.canvas(selector, support)).resolves.toMatchObject({
      status: 'drift',
      diagnostics: [{ code: 'receipt-count-mismatch' }],
    });
    await expect(service.nodeDetail(selector, 'ADMIN', 'node-a', support)).resolves.toMatchObject({
      status: 'drift',
      diagnostics: [{ code: 'receipt-count-mismatch' }],
    });
    expect(cache.size()).toBe(0);

    await expect(service.migrationReview(selector, 'ADMIN', support)).resolves.toMatchObject({
      status: 'available',
      projection: {
        role: 'ADMIN',
        ingest: {
          drift: [{ code: 'receipt-count-mismatch' }],
        },
      },
    });
    expect(cache.size()).toBe(1);
  });

  it('isolates state, role, node, projection version, and semantic support', () => {
    const base = {
      projectionVersion: 'act.node-detail.v2',
      authorityState: 'candidate' as const,
      releaseSetId: 'set-1',
      releaseId: 'release-1',
      role: 'STUDENT' as const,
      nodeId: 'node-a',
      support,
    };
    const keys = [
      buildProjectionCacheKey(base),
      buildProjectionCacheKey({ ...base, authorityState: 'active' }),
      buildProjectionCacheKey({ ...base, role: 'TEACHER' }),
      buildProjectionCacheKey({ ...base, nodeId: 'node-b' }),
      buildProjectionCacheKey({ ...base, projectionVersion: 'act.canvas.v2' }),
      buildProjectionCacheKey({
        ...base,
        support: { ...support, supportedObjectTypes: ['Formula'] },
      }),
    ];
    expect(new Set(keys).size).toBe(keys.length);

    const cache = new AuthoritativeProjectionCache({ maxSize: 2 });
    cache.set(keys[0], 'candidate-student');
    cache.set(keys[1], 'active-student');
    expect(cache.get(keys[0])).toBe('candidate-student');
    expect(cache.get(keys[1])).toBe('active-student');
  });

  it('keeps existing knowledge sources and APIs independent from the new repository', () => {
    const files = [
      'src/lib/knowledge-graph-source.ts',
      'src/app/api/knowledge/graph/route.ts',
      'src/app/api/knowledge/nodes/route.ts',
      'src/app/api/knowledge/nodes/[id]/route.ts',
    ];
    for (const file of files) {
      const source = readFileSync(path.join(process.cwd(), file), 'utf8');
      expect(source).not.toMatch(/authoritative-knowledge|AuthoritativeKnowledgeRepository/);
    }
    const repositorySource = readFileSync(
      path.join(process.cwd(), 'src/lib/authoritative-knowledge/repository.ts'),
      'utf8',
    );
    expect(repositorySource).not.toMatch(/node:fs|Release-file|KnowledgeNode|KnowledgeLink/);
  });
});

const aggregateDigest = 'f324255fd77cf5bf3bacf4cc55a7a082faca3339fff2b8410ddca37a00226255';
const aggregateDatasetHash = 'd'.repeat(64);
const aggregateSelector = {
  authorityState: 'candidate' as const,
  releaseSetId: CURRENT_AGGREGATE_RELEASE_SET_ID,
  releaseId: CURRENT_AGGREGATE_RELEASE_ID,
};

function aggregateFixture(): AuthoritativeKnowledgeSnapshot {
  const releaseId = CURRENT_AGGREGATE_RELEASE_ID;
  return {
    authorityState: 'candidate',
    productionAuthoritative: false,
    historical: false,
    releaseSet: {
      id: CURRENT_AGGREGATE_RELEASE_SET_ID,
      controlledPath: 'course-content/authoring/knowledge/releases/release-set.lock.json',
      lockVersion: 'actkg-release-set-lock/v2',
      candidateState: 'CANDIDATE',
    },
    release: {
      id: releaseId,
      releaseSetId: CURRENT_AGGREGATE_RELEASE_SET_ID,
      releaseVersion: 'v0.2',
      releaseStatus: 'RELEASED',
      protocol: CTKG_0_2_AGGREGATE_PROTOCOL,
      authority: 'ActKG',
      scope: 'control-theory-engineering',
      contractHash: hash,
      releaseHash: hash,
      schemaRawHash: hash,
      releaseRawHash: hash,
      notesRawHash: hash,
      captureRevision: commit,
      lockRawHash: hash,
      schemaVersion: CTKG_0_2_SCHEMA_VERSION,
      upstreamReleaseId: 'ctr:release:control-theory-engineering-v0.2',
      projectionId: 'ctr:projection:control-theory-engineering-v0.2:domain-v2',
      projectionDigest: aggregateDigest,
      sourceDatasetHash: aggregateDatasetHash,
      upstreamPublicationCommit: '7ab6041201f3c23963a8ddb2685256a5418ad532',
      upstreamClosedCommit: 'f5f442e99324af731e0b5226a22b0973e838621b',
    },
    receipt: {
      id: 'receipt-aggregate',
      releaseSetId: CURRENT_AGGREGATE_RELEASE_SET_ID,
      releaseId,
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
      objectCount: 0,
      sourceMappingCount: 0,
      goldRelationCount: 0,
      silverRelationCount: 0,
      sourceObjectCount: 0,
      evidenceSegmentCount: 0,
      candidateState: 'CANDIDATE',
      importedAt: new Date('2026-07-28T00:00:00.000Z'),
      schemaVersion: CTKG_0_2_SCHEMA_VERSION,
      upstreamReleaseId: 'ctr:release:control-theory-engineering-v0.2',
      projectionId: 'ctr:projection:control-theory-engineering-v0.2:domain-v2',
      projectionDigest: aggregateDigest,
      sourceDatasetHash: aggregateDatasetHash,
      upstreamPublicationCommit: '7ab6041201f3c23963a8ddb2685256a5418ad532',
      upstreamClosedCommit: 'f5f442e99324af731e0b5226a22b0973e838621b',
      releaseEntryCount: 5,
      projectionNodeCount: 3,
      projectionLinkCount: 2,
      upstreamRagReferenceCount: 1,
      artifactCount: 1,
      componentCount: 2,
    },
    objects: [],
    relations: [],
    sourceMappings: [],
    sourceObjects: [],
    evidence: [],
    releaseEntries: [
      { releaseId, entityId: 'ctc:concept-a', ordinal: 0, releaseTier: 'gold', entityRole: 'knowledge_object', inclusionReason: 'Retained canonical v14P knowledge object.', payload: {} },
      { releaseId, entityId: 'ctk:formula-b', ordinal: 1, releaseTier: 'silver', entityRole: 'knowledge_object', inclusionReason: 'Governed silver member of the system-modeling release.', payload: {} },
      { releaseId, entityId: 'ctm:model-c', ordinal: 2, releaseTier: 'silver', entityRole: 'knowledge_object', inclusionReason: 'Governed silver member of the system-modeling release.', payload: {} },
      { releaseId, entityId: 'ctr:rel-1', ordinal: 3, releaseTier: 'gold', entityRole: 'relation', inclusionReason: 'Retained gold v14P relation.', payload: {} },
      { releaseId, entityId: 'ctr:rel-2', ordinal: 4, releaseTier: 'silver', entityRole: 'relation', inclusionReason: 'Retained silver v14P relation.', payload: {} },
    ],
    projectionNodes: [
      {
        releaseId,
        nodeId: 'ctc:concept-a',
        ordinal: 0,
        entityId: 'ctc:concept-a',
        entityType: 'DomainConcept',
        displayName: '根轨迹',
        releaseTier: 'gold',
        reviewStatus: 'approved',
        publicationStatus: 'published',
        semanticName: 'root_locus',
        sourceCoverageCount: 2,
        candidate: false,
        payload: {
          description: '根轨迹描述',
          concept_kind: 'analysis_method',
          evidence_refs: ['ctr:ev-1'],
          private: 'must-not-leak-to-student',
        },
      },
      {
        releaseId,
        nodeId: 'ctk:formula-b',
        ordinal: 1,
        entityId: 'ctk:formula-b',
        entityType: 'Formula',
        displayName: '特征方程',
        releaseTier: 'silver',
        reviewStatus: 'approved',
        publicationStatus: 'published',
        semanticName: 'characteristic_equation',
        sourceCoverageCount: 1,
        candidate: false,
        payload: {
          description: '特征方程描述',
          formula_latex: '1+G(s)H(s)=0',
          formula_role: 'characteristic_equation',
        },
      },
      {
        releaseId,
        nodeId: 'ctm:model-c',
        ordinal: 2,
        entityId: 'ctm:model-c',
        entityType: 'SystemModel',
        displayName: '闭环模型',
        releaseTier: 'silver',
        reviewStatus: 'approved',
        publicationStatus: 'published',
        semanticName: 'closed_loop_model',
        sourceCoverageCount: 0,
        candidate: false,
        payload: { description: null },
      },
    ],
    projectionLinks: [
      {
        releaseId,
        linkId: 'link-1',
        ordinal: 0,
        relationId: 'ctr:rel-1',
        sourceId: 'ctc:concept-a',
        targetId: 'ctk:formula-b',
        relationType: 'association',
        relationFamily: 'domain_semantic',
        direction: 'unordered',
        evidenceState: 'available',
        payload: {},
      },
      {
        releaseId,
        linkId: 'link-2',
        ordinal: 1,
        relationId: 'ctr:rel-2',
        sourceId: 'ctk:formula-b',
        targetId: 'ctm:model-c',
        relationType: 'used_to_analyze',
        relationFamily: 'domain_semantic',
        direction: 'source_to_target',
        evidenceState: 'available',
        payload: {},
      },
    ],
    upstreamRagReferences: [{
      releaseId,
      ordinal: 0,
      publishedEntityId: 'ctc:concept-a',
      retrievalChunkId: 'chunk-1',
      citationTargetId: 'citation-1',
    }],
    releaseArtifacts: [{
      releaseId,
      relativePath: 'control-theory-engineering-v0.2.release.json',
      ordinal: 0,
      mediaType: 'application/json',
      sha256: hash,
      byteLength: 128,
    }],
    releaseComponents: [
      {
        releaseId,
        ordinal: 0,
        componentReleaseId: 'ctr:root-locus-engineering-v0.1',
        releaseVersion: 'v0.1',
        protocol: 'ctkg-m1c-v14p-root-locus-engineering-release-v1',
        controlledPath: 'course-content/authoring/knowledge/releases/root-locus-engineering-v0.1',
        releaseHash: hash,
        releaseRawSha256: hash,
        sha256sumsSha256: hash,
        payload: {},
      },
      {
        releaseId,
        ordinal: 1,
        componentReleaseId: 'ctr:system-modeling-engineering-v0.1',
        releaseVersion: 'v0.1',
        protocol: 'ctkg-0.2-release',
        controlledPath: 'course-content/authoring/knowledge/releases/system-modeling-engineering-v0.1',
        releaseHash: hash,
        releaseRawSha256: hash,
        sha256sumsSha256: hash,
        payload: {},
      },
    ],
  };
}

describe('aggregate CTKG 0.2 candidate Repository', () => {
  it('binds runtime constants to the ingestion adapter constants', async () => {
    const adapter = await import('../../../scripts/actkg-release/ctkg-0-2-aggregate-release');
    expect(CURRENT_AGGREGATE_RELEASE_SET_ID).toBe(adapter.AGGREGATE_RELEASE_SET_ID);
    expect(CURRENT_AGGREGATE_RELEASE_ID).toBe(adapter.AGGREGATE_RELEASE_ID);
    expect(CTKG_0_2_AGGREGATE_PROTOCOL).toBe(adapter.AGGREGATE_PROTOCOL);
    expect(CTKG_0_2_SCHEMA_VERSION).toBe(adapter.CTKG_0_2_SCHEMA_VERSION);
    expect(HISTORICAL_ROOT_LOCUS_RELEASE_SET_ID).toBe('actkg-authoritative-candidate-v1');
  });

  it('reads the aggregate snapshot only from aggregate tables and never from legacy tables', async () => {
    const { database, transaction, legacyDelegates } = mockDatabase(aggregateFixture());
    const result = await new AuthoritativeKnowledgeRepository(database).read(aggregateSelector);

    expect(result.status).toBe('available');
    expect(transaction).toHaveBeenCalledTimes(1);
    if (result.status !== 'available') return;
    expect(result.snapshot.historical).toBe(false);
    expect(result.snapshot.projectionNodes?.map((row) => row.nodeId)).toEqual([
      'ctc:concept-a',
      'ctk:formula-b',
      'ctm:model-c',
    ]);
    expect(result.snapshot.projectionLinks).toHaveLength(2);
    expect(result.snapshot.releaseEntries).toHaveLength(5);
    expect(result.snapshot.releaseComponents?.map((row) => row.componentReleaseId)).toEqual([
      'ctr:root-locus-engineering-v0.1',
      'ctr:system-modeling-engineering-v0.1',
    ]);
    expect(result.snapshot.releaseArtifacts?.[0]).not.toHaveProperty('bytes');
    expect(result.snapshot.objects).toEqual([]);
    expect(result.snapshot.relations).toEqual([]);
    for (const delegate of Object.values(legacyDelegates)) {
      expect(delegate.findMany).not.toHaveBeenCalled();
      expect(delegate.findUnique).not.toHaveBeenCalled();
    }
  });

  it('marks every non-aggregate ReleaseSet as historical', async () => {
    const result = await new AuthoritativeKnowledgeRepository(
      mockDatabase(fixture()).database,
    ).read(selector);
    expect(result.status).toBe('available');
    if (result.status === 'available') {
      expect(result.snapshot.historical).toBe(true);
    }
  });

  it('fails closed on aggregate receipt count, digest, and schema-version drift', async () => {
    const drifted = aggregateFixture();
    drifted.receipt = {
      ...drifted.receipt!,
      projectionNodeCount: 99,
      projectionDigest: 'e'.repeat(64),
    };
    drifted.release = { ...drifted.release, schemaVersion: '0.3.0' };
    const result = await new AuthoritativeKnowledgeRepository(
      mockDatabase(drifted).database,
    ).read(aggregateSelector);
    expect(result.status).toBe('drift');
    if (result.status === 'drift') {
      expect(result.diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'receipt-count-mismatch', field: 'receipt.projectionNodeCount' }),
        expect.objectContaining({ code: 'receipt-identity-mismatch', field: 'receipt.projectionDigest' }),
        expect.objectContaining({ code: 'release-identity-mismatch', field: 'release.schemaVersion' }),
      ]));
    }
  });

  it('builds the aggregate canvas with exact V2 types, tiers, directions, families, and evidence state', () => {
    const projection = buildCanvasProjection(aggregateFixture(), support);
    expect(projection).toMatchObject({
      projectionVersion: 'act.canvas.v2',
      release: {
        label: CANDIDATE_RELEASE_LABEL,
        version: 'v0.2',
        scope: 'control-theory-engineering',
      },
      source: {
        releaseSetId: CURRENT_AGGREGATE_RELEASE_SET_ID,
        releaseId: CURRENT_AGGREGATE_RELEASE_ID,
        historical: false,
        schemaVersion: CTKG_0_2_SCHEMA_VERSION,
        projectionDigest: aggregateDigest,
        sourceDatasetHash: aggregateDatasetHash,
        productionAuthoritative: false,
      },
      coverage: {
        objectCount: 3,
        relationCount: 2,
        goldRelationCount: 1,
        silverRelationCount: 1,
        releaseEntryCount: 5,
        goldNodeCount: 1,
        silverNodeCount: 2,
        upstreamRagReferenceCount: 1,
      },
      teachingSemantics: { status: 'unavailable', message: '教学关系尚未发布' },
    });
    expect(projection.fields.included).toContain('relation.direction');
    expect(projection.fields.hidden).toContain('artifact.bytes');
    expect(projection.nodes[0]).toMatchObject({
      id: 'ctc:concept-a',
      canonicalType: 'DomainConcept',
      label: '根轨迹',
      description: '根轨迹描述',
      releaseTier: 'gold',
      candidate: false,
      sourceCoverageCount: 2,
      conceptKind: 'analysis_method',
    });
    expect(projection.relations[0]).toMatchObject({
      id: 'link-1',
      predicate: 'association',
      direction: 'unordered',
      relationFamily: 'domain_semantic',
      evidenceState: 'available',
      qualityTier: 'GOLD',
      releaseTier: 'gold',
    });
    expect(projection.relations[1]).toMatchObject({
      predicate: 'used_to_analyze',
      direction: 'source_to_target',
      qualityTier: 'SILVER',
      releaseTier: 'silver',
    });
    expect(JSON.stringify(projection)).not.toContain('must-not-leak-to-student');
  });

  it('enforces V2 node detail role boundaries with aggregate provenance', () => {
    const snapshot = aggregateFixture();
    const student = buildNodeDetailProjection(snapshot, 'STUDENT', 'ctc:concept-a', support)!;
    expect(student.role).toBe('STUDENT');
    expect(student.node).toMatchObject({
      id: 'ctc:concept-a',
      canonicalType: 'DomainConcept',
      releaseTier: 'gold',
      sources: [],
    });
    expect(student.node.adjacency[0]).toMatchObject({
      relationId: 'ctr:rel-1',
      predicate: 'association',
      direction: 'unordered',
      relationFamily: 'domain_semantic',
      evidenceState: 'available',
      qualityTier: 'GOLD',
      traversal: 'outgoing',
      neighborId: 'ctk:formula-b',
    });
    // fields.hidden 仅声明字段名，不含字段值；泄漏守卫按属性键形态匹配真实泄漏
    expect(JSON.stringify(student)).not.toMatch(/"upstreamRagReferences":|must-not-leak-to-student|"payload":/);

    const teacher = buildNodeDetailProjection(snapshot, 'TEACHER', 'ctc:concept-a', support)!;
    expect(teacher.role).toBe('TEACHER');
    if (teacher.role !== 'STUDENT') {
      expect(teacher.node).toMatchObject({
        governanceTier: 'CORE',
        teachingFields: { concept_kind: 'analysis_method' },
        coverage: { sourceCoverageCount: 2, upstreamRagReferenceCount: 1 },
        upstreamRagReferences: [{ retrievalChunkId: 'chunk-1', citationTargetId: 'citation-1' }],
      });
      expect(JSON.stringify(teacher)).not.toContain('must-not-leak-to-student');
    }

    const admin = buildNodeDetailProjection(snapshot, 'ADMIN', 'ctc:concept-a', support)!;
    expect(admin.role).toBe('ADMIN');
    if (admin.role === 'ADMIN') {
      expect(admin.receipt).toMatchObject({
        sourceRun: null,
        projectionDigest: aggregateDigest,
        projectionId: 'ctr:projection:control-theory-engineering-v0.2:domain-v2',
      });
      expect(admin.node.sourceMappings).toEqual([]);
      expect(admin.node.evidence).toEqual([]);
      expect(JSON.stringify(admin)).toContain('must-not-leak-to-student');
    }
  });

  it('fails closed instead of repairing direction, predicate, family, evidence, tier, or endpoint conflicts', () => {
    const corrupt = (mutate: (snapshot: AuthoritativeKnowledgeSnapshot) => void) => {
      const snapshot = aggregateFixture();
      mutate(snapshot);
      return snapshot;
    };
    expect(() => buildCanvasProjection(corrupt((snapshot) => {
      snapshot.projectionLinks![0].direction = 'target_to_source';
    }), support)).toThrow(AggregateProjectionContractError);
    expect(() => buildCanvasProjection(corrupt((snapshot) => {
      snapshot.projectionLinks![0].direction = 'target_to_source';
    }), support)).toThrow(/unregistered direction/);
    expect(() => buildCanvasProjection(corrupt((snapshot) => {
      snapshot.projectionLinks![0].relationType = 'prerequisite_of';
    }), support)).toThrow(/unregistered relation_type/);
    expect(() => buildCanvasProjection(corrupt((snapshot) => {
      snapshot.projectionLinks![0].relationFamily = 'teaching_prerequisite';
    }), support)).toThrow(/unregistered relation_family/);
    expect(() => buildCanvasProjection(corrupt((snapshot) => {
      snapshot.projectionLinks![0].evidenceState = 'hidden';
    }), support)).toThrow(/unregistered evidence_state/);
    expect(() => buildCanvasProjection(corrupt((snapshot) => {
      snapshot.projectionLinks![0].targetId = 'ctc:not-in-projection';
    }), support)).toThrow(/endpoint outside the projection node set/);
    expect(() => buildCanvasProjection(corrupt((snapshot) => {
      snapshot.projectionNodes![0].releaseTier = 'platinum';
    }), support)).toThrow(/unregistered release_tier/);
    expect(() => buildCanvasProjection(corrupt((snapshot) => {
      snapshot.projectionNodes![0].entityType = 'TeachingHint';
    }), support)).toThrow(/unregistered entity_type/);
    expect(() => buildNodeDetailProjection(corrupt((snapshot) => {
      snapshot.projectionLinks![0].direction = 'repaired_at_runtime';
    }), 'STUDENT', 'ctc:concept-a', support)).toThrow(/unregistered direction/);
    // 字段各自合法但组合违反固定九谓词合同时同样失败关闭：
    // association 必须 unordered，其余谓词必须 source_to_target，
    // 全部 relation_family 必须 domain_semantic，合同表之外谓词不得出现。
    expect(() => buildCanvasProjection(corrupt((snapshot) => {
      snapshot.projectionLinks![0].direction = 'source_to_target';
    }), support)).toThrow(/predicate combination .* outside the pinned contract/u);
    expect(() => buildCanvasProjection(corrupt((snapshot) => {
      snapshot.projectionLinks![1].relationFamily = 'course_sequence';
    }), support)).toThrow(/predicate combination .* outside the pinned contract/u);
    expect(() => buildCanvasProjection(corrupt((snapshot) => {
      snapshot.projectionLinks![0].relationType = 'contains';
      snapshot.projectionLinks![0].direction = 'source_to_target';
    }), support)).toThrow(/predicate combination .* outside the pinned contract/u);
  });

  it('reports aggregate ingest counts and stale shadow outputs in migration review', () => {
    const projection = buildMigrationReviewProjection(aggregateFixture(), []);
    expect(projection).toMatchObject({
      role: 'ADMIN',
      historical: false,
      ingest: {
        expectedCounts: {
          releaseEntries: 5,
          projectionNodes: 3,
          projectionLinks: 2,
          upstreamRagReferences: 1,
          artifacts: 1,
          components: 2,
        },
        actualCounts: {
          releaseEntries: 5,
          projectionNodes: 3,
          projectionLinks: 2,
          upstreamRagReferences: 1,
          artifacts: 1,
          components: 2,
        },
      },
      legacyArchive: 'not-ready',
      activeConsumerRebinding: 'not-started',
      readOnly: true,
    });
    expect(projection.staleShadowOutputs).toEqual(
      ['inventory', 'crosswalk', 'candidate', 'decision', 'binding'].map((output) => ({
        output,
        boundReleaseSetId: HISTORICAL_ROOT_LOCUS_RELEASE_SET_ID,
        disposition: 'stale',
        currentReleaseSetId: CURRENT_AGGREGATE_RELEASE_SET_ID,
      })),
    );

    const historicalReview = buildMigrationReviewProjection(fixture(), []);
    expect(historicalReview.historical).toBe(true);
    expect(historicalReview.ingest.expectedCounts).toMatchObject({ objects: 2 });
  });

  it('searches aggregate nodes by tier and returns provenance-preserving bounded neighbors', async () => {
    const repository = new AuthoritativeKnowledgeRepository(
      mockDatabase(aggregateFixture()).database,
    );
    const service = new AuthoritativeKnowledgeProjectionService(repository);

    const search = await service.canonicalSearch(aggregateSelector, 'TEACHER', '根轨迹', support, {
      governance: 'CORE',
    });
    expect(search).toMatchObject({
      status: 'available',
      projection: {
        source: {
          releaseSetId: CURRENT_AGGREGATE_RELEASE_SET_ID,
          releaseId: CURRENT_AGGREGATE_RELEASE_ID,
          historical: false,
        },
        results: [{
          id: 'ctc:concept-a',
          canonicalType: 'DomainConcept',
          governanceTier: 'CORE',
          releaseTier: 'gold',
        }],
      },
    });

    const neighbors = await service.boundedNeighbors(
      aggregateSelector,
      'STUDENT',
      'ctk:formula-b',
      support,
    );
    expect(neighbors).toMatchObject({
      status: 'available',
      projection: {
        neighbors: [
          {
            predicate: 'association',
            direction: 'unordered',
            relationFamily: 'domain_semantic',
            evidenceState: 'available',
            qualityTier: 'GOLD',
            traversal: 'incoming',
            neighbor: { id: 'ctc:concept-a', canonicalType: 'DomainConcept' },
          },
          {
            predicate: 'used_to_analyze',
            direction: 'source_to_target',
            qualityTier: 'SILVER',
            traversal: 'outgoing',
            neighbor: { id: 'ctm:model-c', canonicalType: 'SystemModel' },
          },
        ],
      },
    });

    const missing = await service.boundedNeighbors(
      aggregateSelector,
      'STUDENT',
      'ctc:not-in-projection',
      support,
    );
    expect(missing).toMatchObject({ status: 'unavailable', reason: 'node-not-found' });
  });

  it('binds cache keys to the projection digest', () => {
    const base = {
      projectionVersion: 'act.canvas.v2',
      authorityState: 'candidate' as const,
      releaseSetId: CURRENT_AGGREGATE_RELEASE_SET_ID,
      releaseId: CURRENT_AGGREGATE_RELEASE_ID,
      role: 'NONE' as const,
      support,
    };
    const keys = new Set([
      buildProjectionCacheKey(base),
      buildProjectionCacheKey({ ...base, projectionDigest: aggregateDigest }),
      buildProjectionCacheKey({ ...base, projectionDigest: 'f'.repeat(64) }),
    ]);
    expect(keys.size).toBe(3);
  });

  it('binds cache keys to release hash and source dataset hash provenance', () => {
    const base = {
      projectionVersion: 'act.canvas.v2',
      authorityState: 'candidate' as const,
      releaseSetId: CURRENT_AGGREGATE_RELEASE_SET_ID,
      releaseId: CURRENT_AGGREGATE_RELEASE_ID,
      projectionDigest: aggregateDigest,
      role: 'NONE' as const,
      support,
    };
    const keys = new Set([
      buildProjectionCacheKey(base),
      buildProjectionCacheKey({ ...base, releaseHash: 'a'.repeat(64) }),
      buildProjectionCacheKey({ ...base, releaseHash: 'b'.repeat(64) }),
      buildProjectionCacheKey({
        ...base,
        releaseHash: 'a'.repeat(64),
        sourceDatasetHash: aggregateDatasetHash,
      }),
      buildProjectionCacheKey({
        ...base,
        releaseHash: 'a'.repeat(64),
        sourceDatasetHash: 'e'.repeat(64),
      }),
    ]);
    expect(keys.size).toBe(5);
  });
});

const standardReleaseSetId = 'actkg-authoritative-candidate-v3-r2';
const standardReleaseId = 'ctr:release:control-theory-engineering-v0.3';
const standardDigest = '3c76c97476178342aa1111111111111111111111111111111111111111111111';
const standardSelector = {
  authorityState: 'candidate' as const,
  releaseSetId: standardReleaseSetId,
  releaseId: standardReleaseId,
};

function standardFixture(options: {
  counts?: { nodes: number; links: number; entries: number };
  unregistered?: boolean;
  missingBundleReceipt?: boolean;
} = {}): AuthoritativeKnowledgeSnapshot {
  const nodeCount = options.counts?.nodes ?? 2;
  const linkCount = options.counts?.links ?? 1;
  const entryCount = options.counts?.entries ?? nodeCount + linkCount;
  const releaseId = standardReleaseId;
  const projectionNodes = Array.from({ length: nodeCount }, (_, ordinal) => ({
    releaseId,
    nodeId: `ctc:std-node-${ordinal}`,
    ordinal,
    entityId: `ctc:std-node-${ordinal}`,
    entityType: options.unregistered && ordinal === 1 ? 'FutureSchemaType' : 'DomainConcept',
    displayName: `标准节点${ordinal}`,
    releaseTier: ordinal === 0 ? 'gold' : 'silver',
    reviewStatus: 'REVIEWED',
    publicationStatus: 'PUBLISHED',
    semanticName: `std_node_${ordinal}`,
    sourceCoverageCount: 1,
    candidate: false,
    payload: { description: `standard node ${ordinal}` },
  }));
  const projectionLinks = Array.from({ length: linkCount }, (_, ordinal) => ({
    releaseId,
    linkId: `ctr:std-link-${ordinal}`,
    ordinal,
    relationId: `ctr:std-rel-${ordinal}`,
    sourceId: projectionNodes[0]!.nodeId,
    targetId: projectionNodes[Math.min(1, nodeCount - 1)]!.nodeId,
    relationType: options.unregistered ? 'future_predicate' : 'association',
    relationFamily: 'domain_semantic',
    direction: options.unregistered ? 'source_to_target' : 'unordered',
    evidenceState: 'available',
    payload: {},
  }));
  const releaseEntries = [
    ...projectionNodes.map((node, ordinal) => ({
      releaseId,
      entityId: node.entityId,
      ordinal,
      releaseTier: node.releaseTier,
      entityRole: 'knowledge_object',
      inclusionReason: 'standard fixture',
      payload: {},
    })),
    ...projectionLinks.map((link, ordinal) => ({
      releaseId,
      entityId: link.relationId,
      ordinal: nodeCount + ordinal,
      releaseTier: 'gold',
      entityRole: 'relation',
      inclusionReason: 'standard fixture',
      payload: {},
    })),
  ];
  while (releaseEntries.length < entryCount) {
    releaseEntries.push({
      releaseId,
      entityId: `ctc:extra-${releaseEntries.length}`,
      ordinal: releaseEntries.length,
      releaseTier: 'support',
      entityRole: 'governance_record',
      inclusionReason: 'padding',
      payload: {},
    });
  }
  const bundleReceipt = options.missingBundleReceipt
    ? null
    : {
        id: `bundle-receipt:${hash}`,
        bundleId: 'ctb:control-theory-engineering-v0.3:r2',
        bundleRevision: 2,
        bundleDigest: hash,
        bundleKind: 'aggregate',
        releaseStage: 'stable',
        bundleContractVersion: STANDARD_PUBLIC_BUNDLE_PROTOCOL,
        controlledPath: 'course-content/authoring/knowledge/releases/control-theory-engineering-v0.3-r2',
        manifestRawSha256: hash,
        normalization: 'actkg-public-bundle-manifest/1',
        publicationTag: 'control-theory-engineering-v0.3-r2',
        sourceCommit: commit,
        sourceTag: 'control-theory-engineering-v0.3-source',
        releaseSetId: standardReleaseSetId,
        releaseId,
        releaseHash: hash,
        sourceDatasetHash: hash,
        schemaVersion: CTKG_0_2_SCHEMA_VERSION,
        schemaRawSha256: hash,
        lockVersion: 'actkg-release-set-lock/v3',
        lockPath: 'course-content/authoring/knowledge/releases/release-set.lock.v3.control-theory-engineering-v0.3-r2.json',
        lockRawSha256: hash,
        captureRevision: commit,
        candidateState: ACCEPTED_CANDIDATE_STATE,
        compatibilityCode: 'COMPATIBLE_CONTENT_UPDATE',
        runtimeProjectionId: 'ctr:projection:control-theory-engineering-v0.3:act-v2',
        runtimeProjectionProfile: 'ctr:profile:control-theory-engineering-v0.3:act-v2',
        runtimeProjectionDigest: standardDigest,
        artifactCount: 6,
        statistics: { projectionNodes: nodeCount, projectionLinks: linkCount },
        importedAt: new Date('2026-07-29T00:00:00.000Z'),
      };

  return {
    authorityState: 'candidate',
    productionAuthoritative: false,
    historical: true,
    releaseSet: {
      id: standardReleaseSetId,
      controlledPath: 'course-content/authoring/knowledge/releases/control-theory-engineering-v0.3-r2',
      lockVersion: 'actkg-release-set-lock/v3',
      candidateState: 'CANDIDATE',
    },
    release: {
      id: releaseId,
      releaseSetId: standardReleaseSetId,
      releaseVersion: 'control-theory-engineering-v0.3',
      releaseStatus: 'RELEASED',
      protocol: STANDARD_PUBLIC_BUNDLE_PROTOCOL,
      authority: 'ActKG',
      scope: 'control-theory-engineering',
      contractHash: hash,
      releaseHash: hash,
      schemaRawHash: hash,
      releaseRawHash: hash,
      notesRawHash: hash,
      captureRevision: commit,
      lockRawHash: hash,
      schemaVersion: CTKG_0_2_SCHEMA_VERSION,
      upstreamReleaseId: releaseId,
      projectionId: 'ctr:projection:control-theory-engineering-v0.3:act-v2',
      projectionDigest: standardDigest,
      sourceDatasetHash: hash,
      upstreamPublicationCommit: commit,
      upstreamClosedCommit: null,
    },
    receipt: {
      id: `receipt:${releaseId}`,
      releaseSetId: standardReleaseSetId,
      releaseId,
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
      objectCount: 0,
      sourceMappingCount: 0,
      goldRelationCount: 0,
      silverRelationCount: 0,
      sourceObjectCount: 0,
      evidenceSegmentCount: 0,
      candidateState: ACCEPTED_CANDIDATE_STATE,
      importedAt: new Date('2026-07-29T00:00:00.000Z'),
      schemaVersion: CTKG_0_2_SCHEMA_VERSION,
      upstreamReleaseId: releaseId,
      projectionId: 'ctr:projection:control-theory-engineering-v0.3:act-v2',
      projectionDigest: standardDigest,
      sourceDatasetHash: hash,
      upstreamPublicationCommit: commit,
      upstreamClosedCommit: null,
      releaseEntryCount: releaseEntries.length,
      projectionNodeCount: nodeCount,
      projectionLinkCount: linkCount,
      upstreamRagReferenceCount: 0,
      artifactCount: null,
      componentCount: 1,
      bundleContractVersion: STANDARD_PUBLIC_BUNDLE_PROTOCOL,
      bundleId: 'ctb:control-theory-engineering-v0.3:r2',
      bundleRevision: 2,
      bundleDigest: hash,
      bundleKind: 'aggregate',
      releaseStage: 'stable',
      manifestRawSha256: hash,
      schemaContractVersion: CTKG_0_2_SCHEMA_VERSION,
    },
    objects: [],
    relations: [],
    sourceMappings: [],
    sourceObjects: [],
    evidence: [],
    releaseEntries,
    projectionNodes,
    projectionLinks,
    upstreamRagReferences: [],
    releaseArtifacts: [],
    releaseComponents: [{
      releaseId,
      ordinal: 0,
      componentReleaseId: 'ctr:root-locus-engineering-v0.1',
      releaseVersion: 'root-locus-engineering-v0.1',
      protocol: 'legacy_exact',
      controlledPath: 'course-content/authoring/knowledge/releases/root-locus-engineering-v0.1',
      releaseHash: hash,
      releaseRawSha256: hash,
      sha256sumsSha256: null,
      referenceKind: 'legacy_exact',
      componentRole: 'module',
      payload: {},
    }],
    bundleReceipt,
    bundleArtifacts: bundleReceipt
      ? [
          {
            bundleReceiptId: bundleReceipt.id,
            relativePath: 'bundle-manifest.json',
            ordinal: 0,
            mediaType: 'application/json',
            sha256: hash,
            byteLength: 12,
            role: 'bundle_manifest',
            profile: null,
            contractVersion: 'actkg-public-bundle-manifest/1',
            required: true,
            recordCount: null,
          },
          {
            bundleReceiptId: bundleReceipt.id,
            relativePath: 'SHA256SUMS',
            ordinal: 1,
            mediaType: 'text/plain; charset=utf-8',
            sha256: hash,
            byteLength: 12,
            role: 'sha256sums',
            profile: null,
            contractVersion: 'actkg-sha256sums/1',
            required: true,
            recordCount: null,
          },
          {
            bundleReceiptId: bundleReceipt.id,
            relativePath: 'control-theory-engineering-v0.3.release.json',
            ordinal: 2,
            mediaType: 'application/json',
            sha256: hash,
            byteLength: 12,
            role: 'release',
            profile: null,
            contractVersion: 'ctkg-release/0.2',
            required: true,
            recordCount: null,
          },
          {
            bundleReceiptId: bundleReceipt.id,
            relativePath: 'control-theory-engineering-v0.3.act-projection.json',
            ordinal: 3,
            mediaType: 'application/json',
            sha256: hash,
            byteLength: 12,
            role: 'projection',
            profile: 'runtime',
            contractVersion: 'ctkg-graph-projection/0.2',
            required: true,
            recordCount: nodeCount,
          },
          {
            bundleReceiptId: bundleReceipt.id,
            relativePath: 'ctkg.schema.json',
            ordinal: 4,
            mediaType: 'application/json',
            sha256: hash,
            byteLength: 12,
            role: 'ctkg_schema',
            profile: null,
            contractVersion: 'ctkg-json-schema/0.2',
            required: true,
            recordCount: null,
          },
          {
            bundleReceiptId: bundleReceipt.id,
            relativePath: 'control-theory-engineering-v0.3.rag-crosswalk.jsonl',
            ordinal: 5,
            mediaType: 'application/x-ndjson',
            sha256: hash,
            byteLength: 12,
            role: 'rag_crosswalk',
            profile: null,
            contractVersion: 'actkg-rag-crosswalk/1',
            required: true,
            recordCount: 0,
          },
        ]
      : [],
    projectionIdentities: [
      {
        releaseId,
        projectionId: 'ctr:projection:control-theory-engineering-v0.3:act-v2',
        ordinal: 0,
        profile: 'runtime',
        projectionProfile: 'ctr:profile:control-theory-engineering-v0.3:act-v2',
        versionDigest: standardDigest,
        sourceRelease: releaseId,
        sourceReleaseHash: hash,
        sourceDatasetHash: hash,
        nodeCount,
        linkCount,
        artifactPath: 'control-theory-engineering-v0.3.act-projection.json',
        artifactSha256: hash,
        isRuntime: true,
        bundleReceiptId: bundleReceipt?.id ?? null,
      },
      {
        releaseId,
        projectionId: 'ctr:projection:control-theory-engineering-v0.3:domain-v2',
        ordinal: 1,
        profile: 'domain',
        projectionProfile: 'ctr:profile:control-theory-engineering-v0.3:domain-v2',
        versionDigest: 'd'.repeat(64),
        sourceRelease: releaseId,
        sourceReleaseHash: hash,
        sourceDatasetHash: hash,
        nodeCount,
        linkCount,
        artifactPath: 'control-theory-engineering-v0.3.domain-projection.json',
        artifactSha256: hash,
        isRuntime: false,
        bundleReceiptId: bundleReceipt?.id ?? null,
      },
    ],
    linkMetadata: [],
  };
}

describe('AuthoritativeKnowledgeRepository standard public Bundle candidates', () => {
  it('reads an explicit standard candidate with multi-Projection identities', async () => {
    const snapshot = standardFixture({ counts: { nodes: 3, links: 2, entries: 6 } });
    const result = await new AuthoritativeKnowledgeRepository(
      mockDatabase(snapshot).database,
    ).read(standardSelector);
    expect(result.status).toBe('available');
    if (result.status === 'available') {
      expect(result.snapshot.historical).toBe(true);
      expect(result.snapshot.productionAuthoritative).toBe(false);
      expect(result.snapshot.projectionNodes).toHaveLength(3);
      expect(result.snapshot.projectionLinks).toHaveLength(2);
      expect(result.snapshot.projectionIdentities).toHaveLength(2);
      expect(result.snapshot.bundleReceipt?.candidateState).toBe(ACCEPTED_CANDIDATE_STATE);
      expect(result.snapshot.release.protocol).toBe(STANDARD_PUBLIC_BUNDLE_PROTOCOL);
    }
  });

  it('preserves unregistered types/predicates for generic read-only projection', async () => {
    const snapshot = standardFixture({ unregistered: true });
    const canvas = buildCanvasProjection(snapshot, support);
    expect(canvas.projectionVersion).toBe('act.canvas.v2');
    expect(canvas.nodes.some((node) => node.canonicalType === 'FutureSchemaType')).toBe(true);
    expect(canvas.relations.some((relation) => relation.predicate === 'future_predicate')).toBe(true);
    expect(
      canvas.nodes.find((node) => node.canonicalType === 'FutureSchemaType')?.semanticSupport,
    ).toEqual({ supported: false, readOnly: true });
  });

  it('fails closed when the accepted Bundle receipt is missing', async () => {
    const snapshot = standardFixture({ missingBundleReceipt: true });
    const result = await new AuthoritativeKnowledgeRepository(
      mockDatabase(snapshot).database,
    ).read(standardSelector);
    expect(result.status).toBe('drift');
    if (result.status === 'drift') {
      expect(result.diagnostics.map((item) => item.code)).toEqual(
        expect.arrayContaining(['bundle-receipt-missing']),
      );
    }
  });

  it('selects latest accepted packaging by acceptance time across bundleId revision resets', async () => {
    const snapshot = standardFixture();
    const olderHighRevision = {
      ...snapshot.bundleReceipt!,
      id: 'bundle-receipt:bundle-a-rev10',
      bundleId: 'ctb:control-theory-engineering-v0.3:bundle-a',
      bundleRevision: 10,
      bundleDigest: '1'.repeat(64),
      importedAt: new Date('2026-07-01T00:00:00.000Z'),
    };
    const newerLowRevision = {
      ...snapshot.bundleReceipt!,
      id: 'bundle-receipt:bundle-b-rev2',
      bundleId: 'ctb:control-theory-engineering-v0.3:bundle-b',
      bundleRevision: 2,
      bundleDigest: '2'.repeat(64),
      importedAt: new Date('2026-07-29T12:00:00.000Z'),
    };
    // Global revision ranking would incorrectly prefer A@10 over B@2.
    expect(olderHighRevision.bundleRevision).toBeGreaterThan(newerLowRevision.bundleRevision);

    const { database, actkgBundleReceiptFindFirst } = mockDatabase(snapshot, {
      acceptedBundleReceipts: [olderHighRevision, newerLowRevision],
    });
    const result = await new AuthoritativeKnowledgeRepository(database).read(standardSelector);
    expect(result.status).toBe('available');
    if (result.status === 'available') {
      expect(result.snapshot.bundleReceipt?.bundleId).toBe(newerLowRevision.bundleId);
      expect(result.snapshot.bundleReceipt?.bundleRevision).toBe(2);
      expect(result.snapshot.bundleReceipt?.bundleDigest).toBe(newerLowRevision.bundleDigest);
    }
    expect(actkgBundleReceiptFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: LATEST_ACCEPTED_BUNDLE_RECEIPT_ORDER_BY,
      }),
    );
    expect(LATEST_ACCEPTED_BUNDLE_RECEIPT_ORDER_BY).toEqual([
      { importedAt: 'desc' },
      { id: 'desc' },
    ]);
    expect(LATEST_ACCEPTED_BUNDLE_RECEIPT_ORDER_BY.some((clause) => 'bundleRevision' in clause)).toBe(false);
    // Primary evidence is monotonic importedAt; id is only equal-timestamp fallback.
    expect(LATEST_ACCEPTED_BUNDLE_RECEIPT_ORDER_BY[0]).toEqual({ importedAt: 'desc' });
    expect(LATEST_ACCEPTED_BUNDLE_RECEIPT_ORDER_BY[1]).toEqual({ id: 'desc' });
  });

  it('accepts packaging-revision capture/lock that differ from the first semantic Release', async () => {
    const packagingCapture = 'c'.repeat(40);
    const packagingLock = 'd'.repeat(64);
    const snapshot = standardFixture();
    // First content import freezes semantic Release + import receipt.
    expect(snapshot.release.captureRevision).toBe(commit);
    expect(snapshot.release.lockRawHash).toBe(hash);
    expect(snapshot.receipt?.captureRevision).toBe(commit);
    expect(snapshot.receipt?.lockRawHash).toBe(hash);
    // Later packaging revision: new accepted Bundle receipt packaging identity.
    snapshot.bundleReceipt = {
      ...snapshot.bundleReceipt!,
      bundleRevision: 3,
      captureRevision: packagingCapture,
      lockRawSha256: packagingLock,
    };

    const result = await new AuthoritativeKnowledgeRepository(
      mockDatabase(snapshot).database,
    ).read(standardSelector);
    expect(result.status).toBe('available');
    if (result.status === 'available') {
      expect(result.snapshot.bundleReceipt?.captureRevision).toBe(packagingCapture);
      expect(result.snapshot.bundleReceipt?.lockRawSha256).toBe(packagingLock);
      expect(result.snapshot.release.captureRevision).toBe(commit);
      expect(result.snapshot.release.lockRawHash).toBe(hash);
      expect(result.diagnostics).toEqual([]);
    }
  });

  it('diagnoses invalid packaging captureRevision and lockRawSha256 formats on Bundle receipt', async () => {
    const snapshot = standardFixture();
    snapshot.bundleReceipt = {
      ...snapshot.bundleReceipt!,
      captureRevision: 'not-a-git-sha',
      lockRawSha256: 'too-short',
    };

    const result = await new AuthoritativeKnowledgeRepository(
      mockDatabase(snapshot).database,
    ).read(standardSelector);
    expect(result.status).toBe('drift');
    if (result.status === 'drift') {
      const byField = Object.fromEntries(
        result.diagnostics.map((item) => [item.field, item]),
      );
      expect(byField['bundleReceipt.captureRevision']).toMatchObject({
        code: 'capture-revision-invalid',
        expected: '40 lowercase hexadecimal characters',
        actual: 'not-a-git-sha',
      });
      expect(byField['bundleReceipt.lockRawSha256']).toMatchObject({
        code: 'hash-invalid',
        expected: '64 lowercase hexadecimal characters',
        actual: 'too-short',
      });
      // Must not falsely require equality with the first semantic Release values.
      expect(result.diagnostics.some((item) => (
        item.code === 'capture-revision-mismatch'
        && item.field === 'bundleReceipt.captureRevision'
      ))).toBe(false);
      expect(result.diagnostics.some((item) => (
        item.code === 'lock-hash-mismatch'
        && item.field === 'bundleReceipt.lockRawSha256'
      ))).toBe(false);
    }
  });

  it('keeps #1125 exact diagnosis free of Manifest-only Bundle requirements', async () => {
    const result = await new AuthoritativeKnowledgeRepository(
      mockDatabase(aggregateFixture()).database,
    ).read(aggregateSelector);
    expect(result.status).toBe('available');
    if (result.status === 'available') {
      expect(result.snapshot.bundleReceipt).toBeUndefined();
      expect(result.snapshot.receipt?.candidateState).toBe('CANDIDATE');
    }
  });

  it('rejects active and legacy selectors without reading standard candidate rows', async () => {
    const { database, transaction } = mockDatabase(standardFixture());
    const repository = new AuthoritativeKnowledgeRepository(database);
    await expect(repository.read({ authorityState: 'active' })).resolves.toMatchObject({
      status: 'unavailable',
      reason: 'active-pointer-unavailable',
    });
    await expect(repository.read({ authorityState: 'legacy' })).resolves.toMatchObject({
      status: 'unavailable',
      reason: 'legacy-outside-repository',
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('marks non-default standard ReleaseSets as historical explicit candidates', async () => {
    const snapshot = standardFixture();
    expect(snapshot.releaseSet.id).not.toBe(CURRENT_AGGREGATE_RELEASE_SET_ID);
    expect(snapshot.historical).toBe(true);
    const canvas = buildCanvasProjection(snapshot, support);
    expect(canvas.source.historical).toBe(true);
    expect(canvas.source.productionAuthoritative).toBe(false);
    expect(canvas.source.projectionDigest).toBe(standardDigest);
  });

  it('keeps exact #1125 projection identity free of standard runtime own-keys', () => {
    const canvas = buildCanvasProjection(aggregateFixture(), support);
    expect(Object.prototype.hasOwnProperty.call(canvas.source, 'runtimeProjectionId')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(canvas.source, 'runtimeProjectionProfile')).toBe(false);
    expect(canvas.source.runtimeProjectionId).toBeUndefined();
    expect(canvas.source.runtimeProjectionProfile).toBeUndefined();
  });

  it('preserves exact #1125 cache keys without runtime Projection segments', () => {
    const base = {
      projectionVersion: 'act.canvas.v2' as const,
      authorityState: 'candidate' as const,
      releaseSetId: CURRENT_AGGREGATE_RELEASE_SET_ID,
      releaseId: CURRENT_AGGREGATE_RELEASE_ID,
      releaseHash: hash,
      sourceDatasetHash: aggregateDatasetHash,
      projectionDigest: aggregateDigest,
      role: 'NONE' as const,
      support,
    };
    // Pre-#1131 exact key shape (no runtimeProjection* segments).
    const legacyExactKey = [
      base.projectionVersion,
      base.authorityState,
      base.releaseSetId,
      base.releaseId,
      base.releaseHash,
      base.sourceDatasetHash,
      base.projectionDigest,
      base.role,
      '',
      consumerSupportDigest(base.support),
    ].join('|');
    expect(buildProjectionCacheKey(base)).toBe(legacyExactKey);
    // Explicit empty-string placeholders must still differ from omission only when
    // at least one runtime field is a string — exact callers omit both.
    expect(buildProjectionCacheKey({
      ...base,
      runtimeProjectionId: 'ctr:projection:should-not-be-used-for-exact',
      runtimeProjectionProfile: 'ctr:profile:should-not-be-used-for-exact',
    })).not.toBe(legacyExactKey);
  });

  it('binds standard candidate runtime Projection identity into source and cache keys', () => {
    const snapshot = standardFixture();
    const canvas = buildCanvasProjection(snapshot, support);
    expect(canvas.source.runtimeProjectionId).toBe(
      'ctr:projection:control-theory-engineering-v0.3:act-v2',
    );
    expect(canvas.source.runtimeProjectionProfile).toBe(
      'ctr:profile:control-theory-engineering-v0.3:act-v2',
    );
    const base = {
      projectionVersion: 'act.canvas.v2' as const,
      authorityState: 'candidate' as const,
      releaseSetId: standardReleaseSetId,
      releaseId: standardReleaseId,
      releaseHash: hash,
      sourceDatasetHash: hash,
      projectionDigest: standardDigest,
      role: 'NONE' as const,
      support,
    };
    const withoutRuntime = buildProjectionCacheKey(base);
    const withRuntime = buildProjectionCacheKey({
      ...base,
      runtimeProjectionId: canvas.source.runtimeProjectionId!,
      runtimeProjectionProfile: canvas.source.runtimeProjectionProfile!,
    });
    expect(withRuntime).not.toBe(withoutRuntime);
    expect(withRuntime).toContain(canvas.source.runtimeProjectionId!);
    expect(withRuntime).toContain(canvas.source.runtimeProjectionProfile!);
  });

  it('aligns standard migration-review Artifact expected/actual counts with Bundle receipt', () => {
    const snapshot = standardFixture();
    const review = buildMigrationReviewProjection(snapshot, []);
    expect(snapshot.receipt?.artifactCount).toBeNull();
    expect(snapshot.bundleReceipt?.artifactCount).toBe(6);
    expect(snapshot.bundleArtifacts).toHaveLength(6);
    expect(review.ingest.expectedCounts).toMatchObject({
      artifacts: 6,
      components: 1,
    });
    expect(review.ingest.actualCounts).toMatchObject({
      artifacts: 6,
      components: 1,
    });
    expect(review.ingest.expectedCounts?.artifacts).toBe(review.ingest.actualCounts.artifacts);

    // Standard candidates without an accepted Bundle receipt must fail closed
    // rather than emit invented Artifact expected counts.
    const missingPackaging = standardFixture();
    missingPackaging.bundleReceipt = null;
    expect(missingPackaging.bundleArtifacts?.length).toBeGreaterThan(0);
    expect(() => buildMigrationReviewProjection(missingPackaging, [])).toThrow(
      /requires an accepted Bundle receipt with numeric artifactCount/u,
    );

    const nonNumeric = standardFixture();
    nonNumeric.bundleReceipt = {
      ...nonNumeric.bundleReceipt!,
      artifactCount: Number.NaN,
    };
    expect(() => buildMigrationReviewProjection(nonNumeric, [])).toThrow(
      /requires an accepted Bundle receipt with numeric artifactCount/u,
    );
  });
});
