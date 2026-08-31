import { stageMicroInterventionEvidenceOutbox } from '@/features/learning-record/personalization-ports/public-api';
import { assertPersonalizationOwnerScope } from '@/features/personalization/recommendations/scope';
import {
  isInterventionLifecycleEventType,
  type InterventionLifecycleEventType,
} from '../constants';

export class PersonalizationInterventionEventError extends Error {
  readonly code = 'INTERVENTION_EVENT_NOT_ALLOWED';

  constructor() {
    super('intervention lifecycle events must be RESOURCE_USED, HINT_REQUESTED, or COMPLETED');
    this.name = 'PersonalizationInterventionEventError';
  }
}

export function assertInterventionLifecycleEventType(
  value: unknown,
): asserts value is InterventionLifecycleEventType {
  if (!isInterventionLifecycleEventType(value)) {
    throw new PersonalizationInterventionEventError();
  }
}

export async function stageInterventionEvidenceProjection(input: {
  actorUserId: string;
  subjectUserId: string;
  role: string;
  db: Parameters<typeof stageMicroInterventionEvidenceOutbox>[0]['db'];
  interventionId: string;
}): Promise<{ status: 'staged' | 'pending'; profileRefreshed: false }> {
  assertPersonalizationOwnerScope({
    actorUserId: input.actorUserId,
    subjectUserId: input.subjectUserId,
    role: input.role,
  });
  await stageMicroInterventionEvidenceOutbox({
    db: input.db,
    interventionId: input.interventionId,
    ownerUserId: input.subjectUserId,
  });
  return { status: 'staged', profileRefreshed: false };
}
