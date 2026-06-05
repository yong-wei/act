import { NextRequest, NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import {
  listEvidenceTimeline,
  parseEvidenceTimelineFilters,
} from '@/lib/data-governance/evidence-timeline';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import { createDatabaseUnavailableResponse, isDatabaseConnectivityError } from '@/lib/service-availability';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const page = await listEvidenceTimeline({
      db: prisma,
      userId: session.user.id,
      filters: parseEvidenceTimelineFilters(request.nextUrl.searchParams),
      viewerRole: 'student',
      restrictedFallbackAction: { href: '/profile/evidence', label: '查看可见证据' },
    });

    return NextResponse.json(page);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[StudentEvidence] Error:', error);
    if (isDatabaseConnectivityError(error)) {
      return createDatabaseUnavailableResponse();
    }
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
