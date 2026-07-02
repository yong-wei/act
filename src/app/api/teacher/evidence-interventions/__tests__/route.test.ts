import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  prisma: {
    evidenceOutbox: {
      createMany: vi.fn(),
    },
    learningPath: {
      findFirst: vi.fn(),
    },
    class: {
      findUnique: vi.fn(),
    },
    studentProfile: {
      findUnique: vi.fn(),
    },
    learningPathIntervention: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

import { POST } from '../route';

function postJson(body: unknown) {
  return POST(new Request('http://localhost/api/teacher/evidence-interventions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

describe('teacher evidence interventions route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({
      user: {
        id: 'teacher-1',
        role: 'TEACHER',
      },
    });
    mocks.prisma.evidenceOutbox.createMany.mockResolvedValue({ count: 1 });
    mocks.prisma.learningPath.findFirst.mockResolvedValue(null);
    mocks.prisma.class.findUnique.mockResolvedValue({ teacherId: 'teacher-1' });
    mocks.prisma.studentProfile.findUnique.mockResolvedValue({
      classId: 'class-1',
      class: { teacherId: 'teacher-1' },
    });
    mocks.prisma.learningPathIntervention.findFirst.mockResolvedValue(null);
    mocks.prisma.learningPathIntervention.create.mockImplementation(async ({ data }) => ({ id: 'intervention-1', ...data }));
  });

  it('records a teacher intervention into the evidence outbox', async () => {
    const response = await postJson({
      kind: 'feedback',
      surface: 'report-ledger',
      studentId: 'student-1',
      classId: 'class-1',
      reportId: 'control-correction',
      sourceEvidenceRefs: ['LearningFact:fact-1'],
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      outbox: 'recorded',
      action: {
        status: 'recorded',
        persistenceTarget: 'EvidenceOutbox',
        studentFacingTarget: {
          surface: 'none',
          href: null,
        },
      },
    });
    expect(mocks.prisma.evidenceOutbox.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [expect.objectContaining({
        eventType: 'teacher_evidence_intervention.feedback_recorded',
        ownerUserId: 'student-1',
      })],
    }));
  });

  it('rejects non-teacher users before creating records', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: {
        id: 'student-1',
        role: 'STUDENT',
      },
    });

    const response = await postJson({
      kind: 'feedback',
      surface: 'report-ledger',
      studentId: 'student-1',
      sourceEvidenceRefs: ['LearningFact:fact-1'],
    });

    expect(response.status).toBe(403);
    expect(mocks.prisma.evidenceOutbox.createMany).not.toHaveBeenCalled();
  });

  it('does not claim durable writeback for class-level actions without a student target', async () => {
    const response = await postJson({
      kind: 'grading-writeback',
      surface: 'report-ledger',
      classId: 'class-1',
      reportId: 'control-correction',
      sourceEvidenceRefs: ['teacher-report:control-correction:latest'],
    });
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body).toMatchObject({
      outbox: 'non-writeback',
      action: {
        status: 'pending',
        persistenceTarget: 'EvidenceOutbox',
      },
    });
    expect(mocks.prisma.evidenceOutbox.createMany).not.toHaveBeenCalled();
  });

  it('rejects students outside the teacher class scope', async () => {
    mocks.prisma.studentProfile.findUnique.mockResolvedValueOnce({
      classId: 'class-2',
      class: { teacherId: 'teacher-2' },
    });

    const response = await postJson({
      kind: 'feedback',
      surface: 'report-ledger',
      studentId: 'student-2',
      classId: 'class-1',
      reportId: 'control-correction',
      sourceEvidenceRefs: ['LearningFact:fact-1'],
    });

    expect(response.status).toBe(403);
    expect(mocks.prisma.evidenceOutbox.createMany).not.toHaveBeenCalled();
  });

  it('rejects remedial path interventions outside the teacher class scope', async () => {
    mocks.prisma.learningPath.findFirst.mockResolvedValueOnce({
      classId: 'class-2',
    });
    mocks.prisma.class.findUnique
      .mockResolvedValueOnce({ teacherId: 'teacher-1' })
      .mockResolvedValueOnce({ teacherId: 'teacher-2' });

    const response = await postJson({
      kind: 'remedial-path',
      surface: 'teacher-evidence',
      studentId: 'student-1',
      classId: 'class-1',
      reportId: 'control-correction',
      pathId: 'path-other-class',
      sourceEvidenceRefs: ['LearningFact:fact-1'],
    });

    expect(response.status).toBe(403);
    expect(mocks.prisma.learningPathIntervention.create).not.toHaveBeenCalled();
    expect(mocks.prisma.evidenceOutbox.createMany).not.toHaveBeenCalled();
  });

  it('keeps missing remedial paths as reduced personalization without completed student URLs', async () => {
    const response = await postJson({
      kind: 'remedial-path',
      surface: 'teacher-evidence',
      studentId: 'student-1',
      classId: 'class-1',
      reportId: 'control-correction',
      pathId: 'missing-path',
      sourceEvidenceRefs: ['LearningFact:fact-1'],
    });
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body).toMatchObject({
      outbox: 'recorded',
      action: {
        status: 'reduced-personalization',
        failureReason: 'missing-learning-path',
        studentFacingTarget: {
          surface: 'none',
          href: null,
        },
      },
    });
    expect(JSON.stringify(body)).not.toContain('status=completed');
  });
});
