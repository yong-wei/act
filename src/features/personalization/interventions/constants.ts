export const PERSONALIZATION_INTERVENTION_POLICY_REVISION = 'personalization-intervention-policy.v1';

export const INTERVENTION_LIFECYCLE_EVENT_TYPES = ['RESOURCE_USED', 'HINT_REQUESTED', 'COMPLETED'] as const;
export type InterventionLifecycleEventType = (typeof INTERVENTION_LIFECYCLE_EVENT_TYPES)[number];

export function isInterventionLifecycleEventType(value: unknown): value is InterventionLifecycleEventType {
  return value === 'RESOURCE_USED' || value === 'HINT_REQUESTED' || value === 'COMPLETED';
}
