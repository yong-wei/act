import { createPrismaClient } from '../../src/lib/prisma-client';
import { type Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

import {
  eventToLearningFactInput,
  resolveLearningFactActionType,
} from '@/lib/data-governance/learning-fact-materialization';
import type { LearningEvent, PageType, UserRole } from '@/lib/data-governance/event-protocol';
import { isCoreEvent } from '@/lib/data-governance/event-types';
import { buildUNIT36SubmissionTelemetry } from '@/features/interactive/unit-3-6-zero-design-workshop/submission-telemetry';
import type { UNIT_3_6StepResponse } from '@/lib/unit-3-6-course';
import type { StudentSnapshotJob } from '../workers/types';

const prisma = createPrismaClient();
const isDryRun = process.argv.includes('--dry-run');
const shouldEnqueueSnapshots = process.argv.includes('--enqueue-snapshots');
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

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

async function enqueueStudentSnapshots(userIds: string[]) {
  if (userIds.length === 0) {
    return 0;
  }

  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue<StudentSnapshotJob>('snapshot-student', { connection: redis });
  const triggerId = `interaction-log-backfill-${Date.now()}`;

  try {
    for (const userId of userIds) {
      await queue.add(
        `student-snapshot-${userId}`,
        { userId },
        {
          attempts: 2,
          backoff: { type: 'exponential', delay: 10000 },
          jobId: `student-snapshot-${userId}-${triggerId}`,
          removeOnComplete: { count: 50 },
          removeOnFail: { count: 200 },
        },
      );
    }
  } finally {
    await queue.close();
    await redis.quit();
  }

  return userIds.length;
}

async function main() {
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
    `[BackfillInteractionLogs] logs=${logs.length} candidates=${factsToInsert.length} enrichedFromState=${enrichedFromState} dryRun=${isDryRun}`,
  );
  console.log(
    '[BackfillInteractionLogs] actionTypes=' +
      JSON.stringify(Object.fromEntries([...countsByActionType.entries()].sort((a, b) => b[1] - a[1]))),
  );

  if (isDryRun || factsToInsert.length === 0) {
    return;
  }

  await prisma.learningFact.createMany({
    data: factsToInsert,
    skipDuplicates: true,
  });
  console.log(`[BackfillInteractionLogs] inserted=${factsToInsert.length}`);

  if (shouldEnqueueSnapshots) {
    const userIds = Array.from(new Set(factsToInsert.map((fact) => fact.userId)));
    const enqueued = await enqueueStudentSnapshots(userIds);
    console.log(`[BackfillInteractionLogs] enqueuedStudentSnapshots=${enqueued}`);
  }
}

main()
  .catch((error) => {
    console.error('[BackfillInteractionLogs] failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
