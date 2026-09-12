import { describe, expect, it } from 'vitest';

import {
  GOAL_CANONICAL_KNOWLEDGE,
  goalCanonicalIds,
  isPresetAdaptiveLearningGoal,
} from '@/features/personalization/path-planning/goal-canonical-knowledge';

describe('goal canonical knowledge', () => {
  it('covers the nine preset goals and leaves unbound goals empty', () => {
    expect(Object.keys(GOAL_CANONICAL_KNOWLEDGE)).toEqual([
      'control-correction',
      'frequency-response-foundations',
      'feedback-loop-concept-foundations',
      'transfer-function-modeling-foundations',
      'time-domain-response-analysis',
      'root-locus-analysis-foundations',
      'stability-margin-frequency-analysis',
      'simulation-validation-practice',
      'ship-ocean-transfer-application',
    ]);
    expect(goalCanonicalIds('simulation-validation-practice')).toEqual([]);
    expect(goalCanonicalIds('ship-ocean-transfer-application')).toEqual([]);
    expect(goalCanonicalIds('control-correction').every((id) => id.startsWith('ctc:') || id.startsWith('ctkg:'))).toBe(true);
    expect(isPresetAdaptiveLearningGoal('control-correction')).toBe(true);
    expect(isPresetAdaptiveLearningGoal('exact-resource')).toBe(false);
  });
});
