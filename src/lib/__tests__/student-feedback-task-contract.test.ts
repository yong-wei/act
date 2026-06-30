import { describe, expect, it } from 'vitest';

import {
  buildAdaptivePathLaunchHref,
  resolveAdaptivePathLaunchReturnContext,
} from '@/features/adaptive/adaptive-learning-center-contracts';
import {
  buildFeedbackTaskContext,
  buildFeedbackTaskHref,
  buildFeedbackTaskStatusState,
  buildPortfolioFeedbackDraft,
  getFeedbackTaskMissionTarget,
  shouldRenderPortfolioFeedbackTask,
  resolveVerifiedTeacherInterventionId,
  type StudentFeedbackTaskContext,
} from '../student-feedback-task-contract';

function expectContext(context: StudentFeedbackTaskContext | null): StudentFeedbackTaskContext {
  expect(context).not.toBeNull();
  return context as StudentFeedbackTaskContext;
}

describe('student feedback task contract', () => {
  it('normalizes a returned report feedback assignment into a visible lifecycle context', () => {
    const context = expectContext(buildFeedbackTaskContext({
      assignment: 'report-control-design',
      criterion: 'model-assumptions',
      source: 'batch59',
      status: 'returned',
      action: 'adopt',
      returnTo: '/assessment/document-feedback?gradingRunId=grading-1',
    }));

    expect(context).toMatchObject({
      assignmentId: 'report-control-design',
      assignmentTitle: '控制设计报告反馈',
      criterionId: 'model-assumptions',
      criterionLabel: '模型假设',
      source: 'batch59',
      lifecycleState: 'adopted',
      completionTarget: 'evidence-growth-portfolio',
      returnHref: '/assessment/document-feedback?gradingRunId=grading-1&assignment=report-control-design&criterion=model-assumptions&status=adopted&source=batch59',
    });
    expect(context.supported).toBe(true);
    expect(context.badges).toEqual(expect.arrayContaining([
      '反馈任务：控制设计报告反馈',
      '量规项：模型假设',
      '状态：已采用',
    ]));
  });

  it('builds a recoverable missing-context state for unknown assignments', () => {
    const context = expectContext(buildFeedbackTaskContext({
      assignment: 'missing-batch56',
      criterion: 'missing-criterion',
      returnTo: 'https://example.com/unsafe',
    }));

    expect(context).toMatchObject({
      assignmentId: 'missing-batch56',
      assignmentTitle: '未知反馈任务',
      criterionId: 'missing-criterion',
      lifecycleState: 'missing',
      supported: false,
      returnHref: '/assessment/document-feedback?assignment=missing-batch56&criterion=missing-criterion&status=missing',
    });
    expect(context.summary).toContain('反馈任务不存在');
  });

  it('supports dynamic document feedback assignments without downgrading them to missing', () => {
    const context = expectContext(buildFeedbackTaskContext({
      assignment: 'report-1',
      criterion: 'validation',
      source: 'document-feedback',
      status: 'returned',
      returnTo: '/assessment/document-feedback?gradingRunId=grading-1',
    }));

    expect(context).toMatchObject({
      assignmentId: 'report-1',
      assignmentTitle: '报告评分反馈',
      criterionId: 'validation',
      criterionLabel: 'validation',
      source: 'document-feedback',
      lifecycleState: 'returned',
      supported: true,
      completionTarget: 'evidence-growth-portfolio',
      returnHref: '/assessment/document-feedback?gradingRunId=grading-1&assignment=report-1&criterion=validation&status=returned&source=document-feedback',
    });
    expect(getFeedbackTaskMissionTarget(context)).toMatchObject({
      missionOrders: [2, 3, 4],
    });
  });

  it('does not support arbitrary unknown assignments without document feedback source', () => {
    const context = expectContext(buildFeedbackTaskContext({
      assignment: 'report-1',
      criterion: 'validation',
      source: 'batch59',
      status: 'returned',
    }));

    expect(context.supported).toBe(false);
    expect(context.lifecycleState).toBe('missing');
    expect(getFeedbackTaskMissionTarget(context)).toBeNull();
  });

  it('rejects backslash return targets that browsers can normalize to another origin', () => {
    const context = expectContext(buildFeedbackTaskContext({
      assignment: 'report-control-design',
      criterion: 'model-assumptions',
      returnTo: '/\\evil.example',
    }));

    expect(context.returnTo).toBeNull();
    expect(buildFeedbackTaskHref('/profile/evidence', context)).not.toContain('returnTo=');
  });

  it('preserves assignment, criterion, source, status, and safe return target across destinations', () => {
    const context = expectContext(buildFeedbackTaskContext({
      assignment: 'report-control-design',
      criterion: 'simulation-evidence',
      source: 'batch58',
      status: 'completed',
      returnTo: '/assessment/document-feedback?gradingRunId=grading-2',
    }));

    expect(buildFeedbackTaskHref('/profile/evidence', context, { status: 'completed' })).toBe(
      '/profile/evidence?assignment=report-control-design&criterion=simulation-evidence&status=completed&source=batch58&returnTo=%2Fassessment%2Fdocument-feedback%3FgradingRunId%3Dgrading-2',
    );
    expect(buildFeedbackTaskHref('/profile/portfolio?category=reflection', context, { intent: 'collect' })).toBe(
      '/profile/portfolio?category=reflection&assignment=report-control-design&criterion=simulation-evidence&status=completed&source=batch58&intent=collect&returnTo=%2Fassessment%2Fdocument-feedback%3FgradingRunId%3Dgrading-2',
    );
  });

  it('does not append internal feedback parameters to external destinations', () => {
    const context = expectContext(buildFeedbackTaskContext({
      assignment: 'report-1',
      criterion: 'validation',
      source: 'document-feedback',
      status: 'returned',
      returnTo: '/assessment/document-feedback?gradingRunId=grading-1',
    }));

    expect(buildFeedbackTaskHref('https://ocw.mit.edu/control/bode', context, { action: 'revise' })).toBe(
      'https://ocw.mit.edu/control/bode',
    );
    expect(buildFeedbackTaskHref('//ocw.mit.edu/control/bode', context, { action: 'revise' })).toBe(
      '//ocw.mit.edu/control/bode',
    );
  });

  it('preserves internal URL fragments after appended feedback parameters', () => {
    const context = expectContext(buildFeedbackTaskContext({
      assignment: 'report-1',
      criterion: 'validation',
      source: 'document-feedback',
      status: 'returned',
    }));

    expect(buildFeedbackTaskHref('/course.md#chunk-001', context)).toBe(
      '/course.md?assignment=report-1&criterion=validation&status=returned&source=document-feedback#chunk-001',
    );
    expect(buildFeedbackTaskHref('/course.md?view=compact#page=12', context, { intent: 'revise' })).toBe(
      '/course.md?view=compact&assignment=report-1&criterion=validation&status=returned&source=document-feedback&intent=revise#page=12',
    );
  });

  it('preserves adaptive path source while carrying feedback source separately', () => {
    const context = expectContext(buildFeedbackTaskContext({
      assignment: 'report-1',
      criterion: 'validation',
      source: 'document-feedback',
      status: 'returned',
      returnTo: '/assessment/document-feedback?gradingRunId=grading-1',
    }));
    const launchHref = buildAdaptivePathLaunchHref('/interactive-learning/resources/lesson09-correction-precheck', {
      goalId: 'control-correction',
      pathId: 'path-1',
      nodeId: 'node-1',
      routeIntent: 'path-execution',
      resourceType: 'resource',
    });
    const wrappedHref = buildFeedbackTaskHref(launchHref, context);
    const wrappedParams = new URLSearchParams(wrappedHref.split('?')[1] ?? '');

    expect(wrappedParams.get('source')).toBe('adaptive-path-center');
    expect(wrappedParams.get('feedbackSource')).toBe('document-feedback');
    expect(wrappedParams.get('assignment')).toBe('report-1');
    expect(wrappedParams.get('criterion')).toBe('validation');
    expect(resolveAdaptivePathLaunchReturnContext(wrappedParams)).toMatchObject({
      source: 'adaptive-path-center',
      goalId: 'control-correction',
      pathId: 'path-1',
      nodeId: 'node-1',
    });
    expect(buildFeedbackTaskContext(Object.fromEntries(wrappedParams))).toMatchObject({
      assignmentId: 'report-1',
      source: 'document-feedback',
      supported: true,
    });
  });

  it('maps lifecycle status and route actions to audited student-visible states', () => {
    const returned = expectContext(buildFeedbackTaskContext({
      assignment: 'report-control-design',
      status: 'returned',
    }));
    const writebackRequested = expectContext(buildFeedbackTaskContext({
      assignment: 'report-control-design',
      status: 'completed',
      action: 'writeback',
    }));
    const writtenBack = expectContext(buildFeedbackTaskContext({
      assignment: 'report-control-design',
      status: 'written-back',
    }));
    const teacherVisibleWithoutIntervention = expectContext(buildFeedbackTaskContext({
      assignment: 'report-control-design',
      status: 'teacher-visible',
    }));

    expect(buildFeedbackTaskStatusState(returned, '/assessment/document-feedback')).toMatchObject({
      status: 'pending',
      identity: {
        category: 'writeback',
        targetId: 'report-control-design',
      },
      message: expect.stringContaining('已返回'),
      nextAction: expect.stringContaining('采用'),
    });
    expect(buildFeedbackTaskStatusState(writebackRequested, '/assessment/document-feedback')).toMatchObject({
      status: 'pending',
      message: expect.stringContaining('等待写回'),
    });
    expect(buildFeedbackTaskStatusState(writtenBack, '/assessment/document-feedback')).toMatchObject({
      status: 'succeeded',
      message: expect.stringContaining('反馈任务已写回'),
    });
    expect(buildFeedbackTaskStatusState(teacherVisibleWithoutIntervention, '/assessment/document-feedback')).toMatchObject({
      status: 'succeeded',
      message: expect.stringContaining('反馈任务已写回'),
    });
  });

  it('does not trust query-only teacher intervention identity as student-visible writeback', () => {
    const context = expectContext(buildFeedbackTaskContext({
      assignment: 'report-control-design',
      status: 'teacher-visible',
      source: 'teacher-intervention',
      teacherInterventionId: 'teacher-intervention:feedback:ref-abc1234',
    }));

    expect(context).toMatchObject({
      lifecycleState: 'completed',
      teacherInterventionId: 'teacher-intervention:feedback:ref-abc1234',
      teacherIntervention: null,
    });
    expect(buildFeedbackTaskStatusState(context, '/assessment/document-feedback')).toMatchObject({
      status: 'pending',
      message: expect.stringContaining('等待写回'),
    });
    expect(buildFeedbackTaskHref('/profile/evidence', context)).toContain(
      'teacherInterventionId=teacher-intervention%3Afeedback%3Aref-abc1234',
    );
  });

  it('does not trust query-only teacher intervention identity as written-back state', () => {
    const context = expectContext(buildFeedbackTaskContext({
      assignment: 'report-control-design',
      status: 'written-back',
      source: 'teacher-intervention',
      teacherInterventionId: 'teacher-intervention:feedback:ref-written-back',
    }));

    expect(context).toMatchObject({
      lifecycleState: 'completed',
      teacherInterventionId: 'teacher-intervention:feedback:ref-written-back',
      teacherIntervention: null,
    });
    expect(buildFeedbackTaskStatusState(context, '/assessment/document-feedback')).toMatchObject({
      status: 'pending',
      message: expect.stringContaining('等待写回'),
    });
  });

  it('preserves server-verified teacher intervention visibility', () => {
    const teacherInterventionId = 'teacher-intervention:feedback:ref-server-visible';
    const context = expectContext(buildFeedbackTaskContext({
      assignment: 'report-control-design',
      status: 'teacher-visible',
      source: 'teacher-intervention',
      teacherInterventionId,
    }, { verifiedTeacherInterventionId: teacherInterventionId }));

    expect(context).toMatchObject({
      lifecycleState: 'teacher-visible',
      teacherInterventionId,
      teacherIntervention: {
        id: teacherInterventionId,
        status: 'student-visible',
        label: '教师处置已对学生可见',
      },
    });
    expect(buildFeedbackTaskStatusState(context, '/assessment/document-feedback')).toMatchObject({
      status: 'succeeded',
      message: expect.stringContaining('教师处置已写回'),
    });
    expect(buildFeedbackTaskHref('/profile/evidence', context)).toContain(
      'teacherInterventionId=teacher-intervention%3Afeedback%3Aref-server-visible',
    );
  });

  it('only verifies student-visible outbox rows for the matching assignment', async () => {
    const visiblePayload = {
      intervention: {
        id: 'teacher-intervention:feedback:ref-visible',
        status: 'student-visible',
        studentFacingTarget: {
          href: '/assessment/document-feedback?assignment=report-control-design&status=teacher-visible',
        },
      },
    };
    const recordedPayload = {
      intervention: {
        id: 'teacher-intervention:feedback:ref-recorded',
        status: 'recorded',
        studentFacingTarget: { href: null },
      },
    };
    const db = (payload: unknown) => ({
      evidenceOutbox: {
        findFirst: async () => ({ causationId: 'teacher-intervention:feedback:ref-visible', payload }),
      },
    });

    await expect(resolveVerifiedTeacherInterventionId({
      db: db(visiblePayload),
      userId: 'student-1',
      teacherInterventionId: 'teacher-intervention:feedback:ref-visible',
      assignment: 'report-control-design',
    })).resolves.toBe('teacher-intervention:feedback:ref-visible');
    await expect(resolveVerifiedTeacherInterventionId({
      db: db(recordedPayload),
      userId: 'student-1',
      teacherInterventionId: 'teacher-intervention:feedback:ref-recorded',
      assignment: 'report-control-design',
    })).resolves.toBeNull();
    await expect(resolveVerifiedTeacherInterventionId({
      db: db(visiblePayload),
      userId: 'student-1',
      teacherInterventionId: 'teacher-intervention:feedback:ref-visible',
      assignment: 'other-assignment',
    })).resolves.toBeNull();
  });

  it('maps supported feedback assignments to explicit mission orders instead of full-text searching ids', () => {
    const context = expectContext(buildFeedbackTaskContext({
      assignment: 'report-control-design',
      status: 'completed',
    }));

    expect(getFeedbackTaskMissionTarget(context)).toMatchObject({
      missionOrders: [2, 3, 4],
      reason: expect.stringContaining('PID'),
    });
  });

  it('creates a portfolio candidate draft without falsely claiming persistence', () => {
    const context = expectContext(buildFeedbackTaskContext({
      assignment: 'report-control-design',
      criterion: 'engineering-rationale',
      status: 'completed',
      source: 'batch59',
    }));

    expect(buildPortfolioFeedbackDraft(context)).toMatchObject({
      id: 'portfolio-candidate:report-control-design:engineering-rationale',
      status: 'candidate',
      persisted: false,
      source: 'batch59',
      title: '控制设计报告反馈收录候选',
      returnHref: '/assessment/document-feedback?assignment=report-control-design&criterion=engineering-rationale&status=completed&source=batch59',
    });
  });

  it('does not treat portfolio reflection assignment as a feedback task', () => {
    expect(shouldRenderPortfolioFeedbackTask({
      assignment: 'ai-collaboration',
      intent: 'create',
    })).toBe(false);
    expect(shouldRenderPortfolioFeedbackTask({
      assignment: 'ai-collaboration',
      intent: 'reflection-review',
    })).toBe(false);
    expect(shouldRenderPortfolioFeedbackTask({
      assignment: 'ai-collaboration',
      intent: 'collect',
    })).toBe(false);
    expect(shouldRenderPortfolioFeedbackTask({
      assignment: 'report-control-design',
      intent: 'collect',
    })).toBe(true);
    expect(shouldRenderPortfolioFeedbackTask({
      assignment: 'report-1',
      criterion: 'validation',
      source: 'document-feedback',
      intent: 'collect',
    })).toBe(true);
  });
});
