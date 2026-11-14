import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { readVesselEvidenceJson, vesselEvidenceErrorResponse } from '@/features/ilab/course-evidence-api';
import { readVesselReportEvidence, readVesselReportWork, reviewVesselCourseReport } from '@/features/ilab/course-report-review';
import { vesselReportReviewSchema } from '@/features/ilab/course-report-review-contract';
import { IlabServiceError } from '@/features/ilab/run-lock';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Context = {params:Promise<{id:string}>};

export async function GET(request:NextRequest, context:Context) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) throw new IlabServiceError('请登录后查看实验报告。',401);
    const {id} = await context.params;
    const kind = request.nextUrl.searchParams.get('kind');
    const workId = request.nextUrl.searchParams.get('workId');
    if (kind && workId) return NextResponse.json(await readVesselReportWork(session.user,id,kind,workId));
    return NextResponse.json(await readVesselReportEvidence(session.user,id));
  } catch (error) { return vesselEvidenceErrorResponse(error); }
}

export async function PATCH(request:Request, context:Context) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) throw new IlabServiceError('请登录后复核实验报告。',401);
    if (request.headers.get('x-act-preview') === '1') throw new IlabServiceError('当前为预览模式。',403);
    const {id} = await context.params;
    const parsed = vesselReportReviewSchema.safeParse(await readVesselEvidenceJson(request));
    if (!parsed.success) throw new IlabServiceError('评分或复核内容不完整。',400);
    return NextResponse.json({report:await reviewVesselCourseReport(session.user,id,parsed.data)});
  } catch (error) { return vesselEvidenceErrorResponse(error); }
}
