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
      schemaVersion: 'manifest-submission-v2',
      evidenceQuality: 'rich',
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
      correctCount: 1,
      objectiveTotal: 3,
      score: 33.3,
      subjectiveCompleteness: {
        answeredCount: 1,
        totalCount: 1,
        complete: true,
      },
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

  it('scores drag-match answers against manifest reference matches', () => {
    const telemetry = buildManifestSubmissionTelemetry(
      {
        stepId: 'step-04',
        submittedAt: 1778550644500,
        answers: {
          assumptions: 'linear|small-signal',
        },
      },
      {
        id: 'step-04',
        interactionSpec: {
          interactionKind: 'activity_card_set',
          activityCards: [
            {
              id: 'assumptions',
              title: '默认条件配对',
              prompt: '把条件和解释配对。',
              responseKind: 'drag_match',
              submitScope: 'per_card',
              layoutSpan: 'full',
              options: [],
              matchItems: [
                { value: 'proportional', label: '比例叠加' },
                { value: 'disturbance', label: '小扰动' },
              ],
              matchOptions: [
                { value: 'linear', label: '线性叠加仍成立' },
                { value: 'small-signal', label: '只在工作点附近成立' },
              ],
              referenceMatches: [
                { item: 'proportional', option: 'linear' },
                { item: 'disturbance', option: 'small-signal' },
              ],
            },
          ],
        },
      } as unknown as InteractiveRuntimeStepManifest,
    );

    expect(telemetry).toMatchObject({
      scoringSupported: true,
      correctCount: 1,
      objectiveTotal: 1,
      score: 100,
      questionSummaries: [
        {
          questionId: 'assumptions',
          studentAnswer: 'linear|small-signal',
          referenceValue: ['linear', 'small-signal'],
          isCorrect: true,
        },
      ],
    });
  });

  it('requires ordered answers for drag-match and sort cards', () => {
    const telemetry = buildManifestSubmissionTelemetry(
      {
        stepId: 'step-07',
        submittedAt: 1778550644700,
        answers: {
          assumptions: 'small-signal|linear',
          workflow: 'validate|model|deploy',
        },
      },
      {
        id: 'step-07',
        interactionSpec: {
          interactionKind: 'activity_card_set',
          activityCards: [
            {
              id: 'assumptions',
              title: '默认条件配对',
              prompt: '把条件和解释配对。',
              responseKind: 'drag_match',
              submitScope: 'per_card',
              layoutSpan: 'full',
              options: [],
              matchItems: [
                { value: 'proportional', label: '比例叠加' },
                { value: 'disturbance', label: '小扰动' },
              ],
              matchOptions: [
                { value: 'linear', label: '线性叠加仍成立' },
                { value: 'small-signal', label: '只在工作点附近成立' },
              ],
              referenceMatches: [
                { item: 'proportional', option: 'linear' },
                { item: 'disturbance', option: 'small-signal' },
              ],
            },
            {
              id: 'workflow',
              title: '治理流程排序',
              prompt: '按证据进入治理链路的顺序排序。',
              responseKind: 'drag_sort',
              submitScope: 'per_card',
              layoutSpan: 'full',
              options: [
                { value: 'model', label: '建模' },
                { value: 'validate', label: '验证' },
                { value: 'deploy', label: '发布' },
              ],
            },
          ],
        },
      } as unknown as InteractiveRuntimeStepManifest,
    );

    expect(telemetry).toMatchObject({
      scoringSupported: true,
      correctCount: 0,
      objectiveTotal: 2,
      score: 0,
      questionSummaries: [
        {
          questionId: 'assumptions',
          referenceValue: ['linear', 'small-signal'],
          isCorrect: false,
        },
        {
          questionId: 'workflow',
          referenceValue: ['model', 'validate', 'deploy'],
          isCorrect: false,
        },
      ],
    });
  });

  it('keeps custom extra evidence under a structured namespace', () => {
    const telemetry = buildManifestSubmissionTelemetry(
      {
        stepId: 'step-06',
        submittedAt: 1778550644900,
        answers: {
          boundary: '局部线性化仅在小扰动附近有效。',
        },
      },
      {
        id: 'step-06',
        interactionSpec: {
          interactionKind: 'curve_compare_panel',
          activityCards: [
            {
              id: 'boundary',
              title: '边界判断',
              prompt: '写出边界。',
              responseKind: 'fill_text',
              submitScope: 'per_card',
              layoutSpan: 'full',
              options: [],
            },
          ],
        },
      } as unknown as InteractiveRuntimeStepManifest,
      {
        extraEvidence: {
          parameterSnapshots: {
            saturationLimit: '0.35',
          },
          panelResult: {
            boundaryTouched: true,
          },
        },
      },
    );

    expect(telemetry).toMatchObject({
      schemaVersion: 'manifest-submission-v2',
      evidenceQuality: 'partial',
      parameterSnapshots: {
        saturationLimit: '0.35',
      },
      extraEvidence: {
        panelResult: {
          boundaryTouched: true,
        },
      },
      subjectiveCompleteness: {
        answeredCount: 1,
        totalCount: 1,
        complete: true,
      },
    });
  });
});
