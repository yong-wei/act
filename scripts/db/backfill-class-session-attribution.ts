import { PrismaClient, SessionStatus } from '@prisma/client';

import {
  resolveSessionClassContext,
  shouldPersistInferredClassAttribution,
  type SessionClassInfo,
} from '@/lib/data-governance/class-session-attribution';

const prisma = new PrismaClient();

function getArgValue(name: string): string | null {
  const prefix = `${name}=`;
  const inline = process.argv.find((item) => item.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }

  const index = process.argv.indexOf(name);
  if (index >= 0) {
    return process.argv[index + 1] ?? null;
  }

  return null;
}

function getNumberArg(name: string, fallback: number): number {
  const value = getArgValue(name);
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function main() {
  const shouldApply = process.argv.includes('--apply');
  const teacherId = getArgValue('--teacher-id');
  const sessionId = getArgValue('--session-id');
  const titleContains = getArgValue('--title-contains');
  const inferenceThreshold = getNumberArg('--threshold', 0.6);
  const minStudentCount = getNumberArg('--min-student-count', 5);

  const sessions = await prisma.classSession.findMany({
    where: {
      classId: null,
      status: SessionStatus.FINISHED,
      ...(teacherId ? { teacherId } : {}),
      ...(sessionId ? { id: sessionId } : {}),
      ...(titleContains
        ? {
            plan: {
              title: {
                contains: titleContains,
                mode: 'insensitive',
              },
            },
          }
        : {}),
    },
    select: {
      id: true,
      joinCode: true,
      teacherId: true,
      startTime: true,
      plan: {
        select: {
          title: true,
        },
      },
      studentStates: {
        select: {
          user: {
            select: {
              profile: {
                select: {
                  classId: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { startTime: 'desc' },
  });

  const classIds = Array.from(
    new Set(
      sessions.flatMap((item) =>
        item.studentStates
          .map((state) => state.user.profile?.classId)
          .filter((value): value is string => typeof value === 'string' && value.length > 0),
      ),
    ),
  );
  const classes = await prisma.class.findMany({
    where: { id: { in: classIds } },
    select: {
      id: true,
      name: true,
      code: true,
      teacherId: true,
    },
  });
  const classesById = new Map<string, SessionClassInfo>(
    classes.map((item) => [item.id, { id: item.id, name: item.name, code: item.code }]),
  );
  const classTeacherById = new Map(classes.map((item) => [item.id, item.teacherId]));

  const candidates = sessions
    .map((item) => {
      const context = resolveSessionClassContext({
        sessionClassId: null,
        sessionClass: null,
        participantClassIds: item.studentStates.map((state) => state.user.profile?.classId),
        classesById,
        inferenceThreshold,
      });

      return {
        session: item,
        context,
        eligible: shouldPersistInferredClassAttribution({
          attribution: context.attribution,
          minStudentCount,
        }),
      };
    })
    .filter(({ session, context, eligible }) => {
      if (!eligible || !context.classId) {
        return false;
      }
      return classTeacherById.get(context.classId) === session.teacherId;
    });

  console.log(
    `[BackfillClassSessionAttribution] scanned=${sessions.length} candidates=${candidates.length} apply=${shouldApply} threshold=${inferenceThreshold} minStudentCount=${minStudentCount}`,
  );

  for (const { session, context } of candidates) {
    console.log(
      JSON.stringify({
        sessionId: session.id,
        joinCode: session.joinCode,
        title: session.plan.title,
        startTime: session.startTime.toISOString(),
        inferredClassId: context.classId,
        inferredClassName: context.class?.name ?? null,
        confidence: context.attribution.confidence,
        studentCount: context.attribution.studentCount,
        classCounts: context.attribution.classCounts,
      }),
    );
  }

  if (!shouldApply || candidates.length === 0) {
    return;
  }

  let updated = 0;
  for (const { session, context } of candidates) {
    if (!context.classId) continue;
    const result = await prisma.classSession.updateMany({
      where: {
        id: session.id,
        classId: null,
      },
      data: {
        classId: context.classId,
      },
    });
    updated += result.count;
  }

  console.log(`[BackfillClassSessionAttribution] updated=${updated}`);
}

main()
  .catch((error) => {
    console.error('[BackfillClassSessionAttribution] failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
