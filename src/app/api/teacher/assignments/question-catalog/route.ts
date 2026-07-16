import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { AdaptiveAssessmentCatalogItem } from '@/features/adaptive-assessment/adaptive-assessment-item-catalog';
import { AssignmentDomainError, signCatalogSelectionIdentity, stableHash } from '@/lib/assignments/assignment-domain';
import { assignmentErrorResponse, readBoundedAssignmentJson, requireAssignmentActor, requireAssignmentMutation } from '@/lib/assignments/assignment-route-guards';
import { prisma } from '@/lib/prisma';

const catalogPath = path.join(process.cwd(), 'course-content/runtime/resource-governance/adaptive-assessment-item-catalog-items.jsonl');

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  try {
    const items = (await readFile(catalogPath, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as AdaptiveAssessmentCatalogItem);
    const refs = await prisma.adaptiveAssessmentItemRef.findMany({
      where: { questionId: { in: items.map((item) => item.sourceId) } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, questionId: true, contentHash: true, algorithmVersion: true },
    });
    const refByQuestionId = new Map(refs.map((ref) => [ref.questionId, ref]));
    return NextResponse.json({
      items: items.flatMap((item) => {
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
      }),
    });
  } catch {
    return NextResponse.json({ error: 'question-catalog-unavailable' }, { status: 503 });
  }
}

const selectionSchema = z.object({ sourceId: z.string().trim().min(1).max(200) }).strict();

export async function POST(request: Request) {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  const blocked = requireAssignmentMutation(request, auth.actor.id);
  if (blocked) return blocked;
  try {
    const { sourceId } = selectionSchema.parse(await readBoundedAssignmentJson(request));
    const ref = await prisma.adaptiveAssessmentItemRef.findUnique({ where: { id: sourceId }, select: { id: true, questionId: true, contentHash: true, algorithmVersion: true } });
    if (!ref) return NextResponse.json({ error: 'catalog-source-not-found' }, { status: 404 });
    const items = (await readFile(catalogPath, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as AdaptiveAssessmentCatalogItem);
    const item = items.find((entry) => entry.sourceId === ref.questionId);
    if (!item) return NextResponse.json({ error: 'catalog-source-not-found' }, { status: 404 });
    if (!isAssignmentAuthoringEligible(item)) return NextResponse.json({ error: 'catalog-item-ineligible', details: item.limitations }, { status: 400 });
    const parentSourceHash = ref.contentHash.startsWith('sha256:') ? ref.contentHash : `sha256:${ref.contentHash}`;
    const identity = { parentSourceId: ref.id, parentSourceVersion: ref.algorithmVersion, parentSourceHash, catalogItemId: item.catalogItemId, originalSourceFamily: item.sourceFamily, reviewState: item.reviewState, eligibilityState: item.eligibilityState, allowedStages: [...item.allowedStages], limitations: [...item.limitations] };
    const secret = process.env.ASSIGNMENT_CATALOG_LINEAGE_SECRET ?? process.env.NEXTAUTH_SECRET;
    if (!secret) throw new AssignmentDomainError('catalog-lineage-secret-missing');
    const prompt = item.questionRefs.stem?.trim() || '题面待补充';
    const referenceAnswer = item.questionRefs.answerKey?.join('\n') || item.questionRefs.explanation?.trim() || '参考答案待教师补充';
    const rubric = { schemaVersion: 'assignment-analytic-rubric.v1' as const, criteria: [{
      id: 'criterion-1', label: '完成质量', maxPoints: 10,
      evidenceDescription: '根据作答中的可复核证据评分。', feedbackGuidance: '指出关键得分证据与改进建议。',
      levels: [{ id: 'level-1', label: '达成程度', minPoints: 0, maxPoints: 10, description: '依据证据在连续整数分值区间内评分。' }],
    }] };
    const derivative = { responseType: 'SUBJECTIVE_TEXT' as const, points: 10, prompt, referenceAnswer, rubric };
    return NextResponse.json({ question: {
      stableQuestionId: `catalog-${item.catalogItemId}`,
      ...derivative,
      source: { family: 'ASSIGNMENT_DERIVATIVE', ...identity, selectionProof: signCatalogSelectionIdentity(identity, secret), contentHash: stableHash(derivative), authoringMarker: 'assignment-authoring' },
    } });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}

function isAssignmentAuthoringEligible(item: AdaptiveAssessmentCatalogItem): boolean {
  return item.reviewState === 'path-eligible'
    && item.eligibilityState === 'path-eligible'
    && item.allowedStages.includes('low-stakes-practice')
    && item.limitations.length === 0;
}

function inferQuestionType(item: AdaptiveAssessmentCatalogItem) {
  if (item.questionRefs.options?.length) return 'choice';
  if (item.questionRefs.choiceMode) return 'choice';
  return item.questionRefs.stem ? 'subjective-text' : 'unknown';
}
