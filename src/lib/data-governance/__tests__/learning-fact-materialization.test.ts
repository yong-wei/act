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
});
