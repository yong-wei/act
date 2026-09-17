import { describe, expect, it } from 'vitest';

import {
  getAdaptivePracticeGoalOption,
  getAdaptivePracticeGoalOptions,
  isAdaptivePracticeGoalId,
} from '@/features/personalization/path-planning/adaptive-path-goal-options';
import {
  listLearningGoals,
  validateLearningGoalCatalog,
} from '@/features/personalization/path-planning/public-api';

describe('adaptive path goal options', () => {
  it('projects every path-ready LearningGoal into a selectable adaptive practice option', () => {
    const pathReadyGoals = listLearningGoals().filter((goal) => goal.status === 'path-ready');
    const options = getAdaptivePracticeGoalOptions();

    expect(validateLearningGoalCatalog()).toEqual([]);
    expect(pathReadyGoals).toHaveLength(31);
    expect(options.map((option) => option.id)).toEqual(pathReadyGoals.map((goal) => goal.id));
    expect(options.map((option) => option.id)).toEqual([
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

    for (const option of options) {
      expect(option.title).toBeTruthy();
      expect(option.description).toBeTruthy();
      expect(option.completionMeaning).toBeTruthy();
      expect(option.intentType).toBeTruthy();
      expect(option.recommendedPhase).toBeTruthy();
      expect(option.terminalValidationSummary).toBeTruthy();
      expect(option.hrefs.generation).toBe(`/assessment/adaptive-practice?goal=${encodeURIComponent(option.id)}&intent=contextual-recommendation`);
      expect(option.hrefs.context).toBe(`/api/adaptive/path-advisor-context?goal=${encodeURIComponent(option.id)}`);
      expect(option.konlingContext.courseTitle).toBe(option.title);
      expect(option.konlingContext.topic).toContain(option.title);
      expect(option.konlingContext.learningObjectives.length).toBeGreaterThan(0);
      expect(option.konlingContext.quickPrompts.length).toBeGreaterThanOrEqual(3);
      expect(option.konlingContext.graphNodeIds.length).toBeGreaterThan(0);
    }
  });

  it('treats unknown and non-ready goals as unsafe entrypoints', () => {
    expect(isAdaptivePracticeGoalId('simulation-validation-practice')).toBe(true);
    expect(isAdaptivePracticeGoalId('unknown-learning-goal')).toBe(false);
    expect(getAdaptivePracticeGoalOption('unknown-learning-goal')).toBeNull();
  });
});
