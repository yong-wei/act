import { describe, expect, it, vi } from 'vitest';
import { assertKnowledgePublicationConsistency } from '../../../scripts/knowledge/assert-knowledge-publication-consistency';
import { shardDigest, shardSha256 } from '@/lib/authority-domain-shards/hash';
vi.mock('@/lib/authority-locale-readiness/qualification-package', () => ({ interfaceCatalogDigest: () => 'interface' }));
vi.mock('@/lib/authority-locale-readiness/qualify', () => ({ qualifyReleaseLocales: () => ({ bilingualReady: true }) }));
function fixture() {
  const files = new Map<string, string>();
  const put = (key: string, value: unknown) => files.set('course-content/runtime/knowledge/' + key, JSON.stringify(value));
  put('projection/current.json', { projectionId: 'course', projectionHash: 'course-hash' });
  put('projection/releases/course/projection-manifest.json', { authoringRevision: 'app', gatePassed: true, projectionHash: 'course-hash', authoritySnapshotHash: 'snapshot', authoritySnapshotId: 'snapshot-id', authorityReleaseId: 'release' });
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
  put('projection/releases/course/resources.jsonl', { resourceId: 'resource', resourceType: 'card', sourcePath: 'cards/example.md' });
  put('projection/releases/course/bindings.jsonl', { resourceId: 'resource', canonicalId: 'local', role: 'EXPLAINS', scopeId: 'course', primary: false });
  put('projection/releases/course/prerequisites.jsonl', { sourceCanonicalId: 'local', targetCanonicalId: 'external', strength: 'REQUIRED', scopeId: 'course' });
  put('prerequisites/releases/prereq/projection-prerequisites.json', [{ sourceCanonicalId: 'local', targetCanonicalId: 'external', strength: 'REQUIRED', scopeId: 'course' }]);
  put('prerequisites/current.json', { publicationId: 'prereq', publicationHash: 'prereq-hash' });
  put('composite-envelopes/actkg-composite-envelope-registry.json', { envelopes: [{ qualified: true, name: 'qualified', authoritySnapshotHash: 'snapshot', projectionId: 'course', projectionHash: 'course-hash', publicationId: 'prereq', publicationHash: 'prereq-hash', shardSetId: 'shards', shardSetHash: hash }] });
  put('composite-envelopes/locale-manifests/qualified.json', { shardSet: { shardSetHash: hash }, authority: { snapshotHash: 'snapshot' }, interfaceCatalogDigest: 'interface', manifest: { denominators: [] } });
  put('course-order/coverage.json', { projectionHash: 'overlay-hash', authoringRevision: 'app', fullCourseCoverage: false });
  const read = (key: string) => { const bytes = files.get(key); if (!bytes) throw new Error('missing:' + key); return bytes; };
  return { put, read, files };
}
describe('frozen knowledge publication consistency', () => {
  it('accepts one coherent candidate with explicitly incomplete full-course coverage', () => {
    const f = fixture();
    expect(() => assertKnowledgePublicationConsistency(f.read)).not.toThrow();
  });
  it('rejects loss of an existing resource binding even when counts could be similar', () => {
    const baseline = fixture();
    const candidate = fixture();
    candidate.put('projection/releases/course/bindings.jsonl', { resourceId: 'other', canonicalId: 'local', role: 'EXPLAINS', scopeId: 'course', primary: false });
    expect(() => assertKnowledgePublicationConsistency(candidate.read, baseline.read)).toThrow('retained resource continuity');
  });
  it.each(['approved', 'missing-ruling', 'wrong-snapshot', 'bound-count', 'bound-row', 'wrong-type'])('checks frozen retirement evidence for an absent infographic (%s)', (variant) => {
    const baseline = fixture();
    const candidate = fixture();
    const resourceId = 'act:infographic:ctc_retired';
    const resourcePath = 'course-content/runtime/knowledge/projection/releases/course/resources.jsonl';
    baseline.files.set(resourcePath, baseline.read(resourcePath) + '\n' + JSON.stringify({
      resourceId, resourceType: variant === 'wrong-type' ? 'card' : 'infographic', sourcePath: null,
      projectionStatus: 'EXPLICIT_NONE', bindingCount: variant === 'bound-count' ? 1 : 0,
    }));
    if (variant !== 'missing-ruling') baseline.files.set(
      'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r6/domain-catalog/retirement-ruling.json',
      JSON.stringify({ contract: 'act-authority-domain-catalog-retirement-ruling/v1', snapshotId: variant === 'wrong-snapshot' ? 'other' : 'snapshot-id', retiredMembers: ['ctc:retired'] }),
    );
    if (variant === 'bound-row') {
      const bindingPath = 'course-content/runtime/knowledge/projection/releases/course/bindings.jsonl';
      const bytes = baseline.read(bindingPath) + '\n' + JSON.stringify({ resourceId, canonicalId: 'local', role: 'EXPLAINS' });
      baseline.files.set(bindingPath, bytes);
      candidate.files.set(bindingPath, bytes);
    }
    const verify = () => assertKnowledgePublicationConsistency(candidate.read, baseline.read);
    if (variant === 'approved') expect(verify).not.toThrow();
    else expect(verify).toThrow('retained resource continuity');
  });
  it('rejects different prerequisite sets in course and path consumers', () => {
    const f = fixture();
    f.put('prerequisites/releases/prereq/projection-prerequisites.json', []);
    expect(() => assertKnowledgePublicationConsistency(f.read)).toThrow('course and path prerequisite publication');
  });
  it('keeps runtime provenance independent from the application baseline', () => {
    const baseline = fixture();
    const candidate = fixture();
    candidate.put('projection/releases/course/projection-manifest.json', { authoringRevision: 'earlier', gatePassed: true, projectionHash: 'course-hash', authoritySnapshotHash: 'snapshot', authoritySnapshotId: 'snapshot-id', authorityReleaseId: 'release' });
    candidate.put('teaching-projection/domain-fragments/releases/overlay/composed-manifest.json', { projectionHash: 'overlay-hash', authoringRevision: 'earlier', authorityBinding: { snapshotHash: 'snapshot' } });
    candidate.put('course-order/coverage.json', { projectionHash: 'overlay-hash', authoringRevision: 'earlier', fullCourseCoverage: false });
    expect(() => assertKnowledgePublicationConsistency(candidate.read, baseline.read)).not.toThrow();
  });
  it('rejects a stale resource sidecar before release', () => {
    const f = fixture();
    f.put('teaching-projection/domain-fragments/releases/overlay/inspector-sidecar.json', { courseProjectionId: 'previous' });
    expect(() => assertKnowledgePublicationConsistency(f.read)).toThrow('inspector resource sidecar');
  });
  it('rejects a language package qualified against an older interface', () => {
    const f = fixture();
    f.put('composite-envelopes/locale-manifests/qualified.json', { shardSet: {}, authority: {} });
    expect(() => assertKnowledgePublicationConsistency(f.read)).toThrow('locale package');
  });
  it('rejects a missing candidate registry instead of accepting app metadata', () => {
    const f = fixture();
    f.put('composite-envelopes/actkg-composite-envelope-registry.json', { envelopes: [] });
    expect(() => assertKnowledgePublicationConsistency(f.read)).toThrow('qualified composite registry');
  });
  it('accepts a binding release pointer that matches the course Authority', () => {
    const f = fixture();
    f.put('resource-bindings/current.json', {
      bindingReleaseId: 'control-theory-engineering-v0.37-r6-b2',
      bindingHash: 'a'.repeat(64),
      authorityReleaseId: 'release',
    });
    f.put('resource-bindings/releases/control-theory-engineering-v0.37-r6-b2/binding-manifest.json', {
      bindingHash: 'a'.repeat(64),
      authorityReleaseId: 'release',
    });
    expect(() => assertKnowledgePublicationConsistency(f.read)).not.toThrow();
  });
  it('rejects a binding release pointer that does not match the course Authority', () => {
    const f = fixture();
    f.put('resource-bindings/current.json', {
      bindingReleaseId: 'control-theory-engineering-v0.37-r6-b2',
      bindingHash: 'a'.repeat(64),
      authorityReleaseId: 'other-release',
    });
    f.put('resource-bindings/releases/control-theory-engineering-v0.37-r6-b2/binding-manifest.json', {
      bindingHash: 'a'.repeat(64),
      authorityReleaseId: 'other-release',
    });
    expect(() => assertKnowledgePublicationConsistency(f.read)).toThrow('resource binding release identity');
  });
});
