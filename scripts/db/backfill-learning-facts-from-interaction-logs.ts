import { createPrismaClient } from '../../src/lib/prisma-client';
import { type Prisma } from '@prisma/client';

import {
  writeLegacyKnowledgeScopedLearningFacts,
  type LearningFactWriteRow,
} from '@/lib/canonical-learning-fact-identity';
import {
  eventToLearningFactInput,
  resolveLearningFactActionType,
} from '@/lib/data-governance/learning-fact-materialization';
import type { LearningEvent, PageType, UserRole } from '@/lib/data-governance/event-protocol';
import { isCoreEvent } from '@/lib/data-governance/event-types';
import { resolveActiveKnowledgeRevision } from '@/lib/data-governance/knowledge-truth-revision';
import { assertExplicitHistoricalApply } from '@/features/learning-record/write-boundary/public-api';
import { buildUNIT36SubmissionTelemetry } from '@/features/interactive/unit-3-6-zero-design-workshop/submission-telemetry';
import type { UNIT_3_6StepResponse } from '@/lib/unit-3-6-course';

const prisma = createPrismaClient();
const isApply = process.argv.includes('--apply');
const shouldEnqueueSnapshots = process.argv.includes('--enqueue-snapshots');

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

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function resolveRole(value: string | null | undefined): UserRole {
  if (value === 'teacher' || value === 'admin' || value === 'student') {
    return value;
  }
  if (value === 'TEACHER') return 'teacher';
  if (value === 'ADMIN') return 'admin';
  return 'student';
}

function resolvePageType(value: unknown): PageType {
  const pageType = readString(value);
  if (
    pageType === 'theory' ||
    pageType === 'practice' ||
    pageType === 'workspace' ||
    pageType === 'quiz' ||
    pageType === 'reflection' ||
    pageType === 'simulation' ||
    pageType === 'resource' ||
    pageType === 'knowledge' ||
    pageType === 'dashboard' ||
    pageType === 'classroom'
  ) {
    return pageType;
  }
  return 'classroom';
}

function isUNIT36Response(value: unknown): value is UNIT_3_6StepResponse {
  const record = readRecord(value);
  return (
    typeof record.stepId === 'string' &&
    typeof record.submittedAt === 'number' &&
    Boolean(record.answers) &&
    typeof record.answers === 'object' &&
    !Array.isArray(record.answers)
  );
}

function readUNIT36Response(
  stateData: unknown,
  stepId: string | null | undefined,
): UNIT_3_6StepResponse | null {
  if (!stepId) {
    return null;
  }

  const data = readRecord(stateData);
  const responses = readRecord(data.responses);
  const response = responses[stepId];
  return isUNIT36Response(response) ? response : null;
}

async function main() {
  if (shouldEnqueueSnapshots) {
    throw new Error(
      '--enqueue-snapshots has been removed; use the stopped-service db:backfill-cumulative-attainment command.',
    );
  }

  const lessonKey = getArgValue('--lesson-key');
  const sessionId = getArgValue('--session-id');
  const since = getArgValue('--since');
  const until = getArgValue('--until');

  const existingFacts = await prisma.learningFact.findMany({
    where: { sourceEventId: { not: null } },
    select: { sourceEventId: true },
  });
  const existingEventIds = new Set(
    existingFacts
      .map((fact) => fact.sourceEventId)
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
  );

  const where: Prisma.InteractionLogWhereInput = {
    OR: [
      { eventData: { path: ['eventType'], equals: 'lesson_submit' } },
      { eventData: { path: ['eventType'], equals: 'lesson_resubmit' } },
      { eventData: { path: ['eventType'], equals: 'session_finalize' } },
    ],
  };
  if (lessonKey) where.lessonKey = lessonKey;
  if (sessionId) where.sessionId = sessionId;
  if (since || until) {
    where.clientEventAt = {
      ...(since ? { gte: new Date(since) } : {}),
      ...(until ? { lte: new Date(until) } : {}),
    };
  }

  const logs = await prisma.interactionLog.findMany({
    where,
    orderBy: { clientEventAt: 'asc' },
    select: {
      id: true,
      userId: true,
      resourceKey: true,
      sessionId: true,
      lessonKey: true,
      stepId: true,
      actorRole: true,
      eventType: true,
      eventData: true,
      clientEventAt: true,
      createdAt: true,
    },
  });

  const stateKeys = Array.from(
    new Set(
      logs
        .filter((log) => log.lessonKey === 'unit-3-6-zero-design-workshop-v1')
        .map((log) => `${log.sessionId ?? ''}::${log.userId}`),
    ),
  );
  const states = stateKeys.length > 0
    ? await prisma.studentState.findMany({
        where: {
          stateKey: 'course',
          OR: stateKeys.map((key) => {
            const [stateSessionId, userId] = key.split('::');
            return { sessionId: stateSessionId, userId };
          }),
        },
        select: { sessionId: true, userId: true, data: true },
      })
    : [];
  const stateBySessionAndUser = new Map(states.map((state) => [`${state.sessionId}::${state.userId}`, state]));

  const factsToInsert: Prisma.LearningFactCreateManyInput[] = [];
  const countsByActionType = new Map<string, number>();
  let enrichedFromState = 0;

  for (const log of logs) {
    const sourceEventId = `interaction-log:${log.id}`;
    if (existingEventIds.has(sourceEventId)) {
      continue;
    }

    const payload = readRecord(log.eventData);
    const state = stateBySessionAndUser.get(`${log.sessionId ?? ''}::${log.userId}`);
    const unit36Response = readUNIT36Response(state?.data, log.stepId);
    const stateTelemetry = unit36Response ? buildUNIT36SubmissionTelemetry(unit36Response) : null;
    if (stateTelemetry) enrichedFromState += 1;

    const event: LearningEvent = {
      eventId: sourceEventId,
      occurredAt: (log.clientEventAt ?? log.createdAt).toISOString(),
      userId: log.userId,
      role: resolveRole(log.actorRole),
      lessonId: log.lessonKey ?? readString(payload.lessonKey),
      sessionId: log.sessionId ?? readString(payload.sessionId),
      pagePath: readString(payload.originPath) ?? '/interactive-learning/courses',
      pageType: resolvePageType(payload.pageType),
      moduleId: log.resourceKey ?? readString(payload.resourceKey),
      actionType: log.eventType,
      payload: {
        ...payload,
        ...(stateTelemetry ?? {}),
        sourceLogId: log.id,
        lessonKey: log.lessonKey ?? readString(payload.lessonKey),
        sessionId: log.sessionId ?? readString(payload.sessionId),
        stepId: log.stepId ?? readString(payload.stepId),
        originalEventType: log.eventType,
      },
      source: 'web',
      priority: 'core',
      clientTimestamp:
        typeof payload.clientEventAt === 'number'
          ? payload.clientEventAt
          : log.clientEventAt?.getTime(),
    };

    const actionType = resolveLearningFactActionType(event);
    countsByActionType.set(actionType, (countsByActionType.get(actionType) ?? 0) + 1);
    if (!isCoreEvent(actionType)) {
      continue;
    }

    const fact = eventToLearningFactInput(event);
    if (!fact?.sourceEventId) {
      continue;
    }
    existingEventIds.add(fact.sourceEventId);
    factsToInsert.push(fact);
  }

  console.log(
    `[BackfillInteractionLogs] logs=${logs.length} candidates=${factsToInsert.length} enrichedFromState=${enrichedFromState} dryRun=${!isApply}`,
  );
  console.log(
    '[BackfillInteractionLogs] actionTypes=' +
      JSON.stringify(Object.fromEntries([...countsByActionType.entries()].sort((a, b) => b[1] - a[1]))),
  );

  if (!isApply || factsToInsert.length === 0) {
    return;
  }

  assertExplicitHistoricalApply({
    operationId: getArgValue('--operation-id') ?? '',
    authorizedBy: getArgValue('--authorize') ?? '',
    frozenCutoff: getArgValue('--frozen-cutoff') ?? '',
  });

  const activeRevision = await resolveActiveKnowledgeRevision(prisma);
  const writeResult = await writeLegacyKnowledgeScopedLearningFacts(
    {
      learningFact: {
        createMany: async (args) => prisma.learningFact.createMany({
          data: [...args.data] as Prisma.LearningFactCreateManyInput[],
          skipDuplicates: args.skipDuplicates,
        }),
      },
    },
    factsToInsert as LearningFactWriteRow[],
    { knowledgeRevisionRef: activeRevision.id },
  );
  console.log(`[BackfillInteractionLogs] inserted=${writeResult.written}`);

}

main()
  .catch((error) => {
    console.error('[BackfillInteractionLogs] failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
