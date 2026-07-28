import { describe, expect, it, vi } from 'vitest';

import { listTeacherAssignments } from '@/lib/assignments/assignment-service';

const now = new Date('2026-07-17T00:00:00.000Z');

function assignmentFixture() {
  return {
    id: 'assignment-1',
    authorId: 'author-1',
    state: 'PUBLISHED',
    updatedAt: now,
    reviewGrants: [],
    revisions: [{
      id: 'revision-1',
      revisionNumber: 1,
      version: 1,
      title: '控制作业',
      state: 'PUBLISHED',
      audiences: [{ classId: 'class-1', availableAt: now, dueAt: new Date('2026-07-20T00:00:00.000Z') }],
    }],
  };
}

function submission(input: {
  id: string;
  classTeacherId: string;
  currentClassId: string | null;
  reviewState?: string;
  runState?: string;
  reviewId?: string | null;
  approvalSnapshot?: object | null;
}) {
  return {
    id: input.id,
    studentId: `student-${input.id}`,
    frozenStudentId: `student-${input.id}`,
    assignmentRevisionId: 'revision-1',
    frozenAudienceClassId: 'class-1',
    updatedAt: now,
    revision: { assignmentId: 'assignment-1' },
    audience: { archivedAt: null, classId: 'class-1', class: { id: 'class-1', teacherId: input.classTeacherId, isActive: true } },
    student: { profile: { classId: input.currentClassId } },
    answers: [{
      assignmentQuestionId: 'question-1',
      attempts: [{
        gradingRuns: [{
          id: `run-${input.id}`,
          questionId: 'question-1',
          state: input.runState ?? 'AWAITING_REVIEW',
          updatedAt: now,
          teacherAssignmentReview: input.reviewId ? { id: input.reviewId, state: input.reviewState ?? 'WORKING' } : null,
          approvalSnapshot: input.approvalSnapshot ?? null,
        }],
      }],
    }],
  };
}

describe('teacher assignment list service', () => {
  it('counts and selects review work only from submissions authorized to the current-class teacher', async () => {
    const db: any = {
      assignment: { findMany: vi.fn().mockResolvedValue([assignmentFixture()]) },
      assignmentSubmission: { findMany: vi.fn().mockResolvedValue([
        submission({ id: 'authorized', classTeacherId: 'teacher-1', currentClassId: 'class-1', reviewId: 'review-1' }),
        submission({ id: 'transferred-student', classTeacherId: 'teacher-1', currentClassId: 'class-2' }),
        submission({ id: 'foreign-class', classTeacherId: 'teacher-2', currentClassId: 'class-1' }),
      ]) },
    };

    const result = await listTeacherAssignments(db, { id: 'teacher-1', role: 'TEACHER' }, now);

    expect(result).toHaveLength(1);
    expect(result[0].reviewSummary).toEqual({
      submissionCount: 1,
      pendingReviewCount: 1,
      reviewedCount: 0,
      nextReview: {
        submissionId: 'authorized',
        questionId: 'question-1',
        reviewId: 'review-1',
        gradingRunId: 'run-authorized',
      },
    });
  });

  it('allows assignment-wide author access and chooses an approved count separately from pending work', async () => {
    const assignment = assignmentFixture();
    assignment.authorId = 'teacher-1';
    const db: any = {
      assignment: { findMany: vi.fn().mockResolvedValue([assignment]) },
      assignmentSubmission: { findMany: vi.fn().mockResolvedValue([
        submission({ id: 'pending', classTeacherId: 'teacher-2', currentClassId: 'class-9' }),
        submission({ id: 'reviewed', classTeacherId: 'teacher-2', currentClassId: 'class-9', runState: 'APPROVED', approvalSnapshot: { id: 'snapshot-1' } }),
      ]) },
    };

    const result = await listTeacherAssignments(db, { id: 'teacher-1', role: 'TEACHER' }, now);

    expect(result[0].reviewSummary).toMatchObject({
      submissionCount: 2,
      pendingReviewCount: 1,
      reviewedCount: 1,
      nextReview: { submissionId: 'pending', gradingRunId: 'run-pending' },
    });
  });
});
