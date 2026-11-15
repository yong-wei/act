import { NextResponse } from 'next/server';
import { readVesselEvidenceJson,requireVesselEvidenceAccount,vesselEvidenceErrorResponse } from '@/features/ilab/course-evidence-api';
import { vesselEvidenceOpeningSchema,type VesselEvidenceOpening } from '@/features/ilab/course-evidence-contract';
import { openVesselEvidenceRun } from '@/features/ilab/course-evidence-service';
import { IlabServiceError } from '@/features/ilab/run-lock';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const userId = await requireVesselEvidenceAccount(request);
    const parsed = vesselEvidenceOpeningSchema.safeParse(await readVesselEvidenceJson(request));
    if (!parsed.success) throw new IlabServiceError('实验初始记录内容不完整。',400);
    return NextResponse.json(await openVesselEvidenceRun(userId,parsed.data as unknown as VesselEvidenceOpening));
  } catch (error) { return vesselEvidenceErrorResponse(error); }
}
