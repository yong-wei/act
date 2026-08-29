import { prisma } from '@/lib/prisma';
import type { RecommendationEvidenceDb } from './types';

export function createPrismaRecommendationEvidenceDb(): RecommendationEvidenceDb {
  return prisma as unknown as RecommendationEvidenceDb;
}
