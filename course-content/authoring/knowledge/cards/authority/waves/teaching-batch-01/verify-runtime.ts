import assert from 'node:assert/strict';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectionSha256 } from '@/lib/teaching-projection/hash';
import { loadCurrentResourceBindingRelease, loadResourceBindingRelease, loadResourceBindingSources, buildResourceBindingRelease } from '@/lib/resource-binding-release';
import { loadStagedTeachingProjection, resolveTeachingProjectionStorePaths } from '@/lib/teaching-projection/store';
import { overlayPublishedCardResources } from '@/lib/resource-binding-release/project-teaching-bindings';
import { buildPublishedResourceFeatureIndex } from '@/lib/published-resource-index';
import { readPublishedLearnerCardByToken } from '@/lib/authority-domain-shards/learning-content';
import { attachActiveAuthorityResourceBindings } from '@/lib/authority-domain-shards/resource-bindings';
import { loadGoalPlanningRegistry } from '@/features/personalization/path-planning/planning-projection-index';
import { GOAL_CANONICAL_KNOWLEDGE } from '@/features/personalization/path-planning/goal-canonical-knowledge';

const root = process.cwd();
const batch = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const inventory = read(join(batch, 'inventory.json'));
const retirement = read(join(batch, 'retirement.json'));
const current = loadCurrentResourceBindingRelease(root)!;
assert.equal(current.manifest.bindingReleaseId, retirement.replacementBindingReleaseId);
const old = loadResourceBindingRelease(root, retirement.baseBindingReleaseId);
const sources = loadResourceBindingSources(root);
const rebuilt = buildResourceBindingRelease(sources, { bindingRevision: current.manifest.bindingRevision });
assert.equal(rebuilt.manifest.bindingHash, current.manifest.bindingHash, 'Retired cards returned or unrelated sources drifted');
const affected = new Set(inventory.cards.map((r: any) => r.resourceId));
for (const entry of retirement.entries) {
  affected.add(entry.resourceId);
  assert(!current.resources.some((r) => r.resourceId === entry.resourceId));
  for (const file of entry.files) assert(!existsSync(join(root, file.path)), file.path);
}
const unaffected = (rows: any[]) => rows.filter((r) => !affected.has(r.resourceId))
  .sort((a, b) => (a.bindingId ?? a.resourceId).localeCompare(b.bindingId ?? b.resourceId));
assert.deepEqual(unaffected(current.bindings), unaffected(old.bindings));
assert.deepEqual(unaffected(current.resources), unaffected(old.resources));
const graph = join(root, 'course-content/runtime/knowledge');
const pointer = read(join(graph, 'projection/current.json'));
const staged = loadStagedTeachingProjection(resolveTeachingProjectionStorePaths(join(graph, 'projection')), pointer.projectionId, { verify: false });
const authority = read(join(root, 'course-content/authoring/knowledge/authority/current.json'));
const engineering = read(join(root, 'course-content/authoring/knowledge/authority/releases', authority.snapshotId, 'engineering.json'));
const published = buildPublishedResourceFeatureIndex({ artifacts: overlayPublishedCardResources(staged.artifacts, current),
  engineering, cardReader: readPublishedLearnerCardByToken, infographTokens: new Set() });
const catalogCards = [];
for (const row of inventory.cards) {
  const feature = published.resources.find((r) => r.identity.resourceId === row.resourceId)!;
  assert(feature?.executable && feature.recommendable, row.name);
  assert.deepEqual(feature.canonicalIds, [row.canonicalId]);
  assert.equal(feature.sourcePath, `content:${row.cardSha256}`);
  assert.equal(projectionSha256(readFileSync(join(graph, 'cards/authority/nodes', `${row.cardId}.md`), 'utf8')), row.cardSha256);
  const detail = read(join(root, row.sources[0].path));
  const inspector = attachActiveAuthorityResourceBindings(detail);
  assert.equal(inspector.state, 'available', row.name);
  if (inspector.state === 'available') {
    const cards = inspector.items.filter((r) => r.resourceId.startsWith('act:card:'));
    assert.deepEqual(cards.map((r) => r.resourceId), [row.resourceId]);
    assert.equal(cards[0].availability, 'available');
  }
  catalogCards.push({ name: row.name, resourceId: row.resourceId, canonicalId: row.canonicalId, executable: true, recommendable: true });
}
for (const entry of retirement.entries) assert(!published.resources.some((r) => r.identity.resourceId === entry.resourceId));
const presetGoals = Object.entries(GOAL_CANONICAL_KNOWLEDGE).map(([goalId, targets]) => {
  const planned = loadGoalPlanningRegistry(goalId, root);
  return { goalId,
    missingTargetIds: targets.filter((t) => !engineering.objects.some((r: any) => r.canonicalId === t.canonicalId)).map((t) => ({ ...t })),
    batchCards: inventory.cards.filter((r: any) => planned.registry.nodes.some((n) => n.sourceRef === r.resourceId)).map((r: any) => r.name),
  };
});
const report = { status: 'passed', localRuntimeActive: true, serverPublished: false,
  bindingReleaseId: current.manifest.bindingReleaseId, bindingHash: current.manifest.bindingHash,
  newCards: catalogCards, retiredResources: retirement.entries.length, deletedFiles: retirement.entries.flatMap((r: any) => r.files).length,
  unchangedOtherBindings: unaffected(current.bindings).length, rebuildHashMatches: true, presetGoals };
writeFileSync(join(batch, 'runtime-verification.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: report.status, newCards: catalogCards.length, retiredResources: report.retiredResources,
  deletedFiles: report.deletedFiles, unchangedOtherBindings: report.unchangedOtherBindings, presetGoals }, null, 2));
