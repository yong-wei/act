import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { VESSEL_EXPERIMENTS } from '@/resources/simulations/simulations/vessel-experiments';

export const dynamic = 'force-dynamic';

const VESSEL_KEYS = VESSEL_EXPERIMENTS.map((experiment) => experiment.key);

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: '请先登录。' }, { status: 401 });
  const { id } = await context.params;
  if (!/^c[a-z0-9]{20,32}$/i.test(id)) {
    return NextResponse.json({ error: '找不到这份报告。' }, { status: 404 });
  }
  const report = await prisma.virtualSimulationReport.findFirst({
    where: { id, userId, experimentKey: { in: VESSEL_KEYS } },
    select: { reportHtml: true },
  });
  if (!report) return NextResponse.json({ error: '找不到这份报告。' }, { status: 404 });
  return NextResponse.json({ reportHtml: report.reportHtml });
}
