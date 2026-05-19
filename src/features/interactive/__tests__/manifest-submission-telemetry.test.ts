import { describe, expect, it } from 'vitest';
import type { InteractiveRuntimeStepManifest } from '@/lib/interactive-lesson-manifest';
import { buildManifestSubmissionTelemetry } from '../shared/manifest-runtime/submission-telemetry';

describe('buildManifestSubmissionTelemetry', () => {
  it('preserves manifest response answers and objective card scoring evidence', () => {
    const telemetry = buildManifestSubmissionTelemetry(
      {
        stepId: 'step-02',
        submittedAt: 1778550642900,
        answers: {
          'model-order': 'A',
          'disturbance-boundary': 'B',
          reflection: '需要补充扰动边界。',
        },
      },
      {
        id: 'step-02',
        interactionSpec: {
          interactionKind: 'quiz_group',
          activityCards: [
            {
              id: 'model-order',
              title: '模型阶次',
              prompt: '名义模型阶次应如何处理？',
              responseKind: 'single_choice',
              submitScope: 'per_card',
              layoutSpan: 'half',
              options: [],
              referenceAnswer: 'A',
            },
            {
              id: 'disturbance-boundary',
              title: '扰动边界',
              prompt: '扰动边界是否可忽略？',
              responseKind: 'single_choice',
              submitScope: 'per_card',
              layoutSpan: 'half',
              options: [],
              referenceAnswer: 'A',
            },
            {
              id: 'reflection',
              title: '边界反思',
              prompt: '写出一项边界证据。',
              responseKind: 'fill_text',
              submitScope: 'per_card',
              layoutSpan: 'full',
              options: [],
              referenceAnswer: '需要补充扰动边界。',
            },
          ],
        },
      } as unknown as InteractiveRuntimeStepManifest,
    );

    expect(telemetry).toMatchObject({
      stepId: 'step-02',
      submittedAt: 1778550642900,
      responseKind: 'manifest_step_response',
      interactionKind: 'quiz_group',
      answers: {
        'model-order': 'A',
        'disturbance-boundary': 'B',
        reflection: '需要补充扰动边界。',
      },
      questionSummaries: [
        {
          questionId: 'model-order',
          studentAnswer: 'A',
          referenceAnswer: 'A',
          isCorrect: true,
        },
        {
          questionId: 'disturbance-boundary',
          studentAnswer: 'B',
          referenceAnswer: 'A',
          isCorrect: false,
        },
      ],
      scoringSupported: true,
    });
  });
});
