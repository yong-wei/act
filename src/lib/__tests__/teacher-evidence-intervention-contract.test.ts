import { describe, expect, it } from 'vitest';

import {
  buildTeacherEvidenceInterventionAction,
  buildTeacherEvidenceInterventionOutboxRow,
} from '../teacher-evidence-intervention-contract';

describe('teacher evidence intervention contract', () => {
  it('creates a stable pending feedback action with source evidence and context', () => {
    const action = buildTeacherEvidenceInterventionAction({
      kind: 'feedback',
      surface: 'report-ledger',
      teacherId: 'teacher-1',
      studentId: 'student-1',
      classId: 'class-1',
      sessionId: 'session-1',
      reportId: 'control-correction',
      gradingRunId: 'grading-1',
      source: 'report-ledger',
      sourceEvidenceRefs: ['LearningFact:fact-1', 'LearningFact:fact-1', 'SimulationRun:run-1'],
      now: new Date('2026-06-30T00:00:00.000Z'),
    });

    expect(action).toMatchObject({
      kind: 'feedback',
      status: 'pending',
      persistenceTarget: 'EvidenceOutbox',
      teacherId: 'teacher-1',
      studentId: 'student-1',
      classId: 'class-1',
      sessionId: 'session-1',
      reportId: 'control-correction',
      gradingRunId: 'grading-1',
      sourceEvidenceRefs: ['LearningFact:fact-1', 'SimulationRun:run-1'],
      failureReason: null,
      studentFacingTarget: {
        surface: 'none',
        href: null,
        label: '学生侧等待写回',
      },
      createdAt: '2026-06-30T00:00:00.000Z',
    });
    expect(action.id).toMatch(/^teacher-intervention:feedback:ref-/);
    expect(action.idempotencyKey).toMatch(/^teacher-intervention-idempotency:ref-/);
    expect(action.privacySafeSummary).toContain('尚未写回');
  });

  it('marks persisted actions as recorded and converts them to outbox rows', () => {
    const action = buildTeacherEvidenceInterventionAction({
      kind: 'feedback',
      surface: 'report-ledger',
      teacherId: 'teacher-1',
      studentId: 'student-1',
      classId: 'class-1',
      reportId: 'control-correction',
      sourceEvidenceRefs: ['LearningFact:fact-1'],
      writebackState: 'recorded',
      now: new Date('2026-06-30T00:00:00.000Z'),
    });

    expect(action).toMatchObject({
      status: 'recorded',
      persistenceTarget: 'EvidenceOutbox',
      studentFacingTarget: {
        surface: 'none',
        href: null,
      },
    });
    expect(buildTeacherEvidenceInterventionOutboxRow(action)).toMatchObject({
      eventType: 'teacher_evidence_intervention.feedback_recorded',
      causationId: action.id,
      ownerUserId: 'student-1',
      dedupeKey: action.idempotencyKey,
      createdAt: '2026-06-30T00:00:00.000Z',
      payload: {
        sourceCapability: 'audit-remediation-teacher-evidence-intervention-closure',
        intervention: {
          id: action.id,
          status: 'recorded',
        },
      },
    });
  });

  it('carries student-visible intervention identity in targets', () => {
    const action = buildTeacherEvidenceInterventionAction({
      kind: 'feedback',
      surface: 'report-ledger',
      teacherId: 'teacher-1',
      studentId: 'student-1',
      classId: 'class-1',
      reportId: 'control-correction',
      sourceEvidenceRefs: ['LearningFact:fact-1'],
      writebackState: 'student-visible',
    });
    const href = action.studentFacingTarget.href ?? '';
    const params = new URLSearchParams(href.split('?')[1] ?? '');

    expect(action.studentFacingTarget).toMatchObject({
      surface: 'feedback-task',
      label: '学生报告反馈',
    });
    expect(params.get('teacherInterventionId')).toBe(action.id);
    expect(params.get('status')).toBe('teacher-visible');
  });

  it('preserves evidence and downgrades personalization when a remedial path is missing', () => {
    const action = buildTeacherEvidenceInterventionAction({
      kind: 'remedial-path',
      surface: 'teacher-evidence',
      studentId: 'student-1',
      classId: 'class-1',
      reportId: 'control-correction',
      sourceEvidenceRefs: ['LearningFact:fact-1'],
      learnerState: 'missing',
    });

    expect(action).toMatchObject({
      status: 'reduced-personalization',
      persistenceTarget: 'EvidenceOutbox',
      failureReason: 'missing-learning-path',
      recoveryAction: '先生成或选择学生补练路径；当前可发送反馈或补强任务',
      studentFacingTarget: {
        surface: 'none',
        href: null,
        label: '学生侧等待写回',
      },
    });
    expect(action.privacySafeSummary).toContain('降低个性化置信度');
  });

  it('carries selected remedial paths into student adaptive practice handoffs', () => {
    const action = buildTeacherEvidenceInterventionAction({
      kind: 'remedial-path',
      surface: 'teacher-evidence',
      teacherId: 'teacher-1',
      studentId: 'student-1',
      classId: 'class-1',
      reportId: 'control-correction',
      pathId: 'path-remedial-1',
      sourceEvidenceRefs: ['LearningFact:fact-1'],
      writebackState: 'student-visible',
    });
    const href = action.studentFacingTarget.href ?? '';
    const params = new URLSearchParams(href.split('?')[1] ?? '');

    expect(action.studentFacingTarget).toMatchObject({
      surface: 'adaptive-path',
      label: '学生补练路径',
    });
    expect(params.get('goal')).toBe('control-correction');
    expect(params.get('goalId')).toBe('control-correction');
    expect(params.get('pathId')).toBe('path-remedial-1');
    expect(params.get('intent')).toBe('path-execution');
    expect(params.get('teacherInterventionId')).toBe(action.id);
    expect(params.get('status')).toBe('teacher-visible');
  });

  it('keeps class report ledger interventions valid without a single student target', () => {
    const action = buildTeacherEvidenceInterventionAction({
      kind: 'grading-writeback',
      surface: 'report-ledger',
      classId: 'class-1',
      reportId: 'control-correction',
      sourceEvidenceRefs: ['teacher-report:control-correction:latest'],
    });

    expect(action).toMatchObject({
      status: 'pending',
      persistenceTarget: 'EvidenceOutbox',
      studentId: null,
      studentFacingTarget: {
        surface: 'none',
        href: null,
        label: '学生侧不可见',
      },
    });
  });

  it('blocks report ledger interventions for missing student identifiers', () => {
    const action = buildTeacherEvidenceInterventionAction({
      kind: 'feedback',
      surface: 'report-ledger',
      classId: 'class-1',
      studentId: 'missing-batch58',
      sourceEvidenceRefs: ['teacher-report:control-correction:latest'],
    });

    expect(action).toMatchObject({
      status: 'blocked',
      persistenceTarget: 'none',
      failureReason: 'missing-student',
    });
  });

  it('blocks writeback when student or source evidence is missing', () => {
    expect(buildTeacherEvidenceInterventionAction({
      kind: 'grading-writeback',
      surface: 'grading-workbench',
      classId: 'class-1',
      sourceEvidenceRefs: ['LearningFact:fact-1'],
    })).toMatchObject({
      status: 'blocked',
      persistenceTarget: 'none',
      failureReason: 'missing-student',
      studentFacingTarget: {
        surface: 'none',
        href: null,
      },
    });

    expect(buildTeacherEvidenceInterventionAction({
      kind: 'reinforcement-task',
      surface: 'teacher-evidence',
      studentId: 'student-1',
      classId: 'class-1',
    })).toMatchObject({
      status: 'blocked',
      persistenceTarget: 'none',
      failureReason: 'missing-source-evidence',
      recoveryAction: '至少选择一条学生可见证据后再创建处置',
    });
  });
});
