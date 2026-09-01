import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { AdaptiveAssessmentCatalogItem } from '@/features/adaptive-assessment/adaptive-assessment-item-catalog';
import { prisma } from '@/lib/prisma';

import { AssignmentDomainError } from './assignment-domain';
import { signCatalogSelectionIdentity, stableHash } from './assignment-integrity';

const catalogPath = path.join(/*turbopackIgnore: true*/ process.cwd(), 'course-content/runtime/resource-governance/adaptive-assessment-item-catalog-items.jsonl');

export function isAssignmentAuthoringEligible(item: AdaptiveAssessmentCatalogItem): boolean {
  return item.reviewState === 'path-eligible'
    && item.eligibilityState === 'path-eligible'
    && item.allowedStages.includes('low-stakes-practice')
    && item.limitations.length === 0;
}

export function inferQuestionType(item: AdaptiveAssessmentCatalogItem) {
  if (item.questionRefs.options?.length) return 'choice';
  if (item.questionRefs.choiceMode) return 'choice';
  return item.questionRefs.stem ? 'subjective-text' : 'unknown';
}

async function readCatalogItems(): Promise<AdaptiveAssessmentCatalogItem[]> {
  return (await readFile(catalogPath, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as AdaptiveAssessmentCatalogItem);
}

export async function listAssignmentQuestionCatalog() {
  const items = await readCatalogItems();
  const refs = await prisma.adaptiveAssessmentItemRef.findMany({
    where: { questionId: { in: items.map((item) => item.sourceId) } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, questionId: true, contentHash: true, algorithmVersion: true },
  });
  const refByQuestionId = new Map(refs.map((ref) => [ref.questionId, ref]));
  return items.flatMap((item) => {
    if (!isAssignmentAuthoringEligible(item)) return [];
    const ref = refByQuestionId.get(item.sourceId);
    if (!ref) return [];
    return [{
      catalogItemId: item.catalogItemId,
      sourceId: ref.id,
      sourceFamily: item.sourceFamily,
      questionType: inferQuestionType(item),
      stemPreview: (item.questionRefs.stem ?? '题面待补充').slice(0, 240),
      knowledgeTags: item.semanticRefs.knowledgeTags,
      difficulty: item.semanticRefs.difficulty,
      reviewState: item.reviewState,
      rubricReadiness: item.questionRefs.rubricRef && item.questionRefs.answerKey?.length ? 'ready' : 'needs-authoring',
      sourceVersion: ref.algorithmVersion,
      contentHash: ref.contentHash.startsWith('sha256:') ? ref.contentHash : `sha256:${ref.contentHash}`,
    }];
  });
}

export async function selectAssignmentQuestionCatalogItem(sourceId: string) {
  const ref = await prisma.adaptiveAssessmentItemRef.findUnique({
    where: { id: sourceId },
    select: { id: true, questionId: true, contentHash: true, algorithmVersion: true },
  });
  if (!ref) throw new AssignmentDomainError('catalog-source-not-found');
  const items = await readCatalogItems();
  const item = items.find((entry) => entry.sourceId === ref.questionId);
  if (!item) throw new AssignmentDomainError('catalog-source-not-found');
  if (!isAssignmentAuthoringEligible(item)) {
    throw new AssignmentDomainError('catalog-item-ineligible', item.limitations);
  }
  const parentSourceHash = ref.contentHash.startsWith('sha256:') ? ref.contentHash : `sha256:${ref.contentHash}`;
  const identity = {
    parentSourceId: ref.id,
    parentSourceVersion: ref.algorithmVersion,
    parentSourceHash,
    catalogItemId: item.catalogItemId,
    originalSourceFamily: item.sourceFamily,
    reviewState: item.reviewState,
    eligibilityState: item.eligibilityState,
    allowedStages: [...item.allowedStages],
    limitations: [...item.limitations],
  };
  const secret = process.env.ASSIGNMENT_CATALOG_LINEAGE_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new AssignmentDomainError('catalog-lineage-secret-missing');
  const prompt = item.questionRefs.stem?.trim() || '题面待补充';
  const referenceAnswer = item.questionRefs.answerKey?.join('\n') || item.questionRefs.explanation?.trim() || '参考答案待教师补充';
  const rubric = {
    schemaVersion: 'assignment-scoring-rubric.v2' as const,
    criteria: [{
      id: 'criterion-1',
      label: '完成质量',
      goalDimension: 'engineeringDecision' as const,
      maxPoints: 10,
      scoringStandard: '根据作答中的可复核证据、正确性和完整性评分。',
      detailedRubricEnabled: false,
      levels: [],
    }],
  };
  const derivative = { responseType: 'SUBJECTIVE_TEXT' as const, points: 10, prompt, referenceAnswer, rubric };
  return {
    stableQuestionId: `catalog-${item.catalogItemId}`,
    ...derivative,
    source: {
      family: 'ASSIGNMENT_DERIVATIVE',
      ...identity,
      selectionProof: signCatalogSelectionIdentity(identity, secret),
      contentHash: stableHash(derivative),
      authoringMarker: 'assignment-authoring',
    },
  };
}
