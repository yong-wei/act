import { REVIEWED_LEARNING_GOAL_CHECKPOINT_QUESTIONS } from '@/features/assessment/learning-goal-checkpoint-question-sets';
import { REVIEWED_TERMINAL_VALIDATION_QUESTIONS } from '@/features/assessment/learning-goal-terminal-validation-question-sets';

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

let catalogMasteryTagsByNode: Map<string, string[]> | null = null;

function catalogMasteryTagsByCanonicalNode(): Map<string, string[]> {
  if (catalogMasteryTagsByNode) return catalogMasteryTagsByNode;
  const collected = new Map<string, Set<string>>();
  for (const question of [
    ...REVIEWED_LEARNING_GOAL_CHECKPOINT_QUESTIONS,
    ...REVIEWED_TERMINAL_VALIDATION_QUESTIONS,
  ]) {
    for (const nodeId of question.graphNodeIds) {
      const tags = collected.get(nodeId) ?? new Set<string>();
      tags.add(question.learningGoalId);
      collected.set(nodeId, tags);
    }
  }
  catalogMasteryTagsByNode = new Map(
    [...collected.entries()].map(([nodeId, tags]) => [nodeId, [...tags].sort()]),
  );
  return catalogMasteryTagsByNode;
}

export function mapCanonicalNodeToMasteryTags(canonicalNodeId: string): string[] {
  const mapped = catalogMasteryTagsByCanonicalNode().get(canonicalNodeId);
  if (mapped && mapped.length > 0) return mapped;
  const leaf = canonicalNodeId.split(':').pop()?.trim();
  return leaf ? [leaf] : [];
}
