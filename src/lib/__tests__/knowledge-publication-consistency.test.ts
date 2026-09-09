import { describe, expect, it, vi } from 'vitest';
import { assertKnowledgePublicationConsistency } from '../../../scripts/knowledge/assert-knowledge-publication-consistency';
import { shardDigest, shardSha256 } from '@/lib/authority-domain-shards/hash';
vi.mock('@/lib/authority-locale-readiness/qualification-package', () => ({ interfaceCatalogDigest: () => 'interface' }));
vi.mock('@/lib/authority-locale-readiness/qualify', () => ({ qualifyReleaseLocales: () => ({ bilingualReady: true }) }));
function fixture() {
  const files = new Map<string, string>();
  const put = (key: string, value: unknown) => files.set('course-content/runtime/knowledge/' + key, JSON.stringify(value));
  put('projection/current.json', { projectionId: 'course', projectionHash: 'course-hash' });
  put('projection/releases/course/projection-manifest.json', { authoringRevision: 'app', gatePassed: true, projectionHash: 'course-hash', authoritySnapshotHash: 'snapshot' });
  put('teaching-projection/domain-fragments/current.json', { projectionId: 'overlay', projectionHash: 'overlay-hash' });
  put('teaching-projection/domain-fragments/releases/overlay/composed-manifest.json', { projectionHash: 'overlay-hash', authoringRevision: 'app', authorityBinding: { snapshotHash: 'snapshot' } });
  put('teaching-projection/domain-fragments/releases/overlay/inspector-sidecar.json', { envelopeProjectionId: 'overlay', envelopeProjectionHash: 'overlay-hash', courseProjectionId: 'course', courseProjectionHash: 'course-hash' });
  const domain = JSON.stringify({ objects: [{ id: 'local' }], teachingBoundaryObjects: [{ id: 'external' }], teachingRelations: [{ sourceId: 'local', targetId: 'external' }], teachingCoverage: { relationCount: 1 } });
  const envelope = { teaching: { projectionHash: 'overlay-hash' } };
  const shardFiles = { 'domains/modeling/default.json': shardSha256(domain), 'domains/modeling/families/prerequisite-order.json': 'family' };
  const hash = shardDigest({ envelope, files: shardFiles });
  put('authority-domain-shards/current.json', { shardSetId: 'shards', shardSetHash: hash, snapshotHash: 'snapshot' });
  put('authority-domain-shards/sets/shards/manifest.json', { shardSetHash: hash, envelope, files: shardFiles });
  files.set('course-content/runtime/knowledge/authority-domain-shards/sets/shards/domains/modeling/default.json', domain);
  put('prerequisites/current.json', { publicationId: 'prereq', publicationHash: 'prereq-hash' });
  put('composite-envelopes/actkg-composite-envelope-registry.json', { envelopes: [{ qualified: true, name: 'qualified', authoritySnapshotHash: 'snapshot', projectionId: 'course', projectionHash: 'course-hash', publicationId: 'prereq', publicationHash: 'prereq-hash', shardSetId: 'shards', shardSetHash: hash }] });
  put('composite-envelopes/locale-manifests/qualified.json', { shardSet: { shardSetHash: hash }, authority: { snapshotHash: 'snapshot' }, interfaceCatalogDigest: 'interface', manifest: { denominators: [] } });
  put('course-order/coverage.json', { projectionHash: 'overlay-hash', authoringRevision: 'app', fullCourseCoverage: false });
  const read = (key: string) => { const bytes = files.get(key); if (!bytes) throw new Error('missing:' + key); return bytes; };
  return { put, read };
}
describe('frozen knowledge publication consistency', () => {
  it('accepts one coherent candidate with explicitly incomplete full-course coverage', () => {
    const f = fixture();
    expect(() => assertKnowledgePublicationConsistency(f.read, 'app')).not.toThrow();
  });
  it('rejects an app capture mismatch', () => {
    const f = fixture();
    expect(() => assertKnowledgePublicationConsistency(f.read, 'other')).toThrow('course projection capture');
  });
  it('rejects a stale resource sidecar before release', () => {
    const f = fixture();
    f.put('teaching-projection/domain-fragments/releases/overlay/inspector-sidecar.json', { courseProjectionId: 'previous' });
    expect(() => assertKnowledgePublicationConsistency(f.read, 'app')).toThrow('inspector resource sidecar');
  });
  it('rejects a language package qualified against an older interface', () => {
    const f = fixture();
    f.put('composite-envelopes/locale-manifests/qualified.json', { shardSet: {}, authority: {} });
    expect(() => assertKnowledgePublicationConsistency(f.read, 'app')).toThrow('locale package');
  });
  it('rejects a missing candidate registry instead of accepting app metadata', () => {
    const f = fixture();
    f.put('composite-envelopes/actkg-composite-envelope-registry.json', { envelopes: [] });
    expect(() => assertKnowledgePublicationConsistency(f.read, 'app')).toThrow('qualified composite registry');
  });
});
