import { describe, expect, it } from 'vitest';

import { reviewState } from '../teacher-ai-grading-lab-workspace';

describe('teacher AI grading lab workspace', () => {
  it('marks a succeeded execution without an AI score as requiring review', () => {
    expect(reviewState({
      evaluationRunId: 'batch-1', sampleId: 'sample-1', questionId: 'T2-1', repetitionOrdinal: 1,
      state: 'SUCCEEDED', aiScore: null, draftScore: null, teacherScore: null, scoreDifference: null,
      failureStage: null, errorCode: null,
    })).toBe('待复核');
  });

  it('marks a succeeded execution with an AI score as completed', () => {
    expect(reviewState({
      evaluationRunId: 'batch-1', sampleId: 'sample-1', questionId: 'T2-1', repetitionOrdinal: 1,
      state: 'SUCCEEDED', aiScore: 8, draftScore: 8, teacherScore: 8, scoreDifference: 0,
      failureStage: null, errorCode: null,
    })).toBe('已完成');
  });
});
