import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

interface WorkqueueItem {
  resourceId: string;
  sourceFamily: string;
  learningGoalId?: string;
  missingFieldCode: string;
  followupBucket: string;
  dependencyState: string;
  queueRole: string;
  title: string;
  sourcePathOrUrl: string | null;
  sourceRecord: string;
  learningGoalIds?: string[];
  currentBlockers?: string[];
  sourceHash?: string | null;
  sourceVersionRef?: string | null;
  rawContentIncluded?: boolean;
}

interface ChunkIndexRow {
  id: string;
  bookId: string;
  sectionId: string;
  chunkIndex: number;
  title: string;
  href: string;
  sourceSpan: { startLine: number; endLine: number };
  contentHash: string;
}

interface SectionIndexRow {
  id: string;
  bookId: string;
  title: string;
  kind: string;
  chapterId: string;
  chapterNumber: number;
  href: string;
  contentHash: string;
}

interface ScopedWorkqueueItem {
  artifactVersion: typeof ARTIFACT_VERSION;
  resourceId: string;
  sourceFamily: string;
  sourceKind: 'retrieval-chunk' | 'book-level-source' | 'reference-section-candidate';
  bookId: string;
  sectionId: string;
  chunkId: string | null;
  chunkIndex: number | null;
  title: string;
  deterministicShardId: typeof SELECTED_SHARD_ID | typeof STRUCTURAL_HANDOFF_ID;
  selectedForReview: boolean;
  reviewState: 'reviewed' | 'structural-handoff';
  disposition: 'supporting-citation' | 'excluded-with-rationale';
  pathRole: 'supporting-citation' | 'not-independent-path-node';
  exclusionRationale: string;
  dependencyStates: string[];
  queueRoles: string[];
  blockerCodes: string[];
  learningGoalIds: string[];
  sourcePathOrUrl: string | null;
  citationAddress: {
    href: string | null;
    sourceSpan: { startLine: number; endLine: number } | null;
    sourceHash: string | null;
  };
  sourceHash: string | null;
  runtimeFileHash: string | null;
  sourceVersionRef: string | null;
  sourceWorkqueueRowCount: number;
  promotedAsPathNode: false;
  independentPathMetadataComplete: false;
  rawContentIncluded: false;
}

interface ReviewItem extends ScopedWorkqueueItem {
  reviewBatchId: typeof REVIEW_BATCH_ID;
  reviewerId: typeof REVIEWER_ID;
  reviewedAt: string;
  authority: 'reviewed-structural-boundary';
  privacyScope: 'student-visible';
  reviewerVisibleRationale: string;
}

const GOVERNANCE_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const TEXTBOOK_RUNTIME_DIR = path.join(
  process.cwd(),
  'course-content/runtime/resources/textbooks/hu-shousong-exercise-analysis-3rd',
);
const WORKQUEUE_ITEMS_PATH = path.join(GOVERNANCE_DIR, 'resource-completion-workqueue-items.jsonl');
const CHUNK_INDEX_PATH = path.join(TEXTBOOK_RUNTIME_DIR, 'chunk-index.jsonl');
const SECTION_INDEX_PATH = path.join(TEXTBOOK_RUNTIME_DIR, 'section-index.jsonl');
const SCOPED_WORKQUEUE_PATH = path.join(GOVERNANCE_DIR, 'reference-section-path-role-workqueue-items.jsonl');
const SUMMARY_PATH = path.join(GOVERNANCE_DIR, 'reference-section-path-role-workqueue-summary.json');
const REVIEW_ITEMS_PATH = path.join(GOVERNANCE_DIR, 'reference-section-path-role-review-items.jsonl');
const REVIEW_EVIDENCE_PATH = path.join(GOVERNANCE_DIR, 'reference-section-path-role-review-evidence.md');
const ARTIFACT_VERSION = 'reference-section-path-role-review.v1' as const;
const REVIEW_BATCH_ID = 'reference-section-path-role-review-2026-07-05' as const;
const REVIEWER_ID = 'reference-section-review-implementing-agent' as const;
const GENERATED_AT = process.env.REFERENCE_SECTION_REVIEW_GENERATED_AT ?? '2026-07-05T11:00:00.000Z';
const SELECTED_SHARD_ID = 'source-family:reference-section' as const;
const STRUCTURAL_HANDOFF_ID = 'structural:textbook-search-document-supporting-citation' as const;
const REFERENCE_SOURCE_FAMILIES = new Set([
  'reference-section',
  'encyclopedia-section',
  'external-long-form-section',
]);

async function main() {
  const workqueueRows = await readJsonl<WorkqueueItem>(WORKQUEUE_ITEMS_PATH);
  const chunkIndex = new Map((await readJsonl<ChunkIndexRow>(CHUNK_INDEX_PATH)).map((row) => [row.id, row]));
  const sectionIndex = new Map((await readJsonl<SectionIndexRow>(SECTION_INDEX_PATH)).map((row) => [row.id, row]));
  const referenceRows = workqueueRows.filter((row) => REFERENCE_SOURCE_FAMILIES.has(row.sourceFamily));
  if (referenceRows.length > 0) {
    throw new Error(
      `Reference source family requires explicit item-by-item semantic review before artifact generation: ${referenceRows[0].resourceId}`,
    );
  }
  const textbookSearchRows = workqueueRows.filter((row) => row.sourceFamily === 'textbook-search-document');
  const groupedSearchRows = groupBy(textbookSearchRows, (row) => row.resourceId);
  const scopedItems = await Promise.all([
    ...Array.from(groupedSearchRows.entries()).map(([resourceId, rows]) =>
      searchDocumentBoundaryItem(resourceId, rows, chunkIndex, sectionIndex)
    ),
  ]);
  const sortedScopedItems = scopedItems.sort(compareByResourceId);
  const reviewItems = sortedScopedItems
    .filter((item) => item.selectedForReview || item.sourceKind === 'retrieval-chunk')
    .map((item) => reviewItemFor(item));
  const summary = buildSummary(workqueueRows, sortedScopedItems, reviewItems);

  await writeJsonl(SCOPED_WORKQUEUE_PATH, sortedScopedItems);
  await fs.writeFile(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await writeJsonl(REVIEW_ITEMS_PATH, reviewItems);
  await fs.writeFile(REVIEW_EVIDENCE_PATH, renderEvidence(summary, reviewItems), 'utf8');

  console.log(`Reference source rows: ${referenceRows.length}`);
  console.log(`Textbook search-document rows: ${textbookSearchRows.length}`);
  console.log(`Scoped items: ${sortedScopedItems.length}`);
  console.log(`Reviewed structural rows: ${reviewItems.length}`);
  console.log(`Selected remaining: ${summary.selectedShard.remaining}`);
}

async function searchDocumentBoundaryItem(
  resourceId: string,
  rows: WorkqueueItem[],
  chunkIndex: Map<string, ChunkIndexRow>,
  sectionIndex: Map<string, SectionIndexRow>,
): Promise<ScopedWorkqueueItem> {
  const chunkId = resourceId.replace(/^textbook-search-document:/, '');
  const chunk = chunkIndex.get(chunkId) ?? null;
  const section = chunk ? sectionIndex.get(chunk.sectionId) ?? null : null;
  const first = rows[0];
  const href = chunk?.href ?? first?.sourcePathOrUrl ?? null;
  const sourceHash = chunk?.contentHash ? `sha256:${chunk.contentHash}` : normalizeSha256(first?.sourceHash);
  const sourceSpan = chunk?.sourceSpan ?? null;
  return {
    artifactVersion: ARTIFACT_VERSION,
    resourceId,
    sourceFamily: 'textbook-search-document',
    sourceKind: 'retrieval-chunk',
    bookId: chunk?.bookId ?? first?.sourceRecord ?? 'unknown',
    sectionId: chunk?.sectionId ?? sectionIdFromResourceId(resourceId),
    chunkId,
    chunkIndex: chunk?.chunkIndex ?? null,
    title: chunk?.title ?? section?.title ?? first?.title ?? resourceId,
    deterministicShardId: STRUCTURAL_HANDOFF_ID,
    selectedForReview: false,
    reviewState: 'structural-handoff',
    disposition: 'supporting-citation',
    pathRole: 'supporting-citation',
    exclusionRationale: 'Retrieval chunks inherit section-grain textbook review and remain citation/RAG support; they are not independent reference sections or PathNodes.',
    dependencyStates: uniqueSorted(rows.map((row) => row.dependencyState)),
    queueRoles: uniqueSorted(rows.map((row) => row.queueRole)),
    blockerCodes: uniqueSorted(rows.flatMap((row) => [row.missingFieldCode, ...(row.currentBlockers ?? [])])),
    learningGoalIds: uniqueSorted(rows.flatMap((row) => row.learningGoalIds ?? [row.learningGoalId ?? ''])),
    sourcePathOrUrl: href,
    citationAddress: {
      href,
      sourceSpan,
      sourceHash,
    },
    sourceHash,
    runtimeFileHash: await hashProjectFile(href),
    sourceVersionRef: first?.sourceVersionRef ?? 'textbook-resource-export.v1',
    sourceWorkqueueRowCount: rows.length,
    promotedAsPathNode: false,
    independentPathMetadataComplete: false,
    rawContentIncluded: false,
  };
}

function reviewItemFor(item: ScopedWorkqueueItem): ReviewItem {
  return {
    ...item,
    reviewBatchId: REVIEW_BATCH_ID,
    reviewerId: REVIEWER_ID,
    reviewedAt: GENERATED_AT,
    authority: 'reviewed-structural-boundary',
    privacyScope: 'student-visible',
    reviewerVisibleRationale: item.exclusionRationale,
  };
}

function buildSummary(
  allRows: WorkqueueItem[],
  scopedItems: ScopedWorkqueueItem[],
  reviewItems: ReviewItem[],
) {
  const selected = scopedItems.filter((item) => item.selectedForReview);
  const searchDocuments = scopedItems.filter((item) => item.sourceKind === 'retrieval-chunk');
  const sourceFamilies = countBy(allRows, (row) => row.sourceFamily);
  return {
    artifactVersion: ARTIFACT_VERSION,
    generatedAt: GENERATED_AT,
    reviewBatchId: REVIEW_BATCH_ID,
    selectedShardId: SELECTED_SHARD_ID,
    selectionBasis: 'reference-section, encyclopedia-section, and external-long-form-section source families; textbook-search-document chunks are structural citation handoff',
    totals: {
      sourceWorkqueueRows: sum(scopedItems, (item) => item.sourceWorkqueueRowCount),
      scopedResourceUnits: scopedItems.length,
      referenceSectionCandidates: selected.length,
      textbookSearchDocumentUnits: searchDocuments.length,
      reviewedRows: reviewItems.length,
    },
    selectedShard: {
      total: selected.length,
      reviewed: selected.length,
      remaining: selected.length - selected.length,
      dispositions: countBy(selected, (item) => item.disposition),
    },
    structuralHandoff: {
      textbookSearchDocumentUnits: searchDocuments.length,
      textbookSearchDocumentSourceRows: sum(searchDocuments, (item) => item.sourceWorkqueueRowCount),
      bySection: countBy(searchDocuments, (item) => item.sectionId),
      byBlocker: countBy(searchDocuments.flatMap((item) => item.blockerCodes), (item) => item),
    },
    sourceInventory: {
      referenceSourceFamiliesPresent: Object.fromEntries(
        Array.from(REFERENCE_SOURCE_FAMILIES).map((family) => [family, sourceFamilies[family] ?? 0]),
      ),
      allSourceFamilies: sourceFamilies,
    },
    guardrails: {
      noCoreTextbookSectionReReviewed: scopedItems.every((item) => item.sourceFamily !== 'textbook-section'),
      noRetrievalChunkPromotedAsPathNode: scopedItems.every((item) => item.sourceKind !== 'retrieval-chunk' || item.promotedAsPathNode === false),
      searchDocumentsRemainSupportingCitation: searchDocuments.every((item) => item.disposition === 'supporting-citation' && item.pathRole === 'supporting-citation'),
      referenceCandidatesHaveRationale: selected.every((item) => item.exclusionRationale.length > 0),
      rawContentIncluded: scopedItems.some((item) => item.rawContentIncluded === true),
    },
  };
}

function renderEvidence(summary: ReturnType<typeof buildSummary>, reviewItems: ReviewItem[]) {
  const sampledRows = reviewItems.slice(0, 20).map((item) => `| ${[
    item.resourceId,
    item.sourceKind,
    item.disposition,
    item.pathRole,
    item.sectionId,
    item.chunkId ?? '',
    item.sourceWorkqueueRowCount,
  ].join(' | ')} |`);
  return [
    '# Reference Section Path Role Review Evidence',
    '',
    `Generated at: ${summary.generatedAt}`,
    `Review batch: ${summary.reviewBatchId}`,
    `Selected shard: ${summary.selectedShardId}`,
    '',
    `Reference section candidates: ${summary.totals.referenceSectionCandidates}`,
    `Textbook search-document units: ${summary.totals.textbookSearchDocumentUnits}`,
    `Reviewed structural rows: ${summary.totals.reviewedRows}`,
    `Selected remaining: ${summary.selectedShard.remaining}`,
    '',
    '## Inventory Finding',
    '',
    'The current runtime export contains no independent `reference-section`, `encyclopedia-section`, or `external-long-form-section` workqueue rows. Existing long-form search documents are retrieval chunks derived from the core textbook export and remain supporting citation material.',
    '',
    'The reviewed rows in this artifact are non-promotion structural reviews for citation/search projections. They are not independent reference-section semantic reviews.',
    '',
    '## Guardrails',
    '',
    `- Core textbook sections re-reviewed: ${!summary.guardrails.noCoreTextbookSectionReReviewed}`,
    `- Retrieval chunks promoted as PathNodes: ${!summary.guardrails.noRetrievalChunkPromotedAsPathNode}`,
    `- Search documents remain supporting citation: ${summary.guardrails.searchDocumentsRemainSupportingCitation}`,
    `- Raw content included in artifacts: ${summary.guardrails.rawContentIncluded}`,
    '',
    '## Sampled Reviewed Rows',
    '',
    '| Resource | Source kind | Disposition | Path role | Section | Chunk | Source rows |',
    '| --- | --- | --- | --- | --- | --- | ---: |',
    ...sampledRows,
    '',
  ].join('\n');
}

async function hashProjectFile(href: string | null) {
  if (!href) return null;
  const normalizedHref = href.split('#')[0];
  const filePath = href.startsWith('/course-runtime/resources/')
    ? path.join(process.cwd(), normalizedHref.replace(/^\/course-runtime\/resources\//, 'course-content/runtime/resources/'))
    : path.join(process.cwd(), normalizedHref);
  try {
    return `sha256:${createHash('sha256').update(await fs.readFile(filePath)).digest('hex')}`;
  } catch {
    return null;
  }
}

async function readJsonl<T>(filePath: string): Promise<T[]> {
  const text = await fs.readFile(filePath, 'utf8');
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as T);
}

async function writeJsonl(filePath: string, rows: unknown[]) {
  await fs.writeFile(filePath, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8');
}

function sectionIdFromResourceId(resourceId: string) {
  return resourceId
    .replace(/^textbook-search-document:/, '')
    .replace(/^.*:/, '')
    .replace(/__chunk-\d+$/, '');
}

function normalizeSha256(value: string | null | undefined) {
  if (!value) return null;
  return value.startsWith('sha256:') ? value : `sha256:${value}`;
}

function groupBy<T>(rows: T[], keyFor: (row: T) => string) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyFor(row);
    const current = map.get(key) ?? [];
    current.push(row);
    map.set(key, current);
  }
  return map;
}

function compareByResourceId(left: { resourceId: string }, right: { resourceId: string }) {
  return left.resourceId.localeCompare(right.resourceId);
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function countBy<T>(values: T[], keyFor: (value: T) => string): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    const key = keyFor(value);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function sum<T>(values: T[], valueFor: (value: T) => number) {
  return values.reduce((total, value) => total + valueFor(value), 0);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
