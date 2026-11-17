import { NextResponse } from 'next/server';
import { readVesselEvidenceBytes, readVesselEvidenceJson, requireVesselEvidenceAccount, vesselEvidenceErrorResponse } from '@/features/ilab/course-evidence-api';
import { vesselTraceChunkSchema, type VesselTraceChunk } from '@/features/ilab/course-evidence-contract';
import { appendVesselEvidenceChunk, stageVesselEvidenceBytes } from '@/features/ilab/course-evidence-chunks';
import { IlabServiceError } from '@/features/ilab/run-lock';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ runRef: string }> }) {
  try {
    const userId = await requireVesselEvidenceAccount(request);
    const { runRef } = await context.params;
    if (new URL(request.url).searchParams.get('stage') === '1') {
      return NextResponse.json(await stageVesselEvidenceBytes(userId, runRef, await readVesselEvidenceBytes(request)));
    }
    const parsed = vesselTraceChunkSchema.safeParse(await readVesselEvidenceJson(request));
    if (!parsed.success || parsed.data.runRef !== runRef) throw new IlabServiceError('原始采样分块内容不完整。',400);
    const chunk = parsed.data as unknown as VesselTraceChunk;
    return NextResponse.json(await appendVesselEvidenceChunk(userId, chunk));
  } catch (error) { return vesselEvidenceErrorResponse(error); }
}
