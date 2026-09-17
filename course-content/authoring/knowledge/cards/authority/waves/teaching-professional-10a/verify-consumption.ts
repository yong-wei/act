import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import katex from 'katex';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { createGovernedRehypeKatexOptions } from '@/lib/governed-math';
import { projectionSha256 } from '@/lib/teaching-projection/hash';
import { loadStagedTeachingProjection, resolveTeachingProjectionStorePaths } from '@/lib/teaching-projection/store';
import { loadCurrentResourceBindingRelease, loadResourceBindingSources, buildResourceBindingRelease } from '@/lib/resource-binding-release';
import { overlayPublishedCardResources } from '@/lib/resource-binding-release/project-teaching-bindings';
import { buildPublishedResourceFeatureIndex } from '@/lib/published-resource-index';
import { readPublishedLearnerCardByToken } from '@/lib/authority-domain-shards/learning-content';
import { attachActiveAuthorityResourceBindings } from '@/lib/authority-domain-shards/resource-bindings';
import { loadGoalPlanningRegistry } from '@/features/personalization/path-planning/planning-projection-index';
import { GOAL_CANONICAL_KNOWLEDGE } from '@/features/personalization/path-planning/goal-canonical-knowledge';
import { getRegisteredAdaptiveLearningPathGoal, validateLearningGoal } from '@/features/personalization/path-planning/internal/assemble-plan';
import { planLearningPath } from '@/features/personalization/path-planning/public-api';
import { resolveActiveEngineeringGraphAuthority, resolveConfiguredAuthorityRoot } from '@/lib/authoritative-knowledge/engineering-authority-consumers';
import { resolveAuthorityStorePaths } from '@/lib/authoritative-knowledge/authority-store';

const root = process.cwd(), batch = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const acceptedScope = read(join(batch, 'accepted-scope.json'));
const currentInventory = read(join(batch, 'inventory.json'));
const currentBatchId = currentInventory.batchId;
const priorBatchIds = ['teaching-batch-01', 'teaching-batch-02', 'teaching-scale-01', 'teaching-scale-01b', 'teaching-scale-01d', 'teaching-scale-01c', 'teaching-scale-01f', 'teaching-scale-01e', 'teaching-scale-01h', 'teaching-scale-01g', 'teaching-core-01a', 'teaching-core-02a', 'teaching-core-04a', 'teaching-core-03a', 'teaching-core-06a', 'teaching-core-05a', 'teaching-core-07a', 'teaching-core-09a', 'teaching-core-08a', 'teaching-core-10a', 'teaching-core-11a', 'teaching-core-12a', 'teaching-core-13a', 'teaching-core-14a', 'teaching-core-15a', 'teaching-core-16a', 'teaching-core-17a', 'teaching-core-18a', 'teaching-core-19a', 'teaching-core-20a', 'teaching-core-21a', 'teaching-core-22a', 'teaching-core-23a', 'teaching-core-24a', 'teaching-core-25a', 'teaching-core-26a', 'teaching-core-27a', 'teaching-core-28a', 'teaching-core-29a', 'teaching-professional-01a', 'teaching-professional-02a', 'teaching-professional-03a', 'teaching-professional-04a', 'teaching-professional-05a', 'teaching-professional-06a', 'teaching-professional-07a', 'teaching-professional-08a', 'teaching-professional-09a'];
assert(!priorBatchIds.includes(currentBatchId), 'Current batch must be appended exactly once');
const batchIds = [...priorBatchIds, currentBatchId];
const inventories = batchIds.map((name) => read(join(batch, '..', name, 'inventory.json')));
const cards = inventories.flatMap((d) => d.cards);
const recoveryFiles = batchIds
  .flatMap((name) => read(join(batch, '..', name, 'retirement.json')).entries.flatMap((entry: any) => entry.files));
const recoveredSources: Array<{ path: string; recoveryPath: string; sha256: string }> = [];
const currentBatch = inventories.find((inventory) => inventory.batchId === currentBatchId);
assert(currentBatch);
assert.deepEqual(currentBatch.cards.map((c: any) => c.canonicalId).sort(), acceptedScope.cards.map((c: any) => c.canonicalId).sort());
const priorCards = inventories.filter((inventory) => inventory.batchId !== currentBatchId).flatMap((d) => d.cards);
assert.equal(cards.length, priorCards.length + acceptedScope.cards.length);
assert.equal(new Set(cards.map((c: any) => c.canonicalId)).size, cards.length);
const graph = join(root, 'course-content/runtime/knowledge');
const authority = read(join(root, 'course-content/authoring/knowledge/authority/current.json'));
const engineering = read(join(root, 'course-content/authoring/knowledge/authority/releases', authority.snapshotId, 'engineering.json'));
const strictAuthority = resolveActiveEngineeringGraphAuthority(resolveAuthorityStorePaths(resolveConfiguredAuthorityRoot(root)));
assert.equal(strictAuthority.status, 'ready', strictAuthority.reason ?? 'Strict Authority load failed');
const ids = new Set<string>(engineering.objects.map((r: any) => r.canonicalId));
const current = loadCurrentResourceBindingRelease(root)!;
const pointer = read(join(graph, 'projection/current.json'));
const projection = loadStagedTeachingProjection(resolveTeachingProjectionStorePaths(join(graph, 'projection')), pointer.projectionId);
assert(projection.artifacts.bindings.every((b) => ids.has(b.canonicalId)));
assert(current.bindings.every((b) => ids.has(b.canonicalId)));
const rebuilt = buildResourceBindingRelease(loadResourceBindingSources(root), { bindingRevision: current.manifest.bindingRevision });
assert.equal(rebuilt.manifest.bindingHash, current.manifest.bindingHash);
const published = buildPublishedResourceFeatureIndex({ artifacts: overlayPublishedCardResources(projection.artifacts, current), engineering,
  cardReader: readPublishedLearnerCardByToken, infographTokens: new Set() });
let formulaCount = 0;
for (const row of cards) {
  assert(ids.has(row.canonicalId));
  const body = readFileSync(join(root, row.authoringPath), 'utf8');
  assert.equal(projectionSha256(body), row.cardSha256);
  const sourceBlock = body.split('source_docs:\n')[1]?.split('asset_refs:')[0] ?? '';
  const declared = [...sourceBlock.matchAll(/^  - "?([^"\n]+)"?$/gmu)].map((match) => {
    const value = match[1];
    const historical = /^git:([0-9a-f]{40}):(.+)$/u.exec(value);
    if (!historical) return value;
    assert(row.sources.some((source: any) => source.path === historical[2] && source.revision === historical[1]), row.name);
    return historical[2];
  });
  assert.deepEqual(declared.sort(), row.sources.map((source: any) => source.path).sort(), `Declared source mismatch: ${row.name}`);
  for (const source of row.sources) {
    let bytes: Buffer;
    if (source.revision) bytes = execFileSync('git', ['show', `${source.revision}:${source.path}`]);
    else if (existsSync(join(root, source.path))) bytes = readFileSync(join(root, source.path));
    else {
      const recovery = recoveryFiles.find((file: any) => file.path === source.path && file.sha256 === source.sha256);
      assert(recovery, `No exact retired-source recovery: ${source.path}`);
      bytes = readFileSync(join(root, recovery.recoveryPath));
      recoveredSources.push({ path: source.path, recoveryPath: recovery.recoveryPath, sha256: source.sha256 });
    }
    assert.equal(projectionSha256(bytes), source.sha256);
  }
  for (const match of body.matchAll(/\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$/gu)) {
    katex.renderToString(match[1] ?? match[2], { displayMode: match[1] !== undefined, throwOnError: true, trust: false });
    formulaCount++;
  }
  const feature = published.resources.find((r) => r.identity.resourceId === row.resourceId);
  assert(feature?.recommendable && feature.executable, row.name);
  assert.deepEqual(feature.canonicalIds, [row.canonicalId]);
  const card = readPublishedLearnerCardByToken(row.cardId, `content:${row.cardSha256}`);
  assert(card && card.explanation.length > 500 && card.explanation.includes('自检'), row.name);
  for (const text of [card.summary, card.explanation]) {
    const html = renderToStaticMarkup(createElement(ReactMarkdown, {
      remarkPlugins: [remarkGfm, remarkMath],
      rehypePlugins: [[rehypeKatex, createGovernedRehypeKatexOptions()]],
    }, text));
    assert(!html.includes('katex-error'), `Parsed Markdown math rendering failed: ${row.name}`);
  }
  const inspector = attachActiveAuthorityResourceBindings(read(join(root, row.sources[0].path)));
  assert(inspector.state === 'available');
  assert(inspector.items.some((r) => r.resourceId === row.resourceId && r.availability === 'available'));
}
const consumed = new Set<string>();
const goals = Object.entries(GOAL_CANONICAL_KNOWLEDGE).map(([goalId, targets]) => {
  assert(targets.every((target) => ids.has(target.canonicalId)), goalId);
  const goal = getRegisteredAdaptiveLearningPathGoal(goalId)!;
  assert(goal && validateLearningGoal(goal.learningGoal).length === 0);
  const p = loadGoalPlanningRegistry(goalId);
  const plan = planLearningPath({ studentId: 'card-consumption-validation-fixture', goal: goal.goal, learnerState: null,
    registry: p.registry, planningScope: { knowledgeIds: p.universe.knowledgeIds, edges: p.universe.edges },
    constraints: { timeBudgetMinutes: 240, privacyScopes: ['student-visible'] },
    resourcePreferences: ['knowledge_card'], resourcePreferenceSource: 'request', preferredStyleId: 'preference-matched-route', policyFamily: 'foundation-remediation' });
  assert.equal(plan.status, 'ready', goalId);
  assert(plan.mainPath.length <= 12, goalId);
  const selected = cards.filter((row) => plan.mainPath.some((n) => n.resourceId === row.resourceId));
  for (const row of selected) consumed.add(row.resourceId);
  return { goalId, status: plan.status, batchCards: selected.map((r) => r.name),
    nodeIds: plan.mainPath.filter((n) => selected.some((r) => r.resourceId === n.resourceId)).map((n) => n.nodeId) };
});
// A long goal cannot put every resource in one 12-step path. Test each remaining
// card in a remediation scenario whose other knowledge is already mastered.
const remediationScenarios = [];
for (const card of cards.filter((r) => !consumed.has(r.resourceId))) {
  for (const goalId of Object.keys(GOAL_CANONICAL_KNOWLEDGE)) {
    const p = loadGoalPlanningRegistry(goalId);
    if (!p.universe.knowledgeIds.includes(card.canonicalId)) continue;
    const goal = getRegisteredAdaptiveLearningPathGoal(goalId)!;
    const tags = Object.fromEntries(p.universe.knowledgeIds.filter((id) => id !== card.canonicalId)
      .map((id) => [id, { posteriorMastery: 1, confidence: 1, evidenceCount: 20 }]));
    const plan = planLearningPath({ studentId: 'card-remediation-validation-fixture', goal: goal.goal,
      learnerState: { knowledgeMastery: { tags } }, registry: p.registry,
      planningScope: { knowledgeIds: p.universe.knowledgeIds, edges: p.universe.edges },
      constraints: { timeBudgetMinutes: 240, privacyScopes: ['student-visible'] },
      resourcePreferences: ['knowledge_card'], resourcePreferenceSource: 'request',
      preferredStyleId: 'preference-matched-route', policyFamily: 'foundation-remediation' });
    assert(plan.mainPath.length <= 12, goalId);
    if (plan.status === 'ready' && plan.mainPath.some((n) => n.resourceId === card.resourceId)) {
      consumed.add(card.resourceId);
      remediationScenarios.push({ canonicalId: card.canonicalId, resourceId: card.resourceId, goalId, status: plan.status });
      break;
    }
  }
}
const missing = cards.filter((r) => !consumed.has(r.resourceId));
assert.equal(missing.length, 0, `Not selected by any actual generated path: ${missing.map((r) => r.name).join(', ')}`);
let retiredCount = 0;
for (const name of batchIds) {
  const retirement = read(join(batch, '..', name, 'retirement.json'));
  if (name === currentBatchId) {
    assert.equal(retirement.status, 'completed');
    const receipt = read(join(batch, 'integration.json'));
    assert.equal(projectionSha256(readFileSync(join(batch, 'inventory.json'), 'utf8')), receipt.inventoryDigest);
    assert.deepEqual(receipt.batchCanonicalIds, currentBatch.cards.map((c: any) => c.canonicalId).sort());
  }
  for (const entry of retirement.entries) {
    retiredCount++;
    assert(!current.resources.some((r) => r.resourceId === entry.resourceId));
    for (const file of entry.files) assert(!existsSync(join(root, file.path)));
  }
}
const report = { status: 'passed', localRuntime: true, serverPublished: false,
  projectionId: pointer.projectionId, bindingReleaseId: current.manifest.bindingReleaseId, bindingHash: current.manifest.bindingHash,
  cards: cards.length, executableCards: cards.length, inspectorCards: cards.length, selectedInActualGeneratedPaths: consumed.size,
  formulaCount, renderedMarkdownCards: cards.length, recoveredSources, retiredCards: retiredCount, unknownActiveBindingEndpoints: 0, invalidGoalTargets: 0,
  learnerScenario: 'unmastered fixture, 240 minutes, explicit card preference and preference-matched route; no learner state written', remediationScenarios, goals };
writeFileSync(join(batch, 'consumption-verification.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ...report, goals: goals.map(({ nodeIds, ...rest }) => rest) }, null, 2));
