import { PrismaClient, type Prisma } from '@prisma/client';

import type { LearningEvent } from '@/lib/data-governance/event-protocol';
import { isCoreEvent } from '@/lib/data-governance/event-types';
import {
  deriveFactOutcome,
  deriveFactScore,
  deriveFactTimeSpent,
  mapActionTypeToFactType,
  resolveCanonicalEventType,
  resolveCompetencyContribution,
} from '@/lib/data-governance/event-normalization';

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');

function toLearningFact(event: LearningEvent): Prisma.LearningFactCreateManyInput | null {
  const actionType = resolveCanonicalEventType(event.actionType, event.payload);
  if (!isCoreEvent(actionType)) {
    return null;
  }

  return {
    userId: event.userId,
    factType: mapActionTypeToFactType(actionType),
    moduleId: event.moduleId,
    sessionId: event.sessionId,
    startedAt: new Date(event.occurredAt),
    finishedAt: new Date(event.occurredAt),
    outcome: deriveFactOutcome(actionType, event.payload),
    score: deriveFactScore(event.payload),
    timeSpent: deriveFactTimeSpent(event.payload),
    competencyContribution: resolveCompetencyContribution(
      actionType,
      event.payload,
      event.derivedMetrics,
    ) as Prisma.InputJsonValue,
    sourceEventId: event.eventId,
    sourceLogId:
      typeof event.payload.sourceLogId === 'string'
        ? event.payload.sourceLogId
        : undefined,
    courseId: event.courseId,
    lessonId: event.lessonId,
  };
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
      const payload =
        rawEvent.payload && typeof rawEvent.payload === 'object'
          ? rawEvent.payload
          : {};
      const canonicalActionType = resolveCanonicalEventType(
        rawEvent.actionType,
        payload,
      );

      countsByActionType.set(
        canonicalActionType,
        (countsByActionType.get(canonicalActionType) ?? 0) + 1,
      );

      const fact = toLearningFact(rawEvent);
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
  });

  console.log(`[BackfillFacts] inserted=${factsToInsert.length}`);
}

main()
  .catch((error) => {
    console.error('[BackfillFacts] failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
