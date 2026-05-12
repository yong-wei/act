import { describe, expect, it } from 'vitest';

import type { InteractiveRuntimeStepManifest } from '@/lib/interactive-lesson-manifest';
import { buildUNIT44SubmissionTelemetry } from '../unit-4-4-submission-telemetry';

function stepManifest(
  id: string,
  activityCards: Array<{
    id: string;
    prompt: string;
    options: string[];
    referenceAnswer?: string;
  }>,
): InteractiveRuntimeStepManifest {
  return {
    id,
    title: id,
    layout: { template: 'stacked_regions', regions: [] },
    modules: [],
    contentBlocks: {},
    evidenceSequence: [],
    interactionSpec: {
      interactionKind: 'quiz_group',
      activityCards: activityCards.map((card) => ({
        id: card.id,
        prompt: card.prompt,
        responseKind: 'single_choice',
        submitScope: 'per_card',
        layoutSpan: 'full',
        referenceAnswer: card.referenceAnswer,
        options: card.options.map((option) => ({ value: option, label: option })),
      })),
    },
    teacherControls: {
      releaseActivity: 'teacher_toggle',
      openBrowse: 'page_load_open',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'teacher_toggle',
    },
    studentAccess: {},
    teacherInsightSpec: { widgets: [] },
    telemetrySpec: { summaryFields: [], misconceptionTags: [] },
    aiContextSpec: { pageGoal: '', deliveryMode: 'hidden_page_context' },
    interactiveFigureSpec: {},
    previewContract: { demoPath: '' },
    acceptanceChecks: [],
  };
}

describe('buildUNIT44SubmissionTelemetry', () => {
  it('scores step-08 and maps weighted objective evidence to parameter design', () => {
    const telemetry = buildUNIT44SubmissionTelemetry(
      {
        stepId: 'step-08',
        submittedAt: 1778550421493,
        answers: { 'weight-preference': 'C' },
      },
      stepManifest('step-08', [
        {
          id: 'weight-preference',
          prompt: '若更担心动作代价继续抬高，更应优先保留哪一组偏好？',
          options: ['A', 'B', 'C'],
        },
      ]),
    );

    expect(telemetry).toMatchObject({
      moduleId: 'step-08',
      score: 100,
      outcome: 'success',
      evidenceTitle: '4-4 step-08：目标函数与权重表达',
      competencyContribution: {
        parameterDesign: 0.7,
        controlModeling: 0.4,
      },
    });
    expect(telemetry?.answerDigest).toEqual({
      'weight-preference': 'C',
    });
    if (!telemetry) {
      throw new Error('Expected step-08 telemetry');
    }
    expect(telemetry.questionSummaries).toEqual([
      expect.objectContaining({
        questionId: 'weight-preference',
        studentAnswer: 'C',
        referenceAnswer: 'C',
        isCorrect: true,
      }),
    ]);
  });

  it('scores step-10 and maps Pareto interpretation to engineering decision', () => {
    const telemetry = buildUNIT44SubmissionTelemetry(
      {
        stepId: 'step-10',
        submittedAt: 1778550900000,
        answers: { 'pareto-meaning': '因为它保留的是一组非支配候选' },
      },
      stepManifest('step-10', [
        {
          id: 'pareto-meaning',
          prompt: '为什么 Pareto front 不是再选一个绝对最优？',
          options: ['因为它保留的是一组非支配候选', '因为图还没画完', '因为权重没有填完'],
        },
      ]),
    );

    expect(telemetry).toMatchObject({
      moduleId: 'step-10',
      score: 100,
      outcome: 'success',
      evidenceTitle: '4-4 step-10：候选解与 Pareto 解释',
      competencyContribution: {
        engineeringDecision: 0.7,
        parameterDesign: 0.5,
      },
    });
    expect(telemetry?.answerDigest).toEqual({
      'pareto-meaning': '因为它保留的是一组非支配候选',
    });
  });

  it('scores post assessment answers and maps them to reflection and transfer', () => {
    const telemetry = buildUNIT44SubmissionTelemetry(
      {
        stepId: 'step-13',
        submittedAt: 1778551472376,
        answers: {
          'post-quiz-1': '因为还没有经过 4-5 的工程复核',
          'post-quiz-2': '因为图还没画完',
          'post-quiz-3': '因为任务通道变了，收益项和代价项必须跟着改写',
        },
      },
      stepManifest('step-13', [
        {
          id: 'post-quiz-1',
          prompt: '为什么本课保留下来的只能叫“候选族”，而不是最终可用解？',
          options: ['因为还没有经过 4-5 的工程复核', '因为参数还没有写成向量', '因为调节时间没有下降'],
        },
        {
          id: 'post-quiz-2',
          prompt: '为什么 Pareto front 不是再选一个绝对最优？',
          options: ['因为它保留的是一组非支配候选', '因为图还没画完', '因为权重没有归一化'],
        },
        {
          id: 'post-quiz-3',
          prompt: '为什么横摇案例不能继续沿用航向保持中的目标语言？',
          options: ['因为任务通道变了，收益项和代价项必须跟着改写', '因为横摇对象没有积分环节', '因为参数范围必须改成负数'],
        },
      ]),
    );

    expect(telemetry).toMatchObject({
      moduleId: 'step-13',
      score: 67,
      outcome: 'partial',
      evidenceTitle: '4-4 step-13：后测与总结判断',
      competencyContribution: {
        inquiryReflection: 0.6,
        selfDirectedLearning: 0.4,
        crossDomainTransfer: 0.4,
      },
    });
    expect(telemetry?.answerDigest).toEqual({
      'post-quiz-1': '因为还没有经过 4-5 的工程复核',
      'post-quiz-2': '因为图还没画完',
      'post-quiz-3': '因为任务通道变了，收益项和代价项必须跟着改写',
    });
    if (!telemetry) {
      throw new Error('Expected step-13 telemetry');
    }
    expect(telemetry.questionSummaries).toEqual([
      expect.objectContaining({ questionId: 'post-quiz-1', isCorrect: true }),
      expect.objectContaining({ questionId: 'post-quiz-2', isCorrect: false }),
      expect.objectContaining({ questionId: 'post-quiz-3', isCorrect: true }),
    ]);
  });

  it('does not emit scored telemetry for unsupported or incomplete steps', () => {
    expect(buildUNIT44SubmissionTelemetry(
      {
        stepId: 'step-12',
        submittedAt: 1778551000000,
        answers: { reflection: '需要改写目标函数。' },
      },
      stepManifest('step-12', [
        {
          id: 'reflection',
          prompt: '写出横摇案例为什么需要改写目标函数。',
          options: [],
        },
      ]),
    )).toBeNull();

    expect(buildUNIT44SubmissionTelemetry(
      {
        stepId: 'step-08',
        submittedAt: 1778551000000,
        answers: { unknown: 'C' },
      },
      stepManifest('step-08', [
        {
          id: 'unknown',
          prompt: '未登记参考答案的问题。',
          options: ['A', 'B', 'C'],
        },
      ]),
    )).toBeNull();
  });

  it('does not score target steps when required answers are missing or blank', () => {
    expect(buildUNIT44SubmissionTelemetry(
      {
        stepId: 'step-13',
        submittedAt: 1778551432404,
        answers: {
          'post-quiz-3': '因为任务通道变了，收益项和代价项必须跟着改写',
        },
      },
      stepManifest('step-13', [
        {
          id: 'post-quiz-1',
          prompt: '为什么本课得到的无约束候选还不能直接视为最终工程方案？',
          options: [],
        },
        {
          id: 'post-quiz-2',
          prompt: '为什么 Pareto front 上会保留一族候选？',
          options: [],
        },
        {
          id: 'post-quiz-3',
          prompt: '横摇通道迁移时，为什么目标函数必须改写？',
          options: [],
        },
      ]),
    )).toBeNull();

    expect(buildUNIT44SubmissionTelemetry(
      {
        stepId: 'step-08',
        submittedAt: 1778550421493,
        answers: { 'weight-preference': '   ' },
      },
      stepManifest('step-08', [
        {
          id: 'weight-preference',
          prompt: '若更担心动作代价继续抬高，更应优先保留哪一组偏好？',
          options: ['A', 'B', 'C'],
        },
      ]),
    )).toBeNull();
  });
});
