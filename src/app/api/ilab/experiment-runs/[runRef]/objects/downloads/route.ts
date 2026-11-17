import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readVesselEvidenceJson, requireVesselEvidenceAccount, vesselEvidenceErrorResponse } from '@/features/ilab/course-evidence-api';
import { authorizeOwnedVesselDownloads } from '@/features/ilab/adapters/course-evidence-oss';
import { simulationTraceReferencePattern } from '@/features/simulations/public-api';
import { IlabServiceError } from '@/features/ilab/service-error';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const schema = z.object({ references: z.array(z.string().startsWith('simulation-cas:oss:')
  .regex(simulationTraceReferencePattern)).min(1).max(32) });

export async function POST(request: Request, context: { params: Promise<{ runRef: string }> }) {
  try {
    const userId = await requireVesselEvidenceAccount(request);
    const { runRef } = await context.params;
    const parsed = schema.safeParse(await readVesselEvidenceJson(request));
    if (!parsed.success) throw new IlabServiceError('下载对象引用无效。', 400);
    return NextResponse.json(await authorizeOwnedVesselDownloads(userId, runRef, parsed.data.references),
      { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return vesselEvidenceErrorResponse(error); }
}
