import { NextResponse } from 'next/server';
import { readVesselEvidenceJson, requireVesselEvidenceAccount, vesselEvidenceErrorResponse, vesselEvidenceJsonResponse } from '@/features/ilab/course-evidence-api';
import { vesselEvidenceCloseSchema, vesselEvidenceDirectCloseSchema } from '@/features/ilab/course-evidence-contract';
import { commitOwnedVesselUpload } from '@/features/ilab/adapters/course-evidence-oss';
import { findOwnedVesselRun, vesselRunProgress } from '@/features/ilab/course-evidence-service';
import { closeVesselEvidenceRun, readVesselEvidenceChunk } from '@/features/ilab/course-evidence-chunks';
import { IlabServiceError } from '@/features/ilab/run-lock';
import { loadOwnedCourseRunRecovery } from '@/features/ilab/adapters/course-session-recovery';
import { VESSEL_TRACE_COLUMNS } from '@/features/simulations/public-api';
import { recordSimulationConfirmation } from '@/lib/simulation-admission-pressure';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Context = { params: Promise<{ runRef: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const userId = await requireVesselEvidenceAccount(request);
    const { runRef } = await context.params;
    const params = new URL(request.url).searchParams;
    if (params.get('recovery') === '1') {
      return await vesselEvidenceJsonResponse(request, await loadOwnedCourseRunRecovery(userId, runRef,
        params.get('format') === 'references', params.get('traceEncoding') === VESSEL_TRACE_COLUMNS));
    }
    const chunkParam = params.get('chunkIndex');
    if (chunkParam !== null) {
      const chunkIndex = Number(chunkParam);
      if (!/^\d+$/.test(chunkParam) || !Number.isInteger(chunkIndex) || chunkIndex > 4096) {
        throw new IlabServiceError('采样分块序号无效。', 400);
      }
      return await vesselEvidenceJsonResponse(request, await readVesselEvidenceChunk(userId, runRef, chunkIndex));
    }
    return NextResponse.json(vesselRunProgress(await findOwnedVesselRun(userId, runRef)));
  } catch (error) { return vesselEvidenceErrorResponse(error); }
}

export async function PUT(request: Request, context: Context) {
  const started = performance.now();
  const deferVerification = new URL(request.url).searchParams.get('defer') === '1';
  try {
    const userId = await requireVesselEvidenceAccount(request);
    const { runRef } = await context.params;
    const body = await readVesselEvidenceJson(request);
    if (body && typeof body === 'object' && 'checkpointReference' in body) {
      const direct = vesselEvidenceDirectCloseSchema.safeParse(body);
      if (!direct.success) throw new IlabServiceError('运行保存描述内容不完整。', 400);
      const result = await commitOwnedVesselUpload(userId, runRef, direct.data, deferVerification);
      if (deferVerification) recordSimulationConfirmation(performance.now() - started, false);
      return NextResponse.json(result);
    }
    const parsed = vesselEvidenceCloseSchema.safeParse(body);
    if (!parsed.success) throw new IlabServiceError('运行结束状态内容不完整。',400);
    return NextResponse.json(await closeVesselEvidenceRun(userId, runRef, parsed.data, deferVerification));
  } catch (error) {
    const response = vesselEvidenceErrorResponse(error);
    if (deferVerification && response.status >= 500) recordSimulationConfirmation(performance.now() - started, true);
    return response;
  }
}
