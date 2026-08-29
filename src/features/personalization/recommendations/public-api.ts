import { createPrismaRecommendationEvidenceDb } from '@/features/learning-record/personalization-ports/prisma-reads';
import type { RecommendationEvidenceDb } from '@/features/learning-record/personalization-ports/types';
import { recommendLearning } from './application/recommend-learning';

export { PERSONALIZATION_RECOMMENDATION_POLICY_REVISION } from './constants';
export { PersonalizationPolicyScopeError, assertPersonalizationOwnerScope } from './scope';
export { recommendLearning } from './application/recommend-learning';
export { dismissRecommendation, getRecommendationById } from './engine';
export type {
  Recommendation,
  RecommendationConfidenceState,
  RecommendationContext,
  RecommendationEvidenceBasis,
  RecommendationEvidenceRole,
  RecommendationPathExecutionRationale,
  RecommendationRationale,
  RecommendationSimulationArenaRationale,
  RecommendationType,
} from './types';

export async function generateRecommendations(
  userId: string,
  db: RecommendationEvidenceDb = createPrismaRecommendationEvidenceDb(),
) {
  const result = await recommendLearning({
    actorUserId: userId,
    subjectUserId: userId,
    role: 'STUDENT',
    db,
  });
  return result.recommendations;
}
