import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  validateVesselReportDraft,
  vesselMaxPoints,
  type VesselReportDraftStep,
} from '@/resources/simulations/simulations/vessel-experiment';
import { findVesselExperiment } from '@/resources/simulations/simulations/vessel-experiments';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getServerAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: '请先登录。' }, { status: 401 });
  const experiment = findVesselExperiment(new URL(request.url).searchParams.get('experimentKey') ?? '');
  if (!experiment) return NextResponse.json({ error: '实验不存在。' }, { status: 404 });
  const reports = await prisma.virtualSimulationReport.findMany({
    where: { userId, experimentKey: experiment.key },
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
  const body = await request.json().catch(() => null) as {
    experimentKey?: unknown;
    reportHtml?: unknown;
    steps?: VesselReportDraftStep[];
  } | null;
  const experiment = findVesselExperiment(typeof body?.experimentKey === 'string' ? body.experimentKey : '');
  if (!experiment) return NextResponse.json({ error: '实验不存在。' }, { status: 404 });
  const draft = validateVesselReportDraft(experiment, {
    reportHtml: typeof body?.reportHtml === 'string' ? body.reportHtml : '',
    steps: Array.isArray(body?.steps) ? body.steps : [],
  });
  if (!draft.ok) return NextResponse.json({ error: draft.message }, { status: 422 });
  const saved = await prisma.virtualSimulationReport.create({
    data: {
      userId,
      experimentKey: experiment.key,
      title: experiment.title,
      score: draft.score,
      maxScore: vesselMaxPoints(experiment.steps),
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
