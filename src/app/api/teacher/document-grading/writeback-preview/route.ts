import { UserRole } from '@prisma/client';
import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';

import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { legacyDocumentRubricDraftRetiredResponse } from '@/lib/data-governance/math-document-grading-api';
import { GradingMutationError } from '@/lib/data-governance/math-document-grading-contracts';
import { prisma } from '@/lib/prisma';
import {
  buildPipelineReviewFactCandidates,
  assertPipelineReviewActor,
  isPipelineRunReviewable,
  PIPELINE_GRADING_REVIEW_INCLUDE,
  pipelineReviewScope,
  validatePipelineReviewContract,
  validatePipelineReviewEdits,
  validatePipelineRuntimeSource,
} from '@/lib/data-governance/math-document-grading-review';
import { createSubmissionObjectStore } from '@/lib/assignments/submission-object-store';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    if (session.user.role !== UserRole.TEACHER && session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: '无权预览文档评分写回' }, { status: 403 });
    }

    const body = await request.json() as {
      gradingRunId?: string;
      edits?: Array<{
        criterionId?: unknown;
        levelId?: unknown;
        score?: unknown;
        comment?: unknown;
      }>;
      notes?: string;
    };
    if (!body.gradingRunId) {
      return NextResponse.json({ error: '缺少评分运行标识' }, { status: 400 });
    }
    if (body.edits !== undefined && !isDocumentGradingEditList(body.edits)) {
      return NextResponse.json({ error: '评分编辑无效' }, { status: 400 });
    }

    const pipelineRun = await prisma.gradingRun.findUnique({
      where: { id: body.gradingRunId },
      include: PIPELINE_GRADING_REVIEW_INCLUDE,
    });
    if (pipelineRun) {
      if (!isPipelineRunReviewable(pipelineRun) || pipelineRun.state !== 'AWAITING_REVIEW') {
        return NextResponse.json({ error: '评分运行当前不可预览写回' }, { status: 409 });
      }
      const scope = pipelineReviewScope(pipelineRun);
      await assertPipelineReviewActor({ db: prisma, run: pipelineRun, actor: { id: session.user.id, role: session.user.role } });
      const editError = validatePipelineReviewEdits(pipelineRun, body.edits ?? []);
      if (editError) return NextResponse.json({ error: editError }, { status: 400 });
      const contractReasons = validatePipelineReviewContract(pipelineRun);
      contractReasons.push(...await validatePipelineRuntimeSource(pipelineRun, createSubmissionObjectStore()));
      if (contractReasons.length > 0) return NextResponse.json({ error: 'grading-review-contract-drift', reasons: contractReasons }, { status: 409 });
      const facts = buildPipelineReviewFactCandidates({ run: pipelineRun, edits: body.edits ?? [], reviewedAt: new Date() });
      return NextResponse.json({
        status: 'preview',
        gradingRunId: pipelineRun.id,
        wouldCreateFacts: facts.length,
        blockedFacts: 0,
        affectedDimensions: facts.flatMap((fact: any) => Object.entries(fact.competencyContribution).map(([competencyDimension, contribution]) => ({ criterionId: fact.contextJson.criterionId, competencyDimension, contribution, confidence: fact.contextJson.confidence, sourceEventId: fact.sourceEventId, anchorCount: pipelineRun.annotations.filter((annotation: any) => annotation.criterionId === fact.contextJson.criterionId).length, hasEvidence: pipelineRun.annotations.some((annotation: any) => annotation.criterionId === fact.contextJson.criterionId) }))),
        evidenceSourceEventIds: facts.map((fact: any) => fact.sourceEventId),
        dedupeKeys: facts.map((fact: any) => fact.sourceEventId),
      });
    }

    return legacyDocumentRubricDraftRetiredResponse();
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof GradingMutationError) return NextResponse.json({ error: error.code }, { status: error.status });
    console.error('[DocumentRubricGrading] writeback preview failed', error);
    return NextResponse.json({ error: '预览文档评分写回失败' }, { status: 500 });
  }
}

function isDocumentGradingEditList(value: unknown): value is Array<{
  criterionId: string;
  levelId: string | null;
  score: number;
  comment: string;
}> {
  return Array.isArray(value) && value.every((item) => item &&
    typeof item === 'object' &&
    !Array.isArray(item) &&
    typeof item.criterionId === 'string' &&
    (item.levelId === null || typeof item.levelId === 'string') &&
    typeof item.score === 'number' &&
    Number.isFinite(item.score) &&
    typeof item.comment === 'string');
}
