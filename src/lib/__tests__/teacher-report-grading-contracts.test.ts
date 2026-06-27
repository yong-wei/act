import { describe, expect, it } from 'vitest';

import {
  buildTeacherReportDeliveryHref,
  buildTeacherReportDeliveryLedgerEntry,
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
      recoveryAction: '回到班级、课堂历史或学生列表选择有效上下文',
    });
  });

  it('builds redacted report delivery ledger fields across teacher surfaces', () => {
    const query = normalizeTeacherReportDeliveryQuery({
      action: 'export',
      report: 'control-correction',
      sessionId: 'session-1',
      lessonId: 'lesson-3-6',
      actorId: 'teacher-1',
      actorRole: 'TEACHER',
      recipientScope: 'class',
      surface: 'classroom-review',
    }, 'class-1');
    const entry = buildTeacherReportDeliveryLedgerEntry({
      query,
      surface: query.surface,
      now: new Date('2026-06-27T00:00:00.000Z'),
    });

    expect(entry).toMatchObject({
      surface: 'classroom-review',
      reportId: 'control-correction',
      classId: 'class-1',
      sessionId: 'session-1',
      lessonId: 'lesson-3-6',
      actorId: 'teacher-1',
      actorRole: 'TEACHER',
      recipientScope: 'class',
      deliveryStatus: 'ready',
      exportState: 'ready',
      sendState: 'draft',
      copySummaryState: 'ready',
      redactionPolicy: 'student-safe-summary-only',
      actionTimestamp: '2026-06-27T00:00:00.000Z',
    });
    expect(entry.actionId).toMatch(/^teacher-report:classroom-review:export:ref-/);
    expect(entry.artifactRef).toMatch(/^teacher-report-artifact:ref-/);
    expect(entry.idempotencyKey).toMatch(/^teacher-report-idempotency:ref-/);
    expect(entry.artifactRef).not.toContain('class-1');
    expect(entry.artifactRef).not.toContain('control-correction');
    expect(entry.idempotencyKey).not.toContain('class-1');
    expect(entry.idempotencyKey).not.toContain('session-1');
    expect(entry.deliveryScope).not.toContain('class-1');
    expect(entry.studentSafeSummary).not.toContain('internal');
    expect(entry.studentSafeSummary).not.toContain('raw evidence');
  });

  it('preserves URL surface context and records a live timestamp by default', () => {
    const query = normalizeTeacherReportDeliveryQuery({
      action: 'summary',
      surface: 'history',
      sessionId: 'session-1',
      report: 'control-correction',
    }, 'class-1');
    const entry = buildTeacherReportDeliveryLedgerEntry({
      query,
      surface: query.surface,
    });

    expect(query.surface).toBe('history');
    expect(entry.surface).toBe('history');
    expect(entry.actionId).toContain('teacher-report:history:summary:');
    expect(entry.actionTimestamp).not.toBe('1970-01-01T00:00:00.000Z');
  });

  it('builds delivery hrefs that preserve class and session context', () => {
    expect(buildTeacherReportDeliveryHref({
      classId: 'class-1',
      action: 'summary',
      sessionId: 'session-1',
      lessonId: 'lesson-1',
      surface: 'history',
      returnTo: '/teacher/history',
    })).toBe('/teacher/classes/class-1/analytics-v2?action=summary&report=control-correction&surface=history&returnTo=%2Fteacher%2Fhistory&sessionId=session-1&lessonId=lesson-1');

    expect(buildTeacherReportDeliveryHref({
      classId: null,
      surface: 'history',
    })).toBe('/teacher/classes');
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

  it('keeps pending delivery actions out of completed ledger states', () => {
    const sendQuery = normalizeTeacherReportDeliveryQuery({
      action: 'send',
      studentId: 'student-1',
    }, 'class-1');
    expect(buildTeacherReportDeliveryLedgerEntry({
      query: sendQuery,
      surface: sendQuery.surface,
      now: new Date('2026-06-27T00:00:00.000Z'),
    })).toMatchObject({
      deliveryStatus: 'ready',
      sendState: 'ready',
      copySummaryState: 'ready',
    });

    const summaryQuery = normalizeTeacherReportDeliveryQuery({
      action: 'summary',
    }, 'class-1');
    expect(buildTeacherReportDeliveryLedgerEntry({
      query: summaryQuery,
      surface: summaryQuery.surface,
      now: new Date('2026-06-27T00:00:00.000Z'),
    })).toMatchObject({
      deliveryStatus: 'ready',
      sendState: 'draft',
      copySummaryState: 'ready',
    });
  });

  it('separates idempotency keys by version and recipient scope', () => {
    const firstVersion = normalizeTeacherReportDeliveryQuery({
      action: 'export',
      version: 'version-1',
    }, 'class-1');
    const secondVersion = normalizeTeacherReportDeliveryQuery({
      action: 'export',
      version: 'version-2',
    }, 'class-1');
    const firstStudent = normalizeTeacherReportDeliveryQuery({
      action: 'send',
      studentId: 'student-1',
      recipientScope: 'student',
      version: 'version-2',
    }, 'class-1');
    const secondStudent = normalizeTeacherReportDeliveryQuery({
      action: 'send',
      studentId: 'student-2',
      recipientScope: 'student',
      version: 'version-2',
    }, 'class-1');

    const keys = new Set([
      buildTeacherReportDeliveryLedgerEntry({ query: firstVersion, surface: firstVersion.surface }).idempotencyKey,
      buildTeacherReportDeliveryLedgerEntry({ query: secondVersion, surface: secondVersion.surface }).idempotencyKey,
      buildTeacherReportDeliveryLedgerEntry({ query: firstStudent, surface: firstStudent.surface }).idempotencyKey,
      buildTeacherReportDeliveryLedgerEntry({ query: secondStudent, surface: secondStudent.surface }).idempotencyKey,
    ]);

    expect(keys.size).toBe(4);
  });

  it('keeps lock action recovery separate from missing-context recovery', () => {
    const lockQuery = normalizeTeacherReportDeliveryQuery({
      action: 'lock',
    }, 'class-1');
    const lockState = buildTeacherReportDeliveryState(lockQuery);
    expect(lockState).toMatchObject({
      status: 'blocked',
      recoveryAction: '先导出或刷新报告，再锁定交付版本',
    });
    expect(lockState?.httpStatus).toBeUndefined();

    const missingClassLockQuery = normalizeTeacherReportDeliveryQuery({
      action: 'lock',
    }, 'missing-class-1');
    expect(buildTeacherReportDeliveryState(missingClassLockQuery)).toMatchObject({
      status: 'blocked',
      httpStatus: 404,
      recoveryAction: '回到班级、课堂历史或学生列表选择有效上下文',
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
