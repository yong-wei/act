import { prisma } from '@/lib/prisma';
import { findAdaptiveAssessmentCatalogSnapshot } from '@/features/assessment/adaptive-assessment-catalog-selector';
import {
  verifyCompanionPracticeMetadata,
  verifyCompanionPracticeSubmissionMetadata,
  type CompanionPracticeSubmissionDb,
} from '@/lib/konling-continuity-assessment';
import type { ContinuityDb } from '@/lib/konling-learning-continuity';
import {
  getAbilityReportDurably,
  getDiagnosticDurably,
  selectNextQuestionDurably,
  submitAnswerDurably,
} from '../adaptive-persistence';
import { readAdaptiveAttemptContext, type AdaptiveAttemptContextDb } from '../adaptive-attempt-context';
import type { AssessmentRuntime } from '../ports';

export function createPrismaAssessmentRuntime(): AssessmentRuntime {
  return {
    pathIdentity: {
      findOwnedCurrentPath: async ({ pathId, userId, nodeId }) => {
        return prisma.learningPath.findFirst({
          where: {
            id: pathId,
            userId,
            currentNodeId: nodeId,
          },
          select: {
            goalId: true,
            nodeIds: true,
            pathPayload: true,
          },
        });
      },
    },
    catalog: {
      findSnapshot: findAdaptiveAssessmentCatalogSnapshot,
    },
    attempts: {
      selectNextQuestion: (params) => selectNextQuestionDurably(params),
      submitAnswer: (params) => submitAnswerDurably(params),
      readAbilityReport: (userId) => getAbilityReportDurably(userId),
      readDiagnostic: (userId) => getDiagnosticDurably(userId),
    },
    attemptContext: {
      readAttemptContext: (input) => readAdaptiveAttemptContext({
        db: prisma as unknown as AdaptiveAttemptContextDb,
        authenticatedUserId: input.authenticatedUserId,
        answerId: input.answerId,
      }),
    },
    companion: {
      verifyMetadata: (input) => verifyCompanionPracticeMetadata(
        prisma as unknown as ContinuityDb,
        input,
      ),
      verifySubmissionMetadata: (input) => verifyCompanionPracticeSubmissionMetadata(
        prisma as unknown as CompanionPracticeSubmissionDb,
        input,
      ),
    },
    mastery: {
      listMasteryUpdates: async (userId) => prisma.adaptiveMasteryUpdate.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 200,
      }),
      readLatestAbilityEstimate: async (userId) => prisma.adaptiveAssessmentAbilityEstimate.findFirst({
        where: { userId },
        orderBy: [{ estimatedAt: 'desc' }, { id: 'desc' }],
      }),
    },
  };
}
