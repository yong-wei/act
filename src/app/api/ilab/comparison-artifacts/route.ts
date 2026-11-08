/**
 * 对照工件 API（issue-2152-p1 阶段 1）：保存与本人列表。
 *
 * 合同：studentModelId 必须属于本人（跨用户引用 404，不泄露存在性）；
 * mode 为 issue-2148 三模式之一。
 */
import { NextRequest, NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import { comparisonSaveSchema } from '@/lib/student-model-artifact-contract';
import { createDatabaseUnavailableResponse, isDatabaseConnectivityError } from '@/lib/service-availability';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '请先登录后再查看对照记录' }, { status: 401 });
    }
    const experimentKey = request.nextUrl.searchParams.get('experimentKey');
    const rows = await prisma.comparisonArtifact.findMany({
      where: {
        userId: session.user.id,
        ...(experimentKey ? { experimentKey } : {}),
      },
      select: {
        id: true,
        experimentKey: true,
        stepKey: true,
        mode: true,
        studentModelId: true,
        physicalRunRef: true,
        inputSource: true,
        metrics: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return NextResponse.json({ comparisons: rows });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (isDatabaseConnectivityError(error)) {
      return createDatabaseUnavailableResponse();
    }
    return NextResponse.json({ error: '暂时无法读取对照记录' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '请先登录后再保存对照记录' }, { status: 401 });
    }
    const body: unknown = await request.json().catch(() => null);
    const parsed = comparisonSaveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: '对照记录内容不完整或含无效数值', issues: parsed.error.issues.length },
        { status: 400 },
      );
    }
    const payload = parsed.data;
    // 归属校验：模型工件必须属于本人。
    const ownedModel = await prisma.studentModelArtifact.findFirst({
      where: { id: payload.studentModelId, userId: session.user.id },
      select: { id: true },
    });
    if (!ownedModel) {
      return NextResponse.json({ error: '未找到关联的学生模型' }, { status: 404 });
    }
    const created = await prisma.comparisonArtifact.create({
      data: {
        userId: session.user.id,
        experimentKey: payload.experimentKey,
        stepKey: payload.stepKey,
        mode: payload.mode,
        studentModelId: payload.studentModelId,
        physicalRunRef: payload.physicalRunRef,
        controllerArtifactHash: payload.controllerArtifactHash ?? null,
        inputSource: payload.inputSource,
        alignmentWindow: payload.alignmentWindow,
        factorFlags: payload.factorFlags,
        metrics: payload.metrics,
        curveRefs: payload.curveRefs,
      },
      select: {
        id: true,
        experimentKey: true,
        stepKey: true,
        mode: true,
        studentModelId: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ comparison: created }, { status: 201 });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (isDatabaseConnectivityError(error)) {
      return createDatabaseUnavailableResponse();
    }
    return NextResponse.json({ error: '暂时无法保存对照记录' }, { status: 500 });
  }
}
