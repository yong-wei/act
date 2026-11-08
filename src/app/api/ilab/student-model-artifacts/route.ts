/**
 * 学生辨识工件 API（issue-2152-p1 阶段 1）：保存与本人列表。
 *
 * 合同：会话鉴权；contentHash 服务端权威；同 lineage 版本只增不改。
 */
import { NextRequest, NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import { studentModelSaveSchema } from '@/lib/student-model-artifact-contract';
import { studentModelContentHash } from '@/lib/student-model-artifact-contract/server-hash';
import { createDatabaseUnavailableResponse, isDatabaseConnectivityError } from '@/lib/service-availability';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '请先登录后再查看模型记录' }, { status: 401 });
    }
    const experimentKey = request.nextUrl.searchParams.get('experimentKey');
    const rows = await prisma.studentModelArtifact.findMany({
      where: {
        userId: session.user.id,
        ...(experimentKey ? { experimentKey } : {}),
      },
      select: {
        id: true,
        experimentKey: true,
        lineageKey: true,
        version: true,
        structure: true,
        identification: true,
        frozenAt: true,
      },
      orderBy: [{ lineageKey: 'asc' }, { version: 'desc' }],
      take: 200,
    });
    return NextResponse.json({
      artifacts: rows.map((row) => ({
        id: row.id,
        experimentKey: row.experimentKey,
        lineageKey: row.lineageKey,
        version: row.version,
        kind: (row.structure as { kind?: string }).kind ?? null,
        identifiedOk: (row.identification as { identifiedOk?: boolean }).identifiedOk ?? null,
        frozenAt: row.frozenAt,
      })),
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (isDatabaseConnectivityError(error)) {
      return createDatabaseUnavailableResponse();
    }
    return NextResponse.json({ error: '暂时无法读取模型记录' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '请先登录后再保存模型' }, { status: 401 });
    }
    const body: unknown = await request.json().catch(() => null);
    const parsed = studentModelSaveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: '模型记录内容不完整或含无效数值', issues: parsed.error.issues.length },
        { status: 400 },
      );
    }
    const payload = parsed.data;
    const contentHash = studentModelContentHash(payload);

    // 同 lineage 版本递增（事务内取 max+1）；并发保存同一 lineage 时版本
    // 唯一约束兜底——冲突则重读最新版本后整体重试一次（design §5），
    // 保证两个并发辨识结果都持久化（version 相邻两行）。
    const saveOnce = () =>
      prisma.$transaction(async (tx) => {
        const latest = await tx.studentModelArtifact.findFirst({
          where: {
            userId: session.user.id,
            experimentKey: payload.experimentKey,
            lineageKey: payload.lineageKey,
          },
          orderBy: { version: 'desc' },
          select: { version: true },
        });
        return tx.studentModelArtifact.create({
          data: {
            userId: session.user.id,
            experimentKey: payload.experimentKey,
            lineageKey: payload.lineageKey,
            version: (latest?.version ?? 0) + 1,
            structure: payload.structure,
            ioContract: payload.ioContract,
            operatingPoint: payload.operatingPoint,
            identification: payload.identification,
            trainingRuns: payload.trainingRuns,
            validationRuns: payload.validationRuns,
            sampleDt: payload.sampleDt,
            contentHash,
          },
          select: {
            id: true,
            experimentKey: true,
            lineageKey: true,
            version: true,
            contentHash: true,
            frozenAt: true,
          },
        });
      });
    let created: {
      id: string;
      experimentKey: string;
      lineageKey: string;
      version: number;
      contentHash: string;
      frozenAt: Date;
    };
    try {
      created = await saveOnce();
    } catch (error) {
      // Prisma P2002 = 唯一约束冲突（并发版本竞态）：整体重试一次。
      if ((error as { code?: string }).code !== 'P2002') {
        throw error;
      }
      created = await saveOnce();
    }

    return NextResponse.json({ artifact: created }, { status: 201 });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (isDatabaseConnectivityError(error)) {
      return createDatabaseUnavailableResponse();
    }
    return NextResponse.json({ error: '暂时无法保存模型记录' }, { status: 500 });
  }
}
