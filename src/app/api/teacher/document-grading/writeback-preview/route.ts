import { UserRole } from '@prisma/client';
import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import {
  approveGradingRun,
  parsePersistedDocumentRubricGradingDraft,
  previewApprovedGradingEvidence,
  validateDocumentRubricGradingDraftInvariants,
} from '@/lib/data-governance/document-rubric-grading-workbench';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

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

    const body = await request.json() as { gradingRunId?: string; notes?: string };
    if (!body.gradingRunId) {
      return NextResponse.json({ error: '缺少评分运行标识' }, { status: 400 });
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

    const previewRun = parsed.run.status === 'approved'
      ? parsed.run
      : approveGradingRun(parsed.run, {
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
