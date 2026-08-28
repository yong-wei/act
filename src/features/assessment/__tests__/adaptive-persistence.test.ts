import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { buildKaqQuizQuestionMetadata } from '@/features/adaptive-assessment/kaq-quiz-foundation';
import * as adaptiveAssessmentCatalogSelector from '@/features/adaptive-assessment/adaptive-assessment-catalog-selector';
import {
  checkpointAuthoredQuestionRuntimeId,
  REVIEWED_LEARNING_GOAL_CHECKPOINT_QUESTIONS,
  sourceIdFromCheckpointAuthoredQuestionRuntimeId,
} from '@/features/adaptive-assessment/learning-goal-checkpoint-question-sets';

import { PRESET_QUESTIONS } from '../adaptive-question-bank';
import * as resourceRegistryMetadata from '@/lib/resource-registry-metadata';
import {
  generateQuestion,
  getAdaptiveQuestionById,
  selectNextQuestionFromAnswers,
} from '../adaptive-engine';
import {
  getAbilityReportDurably,
  getDiagnosticDurably,
  selectNextQuestionDurably,
  submitAnswerDurably,
  RETIRED_ADAPTIVE_ASSESSMENT_PERSISTENCE_FALLBACK,
} from '../adaptive-persistence';

interface CoverageMatrix {
  rows: Array<{
    learningGoalId: string;
    assessmentCoverageState: 'complete' | 'limited';
    stageCoverage: Array<{
      stage: string;
      status: 'complete' | 'limited';
      reviewedPathEligibleCount: number;
    }>;
  }>;
}

interface CatalogItemFixture {
  sourceFamily: string;
  sourceId: string;
  reviewState: string;
  eligibilityState: string;
  allowedStages: string[];
  semanticRefs: {
    learningGoalIds: string[];
  };
}

const APPROVED_READINESS_GOAL_ID = 'time-domain-response-analysis';

describe('standalone adaptive practice governance', () => {
  it('prefers a reviewed catalog question that can support wrong-answer remediation', () => {
    const result = selectNextQuestionFromAnswers({
      userId: 'micro-tutoring-user',
      sessionId: 'micro-tutoring-session',
      questionScope: 'practice',
    }, []);

    expect(adaptiveAssessmentCatalogSelector.findAdaptiveAssessmentCatalogSnapshot(result.question.id))
      .toMatchObject({ reviewDecision: { outcome: 'approved' } });
  });
});

function approvedReadinessQuestion() {
  const question = PRESET_QUESTIONS.find((candidate) => candidate.id === 'preset-q-05');
  if (!question) throw new Error('missing approved readiness question preset-q-05');
  return question;
}

function readCoverageMatrix(): CoverageMatrix {
  return JSON.parse(
    readFileSync('course-content/runtime/resource-governance/learning-goal-assessment-coverage-matrix.json', 'utf8'),
  ) as CoverageMatrix;
}

function readCatalogQuestionIds(params: { learningGoalId: string; stage: 'readiness' | 'checkpoint' | 'remediation'; sourceFamily?: string }): string[] {
  return readFileSync('course-content/runtime/resource-governance/adaptive-assessment-item-catalog-items.jsonl', 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as CatalogItemFixture)
    .filter((item) =>
      item.reviewState === 'path-eligible' &&
      item.eligibilityState === 'path-eligible' &&
      item.allowedStages.includes(params.stage) &&
      item.semanticRefs.learningGoalIds.includes(params.learningGoalId) &&
      (!params.sourceFamily || item.sourceFamily === params.sourceFamily)
    )
    .map((item) => item.sourceId)
    .sort();
}

function expectCatalogPathQuestion(
  question: { id: string },
  learningGoalId: string,
  scope: 'readiness' | 'checkpoint' | 'remediation',
) {
  const ids = readCatalogQuestionIds({ learningGoalId, stage: scope });
  const runtimeIds = new Set([
    ...ids,
    ...ids.map((id) => checkpointAuthoredQuestionRuntimeId(id)),
  ]);
  expect(runtimeIds).toContain(question.id);
}

function metadataForPublicQuestion(question: { id: string }) {
  const runtimeQuestion = getAdaptiveQuestionById(question.id);
  expect(runtimeQuestion).toBeTruthy();
  return buildKaqQuizQuestionMetadata(runtimeQuestion!);
}

function createMockDb(selectedQuestionIds: string[] = []) {
  const answeredAt = new Date('2026-05-26T02:30:00.000Z');
  const sessionState = {
    id: 'durable-session-1',
    userId: 'student-1',
    sessionKey: 'session-1',
    selectedQuestionIds: [...selectedQuestionIds],
    metadata: {} as Record<string, unknown>,
  };
  const itemRefStore = new Map<string, Record<string, unknown>>();
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
        metadata: sessionState.metadata,
      })),
      updateMany: vi.fn().mockImplementation(async (args: {
        where?: { selectedQuestionIds?: { equals?: string[] } };
        data?: { selectedQuestionIds?: string[]; metadata?: Record<string, unknown> };
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
        if (args.data?.metadata) {
          sessionState.metadata = args.data.metadata;
        }
        return { count: 1 };
      }),
    },
    adaptiveAssessmentItemRef: {
      upsert: vi.fn().mockImplementation(async (args: {
        where?: { questionId_algorithmVersion_contentHash?: { questionId?: string; contentHash?: string } };
        create?: Record<string, unknown>;
      }) => {
        const key = JSON.stringify(args.where?.questionId_algorithmVersion_contentHash ?? args.where);
        const existing = itemRefStore.get(key);
        if (existing) return existing;
        const created = {
          id: `item-ref-${itemRefStore.size + 1}`,
          ...(args.create ?? {}),
        };
        itemRefStore.set(key, created);
        return created;
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
    const question = approvedReadinessQuestion();
    const db = createMockDb([question.id]);
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
        goalId: APPROVED_READINESS_GOAL_ID,
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
            goalId: APPROVED_READINESS_GOAL_ID,
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
    const question = approvedReadinessQuestion();
    const db = createMockDb([question.id]);
    const correctOptionText = question.options.find((option) => option.isCorrect)?.text;
    expect(correctOptionText).toBeTruthy();
    const failedOptionIndex = question.options.findIndex((option) => !option.isCorrect);
    const failedOptionKey = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[failedOptionIndex];
    expect(failedOptionKey).toBeTruthy();

    db.adaptiveAssessmentSession.upsert
      .mockResolvedValueOnce({
        id: 'base-session',
        userId: 'student-1',
        sessionKey: 'adaptive-path:path-1:adaptive-quiz:control-target-check',
        selectedQuestionIds: [question!.id],
      })
      .mockResolvedValueOnce({
        id: 'retry-session',
        userId: 'student-1',
        sessionKey: 'adaptive-path:path-1:adaptive-quiz:control-target-check:retry-123',
        selectedQuestionIds: [question!.id],
      });
    db.adaptiveAssessmentAnswer.findUnique
      .mockResolvedValueOnce({
        id: 'answer-old',
        userId: 'student-1',
        questionId: question.id,
        selectedOptionKey: failedOptionKey,
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
      questionId: question.id,
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
      questionId: question.id,
      selectedOption: correctOptionText!,
      timeSpent: 42,
      pathContext: {
        pathId: 'path-1',
        nodeId: 'adaptive-quiz:control-target-check',
        goalId: APPROVED_READINESS_GOAL_ID,
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
          questionId: question.id,
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
            goalId: APPROVED_READINESS_GOAL_ID,
            routeIntent: 'path-execution',
          },
        }),
      }),
    }));
  });

  it('reuses a passed path retry answer when the original failed submission is replayed', async () => {
    const question = PRESET_QUESTIONS.find((candidate) => {
      const metadata = buildKaqQuizQuestionMetadata(candidate);
      return metadata.learningGoalIds.includes('control-correction') &&
        metadata.review.state === 'reviewed' &&
        metadata.purpose === 'readiness-gate';
    });
    expect(question).toBeTruthy();
    const db = createMockDb([question!.id]);
    const correctOptionText = question!.options.find((option) => option.isCorrect)?.text;
    expect(correctOptionText).toBeTruthy();
    const failedOptionIndex = question!.options.findIndex((option) => !option.isCorrect);
    const failedOptionKey = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[failedOptionIndex];
    expect(failedOptionKey).toBeTruthy();

    db.adaptiveAssessmentSession.upsert
      .mockResolvedValueOnce({
        id: 'base-session',
        userId: 'student-1',
        sessionKey: 'adaptive-path:path-1:adaptive-quiz:control-target-check',
        selectedQuestionIds: [question!.id],
      })
      .mockResolvedValueOnce({
        id: 'retry-session',
        userId: 'student-1',
        sessionKey: 'adaptive-path:path-1:adaptive-quiz:control-target-check:retry-123',
        selectedQuestionIds: [question!.id],
      });
    db.adaptiveAssessmentAnswer.findUnique
      .mockResolvedValueOnce({
        id: 'answer-old',
        userId: 'student-1',
        questionId: question!.id,
        selectedOptionKey: failedOptionKey,
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
        selectedOptionKey: expect.any(String),
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

  it('reuses a matching failed path retry answer when the same retry selection is replayed', async () => {
    const question = PRESET_QUESTIONS.find((candidate) => {
      const metadata = buildKaqQuizQuestionMetadata(candidate);
      return metadata.learningGoalIds.includes('control-correction') &&
        metadata.review.state === 'reviewed' &&
        metadata.purpose === 'readiness-gate';
    });
    expect(question).toBeTruthy();
    const db = createMockDb([question!.id]);
    const failedOptions = question!.options
      .map((option, index) => ({ option, key: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[index] }))
      .filter(({ option }) => !option.isCorrect);
    expect(failedOptions.length).toBeGreaterThanOrEqual(2);
    const [originalFailure, retryFailure] = failedOptions;

    db.adaptiveAssessmentSession.upsert
      .mockResolvedValueOnce({
        id: 'base-session',
        userId: 'student-1',
        sessionKey: 'adaptive-path:path-1:adaptive-quiz:control-target-check',
        selectedQuestionIds: [question!.id],
      })
      .mockResolvedValueOnce({
        id: 'retry-session',
        userId: 'student-1',
        sessionKey: 'adaptive-path:path-1:adaptive-quiz:control-target-check:retry-456',
        selectedQuestionIds: [question!.id],
      });
    db.adaptiveAssessmentAnswer.findUnique
      .mockResolvedValueOnce({
        id: 'answer-old',
        userId: 'student-1',
        questionId: question!.id,
        selectedOptionKey: originalFailure.key,
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
        selectedOptionKey: retryFailure.key,
        isCorrect: false,
        score: 0,
        responseTimeSeconds: 42,
        abilityEstimate: 0.3,
        algorithmVersion: 'adaptive-assessment-bkt-v1',
        answeredAt: new Date('2026-05-26T02:31:00.000Z'),
      });
    db.adaptiveAssessmentAnswer.findMany.mockResolvedValueOnce([
      {
        id: 'answer-retry',
        userId: 'student-1',
        session: {
          id: 'retry-session',
          sessionKey: 'adaptive-path:path-1:adaptive-quiz:control-target-check:retry-456',
        },
        questionId: question!.id,
        selectedOptionKey: retryFailure.key,
        isCorrect: false,
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
      isCorrect: false,
      score: 0,
      responseTimeSeconds: 42,
      abilityEstimate: 0.3,
      algorithmVersion: 'adaptive-assessment-bkt-v1',
      answeredAt: new Date('2026-05-26T02:31:00.000Z'),
    });

    const result = await submitAnswerDurably({
      userId: 'student-1',
      sessionId: 'adaptive-path:path-1:adaptive-quiz:control-target-check',
      questionId: question!.id,
      selectedOption: retryFailure.option.text,
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
    expect(db.adaptiveAssessmentAnswer.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({
        userId: 'student-1',
        questionId: question!.id,
        selectedOptionKey: retryFailure.key,
        session: {
          sessionKey: {
            startsWith: 'adaptive-path:path-1:adaptive-quiz:control-target-check:retry-',
          },
        },
      }),
    }));
    expect(db.adaptiveAssessmentSession.upsert).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: {
        userId_sessionKey: {
          userId: 'student-1',
          sessionKey: 'adaptive-path:path-1:adaptive-quiz:control-target-check:retry-456',
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
      update: {},
    }));
    expect(db.adaptiveAssessmentAbilityEstimate.create).not.toHaveBeenCalled();
    expect(db.adaptiveMasteryUpdate.createMany).not.toHaveBeenCalled();
    expect(db.learningFact.createMany).not.toHaveBeenCalled();
  });

  it('keeps replayed failed path submissions idempotent when the selected option is unchanged', async () => {
    const question = PRESET_QUESTIONS.find((candidate) => {
      const metadata = buildKaqQuizQuestionMetadata(candidate);
      return metadata.learningGoalIds.includes('control-correction') &&
        metadata.review.state === 'reviewed' &&
        metadata.purpose === 'readiness-gate';
    });
    expect(question).toBeTruthy();
    const db = createMockDb([question!.id]);
    const failedOptionIndex = question!.options.findIndex((option) => !option.isCorrect);
    const failedOption = question!.options[failedOptionIndex];
    const failedOptionKey = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[failedOptionIndex];
    expect(failedOption?.text).toBeTruthy();
    expect(failedOptionKey).toBeTruthy();

    db.adaptiveAssessmentSession.upsert.mockResolvedValue({
      id: 'base-session',
      userId: 'student-1',
      sessionKey: 'adaptive-path:path-1:adaptive-quiz:control-target-check',
      selectedQuestionIds: [question!.id],
    });
    db.adaptiveAssessmentAnswer.findUnique.mockResolvedValue({
      id: 'answer-old',
      userId: 'student-1',
      questionId: question!.id,
      selectedOptionKey: failedOptionKey,
      isCorrect: false,
      score: 0,
      responseTimeSeconds: 42,
      abilityEstimate: 0.4,
      algorithmVersion: 'adaptive-assessment-bkt-v1',
      answeredAt: new Date('2026-05-26T02:30:00.000Z'),
    });
    db.adaptiveAssessmentAnswer.upsert.mockResolvedValue({
      id: 'answer-old',
      userId: 'student-1',
      sessionId: 'base-session',
      questionId: question!.id,
      isCorrect: false,
      score: 0,
      responseTimeSeconds: 42,
      abilityEstimate: 0.4,
      algorithmVersion: 'adaptive-assessment-bkt-v1',
      answeredAt: new Date('2026-05-26T02:30:00.000Z'),
    });

    const result = await submitAnswerDurably({
      userId: 'student-1',
      sessionId: 'adaptive-path:path-1:adaptive-quiz:control-target-check',
      questionId: question!.id,
      selectedOption: failedOption!.text,
      timeSpent: 42,
      pathContext: {
        pathId: 'path-1',
        nodeId: 'adaptive-quiz:control-target-check',
        goalId: 'control-correction',
        routeIntent: 'path-execution',
      },
    }, db);

    expect(result.durableSessionId).toBe('base-session');
    expect(result.durableAnswerId).toBe('answer-old');
    expect(db.adaptiveAssessmentSession.upsert).toHaveBeenCalledTimes(1);
    expect(db.adaptiveAssessmentAnswer.findMany).not.toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        session: expect.any(Object),
      }),
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

  it('keeps duplicate passed path submissions idempotent without creating a retry session', async () => {
    const question = PRESET_QUESTIONS.find((candidate) => {
      const metadata = buildKaqQuizQuestionMetadata(candidate);
      return metadata.learningGoalIds.includes('control-correction') &&
        metadata.review.state === 'reviewed' &&
        metadata.purpose === 'readiness-gate';
    });
    expect(question).toBeTruthy();
    const db = createMockDb([question!.id]);
    const correctOptionText = question!.options.find((option) => option.isCorrect)?.text;
    expect(correctOptionText).toBeTruthy();

    db.adaptiveAssessmentSession.upsert.mockResolvedValue({
      id: 'base-session',
      userId: 'student-1',
      sessionKey: 'adaptive-path:path-1:adaptive-quiz:control-target-check',
      selectedQuestionIds: [question!.id],
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
    const question = approvedReadinessQuestion();
    const correctOptionText = question.options.find((option) => option.isCorrect)?.text;
    expect(correctOptionText).toBeTruthy();
    const catalogSnapshot = adaptiveAssessmentCatalogSelector.findAdaptiveAssessmentCatalogSnapshot(question.id);
    expect(catalogSnapshot).toBeTruthy();
    const catalogSnapshotSpy = vi.spyOn(adaptiveAssessmentCatalogSelector, 'findAdaptiveAssessmentCatalogSnapshot').mockReturnValue({
      ...catalogSnapshot!,
      reviewDecision: {
        ...catalogSnapshot!.reviewDecision,
        remediationRefs: [
          'registry:valid-remediation',
          'registry:unresolvable-remediation',
          'registry:missing-render-target',
        ],
      },
    });
    const resourceMetadataSpy = vi.spyOn(resourceRegistryMetadata, 'getRegisteredResourceMetadataByNodeId').mockImplementation((id) => {
      if (id === 'registry:valid-remediation') {
        return {
          id: 'valid-remediation',
          label: 'Canonical remediation title',
          renderTarget: '/interactive-learning/resources/canonical-remediation',
        } as ReturnType<typeof resourceRegistryMetadata.getRegisteredResourceMetadataByNodeId>;
      }
      if (id === 'registry:missing-render-target') {
        return {
          id: 'missing-render-target',
          label: 'Resource without target',
          renderTarget: null,
        } as ReturnType<typeof resourceRegistryMetadata.getRegisteredResourceMetadataByNodeId>;
      }
      return undefined;
    });

    await submitAnswerDurably({
      userId: 'student-snapshot',
      sessionId: 'session-snapshot',
      questionId: question.id,
      selectedOption: correctOptionText!,
      timeSpent: 24,
    }, db);
    catalogSnapshotSpy.mockRestore();
    resourceMetadataSpy.mockRestore();

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
        metadata: expect.objectContaining({
          kaq: expect.objectContaining({
            immutableContentHash: expect.any(String),
          }),
          adaptiveAssessmentItemRef: expect.objectContaining({
            catalogBacked: expect.any(Boolean),
            snapshotVersion: 'adaptive-assessment-item-ref.v1',
          }),
          questionSnapshot: {
            version: 'adaptive-question-snapshot.v1',
            prompt: question.stem,
            options: question.options.map((option, index) => ({
              key: String.fromCharCode(65 + index),
              label: option.label,
              text: option.text,
              explanation: option.explanation,
            })),
            correctOptionKey: String.fromCharCode(65 + question.options.findIndex((option) => option.isCorrect)),
            explanation: question.options.find((option) => option.isCorrect)?.explanation,
            knowledgeTags: question.knowledgeTags,
            misconceptionTags: expect.any(Array),
            remediationResources: [{
              id: 'registry:valid-remediation',
              title: 'Canonical remediation title',
              href: '/interactive-learning/resources/canonical-remediation',
              governanceState: 'reviewed',
            }],
          },
        }),
        contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        questionType: question.type,
        domains: question.domains,
        knowledgeTags: question.knowledgeTags,
        difficulty: question.difficulty,
      }),
    }));
  });

  it('fails closed when the retired persistence flag is false', async () => {
    const db = createMockDb();
    const question = PRESET_QUESTIONS[1];
    const correctOptionText = question.options.find((option) => option.isCorrect)?.text;
    expect(correctOptionText).toBeTruthy();
    const disabled = { ADAPTIVE_ASSESSMENT_PERSISTENCE_ENABLED: 'false' };

    await expect(submitAnswerDurably({
      userId: 'student-flag-off',
      sessionId: 'session-flag-off',
      questionId: question.id,
      selectedOption: correctOptionText!,
      timeSpent: 30,
    }, db, disabled)).rejects.toThrow(RETIRED_ADAPTIVE_ASSESSMENT_PERSISTENCE_FALLBACK);
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

    const report = await getAbilityReportDurably('student-restart', db);

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
      const next = await selectNextQuestionDurably({
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

    const next = await selectNextQuestionDurably({
      userId: 'student-next',
      sessionId: 'session-next',
      goalId: 'control-correction',
      questionScope: 'readiness',
    }, db);

    const metadata = metadataForPublicQuestion(next.question);
    expect(metadata.learningGoalIds).toContain('control-correction');
    expect(metadata.purpose).toBe('readiness-gate');
    expect(metadata.review.state).toBe('reviewed');
  });

  it('rejects path answers for questions the session never selected', async () => {
    const db = createMockDb();
    db.adaptiveAssessmentAnswer.findMany.mockResolvedValue([]);
    const selected = await selectNextQuestionDurably({
      userId: 'student-owned',
      sessionId: 'session-owned',
      goalId: APPROVED_READINESS_GOAL_ID,
      questionScope: 'readiness',
    }, db);
    const other = PRESET_QUESTIONS.find((candidate) => candidate.id !== selected.question.id);
    expect(other).toBeTruthy();
    const selectedOption = other!.options.find((option) => option.isCorrect)?.text ?? other!.options[0].text;

    await expect(submitAnswerDurably({
      userId: 'student-owned',
      sessionId: 'session-owned',
      questionId: other!.id,
      selectedOption,
      timeSpent: 20,
      pathContext: {
        pathId: 'path-1',
        nodeId: 'adaptive-quiz:control-target-check',
        goalId: APPROVED_READINESS_GOAL_ID,
        routeIntent: 'path-execution',
        questionScope: 'readiness',
      },
    }, db)).rejects.toThrow('路径自适应答案不属于当前会话已选择的题目');
  });

  it('reuses the selection-time snapshot when the live question later changes', async () => {
    const db = createMockDb();
    db.adaptiveAssessmentAnswer.findMany.mockResolvedValue([]);
    const selected = await selectNextQuestionDurably({
      userId: 'student-owned',
      sessionId: 'session-owned',
      goalId: APPROVED_READINESS_GOAL_ID,
      questionScope: 'readiness',
    }, db);
    const selectionHash = db.adaptiveAssessmentItemRef.upsert.mock.calls[0][0]
      .where.questionId_algorithmVersion_contentHash.contentHash as string;
    const catalogSnapshot = adaptiveAssessmentCatalogSelector.findAdaptiveAssessmentCatalogSnapshot(selected.question.id);
    expect(catalogSnapshot).toBeTruthy();
    const catalogSnapshotSpy = vi.spyOn(
      adaptiveAssessmentCatalogSelector,
      'findAdaptiveAssessmentCatalogSnapshot',
    ).mockReturnValue({
      ...catalogSnapshot!,
      contentHash: `mutated-${catalogSnapshot!.contentHash}`,
    });
    const question = getAdaptiveQuestionById(selected.question.id);
    expect(question).toBeTruthy();
    const originalOptions = question!.options.map((option) => ({ ...option }));
    const originalCorrectText = originalOptions.find((option) => option.isCorrect)?.text ?? originalOptions[0].text;
    question!.options.forEach((option) => {
      option.isCorrect = !option.isCorrect;
    });

    let result: Awaited<ReturnType<typeof submitAnswerDurably>>;
    try {
      result = await submitAnswerDurably({
        userId: 'student-owned',
        sessionId: 'session-owned',
        questionId: selected.question.id,
        selectedOption: originalCorrectText,
        timeSpent: 20,
        pathContext: {
          pathId: 'path-1',
          nodeId: 'adaptive-quiz:control-target-check',
          goalId: APPROVED_READINESS_GOAL_ID,
          routeIntent: 'path-execution',
          questionScope: 'readiness',
        },
      }, db);
    } finally {
      question!.options.forEach((option, index) => {
        option.isCorrect = originalOptions[index].isCorrect;
        option.label = originalOptions[index].label;
        option.text = originalOptions[index].text;
        option.explanation = originalOptions[index].explanation;
      });
      catalogSnapshotSpy.mockRestore();
    }

    expect(result.isCorrect).toBe(true);
    expect(result.correctOption).toBe(originalOptions.find((option) => option.isCorrect)?.label);
    const submitWhere = db.adaptiveAssessmentItemRef.upsert.mock.calls.at(-1)?.[0]
      .where.questionId_algorithmVersion_contentHash;
    expect(submitWhere.questionId).toBe(selected.question.id);
    expect(submitWhere.contentHash).toBe(selectionHash);
    expect(db.adaptiveAssessmentAnswer.upsert.mock.calls.at(-1)?.[0].create).toMatchObject({
      isCorrect: true,
      correctOptionKey: String.fromCharCode(65 + originalOptions.findIndex((option) => option.isCorrect)),
    });
  });

  it('keeps selection-time catalog authority after the live catalog item is withdrawn', async () => {
    const db = createMockDb();
    db.adaptiveAssessmentAnswer.findMany.mockResolvedValue([]);
    const selected = await selectNextQuestionDurably({
      userId: 'student-owned',
      sessionId: 'session-owned',
      goalId: APPROVED_READINESS_GOAL_ID,
      questionScope: 'readiness',
    }, db);
    const selectionCatalog = adaptiveAssessmentCatalogSelector.findAdaptiveAssessmentCatalogSnapshot(selected.question.id);
    expect(selectionCatalog).toBeTruthy();
    const catalogSnapshotSpy = vi.spyOn(
      adaptiveAssessmentCatalogSelector,
      'findAdaptiveAssessmentCatalogSnapshot',
    ).mockReturnValue(null);
    const question = getAdaptiveQuestionById(selected.question.id);
    expect(question).toBeTruthy();
    const selectedOption = question!.options.find((option) => option.isCorrect)?.text ?? question!.options[0].text;

    let result: Awaited<ReturnType<typeof submitAnswerDurably>>;
    try {
      result = await submitAnswerDurably({
        userId: 'student-owned',
        sessionId: 'session-owned',
        questionId: selected.question.id,
        selectedOption,
        timeSpent: 20,
        pathContext: {
          pathId: 'path-1',
          nodeId: 'adaptive-quiz:control-target-check',
          goalId: APPROVED_READINESS_GOAL_ID,
          routeIntent: 'path-execution',
          questionScope: 'readiness',
        },
      }, db);
    } finally {
      catalogSnapshotSpy.mockRestore();
    }

    expect(result.adaptiveAssessmentRef).toMatchObject({
      catalogItemId: selectionCatalog!.catalogItemId,
      contentHash: selectionCatalog!.contentHash,
      evidenceAuthority: 'path-assessment',
      reviewState: 'reviewed',
    });
    expect(db.learningFact.createMany).toHaveBeenCalled();
    expect(db.adaptiveMasteryUpdate.createMany).toHaveBeenCalled();
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

    const next = await selectNextQuestionDurably({
      userId: 'student-next',
      sessionId: 'practice-session-1',
      goalId: 'control-correction',
      questionScope: 'practice',
    }, db);

    expect(next.question.id).toBe(generated.id);
    expect(next.question.id).not.toBe(otherGoalGenerated.id);
    const metadata = metadataForPublicQuestion(next.question);
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
    const generatedFallbackGoal = metadataForPublicQuestion(generated).learningGoalIds[0];
    expect(generatedFallbackGoal).toBeTruthy();
    db.adaptiveAssessmentSession.upsert.mockResolvedValue({
      id: 'durable-session-1',
      userId: 'student-1',
      sessionKey: 'practice-session-unscoped',
      selectedQuestionIds: PRESET_QUESTIONS.map((question) => question.id),
    });
    db.adaptiveAssessmentSession.updateMany.mockResolvedValueOnce({ count: 1 });

    const next = await selectNextQuestionDurably({
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

    const next = await selectNextQuestionDurably({
      userId: 'student-next',
      sessionId: 'practice-session-2',
      goalId: 'control-correction',
      questionScope: 'practice',
    }, db);

    const metadata = metadataForPublicQuestion(next.question);
    expect(metadata.learningGoalIds).toContain('control-correction');
    expect(metadata.review.state).toBe('reviewed');
    expect(metadata.purpose).not.toBe('readiness-gate');
  });

  it('returns the completed companion result without duplicating governed writes after a lost response', async () => {
    const db = createMockDb();
    const question = PRESET_QUESTIONS[0];
    const correctOptionText = question.options.find((option) => option.isCorrect)?.text;
    expect(correctOptionText).toBeTruthy();
    const continuity = {
      origin: 'konling-companion-practice',
      snapshotId: 'continuity:before-result',
      targetKnowledgeId: 'root-locus',
      structuredCauseId: null,
    } as const;
    let existingAnswer: Record<string, unknown> | null = null;
    db.adaptiveAssessmentSession.upsert.mockResolvedValue({
      id: 'durable-session-1',
      userId: 'student-1',
      sessionKey: 'konling-continuity:continuity:before-result',
      selectedQuestionIds: [question.id],
      metadata: continuity,
    });
    db.adaptiveAssessmentAnswer.findUnique.mockImplementation(async () => existingAnswer);
    db.adaptiveAssessmentAnswer.findMany
      .mockResolvedValueOnce([])
      .mockImplementation(async () => existingAnswer ? [{
        ...existingAnswer,
        session: { sessionKey: 'konling-continuity:continuity:before-result' },
        questionRef: {
          difficulty: question.difficulty,
          questionType: question.type,
          domains: question.domains,
          knowledgeTags: question.knowledgeTags,
        },
      }] : []);
    db.adaptiveAssessmentAnswer.upsert.mockImplementation(async (args: { create?: Record<string, unknown> }) => {
      if (!existingAnswer) existingAnswer = { id: 'answer-existing', ...(args.create ?? {}) };
      return existingAnswer;
    });
    const params = {
      userId: 'student-1',
      sessionId: 'konling-continuity:continuity:before-result',
      questionId: question.id,
      selectedOption: correctOptionText!,
      timeSpent: 42,
      continuity,
    };

    const first = await submitAnswerDurably(params, db);
    const abilityWriteCount = db.adaptiveAssessmentAbilityEstimate.create.mock.calls.length;
    const masteryWriteCount = db.adaptiveMasteryUpdate.createMany.mock.calls.length;
    const factWriteCount = db.learningFact.createMany.mock.calls.length;

    const retried = await submitAnswerDurably(params, db);

    expect(retried).toEqual(first);
    expect(db.adaptiveAssessmentAbilityEstimate.create).toHaveBeenCalledTimes(abilityWriteCount);
    expect(db.adaptiveMasteryUpdate.createMany).toHaveBeenCalledTimes(masteryWriteCount);
    expect(db.learningFact.createMany).toHaveBeenCalledTimes(factWriteCount);
  });

  it('returns the same selected question when companion selection is retried', async () => {
    const db = createMockDb();
    const continuity = {
      origin: 'konling-companion-practice',
      snapshotId: 'continuity:retry',
      targetKnowledgeId: 'control-correction',
      structuredCauseId: null,
    } as const;
    db.adaptiveAssessmentAnswer.findMany.mockResolvedValue([]);
    db.adaptiveAssessmentSession.upsert.mockResolvedValueOnce({
      id: 'durable-session-1',
      selectedQuestionIds: [],
      metadata: continuity,
    });
    db.adaptiveAssessmentSession.updateMany.mockResolvedValueOnce({ count: 1 });

    const first = await selectNextQuestionDurably({
      userId: 'student-next',
      sessionId: 'konling-continuity:continuity:retry',
      goalId: continuity.targetKnowledgeId,
      questionScope: 'practice',
      continuity,
    }, db);
    db.adaptiveAssessmentSession.upsert.mockResolvedValueOnce({
      id: 'durable-session-1',
      selectedQuestionIds: [first.question.id],
      metadata: continuity,
    });

    const retried = await selectNextQuestionDurably({
      userId: 'student-next',
      sessionId: 'konling-continuity:continuity:retry',
      goalId: continuity.targetKnowledgeId,
      questionScope: 'practice',
      continuity,
    }, db);

    expect(retried.question.id).toBe(first.question.id);
    expect(db.adaptiveAssessmentSession.updateMany).toHaveBeenCalledTimes(1);
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

    const next = await selectNextQuestionDurably({
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

    const next = await selectNextQuestionDurably({
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

    await expect(selectNextQuestionDurably({
      userId: 'student-next',
      sessionId: 'session-next',
      goalId: 'unknown-goal',
      questionScope: 'readiness',
    }, db)).rejects.toThrow('学习目标 unknown-goal 的 readiness 已审核路径题目覆盖不足');
  });

  it('selects catalog-backed reviewed path items for every currently complete learning goal readiness/checkpoint stage', async () => {
    const matrix = readCoverageMatrix();
    const targets = matrix.rows.flatMap((row) =>
      row.stageCoverage
        .filter((stage) =>
          row.assessmentCoverageState === 'complete' &&
          stage.status === 'complete' &&
          stage.reviewedPathEligibleCount > 0 &&
          (stage.stage === 'readiness' || stage.stage === 'checkpoint' || stage.stage === 'remediation')
        )
        .map((stage) => ({
          learningGoalId: row.learningGoalId,
          scope: stage.stage as 'readiness' | 'checkpoint' | 'remediation',
        }))
    );
    expect(targets.length).toBeGreaterThan(0);

    for (const target of targets) {
      const db = createMockDb();
      db.adaptiveAssessmentAnswer.findMany.mockResolvedValue([]);
      db.adaptiveAssessmentSession.upsert.mockResolvedValue({
        id: `durable-session-${target.learningGoalId}-${target.scope}`,
        userId: 'student-1',
        sessionKey: `session-${target.learningGoalId}-${target.scope}`,
        selectedQuestionIds: [],
      });
      db.adaptiveAssessmentSession.updateMany.mockResolvedValueOnce({ count: 1 });

      const next = await selectNextQuestionDurably({
        userId: 'student-next',
        sessionId: `session-${target.learningGoalId}-${target.scope}`,
        goalId: target.learningGoalId,
        questionScope: target.scope,
      }, db);

      const metadata = metadataForPublicQuestion(next.question);
      expectCatalogPathQuestion(next.question, target.learningGoalId, target.scope);
      expect(metadata.learningGoalIds).toContain(target.learningGoalId);
      expect(metadata.review.state).toBe('reviewed');
      if (target.scope === 'readiness') {
        expect(['readiness-gate', 'precheck', 'readiness']).toContain(metadata.purpose);
      }
      if (target.scope === 'checkpoint') {
        expect(metadata.purpose).toBe('checkpoint');
      }
    }
  });

  it('reissues a selected path readiness question before the answer is submitted', async () => {
    const db = createMockDb();
    db.adaptiveAssessmentAnswer.findMany.mockResolvedValue([]);
    const controlCorrectionReadinessQuestionIds = readCatalogQuestionIds({
      learningGoalId: 'control-correction',
      stage: 'readiness',
    });
    db.adaptiveAssessmentSession.upsert.mockResolvedValue({
      id: 'durable-session-1',
      userId: 'student-1',
      sessionKey: 'session-1',
      selectedQuestionIds: controlCorrectionReadinessQuestionIds,
    });
    db.adaptiveAssessmentSession.updateMany.mockResolvedValueOnce({ count: 1 });

    const next = await selectNextQuestionDurably({
      userId: 'student-next',
      sessionId: 'session-next',
      goalId: 'control-correction',
      questionScope: 'readiness',
    }, db);

    expectCatalogPathQuestion(next.question, 'control-correction', 'readiness');
  });

  it('reissues scoped readiness questions when answered path readiness questions are exhausted', async () => {
    const db = createMockDb();
    const controlCorrectionReadinessQuestionIds = readCatalogQuestionIds({
      learningGoalId: 'control-correction',
      stage: 'readiness',
    });
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

    const next = await selectNextQuestionDurably({
      userId: 'student-next',
      sessionId: 'session-next',
      goalId: 'control-correction',
      questionScope: 'readiness',
    }, db);

    expectCatalogPathQuestion(next.question, 'control-correction', 'readiness');
  });

  it('selects reviewed checkpoint questions for path checkpoint scope', async () => {
    const db = createMockDb();
    db.adaptiveAssessmentAnswer.findMany.mockResolvedValue([]);

    const next = await selectNextQuestionDurably({
      userId: 'student-next',
      sessionId: 'session-next',
      goalId: 'control-correction',
      questionScope: 'checkpoint',
    }, db);

    expectCatalogPathQuestion(next.question, 'control-correction', 'checkpoint');
  });

  it('selects reviewed authored checkpoint questions after legacy preset checkpoint coverage is exhausted', async () => {
    const db = createMockDb();
    const presetControlCheckpointQuestionIds = PRESET_QUESTIONS
      .filter((question) => {
        const metadata = buildKaqQuizQuestionMetadata(question);
        return metadata.learningGoalIds.includes('control-correction') &&
          metadata.purpose === 'checkpoint' &&
          metadata.review.state === 'reviewed';
      })
      .map((question) => question.id);
    const authoredCheckpoint = REVIEWED_LEARNING_GOAL_CHECKPOINT_QUESTIONS.find((question) =>
      question.learningGoalId === 'control-correction' &&
      question.stagePurpose === 'checkpoint'
    );
    expect(authoredCheckpoint).toBeDefined();
    db.adaptiveAssessmentAnswer.findMany.mockResolvedValue(presetControlCheckpointQuestionIds.map((questionId) => ({
      id: `answer-${questionId}`,
      userId: 'student-next',
      session: { sessionKey: 'session-next' },
      questionId,
      selectedOptionKey: 'A',
      isCorrect: true,
      responseTimeSeconds: 42,
      answeredAt: new Date('2026-05-26T02:30:00.000Z'),
      questionRef: {
        difficulty: 0.5,
        questionType: 'multi-criteria',
        domains: ['complex', 'time'],
        knowledgeTags: ['control-correction'],
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
      sessionKey: 'session-next',
      selectedQuestionIds: presetControlCheckpointQuestionIds,
    });
    db.adaptiveAssessmentSession.updateMany.mockResolvedValueOnce({ count: 1 });

    const next = await selectNextQuestionDurably({
      userId: 'student-next',
      sessionId: 'session-next',
      goalId: 'control-correction',
      questionScope: 'checkpoint',
    }, db);

    const authoredCheckpointIds = REVIEWED_LEARNING_GOAL_CHECKPOINT_QUESTIONS
      .filter((question) => question.learningGoalId === 'control-correction' && question.stagePurpose === 'checkpoint')
      .map((question) => checkpointAuthoredQuestionRuntimeId(question.id));
    expect(authoredCheckpointIds).toContain(next.question.id);
    const selectedSourceId = sourceIdFromCheckpointAuthoredQuestionRuntimeId(next.question.id);
    const selectedAuthoredCheckpoint = REVIEWED_LEARNING_GOAL_CHECKPOINT_QUESTIONS
      .find((question) => question.id === selectedSourceId);
    expect(selectedAuthoredCheckpoint).toBeDefined();
    const metadata = metadataForPublicQuestion(next.question);
    expect(metadata.learningGoalIds).toEqual(['control-correction']);
    expect(metadata.purpose).toBe('checkpoint');
    expect(metadata.review).toMatchObject({
      state: 'reviewed',
      reviewerId: selectedAuthoredCheckpoint!.reviewerId,
      reviewBatchId: selectedAuthoredCheckpoint!.reviewBatchId,
    });
  });

  it('does not allow companion practice to use the in-memory fallback', async () => {
    const db = createMockDb();
    const question = PRESET_QUESTIONS[0];
    const selectedOption = question.options[0]?.text;
    expect(selectedOption).toBeTruthy();
    const continuity = {
      origin: 'konling-companion-practice',
      snapshotId: 'continuity:persistence-required',
      targetKnowledgeId: 'control-correction',
      structuredCauseId: null,
    } as const;
    const disabled = { ADAPTIVE_ASSESSMENT_PERSISTENCE_ENABLED: 'false' };

    await expect(selectNextQuestionDurably({
      userId: 'student-1',
      sessionId: 'konling-continuity:continuity:persistence-required',
      goalId: continuity.targetKnowledgeId,
      continuity,
    }, db, disabled)).rejects.toThrow(RETIRED_ADAPTIVE_ASSESSMENT_PERSISTENCE_FALLBACK);

    await expect(submitAnswerDurably({
      userId: 'student-1',
      sessionId: 'konling-continuity:continuity:persistence-required',
      questionId: question.id,
      selectedOption: selectedOption!,
      timeSpent: 0,
      continuity,
    }, db, disabled)).rejects.toThrow(RETIRED_ADAPTIVE_ASSESSMENT_PERSISTENCE_FALLBACK);
  });

  it('does not repeat authored checkpoint runtime ids while unanswered alternatives remain', async () => {
    const db = createMockDb();
    const firstAuthoredCheckpoint = REVIEWED_LEARNING_GOAL_CHECKPOINT_QUESTIONS.find((question) =>
      question.learningGoalId === 'control-correction' &&
      question.stagePurpose === 'checkpoint'
    );
    expect(firstAuthoredCheckpoint).toBeDefined();
    const firstRuntimeId = checkpointAuthoredQuestionRuntimeId(firstAuthoredCheckpoint!.id);
    db.adaptiveAssessmentAnswer.findMany.mockResolvedValue([]);
    db.adaptiveAssessmentSession.upsert.mockResolvedValue({
      id: 'durable-session-1',
      userId: 'student-1',
      sessionKey: 'session-next',
      selectedQuestionIds: [firstRuntimeId],
    });
    db.adaptiveAssessmentSession.updateMany.mockResolvedValueOnce({ count: 1 });

    const next = await selectNextQuestionDurably({
      userId: 'student-next',
      sessionId: 'session-next',
      goalId: 'control-correction',
      questionScope: 'checkpoint',
    }, db);

    expect(next.question.id).not.toBe(firstRuntimeId);
    expectCatalogPathQuestion(next.question, 'control-correction', 'checkpoint');
  });

  it('does not repeat answered authored checkpoint runtime ids while unanswered alternatives remain', async () => {
    const db = createMockDb();
    const firstAuthoredCheckpoint = REVIEWED_LEARNING_GOAL_CHECKPOINT_QUESTIONS.find((question) =>
      question.learningGoalId === 'control-correction' &&
      question.stagePurpose === 'checkpoint'
    );
    expect(firstAuthoredCheckpoint).toBeDefined();
    const firstRuntimeId = checkpointAuthoredQuestionRuntimeId(firstAuthoredCheckpoint!.id);
    db.adaptiveAssessmentAnswer.findMany.mockResolvedValue([{
      id: `answer-${firstRuntimeId}`,
      userId: 'student-next',
      session: { sessionKey: 'session-next' },
      questionId: firstRuntimeId,
      selectedOptionKey: 'A',
      isCorrect: true,
      responseTimeSeconds: 42,
      answeredAt: new Date('2026-05-26T02:30:00.000Z'),
      questionRef: {
        difficulty: 0.5,
        questionType: 'multi-criteria',
        domains: ['complex', 'time'],
        knowledgeTags: ['control-correction'],
        metadata: {
          adaptiveAssessmentItemRef: {
            catalogBacked: true,
            catalogItemId: `adaptive-assessment-item:checkpoint-authored-question:${firstAuthoredCheckpoint!.id}`,
          },
          kaq: {
            review: { state: 'reviewed' },
          },
        },
      },
    }]);
    db.adaptiveAssessmentSession.upsert.mockResolvedValue({
      id: 'durable-session-1',
      userId: 'student-1',
      sessionKey: 'session-next',
      selectedQuestionIds: [firstRuntimeId],
    });
    db.adaptiveAssessmentSession.updateMany.mockResolvedValueOnce({ count: 1 });

    const next = await selectNextQuestionDurably({
      userId: 'student-next',
      sessionId: 'session-next',
      goalId: 'control-correction',
      questionScope: 'checkpoint',
    }, db);

    expect(next.question.id).not.toBe(firstRuntimeId);
    expectCatalogPathQuestion(next.question, 'control-correction', 'checkpoint');
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

    const next = await selectNextQuestionDurably({
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

    const diagnostic = await getDiagnosticDurably('student-generated', db);

    expect(diagnostic.knowledgeDimensions).toMatchObject({
      computational: 55,
      crossDomain: 100,
      design: 100,
    });
  });

  it('wraps durable writes in one transaction and rejects late materialization failures', async () => {
    const db = createMockDb();
    db.learningFact.createMany.mockRejectedValue(new Error('learning fact unavailable'));

    const question = approvedReadinessQuestion();
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
