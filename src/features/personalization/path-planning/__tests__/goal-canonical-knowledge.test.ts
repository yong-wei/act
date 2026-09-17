import { describe, expect, it } from 'vitest';

import {
  GOAL_CANONICAL_KNOWLEDGE,
  goalCanonicalIds,
  isPresetAdaptiveLearningGoal,
} from '@/features/personalization/path-planning/goal-canonical-knowledge';

describe('goal canonical knowledge', () => {
  it('covers the thirty-one preset goals and includes the reviewed application targets', () => {
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
      'discrete-control-foundations',
      'state-space-analysis-foundations',
      'steady-state-control-foundations',
      'system-modeling-process-foundations',
      'physical-modeling-interconnection-foundations',
      'state-space-controllability-foundations',
      'local-linearization-foundations',
      'signal-flow-foundations',
      'block-diagram-modeling-foundations',
      'mason-gain-formula-foundations',
      'feedback-structure-foundations',
      'transfer-poles-zeros-foundations',
      'input-response-foundations',
      'first-second-order-dynamics-foundations',
      'response-metrics-foundations',
      'time-domain-design-foundations',
      'dominant-pole-analysis-foundations',
      'stability-concepts-foundations',
      'routh-relative-stability-foundations',
      'optimal-control-foundations',
      'robust-control-foundations',
      'nonlinear-control-foundations',
    ]);
    expect(goalCanonicalIds('simulation-validation-practice')).toEqual([
      'ctkg:v3e-object-e80f5d56ce06409842363584',
      'ctkg:domainconcept:9b4e79193b3701a9657113eb',
      'ctkg:domainconcept:4eaa0995db3f87d3b7e0f117',
      'ctkg:v3e-object-0ca481aed329f4e6c74c8d30',
    ]);
    expect(goalCanonicalIds('ship-ocean-transfer-application')).toEqual([
      'ctkg:v3e-canonical-ed3a4babf006b2fd746765e8',
      'ctkg:v3e-object-b0cbf122498bca9269e55406',
      'ctkg:m3-v1k:canonical-object:39ac7c77fc6c62d14466a017',
      'ctc:v11g-caa20b325717f0a3c570f16b',
      'ctkg:m3-v1l:canonical-object:9536bb480a03e3193e6e88d2',
      'ctkg:domainconcept:42146fa04dc1459716346cc7',
    ]);
    expect(goalCanonicalIds('unregistered-empty-goal')).toEqual([]);
    expect(goalCanonicalIds('control-correction').every((id) => id.startsWith('ctc:') || id.startsWith('ctkg:'))).toBe(true);
    expect(isPresetAdaptiveLearningGoal('control-correction')).toBe(true);
    expect(isPresetAdaptiveLearningGoal('exact-resource')).toBe(false);
  });
});
