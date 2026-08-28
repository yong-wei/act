import { prisma } from '@/lib/prisma';
import {
  readLatestAbilityEstimate,
  readMasteryUpdates,
} from '@/features/assessment/public-api';
import type { AdaptiveLearnerStateDb } from '../internal';
import { createDbLearnerStateRuntime } from './db-runtime';
import type { LearnerStateRuntime } from '../ports';

export function createPrismaLearnerStateRuntime(): LearnerStateRuntime {
  return createDbLearnerStateRuntime(prisma as unknown as AdaptiveLearnerStateDb, {
    assessment: {
      listMasteryUpdates: (userId) => readMasteryUpdates(userId),
      readLatestAbilityEstimate: (userId) => readLatestAbilityEstimate(userId),
    },
  });
}
