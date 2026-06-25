import { describe, expect, it, vi } from 'vitest';

import { buildKaqQuizQuestionMetadata } from '@/features/adaptive-assessment/kaq-quiz-foundation';

import { PRESET_QUESTIONS } from '../adaptive-question-bank';
import { generateQuestion } from '../adaptive-engine';
import {
  getAbilityReportWithPersistenceFallback,
  getDiagnosticWithPersistenceFallback,
  selectNextQuestionWithPersistenceFallback,
  submitAnswerDurably,
  submitAnswerWithPersistenceFallback,
} from '../adaptive-persistence';

function createMockDb() {
  const answeredAt = new Date('2026-05-26T02:30:00.000Z');
  const sessionState = {
    id: 'durable-session-1',
    userId: 'student-1',
    sessionKey: 'session-1',
    selectedQuestionIds: [] as string[],
  };
  const db = {
    $executeRawUnsafe: vi.fn().mockResolvedValue(1),
    adaptiveAssessmentAlgorithmVersion: {
      upsert: vi.fn().mockResolvedValue({
        version: 'adaptive-assessment-bkt-v1',
      }),
    },
    adaptiveAssessmentSession: {
      upsert: vi.fn().mockImplementation(async () => ({
        ...sessionState,
        selectedQuestionIds: [...sessionState.selectedQuestionIds],
      })),
      updateMany: vi.fn().mockImplementation(async (args: {
        where?: { selectedQuestionIds?: { equals?: string[] } };
        data?: { selectedQuestionIds?: string[] };
      }) => {
        const expectedQuestionIds = args.where?.selectedQuestionIds?.equals;
        if (
          Array.isArray(expectedQuestionIds)
          && JSON.stringify(expectedQuestionIds) !== JSON.stringify(sessionState.selectedQuestionIds)
        ) {
          return { count: 0 };
        }

        if (Array.isArray(args.data?.selectedQuestionIds)) {
          sessionState.selectedQuestionIds = [...args.data.selectedQuestionIds];
        }
        return { count: 1 };
      }),
    },
    adaptiveAssessmentItemRef: {
      upsert: vi.fn().mockResolvedValue({
        id: 'item-ref-1',
        questionId: 'preset-q-01',
      }),
    },
    adaptiveAssessmentAnswer: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockImplementation(async (args: { create?: Record<string, unknown> }) => ({
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
        ...(args.create ?? {}),
      })),
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
            questionType: 'pole-to-behavior',
            domains: ['complex', 'time'],
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

  const transaction = vi.fn(
    async (callback: (tx: typeof db) => Promise<unknown>) => callback(db),
  ) as unknown as <T>(callback: (tx: typeof db) => Promise<T>) => Promise<T>;

  return {
    ...db,
    $transaction: transaction,
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
      pathContext: {
        pathId: 'path-1',
        nodeId: 'adaptive-quiz:control-target-check',
        goalId: 'control-correction',
        routeIntent: 'path-execution',
      },
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

    expect(db.adaptiveAssessmentAnswer.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        selectedOptionKey: expect.stringMatching(/^[A-D]$/),
        correctOptionKey: expect.stringMatching(/^[A-D]$/),
      }),
    }));
    expect(db.adaptiveAssessmentAbilityEstimate.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        dimensions: expect.objectContaining({
          pathExecution: {
            pathId: 'path-1',
            nodeId: 'adaptive-quiz:control-target-check',
            goalId: 'control-correction',
            routeIntent: 'path-execution',
          },
        }),
      }),
    }));

    const answerPayload = JSON.stringify(db.adaptiveAssessmentAnswer.upsert.mock.calls[0][0].create);
    const factPayload = JSON.stringify(db.learningFact.createMany.mock.calls[0][0].data);

    expect(answerPayload).not.toContain(correctOptionText);
    expect(factPayload).not.toContain(correctOptionText);
    expect(factPayload).toContain('adaptiveAssessment');
    expect(factPayload).toContain('privacyLevel');
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.$executeRawUnsafe).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      'adaptive-assessment:adaptive-assessment-bkt-v1:student-1',
    );
  });

  it('keeps retried durable submissions idempotent for the same session question', async () => {
    const db = createMockDb();
    const answeredAt = new Date('2026-05-26T02:30:00.000Z');
    db.adaptiveAssessmentAnswer.findUnique.mockResolvedValue({
      id: 'answer-existing',
      userId: 'student-1',
      questionId: 'preset-q-01',
      isCorrect: true,
      score: 100,
      responseTimeSeconds: 42,
      abilityEstimate: 2.1,
      algorithmVersion: 'adaptive-assessment-bkt-v1',
      answeredAt,
    });
    db.adaptiveAssessmentAnswer.upsert.mockResolvedValue({
      id: 'answer-existing',
      userId: 'student-1',
      questionId: 'preset-q-01',
      isCorrect: true,
      score: 100,
      responseTimeSeconds: 42,
      abilityEstimate: 2.1,
      algorithmVersion: 'adaptive-assessment-bkt-v1',
      answeredAt,
    });
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

    expect(result.durableAnswerId).toBe('answer-existing');
    expect(db.adaptiveAssessmentAnswer.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        sessionId_questionId: {
          sessionId: 'durable-session-1',
          questionId: question.id,
        },
      },
      update: {},
    }));
    expect(db.adaptiveAssessmentAbilityEstimate.create).not.toHaveBeenCalled();
    expect(db.adaptiveMasteryUpdate.createMany).not.toHaveBeenCalled();
    expect(db.learningFact.createMany).not.toHaveBeenCalled();
  });

  it('writes path assessment retries to a retry session after a prior answer', async () => {
    const db = createMockDb();
    const question = PRESET_QUESTIONS.find((candidate) => {
      const metadata = buildKaqQuizQuestionMetadata(candidate);
      return metadata.learningGoalIds.includes('control-correction') &&
        metadata.review.state === 'reviewed' &&
        metadata.purpose === 'readiness-gate';
    });
    expect(question).toBeTruthy();
    const correctOptionText = question!.options.find((option) => option.isCorrect)?.text;
    expect(correctOptionText).toBeTruthy();

    db.adaptiveAssessmentSession.upsert
      .mockResolvedValueOnce({
        id: 'base-session',
        userId: 'student-1',
        sessionKey: 'adaptive-path:path-1:adaptive-quiz:control-target-check',
      })
      .mockResolvedValueOnce({
        id: 'retry-session',
        userId: 'student-1',
        sessionKey: 'adaptive-path:path-1:adaptive-quiz:control-target-check:retry-123',
      });
    db.adaptiveAssessmentAnswer.findUnique
      .mockResolvedValueOnce({
        id: 'answer-old',
        userId: 'student-1',
        questionId: question!.id,
        isCorrect: false,
        score: 0,
        responseTimeSeconds: 42,
        abilityEstimate: 0.4,
        algorithmVersion: 'adaptive-assessment-bkt-v1',
        answeredAt: new Date('2026-05-26T02:30:00.000Z'),
      })
      .mockResolvedValueOnce(null);
    db.adaptiveAssessmentAnswer.findMany.mockResolvedValueOnce([]);
    db.adaptiveAssessmentAnswer.upsert.mockImplementationOnce(async (args: { create?: Record<string, unknown> }) => ({
      id: 'answer-retry',
      userId: 'student-1',
      sessionId: 'retry-session',
      questionId: question!.id,
      isCorrect: true,
      score: 100,
      responseTimeSeconds: 42,
      abilityEstimate: 2.1,
      algorithmVersion: 'adaptive-assessment-bkt-v1',
      answeredAt: new Date(),
      ...(args.create ?? {}),
    }));

    const result = await submitAnswerDurably({
      userId: 'student-1',
      sessionId: 'adaptive-path:path-1:adaptive-quiz:control-target-check',
      questionId: question!.id,
      selectedOption: correctOptionText!,
      timeSpent: 42,
      pathContext: {
        pathId: 'path-1',
        nodeId: 'adaptive-quiz:control-target-check',
        goalId: 'control-correction',
        routeIntent: 'path-execution',
      },
    }, db);

    expect(result.durableSessionId).toBe('retry-session');
    expect(result.durableAnswerId).toBe('answer-retry');
    expect(db.adaptiveAssessmentSession.upsert).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: {
        userId_sessionKey: {
          userId: 'student-1',
          sessionKey: expect.stringMatching(/^adaptive-path:path-1:adaptive-quiz:control-target-check:retry-\d+$/),
        },
      },
    }));
    expect(db.adaptiveAssessmentAnswer.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        sessionId_questionId: {
          sessionId: 'retry-session',
          questionId: question!.id,
        },
      },
      create: expect.objectContaining({
        sessionId: 'retry-session',
        questionId: question!.id,
      }),
    }));
    expect(db.adaptiveAssessmentAbilityEstimate.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        sessionId: 'retry-session',
        answerId: 'answer-retry',
        dimensions: expect.objectContaining({
          pathExecution: {
            pathId: 'path-1',
            nodeId: 'adaptive-quiz:control-target-check',
            goalId: 'control-correction',
            routeIntent: 'path-execution',
          },
        }),
      }),
    }));
  });

  it('reuses a passed path retry answer when the original failed submission is replayed', async () => {
    const db = createMockDb();
    const question = PRESET_QUESTIONS.find((candidate) => {
      const metadata = buildKaqQuizQuestionMetadata(candidate);
      return metadata.learningGoalIds.includes('control-correction') &&
        metadata.review.state === 'reviewed' &&
        metadata.purpose === 'readiness-gate';
    });
    expect(question).toBeTruthy();
    const correctOptionText = question!.options.find((option) => option.isCorrect)?.text;
    expect(correctOptionText).toBeTruthy();

    db.adaptiveAssessmentSession.upsert
      .mockResolvedValueOnce({
        id: 'base-session',
        userId: 'student-1',
        sessionKey: 'adaptive-path:path-1:adaptive-quiz:control-target-check',
      })
      .mockResolvedValueOnce({
        id: 'retry-session',
        userId: 'student-1',
        sessionKey: 'adaptive-path:path-1:adaptive-quiz:control-target-check:retry-123',
      });
    db.adaptiveAssessmentAnswer.findUnique
      .mockResolvedValueOnce({
        id: 'answer-old',
        userId: 'student-1',
        questionId: question!.id,
        isCorrect: false,
        score: 0,
        responseTimeSeconds: 42,
        abilityEstimate: 0.4,
        algorithmVersion: 'adaptive-assessment-bkt-v1',
        answeredAt: new Date('2026-05-26T02:30:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 'answer-retry',
        userId: 'student-1',
        questionId: question!.id,
        isCorrect: true,
        score: 100,
        responseTimeSeconds: 42,
        abilityEstimate: 2.1,
        algorithmVersion: 'adaptive-assessment-bkt-v1',
        answeredAt: new Date('2026-05-26T02:31:00.000Z'),
      });
    db.adaptiveAssessmentAnswer.findMany.mockResolvedValueOnce([
      {
        id: 'answer-retry',
        userId: 'student-1',
        session: {
          id: 'retry-session',
          sessionKey: 'adaptive-path:path-1:adaptive-quiz:control-target-check:retry-123',
        },
        questionId: question!.id,
        selectedOptionKey: 'A',
        isCorrect: true,
        responseTimeSeconds: 42,
        answeredAt: new Date('2026-05-26T02:31:00.000Z'),
        questionRef: {
          difficulty: question!.difficulty,
          questionType: question!.type,
          domains: question!.domains,
          knowledgeTags: question!.knowledgeTags,
        },
      },
    ]);
    db.adaptiveAssessmentAnswer.upsert.mockResolvedValue({
      id: 'answer-retry',
      userId: 'student-1',
      sessionId: 'retry-session',
      questionId: question!.id,
      isCorrect: true,
      score: 100,
      responseTimeSeconds: 42,
      abilityEstimate: 2.1,
      algorithmVersion: 'adaptive-assessment-bkt-v1',
      answeredAt: new Date('2026-05-26T02:31:00.000Z'),
    });

    const result = await submitAnswerDurably({
      userId: 'student-1',
      sessionId: 'adaptive-path:path-1:adaptive-quiz:control-target-check',
      questionId: question!.id,
      selectedOption: correctOptionText!,
      timeSpent: 42,
      pathContext: {
        pathId: 'path-1',
        nodeId: 'adaptive-quiz:control-target-check',
        goalId: 'control-correction',
        routeIntent: 'path-execution',
      },
    }, db);

    expect(result.durableSessionId).toBe('retry-session');
    expect(result.durableAnswerId).toBe('answer-retry');
    expect(db.adaptiveAssessmentSession.upsert).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: {
        userId_sessionKey: {
          userId: 'student-1',
          sessionKey: 'adaptive-path:path-1:adaptive-quiz:control-target-check:retry-123',
        },
      },
    }));
    expect(db.adaptiveAssessmentAnswer.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({
        userId: 'student-1',
        questionId: question!.id,
        isCorrect: true,
        session: {
          sessionKey: {
            startsWith: 'adaptive-path:path-1:adaptive-quiz:control-target-check:retry-',
          },
        },
      }),
    }));
    expect(db.adaptiveAssessmentAnswer.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        sessionId_questionId: {
          sessionId: 'retry-session',
          questionId: question!.id,
        },
      },
      update: {},
    }));
    expect(db.adaptiveAssessmentAbilityEstimate.create).not.toHaveBeenCalled();
    expect(db.adaptiveMasteryUpdate.createMany).not.toHaveBeenCalled();
    expect(db.learningFact.createMany).not.toHaveBeenCalled();
  });

  it('keeps duplicate passed path submissions idempotent without creating a retry session', async () => {
    const db = createMockDb();
    const question = PRESET_QUESTIONS.find((candidate) => {
      const metadata = buildKaqQuizQuestionMetadata(candidate);
      return metadata.learningGoalIds.includes('control-correction') &&
        metadata.review.state === 'reviewed' &&
        metadata.purpose === 'readiness-gate';
    });
    expect(question).toBeTruthy();
    const correctOptionText = question!.options.find((option) => option.isCorrect)?.text;
    expect(correctOptionText).toBeTruthy();

    db.adaptiveAssessmentSession.upsert.mockResolvedValue({
      id: 'base-session',
      userId: 'student-1',
      sessionKey: 'adaptive-path:path-1:adaptive-quiz:control-target-check',
    });
    db.adaptiveAssessmentAnswer.findUnique.mockResolvedValue({
      id: 'answer-existing',
      userId: 'student-1',
      questionId: question!.id,
      isCorrect: true,
      score: 100,
      responseTimeSeconds: 42,
      abilityEstimate: 2.1,
      algorithmVersion: 'adaptive-assessment-bkt-v1',
      answeredAt: new Date('2026-05-26T02:30:00.000Z'),
    });
    db.adaptiveAssessmentAnswer.upsert.mockResolvedValue({
      id: 'answer-existing',
      userId: 'student-1',
      sessionId: 'base-session',
      questionId: question!.id,
      isCorrect: true,
      score: 100,
      responseTimeSeconds: 42,
      abilityEstimate: 2.1,
      algorithmVersion: 'adaptive-assessment-bkt-v1',
      answeredAt: new Date('2026-05-26T02:30:00.000Z'),
    });

    const result = await submitAnswerDurably({
      userId: 'student-1',
      sessionId: 'adaptive-path:path-1:adaptive-quiz:control-target-check',
      questionId: question!.id,
      selectedOption: correctOptionText!,
      timeSpent: 42,
      pathContext: {
        pathId: 'path-1',
        nodeId: 'adaptive-quiz:control-target-check',
        goalId: 'control-correction',
        routeIntent: 'path-execution',
      },
    }, db);

    expect(result.durableSessionId).toBe('base-session');
    expect(result.durableAnswerId).toBe('answer-existing');
    expect(db.adaptiveAssessmentSession.upsert).toHaveBeenCalledTimes(1);
    expect(db.adaptiveAssessmentSession.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId_sessionKey: {
          userId: 'student-1',
          sessionKey: 'adaptive-path:path-1:adaptive-quiz:control-target-check',
        },
      },
    }));
    expect(db.adaptiveAssessmentAnswer.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        sessionId_questionId: {
          sessionId: 'base-session',
          questionId: question!.id,
        },
      },
      update: {},
    }));
    expect(db.adaptiveAssessmentAbilityEstimate.create).not.toHaveBeenCalled();
    expect(db.adaptiveMasteryUpdate.createMany).not.toHaveBeenCalled();
    expect(db.learningFact.createMany).not.toHaveBeenCalled();
  });

  it('stores immutable item reference snapshots for question metadata', async () => {
    const db = createMockDb();
    const question = PRESET_QUESTIONS[0];
    const correctOptionText = question.options.find((option) => option.isCorrect)?.text;
    expect(correctOptionText).toBeTruthy();

    await submitAnswerDurably({
      userId: 'student-snapshot',
      sessionId: 'session-snapshot',
      questionId: question.id,
      selectedOption: correctOptionText!,
      timeSpent: 24,
    }, db);

    expect(db.adaptiveAssessmentItemRef.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        questionId_algorithmVersion_contentHash: {
          questionId: question.id,
          algorithmVersion: 'adaptive-assessment-bkt-v1',
          contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      },
      update: {},
      create: expect.objectContaining({
        contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        questionType: question.type,
        domains: question.domains,
        knowledgeTags: question.knowledgeTags,
        difficulty: question.difficulty,
      }),
    }));
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
    expect(db.adaptiveAssessmentAnswer.upsert).not.toHaveBeenCalled();
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
          questionType: 'pole-to-behavior',
          domains: ['complex', 'time'],
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
          questionType: 'bode-to-stability',
          domains: ['frequency', 'time'],
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

  it('keeps persisted next-question selections from repeating before the answer is submitted', async () => {
    const db = createMockDb();
    db.adaptiveAssessmentAnswer.findMany.mockResolvedValue([]);

    const selectedQuestionIds: string[] = [];
    for (let index = 0; index < PRESET_QUESTIONS.length; index += 1) {
      const next = await selectNextQuestionWithPersistenceFallback({
        userId: 'student-next',
        sessionId: 'session-next',
      }, db);
      selectedQuestionIds.push(next.question.id);
    }

    expect(new Set(selectedQuestionIds).size).toBe(PRESET_QUESTIONS.length);
    expect(db.adaptiveAssessmentSession.updateMany).toHaveBeenCalledTimes(PRESET_QUESTIONS.length);
    expect(db.adaptiveAssessmentSession.updateMany.mock.calls.at(-1)?.[0].data.selectedQuestionIds)
      .toHaveLength(PRESET_QUESTIONS.length);
  });

  it('scopes persisted next-question selections to the path learning goal', async () => {
    const db = createMockDb();
    db.adaptiveAssessmentAnswer.findMany.mockResolvedValue([]);

    const next = await selectNextQuestionWithPersistenceFallback({
      userId: 'student-next',
      sessionId: 'session-next',
      goalId: 'control-correction',
      questionScope: 'readiness',
    }, db);

    const metadata = buildKaqQuizQuestionMetadata(next.question);
    expect(metadata.learningGoalIds).toContain('control-correction');
    expect(metadata.purpose).toBe('readiness-gate');
    expect(metadata.review.state).toBe('reviewed');
  });

  it('allows generated low-stakes questions during goal practice selection', async () => {
    globalThis.__adaptiveAssessmentStore = undefined;
    const db = createMockDb();
    db.adaptiveAssessmentAnswer.findMany.mockResolvedValue([]);
    const generated = generateQuestion({
      targetKnowledgeTags: ['controller-tuning'],
      difficultyTarget: 0.5,
      domains: ['time', 'frequency'],
      learningGoalIds: ['control-correction'],
      ownerUserId: 'student-next',
      sessionId: 'practice-session-1',
    });
    const otherGoalGenerated = generateQuestion({
      targetKnowledgeTags: ['phase-margin'],
      difficultyTarget: 0.5,
      domains: ['frequency'],
      learningGoalIds: ['frequency-response-foundations'],
      ownerUserId: 'student-next',
      sessionId: 'practice-session-1',
    });
    db.adaptiveAssessmentSession.upsert.mockResolvedValue({
      id: 'durable-session-1',
      userId: 'student-1',
      sessionKey: 'practice-session-1',
      selectedQuestionIds: PRESET_QUESTIONS.map((question) => question.id),
    });
    db.adaptiveAssessmentSession.updateMany.mockResolvedValueOnce({ count: 1 });

    const next = await selectNextQuestionWithPersistenceFallback({
      userId: 'student-next',
      sessionId: 'practice-session-1',
      goalId: 'control-correction',
      questionScope: 'practice',
    }, db);

    expect(next.question.id).toBe(generated.id);
    expect(next.question.id).not.toBe(otherGoalGenerated.id);
    const metadata = buildKaqQuizQuestionMetadata(next.question);
    expect(metadata.learningGoalIds).toContain('control-correction');
    expect(metadata.review.state).toBe('provisional');
  });

  it('excludes unscoped generated questions from goal practice selection', async () => {
    globalThis.__adaptiveAssessmentStore = undefined;
    const db = createMockDb();
    db.adaptiveAssessmentAnswer.findMany.mockResolvedValue([]);
    const generated = generateQuestion({
      targetKnowledgeTags: ['controller-tuning'],
      difficultyTarget: 0.5,
      domains: ['time', 'frequency'],
      ownerUserId: 'student-next',
      sessionId: 'practice-session-unscoped',
    });
    const generatedFallbackGoal = buildKaqQuizQuestionMetadata(generated).learningGoalIds[0];
    expect(generatedFallbackGoal).toBeTruthy();
    db.adaptiveAssessmentSession.upsert.mockResolvedValue({
      id: 'durable-session-1',
      userId: 'student-1',
      sessionKey: 'practice-session-unscoped',
      selectedQuestionIds: PRESET_QUESTIONS.map((question) => question.id),
    });
    db.adaptiveAssessmentSession.updateMany.mockResolvedValueOnce({ count: 1 });

    const next = await selectNextQuestionWithPersistenceFallback({
      userId: 'student-next',
      sessionId: 'practice-session-unscoped',
      goalId: generatedFallbackGoal,
      questionScope: 'practice',
    }, db);

    expect(next.question.id).not.toBe(generated.id);
  });

  it('uses same-goal non-readiness reviewed questions for goal practice selection', async () => {
    globalThis.__adaptiveAssessmentStore = undefined;
    const db = createMockDb();
    db.adaptiveAssessmentAnswer.findMany.mockResolvedValue([]);
    const controlCorrectionReadinessQuestionIds = PRESET_QUESTIONS
      .filter((question) => {
        const metadata = buildKaqQuizQuestionMetadata(question);
        return metadata.learningGoalIds.includes('control-correction') &&
          metadata.purpose === 'readiness-gate';
      })
      .map((question) => question.id);
    db.adaptiveAssessmentSession.upsert.mockResolvedValue({
      id: 'durable-session-1',
      userId: 'student-1',
      sessionKey: 'practice-session-2',
      selectedQuestionIds: controlCorrectionReadinessQuestionIds,
    });
    db.adaptiveAssessmentSession.updateMany.mockResolvedValueOnce({ count: 1 });

    const next = await selectNextQuestionWithPersistenceFallback({
      userId: 'student-next',
      sessionId: 'practice-session-2',
      goalId: 'control-correction',
      questionScope: 'practice',
    }, db);

    const metadata = buildKaqQuizQuestionMetadata(next.question);
    expect(metadata.learningGoalIds).toContain('control-correction');
    expect(metadata.review.state).toBe('reviewed');
    expect(metadata.purpose).not.toBe('readiness-gate');
  });

  it('does not expose generated questions to the same user in a different session', async () => {
    globalThis.__adaptiveAssessmentStore = undefined;
    const db = createMockDb();
    db.adaptiveAssessmentAnswer.findMany.mockResolvedValue([]);
    const generated = generateQuestion({
      targetKnowledgeTags: ['controller-tuning'],
      difficultyTarget: 0.5,
      domains: ['time', 'frequency'],
      learningGoalIds: ['control-correction'],
      ownerUserId: 'student-owner',
      sessionId: 'practice-owner',
    });
    db.adaptiveAssessmentSession.upsert.mockResolvedValue({
      id: 'durable-session-1',
      userId: 'student-1',
      sessionKey: 'practice-other-session',
      selectedQuestionIds: PRESET_QUESTIONS.map((question) => question.id),
    });
    db.adaptiveAssessmentSession.updateMany.mockResolvedValueOnce({ count: 1 });

    const next = await selectNextQuestionWithPersistenceFallback({
      userId: 'student-owner',
      sessionId: 'practice-other-session',
      goalId: 'control-correction',
      questionScope: 'practice',
    }, db);

    expect(next.question.id).not.toBe(generated.id);
  });

  it('does not expose generated questions to another user in the same session key', async () => {
    globalThis.__adaptiveAssessmentStore = undefined;
    const db = createMockDb();
    db.adaptiveAssessmentAnswer.findMany.mockResolvedValue([]);
    const generated = generateQuestion({
      targetKnowledgeTags: ['controller-tuning'],
      difficultyTarget: 0.5,
      domains: ['time', 'frequency'],
      learningGoalIds: ['control-correction'],
      ownerUserId: 'student-owner',
      sessionId: 'practice-owner',
    });
    db.adaptiveAssessmentSession.upsert.mockResolvedValue({
      id: 'durable-session-1',
      userId: 'student-1',
      sessionKey: 'practice-owner',
      selectedQuestionIds: PRESET_QUESTIONS.map((question) => question.id),
    });
    db.adaptiveAssessmentSession.updateMany.mockResolvedValueOnce({ count: 1 });

    const next = await selectNextQuestionWithPersistenceFallback({
      userId: 'student-other',
      sessionId: 'practice-owner',
      goalId: 'control-correction',
      questionScope: 'practice',
    }, db);

    expect(next.question.id).not.toBe(generated.id);
  });

  it('fails path next-question selection for unknown learning goals', async () => {
    const db = createMockDb();
    db.adaptiveAssessmentAnswer.findMany.mockResolvedValue([]);

    await expect(selectNextQuestionWithPersistenceFallback({
      userId: 'student-next',
      sessionId: 'session-next',
      goalId: 'unknown-goal',
      questionScope: 'readiness',
    }, db)).rejects.toThrow('未找到学习目标 unknown-goal 的已审核 readiness 题目');
  });

  it('reissues a selected path readiness question before the answer is submitted', async () => {
    const db = createMockDb();
    db.adaptiveAssessmentAnswer.findMany.mockResolvedValue([]);
    const controlCorrectionReadinessQuestionIds = PRESET_QUESTIONS
      .filter((question) => {
        const metadata = buildKaqQuizQuestionMetadata(question);
        return metadata.learningGoalIds.includes('control-correction') &&
          metadata.purpose === 'readiness-gate' &&
          metadata.review.state === 'reviewed';
      })
      .map((question) => question.id);
    db.adaptiveAssessmentSession.upsert.mockResolvedValue({
      id: 'durable-session-1',
      userId: 'student-1',
      sessionKey: 'session-1',
      selectedQuestionIds: controlCorrectionReadinessQuestionIds,
    });
    db.adaptiveAssessmentSession.updateMany.mockResolvedValueOnce({ count: 1 });

    const next = await selectNextQuestionWithPersistenceFallback({
      userId: 'student-next',
      sessionId: 'session-next',
      goalId: 'control-correction',
      questionScope: 'readiness',
    }, db);

    expect(controlCorrectionReadinessQuestionIds).toContain(next.question.id);
  });

  it('reissues scoped readiness questions when answered path readiness questions are exhausted', async () => {
    const db = createMockDb();
    const controlCorrectionReadinessQuestionIds = PRESET_QUESTIONS
      .filter((question) => {
        const metadata = buildKaqQuizQuestionMetadata(question);
        return metadata.learningGoalIds.includes('control-correction') &&
          metadata.purpose === 'readiness-gate' &&
          metadata.review.state === 'reviewed';
      })
      .map((question) => question.id);
    db.adaptiveAssessmentAnswer.findMany.mockResolvedValue(controlCorrectionReadinessQuestionIds.map((questionId) => ({
      id: `answer-${questionId}`,
      userId: 'student-next',
      session: { sessionKey: 'session-next' },
      questionId,
      selectedOptionKey: 'A',
      isCorrect: false,
      responseTimeSeconds: 42,
      answeredAt: new Date('2026-05-26T02:30:00.000Z'),
      questionRef: {
        difficulty: 0.5,
        questionType: 'multi-criteria',
        domains: ['complex', 'time'],
        knowledgeTags: ['controller-tuning'],
        metadata: {
          kaq: {
            review: { state: 'reviewed' },
          },
        },
      },
    })));
    db.adaptiveAssessmentSession.upsert.mockResolvedValue({
      id: 'durable-session-1',
      userId: 'student-1',
      sessionKey: 'session-1',
      selectedQuestionIds: controlCorrectionReadinessQuestionIds,
    });
    db.adaptiveAssessmentSession.updateMany.mockResolvedValueOnce({ count: 1 });

    const next = await selectNextQuestionWithPersistenceFallback({
      userId: 'student-next',
      sessionId: 'session-next',
      goalId: 'control-correction',
      questionScope: 'readiness',
    }, db);

    expect(controlCorrectionReadinessQuestionIds).toContain(next.question.id);
  });

  it('selects reviewed checkpoint questions for path checkpoint scope', async () => {
    const db = createMockDb();
    db.adaptiveAssessmentAnswer.findMany.mockResolvedValue([]);

    const next = await selectNextQuestionWithPersistenceFallback({
      userId: 'student-next',
      sessionId: 'session-next',
      goalId: 'control-correction',
      questionScope: 'checkpoint',
    }, db);

    const metadata = buildKaqQuizQuestionMetadata(next.question);
    expect(metadata.learningGoalIds).toContain('control-correction');
    expect(metadata.review.state).toBe('reviewed');
    expect(metadata.purpose).toBe('checkpoint');
  });

  it('retries next-question selection when the persisted asked set changed concurrently', async () => {
    const db = createMockDb();
    db.adaptiveAssessmentAnswer.findMany.mockResolvedValue([]);
    db.adaptiveAssessmentSession.upsert
      .mockResolvedValueOnce({
        id: 'durable-session-1',
        selectedQuestionIds: [],
      })
      .mockResolvedValueOnce({
        id: 'durable-session-1',
        selectedQuestionIds: [PRESET_QUESTIONS[0].id],
      });
    db.adaptiveAssessmentSession.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    const next = await selectNextQuestionWithPersistenceFallback({
      userId: 'student-next',
      sessionId: 'session-next',
    }, db);

    expect(next.question.id).not.toBe(PRESET_QUESTIONS[0].id);
    expect(db.adaptiveAssessmentSession.updateMany).toHaveBeenCalledTimes(2);
  });

  it('uses persisted generated question metadata for diagnostic dimensions after restart', async () => {
    const db = createMockDb();
    db.adaptiveAssessmentAnswer.findMany.mockResolvedValue([
      {
        id: 'answer-generated',
        userId: 'student-generated',
        session: { sessionKey: 'session-generated' },
        questionId: 'generated-q-review-1',
        selectedOptionKey: 'A',
        isCorrect: true,
        responseTimeSeconds: 55,
        answeredAt: new Date('2026-05-26T03:00:00.000Z'),
        questionRef: {
          difficulty: 0.7,
          questionType: 'multi-criteria',
          domains: ['time', 'frequency'],
          knowledgeTags: ['robustness', 'controller-tuning'],
        },
      },
    ]);

    const diagnostic = await getDiagnosticWithPersistenceFallback('student-generated', db);

    expect(diagnostic.knowledgeDimensions).toMatchObject({
      computational: 55,
      crossDomain: 100,
      design: 100,
    });
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
