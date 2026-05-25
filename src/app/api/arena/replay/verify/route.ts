import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  ArenaReplayAccessError,
  ArenaReplayNotFoundError,
  prismaArenaReplayRunStore,
  verifyArenaVirtualSimulationReplay,
  type ArenaReplayRole,
} from '@/features/arena/blackbox/replay-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json() as { runId?: string };
    if (!body.runId) {
      return NextResponse.json({ error: 'runId is required' }, { status: 400 });
    }

    const result = await verifyArenaVirtualSimulationReplay({
      runId: body.runId,
      requester: {
        userId: session.user.id,
        role: session.user.role as ArenaReplayRole,
      },
      store: prismaArenaReplayRunStore,
    });

    if (result.status === 'mismatch') {
      return NextResponse.json(result, { status: 409 });
    }
    if (result.status === 'missing_trace') {
      return NextResponse.json(result, { status: 422 });
    }
    return NextResponse.json(result);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof ArenaReplayNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ArenaReplayAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Arena replay verification failed', error);
    return NextResponse.json({ error: 'Arena replay verification failed' }, { status: 500 });
  }
}
