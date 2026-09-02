import { describe, expect, it, vi } from 'vitest';
import type { InteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';

import {
  applyCourseEvidenceBackfillPlan,
  buildCourseEvidenceBackfillPlan,
  collectCourseEvidenceBackfillPlan,
  refreshCourseEvidenceAffectedStudentCaches,
  regenerateCourseEvidenceReports,
} from '../course-evidence-backfill';

const lessonManifest: InteractiveRuntimeManifest = {
  lessonId: '5-1',
  courseTitle: '5-1',
  courseRouteSegment: 'unit-5-1-linear-backbone-boundaries',
  previewMode: {},
  mediaPolicy: {},
  telemetryStrategy: 'manifest-submission-v2',
  teacherInsightStrategy: 'manifest',
  requiredStepFields: [],
  stepOrder: ['step-03'],
  steps: [
    {
      id: 'step-03',
      title: '前测',
      layout: { template: 'stacked_regions', regions: [] },
      modules: [],
      contentBlocks: {},
      evidenceSequence: [],
      interactionSpec: {
        interactionKind: 'quiz_group',
        activityCards: [
          {
            id: 'linear-boundary',
            title: '线性边界',
            prompt: '线性模型是否可无限外推？',
            responseKind: 'single_choice',
            submitScope: 'per_card',
            layoutSpan: 'half',
            options: [
              { value: 'a', label: '可以无限外推' },
              { value: 'b', label: '只能在工作范围内使用' },
            ],
            referenceAnswer: '选 B。线性模型只能在工作范围内使用。',
          },
        ],
      },
      teacherControls: {
        releaseActivity: 'teacher_toggle',
        openBrowse: 'page_load_open',
        teacherStepReveal: 'not_applicable',
        revealReferenceAnswer: 'teacher_toggle',
      },
      studentAccess: {},
      teacherInsightSpec: { widgets: [] },
      telemetrySpec: { summaryFields: [], misconceptionTags: [] },
      aiContextSpec: { pageGoal: '', deliveryMode: '' },
      interactiveFigureSpec: {},
      previewContract: { demoPath: '' },
      acceptanceChecks: [],
    },
  ],
};

describe('course evidence backfill', () => {
  it('selects dry-run candidates by session, lesson, and date without writing', async () => {
    const db = {
      studentStepResponse: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'response-1',
            userId: 'student-1',
            sessionId: 'session-5-1',
            lessonKey: 'unit-5-1-linear-backbone-boundaries-v1',
            stepId: 'step-03',
            attemptKey: 'step-03:attempt-1',
            sourceLogId: 'log-1',
            clientEventId: 'client-1',
            submittedAt: new Date('2026-05-20T02:00:00.000Z'),
            responseData: { eventType: 'lesson_submit', evidenceQuality: 'legacy-envelope' },
          },
        ]),
        update: vi.fn(),
      },
      studentState: {
        findMany: vi.fn().mockResolvedValue([
          {
            sessionId: 'session-5-1',
            userId: 'student-1',
            stateKey: 'course',
            lessonKey: 'unit-5-1-linear-backbone-boundaries-v1',
            itemId: 'student:unit51:state',
            data: {
              kind: 'unit51_student_state',
              responses: {
                'step-03': {
                  stepId: 'step-03',
                  submittedAt: 1779242400000,
                  answers: { 'linear-boundary': 'b' },
                },
              },
            },
            submittedAt: new Date('2026-05-20T02:01:00.000Z'),
            lastClientEventAt: new Date('2026-05-20T02:01:00.000Z'),
          },
        ]),
      },
      learningFact: {
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
      },
    };

    const plan = await collectCourseEvidenceBackfillPlan(db as never, {
      filters: {
        sessionIds: ['session-5-1'],
        lessonKeys: ['unit-5-1-linear-backbone-boundaries-v1'],
        from: new Date('2026-05-20T00:00:00.000Z'),
        to: new Date('2026-05-21T00:00:00.000Z'),
      },
      manifestsByLessonKey: {
        'unit-5-1-linear-backbone-boundaries-v1': lessonManifest,
      },
      generatedAt: '2026-05-20T03:00:00.000Z',
    });

    expect(db.studentStepResponse.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        sessionId: { in: ['session-5-1'] },
        lessonKey: { in: ['unit-5-1-linear-backbone-boundaries-v1'] },
        submittedAt: {
          gte: new Date('2026-05-20T00:00:00.000Z'),
          lte: new Date('2026-05-21T00:00:00.000Z'),
        },
      },
    }));
    expect(db.studentStepResponse.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: {
        sessionId: { in: ['session-5-1'] },
        userId: { in: ['student-1'] },
        lessonKey: { in: ['unit-5-1-linear-backbone-boundaries-v1'] },
      },
    }));
    expect(plan.mode).toBe('dry-run');
    expect(plan.totals).toMatchObject({
      candidateRows: 1,
      recoverableRows: 1,
      newlyEnrichableRows: 1,
      alreadyEnrichedRows: 0,
      unrecoverableRows: 0,
      affectedSessions: 1,
      affectedUsers: 1,
    });
    expect(plan.responseActions[0]).toMatchObject({
      action: 'enrich',
      responseId: 'response-1',
      source: 'final-state-enriched',
    });
    expect(db.studentStepResponse.update).not.toHaveBeenCalled();
    expect(db.learningFact.update).not.toHaveBeenCalled();
  });

  it('enriches final-state answers with manifest scoring metadata and matching fact context', async () => {
    const plan = buildCourseEvidenceBackfillPlan({
      generatedAt: '2026-05-20T03:00:00.000Z',
      manifestsByLessonKey: {
        'unit-5-1-linear-backbone-boundaries-v1': lessonManifest,
      },
      studentStepResponses: [
        {
          id: 'response-1',
          userId: 'student-1',
          sessionId: 'session-5-1',
          lessonKey: 'unit-5-1-linear-backbone-boundaries-v1',
          stepId: 'step-03',
          attemptKey: 'step-03:attempt-1',
          sourceLogId: 'log-1',
          clientEventId: 'client-1',
          submittedAt: new Date('2026-05-20T02:00:00.000Z'),
          responseData: { eventType: 'lesson_submit', evidenceQuality: 'legacy-envelope' },
        },
      ],
      studentStates: [
        {
          sessionId: 'session-5-1',
          userId: 'student-1',
          stateKey: 'course',
          lessonKey: 'unit-5-1-linear-backbone-boundaries-v1',
          itemId: 'student:unit51:state',
          data: {
            responses: {
              'step-03': {
                stepId: 'step-03',
                submittedAt: 1779242400000,
                answers: { 'linear-boundary': 'b' },
              },
            },
          },
          submittedAt: new Date('2026-05-20T02:01:00.000Z'),
          lastClientEventAt: new Date('2026-05-20T02:01:00.000Z'),
        },
      ],
      learningFacts: [
        {
          id: 'fact-1',
          userId: 'student-1',
          sessionId: 'session-5-1',
          lessonId: 'unit-5-1-linear-backbone-boundaries-v1',
          moduleId: 'step-03',
          sourceEventId: 'historical:InteractionLog:log-1:lesson_submit',
          sourceLogId: 'log-1',
          score: null,
          outcome: 'partial',
          contextJson: { historicalMaterialization: { sourceId: 'StudentStepResponse' } },
        },
      ],
    });

    expect(plan.responseActions[0].nextResponseData).toMatchObject({
      schemaVersion: 'manifest-submission-v2',
      evidenceQuality: 'rich',
      evidenceQualityReason: 'scoreable_objective_evidence',
      evidenceSourceState: 'final-state-enriched',
      responseKind: 'manifest_step_response',
      answers: { 'linear-boundary': 'b' },
      questionSummaries: [
        expect.objectContaining({
          questionId: 'linear-boundary',
          studentAnswer: 'b',
          referenceValue: 'b',
          isCorrect: true,
        }),
      ],
      score: 100,
      backfill: {
        version: 'course-evidence-backfill-v1',
        status: 'final-state-enriched',
        source: 'final-state',
        responseId: 'response-1',
        studentStateKey: 'course',
      },
    });
    expect(plan.factActions[0]).toMatchObject({
      action: 'enrich-context',
      factId: 'fact-1',
      nextScore: 100,
      nextContextJson: {
        interactiveQuiz: expect.objectContaining({
          schemaVersion: 'manifest-submission-v2',
          evidenceQuality: 'rich',
          score: 100,
        }),
        courseEvidenceBackfill: expect.objectContaining({
          status: 'final-state-enriched',
          responseId: 'response-1',
        }),
      },
    });
    expect(plan.coverage.before.answerAvailableRows).toBe(0);
    expect(plan.coverage.after.answerAvailableRows).toBe(1);
    expect(plan.coverage.after.scoreAvailableRows).toBe(1);
    expect(plan.coverage.after.questionSummaryAvailableRows).toBe(1);
  });

  it('marks missing durable answers as legacy without fabricating scores', () => {
    const plan = buildCourseEvidenceBackfillPlan({
      manifestsByLessonKey: {
        'unit-5-1-linear-backbone-boundaries-v1': lessonManifest,
      },
      studentStepResponses: [
        {
          id: 'response-2',
          userId: 'student-2',
          sessionId: 'session-5-1',
          lessonKey: 'unit-5-1-linear-backbone-boundaries-v1',
          stepId: 'step-03',
          attemptKey: null,
          sourceLogId: 'log-2',
          clientEventId: 'client-2',
          submittedAt: new Date('2026-05-20T02:02:00.000Z'),
          responseData: {
            schemaVersion: 'manifest-submission-v2',
            eventType: 'lesson_submit',
            evidenceQuality: 'partial',
          },
        },
      ],
      studentStates: [
        {
          sessionId: 'session-5-1',
          userId: 'student-2',
          stateKey: 'course',
          lessonKey: 'unit-5-1-linear-backbone-boundaries-v1',
          itemId: 'student:unit51:state',
          data: { responses: {} },
          submittedAt: new Date('2026-05-20T02:03:00.000Z'),
          lastClientEventAt: null,
        },
      ],
      learningFacts: [
        {
          id: 'fact-2',
          userId: 'student-2',
          sessionId: 'session-5-1',
          lessonId: 'unit-5-1-linear-backbone-boundaries-v1',
          moduleId: 'step-03',
          sourceEventId: 'historical:InteractionLog:log-2:lesson_submit',
          sourceLogId: 'log-2',
          score: null,
          outcome: 'partial',
          contextJson: {},
        },
      ],
    });

    expect(plan.totals).toMatchObject({
      recoverableRows: 0,
      newlyEnrichableRows: 0,
      unrecoverableRows: 1,
    });
    expect(plan.responseActions[0]).toMatchObject({
      action: 'mark-unrecoverable',
      nextResponseData: {
        eventType: 'lesson_submit',
        evidenceQuality: 'legacy-envelope',
        evidenceQualityReason: 'legacy_unrecoverable',
        evidenceSourceState: 'legacy-unrecoverable',
        backfill: expect.objectContaining({
          status: 'legacy-unrecoverable',
          reason: 'missing_durable_answers',
        }),
      },
    });
    expect(plan.responseActions[0].nextResponseData).not.toHaveProperty('score');
    expect(plan.factActions[0]).toMatchObject({
      action: 'mark-legacy-context',
      nextContextJson: {
        courseEvidenceBackfill: expect.objectContaining({
          status: 'legacy-unrecoverable',
          reason: 'missing_durable_answers',
        }),
      },
    });
  });

  it('keeps score-only manifest submissions usable during backfill', () => {
    const plan = buildCourseEvidenceBackfillPlan({
      manifestsByLessonKey: {
        'unit-5-1-linear-backbone-boundaries-v1': lessonManifest,
      },
      studentStepResponses: [
        {
          id: 'response-score-only',
          userId: 'student-score-only',
          sessionId: 'session-5-1',
          lessonKey: 'unit-5-1-linear-backbone-boundaries-v1',
          stepId: 'step-03',
          attemptKey: null,
          sourceLogId: 'log-score-only',
          clientEventId: 'client-score-only',
          submittedAt: new Date('2026-05-20T02:04:00.000Z'),
          responseData: {
            schemaVersion: 'manifest-submission-v2',
            eventType: 'lesson_submit',
            score: 72.5,
          },
        },
      ],
      studentStates: [],
      learningFacts: [],
    });

    expect(plan.totals).toMatchObject({
      candidateRows: 1,
      recoverableRows: 0,
      newlyEnrichableRows: 0,
      alreadyEnrichedRows: 1,
      unrecoverableRows: 0,
    });
    expect(plan.responseActions[0]).toMatchObject({
      action: 'already-enriched',
      nextResponseData: {
        schemaVersion: 'manifest-submission-v2',
        score: 72.5,
      },
    });
    expect(plan.coverage.before.scoreAvailableRows).toBe(1);
    expect(plan.coverage.before.partialRows).toBe(1);
    expect(plan.coverage.before.missingRows).toBe(0);
  });

  it('keeps repeated apply runs idempotent and reports already enriched rows separately', async () => {
    const enrichedResponseData = {
      schemaVersion: 'manifest-submission-v2',
      evidenceQuality: 'rich',
      answers: { 'linear-boundary': 'b' },
      backfill: {
        version: 'course-evidence-backfill-v1',
        status: 'final-state-enriched',
        responseId: 'response-1',
      },
    };
    const plan = buildCourseEvidenceBackfillPlan({
      studentStepResponses: [
        {
          id: 'response-1',
          userId: 'student-1',
          sessionId: 'session-5-1',
          lessonKey: 'unit-5-1-linear-backbone-boundaries-v1',
          stepId: 'step-03',
          attemptKey: null,
          sourceLogId: 'log-1',
          clientEventId: null,
          submittedAt: new Date('2026-05-20T02:00:00.000Z'),
          responseData: enrichedResponseData,
        },
      ],
      studentStates: [],
      learningFacts: [
        {
          id: 'fact-1',
          userId: 'student-1',
          sessionId: 'session-5-1',
          lessonId: 'unit-5-1-linear-backbone-boundaries-v1',
          moduleId: 'step-03',
          sourceEventId: 'historical:InteractionLog:log-1:lesson_submit',
          sourceLogId: 'log-1',
          score: 100,
          outcome: 'success',
          contextJson: {
            courseEvidenceBackfill: {
              version: 'course-evidence-backfill-v1',
              status: 'final-state-enriched',
              responseId: 'response-1',
            },
          },
        },
      ],
      manifestsByLessonKey: {
        'unit-5-1-linear-backbone-boundaries-v1': lessonManifest,
      },
    });
    const db = {
      studentStepResponse: { update: vi.fn() },
      learningFact: { update: vi.fn() },
    };

    const result = await applyCourseEvidenceBackfillPlan(db as never, plan, {
      operationId: 'op-test',
      authorizedBy: 'operator',
      frozenCutoff: '2026-05-21T00:00:00.000Z',
    });

    expect(plan.totals).toMatchObject({
      candidateRows: 1,
      alreadyEnrichedRows: 1,
      newlyEnrichableRows: 0,
      unrecoverableRows: 0,
    });
    expect(result).toMatchObject({
      responseRowsUpdated: 0,
      factRowsUpdated: 0,
      alreadyEnrichedRows: 1,
    });
    expect(db.studentStepResponse.update).not.toHaveBeenCalled();
    expect(db.learningFact.update).not.toHaveBeenCalled();
    expect(result.receipt.status).toBe('applied');
    expect(result.receipt.currentPointerMoved).toBe(false);
  });

  it('requires an operation identity and resumes the same frozen input', async () => {
    const plan = buildCourseEvidenceBackfillPlan({
      studentStepResponses: [],
      studentStates: [],
      learningFacts: [],
    });
    const db = {
      studentStepResponse: { update: vi.fn() },
      learningFact: { update: vi.fn() },
    };
    await expect(applyCourseEvidenceBackfillPlan(db as never, plan, {
      operationId: '',
      authorizedBy: '',
      frozenCutoff: '',
    })).rejects.toThrow();
    const receipts = new Map();
    const store = {
      get: (operationId: string) => receipts.get(operationId),
      put: (receipt: { operationId: string }) => {
        receipts.set(receipt.operationId, receipt);
      },
    };
    const auth = {
      operationId: 'op-replay',
      authorizedBy: 'operator',
      frozenCutoff: '2026-05-21T00:00:00.000Z',
    };
    const first = await applyCourseEvidenceBackfillPlan(db as never, plan, auth, store);
    const second = await applyCourseEvidenceBackfillPlan(db as never, plan, auth, store);
    expect(first.receipt.status).toBe('applied');
    expect(second.receipt.status).toBe('resumed');
    expect(db.studentStepResponse.update).not.toHaveBeenCalled();
  });

  it('supplements matching facts when response evidence is already manifest-enriched', () => {
    const plan = buildCourseEvidenceBackfillPlan({
      studentStepResponses: [
        {
          id: 'response-3',
          userId: 'student-3',
          sessionId: 'session-5-1',
          lessonKey: 'unit-5-1-linear-backbone-boundaries-v1',
          stepId: 'step-03',
          attemptKey: null,
          sourceLogId: 'log-3',
          clientEventId: null,
          submittedAt: new Date('2026-05-20T02:05:00.000Z'),
          responseData: {
            schemaVersion: 'manifest-submission-v2',
            evidenceQuality: 'rich',
            answers: { 'linear-boundary': 'b' },
            questionSummaries: [
              { questionId: 'linear-boundary', studentAnswer: 'b', referenceValue: 'b', isCorrect: true },
            ],
            score: 100,
          },
        },
      ],
      studentStates: [],
      learningFacts: [
        {
          id: 'fact-3',
          userId: 'student-3',
          sessionId: 'session-5-1',
          lessonId: 'unit-5-1-linear-backbone-boundaries-v1',
          moduleId: 'step-03',
          sourceEventId: 'historical:InteractionLog:log-3:lesson_submit',
          sourceLogId: 'log-3',
          score: null,
          outcome: 'partial',
          contextJson: {},
        },
      ],
      manifestsByLessonKey: {
        'unit-5-1-linear-backbone-boundaries-v1': lessonManifest,
      },
    });

    expect(plan.totals.alreadyEnrichedRows).toBe(1);
    expect(plan.responseActions[0].action).toBe('already-enriched');
    expect(plan.factActions[0]).toMatchObject({
      action: 'enrich-context',
      factId: 'fact-3',
      responseId: 'response-3',
      nextScore: 100,
      nextContextJson: {
        interactiveQuiz: expect.objectContaining({
          schemaVersion: 'manifest-submission-v2',
          score: 100,
        }),
        courseEvidenceBackfill: expect.objectContaining({
          version: 'course-evidence-backfill-v1',
          status: 'already-manifest-enriched',
          responseId: 'response-3',
        }),
      },
    });
  });

  it('matches source-log-missing facts by stable response sourceEventId before broad step fallback', () => {
    const plan = buildCourseEvidenceBackfillPlan({
      manifestsByLessonKey: {
        'unit-5-1-linear-backbone-boundaries-v1': lessonManifest,
      },
      studentStepResponses: [
        {
          id: 'response-1',
          userId: 'student-1',
          sessionId: 'session-5-1',
          lessonKey: 'unit-5-1-linear-backbone-boundaries-v1',
          stepId: 'step-03',
          attemptKey: 'attempt-1',
          sourceLogId: null,
          clientEventId: 'client-1',
          submittedAt: new Date('2026-05-20T02:00:00.000Z'),
          responseData: { eventType: 'lesson_submit', evidenceQuality: 'legacy-envelope' },
        },
        {
          id: 'response-2',
          userId: 'student-1',
          sessionId: 'session-5-1',
          lessonKey: 'unit-5-1-linear-backbone-boundaries-v1',
          stepId: 'step-03',
          attemptKey: 'attempt-2',
          sourceLogId: null,
          clientEventId: 'client-2',
          submittedAt: new Date('2026-05-20T02:05:00.000Z'),
          responseData: { eventType: 'lesson_submit', evidenceQuality: 'legacy-envelope' },
        },
      ],
      studentStates: [
        {
          sessionId: 'session-5-1',
          userId: 'student-1',
          stateKey: 'course',
          lessonKey: 'unit-5-1-linear-backbone-boundaries-v1',
          itemId: 'student:unit51:state',
          data: {
            responses: {
              'step-03': {
                stepId: 'step-03',
                submittedAt: 1779242700000,
                answers: { 'linear-boundary': 'b' },
              },
            },
          },
          submittedAt: new Date('2026-05-20T02:06:00.000Z'),
          lastClientEventAt: new Date('2026-05-20T02:06:00.000Z'),
        },
      ],
      learningFacts: [
        {
          id: 'fact-1',
          userId: 'student-1',
          sessionId: 'session-5-1',
          lessonId: 'unit-5-1-linear-backbone-boundaries-v1',
          moduleId: 'step-03',
          sourceEventId: 'historical:StudentStepResponse:response-1:lesson_submit',
          sourceLogId: null,
          score: null,
          outcome: 'partial',
          contextJson: {},
        },
        {
          id: 'fact-2',
          userId: 'student-1',
          sessionId: 'session-5-1',
          lessonId: 'unit-5-1-linear-backbone-boundaries-v1',
          moduleId: 'step-03',
          sourceEventId: 'historical:StudentStepResponse:response-2:lesson_submit',
          sourceLogId: null,
          score: null,
          outcome: 'partial',
          contextJson: {},
        },
      ],
    });

    expect(plan.factActions).toHaveLength(2);
    expect(plan.factActions.map((action) => [action.factId, action.responseId])).toEqual([
      ['fact-1', 'response-1'],
      ['fact-2', 'response-2'],
    ]);
  });

  it('uses final-state answers only for the terminal attempt in a repeated step', () => {
    const plan = buildCourseEvidenceBackfillPlan({
      manifestsByLessonKey: {
        'unit-5-1-linear-backbone-boundaries-v1': lessonManifest,
      },
      generatedAt: '2026-05-20T03:00:00.000Z',
      studentStepResponses: [
        {
          id: 'response-early',
          userId: 'student-1',
          sessionId: 'session-5-1',
          lessonKey: 'unit-5-1-linear-backbone-boundaries-v1',
          stepId: 'step-03',
          attemptKey: 'attempt-1',
          sourceLogId: null,
          clientEventId: null,
          submittedAt: new Date('2026-05-20T02:00:00.000Z'),
          responseData: { eventType: 'lesson_submit', evidenceQuality: 'legacy-envelope' },
        },
        {
          id: 'response-final',
          userId: 'student-1',
          sessionId: 'session-5-1',
          lessonKey: 'unit-5-1-linear-backbone-boundaries-v1',
          stepId: 'step-03',
          attemptKey: 'attempt-2',
          sourceLogId: null,
          clientEventId: null,
          submittedAt: new Date('2026-05-20T02:05:00.000Z'),
          responseData: { eventType: 'lesson_resubmit', evidenceQuality: 'legacy-envelope' },
        },
      ],
      studentStates: [
        {
          sessionId: 'session-5-1',
          userId: 'student-1',
          stateKey: 'course',
          lessonKey: 'unit-5-1-linear-backbone-boundaries-v1',
          itemId: 'student:unit51:state',
          data: {
            responses: {
              'step-03': {
                stepId: 'step-03',
                submittedAt: new Date('2026-05-20T02:05:00.000Z').getTime(),
                answers: { 'linear-boundary': 'b' },
              },
            },
          },
          submittedAt: new Date('2026-05-20T02:06:00.000Z'),
          lastClientEventAt: new Date('2026-05-20T02:06:00.000Z'),
        },
      ],
      learningFacts: [
        {
          id: 'fact-early',
          userId: 'student-1',
          sessionId: 'session-5-1',
          lessonId: 'unit-5-1-linear-backbone-boundaries-v1',
          moduleId: 'step-03',
          sourceEventId: 'historical:StudentStepResponse:response-early:lesson_submit',
          sourceLogId: null,
          score: null,
          outcome: 'partial',
          contextJson: {},
        },
        {
          id: 'fact-final',
          userId: 'student-1',
          sessionId: 'session-5-1',
          lessonId: 'unit-5-1-linear-backbone-boundaries-v1',
          moduleId: 'step-03',
          sourceEventId: 'historical:StudentStepResponse:response-final:lesson_resubmit',
          sourceLogId: null,
          score: null,
          outcome: 'partial',
          contextJson: {},
        },
      ],
    });

    expect(plan.responseActions.map((action) => ({
      responseId: action.responseId,
      action: action.action,
      reason: action.reason,
      score: action.nextResponseData?.score,
    }))).toEqual([
      {
        responseId: 'response-early',
        action: 'mark-unrecoverable',
        reason: 'final_state_not_attempt_safe',
        score: undefined,
      },
      {
        responseId: 'response-final',
        action: 'enrich',
        reason: undefined,
        score: 100,
      },
    ]);
    expect(plan.factActions.map((action) => ({
      factId: action.factId,
      responseId: action.responseId,
      action: action.action,
      nextScore: action.nextScore,
    }))).toEqual([
      {
        factId: 'fact-early',
        responseId: 'response-early',
        action: 'mark-legacy-context',
        nextScore: undefined,
      },
      {
        factId: 'fact-final',
        responseId: 'response-final',
        action: 'enrich-context',
        nextScore: 100,
      },
    ]);
  });

  it('does not enrich a filtered historical slice with a later final state', () => {
    const earlyResponse = {
      id: 'response-early',
      userId: 'student-1',
      sessionId: 'session-5-1',
      lessonKey: 'unit-5-1-linear-backbone-boundaries-v1',
      stepId: 'step-03',
      attemptKey: 'attempt-1',
      sourceLogId: null,
      clientEventId: null,
      submittedAt: new Date('2026-05-20T02:00:00.000Z'),
      responseData: { eventType: 'lesson_submit', evidenceQuality: 'legacy-envelope' },
    };
    const finalResponse = {
      id: 'response-final',
      userId: 'student-1',
      sessionId: 'session-5-1',
      lessonKey: 'unit-5-1-linear-backbone-boundaries-v1',
      stepId: 'step-03',
      attemptKey: 'attempt-2',
      sourceLogId: null,
      clientEventId: null,
      submittedAt: new Date('2026-05-20T02:05:00.000Z'),
      responseData: { eventType: 'lesson_resubmit', evidenceQuality: 'legacy-envelope' },
    };

    const plan = buildCourseEvidenceBackfillPlan({
      generatedAt: '2026-05-20T03:00:00.000Z',
      manifestsByLessonKey: {
        'unit-5-1-linear-backbone-boundaries-v1': lessonManifest,
      },
      studentStepResponses: [earlyResponse],
      studentStepResponseHistory: [earlyResponse, finalResponse],
      studentStates: [
        {
          sessionId: 'session-5-1',
          userId: 'student-1',
          stateKey: 'course',
          lessonKey: 'unit-5-1-linear-backbone-boundaries-v1',
          itemId: 'student:unit51:state',
          data: {
            responses: {
              'step-03': {
                stepId: 'step-03',
                submittedAt: new Date('2026-05-20T02:05:00.000Z').getTime(),
                answers: { 'linear-boundary': 'b' },
              },
            },
          },
          submittedAt: new Date('2026-05-20T02:06:00.000Z'),
          lastClientEventAt: new Date('2026-05-20T02:06:00.000Z'),
        },
      ],
      learningFacts: [],
    });

    expect(plan.responseActions[0]).toMatchObject({
      action: 'mark-unrecoverable',
      responseId: 'response-early',
      reason: 'final_state_not_attempt_safe',
      nextResponseData: {
        evidenceQuality: 'legacy-envelope',
        backfill: expect.objectContaining({
          status: 'legacy-unrecoverable',
          reason: 'final_state_not_attempt_safe',
        }),
      },
    });
    expect(plan.responseActions[0].nextResponseData).not.toHaveProperty('score');
  });

  it('uses full response history to disable broad fact fallback for partial slices', () => {
    const selectedResponse = {
      id: 'response-early',
      userId: 'student-1',
      sessionId: 'session-5-1',
      lessonKey: 'unit-5-1-linear-backbone-boundaries-v1',
      stepId: 'step-03',
      attemptKey: 'attempt-1',
      sourceLogId: null,
      clientEventId: null,
      submittedAt: new Date('2026-05-20T02:00:00.000Z'),
      responseData: { eventType: 'lesson_submit', evidenceQuality: 'legacy-envelope' },
    };

    const plan = buildCourseEvidenceBackfillPlan({
      generatedAt: '2026-05-20T03:00:00.000Z',
      manifestsByLessonKey: {
        'unit-5-1-linear-backbone-boundaries-v1': lessonManifest,
      },
      studentStepResponses: [selectedResponse],
      studentStepResponseHistory: [
        selectedResponse,
        {
          ...selectedResponse,
          id: 'response-final',
          attemptKey: 'attempt-2',
          submittedAt: new Date('2026-05-20T02:05:00.000Z'),
        },
      ],
      studentStates: [],
      learningFacts: [
        {
          id: 'fact-without-source-id',
          userId: 'student-1',
          sessionId: 'session-5-1',
          lessonId: 'unit-5-1-linear-backbone-boundaries-v1',
          moduleId: 'step-03',
          sourceEventId: null,
          sourceLogId: null,
          score: null,
          outcome: 'partial',
          contextJson: {},
        },
      ],
    });

    expect(plan.responseActions[0]).toMatchObject({
      action: 'mark-unrecoverable',
      responseId: 'response-early',
    });
    expect(plan.factActions).toEqual([]);
  });

  it('regenerates class and student reports for selected sessions', async () => {
    const generateReports = vi.fn()
      .mockResolvedValueOnce({ classReports: 1, studentReports: 2, skipped: false })
      .mockResolvedValueOnce({ classReports: 0, studentReports: 0, skipped: true });

    const result = await regenerateCourseEvidenceReports({} as never, ['session-a', 'session-b'], {
      generateReports,
    });

    expect(generateReports).toHaveBeenCalledTimes(2);
    expect(generateReports).toHaveBeenNthCalledWith(1, {}, 'session-a');
    expect(generateReports).toHaveBeenNthCalledWith(2, {}, 'session-b');
    expect(result).toEqual({
      sessionsRequested: 2,
      sessionsRegenerated: 1,
      sessionsSkipped: 1,
      classReports: 1,
      studentReports: 2,
    });
  });

  it('refreshes feature caches only for affected students after apply', async () => {
    const refreshStudentCache = vi.fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    const result = await refreshCourseEvidenceAffectedStudentCaches(
      {} as never,
      {
        affectedUserIds: ['student-b', 'student-a', 'student-b'],
      },
      { refreshStudentCache },
    );

    expect(refreshStudentCache).toHaveBeenCalledTimes(2);
    expect(refreshStudentCache).toHaveBeenNthCalledWith(1, {}, 'student-a');
    expect(refreshStudentCache).toHaveBeenNthCalledWith(2, {}, 'student-b');
    expect(result).toEqual({
      usersRequested: 2,
      usersRefreshed: 2,
    });
  });
});
