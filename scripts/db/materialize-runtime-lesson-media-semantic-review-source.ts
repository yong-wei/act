import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import {
  assertRuntimeLessonSemanticReviewEvidence,
  assertRuntimeSemanticEvidenceReference,
} from './runtime-lesson-semantic-evidence';

const ROOT = process.cwd();
const GOVERNANCE_DIR = path.join(ROOT, 'course-content/runtime/resource-governance');
const AUDIT_PATH = path.join(GOVERNANCE_DIR, 'resource-field-completion-audit.jsonl');
const SOURCE_PATH = path.join(
  GOVERNANCE_DIR,
  'runtime-lesson-media-resource-semantics-review-source.jsonl',
);
const REVIEW_ITEMS_PATH = path.join(
  GOVERNANCE_DIR,
  'runtime-lesson-media-resource-semantics-review-items.jsonl',
);
const RUNTIME_LESSONS_PATH = path.join(ROOT, 'course-content/runtime/lessons');
type JsonRow = Record<string, any>;

function readJsonl(filename: string): JsonRow[] {
  return readFileSync(filename, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line: string) => JSON.parse(line) as JsonRow);
}

/**
 * The review source is the human-owned decision input. This command is
 * intentionally a validator: it never derives or overwrites rationale,
 * reviewer metadata, disposition, parent decisions, or evidence selectors.
 */
function validateSource(row: JsonRow, source: JsonRow) {
  if (source.sourceFamily !== row.family) {
    throw new Error(`Runtime semantic source family mismatch: ${row.resourceId}`);
  }
  if (source.expectedSourceHash !== (row.sourceHash ?? null)) {
    throw new Error(`Runtime semantic source hash mismatch: ${row.resourceId}`);
  }
  if (source.expectedSourceVersionRef !== (row.sourceVersionRef ?? null)) {
    throw new Error(`Runtime semantic source version mismatch: ${row.resourceId}`);
  }
  if (!source.reviewerVisibleRationale || !source.reviewerVisibleRationale.trim()) {
    throw new Error(`Runtime semantic source rationale is empty: ${row.resourceId}`);
  }
  assertRuntimeSemanticEvidenceReference(source.independentEvidenceRef);
  assertRuntimeLessonSemanticReviewEvidence(row, source);
}

function hasMachineFreshnessStaleOverlay(source: JsonRow): boolean {
  return source.reviewState === 'pending-rereview' && Boolean(source.staleReason?.trim());
}

function main() {
  const auditRows = readJsonl(AUDIT_PATH).filter((row) => (
    row.family === 'runtime-lesson-step'
    || row.family === 'runtime-lesson-module'
    || row.family === 'runtime-lesson-media'
    || row.family === 'runtime-handout'
  ));
  const auditById = new Map(auditRows.map((row) => [row.resourceId, row]));
  const sourceRows = readJsonl(SOURCE_PATH);
  const reviewItems = readJsonl(REVIEW_ITEMS_PATH);
  const sourceIds = new Set(sourceRows.map((source) => source.resourceId));
  const machinePendingIds = new Set(reviewItems.filter((item) => (
    !sourceIds.has(item.resourceId)
    && ['pending-target-migration', 'pending-identity-migration', 'pending-new-resource']
      .includes(item.reviewState)
    && item.promotedAsPlanningUnit === false
  )).map((item) => item.resourceId));
  const dedicatedClearanceIds = new Set<string>();
  for (const lessonDir of readdirSync(RUNTIME_LESSONS_PATH, { withFileTypes: true })) {
    if (!lessonDir.isDirectory()) continue;
    const clearancePath = path.join(RUNTIME_LESSONS_PATH, lessonDir.name, 'review/content-clearance.json');
    if (!existsSync(clearancePath)) continue;
    const clearance = JSON.parse(readFileSync(clearancePath, 'utf8')) as JsonRow;
    for (const reviewed of clearance.reviewed_resources ?? []) {
      if (typeof reviewed.resourceId === 'string') dedicatedClearanceIds.add(reviewed.resourceId);
    }
  }
  const seen = new Set<string>();
  const pendingRereview: string[] = [];
  for (const source of sourceRows) {
    if (seen.has(source.resourceId)) throw new Error(`Duplicate runtime semantic source: ${source.resourceId}`);
    seen.add(source.resourceId);
    const row = auditById.get(source.resourceId);
    if (!row) throw new Error(`Runtime semantic source has no audit row: ${source.resourceId}`);
    if (hasMachineFreshnessStaleOverlay(source)) {
      pendingRereview.push(source.resourceId);
      continue;
    }
    validateSource(row, source);
  }
  const uncoveredIds = [...auditById.keys()].filter((resourceId) => (
    !seen.has(resourceId)
    && !dedicatedClearanceIds.has(resourceId)
    && !machinePendingIds.has(resourceId)
  ));
  if (uncoveredIds.length > 0) {
    throw new Error(`Runtime semantic source uncovered audit rows: ${uncoveredIds.join(', ')}`);
  }
  console.log(JSON.stringify({
    sourceRows: sourceRows.length,
    activeSources: sourceRows.length - pendingRereview.length,
    promoted: sourceRows.filter((row) => row.reviewState === 'human-confirmed' && row.promotedAsPlanningUnit).length,
    pendingRereview,
    machinePendingIds: [...machinePendingIds].sort(),
    dedicatedClearanceIds: [...dedicatedClearanceIds].filter((resourceId) => auditById.has(resourceId)),
    remaining: pendingRereview.length + machinePendingIds.size,
    mode: 'validate-explicit-source',
  }));
}

main();
