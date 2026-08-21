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

const CANONICAL_NODE_MASTERY_TAGS: Record<string, string[]> = {
  'kn:autocontrol:stability-margin': ['phase-margin', 'gain-margin'],
  'kn:autocontrol:controller-correction': ['controller-tuning'],
  'kn:autocontrol:frequency-response': ['phase-margin'],
  'kn:autocontrol:time-domain-performance': ['overshoot', 'settling-time'],
  'kn:autocontrol:root-locus': ['pole-stability'],
  'kn:autocontrol:feedback-loop': ['pole-stability'],
  'kn:autocontrol:transfer-function-model': ['pole-stability'],
};

export function mapCanonicalNodeToMasteryTags(canonicalNodeId: string): string[] {
  const mapped = CANONICAL_NODE_MASTERY_TAGS[canonicalNodeId];
  if (mapped) return mapped;
  const leaf = canonicalNodeId.split(':').pop()?.trim();
  return leaf ? [leaf] : [];
}
