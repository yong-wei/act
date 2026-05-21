import { describe, expect, it } from 'vitest';
import type { LearningEvent } from '../event-protocol';
import { eventToLearningFactInput } from '../learning-fact-materialization';

function createEvent(overrides: Partial<LearningEvent> = {}): LearningEvent {
  return {
    eventId: 'event-001',
    occurredAt: '2026-04-16T02:41:03.547Z',
    userId: 'user-001',
    role: 'student',
    pagePath: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/session-001',
    pageType: 'classroom',
    actionType: 'submit',
    sessionId: 'session-001',
    payload: {
      eventType: 'lesson_submit',
      stepId: 'step-04',
      lessonKey: 'unit-3-6-zero-design-workshop-v1',
      score: 67,
      answerKeys: { q1: 'root-region', q2: 'root-locus', q3: 'review-goal' },
    },
    source: 'web',
    priority: 'secondary',
    ...overrides,
  };
}

describe('eventToLearningFactInput', () => {
  it('materializes legacy submit events as lesson_submit facts when payload carries the canonical event type', () => {
    const fact = eventToLearningFactInput(createEvent());

    expect(fact).toMatchObject({
      userId: 'user-001',
      factType: 'question',
      sessionId: 'session-001',
      lessonId: 'unit-3-6-zero-design-workshop-v1',
      outcome: 'partial',
      score: 67,
      sourceEventId: 'event-001',
    });
    expect(fact?.competencyContribution).toMatchObject({
      controlModeling: 0.5,
      selfDirectedLearning: 0.3,
    });
    expect(fact?.contextJson).toMatchObject({
      evidenceGovernance: {
        evidenceQuality: 'legacy',
        profileWeight: 0,
        skipProfileContribution: true,
        policyReason: 'legacy_evidence_context_only',
      },
    });
  });

  it('ignores low-value secondary events that should not update student competency facts', () => {
    const fact = eventToLearningFactInput(createEvent({
      actionType: 'view',
      payload: { eventType: 'lesson_step_view', stepId: 'step-01' },
    }));

    expect(fact).toBeNull();
  });

  it('materializes sampled parameter exploration as a low-weight simulation fact', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'workspace-param-sampled-001',
      actionType: 'param_change',
      payload: {
        eventType: 'workspace_param_change',
        stepId: 'step-04',
        lessonKey: 'unit-4-1-design-task-expression-v1',
        sampled: true,
        changeCount: 8,
        flushReason: 'step_leave',
      },
    }));

    expect(fact).toMatchObject({
      sourceEventId: 'workspace-param-sampled-001',
      factType: 'simulation',
      lessonId: 'unit-4-1-design-task-expression-v1',
      outcome: 'success',
    });
    expect(fact?.competencyContribution).toMatchObject({
      controlModeling: 0.1,
      selfDirectedLearning: 0.1,
    });
  });

  it('keeps second-based duration payloads as seconds in canonical facts', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'simulation-duration-seconds-001',
      actionType: 'simulation_finish',
      payload: {
        eventType: 'simulation_finish',
        moduleId: 'module-3',
        durationSeconds: 140,
      },
    }));

    expect(fact).toMatchObject({
      sourceEventId: 'simulation-duration-seconds-001',
      factType: 'simulation',
      timeSpent: 140,
    });
  });

  it('does not materialize raw parameter ticks or sync errors', () => {
    const rawTick = eventToLearningFactInput(createEvent({
      actionType: 'param_change',
      payload: {
        eventType: 'workspace_param_change',
        stepId: 'step-04',
        sampled: false,
      },
    }));
    const syncError = eventToLearningFactInput(createEvent({
      actionType: 'error',
      payload: {
        eventType: 'sync_error',
        stepId: 'step-04',
      },
    }));

    expect(rawTick).toBeNull();
    expect(syncError).toBeNull();
  });

  it('marks unfinished session finalization as partial instead of success', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'client-event-finalize-001',
      actionType: 'complete',
      payload: {
        eventType: 'session_finalize',
        lessonKey: 'unit-3-7-steady-error-low-frequency-compensation-v1',
        currentStepId: 'step-12',
        finalStepId: 'step-12',
        finalStepIndex: 11,
        totalSteps: 17,
        completionRatio: 0.7059,
        endedBeforeAssessment: true,
        endedBeforeSummary: true,
      },
    }));

    expect(fact).toMatchObject({
      sourceEventId: 'client-event-finalize-001',
      factType: 'question',
      lessonId: 'unit-3-7-steady-error-low-frequency-compensation-v1',
      outcome: 'partial',
    });
  });

  it('preserves sourceLogId when materializing a fact from a persisted interaction log', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'interaction-log:log-001',
      payload: {
        eventType: 'lesson_submit',
        lessonKey: 'unit-3-6-zero-design-workshop-v1',
        sourceLogId: 'log-001',
      },
    }));

    expect(fact).toMatchObject({
      sourceEventId: 'interaction-log:log-001',
      sourceLogId: 'log-001',
    });
  });

  it('uses scored 4-4 submission telemetry as the learning fact evidence basis', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'unit-4-4-submit-001',
      actionType: 'submit',
      sessionId: 'session-4-4',
      payload: {
        eventType: 'lesson_submit',
        lessonKey: 'unit-4-4-fixed-structure-optimization-modeling-v1',
        stepId: 'step-08',
        moduleId: 'step-08',
        score: 100,
        outcome: 'success',
        competencyContribution: {
          parameterDesign: 0.7,
          controlModeling: 0.4,
        },
        evidenceTitle: '4-4 step-08：目标函数与权重表达',
        questionSummaries: [
          {
            questionId: 'weight-preference',
            prompt: '若更担心动作代价继续抬高，更应优先保留哪一组偏好？',
            studentAnswer: 'C',
            referenceAnswer: 'C',
            isCorrect: true,
          },
        ],
      },
    }));

    expect(fact).toMatchObject({
      sourceEventId: 'unit-4-4-submit-001',
      factType: 'question',
      sessionId: 'session-4-4',
      moduleId: 'step-08',
      lessonId: 'unit-4-4-fixed-structure-optimization-modeling-v1',
      outcome: 'success',
      score: 100,
    });
    expect(fact?.competencyContribution).toMatchObject({
      parameterDesign: 0.7,
      controlModeling: 0.4,
    });
  });

  it('scores objective lesson submissions from per-card question summaries', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'unit-4-7-step-02-submit-001',
      actionType: 'submit',
      sessionId: 'session-4-7',
      payload: {
        eventType: 'lesson_submit',
        schemaVersion: 'manifest-submission-v2',
        evidenceQuality: 'rich',
        lessonKey: 'unit-4-7-destroyer-hifi-design-closure-v1',
        stepId: 'step-02',
        attemptKey: 'step-02:response:1778550642900',
        clientEventId: 'client-step-02-submit',
        sourceLogId: 'log-step-02-submit',
        questionSummaries: [
          {
            questionId: 'model-order',
            studentAnswer: 'A',
            referenceAnswer: 'A',
          },
          {
            questionId: 'disturbance-boundary',
            studentAnswer: 'B',
            referenceAnswer: 'A',
          },
        ],
      },
    }));

    expect(fact).toMatchObject({
      score: 50,
      outcome: 'partial',
      contextJson: {
        evidenceGovernance: {
          evidenceQuality: 'rich',
          profileWeight: 1,
          skipProfileContribution: false,
          policyReason: 'rich_objective_evidence',
        },
        interactiveQuiz: {
          lessonKey: 'unit-4-7-destroyer-hifi-design-closure-v1',
          stepId: 'step-02',
          attemptKey: 'step-02:response:1778550642900',
          clientEventId: 'client-step-02-submit',
          sourceLogId: 'log-step-02-submit',
          scoring: {
            supported: true,
            evidenceQuality: 'rich',
            answeredCount: 2,
            correctCount: 1,
            totalCount: 2,
            score: 50,
            basis: 'questionSummaries',
          },
          cards: [
            {
              cardId: 'model-order',
              selectedValue: 'A',
              referenceAnswer: 'A',
              isCorrect: true,
            },
            {
              cardId: 'disturbance-boundary',
              selectedValue: 'B',
              referenceAnswer: 'A',
              isCorrect: false,
            },
          ],
        },
      },
    });
  });

  it('keeps unanswered objective cards in the scoring denominator', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'unit-4-7-step-02-submit-partial',
      actionType: 'submit',
      sessionId: 'session-4-7',
      payload: {
        eventType: 'lesson_submit',
        lessonKey: 'unit-4-7-destroyer-hifi-design-closure-v1',
        stepId: 'step-02',
        questionSummaries: [
          {
            questionId: 'model-order',
            studentAnswer: 'a',
            referenceAnswer: '选 A。名义模型阶次应保留为二阶。',
            referenceValue: 'a',
            answered: true,
            isCorrect: true,
          },
          {
            questionId: 'disturbance-boundary',
            studentAnswer: null,
            referenceAnswer: '选 A。扰动边界不能忽略。',
            referenceValue: 'a',
            answered: false,
            isCorrect: false,
          },
        ],
      },
    }));

    expect(fact).toMatchObject({
      score: 50,
      outcome: 'partial',
      contextJson: {
        interactiveQuiz: {
          scoring: {
            supported: true,
            answeredCount: 1,
            correctCount: 1,
            totalCount: 2,
            score: 50,
          },
          cards: [
            {
              cardId: 'model-order',
              selectedValue: 'a',
              answered: true,
              isCorrect: true,
            },
            {
              cardId: 'disturbance-boundary',
              selectedValue: null,
              answered: false,
              isCorrect: false,
            },
          ],
        },
      },
    });
  });

  it('marks unsupported objective scoring explicitly instead of writing a zero score', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'unit-4-7-step-02-submit-unsupported',
      actionType: 'submit',
      sessionId: 'session-4-7',
      payload: {
        eventType: 'lesson_submit',
        schemaVersion: 'manifest-submission-v2',
        evidenceQuality: 'partial',
        lessonKey: 'unit-4-7-destroyer-hifi-design-closure-v1',
        stepId: 'step-02',
        attemptKey: 'step-02:response:1778550642999',
        answers: {
          'model-order': 'A',
        },
      },
    }));

    expect(fact?.score).toBeUndefined();
    expect(fact?.contextJson).toMatchObject({
      interactiveQuiz: {
        lessonKey: 'unit-4-7-destroyer-hifi-design-closure-v1',
        stepId: 'step-02',
        scoring: {
          supported: false,
          evidenceQuality: 'partial',
          reason: 'missing_objective_answer_keys',
          answeredCount: 1,
        },
      },
    });
  });

  it('downgrades partial manifest submissions while keeping fact traceability', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'unit-4-7-step-02-submit-answer-only',
      actionType: 'submit',
      sessionId: 'session-4-7',
      payload: {
        eventType: 'lesson_submit',
        schemaVersion: 'manifest-submission-v2',
        lessonKey: 'unit-4-7-destroyer-hifi-design-closure-v1',
        stepId: 'step-02',
        answers: {
          'model-order': 'A',
        },
      },
    }));

    expect(fact).toMatchObject({
      sourceEventId: 'unit-4-7-step-02-submit-answer-only',
      factType: 'question',
      lessonId: 'unit-4-7-destroyer-hifi-design-closure-v1',
    });
    expect(fact?.contextJson).toMatchObject({
      evidenceGovernance: {
        evidenceQuality: 'partial',
        profileWeight: 0.25,
        skipProfileContribution: false,
        policyReason: 'partial_evidence_low_weight',
      },
    });
  });

  it('keeps missing manifest submissions traceable without profile contribution', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'unit-5-1-missing-submit-001',
      actionType: 'submit',
      payload: {
        eventType: 'lesson_submit',
        schemaVersion: 'manifest-submission-v2',
        lessonKey: 'unit-5-1-linear-backbone-boundaries-v1',
        stepId: 'step-05',
      },
    }));

    expect(fact).toMatchObject({
      sourceEventId: 'unit-5-1-missing-submit-001',
      lessonId: 'unit-5-1-linear-backbone-boundaries-v1',
    });
    expect(fact?.contextJson).toMatchObject({
      evidenceGovernance: {
        evidenceQuality: 'missing',
        profileWeight: 0,
        skipProfileContribution: true,
        policyReason: 'missing_evidence_context_only',
      },
    });
  });

  it('does not materialize classroom completion facts from after-session events by default', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'late-submit-001',
      actionType: 'submit',
      payload: {
        eventType: 'lesson_submit',
        lessonKey: 'unit-3-7-steady-error-low-frequency-compensation-v1',
        afterSessionEnd: true,
      },
    }));

    expect(fact).toBeNull();
  });

  it('does not materialize lesson submits explicitly marked as non-governance evidence', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'unit-4-4-unsupported-submit-001',
      actionType: 'submit',
      payload: {
        eventType: 'lesson_submit',
        lessonKey: 'unit-4-4-fixed-structure-optimization-modeling-v1',
        stepId: 'step-12',
        skipLearningFact: true,
      },
    }));

    expect(fact).toBeNull();
  });

  it('materializes Arena official evaluation completion as a design fact', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'arena-evaluation-001',
      actionType: 'arena_evaluation_complete',
      pagePath: '/arena/task-second-order-lead-pid',
      pageType: 'workspace',
      payload: {
        eventType: 'arena_evaluation_complete',
        taskId: 'task-second-order-lead-pid',
        score: 91,
        valid: true,
        method: 'pid',
      },
    }));

    expect(fact).toMatchObject({
      sourceEventId: 'arena-evaluation-001',
      factType: 'design',
      outcome: 'success',
      score: 91,
    });
    expect(fact?.competencyContribution).toMatchObject({
      parameterDesign: 0.9,
      engineeringDecision: 0.6,
      selfDirectedLearning: 0.3,
    });
    expect(fact?.contextJson).toMatchObject({
      evidenceGovernance: {
        evidenceQuality: 'rich',
        profileWeight: 1,
        skipProfileContribution: false,
        policyReason: 'official_arena_evaluation',
      },
    });
  });

  it('does not materialize Arena open and view events as competency facts', () => {
    for (const eventType of [
      'arena_challenge_open',
      'arena_workspace_start',
      'arena_result_view',
      'arena_leaderboard_view',
      'arena_feedback_view',
    ]) {
      expect(eventToLearningFactInput(createEvent({
        eventId: `${eventType}-001`,
        actionType: eventType,
        pagePath: '/arena/task-second-order-lead-pid',
        pageType: 'workspace',
        payload: {
          eventType,
          taskId: 'task-second-order-lead-pid',
        },
      }))).toBeNull();
    }
  });
});
