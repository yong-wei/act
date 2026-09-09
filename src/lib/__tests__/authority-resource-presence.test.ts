import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthorityShardEnvelope } from '@/lib/authority-domain-shards/contracts';

const state = vi.hoisted(() => ({ capture: 'a'.repeat(40), expected: 'a'.repeat(40), owned: true }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/authority-domain-shards/learning-content', () => ({ publishedLearningContentTypes: () => new Map([['card-node', ['card']]]) }));
vi.mock('@/features/knowledge/resource-index/public-api', () => ({
  getLiveResourceRegistryIndex: () => ({ contract: 'resource-index', identity: 'index', digest: 'digest',
    captures: [{ sharedRevision: state.capture }],
    entries: state.owned ? [{ descriptor: { launcher: { launcherRef: '/interactive-learning/courses/unit-1-1-see-the-full-picture' }, foreignRefs: {}, identity: {} } }] : [],
  }),
}));
vi.mock('@/lib/authority-domain-shards/resource-bindings', async (original) => {
  const actual = await original<typeof import('@/lib/authority-domain-shards/resource-bindings')>();
  return { ...actual, matchActiveTeachingProjection: () => ({ status: 'available', authoringRevision: state.expected,
    resources: [
      { resourceId: 'act:lesson:1-1', resourceType: 'lesson', title: '课程', sourcePath: null },
      { resourceId: 'act:textbook:unavailable', resourceType: 'textbook', title: '无入口教材', sourcePath: null },
    ],
    bindings: [
      { resourceId: 'act:lesson:1-1', canonicalId: 'course-node', role: 'EXPLAINS' },
      { resourceId: 'act:textbook:unavailable', canonicalId: 'unavailable-node', role: 'EXPLAINS' },
    ],
  }) };
});
import { activeAuthorityResourceTypes } from '@/lib/authority-domain-shards/resource-presence';

const envelope = {} as AuthorityShardEnvelope;
const availableIds = (requested: readonly string[]) => [...activeAuthorityResourceTypes(envelope, requested, 'STUDENT').keys()];
const ids = ['card-node', 'course-node', 'unavailable-node', 'empty-node'];
beforeEach(() => { state.capture = 'a'.repeat(40); state.expected = state.capture; state.owned = true; });
describe('qualified graph resource presence', () => {
  it('includes published cards and registry-qualified course resources only', () => {
    expect(availableIds(ids).sort()).toEqual(['card-node', 'course-node']);
    const types = activeAuthorityResourceTypes(envelope, ids, 'STUDENT');
    expect([...(types.get('card-node') ?? [])]).toEqual(['card']);
    expect([...(types.get('course-node') ?? [])]).toEqual(['lesson']);
  });
  it('does not treat a mismatched course capture as an available resource', () => {
    state.expected = 'b'.repeat(40);
    expect(availableIds(ids)).toEqual(['card-node']);
  });
  it('requires the live registry to own the resource launch route', () => {
    state.owned = false;
    expect(availableIds(ids)).toEqual(['card-node']);
  });
  it('keeps the presence result bounded to requested objects', () => {
    expect(availableIds(['empty-node'])).toEqual([]);
  });
});
