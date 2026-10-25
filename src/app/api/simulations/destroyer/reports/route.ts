import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  DESTROYER_EXPERIMENT_KEY,
  DESTROYER_EXPERIMENT_TITLE,
  DESTROYER_MAX_POINTS,
  validateDestroyerReportDraft,
  type DestroyerReportDraftStep,
} from '@/resources/simulations/simulations/destroyer-experiment';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: '请先登录。' }, { status: 401 });
  const reports = await prisma.virtualSimulationReport.findMany({
    where: { userId, experimentKey: DESTROYER_EXPERIMENT_KEY },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { id: true, score: true, maxScore: true, createdAt: true },
  });
  return NextResponse.json({
    reports: reports.map((report) => ({
      id: report.id,
      score: report.score,
      maxScore: report.maxScore,
      createdAt: report.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: '请先登录。' }, { status: 401 });
  const body = await request.json().catch(() => null) as { reportHtml?: unknown; steps?: DestroyerReportDraftStep[] } | null;
  const draft = validateDestroyerReportDraft({
    reportHtml: typeof body?.reportHtml === 'string' ? body.reportHtml : '',
    steps: Array.isArray(body?.steps) ? body.steps : [],
  });
  if (!draft.ok) return NextResponse.json({ error: draft.message }, { status: 422 });
  const saved = await prisma.virtualSimulationReport.create({
    data: {
      userId,
      experimentKey: DESTROYER_EXPERIMENT_KEY,
      title: DESTROYER_EXPERIMENT_TITLE,
      score: draft.score,
      maxScore: DESTROYER_MAX_POINTS,
      reportHtml: typeof body?.reportHtml === 'string' ? body.reportHtml : '',
      stepScores: draft.steps as unknown as Prisma.InputJsonValue,
    },
    select: { id: true, score: true, maxScore: true, createdAt: true },
  });
  return NextResponse.json({
    id: saved.id,
    score: saved.score,
    maxScore: saved.maxScore,
    createdAt: saved.createdAt.toISOString(),
  });
}
