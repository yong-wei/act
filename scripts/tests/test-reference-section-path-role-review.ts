import { readFileSync } from 'node:fs';
import path from 'node:path';

interface ScopedWorkqueueItem {
  resourceId: string;
  sourceFamily: string;
  sourceKind: string;
  selectedForReview: boolean;
  reviewState: string;
  disposition: string;
  pathRole: string;
  exclusionRationale: string;
  promotedAsPathNode: boolean;
  independentPathMetadataComplete: boolean;
  rawContentIncluded: boolean;
  sourceWorkqueueRowCount: number;
  citationAddress: { href: string | null; sourceHash: string | null; sourceSpan: { startLine: number; endLine: number } | null };
}

interface ReviewItem extends ScopedWorkqueueItem {
  reviewBatchId: string;
  reviewerId: string;
  reviewedAt: string;
  authority: string;
  privacyScope: string;
  reviewerVisibleRationale: string;
}

const GOVERNANCE_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const workqueueItems = readJsonl<ScopedWorkqueueItem>('reference-section-path-role-workqueue-items.jsonl');
const reviewItems = readJsonl<ReviewItem>('reference-section-path-role-review-items.jsonl');
const summary = JSON.parse(readFileSync(path.join(
  GOVERNANCE_DIR,
  'reference-section-path-role-workqueue-summary.json',
), 'utf8'));
const evidence = readFileSync(path.join(
  GOVERNANCE_DIR,
  'reference-section-path-role-review-evidence.md',
), 'utf8');
const helperSource = readFileSync(path.join(
  process.cwd(),
  'scripts/db/generate-reference-section-path-role-review.ts',
), 'utf8');

assert(summary.totals.referenceSectionCandidates === 0, 'current runtime export must not claim imported reference sections exist');
assert(summary.selectedShard.remaining === 0, 'empty reference-section shard must have zero remaining selected rows');
assert(summary.totals.textbookSearchDocumentUnits === 964, 'expected all textbook search documents to be structurally accounted for');
assert(summary.structuralHandoff.textbookSearchDocumentSourceRows === 3856, 'expected source rows for search-document structural handoff');
assert(summary.guardrails.noCoreTextbookSectionReReviewed === true, 'must not re-review core textbook section rows from #817');
assert(summary.guardrails.noRetrievalChunkPromotedAsPathNode === true, 'retrieval chunks must not become PathNodes');
assert(summary.guardrails.searchDocumentsRemainSupportingCitation === true, 'search documents must remain supporting citation');
assert(summary.guardrails.rawContentIncluded === false, 'summary must report actual raw content inclusion state');
assert(
  Object.values(summary.sourceInventory.referenceSourceFamiliesPresent).every((count) => count === 0),
  'reference source-family inventory must show zero imported reference rows',
);
assert(workqueueItems.length === 964, 'scoped workqueue must contain one item per textbook search-document resource');
assert(reviewItems.length === workqueueItems.length, 'every structural handoff item must be reviewed for non-promotion');
assert(
  workqueueItems.every((item) =>
    item.sourceFamily === 'textbook-search-document' &&
    item.sourceKind === 'retrieval-chunk' &&
    item.selectedForReview === false &&
    item.reviewState === 'structural-handoff' &&
    item.disposition === 'supporting-citation' &&
    item.pathRole === 'supporting-citation' &&
    item.promotedAsPathNode === false &&
    item.independentPathMetadataComplete === false &&
    item.rawContentIncluded === false &&
    item.exclusionRationale.includes('not independent reference sections or PathNodes') &&
    item.sourceWorkqueueRowCount > 0 &&
    item.citationAddress.href?.includes('/course-runtime/resources/textbooks/') &&
    item.citationAddress.sourceHash?.startsWith('sha256:') &&
    (item as { runtimeFileHash?: string | null }).runtimeFileHash?.startsWith('sha256:')
  ),
  'each scoped search document must carry structural supporting-citation evidence',
);
assert(
  reviewItems.every((item) =>
    item.reviewBatchId === 'reference-section-path-role-review-2026-07-05' &&
    item.reviewerId === 'reference-section-review-implementing-agent' &&
    item.reviewedAt === '2026-07-05T11:00:00.000Z' &&
    item.authority === 'reviewed-structural-boundary' &&
    item.privacyScope === 'student-visible' &&
    item.reviewerVisibleRationale === item.exclusionRationale
  ),
  'review rows must carry stable reviewer metadata',
);
assert(
  !workqueueItems.some((item) => item.sourceFamily === 'textbook-section'),
  'reference review artifacts must not include core textbook-section records',
);
assert(
  !/textbook-section:hu-shousong-exercise-analysis-3rd:ch0[135]|textbook-section:hu-shousong-exercise-analysis-3rd:ch10/.test(evidence),
  'evidence must not repeat #817 core textbook section review ids',
);
assert(
  evidence.includes('contains no independent `reference-section`, `encyclopedia-section`, or `external-long-form-section` workqueue rows'),
  'evidence must state the inventory finding explicitly',
);
assert(
  evidence.includes('non-promotion structural reviews for citation/search projections'),
  'evidence must distinguish structural review rows from independent reference-section semantic review',
);
assert(
  evidence.includes('Raw content included in artifacts: false'),
  'evidence must state that raw content is not included in artifacts',
);
assert(
  helperSource.includes('Reference source family requires explicit item-by-item semantic review before artifact generation'),
  'helper must fail closed when future reference-family rows appear',
);

console.log('Reference section path-role review artifacts verified.');

function readJsonl<T>(filename: string): T[] {
  return readFileSync(path.join(GOVERNANCE_DIR, filename), 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
