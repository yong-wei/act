import { describe, expect, it } from 'vitest';

import { createTeacherAiGradingControlledStrataSnapshot } from '../teacher-ai-grading-lab-strata';

describe('teacher AI grading controlled strata', () => {
  it('derives question-level visual and type strata from structural counts', () => {
    const snapshot = createTeacherAiGradingControlledStrataSnapshot([
      { sampleId: 'sample-b', questionId: 'T2-1', imageCount: 0, formulaCount: 2 },
      { sampleId: 'sample-a', questionId: 'T2-3', imageCount: 1, formulaCount: 0 },
      { sampleId: 'sample-a', questionId: 'O2', imageCount: 0, formulaCount: 0 },
    ]);

    expect(snapshot.strata).toEqual([
      { sampleId: 'sample-a', questionId: 'O2', questionType: 'text-response', hasVisualEvidence: false },
      { sampleId: 'sample-a', questionId: 'T2-3', questionType: 'hand-drawn-or-diagram', hasVisualEvidence: true },
      { sampleId: 'sample-b', questionId: 'T2-1', questionType: 'formula-response', hasVisualEvidence: false },
    ]);
    expect(snapshot.contentHash).toMatch(/^sha256:/);
  });

  it('rejects duplicate question structures', () => {
    expect(() => createTeacherAiGradingControlledStrataSnapshot([
      { sampleId: 'sample-a', questionId: 'T2-3', imageCount: 1, formulaCount: 0 },
      { sampleId: 'sample-a', questionId: 'T2-3', imageCount: 1, formulaCount: 0 },
    ])).toThrow('teacher-ai-grading-controlled-strata-duplicate');
  });
});
