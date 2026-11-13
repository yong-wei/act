/**
 * 生效运行信封 API（issue-2152 阶段 2a）：开启/收口（runRef 全局唯一）
 * 与本人列表。
 *
 * 合同：编辑态参数不等于生效配置——信封以 firstSampleReceipt（首采样
 * 回执哈希）绑定实际运行；收口仅允许补充结束字段，不覆写开启态配置。
 * 归属以「创建竞跑 + updateMany 绑 userId」原子保证：并发同 runRef 的
 * 后到者只能更新自己的行，否则 409。
 */
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import { appliedRunEnvelopeSchema } from '@/lib/student-model-artifact-contract';
import { createDatabaseUnavailableResponse, isDatabaseConnectivityError } from '@/lib/service-availability';

export const dynamic = 'force-dynamic';

type EnvelopeRow = {
  id: string;
  userId: string;
  experimentKey: string;
  runRef: string;
  stepKey: string | null;
  courseVersion: string;
  modelId: string;
  modelVersion: string;
  parameterBundleHash: string | null;
  environmentVersion: string | null;
  sensorVersion: string | null;
  seed: string | null;
  substreamIds: Prisma.JsonValue | null;
  initialState: Prisma.JsonValue;
  appliedFactorMask: Prisma.JsonValue;
  controllerArtifactHash: string | null;
  simulationStartMs: bigint;
  simulationEndMs: bigint | null;
  terminationReason: string | null;
  quality: Prisma.JsonValue;
  firstSampleReceipt: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** BigInt 毫秒转 Number（毫秒量级远小于 2^53，无损）。 */
function envelopeToJson(row: EnvelopeRow) {
  return {
    id: row.id,
    experimentKey: row.experimentKey,
    runRef: row.runRef,
    stepKey: row.stepKey,
    courseVersion: row.courseVersion,
    modelId: row.modelId,
    modelVersion: row.modelVersion,
    parameterBundleHash: row.parameterBundleHash,
    environmentVersion: row.environmentVersion,
    sensorVersion: row.sensorVersion,
    seed: row.seed,
    substreamIds: row.substreamIds,
    initialState: row.initialState,
    appliedFactorMask: row.appliedFactorMask,
    controllerArtifactHash: row.controllerArtifactHash,
    simulationStartMs: Number(row.simulationStartMs),
    simulationEndMs: row.simulationEndMs === null ? null : Number(row.simulationEndMs),
    terminationReason: row.terminationReason,
    quality: row.quality,
    firstSampleReceipt: row.firstSampleReceipt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

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
    return NextResponse.json({ envelopes: rows.map(envelopeToJson) });
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
    const closing = e.simulationEndMs !== undefined && e.simulationEndMs !== null;

    // 创建竞跑：runRef 唯一约束决定谁是首建者；P2002 = 已存在（进入更新路径）。
    let created: EnvelopeRow | null = null;
    try {
      created = await prisma.appliedRunEnvelope.create({
        data: {
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
          seed: e.seed ?? null,
          substreamIds: e.substreamIds ? (e.substreamIds as Prisma.InputJsonValue) : Prisma.DbNull,
          initialState: e.initialState as Prisma.InputJsonValue,
          appliedFactorMask: e.appliedFactorMask as Prisma.InputJsonValue,
          controllerArtifactHash: e.controllerArtifactHash ?? null,
          simulationStartMs: BigInt(Math.trunc(e.simulationStartMs)),
          simulationEndMs: closing ? BigInt(Math.trunc(e.simulationEndMs as number)) : null,
          terminationReason: e.terminationReason ?? null,
          quality: (e.quality ?? {}) as Prisma.InputJsonValue,
          firstSampleReceipt: e.firstSampleReceipt ?? null,
        },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }
    }

    if (created) {
      return NextResponse.json({ envelope: envelopeToJson(created) }, { status: 201 });
    }

    // 更新路径（runRef 已存在）：归属原子绑定在写入条件里——他人行 0 命中。
    const existing = await prisma.appliedRunEnvelope.findUnique({
      where: { runRef: e.runRef },
      select: { userId: true, simulationStartMs: true },
    });
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: '运行标识已被占用，请重新开始实验' }, { status: 409 });
    }
    // 收口时间对账已持久化的开始时刻（载荷内自洽不够）。
    if (e.simulationStartMs !== Number(existing.simulationStartMs)) {
      return NextResponse.json({ error: '开始时刻与已保存的运行记录不一致' }, { status: 400 });
    }
    if (closing && (e.simulationEndMs as number) < Number(existing.simulationStartMs)) {
      return NextResponse.json({ error: '结束时刻不得早于开始时刻' }, { status: 400 });
    }
    // updateMany 绑 userId：读取与写入之间的归属竞态由条件原子兜底。
    const updated = await prisma.appliedRunEnvelope.updateMany({
      where: { runRef: e.runRef, userId: session.user.id },
      data: {
        ...(closing ? { simulationEndMs: BigInt(Math.trunc(e.simulationEndMs as number)) } : {}),
        ...(e.terminationReason !== undefined ? { terminationReason: e.terminationReason } : {}),
        ...(e.quality !== undefined ? { quality: e.quality as Prisma.InputJsonValue } : {}),
        ...(e.firstSampleReceipt !== undefined ? { firstSampleReceipt: e.firstSampleReceipt } : {}),
      },
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: '运行标识已被占用，请重新开始实验' }, { status: 409 });
    }
    const envelope = await prisma.appliedRunEnvelope.findUnique({ where: { runRef: e.runRef } });
    return NextResponse.json({ envelope: envelope ? envelopeToJson(envelope) : null }, { status: 200 });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (isDatabaseConnectivityError(error)) {
      return createDatabaseUnavailableResponse();
    }
    return NextResponse.json({ error: '暂时无法保存运行记录' }, { status: 500 });
  }
}
