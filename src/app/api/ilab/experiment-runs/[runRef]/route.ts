import { NextResponse } from 'next/server';
import { readVesselEvidenceJson, requireVesselEvidenceAccount, vesselEvidenceErrorResponse } from '@/features/ilab/course-evidence-api';
import { vesselEvidenceCloseSchema } from '@/features/ilab/course-evidence-contract';
import { findOwnedVesselRun, vesselRunProgress } from '@/features/ilab/course-evidence-service';
import { closeVesselEvidenceRun, readVesselEvidenceChunk } from '@/features/ilab/course-evidence-chunks';
import { IlabServiceError } from '@/features/ilab/run-lock';
import { loadOwnedCourseRunRecovery } from '@/features/ilab/adapters/course-session-recovery';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Context = { params: Promise<{ runRef: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const userId = await requireVesselEvidenceAccount(request);
    const { runRef } = await context.params;
    if (new URL(request.url).searchParams.get('recovery') === '1') {
      return NextResponse.json(await loadOwnedCourseRunRecovery(userId, runRef));
    }
    const chunkParam = new URL(request.url).searchParams.get('chunkIndex');
    if (chunkParam !== null) {
      const chunkIndex = Number(chunkParam);
      if (!/^\d+$/.test(chunkParam) || !Number.isInteger(chunkIndex) || chunkIndex > 4096) {
        throw new IlabServiceError('采样分块序号无效。', 400);
      }
      return NextResponse.json(await readVesselEvidenceChunk(userId, runRef, chunkIndex));
    }
    return NextResponse.json(vesselRunProgress(await findOwnedVesselRun(userId, runRef)));
  } catch (error) { return vesselEvidenceErrorResponse(error); }
}

export async function PUT(request: Request, context: Context) {
  try {
    const userId = await requireVesselEvidenceAccount(request);
    const { runRef } = await context.params;
    const parsed = vesselEvidenceCloseSchema.safeParse(await readVesselEvidenceJson(request));
    if (!parsed.success) throw new IlabServiceError('运行结束状态内容不完整。',400);
    return NextResponse.json(await closeVesselEvidenceRun(userId, runRef, parsed.data));
  } catch (error) { return vesselEvidenceErrorResponse(error); }
}
