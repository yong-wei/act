import { createPrismaClient } from '../../src/lib/prisma-client';
import { type Prisma } from '@prisma/client';

import {
  writeLegacyKnowledgeScopedLearningFacts,
  type LearningFactWriteRow,
} from '@/lib/canonical-learning-fact-identity';
import type { LearningEvent } from '@/lib/data-governance/event-protocol';
import {
  eventToLearningFactInput,
  resolveLearningFactActionType,
} from '@/lib/data-governance/learning-fact-materialization';
import { resolveActiveKnowledgeRevision } from '@/lib/data-governance/knowledge-truth-revision';

const prisma = createPrismaClient();
const isDryRun = process.argv.includes('--dry-run');
const shouldEnqueueSnapshots = process.argv.includes('--enqueue-snapshots');

async function main() {
  if (shouldEnqueueSnapshots) {
    throw new Error(
      '--enqueue-snapshots has been removed; use the stopped-service db:backfill-cumulative-attainment command.',
    );
  }

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

  console.log(`[BackfillFacts] inserted=${writeResult.written}`);

}

main()
  .catch((error) => {
    console.error('[BackfillFacts] failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
