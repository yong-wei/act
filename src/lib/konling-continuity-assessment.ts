import type { CompanionPracticeMetadata } from '@/features/assessment/adaptive-engine';
import { resolveKonlingContinuitySnapshot } from '@/lib/konling-learning-continuity';
import type { ContinuityDb } from '@/lib/konling-learning-continuity';

export async function verifyCompanionPracticeMetadata(
  db: ContinuityDb,
  input: { userId: string; continuity: unknown },
): Promise<CompanionPracticeMetadata | undefined> {
  if (input.continuity === undefined) return undefined;
  if (!input.continuity || typeof input.continuity !== 'object' || Array.isArray(input.continuity)) {
    throw new Error('Invalid companion-practice metadata.');
  }
  const requested = input.continuity as Record<string, unknown>;
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
