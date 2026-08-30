import { NextRequest, NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import {
  mapGovernedCopilotRole,
  resolveGovernedCopilotProfile,
} from '@/lib/governed-copilot-profile-context';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const projection = await resolveGovernedCopilotProfile({
      userId: session.user.id,
      role: mapGovernedCopilotRole(session.user.role),
      displayName: session.user.name,
    });

    return NextResponse.json(projection, {
      headers: {
        'X-Governed-Copilot-Profile-Status': projection.status,
        'X-Governed-Copilot-Profile-Limitations': encodeURIComponent(projection.limitations.join('|')),
      },
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return NextResponse.json({
      error: '画像服务不可用',
    }, { status: 503 });
  }
}
