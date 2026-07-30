import {
  DiagnosisReportScopeError,
  persistDiagnosisReport,
  readDiagnosisReports,
  type DiagnosisPersistenceDb,
} from '@/lib/diagnosis-persistence';
import { describe, expect, it, vi } from 'vitest';

function createDb(overrides: Partial<DiagnosisPersistenceDb> = {}): DiagnosisPersistenceDb {
  return {
    class: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'class-1',
        teacherId: 'teacher-1',
        isActive: true,
      }),
    },
    studentProfile: {
      findFirst: vi.fn().mockResolvedValue({ userId: 'student-1' }),
    },
    diagnosisReport: {
      create: vi.fn().mockResolvedValue({ id: 'report-1' }),
      findMany: vi.fn().mockResolvedValue([{ id: 'report-1' }]),
    },
    ...overrides,
  };
}

const reportBody = {
  summary: 'The class needs reinforcement on stability margins.',
  findings: [{ knowledgeNodeId: 'node-1', title: 'Stability margin' }],
  evidenceRefs: ['knowledge-progress:student-1:node-1'],
  evidenceCutoff: '2026-07-30T08:00:00.000Z',
  sourceCoverage: { knowledgeProgress: 1 },
  confidence: 'medium' as const,
  limitations: ['One evidence source is currently available.'],
};

describe('diagnosis report persistence', () => {
  it('derives the student scope, validates membership, and stores governed evidence metadata', async () => {
    const db = createDb();

    await persistDiagnosisReport({
      teacherId: 'teacher-1',
      classId: 'class-1',
      targetStudentId: 'student-1',
      reportBody,
    }, db);

    expect(db.studentProfile.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'student-1', classId: 'class-1' },
    }));
    expect(db.diagnosisReport.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scopeType: 'student',
        scopeId: 'student-1',
        classId: 'class-1',
        userId: 'teacher-1',
        targetUserId: 'student-1',
        evidenceCutoff: new Date(reportBody.evidenceCutoff),
        reportBody: expect.objectContaining({
          findings: [
            expect.objectContaining({
              knowledgeNodeId: 'node-1',
              prepLink: '/teacher/preparation?knowledgeNodeId=node-1&classId=class-1',
            }),
          ],
        }),
      }),
    });
  });

  it('rejects a teacher outside the class and a student outside the roster', async () => {
    const foreignClassDb = createDb({
      class: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'class-1',
          teacherId: 'teacher-2',
          isActive: true,
        }),
      },
    });
    await expect(persistDiagnosisReport({
      teacherId: 'teacher-1',
      classId: 'class-1',
      reportBody,
    }, foreignClassDb)).rejects.toMatchObject({
      status: 403,
      message: 'diagnosis-class-forbidden',
    });

    const missingStudentDb = createDb({
      studentProfile: { findFirst: vi.fn().mockResolvedValue(null) },
    });
    await expect(readDiagnosisReports({
      teacherId: 'teacher-1',
      classId: 'class-1',
      targetStudentId: 'student-2',
    }, missingStudentDb)).rejects.toMatchObject({
      status: 403,
      message: 'diagnosis-student-not-in-class',
    });
  });

  it('rejects nested raw evidence payloads', async () => {
    const db = createDb();
    await expect(persistDiagnosisReport({
      teacherId: 'teacher-1',
      classId: 'class-1',
      reportBody: {
        ...reportBody,
        findings: [{ title: 'unsafe', eventPayload: { answer: 'raw' } }],
      },
    }, db)).rejects.toMatchObject({
      status: 400,
    });
    expect(db.diagnosisReport.create).not.toHaveBeenCalled();
  });

  it('reads only the requested class-level reports with a bounded limit', async () => {
    const db = createDb();
    await readDiagnosisReports({
      teacherId: 'teacher-1',
      classId: 'class-1',
      limit: 500,
    }, db);

    expect(db.diagnosisReport.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        classId: 'class-1',
        targetUserId: null,
      },
      take: 100,
    }));
  });
});
