/**
 * Seed Event Dictionary
 *
 * Populates the EventDictionary table with all known event types.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { ALL_EVENTS } from '@/lib/data-governance/event-types';

const prisma = new PrismaClient();

async function seedEventDictionary() {
  console.log('[Migration] Seeding event dictionary...');

  for (const eventMeta of ALL_EVENTS) {
    await prisma.eventDictionary.upsert({
      where: { eventType: eventMeta.eventType },
      update: {
        category: eventMeta.category,
        priority: eventMeta.priority,
        description: eventMeta.description,
        schema: eventMeta.schema as Prisma.InputJsonValue,
        competencyMapping: eventMeta.competencyMapping as Prisma.InputJsonValue,
      },
      create: {
        eventType: eventMeta.eventType,
        category: eventMeta.category,
        priority: eventMeta.priority,
        description: eventMeta.description,
        schema: eventMeta.schema as Prisma.InputJsonValue,
        competencyMapping: eventMeta.competencyMapping as Prisma.InputJsonValue,
      },
    });

    console.log(`[Migration] Seeded: ${eventMeta.eventType}`);
  }

  console.log('[Migration] Event dictionary seeded successfully');
}

seedEventDictionary()
  .catch((err) => {
    console.error('[Migration] Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
