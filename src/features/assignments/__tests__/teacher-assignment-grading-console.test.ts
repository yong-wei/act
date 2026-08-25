import { describe, expect, it } from 'vitest';

import { gradingErrorMessage, isAiGradingCandidate, isAiReviewCandidate, normalizeSubmission, toggleAllAiGradingCandidates } from '@/features/assignments/teacher-assignment-grading-console';
import { deriveTeacherAssignmentGradingDiagnostic } from '@/lib/data-governance/teacher-assignment-review';

describe('teacher assignment grading console candidates', () => {
  it('includes partially submitted students and excludes empty or already snapshotted submissions', () => {
    expect(isAiGradingCandidate({ state: 'IN_PROGRESS', submittedRequiredCount: 1, grading: null })).toBe(true);
    expect(isAiGradingCandidate({ state: 'IN_PROGRESS', submittedRequiredCount: 0, grading: null })).toBe(false);
    expect(isAiGradingCandidate({ state: 'SUBMITTED', submittedRequiredCount: 2, grading: { snapshotId: 'snapshot-1', source: 'AI', state: 'PENDING_GRADING', operationState: 'RUNNING', confirmationId: null, releaseId: null } })).toBe(false);
    expect(isAiGradingCandidate({ state: 'SUBMITTED', submittedRequiredCount: 2, grading: { snapshotId: 'snapshot-2', source: 'MANUAL', state: 'PENDING_GRADING', operationState: 'SUCCEEDED', confirmationId: null, releaseId: null } })).toBe(true);
    expect(isAiGradingCandidate({ state: 'SUBMITTED', submittedRequiredCount: 2, grading: { snapshotId: 'snapshot-3', source: 'MANUAL', state: 'CONFIRMED', operationState: 'SUCCEEDED', confirmationId: 'confirmation-1', releaseId: null } })).toBe(false);
  });

  it('keeps the server diagnostic when normalizing the submissions response', () => {
    const [submission] = normalizeSubmission({
      submissionId: 'submission-1', studentId: 'student-1', state: 'SUBMITTED', submittedRequiredCount: 1,
      gradingDiagnostic: { code: 'DEADLINE_NOT_REACHED', message: '尚未到批改时间', canStartAi: false },
      questions: [{ questionId: 'question-1', status: 'READY', diagnosticCode: 'DEADLINE_NOT_REACHED', diagnosticMessage: '尚未到批改时间' }],
    });
    expect(submission.gradingDiagnostic).toEqual({ code: 'DEADLINE_NOT_REACHED', message: '尚未到批改时间', canStartAi: false });
    expect(submission.questions[0]).toMatchObject({ diagnosticCode: 'DEADLINE_NOT_REACHED', diagnosticMessage: '尚未到批改时间' });
    expect(isAiGradingCandidate(submission)).toBe(false);
  });

  it('keeps an already-created automatic review reachable after returning to the console', () => {
    expect(isAiReviewCandidate({ status: 'READY', gradingRunId: 'run-1', reviewId: null })).toBe(true);
    expect(isAiReviewCandidate({ status: 'IN_REVIEW', gradingRunId: 'run-1', reviewId: 'review-1' })).toBe(true);
    expect(isAiReviewCandidate({ status: 'READY', gradingRunId: null, reviewId: null })).toBe(false);
    expect(isAiReviewCandidate({ status: 'APPROVED', gradingRunId: 'run-1', reviewId: null })).toBe(false);
  });

  it('selects every eligible student and deselects only those students on a second toggle', () => {
    expect(toggleAllAiGradingCandidates(['student-archived'], ['student-1', 'student-2', 'student-1'])).toEqual(['student-archived', 'student-1', 'student-2']);
    expect(toggleAllAiGradingCandidates(['student-archived', 'student-1', 'student-2'], ['student-1', 'student-2'])).toEqual(['student-archived']);
  });

  it('explains why the one-click action is unavailable without exposing implementation details', () => {
    const beforeDeadline = deriveTeacherAssignmentGradingDiagnostic({ now: new Date('2026-08-21T09:00:00.000Z'), dueAt: new Date('2026-08-21T10:00:00.000Z'), submittedRequiredCount: 1, hasGradingSnapshot: false, status: 'READY' });
    expect(beforeDeadline).toMatchObject({ code: 'DEADLINE_NOT_REACHED', canStartAi: false });
    expect(beforeDeadline.message).toContain('截止');
    const visualReview = deriveTeacherAssignmentGradingDiagnostic({ now: new Date('2026-08-21T11:00:00.000Z'), dueAt: new Date('2026-08-21T10:00:00.000Z'), submittedRequiredCount: 1, hasGradingSnapshot: false, status: 'BLOCKED', failureStage: 'visual-evidence' });
    expect(visualReview).toMatchObject({ code: 'VISUAL_EVIDENCE_REVIEW', canStartAi: false });
    expect(visualReview.message).toContain('人工批改');
    expect(gradingErrorMessage(new Error('grading-provider-policy-not-found'), 'fallback')).toContain('策略暂时不可用');
    expect(gradingErrorMessage(new Error('internal-provider-name'), 'fallback')).toBe('fallback');
  });
});
