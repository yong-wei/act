import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import katex from 'katex';
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
const inventories = ['teaching-batch-01', 'teaching-batch-02'].map((name) => read(join(batch, '..', name, 'inventory.json')));
const cards = inventories.flatMap((d) => d.cards);
assert.equal(cards.length, 24);
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
  for (const source of row.sources) {
    const bytes = source.revision ? execFileSync('git', ['show', `${source.revision}:${source.path}`]) : readFileSync(join(root, source.path));
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
  const selected = cards.filter((row) => plan.mainPath.some((n) => n.resourceId === row.resourceId));
  for (const row of selected) consumed.add(row.resourceId);
  return { goalId, status: plan.status, batchCards: selected.map((r) => r.name),
    nodeIds: plan.mainPath.filter((n) => selected.some((r) => r.resourceId === n.resourceId)).map((n) => n.nodeId) };
});
const missing = cards.filter((r) => !consumed.has(r.resourceId));
assert.equal(missing.length, 0, `Not selected by any actual generated path: ${missing.map((r) => r.name).join(', ')}`);
let retiredCount = 0;
for (const name of ['teaching-batch-01', 'teaching-batch-02']) {
  const retirement = read(join(batch, '..', name, 'retirement.json'));
  for (const entry of retirement.entries) {
    retiredCount++;
    assert(!current.resources.some((r) => r.resourceId === entry.resourceId));
    for (const file of entry.files) assert(!existsSync(join(root, file.path)));
  }
}
const report = { status: 'passed', localRuntime: true, serverPublished: false,
  projectionId: pointer.projectionId, bindingReleaseId: current.manifest.bindingReleaseId, bindingHash: current.manifest.bindingHash,
  cards: 24, executableCards: 24, inspectorCards: 24, selectedInActualGeneratedPaths: consumed.size,
  formulaCount, retiredCards: retiredCount, unknownActiveBindingEndpoints: 0, invalidGoalTargets: 0,
  learnerScenario: 'unmastered fixture, 240 minutes, explicit card preference and preference-matched route; no learner state written', goals };
writeFileSync(join(batch, 'consumption-verification.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ...report, goals: goals.map(({ nodeIds, ...rest }) => rest) }, null, 2));
