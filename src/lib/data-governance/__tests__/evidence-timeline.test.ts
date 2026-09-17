import { describe, expect, it, vi } from 'vitest';
import type { LearningFact } from '@prisma/client';

import {
  createEvidenceTimelineCursor,
  inferStudentSafeEvidenceSource,
  listEvidenceTimeline,
  parseEvidenceTimelineFilters,
  projectStudentSafeEvidenceSource,
} from '../evidence-timeline';

function fact(overrides: Partial<LearningFact> = {}): LearningFact {
  return {
    id: overrides.id ?? 'fact-1',
    userId: overrides.userId ?? 'student-1',
    factType: overrides.factType ?? 'question',
    moduleId: overrides.moduleId ?? 'step-09',
    sessionId: overrides.sessionId ?? 'session-1',
    startedAt: overrides.startedAt ?? new Date('2026-05-21T08:00:00.000Z'),
    finishedAt: overrides.finishedAt ?? new Date('2026-05-21T08:05:00.000Z'),
    outcome: overrides.outcome ?? 'success',
    score: overrides.score ?? 80,
    timeSpent: overrides.timeSpent ?? 240,
    competencyContribution: overrides.competencyContribution ?? { engineeringDecision: 0.8 },
    sourceEventId: overrides.sourceEventId ?? 'event-1',
    sourceLogId: overrides.sourceLogId ?? 'log-1',
    courseId: overrides.courseId ?? 'automatic-control',
    lessonId: overrides.lessonId ?? 'unit-5-2-phase-plane-disturbance-boundary',
    contextJson: overrides.contextJson ?? {},
    knowledgeIdentityNamespace: overrides.knowledgeIdentityNamespace ?? null,
    canonicalObjectId: overrides.canonicalObjectId ?? null,
    aggregateReleaseSetId: overrides.aggregateReleaseSetId ?? null,
    aggregateReleaseId: overrides.aggregateReleaseId ?? null,
    knowledgeProjectionId: overrides.knowledgeProjectionId ?? null,
    knowledgeRevisionRef: overrides.knowledgeRevisionRef ?? null,
    createdAt: overrides.createdAt ?? new Date('2026-05-21T08:05:01.000Z'),
  };
}

function response(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id ?? 'response-1',
    userId: overrides.userId ?? 'student-1',
    sessionId: overrides.sessionId ?? 'session-1',
    lessonKey: overrides.lessonKey ?? 'unit-5-2-phase-plane-disturbance-boundary',
    stepId: overrides.stepId ?? 'step-09',
    attemptKey: overrides.attemptKey ?? 'attempt-1',
    sourceLogId: overrides.sourceLogId ?? 'log-1',
    clientEventId: overrides.clientEventId ?? 'client-event-1',
    submittedAt: overrides.submittedAt ?? new Date('2026-05-21T08:05:00.000Z'),
    responseData: overrides.responseData ?? {
      schemaVersion: 'manifest-submission-v2',
      evidenceQuality: 'rich',
      score: 100,
      questionSummaries: [
        {
          questionId: '5-2-q1',
          prompt: '扰动边界如何影响相轨线？',
          studentAnswer: '边界外需要重新判断收敛路径',
          referenceAnswer: '边界外需要重新判断收敛路径',
          isCorrect: true,
        },
      ],
    },
    createdAt: overrides.createdAt ?? new Date('2026-05-21T08:05:01.000Z'),
  };
}

describe('evidence timeline browser', () => {
  it('shares stable student source and navigation projections with recommendation evidence', () => {
    expect(inferStudentSafeEvidenceSource({
      factType: 'assessment',
      moduleId: 'adaptive-assessment',
    })).toEqual({
      sourceScope: 'adaptive-practice-submission',
      summary: '自适应练习记录参与了该项能力判断。',
      nextAction: {
        href: '/assessment/adaptive-practice?intent=practice',
        label: '继续自适应练习',
      },
    });
    expect(projectStudentSafeEvidenceSource({
      sourceScope: 'interactive-lesson-submission',
      lessonId: 'lesson/a',
    }).nextAction.href).toBe('/profile/evidence?lessonId=lesson%2Fa');
  });

  it('prefers feedbackSource over launch source when parsing assignment filters', () => {
    const filters = parseEvidenceTimelineFilters(new URLSearchParams({
      assignment: 'report-1',
      criterion: 'validation',
      source: 'adaptive-path-center',
      feedbackSource: 'document-feedback',
    }));

    expect(filters).toMatchObject({
      assignment: 'report-1',
      criterion: 'validation',
      assignmentSource: 'document-feedback',
    });
  });

  it('returns newest-first timeline items with 5-2 rich submission summaries', async () => {
    const db = {
      learningFact: {
        findMany: vi.fn().mockResolvedValue([
          fact({
            id: 'newer-5-2-lower-score',
            score: 55,
            startedAt: new Date('2026-05-21T08:00:00.000Z'),
            createdAt: new Date('2026-05-21T08:05:01.000Z'),
          }),
          fact({
            id: 'older-4-4-high-score',
            score: 98,
            lessonId: 'unit-4-4-fixed-structure-optimization',
            sourceLogId: 'log-2',
            startedAt: new Date('2026-05-01T08:00:00.000Z'),
            createdAt: new Date('2026-05-01T08:05:01.000Z'),
          }),
          fact({
            id: 'extra-page-item',
            sourceLogId: 'log-3',
            startedAt: new Date('2026-04-30T08:00:00.000Z'),
            createdAt: new Date('2026-04-30T08:05:01.000Z'),
          }),
        ]),
      },
      studentStepResponse: {
        findMany: vi.fn().mockResolvedValue([
          response({ sourceLogId: 'log-1' }),
        ]),
      },
    };

    const page = await listEvidenceTimeline({
      db,
      userId: 'student-1',
      filters: { limit: 2 },
    });

    expect(db.learningFact.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'student-1' },
      orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: 5,
    }));
    expect(page.items.map((item) => item.id)).toEqual([
      'newer-5-2-lower-score',
      'older-4-4-high-score',
    ]);
    expect(page.items[0]).toMatchObject({
      score: 55,
      lessonId: 'unit-5-2-phase-plane-disturbance-boundary',
      quality: 'rich',
      stepId: 'step-09',
      questionSummaries: [
        {
          questionId: '5-2-q1',
          studentAnswer: '边界外需要重新判断收敛路径',
          referenceAnswer: '边界外需要重新判断收敛路径',
          isCorrect: true,
        },
      ],
    });
    expect(page.nextCursor).toBeTruthy();
  });

  it('scopes feedback assignment evidence by assignment, criterion, and source fields', async () => {
    const db = {
      learningFact: {
        findMany: vi.fn().mockResolvedValue([
          fact({
            id: 'feedback-fact',
            contextJson: {
              assignmentId: 'report-control-design',
              criterionId: 'simulation-evidence',
              source: 'batch59',
            },
          }),
        ]),
      },
      studentStepResponse: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const page = await listEvidenceTimeline({
      db,
      userId: 'student-1',
      filters: {
        assignment: 'report-control-design',
        criterion: 'simulation-evidence',
        assignmentSource: 'batch59',
      },
    });

    expect(db.learningFact.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 'student-1',
        AND: expect.arrayContaining([
          { contextJson: { path: ['assignmentId'], equals: 'report-control-design' } },
          { contextJson: { path: ['criterionId'], equals: 'simulation-evidence' } },
          expect.objectContaining({
            OR: expect.arrayContaining([
              { contextJson: { path: ['source'], equals: 'batch59' } },
              { contextJson: { path: ['feedbackSource'], equals: 'batch59' } },
              { contextJson: { path: ['gradingRunId'], equals: 'batch59' } },
            ]),
          }),
        ]),
      }),
    }));
    expect(page.items.map((item) => item.id)).toEqual(['feedback-fact']);
  });

  it('keeps legacy document feedback facts visible when source markers are missing', async () => {
    const db = {
      learningFact: {
        findMany: vi.fn().mockResolvedValue([
          fact({
            id: 'legacy-document-feedback-fact',
            factType: 'document_rubric_grading',
            contextJson: {
              assignmentId: 'report-control-design',
              criterionId: 'simulation-evidence',
              gradingRunId: 'grading-run-1',
            },
          }),
        ]),
      },
      studentStepResponse: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const page = await listEvidenceTimeline({
      db,
      userId: 'student-1',
      filters: {
        assignment: 'report-control-design',
        criterion: 'simulation-evidence',
        assignmentSource: 'document-feedback',
      },
    });

    expect(db.learningFact.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          { contextJson: { path: ['assignmentId'], equals: 'report-control-design' } },
          { contextJson: { path: ['criterionId'], equals: 'simulation-evidence' } },
          expect.objectContaining({
            OR: expect.arrayContaining([
              { factType: 'document_rubric_grading' },
            ]),
          }),
        ]),
      }),
    }));
    expect(page.items.map((item) => item.id)).toEqual(['legacy-document-feedback-fact']);
  });

  it('does not broaden document feedback legacy fallback without assignment and criterion', async () => {
    const db = {
      learningFact: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      studentStepResponse: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    await listEvidenceTimeline({
      db,
      userId: 'student-1',
      filters: {
        assignment: 'report-control-design',
        assignmentSource: 'document-feedback',
      },
    });
    await listEvidenceTimeline({
      db,
      userId: 'student-1',
      filters: {
        assignmentSource: 'document-feedback',
      },
    });

    for (const call of db.learningFact.findMany.mock.calls) {
      const sourceCondition = call[0].where.AND?.find((condition: { OR?: unknown[] }) => condition.OR);
      expect(sourceCondition?.OR).not.toContainEqual({ factType: 'document_rubric_grading' });
    }
  });

  it('redacts raw question answers from teacher evidence timeline summaries', async () => {
    const db = {
      learningFact: {
        findMany: vi.fn().mockResolvedValue([
          fact({ id: 'teacher-visible-question' }),
        ]),
      },
      studentStepResponse: {
        findMany: vi.fn().mockResolvedValue([
          response({ sourceLogId: 'log-1' }),
        ]),
      },
    };

    const page = await listEvidenceTimeline({
      db,
      userId: 'student-1',
      filters: { limit: 10 },
      viewerRole: 'teacher',
    });

    expect(page.items[0].questionSummaries?.[0]).not.toHaveProperty('studentAnswer');
    expect(page.items[0].questionSummaries?.[0]).toMatchObject({
      questionId: '5-2-q1',
      studentAnswerRedacted: true,
      referenceAnswer: '边界外需要重新判断收敛路径',
      isCorrect: true,
    });
  });

  it('surfaces core learning work as learner-record evidence with freshness, confidence, source scope, and next action', async () => {
    const db = {
      learningFact: {
        findMany: vi.fn().mockResolvedValue([
          fact({
            id: 'interactive-submission',
            factType: 'question',
            sourceLogId: 'interactive-log',
            startedAt: new Date('2026-05-21T08:00:00.000Z'),
            createdAt: new Date('2026-05-21T08:05:01.000Z'),
            contextJson: {
              learnerRecord: {
                sourceScope: 'interactive-lesson-submission',
                confidence: 'high',
                freshness: 'fresh',
                missingSourceState: 'complete',
                nextAction: { href: '/profile/evidence?lessonId=unit-5-2-phase-plane-disturbance-boundary', label: '复盘课堂作答' },
              },
            },
          }),
          fact({
            id: 'arena-preview',
            factType: 'arena_preview',
            sourceLogId: 'arena-preview-log',
            startedAt: new Date('2026-05-21T07:00:00.000Z'),
            createdAt: new Date('2026-05-21T07:05:01.000Z'),
            contextJson: {
              learnerRecord: {
                sourceScope: 'arena-preview-result',
                confidence: 'medium',
                freshness: 'recent',
                missingSourceState: 'official-arena-missing',
                nextAction: { href: '/arena', label: '提交官方评测' },
              },
            },
          }),
          fact({
            id: 'workbench-completion',
            factType: 'simulation',
            sourceLogId: 'workbench-log',
            startedAt: new Date('2026-05-21T06:00:00.000Z'),
            createdAt: new Date('2026-05-21T06:05:01.000Z'),
            contextJson: {
              learnerRecord: {
                sourceScope: 'simulation-workbench-completion',
                confidence: 'medium',
                freshness: 'recent',
                missingSourceState: 'partial',
                nextAction: { href: '/interactive-learning/control-workbench', label: '继续工作台验证' },
              },
            },
          }),
          fact({
            id: 'adaptive-practice-submission',
            factType: 'adaptive_practice',
            sourceLogId: 'adaptive-log',
            startedAt: new Date('2026-05-21T05:00:00.000Z'),
            createdAt: new Date('2026-05-21T05:05:01.000Z'),
            contextJson: {
              learnerRecord: {
                sourceScope: 'adaptive-practice-submission',
                confidence: 'low',
                freshness: 'stale',
                missingSourceState: 'low-confidence',
                nextAction: { href: '/assessment/adaptive-practice?intent=practice', label: '继续自适应练习' },
              },
            },
          }),
        ]),
      },
      studentStepResponse: {
        findMany: vi.fn().mockResolvedValue([
          response({ sourceLogId: 'interactive-log' }),
        ]),
      },
    };

    const page = await listEvidenceTimeline({
      db,
      userId: 'student-1',
      filters: { limit: 10 },
    });

    expect(page.items.map((item) => item.learnerRecord?.sourceScope)).toEqual([
      'interactive-lesson-submission',
      'arena-preview-result',
      'simulation-workbench-completion',
      'adaptive-practice-submission',
    ]);
    expect(page.items[0].learnerRecord).toMatchObject({
      freshness: 'fresh',
      confidence: 'high',
      missingSourceState: 'complete',
      nextAction: { href: '/profile/evidence?lessonId=unit-5-2-phase-plane-disturbance-boundary', label: '复盘课堂作答' },
    });
    expect(page.items[1].learnerRecord).toMatchObject({
      confidence: 'medium',
      missingSourceState: 'official-arena-missing',
    });
    expect(page.items[3].learnerRecord).toMatchObject({
      freshness: 'stale',
      confidence: 'low',
      missingSourceState: 'low-confidence',
    });
  });

  it('derives learner-record metadata from existing production learning facts when no explicit learnerRecord is written', async () => {
    const db = {
      learningFact: {
        findMany: vi.fn().mockResolvedValue([
          fact({
            id: 'interactive-submission',
            factType: 'question',
            sourceLogId: 'interactive-log',
            contextJson: {},
          }),
          fact({
            id: 'arena-official',
            factType: 'design',
            moduleId: 'task-second-order-lead-pid',
            sourceEventId: 'arena_evaluation_complete:event-1',
            sourceLogId: 'arena-official-log',
            contextJson: {
              arena: {
                taskId: 'task-second-order-lead-pid',
                score: 91,
                valid: true,
              },
              evidenceGovernance: {
                policyReason: 'arena_client_evaluation_context_only',
              },
            },
          }),
          fact({
            id: 'arena-persisted-writeback',
            factType: 'design',
            moduleId: 'task-second-order-lead-pid',
            sourceEventId: 'arena-official:publication-a:task-second-order-lead-pid:submission-a:student-1:hash-a',
            sourceLogId: 'submission-a',
            contextJson: {
              arena: {
                taskId: 'task-second-order-lead-pid',
                score: 93,
                valid: true,
                evidenceWriteback: {
                  status: 'accepted',
                  sourceRef: { kind: 'ArenaSubmission', id: 'submission-a' },
                  attemptStatus: 'effective',
                  visibilityState: 'materialized',
                  targetLabel: '控制校正 Arena 官方迁移验证',
                  summary: '官方 Arena 结果已写入学生证据时间线，并可作为终端验证证据。',
                  recoveryAction: '无需处理；教师报告可直接引用该官方证据。',
                  limitationCodes: [],
                  overlayCount: 1,
                  terminalValidationAccepted: true,
                },
              },
            },
          }),
          fact({
            id: 'arena-preview',
            factType: 'simulation',
            moduleId: 'task-second-order-lead-pid',
            sourceEventId: 'arena_simulation_run:event-preview',
            sourceLogId: 'arena-preview-log',
            contextJson: {
              arena: {
                taskId: 'task-second-order-lead-pid',
                valid: false,
              },
            },
          }),
          fact({
            id: 'workbench-completion',
            factType: 'simulation',
            moduleId: 'control-workbench',
            sourceLogId: 'workbench-log',
            contextJson: {},
          }),
          fact({
            id: 'adaptive-practice-submission',
            factType: 'adaptive_practice',
            moduleId: 'adaptive-practice',
            sourceLogId: 'adaptive-log',
            contextJson: {},
          }),
        ]),
      },
      studentStepResponse: {
        findMany: vi.fn().mockResolvedValue([
          response({ sourceLogId: 'interactive-log' }),
        ]),
      },
    };

    const page = await listEvidenceTimeline({
      db,
      userId: 'student-1',
      filters: { limit: 10 },
    });

    expect(page.items.map((item) => item.learnerRecord?.sourceScope)).toEqual([
      'interactive-lesson-submission',
      'arena-preview-result',
      'arena-official-result',
      'arena-preview-result',
      'simulation-workbench-completion',
      'adaptive-practice-submission',
    ]);
    expect(page.items[0].learnerRecord).toMatchObject({
      confidence: 'high',
      missingSourceState: 'complete',
      nextAction: { href: '/profile/evidence?lessonId=unit-5-2-phase-plane-disturbance-boundary', label: '复盘课堂作答' },
    });
    expect(page.items[1].learnerRecord).toMatchObject({
      confidence: 'medium',
      missingSourceState: 'official-arena-missing',
      nextAction: { href: '/arena', label: '提交官方评测' },
    });
    expect(page.items[2].learnerRecord).toMatchObject({
      confidence: 'high',
      missingSourceState: 'complete',
      nextAction: { href: '/arena', label: '查看 Arena 结果' },
    });
    expect(page.items[3].learnerRecord).toMatchObject({
      confidence: 'medium',
      missingSourceState: 'official-arena-missing',
      nextAction: { href: '/arena', label: '提交官方评测' },
    });
    expect(page.items[4].learnerRecord).toMatchObject({
      nextAction: { href: '/interactive-learning/control-workbench', label: '继续工作台验证' },
    });
    expect(page.items[5].learnerRecord).toMatchObject({
      nextAction: { href: '/assessment/adaptive-practice?intent=practice', label: '继续自适应练习' },
    });
  });

  it('redacts teacher and governance scoped learner-record metadata from student evidence views', async () => {
    const db = {
      learningFact: {
        findMany: vi.fn().mockResolvedValue([
          fact({
            id: 'restricted-teacher-record',
            factType: 'question',
            contextJson: {
              learnerRecord: {
                sourceScope: 'interactive-lesson-submission',
                confidence: 'medium',
                freshness: 'recent',
                missingSourceState: 'teacher-intervention-required',
                privacyScope: 'teacher-scoped',
                nextAction: { href: '/teacher/classes/class-1/students/student-1', label: '查看教师诊断' },
              },
            },
          }),
          fact({
            id: 'restricted-governance-record',
            factType: 'arena_preview',
            sourceLogId: 'arena-log',
            contextJson: {
              learnerRecord: {
                sourceScope: 'arena-preview-result',
                confidence: 'low',
                freshness: 'stale',
                missingSourceState: 'governance-review-required',
                privacyScope: 'governance-scoped',
                nextAction: { href: '/admin/data-governance', label: '查看治理详情' },
              },
            },
          }),
        ]),
      },
      studentStepResponse: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const page = await listEvidenceTimeline({
      db,
      userId: 'student-1',
      filters: { limit: 10 },
      viewerRole: 'student',
    });

    expect(page.items[0].learnerRecord).toMatchObject({
      sourceScope: 'interactive-lesson-submission',
      confidence: 'medium',
      freshness: 'recent',
      missingSourceState: 'restricted',
      privacyScope: 'restricted',
      nextAction: { href: '/profile/evidence', label: '查看可见证据' },
    });
    expect(JSON.stringify(page.items)).not.toContain('/teacher/classes');
    expect(JSON.stringify(page.items)).not.toContain('/admin/data-governance');
    expect(JSON.stringify(page.items)).not.toContain('教师诊断');
    expect(JSON.stringify(page.items)).not.toContain('治理详情');
    expect(JSON.stringify(page.items)).not.toContain('teacher-scoped');
    expect(JSON.stringify(page.items)).not.toContain('governance-scoped');
  });

  it('preserves teacher-scoped learner-record metadata for teacher evidence review', async () => {
    const db = {
      learningFact: {
        findMany: vi.fn().mockResolvedValue([
          fact({
            id: 'teacher-scoped-record',
            factType: 'question',
            contextJson: {
              learnerRecord: {
                sourceScope: 'interactive-lesson-submission',
                confidence: 'medium',
                freshness: 'recent',
                missingSourceState: 'teacher-intervention-required',
                privacyScope: 'teacher-scoped',
                nextAction: { href: '/teacher/classes/class-1/students/student-1', label: '查看教师诊断' },
              },
            },
          }),
        ]),
      },
      studentStepResponse: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const page = await listEvidenceTimeline({
      db,
      userId: 'student-1',
      filters: { limit: 10 },
      viewerRole: 'teacher',
    });

    expect(page.items[0].learnerRecord).toMatchObject({
      missingSourceState: 'teacher-intervention-required',
      privacyScope: 'teacher-scoped',
      nextAction: { href: '/teacher/classes/class-1/students/student-1', label: '查看教师诊断' },
    });
  });

  it('uses reviewer fallback actions for explicit student-visible learner-record metadata in teacher evidence review', async () => {
    const db = {
      learningFact: {
        findMany: vi.fn().mockResolvedValue([
          fact({
            id: 'student-visible-explicit-record',
            factType: 'adaptive_practice',
            contextJson: {
              learnerRecord: {
                sourceScope: 'adaptive-practice-submission',
                confidence: 'medium',
                freshness: 'fresh',
                missingSourceState: 'complete',
                privacyScope: 'student-visible',
                nextAction: { href: '/assessment/adaptive-practice?intent=practice', label: '继续自适应练习' },
              },
            },
          }),
        ]),
      },
      studentStepResponse: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const page = await listEvidenceTimeline({
      db,
      userId: 'student-1',
      filters: { limit: 10 },
      viewerRole: 'teacher',
      restrictedFallbackAction: {
        href: '/teacher/classes/class-1/students/student-1/evidence',
        label: '留在学生证据审核',
      },
    });

    expect(page.items[0].learnerRecord).toMatchObject({
      missingSourceState: 'complete',
      privacyScope: 'student-visible',
      nextAction: {
        href: '/teacher/classes/class-1/students/student-1/evidence',
        label: '留在学生证据审核',
      },
    });
  });

  it('uses reviewer fallback actions for derived learner-record metadata in teacher evidence review', async () => {
    const db = {
      learningFact: {
        findMany: vi.fn().mockResolvedValue([
          fact({
            id: 'derived-classroom-submission',
            factType: 'question',
            sourceLogId: 'interactive-log',
            contextJson: {},
          }),
          fact({
            id: 'derived-adaptive-practice',
            factType: 'adaptive_practice',
            moduleId: 'adaptive-practice',
            sourceLogId: 'adaptive-log',
            contextJson: {},
          }),
        ]),
      },
      studentStepResponse: {
        findMany: vi.fn().mockResolvedValue([
          response({ sourceLogId: 'interactive-log' }),
        ]),
      },
    };

    const page = await listEvidenceTimeline({
      db,
      userId: 'student-1',
      filters: { limit: 10 },
      viewerRole: 'teacher',
      restrictedFallbackAction: {
        href: '/teacher/classes/class-1/students/student-1/evidence',
        label: '留在学生证据审核',
      },
    });

    expect(page.items.map((item) => item.learnerRecord?.sourceScope)).toEqual([
      'interactive-lesson-submission',
      'adaptive-practice-submission',
    ]);
    expect(page.items.map((item) => item.learnerRecord?.nextAction)).toEqual([
      {
        href: '/teacher/classes/class-1/students/student-1/evidence',
        label: '留在学生证据审核',
      },
      {
        href: '/teacher/classes/class-1/students/student-1/evidence',
        label: '留在学生证据审核',
      },
    ]);
  });

  it('preserves governance-scoped learner-record metadata only for admin evidence review', async () => {
    const db = {
      learningFact: {
        findMany: vi.fn().mockResolvedValue([
          fact({
            id: 'governance-scoped-record',
            factType: 'arena_preview',
            contextJson: {
              learnerRecord: {
                sourceScope: 'arena-preview-result',
                confidence: 'low',
                freshness: 'stale',
                missingSourceState: 'governance-review-required',
                privacyScope: 'governance-scoped',
                nextAction: { href: '/admin/data-governance', label: '查看治理详情' },
              },
            },
          }),
        ]),
      },
      studentStepResponse: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const teacherPage = await listEvidenceTimeline({
      db,
      userId: 'student-1',
      filters: { limit: 10 },
      viewerRole: 'teacher',
      restrictedFallbackAction: {
        href: '/teacher/classes/class-1/students/student-1/evidence',
        label: '留在学生证据审核',
      },
    });
    const adminPage = await listEvidenceTimeline({
      db,
      userId: 'student-1',
      filters: { limit: 10 },
      viewerRole: 'admin',
    });

    expect(teacherPage.items[0].learnerRecord).toMatchObject({
      missingSourceState: 'restricted',
      privacyScope: 'restricted',
      nextAction: {
        href: '/teacher/classes/class-1/students/student-1/evidence',
        label: '留在学生证据审核',
      },
    });
    expect(adminPage.items[0].learnerRecord).toMatchObject({
      missingSourceState: 'governance-review-required',
      privacyScope: 'governance-scoped',
      nextAction: { href: '/admin/data-governance', label: '查看治理详情' },
    });
  });

  it('fails closed for unrecognized learner-record privacy scopes', async () => {
    const db = {
      learningFact: {
        findMany: vi.fn().mockResolvedValue([
          fact({
            id: 'unknown-scope-record',
            factType: 'arena_preview',
            contextJson: {
              learnerRecord: {
                sourceScope: 'arena-preview-result',
                confidence: 'low',
                freshness: 'stale',
                missingSourceState: 'system-internal-review-required',
                privacyScope: 'system-internal',
                nextAction: { href: '/admin/data-governance', label: '内部治理详情' },
              },
            },
          }),
        ]),
      },
      studentStepResponse: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const page = await listEvidenceTimeline({
      db,
      userId: 'student-1',
      filters: { limit: 10 },
      viewerRole: 'student',
    });

    expect(page.items[0].learnerRecord).toMatchObject({
      missingSourceState: 'restricted',
      privacyScope: 'restricted',
      nextAction: { href: '/profile/evidence', label: '查看可见证据' },
    });
    expect(JSON.stringify(page.items)).not.toContain('system-internal');
    expect(JSON.stringify(page.items)).not.toContain('/admin/data-governance');
    expect(JSON.stringify(page.items)).not.toContain('内部治理详情');
  });

  it('applies field filters, dimension filters, and cursor pagination', async () => {
    const cursor = createEvidenceTimelineCursor({
      startedAt: '2026-05-21T08:00:00.000Z',
      createdAt: '2026-05-21T08:05:01.000Z',
      id: 'cursor-fact',
    });
    const db = {
      learningFact: {
        findMany: vi.fn().mockResolvedValue([
          fact({
            id: 'ignored-other-dimension',
            competencyContribution: { controlModeling: 0.7 },
            sourceLogId: 'log-a',
          }),
          fact({
            id: 'matched-5-1-fixture',
            lessonId: 'unit-5-1-controller-parameter-observation',
            sourceLogId: 'log-b',
            competencyContribution: { engineeringDecision: 0.6 },
          }),
          fact({
            id: 'native-v2-contribution',
            competencyContribution: { controllerDesignSynthesis: 0.6 },
          }),
        ]),
      },
      studentStepResponse: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const page = await listEvidenceTimeline({
      db,
      userId: 'student-1',
      filters: {
        limit: 5,
        cursor,
        dimension: 'engineeringDecision',
        lessonId: 'unit-5-1-controller-parameter-observation',
        factType: 'question',
        outcome: 'success',
        sessionId: 'session-1',
      },
    });

    expect(db.learningFact.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 'student-1',
        lessonId: 'unit-5-1-controller-parameter-observation',
        factType: 'question',
        outcome: 'success',
        sessionId: 'session-1',
        AND: expect.any(Array),
      }),
    }));
    expect(page.items.map((item) => item.id)).toEqual(['matched-5-1-fixture']);
    expect(page.appliedFilters).toMatchObject({
      dimension: 'engineeringDecision',
      lessonId: 'unit-5-1-controller-parameter-observation',
    });

    const nativePortraitPage = await listEvidenceTimeline({
      db,
      userId: 'student-1',
      filters: { limit: 5, dimension: 'controllerDesignSynthesis' },
    });

    expect(nativePortraitPage.items.map((item) => item.id)).toEqual(['native-v2-contribution']);
  });

  it('groups repeated low-signal events while keeping high-signal evidence visible', async () => {
    const db = {
      learningFact: {
        findMany: vi.fn().mockResolvedValue([
          fact({
            id: 'empty-question-2',
            score: 0,
            outcome: 'abandoned',
            sourceLogId: 'empty-log-2',
            sourceEventId: 'empty-event-2',
            startedAt: new Date('2026-05-21T08:10:00.000Z'),
            createdAt: new Date('2026-05-21T08:10:01.000Z'),
            contextJson: { stepId: 'step-09', evidenceQuality: 'missing' },
          }),
          fact({
            id: 'empty-question-1',
            score: 0,
            outcome: 'abandoned',
            sourceLogId: 'empty-log-1',
            sourceEventId: 'empty-event-1',
            startedAt: new Date('2026-05-21T08:08:00.000Z'),
            createdAt: new Date('2026-05-21T08:08:01.000Z'),
            contextJson: { stepId: 'step-09', evidenceQuality: 'missing' },
          }),
          fact({
            id: 'simulation-breakthrough',
            factType: 'simulation',
            score: 92,
            outcome: 'success',
            sourceLogId: 'sim-log',
            sourceEventId: 'sim-event',
            startedAt: new Date('2026-05-21T08:06:00.000Z'),
            createdAt: new Date('2026-05-21T08:06:01.000Z'),
            contextJson: { evidenceTitle: '相轨线边界仿真突破', evidenceQuality: 'rich' },
          }),
        ]),
      },
      studentStepResponse: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const page = await listEvidenceTimeline({
      db,
      userId: 'student-1',
      filters: { limit: 10 },
    });

    expect(page.items).toHaveLength(2);
    expect(page.items[0]).toMatchObject({
      id: 'empty-question-2',
      factType: 'question',
      outcome: 'abandoned',
      stepId: 'step-09',
      groupedCount: 2,
      groupedEvidenceIds: ['empty-question-2', 'empty-question-1'],
      displayPriority: 'deemphasized',
      groupLabel: '重复低信号证据 2 条',
    });
    expect(page.items[1]).toMatchObject({
      id: 'simulation-breakthrough',
      factType: 'simulation',
      displayPriority: 'normal',
    });
  });

  it('projects internal fact types and fixture names to Chinese evidence titles', async () => {
    const db = {
      learningFact: {
        findMany: vi.fn().mockResolvedValue([
          fact({
            id: 'path-selection',
            factType: 'control_correction_path.selection_recorded',
            lessonId: null,
            moduleId: null,
            contextJson: {},
          }),
          fact({
            id: 'diagnostic-fixture',
            factType: 'yangfan-diagnostic-fixture',
            lessonId: null,
            moduleId: null,
            contextJson: { evidenceTitle: 'yangfan-diagnostic-fixture' },
            startedAt: new Date('2026-05-21T07:50:00.000Z'),
            createdAt: new Date('2026-05-21T07:50:01.000Z'),
          }),
        ]),
      },
      studentStepResponse: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const page = await listEvidenceTimeline({
      db,
      userId: 'student-1',
      filters: { limit: 10 },
    });

    expect(page.items.map((item) => item.evidenceTitle)).toEqual([
      '路径方案选择记录',
      '诊断练习记录',
    ]);
    expect(JSON.stringify(page.items.map((item) => item.evidenceTitle)))
      .not.toMatch(/fixture|ctc:|selection_recorded|yangfan/u);
  });

  it('keeps legacy high-value simulation events visually identifiable instead of grouping them as low signal', async () => {
    const db = {
      learningFact: {
        findMany: vi.fn().mockResolvedValue([
          fact({
            id: 'legacy-simulation-2',
            factType: 'simulation',
            score: 91,
            outcome: 'success',
            sourceLogId: 'sim-log-2',
            sourceEventId: 'sim-event-2',
            startedAt: new Date('2026-05-21T08:10:00.000Z'),
            createdAt: new Date('2026-05-21T08:10:01.000Z'),
            contextJson: { evidenceTitle: '鲁棒性仿真突破', evidenceQuality: 'legacy-envelope' },
          }),
          fact({
            id: 'legacy-simulation-1',
            factType: 'simulation',
            score: 89,
            outcome: 'success',
            sourceLogId: 'sim-log-1',
            sourceEventId: 'sim-event-1',
            startedAt: new Date('2026-05-21T08:08:00.000Z'),
            createdAt: new Date('2026-05-21T08:08:01.000Z'),
            contextJson: { evidenceTitle: '鲁棒性仿真突破', evidenceQuality: 'legacy-envelope' },
          }),
        ]),
      },
      studentStepResponse: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const page = await listEvidenceTimeline({
      db,
      userId: 'student-1',
      filters: { limit: 10 },
    });

    expect(page.items.map((item) => item.id)).toEqual(['legacy-simulation-2', 'legacy-simulation-1']);
    expect(page.items.every((item) => item.displayPriority === 'normal')).toBe(true);
    expect(page.items.every((item) => item.groupedCount === undefined)).toBe(true);
  });

  it('keeps a next cursor when grouped low-signal events consume the page lookahead window', async () => {
    const rows = [
      fact({
        id: 'empty-question-page-1',
        score: 0,
        outcome: 'abandoned',
        sourceLogId: 'empty-page-log-1',
        sourceEventId: 'empty-page-event-1',
        startedAt: new Date('2026-05-21T08:10:00.000Z'),
        createdAt: new Date('2026-05-21T08:10:01.000Z'),
        contextJson: { stepId: 'step-09', evidenceQuality: 'missing' },
      }),
      fact({
        id: 'empty-question-lookahead',
        score: 0,
        outcome: 'abandoned',
        sourceLogId: 'empty-page-log-2',
        sourceEventId: 'empty-page-event-2',
        startedAt: new Date('2026-05-21T08:08:00.000Z'),
        createdAt: new Date('2026-05-21T08:08:01.000Z'),
        contextJson: { stepId: 'step-09', evidenceQuality: 'missing' },
      }),
      fact({
        id: 'empty-question-lookahead-tail',
        score: 0,
        outcome: 'abandoned',
        sourceLogId: 'empty-page-log-3',
        sourceEventId: 'empty-page-event-3',
        startedAt: new Date('2026-05-21T08:06:00.000Z'),
        createdAt: new Date('2026-05-21T08:06:01.000Z'),
        contextJson: { stepId: 'step-09', evidenceQuality: 'missing' },
      }),
      fact({
        id: 'new-page-item',
        score: 84,
        outcome: 'success',
        sourceLogId: 'new-page-log',
        sourceEventId: 'new-page-event',
        startedAt: new Date('2026-05-21T08:04:00.000Z'),
        createdAt: new Date('2026-05-21T08:04:01.000Z'),
      }),
    ];
    const db = {
      learningFact: {
        findMany: vi.fn(async (args) => {
          const where = JSON.stringify(args.where ?? {});
          const cursorIndex = rows.findIndex((row) => where.includes(`"id":{"lt":"${row.id}"}`));
          const startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
          return rows.slice(startIndex, startIndex + (args.take ?? rows.length));
        }),
      },
      studentStepResponse: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const page = await listEvidenceTimeline({
      db,
      userId: 'student-1',
      filters: { limit: 1 },
    });

    expect(db.learningFact.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 4 }));
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      id: 'empty-question-page-1',
      groupedCount: 3,
      groupedEvidenceIds: ['empty-question-page-1', 'empty-question-lookahead', 'empty-question-lookahead-tail'],
      displayPriority: 'deemphasized',
    });
    expect(page.nextCursor).toBeTruthy();
    expect(JSON.parse(Buffer.from(page.nextCursor ?? '', 'base64').toString('utf8'))).toMatchObject({
      id: 'empty-question-lookahead-tail',
    });

    const secondPage = await listEvidenceTimeline({
      db,
      userId: 'student-1',
      filters: { limit: 1, cursor: page.nextCursor ?? undefined },
    });

    expect(JSON.stringify(db.learningFact.findMany.mock.calls[1][0].where)).toContain('"id":{"lt":"empty-question-lookahead-tail"}');
    expect(secondPage.items.map((item) => item.id)).toEqual(['new-page-item']);
  });

  it('does not group across high-value evidence between matching low-signal events', async () => {
    const rows = [
      fact({
        id: 'empty-question-a',
        score: 0,
        outcome: 'abandoned',
        sourceLogId: 'empty-log-a',
        sourceEventId: 'empty-event-a',
        startedAt: new Date('2026-05-21T08:10:00.000Z'),
        createdAt: new Date('2026-05-21T08:10:01.000Z'),
        contextJson: { stepId: 'step-09', evidenceQuality: 'missing' },
      }),
      fact({
        id: 'simulation-middle',
        factType: 'simulation',
        score: 92,
        outcome: 'success',
        sourceLogId: 'sim-log-middle',
        sourceEventId: 'sim-event-middle',
        startedAt: new Date('2026-05-21T08:08:00.000Z'),
        createdAt: new Date('2026-05-21T08:08:01.000Z'),
        contextJson: { evidenceTitle: '相轨线边界仿真突破', evidenceQuality: 'rich' },
      }),
      fact({
        id: 'empty-question-c',
        score: 0,
        outcome: 'abandoned',
        sourceLogId: 'empty-log-c',
        sourceEventId: 'empty-event-c',
        startedAt: new Date('2026-05-21T08:06:00.000Z'),
        createdAt: new Date('2026-05-21T08:06:01.000Z'),
        contextJson: { stepId: 'step-09', evidenceQuality: 'missing' },
      }),
      fact({
        id: 'older-page-item',
        score: 84,
        outcome: 'success',
        sourceLogId: 'older-page-log',
        sourceEventId: 'older-page-event',
        startedAt: new Date('2026-05-21T08:04:00.000Z'),
        createdAt: new Date('2026-05-21T08:04:01.000Z'),
      }),
    ];
    const db = {
      learningFact: {
        findMany: vi.fn(async (args) => {
          const where = JSON.stringify(args.where ?? {});
          const cursorIndex = rows.findIndex((row) => where.includes(`"id":{"lt":"${row.id}"}`));
          const startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
          return rows.slice(startIndex, startIndex + (args.take ?? rows.length));
        }),
      },
      studentStepResponse: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const page = await listEvidenceTimeline({
      db,
      userId: 'student-1',
      filters: { limit: 1 },
    });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      id: 'empty-question-a',
      displayPriority: 'normal',
    });
    expect(page.items[0].groupedCount).toBeUndefined();
    expect(JSON.parse(Buffer.from(page.nextCursor ?? '', 'base64').toString('utf8'))).toMatchObject({
      id: 'empty-question-a',
    });

    const secondPage = await listEvidenceTimeline({
      db,
      userId: 'student-1',
      filters: { limit: 1, cursor: page.nextCursor ?? undefined },
    });

    expect(JSON.stringify(db.learningFact.findMany.mock.calls[1][0].where)).toContain('"id":{"lt":"empty-question-a"}');
    expect(secondPage.items.map((item) => item.id)).toEqual(['simulation-middle']);
  });
});
