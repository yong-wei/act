import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthorityNodeDetailShard } from '@/lib/authority-domain-shards/contracts';
import type { PublishedResourceFeature, PublishedResourceFeatureIndex } from '@/lib/published-resource-reference';
import { parsePublishedResourceHref } from '@/lib/published-resource-reference';

const state = vi.hoisted(() => ({ matched: true, projectionHash: 'a'.repeat(64), authoringRevision: '1'.repeat(40) }));
vi.mock('@/lib/published-resource-index', async (original) => ({
  ...await original<typeof import('@/lib/published-resource-index')>(),
  loadPublishedResourceFeatureIndexCapture: vi.fn(),
}));
vi.mock('@/lib/authority-domain-shards/resource-bindings', () => ({
  matchActiveTeachingProjection: () => ({
    status: state.matched ? 'available' : 'mismatch',
    projectionId: 'proj-' + state.projectionHash, projectionHash: state.projectionHash,
    authoringRevision: state.authoringRevision,
    scopeId: 'fixture',
    bindings: [
      { canonicalId: 'node', resourceId: 'act:lesson:3-1', role: 'EXPLAINS' },
      { canonicalId: 'node', resourceId: 'act:lesson:3-1', role: 'COVERS' },
      { canonicalId: 'node', resourceId: 'act:textbook:book', role: 'COVERS' },
      { canonicalId: 'node', resourceId: 'act:card:blocked', role: 'EXPLAINS' },
      { canonicalId: 'other', resourceId: 'act:lesson:other', role: 'COVERS' },
    ],
  }),
}));

import { publishedResourceEnvelopeKey, readPublishedNodeResources } from '@/lib/authority-domain-shards/published-resource-bindings';

const shard = {
  node: { id: 'node' },
  envelope: { catalog: { catalogHash: 'catalog' }, teaching: { status: 'available', projectionId: 'proj-teaching', projectionHash: 'teaching' },
    match: { teaching: true }, authority: { snapshotId: 'snap-' + 'b'.repeat(64), snapshotHash: 'b'.repeat(64), activationHash: 'activation' } },
} as AuthorityNodeDetailShard;

function feature(id: string, type: PublishedResourceFeature['type'], backend: PublishedResourceFeature['backend']): PublishedResourceFeature {
  return {
    identity: { resourceId: id, projectionId: 'proj-' + 'a'.repeat(64), projectionHash: 'a'.repeat(64),
      snapshotId: 'snap-' + 'b'.repeat(64), snapshotHash: 'b'.repeat(64), runtimeReleaseId: null },
    version: 'c'.repeat(64), type, title: id.split(':').at(-1)!, canonicalIds: ['node'], backend,
  } as PublishedResourceFeature;
}

function index(): PublishedResourceFeatureIndex {
  return { contract: 'published-resource-features/v1', indexId: 'd'.repeat(64),
    projectionId: 'proj-' + 'a'.repeat(64), projectionHash: 'a'.repeat(64),
    snapshotId: 'snap-' + 'b'.repeat(64), snapshotHash: 'b'.repeat(64), runtimeReleaseId: null,
    resources: [
      feature('act:lesson:3-1', 'lesson', { kind: 'route', href: '/interactive-learning/courses/unit-3-1' }),
      feature('act:textbook:book', 'textbook', { kind: 'container', childResourceIds: ['act:lesson:3-1'] }),
      feature('act:card:blocked', 'card', { kind: 'reference-only', reason: 'Missing published content' }),
    ],
  } as PublishedResourceFeatureIndex;
}

function capturedIndex(value = index()) {
  return { index: value, assertCurrent: vi.fn() };
}

beforeEach(() => { state.matched = true; state.projectionHash = 'a'.repeat(64); state.authoringRevision = '1'.repeat(40); });

describe('published resources in the node inspector', () => {
  it('detects private-envelope changes across the asynchronous resource read', () => {
    const before = publishedResourceEnvelopeKey(shard.envelope);
    for (const changed of [
      { ...shard.envelope, catalog: { ...shard.envelope.catalog, catalogHash: 'other' } },
      { ...shard.envelope, teaching: { ...shard.envelope.teaching, projectionHash: 'other' } },
      { ...shard.envelope, authority: { ...shard.envelope.authority, snapshotHash: 'other' } },
    ]) expect(publishedResourceEnvelopeKey(changed)).not.toBe(before);
  });
  it('lists every bound resource once and retains its exact published reference', async () => {
    const result = await readPublishedNodeResources(shard, async () => capturedIndex());
    expect(result.bindings.state).toBe('available');
    if (result.bindings.state !== 'available') throw new Error('Expected bound resources');
    expect(result.bindings.items.map((item) => item.resourceId)).toEqual(['act:lesson:3-1', 'act:textbook:book', 'act:card:blocked']);
    expect(result.bindings.items[0].bindingRole).toBe('讲解');
    for (const item of result.bindings.items.slice(0, 2)) {
      expect(item.availability).toBe('available');
      expect(parsePublishedResourceHref(item.launch.href!)).toMatchObject({
        resourceId: item.resourceId, projectionHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64), resourceVersion: 'c'.repeat(64),
      });
    }
    expect(result.registryIndex).toEqual({ contract: 'published-resource-features/v1', identity: 'd'.repeat(64), digest: 'd'.repeat(64),
      publication: { projectionId: 'proj-' + 'a'.repeat(64), projectionHash: 'a'.repeat(64),
        snapshotId: 'snap-' + 'b'.repeat(64), snapshotHash: 'b'.repeat(64), scopeId: 'fixture', runtimeReleaseId: null } });
  });

  it('does not advertise a placeholder as readable content', async () => {
    const result = await readPublishedNodeResources(shard, async () => capturedIndex());
    expect(result.bindings.state === 'available' && result.bindings.items[2]).toMatchObject({
      resourceId: 'act:card:blocked', availability: 'unavailable', launch: { href: null },
    });
  });

  it('rejects a projection or snapshot mismatch before exposing resource links', async () => {
    for (const field of ['projectionHash', 'snapshotHash'] as const) {
      const changed = index();
      changed[field] = 'e'.repeat(64);
      expect((await readPublishedNodeResources(shard, async () => capturedIndex(changed))).bindings.state).toBe('unavailable');
    }
    state.matched = false;
    const load = vi.fn(async () => capturedIndex());
    expect((await readPublishedNodeResources(shard, load)).bindings.state).toBe('unavailable');
    expect(load).not.toHaveBeenCalled();
  });

  it('rejects a missing or foreign resource instead of silently omitting its binding', async () => {
    const missing = index();
    missing.resources.pop();
    await expect(readPublishedNodeResources(shard, async () => capturedIndex(missing))).rejects.toThrow('identity differs');
    const foreign = index();
    foreign.resources[0].identity.snapshotHash = 'e'.repeat(64);
    await expect(readPublishedNodeResources(shard, async () => capturedIndex(foreign))).rejects.toThrow('identity differs');
  });

  it.each(['projectionHash', 'authoringRevision'] as const)('rejects a sidecar %s change while loading the index', async (field) => {
    await expect(readPublishedNodeResources(shard, async () => {
      state[field] = 'e'.repeat(field === 'projectionHash' ? 64 : 40);
      return capturedIndex();
    })).rejects.toThrow('course projection changed');
  });

  it('carries the captured teaching revision and rechecks it at the response boundary', async () => {
    const capture = capturedIndex();
    const result = await readPublishedNodeResources(shard, async () => capture);
    expect(result.teachingCaptureRevision).toBe('1'.repeat(40));
    result.assertCurrent();
    expect(capture.assertCurrent).toHaveBeenCalledTimes(2);
    state.authoringRevision = '2'.repeat(40);
    expect(() => result.assertCurrent()).toThrow('course projection changed');
  });

  it('rejects resource references with a different runtime identity from their index', async () => {
    const mixed = index();
    mixed.resources[0].identity.runtimeReleaseId = 'runtime-other';
    await expect(readPublishedNodeResources(shard, async () => capturedIndex(mixed))).rejects.toThrow('identity differs');
  });
});
