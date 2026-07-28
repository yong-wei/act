import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  AggregateProjectionContractError,
  AuthoritativeKnowledgeProjectionService,
  AuthoritativeKnowledgeRepository,
  AuthoritativeProjectionCache,
  buildCanvasProjection,
  buildMigrationReviewProjection,
  buildNodeDetailProjection,
  buildProjectionCacheKey,
  CANDIDATE_RELEASE_LABEL,
  CTKG_0_2_AGGREGATE_PROTOCOL,
  CTKG_0_2_SCHEMA_VERSION,
  CURRENT_AGGREGATE_RELEASE_ID,
  CURRENT_AGGREGATE_RELEASE_SET_ID,
  HISTORICAL_ROOT_LOCUS_RELEASE_SET_ID,
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

function mockDatabase(snapshot: AuthoritativeKnowledgeSnapshot): {
  database: AuthoritativeKnowledgeDatabase;
  transaction: ReturnType<typeof vi.fn>;
  legacyDelegates: Record<string, { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> }>;
} {
  const one = (value: unknown) => ({ findUnique: vi.fn(async () => value), findMany: vi.fn() });
  const many = (value: unknown[]) => ({ findUnique: vi.fn(), findMany: vi.fn(async () => value) });
  const legacyDelegates = {
    actkgAuthoritativeObject: many([...snapshot.objects].reverse()),
    actkgAuthoritativeRelation: many([...snapshot.relations].reverse()),
    actkgSourceMapping: many([...snapshot.sourceMappings].reverse()),
    actkgSourceObject: many([...snapshot.sourceObjects].reverse()),
    actkgEvidenceSegment: many([...snapshot.evidence].reverse()),
  };
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
  };
  const transaction = vi.fn(async (callback, options) => {
    expect(options).toEqual({ isolationLevel: 'RepeatableRead' });
    return callback(tx);
  });
  return { database: { $transaction: transaction }, transaction, legacyDelegates };
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
