import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAssignmentActor: vi.fn(),
  getReview: vi.fn(),
}));

vi.mock('@/lib/assignments/assignment-route-guards', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/assignments/assignment-route-guards')>();
  return {
    ...actual,
    requireAssignmentActor: mocks.requireAssignmentActor,
    requireAssignmentMutation: vi.fn(),
    readBoundedAssignmentJson: vi.fn(),
  };
});
vi.mock('@/lib/assignments/public-api', () => ({
  teacherGetReview: mocks.getReview,
}));

import { GET } from '../route';
import { normalizeTeacherReviewDetail } from '@/features/assignments/teacher-review-contracts';
import { buildTeacherAssignmentReviewApiProjection } from '@/lib/assignments/assignment-review';

describe('teacher assignment review detail route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAssignmentActor.mockResolvedValue({
      actor: { id: 'teacher-1', role: 'TEACHER' },
    });
  });

  it('returns the safe sealed original-response projection without conversion or storage metadata', async () => {
    mocks.getReview.mockResolvedValue(buildTeacherAssignmentReviewApiProjection({
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
      criterionValues: [{
        criterionId: 'criterion-1',
        levelId: null,
        score: 8,
        comment: '',
      }],
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
        questionSnapshot: {
          rubric: {
            criteria: [{
              id: 'criterion-1',
              label: '建模依据',
              maxPoints: 10,
              levels: [],
            }],
          },
        },
        assessments: [{
          id: 'assessment-1',
          criterionId: 'criterion-1',
          levelId: null,
          score: 8,
          rationale: '模型结构与题意一致',
        }],
        annotations: [{
          id: 'annotation-1',
          criterionId: 'criterion-1',
          comment: '对应建模步骤',
          authorRole: 'AI',
          blockId: 'block-2',
          pageNumber: 2,
          spanStart: null,
          spanEnd: null,
          bbox: null,
          precision: 'BLOCK',
          excerpt: '建立对象的微分方程',
        }],
        question: {
          id: 'question-1',
          responseType: 'SUBJECTIVE_TEXT',
          promptSnapshot: { text: '说明建模过程' },
        },
        answerAttempt: {
          id: 'attempt-1',
          textSnapshot: '# 原始答案',
          answerSnapshot: {
            schemaVersion: 'assignment-response.v2',
            attachmentOrderProvenance: 'legacy-fallback',
          },
          answer: {
            id: 'answer-1',
            attachmentOrderProvenance: 'student-arranged',
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
    }));

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
      attachmentOrderProvenance: 'legacy-fallback',
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
    const detail = normalizeTeacherReviewDetail(body);
    expect(detail?.criteria[0]).toMatchObject({
      id: 'criterion-1',
      aiScore: 8,
      aiComment: '模型结构与题意一致',
    });
    expect(detail?.aiAnnotations).toEqual([
      expect.objectContaining({
        id: 'annotation-1',
        criterionId: 'criterion-1',
        origin: 'AI_DRAFT',
        anchor: expect.objectContaining({
          blockId: 'block-2',
          pageNumber: 2,
          precision: 'BLOCK',
        }),
      }),
    ]);
  });
});
