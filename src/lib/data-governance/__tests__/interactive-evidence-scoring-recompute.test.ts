import { describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import type { InteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';

import {
  applyInteractiveEvidenceScoringRecomputePlan,
  buildInteractiveEvidenceScoringRecomputePlan,
  collectInteractiveEvidenceScoringRecomputePlan,
} from '../interactive-evidence-scoring-recompute';
import { parseInteractiveEvidenceScoringRecomputeOptions } from '../../../../scripts/db/recompute-interactive-evidence-scoring-options';

const lesson53Manifest: InteractiveRuntimeManifest = {
  lessonId: '5-3',
  courseTitle: '5-3',
  courseRouteSegment: 'unit-5-3-state-feedback-observer-coordination',
  previewMode: {},
  mediaPolicy: {},
  telemetryStrategy: 'manifest-submission-v2',
  teacherInsightStrategy: 'manifest',
  requiredStepFields: [],
  stepOrder: ['step-08'],
  steps: [
    {
      id: 'step-08',
      title: '角色匹配',
      layout: { template: 'stacked_regions', regions: [] },
      modules: [],
      contentBlocks: {},
      evidenceSequence: [],
      interactionSpec: {
        interactionKind: 'quiz_group',
        activityCards: [
          {
            id: 'role-match',
            title: '角色匹配',
            prompt: '匹配状态反馈与观测器协同设计中的角色。',
            responseKind: 'drag_match',
            submitScope: 'per_card',
            layoutSpan: 'full',
            options: [],
            matchItems: [
              { value: 'target-outline', label: '目标轮廓' },
              { value: 'target-speed', label: '目标速度' },
            ],
            matchOptions: [
              { value: 'planner', label: '规划器' },
              { value: 'controller', label: '控制器' },
            ],
            referenceMatches: [
              { item: 'target-outline', option: 'planner' },
              { item: 'target-speed', option: 'controller' },
            ],
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

const submittedAt = new Date('2026-05-20T02:00:00.000Z');

function staleResponseData() {
  return {
    schemaVersion: 'manifest-submission-v2',
    stepId: 'step-08',
    submittedAt: submittedAt.getTime(),
    evidenceQuality: 'rich',
    responseKind: 'manifest_step_response',
    answers: {
      'role-match': 'target-speed:controller,target-outline:planner',
    },
    answerDigest: {
      'role-match': 'target-speed:controller,target-outline:planner',
    },
    questionSummaries: [
      {
        questionId: 'role-match',
        responseKind: 'drag_match',
        studentAnswer: 'target-speed:controller,target-outline:planner',
        isCorrect: false,
        score: 0,
        scoringVersion: 'legacy-text-match/v0',
      },
    ],
    scoringSupported: true,
    correctCount: 0,
    objectiveTotal: 1,
    score: 0,
  };
}

function buildRows(responseData = staleResponseData()) {
  return {
    studentStepResponses: [
      {
        id: 'response-53',
        userId: 'student-53',
        sessionId: 'session-53',
        lessonKey: 'unit-5-3-state-feedback-observer-coordination-v1',
        stepId: 'step-08',
        attemptKey: 'step-08:attempt-1',
        sourceLogId: 'log-53',
        clientEventId: 'client-53',
        submittedAt,
        responseData,
      },
    ],
    interactionLogs: [
      {
        id: 'log-53',
        userId: 'student-53',
        sessionId: 'session-53',
        lessonKey: 'unit-5-3-state-feedback-observer-coordination-v1',
        stepId: 'step-08',
        attemptKey: 'step-08:attempt-1',
        eventType: 'submit',
        clientEventId: 'client-53',
        eventData: {
          eventType: 'lesson_submit',
          lessonKey: 'unit-5-3-state-feedback-observer-coordination-v1',
          stepId: 'step-08',
        },
        createdAt: submittedAt,
        clientEventAt: submittedAt,
      },
    ],
    learningFacts: [
      {
        id: 'fact-53',
        userId: 'student-53',
        factType: 'question',
        sessionId: 'session-53',
        lessonId: 'unit-5-3-state-feedback-observer-coordination-v1',
        moduleId: 'step-08',
        sourceEventId: 'client-53',
        sourceLogId: null,
        score: 0,
        outcome: 'failure',
        contextJson: {
          interactiveQuiz: {
            scoring: {
              scoringVersion: 'legacy-text-match/v0',
              score: 0,
            },
          },
        },
      },
    ],
  };
}

describe('interactive evidence scoring recompute', () => {
  it('selects dry-run candidates without writing database changes', async () => {
    const rows = buildRows();
    const db = {
      studentStepResponse: {
        findMany: vi.fn().mockResolvedValue(rows.studentStepResponses),
        update: vi.fn(),
      },
      interactionLog: {
        findMany: vi.fn().mockResolvedValue(rows.interactionLogs),
      },
      learningFact: {
        findMany: vi.fn().mockResolvedValue(rows.learningFacts),
        update: vi.fn(),
      },
    };

    const plan = await collectInteractiveEvidenceScoringRecomputePlan(db as never, {
      generatedAt: '2026-05-20T03:00:00.000Z',
      filters: {
        sessionIds: ['session-53'],
        lessonKeys: ['unit-5-3-state-feedback-observer-coordination-v1'],
      },
      manifestsByLessonKey: {
        'unit-5-3-state-feedback-observer-coordination-v1': lesson53Manifest,
      },
    });

    expect(plan.mode).toBe('dry-run');
    expect(plan.totals).toMatchObject({
      candidateRows: 1,
      responseRowsChanged: 1,
      factRowsChanged: 1,
      sourceLogRepairs: 1,
      affectedLessons: 1,
      affectedSessions: 1,
      affectedUsers: 1,
    });
    expect(plan.responseActions[0]).toMatchObject({
      action: 'update-derived-scoring',
      responseId: 'response-53',
      lessonKey: 'unit-5-3-state-feedback-observer-coordination-v1',
      stepId: 'step-08',
      questionKinds: ['drag_match'],
      oldScore: 0,
      newScore: 100,
    });
    expect(db.studentStepResponse.update).not.toHaveBeenCalled();
    expect(db.learningFact.update).not.toHaveBeenCalled();
  });

  it('recomputes 5-3 style matching scores and repairs sourceLogId without overwriting raw answers', async () => {
    const rows = buildRows();
    const plan = buildInteractiveEvidenceScoringRecomputePlan({
      generatedAt: '2026-05-20T03:00:00.000Z',
      manifestsByLessonKey: {
        'unit-5-3-state-feedback-observer-coordination-v1': lesson53Manifest,
      },
      ...rows,
    });

    expect(plan.prerequisiteErrors).toEqual([]);
    expect(plan.responseActions[0].nextResponseData).toMatchObject({
      answers: {
        'role-match': 'target-speed:controller,target-outline:planner',
      },
      score: 100,
      correctCount: 1,
      objectiveTotal: 1,
      questionSummaries: [
        expect.objectContaining({
          questionId: 'role-match',
          responseKind: 'drag_match',
          studentAnswer: 'target-speed:controller,target-outline:planner',
          isCorrect: true,
          score: 1,
          scoringVersion: 'manifest-objective-scoring/v1',
          normalizedSubmitted: {
            'target-outline': 'planner',
            'target-speed': 'controller',
          },
        }),
      ],
    });
    expect(plan.responseActions[0].nextResponseData?.answers).toBe(rows.studentStepResponses[0].responseData.answers);
    expect(plan.factActions[0]).toMatchObject({
      action: 'update-derived-context',
      factId: 'fact-53',
      responseId: 'response-53',
      oldScore: 0,
      newScore: 100,
      oldOutcome: 'failure',
      newOutcome: 'success',
      oldSourceLogId: null,
      nextSourceLogId: 'log-53',
      nextContextJson: {
        interactiveQuiz: {
          scoring: expect.objectContaining({
            supported: true,
            score: 100,
            scoringVersion: 'manifest-objective-scoring/v1',
          }),
        },
      },
    });
  });

  it('does not match learning facts across users or sessions when source ids collide', () => {
    const rows = buildRows();
    const crossUserFact = {
      ...rows.learningFacts[0],
      id: 'fact-other-student',
      userId: 'student-other',
      sessionId: 'session-other',
    };

    const plan = buildInteractiveEvidenceScoringRecomputePlan({
      generatedAt: '2026-05-20T03:00:00.000Z',
      manifestsByLessonKey: {
        'unit-5-3-state-feedback-observer-coordination-v1': lesson53Manifest,
      },
      studentStepResponses: rows.studentStepResponses,
      interactionLogs: rows.interactionLogs,
      learningFacts: [crossUserFact],
    });

    expect(plan.responseActions[0]).toMatchObject({ action: 'update-derived-scoring' });
    expect(plan.factActions).toEqual([]);
  });

  it('does not update non-question facts even when trace ids match', () => {
    const rows = buildRows();
    const plan = buildInteractiveEvidenceScoringRecomputePlan({
      generatedAt: '2026-05-20T03:00:00.000Z',
      manifestsByLessonKey: {
        'unit-5-3-state-feedback-observer-coordination-v1': lesson53Manifest,
      },
      studentStepResponses: rows.studentStepResponses,
      interactionLogs: rows.interactionLogs,
      learningFacts: rows.learningFacts.map((fact) => ({
        ...fact,
        factType: 'simulation',
      })),
    });

    expect(plan.responseActions[0]).toMatchObject({ action: 'update-derived-scoring' });
    expect(plan.factActions).toEqual([]);
  });

  it('matches question facts when lesson ids use canonical aliases', () => {
    const rows = buildRows();
    const lessonKey = 'unit-5-3-mass-coordination-chain-v1';
    rows.studentStepResponses[0] = { ...rows.studentStepResponses[0], lessonKey };
    rows.interactionLogs[0] = { ...rows.interactionLogs[0], lessonKey };
    rows.learningFacts[0] = { ...rows.learningFacts[0], lessonId: '5-3' };

    const plan = buildInteractiveEvidenceScoringRecomputePlan({
      generatedAt: '2026-05-20T03:00:00.000Z',
      manifestsByLessonKey: { [lessonKey]: lesson53Manifest },
      studentStepResponses: rows.studentStepResponses,
      interactionLogs: rows.interactionLogs,
      learningFacts: rows.learningFacts,
    });

    expect(plan.responseActions[0]).toMatchObject({ action: 'update-derived-scoring' });
    expect(plan.factActions).toHaveLength(1);
    expect(plan.factActions[0]).toMatchObject({
      action: 'update-derived-context',
      factId: 'fact-53',
    });
  });

  it('does not match question facts from a different lesson alias even when trace ids match', () => {
    const rows = buildRows();
    const lessonKey = 'unit-5-3-mass-coordination-chain-v1';
    rows.studentStepResponses[0] = { ...rows.studentStepResponses[0], lessonKey };
    rows.interactionLogs[0] = { ...rows.interactionLogs[0], lessonKey };
    rows.learningFacts[0] = { ...rows.learningFacts[0], lessonId: '5-2' };

    const plan = buildInteractiveEvidenceScoringRecomputePlan({
      generatedAt: '2026-05-20T03:00:00.000Z',
      manifestsByLessonKey: { [lessonKey]: lesson53Manifest },
      studentStepResponses: rows.studentStepResponses,
      interactionLogs: rows.interactionLogs,
      learningFacts: rows.learningFacts,
    });

    expect(plan.responseActions[0]).toMatchObject({ action: 'update-derived-scoring' });
    expect(plan.factActions).toEqual([]);
  });

  it('skips fact updates when multiple responses match the same learning fact', () => {
    const rows = buildRows();
    const newerResponse = {
      ...rows.studentStepResponses[0],
      id: 'response-53-newer',
      submittedAt: new Date('2026-05-20T02:05:00.000Z'),
    };

    const plan = buildInteractiveEvidenceScoringRecomputePlan({
      generatedAt: '2026-05-20T03:00:00.000Z',
      manifestsByLessonKey: {
        'unit-5-3-state-feedback-observer-coordination-v1': lesson53Manifest,
      },
      studentStepResponses: [rows.studentStepResponses[0], newerResponse],
      interactionLogs: rows.interactionLogs,
      learningFacts: rows.learningFacts,
    });

    expect(plan.responseActions).toHaveLength(2);
    expect(plan.factActions).toEqual([]);
    expect(plan.sourceLogDiagnostics).toEqual([
      expect.objectContaining({
        factId: 'fact-53',
        responseId: 'response-53',
        reason: 'ambiguous_matching_response',
      }),
    ]);
  });

  it('uses runtime manifest aliases for courses outside the static lesson registry', () => {
    const rows = buildRows();
    const lessonKey = 'unit-6-1-new-course-v1';
    const runtimeManifest = {
      ...lesson53Manifest,
      lessonId: '6-1',
      courseRouteSegment: 'unit-6-1-new-course',
    };
    rows.studentStepResponses[0] = { ...rows.studentStepResponses[0], lessonKey };
    rows.interactionLogs[0] = { ...rows.interactionLogs[0], lessonKey };
    rows.learningFacts[0] = { ...rows.learningFacts[0], lessonId: '6-1' };

    const plan = buildInteractiveEvidenceScoringRecomputePlan({
      generatedAt: '2026-05-20T03:00:00.000Z',
      manifestsByLessonKey: { [lessonKey]: runtimeManifest },
      studentStepResponses: rows.studentStepResponses,
      interactionLogs: rows.interactionLogs,
      learningFacts: rows.learningFacts,
    });

    expect(plan.responseActions[0]).toMatchObject({ action: 'update-derived-scoring' });
    expect(plan.factActions).toHaveLength(1);
    expect(plan.factActions[0]).toMatchObject({
      action: 'update-derived-context',
      factId: 'fact-53',
    });
  });

  it('does not repair sourceLogId from an interaction log that belongs to another user or session', () => {
    const rows = buildRows();
    const sharedEventId = 'shared-client-event';
    const plan = buildInteractiveEvidenceScoringRecomputePlan({
      generatedAt: '2026-05-20T03:00:00.000Z',
      manifestsByLessonKey: {
        'unit-5-3-state-feedback-observer-coordination-v1': lesson53Manifest,
      },
      studentStepResponses: rows.studentStepResponses.map((response) => ({
        ...response,
        sourceLogId: null,
        clientEventId: sharedEventId,
      })),
      interactionLogs: rows.interactionLogs.map((log) => ({
        ...log,
        id: 'other-user-log',
        userId: 'student-other',
        sessionId: 'session-other',
        clientEventId: sharedEventId,
      })),
      learningFacts: rows.learningFacts.map((fact) => ({
        ...fact,
        sourceEventId: sharedEventId,
        sourceLogId: null,
      })),
    });

    expect(plan.factActions[0]?.nextSourceLogId).toBeUndefined();
    expect(plan.sourceLogDiagnostics).toEqual([
      expect.objectContaining({
        factId: 'fact-53',
        responseId: 'response-53',
        sourceEventId: sharedEventId,
        reason: 'missing_matching_interaction_log',
      }),
    ]);
  });

  it('does not repair sourceLogId when sourceEventId matches multiple logs', () => {
    const rows = buildRows();
    const sharedEventId = 'duplicated-client-event';
    const [log] = rows.interactionLogs;
    const plan = buildInteractiveEvidenceScoringRecomputePlan({
      generatedAt: '2026-05-20T03:00:00.000Z',
      manifestsByLessonKey: {
        'unit-5-3-state-feedback-observer-coordination-v1': lesson53Manifest,
      },
      studentStepResponses: rows.studentStepResponses.map((response) => ({
        ...response,
        sourceLogId: null,
        clientEventId: sharedEventId,
      })),
      interactionLogs: [
        {
          ...log,
          id: 'log-duplicate-a',
          clientEventId: sharedEventId,
        },
        {
          ...log,
          id: 'log-duplicate-b',
          clientEventId: sharedEventId,
        },
      ],
      learningFacts: rows.learningFacts.map((fact) => ({
        ...fact,
        sourceEventId: sharedEventId,
        sourceLogId: null,
      })),
    });

    expect(plan.factActions[0]?.nextSourceLogId).toBeUndefined();
    expect(plan.sourceLogDiagnostics).toEqual([
      expect.objectContaining({
        factId: 'fact-53',
        responseId: 'response-53',
        sourceEventId: sharedEventId,
        reason: 'ambiguous_matching_interaction_log',
      }),
    ]);
  });

  it('repairs sourceLogId when duplicated sourceEventId has one matching user-session log', () => {
    const rows = buildRows();
    const sharedEventId = 'duplicated-across-users';
    const [log] = rows.interactionLogs;
    const plan = buildInteractiveEvidenceScoringRecomputePlan({
      generatedAt: '2026-05-20T03:00:00.000Z',
      manifestsByLessonKey: {
        'unit-5-3-state-feedback-observer-coordination-v1': lesson53Manifest,
      },
      studentStepResponses: rows.studentStepResponses.map((response) => ({
        ...response,
        sourceLogId: null,
        clientEventId: sharedEventId,
      })),
      interactionLogs: [
        {
          ...log,
          id: 'owned-log',
          clientEventId: sharedEventId,
        },
        {
          ...log,
          id: 'other-user-log',
          userId: 'student-other',
          sessionId: 'session-other',
          clientEventId: sharedEventId,
        },
      ],
      learningFacts: rows.learningFacts.map((fact) => ({
        ...fact,
        sourceEventId: sharedEventId,
        sourceLogId: null,
      })),
    });

    expect(plan.factActions[0]?.nextSourceLogId).toBe('owned-log');
    expect(plan.sourceLogDiagnostics).toEqual([]);
  });

  it('counts only explicit answered cards when rebuilding interactive quiz context', () => {
    const seedRows = buildRows({
      schemaVersion: 'manifest-submission-v2',
      stepId: 'step-08',
      submittedAt: submittedAt.getTime(),
      evidenceQuality: 'partial',
      responseKind: 'manifest_step_response',
      answers: {
        unrelated: 'value',
      },
      answerDigest: {
        unrelated: 'value',
      },
      questionSummaries: [],
      scoringSupported: true,
      correctCount: 0,
      objectiveTotal: 1,
      score: 0,
    });
    const seedPlan = buildInteractiveEvidenceScoringRecomputePlan({
      generatedAt: '2026-05-20T03:00:00.000Z',
      manifestsByLessonKey: {
        'unit-5-3-state-feedback-observer-coordination-v1': lesson53Manifest,
      },
      ...seedRows,
    });
    const currentResponseData = {
      ...seedPlan.responseActions[0].nextResponseData,
      questionSummaries: [
        {
          ...(seedPlan.responseActions[0].nextResponseData?.questionSummaries as Record<string, unknown>[])[0],
          studentAnswer: undefined,
        },
      ],
    };
    const currentRows = buildRows(currentResponseData);

    const plan = buildInteractiveEvidenceScoringRecomputePlan({
      generatedAt: '2026-05-20T04:00:00.000Z',
      manifestsByLessonKey: {
        'unit-5-3-state-feedback-observer-coordination-v1': lesson53Manifest,
      },
      ...currentRows,
    });

    expect(plan.responseActions[0]).toMatchObject({ action: 'already-current' });
    expect(plan.factActions[0].nextContextJson.interactiveQuiz).toMatchObject({
      scoring: expect.objectContaining({
        answeredCount: 0,
      }),
    });
  });

  it('applies updates idempotently without creating repeated changes', async () => {
    const rows = buildRows();
    const plan = buildInteractiveEvidenceScoringRecomputePlan({
      generatedAt: '2026-05-20T03:00:00.000Z',
      manifestsByLessonKey: {
        'unit-5-3-state-feedback-observer-coordination-v1': lesson53Manifest,
      },
      ...rows,
    });
    const db = {
      studentStepResponse: { update: vi.fn().mockResolvedValue({}) },
      learningFact: { update: vi.fn().mockResolvedValue({}) },
    };

    const applyResult = await applyInteractiveEvidenceScoringRecomputePlan(db as never, plan);

    expect(applyResult).toMatchObject({
      responseRowsUpdated: 1,
      factRowsUpdated: 1,
      sourceLogIdsRepaired: 1,
    });
    expect(db.studentStepResponse.update).toHaveBeenCalledWith({
      where: { id: 'response-53' },
      data: { responseData: plan.responseActions[0].nextResponseData },
    });
    expect(db.learningFact.update).toHaveBeenCalledWith({
      where: { id: 'fact-53' },
      data: expect.objectContaining({
        score: 100,
        outcome: 'success',
        sourceLogId: 'log-53',
      }),
    });

    const secondRows = buildRows(plan.responseActions[0].nextResponseData);
    secondRows.learningFacts[0] = {
      ...secondRows.learningFacts[0],
      score: plan.factActions[0].newScore,
      outcome: plan.factActions[0].newOutcome,
      sourceLogId: plan.factActions[0].nextSourceLogId,
      contextJson: plan.factActions[0].nextContextJson,
    };
    const secondPlan = buildInteractiveEvidenceScoringRecomputePlan({
      generatedAt: '2026-05-20T04:00:00.000Z',
      manifestsByLessonKey: {
        'unit-5-3-state-feedback-observer-coordination-v1': lesson53Manifest,
      },
      ...secondRows,
    });

    expect(secondPlan.totals.responseRowsChanged).toBe(0);
    expect(secondPlan.totals.factRowsChanged).toBe(0);
    expect(secondPlan.responseActions[0]).toMatchObject({ action: 'already-current' });
    expect(secondPlan.factActions).toEqual([]);
  });

  it('clears learning fact score when recomputed response is no longer scoreable', async () => {
    const unsupportedManifest = {
      ...lesson53Manifest,
      steps: [
        {
          ...lesson53Manifest.steps[0],
          interactionSpec: {
            ...lesson53Manifest.steps[0].interactionSpec,
            activityCards: lesson53Manifest.steps[0].interactionSpec.activityCards?.map((card) => ({
              ...card,
              responseKind: 'free_text',
            })),
          },
        },
      ],
    };
    const rows = buildRows();
    rows.learningFacts[0] = {
      ...rows.learningFacts[0],
      score: 80,
      outcome: 'success',
    };
    const plan = buildInteractiveEvidenceScoringRecomputePlan({
      generatedAt: '2026-05-20T03:00:00.000Z',
      manifestsByLessonKey: {
        'unit-5-3-state-feedback-observer-coordination-v1': unsupportedManifest,
      },
      ...rows,
    });
    const db = {
      studentStepResponse: { update: vi.fn().mockResolvedValue({}) },
      learningFact: { update: vi.fn().mockResolvedValue({}) },
    };

    expect(plan.responseActions[0]).toMatchObject({
      action: 'update-derived-scoring',
      oldScore: 0,
      newScore: null,
    });
    expect(plan.factActions[0]).toMatchObject({
      oldScore: 80,
      newScore: null,
      oldOutcome: 'success',
      newOutcome: 'unknown',
    });

    await applyInteractiveEvidenceScoringRecomputePlan(db as never, plan);

    expect(db.learningFact.update).toHaveBeenCalledWith({
      where: { id: 'fact-53' },
      data: expect.objectContaining({
        score: null,
        outcome: 'unknown',
      }),
    });
  });

  it('blocks apply when lesson identity cannot resolve to a manifest', async () => {
    const rows = buildRows();
    const plan = buildInteractiveEvidenceScoringRecomputePlan({
      generatedAt: '2026-05-20T03:00:00.000Z',
      manifestsByLessonKey: {},
      ...rows,
    });

    expect(plan.prerequisiteErrors).toEqual([
      expect.objectContaining({
        reason: 'missing_manifest',
        lessonKey: 'unit-5-3-state-feedback-observer-coordination-v1',
      }),
    ]);
    expect(plan.totals.scoreChanges).toBe(0);
    await expect(applyInteractiveEvidenceScoringRecomputePlan({
      studentStepResponse: { update: vi.fn() },
      learningFact: { update: vi.fn() },
    } as never, plan)).rejects.toThrow(/missing_manifest/);
  });

  it('reports missing sourceLogId repairs that cannot find a matching interaction log', () => {
    const rows = buildRows();
    const plan = buildInteractiveEvidenceScoringRecomputePlan({
      generatedAt: '2026-05-20T03:00:00.000Z',
      manifestsByLessonKey: {
        'unit-5-3-state-feedback-observer-coordination-v1': lesson53Manifest,
      },
      ...rows,
      interactionLogs: [],
    });

    expect(plan.totals.sourceLogRepairs).toBe(0);
    expect(plan.sourceLogDiagnostics).toEqual([
      expect.objectContaining({
        factId: 'fact-53',
        responseId: 'response-53',
        sourceEventId: 'client-53',
        reason: 'missing_matching_interaction_log',
      }),
    ]);
  });

  it('rejects calendar-invalid recompute date filters', () => {
    expect(() => parseInteractiveEvidenceScoringRecomputeOptions([
      'node',
      'recompute-interactive-evidence-scoring-history.ts',
      '--from',
      '2026-02-31',
    ])).toThrow('Invalid date: 2026-02-31');

    expect(() => parseInteractiveEvidenceScoringRecomputeOptions([
      'node',
      'recompute-interactive-evidence-scoring-history.ts',
      '--to',
      '2026-04-31T00:00:00.000Z',
    ])).toThrow('Invalid date: 2026-04-31T00:00:00.000Z');
  });

  it('expands date-only recompute filters to UTC day boundaries', () => {
    const options = parseInteractiveEvidenceScoringRecomputeOptions([
      'node',
      'recompute-interactive-evidence-scoring-history.ts',
      '--from',
      '2026-05-20',
      '--to',
      '2026-05-20',
    ]);

    expect(options.filters.from?.toISOString()).toBe('2026-05-20T00:00:00.000Z');
    expect(options.filters.to?.toISOString()).toBe('2026-05-20T23:59:59.999Z');
  });

  it('rejects filter flags without values before a recompute can fall back to all rows', () => {
    const result = spawnSync('npx', [
      'tsx',
      './scripts/db/recompute-interactive-evidence-scoring-history.ts',
      '--apply',
      '--session-id',
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Missing value for --session-id');
  });

  it('rejects blank filter lists before apply can fall back to all rows', () => {
    const result = spawnSync('npx', [
      'tsx',
      './scripts/db/recompute-interactive-evidence-scoring-history.ts',
      '--apply',
      '--lesson-key',
      ',',
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('No values provided for --lesson-key');
  });
});
