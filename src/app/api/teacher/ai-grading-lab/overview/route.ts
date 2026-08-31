import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { readTeacherAiGradingLabConfig } from '@/lib/data-governance/teacher-ai-grading-lab-contracts';
import { createFileSystemTeacherAiGradingLabDatasetStore } from '@/lib/data-governance/teacher-ai-grading-lab-dataset-store';
import { getTeacherAiGradingLabOverview, type TeacherAiGradingLabOverview } from '@/lib/data-governance/teacher-ai-grading-lab-overview';
import { createPrismaClient } from '@/lib/prisma-client';

export const dynamic = 'force-dynamic';

type Session = { user?: { id?: string; role?: string } } | null;
interface Dependencies {
  getSession(): Promise<Session>;
  readConfig(): { dataRoot: string; ownerTeacherUserId: string };
  loadOverview(input: { dataRoot: string; ownerTeacherUserId: string }): Promise<TeacherAiGradingLabOverview>;
}

export function createTeacherAiGradingLabOverviewHandler(dependencies: Dependencies) {
  return async function GET() {
    const session = await dependencies.getSession();
    if (!session?.user?.id) return failure('UNAUTHENTICATED', 401);
    let config: { dataRoot: string; ownerTeacherUserId: string };
    try { config = dependencies.readConfig(); } catch { return failure('LAB_UNAVAILABLE', 503); }
    if (session.user.role !== 'TEACHER' || session.user.id !== config.ownerTeacherUserId) return failure('FORBIDDEN', 403);
    try { return NextResponse.json(await dependencies.loadOverview(config)); } catch { return failure('LAB_UNAVAILABLE', 503); }
  };
}

export const GET = createTeacherAiGradingLabOverviewHandler({
  getSession: getServerAuthSession,
  readConfig: () => readTeacherAiGradingLabConfig(process.env),
  async loadOverview(config) {
    const db = createPrismaClient({ log: ['warn', 'error'] });
    try { return await getTeacherAiGradingLabOverview({ db, datasetStore: createFileSystemTeacherAiGradingLabDatasetStore(config) }); }
    finally { await db.$disconnect(); }
  },
});

function failure(code: string, status: number) { return NextResponse.json({ error: { code } }, { status }); }
