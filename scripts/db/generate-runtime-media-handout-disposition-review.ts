import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

type ProjectionFamily = 'runtime-lesson-media' | 'runtime-handout';

interface RuntimeProjectionRow {
  id: string;
  family: string;
  resourceType?: string;
  title?: string;
  sourcePathOrUrl?: string | null;
  sourceRecord?: string | null;
  sourceHash?: string | null;
  sourceVersionRef?: string | null;
  renderTarget?: string | null;
  routeTarget?: string | null;
  graphNodeRefs?: {
    knowledge?: string[];
    capability?: string[];
    quality?: string[];
  };
  evidenceInstrumentation?: string[];
  privacyScope?: string | null;
  pathEligibility?: {
    blockedBy?: string[];
  };
}

interface WorkqueueItem {
  resourceId: string;
  sourceFamily: string;
  queueRole: string;
  missingFieldCode: string;
  followupBucket: string;
  dependencyState: string;
  currentBlockers?: string[];
}

interface ScopedWorkqueueItem {
  artifactVersion: 'runtime-media-handout-disposition-review.v1';
  resourceId: string;
  family: ProjectionFamily;
  lessonKey: string;
  resourceKind: string;
  blockerType: string;
  deterministicShardId: string;
  hashShardId: string;
  selectedForReview: boolean;
  title: string;
  sourcePathOrUrl: string | null;
  sourceRecord: string | null;
  sourceHash: string | null;
  repairedSourceHash: string | null;
  sourceVersionRef: string | null;
  currentBlockers: string[];
  followupBuckets: string[];
  dependencyStates: string[];
  reviewState: 'pending' | 'reviewed';
  privacyMinimized: true;
  rawContentIncluded: false;
}

interface ReviewItem {
  artifactVersion: 'runtime-media-handout-disposition-review.v1';
  reviewBatchId: typeof REVIEW_BATCH_ID;
  reviewerId: typeof REVIEWER_ID;
  reviewedAt: string;
  resourceId: string;
  family: ProjectionFamily;
  lessonKey: string;
  resourceKind: string;
  disposition:
    | 'supporting-citation'
    | 'embedded-asset'
    | 'evidence-producing'
    | 'excluded-with-rationale';
  citationAnchorState:
    | 'document-section-anchor-required'
    | 'figure-anchor-ready'
    | 'page-anchor-required'
    | 'transcript-required'
    | 'data-appendix-anchor-required'
    | 'production-missing';
  parentPlanningUnitRef: string;
  routeTarget: string | null;
  renderTarget: string | null;
  evidenceInstrumentation: string[];
  privacyScope: string | null;
  graphNodeRefs: {
    knowledge: string[];
    capability: string[];
    quality: string[];
  };
  sourceHash: string | null;
  sourceVersionRef: string | null;
  limitationState: string[];
  reviewerVisibleRationale: string;
  independentPathMetadataComplete: boolean;
  promotedAsPathNode: false;
  privacyMinimized: true;
  rawContentIncluded: false;
}

const OUTPUT_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const PROJECTION_JSONL_PATH = path.join(OUTPUT_DIR, 'runtime-resource-projections.jsonl');
const WORKQUEUE_ITEMS_JSONL_PATH = path.join(OUTPUT_DIR, 'resource-completion-workqueue-items.jsonl');
const SCOPED_WORKQUEUE_JSONL_PATH = path.join(OUTPUT_DIR, 'runtime-media-handout-disposition-workqueue-items.jsonl');
const SCOPED_SUMMARY_JSON_PATH = path.join(OUTPUT_DIR, 'runtime-media-handout-disposition-workqueue-summary.json');
const REVIEW_ITEMS_JSONL_PATH = path.join(OUTPUT_DIR, 'runtime-media-handout-disposition-review-items.jsonl');
const REVIEW_EVIDENCE_MD_PATH = path.join(OUTPUT_DIR, 'runtime-media-handout-disposition-review-evidence.md');
const ARTIFACT_VERSION = 'runtime-media-handout-disposition-review.v1' as const;
const REVIEW_BATCH_ID = 'runtime-media-handout-disposition-review-2026-07-05' as const;
const REVIEWER_ID = 'runtime-media-handout-disposition-implementing-agent' as const;
const DEFAULT_REVIEWED_AT = '2026-07-05T05:30:00.000Z' as const;
const SELECTED_LESSON = process.env.RUNTIME_MEDIA_HANDOUT_REVIEW_LESSON ?? '1-1';
const GENERATED_AT = process.env.RUNTIME_MEDIA_HANDOUT_REVIEW_GENERATED_AT ?? DEFAULT_REVIEWED_AT;
const HASH_SHARD_COUNT = 32;

async function main() {
  const projections = (await readJsonl<RuntimeProjectionRow>(PROJECTION_JSONL_PATH))
    .filter((row): row is RuntimeProjectionRow & { family: ProjectionFamily } =>
      row.family === 'runtime-lesson-media' || row.family === 'runtime-handout'
    );
  const workqueueByResource = groupWorkqueueItems(await readJsonl<WorkqueueItem>(WORKQUEUE_ITEMS_JSONL_PATH));

  const scopedItems = await Promise.all(projections.map((row) => scopedWorkqueueItem(row, workqueueByResource)));
  const sortedScopedItems = scopedItems.sort(compareByResourceId);
  const projectionsById = new Map(projections.map((row) => [row.id, row]));
  const reviewItems = sortedScopedItems
    .filter((item) => item.selectedForReview)
    .map((item) => reviewItemFor(item, projectionsById.get(item.resourceId)));
  const summary = buildSummary(sortedScopedItems, reviewItems);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await writeJsonl(SCOPED_WORKQUEUE_JSONL_PATH, sortedScopedItems);
  await fs.writeFile(SCOPED_SUMMARY_JSON_PATH, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await writeJsonl(REVIEW_ITEMS_JSONL_PATH, reviewItems);
  await fs.writeFile(REVIEW_EVIDENCE_MD_PATH, renderEvidenceMarkdown(summary, reviewItems), 'utf8');

  console.log(`Runtime media/handout scoped rows: ${sortedScopedItems.length}`);
  console.log(`Selected lesson shard: ${SELECTED_LESSON}`);
  console.log(`Selected reviewed rows: ${reviewItems.length}`);
  console.log(`Selected remaining: ${summary.selectedShard.remaining}`);
  console.log(`Scoped workqueue: ${path.relative(process.cwd(), SCOPED_WORKQUEUE_JSONL_PATH)}`);
  console.log(`Review evidence: ${path.relative(process.cwd(), REVIEW_EVIDENCE_MD_PATH)}`);
}

async function scopedWorkqueueItem(
  row: RuntimeProjectionRow & { family: ProjectionFamily },
  workqueueByResource: Map<string, WorkqueueItem[]>,
): Promise<ScopedWorkqueueItem> {
  const lessonKey = lessonKeyFor(row);
  const workqueueItems = workqueueByResource.get(row.id) ?? [];
  const rawSourcePathOrUrl = row.sourcePathOrUrl ?? null;
  const currentBlockers = uniqueSorted([
    ...(row.pathEligibility?.blockedBy ?? []),
    ...workqueueItems.flatMap((item) => item.currentBlockers ?? []),
    ...workqueueItems.map((item) => item.missingFieldCode),
  ]);
  const sourcePathOrUrl = privacyMinimizedSourcePath(rawSourcePathOrUrl);
  const repairedSourceHash = row.sourceHash ?? await hashProjectPath(rawSourcePathOrUrl);
  const selectedForReview = lessonKey === SELECTED_LESSON;

  return {
    artifactVersion: ARTIFACT_VERSION,
    resourceId: row.id,
    family: row.family,
    lessonKey,
    resourceKind: row.resourceType ?? (row.family === 'runtime-handout' ? 'handout' : 'media'),
    blockerType: blockerTypeFor(currentBlockers),
    deterministicShardId: `lesson:${lessonKey}`,
    hashShardId: `hash32:${hashShardFor(row.id)}`,
    selectedForReview,
    title: row.title ?? row.id,
    sourcePathOrUrl,
    sourceRecord: row.sourceRecord ?? null,
    sourceHash: row.sourceHash ?? null,
    repairedSourceHash,
    sourceVersionRef: row.sourceVersionRef ?? null,
    currentBlockers,
    followupBuckets: uniqueSorted(workqueueItems.map((item) => item.followupBucket)),
    dependencyStates: uniqueSorted(workqueueItems.map((item) => item.dependencyState)),
    reviewState: selectedForReview ? 'reviewed' : 'pending',
    privacyMinimized: true,
    rawContentIncluded: false,
  };
}

function reviewItemFor(item: ScopedWorkqueueItem, row: RuntimeProjectionRow | undefined): ReviewItem {
  const disposition = dispositionFor(item);
  const anchorState = citationAnchorStateFor(item);
  const sourceHash = item.repairedSourceHash ?? item.sourceHash;
  const limitationState = limitationStateFor(sourceHash, anchorState);
  const graphNodeRefs = {
    knowledge: uniqueSorted(row?.graphNodeRefs?.knowledge ?? []),
    capability: uniqueSorted(row?.graphNodeRefs?.capability ?? []),
    quality: uniqueSorted(row?.graphNodeRefs?.quality ?? []),
  };

  return {
    artifactVersion: ARTIFACT_VERSION,
    reviewBatchId: REVIEW_BATCH_ID,
    reviewerId: REVIEWER_ID,
    reviewedAt: GENERATED_AT,
    resourceId: item.resourceId,
    family: item.family,
    lessonKey: item.lessonKey,
    resourceKind: item.resourceKind,
    disposition,
    citationAnchorState: anchorState,
    parentPlanningUnitRef: `runtime-lesson:${item.lessonKey}`,
    routeTarget: null,
    renderTarget: privacyMinimizedSourcePath(row?.renderTarget ?? item.sourcePathOrUrl),
    evidenceInstrumentation: uniqueSorted(row?.evidenceInstrumentation ?? []),
    privacyScope: row?.privacyScope ?? null,
    graphNodeRefs,
    sourceHash,
    sourceVersionRef: item.sourceVersionRef,
    limitationState,
    reviewerVisibleRationale: rationaleFor(item, disposition, anchorState, graphNodeRefs),
    independentPathMetadataComplete: false,
    promotedAsPathNode: false,
    privacyMinimized: true,
    rawContentIncluded: false,
  };
}

function dispositionFor(item: ScopedWorkqueueItem): ReviewItem['disposition'] {
  if (item.resourceId === 'runtime-media:1-1:1-1-intro-video') return 'excluded-with-rationale';
  if (item.resourceKind === 'handout' && item.family === 'runtime-lesson-media') return 'evidence-producing';
  if (item.family === 'runtime-handout') return 'supporting-citation';
  return item.sourcePathOrUrl?.startsWith('course-content/')
    ? 'embedded-asset'
    : 'supporting-citation';
}

function citationAnchorStateFor(item: ScopedWorkqueueItem): ReviewItem['citationAnchorState'] {
  if (item.resourceId === 'runtime-media:1-1:1-1-intro-video') return 'production-missing';
  if (item.family === 'runtime-handout') return 'document-section-anchor-required';
  if (item.resourceKind === 'video' || item.resourceKind === 'audio') return 'transcript-required';
  if (item.resourceKind === 'slides' || item.sourcePathOrUrl?.endsWith('.pdf')) return 'page-anchor-required';
  if (item.sourcePathOrUrl?.includes('/generated-data/')) return 'data-appendix-anchor-required';
  return 'figure-anchor-ready';
}

function limitationStateFor(
  sourceHash: string | null,
  anchorState: ReviewItem['citationAnchorState'],
): string[] {
  return uniqueSorted([
    !sourceHash ? 'source-hash-unavailable' : null,
    anchorState === 'transcript-required' ? 'transcript-required-before-path-promotion' : null,
    anchorState === 'page-anchor-required' ? 'page-anchor-required-before-path-promotion' : null,
    anchorState === 'document-section-anchor-required' ? 'section-anchor-required-before-path-promotion' : null,
    anchorState === 'production-missing' ? 'media-production-missing' : null,
  ].filter((value): value is string => Boolean(value)));
}

function rationaleFor(
  item: ScopedWorkqueueItem,
  disposition: ReviewItem['disposition'],
  anchorState: ReviewItem['citationAnchorState'],
  graphNodeRefs: ReviewItem['graphNodeRefs'],
) {
  const graphScope = graphNodeRefs.knowledge.length > 0
    ? `graph scope ${graphNodeRefs.knowledge.slice(0, 4).join(', ')}`
    : 'lesson-level graph scope';
  if (disposition === 'excluded-with-rationale') {
    return `${item.resourceId} is listed as pending production in the lesson media index, so it remains excluded until a concrete source exists.`;
  }
  if (disposition === 'evidence-producing') {
    return `${item.resourceId} is generated-data support for lesson ${item.lessonKey}; it can support evidence interpretation but is not a standalone path node.`;
  }
  if (disposition === 'embedded-asset') {
    return `${item.resourceId} is an embedded lesson visual tied to ${graphScope}; ${anchorState} is sufficient for citation support, not PathNode promotion.`;
  }
  return `${item.resourceId} supports lesson ${item.lessonKey} as citation material tied to ${graphScope}; ${anchorState} remains the promotion blocker.`;
}

function buildSummary(items: ScopedWorkqueueItem[], reviewItems: ReviewItem[]) {
  const selectedItems = items.filter((item) => item.selectedForReview);
  return {
    artifactVersion: ARTIFACT_VERSION,
    generatedAt: GENERATED_AT,
    reviewBatchId: REVIEW_BATCH_ID,
    selectedShardId: `lesson:${SELECTED_LESSON}`,
    selectionBasis: 'deterministic lesson shard selected by RUNTIME_MEDIA_HANDOUT_REVIEW_LESSON',
    totals: {
      scopedRows: items.length,
      runtimeLessonMedia: items.filter((item) => item.family === 'runtime-lesson-media').length,
      runtimeHandouts: items.filter((item) => item.family === 'runtime-handout').length,
      nonMediaHandoutRows: items.filter((item) => item.family !== 'runtime-lesson-media' && item.family !== 'runtime-handout').length,
      selectedRows: selectedItems.length,
      unselectedRows: items.length - selectedItems.length,
      reviewedRows: reviewItems.length,
    },
    selectedShard: {
      lessonKey: SELECTED_LESSON,
      total: selectedItems.length,
      reviewed: reviewItems.length,
      remaining: selectedItems.length - reviewItems.length,
      independentPathPlannableMedia: reviewItems.filter((item) => item.independentPathMetadataComplete).length,
      promotedAsPathNode: reviewItems.filter((item) => item.promotedAsPathNode).length,
      dispositions: countBy(reviewItems, (item) => item.disposition),
      citationAnchorStates: countBy(reviewItems, (item) => item.citationAnchorState),
    },
    grouping: {
      byLesson: countBy(items, (item) => item.lessonKey),
      byFamily: countBy(items, (item) => item.family),
      byKind: countBy(items, (item) => item.resourceKind),
      byBlockerType: countBy(items, (item) => item.blockerType),
      byDeterministicShard: countBy(items, (item) => item.deterministicShardId),
    },
    guardrails: {
      excludesTextbookSections: items.every((item) => !item.family.includes('textbook')),
      excludesRuntimeLessonSteps: items.every((item) => !item.resourceId.startsWith('runtime-step:')),
      selectedCitationOnlyNotPromoted: reviewItems.every((item) => !item.promotedAsPathNode),
      rawContentIncluded: false,
    },
  };
}

function renderEvidenceMarkdown(summary: ReturnType<typeof buildSummary>, reviewItems: ReviewItem[]) {
  const rows = reviewItems.map((item) => `| ${[
    item.resourceId,
    item.resourceKind,
    item.disposition,
    item.citationAnchorState,
    item.sourceHash ? 'yes' : 'no',
    item.promotedAsPathNode ? 'yes' : 'no',
  ].join(' | ')} |`);
  return [
    '# Runtime Media Handout Disposition Review Evidence',
    '',
    `Generated at: ${summary.generatedAt}`,
    `Review batch: ${summary.reviewBatchId}`,
    `Selected shard: ${summary.selectedShardId}`,
    '',
    `Scoped rows: ${summary.totals.scopedRows}`,
    `Runtime media rows: ${summary.totals.runtimeLessonMedia}`,
    `Runtime handout rows: ${summary.totals.runtimeHandouts}`,
    `Selected reviewed rows: ${summary.selectedShard.reviewed}`,
    `Selected remaining: ${summary.selectedShard.remaining}`,
    '',
    '## Guardrails',
    '',
    `- Textbook sections excluded: ${summary.guardrails.excludesTextbookSections}`,
    `- Selected citation-only media promoted as PathNodes: ${summary.selectedShard.promotedAsPathNode}`,
    `- Raw content included: ${summary.guardrails.rawContentIncluded}`,
    '',
    '## Selected Rows',
    '',
    '| Resource | Kind | Disposition | Anchor state | Source hash | PathNode |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

function groupWorkqueueItems(items: WorkqueueItem[]) {
  const map = new Map<string, WorkqueueItem[]>();
  for (const item of items) {
    if (item.sourceFamily !== 'runtime-lesson-media' && item.sourceFamily !== 'runtime-handout') continue;
    const current = map.get(item.resourceId) ?? [];
    current.push(item);
    map.set(item.resourceId, current);
  }
  return map;
}

function lessonKeyFor(row: RuntimeProjectionRow) {
  if (row.family === 'runtime-handout') return row.id.replace(/^runtime-handout:/, '');
  if (row.sourceRecord?.includes(':')) return row.sourceRecord.split(':')[0] ?? 'unknown';
  return row.id.replace(/^runtime-media:/, '').split(':')[0] ?? 'unknown';
}

function blockerTypeFor(blockers: string[]) {
  if (blockers.includes('missing-content-hash')) return 'identity-repair';
  if (blockers.includes('missing-human-review') || blockers.includes('provisional-metadata')) return 'semantic-disposition-review';
  if (blockers.includes('missing-path-profile') || blockers.includes('missing-path-target')) return 'path-metadata';
  if (blockers.includes('missing-evidence-contract') || blockers.includes('missing-evidence-instrumentation')) return 'evidence-contract';
  if (blockers.includes('missing-knowledge-binding') || blockers.includes('missing-capability-target')) return 'graph-binding';
  return 'none';
}

async function hashProjectPath(sourcePathOrUrl: string | null): Promise<string | null> {
  const filePath = projectFilePathFor(sourcePathOrUrl);
  if (!filePath) return null;
  try {
    return `sha256:${createHash('sha256').update(await fs.readFile(filePath)).digest('hex')}`;
  } catch {
    return null;
  }
}

function projectFilePathFor(sourcePathOrUrl: string | null) {
  if (!sourcePathOrUrl || /^https?:\/\//i.test(sourcePathOrUrl)) return null;
  if (sourcePathOrUrl.startsWith('course-content/')) return path.join(process.cwd(), sourcePathOrUrl);
  if (sourcePathOrUrl.startsWith('/course-runtime/lessons/')) {
    return path.join(process.cwd(), sourcePathOrUrl.replace(/^\/course-runtime\/lessons\//, 'course-content/runtime/lessons/'));
  }
  return null;
}

function privacyMinimizedSourcePath(sourcePathOrUrl: string | null | undefined) {
  if (!sourcePathOrUrl) return null;
  if (/^https?:\/\//i.test(sourcePathOrUrl)) {
    return `external-url:${createHash('sha256').update(sourcePathOrUrl).digest('hex').slice(0, 16)}`;
  }
  return sourcePathOrUrl;
}

function hashShardFor(resourceId: string) {
  const digest = createHash('sha256').update(resourceId).digest();
  return String(digest[0] % HASH_SHARD_COUNT).padStart(2, '0');
}

async function readJsonl<T>(filePath: string): Promise<T[]> {
  const text = await fs.readFile(filePath, 'utf8');
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

async function writeJsonl(filePath: string, rows: unknown[]) {
  await fs.writeFile(filePath, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8');
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
