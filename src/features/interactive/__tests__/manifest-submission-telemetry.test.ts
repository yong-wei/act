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
          'model-order': 'a',
          'disturbance-boundary': 'b',
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
              options: [
                { value: 'a', label: '保留名义模型阶次。' },
                { value: 'b', label: '忽略模型阶次。' },
              ],
              referenceAnswer: '选 A。名义模型阶次应保留为二阶。',
            },
            {
              id: 'disturbance-boundary',
              title: '扰动边界',
              prompt: '扰动边界是否可忽略？',
              responseKind: 'single_choice',
              submitScope: 'per_card',
              layoutSpan: 'half',
              options: [
                { value: 'a', label: '不能忽略。' },
                { value: 'b', label: '可以忽略。' },
              ],
              referenceAnswer: '选 A。扰动边界不能忽略。',
            },
            {
              id: 'stability-margin',
              title: '稳定裕度',
              prompt: '稳定裕度是否可以省略？',
              responseKind: 'single_choice',
              submitScope: 'per_card',
              layoutSpan: 'half',
              options: [
                { value: 'a', label: '不能省略。' },
                { value: 'b', label: '可以省略。' },
              ],
              referenceAnswer: '选 A。稳定裕度必须纳入证据。',
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
        'model-order': 'a',
        'disturbance-boundary': 'b',
        reflection: '需要补充扰动边界。',
      },
      questionSummaries: [
        {
          questionId: 'model-order',
          studentAnswer: 'a',
          referenceAnswer: '选 A。名义模型阶次应保留为二阶。',
          referenceValue: 'a',
          answered: true,
          isCorrect: true,
        },
        {
          questionId: 'disturbance-boundary',
          studentAnswer: 'b',
          referenceAnswer: '选 A。扰动边界不能忽略。',
          referenceValue: 'a',
          answered: true,
          isCorrect: false,
        },
        {
          questionId: 'stability-margin',
          studentAnswer: null,
          referenceAnswer: '选 A。稳定裕度必须纳入证据。',
          referenceValue: 'a',
          answered: false,
          isCorrect: false,
        },
      ],
      scoringSupported: true,
    });
  });

  it('scores multi-choice answers serialized with a single pipe', () => {
    const telemetry = buildManifestSubmissionTelemetry(
      {
        stepId: 'step-11',
        submittedAt: 1778550643900,
        answers: {
          'multi-evidence': 'a|b',
        },
      },
      {
        id: 'step-11',
        interactionSpec: {
          interactionKind: 'quiz_group',
          activityCards: [
            {
              id: 'multi-evidence',
              title: '多选证据',
              prompt: '哪些证据需要同时保留？',
              responseKind: 'multi_choice',
              submitScope: 'per_card',
              layoutSpan: 'half',
              options: [
                { value: 'a', label: '航迹偏离。' },
                { value: 'b', label: '舵角边界。' },
                { value: 'c', label: '文件名。' },
              ],
              referenceAnswer: '选 A、B。航迹与执行边界都需要保留。',
            },
          ],
        },
      } as unknown as InteractiveRuntimeStepManifest,
    );

    expect(telemetry).toMatchObject({
      questionSummaries: [
        {
          questionId: 'multi-evidence',
          studentAnswer: 'a|b',
          referenceValue: ['a', 'b'],
          answered: true,
          isCorrect: true,
        },
      ],
    });
  });
});
