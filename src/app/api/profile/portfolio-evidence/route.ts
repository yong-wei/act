import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import {
  buildClassroomPortfolioWorks,
  buildEthicsPortfolioCases,
  buildSimulationPortfolioDesigns,
  getPortfolioEvidenceSourceState,
  type ClassroomPortfolioWork,
  type EthicsPortfolioCase,
  type PortfolioEvidenceSource,
  type SimulationPortfolioDesign,
} from '@/lib/data-governance/profile-portfolio-evidence';

export const dynamic = 'force-dynamic';

const SOURCE_READ_LIMIT = 20;

async function readSource<T>(
  read: () => Promise<{ total: number; rows: T[] }>,
): Promise<{ total: number | null; rows: T[] }> {
  try {
    return await read();
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return { total: null, rows: [] };
  }
}

function toResponse<TSource, TItem>(
  source: { total: number | null; rows: TSource[] },
  project: (rows: TSource[]) => TItem[],
): PortfolioEvidenceSource<TItem> {
  return {
    state: getPortfolioEvidenceSourceState(source.total),
    total: source.total,
    items: project(source.rows),
  };
}

export async function GET() {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    if (session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: '仅学生可以查看学习档案证据' }, { status: 403 });
    }

    const userId = session.user.id;
    const [classroom, simulations, ethics] = await Promise.all([
      readSource(async () => {
        const [total, rows] = await Promise.all([
          prisma.studentStepResponse.count({ where: { userId } }),
          prisma.studentStepResponse.findMany({
            where: { userId },
            orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
            take: SOURCE_READ_LIMIT,
            select: {
              id: true,
              lessonKey: true,
              stepId: true,
              submittedAt: true,
              responseData: true,
              session: {
                select: {
                  plan: { select: { title: true } },
                },
              },
            },
          }),
        ]);
        return { total, rows };
      }),
      readSource(async () => {
        const [total, rows] = await Promise.all([
          prisma.simulationLog.count({ where: { userId } }),
          prisma.simulationLog.findMany({
            where: { userId },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: SOURCE_READ_LIMIT,
            select: {
              id: true,
              controlMode: true,
              inputParams: true,
              score: true,
              createdAt: true,
            },
          }),
        ]);
        return { total, rows };
      }),
      readSource(async () => {
        const [total, rows] = await Promise.all([
          prisma.ethicalLog.count({ where: { userId } }),
          prisma.ethicalLog.findMany({
            where: { userId },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: SOURCE_READ_LIMIT,
            select: {
              id: true,
              violationType: true,
              aiCritique: true,
              studentJustification: true,
              isResolved: true,
              createdAt: true,
            },
          }),
        ]);
        return { total, rows };
      }),
    ]);

    const response: {
      classroom: PortfolioEvidenceSource<ClassroomPortfolioWork>;
      simulations: PortfolioEvidenceSource<SimulationPortfolioDesign>;
      ethics: PortfolioEvidenceSource<EthicsPortfolioCase>;
    } = {
      classroom: toResponse(classroom, buildClassroomPortfolioWorks),
      simulations: toResponse(simulations, buildSimulationPortfolioDesigns),
      ethics: toResponse(ethics, buildEthicsPortfolioCases),
    };

    return NextResponse.json(response);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('读取学习档案证据失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
