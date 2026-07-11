import type { AssignmentDraftInput } from './assignment-domain';

export function buildRubricBackedSubjectiveAssignmentFixture(): AssignmentDraftInput {
  return {
    title: '控制系统校正分析作业',
    instructions: '依据给定系统参数说明校正目标、设计依据和验证过程。',
    totalPoints: 20,
    latePolicy: { version: 1, mode: 'CLOSED' },
    responsePolicy: { version: 1, allowedResponseTypes: ['SUBJECTIVE_TEXT'] },
    resubmissionPolicy: { version: 1, maxAttempts: 1, untilDueAt: true },
    solutionReleasePolicy: { version: 1, mode: 'PRIVATE' },
    questions: [{
      stableQuestionId: 'control-correction-analysis',
      responseType: 'SUBJECTIVE_TEXT',
      points: 20,
      prompt: '说明所选校正方法，并给出可复核的时域与频域依据。',
      referenceAnswer: '答案应包含目标指标、校正网络、关键计算过程及结果核验。',
      rubric: {
        schemaVersion: 'assignment-analytic-rubric.v1',
        criteria: [
          {
            id: 'model-and-targets',
            label: '模型与目标',
            maxPoints: 8,
            evidenceDescription: '明确对象模型、指标定义和设计约束。',
            feedbackGuidance: '指出遗漏的模型假设或指标单位。',
            studentVisibleGuidance: '列出模型、指标和约束。',
            levels: [
              { id: 'complete', label: '完整', minPoints: 7, maxPoints: 8, description: '模型、指标与约束完整且一致。' },
              { id: 'partial', label: '部分完成', minPoints: 3, maxPoints: 6.99, description: '核心要素存在但有遗漏。' },
              { id: 'missing', label: '缺失', minPoints: 0, maxPoints: 2.99, description: '无法形成可复核的设计输入。' },
            ],
          },
          {
            id: 'design-and-verification',
            label: '设计与验证',
            maxPoints: 12,
            evidenceDescription: '给出设计过程，并用可复核结果验证目标。',
            feedbackGuidance: '区分设计依据、计算步骤和验证结论。',
            studentVisibleGuidance: '展示设计过程及验证证据。',
            levels: [
              { id: 'complete', label: '完整', minPoints: 10, maxPoints: 12, description: '设计正确，证据充分，结论一致。' },
              { id: 'partial', label: '部分完成', minPoints: 4, maxPoints: 9.99, description: '设计或验证存在局部缺口。' },
              { id: 'missing', label: '缺失', minPoints: 0, maxPoints: 3.99, description: '缺少有效设计或验证证据。' },
            ],
          },
        ],
      },
      source: { family: 'MANUAL', authoringMarker: 'assignment-authoring' },
    }],
  };
}
