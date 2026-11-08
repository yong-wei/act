/**
 * 步骤提交尝试 API（issue-2152 阶段 3）：追加与本人列表。
 *
 * 合同：只增不删——计分选取不删除其他尝试；attemptSeq 步内递增唯一
 * （事务内 max+1，P2002 兜底整体重试一次）；首次/最近/最佳/最终选定
 * 由列表端按 attemptSeq/createdAt/scoreResult/selectedFinalAt 派生。
 * 引用工件（模型/对照/信封）归属校验：非本人引用 404 不泄露存在性。
 */
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import { stepSubmissionAttemptSchema } from '@/lib/student-model-artifact-contract';
import { createDatabaseUnavailableResponse, isDatabaseConnectivityError } from '@/lib/service-availability';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '请先登录后再查看提交记录' }, { status: 401 });
    }
    const experimentKey = request.nextUrl.searchParams.get('experimentKey');
    const stepKey = request.nextUrl.searchParams.get('stepKey');
    if (!experimentKey || !stepKey) {
      return NextResponse.json({ error: '需要指定实验与步骤' }, { status: 400 });
    }
    const rows = await prisma.stepSubmissionAttempt.findMany({
      where: {
        userId: session.user.id,
        experimentKey,
        stepKey,
      },
      orderBy: { attemptSeq: 'asc' },
    });
    return NextResponse.json({
      attempts: rows,
      derived: {
        firstAttemptSeq: rows.length > 0 ? rows[0].attemptSeq : null,
        latestAttemptSeq: rows.length > 0 ? rows[rows.length - 1].attemptSeq : null,
      },
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (isDatabaseConnectivityError(error)) {
      return createDatabaseUnavailableResponse();
    }
    return NextResponse.json({ error: '暂时无法读取提交记录' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '请先登录后再保存提交' }, { status: 401 });
    }
    const body: unknown = await request.json().catch(() => null);
    const parsed = stepSubmissionAttemptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: '提交记录内容不完整或含无效数值', issues: parsed.error.issues.length },
        { status: 400 },
      );
    }
    const payload = parsed.data;

    // 归属校验：引用的学生模型必须属于本人（不泄露他人工件存在性）。
    const modelIds = payload.studentModelIds ?? [];
    if (modelIds.length > 0) {
      const owned = await prisma.studentModelArtifact.count({
        where: { userId: session.user.id, id: { in: modelIds } },
      });
      if (owned !== modelIds.length) {
        return NextResponse.json({ error: '提交引用了无效的学生模型' }, { status: 404 });
      }
    }
    const comparisonIds = payload.comparisonIds ?? [];
    if (comparisonIds.length > 0) {
      const owned = await prisma.comparisonArtifact.count({
        where: { userId: session.user.id, id: { in: comparisonIds } },
      });
      if (owned !== comparisonIds.length) {
        return NextResponse.json({ error: '提交引用了无效的对照记录' }, { status: 404 });
      }
    }
    const runRefs = payload.runRefs;
    if (runRefs.length > 0) {
      const owned = await prisma.appliedRunEnvelope.count({
        where: { userId: session.user.id, runRef: { in: runRefs } },
      });
      if (owned !== runRefs.length) {
        return NextResponse.json({ error: '提交引用了无效的运行记录' }, { status: 404 });
      }
    }

    const appendOnce = () =>
      prisma.$transaction(async (tx) => {
        const latest = await tx.stepSubmissionAttempt.findFirst({
          where: {
            userId: session.user.id,
            experimentKey: payload.experimentKey,
            stepKey: payload.stepKey,
          },
          orderBy: { attemptSeq: 'desc' },
          select: { attemptSeq: true },
        });
        return tx.stepSubmissionAttempt.create({
          data: {
            userId: session.user.id,
            experimentKey: payload.experimentKey,
            stepKey: payload.stepKey,
            attemptSeq: (latest?.attemptSeq ?? 0) + 1,
            status: payload.status,
            runRefs: runRefs as Prisma.InputJsonValue,
            studentModelIds: modelIds.length
              ? (modelIds as Prisma.InputJsonValue)
              : Prisma.DbNull,
            comparisonIds: comparisonIds.length
              ? (comparisonIds as Prisma.InputJsonValue)
              : Prisma.DbNull,
            sketchRefs: payload.sketchRefs
              ? (payload.sketchRefs as Prisma.InputJsonValue)
              : Prisma.DbNull,
            explanation: payload.explanation ?? null,
            scoringVersion: payload.scoringVersion,
            scoreResult: payload.scoreResult
              ? (payload.scoreResult as Prisma.InputJsonValue)
              : Prisma.DbNull,
          },
        });
      });
    let attempt;
    try {
      attempt = await appendOnce();
    } catch (error) {
      // 步内序号唯一约束竞态：整体重试一次（与工件保存同模式）。
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }
      attempt = await appendOnce();
    }

    return NextResponse.json({ attempt }, { status: 201 });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (isDatabaseConnectivityError(error)) {
      return createDatabaseUnavailableResponse();
    }
    return NextResponse.json({ error: '暂时无法保存提交' }, { status: 500 });
  }
}
