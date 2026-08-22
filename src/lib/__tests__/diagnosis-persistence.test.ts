import {
  DIAGNOSIS_REPORT_GENERATOR_VERSION,
  DiagnosisReportScopeError,
  diagnosisReportWriteSchema,
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
      findMany: vi.fn().mockResolvedValue([{ userId: 'student-1' }]),
    },
    studentRiskFlag: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    studentCompetencySnapshot: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    knowledgeProgress: {
      findMany: vi.fn().mockResolvedValue([{
        id: 'progress-1',
        userId: 'student-1',
        lastVisited: new Date('2026-07-30T07:00:00.000Z'),
      }]),
    },
    diagnosisReport: {
      create: vi.fn().mockResolvedValue({ id: 'report-1' }),
      findMany: vi.fn().mockResolvedValue([{
        id: 'report-1',
        scopeType: 'class',
        scopeId: 'class-1',
        classId: 'class-1',
        targetUserId: null,
        reportBody,
        riskSummary: {
          total: 1,
          byType: { stagnation: 0, constraint: 1, cross_domain: 0 },
          bySeverity: { low: 0, medium: 1, high: 0 },
        },
        evidenceCutoff: new Date(reportBody.evidenceCutoff),
        generatorVersion: DIAGNOSIS_REPORT_GENERATOR_VERSION,
        generatedAt: new Date('2026-07-30T08:01:00.000Z'),
      }]),
    },
    ...overrides,
  };
}

const reportBody = {
  summary: 'The class needs reinforcement on stability margins.',
  findings: [{
    knowledgeNodeId: 'node-1',
    title: 'Stability margin',
    riskType: 'constraint' as const,
    severity: 'medium' as const,
  }],
  evidenceRefs: ['knowledge-progress:progress-1'],
  evidenceCutoff: '2026-07-30T08:00:00.000Z',
  sourceCoverage: { progressRows: 1 },
  confidence: 'medium' as const,
  limitations: ['One evidence source is currently available.'],
};

function reviewedAssignment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'submission-1',
    studentId: 'student-1',
    frozenStudentId: 'student-1',
    frozenAudienceClassId: 'class-1',
    assignmentRevisionId: 'revision-1',
    reviewState: 'REVIEWED',
    reviewedAt: new Date('2026-07-30T07:00:00.000Z'),
    audience: {
      classId: 'class-1',
      assignmentRevisionId: 'revision-1',
    },
    revision: { id: 'revision-1' },
    ...overrides,
  };
}

describe('diagnosis report persistence', () => {
  it('persists a blank optional knowledge node id as missing without a preparation link', async () => {
    const db = createDb();
    await persistDiagnosisReport({
      teacherId: 'teacher-1',
      classId: 'class-1',
      targetStudentId: 'student-1',
      reportBody: {
        ...reportBody,
        findings: [{
          ...reportBody.findings[0],
          knowledgeNodeId: '   ',
        }],
      },
    }, db);

    const createCall = vi.mocked(db.diagnosisReport.create).mock.calls[0]?.[0] as {
      data: { reportBody: { findings: Array<Record<string, unknown>> } };
    };
    const storedFinding = createCall.data.reportBody.findings[0];
    expect(storedFinding).not.toHaveProperty('knowledgeNodeId');
    expect(storedFinding).not.toHaveProperty('prepLink');
  });

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
            }),
          ],
        }),
        riskSummary: {
          total: 1,
          byType: {
            stagnation: 0,
            constraint: 1,
            cross_domain: 0,
          },
          bySeverity: {
            low: 0,
            medium: 1,
            high: 0,
          },
        },
        generatorVersion: DIAGNOSIS_REPORT_GENERATOR_VERSION,
      }),
    });
    const createCall = vi.mocked(db.diagnosisReport.create).mock.calls[0]?.[0] as {
      data: { reportBody: { findings: Array<Record<string, unknown>> } };
    };
    expect(createCall.data.reportBody.findings[0]).not.toHaveProperty('prepLink');
  });

  it('binds generation governance audit metadata to the formal report', async () => {
    const db = createDb();
    const inputSummary = {
      schemaVersion: 'teacher-diagnosis-input-summary.v1',
      categories: {
        learningBehavior: { currentCount: 1, itemDigests: ['digest-1'] },
      },
    };

    await persistDiagnosisReport({
      teacherId: 'teacher-1',
      classId: 'class-1',
      targetStudentId: 'student-1',
      reportBody,
      generationJobId: 'job-1',
      generatorVersion: 'teacher-diagnosis.v2',
      ruleVersion: 'teacher-diagnosis-preflight.v1',
      generationReason: 'teacher-forced',
      forceReason: '用于本周教学复盘会议留档',
      previousReportId: 'report-previous',
      inputSummary,
      inputDigest: 'input-digest',
    }, db);

    expect(db.diagnosisReport.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'teacher-1',
        generationJobId: 'job-1',
        generatorVersion: 'teacher-diagnosis.v2',
        ruleVersion: 'teacher-diagnosis-preflight.v1',
        generationReason: 'teacher-forced',
        forceReason: '用于本周教学复盘会议留档',
        previousReportId: 'report-previous',
        inputSummary,
        inputDigest: 'input-digest',
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
      studentProfile: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
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

  it.each([
    { raw_answer: 'secret' },
    { rawAnswers: ['secret'] },
    { RAWANSWER: 'secret' },
    { nested: { eventPayload: { answer: 'secret' } } },
  ])('rejects non-allowlisted finding payload %j', async (unsafeFinding) => {
    const db = createDb();
    await expect(persistDiagnosisReport({
      teacherId: 'teacher-1',
      classId: 'class-1',
      reportBody: {
        ...reportBody,
        findings: [{ title: 'unsafe', ...unsafeFinding }],
      },
    }, db)).rejects.toBeDefined();
    expect(db.diagnosisReport.create).not.toHaveBeenCalled();
  });

  it('rejects ungoverned evidence references and client-controlled report metadata', async () => {
    await expect(persistDiagnosisReport({
      teacherId: 'teacher-1',
      classId: 'class-1',
      reportBody: {
        ...reportBody,
        evidenceRefs: ['local-file:C:/private-answer.json'],
      },
    }, createDb())).rejects.toBeDefined();

    expect(diagnosisReportWriteSchema.safeParse({
      targetStudentId: 'student-1',
      reportBody,
      riskSummary: { raw_answer: 'secret' },
      generatorVersion: 'client-controlled',
    }).success).toBe(false);
  });

  it('rejects missing or source-mismatched evidence references', async () => {
    const db = createDb({
      knowledgeProgress: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    });
    await expect(persistDiagnosisReport({
      teacherId: 'teacher-1',
      classId: 'class-1',
      reportBody,
    }, db)).rejects.toMatchObject({
      status: 400,
      message: 'diagnosis-evidence-not-found',
    });
    expect(db.diagnosisReport.create).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: 'cross-class audience',
      row: reviewedAssignment({
        audience: { classId: 'class-2', assignmentRevisionId: 'revision-1' },
      }),
    },
    {
      label: 'frozen student mismatch',
      row: reviewedAssignment({ frozenStudentId: 'student-2' }),
    },
    {
      label: 'revision mismatch',
      row: reviewedAssignment({ revision: { id: 'revision-2' } }),
    },
  ])('rejects $label assignment evidence during persistence', async ({ row }) => {
    const db = createDb({
      assignmentSubmission: {
        findMany: vi.fn().mockResolvedValue([row]),
      },
    });

    await expect(persistDiagnosisReport({
      teacherId: 'teacher-1',
      classId: 'class-1',
      targetStudentId: 'student-1',
      reportBody: {
        ...reportBody,
        evidenceRefs: ['assignment-submission:submission-1'],
      },
    }, db)).rejects.toMatchObject({
      status: 400,
      message: 'diagnosis-evidence-not-found',
    });
    expect(db.diagnosisReport.create).not.toHaveBeenCalled();
  });

  it('rejects evidence owned by another student or class', async () => {
    const foreignStudentDb = createDb({
      knowledgeProgress: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'progress-1',
          userId: 'student-2',
          lastVisited: new Date('2026-07-30T07:00:00.000Z'),
        }]),
      },
    });
    await expect(persistDiagnosisReport({
      teacherId: 'teacher-1',
      classId: 'class-1',
      targetStudentId: 'student-1',
      reportBody,
    }, foreignStudentDb)).rejects.toMatchObject({
      status: 403,
      message: 'diagnosis-evidence-outside-target',
    });

    const foreignClassDb = createDb({
      studentProfile: {
        findFirst: vi.fn().mockResolvedValue({ userId: 'student-1' }),
        findMany: vi.fn().mockResolvedValue([]),
      },
    });
    await expect(persistDiagnosisReport({
      teacherId: 'teacher-1',
      classId: 'class-1',
      reportBody,
    }, foreignClassDb)).rejects.toMatchObject({
      status: 403,
      message: 'diagnosis-evidence-outside-class',
    });
  });

  it('rejects top-level or finding evidence newer than the declared cutoff', async () => {
    const db = createDb({
      studentRiskFlag: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'risk-1',
          userId: 'student-1',
          flagType: 'constraint',
          triggeredAt: new Date('2026-07-01T09:00:00.000Z'),
          evidenceObservedAt: new Date('2026-07-30T09:00:00.000Z'),
        }]),
      },
    });
    await expect(persistDiagnosisReport({
      teacherId: 'teacher-1',
      classId: 'class-1',
      targetStudentId: 'student-1',
      reportBody: {
        ...reportBody,
        findings: [{
          title: 'Late evidence',
          evidenceRefs: ['student-risk-flag:risk-1'],
        }],
      },
    }, db)).rejects.toMatchObject({
      status: 400,
      message: 'diagnosis-evidence-after-cutoff',
    });
    expect(db.diagnosisReport.create).not.toHaveBeenCalled();
  });

  it('rejects legacy audit-only risk references', async () => {
    const db = createDb({
      studentRiskFlag: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'legacy-risk-1',
          userId: 'student-1',
          flagType: 'participation',
          evidenceObservedAt: new Date('2026-07-30T07:00:00.000Z'),
        }]),
      },
    });
    await expect(persistDiagnosisReport({
      teacherId: 'teacher-1',
      classId: 'class-1',
      targetStudentId: 'student-1',
      reportBody: {
        ...reportBody,
        evidenceRefs: ['student-risk-flag:legacy-risk-1'],
      },
    }, db)).rejects.toMatchObject({
      status: 400,
      message: 'diagnosis-evidence-unsupported-risk-type',
    });
    expect(db.diagnosisReport.create).not.toHaveBeenCalled();
  });

  it.each(['constraint', 'stagnation', 'cross_domain'])(
    'accepts governed current risk evidence of type %s',
    async (flagType) => {
      const db = createDb({
        studentRiskFlag: {
          findMany: vi.fn().mockResolvedValue([{
            id: 'risk-1',
            userId: 'student-1',
            flagType,
            evidenceObservedAt: new Date('2026-07-30T07:00:00.000Z'),
          }]),
        },
      });
      await persistDiagnosisReport({
        teacherId: 'teacher-1',
        classId: 'class-1',
        targetStudentId: 'student-1',
        reportBody: {
          ...reportBody,
          evidenceRefs: ['student-risk-flag:risk-1'],
        },
      }, db);

      expect(db.studentRiskFlag.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          id: { in: ['risk-1'] },
          flagType: { in: ['stagnation', 'constraint', 'cross_domain'] },
        },
      }));
      expect(db.diagnosisReport.create).toHaveBeenCalledTimes(1);
    },
  );

  it('reads only the requested class-level reports with a bounded limit', async () => {
    const db = createDb();
    const reports = await readDiagnosisReports({
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
    expect(reports[0]?.reportBody.findings[0]).toMatchObject({ knowledgeNodeId: 'node-1' });
    expect(reports[0]?.reportBody.findings[0]).not.toHaveProperty('prepLink');
  });
});
