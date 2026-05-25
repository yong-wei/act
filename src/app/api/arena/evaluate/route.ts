import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import { prismaArenaBlackBoxExperimentStore } from '@/features/arena/blackbox/experiment-service';
import { ArenaSubmissionInputError, createPersistedArenaSubmission } from '@/features/arena/submissions/persistence';
import { prismaArenaSubmissionStore } from '@/features/arena/submissions/prisma-store';
import {
  ArenaPlantAdapterSelectionError,
  getArenaPlantAdapterForOfficialEvaluationTaskId,
} from '@/features/arena/adapters/registry';
import {
  ArenaPublicationAccessError,
  resolveAccessibleArenaPublicationForStudent,
} from '@/features/arena/teacher/publication-store';
import type { ControllerArtifact } from '@/features/arena/types';

export const dynamic = 'force-dynamic';

function isPendingArenaDatabaseMigration(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }
  const prismaError = error as {
    code?: unknown;
    meta?: {
      modelName?: unknown;
      column?: unknown;
      table?: unknown;
    };
  };
  if (prismaError.code !== 'P2021' && prismaError.code !== 'P2022') {
    return false;
  }
  const modelName = typeof prismaError.meta?.modelName === 'string' ? prismaError.meta.modelName : '';
  const column = typeof prismaError.meta?.column === 'string' ? prismaError.meta.column : '';
  const table = typeof prismaError.meta?.table === 'string' ? prismaError.meta.table : '';
  return [modelName, column, table].some((value) => (
    value.split(/[^A-Za-z0-9_]+/).some((part) => part.startsWith('Arena'))
  ));
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'STUDENT') {
    return NextResponse.json({ error: 'Only students can submit Arena entries' }, { status: 403 });
  }

  try {
    const body = await request.json() as {
      taskId?: string;
      artifact?: ControllerArtifact;
      publicationId?: string;
    };

    if (!body.taskId || !body.artifact) {
      return NextResponse.json({ error: 'taskId and artifact are required' }, { status: 400 });
    }

    getArenaPlantAdapterForOfficialEvaluationTaskId(body.taskId);

    const publicationContext = typeof body.publicationId === 'string' && body.publicationId.trim().length > 0
      ? await resolveAccessibleArenaPublicationForStudent(prisma as any, {
        publicationId: body.publicationId,
        studentId: session.user.id,
        taskId: body.taskId,
        now: new Date(),
      })
      : null;

    const submission = await createPersistedArenaSubmission({
      taskId: body.taskId,
      artifact: body.artifact,
      userId: session.user.id,
      publicationId: publicationContext?.id,
      classId: publicationContext?.classId,
      seasonId: publicationContext?.seasonId,
      isLate: publicationContext?.isLate,
      studentLabel: session.user.name ?? '匿名学生',
      submittedAt: new Date().toISOString(),
      store: prismaArenaSubmissionStore,
      blackBoxExperimentStore: prismaArenaBlackBoxExperimentStore,
      identificationModelStore: prismaArenaBlackBoxExperimentStore,
    });

    return NextResponse.json({ submission });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof ArenaPublicationAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ArenaSubmissionInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof ArenaPlantAdapterSelectionError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (isPendingArenaDatabaseMigration(error)) {
      console.error('Arena evaluation schema migration pending', error);
      return NextResponse.json(
        { error: '竞技场评测数据表尚未完成迁移，请先完成数据库迁移后重试。' },
        { status: 503 },
      );
    }
    console.error('Arena evaluation failed', error);
    return NextResponse.json({ error: 'Arena evaluation failed' }, { status: 500 });
  }
}
