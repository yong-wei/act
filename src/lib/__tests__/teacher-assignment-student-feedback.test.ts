import { describe, expect, it } from 'vitest';

import { presentStudentAssignmentFeedback } from '@/lib/assignments/submission-service';

const question = { id: 'question-1', promptSnapshot: { prompt: '解释闭环稳定性' } };
const snapshot = {
  id: 'snapshot-1',
  assignmentId: 'assignment-1',
  questionId: 'question-1',
  questionTotal: 8,
  criterionSnapshot: [{ criterionId: 'criterion-1', score: 8, comment: '证据充分' }],
  annotationSnapshot: [{ id: 'annotation-1', status: 'ACTIVE', comment: '这里需要说明裕度', anchor: { precision: 'BLOCK', blockId: 'block-1' } }],
  overallComment: '继续完善工程解释。',
  approvedAt: new Date('2026-07-17T00:00:00Z'),
  outboxCommands: [{ command: 'RELEASE_STUDENT_FEEDBACK', state: 'SUCCEEDED' }],
  feedbackRelease: {
    ownerStudentId: 'student-1',
    mode: 'DERIVATIVE',
    derivative: {
      id: 'derivative-1',
      state: 'READY',
      outputKind: 'ANNOTATED_MARKDOWN',
      outputObjectKey: 'reviewed/snapshot-1.md',
      outputMimeType: 'text/markdown',
      anchorPrecision: 'BLOCK',
      limitations: ['native-docx-annotation-unavailable'],
    },
  },
};

describe('student assignment approved feedback projection', () => {
  it('publishes only a successful release owned by the frozen student', () => {
    const feedback = presentStudentAssignmentFeedback({
      studentId: 'student-1', frozenStudentId: 'student-1', approvalSnapshots: [snapshot], resubmissionGrants: [],
    }, [question], new Date('2026-07-17T01:00:00Z'));
    expect(feedback).toEqual([expect.objectContaining({
      snapshotId: 'snapshot-1',
      questionTitle: '解释闭环稳定性',
      questionTotal: 8,
      reviewedAssets: [expect.objectContaining({ href: '/api/student/assignments/assignment-1/feedback/snapshot-1/asset', precision: 'BLOCK' })],
      limitations: ['native-docx-annotation-unavailable'],
    })]);
  });

  it('keeps feedback hidden before release and on owner mismatch', () => {
    expect(presentStudentAssignmentFeedback({ studentId: 'student-1', frozenStudentId: 'student-1', approvalSnapshots: [{ ...snapshot, outboxCommands: [{ command: 'RELEASE_STUDENT_FEEDBACK', state: 'PENDING' }] }] }, [question], new Date())).toEqual([]);
    expect(presentStudentAssignmentFeedback({ studentId: 'student-1', frozenStudentId: 'student-2', approvalSnapshots: [snapshot] }, [question], new Date())).toEqual([]);
  });
});
