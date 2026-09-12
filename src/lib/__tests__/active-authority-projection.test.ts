import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
  canvas: vi.fn(),
  nodeDetail: vi.fn(),
  publishedResources: vi.fn(),
  catalogHash: 'c'.repeat(64),
}));

vi.mock('@/lib/authoritative-knowledge/engineering-authority-consumers', () => ({
  resolveActiveEngineeringGraphAuthority: mocks.resolve,
  resolveConfiguredAuthorityRoot: () => '/tmp/authority',
}));
vi.mock('@/lib/authoritative-knowledge/projections', () => ({
  buildActiveAuthorityCanvasProjection: mocks.canvas,
  buildActiveAuthorityNodeDetailProjection: mocks.nodeDetail,
}));
vi.mock('@/lib/authority-domain-shards/identity', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/authority-domain-shards/identity')>();
  return {
    ...original,
    resolveActiveShardIdentity: () => ({
      envelope: {
        authority: {
          releaseId: 'release-1',
          snapshotHash: 'a'.repeat(64),
          activationHash: 'b'.repeat(64),
        },
        catalog: { catalogHash: mocks.catalogHash },
        teaching: { status: 'available', projectionId: 'teaching-1', projectionHash: 'd'.repeat(64) },
        match: { teaching: true },
      },
    }),
  };
});

vi.mock('@/lib/authority-domain-shards/published-resource-bindings', async (original) => ({
  ...await original<typeof import('@/lib/authority-domain-shards/published-resource-bindings')>(),
  readPublishedNodeResources: mocks.publishedResources,
}));

import {
  activeShardResponse,
  activePublishedDetailResponse,
  readActiveCanvas,
  readActiveNode,
} from '@/app/api/knowledge/_active-authority';
import {
  AuthorityShardIdentityError,
  AuthorityShardStoreError,
} from '@/lib/authority-domain-shards';

const resolved = {
  status: 'ready' as const,
  consumerId: 'engineering-graph' as const,
  snapshotId: 'snap-1',
  snapshotHash: 'a'.repeat(64),
  releaseId: 'release-1',
  releaseSetId: 'set-1',
  objectCount: 1,
  relationCount: 0,
  engineering: {},
  manifest: {},
  teachingProjectionRequired: false as const,
  activationMode: 'use-combination' as const,
  consumerStatus: 'READY' as const,
  activationId: 'activation-1',
  activationHash: 'b'.repeat(64),
  combination: {
    authorityReleaseId: 'release-1',
    authoritySnapshotId: 'snap-1',
    authoritySnapshotHash: 'a'.repeat(64),
    projectionId: null,
    projectionHash: null,
    scopeId: null,
    captureRevision: null,
  },
  projectionId: null,
  projectionHash: null,
  snapshot: { authorityState: 'active' },
};

const source = {
  authorityState: 'active' as const,
  releaseSetId: 'set-1',
  releaseId: 'release-1',
  productionAuthoritative: false as const,
  historical: false,
  releaseHash: 'c'.repeat(64),
  schemaVersion: '0.2.0',
  projectionDigest: 'd'.repeat(64),
  sourceDatasetHash: 'e'.repeat(64),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolve.mockReturnValue(resolved);
  mocks.canvas.mockReturnValue({
    projectionVersion: 'act.canvas.v2',
    source,
    release: { label: 'Authority', version: 'v1', scope: 'engineering' },
    fields: { included: [], hidden: [] },
    coverage: {
      status: 'partial',
      objectCount: 1,
      relationCount: 0,
      goldRelationCount: 0,
      silverRelationCount: 0,
      sourceObjectCount: 0,
      evidenceSegmentCount: 0,
    },
    teachingSemantics: { status: 'unavailable', message: '教学关系尚未发布' },
    nodes: [],
    relations: [],
  });
  mocks.nodeDetail.mockReturnValue({
    projectionVersion: 'act.node-detail.v2',
    source: { ...source, controlledPath: '/private/host/path' },
    role: 'ADMIN',
    fields: { included: [], hidden: [] },
    node: {
      id: 'node-1',
      canonicalType: 'DomainConcept',
      label: '节点',
      description: null,
      adjacency: [],
      sources: [],
      semanticSupport: { supported: true, readOnly: true },
      aliases: [],
      teachingFields: {},
      governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: null },
      coverage: { sourceMappingCount: 0, evidenceCount: 0 },
      governanceTier: 'CORE',
      payload: { secret: 'raw-store' },
      sourceMappings: [],
      sourceStubs: [],
      evidence: [],
    },
    receipt: { id: 'receipt-1', lockRawHash: 'secret' },
    diagnostics: [],
    activeConsumerRebinding: 'not-started',
  });
});

describe('active Authority role-safe projections', () => {
  beforeEach(() => {
    mocks.catalogHash = 'c'.repeat(64);
    mocks.publishedResources.mockRejectedValue(new Error('optional resource index unavailable'));
  });
  const nodeShard = {
    shardClass: 'node-detail' as const,
    envelope: {
      contract: 'act-authority-shard-envelope/v1' as const,
      authority: {
        snapshotId: 'snap-1',
        snapshotHash: 'a'.repeat(64),
        releaseId: 'release-1',
        releaseSetId: 'set-1',
        activationId: 'activation-1',
        activationHash: 'b'.repeat(64),
        projectionId: null,
        projectionHash: null,
      },
      catalog: { catalogId: 'catalog-1', catalogHash: 'c'.repeat(64), catalogVersion: 'v1' },
      teaching: { status: 'available' as const, projectionId: 'teaching-1', projectionHash: 'd'.repeat(64), teachingCacheFamily: 'family-1' },
      match: { authority: true as const, catalog: true as const, teaching: true as const },
    },
    node: {
      id: 'node-1',
      canonicalType: 'DomainConcept',
      label: '节点',
      description: null,
      teachingFields: { concept_kind: 'engineering' },
      governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: 'active' },
      sources: [],
      media: { cardAvailable: false as const, infographAvailable: false as const },
      semanticSupport: { supported: true, readOnly: true as const },
    },
  };

  it('keeps valid student detail without waiting for the published resource index', async () => {
    const response = await activePublishedDetailResponse(() => nodeShard, 'STUDENT', new Request('http://localhost/api/knowledge/shards/active/nodes/node-1'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.node.id).toBe('node-1');
    expect(body.node.resourceBindings.state).toBe('unavailable');
    expect(body.node).not.toHaveProperty('teachingFields');
    expect(mocks.publishedResources).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toContain('optional resource index unavailable');
  });

  it.each([
    ['STUDENT' as const, false],
    ['TEACHER' as const, true],
    ['ADMIN' as const, true],
  ])('projects node-detail teachingFields by authenticated role (%s)', async (role, includesTeachingFields) => {
    const response = activeShardResponse(() => nodeShard, role);
    const body = await response.json();
    expect(Object.prototype.hasOwnProperty.call(body.node, 'teachingFields')).toBe(includesTeachingFields);
    expect(body.node.mathematics).toEqual({ state: 'missing' });
    if (!includesTeachingFields) expect(JSON.stringify(body)).not.toContain('concept_kind');
  });

  it.each([
    [
      new AuthorityShardStoreError('shard-tamper', 'private path /tmp/secret parser detail'),
      'ACTIVE_SHARD_SHARD_TAMPER',
      409,
    ],
    [
      new AuthorityShardIdentityError('manifest-hash-invalid', 'private path /tmp/secret parser detail'),
      'ACTIVE_SHARD_MANIFEST_HASH_INVALID',
      503,
    ],
  ])('does not expose internal shard error messages (%s)', async (error, code, status) => {
    const response = activeShardResponse(() => {
      throw error;
    });
    const body = await response.json();
    expect(response.status).toBe(status);
    expect(body).toMatchObject({
      code,
      error: '当前 Authority 分片暂时无法加载。',
    });
    expect(JSON.stringify(body)).not.toContain('private path /tmp/secret parser detail');
  });

  it('projects active provenance with null engineering projection', () => {
    const result = readActiveCanvas();
    expect(result.status).toBe('available');
    if (result.status !== 'available') return;
    expect(result.projection.source.projectionDigest).toBeNull();
    expect(result.projection.provenance).toMatchObject({
      authority: { consumerId: 'engineering-graph', snapshotId: 'snap-1' },
      activation: { status: 'READY', mode: 'use-combination' },
      projection: { status: 'not-applicable', projectionId: null, projectionHash: null },
    });
  });

  it('removes host paths, raw payloads, and receipts from admin active details', () => {
    const result = readActiveNode('ADMIN', 'node-1');
    expect(result.status).toBe('available');
    if (result.status !== 'available') return;
    const json = JSON.stringify(result.projection);
    expect(json).not.toContain('/private/host/path');
    expect(json).not.toContain('raw-store');
    expect(json).not.toContain('receipt-1');
    expect(json).not.toContain('lockRawHash');
    expect(result.projection.provenance.projection.projectionId).toBeNull();
  });

  it('does not turn an unavailable strict resolver into a Legacy response', () => {
    mocks.resolve.mockReturnValueOnce({ status: 'unavailable', reason: 'engineering-graph-activation-absent' });
    const result = readActiveCanvas();
    expect(result).toEqual({ status: 'unavailable', reason: 'engineering-graph-activation-absent' });
    expect(mocks.canvas).not.toHaveBeenCalled();
  });
});
