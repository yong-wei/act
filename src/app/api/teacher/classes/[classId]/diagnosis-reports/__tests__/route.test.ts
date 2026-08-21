import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  class DiagnosisReportScopeError extends Error {
    constructor(readonly status: number, message: string) {
      super(message);
    }
  }
  return {
    DiagnosisReportScopeError,
    getServerAuthSession: vi.fn(),
    readDiagnosisReports: vi.fn(),
    parseGenerationRequest: vi.fn(),
    startGenerationJob: vi.fn(),
    enqueueGenerationJob: vi.fn(),
  };
});

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/diagnosis-persistence', () => ({
  DiagnosisReportScopeError: mocks.DiagnosisReportScopeError,
  diagnosisReportWriteSchema: { parse: vi.fn() },
  persistDiagnosisReport: vi.fn(),
  readDiagnosisReports: mocks.readDiagnosisReports,
}));

vi.mock('@/lib/diagnosis-generation', () => ({
  diagnosisGenerationRequestSchema: { parse: mocks.parseGenerationRequest },
  diagnosisGenerationErrorResponse: (error: unknown) => error instanceof Error && error.message === 'browser-report-body-forbidden'
    ? { status: 400, body: { error: 'invalid-diagnosis-generation-request' } }
    : null,
  startDiagnosisGenerationJob: mocks.startGenerationJob,
  projectDiagnosisGenerationJob: (job: unknown) => job,
}));

vi.mock('@/lib/diagnosis-generation-queue', () => ({
  enqueueDiagnosisGenerationJob: mocks.enqueueGenerationJob,
}));

vi.mock('@/lib/prisma', () => ({ prisma: { marker: 'prisma' } }));

import { GET, POST } from '@/app/api/teacher/classes/[classId]/diagnosis-reports/route';

describe('GET teacher diagnosis reports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
  });

  it('serializes report timestamps and preserves the governed projection', async () => {
    mocks.readDiagnosisReports.mockResolvedValue([{
      id: 'report-1',
      scopeType: 'student',
      scopeId: 'student-1',
      classId: 'class-1',
      targetUserId: 'student-1',
      reportBody: {
        summary: '学生需要补强稳定裕度判断。',
        findings: [],
        evidenceRefs: ['knowledge-progress:row-1'],
        evidenceCutoff: '2026-07-30T08:00:00.000Z',
        sourceCoverage: { progressRows: 1 },
        confidence: 'medium',
        limitations: [],
      },
      riskSummary: {
        total: 0,
        byType: { stagnation: 0, constraint: 0, cross_domain: 0 },
        bySeverity: { low: 0, medium: 0, high: 0 },
      },
      evidenceCutoff: new Date('2026-07-30T08:00:00.000Z'),
      generatorVersion: 'teacher-diagnosis.v1',
      generatedAt: new Date('2026-07-30T08:05:00.000Z'),
    }]);

    const response = await GET(
      new Request('http://localhost/api/teacher/classes/class-1/diagnosis-reports?studentId=student-1&limit=20'),
      { params: Promise.resolve({ classId: 'class-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.readDiagnosisReports).toHaveBeenCalledWith({
      teacherId: 'teacher-1',
      classId: 'class-1',
      targetStudentId: 'student-1',
      limit: 20,
    });
    await expect(response.json()).resolves.toMatchObject({
      reports: [{
        id: 'report-1',
        evidenceCutoff: '2026-07-30T08:00:00.000Z',
        generatedAt: '2026-07-30T08:05:00.000Z',
      }],
    });
  });

  it('rejects unauthenticated and non-teacher reads', async () => {
    mocks.getServerAuthSession.mockResolvedValueOnce(null);
    const unauthenticated = await GET(
      new Request('http://localhost/api/teacher/classes/class-1/diagnosis-reports'),
      { params: Promise.resolve({ classId: 'class-1' }) },
    );
    mocks.getServerAuthSession.mockResolvedValueOnce({ user: { id: 'student-1', role: 'STUDENT' } });
    const forbidden = await GET(
      new Request('http://localhost/api/teacher/classes/class-1/diagnosis-reports'),
      { params: Promise.resolve({ classId: 'class-1' }) },
    );

    expect(unauthenticated.status).toBe(401);
    expect(forbidden.status).toBe(403);
    expect(mocks.readDiagnosisReports).not.toHaveBeenCalled();
  });

  it('fails closed when the teacher does not own the class or the student is not a current member', async () => {
    mocks.readDiagnosisReports.mockRejectedValueOnce(
      new mocks.DiagnosisReportScopeError(404, '班级或学生范围不可用'),
    );

    const response = await GET(
      new Request('http://localhost/api/teacher/classes/class-other/diagnosis-reports?studentId=student-departed'),
      { params: Promise.resolve({ classId: 'class-other' }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: '班级或学生范围不可用' });
  });
});

describe('POST teacher diagnosis generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.parseGenerationRequest.mockImplementation((body: Record<string, unknown>) => {
      if ('reportBody' in body) throw new Error('browser-report-body-forbidden');
      return body;
    });
  });

  it('accepts only generation intent and enqueues the durable job', async () => {
    const job = { id: 'job-1', state: 'QUEUED' };
    mocks.startGenerationJob.mockResolvedValue(job);
    mocks.enqueueGenerationJob.mockResolvedValue({ queued: true, job, errorCode: null });

    const response = await POST(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ idempotencyKey: 'request-123', targetStudentId: 'student-1' }),
    }), { params: Promise.resolve({ classId: 'class-1' }) });

    expect(response.status).toBe(202);
    expect(mocks.startGenerationJob).toHaveBeenCalledWith(
      { marker: 'prisma' },
      {
        teacherId: 'teacher-1',
        classId: 'class-1',
        targetStudentId: 'student-1',
        idempotencyKey: 'request-123',
        force: undefined,
        forceReason: null,
      },
    );
    expect(mocks.enqueueGenerationJob).toHaveBeenCalledWith({ marker: 'prisma' }, 'job-1');
  });

  it('does not pass a browser-authored report body to persistence', async () => {
    const response = await POST(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ idempotencyKey: 'request-123', reportBody: { summary: '伪造报告' } }),
    }), { params: Promise.resolve({ classId: 'class-1' }) });

    expect(response.status).toBe(400);
    expect(mocks.startGenerationJob).not.toHaveBeenCalled();
    expect(mocks.enqueueGenerationJob).not.toHaveBeenCalled();
  });

  it('passes only explicit force intent and teacher reason to server-side job creation', async () => {
    const job = { id: 'job-forced', state: 'QUEUED' };
    mocks.startGenerationJob.mockResolvedValue(job);
    mocks.enqueueGenerationJob.mockResolvedValue({ queued: true, job, errorCode: null });

    const response = await POST(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: 'request-forced',
        force: true,
        forceReason: '用于本周教学复盘会议留档',
      }),
    }), { params: Promise.resolve({ classId: 'class-1' }) });

    expect(response.status).toBe(202);
    expect(mocks.startGenerationJob).toHaveBeenCalledWith(
      { marker: 'prisma' },
      expect.objectContaining({
        teacherId: 'teacher-1',
        classId: 'class-1',
        force: true,
        forceReason: '用于本周教学复盘会议留档',
      }),
    );
  });
});
