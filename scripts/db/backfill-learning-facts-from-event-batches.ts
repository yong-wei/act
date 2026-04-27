import { PrismaClient, type Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

import type { LearningEvent } from '@/lib/data-governance/event-protocol';
import {
  eventToLearningFactInput,
  resolveLearningFactActionType,
} from '@/lib/data-governance/learning-fact-materialization';
import type { StudentSnapshotJob } from '../workers/types';

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');
const shouldEnqueueSnapshots = process.argv.includes('--enqueue-snapshots');
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function enqueueStudentSnapshots(userIds: string[]) {
  if (userIds.length === 0) {
    return 0;
  }

  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue<StudentSnapshotJob>('snapshot-student', { connection: redis });
  const triggerId = `learning-fact-backfill-${Date.now()}`;

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
  const batches = await prisma.learningEventBatch.findMany({
    orderBy: { processedAt: 'asc' },
    select: { events: true },
  });

  const existingFacts = await prisma.learningFact.findMany({
    where: { sourceEventId: { not: null } },
    select: { sourceEventId: true },
  });
  const existingEventIds = new Set(
    existingFacts
      .map((fact) => fact.sourceEventId)
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
  );

  const factsToInsert: Prisma.LearningFactCreateManyInput[] = [];
  const countsByActionType = new Map<string, number>();

  for (const batch of batches) {
    const events = Array.isArray(batch.events) ? (batch.events as LearningEvent[]) : [];
    for (const rawEvent of events) {
      const canonicalActionType = resolveLearningFactActionType(rawEvent);

      countsByActionType.set(
        canonicalActionType,
        (countsByActionType.get(canonicalActionType) ?? 0) + 1,
      );

      const fact = eventToLearningFactInput(rawEvent);
      if (!fact?.sourceEventId || existingEventIds.has(fact.sourceEventId)) {
        continue;
      }

      existingEventIds.add(fact.sourceEventId);
      factsToInsert.push(fact);
    }
  }

  console.log(
    `[BackfillFacts] batches=${batches.length} candidates=${factsToInsert.length} dryRun=${isDryRun}`,
  );
  console.log(
    '[BackfillFacts] actionTypes=' +
      JSON.stringify(
        Object.fromEntries(
          [...countsByActionType.entries()].sort((a, b) => b[1] - a[1]),
        ),
      ),
  );

  if (isDryRun || factsToInsert.length === 0) {
    return;
  }

  await prisma.learningFact.createMany({
    data: factsToInsert,
    skipDuplicates: true,
  });

  console.log(`[BackfillFacts] inserted=${factsToInsert.length}`);

  if (shouldEnqueueSnapshots) {
    const userIds = Array.from(
      new Set(
        factsToInsert
          .map((fact) => fact.userId)
          .filter((userId): userId is string => typeof userId === 'string' && userId.length > 0),
      ),
    );
    const enqueued = await enqueueStudentSnapshots(userIds);
    console.log(`[BackfillFacts] enqueuedStudentSnapshots=${enqueued}`);
  }
}

main()
  .catch((error) => {
    console.error('[BackfillFacts] failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
