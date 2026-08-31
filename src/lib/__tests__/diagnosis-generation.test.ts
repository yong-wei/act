import { Prisma } from '@prisma/client';
import { NoOutputGeneratedError } from 'ai';
import { UnrecoverableError } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('server-only', () => ({}));

const { providerGenerate, TextJsonFallbackOutputError } = vi.hoisted(() => ({
  providerGenerate: vi.fn(),
  TextJsonFallbackOutputError: class TextJsonFallbackOutputError extends Error {},
}));

vi.mock('@/lib/konling-agent-runtime', () => ({
  getOrCreateKonlingAgentSession: vi.fn().mockResolvedValue({ id: 'agent-session-1' }),
  verifyKonlingRuntimeScope: vi.fn().mockResolvedValue({ ok: true, scope: {} }),
}));

vi.mock('@/lib/smart-lesson-plan/provider-runtime', () => ({
  resolveSmartLessonStructuredProvider: vi.fn().mockResolvedValue({ generate: providerGenerate }),
  TextJsonFallbackOutputError,
}));

import {
  claimDiagnosisGenerationAttempt,
  DiagnosisGenerationOutputValidationError,
  DIAGNOSIS_GENERATION_ATTEMPT_TIMEOUT_MS,
  DIAGNOSIS_GENERATION_LOCK_DURATION_MS,
  DIAGNOSIS_PROVIDER_GENERATION_WINDOW_MS,
  diagnosisGenerationRequestSchema,
  projectDiagnosisGenerationJob,
  retryDiagnosisGenerationJob,
  startDiagnosisGenerationJob,
} from '@/lib/diagnosis-generation';
import { diagnosisReportBodySchema } from '@/lib/diagnosis-persistence';
import {
  DiagnosisGenerationFindingAttributionError,
  DiagnosisGenerationProviderEmptyOutputError,
  DiagnosisGenerationProviderLanguageError,
  buildKnowledgeNodeByEvidenceRef,
  enforceDiagnosisFindingNodeAttribution,
  generateGovernedDiagnosisReport,
  isSimplifiedChineseNaturalLanguageText,
  validateDiagnosisReportBodyLanguage,
} from '@/lib/diagnosis-generation-provider';
import { processDiagnosisGenerationJob } from '@/lib/diagnosis-generation-worker';
import { SmartLessonPlanError } from '@/lib/smart-lesson-plan/domain';
import {
  digestDiagnosisGovernedInput,
  preflightDiagnosisGeneration,
} from '@/lib/diagnosis-generation-preflight';

const now = new Date('2026-08-08T08:00:00.000Z');
const governedInput = {
  schemaVersion: 'teacher-diagnosis-governed-input.v1',
  classId: 'class-1',
  studentIds: ['student-1'],
  riskFlags: [],
  competencySnapshots: [],
  knowledgeProgress: [{
    id: 'progress-1',
    userId: 'student-1',
    nodeId: 'node-1',
    status: 'IN_PROGRESS',
    progress: 50,
    timeSpent: 120,
    lastVisited: now.toISOString(),
  }],
};
const governedInputDigest = digestDiagnosisGovernedInput(governedInput);

function publicJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    classId: 'class-1',
    targetUserId: null,
    scopeType: 'class',
    scopeId: 'class-1',
    state: 'QUEUED',
    evidenceCutoff: now,
    generatorVersion: 'teacher-diagnosis.v1',
    failureCode: null,
    failureMessage: null,
    retryable: false,
    createdAt: now,
    startedAt: null,
    completedAt: null,
    report: null,
    ...overrides,
  };
}

function dbFixture() {
  const db = {
    class: {
      findUnique: vi.fn().mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1', isActive: true }),
    },
    studentProfile: {
      findFirst: vi.fn().mockResolvedValue({ userId: 'student-1' }),
      findMany: vi.fn().mockResolvedValue([{ userId: 'student-1' }]),
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
        lastVisited: now,
      }]),
    },
    studentCompetencySnapshot: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    assignmentSubmission: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    adaptiveAssessmentSession: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    diagnosisGenerationJob: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    diagnosisGenerationAttempt: {
      updateMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    $executeRaw: vi.fn().mockResolvedValue(1),
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(async (callback: (client: unknown) => unknown) => callback(db));
  return db;
}

function workerDbFixture() {
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    diagnosisGenerationJob: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: 'job-1',
        userId: 'teacher-1',
        classId: 'class-1',
        targetUserId: null,
        evidenceCutoff: now,
        generatorVersion: 'teacher-diagnosis.v1',
        governedInput,
        inputDigest: governedInputDigest,
      }),
      update: vi.fn().mockResolvedValue({ id: 'job-1' }),
    },
    diagnosisGenerationAttempt: {
      updateMany: vi.fn()
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValue({ count: 1 }),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: 'attempt-1', attemptNumber: 1 }),
    },
  };
  return {
    db: {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    },
    tx,
  };
}

describe('teacher diagnosis generation contracts', () => {
  it('fails closed before database or provider access when the frozen input digest is altered', async () => {
    const db = { class: { findUnique: vi.fn() } };

    await expect(generateGovernedDiagnosisReport(db as never, {
      jobId: 'job-1',
      attemptId: 'attempt-1',
      teacherId: 'teacher-1',
      classId: 'class-1',
      targetStudentId: null,
      evidenceCutoff: now,
      generatorVersion: 'teacher-diagnosis.v1',
      governedInput,
      inputDigest: '0'.repeat(64),
    })).rejects.toMatchObject({
      code: 'diagnosis-governed-input-digest-mismatch',
    });
    expect(db.class.findUnique).not.toHaveBeenCalled();
  });

  it('uses report-local aliases instead of student identities in assignment and assessment provider rows', async () => {
    const providerInput = {
      schemaVersion: 'teacher-diagnosis-governed-input.v1' as const,
      classId: 'class-1',
      studentIds: ['student-actual-1', 'student-actual-2'],
      assignmentSubmissions: [{
        id: 'assignment-submission-1',
        userId: 'student-actual-1',
        assignmentRevisionId: 'assignment-revision-1',
        contentHash: 'assignment-content-sha256',
        score: 82,
        totalPoints: 100,
        reviewedAt: now.toISOString(),
      }],
      assessmentSessions: [{
        id: 'assessment-session-1',
        userId: 'student-actual-1',
        assessmentId: 'assessment-1',
        contentDigest: 'assessment-content-sha256',
        itemCount: 10,
        correctCount: 8,
        score: 80,
        completedAt: now.toISOString(),
      }],
      riskFlags: [],
      competencySnapshots: [],
      knowledgeProgress: [],
    };
    providerGenerate.mockResolvedValueOnce({
      output: {
        summary: '作业与测验结果显示班级需要继续巩固。',
        findings: [],
        evidenceRefs: ['assignment-submission:assignment-submission-1'],
        evidenceCutoff: now.toISOString(),
        sourceCoverage: { classMembers: 2 },
        confidence: 'medium',
        limitations: [],
      },
      normalizedResponseId: 'provider-response-1',
    });

    await generateGovernedDiagnosisReport({} as never, {
      jobId: 'job-1',
      attemptId: 'attempt-privacy-1',
      teacherId: 'teacher-1',
      classId: 'class-1',
      targetStudentId: null,
      evidenceCutoff: now,
      generatorVersion: 'teacher-diagnosis.v1',
      governedInput: providerInput,
      inputDigest: digestDiagnosisGovernedInput(providerInput),
    });

    const generatedPrompt = providerGenerate.mock.calls[0]?.[0]?.prompt;
    expect(typeof generatedPrompt).toBe('string');
    const governedToolResults = JSON.parse(generatedPrompt as string).governedToolResults;
    expect(governedToolResults.assignments.assignments[0].learnerAlias).toMatch(/^learner-[a-f0-9]{12}-1$/u);
    expect(governedToolResults.assessments.assessments[0].learnerAlias)
      .toBe(governedToolResults.assignments.assignments[0].learnerAlias);
    expect(JSON.stringify(governedToolResults)).not.toContain('student-actual-1');
    expect(JSON.stringify(governedToolResults)).not.toContain('student-actual-2');
  });

  it('normalizes assignment aggregates against their reviewed total points', async () => {
    const providerInput = {
      schemaVersion: 'teacher-diagnosis-governed-input.v1' as const,
      classId: 'class-1',
      studentIds: ['student-1', 'student-2'],
      assignmentSubmissions: [
        {
          id: 'assignment-submission-1',
          userId: 'student-1',
          assignmentRevisionId: 'assignment-revision-1',
          contentHash: 'assignment-content-sha256',
          score: 20,
          totalPoints: 20,
          reviewedAt: now.toISOString(),
        },
        {
          id: 'assignment-submission-2',
          userId: 'student-2',
          assignmentRevisionId: 'assignment-revision-2',
          contentHash: 'assignment-content-sha256',
          score: 10,
          totalPoints: 20,
          reviewedAt: now.toISOString(),
        },
      ],
      riskFlags: [],
      competencySnapshots: [],
      knowledgeProgress: [],
    };
    providerGenerate.mockResolvedValueOnce({
      output: {
        summary: '作业结果需要复核。',
        findings: [],
        evidenceRefs: ['assignment-submission:assignment-submission-1'],
        evidenceCutoff: now.toISOString(),
        sourceCoverage: { classMembers: 2 },
        confidence: 'medium',
        limitations: [],
      },
      normalizedResponseId: 'provider-response-normalized-assignment',
    });

    await generateGovernedDiagnosisReport({} as never, {
      jobId: 'job-1',
      attemptId: 'attempt-normalized-assignment-1',
      teacherId: 'teacher-1',
      classId: 'class-1',
      targetStudentId: null,
      evidenceCutoff: now,
      generatorVersion: 'teacher-diagnosis.v1',
      governedInput: providerInput,
      inputDigest: digestDiagnosisGovernedInput(providerInput),
    });

    const assignments = JSON.parse(providerGenerate.mock.calls.at(-1)?.[0]?.prompt as string)
      .governedToolResults.assignments;
    expect(assignments.assignments.map((assignment: { scorePercent: number }) => assignment.scorePercent))
      .toEqual([50, 100]);
    expect(assignments.aggregate).toEqual({
      count: 2,
      mean: 75,
      min: 50,
      max: 100,
      below60: 1,
      atLeast85: 1,
    });
  });

  it('maps a provider-window timeout to the retryable empty-output failure', async () => {
    providerGenerate.mockRejectedValueOnce(new SmartLessonPlanError('advisory-provider-timeout', 503));

    await expect(generateGovernedDiagnosisReport({} as never, {
      jobId: 'job-1',
      attemptId: 'attempt-provider-window-timeout-1',
      teacherId: 'teacher-1',
      classId: 'class-1',
      targetStudentId: null,
      evidenceCutoff: now,
      generatorVersion: 'teacher-diagnosis.v1',
      governedInput,
      inputDigest: governedInputDigest,
    })).rejects.toBeInstanceOf(DiagnosisGenerationProviderEmptyOutputError);
  });

  it('maps an unusable text fallback to the retryable empty-output failure', async () => {
    providerGenerate.mockRejectedValueOnce(new TextJsonFallbackOutputError());

    await expect(generateGovernedDiagnosisReport({} as never, {
      jobId: 'job-1',
      attemptId: 'attempt-invalid-fallback-1',
      teacherId: 'teacher-1',
      classId: 'class-1',
      targetStudentId: null,
      evidenceCutoff: now,
      generatorVersion: 'teacher-diagnosis.v1',
      governedInput,
      inputDigest: governedInputDigest,
    })).rejects.toBeInstanceOf(DiagnosisGenerationProviderEmptyOutputError);
  });

  it('maps provider-schema-invalid text fallback output to the retryable empty-output failure', async () => {
    const output = {
      summary: '持久化报告模式可接受该结果。',
      findings: Array.from({ length: 7 }, () => ({
        title: '超出提供方诊断模式上限的发现项。',
        evidenceRefs: [],
      })),
      evidenceRefs: ['knowledge-progress:progress-1'],
      evidenceCutoff: now.toISOString(),
      sourceCoverage: { progressRows: 1 },
      confidence: 'medium' as const,
      limitations: [],
    };
    expect(diagnosisReportBodySchema.safeParse(output).success).toBe(true);
    providerGenerate.mockResolvedValueOnce({
      output,
      normalizedResponseId: 'provider-response-schema-invalid-fallback',
      usedTextJsonFallback: true,
    });

    await expect(generateGovernedDiagnosisReport({} as never, {
      jobId: 'job-1',
      attemptId: 'attempt-schema-invalid-fallback-1',
      teacherId: 'teacher-1',
      classId: 'class-1',
      targetStudentId: null,
      evidenceCutoff: now,
      generatorVersion: 'teacher-diagnosis.v1',
      governedInput,
      inputDigest: governedInputDigest,
    })).rejects.toBeInstanceOf(DiagnosisGenerationProviderEmptyOutputError);
  });

  it('bounds a large class provider projection while retaining complete governed coverage', async () => {
    const studentIds = Array.from({ length: 100 }, (_value, index) => `student-${index}`);
    const providerInput = {
      schemaVersion: 'teacher-diagnosis-governed-input.v1' as const,
      classId: 'class-1',
      studentIds,
      assignmentSubmissions: studentIds.map((userId, index) => ({
        id: `assignment-submission-${index}`,
        userId,
        assignmentRevisionId: 'assignment-revision-1',
        contentHash: 'assignment-content-sha256',
        score: index,
        totalPoints: 100,
        reviewedAt: now.toISOString(),
      })),
      assessmentSessions: studentIds.map((userId, index) => ({
        id: `assessment-session-${index}`,
        userId,
        assessmentId: 'assessment-1',
        contentDigest: 'assessment-content-sha256',
        itemCount: 10,
        correctCount: index % 10,
        score: index,
        completedAt: now.toISOString(),
      })),
      riskFlags: studentIds.slice(0, 25).map((userId, index) => ({
        id: `risk-${index}`,
        userId,
        type: index % 2 === 0 ? 'stagnation' : 'constraint',
        severity: index % 3 === 0 ? 'high' : 'medium',
        description: 'Synthetic governed risk summary.',
        evidenceSummary: { factCount: index + 1 },
        triggeredAt: now.toISOString(),
        observedAt: now.toISOString(),
      })),
      competencySnapshots: studentIds.map((userId, index) => ({
        id: `snapshot-${index}`,
        userId,
        snapshotAt: now.toISOString(),
        competencyVector: { modeling: 60 + (index % 30), analysis: 55 + (index % 35) },
        calculationVersion: 'test-v1',
      })),
      knowledgeProgress: studentIds.flatMap((userId, studentIndex) => (
        Array.from({ length: 7 }, (_value, nodeIndex) => ({
          id: `progress-${studentIndex}-${nodeIndex}`,
          userId,
          nodeId: `node-${nodeIndex}`,
          status: nodeIndex % 2 === 0 ? 'MASTERED' : 'IN_PROGRESS',
          progress: 40 + ((studentIndex + nodeIndex) % 60),
          timeSpent: 120 + studentIndex,
          lastVisited: now.toISOString(),
        }))
      )),
    };
    providerGenerate.mockResolvedValueOnce({
      output: {
        summary: '班级证据覆盖完整，建议优先处理低分群体。',
        findings: [],
        evidenceRefs: ['assignment-submission:assignment-submission-0'],
        evidenceCutoff: now.toISOString(),
        sourceCoverage: { classMembers: 100 },
        confidence: 'high',
        limitations: [],
      },
      normalizedResponseId: 'provider-response-bounded',
    });

    await generateGovernedDiagnosisReport({} as never, {
      jobId: 'job-1',
      attemptId: 'attempt-bounded-1',
      teacherId: 'teacher-1',
      classId: 'class-1',
      targetStudentId: null,
      evidenceCutoff: now,
      generatorVersion: 'teacher-diagnosis.v1',
      governedInput: providerInput,
      inputDigest: digestDiagnosisGovernedInput(providerInput),
    });

    const prompt = providerGenerate.mock.calls.at(-1)?.[0]?.prompt;
    const governedToolResults = JSON.parse(prompt as string).governedToolResults;
    expect(governedToolResults.assignments.assignments).toHaveLength(24);
    expect(governedToolResults.assessments.assessments).toHaveLength(24);
    expect(governedToolResults.riskFlags.flags).toHaveLength(24);
    expect(governedToolResults.competency.evidenceRefs).toHaveLength(24);
    expect(governedToolResults.knowledgeProgress.progress).toHaveLength(7);
    expect(governedToolResults.assignments.sourceCoverage).toMatchObject({
      includedStudents: 100,
      evidenceCount: 100,
    });
    expect(governedToolResults.knowledgeProgress.sourceCoverage).toMatchObject({
      progressRows: 700,
      includedStudents: 100,
    });
    expect(governedToolResults.assignments.providerProjection).toMatchObject({
      totalRecords: 100,
      includedRecords: 24,
    });
    expect(JSON.stringify(governedToolResults)).not.toContain('student-0');
    expect((prompt as string).length).toBeLessThan(80_000);

    const providerSchema = providerGenerate.mock.calls.at(-1)?.[0]?.schema as z.ZodType;
    const providerReport = {
      summary: '班级证据覆盖完整，建议优先处理低分群体。',
      findings: [],
      evidenceRefs: ['assignment-submission:assignment-submission-0'],
      evidenceCutoff: now.toISOString(),
      sourceCoverage: { classMembers: 100 },
      confidence: 'high',
      limitations: [],
    };
    expect(providerSchema.safeParse(providerReport).success).toBe(true);
    expect(providerSchema.safeParse({
      ...providerReport,
      summary: 'a'.repeat(1_001),
    }).success).toBe(false);
    expect(providerSchema.safeParse({
      ...providerReport,
      findings: Array.from({ length: 7 }, () => ({
        title: '需要关注的学习表现',
        evidenceRefs: ['assignment-submission:assignment-submission-0'],
      })),
    }).success).toBe(false);
  });

  it('passes the immutable preflight input to the provider after mutable evidence changes', async () => {
    const { db } = workerDbFixture();
    const providerUnavailable = new Error('provider unavailable');
    const generate = vi.fn().mockRejectedValue(providerUnavailable);

    await expect(processDiagnosisGenerationJob(db as never, 'job-1', undefined, generate))
      .rejects.toBe(providerUnavailable);

    expect(generate).toHaveBeenCalledWith(db, expect.objectContaining({
      governedInput,
      inputDigest: governedInputDigest,
    }));
  });

  it('records malformed provider output as non-retryable and stops the worker', async () => {
    const parsed = diagnosisReportBodySchema.safeParse({
      summary: 'Malformed diagnosis output.',
      findings: [],
      evidenceRefs: [],
      evidenceCutoff: now.toISOString(),
      sourceCoverage: { progressRows: 1 },
      confidence: 'medium',
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const { db, tx } = workerDbFixture();
    await expect(processDiagnosisGenerationJob(
      db as never,
      'job-1',
      { attemptsMade: 0, opts: { attempts: 3 } } as never,
      async () => { throw new DiagnosisGenerationOutputValidationError(parsed.error); },
    )).rejects.toBeInstanceOf(UnrecoverableError);

    expect(tx.diagnosisGenerationAttempt.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        state: 'FAILED',
        errorCode: 'diagnosis-output-invalid',
      }),
    }));
    expect(tx.diagnosisGenerationJob.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        state: 'FAILED',
        activeScopeKey: null,
        failureCode: 'diagnosis-output-invalid',
        retryable: false,
      }),
    }));
  });

  it('records provider-window timeout as empty-output instead of task timeout', async () => {
    const providerTimeout = new SmartLessonPlanError('advisory-provider-timeout', 503);
    const { db, tx } = workerDbFixture();

    await expect(processDiagnosisGenerationJob(
      db as never,
      'job-1',
      { attemptsMade: 0, opts: { attempts: 3 } } as never,
      async () => { throw providerTimeout; },
    )).rejects.toBe(providerTimeout);

    expect(tx.diagnosisGenerationAttempt.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        state: 'FAILED',
        errorCode: 'diagnosis-provider-empty-output',
        errorMessage: '诊断模型未返回可用的结构化结果。',
      }),
    }));
    expect(tx.diagnosisGenerationJob.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { state: 'QUEUED', startedAt: null },
    }));
  });

  it('keeps ordinary provider failures retryable', async () => {
    const providerError = new Error('provider unavailable');
    const { db, tx } = workerDbFixture();

    await expect(processDiagnosisGenerationJob(
      db as never,
      'job-1',
      { attemptsMade: 0, opts: { attempts: 3 } } as never,
      async () => { throw providerError; },
    )).rejects.toBe(providerError);

    expect(tx.diagnosisGenerationAttempt.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        state: 'FAILED',
        errorCode: 'diagnosis-provider-unavailable',
      }),
    }));
    expect(tx.diagnosisGenerationJob.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { state: 'QUEUED', startedAt: null },
    }));
  });

  it('records a provider-schema-invalid fallback as retryable with a specific diagnosis code', async () => {
    const { db, tx } = workerDbFixture();
    providerGenerate.mockResolvedValueOnce({
      output: {
        summary: '持久化报告模式可接受该结果。',
        findings: Array.from({ length: 7 }, () => ({
          title: '超出提供方诊断模式上限的发现项。',
          evidenceRefs: [],
        })),
        evidenceRefs: ['knowledge-progress:progress-1'],
        evidenceCutoff: now.toISOString(),
        sourceCoverage: { progressRows: 1 },
        confidence: 'medium',
        limitations: [],
      },
      normalizedResponseId: 'provider-response-schema-invalid-fallback',
      usedTextJsonFallback: true,
    });

    await expect(processDiagnosisGenerationJob(
      db as never,
      'job-1',
      { attemptsMade: 2, opts: { attempts: 3 } } as never,
    )).rejects.toBeInstanceOf(DiagnosisGenerationProviderEmptyOutputError);

    expect(tx.diagnosisGenerationAttempt.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        state: 'FAILED',
        errorCode: 'diagnosis-provider-empty-output',
        errorMessage: '诊断模型未返回可用的结构化结果。',
      }),
    }));
    expect(tx.diagnosisGenerationJob.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        state: 'FAILED',
        failureCode: 'diagnosis-provider-empty-output',
        retryable: true,
      }),
    }));
  });

  it('keeps non-report Zod errors on the ordinary retry path', async () => {
    const metadataError = z.object({ responseId: z.string().max(3) }).safeParse({ responseId: 'response-id-too-long' });
    expect(metadataError.success).toBe(false);
    if (metadataError.success) return;
    const { db, tx } = workerDbFixture();

    await expect(processDiagnosisGenerationJob(
      db as never,
      'job-1',
      { attemptsMade: 0, opts: { attempts: 3 } } as never,
      async () => { throw metadataError.error; },
    )).rejects.toBe(metadataError.error);

    expect(tx.diagnosisGenerationJob.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { state: 'QUEUED', startedAt: null },
    }));
  });

  it('rejects factual report content from the browser', () => {
    expect(() => diagnosisGenerationRequestSchema.parse({
      idempotencyKey: 'request-123',
      reportBody: { summary: 'browser-authored' },
    })).toThrow();
  });

  it('requires a bounded teacher reason only for explicit force intent', () => {
    expect(() => diagnosisGenerationRequestSchema.parse({
      idempotencyKey: 'request-123',
      force: true,
    })).toThrow();
    expect(() => diagnosisGenerationRequestSchema.parse({
      idempotencyKey: 'request-123',
      forceReason: '不应脱离强制生成意图单独提交',
    })).toThrow();
    expect(diagnosisGenerationRequestSchema.parse({
      idempotencyKey: 'request-123',
      force: true,
      forceReason: '用于本周教学复盘会议留档',
    })).toMatchObject({ force: true, forceReason: '用于本周教学复盘会议留档' });
  });

  it('reuses the same idempotency key', async () => {
    const db = dbFixture();
    db.diagnosisGenerationJob.findUnique.mockResolvedValueOnce(publicJob());

    const result = await startDiagnosisGenerationJob(db as never, {
      teacherId: 'teacher-1',
      classId: 'class-1',
      idempotencyKey: 'request-123',
      now,
    });

    expect(result.id).toBe('job-1');
    expect(db.diagnosisGenerationJob.create).not.toHaveBeenCalled();
  });

  it('reuses an active scope for a different request key', async () => {
    const db = dbFixture();
    db.diagnosisGenerationJob.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(publicJob());

    const result = await startDiagnosisGenerationJob(db as never, {
      teacherId: 'teacher-1',
      classId: 'class-1',
      idempotencyKey: 'request-456',
      now,
    });

    expect(result.id).toBe('job-1');
    expect(db.diagnosisGenerationJob.create).not.toHaveBeenCalled();
  });

  it('creates a new immutable evidence snapshot after terminal jobs', async () => {
    const db = dbFixture();
    db.diagnosisGenerationJob.findUnique.mockResolvedValue(null);
    db.diagnosisGenerationJob.create.mockResolvedValue(publicJob({ id: 'job-2' }));

    const result = await startDiagnosisGenerationJob(db as never, {
      teacherId: 'teacher-1',
      classId: 'class-1',
      targetStudentId: 'student-1',
      idempotencyKey: 'request-789',
      now,
    });

    expect(result.id).toBe('job-2');
    expect(db.diagnosisGenerationJob.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        activeScopeKey: 'teacher-1:class-1:student-1',
        evidenceCutoff: now,
        scopeType: 'student',
        scopeId: 'student-1',
        generationReason: 'first-generation',
        ruleVersion: 'teacher-diagnosis-preflight.v1',
      }),
    }));
    expect(projectDiagnosisGenerationJob(result as never)).toMatchObject({
      id: 'job-2',
      evidenceCutoff: now.toISOString(),
    });
  });

  it('blocks ordinary generation when the governed input and versions are unchanged', async () => {
    const db = dbFixture();
    const baseline = await preflightDiagnosisGeneration(db as never, {
      teacherId: 'teacher-1',
      classId: 'class-1',
      now,
    });
    db.diagnosisReport.findFirst.mockResolvedValue({
      id: 'report-1',
      evidenceCutoff: now,
      generatedAt: now,
      generatorVersion: baseline.generatorVersion,
      ruleVersion: baseline.ruleVersion,
      inputSummary: baseline.inputSummary,
      inputDigest: baseline.inputDigest,
    });

    await expect(startDiagnosisGenerationJob(db as never, {
      teacherId: 'teacher-1',
      classId: 'class-1',
      idempotencyKey: 'request-unchanged',
      now,
    })).rejects.toMatchObject({ code: 'diagnosis-generation-no-effective-change', status: 409 });
    expect(db.diagnosisGenerationJob.create).not.toHaveBeenCalled();
  });

  it('audits a teacher-forced generation without changing governed evidence', async () => {
    const db = dbFixture();
    const baseline = await preflightDiagnosisGeneration(db as never, {
      teacherId: 'teacher-1',
      classId: 'class-1',
      now,
    });
    db.diagnosisReport.findFirst.mockResolvedValue({
      id: 'report-1',
      evidenceCutoff: now,
      generatedAt: now,
      generatorVersion: baseline.generatorVersion,
      ruleVersion: baseline.ruleVersion,
      inputSummary: baseline.inputSummary,
      inputDigest: baseline.inputDigest,
    });
    db.diagnosisGenerationJob.create.mockResolvedValue(publicJob({
      id: 'job-forced',
      generationReason: 'teacher-forced',
      forceReason: '用于本周教学复盘会议留档',
      previousReportId: 'report-1',
    }));

    const result = await startDiagnosisGenerationJob(db as never, {
      teacherId: 'teacher-1',
      classId: 'class-1',
      idempotencyKey: 'request-forced',
      force: true,
      forceReason: '用于本周教学复盘会议留档',
      now,
    });

    expect(result.id).toBe('job-forced');
    expect(db.diagnosisGenerationJob.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'teacher-1',
        generationReason: 'teacher-forced',
        forceReason: '用于本周教学复盘会议留档',
        previousReportId: 'report-1',
        evidenceCutoff: now,
        generatorVersion: baseline.generatorVersion,
        ruleVersion: baseline.ruleVersion,
        inputDigest: baseline.inputDigest,
        ordinaryGenerationIdentity: null,
      }),
    }));
    expect(db.studentRiskFlag.findMany).toHaveBeenCalledTimes(2);
    expect(db.studentRiskFlag).not.toHaveProperty('update');
    expect(db.knowledgeProgress).not.toHaveProperty('update');
  });

  it('rejects a forced job when the latest predecessor changes before the locked insert', async () => {
    const db = dbFixture();
    const baseline = await preflightDiagnosisGeneration(db as never, {
      teacherId: 'teacher-1', classId: 'class-1', now,
    });
    const report = {
      id: 'report-1', evidenceCutoff: now, generatedAt: now,
      generatorVersion: baseline.generatorVersion,
      ruleVersion: baseline.ruleVersion,
      inputSummary: baseline.inputSummary,
      inputDigest: baseline.inputDigest,
    };
    db.diagnosisReport.findFirst.mockReset();
    db.diagnosisReport.findFirst
      .mockResolvedValueOnce(report)
      .mockResolvedValueOnce({ id: 'report-2' });

    await expect(startDiagnosisGenerationJob(db as never, {
      teacherId: 'teacher-1',
      classId: 'class-1',
      idempotencyKey: 'request-stale-forced',
      force: true,
      forceReason: '用于本周教学复盘会议留档',
      now,
    })).rejects.toMatchObject({
      code: 'diagnosis-generation-predecessor-changed',
      status: 409,
    });
    expect(db.$executeRaw).toHaveBeenCalledOnce();
    expect(db.$executeRaw.mock.invocationCallOrder[0])
      .toBeLessThan(db.diagnosisReport.findFirst.mock.invocationCallOrder[1]!);
    expect(db.diagnosisGenerationJob.create).not.toHaveBeenCalled();
  });

  it('returns the ordinary job that wins the deterministic identity race', async () => {
    const db = dbFixture();
    const winner = publicJob({ id: 'job-winner', state: 'RUNNING' });
    db.diagnosisGenerationJob.findUnique.mockResolvedValue(null);
    db.diagnosisGenerationJob.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError(
      'ordinary generation identity already exists',
      { code: 'P2002', clientVersion: 'test' },
    ));
    db.diagnosisGenerationJob.findFirst.mockResolvedValue(winner);

    const result = await startDiagnosisGenerationJob(db as never, {
      teacherId: 'teacher-1',
      classId: 'class-1',
      idempotencyKey: 'request-raced',
      now,
    });

    expect(result.id).toBe('job-winner');
    expect(db.diagnosisGenerationJob.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        OR: expect.arrayContaining([
          expect.objectContaining({ ordinaryGenerationIdentity: expect.any(String) }),
        ]),
      },
    }));
  });

  it('reclaims a stale running job and records the interrupted attempt as timed out', async () => {
    const db = dbFixture();
    const tx = {
      diagnosisGenerationJob: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'job-1' }),
      },
      diagnosisGenerationAttempt: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        count: vi.fn().mockResolvedValue(1),
        create: vi.fn().mockResolvedValue({ id: 'attempt-2', attemptNumber: 2 }),
      },
    };
    db.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));

    const claim = await claimDiagnosisGenerationAttempt(db as never, 'job-1', now);

    expect(claim).toMatchObject({ attempt: { id: 'attempt-2', attemptNumber: 2 } });
    expect(tx.diagnosisGenerationJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          { state: 'QUEUED' },
          { state: 'RUNNING', startedAt: { lt: new Date(now.getTime() - DIAGNOSIS_GENERATION_ATTEMPT_TIMEOUT_MS) } },
        ]),
      }),
    }));
    expect(tx.diagnosisGenerationAttempt.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { jobId: 'job-1', state: 'RUNNING' },
      data: expect.objectContaining({ state: 'TIMED_OUT', completedAt: now }),
    }));
  });

  it('keeps the provider generation window strictly inside the task window', () => {
    expect(DIAGNOSIS_PROVIDER_GENERATION_WINDOW_MS).toBeLessThan(DIAGNOSIS_GENERATION_ATTEMPT_TIMEOUT_MS);
    expect(DIAGNOSIS_GENERATION_LOCK_DURATION_MS).toBeGreaterThanOrEqual(DIAGNOSIS_GENERATION_ATTEMPT_TIMEOUT_MS);
  });

  it('reuses a newer active scope instead of reviving an older failed job into a uniqueness conflict', async () => {
    const db = dbFixture();
    const failed = publicJob({ id: 'job-old', state: 'FAILED', retryable: true });
    const active = publicJob({ id: 'job-new', state: 'RUNNING', retryable: false });
    db.diagnosisGenerationJob.findFirst.mockResolvedValue(failed);
    db.diagnosisGenerationJob.findUnique.mockResolvedValue(active);

    const result = await retryDiagnosisGenerationJob(db as never, {
      teacherId: 'teacher-1',
      jobId: 'job-old',
      idempotencyKey: 'retry-123',
    });

    expect(result.id).toBe('job-new');
    expect(db.diagnosisGenerationJob.updateMany).not.toHaveBeenCalled();
  });

  it('reuses an active scope created between retry lookup and the unique-key write', async () => {
    const db = dbFixture();
    const failed = publicJob({ id: 'job-old', state: 'FAILED', retryable: true });
    const active = publicJob({ id: 'job-new', state: 'QUEUED', retryable: false });
    db.diagnosisGenerationJob.findFirst.mockResolvedValue(failed);
    db.diagnosisGenerationJob.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(active);
    db.diagnosisGenerationJob.updateMany.mockRejectedValue(new Prisma.PrismaClientKnownRequestError(
      'active scope already claimed',
      { code: 'P2002', clientVersion: 'test' },
    ));

    const result = await retryDiagnosisGenerationJob(db as never, {
      teacherId: 'teacher-1',
      jobId: 'job-old',
      idempotencyKey: 'retry-456',
    });

    expect(result.id).toBe('job-new');
    expect(db.diagnosisGenerationJob.findUnique).toHaveBeenCalledTimes(2);
  });
});

describe('diagnosis report language contract', () => {
  it('accepts Chinese-dominant text with inline technical terms and rejects English-dominant fields', () => {
    expect(isSimplifiedChineseNaturalLanguageText('基于受治理工具结果，风险标志（Risk Flags）覆盖完整。')).toBe(true);
    expect(isSimplifiedChineseNaturalLanguageText('班级证据覆盖完整，建议优先处理低分群体。')).toBe(true);
    expect(isSimplifiedChineseNaturalLanguageText('The class shows strong overall progress this week.')).toBe(false);
    expect(isSimplifiedChineseNaturalLanguageText('no-current-governed-risk-flags')).toBe(false);
    expect(isSimplifiedChineseNaturalLanguageText('')).toBe(false);
  });

  it('rejects traditional Chinese and kana instead of treating every CJK char as Simplified Chinese', () => {
    expect(isSimplifiedChineseNaturalLanguageText('課程學習進度良好，學生們表現優異。')).toBe(false);
    expect(isSimplifiedChineseNaturalLanguageText('班级學習狀況良好。')).toBe(false);
    expect(isSimplifiedChineseNaturalLanguageText('学習が順調に進んでいます。')).toBe(false);
    expect(isSimplifiedChineseNaturalLanguageText('学习进度良好，学生表现优异。')).toBe(true);
  });

  it('reports per-field violations for a structured report body', () => {
    const violations = validateDiagnosisReportBodyLanguage({
      summary: '班级整体证据覆盖完整。',
      findings: [
        { title: '需要关注的学习表现', summary: '建议巩固基础知识点。' },
        { title: 'Weak mastery signals detected', summary: '该说明保持中文。' },
        { title: '缺少中文的发现', summary: 'Mixed content with mostly English sentences here.' },
      ],
      limitations: ['no-current-governed-risk-flags'],
    });
    expect(violations).toEqual([
      'findings[1].title',
      'findings[2].summary',
      'limitations[0]',
    ]);
  });

  it('requires Simplified Chinese output in the provider system prompt', async () => {
    providerGenerate.mockResolvedValueOnce({
      output: {
        summary: '作业与测验结果显示班级需要继续巩固。',
        findings: [],
        evidenceRefs: ['knowledge-progress:progress-1'],
        evidenceCutoff: now.toISOString(),
        sourceCoverage: { classMembers: 1 },
        confidence: 'medium',
        limitations: [],
      },
      normalizedResponseId: 'provider-response-language-prompt',
    });

    await generateGovernedDiagnosisReport({} as never, {
      jobId: 'job-1',
      attemptId: 'attempt-language-prompt',
      teacherId: 'teacher-1',
      classId: 'class-1',
      targetStudentId: null,
      evidenceCutoff: now,
      generatorVersion: 'teacher-diagnosis.v1',
      governedInput,
      inputDigest: governedInputDigest,
    });

    const system = providerGenerate.mock.calls.at(-1)?.[0]?.system;
    expect(typeof system).toBe('string');
    expect(system).toContain('简体中文');
  });

  it('rejects English provider output as a language failure instead of returning a report', async () => {
    const providerInput = {
      schemaVersion: 'teacher-diagnosis-governed-input.v1' as const,
      classId: 'class-1',
      studentIds: ['student-actual-1'],
      assignmentSubmissions: [{
        id: 'assignment-submission-1',
        userId: 'student-actual-1',
        assignmentRevisionId: 'assignment-revision-1',
        contentHash: 'assignment-content-sha256',
        score: 82,
        totalPoints: 100,
        reviewedAt: now.toISOString(),
      }],
      assessmentSessions: [],
      riskFlags: [],
      competencySnapshots: [],
      knowledgeProgress: [],
    };
    providerGenerate.mockResolvedValueOnce({
      output: {
        summary: 'The governed evidence shows the class needs continued consolidation.',
        findings: [{
          title: 'Weak mastery signals detected',
          summary: 'Several learners show below-threshold performance.',
          evidenceRefs: ['assignment-submission:assignment-submission-1'],
        }],
        evidenceRefs: ['assignment-submission:assignment-submission-1'],
        evidenceCutoff: now.toISOString(),
        sourceCoverage: { classMembers: 1 },
        confidence: 'medium',
        limitations: ['no-current-governed-risk-flags'],
      },
      normalizedResponseId: 'provider-response-language-en',
    });

    await expect(generateGovernedDiagnosisReport({} as never, {
      jobId: 'job-1',
      attemptId: 'attempt-language-en',
      teacherId: 'teacher-1',
      classId: 'class-1',
      targetStudentId: null,
      evidenceCutoff: now,
      generatorVersion: 'teacher-diagnosis.v1',
      governedInput: providerInput,
      inputDigest: digestDiagnosisGovernedInput(providerInput),
    })).rejects.toMatchObject({
      name: 'DiagnosisGenerationProviderLanguageError',
      violations: ['summary', 'findings[0].title', 'findings[0].summary', 'limitations[0]'],
    });
  });

  it('records language-invalid provider output as retryable instead of non-retryable validation', async () => {
    const languageError = new DiagnosisGenerationProviderLanguageError(['summary']);
    const { db, tx } = workerDbFixture();

    await expect(processDiagnosisGenerationJob(
      db as never,
      'job-1',
      { attemptsMade: 0, opts: { attempts: 3 } } as never,
      async () => { throw languageError; },
    )).rejects.toBe(languageError);

    expect(tx.diagnosisGenerationAttempt.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        state: 'FAILED',
        errorCode: 'diagnosis-provider-language-mismatch',
        errorMessage: '诊断模型返回的报告内容不是简体中文。',
      }),
    }));
    expect(tx.diagnosisGenerationJob.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { state: 'QUEUED', startedAt: null },
    }));
  });

  it('fails the job with an explicit Chinese reason after language retries are exhausted', async () => {
    const languageError = new DiagnosisGenerationProviderLanguageError(['summary']);
    const { db, tx } = workerDbFixture();

    await expect(processDiagnosisGenerationJob(
      db as never,
      'job-1',
      { attemptsMade: 2, opts: { attempts: 3 } } as never,
      async () => { throw languageError; },
    )).rejects.toBe(languageError);

    expect(tx.diagnosisGenerationJob.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        state: 'FAILED',
        failureCode: 'diagnosis-provider-language-mismatch',
        failureMessage: '诊断模型返回的报告内容不是简体中文。',
        retryable: true,
      }),
    }));
  });
});

describe('diagnosis finding knowledge-node attribution contract', () => {
  const attributionInput = {
    schemaVersion: 'teacher-diagnosis-governed-input.v1' as const,
    classId: 'class-1',
    studentIds: ['student-1'],
    riskFlags: [],
    competencySnapshots: [],
    knowledgeProgress: [
      {
        id: 'progress-1',
        userId: 'student-1',
        nodeId: 'node-1',
        status: 'IN_PROGRESS',
        progress: 50,
        timeSpent: 120,
        lastVisited: now.toISOString(),
      },
      {
        id: 'progress-2',
        userId: 'student-1',
        nodeId: 'node-2',
        status: 'IN_PROGRESS',
        progress: 30,
        timeSpent: 80,
        lastVisited: now.toISOString(),
      },
    ],
  };

  const attributionRequest = {
    jobId: 'job-1',
    teacherId: 'teacher-1',
    classId: 'class-1',
    targetStudentId: null,
    evidenceCutoff: now,
    generatorVersion: 'teacher-diagnosis.v1',
    governedInput: attributionInput,
    inputDigest: digestDiagnosisGovernedInput(attributionInput),
  } as const;

  function attributionOutput(findings: unknown[], reportRefs: string[] = ['knowledge-progress:progress-1']) {
    return {
      output: {
        summary: '知识点掌握情况需要巩固。',
        findings,
        evidenceRefs: reportRefs,
        evidenceCutoff: now.toISOString(),
        sourceCoverage: { classMembers: 1 },
        confidence: 'medium',
        limitations: [],
      },
      normalizedResponseId: 'provider-response-attribution',
    };
  }

  it('backfills a knowledge finding whose cited rows resolve to one governed node', async () => {
    providerGenerate.mockResolvedValueOnce(attributionOutput([
      {
        title: '单知识点掌握薄弱',
        evidenceRefs: ['knowledge-progress:progress-1'],
      },
    ]));

    const result = await generateGovernedDiagnosisReport({} as never, {
      ...attributionRequest,
      attemptId: 'attempt-attribution-backfill',
    });

    expect(result.reportBody.findings[0]?.knowledgeNodeId).toBe('node-1');
  });

  it('rejects a knowledge finding that omits a node across ambiguous cited rows', async () => {
    providerGenerate.mockResolvedValueOnce(attributionOutput([
      {
        title: '跨知识点表现波动',
        evidenceRefs: ['knowledge-progress:progress-1', 'knowledge-progress:progress-2'],
      },
    ], ['knowledge-progress:progress-1', 'knowledge-progress:progress-2']));

    await expect(generateGovernedDiagnosisReport({} as never, {
      ...attributionRequest,
      attemptId: 'attempt-attribution-ambiguous',
    })).rejects.toMatchObject({
      name: 'DiagnosisGenerationFindingAttributionError',
      violations: ['findings[0].knowledgeNodeId'],
    });
  });

  it('rejects a knowledge finding that cherry-picks one node while citing rows across multiple nodes', async () => {
    providerGenerate.mockResolvedValueOnce(attributionOutput([
      {
        title: '单知识点掌握薄弱',
        knowledgeNodeId: 'node-1',
        evidenceRefs: ['knowledge-progress:progress-1', 'knowledge-progress:progress-2'],
      },
    ], ['knowledge-progress:progress-1', 'knowledge-progress:progress-2']));

    await expect(generateGovernedDiagnosisReport({} as never, {
      ...attributionRequest,
      attemptId: 'attempt-attribution-mixed-filled',
    })).rejects.toMatchObject({
      name: 'DiagnosisGenerationFindingAttributionError',
      violations: ['findings[0].knowledgeNodeId'],
    });
  });

  it('rejects a knowledge finding whose node is outside the governed universe', async () => {
    providerGenerate.mockResolvedValueOnce(attributionOutput([
      {
        title: '单知识点掌握薄弱',
        knowledgeNodeId: 'node-not-in-input',
        evidenceRefs: ['knowledge-progress:progress-1'],
      },
    ]));

    await expect(generateGovernedDiagnosisReport({} as never, {
      ...attributionRequest,
      attemptId: 'attempt-attribution-unknown',
    })).rejects.toBeInstanceOf(DiagnosisGenerationFindingAttributionError);
  });

  it('rejects a knowledge finding whose node disagrees with its cited rows', async () => {
    providerGenerate.mockResolvedValueOnce(attributionOutput([
      {
        title: '单知识点掌握薄弱',
        knowledgeNodeId: 'node-2',
        evidenceRefs: ['knowledge-progress:progress-1'],
      },
    ]));

    await expect(generateGovernedDiagnosisReport({} as never, {
      ...attributionRequest,
      attemptId: 'attempt-attribution-inconsistent',
    })).rejects.toMatchObject({
      name: 'DiagnosisGenerationFindingAttributionError',
      violations: ['findings[0].knowledgeNodeId'],
    });
  });

  it('keeps non-knowledge findings free of attribution requirements', async () => {
    providerGenerate.mockResolvedValueOnce(attributionOutput([
      {
        title: '整体风险水平提示',
        riskType: 'constraint',
        evidenceRefs: [],
      },
    ]));

    const result = await generateGovernedDiagnosisReport({} as never, {
      ...attributionRequest,
      attemptId: 'attempt-attribution-non-knowledge',
    });

    expect(result.reportBody.findings[0]?.knowledgeNodeId).toBeUndefined();
  });

  it('does not node-check non-knowledge findings even when they carry an id outside the governed universe', async () => {
    providerGenerate.mockResolvedValueOnce(attributionOutput([
      {
        title: '低分段学生比例需关注',
        knowledgeNodeId: 'node-not-in-input',
        evidenceRefs: [],
      },
    ]));

    const result = await generateGovernedDiagnosisReport({} as never, {
      ...attributionRequest,
      attemptId: 'attempt-attribution-non-knowledge-with-node',
    });

    expect(result.reportBody.findings[0]?.knowledgeNodeId).toBe('node-not-in-input');
  });

  it('keeps findings unattributed when cited rows carry no governed node', () => {
    const nodeByEvidenceRef = buildKnowledgeNodeByEvidenceRef([{ id: 'progress-9', nodeId: '' }]);
    const findings = [{ evidenceRefs: ['knowledge-progress:progress-9'] }];

    expect(enforceDiagnosisFindingNodeAttribution(findings, nodeByEvidenceRef)).toEqual([]);
    expect(findings[0]?.knowledgeNodeId).toBeUndefined();
  });

  it('rejects filling a node from other rows when the cited rows have no governed node', () => {
    const nodeByEvidenceRef = buildKnowledgeNodeByEvidenceRef([
      { id: 'progress-9', nodeId: '' },
      { id: 'progress-10', nodeId: 'node-1' },
    ]);
    const findings = [{
      knowledgeNodeId: 'node-1',
      evidenceRefs: ['knowledge-progress:progress-9'],
    }];

    expect(enforceDiagnosisFindingNodeAttribution(findings, nodeByEvidenceRef))
      .toEqual(['findings[0].knowledgeNodeId']);
  });

  it('records attribution-invalid provider output as retryable instead of non-retryable validation', async () => {
    const attributionError = new DiagnosisGenerationFindingAttributionError(['findings[0].knowledgeNodeId']);
    const { db, tx } = workerDbFixture();

    await expect(processDiagnosisGenerationJob(
      db as never,
      'job-1',
      { attemptsMade: 0, opts: { attempts: 3 } } as never,
      async () => { throw attributionError; },
    )).rejects.toBe(attributionError);

    expect(tx.diagnosisGenerationAttempt.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        state: 'FAILED',
        errorCode: 'diagnosis-finding-attribution-invalid',
        errorMessage: '诊断模型返回的知识点发现缺少与受治理证据一致的知识节点归因。',
      }),
    }));
    expect(tx.diagnosisGenerationJob.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { state: 'QUEUED', startedAt: null },
    }));
  });

  it('fails the job after attribution retries are exhausted with an explicit Chinese reason', async () => {
    const attributionError = new DiagnosisGenerationFindingAttributionError(['findings[0].knowledgeNodeId']);
    const { db, tx } = workerDbFixture();

    await expect(processDiagnosisGenerationJob(
      db as never,
      'job-1',
      { attemptsMade: 2, opts: { attempts: 3 } } as never,
      async () => { throw attributionError; },
    )).rejects.toBe(attributionError);

    expect(tx.diagnosisGenerationJob.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        state: 'FAILED',
        failureCode: 'diagnosis-finding-attribution-invalid',
        failureMessage: '诊断模型返回的知识点发现缺少与受治理证据一致的知识节点归因。',
        retryable: true,
      }),
    }));
  });
});
