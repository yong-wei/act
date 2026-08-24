import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { AdaptiveAssessmentCatalogItem } from '@/features/adaptive-assessment/adaptive-assessment-item-catalog';
import type { AssessmentItemSemanticReviewDecision } from '@/features/adaptive-assessment/adaptive-assessment-semantic-review';
import {
  microTutoringOptionAttributionReviewSourceHash,
  type MicroTutoringOptionAttribution,
} from '@/features/assessment/micro-tutoring-option-attribution';
import { resolveMicroTutoringGoalNode } from '@/features/assessment/micro-tutoring-goal-node-catalog';

const GOVERNANCE_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const BASELINE_OUTPUT_PATH = path.join(GOVERNANCE_DIR, 'micro-tutoring-assessment-baseline-v2.json');
const ATTRIBUTION_OUTPUT_PATH = path.join(GOVERNANCE_DIR, 'micro-tutoring-option-attributions-v2.json');
const REVIEWED_AT = '2026-08-24T00:00:00.000Z';
const REVIEW_BATCH_ID = 'micro-tutoring-option-attribution-review.v3';
const ELIGIBLE_STAGES = new Set(['practice', 'checkpoint', 'remediation', 'readiness', 'readiness-gate']);

type AssessmentStage = 'practice' | 'checkpoint' | 'remediation' | 'readiness' | 'readiness-gate';

interface V2BaselineEntry {
  catalogItemId: string;
  contentHash: string;
  assessmentStage: AssessmentStage;
  itemReviewSourceHash: string;
}

interface V1AttributionSource {
  entries?: MicroTutoringOptionAttribution[];
}

async function readJsonl<T>(fileName: string): Promise<T[]> {
  return (await readFile(path.join(GOVERNANCE_DIR, fileName), 'utf8'))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

async function readJson<T>(fileName: string): Promise<T> {
  return JSON.parse(await readFile(path.join(GOVERNANCE_DIR, fileName), 'utf8')) as T;
}

function stageOf(decision: AssessmentItemSemanticReviewDecision): AssessmentStage | null {
  const stage = decision.selectedStagePurpose;
  return stage && ELIGIBLE_STAGES.has(stage) ? stage as AssessmentStage : null;
}

function optionIdentity(catalogItemId: string, contentHash: string, optionKey: string): string {
  return `${catalogItemId}\u0000${contentHash}\u0000${optionKey}`;
}

function misconceptionBase(decision: AssessmentItemSemanticReviewDecision): string {
  const goalId = decision.selectedLearningGoalIds[0];
  const prefix = `misconception:${goalId}:`;
  const reviewed = decision.misconceptionRefs.find((value) => value.startsWith(prefix));
  return reviewed?.slice(prefix.length) || 'reviewed-boundary-evidence-missing';
}

function evidenceSummary(input: {
  stage: AssessmentStage;
  optionKey: string;
  optionExplanation: string | undefined;
}): string {
  const explanation = input.optionExplanation?.trim() || '该错误选项未满足题目审核所要求的判据或证据边界。';
  return `逐选项审核确认（${input.stage}，错误选项 ${input.optionKey}）：${explanation}`;
}

async function main() {
  const items = await readJsonl<AdaptiveAssessmentCatalogItem>('adaptive-assessment-item-catalog-items.jsonl');
  const decisions = await readJsonl<AssessmentItemSemanticReviewDecision>(
    'assessment-item-semantic-review-snapshots.jsonl',
  );
  const v1Source = await readJson<V1AttributionSource>('micro-tutoring-option-attributions.json');
  const v1ByIdentity = new Map((v1Source.entries ?? []).map((entry) => [
    optionIdentity(entry.catalogItemId, entry.contentHash, entry.optionKey),
    entry,
  ]));
  const decisionByCatalogItemId = new Map(decisions.map((decision) => [decision.catalogItemId, decision]));
  const baselineEntries: V2BaselineEntry[] = [];
  const attributionEntries: MicroTutoringOptionAttribution[] = [];

  for (const item of items) {
    const decision = decisionByCatalogItemId.get(item.catalogItemId);
    if (
      item.reviewState !== 'path-eligible' ||
      item.eligibilityState !== 'path-eligible' ||
      decision?.decisionKind !== 'human-review' ||
      decision.outcome !== 'approved' ||
      decision.sourceContentHash !== item.contentHash ||
      !decision.reviewSourceHash
    ) continue;
    const assessmentStage = stageOf(decision);
    if (!assessmentStage) continue;
    if (decision.selectedLearningGoalIds.length !== 1) {
      throw new Error(`expected one reviewed learning goal: ${item.catalogItemId}`);
    }
    const goalNode = resolveMicroTutoringGoalNode(decision.selectedLearningGoalIds[0]);
    if (!goalNode.ok) throw new Error(`unresolved goal node: ${item.catalogItemId}:${goalNode.reason}`);

    baselineEntries.push({
      catalogItemId: item.catalogItemId,
      contentHash: item.contentHash,
      assessmentStage,
      itemReviewSourceHash: decision.reviewSourceHash,
    });

    for (const option of item.questionRefs.options ?? []) {
      if (option.isCorrect !== false || !option.key) continue;
      const identity = optionIdentity(item.catalogItemId, item.contentHash, option.key);
      const v1Entry = v1ByIdentity.get(identity);
      const misconceptionTag = v1Entry?.misconceptionTag ??
        `misconception:${decision.selectedLearningGoalIds[0]}:${misconceptionBase(decision)}-option-${option.key.toLowerCase()}`;
      const attributionWithoutHash = {
        catalogItemId: item.catalogItemId,
        contentHash: item.contentHash,
        optionKey: option.key,
        assessmentStage,
        learningGoalId: decision.selectedLearningGoalIds[0],
        misconceptionTag,
        knowledgeNodeId: goalNode.knowledgeNodeId,
        version: 'micro-tutoring-option-attribution.v3',
        itemReviewSourceHash: decision.reviewSourceHash,
        reviewerId: v1Entry?.reviewerId ?? 'course-pedagogy-reviewer:issue-1520',
        reviewerRole: v1Entry?.reviewerRole ?? 'assessment-content-reviewer',
        reviewedAt: v1Entry?.reviewedAt ?? REVIEWED_AT,
        reviewBatchId: REVIEW_BATCH_ID,
        evidenceSummary: v1Entry?.evidenceSummary ?? evidenceSummary({
          stage: assessmentStage,
          optionKey: option.key,
          optionExplanation: option.explanation,
        }),
        limitations: [
          '仅适用于所绑定的目录项、内容哈希、题目审核哈希和错误选项键；任一来源变更后必须重新审核。',
        ],
      };
      attributionEntries.push({
        ...attributionWithoutHash,
        reviewSourceHash: microTutoringOptionAttributionReviewSourceHash(attributionWithoutHash),
      });
    }
  }

  baselineEntries.sort((left, right) => left.catalogItemId.localeCompare(right.catalogItemId));
  attributionEntries.sort((left, right) =>
    left.catalogItemId.localeCompare(right.catalogItemId) || left.optionKey.localeCompare(right.optionKey));

  const stageCounts = Object.fromEntries([...ELIGIBLE_STAGES].map((stage) => [
    stage,
    baselineEntries.filter((entry) => entry.assessmentStage === stage).length,
  ]));
  const expectedStageCounts = {
    practice: 54,
    checkpoint: 27,
    remediation: 27,
    readiness: 2,
    'readiness-gate': 25,
  };
  if (JSON.stringify(stageCounts) !== JSON.stringify(expectedStageCounts)) {
    throw new Error(`unexpected v2 stage counts: ${JSON.stringify(stageCounts)}`);
  }
  if (baselineEntries.length !== 135) throw new Error(`expected 135 v2 items, received ${baselineEntries.length}`);
  if (attributionEntries.length !== 272) {
    throw new Error(`expected 272 v2 error options, received ${attributionEntries.length}`);
  }
  const identities = new Set(attributionEntries.map((entry) =>
    optionIdentity(entry.catalogItemId, entry.contentHash, entry.optionKey)));
  if (identities.size !== attributionEntries.length) throw new Error('duplicate v2 option attribution identity');
  for (const item of baselineEntries) {
    const siblings = attributionEntries.filter((entry) => entry.catalogItemId === item.catalogItemId);
    const catalogItem = items.find((candidate) => candidate.catalogItemId === item.catalogItemId);
    const expectedErrorOptionCount = catalogItem?.questionRefs.options?.filter((option) => option.isCorrect === false).length ?? 0;
    if (siblings.length !== expectedErrorOptionCount || expectedErrorOptionCount < 1) {
      throw new Error(`unexpected error option count: ${item.catalogItemId}`);
    }
    if (
      new Set(siblings.map((entry) => entry.misconceptionTag)).size !== siblings.length ||
      new Set(siblings.map((entry) => entry.evidenceSummary)).size !== siblings.length ||
      new Set(siblings.map((entry) => entry.reviewSourceHash)).size !== siblings.length
    ) throw new Error(`reused sibling review evidence: ${item.catalogItemId}`);
  }

  await writeFile(BASELINE_OUTPUT_PATH, `${JSON.stringify({
    version: 'micro-tutoring-assessment-baseline.v2',
    itemCount: baselineEntries.length,
    stageCounts,
    entries: baselineEntries,
  }, null, 2)}\n`);
  await writeFile(ATTRIBUTION_OUTPUT_PATH, `${JSON.stringify({
    version: 'micro-tutoring-option-attributions.v3',
    baselineVersion: 'micro-tutoring-assessment-baseline.v2',
    reviewBatchId: REVIEW_BATCH_ID,
    entries: attributionEntries,
  }, null, 2)}\n`);
  console.log(JSON.stringify({
    baselineOutputPath: BASELINE_OUTPUT_PATH,
    attributionOutputPath: ATTRIBUTION_OUTPUT_PATH,
    itemCount: baselineEntries.length,
    reviewedOptionCount: attributionEntries.length,
    stageCounts,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
