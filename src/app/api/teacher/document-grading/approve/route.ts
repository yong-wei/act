import { Prisma, UserRole } from '@prisma/client';
import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  approveGradingRun,
  parsePersistedDocumentRubricGradingDraft,
  validateDocumentRubricGradingDraftInvariants,
  writeApprovedGradingEvidence,
} from '@/lib/data-governance/document-rubric-grading-workbench';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    if (session.user.role !== UserRole.TEACHER && session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: '无权审批文档评分' }, { status: 403 });
    }

    const body = await request.json() as {
      gradingRunId?: string;
      decision?: unknown;
      notes?: string;
    };
    if (!body.gradingRunId) {
      return NextResponse.json({ error: '缺少评分运行标识' }, { status: 400 });
    }
    if (body.decision !== undefined && !isDocumentGradingDecision(body.decision)) {
      return NextResponse.json({ error: '审批决策无效' }, { status: 400 });
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

    const decision = body.decision ?? 'approved';
    const approved = approveGradingRun(parsed.run, {
      reviewerId: session.user.id,
      decision,
      notes: body.notes,
    });
    const writeback = decision === 'approved'
      ? await writeApprovedGradingEvidence({
          db: {
            learningFact: {
              createMany: async (input) => prisma.learningFact.createMany({
                data: input.data as NonNullable<Parameters<typeof prisma.learningFact.createMany>[0]>['data'],
                skipDuplicates: input.skipDuplicates,
              }),
            },
            studentEvidenceFeatureCache: {
              deleteMany: async (input) => prisma.studentEvidenceFeatureCache.deleteMany(input),
            },
          },
          run: approved,
          rubric: parsed.rubric,
          studentId: draft.ownerUserId,
          goalContext: parsed.goalContext,
        })
      : { status: 'blocked-unapproved' as const, created: 0, facts: [] };

    const existingSummary = typeof draft.summary === 'object' && draft.summary !== null && !Array.isArray(draft.summary)
      ? draft.summary as Record<string, unknown>
      : {};
    const existingProvenance = typeof draft.provenance === 'object' && draft.provenance !== null && !Array.isArray(draft.provenance)
      ? draft.provenance as Record<string, unknown>
      : {};

    const updatedSummary = toPrismaJsonObject({
      ...existingSummary,
      run: approved,
    });
    const updatedProvenance = toPrismaJsonObject({
      ...existingProvenance,
      reviewerId: session.user.id,
      reviewedAt: approved.teacherReview.reviewedAt,
      decision,
    });

    await prisma.learningEvidenceDraft.update({
      where: { id: draft.id },
      data: {
        reviewerState: decision,
        summary: updatedSummary,
        provenance: updatedProvenance,
      },
    });

    return NextResponse.json({
      status: decision,
      gradingRunId: approved.id,
      createdFacts: writeback.created,
      evidenceSourceEventIds: writeback.facts.map((fact) => fact.sourceEventId),
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[DocumentRubricGrading] approve failed', error);
    return NextResponse.json({ error: '审批文档评分失败' }, { status: 500 });
  }
}

function toPrismaJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

function isDocumentGradingDecision(value: unknown): value is 'approved' | 'returned' | 'rejected' {
  return value === 'approved' || value === 'returned' || value === 'rejected';
}
