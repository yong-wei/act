import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type JsonRecord = Record<string, any>;

const repoRoot = process.cwd();
const governanceDir = join(repoRoot, 'course-content/runtime/resource-governance');
const scopeFamilies = new Set(['registered-resource', 'knowledge-card', 'knowledge-infograph']);

function readJsonl(path: string): JsonRecord[] {
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as JsonRecord);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const auditRows = readJsonl(join(governanceDir, 'resource-field-completion-audit.jsonl'));
const workqueueItems = readJsonl(join(governanceDir, 'core-registered-knowledge-resource-semantic-workqueue-items.jsonl'));
const reviewSourceItems = readJsonl(join(
  repoRoot,
  'openspec/changes/complete-core-registered-knowledge-resource-semantics/evidence/core-registered-knowledge-resource-semantic-review-source.jsonl',
));
const reviewItems = readJsonl(join(governanceDir, 'core-registered-knowledge-resource-semantic-review-items.jsonl'));
const summary = JSON.parse(
  readFileSync(join(governanceDir, 'core-registered-knowledge-resource-semantic-summary.json'), 'utf8'),
) as JsonRecord;

const scopedAuditRows = auditRows.filter((row) => scopeFamilies.has(row.family));
const scopedIds = new Set(scopedAuditRows.map((row) => row.resourceId));
const workqueueIds = new Set(workqueueItems.map((item) => item.resourceId));
const reviewSourceIds = new Set(reviewSourceItems.map((item) => item.resourceId));
const reviewIds = new Set(reviewItems.map((item) => item.resourceId));

assert(scopedAuditRows.length === 608, 'scoped denominator must remain 608 resources');
assert(workqueueItems.length === scopedAuditRows.length, 'workqueue must include every scoped row');
assert(reviewSourceItems.length === scopedAuditRows.length, 'review source must include every scoped row');
assert(reviewItems.length === scopedAuditRows.length, 'review items must include every scoped row');
assert(workqueueItems.every((item) => scopedIds.has(item.resourceId)), 'workqueue includes out-of-scope resource');
assert(reviewSourceItems.every((item) => scopedIds.has(item.resourceId)), 'review source includes out-of-scope resource');
assert(reviewItems.every((item) => scopedIds.has(item.resourceId)), 'review includes out-of-scope resource');
assert(scopedAuditRows.every((row) => workqueueIds.has(row.resourceId)), 'workqueue misses scoped audit row');
assert(scopedAuditRows.every((row) => reviewSourceIds.has(row.resourceId)), 'review source misses scoped audit row');
assert(scopedAuditRows.every((row) => reviewIds.has(row.resourceId)), 'review misses scoped audit row');

assert(summary.totals.scopedResources === 608, 'summary scoped resource count mismatch');
assert(summary.totals.reviewedResources === 608, 'summary reviewed resource count mismatch');
assert(summary.totals.remainingSemanticReviewBlockers === 0, 'semantic review blockers must be closed');
assert(summary.totals.unexplainedRemainingItems === 0, 'remaining items must be explained');
assert(summary.totals.rawContentIncluded === false, 'review artifact must not include raw resource content');
assert(summary.totals.privacyMinimized === true, 'review artifact must be privacy-minimized');
assert(summary.bySourceFamily['registered-resource'] === 168, 'registered resource count mismatch');
assert(summary.bySourceFamily['knowledge-card'] === 279, 'knowledge-card count mismatch');
assert(summary.bySourceFamily['knowledge-infograph'] === 161, 'knowledge-infograph count mismatch');
assert(summary.byDisposition['path-plannable'] === 2, 'only source-backed path-ready resources may be path-plannable');
assert(summary.byDisposition['supporting-citation'] === 277, 'supporting knowledge-card count mismatch');
assert(summary.byDisposition['embedded-asset'] === 161, 'embedded infograph count mismatch');
assert(summary.byDisposition['evidence-producing'] === 168, 'registered resource evidence-producing count mismatch');

const auditById = new Map(scopedAuditRows.map((row) => [row.resourceId, row]));
const reviewSourceById = new Map(reviewSourceItems.map((item) => [item.resourceId, item]));
const rationaleSet = new Set<string>();
for (const item of reviewItems) {
  const audit = auditById.get(item.resourceId);
  assert(audit, `${item.resourceId} missing audit row`);
  const source = reviewSourceById.get(item.resourceId);
  assert(source, `${item.resourceId} missing review source row`);
  assert(item.reviewBatchId === 'core-registered-knowledge-resource-semantics-2026-07-09', `${item.resourceId} batch mismatch`);
  assert(item.reviewerId === 'core-registered-knowledge-resource-implementing-agent', `${item.resourceId} reviewer mismatch`);
  assert(item.reviewerRole === 'curriculum-data-governance', `${item.resourceId} reviewer role mismatch`);
  assert(item.reviewSourceKind === 'implementing-agent-item-review', `${item.resourceId} must come from item review source`);
  assert(source.reviewSourceKind === item.reviewSourceKind, `${item.resourceId} review source kind mismatch`);
  assert(item.privacyScope === 'student-visible', `${item.resourceId} privacy policy missing`);
  assert(item.privacyMinimized === true, `${item.resourceId} must be privacy-minimized`);
  assert(item.rawContentIncluded === false, `${item.resourceId} must not include raw content`);
  assert(item.reviewerVisibleRationale?.length > 60, `${item.resourceId} missing rationale`);
  assert(item.objectiveMappingRationale?.length > 60, `${item.resourceId} missing objective rationale`);
  rationaleSet.add(item.reviewerVisibleRationale);
  assert(Array.isArray(item.residualLimitationState), `${item.resourceId} residual limitations missing`);
  assert(JSON.stringify(item.startingBlockerCodes) === JSON.stringify(audit.missingFieldCodes), `${item.resourceId} starting blockers mismatch`);
  assert(item.sourceVersionRef === audit.sourceVersionRef, `${item.resourceId} source version mismatch`);
  assert(item.sourceHash === audit.sourceHash, `${item.resourceId} source hash mismatch`);
  assert(item.citationTargets.length === audit.citationTargets.length, `${item.resourceId} citation target count mismatch`);
  assert(item.disposition === source.disposition, `${item.resourceId} disposition must be copied from review source`);
  assert(item.evidenceBehavior === source.evidenceBehavior, `${item.resourceId} evidence behavior must be copied from review source`);
  assert(item.routeTarget === source.routeTarget, `${item.resourceId} route target must be copied from review source`);

  if (item.disposition === 'path-plannable') {
    assert(item.sourceHash?.startsWith('sha256:'), `${item.resourceId} path resource needs source hash`);
    assert(item.currentPathEligible === true, `${item.resourceId} path resource must be currently eligible`);
    assert(item.routeTarget, `${item.resourceId} path resource needs route target`);
    assert(item.evidenceBehavior === 'path-execution-evidence-only', `${item.resourceId} path resource needs path evidence policy`);
  } else {
    assert(item.currentPathEligible === false, `${item.resourceId} non-path resource must not be path eligible`);
    assert(item.routeTarget === null, `${item.resourceId} non-path resource must not expose path route`);
  }

  if (item.sourceFamily === 'knowledge-card') {
    assert(item.sourceHash?.startsWith('sha256:'), `${item.resourceId} knowledge card needs current source hash`);
    assert(item.graphNodeIds.length > 0, `${item.resourceId} knowledge card needs graph ids`);
    if (item.disposition === 'path-plannable') {
      assert(item.learningGoalIds.length > 0, `${item.resourceId} path card needs LearningGoal fit`);
      assert(item.knowledgeObjectiveIds.length > 0, `${item.resourceId} path card needs K objective ids`);
      assert(item.capabilityObjectiveIds.length > 0, `${item.resourceId} path card needs A objective ids`);
      assert(item.qualityObjectiveIds.length > 0, `${item.resourceId} path card needs Q objective ids`);
      assert(item.routeTarget?.startsWith('/knowledge?node='), `${item.resourceId} path card route mismatch`);
    } else {
      assert(item.routeTarget === null, `${item.resourceId} support card must not expose path route`);
      assert(item.residualLimitationState.includes('support-or-excluded-resource-not-path-node'), `${item.resourceId} support card needs non-path limitation`);
    }
  }

  if (item.sourceFamily === 'knowledge-infograph') {
    assert(item.disposition === 'embedded-asset', `${item.resourceId} infograph must remain embedded`);
    assert(item.currentPathEligible === false, `${item.resourceId} infograph must not become path eligible`);
    assert(item.routeTarget === null, `${item.resourceId} infograph route target must remain null`);
    assert(item.residualLimitationState.includes('embedded-asset-not-independent-path-node'), `${item.resourceId} missing embedded limitation`);
  }

  if (item.sourceFamily === 'registered-resource' && item.sourceHash === null) {
    assert(item.residualLimitationState.includes('concrete-missing-source-hash'), `${item.resourceId} registered route needs source-hash limitation`);
    assert(item.disposition !== 'path-plannable', `${item.resourceId} registered route without source hash must not be path-plannable`);
  }
}
assert(rationaleSet.size > 550, 'review rationale must be item-specific');

console.log('core registered/knowledge resource semantics verified');
