import { createPrismaRecommendationEvidenceDb } from '@/features/learning-record/personalization-ports/prisma-reads';
import type { RecommendationEvidenceDb } from '@/features/learning-record/personalization-ports/types';
import { PERSONALIZATION_RECOMMENDATION_POLICY_REVISION } from '../constants';
import { generateRecommendations } from '../engine';
import { assertPersonalizationOwnerScope } from '../scope';
import type { Recommendation } from '../types';

export interface RecommendLearningInput {
  actorUserId: string;
  subjectUserId: string;
  role: string;
  db?: RecommendationEvidenceDb;
}

export interface RecommendLearningResult {
  recommendations: Recommendation[];
  policyRevision: string;
  ownerUserId: string;
  grantsMastery: false;
}

export async function recommendLearning(
  input: RecommendLearningInput,
): Promise<RecommendLearningResult> {
  assertPersonalizationOwnerScope(input);
  const db = input.db ?? createPrismaRecommendationEvidenceDb();
  const recommendations = await generateRecommendations(input.subjectUserId, db);
  return {
    recommendations,
    policyRevision: PERSONALIZATION_RECOMMENDATION_POLICY_REVISION,
    ownerUserId: input.subjectUserId,
    grantsMastery: false,
  };
}
