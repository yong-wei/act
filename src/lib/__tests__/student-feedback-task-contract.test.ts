import { describe, expect, it } from 'vitest';

import {
  buildFeedbackTaskContext,
  buildFeedbackTaskHref,
  buildFeedbackTaskStatusState,
  buildPortfolioFeedbackDraft,
  getFeedbackTaskMissionTarget,
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
      message: expect.stringContaining('已写回'),
      nextAction: expect.stringContaining('证据'),
    });
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
});
