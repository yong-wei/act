import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  DIAGNOSIS_PREFLIGHT_RULE_VERSION,
  digestDiagnosisGovernedInput,
  preflightDiagnosisGeneration,
  projectDiagnosisGenerationPreflight,
} from '@/lib/diagnosis-generation-preflight';
import { DIAGNOSIS_REPORT_GENERATOR_VERSION } from '@/lib/diagnosis-persistence';

const now = new Date('2026-08-19T03:00:00.000Z');

function reviewedAssignment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'submission-1',
    studentId: 'student-1',
    frozenStudentId: 'student-1',
    frozenAudienceClassId: 'class-1',
    assignmentRevisionId: 'revision-1',
    reviewState: 'REVIEWED',
    approvedTotal: 82,
    reviewedAt: new Date('2026-08-19T02:00:00.000Z'),
    audience: {
      classId: 'class-1',
      assignmentRevisionId: 'revision-1',
    },
    revision: {
      id: 'revision-1',
      contentHash: 'assignment-content-1',
      totalPoints: 100,
      publishedAt: new Date('2026-08-18T02:00:00.000Z'),
    },
    ...overrides,
  };
}

function fixture() {
  return {
    class: {
      findUnique: vi.fn().mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1', isActive: true }),
    },
    studentProfile: {
      findFirst: vi.fn().mockResolvedValue({ userId: 'student-1' }),
      findMany: vi.fn().mockResolvedValue([{ userId: 'student-1' }]),
    },
    diagnosisGenerationJob: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    diagnosisReport: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    studentRiskFlag: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    knowledgeProgress: {
      findMany: vi.fn().mockResolvedValue([{
        id: 'progress-1',
        userId: 'student-1',
        nodeId: 'node-1',
        status: 'IN_PROGRESS',
        progress: 50,
        timeSpent: 120,
        lastVisited: new Date('2026-08-19T02:00:00.000Z'),
      }]),
    },
    studentCompetencySnapshot: {
      findMany: vi.fn().mockResolvedValue([{
        id: 'snapshot-1',
        userId: 'student-1',
        snapshotAt: new Date('2026-08-19T01:00:00.000Z'),
        competencyVector: { analysis: 0.6 },
        calculationVersion: 'v1',
      }]),
    },
    assignmentSubmission: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    adaptiveAssessmentSession: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

describe('diagnosis generation preflight', () => {
  let db: ReturnType<typeof fixture>;

  beforeEach(() => {
    db = fixture();
  });

  it('permits the first generation without creating jobs or reports', async () => {
    const result = await preflightDiagnosisGeneration(db as never, {
      teacherId: 'teacher-1',
      classId: 'class-1',
      now,
    });

    expect(result).toMatchObject({
      status: 'FIRST_GENERATION',
      canGenerate: true,
      canForce: false,
      generationReason: 'first-generation',
    });
    expect(result.categories).toMatchObject({
      assignment: { availability: 'available', currentCount: 0, changedCount: 0 },
      assessment: { availability: 'available', currentCount: 0, changedCount: 0 },
      learningBehavior: { availability: 'available', currentCount: 1, changedCount: 1 },
      eligibility: { availability: 'available', currentCount: 1, changedCount: 1 },
    });
    expect(db.diagnosisGenerationJob).not.toHaveProperty('create');
    expect(db.diagnosisReport).not.toHaveProperty('create');
  });

  it('blocks unchanged input and exposes only aggregate category data', async () => {
    const first = await preflightDiagnosisGeneration(db as never, {
      teacherId: 'teacher-1',
      classId: 'class-1',
      now,
    });
    db.diagnosisReport.findFirst.mockResolvedValue({
      id: 'report-1',
      evidenceCutoff: now,
      generatedAt: now,
      generatorVersion: DIAGNOSIS_REPORT_GENERATOR_VERSION,
      ruleVersion: DIAGNOSIS_PREFLIGHT_RULE_VERSION,
      inputSummary: first.inputSummary,
      inputDigest: first.inputDigest,
    });

    const result = await preflightDiagnosisGeneration(db as never, {
      teacherId: 'teacher-1',
      classId: 'class-1',
      now,
    });
    const projection = projectDiagnosisGenerationPreflight(result);

    expect(result).toMatchObject({
      status: 'NO_EFFECTIVE_CHANGE',
      canGenerate: false,
      canForce: true,
    });
    expect(result.categories.learningBehavior.changedCount).toBe(0);
    expect(JSON.stringify(projection)).not.toContain('student-1');
    expect(projection).not.toHaveProperty('inputDigest');
    expect(projection).not.toHaveProperty('inputSummary');
  });

  it('permits changed governed progress but ignores unrelated fact stores', async () => {
    const first = await preflightDiagnosisGeneration(db as never, {
      teacherId: 'teacher-1',
      classId: 'class-1',
      now,
    });
    db.diagnosisReport.findFirst.mockResolvedValue({
      id: 'report-1',
      evidenceCutoff: now,
      generatedAt: now,
      generatorVersion: DIAGNOSIS_REPORT_GENERATOR_VERSION,
      ruleVersion: DIAGNOSIS_PREFLIGHT_RULE_VERSION,
      inputSummary: first.inputSummary,
      inputDigest: first.inputDigest,
    });
    db.knowledgeProgress.findMany.mockResolvedValue([{
      id: 'progress-1',
      userId: 'student-1',
      nodeId: 'node-1',
      status: 'COMPLETED',
      progress: 100,
      timeSpent: 180,
      lastVisited: now,
    }]);

    const result = await preflightDiagnosisGeneration(db as never, {
      teacherId: 'teacher-1',
      classId: 'class-1',
      now,
    });

    expect(result.status).toBe('NEW_EVIDENCE');
    expect(result.categories.learningBehavior.changedCount).toBe(2);
    expect(db).not.toHaveProperty('learningFact');
  });

  it('ignores risk metadata that is not projected to the diagnosis generator', async () => {
    const riskRow = {
      id: 'risk-1',
      userId: 'student-1',
      flagType: 'constraint',
      severity: 'medium',
      description: '需要复核约束条件。',
      evidenceJson: { avgProgress: 42, internalTrace: 'first' },
      triggeredAt: new Date('2026-08-19T01:30:00.000Z'),
      evidenceObservedAt: new Date('2026-08-19T01:30:00.000Z'),
    };
    db.studentRiskFlag.findMany.mockResolvedValue([riskRow]);
    const first = await preflightDiagnosisGeneration(db as never, {
      teacherId: 'teacher-1',
      classId: 'class-1',
      now,
    });
    db.diagnosisReport.findFirst.mockResolvedValue({
      id: 'report-1',
      evidenceCutoff: now,
      generatedAt: now,
      generatorVersion: first.generatorVersion,
      ruleVersion: first.ruleVersion,
      inputSummary: first.inputSummary,
      inputDigest: first.inputDigest,
    });
    db.studentRiskFlag.findMany.mockResolvedValue([{
      ...riskRow,
      evidenceJson: { avgProgress: 42, internalTrace: 'changed-but-not-visible' },
    }]);

    const result = await preflightDiagnosisGeneration(db as never, {
      teacherId: 'teacher-1',
      classId: 'class-1',
      now,
    });

    expect(result.status).toBe('NO_EFFECTIVE_CHANGE');
    expect(result.categories.risk.changedCount).toBe(0);
  });

  it('keeps the canonical digest stable when tied evidence rows arrive in a different order', async () => {
    const tiedAt = new Date('2026-08-19T02:00:00.000Z');
    const progressRows = [
      {
        id: 'progress-b', userId: 'student-1', nodeId: 'node-b', status: 'IN_PROGRESS',
        progress: 40, timeSpent: 90, lastVisited: tiedAt,
      },
      {
        id: 'progress-a', userId: 'student-1', nodeId: 'node-a', status: 'IN_PROGRESS',
        progress: 60, timeSpent: 120, lastVisited: tiedAt,
      },
    ];
    db.knowledgeProgress.findMany.mockResolvedValueOnce(progressRows);
    const first = await preflightDiagnosisGeneration(db as never, {
      teacherId: 'teacher-1', classId: 'class-1', now,
    });
    db.knowledgeProgress.findMany.mockResolvedValueOnce([...progressRows].reverse());

    const second = await preflightDiagnosisGeneration(db as never, {
      teacherId: 'teacher-1', classId: 'class-1', now,
    });

    expect(second.inputDigest).toBe(first.inputDigest);
    expect(second.governedInput).toEqual(first.governedInput);
    expect(db.knowledgeProgress.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      orderBy: [{ userId: 'asc' }, { lastVisited: 'desc' }, { id: 'asc' }],
    }));
  });

  it('permits one migration report for legacy audit metadata', async () => {
    db.diagnosisReport.findFirst.mockResolvedValue({
      id: 'legacy-report',
      evidenceCutoff: now,
      generatedAt: now,
      generatorVersion: DIAGNOSIS_REPORT_GENERATOR_VERSION,
      ruleVersion: null,
      inputSummary: null,
      inputDigest: null,
    });

    const result = await preflightDiagnosisGeneration(db as never, {
      teacherId: 'teacher-1',
      classId: 'class-1',
      now,
    });

    expect(result).toMatchObject({
      status: 'VERSION_CHANGE',
      generationReason: 'version-change',
      previousReport: { id: 'legacy-report' },
    });
  });

  it('returns unavailable when no eligible governed input exists', async () => {
    db.knowledgeProgress.findMany.mockResolvedValue([]);
    db.studentCompetencySnapshot.findMany.mockResolvedValue([]);

    const result = await preflightDiagnosisGeneration(db as never, {
      teacherId: 'teacher-1',
      classId: 'class-1',
      now,
    });

    expect(result).toMatchObject({ status: 'UNAVAILABLE', canGenerate: false, canForce: false });
  });

  it('returns the active job before permitting another generation', async () => {
    db.diagnosisGenerationJob.findUnique.mockResolvedValue({
      id: 'job-active',
      state: 'RUNNING',
      evidenceCutoff: now,
    });

    const result = await preflightDiagnosisGeneration(db as never, {
      teacherId: 'teacher-1',
      classId: 'class-1',
      now,
    });

    expect(result).toMatchObject({
      status: 'ACTIVE_JOB',
      canGenerate: false,
      canForce: false,
      activeJob: { id: 'job-active', state: 'RUNNING' },
    });
  });

  it('includes reviewed assignments and class-bound assessment sessions without raw answers', async () => {
    db.assignmentSubmission.findMany.mockResolvedValue([reviewedAssignment()]);
    const contentDigest = digestDiagnosisGovernedInput(['assessment-item-1']);
    db.adaptiveAssessmentSession.findMany.mockResolvedValue([{
      id: 'assessment-session-1',
      userId: 'student-1',
      metadata: {
        diagnosisClassAssessment: {
          schemaVersion: 'diagnosis-class-assessment-session.v1',
          classId: 'class-1',
          assessmentId: 'assessment-1',
          contentDigest,
        },
      },
      answers: [{
        id: 'answer-1',
        isCorrect: true,
        score: 100,
        answeredAt: new Date('2026-08-19T02:30:00.000Z'),
        questionRef: { contentHash: 'assessment-item-1' },
      }],
    }]);

    const result = await preflightDiagnosisGeneration(db as never, {
      teacherId: 'teacher-1',
      classId: 'class-1',
      now,
    });

    expect(result.categories).toMatchObject({
      assignment: { availability: 'available', currentCount: 1, changedCount: 1 },
      assessment: { availability: 'available', currentCount: 1, changedCount: 1 },
    });
    expect(result.governedInput).toMatchObject({
      assignmentSubmissions: [{ id: 'submission-1', score: 82, totalPoints: 100 }],
      assessmentSessions: [{ id: 'assessment-session-1', score: 100, correctCount: 1 }],
    });
    expect(JSON.stringify(result.governedInput)).not.toContain('selectedOptionKey');
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
      row: reviewedAssignment({
        audience: { classId: 'class-1', assignmentRevisionId: 'revision-2' },
      }),
    },
  ])('excludes reviewed assignments with $label from governed input', async ({ row }) => {
    db.assignmentSubmission.findMany.mockResolvedValue([row]);

    const result = await preflightDiagnosisGeneration(db as never, {
      teacherId: 'teacher-1',
      classId: 'class-1',
      now,
    });

    expect(result.categories.assignment).toMatchObject({
      availability: 'available',
      currentCount: 0,
    });
    expect(result.governedInput.assignmentSubmissions).toEqual([]);
  });
});
