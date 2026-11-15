import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerAuthSession } from '@/lib/auth';
import { vesselReportView } from '@/features/ilab/course-artifact-service';
import { vesselEvidenceErrorResponse } from '@/features/ilab/course-evidence-api';
import { IlabServiceError } from '@/features/ilab/run-lock';

export const dynamic = 'force-dynamic';

export async function GET(request:NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id || !['TEACHER','ADMIN'].includes(session.user.role)) throw new IlabServiceError('请使用教师身份查看实验复核。',403);
    const classes = await prisma.class.findMany({where:session.user.role === 'ADMIN' ? {} : {teacherId:session.user.id},select:{id:true,name:true},orderBy:{name:'asc'}});
    const query = request.nextUrl.searchParams;
    const classId = query.get('classId');
    const status = query.get('status');
    const courseKey = query.get('courseKey');
    const cursor = query.get('cursor');
    if (classId && !classes.some((item)=>item.id === classId)) throw new IlabServiceError('班级不存在。',404);
    const where:Prisma.VirtualSimulationReportWhereInput = {
      clientRef:{not:null},
      ...(session.user.role === 'ADMIN' ? {} : {OR:[{classId:{in:classes.map((item)=>item.id)}},{reviewerId:session.user.id}]}),
      ...(classId ? {classId} : {}),...(status ? {status} : {}),...(courseKey ? {experimentKey:courseKey} : {}),
    };
    const rows = await prisma.virtualSimulationReport.findMany({
      where,orderBy:[{createdAt:'desc'},{id:'desc'}],take:51,
      ...(cursor ? {cursor:{id:cursor},skip:1} : {}),include:{user:{select:{name:true}}},
    });
    const page = rows.slice(0,50);
    return NextResponse.json({classes,reports:page.map((row)=>({...vesselReportView(row),studentName:row.user.name,classId:row.classId})),
      nextCursor:rows.length > 50 ? page.at(-1)!.id : null});
  } catch (error) { return vesselEvidenceErrorResponse(error); }
}
