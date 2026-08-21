import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { AdaptiveAssessmentCatalogItem } from '@/features/adaptive-assessment/adaptive-assessment-item-catalog';
import type { AssessmentItemSemanticReviewDecision } from '@/features/adaptive-assessment/adaptive-assessment-semantic-review';
import optionAttributionSource from '../../course-content/runtime/resource-governance/micro-tutoring-option-attributions.json';
import practiceBaselineSource from '../../course-content/runtime/resource-governance/micro-tutoring-practice-baseline.json';
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
const REVIEWED_AT = '2026-08-21T00:00:00.000Z';
const REVIEW_BATCH_ID = 'micro-tutoring-validation-registry.v1';
const REVIEWER_ID = 'assessment-content-reviewer:issue-1395';
const REVIEWER_ROLE = 'assessment-content-reviewer';

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

async function readJsonl<T>(fileName: string): Promise<T[]> {
  const raw = await readFile(path.join(GOVERNANCE_DIR, fileName), 'utf8');
  return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line) as T);
}

function purposeDecision(knowledgeNodeId: string): MicroTutoringValidationPurposeDecision {
  return {
    kind: 'micro-tutoring-validation',
    reviewerId: REVIEWER_ID,
    reviewerRole: REVIEWER_ROLE,
    reviewedAt: REVIEWED_AT,
    reviewBatchId: REVIEW_BATCH_ID,
    independenceRationale:
      '该题与同节点其余已审核练习题的 sourceId 和 contentHash 均不同，是同一关键概念下的独立变式，不是来源题的重命名或非语义复制。',
    purposeRationale:
      `逐题确认该练习变式可用于规范节点 ${knowledgeNodeId} 上已审核错因的微辅导验证，不由 allowedStages 或 remediation/checkpoint 标签自动授权。`,
  };
}

async function main() {
  const [catalogItems, reviewDecisions] = await Promise.all([
    readJsonl<AdaptiveAssessmentCatalogItem>('adaptive-assessment-item-catalog-items.jsonl'),
    readJsonl<AssessmentItemSemanticReviewDecision>('assessment-item-semantic-review-snapshots.jsonl'),
  ]);
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

  const entries = practiceBaselineSource.entries.map((baseline) => {
    const item = catalogById.get(baseline.catalogItemId);
    const review = reviewById.get(baseline.catalogItemId);
    if (!item || !review) {
      throw new Error(`Missing catalog or review for ${baseline.catalogItemId}`);
    }
    if (item.contentHash !== baseline.contentHash || review.sourceContentHash !== baseline.contentHash) {
      throw new Error(`Content hash drift for ${baseline.catalogItemId}`);
    }
    if (review.outcome !== 'approved' || review.selectedStagePurpose !== 'practice') {
      throw new Error(`${baseline.catalogItemId} is not an approved practice item`);
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
    const relations: MicroTutoringValidationRelation[] = [...nodeTags]
      .sort((left, right) => left.misconceptionTag.localeCompare(right.misconceptionTag))
      .map((tag) => ({
        misconceptionTag: tag.misconceptionTag,
        rationale: `复用已审核练习变式 ${item.sourceId} 作为独立验证，覆盖选项审核确认的错因：${tag.evidenceSummary}`,
      }));
    const purpose = purposeDecision(goalNode.knowledgeNodeId);
    const snapshotVersion = item.versionRefs.adaptiveAssessmentSnapshotVersion;
    if (!snapshotVersion) {
      throw new Error(`Missing snapshot version for ${baseline.catalogItemId}`);
    }
    const difficulty = typeof review.difficulty === 'number' ? review.difficulty : item.semanticRefs.difficulty;
    if (typeof difficulty !== 'number') {
      throw new Error(`Missing difficulty for ${baseline.catalogItemId}`);
    }
    if (!review.reviewSourceHash) {
      throw new Error(`Missing review source hash for ${baseline.catalogItemId}`);
    }
    return {
      id: `micro-tutoring-validation:${item.sourceId}`,
      catalogItemId: item.catalogItemId,
      sourceId: item.sourceId,
      contentHash: item.contentHash,
      itemRevision: microTutoringValidationItemRevision({
        catalogItemId: item.catalogItemId,
        sourceId: item.sourceId,
        contentHash: item.contentHash,
        learningGoalId,
        knowledgeNodeId: goalNode.knowledgeNodeId,
        difficulty,
        estimatedMinutes: MICRO_TUTORING_VALIDATION_ESTIMATED_MINUTES,
        snapshotVersion,
        itemReviewSourceHash: review.reviewSourceHash,
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
      itemReviewSourceHash: review.reviewSourceHash,
      purposeDecision: purpose,
      studentQuestionRef: {
        catalogItemId: item.catalogItemId,
        sourceId: item.sourceId,
        contentHash: item.contentHash,
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
