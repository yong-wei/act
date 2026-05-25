import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  ArenaBlackBoxExperimentInputError,
  prismaArenaBlackBoxExperimentStore,
} from '@/features/arena/blackbox/experiment-service';
import type { ArenaBlackBoxExperimentInput } from '@/features/arena/blackbox/experiment';
import {
  ArenaPlantAdapterSelectionError,
  getArenaPlantAdapterForPublicExperimentTaskId,
} from '@/features/arena/adapters/registry';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'STUDENT') {
    return NextResponse.json({ error: 'Only students can run Arena black-box experiments' }, { status: 403 });
  }

  try {
    const body = await request.json() as {
      taskId?: string;
      experimentInput?: ArenaBlackBoxExperimentInput;
    };

    if (!body.taskId || !body.experimentInput) {
      return NextResponse.json({ error: 'taskId and experimentInput are required' }, { status: 400 });
    }

    const adapter = getArenaPlantAdapterForPublicExperimentTaskId(body.taskId);
    const result = await adapter.runPublicExperiment({
      taskId: body.taskId,
      experimentInput: body.experimentInput,
      userId: session.user.id,
      store: prismaArenaBlackBoxExperimentStore,
      identificationModelStore: prismaArenaBlackBoxExperimentStore,
    });

    return NextResponse.json(result);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (
      error instanceof ArenaBlackBoxExperimentInputError ||
      error instanceof ArenaPlantAdapterSelectionError
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Arena black-box experiment failed', error);
    return NextResponse.json({ error: 'Arena black-box experiment failed' }, { status: 500 });
  }
}
