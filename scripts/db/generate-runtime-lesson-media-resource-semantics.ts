import { promises as fs } from 'node:fs';
import path from 'node:path';

import { ADAPTIVE_LEARNING_GOAL_DEFINITIONS } from '@/lib/adaptive-learning-path-planner';
import {
  assertRuntimeLessonSemanticReviewEvidence,
  buildRuntimeLessonSemanticDecisionHash,
  RUNTIME_SEMANTIC_DECISION_VERSION,
  type RuntimeLessonSemanticDecisionFacts,
  type RuntimeLessonSemanticReviewEvidence,
  type RuntimeSemanticAssetObservation,
} from './runtime-lesson-semantic-evidence';

const GOVERNANCE_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const OUTPUT_PREFIX = path.join(GOVERNANCE_DIR, 'runtime-lesson-media-resource-semantics');
const ARTIFACT_VERSION = 'runtime-lesson-media-resource-semantics.v1' as const;
const REVIEW_SOURCE_ARTIFACT_VERSION = 'runtime-lesson-media-resource-semantics.review-source.v1' as const;
const REVIEW_SOURCE_KIND = 'explicit-item-review' as const;

const SCOPED_FAMILIES = new Set([
  'runtime-lesson-step',
  'runtime-lesson-module',
  'runtime-lesson-media',
  'runtime-handout',
]);

type Disposition =
  | 'planning-unit'
  | 'supporting-citation'
  | 'embedded-asset'
  | 'evidence-producing'
  | 'excluded-with-rationale';

type JsonRow = Record<string, any>;

interface ReviewSourceRow {
  artifactVersion: typeof REVIEW_SOURCE_ARTIFACT_VERSION;
  reviewSourceKind: typeof REVIEW_SOURCE_KIND;
  reviewBatchId: string;
  reviewerId: string;
  reviewerRole: string;
  reviewedAt: string;
  resourceId: string;
  sourceFamily: string;
  expectedSourceHash: string | null;
  expectedSourceVersionRef: string | null;
  sourceEvidenceHash: string | null;
  disposition: Disposition;
  promotedAsPlanningUnit: boolean;
  currentPathEligible: boolean;
  pathTarget: string | null;
  parentLessonRef: string;
  parentResourceRef: string | null;
  parentPlanningUnitRef: string | null;
  graphNodeRefs: { knowledge: string[]; capability: string[]; quality: string[] };
  learningGoalIds: string[];
  knowledgeObjectiveIds: string[];
  capabilityObjectiveIds: string[];
  qualityObjectiveIds: string[];
  learningGoalFit: 'verified-by-formal-audit' | 'reviewed-source-fit' | 'not-claimed-supporting';
  evidenceDecision: 'independent-path-evidence' | 'parent-evidence' | 'citation-only' | 'embedded' | 'excluded';
  evidenceContractComplete: boolean;
  evidenceMissingFields: string[];
  evidenceInstrumentation: string[];
  readinessPresent: boolean;
  estimatedTimeMinutes: number | null;
  citationTargets: string[];
  independentEvidenceRef: string;
  reviewerVisibleRationale: string;
  confidence: number | null;
  rawContentIncluded: false;
  privacyMinimized: true;
  reasonCodes: string[];
  decisionVersion: typeof RUNTIME_SEMANTIC_DECISION_VERSION;
  decisionHash: string;
  decisionFacts: RuntimeLessonSemanticDecisionFacts;
  assetObservation?: RuntimeSemanticAssetObservation;
  runtimeEvidence: RuntimeLessonSemanticReviewEvidence;
}

interface ReviewItem extends ReviewSourceRow {
  artifactVersion: 'runtime-lesson-media-resource-semantics.v1';
  title: string;
  resourceType: string;
  lessonKey: string;
  sourcePathOrUrl: string | null;
  sourceRecord: string | null;
  startingBlockerCodes: string[];
  startingBlockerCount: number;
  parentLessonRef: string;
  parentResourceRef: string | null;
  parentPlanningUnitRef: string | null;
  graphNodeRefs: { knowledge: string[]; capability: string[]; quality: string[] };
  learningGoalIds: string[];
  learningGoalFit: 'verified-by-formal-audit' | 'reviewed-source-fit' | 'not-claimed-supporting';
  evidenceContractComplete: boolean;
  evidenceMissingFields: string[];
  evidenceInstrumentation: string[];
  readinessPresent: boolean;
  estimatedTimeMinutes: number | null;
  citationTargets: string[];
  sourceReview: {
    sourceArtifact: string;
    reviewBatchId: string;
    reviewerId: string;
    reviewedAt: string;
    originalClassification: string | null;
  };
}

function readJsonl<T extends JsonRow>(text: string): T[] {
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as T);
}

async function readJsonlFile<T extends JsonRow>(filePath: string): Promise<T[]> {
  return readJsonl<T>(await fs.readFile(filePath, 'utf8'));
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function indexById(rows: readonly JsonRow[], label: string) {
  const index = new Map<string, JsonRow>();
  for (const row of rows) {
    assert(typeof row.resourceId === 'string' || typeof row.id === 'string', `${label} row lacks stable id`);
    const id = row.resourceId ?? row.id;
    assert(!index.has(id), `Duplicate ${label} row: ${id}`);
    index.set(id, row);
  }
  return index;
}

function lessonKeyFor(resourceId: string) {
  const parts = resourceId.split(':');
  return parts[1] ?? 'unknown';
}

function safeSourcePathOrUrl(sourcePathOrUrl: string | null) {
  if (!sourcePathOrUrl || !/^https?:\/\//i.test(sourcePathOrUrl)) return sourcePathOrUrl;
  return 'external-source:redacted';
}

async function loadFormalReviewSources(): Promise<Map<string, ReviewSourceRow>> {
  const sourcePath = `${OUTPUT_PREFIX}-review-source.jsonl`;
  const sourceRows = await readJsonlFile<ReviewSourceRow>(sourcePath);
  if (sourceRows.length === 0) {
    throw new Error(`Explicit runtime lesson/media semantic review source is empty or missing: ${sourcePath}`);
  }
  const sources = new Map<string, ReviewSourceRow>();
  for (const source of sourceRows) {
    if (source.artifactVersion !== REVIEW_SOURCE_ARTIFACT_VERSION || source.reviewSourceKind !== REVIEW_SOURCE_KIND) {
      throw new Error(`Invalid explicit runtime lesson/media semantic review source: ${source.resourceId}`);
    }
    if (sources.has(source.resourceId)) throw new Error(`Duplicate explicit runtime review source: ${source.resourceId}`);
    if (!SCOPED_FAMILIES.has(source.sourceFamily)) throw new Error(`Out-of-scope explicit runtime review source: ${source.resourceId}`);
    if (source.promotedAsPlanningUnit !== (source.disposition === 'planning-unit')) {
      throw new Error(`Explicit runtime review source promotion/disposition mismatch: ${source.resourceId}`);
    }
    if (!source.reviewerId || !source.reviewerRole || !source.reviewBatchId || !source.reviewedAt || !source.reviewerVisibleRationale) {
      throw new Error(`Explicit runtime review source lacks per-item review metadata: ${source.resourceId}`);
    }
    if (!Array.isArray(source.reasonCodes) || source.reasonCodes.length === 0 || !source.decisionFacts || typeof source.decisionFacts !== 'object') {
      throw new Error(`Explicit runtime review source lacks per-item decision facts: ${source.resourceId}`);
    }
    if (source.decisionVersion !== RUNTIME_SEMANTIC_DECISION_VERSION || source.decisionHash !== buildRuntimeLessonSemanticDecisionHash(source)) {
      throw new Error(`Explicit runtime review source decision hash/version mismatch: ${source.resourceId}`);
    }
    if (!source.independentEvidenceRef || /runtime-lesson-media-resource-semantics-(?:review|workqueue|summary|evidence)/i.test(source.independentEvidenceRef)) {
      throw new Error(`Explicit runtime review source has non-independent evidence: ${source.resourceId}`);
    }
    sources.set(source.resourceId, source);
  }
  return sources;
}

function assertExplicitSourceMatchesRow(row: JsonRow, source: ReviewSourceRow) {
  assert(source.sourceFamily === row.family, `explicit runtime source family mismatch: ${row.resourceId}`);
  assert(source.expectedSourceHash === row.sourceHash, `explicit runtime source hash mismatch: ${row.resourceId}`);
  assert(source.expectedSourceVersionRef === row.sourceVersionRef, `explicit runtime source version mismatch: ${row.resourceId}`);
  assert(source.graphNodeRefs && JSON.stringify(source.graphNodeRefs) === JSON.stringify(row.graphNodeRefs), `explicit runtime graph refs mismatch: ${row.resourceId}`);
  assert(source.estimatedTimeMinutes === row.estimatedTimeMinutes, `explicit runtime time measurement mismatch: ${row.resourceId}`);
  assert(source.readinessPresent === (row.readiness !== null), `explicit runtime readiness decision mismatch: ${row.resourceId}`);
  assert(source.evidenceContractComplete === row.evidenceContract.complete, `explicit runtime evidence decision mismatch: ${row.resourceId}`);
  assert(JSON.stringify(source.evidenceMissingFields) === JSON.stringify(row.evidenceContract.missingFields), `explicit runtime evidence missing fields mismatch: ${row.resourceId}`);
  assert(source.decisionVersion === RUNTIME_SEMANTIC_DECISION_VERSION, `explicit runtime decision version mismatch: ${row.resourceId}`);
  const citationTargets = row.citationTargets.filter((target: string) => !/^https?:\/\//i.test(target)).sort();
  assert(JSON.stringify(source.citationTargets) === JSON.stringify(citationTargets), `explicit runtime citation decision mismatch: ${row.resourceId}`);
  if (source.promotedAsPlanningUnit) {
    assert(row.family === 'runtime-lesson-step', `only runtime lesson steps may be promoted: ${row.resourceId}`);
    assert(source.currentPathEligible && source.pathTarget === row.pathTarget, `explicit runtime path decision mismatch: ${row.resourceId}`);
    assert(row.missingFieldCodes.length === 0 && row.pathEligibility.current && row.pathEligibility.afterCompletion && row.pathEligibility.blockedBy.length === 0, `explicit runtime promotion has audit blockers: ${row.resourceId}`);
    assert(source.learningGoalIds.length > 0 && source.knowledgeObjectiveIds.length > 0 && source.capabilityObjectiveIds.length > 0 && source.qualityObjectiveIds.length > 0, `explicit runtime promotion lacks LearningGoal/K/A/Q: ${row.resourceId}`);
    assert(source.evidenceDecision === 'independent-path-evidence' && source.evidenceInstrumentation.length > 0, `explicit runtime promotion lacks evidence decision: ${row.resourceId}`);
    assert(source.readinessPresent && source.estimatedTimeMinutes !== null && source.estimatedTimeMinutes > 0, `explicit runtime promotion lacks readiness/time decision: ${row.resourceId}`);
    assert(source.citationTargets.length > 0, `explicit runtime promotion lacks citation decision: ${row.resourceId}`);
    assert(source.graphNodeRefs.knowledge.length > 0, `explicit runtime promotion lacks graph decision: ${row.resourceId}`);
    assert(source.evidenceContractComplete && source.evidenceMissingFields.length === 0, `explicit runtime promotion lacks complete evidence contract: ${row.resourceId}`);
    for (const goalId of source.learningGoalIds) {
      assert(Boolean(ADAPTIVE_LEARNING_GOAL_DEFINITIONS[goalId]?.learningGoal), `explicit runtime source has unknown LearningGoal: ${row.resourceId}:${goalId}`);
    }
    const objectives = {
      knowledge: new Set(source.learningGoalIds.flatMap((id) => ADAPTIVE_LEARNING_GOAL_DEFINITIONS[id].learningGoal!.knowledgeObjectiveIds)),
      capability: new Set(source.learningGoalIds.flatMap((id) => ADAPTIVE_LEARNING_GOAL_DEFINITIONS[id].learningGoal!.capabilityObjectiveIds)),
      quality: new Set(source.learningGoalIds.flatMap((id) => ADAPTIVE_LEARNING_GOAL_DEFINITIONS[id].learningGoal!.qualityObjectiveIds)),
    };
    for (const [domain, ids] of Object.entries({
      knowledge: source.knowledgeObjectiveIds,
      capability: source.capabilityObjectiveIds,
      quality: source.qualityObjectiveIds,
    }) as Array<[keyof typeof objectives, string[]]>) {
      assert(ids.every((id) => objectives[domain].has(id)), `explicit runtime source has out-of-bound ${domain} objective: ${row.resourceId}`);
    }
  } else {
    assert(!source.currentPathEligible && source.pathTarget === null, `explicit runtime support row exposes path eligibility: ${row.resourceId}`);
  }
}

async function main() {
  const [auditRows, projectionRows, baselineBindings, reviewSources] = await Promise.all([
    readJsonlFile(path.join(GOVERNANCE_DIR, 'resource-field-completion-audit.jsonl')),
    readJsonlFile(path.join(GOVERNANCE_DIR, 'runtime-resource-projections.jsonl')),
    readJsonlFile(path.join(GOVERNANCE_DIR, 'learning-goal-resource-baseline-reviewed-bindings.jsonl')),
    loadFormalReviewSources(),
  ]);
  const scopedRows = auditRows.filter((row) => SCOPED_FAMILIES.has(row.family));
  const auditById = indexById(scopedRows, 'scoped audit');
  const projectionById = indexById(projectionRows.filter((row) => SCOPED_FAMILIES.has(row.family)), 'scoped projection');
  assert(auditById.size === scopedRows.length, 'scoped audit denominator must be unique');
  assert(projectionById.size === auditById.size, `scoped projection denominator mismatch: ${projectionById.size} vs ${auditById.size}`);
  for (const id of auditById.keys()) assert(projectionById.has(id), `missing scoped projection row: ${id}`);
  for (const id of projectionById.keys()) assert(auditById.has(id), `out-of-audit scoped projection row: ${id}`);
  assert(reviewSources.size === auditById.size, `review coverage mismatch: ${reviewSources.size} vs ${auditById.size}`);
  const promotedIds = new Set([...reviewSources.values()]
    .filter((source) => source.promotedAsPlanningUnit)
    .map((source) => source.resourceId));
  const baselineBindingIds = new Set(
    baselineBindings
      .filter((binding) => SCOPED_FAMILIES.has(auditById.get(binding.resourceId)?.family))
      .map((binding) => `${binding.learningGoalId}:${binding.resourceId}`),
  );
  for (const row of scopedRows) {
    const source = reviewSources.get(row.resourceId);
    assert(source, `unreviewed runtime row has no explicit item-level disposition: ${row.resourceId}`);
    assertExplicitSourceMatchesRow(row, source);
    assertRuntimeLessonSemanticReviewEvidence(row, source);
    assert(source.parentResourceRef === null || auditById.has(source.parentResourceRef), `explicit runtime source parent resource is outside the scoped audit: ${row.resourceId}`);
    assert(source.parentResourceRef === null || !source.parentResourceRef.startsWith('runtime-lesson:'), `explicit runtime source uses a lesson placeholder as parent resource: ${row.resourceId}`);
    assert(source.parentResourceRef === null || source.runtimeEvidence.parent.resourceCandidates.includes(source.parentResourceRef), `explicit runtime source parent resource is not resolved by the runtime manifest: ${row.resourceId}`);
    assert(source.parentPlanningUnitRef === null || promotedIds.has(source.parentPlanningUnitRef), `explicit runtime source parent is not a promoted PlanningUnit: ${row.resourceId}`);
    if (source.promotedAsPlanningUnit) {
      for (const goalId of source.learningGoalIds) {
        assert(baselineBindingIds.has(`${goalId}:${row.resourceId}`), `promoted runtime row lacks an existing LearningGoal baseline binding: ${row.resourceId}:${goalId}`);
      }
    }
  }

  const workqueueItems: JsonRow[] = [];
  const reviewItems: ReviewItem[] = [];
  const byDisposition = new Map<string, number>();
  const byFamily = new Map<string, number>();
  const byAssetStatus = new Map<string, number>();
  const startingBlockers = new Map<string, number>();
  for (const [index, row] of scopedRows.slice().sort((left, right) => left.resourceId.localeCompare(right.resourceId)).entries()) {
    const source = reviewSources.get(row.resourceId)!;
    const lessonKey = lessonKeyFor(row.resourceId);
    const reviewItem: ReviewItem = {
      ...source,
      artifactVersion: ARTIFACT_VERSION,
      title: row.title,
      resourceType: row.resourceType,
      lessonKey,
      sourcePathOrUrl: safeSourcePathOrUrl(row.sourcePathOrUrl),
      sourceRecord: row.sourceRecord,
      startingBlockerCodes: [...row.missingFieldCodes],
      startingBlockerCount: row.missingFieldCodes.length,
      sourceReview: {
        sourceArtifact: 'course-content/runtime/resource-governance/runtime-lesson-media-resource-semantics-review-source.jsonl',
        reviewBatchId: source.reviewBatchId,
        reviewerId: source.reviewerId,
        reviewedAt: source.reviewedAt,
        originalClassification: source.disposition,
      },
    };
    reviewItems.push(reviewItem);
    workqueueItems.push({
      artifactVersion: ARTIFACT_VERSION,
      reviewBatchId: source.reviewBatchId,
      selectedOrder: index + 1,
      resourceId: row.resourceId,
      sourceFamily: row.family,
      resourceType: row.resourceType,
      lessonKey,
      title: row.title,
      startingBlockerCodes: [...row.missingFieldCodes],
      startingBlockerCount: row.missingFieldCodes.length,
      reviewState: 'reviewed',
      disposition: source.disposition,
      promotedAsPlanningUnit: source.promotedAsPlanningUnit,
      parentLessonRef: source.parentLessonRef,
      parentResourceRef: source.parentResourceRef,
      parentPlanningUnitRef: source.parentPlanningUnitRef,
      evidenceDecision: source.evidenceDecision,
      rawContentIncluded: false,
      privacyMinimized: true,
    });
    byDisposition.set(source.disposition, (byDisposition.get(source.disposition) ?? 0) + 1);
    byFamily.set(row.family, (byFamily.get(row.family) ?? 0) + 1);
    byAssetStatus.set(source.decisionFacts.source.assetStatus, (byAssetStatus.get(source.decisionFacts.source.assetStatus) ?? 0) + 1);
    for (const code of row.missingFieldCodes) startingBlockers.set(code, (startingBlockers.get(code) ?? 0) + 1);
  }

  assert(reviewItems.length === scopedRows.length, 'review item denominator must equal scoped audit denominator');
  assert(reviewItems.every((item) => item.rawContentIncluded === false && item.privacyMinimized), 'closure review must be privacy minimized');
  assert(reviewItems.filter((item) => item.promotedAsPlanningUnit).every((item) => item.sourceFamily === 'runtime-lesson-step'), 'only runtime lesson steps may be promoted');
  assert(reviewItems.filter((item) => item.promotedAsPlanningUnit).every((item) => item.pathTarget && item.evidenceContractComplete && item.readinessPresent && item.learningGoalIds.length > 0), 'promoted rows must retain independent launch/evidence/LearningGoal metadata');

  const sorted = <T extends { resourceId: string }>(rows: readonly T[]) => rows.slice().sort((left, right) => left.resourceId.localeCompare(right.resourceId));
  const reviewBatchIds = [...new Set(reviewItems.map((item) => item.reviewBatchId))].sort();
  const reviewerIds = [...new Set(reviewItems.map((item) => item.reviewerId))].sort();
  const reviewerRoles = [...new Set(reviewItems.map((item) => item.reviewerRole))].sort();
  const reviewedAtValues = reviewItems.map((item) => item.reviewedAt).sort();
  const remaining = scopedRows.length - reviewItems.length;
  const summary = {
    artifactVersion: ARTIFACT_VERSION,
    reviewBatchIds,
    reviewerIds,
    reviewerRoles,
    reviewedAtRange: { from: reviewedAtValues[0] ?? null, to: reviewedAtValues.at(-1) ?? null },
    totals: {
      scopedRows: scopedRows.length,
      workqueueItems: workqueueItems.length,
      reviewedRows: reviewItems.length,
      remaining,
      unexplainedUnreviewed: remaining,
      promotedPlanningUnits: reviewItems.filter((item) => item.promotedAsPlanningUnit).length,
      residualFormalBlockers: reviewItems.reduce((total, item) => total + item.startingBlockerCount, 0),
    },
    bySourceFamily: Object.fromEntries([...byFamily.entries()].sort()),
    byDisposition: Object.fromEntries([...byDisposition.entries()].sort()),
    byAssetStatus: Object.fromEntries([...byAssetStatus.entries()].sort()),
    startingBlockers: Object.fromEntries([...startingBlockers.entries()].sort()),
    guardrails: {
      onlyRuntimeLessonStepModuleMediaHandoutFamilies: true,
      excludesTextbookReferenceAndAssessmentFamilies: true,
      exactAuditProjectionDenominator: true,
      allScopedRowsItemReviewed: true,
      unexplainedUnreviewedRows: remaining,
      onlyIndependentLaunchAndEvidenceRowsPromoted: true,
      mediaAndHandoutPathNodePromotion: false,
      rawContentIncluded: false,
      privacyMinimized: true,
    },
    evidence: {
      workqueueItemsPath: 'course-content/runtime/resource-governance/runtime-lesson-media-resource-semantics-workqueue-items.jsonl',
      reviewSourcePath: 'course-content/runtime/resource-governance/runtime-lesson-media-resource-semantics-review-source.jsonl',
      reviewItemsPath: 'course-content/runtime/resource-governance/runtime-lesson-media-resource-semantics-review-items.jsonl',
      auditPath: 'course-content/runtime/resource-governance/resource-field-completion-audit.jsonl',
      projectionPath: 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl',
    },
  };
  const evidence = [
    '# Runtime lesson/media resource semantics closure',
    '',
    `Review batches: ${reviewBatchIds.join(', ')}`,
    `Scoped audit/projection rows: ${scopedRows.length}`,
    `Reviewed rows: ${reviewItems.length}`,
    `Unexplained unreviewed rows: ${summary.totals.unexplainedUnreviewed}`,
    `Promoted PlanningUnits: ${summary.totals.promotedPlanningUnits} (runtime lesson steps only)`,
    `Media/handout/module promotions: 0`,
    '',
    '## Family counts',
    '',
    ...Object.entries(summary.bySourceFamily).map(([family, count]) => `- ${family}: ${count}`),
    '',
    '## Disposition counts',
    '',
    ...Object.entries(summary.byDisposition).map(([disposition, count]) => `- ${disposition}: ${count}`),
    '',
    '## Runtime asset status',
    '',
    ...Object.entries(summary.byAssetStatus).map(([status, count]) => `- ${status}: ${count}`),
    '',
    '## Review decision',
    '',
    'Each row consumes an explicit item-level decision from the committed review source and is checked against the runtime audit/projection identity. The helper does not infer dispositions, LearningGoal bindings, rationale, reviewer metadata, or independent evidence references.',
    '',
    '## Evidence reference syntax',
    '',
    'Every `independentEvidenceRef` is `<project-relative-file>#<selector>`. JSON manifests use `json-pointer:/...` and the loader resolves the pointer against the parsed document; Markdown handouts/media indexes use `markdown-line:<positive-line-number>` and the loader checks the non-empty line; only git-index tracked local binary/structured media use `file-sha256:<64-hex-digest>`. A local file present only in the working tree is marked `missing-local-runtime-asset` and uses its real media-index heading line without inventing a file hash. External media is allowed only when the media-index entry contains a real HTTP(S) URL and its URL identity matches the audit source URL; it uses that media-index line and retains the URL identity only as a sha256 digest. Asset status is derived only from the actual git-index state, audit sourcePathOrUrl, and the real media-index URL identity; `runtimeEvidence.assetStatus` and `runtimeEvidence.sourceFilePath` are validated declarations, never classifiers. `assetObservation.workingTreePresent` is retained only as a non-canonical local observation and is excluded from status and decision hashes.',
    '',
    '## Formal blockers retained',
    '',
    'Starting blocker codes remain visible in each workqueue and review row. They are downstream implementation gaps, not unexplained semantic-review gaps.',
    '',
  ].join('\n');

  await fs.mkdir(GOVERNANCE_DIR, { recursive: true });
  await Promise.all([
    fs.writeFile(`${OUTPUT_PREFIX}-workqueue-items.jsonl`, `${sorted(workqueueItems).map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8'),
    fs.writeFile(`${OUTPUT_PREFIX}-review-items.jsonl`, `${sorted(reviewItems).map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8'),
    fs.writeFile(`${OUTPUT_PREFIX}-workqueue-summary.json`, `${JSON.stringify(summary, null, 2)}\n`, 'utf8'),
    fs.writeFile(`${OUTPUT_PREFIX}-review-evidence.md`, evidence, 'utf8'),
  ]);
  console.log(`Runtime lesson/media semantics scoped rows: ${scopedRows.length}`);
  console.log(`Runtime lesson/media semantics reviewed rows: ${reviewItems.length}`);
  console.log(`Runtime lesson/media semantics promoted PlanningUnits: ${summary.totals.promotedPlanningUnits}`);
  console.log(`Runtime lesson/media semantics remaining: ${summary.totals.remaining}`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
