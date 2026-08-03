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

import { GET } from '@/app/api/teacher/classes/[classId]/diagnosis-reports/route';

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
