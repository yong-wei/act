import { readFileSync } from 'node:fs';
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

function main() {
  const auditRows = readJsonl(AUDIT_PATH).filter((row) => (
    row.family === 'runtime-lesson-step'
    || row.family === 'runtime-lesson-module'
    || row.family === 'runtime-lesson-media'
    || row.family === 'runtime-handout'
  ));
  const auditById = new Map(auditRows.map((row) => [row.resourceId, row]));
  const sourceRows = readJsonl(SOURCE_PATH);
  if (sourceRows.length !== auditRows.length) {
    throw new Error(`Runtime semantic source denominator mismatch: source=${sourceRows.length}, audit=${auditRows.length}`);
  }
  const seen = new Set<string>();
  for (const source of sourceRows) {
    if (seen.has(source.resourceId)) throw new Error(`Duplicate runtime semantic source: ${source.resourceId}`);
    seen.add(source.resourceId);
    const row = auditById.get(source.resourceId);
    if (!row) throw new Error(`Runtime semantic source has no audit row: ${source.resourceId}`);
    validateSource(row, source);
  }
  console.log(JSON.stringify({
    sourceRows: sourceRows.length,
    promoted: sourceRows.filter((row) => row.promotedAsPlanningUnit).length,
    remaining: 0,
    mode: 'validate-explicit-source',
  }));
}

main();
