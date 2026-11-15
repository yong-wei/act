import { NextRequest, NextResponse } from 'next/server';

import { loadCourseSessionRecovery } from '@/features/ilab/adapters/course-session-recovery';
import { resolveCurrentActorContext } from '@/features/ilab/adapters/ilab-session-lifecycle';
import { readIlabGrantFromRequest } from '@/features/ilab/grant-cookie';
import { IlabServiceError, toIlabHttpError } from '@/features/ilab/run-lock';
import { findVesselCourse } from '@/resources/simulations/experiments/course-catalog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const courseKey = request.nextUrl.searchParams.get('courseKey')?.trim() || 'destroyer';
    const courseVersion = request.nextUrl.searchParams.get('courseVersion')?.trim() || undefined;
    const reportClientRef = request.nextUrl.searchParams.get('reportClientRef')?.trim() || undefined;
    const originId = request.nextUrl.searchParams.get('originId')?.trim() || undefined;
    const course = findVesselCourse(courseKey);
    if (!course) {
      throw new IlabServiceError('未知船舶课程标识。', 400);
    }
    const actor = await resolveCurrentActorContext(readIlabGrantFromRequest(request));
    if (!actor.userId) {
      return NextResponse.json({
        authenticated: false,
        userId: null,
        recovery: null,
      });
    }

    const recovery = await loadCourseSessionRecovery({
      userId: actor.userId,
      courseKey: course.key,
      courseVersion,
      reportClientRef,
      originId,
      deferTraceChunks: true,
    });
    return NextResponse.json({
      authenticated: true,
      userId: actor.userId,
      recovery,
    });
  } catch (error) {
    const httpError = toIlabHttpError(error);
    return NextResponse.json({ error: httpError.message }, { status: httpError.status });
  }
}
