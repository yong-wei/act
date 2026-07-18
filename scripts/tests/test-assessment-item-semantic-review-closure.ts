import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const governanceDir = path.join(process.cwd(), 'course-content/runtime/resource-governance');

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(governanceDir, name), 'utf8')) as T;
}

function readJsonl<T>(name: string): T[] {
  return readFileSync(path.join(governanceDir, name), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

type Decision = {
  catalogItemId: string;
  decisionKind: string;
  outcome: string;
  reviewerId?: string;
  reviewedAt?: string;
  reviewBatchId?: string;
  notes?: string;
};

type Coverage = {
  itemCount: number;
  reviewedItemCount: number;
  reviewedDispositionCount: number;
  reviewedLimitationCount: number;
  unreviewedItemCount: number;
  pathEligibleItemCount: number;
  staleReviewCount: number;
  issues: unknown[];
};

type Matrix = {
  totals: {
    learningGoalCount: number;
    complete: number;
    limited: number;
    reviewedPathEligibleItemCount: number;
  };
};

const acq = readJsonl<Decision>('assessment-item-semantic-review-acq-decisions.jsonl');
const icourse = readJsonl<Decision>('assessment-item-semantic-review-icourse-decisions.jsonl');
const snapshots = readJsonl<Decision>('assessment-item-semantic-review-snapshots.jsonl');
const coverage = readJson<Coverage>('assessment-item-semantic-review-coverage.json');
const matrix = readJson<Matrix>('learning-goal-assessment-coverage-matrix.json');

assert.equal(acq.length, 167, 'ACQ review shard must cover all 167 source items');
assert.equal(icourse.length, 226, 'iCourse review shard must cover all 226 source items');
assert.equal(new Set([...acq, ...icourse].map((row) => row.catalogItemId)).size, 393, 'review shards must not overlap');
for (const decision of [...acq, ...icourse]) {
  assert.equal(decision.decisionKind, 'human-review', `${decision.catalogItemId} must be human-reviewed`);
  assert.ok(decision.reviewerId, `${decision.catalogItemId} missing reviewer`);
  assert.ok(decision.reviewedAt, `${decision.catalogItemId} missing review timestamp`);
  assert.ok(decision.reviewBatchId, `${decision.catalogItemId} missing review batch`);
  assert.ok(decision.notes?.trim(), `${decision.catalogItemId} missing review rationale`);
}

assert.equal(snapshots.length, 530, 'combined snapshots must cover the complete assessment catalog');
assert.equal(new Set(snapshots.map((row) => row.catalogItemId)).size, 530, 'combined snapshots must be unique');
assert.deepEqual(coverage, {
  ...coverage,
  itemCount: 530,
  reviewedItemCount: 137,
  reviewedDispositionCount: 530,
  reviewedLimitationCount: 393,
  unreviewedItemCount: 0,
  pathEligibleItemCount: 137,
  staleReviewCount: 0,
  issues: [],
});
assert.deepEqual(matrix.totals, {
  learningGoalCount: 9,
  complete: 9,
  limited: 0,
  reviewedPathEligibleItemCount: 137,
});

console.log('Assessment semantic review closure: 530/530 dispositioned; 137 path eligible; 393 reviewed limitations.');
