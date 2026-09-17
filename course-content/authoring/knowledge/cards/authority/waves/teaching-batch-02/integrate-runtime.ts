/** Rebase resource projections onto the current Authority without remapping learner facts. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTeachingProjection } from '@/lib/teaching-projection/builder';
import type { TeachingProjectionAuthoringInput } from '@/lib/teaching-projection/contracts';
import { resolveTeachingProjectionStorePaths, stageTeachingProjectionArtifacts, activateTeachingProjection } from '@/lib/teaching-projection/store';
import { loadResourceBindingSources, buildResourceBindingRelease, nextBindingRevision, authorityRevisionLabel, resourceBindingRuntimeDir, writeResourceBindingRelease, writeResourceBindingCurrentPointer, loadResourceBindingRelease } from '@/lib/resource-binding-release';

const root = process.cwd();
const batch = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const jsonl = (path: string) => readFileSync(path, 'utf8').split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
const write = (path: string, data: unknown) => writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
const graph = join(root, 'course-content/runtime/knowledge');
const authority = read(join(root, 'course-content/authoring/knowledge/authority/current.json'));
const engineering = read(join(root, 'course-content/authoring/knowledge/authority/releases', authority.snapshotId, 'engineering.json'));
const endpoints = new Set<string>(engineering.objects.map((r: { canonicalId: string }) => r.canonicalId));
const replacement = read(join(root, 'course-content/authoring/knowledge/resource-bindings/card-replacements.json'));
const sources = loadResourceBindingSources(root); // validates all 24 current card hashes and endpoints
assert.equal(replacement.rows.length, 24);
const before = read(join(graph, 'projection/current.json'));
const receiptPath = join(batch, 'integration.json');
if (existsSync(receiptPath)) {
  const receipt = read(receiptPath);
  if (receipt.status === 'local-runtime-active') {
    assert.equal(before.projectionId, receipt.projectionId, 'Active projection changed; use a new integration batch');
    const binding = loadResourceBindingRelease(root, receipt.bindingReleaseId);
    assert.equal(binding.manifest.bindingHash, receipt.bindingHash);
    assert.equal(binding.manifest.sourceHashes.cardReplacements, sources.cardReplacements?.digest);
    console.log('Already integrated; preserved original quarantine and activation evidence.');
    process.exit(0);
  }
}
const oldDir = join(graph, 'projection/releases', before.projectionId);
const retired = new Set<string>(replacement.rows.flatMap((r: { retiredResourceIds: string[] }) => r.retiredResourceIds));
const newIds = new Set<string>(replacement.rows.map((r: { cardId: string }) => `act:card:${r.cardId}`));
const quarantine = sources.carryForward.bindings.filter((b) => !endpoints.has(b.canonicalId));
const retainedBindings = sources.carryForward.bindings.filter((b) => endpoints.has(b.canonicalId) && !retired.has(b.resourceId) && !newIds.has(b.resourceId));
const boundIds = new Set(retainedBindings.map((b) => b.resourceId));
const orphaned = sources.carryForward.resources.filter((r) => r.bindingCount > 0 && !boundIds.has(r.resourceId) && !retired.has(r.resourceId) && !newIds.has(r.resourceId));
const orphanedIds = new Set(orphaned.map((r) => r.resourceId));
const oldCards = read(join(oldDir, 'cards-index.json')).cards;
const replacementTargets = new Set<string>(replacement.rows.map((r: { canonicalId: string }) => r.canonicalId));
const prerequisites = jsonl(join(oldDir, 'prerequisites.jsonl'));
const coreNodes = read(join(oldDir, 'core-nodes.json')).nodes;
assert(prerequisites.every((r) => endpoints.has(r.sourceCanonicalId) && endpoints.has(r.targetCanonicalId)));
assert(coreNodes.every((r: { canonicalId: string }) => endpoints.has(r.canonicalId)));
const input: TeachingProjectionAuthoringInput = {
  scopeId: sources.scopeId, authoringRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  authorityReleaseId: authority.releaseId, authorityReleaseSetId: authority.releaseSetId,
  authoritySnapshotId: authority.snapshotId, authoritySnapshotHash: authority.snapshotHash,
  authorityNodes: engineering.objects.map((r: { canonicalId: string; lifecycleStatus: string | null }) => ({ canonicalId: r.canonicalId, lifecycleStatus: r.lifecycleStatus ?? '' })),
  resources: [
    ...sources.carryForward.resources.filter((r) => !retired.has(r.resourceId) && !newIds.has(r.resourceId)).map((r) => ({ ...r, projectionMode: orphanedIds.has(r.resourceId) ? 'NONE' as const : r.projectionMode })),
    ...replacement.rows.map((r: { cardId: string; canonicalId: string; title: string; sha256: string }) => ({ resourceId: `act:card:${r.cardId}`, resourceType: 'card' as const,
      projectionMode: 'REQUIRED' as const, scopeId: sources.scopeId, sourcePath: `content:${r.sha256}`, title: r.title,
      knowledgeRefs: [{ canonicalId: r.canonicalId, role: 'EXPLAINS' as const, primary: true }] })),
  ],
  bindings: retainedBindings, prerequisites, coreNodes,
  cards: [...oldCards.filter((r: { canonicalId: string; resourceId: string }) => endpoints.has(r.canonicalId) && !replacementTargets.has(r.canonicalId) && !retired.has(r.resourceId)),
    ...replacement.rows.map((r: { cardId: string; canonicalId: string; title: string; sha256: string }) => ({ cardId: r.cardId, canonicalId: r.canonicalId, title: r.title, sourcePath: `content:${r.sha256}`, active: true, required: false }))],
};
const artifacts = buildTeachingProjection(input);
assert(artifacts.gate.passed, JSON.stringify(artifacts.gate.findings.filter((r) => r.severity === 'error').slice(0, 5)));
assert.deepEqual(artifacts.prerequisites, prerequisites);
assert(artifacts.bindings.every((b) => endpoints.has(b.canonicalId)));
const paths = resolveTeachingProjectionStorePaths(join(graph, 'projection'));
const staged = stageTeachingProjectionArtifacts(paths, artifacts);
sources.carryForward = { projectionId: staged.projectionId, manifest: artifacts.manifest, resources: artifacts.resources, bindings: artifacts.bindings,
  resourcesRaw: readFileSync(join(staged.releaseDir, 'resources.jsonl'), 'utf8'), bindingsRaw: readFileSync(join(staged.releaseDir, 'bindings.jsonl'), 'utf8') };
const revision = nextBindingRevision(resourceBindingRuntimeDir(root), authorityRevisionLabel(authority.releaseId, authority.releaseSetId));
const built = buildResourceBindingRelease(sources, { bindingRevision: revision });
assert(built.gate.passed);
assert(built.bindings.every((b) => endpoints.has(b.canonicalId)), 'Binding rebuild reintroduced unknown endpoints');
writeResourceBindingRelease(root, built);
loadResourceBindingRelease(root, built.manifest.bindingReleaseId);
const rows = quarantine.map((binding) => JSON.stringify({ reason: 'endpoint-absent-from-current-authority', originalProjectionId: before.projectionId, binding }));
const quarantinePath = join(batch, 'quarantined-bindings.jsonl');
writeFileSync(quarantinePath, '');
for (let start = 0; start < rows.length; start += 300) appendFileSync(quarantinePath, `${rows.slice(start, start + 300).join('\n')}\n`);
write(join(batch, 'quarantined-card-index.json'), oldCards.filter((r: { canonicalId: string }) => !endpoints.has(r.canonicalId)));
const activated = process.argv.includes('--activate');
if (activated) {
  const result = activateTeachingProjection(paths, { projectionId: staged.projectionId, activatedAt: new Date().toISOString() });
  assert.equal(result.status, 'activated');
  const overlay = read(join(graph, 'teaching-projection/domain-fragments/current.json'));
  const sidecarPath = join(graph, 'teaching-projection/domain-fragments/releases', overlay.projectionId, 'inspector-sidecar.json');
  const sidecar = read(sidecarPath);
  assert.equal(sidecar.courseProjectionId, before.projectionId);
  write(sidecarPath, { ...sidecar, courseProjectionId: staged.projectionId, courseProjectionHash: staged.projectionHash });
  writeResourceBindingCurrentPointer(root, built.manifest);
}
const report = { status: activated ? 'local-runtime-active' : 'staged', serverPublished: false,
  previousProjectionId: before.projectionId, projectionId: staged.projectionId, projectionHash: staged.projectionHash,
  bindingReleaseId: built.manifest.bindingReleaseId, bindingHash: built.manifest.bindingHash,
  isolatedBindingCount: quarantine.length, isolatedCanonicalCount: new Set(quarantine.map((r) => r.canonicalId)).size,
  isolatedCardIndexCount: oldCards.filter((r: { canonicalId: string }) => !endpoints.has(r.canonicalId)).length,
  explicitlyUnprojectedResources: orphaned.map((r) => r.resourceId),
  teachingGate: artifacts.gate.status, bindingGate: built.gate.status, unknownActiveEndpoints: 0, newCards: 24,
  teachingPrerequisitesChanged: false, learnerFactsChanged: false };
write(join(batch, 'integration.json'), report);
console.log(JSON.stringify({ ...report, explicitlyUnprojectedResources: orphaned.length }, null, 2));
