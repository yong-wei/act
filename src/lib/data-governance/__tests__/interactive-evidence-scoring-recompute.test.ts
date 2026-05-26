import { describe, expect, it, vi } from 'vitest';
import type { InteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';

import {
  applyInteractiveEvidenceScoringRecomputePlan,
  buildInteractiveEvidenceScoringRecomputePlan,
  collectInteractiveEvidenceScoringRecomputePlan,
} from '../interactive-evidence-scoring-recompute';

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
});
