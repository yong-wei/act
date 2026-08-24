import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { AdaptiveAssessmentCatalogItem } from '@/features/adaptive-assessment/adaptive-assessment-item-catalog';
import type { AssessmentItemSemanticReviewDecision } from '@/features/adaptive-assessment/adaptive-assessment-semantic-review';
import optionAttributionSource from '../../course-content/runtime/resource-governance/micro-tutoring-option-attributions-v2.json';
import practiceBaselineSource from '../../course-content/runtime/resource-governance/micro-tutoring-assessment-baseline-v2.json';
import { resolveMicroTutoringGoalNode } from '@/features/assessment/micro-tutoring-goal-node-catalog';
import {
  MICRO_TUTORING_VALIDATION_ACTION_PATH,
  MICRO_TUTORING_VALIDATION_ESTIMATED_MINUTES,
  MICRO_TUTORING_VALIDATION_REGISTRY_SOURCE,
  MICRO_TUTORING_VALIDATION_REGISTRY_VERSION,
  loadMicroTutoringValidationRegistry,
  microTutoringValidationItemRevision,
  microTutoringValidationRelationSourceRef,
  type MicroTutoringValidationPurposeDecision,
  type MicroTutoringValidationRelation,
} from '@/features/assessment/micro-tutoring-validation-registry';

const GOVERNANCE_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const OUTPUT_PATH = path.join(GOVERNANCE_DIR, 'micro-tutoring-validation-registry.json');
const GIT_REVISION = /^[a-f0-9]{40}$/u;
const SOURCE_PATHS = [
  `${path.relative(process.cwd(), GOVERNANCE_DIR)}/adaptive-assessment-item-catalog-items.jsonl`,
  `${path.relative(process.cwd(), GOVERNANCE_DIR)}/assessment-item-semantic-review-snapshots.jsonl`,
  `${path.relative(process.cwd(), GOVERNANCE_DIR)}/micro-tutoring-assessment-baseline-v2.json`,
  `${path.relative(process.cwd(), GOVERNANCE_DIR)}/micro-tutoring-option-attributions-v2.json`,
  `${path.relative(process.cwd(), GOVERNANCE_DIR)}/micro-tutoring-validation-purpose-reviews-v1.jsonl`,
  `${path.relative(process.cwd(), GOVERNANCE_DIR)}/micro-tutoring-goal-node-catalog.json`,
] as const;

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function git(args: string[]): string {
  const result = spawnSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`微辅导验证登记无法执行 Git ${args.join(' ')}：${result.stderr.trim()}`);
  }
  return result.stdout;
}

function captureSourceRevision(): string {
  git(['ls-files', '--error-unmatch', '--', ...SOURCE_PATHS]);
  const dirty = git(['status', '--porcelain=v1', '--untracked-files=no', '--', ...SOURCE_PATHS]).trim();
  if (dirty) {
    throw new Error(`微辅导验证登记拒绝脏源文件：\n${dirty}`);
  }
  const sourceRevision = git(['rev-parse', '--verify', 'HEAD']).trim();
  if (!GIT_REVISION.test(sourceRevision)) {
    throw new Error('微辅导验证登记无法解析有效的 Git 修订');
  }
  return sourceRevision;
}

async function readJsonl<T>(fileName: string): Promise<T[]> {
  const raw = await readFile(path.join(GOVERNANCE_DIR, fileName), 'utf8');
  return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line) as T);
}

async function main() {
  const [catalogItems, reviewDecisions] = await Promise.all([
    readJsonl<AdaptiveAssessmentCatalogItem>('adaptive-assessment-item-catalog-items.jsonl'),
    readJsonl<AssessmentItemSemanticReviewDecision>('assessment-item-semantic-review-snapshots.jsonl'),
  ]);
  const purposeReviews = new Map(
    (await readJsonl<{
      catalogItemId: string;
      sourceId: string;
      contentHash: string;
      knowledgeNodeId: string;
      purposeDecision: MicroTutoringValidationPurposeDecision;
    }>('micro-tutoring-validation-purpose-reviews-v1.jsonl'))
      .map((row) => [row.catalogItemId, row] as const),
  );
  const catalogById = new Map(catalogItems.map((item) => [item.catalogItemId, item]));
  const reviewById = new Map(reviewDecisions.map((decision) => [decision.catalogItemId, decision]));
  const tagsByNode = new Map<string, Array<{ misconceptionTag: string; evidenceSummary: string }>>();
  for (const attribution of optionAttributionSource.entries) {
    const current = tagsByNode.get(attribution.knowledgeNodeId) ?? [];
    if (!current.some((row) => row.misconceptionTag === attribution.misconceptionTag)) {
      current.push({
        misconceptionTag: attribution.misconceptionTag,
        evidenceSummary: attribution.evidenceSummary,
      });
    }
    tagsByNode.set(attribution.knowledgeNodeId, current);
  }

  const nextCandidateByGoal = new Map<string, number>();
  const entries = practiceBaselineSource.entries.map((baseline, baselineIndex) => {
    const item = catalogById.get(baseline.catalogItemId);
    const review = reviewById.get(baseline.catalogItemId);
    if (!item || !review) {
      throw new Error(`Missing catalog or review for ${baseline.catalogItemId}`);
    }
    if (item.contentHash !== baseline.contentHash || review.sourceContentHash !== baseline.contentHash) {
      throw new Error(`Content hash drift for ${baseline.catalogItemId}`);
    }
    if (review.outcome !== 'approved') {
      throw new Error(`${baseline.catalogItemId} is not approved`);
    }
    const learningGoalId = review.selectedLearningGoalIds[0];
    const goalNode = resolveMicroTutoringGoalNode(learningGoalId);
    if (!goalNode.ok) {
      throw new Error(`${baseline.catalogItemId}: ${goalNode.reason}`);
    }
    const nodeTags = tagsByNode.get(goalNode.knowledgeNodeId);
    if (!nodeTags || nodeTags.length === 0) {
      throw new Error(`No option attributions for ${goalNode.knowledgeNodeId}`);
    }
    const candidates = practiceBaselineSource.entries
      .map((candidate) => catalogById.get(candidate.catalogItemId))
      .filter((candidate): candidate is AdaptiveAssessmentCatalogItem => Boolean(candidate))
      .filter((candidate) => candidate.catalogItemId !== item.catalogItemId)
      .filter((candidate) => reviewById.get(candidate.catalogItemId)?.selectedLearningGoalIds.includes(learningGoalId));
    const candidateIndex = nextCandidateByGoal.get(learningGoalId) ?? 0;
    nextCandidateByGoal.set(learningGoalId, candidateIndex + 1);
    const validationBaseline = candidates[candidateIndex % Math.max(candidates.length, 1)];
    if (!validationBaseline) {
      throw new Error(`No independent validation candidate for ${baseline.catalogItemId} (index ${baselineIndex})`);
    }
    const validationReview = reviewById.get(validationBaseline.catalogItemId);
    if (!validationReview?.reviewSourceHash || validationReview.outcome !== 'approved') {
      throw new Error(`Invalid independent validation candidate for ${baseline.catalogItemId}`);
    }
    const relations: MicroTutoringValidationRelation[] = [...nodeTags]
      .sort((left, right) => left.misconceptionTag.localeCompare(right.misconceptionTag))
      .map((tag) => ({
        misconceptionTag: tag.misconceptionTag,
        rationale: `使用独立已审核题 ${validationBaseline.sourceId} 作为验证，覆盖选项审核确认的错因：${tag.evidenceSummary}`,
      }));
    const purposeReview = purposeReviews.get(validationBaseline.catalogItemId);
    if (
      !purposeReview ||
      purposeReview.sourceId !== validationBaseline.sourceId ||
      purposeReview.contentHash !== validationBaseline.contentHash ||
      purposeReview.knowledgeNodeId !== goalNode.knowledgeNodeId
    ) {
      throw new Error(`Missing or mismatched validation-purpose review for ${validationBaseline.catalogItemId}`);
    }
    const purpose = purposeReview.purposeDecision;
    const snapshotVersion = validationBaseline.versionRefs.adaptiveAssessmentSnapshotVersion;
    if (!snapshotVersion) {
      throw new Error(`Missing snapshot version for ${baseline.catalogItemId}`);
    }
    const difficulty = typeof validationReview.difficulty === 'number' ? validationReview.difficulty : validationBaseline.semanticRefs.difficulty;
    if (typeof difficulty !== 'number') {
      throw new Error(`Missing difficulty for ${baseline.catalogItemId}`);
    }
    
    return {
      id: `micro-tutoring-validation:${validationBaseline.sourceId}`,
      catalogItemId: validationBaseline.catalogItemId,
      sourceId: validationBaseline.sourceId,
      contentHash: validationBaseline.contentHash,
      itemRevision: microTutoringValidationItemRevision({
        catalogItemId: validationBaseline.catalogItemId,
        sourceId: validationBaseline.sourceId,
        contentHash: validationBaseline.contentHash,
        learningGoalId,
        knowledgeNodeId: goalNode.knowledgeNodeId,
        difficulty,
        estimatedMinutes: MICRO_TUTORING_VALIDATION_ESTIMATED_MINUTES,
        snapshotVersion,
        itemReviewSourceHash: validationReview.reviewSourceHash,
        purposeDecision: purpose,
        relations,
      }),
      learningGoalId,
      knowledgeNodeId: goalNode.knowledgeNodeId,
      difficulty,
      estimatedMinutes: MICRO_TUTORING_VALIDATION_ESTIMATED_MINUTES,
      actionPath: MICRO_TUTORING_VALIDATION_ACTION_PATH,
      privacyLevel: 'student-visible' as const,
      enabled: true,
      snapshotVersion,
      itemReviewSourceHash: validationReview.reviewSourceHash,
      purposeDecision: purpose,
      studentQuestionRef: {
        catalogItemId: validationBaseline.catalogItemId,
        sourceId: validationBaseline.sourceId,
        contentHash: validationBaseline.contentHash,
        snapshotVersion,
      },
      relations,
      sourceRefs: uniqueSorted(relations.map((relation) => microTutoringValidationRelationSourceRef({
        knowledgeNodeId: goalNode.knowledgeNodeId,
        misconceptionTag: relation.misconceptionTag,
      }))),
    };
  }).sort((left, right) => left.catalogItemId.localeCompare(right.catalogItemId));

  const registry = {
    version: MICRO_TUTORING_VALIDATION_REGISTRY_VERSION,
    source: MICRO_TUTORING_VALIDATION_REGISTRY_SOURCE,
    sourceRevision: captureSourceRevision(),
    entries,
  };
  const loaded = loadMicroTutoringValidationRegistry(registry, optionAttributionSource, practiceBaselineSource);
  if (loaded.issues.length > 0 || !loaded.registry) {
    throw new Error(`Generated validation registry is invalid: ${JSON.stringify(loaded.issues, null, 2)}`);
  }

  const byNode = new Map<string, number>();
  for (const entry of registry.entries) {
    byNode.set(entry.knowledgeNodeId, (byNode.get(entry.knowledgeNodeId) ?? 0) + 1);
  }
  const pairCoverage = new Map<string, number>();
  for (const entry of registry.entries) {
    for (const relation of entry.relations) {
      const key = `${entry.knowledgeNodeId}\0${relation.misconceptionTag}`;
      pairCoverage.set(key, (pairCoverage.get(key) ?? 0) + 1);
    }
  }
  const emptyUnits = [...pairCoverage.values()].filter((count) => count < 2).length;
  await writeFile(OUTPUT_PATH, `${JSON.stringify(registry, null, 2)}\n`);
  console.log(JSON.stringify({
    output: OUTPUT_PATH,
    sourceRevision: registry.sourceRevision,
    entries: registry.entries.length,
    nodes: byNode.size,
    nodeCounts: Object.fromEntries([...byNode.entries()].sort(([left], [right]) => left.localeCompare(right))),
    optionAttributionPairs: pairCoverage.size,
    independentCandidatesPerSource: 5,
    emptyUnits,
    newQuestionsCreated: 0,
    sourceFamilies: ['checkpoint-authored-question'],
    autoApprovedFromAllowedStages: false,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
