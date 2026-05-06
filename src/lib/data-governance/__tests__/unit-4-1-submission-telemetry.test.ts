import { describe, expect, it } from 'vitest';

import { buildUNIT41SubmissionTelemetry } from '../unit-4-1-submission-telemetry';

describe('buildUNIT41SubmissionTelemetry', () => {
  it('scores the 4-1 post assessment and maps it to lesson-specific competency dimensions', () => {
    const telemetry = buildUNIT41SubmissionTelemetry({
      stepId: 'step-12',
      submittedAt: 1778039644995,
      answers: {
        'post-q1': 'B',
        'post-q2': 'B',
        'post-q3': 'B',
      },
    });

    expect(telemetry).toMatchObject({
      moduleId: 'step-12',
      score: 100,
      outcome: 'success',
      evidenceTitle: '4-1 后测：任务表达出口判断',
    });
    expect(telemetry.competencyContribution).toMatchObject({
      engineeringDecision: 0.9,
      parameterDesign: 0.7,
      crossDomainTransfer: 0.6,
    });
    expect(telemetry.questionSummaries).toHaveLength(3);
    expect(telemetry.questionSummaries[0]).toMatchObject({
      questionId: 'post-q1',
      studentAnswer: 'B',
      referenceAnswer: 'B',
      isCorrect: true,
    });
  });

  it('marks partially correct diagnostic submissions as partial instead of blanket success', () => {
    const telemetry = buildUNIT41SubmissionTelemetry({
      stepId: 'step-03',
      submittedAt: 1778034784083,
      answers: {
        'pretest-q1': 'A',
        'pretest-q2': 'B',
      },
    });

    expect(telemetry.score).toBe(33);
    expect(telemetry.outcome).toBe('failure');
    expect(telemetry.questionSummaries).toMatchObject([
      { questionId: 'pretest-q1', isCorrect: false },
      { questionId: 'pretest-q2', isCorrect: true },
      { questionId: 'pretest-q3', isCorrect: false },
    ]);
  });
});
