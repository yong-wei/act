import { NextRequest, NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import {
  mapEvidenceCopilotRole,
  parseEvidenceCopilotHintsFromSearch,
  resolveEvidenceCopilotContext,
} from '@/lib/evidence-copilot-context';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const hints = parseEvidenceCopilotHintsFromSearch(request.nextUrl.searchParams);
    const projection = await resolveEvidenceCopilotContext({
      userId: session.user.id,
      role: mapEvidenceCopilotRole(session.user.role),
      hints,
      db: prisma,
    });

    return NextResponse.json(projection, {
      headers: {
        'X-Evidence-Copilot-Status': projection.status,
        'X-Evidence-Copilot-Limitations': encodeURIComponent(projection.limitations.join('|')),
      },
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return NextResponse.json({
      error: '证据服务不可用',
    }, { status: 503 });
  }
}
