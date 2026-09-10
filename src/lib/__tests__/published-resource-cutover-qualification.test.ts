import { describe, expect, it } from 'vitest';
import { qualifyPublishedResourceInputs } from '../../../scripts/knowledge/prepare-current-resource-cutover';
import type { TeachingProjectionArtifacts } from '@/lib/teaching-projection/contracts';
import type { PublishedResourceFeatureIndex } from '@/lib/published-resource-reference';

function fixture() {
  const artifacts = {
    gate: { passed: true },
    manifest: { gatePassed: true, projectionId: 'projection', projectionHash: 'projection-hash', authoritySnapshotId: 'snapshot', authoritySnapshotHash: 'snapshot-hash' },
    resources: [{ resourceId: 'card', resourceType: 'card', sourcePath: 'card.md', bindingCount: 1, projectionStatus: 'BOUND' }],
    bindings: [{ bindingId: 'binding', resourceId: 'card', canonicalId: 'node' }],
  } as unknown as TeachingProjectionArtifacts;
  const index = {
    contract: 'published-resource-features/v1', projectionId: 'projection', projectionHash: 'projection-hash',
    snapshotId: 'snapshot', snapshotHash: 'snapshot-hash', runtimeReleaseId: null,
    resources: [{ identity: { resourceId: 'card', projectionId: 'projection', projectionHash: 'projection-hash',
      snapshotId: 'snapshot', snapshotHash: 'snapshot-hash', runtimeReleaseId: null },
    type: 'card', version: 'a'.repeat(64), canonicalIds: ['node'], bindingIds: ['binding'],
    backend: { kind: 'route', href: '/owned-reader' }, recommendable: true }],
  } as unknown as PublishedResourceFeatureIndex;
  return { artifacts, index, members: new Set(['node']) };
}

describe('published resource cutover qualification', () => {
  it('seals the checked resource version and Canonical binding without a circular Runtime release id', () => {
    const f = fixture();
    const result = qualifyPublishedResourceInputs(f.artifacts, f.index, f.members);
    expect(result.resources[0]).toMatchObject({ resourceId: 'card', readable: true, bindingCount: 1, version: 'a'.repeat(64) });
    expect(result.qualificationHash).toMatch(/^[a-f0-9]{64}$/);
    f.index.runtimeReleaseId = 'runtime-next';
    f.index.resources[0].identity.runtimeReleaseId = 'runtime-next';
    expect(qualifyPublishedResourceInputs(f.artifacts, f.index, f.members).qualificationHash).toBe(result.qualificationHash);
  });

  it.each(['publication', 'resource-set', 'feature-identity', 'binding', 'scope', 'unreadable', 'empty-container'])('rejects unqualified input: %s', (caseName) => {
    const f = fixture();
    if (caseName === 'publication') f.index.projectionHash = 'other';
    if (caseName === 'resource-set') f.index.resources = [];
    if (caseName === 'feature-identity') f.index.resources[0].identity.snapshotHash = 'other';
    if (caseName === 'binding') f.index.resources[0].bindingIds = [];
    if (caseName === 'scope') f.members.clear();
    if (caseName === 'unreadable') f.index.resources[0].backend = { kind: 'reference-only', reason: 'missing' };
    if (caseName === 'empty-container') f.index.resources[0].backend = { kind: 'container', childResourceIds: [] };
    expect(() => qualifyPublishedResourceInputs(f.artifacts, f.index, f.members)).toThrow('resource qualification:');
  });
});
