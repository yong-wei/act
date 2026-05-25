import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prismaArenaBlackBoxExperimentStore } from '@/features/arena/blackbox/experiment-service';
import {
  ArenaVirtualSimulationRunInputError,
  prismaArenaVirtualSimulationRunStore,
} from '@/features/arena/blackbox/controller-preview';
import type { ControllerArtifact } from '@/features/arena/types';
import {
  ArenaPlantAdapterSelectionError,
  getArenaPlantAdapterForVirtualPreviewTaskId,
} from '@/features/arena/adapters/registry';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'STUDENT') {
    return NextResponse.json({ error: 'Only students can run Arena virtual simulation previews' }, { status: 403 });
  }

  try {
    const body = await request.json() as {
      taskId?: string;
      artifact?: ControllerArtifact;
    };

    if (!body.taskId || !body.artifact) {
      return NextResponse.json({ error: 'taskId and artifact are required' }, { status: 400 });
    }

    const adapter = getArenaPlantAdapterForVirtualPreviewTaskId(body.taskId);
    const preview = await adapter.runVirtualPreview({
      userId: session.user.id,
      taskId: body.taskId,
      artifact: body.artifact,
      blackBoxExperimentStore: prismaArenaBlackBoxExperimentStore,
      identificationModelStore: prismaArenaBlackBoxExperimentStore,
      runStore: prismaArenaVirtualSimulationRunStore,
    });

    return NextResponse.json({ preview });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (
      error instanceof ArenaVirtualSimulationRunInputError ||
      error instanceof ArenaPlantAdapterSelectionError
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Arena virtual simulation preview failed', error);
    return NextResponse.json({ error: 'Arena virtual simulation preview failed' }, { status: 500 });
  }
}
