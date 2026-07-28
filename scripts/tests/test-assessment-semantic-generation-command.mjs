import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const tsx = path.join(repoRoot, 'node_modules/.bin/tsx');
const governanceDir = path.join(repoRoot, 'course-content/runtime/resource-governance');
const generatedAt = '2026-07-18T00:00:00.000Z';
const sourcePath = path.join(governanceDir, 'assessment-item-semantic-review-source.jsonl');
const outputPaths = [
  'adaptive-assessment-item-catalog-items.jsonl',
  'adaptive-assessment-item-catalog-manifest.json',
  'assessment-item-semantic-review-packets.jsonl',
  'assessment-item-semantic-review-snapshots.jsonl',
  'assessment-item-semantic-review-coverage.json',
  'learning-goal-assessment-coverage-matrix.json',
].map((fileName) => path.join(governanceDir, fileName));

assert.equal(existsSync(sourcePath), true, 'tracked human review source must exist before generation');

function hashFile(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function readJson(fileName) {
  return JSON.parse(readFileSync(path.join(governanceDir, fileName), 'utf8'));
}

function readJsonl(fileName) {
  return readFileSync(path.join(governanceDir, fileName), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function generate() {
  const env = {
    ...process.env,
    RESOURCE_FIELD_COMPLETION_GENERATED_AT: generatedAt,
  };
  for (const script of [
    'scripts/db/generate-adaptive-assessment-item-catalog.ts',
    'scripts/db/generate-assessment-item-semantic-review.ts',
    'scripts/db/generate-learning-goal-assessment-coverage.ts',
  ]) {
    execFileSync(tsx, [script], { cwd: repoRoot, env, stdio: 'pipe' });
  }
}

const sourceHashBefore = hashFile(sourcePath);
generate();
const firstOutputHashes = outputPaths.map(hashFile);
generate();

assert.equal(hashFile(sourcePath), sourceHashBefore, 'generators must not rewrite or bootstrap the human review source');
assert.deepEqual(outputPaths.map(hashFile), firstOutputHashes, 'two fixed-time generation runs must be byte-identical');

const catalogItems = readJsonl('adaptive-assessment-item-catalog-items.jsonl');
const reviewSource = readJsonl('assessment-item-semantic-review-source.jsonl');
const snapshots = readJsonl('assessment-item-semantic-review-snapshots.jsonl');
const coverage = readJson('assessment-item-semantic-review-coverage.json');
const matrix = readJson('learning-goal-assessment-coverage-matrix.json');

assert.equal(catalogItems.length, 576);
assert.equal(reviewSource.length, 576);
assert.equal(snapshots.length, 576);
assert.equal(new Set(reviewSource.map((row) => row.catalogItemId)).size, 576);
assert.deepEqual(
  new Set(reviewSource.map((row) => row.catalogItemId)),
  new Set(catalogItems.map((row) => row.catalogItemId)),
  'review source must cover the exact catalog denominator',
);
assert.equal(coverage.itemCount, 576);
assert.equal(coverage.reviewedItemCount, 135);
assert.equal(coverage.pathEligibleItemCount, 135);
assert.equal(coverage.sourceFamilies.reduce((total, family) => total + family.blockedTotal, 0), 363);
assert.equal(coverage.sourceFamilies.reduce((total, family) => total + family.deprecatedTotal, 0), 78);
assert.equal(coverage.issues.length, 0);

assert.deepEqual(matrix.stageRequirements, { readiness: 3, practice: 6, checkpoint: 3, remediation: 3 });
assert.equal(matrix.rows.length, 9);
assert.equal(matrix.rows.every((row) => row.assessmentCoverageState === 'complete'), true);
assert.equal(matrix.rows.every((row) => row.terminalValidationSupport.assessmentItemsReplaceTerminalEvidence === false), true);

const q05 = reviewSource.find((row) => row.catalogItemId.endsWith(':preset-q-05'));
assert.deepEqual(q05?.selectedLearningGoalIds, ['time-domain-response-analysis']);
assert.equal(q05?.selectedStagePurpose, 'readiness');

for (const [id, reason] of [
  ['preset-q-27', 'underdetermined-msi-bandwidth-claim'],
  ['preset-q-36', 'undefined-ship-model-parameters-and-slogan-only-answer'],
]) {
  const row = reviewSource.find((candidate) => candidate.catalogItemId.endsWith(`:${id}`));
  assert.equal(row?.outcome, 'deprecated');
  assert.deepEqual(row?.selectedLearningGoalIds, []);
  assert.deepEqual(row?.selectedKaqObjectiveIds, []);
  assert.deepEqual(row?.selectedGraphNodeIds, []);
  assert.equal(row?.selectedStagePurpose, undefined);
  assert.match(row?.notes ?? '', new RegExp(reason));
}

const authoredRows = reviewSource.filter((row) => row.catalogItemId.includes(':checkpoint-authored-question:'));
assert.equal(authoredRows.length, 133);
assert.equal(authoredRows.every((row) => row.selectedKaqObjectiveIds.length > 0 && row.selectedKaqObjectiveIds.length < 3), true);
assert.equal(authoredRows.every((row) => row.selectedKaqObjectiveIds.length === row.selectedGraphNodeIds.length), true);
assert.equal(authoredRows.every((row) => row.reviewerId === 'course-pedagogy-reviewer:issue-883'), true);
assert.equal(authoredRows.every((row) => row.reviewerRole === 'course-pedagogy-reviewer'), true);
assert.equal(authoredRows.every((row) => row.reviewedAt === generatedAt), true);
assert.equal(authoredRows.every((row) => row.reviewBatchId === 'complete-assessment-checkpoint-resource-semantics.v2'), true);
assert.equal(authoredRows.every((row) => row.metadataVersionRefs.checkpointQuestionSetVersion === 'learning-goal-checkpoint-question-sets.v2'), true);
assert.equal(authoredRows.some((row) => /2026-07-03|learning-goal-checkpoint-question-sets\.v1/.test(JSON.stringify(row))), false);

for (const [id, stage] of [
  ['ship-ocean-transfer-application-practice-06', 'practice'],
  ['ship-ocean-transfer-application-checkpoint-03', 'checkpoint'],
]) {
  const row = authoredRows.find((candidate) => candidate.catalogItemId.endsWith(`:${id}`));
  assert.equal(row?.selectedStagePurpose, stage);
  assert.equal(matrix.rows.find((candidate) => candidate.learningGoalId === 'ship-ocean-transfer-application')
    ?.stageCoverage.find((candidate) => candidate.stage === stage)
    ?.countedCatalogItemIds.includes(row.catalogItemId), true);
}

const deprecatedIds = new Set(reviewSource.filter((row) => row.outcome === 'deprecated').map((row) => row.catalogItemId));
assert.equal(deprecatedIds.size, 78);
assert.equal(
  snapshots.some((row) => deprecatedIds.has(row.catalogItemId) && row.eligibilityState === 'path-eligible'),
  false,
  'deprecated items must never become path eligible',
);

console.log('assessment semantic generation command contract passed');
