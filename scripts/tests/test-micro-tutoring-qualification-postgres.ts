import 'dotenv/config';
import { Prisma } from '@prisma/client';

import { createPrismaClient } from '../../src/lib/prisma-client';

const required = process.env.MICRO_TUTORING_QUALIFICATION_POSTGRES_REQUIRED === '1';
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  if (required) throw new Error('DATABASE_URL is required for micro-tutoring qualification postgres tests');
  console.log('micro tutoring qualification postgres skipped: DATABASE_URL is not set');
  process.exit(0);
}

function postgresErrorCode(error: unknown): string | undefined {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code;
  if (!error || typeof error !== 'object') return undefined;
  const record = error as {
    code?: unknown;
    cause?: { code?: unknown; originalCode?: unknown };
  };
  if (typeof record.code === 'string') return record.code;
  if (typeof record.cause?.code === 'string') return record.cause.code;
  if (typeof record.cause?.originalCode === 'string') return record.cause.originalCode;
  return undefined;
}

function isUniqueConflict(error: unknown): boolean {
  const code = postgresErrorCode(error);
  return code === 'P2002' || code === '23505';
}

function learnerSafeTaskSnapshot(marker: string) {
  return {
    version: 'remediation-task-snapshot.v1',
    goal: '巩固关键概念',
    estimatedMinutes: 8,
    sourceQuestionId: `${marker}-source`,
    knowledgeNodeId: 'kn:autocontrol:controller-correction',
    misconceptionTag: 'misconception:control-correction:sample',
    resources: [{
      id: `${marker}-resource`,
      title: 'guided resource',
      version: 'v1',
      estimatedMinutes: 6,
      actionPath: '/r',
    }],
    validationQuestion: {
      itemRefId: `${marker}-item-ref`,
      questionId: `${marker}-question`,
      contentHash: 'a'.repeat(64),
      version: 'adaptive-assessment-item-ref.v1',
      estimatedMinutes: 2,
      actionPath: '/assessment/adaptive-practice',
    },
  };
}

function assertLearnerSafe(value: unknown, label: string): void {
  const serialized = JSON.stringify(value ?? {});
  if (serialized.includes('PRIVATE_CORRECT_ANSWER') || serialized.includes('answerKey')) {
    throw new Error(`learner-unsafe ${label}`);
  }
}

async function expectUniqueConflict(work: () => Promise<unknown>, label: string): Promise<void> {
  try {
    await work();
  } catch (error) {
    if (isUniqueConflict(error)) return;
    throw error;
  }
  throw new Error(`postgres qualification expected unique ${label} writes to conflict`);
}

async function main() {
  const prisma = createPrismaClient();
  const marker = `v2-qualify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdOrchestrationIds: string[] = [];
  const createdInterventionIds: string[] = [];
  try {
    const [orchestrationSamples, outcomeSamples] = await Promise.all([
      prisma.remediationOrchestrationResult.findMany({
        take: 5,
        select: { id: true, status: true, taskSnapshot: true, unavailableReason: true },
      }),
      prisma.microInterventionOutcome.findMany({
        take: 5,
        select: { id: true, sourceSnapshot: true },
      }),
    ]);
    for (const row of orchestrationSamples) {
      assertLearnerSafe(row.taskSnapshot, `orchestration snapshot ${row.id}`);
    }
    for (const row of outcomeSamples) {
      assertLearnerSafe(row.sourceSnapshot, `intervention snapshot ${row.id}`);
    }

    const seed = await prisma.wrongAnswerAttribution.findFirst({
      select: { id: true, userId: true },
    });
    if (!seed) {
      if (required) {
        throw new Error('postgres qualification requires at least one WrongAnswerAttribution row for write/replay');
      }
      console.log(JSON.stringify({
        orchestrationSamples: orchestrationSamples.length,
        interventionSamples: outcomeSamples.length,
        learnerSafe: true,
        writeReplay: 'skipped-empty',
      }));
      return;
    }

    const taskSnapshot = learnerSafeTaskSnapshot(marker);
    assertLearnerSafe(taskSnapshot, 'written orchestration snapshot');
    const created = await prisma.remediationOrchestrationResult.create({
      data: {
        wrongAnswerAttributionId: seed.id,
        orchestratorVersion: marker,
        userId: seed.userId,
        status: 'AVAILABLE',
        taskSnapshot,
      },
      select: { id: true, status: true, taskSnapshot: true },
    });
    createdOrchestrationIds.push(created.id);
    const replay = await prisma.remediationOrchestrationResult.findUnique({
      where: { id: created.id },
      select: { id: true, status: true, taskSnapshot: true, orchestratorVersion: true },
    });
    if (!replay || replay.orchestratorVersion !== marker || replay.status !== 'AVAILABLE') {
      throw new Error('postgres qualification failed to replay the written orchestration row');
    }
    assertLearnerSafe(replay.taskSnapshot, `replayed orchestration snapshot ${replay.id}`);
    await expectUniqueConflict(
      () => prisma.remediationOrchestrationResult.create({
        data: {
          wrongAnswerAttributionId: seed.id,
          orchestratorVersion: marker,
          userId: seed.userId,
          status: 'AVAILABLE',
          taskSnapshot: learnerSafeTaskSnapshot(`${marker}-duplicate`),
        },
      }),
      'orchestration',
    );

    const [leftIntervention, rightIntervention] = await Promise.all([
      prisma.microInterventionOutcome.create({
        data: {
          remediationOrchestrationResultId: created.id,
          userId: seed.userId,
          learnerSessionId: `${marker}-session`,
          startEventKey: `${marker}-start-a`,
          sourceSnapshot: { marker, lane: 'a', learnerSafe: true },
        },
        select: { id: true, startEventKey: true, sourceSnapshot: true },
      }),
      prisma.microInterventionOutcome.create({
        data: {
          remediationOrchestrationResultId: created.id,
          userId: seed.userId,
          learnerSessionId: `${marker}-session`,
          startEventKey: `${marker}-start-b`,
          sourceSnapshot: { marker, lane: 'b', learnerSafe: true },
        },
        select: { id: true, startEventKey: true, sourceSnapshot: true },
      }),
    ]);
    createdInterventionIds.push(leftIntervention.id, rightIntervention.id);
    const [leftReplay, rightReplay] = await Promise.all([
      prisma.microInterventionOutcome.findUnique({
        where: { id: leftIntervention.id },
        select: { id: true, startEventKey: true },
      }),
      prisma.microInterventionOutcome.findUnique({
        where: { id: rightIntervention.id },
        select: { id: true, startEventKey: true },
      }),
    ]);
    if (
      !leftReplay ||
      !rightReplay ||
      leftReplay.startEventKey !== `${marker}-start-a` ||
      rightReplay.startEventKey !== `${marker}-start-b`
    ) {
      throw new Error('postgres qualification failed to persist concurrent intervention writes');
    }
    assertLearnerSafe(leftIntervention.sourceSnapshot, `written intervention snapshot ${leftIntervention.id}`);
    assertLearnerSafe(rightIntervention.sourceSnapshot, `written intervention snapshot ${rightIntervention.id}`);

    const concurrentConflict = await Promise.allSettled([
      prisma.microInterventionOutcome.create({
        data: {
          remediationOrchestrationResultId: created.id,
          userId: seed.userId,
          learnerSessionId: `${marker}-session`,
          startEventKey: `${marker}-start-conflict`,
          sourceSnapshot: { marker, lane: 'conflict-1', learnerSafe: true },
        },
        select: { id: true },
      }),
      prisma.microInterventionOutcome.create({
        data: {
          remediationOrchestrationResultId: created.id,
          userId: seed.userId,
          learnerSessionId: `${marker}-session`,
          startEventKey: `${marker}-start-conflict`,
          sourceSnapshot: { marker, lane: 'conflict-2', learnerSafe: true },
        },
        select: { id: true },
      }),
    ]);
    const concurrentCreated = concurrentConflict.flatMap((result) => (
      result.status === 'fulfilled' ? [result.value.id] : []
    ));
    const concurrentRejected = concurrentConflict.filter((result) => result.status === 'rejected');
    createdInterventionIds.push(...concurrentCreated);
    if (concurrentCreated.length !== 1 || concurrentRejected.length !== 1) {
      throw new Error('postgres qualification expected exactly one concurrent unique intervention write to persist');
    }
    const rejected = concurrentRejected[0];
    if (rejected?.status !== 'rejected' || !isUniqueConflict(rejected.reason)) {
      throw new Error('postgres qualification expected concurrent unique intervention writes to raise P2002');
    }

    const event = await prisma.microInterventionEvent.create({
      data: {
        interventionId: leftIntervention.id,
        eventKey: `${marker}-event`,
        eventType: 'RESOURCE_USED',
        resourceId: `${marker}-resource`,
        durationSeconds: 8,
        occurredAt: new Date(),
      },
      select: { id: true, eventKey: true, eventType: true },
    });
    const eventReplay = await prisma.microInterventionEvent.findUnique({
      where: { id: event.id },
      select: { id: true, eventKey: true, eventType: true },
    });
    if (!eventReplay || eventReplay.eventKey !== event.eventKey || eventReplay.eventType !== 'RESOURCE_USED') {
      throw new Error('postgres qualification failed to replay the written intervention event');
    }
    await expectUniqueConflict(
      () => prisma.microInterventionEvent.create({
        data: {
          interventionId: leftIntervention.id,
          eventKey: event.eventKey,
          eventType: 'RESOURCE_USED',
          occurredAt: new Date(),
        },
      }),
      'event',
    );

    const validation = await prisma.microInterventionValidation.create({
      data: {
        interventionId: leftIntervention.id,
        eventKey: `${marker}-validation`,
        selectedOptionKey: 'A',
        isCorrect: false,
        durationSeconds: 12,
        questionId: `${marker}-question`,
        questionContentHash: 'a'.repeat(64),
        questionVersion: 'adaptive-assessment-item-ref.v1',
        recommendationSnapshot: { marker, nextAction: 'retry', learnerSafe: true },
      },
      select: { id: true, interventionId: true, recommendationSnapshot: true },
    });
    const validationReplay = await prisma.microInterventionValidation.findUnique({
      where: { interventionId: leftIntervention.id },
      select: { id: true, eventKey: true, isCorrect: true },
    });
    if (
      !validationReplay ||
      validationReplay.id !== validation.id ||
      validationReplay.eventKey !== `${marker}-validation` ||
      validationReplay.isCorrect !== false
    ) {
      throw new Error('postgres qualification failed to replay the written validation result');
    }
    assertLearnerSafe(validation.recommendationSnapshot, `validation snapshot ${validation.id}`);
    await expectUniqueConflict(
      () => prisma.microInterventionValidation.create({
        data: {
          interventionId: leftIntervention.id,
          eventKey: `${marker}-validation-duplicate`,
          selectedOptionKey: 'B',
          isCorrect: false,
          durationSeconds: 3,
          questionId: `${marker}-question-2`,
          questionContentHash: 'b'.repeat(64),
          questionVersion: 'adaptive-assessment-item-ref.v1',
          recommendationSnapshot: { marker, duplicate: true, learnerSafe: true },
        },
      }),
      'validation',
    );

    console.log(JSON.stringify({
      orchestrationSamples: orchestrationSamples.length,
      interventionSamples: outcomeSamples.length,
      learnerSafe: true,
      writeReplay: true,
      concurrentWrites: true,
      idempotentConflict: true,
      eventPersistence: true,
      validationResult: true,
    }));
  } finally {
    if (createdInterventionIds.length > 0) {
      await prisma.microInterventionOutcome.deleteMany({
        where: { id: { in: createdInterventionIds } },
      }).catch(() => undefined);
    }
    if (createdOrchestrationIds.length > 0) {
      await prisma.remediationOrchestrationResult.deleteMany({
        where: { id: { in: createdOrchestrationIds } },
      }).catch(() => undefined);
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
