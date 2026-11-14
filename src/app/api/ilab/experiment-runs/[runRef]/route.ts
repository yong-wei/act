import { NextResponse } from 'next/server';
import { readVesselEvidenceJson, requireVesselEvidenceAccount, vesselEvidenceErrorResponse } from '@/features/ilab/course-evidence-api';
import { vesselEvidenceCloseSchema } from '@/features/ilab/course-evidence-contract';
import { findOwnedVesselRun, vesselRunProgress } from '@/features/ilab/course-evidence-service';
import { closeVesselEvidenceRun } from '@/features/ilab/course-evidence-chunks';
import { IlabServiceError } from '@/features/ilab/run-lock';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Context = { params: Promise<{ runRef: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const userId = await requireVesselEvidenceAccount(request);
    const { runRef } = await context.params;
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
