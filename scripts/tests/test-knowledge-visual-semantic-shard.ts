import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type JsonRecord = Record<string, any>;

const repoRoot = process.cwd();
const governanceDir = join(repoRoot, 'course-content/runtime/resource-governance');
const selectedIds = [
  'knowledge-card:Bode图_1_1',
  'infograph:Bode图_1_1',
  'knowledge-card:Bode首轮骨架_5_1e07d9da',
  'infograph:传统设计四联图校正_4_47004',
];

function readJsonl(path: string): JsonRecord[] {
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as JsonRecord);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sha256File(relativePath: string) {
  return `sha256:${createHash('sha256').update(readFileSync(join(repoRoot, relativePath))).digest('hex')}`;
}

const reviewItems = readJsonl(join(governanceDir, 'knowledge-visual-semantic-shard-review-items.jsonl'));
const auditRows = readJsonl(join(governanceDir, 'resource-field-completion-audit.jsonl'));
const projectionRows = readJsonl(join(governanceDir, 'runtime-resource-projections.jsonl'));
const summary = JSON.parse(readFileSync(join(governanceDir, 'knowledge-visual-semantic-shard-summary.json'), 'utf8')) as JsonRecord;

assert(JSON.stringify(summary.selectedResourceIds) === JSON.stringify(selectedIds), 'selected shard ids must remain deterministic');
assert(summary.selectedCount === selectedIds.length, 'selected shard count mismatch');
assert(summary.remainingSelectedSemanticReview === 0, 'selected shard still has semantic review blockers');
assert(summary.residualUnselectedCounts['knowledge-card'] > 0, 'knowledge-card residual unselected count must be preserved');
assert(summary.residualUnselectedCounts['knowledge-infograph'] > 0, 'knowledge-infograph residual unselected count must be preserved');
assert(summary.byDisposition['path-plannable'] === 2, 'expected two reviewed path-plannable knowledge cards');
assert(summary.byDisposition['embedded-asset'] === 2, 'expected two embedded infograph assets');

for (const item of reviewItems) {
  assert(selectedIds.includes(item.resourceId), `unexpected review item ${item.resourceId}`);
  assert(item.rawContentIncluded === false, `${item.resourceId} must not include raw content`);
  assert(item.privacyMinimized === true, `${item.resourceId} must be privacy-minimized`);
  assert(item.graphNodeIds.length > 0, `${item.resourceId} missing graph refs`);
  assert(item.learningGoalIds.length > 0, `${item.resourceId} missing LearningGoal refs`);
  assert(item.knowledgeObjectiveIds.length > 0, `${item.resourceId} missing K objective refs`);
  assert(item.capabilityObjectiveIds.length > 0, `${item.resourceId} missing A objective refs`);
  assert(item.qualityObjectiveIds.length > 0, `${item.resourceId} missing Q objective refs`);
  assert(item.citationTargets.length > 0, `${item.resourceId} missing citation target`);
  assert(item.limitationState.length > 0, `${item.resourceId} missing limitation state`);
  assert(item.sourceHash === sha256File(item.sourcePathOrUrl), `${item.resourceId} source hash mismatch`);
}

const rowById = new Map(auditRows.map((row) => [row.resourceId, row]));
const projectionById = new Map(projectionRows.map((row) => [row.id, row]));
for (const resourceId of selectedIds) {
  const row = rowById.get(resourceId);
  assert(row, `missing audit row for ${resourceId}`);
  assert(row.reviewStatus === 'human-confirmed', `${resourceId} must be human-confirmed`);
  assert(!row.missingFieldCodes.includes('missing-human-review'), `${resourceId} still missing human review`);
  assert(!row.missingFieldCodes.includes('provisional-metadata'), `${resourceId} still provisional`);
  assert(!row.missingFieldCodes.includes('stale-review'), `${resourceId} has stale review`);
  assert(row.reviewAudit.reviewerId === 'knowledge-visual-semantic-shard-implementing-agent', `${resourceId} reviewer mismatch`);
  assert(row.reviewAudit.promptOrManifestHash?.startsWith('sha256:'), `${resourceId} missing review packet hash`);
  assert(row.groundingEligibility.citationReady === true, `${resourceId} citation grounding must be ready`);
}

for (const resourceId of ['knowledge-card:Bode图_1_1', 'knowledge-card:Bode首轮骨架_5_1e07d9da']) {
  const row = rowById.get(resourceId)!;
  assert(row.pathEligibility.current === true, `${resourceId} must be current path eligible`);
  assert(row.pathEligibility.masteryAffecting === false, `${resourceId} must remain path-only, not mastery-affecting`);
  assert(row.evidenceContract.learningFactMaterializationPolicy === 'path-execution-evidence-only', `${resourceId} must not materialize LearningFacts`);
  assert(row.missingFieldCodes.length === 0, `${resourceId} should have no selected-shard audit blockers`);
}

for (const resourceId of ['infograph:Bode图_1_1', 'infograph:传统设计四联图校正_4_47004']) {
  const row = rowById.get(resourceId)!;
  const projection = projectionById.get(resourceId);
  assert(row.pathTarget === null, `${resourceId} must not expose an independent path target`);
  assert(row.pathEligibility.current === false, `${resourceId} must not be current path eligible`);
  assert(row.pathEligibility.afterCompletion === false, `${resourceId} must not become path eligible after completion`);
  assert(row.missingFieldCodes.includes('missing-path-target'), `${resourceId} should retain path-target limitation`);
  assert(row.missingFieldCodes.includes('missing-evidence-instrumentation'), `${resourceId} should retain evidence limitation`);
  assert(projection?.routeTarget === null, `${resourceId} projection route target must remain null`);
  assert(projection?.renderTarget?.startsWith('/course-runtime/knowledge/infographs/'), `${resourceId} projection must keep renderable infograph URL`);
}

console.log('knowledge visual semantic shard verified');
