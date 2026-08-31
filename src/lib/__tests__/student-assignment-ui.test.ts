import { describe, expect, it } from 'vitest';
import { belongsToAssignmentFilter, studentAssignmentHref } from '@/features/assignments/student-assignment-list';
import { formatAssignmentDeadline } from '@/features/assignments/student-assignment-types';
import { presentStudentReferenceAnswer, presentStudentScoringStandard } from '@/lib/assignments/student-result-presentation';
import { presentStudentAssignmentResult } from '@/lib/assignments/submission-service';

describe('student assignment task center view model', () => {
  it('keeps open, submitted pipeline, and reviewed filters semantically distinct', () => {
    expect(belongsToAssignmentFilter('NOT_STARTED', 'open')).toBe(true);
    expect(belongsToAssignmentFilter('RESUBMISSION_REQUIRED', 'open')).toBe(true);
    expect(belongsToAssignmentFilter('AWAITING_REVIEW', 'submitted')).toBe(true);
    expect(belongsToAssignmentFilter('IN_REVIEW', 'submitted')).toBe(true);
    expect(belongsToAssignmentFilter('REVIEWED', 'reviewed')).toBe(true);
    expect(belongsToAssignmentFilter('REVIEWED', 'submitted')).toBe(false);
  });

  it('does not invent a deadline when the publication has none or stale data', () => {
    expect(formatAssignmentDeadline(null)).toBe('无截止时间');
    expect(formatAssignmentDeadline('not-a-date')).toBe('截止时间待确认');
  });

  it('routes historical entries to the exact owned revision', () => {
    expect(studentAssignmentHref({ id: 'assignment/1', revisionId: 'revision/1', historicalOnly: true }))
      .toBe('/missions/assignments/assignment%2F1?revisionId=revision%2F1');
    expect(studentAssignmentHref({ id: 'assignment/1', revisionId: 'revision/2', historicalOnly: false }))
      .toBe('/missions/assignments/assignment%2F1');
  });

  it('converts released answer and rubric snapshots into student-readable text', () => {
    expect(presentStudentReferenceAnswer({ text: '给出模型、参数和验证结果。' }))
      .toBe('给出模型、参数和验证结果。');
    expect(presentStudentScoringStandard({
      schemaVersion: 'assignment-scoring-rubric.v2',
      criteria: [{
        id: 'internal-only-id',
        label: '模型证据',
        maxPoints: 2.5,
        scoringStandard: '说明对象模型和目标指标。',
        feedbackGuidance: '教师内部提示。',
        levels: [{ id: 'complete', label: '完整', maxPoints: 2.5, guideline: '模型与指标准确完整。' }],
      }],
    })).toBe('模型证据（2.5 分）\n说明对象模型和目标指标。\n完整：模型与指标准确完整。');
  });

  it('fails closed instead of displaying unknown snapshot structures', () => {
    expect(presentStudentReferenceAnswer({ answer: '不应展示' })).toBeNull();
    expect(presentStudentScoringStandard({ internal: '不应展示' })).toBeNull();
  });

  it('projects released results through a fixed student-safe field list', () => {
    const result = presentStudentAssignmentResult({
      studentId: 'student-1',
      frozenStudentId: 'student-1',
      answers: [{ assignmentQuestionId: 'question-1', currentAttemptNumber: 1, attempts: [{ id: 'attempt-1', attemptNumber: 1 }] }],
      approvalSnapshots: [{
        questionId: 'question-1',
        attemptId: 'attempt-1',
        questionTotal: 4,
        overallComment: '题目评价',
        criterionSnapshot: [{ criterionId: 'criterion-1', score: 4, comment: '评分说明', reasonCode: 'internal' }],
        annotationSnapshot: [{ criterionId: 'criterion-1', comment: '批注', anchor: { excerpt: 'internal' } }],
        outboxCommands: [{ command: 'RELEASE_STUDENT_FEEDBACK', state: 'SUCCEEDED' }],
        feedbackRelease: { ownerStudentId: 'student-1', releasedAt: new Date('2026-08-31T00:00:00.000Z') },
      }],
      gradingSnapshots: [{ createdAt: new Date('2026-08-30T00:00:00.000Z'), items: [{ questionId: 'question-1', attemptId: 'attempt-1' }] }],
    }, [{ id: 'question-1', answerSnapshot: { text: '参考答案' }, rubricSnapshot: '评分标准' }]);

    expect(result).toEqual({
      version: 'assignment-student-result.v1',
      totalScore: 4,
      overallComment: '第 1 题：题目评价',
      releasedAt: '2026-08-31T00:00:00.000Z',
      questions: [{
        questionId: 'question-1',
        score: 4,
        comment: '题目评价',
        criteria: [{ criterionId: 'criterion-1', score: 4, comment: '评分说明' }],
        annotations: [{ criterionId: 'criterion-1', comment: '批注' }],
        referenceAnswer: '参考答案',
        scoringStandard: '评分标准',
      }],
    });
  });
});
