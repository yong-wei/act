import type { LearningEvent } from '@/lib/data-governance/event-protocol';
import { LearningRecordContractError } from './errors';
import { acceptLearningRecordEvent } from './accept';
import type {
  ClientEventHint,
  LearningRecordAcceptanceStore,
  TrustedServerContext,
} from './types';

export async function adaptLegacyLearningEvent(
  store: LearningRecordAcceptanceStore,
  context: TrustedServerContext,
  legacy: Pick<LearningEvent, 'eventId' | 'actionType' | 'sessionId' | 'courseId' | 'classId' | 'userId' | 'payload' | 'clientTimestamp'>,
) {
  if (!legacy.eventId || !legacy.actionType) {
    throw new LearningRecordContractError('legacy-unsafe', 'Legacy event is missing identity or action');
  }
  if (legacy.userId && legacy.userId !== context.subjectId) {
    throw new LearningRecordContractError('legacy-unsafe', 'Legacy subject cannot be inferred across users');
  }
  const hint: ClientEventHint = {
    action: legacy.actionType,
    eventId: legacy.eventId,
    sourceEventId: legacy.eventId,
    sessionId: legacy.sessionId,
    courseId: legacy.courseId,
    classId: legacy.classId,
    payload: legacy.payload,
    reportedClientAt: legacy.clientTimestamp,
  };
  return acceptLearningRecordEvent(store, context, hint);
}
