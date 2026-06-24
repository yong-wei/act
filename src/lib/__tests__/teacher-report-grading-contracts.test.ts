import { describe, expect, it } from 'vitest';

import {
  buildTeacherGradingMissingRunState,
  buildTeacherGradingRouteState,
  buildTeacherReportDeliveryState,
  normalizeTeacherGradingRouteQuery,
  normalizeTeacherReportDeliveryQuery,
  resolveTeacherReturnTo,
} from '../teacher-report-grading-contracts';

describe('teacher report and grading audit contracts', () => {
  it('builds report export and missing-student delivery states', () => {
    const exportQuery = normalizeTeacherReportDeliveryQuery({
      action: 'export',
      report: 'control-correction',
      format: 'json',
    }, 'class-1');
    expect(buildTeacherReportDeliveryState(exportQuery)).toMatchObject({
      status: 'pending',
      identity: {
        category: 'export',
        targetId: 'control-correction',
      },
    });

    const missingStudent = normalizeTeacherReportDeliveryQuery({
      action: 'send',
      studentId: 'missing-batch58',
      returnTo: '/teacher/classes/class-1/analytics-v2',
    }, 'class-1');
    expect(buildTeacherReportDeliveryState(missingStudent)).toMatchObject({
      status: 'blocked',
      httpStatus: 404,
      recoveryAction: '回到班级学生列表选择有效学生',
    });
  });

  it('maps every report delivery action to supported teacher states', () => {
    const cases = [
      ['download', 'export', 'pending'],
      ['send', 'send', 'pending'],
      ['deliver', 'send', 'pending'],
      ['lock', 'save', 'blocked'],
      ['summary', 'save', 'pending'],
      ['reinforcement', 'save', 'pending'],
    ] as const;

    cases.forEach(([action, category, status]) => {
      const query = normalizeTeacherReportDeliveryQuery({
        action,
        report: 'control-correction',
      }, 'class-1');
      expect(buildTeacherReportDeliveryState(query)).toMatchObject({
        status,
        identity: {
          category,
          requestedAction: action,
        },
      });
    });

    const unsupported = normalizeTeacherReportDeliveryQuery({
      action: 'print',
    }, 'class-1');
    expect(buildTeacherReportDeliveryState(unsupported)).toMatchObject({
      status: 'unsupported',
      identity: {
        category: 'unsupported-action',
        requestedAction: 'unsupported',
      },
    });
  });

  it('maps grading missing run and unsupported method into teacher states', () => {
    const missingRun = normalizeTeacherGradingRouteQuery({
      gradingRunId: 'missing-batch58',
      action: 'approve',
      returnTo: '/teacher/classes/class-1/analytics-v2',
    });
    expect(buildTeacherGradingRouteState(missingRun)).toMatchObject({
      status: 'blocked',
      httpStatus: 404,
      identity: {
        targetId: 'missing-batch58',
      },
    });

    const unsupportedGet = normalizeTeacherGradingRouteQuery({
      method: 'get',
      assignment: 'report-control-design',
    });
    expect(buildTeacherGradingRouteState(unsupportedGet)).toMatchObject({
      status: 'unsupported',
      httpStatus: 405,
    });
  });

  it('maps grading approval, writeback, draft, and arbitrary missing run states', () => {
    const approveWithoutRun = normalizeTeacherGradingRouteQuery({ action: 'approve' });
    expect(buildTeacherGradingRouteState(approveWithoutRun)).toMatchObject({
      status: 'blocked',
      httpStatus: 400,
      identity: {
        category: 'approve',
      },
    });

    const writebackWithoutRun = normalizeTeacherGradingRouteQuery({ action: 'writeback' });
    expect(buildTeacherGradingRouteState(writebackWithoutRun)).toMatchObject({
      status: 'blocked',
      httpStatus: 400,
      identity: {
        category: 'writeback',
      },
    });

    const draft = normalizeTeacherGradingRouteQuery({
      gradingRunId: 'run-1',
      status: 'draft',
    });
    expect(buildTeacherGradingRouteState(draft)).toMatchObject({
      status: 'pending',
      nextAction: '打开有效 gradingRunId 后审批或返回学生修改',
    });

    const arbitraryMissingRun = normalizeTeacherGradingRouteQuery({
      gradingRunId: 'run-does-not-exist',
      action: 'approve',
    });
    expect(buildTeacherGradingMissingRunState(arbitraryMissingRun)).toMatchObject({
      status: 'blocked',
      httpStatus: 404,
      message: '评分运行 run-does-not-exist 不存在或当前教师不可见。',
    });
  });

  it('keeps returnTo inside teacher routes only', () => {
    expect(resolveTeacherReturnTo('/teacher/grading-workbench?gradingRunId=run-1', '/teacher/classes')).toBe(
      '/teacher/grading-workbench?gradingRunId=run-1',
    );
    expect(resolveTeacherReturnTo('/admin/users', '/teacher/classes')).toBe('/teacher/classes');
    expect(resolveTeacherReturnTo('https://evil.example', '/teacher/classes')).toBe('/teacher/classes');
  });
});
