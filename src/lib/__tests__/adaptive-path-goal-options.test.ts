import { describe, expect, it } from 'vitest';

import {
  getAdaptivePracticeGoalOption,
  getAdaptivePracticeGoalOptions,
  isAdaptivePracticeGoalId,
} from '@/lib/adaptive-path-goal-options';
import { listLearningGoals } from '@/lib/adaptive-learning-path-planner';

describe('adaptive path goal options', () => {
  it('projects every path-ready LearningGoal into a selectable adaptive practice option', () => {
    const pathReadyGoals = listLearningGoals().filter((goal) => goal.status === 'path-ready');
    const options = getAdaptivePracticeGoalOptions();

    expect(pathReadyGoals).toHaveLength(9);
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
