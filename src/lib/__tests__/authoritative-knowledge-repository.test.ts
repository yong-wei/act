import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  AuthoritativeKnowledgeProjectionService,
  AuthoritativeKnowledgeRepository,
  AuthoritativeProjectionCache,
  buildCanvasProjection,
  buildMigrationReviewProjection,
  buildNodeDetailProjection,
  buildProjectionCacheKey,
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
} {
  const one = (value: unknown) => ({ findUnique: vi.fn(async () => value), findMany: vi.fn() });
  const many = (value: unknown[]) => ({ findUnique: vi.fn(), findMany: vi.fn(async () => value) });
  const tx = {
    actkgReleaseSet: one(snapshot.releaseSet),
    actkgRelease: one(snapshot.release),
    actkgImportReceipt: one(snapshot.receipt),
    actkgAuthoritativeObject: many([...snapshot.objects].reverse()),
    actkgAuthoritativeRelation: many([...snapshot.relations].reverse()),
    actkgSourceMapping: many([...snapshot.sourceMappings].reverse()),
    actkgSourceObject: many([...snapshot.sourceObjects].reverse()),
    actkgEvidenceSegment: many([...snapshot.evidence].reverse()),
  };
  const transaction = vi.fn(async (callback, options) => {
    expect(options).toEqual({ isolationLevel: 'RepeatableRead' });
    return callback(tx);
  });
  return { database: { $transaction: transaction }, transaction };
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
    expect(JSON.stringify(student)).not.toMatch(/aliases|payload|controlledPath|sourceRun|contentHash/);
    expect(teacher.role).toBe('TEACHER');
    expect(teacher.node).toEqual(expect.objectContaining({
      aliases: ['根轨迹'],
      teachingFields: { concept_kind: 'engineering' },
      coverage: { sourceMappingCount: 1, evidenceCount: 1 },
      governanceTier: 'CORE',
    }));
    expect(JSON.stringify(teacher)).not.toMatch(/payload|controlledPath|sourceRun|contentHash/);
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
