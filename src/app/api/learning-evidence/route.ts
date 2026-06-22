import { NextRequest, NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import {
  listEvidenceTimeline,
  parseEvidenceTimelineFilters,
} from '@/lib/data-governance/evidence-timeline';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import { createDatabaseUnavailableResponse, isDatabaseConnectivityError } from '@/lib/service-availability';
import {
  buildFeedbackTaskContext,
  buildLearningEvidenceAssignmentResponse,
} from '@/lib/student-feedback-task-contract';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const context = buildFeedbackTaskContext({
      assignment: request.nextUrl.searchParams.get('assignment'),
      criterion: request.nextUrl.searchParams.get('criterion'),
      source: request.nextUrl.searchParams.get('source'),
      status: request.nextUrl.searchParams.get('status'),
      action: request.nextUrl.searchParams.get('action'),
      returnTo: request.nextUrl.searchParams.get('returnTo'),
      intent: request.nextUrl.searchParams.get('intent'),
    });

    if (!context) {
      return NextResponse.json({
        error: '缺少反馈 assignment',
        recoveryAction: '返回报告反馈页重新进入',
      }, { status: 400 });
    }

    const page = await listEvidenceTimeline({
      db: prisma,
      userId: session.user.id,
      filters: parseEvidenceTimelineFilters(request.nextUrl.searchParams),
      viewerRole: 'student',
      restrictedFallbackAction: { href: context.returnHref, label: '返回报告反馈' },
    });

    return NextResponse.json(buildLearningEvidenceAssignmentResponse(context, page));
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[LearningEvidence] Error:', error);
    if (isDatabaseConnectivityError(error)) {
      return createDatabaseUnavailableResponse();
    }
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
