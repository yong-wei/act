import { createHash } from 'node:crypto';

import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { createFileSystemTeacherAiGradingLabArtifactStore } from '@/lib/data-governance/teacher-ai-grading-lab-artifact-store';
import { readTeacherAiGradingLabConfig } from '@/lib/data-governance/teacher-ai-grading-lab-contracts';
import { createPrismaClient } from '@/lib/prisma-client';

export const dynamic = 'force-dynamic';

type Session = { user?: { id?: string; role?: string } } | null;

interface Dependencies {
  getSession(): Promise<Session>;
  readConfig(): { dataRoot: string; ownerTeacherUserId: string };
  loadPdf(input: { dataRoot: string; derivativeId: string }): Promise<Buffer | null>;
}

export function createTeacherAiGradingLabPdfHandler(dependencies: Dependencies) {
  return async function GET(_request: Request, context: { params: Promise<{ derivativeId: string }> }) {
    const session = await dependencies.getSession();
    if (!session?.user?.id) return failure('UNAUTHENTICATED', 401);
    let config: { dataRoot: string; ownerTeacherUserId: string };
    try { config = dependencies.readConfig(); } catch { return failure('LAB_UNAVAILABLE', 503); }
    if (session.user.role !== 'TEACHER' || session.user.id !== config.ownerTeacherUserId) return failure('FORBIDDEN', 403);
    const { derivativeId } = await context.params;
    if (!derivativeId || derivativeId.length > 256) return failure('NOT_FOUND', 404);
    try {
      const bytes = await dependencies.loadPdf({ dataRoot: config.dataRoot, derivativeId });
      if (!bytes) return failure('NOT_FOUND', 404);
      return new NextResponse(bytes, { headers: { 'content-type': 'application/pdf', 'cache-control': 'private, no-store' } });
    } catch { return failure('LAB_UNAVAILABLE', 503); }
  };
}

export const GET = createTeacherAiGradingLabPdfHandler({
  getSession: getServerAuthSession,
  readConfig: () => readTeacherAiGradingLabConfig(process.env),
  async loadPdf({ dataRoot, derivativeId }) {
    const db = createPrismaClient({ log: ['warn', 'error'] });
    try {
      const verification = await db.teacherAiGradingPdfVerification.findUnique({
        where: { derivativeId },
        select: { acceptance: { select: { state: true } }, derivative: { select: { contentChecksum: true } } },
      });
      if (!verification || verification.acceptance.state !== 'CONSUMED') return null;
      const bytes = await createFileSystemTeacherAiGradingLabArtifactStore({ artifactRoot: `${dataRoot}/artifacts` })
        .read(`teacher-ai-grading/pdf-derivatives/${encodeURIComponent(derivativeId)}.pdf`);
      return checksum(bytes) === verification.derivative.contentChecksum ? bytes : null;
    } finally { await db.$disconnect(); }
  },
});

function checksum(bytes: Uint8Array) { return `sha256:${createHash('sha256').update(bytes).digest('hex')}`; }
function failure(code: string, status: number) { return NextResponse.json({ error: { code } }, { status }); }
