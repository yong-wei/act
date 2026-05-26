import { describe, expect, it, vi } from 'vitest';

import { PRESET_QUESTIONS } from '../adaptive-question-bank';
import {
  getAbilityReportWithPersistenceFallback,
  submitAnswerDurably,
  submitAnswerWithPersistenceFallback,
} from '../adaptive-persistence';

function createMockDb() {
  const answeredAt = new Date('2026-05-26T02:30:00.000Z');
  const db = {
    adaptiveAssessmentAlgorithmVersion: {
      upsert: vi.fn().mockResolvedValue({
        version: 'adaptive-assessment-bkt-v1',
      }),
    },
    adaptiveAssessmentSession: {
      upsert: vi.fn().mockResolvedValue({
        id: 'durable-session-1',
        userId: 'student-1',
        sessionKey: 'session-1',
      }),
    },
    adaptiveAssessmentItemRef: {
      upsert: vi.fn().mockResolvedValue({
        id: 'item-ref-1',
        questionId: 'preset-q-01',
      }),
    },
    adaptiveAssessmentAnswer: {
      create: vi.fn().mockResolvedValue({
        id: 'answer-1',
        userId: 'student-1',
        sessionId: 'durable-session-1',
        questionId: 'preset-q-01',
        isCorrect: true,
        score: 100,
        responseTimeSeconds: 42,
        abilityEstimate: 2.1,
        algorithmVersion: 'adaptive-assessment-bkt-v1',
        answeredAt,
      }),
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'answer-1',
          userId: 'student-1',
          session: { sessionKey: 'session-1' },
          questionId: 'preset-q-01',
          selectedOptionKey: 'A',
          isCorrect: true,
          responseTimeSeconds: 42,
          answeredAt,
          questionRef: {
            difficulty: 0.1,
            knowledgeTags: ['pole-stability', 'gain-margin'],
          },
        },
      ]),
    },
    adaptiveAssessmentAbilityEstimate: {
      create: vi.fn().mockResolvedValue({ id: 'ability-1' }),
    },
    adaptiveMasteryUpdate: {
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
    learningFact: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };

  return {
    ...db,
    $transaction: vi.fn(async (callback: (tx: typeof db) => Promise<unknown>) => callback(db)),
  };
}

describe('submitAnswerDurably', () => {
  it('persists adaptive submissions with safe references while preserving the response contract', async () => {
    const db = createMockDb();
    const question = PRESET_QUESTIONS[0];
    const correctOptionText = question.options.find((option) => option.isCorrect)?.text;
    expect(correctOptionText).toBeTruthy();

    const result = await submitAnswerDurably({
      userId: 'student-1',
      sessionId: 'session-1',
      questionId: question.id,
      selectedOption: correctOptionText!,
      timeSpent: 42,
    }, db);

    expect(result).toMatchObject({
      isCorrect: true,
      correctOption: correctOptionText,
      explanation: expect.any(String),
      estimatedAbility: expect.any(Number),
      recommendedFocus: expect.any(Array),
      durableSessionId: 'durable-session-1',
      durableAnswerId: 'answer-1',
      algorithmVersion: 'adaptive-assessment-bkt-v1',
    });

    expect(db.adaptiveAssessmentAnswer.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        selectedOptionKey: expect.stringMatching(/^[A-D]$/),
        correctOptionKey: expect.stringMatching(/^[A-D]$/),
      }),
    }));

    const answerPayload = JSON.stringify(db.adaptiveAssessmentAnswer.create.mock.calls[0][0].data);
    const factPayload = JSON.stringify(db.learningFact.createMany.mock.calls[0][0].data);

    expect(answerPayload).not.toContain(correctOptionText);
    expect(factPayload).not.toContain(correctOptionText);
    expect(factPayload).toContain('adaptiveAssessment');
    expect(factPayload).toContain('privacyLevel');
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it('falls back to the legacy response shape when persistence is disabled', async () => {
    const db = createMockDb();
    const question = PRESET_QUESTIONS[1];
    const correctOptionText = question.options.find((option) => option.isCorrect)?.text;
    expect(correctOptionText).toBeTruthy();

    const result = await submitAnswerWithPersistenceFallback({
      userId: 'student-flag-off',
      sessionId: 'session-flag-off',
      questionId: question.id,
      selectedOption: correctOptionText!,
      timeSpent: 30,
    }, db, {
      ADAPTIVE_ASSESSMENT_PERSISTENCE_ENABLED: 'false',
    });

    expect(result).toMatchObject({
      isCorrect: true,
      correctOption: correctOptionText,
      explanation: expect.any(String),
      estimatedAbility: expect.any(Number),
      recommendedFocus: expect.any(Array),
    });
    expect(result).not.toHaveProperty('durableSessionId');
    expect(db.adaptiveAssessmentAnswer.create).not.toHaveBeenCalled();
    expect(db.learningFact.createMany).not.toHaveBeenCalled();
  });

  it('reads persisted assessment history after memory state is gone', async () => {
    const db = createMockDb();
    db.adaptiveAssessmentAnswer.findMany.mockResolvedValue([
      {
        id: 'answer-before-restart',
        userId: 'student-restart',
        session: { sessionKey: 'session-restart' },
        questionId: 'preset-q-01',
        selectedOptionKey: 'A',
        isCorrect: true,
        responseTimeSeconds: 35,
        answeredAt: new Date('2026-05-26T02:30:00.000Z'),
        questionRef: {
          difficulty: 0.1,
          knowledgeTags: ['pole-stability', 'gain-margin'],
        },
      },
      {
        id: 'answer-after-restart',
        userId: 'student-restart',
        session: { sessionKey: 'session-restart' },
        questionId: 'preset-q-02',
        selectedOptionKey: 'B',
        isCorrect: false,
        responseTimeSeconds: 70,
        answeredAt: new Date('2026-05-26T02:35:00.000Z'),
        questionRef: {
          difficulty: 0.2,
          knowledgeTags: ['damping-ratio', 'overshoot'],
        },
      },
    ]);

    const report = await getAbilityReportWithPersistenceFallback('student-restart', db);

    expect(report.timeline).toHaveLength(2);
    expect(report.timeline.map((point) => point.timestamp)).toEqual([
      Date.parse('2026-05-26T02:30:00.000Z'),
      Date.parse('2026-05-26T02:35:00.000Z'),
    ]);
    expect(report.estimatedAbility).not.toBe(0);
  });

  it('wraps durable writes in one transaction and rejects late materialization failures', async () => {
    const db = createMockDb();
    db.learningFact.createMany.mockRejectedValue(new Error('learning fact unavailable'));

    const question = PRESET_QUESTIONS[0];
    const correctOptionText = question.options.find((option) => option.isCorrect)?.text;
    expect(correctOptionText).toBeTruthy();

    await expect(submitAnswerDurably({
      userId: 'student-transaction',
      sessionId: 'session-transaction',
      questionId: question.id,
      selectedOption: correctOptionText!,
      timeSpent: 42,
    }, db)).rejects.toThrow('learning fact unavailable');

    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
});
