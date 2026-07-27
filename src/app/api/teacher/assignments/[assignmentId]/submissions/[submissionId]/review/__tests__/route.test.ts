import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAssignmentActor: vi.fn(),
  getReview: vi.fn(),
}));

vi.mock('@/lib/assignments/assignment-route-guards', () => ({
  requireAssignmentActor: mocks.requireAssignmentActor,
  requireAssignmentMutation: vi.fn(),
  readBoundedAssignmentJson: vi.fn(),
}));
vi.mock('@/lib/data-governance/teacher-assignment-review', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/data-governance/teacher-assignment-review')>();
  return {
    ...actual,
    getTeacherAssignmentReview: mocks.getReview,
  };
});
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { GET } from '../route';

describe('teacher assignment review detail route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAssignmentActor.mockResolvedValue({
      actor: { id: 'teacher-1', role: 'TEACHER' },
    });
  });

  it('returns the safe sealed original-response projection without conversion or storage metadata', async () => {
    mocks.getReview.mockResolvedValue({
      id: 'review-1',
      assignmentId: 'assignment-1',
      assignmentRevisionId: 'revision-1',
      submissionId: 'submission-1',
      answerId: 'answer-1',
      attemptId: 'attempt-1',
      questionId: 'question-1',
      gradingRunId: 'run-1',
      state: 'WORKING',
      version: 1,
      criterionValues: [],
      annotationValues: [],
      assignment: { id: 'assignment-1', title: '控制作业' },
      submission: {
        id: 'submission-1',
        student: { name: '学生甲', profile: { studentNumber: '2026001' } },
      },
      gradingRun: {
        id: 'run-1',
        state: 'AWAITING_REVIEW',
        evidenceState: 'EVIDENCE_INCOMPLETE',
        assessments: [],
        question: {
          id: 'question-1',
          responseType: 'SUBJECTIVE_TEXT',
          promptSnapshot: { text: '说明建模过程' },
        },
        answerAttempt: {
          id: 'attempt-1',
          textSnapshot: '# 原始答案',
          answer: {
            id: 'answer-1',
            attachmentOrderProvenance: 'student-frozen-order.v1',
          },
          assets: [{
            id: 'asset-1',
            answerId: 'answer-1',
            attemptId: 'attempt-1',
            originalName: '/private/report.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 12,
            assetRole: 'ATTACHMENT',
            orderIndex: 0,
            embeddedPosition: null,
            state: 'FINALIZED',
            objectKey: 'private/object',
            checksum: `sha256:${'1'.repeat(64)}`,
          }],
        },
        answerEvidence: {
          limitationState: 'evidence-incomplete',
          sourceManifest: {
            sources: [{
              assetId: 'asset-1',
              state: 'UNDERSTANDING_FAILED',
              provider: 'private-provider',
              errorCode: 'private-error',
            }],
          },
          conversion: {
            canonicalMarkdown: 'converted private content',
          },
        },
      },
    });

    const response = (await GET(
      new Request('https://act.example/api/review?reviewId=review-1'),
      {
        params: Promise.resolve({
          assignmentId: 'assignment-1',
          submissionId: 'submission-1',
        }),
      },
    ))!;
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.review.originalResponse).toMatchObject({
      textSnapshot: '# 原始答案',
      assets: [{
        id: 'asset-1',
        displayName: 'report.pdf',
        orderIndex: 0,
      }],
    });
    expect(serialized).not.toMatch(
      /private\/object|checksum|conversion|private-provider|private-error|converted private content/,
    );
    expect(serialized).not.toContain('token=');
  });
});
