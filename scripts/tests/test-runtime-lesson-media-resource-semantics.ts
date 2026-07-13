import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';

import { runtimeLessonMediaSemanticFormalReviewOverlaysForRows } from '../db/generate-resource-field-completion-audit';
import {
  getLearningGoal,
  listLearningGoals,
  validateLearningGoalCatalog,
  validateLearningGoalPackageCatalog,
} from '@/lib/adaptive-learning-path-planner';
import {
  assertRuntimeLessonSemanticReviewEvidence,
  assertRuntimeSemanticEvidenceReference,
  buildRuntimeLessonSemanticDecisionFacts,
  buildRuntimeLessonSemanticDecisionHash,
  buildRuntimeLessonSemanticEvidence,
  buildRuntimeLessonSemanticReasonCodes,
  deriveRuntimeSemanticAssetStatus,
  RUNTIME_SEMANTIC_ASSET_OBSERVATION_VERSION,
  RUNTIME_SEMANTIC_DECISION_VERSION,
} from '../db/runtime-lesson-semantic-evidence';

type JsonRow = Record<string, any>;

const governanceDir = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const scopedFamilies = new Set([
  'runtime-lesson-step',
  'runtime-lesson-module',
  'runtime-lesson-media',
  'runtime-handout',
]);

const readJsonl = (filename: string) => readFileSync(path.join(governanceDir, filename), 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line) as JsonRow);
const indexById = (rows: readonly JsonRow[]) => new Map(rows.map((row) => [row.resourceId ?? row.id, row]));
const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw new Error(message);
};
const hasObjectKey = (value: unknown, key: string): boolean => {
  if (Array.isArray(value)) return value.some((entry) => hasObjectKey(entry, key));
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([entryKey, entryValue]) => entryKey === key || hasObjectKey(entryValue, key));
};
const hashFile = (relativePath: string) => `sha256:${createHash('sha256').update(
  readFileSync(path.join(process.cwd(), relativePath)),
).digest('hex')}`;
const isIndexPath = (relativePath: string) => {
  try {
    execFileSync('git', ['cat-file', '-e', `:${relativePath}`], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
const mediaIndexBlockHttpUrl = (relativePath: string, headingLine: number) => {
  const lines = readFileSync(path.join(process.cwd(), relativePath), 'utf8').split(/\r?\n/);
  const nextHeading = lines.findIndex((line, index) => index >= headingLine && /^#{1,6}\s+/.test(line));
  const end = nextHeading < 0 ? lines.length : nextHeading;
  return lines.slice(headingLine - 1, end).find((line) => /^https?:\/\/\S+$/i.test(line.trim()))?.trim() ?? null;
};
const canonicalAssetStatusFromSnapshot = (audit: JsonRow, source: JsonRow) => {
  const observation = source.assetObservation;
  assert(observation?.schemaVersion === RUNTIME_SEMANTIC_ASSET_OBSERVATION_VERSION, `${source.resourceId} asset observation schema is missing`);
  const mediaUrl = source.runtimeEvidence.mediaIndexPath && source.runtimeEvidence.mediaIndexLine
    ? mediaIndexBlockHttpUrl(source.runtimeEvidence.mediaIndexPath, source.runtimeEvidence.mediaIndexLine)
    : null;
  return deriveRuntimeSemanticAssetStatus({
    gitIndexTracked: observation.gitIndexTracked,
    auditSourcePathOrUrl: audit.sourcePathOrUrl,
    mediaIndexUrl: mediaUrl,
  });
};
const resolveJsonPointer = (document: unknown, pointer: string): unknown => {
  assert(pointer === '' || pointer.startsWith('/'), `invalid JSON Pointer in independent test: ${pointer}`);
  let current: any = document;
  for (const rawSegment of pointer === '' ? [] : pointer.slice(1).split('/')) {
    const segment = rawSegment.replace(/~1/g, '/').replace(/~0/g, '~');
    assert(current !== null && current !== undefined, `JSON Pointer traversed null in independent test: ${pointer}`);
    current = Array.isArray(current) ? current[Number(segment)] : current[segment];
    assert(current !== undefined, `JSON Pointer target missing in independent test: ${pointer}`);
  }
  return current;
};
const independentlyVerifyEvidence = (resourceId: string, source: JsonRow) => {
  const hashIndex = source.independentEvidenceRef.indexOf('#');
  assert(hashIndex > 0 && hashIndex === source.independentEvidenceRef.lastIndexOf('#'), `${resourceId} evidence ref must have one fragment`);
  const evidenceFile = source.independentEvidenceRef.slice(0, hashIndex);
  const selector = source.independentEvidenceRef.slice(hashIndex + 1);
  const actualHash = hashFile(evidenceFile);
  assert(actualHash === source.sourceEvidenceHash, `${resourceId} source evidence hash must match the independently read file`);
  if (selector.startsWith('json-pointer:')) {
    const manifest = JSON.parse(readFileSync(path.join(process.cwd(), evidenceFile), 'utf8')) as unknown;
    resolveJsonPointer(manifest, selector.slice('json-pointer:'.length));
  } else if (selector.startsWith('markdown-line:')) {
    const lineNumber = Number(selector.slice('markdown-line:'.length));
    const lines = readFileSync(path.join(process.cwd(), evidenceFile), 'utf8').split(/\r?\n/);
    assert(Number.isInteger(lineNumber) && lineNumber > 0 && lineNumber <= lines.length && lines[lineNumber - 1].trim().length > 0, `${resourceId} Markdown evidence line must exist`);
  } else if (selector.startsWith('file-sha256:')) {
    const fileHash = selector.slice('file-sha256:'.length);
    assert(/^[0-9a-f]{64}$/i.test(fileHash), `${resourceId} file evidence selector must contain a raw sha256 digest`);
    execFileSync('git', ['cat-file', '-e', `:${evidenceFile}`], { stdio: 'pipe' });
    assert(actualHash === `sha256:${fileHash.toLowerCase()}`, `${resourceId} file evidence selector hash mismatch`);
  } else {
    throw new Error(`${resourceId} has an unsupported independent evidence selector`);
  }
};

const formalArtifactPaths = [
  'course-content/runtime/resource-governance/runtime-lesson-media-resource-semantics-review-source.jsonl',
  'course-content/runtime/resource-governance/runtime-lesson-media-resource-semantics-review-items.jsonl',
  'course-content/runtime/resource-governance/runtime-lesson-media-resource-semantics-review-evidence.md',
  'course-content/runtime/resource-governance/runtime-lesson-media-resource-semantics-workqueue-items.jsonl',
  'course-content/runtime/resource-governance/runtime-lesson-media-resource-semantics-workqueue-summary.json',
];
for (const filePath of formalArtifactPaths) {
  execFileSync('git', ['ls-files', '--error-unmatch', filePath], { stdio: 'pipe' });
}
const materializerSource = readFileSync(
  path.join(process.cwd(), 'scripts/db/materialize-runtime-lesson-media-semantic-review-source.ts'),
  'utf8',
);
assert(materializerSource.includes('validate-explicit-source'), 'materializer must expose explicit-source validation mode');
assert(!materializerSource.includes('writeFile') && !materializerSource.includes('reviewerVisibleRationale:'), 'materializer must not write or synthesize reviewer rationale');
execFileSync('npx', ['tsx', '-e', "(async()=>{const {loadRuntimeLessonMediaSemanticReviewMap}=await import('./scripts/db/generate-resource-field-completion-audit.ts'); const sources=await loadRuntimeLessonMediaSemanticReviewMap(); if(sources.size!==2598) throw new Error('formal loader denominator mismatch');})()"], { stdio: 'pipe' });

const artifactNames = [
  'runtime-lesson-media-resource-semantics-workqueue-items.jsonl',
  'runtime-lesson-media-resource-semantics-workqueue-summary.json',
  'runtime-lesson-media-resource-semantics-review-source.jsonl',
  'runtime-lesson-media-resource-semantics-review-items.jsonl',
  'runtime-lesson-media-resource-semantics-review-evidence.md',
];
const artifactTexts = artifactNames.map((filename) => readFileSync(path.join(governanceDir, filename), 'utf8'));
const workqueueItems = readJsonl('runtime-lesson-media-resource-semantics-workqueue-items.jsonl');
const sourceItems = readJsonl('runtime-lesson-media-resource-semantics-review-source.jsonl');
const reviewItems = readJsonl('runtime-lesson-media-resource-semantics-review-items.jsonl');
const summary = JSON.parse(readFileSync(
  path.join(governanceDir, 'runtime-lesson-media-resource-semantics-workqueue-summary.json'),
)) as JsonRow;
const auditItems = readJsonl('resource-field-completion-audit.jsonl');
const projectionItems = readJsonl('runtime-resource-projections.jsonl');
const auditById = indexById(auditItems.filter((row) => scopedFamilies.has(row.family)));
const projectionById = indexById(projectionItems.filter((row) => scopedFamilies.has(row.family)));
const workqueueById = indexById(workqueueItems);
const sourceById = indexById(sourceItems);
const reviewById = indexById(reviewItems);

assert(auditById.size === 2598, `expected 2,598 scoped audit rows, found ${auditById.size}`);
assert(projectionById.size === auditById.size, 'projection and audit scoped denominators must match');
assert(workqueueItems.length === auditById.size, 'workqueue must cover the scoped audit denominator');
assert(sourceItems.length === auditById.size, 'review source must cover the scoped audit denominator');
assert(reviewItems.length === auditById.size, 'review items must cover the scoped audit denominator');
assert(summary.totals.remaining === 0, 'closure workqueue remaining must be zero');
assert(summary.totals.unexplainedUnreviewed === 0, 'closure workqueue cannot retain unexplained review gaps');
assert(summary.guardrails.onlyIndependentLaunchAndEvidenceRowsPromoted === true, 'promotion guardrail must be explicit');
assert(summary.guardrails.excludesTextbookReferenceAndAssessmentFamilies === true, 'scope guardrail must exclude textbook/reference/assessment');

const learningGoalRegistryIssues = [
  ...validateLearningGoalCatalog(),
  ...validateLearningGoalPackageCatalog(),
];
assert(learningGoalRegistryIssues.length === 0, `independent LearningGoal registry validation failed: ${JSON.stringify(learningGoalRegistryIssues)}`);
const registeredLearningGoalIds = new Set(listLearningGoals().map((goal) => goal.id));
const baseline = JSON.parse(readFileSync(
  path.join(governanceDir, 'learning-goal-resource-baseline-matrix.json'),
  'utf8',
)) as JsonRow;
assert(
  JSON.stringify([...registeredLearningGoalIds].sort()) === JSON.stringify([...new Set(baseline.registeredLearningGoalIds)].sort()),
  'independent LearningGoal registry must match the governed baseline registry ids',
);

for (const id of auditById.keys()) {
  assert(projectionById.has(id), `missing projection row for ${id}`);
  assert(workqueueById.has(id), `missing workqueue row for ${id}`);
  assert(sourceById.has(id), `missing review source row for ${id}`);
  assert(reviewById.has(id), `missing review item row for ${id}`);
}
assert(
  [...workqueueById.keys()].every((id) => auditById.has(id)),
  'workqueue must not introduce out-of-scope resource ids',
);
assert(
  [...reviewById.values()].every((item) => scopedFamilies.has(item.sourceFamily)),
  'review items must only contain runtime lesson/resource families',
);
const canonicalAssetStatuses = sourceItems
  .filter((item) => item.sourceFamily === 'runtime-lesson-media')
  .map((item) => canonicalAssetStatusFromSnapshot(auditById.get(item.resourceId)!, item));
assert(canonicalAssetStatuses.filter((status) => status === 'tracked-local-runtime-asset').length === 647, 'canonical asset snapshot must retain 647 tracked assets');
assert(canonicalAssetStatuses.filter((status) => status === 'missing-local-runtime-asset').length === 23, 'canonical asset snapshot must derive 23 non-indexed missing assets from audit and media-index facts');
assert(canonicalAssetStatuses.filter((status) => status === 'external-http-runtime-asset').length === 89, 'canonical asset snapshot must derive every matching real media-index HTTP identity as external');
assert(sourceItems.every((item) => !Object.hasOwn(item.decisionFacts?.asset ?? {}, 'workingTreePresent')), 'working-tree presence must remain outside canonical decision facts');
const cleanArchiveFlipCandidate = sourceItems.find((item) => (
  item.sourceFamily === 'runtime-lesson-media'
  && item.assetObservation?.workingTreePresent === true
  && typeof item.assetObservation.localPath === 'string'
  && !existsSync(path.join(process.cwd(), item.assetObservation.localPath))
));
if (cleanArchiveFlipCandidate) {
  const flipAudit = auditById.get(cleanArchiveFlipCandidate.resourceId)!;
  const originalStatus = canonicalAssetStatusFromSnapshot(flipAudit, cleanArchiveFlipCandidate);
  const originalDecisionHash = cleanArchiveFlipCandidate.decisionHash;
  const flippedSource = JSON.parse(JSON.stringify(cleanArchiveFlipCandidate)) as JsonRow;
  flippedSource.assetObservation.workingTreePresent = false;
  assert(canonicalAssetStatusFromSnapshot(flipAudit, flippedSource) === originalStatus, 'clean archive working-tree observation flip must not change canonical asset status');
  assert(buildRuntimeLessonSemanticDecisionHash(flippedSource) === originalDecisionHash, 'clean archive working-tree observation flip must not change decision hash');
}
const assetRereviewBatchId = 'runtime-lesson-media-asset-canonical-re-review-2026-07-13';
const assetRereviewReviewerId = 'patch-worker:runtime-lesson-media-asset-canonical-re-review';
const assetRereviewedAt = '2026-07-13T06:42:08.000Z';
const assetRereviewed = sourceItems.filter((item) => (
  item.sourceFamily === 'runtime-lesson-media' &&
  (item.runtimeEvidence?.assetStatus === 'missing-local-runtime-asset' || item.runtimeEvidence?.assetStatus === 'external-http-runtime-asset')
));
assert(assetRereviewed.length === 112, 'all non-tracked media asset decisions must carry the current re-review provenance');
assert(assetRereviewed.every((item) => item.reviewBatchId === assetRereviewBatchId && item.reviewerId === assetRereviewReviewerId && item.reviewedAt === assetRereviewedAt), 'non-tracked media asset decisions must use one consistent current re-review provenance');
assert(assetRereviewed.every((item) => !item.reviewBatchId.includes('2026-07-05') && !item.reviewedAt.startsWith('2026-07-05')), 'non-tracked media asset decisions must not retain the old review metadata');
const workingTreeObservedBinaryAssets = sourceItems.filter((item) => (
  item.sourceFamily === 'runtime-lesson-media'
  && item.assetObservation?.gitIndexTracked === false
  && item.assetObservation?.workingTreePresent === true
));
assert(workingTreeObservedBinaryAssets.length === 99, `expected 99 working-tree-observed m4a/mp4/pdf assets, found ${workingTreeObservedBinaryAssets.length}`);
assert(workingTreeObservedBinaryAssets.every((item) => /\.(?:m4a|mp4|pdf)$/i.test(item.assetObservation.localPath)), 'working-tree-observed runtime assets must be m4a/mp4/pdf');
const workingTreeAssetsPresent = workingTreeObservedBinaryAssets.filter((item) => existsSync(path.join(process.cwd(), item.assetObservation.localPath)));
assert(
  workingTreeAssetsPresent.length === 0 || workingTreeAssetsPresent.length === workingTreeObservedBinaryAssets.length,
  'working-tree-only asset snapshot must be internally consistent about local presence',
);
assert(workingTreeAssetsPresent.every((item) => !isIndexPath(item.assetObservation.localPath)), 'working-tree-only assets must remain outside the git index');
const externalMedia = sourceItems.filter((item) => item.sourceFamily === 'runtime-lesson-media' && item.runtimeEvidence?.assetStatus === 'external-http-runtime-asset');
assert(externalMedia.length === 89, `89 runtime media entries have matching real media-index HTTP identities, found ${externalMedia.length}`);
assert(externalMedia.every((item) => mediaIndexBlockHttpUrl(item.runtimeEvidence.mediaIndexPath, item.runtimeEvidence.mediaIndexLine)), 'external media must be justified by a real media-index HTTP URL');

const promoted = reviewItems.filter((item) => item.promotedAsPlanningUnit);
assert(promoted.length === 16, `expected 16 formally promoted PlanningUnits with real LearningGoal bindings, found ${promoted.length}`);
assert(promoted.every((item) => item.sourceFamily === 'runtime-lesson-step'), 'only runtime steps may be PlanningUnits');
assert(
  reviewItems.filter((item) => item.sourceFamily !== 'runtime-lesson-step').every((item) => item.promotedAsPlanningUnit === false),
  'module/media/handout rows must not be promoted',
);

for (const item of reviewItems) {
  const audit = auditById.get(item.resourceId)!;
  const source = sourceById.get(item.resourceId)!;
  const projection = projectionById.get(item.resourceId)!;
  independentlyVerifyEvidence(item.resourceId, source);
  const runtimeEvidence = assertRuntimeLessonSemanticReviewEvidence(audit, source);
  const projectedEvidence = projection.runtimeSemanticEvidence;
  assert(projectedEvidence, `${item.resourceId} projection must preserve explicit runtime semantic evidence`);
  assert(projectedEvidence.evidenceFileHash === runtimeEvidence.evidenceFileHash, `${item.resourceId} projection evidence hash must match formal runtime evidence`);
  assert(projectedEvidence.evidenceSelector === runtimeEvidence.evidenceSelector, `${item.resourceId} projection evidence selector must match formal runtime evidence`);
  if (runtimeEvidence.assetStatus === 'missing-local-runtime-asset' || runtimeEvidence.assetStatus === 'external-http-runtime-asset') {
    assert(projection.sourceHash === null, `${item.resourceId} non-local media projection must not invent a source file hash`);
    assert(projection.reviewAudit?.reviewedSourceHash === null, `${item.resourceId} non-local media projection must not invent a reviewed source hash`);
  } else {
    assert(projection.sourceHash === runtimeEvidence.sourceFileHash, `${item.resourceId} tracked projection must preserve the file sha256`);
    assert(projection.reviewAudit?.reviewedSourceHash === runtimeEvidence.sourceFileHash, `${item.resourceId} tracked projection review hash must match the file sha256`);
  }
  const parsedEvidenceRef = assertRuntimeSemanticEvidenceReference(source.independentEvidenceRef);
  assert(item.reviewBatchId === source.reviewBatchId, `${item.resourceId} batch mismatch`);
  assert(item.reviewState === undefined || item.reviewState === 'reviewed', `${item.resourceId} is not reviewed`);
  assert(item.rawContentIncluded === false && item.privacyMinimized === true, `${item.resourceId} violates privacy guardrail`);
  assert(item.expectedSourceHash === audit.sourceHash, `${item.resourceId} source hash does not match formal audit`);
  assert(item.expectedSourceVersionRef === audit.sourceVersionRef, `${item.resourceId} source version does not match formal audit`);
  assert(source.expectedSourceHash === audit.sourceHash, `${item.resourceId} source overlay hash mismatch`);
  assert(source.expectedSourceVersionRef === audit.sourceVersionRef, `${item.resourceId} source overlay version mismatch`);
  assert(item.reviewerVisibleRationale.length > 40, `${item.resourceId} rationale is too thin`);
  assert(!String(source.independentEvidenceRef).includes('review-items.jsonl'), `${item.resourceId} cannot cite generated review items as independent evidence`);
  assert(existsSync(path.join(process.cwd(), String(source.independentEvidenceRef).split('#', 1)[0])), `${item.resourceId} evidence file must exist`);
  assert(source.reviewSourceKind === 'explicit-item-review', `${item.resourceId} must come from an explicit item review source`);
  assert(source.decisionVersion === RUNTIME_SEMANTIC_DECISION_VERSION, `${item.resourceId} decision version is missing`);
  assert(source.decisionHash === buildRuntimeLessonSemanticDecisionHash(source), `${item.resourceId} decision hash must bind its source decision`);
  assert(typeof source.reviewerId === 'string' && source.reviewerId.length > 0, `${item.resourceId} source reviewer is missing`);
  assert(typeof source.reviewedAt === 'string' && source.reviewedAt.length > 0, `${item.resourceId} source review time is missing`);
  assert(source.parentLessonRef === `runtime-lesson:${item.lessonKey}`, `${item.resourceId} must resolve to its actual lesson registry entry`);
  const lessonRegistry = JSON.parse(readFileSync(
    path.join(process.cwd(), `course-content/runtime/lessons/${item.lessonKey}/lesson.json`),
    'utf8',
  )) as JsonRow;
  assert(typeof lessonRegistry.lesson_id === 'string', `${item.resourceId} parent lesson registry entry must contain lesson_id`);
  assert(existsSync(path.join(process.cwd(), `course-content/runtime/lessons/${item.lessonKey}`)), `${item.resourceId} parent lesson directory must exist`);
  if (runtimeEvidence.manifestPath && runtimeEvidence.manifestPointer) {
    const manifest = JSON.parse(readFileSync(path.join(process.cwd(), runtimeEvidence.manifestPath), 'utf8')) as unknown;
    resolveJsonPointer(manifest, runtimeEvidence.manifestPointer);
  }
  if (item.promotedAsPlanningUnit) {
    const targetPathname = String(item.pathTarget).split('?', 1)[0];
    const routePath = targetPathname.replace(/\/student\/[^/]+$/, '/student/[sessionId]');
    assert(existsSync(path.join(process.cwd(), `src/app${routePath}/page.tsx`)), `${item.resourceId} promoted path target must map to a real route file`);
  }
  assert(parsedEvidenceRef.evidenceFileHash === runtimeEvidence.evidenceFileHash, `${item.resourceId} evidence selector hash must match the actual evidence file`);
  assert(runtimeEvidence.parentLessonRef === source.parentLessonRef, `${item.resourceId} runtime evidence parent lesson mismatch`);
  assert(runtimeEvidence.parent.planningUnitRef === source.parentPlanningUnitRef, `${item.resourceId} runtime evidence PlanningUnit parent mismatch`);
  assert(runtimeEvidence.parent.resourceRef === source.parentResourceRef, `${item.resourceId} runtime evidence resource parent mismatch`);
  assert(source.reviewerVisibleRationale.includes(`source-kind=${runtimeEvidence.sourceFileKind}`), `${item.resourceId} rationale must state the actual source kind`);
  assert(source.reviewerVisibleRationale.includes('Runtime structure='), `${item.resourceId} rationale must state actual runtime structure`);
  assert(source.reviewerVisibleRationale.includes('Launch='), `${item.resourceId} rationale must state launch behavior`);
  assert(source.reviewerVisibleRationale.includes('Evidence='), `${item.resourceId} rationale must state evidence behavior`);
  assert(source.reviewerVisibleRationale.includes('Parent='), `${item.resourceId} rationale must state parent resolution`);
  assert(Array.isArray(source.reasonCodes) && source.reasonCodes.length > 0, `${item.resourceId} source reason codes must be explicit`);
  assert(source.decisionFacts?.source?.fileKind === runtimeEvidence.sourceFileKind, `${item.resourceId} decision facts must preserve actual source kind`);
  assert(source.decisionFacts?.manifest?.pointer === runtimeEvidence.manifestPointer, `${item.resourceId} decision facts must preserve actual manifest pointer`);
  assert(source.decisionFacts?.parent?.resourceRef === runtimeEvidence.parent.resourceRef, `${item.resourceId} decision facts must preserve actual parent resource`);
  if (source.parentResourceRef) {
    assert(!source.parentResourceRef.startsWith('runtime-lesson:'), `${item.resourceId} cannot use a lesson placeholder as resource parent`);
    const parent = auditById.get(source.parentResourceRef);
    assert(parent, `${item.resourceId} resource parent must be present in the scoped audit registry`);
    assert(runtimeEvidence.parent.resourceCandidates.includes(source.parentResourceRef), `${item.resourceId} resource parent must be resolved from the manifest relationship`);
    assert(parent.resourceId.split(':')[1] === item.lessonKey, `${item.resourceId} resource parent must belong to the same lesson`);
    if (item.sourceFamily === 'runtime-lesson-module') {
      assert(parent.family === 'runtime-lesson-step', `${item.resourceId} module parent must be a real runtime step`);
    }
    if (item.sourceFamily === 'runtime-lesson-media') {
      assert(parent.family === 'runtime-lesson-module', `${item.resourceId} media parent must be a real runtime module`);
    }
  }
  if (item.sourceFamily === 'runtime-lesson-step') {
    assert(runtimeEvidence.recordKind === 'step', `${item.resourceId} must resolve as a manifest step`);
    assert(runtimeEvidence.manifestPointer?.startsWith('/steps/'), `${item.resourceId} must use a real manifest step pointer`);
    assert(source.parentResourceRef === null, `${item.resourceId} must not use an unverified resource parent`);
    assert(runtimeEvidence.launch.available, `${item.resourceId} must have a manifest or route launch surface`);
    assert(runtimeEvidence.launch.independent === item.promotedAsPlanningUnit, `${item.resourceId} launch independence must match its explicit disposition`);
    assert(runtimeEvidence.evidence.independent === item.promotedAsPlanningUnit, `${item.resourceId} evidence independence must match its explicit disposition`);
  }
  if (item.sourceFamily === 'runtime-lesson-module') {
    assert(runtimeEvidence.recordKind === 'module', `${item.resourceId} must resolve as a manifest module`);
    assert(runtimeEvidence.moduleKind, `${item.resourceId} must record the actual manifest module kind`);
    assert(runtimeEvidence.manifestPointer?.includes('/modules/'), `${item.resourceId} must use a real manifest module pointer`);
    assert(source.parentResourceRef !== null, `${item.resourceId} must record its actual parent step resource`);
  }
  if (item.sourceFamily === 'runtime-lesson-media') {
    assert(runtimeEvidence.recordKind === 'media', `${item.resourceId} must resolve as media`);
    assert(runtimeEvidence.mediaKind, `${item.resourceId} must record the actual media kind`);
    assert(!runtimeEvidence.launch.independent && !runtimeEvidence.evidence.independent, `${item.resourceId} media cannot claim independent launch/evidence`);
    if (runtimeEvidence.sourceFileKind === 'external-media') {
      assert(runtimeEvidence.assetStatus === 'external-http-runtime-asset', `${item.resourceId} external media must have an HTTP asset status`);
      assert(runtimeEvidence.assetAvailability === 'external-media-index-url', `${item.resourceId} external media must come from the media-index URL state`);
      assert(runtimeEvidence.sourceFileHash === null, `${item.resourceId} external media must not invent a source file hash`);
      assert(runtimeEvidence.mediaIndexLine !== null, `${item.resourceId} external media must resolve to a real media-index line`);
      assert(runtimeEvidence.externalIdentitySha256 !== null, `${item.resourceId} external media must retain a verifiable identity hash`);
    } else if (runtimeEvidence.sourceFileKind === 'missing-local-runtime-asset') {
      assert(runtimeEvidence.assetStatus === 'missing-local-runtime-asset', `${item.resourceId} missing local media must retain the missing asset status`);
      assert(runtimeEvidence.assetAvailability === 'not-tracked-in-git-index', `${item.resourceId} missing local media must use the canonical non-indexed availability state`);
      assert(runtimeEvidence.sourceFileHash === null, `${item.resourceId} missing local media must not hash an untracked asset`);
      assert(runtimeEvidence.evidenceSelector.startsWith('markdown-line:'), `${item.resourceId} missing local media must use the media-index heading line`);
      assert(runtimeEvidence.mediaIndexLine !== null, `${item.resourceId} missing local media must resolve to a media-index line`);
      assert(source.reviewerVisibleRationale.includes('missing-local-runtime-asset'), `${item.resourceId} missing local media rationale must be explicit`);
    } else {
      assert(runtimeEvidence.assetStatus === 'tracked-local-runtime-asset', `${item.resourceId} local media must be tracked in the git index`);
      assert(runtimeEvidence.sourceFileHash?.startsWith('sha256:'), `${item.resourceId} local media must retain its file sha256`);
      assert(runtimeEvidence.evidenceSelector.startsWith('file-sha256:'), `${item.resourceId} local media must use a file hash selector`);
    }
  }
  if (item.sourceFamily === 'runtime-handout') {
    assert(runtimeEvidence.recordKind === 'handout', `${item.resourceId} must resolve as a handout`);
    assert(runtimeEvidence.sourceFileKind === 'markdown', `${item.resourceId} handout source must be Markdown`);
    assert(runtimeEvidence.evidenceSelector.startsWith('markdown-line:'), `${item.resourceId} handout evidence must use a real Markdown line`);
    assert(source.parentResourceRef === null, `${item.resourceId} handout must remain lesson-level without a resource placeholder`);
  }
  assert(Array.isArray(source.learningGoalIds), `${item.resourceId} source LearningGoal binding is missing`);
  assert(Array.isArray(source.knowledgeObjectiveIds), `${item.resourceId} source knowledge objectives are missing`);
  assert(Array.isArray(source.capabilityObjectiveIds), `${item.resourceId} source capability objectives are missing`);
  assert(Array.isArray(source.qualityObjectiveIds), `${item.resourceId} source quality objectives are missing`);
  assert(source.parentPlanningUnitRef === null || promoted.some((candidate) => candidate.resourceId === source.parentPlanningUnitRef), `${item.resourceId} parent PlanningUnit must be a real promoted row`);
  if (item.promotedAsPlanningUnit) {
    assert(item.disposition === 'planning-unit', `${item.resourceId} promoted disposition mismatch`);
    assert(source.learningGoalIds.length > 0, `${item.resourceId} promoted row lacks a real LearningGoal binding`);
    assert(source.knowledgeObjectiveIds.length > 0, `${item.resourceId} promoted row lacks knowledge objectives`);
    assert(source.capabilityObjectiveIds.length > 0, `${item.resourceId} promoted row lacks capability objectives`);
    assert(source.qualityObjectiveIds.length > 0, `${item.resourceId} promoted row lacks quality objectives`);
    assert(item.currentPathEligible === true && item.pathTarget === audit.pathTarget, `${item.resourceId} promoted path contract mismatch`);
    assert(audit.missingFieldCodes.length === 0, `${item.resourceId} promoted row still has formal blockers`);
    assert(audit.evidenceContract.complete === true && audit.readiness !== null, `${item.resourceId} promoted evidence/readiness contract incomplete`);
    assert(audit.pathEligibility.current === true && audit.pathEligibility.afterCompletion === true, `${item.resourceId} promoted path eligibility mismatch`);
  } else {
    assert(item.currentPathEligible === false && item.pathTarget === null, `${item.resourceId} support row must not expose a path target`);
    assert(item.parentLessonRef.startsWith('runtime-lesson:'), `${item.resourceId} must retain parent lesson context`);
  }
}

assert(
  reviewItems.filter((item) => item.sourceFamily === 'runtime-lesson-module')
    .every((item) => item.disposition === 'excluded-with-rationale'),
  'runtime modules must remain embedded/excluded fragments in the closure contract',
);
assert(
  reviewItems.filter((item) => item.sourceFamily === 'runtime-handout')
    .every((item) => item.disposition === 'supporting-citation'),
  'runtime handouts must remain supporting citations until section-grain path metadata exists',
);
assert(
  reviewItems.filter((item) => item.sourceFamily === 'runtime-lesson-media')
    .every((item) => item.promotedAsPlanningUnit === false),
  'runtime media must not become PlanningUnits through content presence alone',
);
assert(
  reviewItems.some((item) => item.resourceId === 'runtime-step:4-7:step-02' && item.disposition === 'evidence-producing' && !item.promotedAsPlanningUnit),
  '4-7 diagnostic step must retain evidence-producing but non-promoted disposition while formal blockers remain',
);
assert(
  artifactTexts.every((text) => !/https?:\/\/.*(?:signature|objectshowpreview)/i.test(text)),
  'closure artifacts must not copy signed external URLs',
);
assert(
  [...workqueueItems, ...sourceItems, ...reviewItems].every((item) => (
    !hasObjectKey(item, 'question_cards') && !hasObjectKey(item, 'frontier_methods')
  )),
  'closure artifacts must not copy raw manifest content blocks',
);
assert(new Set(sourceItems.map((item) => `${item.reviewerId}:${item.reviewedAt}`)).size > 1, 'formal source must not use one fixed reviewer/time for every row');
assert(sourceItems.every((item) => item.decisionFacts && Array.isArray(item.reasonCodes)), 'formal source must preserve explicit structured decision basis for every row');
assert(sourceItems.some((item) => item.runtimeEvidence?.assetStatus === 'missing-local-runtime-asset'), 'formal source must retain missing local runtime asset decisions');
assert(sourceItems.every((item) => !/sourceDescription\(|materializeSource\(/.test(String(item.reviewerVisibleRationale))), 'formal source rationale must be stored as source text, not executable generator expressions');

const directId = promoted[0].resourceId;
const directAudit = auditById.get(directId)!;
const directSource = sourceById.get(directId)!;
const directOverlays = runtimeLessonMediaSemanticFormalReviewOverlaysForRows(
  [directAudit],
  new Map([[directId, directSource]]),
);
assert(directOverlays.length === 1, 'formal review overlay direct test must produce one overlay');
assert(directOverlays[0].reviewAudit.independentEvidenceRef === directSource.independentEvidenceRef, 'formal overlay must preserve independent evidence reference');

const refreshExplicitRuntimeFacts = (audit: JsonRow, source: JsonRow) => {
  const facts = buildRuntimeLessonSemanticEvidence(audit, source);
  source.runtimeEvidence = facts;
  source.sourceEvidenceHash = facts.evidenceFileHash;
  source.independentEvidenceRef = `${facts.evidenceFilePath}#${facts.evidenceSelector}`;
  source.decisionFacts = buildRuntimeLessonSemanticDecisionFacts(audit, source, facts);
  source.reasonCodes = buildRuntimeLessonSemanticReasonCodes(audit, source, facts);
  source.decisionVersion = RUNTIME_SEMANTIC_DECISION_VERSION;
  source.decisionHash = buildRuntimeLessonSemanticDecisionHash(source);
};

const expectDirectPromotionFailure = (
  label: string,
  mutateSource: (source: JsonRow) => void = () => undefined,
  mutateAudit: (audit: JsonRow) => void = () => undefined,
) => {
  const invalidAudit = JSON.parse(JSON.stringify(directAudit)) as JsonRow;
  const invalidSource = JSON.parse(JSON.stringify(directSource)) as JsonRow;
  mutateAudit(invalidAudit);
  mutateSource(invalidSource);
  refreshExplicitRuntimeFacts(invalidAudit, invalidSource);
  let failed = false;
  try {
    runtimeLessonMediaSemanticFormalReviewOverlaysForRows([invalidAudit], new Map([[directId, invalidSource]]));
  } catch {
    failed = true;
  }
  assert(failed, `direct promotion gate must reject ${label}`);
};
expectDirectPromotionFailure('missing LearningGoal', (source) => { source.learningGoalIds = []; });
expectDirectPromotionFailure('unknown LearningGoal', (source) => { source.learningGoalIds = ['not-registered']; });
expectDirectPromotionFailure('missing knowledge objective', (source) => { source.knowledgeObjectiveIds = []; });
expectDirectPromotionFailure('missing capability objective', (source) => { source.capabilityObjectiveIds = []; });
expectDirectPromotionFailure('missing quality objective', (source) => { source.qualityObjectiveIds = []; });
expectDirectPromotionFailure('missing readiness', undefined, (audit) => { audit.readiness = null; });
expectDirectPromotionFailure('missing estimated time', undefined, (audit) => { audit.estimatedTimeMinutes = null; });
expectDirectPromotionFailure('missing citation target', (source) => { source.citationTargets = []; }, (audit) => { audit.citationTargets = []; });
expectDirectPromotionFailure('missing graph knowledge binding', (source) => { source.graphNodeRefs = { knowledge: [], capability: [], quality: [] }; }, (audit) => { audit.graphNodeRefs = { knowledge: [], capability: [], quality: [] }; });
expectDirectPromotionFailure('missing launch target', (source) => { source.currentPathEligible = false; source.pathTarget = null; });
expectDirectPromotionFailure('missing evidence decision', (source) => { source.evidenceDecision = 'citation-only'; source.evidenceInstrumentation = []; });
expectDirectPromotionFailure(
  'incomplete evidence contract',
  (source) => {
    source.evidenceContractComplete = false;
    source.evidenceMissingFields = ['missing-evidence-instrumentation'];
    source.evidenceDecision = 'citation-only';
    source.evidenceInstrumentation = [];
  },
  (audit) => {
    audit.evidenceContract.complete = false;
    audit.evidenceContract.missingFields = ['missing-evidence-instrumentation'];
  },
);
expectDirectPromotionFailure('invalid parent PlanningUnit', (source) => { source.parentPlanningUnitRef = 'runtime-lesson:placeholder'; });

const expectEvidenceFailure = (label: string, sourceSeed: JsonRow, mutate: (source: JsonRow) => void) => {
  const audit = JSON.parse(JSON.stringify(auditById.get(sourceSeed.resourceId)!)) as JsonRow;
  const source = JSON.parse(JSON.stringify(sourceSeed)) as JsonRow;
  mutate(source);
  let failed = false;
  try {
    assertRuntimeLessonSemanticReviewEvidence(audit, source);
  } catch {
    failed = true;
  }
  assert(failed, `runtime asset canonical gate must reject ${label}`);
};
const externalSeed = sourceItems.find((item) => item.runtimeEvidence?.assetStatus === 'external-http-runtime-asset')!;
const untrackedSeed = sourceItems.find((item) => (
  item.assetObservation?.gitIndexTracked === false
  && item.assetObservation?.workingTreePresent === true
  && canonicalAssetStatusFromSnapshot(auditById.get(item.resourceId)!, item) === 'missing-local-runtime-asset'
))!;
expectEvidenceFailure('external asset relabeled as missing', externalSeed, (source) => {
  source.runtimeEvidence.assetStatus = 'missing-local-runtime-asset';
});
expectEvidenceFailure('missing asset relabeled as external', untrackedSeed, (source) => {
  source.runtimeEvidence.assetStatus = 'external-http-runtime-asset';
});
expectEvidenceFailure('media-index URL identity mismatch', externalSeed, (source) => {
  source.assetObservation.mediaIndexUrlSha256 = '0'.repeat(64);
});
expectEvidenceFailure('fake tracked availability', untrackedSeed, (source) => {
  source.assetObservation.gitIndexTracked = true;
});
expectEvidenceFailure('fake external availability', untrackedSeed, (source) => {
  source.runtimeEvidence.assetAvailability = 'external-media-index-url';
});

const artifactHashes = () => artifactNames.map((filename) => createHash('sha256').update(readFileSync(path.join(governanceDir, filename))).digest('hex'));
const nonRuntimeCanonicalIdentity = (filename: string) => readJsonl(filename)
  .filter((row) => !scopedFamilies.has(row.family))
  .map((row) => JSON.stringify({
    id: row.id ?? row.resourceId,
    resourceId: row.resourceId ?? row.id,
    family: row.family,
    resourceType: row.resourceType,
    sourceRecord: row.sourceRecord ?? null,
    sourceHash: row.sourceHash ?? null,
    sourceVersionRef: row.sourceVersionRef ?? null,
    sourcePathOrUrl: row.sourcePathOrUrl ?? null,
  }))
  .sort();
const nonRuntimeBaselineIdentity = () => baseline.rows
  .flatMap((row) => Object.entries(row.categories).map(([category, summary]) => ({
    learningGoalId: row.learningGoalId,
    category,
    resourceIds: (summary as JsonRow).resourceIds.filter((id: string) => !id.startsWith('runtime-')),
    pathEligibleResourceIds: (summary as JsonRow).pathEligibleResourceIds.filter((id: string) => !id.startsWith('runtime-')),
  })))
  .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
const beforeClosureArtifactHashes = artifactHashes();
const beforeNonRuntimeAuditIdentity = nonRuntimeCanonicalIdentity('resource-field-completion-audit.jsonl');
const beforeNonRuntimeProjectionIdentity = nonRuntimeCanonicalIdentity('runtime-resource-projections.jsonl');
const beforeNonRuntimeBaselineIdentity = nonRuntimeBaselineIdentity();
execFileSync('npx', ['tsx', './scripts/db/generate-runtime-lesson-media-resource-semantics.ts'], { stdio: 'pipe' });
assert(JSON.stringify(artifactHashes()) === JSON.stringify(beforeClosureArtifactHashes), 'repeated closure generation must be byte-stable');
assert(JSON.stringify(nonRuntimeCanonicalIdentity('resource-field-completion-audit.jsonl')) === JSON.stringify(beforeNonRuntimeAuditIdentity), 'closure generation must not change non-runtime audit identities');
assert(JSON.stringify(nonRuntimeCanonicalIdentity('runtime-resource-projections.jsonl')) === JSON.stringify(beforeNonRuntimeProjectionIdentity), 'closure generation must not change non-runtime projection identities');
assert(JSON.stringify(nonRuntimeBaselineIdentity()) === JSON.stringify(beforeNonRuntimeBaselineIdentity), 'closure generation must not change non-runtime/base baseline identity');

console.log(`Runtime lesson/media semantics rows: ${reviewItems.length}`);
console.log(`Runtime lesson/media semantics promoted PlanningUnits: ${promoted.length}`);
console.log(`Runtime lesson/media semantics remaining: ${summary.totals.remaining}`);
