/** Build and verify this content batch without changing any active pointer. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import katex from 'katex';
import { buildTeachingProjection } from '@/lib/teaching-projection/builder';
import type { TeachingProjectionAuthoringInput } from '@/lib/teaching-projection/contracts';
import { resolveTeachingProjectionStorePaths, stageTeachingProjectionArtifacts } from '@/lib/teaching-projection/store';
import { buildResourceBindingRelease, loadResourceBindingSources, writeResourceBindingRelease, loadResourceBindingRelease } from '@/lib/resource-binding-release';
import { readPublishedLearnerCardByToken } from '@/lib/authority-domain-shards/learning-content';
import { resolveBindingViewerContent } from '@/lib/authority-domain-shards/binding-viewer-content';
import { sliceGoalPlanningUniverse, buildGoalPlanningRegistry } from '@/features/personalization/path-planning/planning-projection-index';
import { GOAL_CANONICAL_KNOWLEDGE } from '@/features/personalization/path-planning/goal-canonical-knowledge';

const root = process.cwd();
const batch = dirname(fileURLToPath(import.meta.url));
const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const jsonl = (file: string) => readFileSync(file, 'utf8').split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
const write = (file: string, data: unknown) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
};
const inventory = read(join(batch, 'inventory.json'));
const delta = read(join(batch, 'teaching-input.json')) as TeachingProjectionAuthoringInput;
const graph = join(root, 'course-content/runtime/knowledge');
const authority = read(join(root, 'course-content/authoring/knowledge/authority/current.json'));
const shard = read(join(graph, 'authority-domain-shards/current.json'));
const sourceHashes = new Map<string, { sha256: string; revision?: string }>();
const sourceBytes = (file: string, revision?: string) => revision
  ? execFileSync('git', ['show', `${revision}:${file}`])
  : readFileSync(join(root, file));
for (const key of ['releaseId', 'snapshotId', 'snapshotHash']) {
  assert.equal(authority[key], inventory.authority[key], `Authority drift: ${key}`);
  assert.equal(shard[key], authority[key], `Shard drift: ${key}`);
}
assert.equal(delta.authorityReleaseSetId, authority.releaseSetId);
const pointerPaths = [
  'authority-domain-shards/current.json', 'projection/current.json',
  'resource-bindings/current.json', 'consumer-activation/current.json',
  'teaching-projection/domain-fragments/current.json',
].map((p) => join(graph, p));
const pointersBefore = pointerPaths.map((p) => sha(readFileSync(p)));
const engineeringPath = join(root, 'course-content/authoring/knowledge/authority/releases', authority.snapshotId, 'engineering.json');
const engineering = read(engineeringPath);
const endpoints = new Map<string, any>(engineering.objects.map((n: any) => [n.canonicalId, n]));
const cardIds = new Set<string>();
const canonicalIds = new Set<string>();
assert.equal(inventory.cards.length, 12);
assert.equal(delta.resources?.length, 12);
assert.equal(delta.cards?.length, 12);
for (const row of inventory.cards) {
  assert(!cardIds.has(row.cardId) && !canonicalIds.has(row.canonicalId), 'Duplicate card or target');
  cardIds.add(row.cardId);
  canonicalIds.add(row.canonicalId);
  const endpoint = endpoints.get(row.canonicalId);
  assert(endpoint && endpoint.canonicalType === 'DomainConcept', row.name);
  assert.equal(endpoint.reviewStatus, 'approved');
  assert.equal(endpoint.publicationStatus, 'published');
  assert(!['retired', 'draft'].includes(endpoint.lifecycleStatus));
  const raw = readFileSync(join(root, row.authoringPath));
  assert.equal(sha(raw), row.cardSha256, `Card changed: ${row.name}`);
  const resource = delta.resources!.find((r) => r.resourceId === row.resourceId)!;
  assert.equal(resource?.sourcePath, `content:${row.cardSha256}`);
  assert.deepEqual(resource.knowledgeRefs?.map((r) => r.canonicalId), [row.canonicalId]);
  assert(raw.toString().includes(`authority_entity_id: "${row.canonicalId}"`));
  for (const source of row.sources) {
    assert.equal(sha(sourceBytes(source.path, source.revision)), source.sha256, `Source drift: ${source.path}`);
    sourceHashes.set(source.path, { sha256: source.sha256, revision: source.revision });
  }
}

// Rebuild a complete candidate projection, preserving all unrelated records and teaching edges.
const sources = loadResourceBindingSources(root);
const current = read(join(graph, 'projection/current.json'));
const liveDir = join(graph, 'projection/releases', current.projectionId);
const liveCards = read(join(liveDir, 'cards-index.json')).cards;
const liveCore = read(join(liveDir, 'core-nodes.json')).nodes;
const livePrerequisites = jsonl(join(liveDir, 'prerequisites.jsonl'));
const resourceIds = new Set(delta.resources!.map((r) => r.resourceId));
const input: TeachingProjectionAuthoringInput = {
  ...delta,
  resources: [...sources.carryForward.resources.filter((r) => !resourceIds.has(r.resourceId)), ...delta.resources!],
  bindings: sources.carryForward.bindings.filter((b) => !resourceIds.has(b.resourceId)),
  // Existing alternate resources remain available; only the canonical primary card index is replaced.
  cards: [...liveCards.filter((c: any) => !canonicalIds.has(c.canonicalId)), ...delta.cards!],
  coreNodes: liveCore,
  prerequisites: livePrerequisites,
  authorityNodes: engineering.objects.map((n: any) => ({
    canonicalId: n.canonicalId, lifecycleStatus: n.lifecycleStatus ?? '',
    successorCanonicalId: n.successorCanonicalId ?? null,
  })),
};
const fullProjection = buildTeachingProjection(input);
const fullErrors = fullProjection.gate.findings.filter((f) => f.severity === 'error');
const baseline = buildTeachingProjection({
  ...input, resources: sources.carryForward.resources, bindings: sources.carryForward.bindings,
  cards: liveCards,
});
const baselineErrors = baseline.gate.findings.filter((f) => f.severity === 'error');
const baselineKeys = new Set(baselineErrors.map((f) => `${f.code}|${f.canonicalId}|${f.resourceId}`));
assert(fullErrors.every((f) => baselineKeys.has(`${f.code}|${f.canonicalId}|${f.resourceId}`)), 'Batch introduced a new integration failure');
const integration = {
  status: fullProjection.gate.passed ? 'passed' : 'blocked-by-existing-projection',
  errorCount: fullErrors.length,
  baselineErrorCount: baselineErrors.length,
  newErrorCount: 0,
  unknownCanonicalCount: new Set(fullErrors.map((f) => f.canonicalId).filter(Boolean)).size,
  errorCodes: [...new Set(fullErrors.map((f) => f.code))],
  examples: fullErrors.slice(0, 5),
};
// This package is deliberately batch-scoped, never an activation replacement.
const projection = buildTeachingProjection({
  ...delta, authorityNodes: input.authorityNodes,
  coreNodes: liveCore.filter((n: any) => canonicalIds.has(n.canonicalId)),
  prerequisites: [],
});
assert(projection.gate.passed, JSON.stringify(projection.gate.findings.filter((f) => f.severity === 'error').slice(0, 5)));
assert.equal(projection.prerequisites.length, 0, 'Batch must not author teaching edges');
const output = resolve(root, '.cache/knowledge-card-batches', `teaching-batch-01-${projection.manifest.projectionHash}`);
const staged = stageTeachingProjectionArtifacts(resolveTeachingProjectionStorePaths(join(output, 'course-content/runtime/knowledge/projection')), projection);
sources.carryForward = {
  projectionId: staged.projectionId, manifest: projection.manifest,
  resources: projection.resources, bindings: projection.bindings,
  resourcesRaw: readFileSync(join(staged.releaseDir, 'resources.jsonl'), 'utf8'),
  bindingsRaw: readFileSync(join(staged.releaseDir, 'bindings.jsonl'), 'utf8'),
};
// No lesson or media bindings are regenerated in this batch-only contract check.
sources.anchors = new Map();
sources.lessons = new Map();
sources.unitScopes = new Map();
sources.crosswalk = [];
sources.review = [];
sources.ambiguousLabels = [];
sources.unitOrder = [];
sources.activeMedia = { runtimeReleaseId: null, files: [] };
sources.raw = { anchors: '', unitScopes: '', crosswalk: '', review: '', courseOrder: '', activeRuntimeMediaIndex: '' };
const bound = buildResourceBindingRelease(sources, { bindingRevision: 2 });
assert(bound.gate.passed, JSON.stringify(bound.gate.findings.filter((f) => f.severity === 'error').slice(0, 5)));
writeResourceBindingRelease(output, bound);
const loaded = loadResourceBindingRelease(output, bound.manifest.bindingReleaseId);
const readback = [];
for (const row of inventory.cards) {
  const target = join(output, 'course-content/runtime/knowledge/cards/authority/nodes', `${row.cardId}.md`);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, readFileSync(join(root, row.authoringPath)));
  const text = readFileSync(target, 'utf8');
  let formulaCount = 0;
  for (const match of text.matchAll(/\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$/gu)) {
    katex.renderToString(match[1] ?? match[2], { displayMode: match[1] !== undefined, throwOnError: true, trust: false });
    formulaCount += 1;
  }
  const resource = loaded.resources.find((r) => r.resourceId === row.resourceId)!;
  const bindings = loaded.bindings.filter((b) => b.resourceId === row.resourceId);
  assert.equal(resource.sourcePath, `content:${row.cardSha256}`);
  assert.deepEqual(bindings.map((b) => b.canonicalId), [row.canonicalId]);
  assert.equal(bindings[0].anchor.kind, 'whole');
  process.chdir(output);
  try {
    const card = readPublishedLearnerCardByToken(row.cardId, resource.sourcePath);
    assert(card && card.explanation.length > 500, `Unreadable or thin card: ${row.name}`);
    assert(card.explanation.includes('自检') && card.explanation.includes('核对要点'));
    assert(!/(?:ctkg:|ctc:|course-content\/)/u.test(card.explanation));
    assert(resolveBindingViewerContent(resource));
    assert.equal(readPublishedLearnerCardByToken(row.cardId, `content:${'0'.repeat(64)}`), null);
    readback.push({ name: row.name, canonicalId: row.canonicalId, resourceId: row.resourceId, cardSha256: row.cardSha256, explanationChars: card.explanation.length, formulaCount });
  } finally {
    process.chdir(root);
  }
}

// Exercise the actual path adapter, using unchanged goal membership and prerequisite edges.
const planning = Object.keys(GOAL_CANONICAL_KNOWLEDGE).map((goalId) => {
  const universe = sliceGoalPlanningUniverse({
    goalId, projectionId: projection.manifest.projectionId, projectionHash: projection.manifest.projectionHash,
    snapshotId: authority.snapshotId, snapshotHash: authority.snapshotHash,
    authorityReleaseId: authority.releaseId, bindingReleaseId: bound.manifest.bindingReleaseId,
    bindingHash: bound.manifest.bindingHash,
    resources: loaded.resources.map((r) => ({ ...r, bindingDigest: bound.manifest.bindingHash, projectionStatus: 'BOUND' })),
    bindings: loaded.bindings, edges: livePrerequisites,
  });
  const nodes = buildGoalPlanningRegistry(universe).nodes.filter((n) => resourceIds.has(n.sourceRef));
  for (const node of nodes) {
    assert.equal(node.type, 'knowledge_card');
    assert(node.launchTarget?.includes('/learning-resources/'));
  }
  return { goalId, batchResourceIds: [...new Set(nodes.map((n) => n.sourceRef))] };
});
assert(planning.some((p) => p.batchResourceIds.length > 0), 'No existing goal can use this batch');
assert.deepEqual(pointerPaths.map((p) => sha(readFileSync(p))), pointersBefore, 'Active pointers changed');
for (const [file, source] of sourceHashes) assert.equal(sha(sourceBytes(file, source.revision)), source.sha256);
const report = {
  status: 'batch-candidate-verified', candidateScope: '12 cards only; must not activate as the full course', activated: false, deployed: false,
  fullCourseIntegration: integration,
  capturedRevision: inventory.capturedRevision,
  verifiedRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  authoringContentIdentity: 'inventory cardSha256 and source sha256; includes uncommitted authored content',
  authorityReleaseId: authority.releaseId, snapshotId: authority.snapshotId, snapshotHash: authority.snapshotHash,
  baseProjectionId: current.projectionId,
  candidateProjectionId: projection.manifest.projectionId,
  candidateBindingReleaseId: bound.manifest.bindingReleaseId, candidateBindingHash: bound.manifest.bindingHash,
  candidateRoot: relative(root, output),
  teachingGate: projection.gate.status, bindingGate: bound.gate.status,
  cardCount: readback.length, readback, planning,
  checks: ['exact current Authority endpoints', 'source and card hashes', 'no teaching edges authored', 'immutable batch candidate stores', '12 exact whole-card bindings', 'real card parser and viewer resolver', 'wrong content hash rejected', 'existing goal path adapter with existing prerequisites', 'active pointers unchanged'],
};
write(join(batch, 'verification.json'), report);
console.log(JSON.stringify({ status: report.status, cards: readback.length, teachingGate: report.teachingGate, bindingGate: report.bindingGate, planning: planning.map((p) => ({ goalId: p.goalId, cards: p.batchResourceIds.length })), candidateRoot: report.candidateRoot }, null, 2));
