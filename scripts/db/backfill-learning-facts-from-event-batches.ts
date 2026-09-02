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
import { assertExplicitHistoricalApply } from '@/features/learning-record/write-boundary/public-api';
import {
  beginAuthorizedBackfillApply,
  buildBackfillTerminalReceipt,
  computeBackfillInputDigest,
  createFileReceiptStore,
} from '@/features/learning-record/backfill-lane/public-api';

const prisma = createPrismaClient();
const isApply = process.argv.includes('--apply');
const shouldEnqueueSnapshots = process.argv.includes('--enqueue-snapshots');

function readArg(flag: string): string {
  const prefix = `${flag}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)?.trim() ?? '';
}

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

  const frozenCutoff = readArg('--frozen-cutoff');
  const factsToInsert: Prisma.LearningFactCreateManyInput[] = [];
  const countsByActionType = new Map<string, number>();

  for (const batch of batches) {
    const events = Array.isArray(batch.events) ? (batch.events as LearningEvent[]) : [];
    for (const rawEvent of events) {
      if (frozenCutoff && rawEvent.occurredAt > frozenCutoff) continue;
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
    `[BackfillFacts] batches=${batches.length} candidates=${factsToInsert.length} dryRun=${!isApply}`,
  );
  console.log(
    '[BackfillFacts] actionTypes=' +
      JSON.stringify(
        Object.fromEntries(
          [...countsByActionType.entries()].sort((a, b) => b[1] - a[1]),
        ),
      ),
  );

  if (!isApply) {
    return;
  }

  const auth = assertExplicitHistoricalApply({
    operationId: readArg('--operation-id'),
    authorizedBy: readArg('--authorize'),
    frozenCutoff,
  });
  const store = createFileReceiptStore();
  const inputDigest = computeBackfillInputDigest({
    lane: 'event-batches',
    frozenCutoff: auth.frozenCutoff,
    scope: { sourceEventIds: factsToInsert.map((fact) => String(fact.sourceEventId)).sort() },
  });
  const { existing } = beginAuthorizedBackfillApply(auth, inputDigest, store);
  if (existing?.status === 'applied' || existing?.status === 'resumed') {
    console.log(`[BackfillFacts] resumed operation=${auth.operationId}`);
    return;
  }

  let written = 0;
  if (factsToInsert.length > 0) {
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
    written = writeResult.written;
    console.log(`[BackfillFacts] inserted=${written}`);
  }
  store.put(buildBackfillTerminalReceipt(auth, {
    lane: 'event-batches',
    inputDigest,
    status: 'applied',
    outcomes: { accepted: written },
    factsCreated: written,
  }));
}

main()
  .catch((error) => {
    console.error('[BackfillFacts] failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
