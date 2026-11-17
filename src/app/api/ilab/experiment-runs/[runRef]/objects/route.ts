import { NextResponse } from 'next/server';
import { readVesselEvidenceJson, requireVesselEvidenceAccount, vesselEvidenceErrorResponse } from '@/features/ilab/course-evidence-api';
import { vesselEvidenceOssGrantSchema } from '@/features/ilab/course-evidence-contract';
import { authorizeOwnedVesselUploads } from '@/features/ilab/adapters/course-evidence-oss';
import { IlabServiceError } from '@/features/ilab/service-error';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ runRef: string }> }) {
  try {
    const userId = await requireVesselEvidenceAccount(request);
    const { runRef } = await context.params;
    const parsed = vesselEvidenceOssGrantSchema.safeParse(await readVesselEvidenceJson(request));
    if (!parsed.success) throw new IlabServiceError('上传对象描述内容不完整。', 400);
    return NextResponse.json(await authorizeOwnedVesselUploads(userId, runRef, parsed.data.objects),
      { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return vesselEvidenceErrorResponse(error); }
}
