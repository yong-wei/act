/**
 * 生效运行信封 API（issue-2152 阶段 2a）：开启/收口（upsert by runRef）
 * 与本人列表。
 *
 * 合同：编辑态参数不等于生效配置——信封以 firstSampleReceipt（首采样
 * 回执哈希）绑定实际运行；收口仅允许补充结束字段，不覆写开启态配置。
 */
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import { appliedRunEnvelopeSchema } from '@/lib/student-model-artifact-contract';
import { createDatabaseUnavailableResponse, isDatabaseConnectivityError } from '@/lib/service-availability';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '请先登录后再查看运行记录' }, { status: 401 });
    }
    const experimentKey = request.nextUrl.searchParams.get('experimentKey');
    const rows = await prisma.appliedRunEnvelope.findMany({
      where: {
        userId: session.user.id,
        ...(experimentKey ? { experimentKey } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return NextResponse.json({ envelopes: rows });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (isDatabaseConnectivityError(error)) {
      return createDatabaseUnavailableResponse();
    }
    return NextResponse.json({ error: '暂时无法读取运行记录' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '请先登录后再保存运行记录' }, { status: 401 });
    }
    const body: unknown = await request.json().catch(() => null);
    const parsed = appliedRunEnvelopeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: '运行记录内容不完整或含无效数值', issues: parsed.error.issues.length },
        { status: 400 },
      );
    }
    const e = parsed.data;
    const seed = e.seed !== undefined && e.seed !== null ? BigInt(e.seed) : null;
    const closing =
      e.simulationEndMs !== undefined && e.simulationEndMs !== null;

    // 归属预检：runRef 全局唯一，upsert 前必须确认不存在他人信封，
    // 否则会被更新分支收口他人运行。
    const existing = await prisma.appliedRunEnvelope.findUnique({
      where: { runRef: e.runRef },
      select: { userId: true },
    });
    if (existing && existing.userId !== session.user.id) {
      return NextResponse.json({ error: '运行标识已被占用，请重新开始实验' }, { status: 409 });
    }

    const envelope = await prisma.appliedRunEnvelope.upsert({
      where: { runRef: e.runRef },
      create: {
        userId: session.user.id,
        experimentKey: e.experimentKey,
        runRef: e.runRef,
        stepKey: e.stepKey ?? null,
        courseVersion: e.courseVersion,
        modelId: e.modelId,
        modelVersion: e.modelVersion,
        parameterBundleHash: e.parameterBundleHash ?? null,
        environmentVersion: e.environmentVersion ?? null,
        sensorVersion: e.sensorVersion ?? null,
        seed,
        substreamIds: e.substreamIds ? (e.substreamIds as Prisma.InputJsonValue) : Prisma.DbNull,
        initialState: e.initialState,
        appliedFactorMask: e.appliedFactorMask,
        controllerArtifactHash: e.controllerArtifactHash ?? null,
        simulationStartMs: BigInt(Math.trunc(e.simulationStartMs)),
        simulationEndMs: closing ? BigInt(Math.trunc(e.simulationEndMs as number)) : null,
        terminationReason: e.terminationReason ?? null,
        quality: e.quality ?? {},
        firstSampleReceipt: e.firstSampleReceipt ?? null,
      },
      update: {
        // 收口：只允许补充结束态字段；开启态配置（版本/种子/初态/因素）
        // 一经写入不覆写——生效配置不可变。
        ...(closing ? { simulationEndMs: BigInt(Math.trunc(e.simulationEndMs as number)) } : {}),
        ...(e.terminationReason !== undefined ? { terminationReason: e.terminationReason } : {}),
        ...(e.quality !== undefined ? { quality: e.quality } : {}),
        ...(e.firstSampleReceipt !== undefined ? { firstSampleReceipt: e.firstSampleReceipt } : {}),
      },
    });
    return NextResponse.json({ envelope }, { status: closing ? 200 : 201 });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      // runRef 撞车（他人已占用同 runRef）：不泄露存在性。
      return NextResponse.json({ error: '运行标识已被占用，请重新开始实验' }, { status: 409 });
    }
    if (isDatabaseConnectivityError(error)) {
      return createDatabaseUnavailableResponse();
    }
    return NextResponse.json({ error: '暂时无法保存运行记录' }, { status: 500 });
  }
}
