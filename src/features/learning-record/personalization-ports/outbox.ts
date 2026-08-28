import {
  enqueueMicroInterventionEvidenceProjection,
  processPendingMicroInterventionEvidenceProjections,
} from '@/features/assessment/micro-intervention-learning-evidence';
import { collectForbiddenFields } from '@/features/learning-record/event-contract/allowlist';
import {
  LearningRecordDoubleWriteError,
  PERSONALIZATION_OUTBOX_EVENT_TYPE,
  type LearningRecordFactWriteGuard,
} from './types';

export const learningRecordFactWriteGuard: LearningRecordFactWriteGuard = {
  rejectDirectAndOutboxDoubleWrite(input) {
    if (input.writesLearningFact && input.stagesOutbox) {
      throw new LearningRecordDoubleWriteError();
    }
  },
};

export function assertPrivacySafeOutboxProjection(payload: unknown): void {
  const forbidden = collectForbiddenFields(payload).filter((path) => (
    !path.endsWith('.ownerUserId') && path !== 'ownerUserId'
  ));
  if (forbidden.length > 0) {
    throw new Error(`privacy-unsafe outbox projection: ${forbidden.join(',')}`);
  }
}

export async function stageMicroInterventionEvidenceOutbox(input: {
  db: Parameters<typeof enqueueMicroInterventionEvidenceProjection>[0]['db'];
  interventionId: string;
  ownerUserId: string;
}): Promise<{ status: 'staged'; eventType: typeof PERSONALIZATION_OUTBOX_EVENT_TYPE }> {
  learningRecordFactWriteGuard.rejectDirectAndOutboxDoubleWrite({
    writesLearningFact: false,
    stagesOutbox: true,
  });
  await enqueueMicroInterventionEvidenceProjection(input);
  return { status: 'staged', eventType: PERSONALIZATION_OUTBOX_EVENT_TYPE };
}

export async function applyStagedMicroInterventionEvidence(
  db: Parameters<typeof processPendingMicroInterventionEvidenceProjections>[0],
  options: { interventionId?: string; limit?: number } = {},
): Promise<{ processed: number; failed: number }> {
  return processPendingMicroInterventionEvidenceProjections(db, options);
}
