import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readVesselEvidenceJson, requireVesselEvidenceAccount, vesselEvidenceErrorResponse } from '@/features/ilab/course-evidence-api';
import { vesselCourseArtifactSchema } from '@/features/ilab/course-artifact-contract';
import { saveVesselCourseArtifact, vesselReportView } from '@/features/ilab/course-artifact-service';
import { IlabServiceError } from '@/features/ilab/run-lock';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const userId = await requireVesselEvidenceAccount(request);
    const clientRef = request.nextUrl.searchParams.get('clientRef');
    const courseKey = request.nextUrl.searchParams.get('courseKey');
    const reports = await prisma.virtualSimulationReport.findMany({
      where:{userId,clientRef:clientRef ? clientRef : {not:null},...(courseKey ? {experimentKey:courseKey} : {})},orderBy:{updatedAt:'desc'},take:100,
    });
    return NextResponse.json({reports:reports.map(vesselReportView)});
  } catch (error) { return vesselEvidenceErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const userId = await requireVesselEvidenceAccount(request);
    const parsed = vesselCourseArtifactSchema.safeParse(await readVesselEvidenceJson(request));
    if (!parsed.success) throw new IlabServiceError('实验工件内容不完整或含无效数值。',400);
    return NextResponse.json(await saveVesselCourseArtifact(userId,parsed.data));
  } catch (error) { return vesselEvidenceErrorResponse(error); }
}
