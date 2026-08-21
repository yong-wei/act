export const MICRO_INTERVENTION_EVIDENCE_ALGORITHM_VERSION = 'micro-intervention-evidence.v1';
export const MICRO_INTERVENTION_EVIDENCE_REPEAT_WINDOW_MS = 6 * 60 * 60 * 1000;
export const MICRO_INTERVENTION_EVIDENCE_DECAY_AFTER_MS = 14 * 24 * 60 * 60 * 1000;
export const MICRO_INTERVENTION_VALIDATION_WEIGHT_CAP = 0.25;
export const MICRO_INTERVENTION_PUBLIC_MIN_LEARNERS = 5;

export type MicroInterventionEvidenceKind =
  | 'context-participation'
  | 'independent-validation';

export type MicroInterventionEvidenceLimitation =
  | 'identity-incomplete'
  | 'identity-drift'
  | 'repeat-suppressed'
  | 'time-decayed'
  | 'conflict'
  | 'consumer-shadow-only'
  | 'not-terminal-mastery';

export function isMicroInterventionEvidenceConsumerEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.MICRO_INTERVENTION_EVIDENCE_CONSUMER_ENABLED === 'true';
}

export function decayedValidationWeight(occurredAt: Date, now = new Date()): number {
  const age = now.getTime() - occurredAt.getTime();
  if (age > MICRO_INTERVENTION_EVIDENCE_DECAY_AFTER_MS) {
    return MICRO_INTERVENTION_VALIDATION_WEIGHT_CAP * 0.5;
  }
  return MICRO_INTERVENTION_VALIDATION_WEIGHT_CAP;
}

export function isRepeatWithinWindow(previousAt: Date, currentAt: Date): boolean {
  return Math.abs(currentAt.getTime() - previousAt.getTime()) < MICRO_INTERVENTION_EVIDENCE_REPEAT_WINDOW_MS;
}
