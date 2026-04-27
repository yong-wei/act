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
});
