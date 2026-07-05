import { readFileSync } from 'node:fs';
import path from 'node:path';

interface ScopedWorkqueueItem {
  resourceId: string;
  family: string;
  selectedForReview: boolean;
  repairedSourceHash: string | null;
  rawContentIncluded: boolean;
}

interface ReviewItem {
  resourceId: string;
  disposition: string;
  citationAnchorState: string;
  sourceHash: string | null;
  reviewerVisibleRationale: string;
  promotedAsPathNode: boolean;
  rawContentIncluded: boolean;
}

const GOVERNANCE_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const artifactTexts = [
  'runtime-media-handout-disposition-workqueue-items.jsonl',
  'runtime-media-handout-disposition-workqueue-summary.json',
  'runtime-media-handout-disposition-review-items.jsonl',
  'runtime-media-handout-disposition-review-evidence.md',
].map((filename) => readFileSync(path.join(GOVERNANCE_DIR, filename), 'utf8'));
const workqueueItems = readJsonl<ScopedWorkqueueItem>('runtime-media-handout-disposition-workqueue-items.jsonl');
const reviewItems = readJsonl<ReviewItem>('runtime-media-handout-disposition-review-items.jsonl');
const summary = JSON.parse(readFileSync(path.join(
  GOVERNANCE_DIR,
  'runtime-media-handout-disposition-workqueue-summary.json',
), 'utf8'));

assert(workqueueItems.length > 0, 'expected scoped workqueue rows');
assert(reviewItems.length > 0, 'expected reviewed selected shard rows');
assert(
  workqueueItems.every((item) => item.family === 'runtime-lesson-media' || item.family === 'runtime-handout'),
  'scoped workqueue must only include runtime media and handouts',
);
assert(
  workqueueItems.every((item) => !item.resourceId.startsWith('textbook') && !item.resourceId.startsWith('runtime-step:')),
  'scoped workqueue must exclude textbook sections and runtime steps',
);
assert(summary.selectedShard.remaining === 0, 'selected shard remaining must be zero');
assert(summary.generatedAt === '2026-07-05T05:30:00.000Z', 'default generatedAt must be stable');
assert(summary.guardrails.selectedCitationOnlyNotPromoted === true, 'citation-only media must not be promoted');
assert(summary.guardrails.rawContentIncluded === false, 'raw content must not be included');
assert(
  artifactTexts.every((text) => !/https?:\/\//i.test(text) && !/objectshowpreview|signature=/i.test(text)),
  'scoped artifacts must not repeat raw external signed URLs',
);
assert(summary.totals.scopedRows === workqueueItems.length, 'summary scoped row count must match JSONL');
assert(summary.totals.reviewedRows === reviewItems.length, 'summary reviewed row count must match JSONL');
assert(
  setEquals(
    new Set(workqueueItems.filter((item) => item.selectedForReview).map((item) => item.resourceId)),
    new Set(reviewItems.map((item) => item.resourceId)),
  ),
  'selected workqueue resource ids must match review item resource ids exactly',
);
assert(
  reviewItems.every((item) =>
    item.disposition &&
    item.citationAnchorState &&
    item.reviewerVisibleRationale &&
    item.promotedAsPathNode === false &&
    item.rawContentIncluded === false
  ),
  'every reviewed row must carry disposition, anchor state, rationale, and no PathNode promotion',
);
assert(
  reviewItems.some((item) => item.resourceId === 'runtime-handout:1-1' && item.sourceHash?.startsWith('sha256:')),
  'selected handout must have repaired source hash evidence',
);
assert(
  workqueueItems.some((item) => item.selectedForReview && item.repairedSourceHash?.startsWith('sha256:')),
  'selected shard must include hash-repaired local rows',
);

console.log(`Runtime media/handout disposition review rows: ${reviewItems.length}`);
console.log(`Selected shard remaining: ${summary.selectedShard.remaining}`);

function readJsonl<T>(filename: string): T[] {
  return readFileSync(path.join(GOVERNANCE_DIR, filename), 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function setEquals<T>(left: Set<T>, right: Set<T>) {
  if (left.size !== right.size) return false;
  for (const item of left) {
    if (!right.has(item)) return false;
  }
  return true;
}
