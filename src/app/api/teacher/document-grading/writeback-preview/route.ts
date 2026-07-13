import { UserRole } from '@prisma/client';
import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import {
  approveGradingRun,
  editCriterionGrade,
  parsePersistedDocumentRubricGradingDraft,
  previewApprovedGradingEvidence,
  validateDocumentRubricGradingDraftInvariants,
} from '@/lib/data-governance/document-rubric-grading-workbench';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import { legacyDocumentGradingRouteDisabled } from '@/lib/data-governance/math-document-grading-api';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    if (legacyDocumentGradingRouteDisabled()) {
      return NextResponse.json({ error: 'legacy-document-grading-route-disabled', replacement: '/api/teacher/document-grading/pipeline' }, { status: 410, headers: { Deprecation: 'true' } });
    }
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

    const draft = await prisma.learningEvidenceDraft.findFirst({
      where: {
        id: body.gradingRunId,
        sourceType: 'document_rubric_grading',
      },
    });
    if (!draft) {
      return NextResponse.json({ error: '评分草稿不存在' }, { status: 404 });
    }

    const parsed = parsePersistedDocumentRubricGradingDraft(draft);
    if (!parsed) {
      return NextResponse.json({ error: '评分草稿结构不可用' }, { status: 422 });
    }
    const invariants = validateDocumentRubricGradingDraftInvariants({ draft, parsed });
    if (!invariants.valid) {
      return NextResponse.json({
        error: '评分草稿归属不一致',
        reasons: invariants.reasons,
      }, { status: 422 });
    }

    const classData = await prisma.class.findUnique({
      where: { id: parsed.goalContext.classId },
      select: { id: true, teacherId: true },
    });
    if (!classData) {
      return NextResponse.json({ error: '班级不存在' }, { status: 404 });
    }
    if (session.user.role !== UserRole.ADMIN && classData.teacherId !== session.user.id) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const studentProfile = await prisma.studentProfile.findFirst({
      where: {
        classId: parsed.goalContext.classId,
        userId: draft.ownerUserId,
      },
      select: { id: true },
    });
    if (!studentProfile) {
      return NextResponse.json({ error: '学生不在该班级中' }, { status: 404 });
    }
    if (parsed.run.status === 'approved' && (body.edits ?? []).length > 0) {
      return NextResponse.json({ error: '已批准评分不能直接编辑' }, { status: 409 });
    }
    if (parsed.run.status === 'blocked' || parsed.run.evaluator.status === 'blocked') {
      return NextResponse.json({
        error: '评分草稿存在阻塞的评估器输出，需要重新转换或重新评估后再预览写回',
        reasons: parsed.run.evaluator.blockedReasons,
      }, { status: 409 });
    }
    const editValidationError = validateDocumentGradingEditsAgainstRubric(
      body.edits ?? [],
      parsed.rubric,
    );
    if (editValidationError) {
      return NextResponse.json({ error: editValidationError }, { status: 400 });
    }

    const editedRun = (body.edits ?? []).reduce((run, edit) => editCriterionGrade(run, {
      criterionId: edit.criterionId,
      levelId: edit.levelId,
      score: edit.score,
      comment: edit.comment,
      reviewerId: session.user.id,
      rubric: parsed.rubric,
    }), parsed.run);
    const previewRun = editedRun.status === 'approved'
      ? editedRun
      : approveGradingRun(editedRun, {
          reviewerId: session.user.id,
          decision: 'approved',
          notes: body.notes,
        });
    const preview = previewApprovedGradingEvidence({
      run: previewRun,
      rubric: parsed.rubric,
      studentId: draft.ownerUserId,
      goalContext: parsed.goalContext,
    });

    return NextResponse.json({
      status: preview.status,
      gradingRunId: previewRun.id,
      wouldCreateFacts: preview.facts.length,
      blockedFacts: preview.blocked,
      affectedDimensions: preview.affectedDimensions,
      evidenceSourceEventIds: preview.facts.map((fact) => fact.sourceEventId),
      dedupeKeys: preview.dedupeKeys,
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[DocumentRubricGrading] writeback preview failed', error);
    return NextResponse.json({ error: '预览文档评分写回失败' }, { status: 500 });
  }
}

function isDocumentGradingEditList(value: unknown): value is Array<{
  criterionId: string;
  levelId: string;
  score: number;
  comment: string;
}> {
  return Array.isArray(value) && value.every((item) => item &&
    typeof item === 'object' &&
    !Array.isArray(item) &&
    typeof item.criterionId === 'string' &&
    typeof item.levelId === 'string' &&
    typeof item.score === 'number' &&
    Number.isFinite(item.score) &&
    typeof item.comment === 'string');
}

function validateDocumentGradingEditsAgainstRubric(
  edits: Array<{
    criterionId: string;
    levelId: string;
    score: number;
    comment: string;
  }>,
  rubric: {
    maxScore: number;
    criteria: Array<{
      id: string;
      levels: Array<{ id: string; score: number }>;
    }>;
  },
): string | null {
  for (const edit of edits) {
    const criterion = rubric.criteria.find((item) => item.id === edit.criterionId);
    if (!criterion) {
      return '评分编辑指标不存在';
    }
    const level = criterion.levels.find((item) => item.id === edit.levelId);
    if (!level) {
      return '评分编辑等级不存在';
    }
    if (edit.score < 0 || edit.score > rubric.maxScore) {
      return '评分编辑分数超出量规范围';
    }
  }
  return null;
}
