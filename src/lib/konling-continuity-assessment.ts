import type { CompanionPracticeMetadata } from '@/features/assessment/adaptive-engine';
import { resolveKonlingContinuitySnapshot } from '@/lib/konling-learning-continuity';
import type { ContinuityDb } from '@/lib/konling-learning-continuity';

export type CompanionPracticeSubmissionDb = ContinuityDb & {
  adaptiveAssessmentSession: {
    findUnique(args: unknown): Promise<{
      selectedQuestionIds: string[];
      metadata: unknown;
      answers: Array<{ id: string }>;
    } | null>;
  };
};

function readRequestedMetadata(continuity: unknown): CompanionPracticeMetadata | undefined {
  if (continuity === undefined) return undefined;
  if (!continuity || typeof continuity !== 'object' || Array.isArray(continuity)) {
    throw new Error('Invalid companion-practice metadata.');
  }
  const requested = continuity as Record<string, unknown>;
  if (
    requested.origin !== 'konling-companion-practice' ||
    typeof requested.snapshotId !== 'string' || !requested.snapshotId ||
    typeof requested.targetKnowledgeId !== 'string' || !requested.targetKnowledgeId ||
    (requested.structuredCauseId !== null && requested.structuredCauseId !== undefined && typeof requested.structuredCauseId !== 'string')
  ) {
    throw new Error('Invalid companion-practice metadata.');
  }
  return {
    origin: 'konling-companion-practice',
    snapshotId: requested.snapshotId,
    targetKnowledgeId: requested.targetKnowledgeId,
    structuredCauseId: requested.structuredCauseId ?? null,
  };
}

function metadataMatches(left: CompanionPracticeMetadata, right: unknown): boolean {
  if (!right || typeof right !== 'object' || Array.isArray(right)) return false;
  const record = right as Record<string, unknown>;
  return record.origin === left.origin &&
    record.snapshotId === left.snapshotId &&
    record.targetKnowledgeId === left.targetKnowledgeId &&
    (record.structuredCauseId ?? null) === left.structuredCauseId;
}

export async function verifyCompanionPracticeMetadata(
  db: ContinuityDb,
  input: { userId: string; continuity: unknown },
): Promise<CompanionPracticeMetadata | undefined> {
  const requested = readRequestedMetadata(input.continuity);
  if (!requested) return undefined;
  const snapshot = await resolveKonlingContinuitySnapshot(db, { userId: input.userId });
  if (snapshot.state !== 'recent_mistake' || !snapshot.recentMistake) {
    throw new Error('Companion practice is unavailable for the current continuity state.');
  }
  if (
    requested.origin !== 'konling-companion-practice' ||
    requested.snapshotId !== snapshot.snapshotId ||
    requested.targetKnowledgeId !== snapshot.recentMistake.knowledgeId ||
    (requested.structuredCauseId ?? null) !== snapshot.recentMistake.structuredCauseId
  ) {
    throw new Error('Stale or cross-user companion-practice metadata.');
  }
  return {
    origin: 'konling-companion-practice',
    snapshotId: snapshot.snapshotId,
    targetKnowledgeId: snapshot.recentMistake.knowledgeId,
    structuredCauseId: snapshot.recentMistake.structuredCauseId,
  };
}

export async function verifyCompanionPracticeSubmissionMetadata(
  db: CompanionPracticeSubmissionDb,
  input: { userId: string; sessionId: string; questionId: string; continuity: unknown },
): Promise<CompanionPracticeMetadata | undefined> {
  const requested = readRequestedMetadata(input.continuity);
  if (!requested) return undefined;
  try {
    return await verifyCompanionPracticeMetadata(db, input);
  } catch (error) {
    const completedSession = await db.adaptiveAssessmentSession.findUnique({
      where: { userId_sessionKey: { userId: input.userId, sessionKey: input.sessionId } },
      select: {
        selectedQuestionIds: true,
        metadata: true,
        answers: { where: { questionId: input.questionId }, select: { id: true }, take: 1 },
      },
    });
    if (
      completedSession &&
      metadataMatches(requested, completedSession.metadata) &&
      completedSession.selectedQuestionIds.length === 1 &&
      completedSession.selectedQuestionIds[0] === input.questionId &&
      completedSession.answers.length === 1
    ) {
      return requested;
    }
    throw error;
  }
}
