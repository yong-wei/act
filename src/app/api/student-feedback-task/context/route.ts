import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import {
  buildFeedbackTaskContext,
  resolveVerifiedTeacherInterventionId,
} from '@/lib/student-feedback-task-contract';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ context: null }, { status: 401 });
    }

    const url = new URL(request.url);
    const query = {
      assignment: url.searchParams.get('assignment') ?? url.searchParams.get('q'),
      criterion: url.searchParams.get('criterion'),
      source: url.searchParams.get('source'),
      feedbackSource: url.searchParams.get('feedbackSource'),
      status: url.searchParams.get('status'),
      action: url.searchParams.get('action'),
      returnTo: url.searchParams.get('returnTo'),
      intent: url.searchParams.get('intent'),
      teacherInterventionId: url.searchParams.get('teacherInterventionId'),
    };
    const verifiedTeacherInterventionId = await resolveVerifiedTeacherInterventionId({
      db: prisma,
      userId: session.user.id,
      teacherInterventionId: query.teacherInterventionId,
      assignment: query.assignment,
    });

    return NextResponse.json({
      context: buildFeedbackTaskContext(query, { verifiedTeacherInterventionId }),
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[StudentFeedbackTaskContext] Error:', error);
    return NextResponse.json({ context: null, error: '读取反馈任务上下文失败' }, { status: 500 });
  }
}
