import { readFileSync } from 'node:fs';
import path from 'node:path';

interface ReviewedGraphResourceCoverageItem {
  graphNodeId: string;
  decision: string;
  limitationCategory: string;
  coverageRole: string;
  reviewerVisibleRationale: string;
  sourceVersionRef: string;
  sourceHash: string;
}

interface WorkqueueItem {
  queueId: string;
  graphNodeId: string;
  limitationCategory: string;
  coverageRole: string;
  reviewerVisibleRationale: string;
  sourceVersionRef: string;
  findingCode: string;
  rawContentIncluded: boolean;
}

const GOVERNANCE_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const workqueueItems = readJsonl<WorkqueueItem>('graph-resource-coverage-workqueue-items.jsonl');
const reviewedItems = readJsonl<ReviewedGraphResourceCoverageItem>('graph-resource-coverage-reviewed-items.jsonl');
const summary = JSON.parse(readFileSync(path.join(GOVERNANCE_DIR, 'graph-resource-coverage-summary.json'), 'utf8'));
const evidence = readFileSync(path.join(GOVERNANCE_DIR, 'graph-resource-coverage-evidence.md'), 'utf8');

assert(summary.totals.beforeGraphNodeResourceMissing === 541, 'baseline graph-node-resource-missing count must be preserved');
assert(summary.totals.workqueueItems === 541, 'workqueue must enumerate every residual graph resource finding');
assert(summary.totals.reviewedLimitations === 541, 'every residual finding must receive reviewed limitation state');
assert(summary.totals.afterGraphNodeResourceMissing === 0, 'reviewed overlay must close unexplained graph-node-resource-missing findings');
assert(summary.totals.afterReviewedResourceGaps === 541, 'data-completeness overlay must expose reviewed resource gaps');
assert(summary.guardrails.everyMissingNodeReviewed === true, 'summary must prove every missing graph node was reviewed');
assert(summary.guardrails.noUnexplainedGraphNodeResourceMissing === true, 'summary must prove no unexplained missing graph resource refs remain');
assert(summary.guardrails.noPathPromotion === true, 'reviewed gaps must not be path promoted');
assert(summary.guardrails.rawContentIncluded === false, 'artifacts must not include raw content');

assert(workqueueItems.length === 541, 'workqueue row count mismatch');
assert(reviewedItems.length === 541, 'reviewed row count mismatch');
assert(new Set(workqueueItems.map((item) => item.graphNodeId)).size === 541, 'workqueue rows must be one per graph node');
assert(new Set(reviewedItems.map((item) => item.graphNodeId)).size === 541, 'reviewed rows must be one per graph node');
assert(workqueueItems.every((item) =>
  item.queueId.startsWith('graph-resource-coverage:') &&
  item.findingCode === 'graph-node-resource-missing' &&
  item.coverageRole === 'explicit-gap' &&
  item.reviewerVisibleRationale.length > 0 &&
  item.sourceVersionRef === 'graph-resource-coverage-overlay.v1' &&
  item.rawContentIncluded === false
), 'workqueue rows must preserve reviewed-gap queue metadata without raw content');
assert(reviewedItems.every((item) =>
  item.decision === 'reviewed-limitation' &&
  item.coverageRole === 'explicit-gap' &&
  item.limitationCategory.endsWith('-resource-not-yet-authored') &&
  item.reviewerVisibleRationale.length > 0 &&
  item.sourceVersionRef === 'graph-resource-coverage-overlay.v1' &&
  item.sourceHash.startsWith('sha256:')
), 'reviewed rows must carry explicit limitation states');
assert(evidence.includes('Before graph-node-resource-missing: 541'), 'evidence must preserve before total');
assert(evidence.includes('After graph-node-resource-missing: 0'), 'evidence must preserve after total');
assert(evidence.includes('No path promotion from reviewed gaps: true'), 'evidence must state path-promotion guardrail');

console.log('Graph resource coverage overlay artifacts verified.');

function readJsonl<T>(filename: string): T[] {
  return readFileSync(path.join(GOVERNANCE_DIR, filename), 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
