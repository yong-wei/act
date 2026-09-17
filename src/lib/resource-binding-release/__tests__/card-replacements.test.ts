import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { projectionSha256 } from '@/lib/teaching-projection/hash';
import { buildTeachingProjection } from '@/lib/teaching-projection/builder';
import { CARD_REPLACEMENTS_PATH, loadCardReplacements } from '../card-replacements';
import { buildResourceBindingRelease } from '../builder';
import type { ResourceBindingSources } from '../sources';
import { overlayPublishedCardResources } from '../project-teaching-bindings';

const roots: string[] = [];
afterEach(() => { roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'card-replacement-'));
  roots.push(root);
  const write = (file: string, text: string) => { mkdirSync(dirname(join(root, file)), { recursive: true }); writeFileSync(join(root, file), text); };
  const authority = { releaseId: 'ctr:release:test', releaseSetId: 'set-test', snapshotId: 'snap-test', snapshotHash: 'a'.repeat(64) };
  const card = '---\nauthority_entity_id: "ctc:target"\nstatus: ready\n---\n## 首页\n**一句话定义**：定义\n## 详情\n### 完整解释\n解释\n';
  const record = { contract: 'act-reviewed-card-replacements/v1', status: 'accepted', authority,
    rows: [{ canonicalId: 'ctc:target', cardId: 'ctc_target', title: '新卡', sha256: projectionSha256(card), retiredResourceIds: ['act:card:old'] }] };
  write(CARD_REPLACEMENTS_PATH, JSON.stringify(record));
  write('course-content/authoring/knowledge/authority/releases/snap-test/engineering.json', JSON.stringify({ objects: [{ canonicalId: 'ctc:target', canonicalType: 'DomainConcept', reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: null }] }));
  for (const kind of ['authoring', 'runtime']) write(`course-content/${kind}/knowledge/cards/authority/nodes/ctc_target.md`, card);
  const projection = buildTeachingProjection({ scopeId: 'test', authoringRevision: 'a'.repeat(40), authorityReleaseId: authority.releaseId,
    authoritySnapshotId: authority.snapshotId, authoritySnapshotHash: authority.snapshotHash,
    authorityNodes: [{ canonicalId: 'ctc:target', lifecycleStatus: 'active' }, { canonicalId: 'ctc:other', lifecycleStatus: 'active' }],
    resources: ['old', 'other'].map((id) => ({ resourceId: `act:card:${id}`, resourceType: 'card', projectionMode: 'REQUIRED', scopeId: 'test', title: id,
      knowledgeRefs: [{ canonicalId: id === 'old' ? 'ctc:target' : 'ctc:other', role: 'EXPLAINS' }] })),
  });
  const sources: ResourceBindingSources = { repoRoot: root, scopeId: 'test', authority, prerequisitePublicationId: null,
    unitOrder: [], lessons: new Map(), anchors: new Map(), unitScopes: new Map(), crosswalk: [], review: [], ambiguousLabels: [],
    activeMedia: { runtimeReleaseId: null, files: [] },
    carryForward: { projectionId: projection.manifest.projectionId, manifest: projection.manifest, resources: projection.resources, bindings: projection.bindings,
      resourcesRaw: JSON.stringify(projection.resources), bindingsRaw: JSON.stringify(projection.bindings) },
    raw: { anchors: '', unitScopes: '', crosswalk: '', review: '', courseOrder: '', activeRuntimeMediaIndex: '' },
  };
  return { root, write, authority, record, sources, projection };
}

describe('reviewed card replacement', () => {
  it('excludes stale endpoints from anchored inputs and records the exclusion', () => {
    const f = fixture();
    f.sources.authorityCanonicalIds = new Set(['ctc:target']);
    const result = buildResourceBindingRelease(f.sources, { bindingRevision: 2 });
    expect(result.bindings.every((b) => b.canonicalId === 'ctc:target')).toBe(true);
    expect(result.gate.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'canonical-endpoint-excluded', canonicalId: 'ctc:other', resourceId: 'act:card:other' }),
    ]));
  });
  it('removes the retired card on every build and preserves unrelated resources', () => {
    const f = fixture();
    f.sources.cardReplacements = loadCardReplacements(f.root, f.authority, f.sources.carryForward.bindings);
    for (const revision of [2, 3]) {
      const result = buildResourceBindingRelease(f.sources, { bindingRevision: revision });
      expect(result.gate.passed).toBe(true);
      expect(result.resources.map((r) => r.resourceId)).toEqual(['act:card:ctc_target', 'act:card:other']);
      expect(result.bindings.find((b) => b.resourceId === 'act:card:ctc_target')).toMatchObject({ canonicalId: 'ctc:target', anchor: { kind: 'whole' }, provenance: { method: 'reviewed' } });
      expect(result.manifest.sourceHashes.cardReplacements).toBe(f.sources.cardReplacements!.digest);
    }
  });
  it('rejects a different snapshot and content drift', () => {
    const f = fixture();
    expect(() => loadCardReplacements(f.root, { ...f.authority, snapshotHash: 'b'.repeat(64) }, f.sources.carryForward.bindings)).toThrow('Authority drift');
    f.write('course-content/runtime/knowledge/cards/authority/nodes/ctc_target.md', 'changed');
    expect(() => loadCardReplacements(f.root, f.authority, f.sources.carryForward.bindings)).toThrow('hash drift');
  });
  it('makes a new card visible to the published catalog without adding it to the historical course projection', () => {
    const f = fixture();
    f.sources.cardReplacements = loadCardReplacements(f.root, f.authority, f.sources.carryForward.bindings);
    const built = buildResourceBindingRelease(f.sources, { bindingRevision: 2 });
    const release = { ...built, releaseDir: f.root };
    const view = overlayPublishedCardResources(f.projection, release);
    expect(f.projection.resources.map((r) => r.resourceId)).toContain('act:card:old');
    expect(view.resources.map((r) => r.resourceId)).toEqual(['act:card:ctc_target', 'act:card:other']);
    expect(view.bindings.find((b) => b.resourceId === 'act:card:ctc_target')?.canonicalId).toBe('ctc:target');
    expect(() => overlayPublishedCardResources(f.projection, { ...release, manifest: { ...release.manifest, authoritySnapshotHash: 'b'.repeat(64) } })).toThrow('identity mismatch');
  });
  it('rejects deleting an old card that also teaches another node', () => {
    const f = fixture();
    const binding = f.sources.carryForward.bindings.find((b) => b.resourceId === 'act:card:old')!;
    expect(() => loadCardReplacements(f.root, f.authority, [...f.sources.carryForward.bindings, { ...binding, canonicalId: 'ctc:other' }])).toThrow('crosses Canonical');
  });
  it('rejects unreviewed records, duplicate targets and undeclared old cards', () => {
    const f = fixture();
    f.write(CARD_REPLACEMENTS_PATH, JSON.stringify({ ...f.record, status: 'pending' }));
    expect(() => loadCardReplacements(f.root, f.authority, f.sources.carryForward.bindings)).toThrow('Invalid replacement');
    f.write(CARD_REPLACEMENTS_PATH, JSON.stringify({ ...f.record, rows: [...f.record.rows, ...f.record.rows] }));
    expect(() => loadCardReplacements(f.root, f.authority, f.sources.carryForward.bindings)).toThrow('duplicate');
    f.write(CARD_REPLACEMENTS_PATH, JSON.stringify({ ...f.record, rows: [{ ...f.record.rows[0], retiredResourceIds: [] }] }));
    expect(() => loadCardReplacements(f.root, f.authority, f.sources.carryForward.bindings)).toThrow('Undeclared');
  });
});
