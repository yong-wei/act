import { opaqueSubjectRef } from '@/features/learning-record/event-contract/allowlist';
import {
  LEARNING_FACT_TRIGGER_OUTBOX_EVENT_TYPE,
  projectionTriggerKey,
  type IngestionWriteDb,
  type ProjectionTriggerDescriptor,
} from './types';
import { inspectIngestionBoundary, minimizedFailureRecord } from './sanitizer';

export function buildProjectionTrigger(input: {
  subjectUserId: string;
  inputDigest: string;
  captureRevision: string;
  classId?: string;
}): ProjectionTriggerDescriptor {
  return {
    triggerKey: projectionTriggerKey(input),
    subjectUserId: input.subjectUserId,
    captureRevision: input.captureRevision,
    inputDigest: input.inputDigest,
    classId: input.classId,
  };
}

export async function recordProjectionTriggerIntent(
  db: IngestionWriteDb,
  trigger: ProjectionTriggerDescriptor,
): Promise<void> {
  if (typeof db.evidenceOutbox?.upsert !== 'function') return;
  const payload = {
    kind: 'projection-trigger',
    subjectRef: opaqueSubjectRef(trigger.subjectUserId),
    captureRevision: trigger.captureRevision,
    inputDigest: trigger.inputDigest,
    classId: trigger.classId ?? null,
  };
  const violations = inspectIngestionBoundary(payload);
  if (violations.length > 0) {
    throw new Error(`privacy-unsafe projection trigger: ${violations.join(',')}`);
  }
  await db.evidenceOutbox.upsert({
    where: { dedupeKey: trigger.triggerKey },
    update: {
      status: 'pending',
      causationId: trigger.inputDigest,
      payload,
    },
    create: {
      eventType: LEARNING_FACT_TRIGGER_OUTBOX_EVENT_TYPE,
      correlationId: opaqueSubjectRef(trigger.subjectUserId),
      causationId: trigger.inputDigest,
      ownerUserId: trigger.subjectUserId,
      dedupeKey: trigger.triggerKey,
      status: 'pending',
      payload,
    },
  });
}

export { minimizedFailureRecord };
