import { describe, expect, it } from 'vitest';
import { buildUNIT36SubmissionTelemetry } from '../unit-3-6-zero-design-workshop/submission-telemetry';

describe('buildUNIT36SubmissionTelemetry', () => {
  it('adds answer keys and score to the step-04 pretest submission payload', () => {
    const telemetry = buildUNIT36SubmissionTelemetry({
      stepId: 'step-04',
      submittedAt: 1776307886454,
      answers: {
        q1: 'root-region',
        q2: 'root-locus',
        q3: 'review-goal',
        reason: '容易把频域指标误转为根轨迹入口',
      },
    });

    expect(telemetry).toMatchObject({
      stepId: 'step-04',
      assessmentKind: 'pretest',
      score: 67,
      correctCount: 2,
      totalCount: 3,
      answerKeys: {
        q1: 'root-region',
        q2: 'root-locus',
        q3: 'review-goal',
      },
      answerCompleteness: {
        reasonLength: 15,
      },
    });
  });

  it('adds score to the final quiz submission payload', () => {
    const telemetry = buildUNIT36SubmissionTelemetry({
      stepId: 'step-15',
      submittedAt: 1776307886454,
      answers: {
        q1: 'same-goal',
        q2: 'equivalent-pole',
        q3: 'nmp-boundary',
        reflectionSubmitted: '先判断目标边界。',
      },
    });

    expect(telemetry).toMatchObject({
      assessmentKind: 'posttest',
      score: 100,
      correctCount: 3,
      totalCount: 3,
    });
  });
});
