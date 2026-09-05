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
    readDiagnosisReportEvolution: vi.fn(),
  };
});

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/diagnosis-persistence', () => ({
  DiagnosisReportScopeError: mocks.DiagnosisReportScopeError,
  readDiagnosisReportEvolution: mocks.readDiagnosisReportEvolution,
}));

import { GET } from '@/app/api/teacher/classes/[classId]/diagnosis-reports/evolution/route';

describe('GET teacher diagnosis report evolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
  });

  it('returns frozen snapshots with ISO timestamps for an authorized teacher', async () => {
    mocks.readDiagnosisReportEvolution.mockResolvedValue([{
      id: 'report-1',
      scopeType: 'class',
      scopeId: 'class-1',
      evidenceCutoff: new Date('2026-08-30T08:00:00.000Z'),
      generatedAt: new Date('2026-09-01T08:00:00.000Z'),
      metricSnapshot: {
        id: 'snapshot-1',
        schemaVersion: 'diagnosis-metric-snapshot.v1',
        computationVersion: 'class-metrics.v1',
        scopeType: 'class',
        scopeId: 'class-1',
        memberSetFingerprint: 'fingerprint-1',
        evidenceCutoff: new Date('2026-08-30T08:00:00.000Z'),
        metrics: { memberCount: 3 },
        generatedAt: new Date('2026-09-01T08:00:00.000Z'),
      },
    }, {
      id: 'report-legacy',
      scopeType: 'class',
      scopeId: 'class-1',
      evidenceCutoff: new Date('2026-07-30T08:00:00.000Z'),
      generatedAt: new Date('2026-08-01T08:00:00.000Z'),
      metricSnapshot: null,
    }]);

    const response = await GET(
      new Request('http://localhost/api/teacher/classes/class-1/diagnosis-reports/evolution'),
      { params: Promise.resolve({ classId: 'class-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.readDiagnosisReportEvolution).toHaveBeenCalledWith({
      teacherId: 'teacher-1',
      classId: 'class-1',
      limit: undefined,
    });
    await expect(response.json()).resolves.toMatchObject({
      reports: [
        {
          id: 'report-1',
          generatedAt: '2026-09-01T08:00:00.000Z',
          metricSnapshot: {
            schemaVersion: 'diagnosis-metric-snapshot.v1',
            generatedAt: '2026-09-01T08:00:00.000Z',
            metrics: { memberCount: 3 },
          },
        },
        {
          id: 'report-legacy',
          metricSnapshot: null,
        },
      ],
    });
  });

  it('rejects unauthenticated and non-teacher requests without reading snapshots', async () => {
    mocks.getServerAuthSession.mockResolvedValueOnce({ user: null });
    await expect(GET(
      new Request('http://localhost/api/teacher/classes/class-1/diagnosis-reports/evolution'),
      { params: Promise.resolve({ classId: 'class-1' }) },
    )).resolves.toMatchObject({ status: 401 });

    mocks.getServerAuthSession.mockResolvedValueOnce({ user: { id: 'student-1', role: 'STUDENT' } });
    await expect(GET(
      new Request('http://localhost/api/teacher/classes/class-1/diagnosis-reports/evolution'),
      { params: Promise.resolve({ classId: 'class-1' }) },
    )).resolves.toMatchObject({ status: 403 });

    expect(mocks.readDiagnosisReportEvolution).not.toHaveBeenCalled();
  });

  it('fails closed on class-scope errors and invalid limits', async () => {
    mocks.readDiagnosisReportEvolution.mockRejectedValueOnce(
      new mocks.DiagnosisReportScopeError(403, 'diagnosis-class-forbidden'),
    );
    await expect(GET(
      new Request('http://localhost/api/teacher/classes/class-1/diagnosis-reports/evolution'),
      { params: Promise.resolve({ classId: 'class-1' }) },
    )).resolves.toMatchObject({ status: 403 });

    await expect(GET(
      new Request('http://localhost/api/teacher/classes/class-1/diagnosis-reports/evolution?limit=0'),
      { params: Promise.resolve({ classId: 'class-1' }) },
    )).resolves.toMatchObject({ status: 400 });
    expect(mocks.readDiagnosisReportEvolution).toHaveBeenCalledTimes(1);
  });
});
