import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStudentActor: vi.fn(),
  findUnique: vi.fn(),
  findGradeRelease: vi.fn(),
  readObject: vi.fn(),
}));

vi.mock('@/lib/assignments/submission-route-guards', () => ({ requireStudentActor: mocks.requireStudentActor }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    teacherAssignmentApprovalSnapshot: { findUnique: mocks.findUnique },
    assignmentSubmissionGradeRelease: { findFirst: mocks.findGradeRelease },
  },
}));
vi.mock('@/lib/data-governance/teacher-assignment-review-derivative-storage', () => ({
  readReviewedDerivativeObject: mocks.readObject,
}));

import { GET } from '../../../app/api/student/assignments/[assignmentId]/feedback/[snapshotId]/asset/route';

const context = { params: Promise.resolve({ assignmentId: 'assignment-1', snapshotId: 'snapshot-1' }) };

describe('student reviewed derivative asset route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStudentActor.mockResolvedValue({ actor: { id: 'student-1' } });
  });

  it('hides a ready release until its release outbox command has succeeded', async () => {
    mocks.findUnique.mockResolvedValue(snapshot([]));

    const response = await GET(new Request('https://act.example/asset'), context);

    expect(response).toBeDefined();
    expect(response!.status).toBe(404);
    expect(mocks.readObject).not.toHaveBeenCalled();
  });

  it('serves the checksum-verified derivative after release settlement', async () => {
    const bytes = new TextEncoder().encode('reviewed feedback');
    const checksum = `sha256:${Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex')}`;
    mocks.findUnique.mockResolvedValue({
      ...snapshot([{ id: 'outbox-release' }], checksum),
      revision: { solutionReleasePolicy: { mode: 'TEACHER_CONFIRMED_RESULT' } },
    });
    mocks.findGradeRelease.mockResolvedValue({ id: 'grade-release-1' });
    mocks.readObject.mockResolvedValue(bytes);

    const response = await GET(new Request('https://act.example/asset'), context);

    expect(response).toBeDefined();
    expect(response!.status).toBe(200);
    expect(response!.headers.get('cache-control')).toBe('private, no-store');
    await expect(response!.text()).resolves.toBe('reviewed feedback');
  });

  it('hides another student’s reviewed derivative', async () => {
    mocks.requireStudentActor.mockResolvedValue({ actor: { id: 'student-2' } });
    mocks.findUnique.mockResolvedValue({
      ...snapshot([{ id: 'outbox-release' }]),
      revision: { solutionReleasePolicy: { mode: 'TEACHER_CONFIRMED_RESULT' } },
    });

    const response = await GET(new Request('https://act.example/asset'), context);

    expect(response!.status).toBe(404);
    expect(mocks.readObject).not.toHaveBeenCalled();
  });

  it('hides a reviewed derivative before its whole-submission grade is released', async () => {
    mocks.findUnique.mockResolvedValue({
      ...snapshot([{ id: 'outbox-release' }]),
      revision: { solutionReleasePolicy: { mode: 'TEACHER_CONFIRMED_RESULT' } },
    });
    mocks.findGradeRelease.mockResolvedValue(null);

    const response = await GET(new Request('https://act.example/asset'), context);

    expect(response!.status).toBe(404);
    expect(mocks.readObject).not.toHaveBeenCalled();
  });
});

function snapshot(outboxCommands: Array<{ id: string }>, outputChecksum = 'sha256:unused') {
  return {
    id: 'snapshot-1', assignmentId: 'assignment-1', questionId: 'question-1',
    submission: { studentId: 'student-1', frozenStudentId: 'student-1' },
    outboxCommands,
    feedbackRelease: {
      ownerStudentId: 'student-1',
      derivative: {
        state: 'READY', outputObjectKey: 'reviewed/snapshot-1.md', outputChecksum,
        outputKind: 'ANNOTATED_MARKDOWN', outputMimeType: 'text/markdown',
      },
    },
  };
}
