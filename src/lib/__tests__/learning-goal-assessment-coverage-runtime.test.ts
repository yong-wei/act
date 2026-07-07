import { describe, expect, it } from 'vitest';

import { getLearningGoalAssessmentCoverageForPlanner } from '../learning-goal-assessment-coverage-runtime';

describe('LearningGoal assessment coverage runtime', () => {
  it('treats missing LearningGoal coverage rows as blocking limited coverage', () => {
    const coverage = getLearningGoalAssessmentCoverageForPlanner('missing-learning-goal-for-runtime-test');

    expect(coverage).toMatchObject({
      coverageState: 'limited',
      reviewedPathEligibleItemCount: 0,
      limitationReason: 'learning-goal-assessment-coverage-missing:missing-learning-goal-for-runtime-test',
      terminalValidationRequired: true,
      assessmentItemsReplaceTerminalEvidence: false,
    });
    expect(coverage.incompleteStages).toEqual(['readiness', 'practice', 'checkpoint', 'remediation']);
    expect(coverage.matrixVersion).toBe('learning-goal-assessment-coverage.v1');
  });
});
