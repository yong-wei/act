import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  class DiagnosisReportScopeError extends Error {
    constructor(readonly status: 400 | 403 | 404 | 409, message: string) {
      super(message);
    }
  }
  return {
    DiagnosisReportScopeError,
    getServerAuthSession: vi.fn(),
    preflight: vi.fn(),
  };
});

vi.mock('@/lib/auth', () => ({ getServerAuthSession: mocks.getServerAuthSession }));
vi.mock('@/lib/diagnosis-generation-preflight', () => ({
  preflightDiagnosisGeneration: mocks.preflight,
  projectDiagnosisGenerationPreflight: (value: unknown) => value,
}));
vi.mock('@/lib/diagnosis-generation', () => ({ diagnosisGenerationErrorResponse: () => null }));
vi.mock('@/lib/diagnosis-persistence', () => ({
  DiagnosisReportScopeError: mocks.DiagnosisReportScopeError,
}));
vi.mock('@/lib/prisma', () => ({ prisma: { marker: 'prisma' } }));

import { GET } from '@/app/api/teacher/classes/[classId]/diagnosis-reports/preflight/route';

describe('teacher diagnosis generation preflight route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
  });

  it('returns the authorized privacy-safe projection without creating generation state', async () => {
    mocks.preflight.mockResolvedValue({
      status: 'NO_EFFECTIVE_CHANGE',
      canGenerate: false,
      canForce: true,
      categories: {
        assignment: { availability: 'unavailable', currentCount: null, changedCount: null },
        assessment: { availability: 'unavailable', currentCount: null, changedCount: null },
        learningBehavior: { availability: 'available', currentCount: 3, changedCount: 0 },
        risk: { availability: 'available', currentCount: 1, changedCount: 0 },
        eligibility: { availability: 'available', currentCount: 30, changedCount: 0 },
      },
    });

    const response = await GET(
      new Request('http://localhost/api/teacher/classes/class-1/diagnosis-reports/preflight?studentId=student-1'),
      { params: Promise.resolve({ classId: 'class-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.preflight).toHaveBeenCalledWith(
      { marker: 'prisma' },
      { teacherId: 'teacher-1', classId: 'class-1', targetStudentId: 'student-1' },
    );
    const payload = await response.json();
    expect(payload.preflight).not.toHaveProperty('inputDigest');
    expect(JSON.stringify(payload)).not.toContain('student-1');
  });

  it('rejects unauthenticated and non-teacher reads before preflight', async () => {
    mocks.getServerAuthSession.mockResolvedValueOnce(null);
    const unauthenticated = await GET(new Request('http://localhost/preflight'), {
      params: Promise.resolve({ classId: 'class-1' }),
    });
    mocks.getServerAuthSession.mockResolvedValueOnce({ user: { id: 'student-1', role: 'STUDENT' } });
    const forbidden = await GET(new Request('http://localhost/preflight'), {
      params: Promise.resolve({ classId: 'class-1' }),
    });

    expect(unauthenticated.status).toBe(401);
    expect(forbidden.status).toBe(403);
    expect(mocks.preflight).not.toHaveBeenCalled();
  });

  it('fails closed for an unauthorized class or departed student', async () => {
    mocks.preflight.mockRejectedValue(
      new mocks.DiagnosisReportScopeError(403, 'diagnosis-student-not-in-class'),
    );

    const response = await GET(new Request('http://localhost/preflight?studentId=departed'), {
      params: Promise.resolve({ classId: 'class-1' }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'diagnosis-student-not-in-class' });
  });
});
