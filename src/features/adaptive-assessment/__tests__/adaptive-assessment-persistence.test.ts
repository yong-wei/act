import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { generateQuestion, getAdaptiveQuestionById } from '../../assessment/adaptive-engine';
import { PRESET_QUESTIONS } from '../../assessment/adaptive-question-bank';
import { submitAnswerDurably } from '../../assessment/adaptive-persistence';
import { buildKaqQuizQuestionMetadata } from '../kaq-quiz-foundation';
import {
  checkpointAuthoredQuestionRuntimeId,
  REVIEWED_LEARNING_GOAL_CHECKPOINT_QUESTIONS,
} from '../learning-goal-checkpoint-question-sets';

function readReviewedItem(questionId: string) {
  return readFileSync('course-content/runtime/resource-governance/kaq-quiz-foundation-reviewed-items.jsonl', 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as { questionId: string; metadata: { immutableContentHash: string } })
    .find((item) => item.questionId === questionId);
}

function legacyQuestionMetadataContentHash(question: typeof PRESET_QUESTIONS[number]): string {
  const snapshot = {
    source: question.id.startsWith('generated-q-') ? 'generated' : 'preset',
    questionType: question.type,
    domains: [...question.domains].sort(),
    knowledgeTags: [...question.knowledgeTags].sort(),
    difficulty: Number(question.difficulty.toFixed(6)),
    optionCount: question.options.length,
    kaq: buildKaqQuizQuestionMetadata(question).immutableContentHash,
  };

  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

function createMockDb(): any {
  const answeredAt = new Date('2026-06-24T08:00:00.000Z');
  const sessionState = {
    id: 'durable-session-quiz-1',
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
      upsert: vi.fn().mockResolvedValue(sessionState),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    adaptiveAssessmentItemRef: {
      upsert: vi.fn().mockResolvedValue({ id: 'question-ref-quiz-1' }),
    },
    adaptiveAssessmentAnswer: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockImplementation(async (args: { create?: Record<string, unknown> }) => ({
        id: 'answer-quiz-1',
        userId: 'student-quiz',
        questionId: 'preset-q-01',
        isCorrect: true,
        score: 100,
        responseTimeSeconds: 32,
        abilityEstimate: 1.4,
        algorithmVersion: 'adaptive-assessment-bkt-v1',
        answeredAt,
        ...(args.create ?? {}),
      })),
      findMany: vi.fn().mockResolvedValue([]),
    },
    adaptiveAssessmentAbilityEstimate: {
      create: vi.fn().mockResolvedValue({ id: 'ability-quiz-1' }),
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
    $transaction: vi.fn(async <T>(callback: (tx: typeof db) => Promise<T>) => callback(db)),
  };
}

describe('K/A/Q adaptive assessment persistence', () => {
  it('persists immutable K/A/Q question metadata and governed outcome refs without raw answer bodies', async () => {
    const db = createMockDb();
    const question = PRESET_QUESTIONS[0];
    const correctOptionText = question.options.find((option) => option.isCorrect)?.text;
    expect(correctOptionText).toBeTruthy();

    await submitAnswerDurably({
      userId: 'student-quiz',
      sessionId: 'session-quiz',
      questionId: question.id,
      selectedOption: correctOptionText!,
      timeSpent: 32,
      pathContext: {
        pathId: 'path-quiz-1',
        nodeId: 'adaptive-quiz:control-correction:precheck',
        goalId: 'control-correction',
        routeIntent: 'path-execution',
        questionScope: 'readiness',
      },
    }, db);

    const itemRefCreate = db.adaptiveAssessmentItemRef.upsert.mock.calls[0][0].create;
    const itemRefUpdate = db.adaptiveAssessmentItemRef.upsert.mock.calls[0][0].update;
    const itemRefWhere = db.adaptiveAssessmentItemRef.upsert.mock.calls[0][0].where.questionId_algorithmVersion_contentHash;
    expect(itemRefWhere.contentHash).not.toBe(legacyQuestionMetadataContentHash(question));
    expect(itemRefCreate.contentHash).toBe(itemRefWhere.contentHash);
    expect(itemRefCreate.metadata).toMatchObject({
      kaq: expect.objectContaining({
        learningGoalIds: expect.arrayContaining(['control-correction']),
        knowledgeNodeIds: expect.any(Array),
        capabilityTargetIds: expect.any(Array),
        qualityTargetIds: expect.any(Array),
        outcomeRefs: expect.arrayContaining([
          expect.stringMatching(/^quiz-outcome:/),
        ]),
        remediationResourceNodeIds: expect.any(Array),
        review: expect.objectContaining({
          state: 'reviewed',
          reviewBatchId: 'kaq-quiz-foundation-bank.v1',
        }),
        versionRefs: expect.objectContaining({
          questionBankVersion: 'kaq-quiz-foundation-bank.v1',
        }),
      }),
      adaptiveAssessmentItemRef: expect.objectContaining({
        catalogBacked: true,
        catalogItemId: `adaptive-assessment-item:preset-adaptive-question:${question.id}`,
        sourceFamily: 'preset-adaptive-question',
        sourceId: question.id,
        contentHash: expect.any(String),
        reviewState: 'path-eligible',
        eligibilityState: 'path-eligible',
        semanticRefs: expect.objectContaining({
          learningGoalIds: expect.arrayContaining(['control-correction']),
        }),
        reviewDecision: expect.objectContaining({
          decisionKind: 'human-review',
          outcome: 'approved',
          selectedLearningGoalIds: expect.arrayContaining(['control-correction']),
        }),
        relationship: expect.objectContaining({
          relationship: 'answer-time-snapshot',
          immutable: true,
          catalogUpdatesRewriteHistoricalAnswers: false,
        }),
      }),
    });
    expect(itemRefCreate.metadata.kaq.immutableContentHash).toBe(
      readReviewedItem(question.id)?.metadata.immutableContentHash,
    );
    expect(itemRefUpdate.metadata).toMatchObject({
      adaptiveAssessmentItemRef: expect.objectContaining({
        catalogBacked: true,
        catalogItemId: `adaptive-assessment-item:preset-adaptive-question:${question.id}`,
        reviewDecision: expect.objectContaining({
          decisionKind: 'human-review',
          outcome: 'approved',
        }),
        versionRefs: expect.objectContaining({
          adaptiveAssessmentSnapshotVersion: expect.any(String),
        }),
      }),
    });

    const factPayload = db.learningFact.createMany.mock.calls[0][0].data[0].contextJson.adaptiveAssessment.kaqQuizEvidence;
    const adaptiveAssessmentRef = db.learningFact.createMany.mock.calls[0][0].data[0].contextJson.adaptiveAssessment.adaptiveAssessmentRef;
    expect(adaptiveAssessmentRef).toMatchObject({
      kind: 'AdaptiveAssessmentAnswer',
      provenance: 'official',
      answerId: 'answer-quiz-1',
      questionId: question.id,
      catalogItemId: `adaptive-assessment-item:preset-adaptive-question:${question.id}`,
      reviewState: 'reviewed',
      eligibilityState: 'path-eligible',
      readinessGateEligible: true,
      pathCompletionEligible: true,
      evidenceAuthority: 'path-assessment',
    });
    expect(factPayload).toMatchObject({
      questionSnapshotId: expect.stringMatching(/^question-snapshot:/),
      quizSetId: expect.stringMatching(/^kaq-quiz-set:/),
      attemptKey: 'session-quiz:preset-q-01',
      scoringVersion: 'adaptive-assessment-bkt-v1',
      denominator: 1,
      retryPolicy: expect.objectContaining({
        maxAttemptsAffectingMastery: 1,
      }),
      eventSource: 'adaptive_assessment',
      eventType: 'answer_submit',
      sourceLogId: 'adaptive-assessment:answer-quiz-1',
      dedupeKey: 'adaptive-assessment:session-quiz:preset-q-01',
      learningFactEligible: true,
      readinessGateEligible: true,
      terminalValidationEligible: true,
      studentCompetencySnapshotEffect: 'update',
      confidence: expect.objectContaining({
        level: 'high',
      }),
      remediationResourceNodeIds: expect.any(Array),
    });
    expect(JSON.stringify(factPayload)).not.toContain(question.stem);
    expect(JSON.stringify(factPayload)).not.toContain(correctOptionText!);
  });

  it('does not promote catalog-backed answers without verified path context', async () => {
    const db = createMockDb();
    const question = PRESET_QUESTIONS[0];
    const correctOptionText = question.options.find((option) => option.isCorrect)?.text;
    expect(correctOptionText).toBeTruthy();

    const result = await submitAnswerDurably({
      userId: 'student-quiz',
      sessionId: 'session-quiz',
      questionId: question.id,
      selectedOption: correctOptionText!,
      timeSpent: 32,
    }, db);

    expect(result.adaptiveAssessmentRef).toMatchObject({
      kind: 'AdaptiveAssessmentAnswer',
      reviewState: 'reviewed',
      catalogItemId: `adaptive-assessment-item:preset-adaptive-question:${question.id}`,
      readinessGateEligible: false,
      terminalValidationEligible: false,
      pathCompletionEligible: false,
      evidenceAuthority: 'legacy-compatible',
    });
  });

  it('does not promote catalog-backed answers when the server path scope does not match the item snapshot', async () => {
    const db = createMockDb();
    const question = PRESET_QUESTIONS[0];
    const correctOptionText = question.options.find((option) => option.isCorrect)?.text;
    expect(correctOptionText).toBeTruthy();

    const result = await submitAnswerDurably({
      userId: 'student-quiz',
      sessionId: 'session-quiz',
      questionId: question.id,
      selectedOption: correctOptionText!,
      timeSpent: 32,
      pathContext: {
        pathId: 'path-quiz-1',
        nodeId: 'checkpoint:control-correction-review',
        goalId: 'control-correction',
        routeIntent: 'path-execution',
        questionScope: 'checkpoint',
      },
    }, db);

    expect(result.adaptiveAssessmentRef).toMatchObject({
      kind: 'AdaptiveAssessmentAnswer',
      reviewState: 'reviewed',
      catalogItemId: `adaptive-assessment-item:preset-adaptive-question:${question.id}`,
      readinessGateEligible: false,
      terminalValidationEligible: false,
      pathCompletionEligible: false,
      evidenceAuthority: 'legacy-compatible',
    });
  });

  it('treats catalog-backed checkpoint answers as path-completion eligible', async () => {
    const db = createMockDb();
    const authoredCheckpoint = REVIEWED_LEARNING_GOAL_CHECKPOINT_QUESTIONS.find((candidate) =>
      candidate.learningGoalId === 'control-correction' &&
      candidate.stagePurpose === 'checkpoint'
    );
    expect(authoredCheckpoint).toBeTruthy();
    const runtimeQuestionId = checkpointAuthoredQuestionRuntimeId(authoredCheckpoint!.id);
    const question = getAdaptiveQuestionById(runtimeQuestionId);
    expect(question).toBeTruthy();
    const correctOptionText = question!.options.find((option) => option.isCorrect)?.text;
    expect(correctOptionText).toBeTruthy();

    const result = await submitAnswerDurably({
      userId: 'student-quiz',
      sessionId: 'session-quiz',
      questionId: runtimeQuestionId,
      selectedOption: correctOptionText!,
      timeSpent: 32,
      pathContext: {
        pathId: 'path-quiz-1',
        nodeId: 'checkpoint:control-correction-review',
        goalId: 'control-correction',
        routeIntent: 'path-execution',
        questionScope: 'checkpoint',
      },
    }, db);

    expect(result.adaptiveAssessmentRef).toMatchObject({
      kind: 'AdaptiveAssessmentAnswer',
      reviewState: 'reviewed',
      catalogItemId: `adaptive-assessment-item:checkpoint-authored-question:${authoredCheckpoint!.id}`,
      readinessGateEligible: false,
      terminalValidationEligible: false,
      pathCompletionEligible: true,
      evidenceAuthority: 'path-assessment',
    });
  });

  it('treats catalog-backed remediation answers as path-completion eligible', async () => {
    const db = createMockDb();
    const authoredRemediation = REVIEWED_LEARNING_GOAL_CHECKPOINT_QUESTIONS.find((candidate) =>
      candidate.learningGoalId === 'control-correction' &&
      candidate.stagePurpose === 'remediation'
    );
    expect(authoredRemediation).toBeTruthy();
    const runtimeQuestionId = checkpointAuthoredQuestionRuntimeId(authoredRemediation!.id);
    const question = getAdaptiveQuestionById(runtimeQuestionId);
    expect(question).toBeTruthy();
    const correctOptionText = question!.options.find((option) => option.isCorrect)?.text;
    expect(correctOptionText).toBeTruthy();

    const result = await submitAnswerDurably({
      userId: 'student-quiz',
      sessionId: 'session-quiz',
      questionId: runtimeQuestionId,
      selectedOption: correctOptionText!,
      timeSpent: 32,
      pathContext: {
        pathId: 'path-quiz-1',
        nodeId: 'remediation:control-correction-review',
        goalId: 'control-correction',
        routeIntent: 'path-execution',
        questionScope: 'remediation',
      },
    }, db);

    expect(result.adaptiveAssessmentRef).toMatchObject({
      kind: 'AdaptiveAssessmentAnswer',
      reviewState: 'reviewed',
      catalogItemId: `adaptive-assessment-item:checkpoint-authored-question:${authoredRemediation!.id}`,
      readinessGateEligible: false,
      terminalValidationEligible: false,
      pathCompletionEligible: true,
      evidenceAuthority: 'path-assessment',
    });
    const factPayload = db.learningFact.createMany.mock.calls[0][0].data[0].contextJson.adaptiveAssessment.kaqQuizEvidence;
    expect(factPayload).toMatchObject({
      quizSetId: expect.stringContaining(':remediation'),
      outcomeRefs: expect.arrayContaining([
        expect.stringContaining(':remediation:'),
      ]),
    });
  });

  it('excludes historical provisional answers from reviewed mastery rebuilds', async () => {
    const db = createMockDb();
    const question = PRESET_QUESTIONS[0];
    const correctOptionText = question.options.find((option) => option.isCorrect)?.text;
    expect(correctOptionText).toBeTruthy();
    db.adaptiveAssessmentAnswer.findMany.mockResolvedValue([{
      id: 'answer-generated-history',
      userId: 'student-quiz',
      questionId: 'generated-q-history',
      selectedOptionKey: 'A',
      isCorrect: true,
      responseTimeSeconds: 28,
      answeredAt: new Date('2026-06-24T07:30:00.000Z'),
      session: {
        sessionKey: 'session-generated-history',
      },
      questionRef: {
        difficulty: 0.7,
        questionType: 'multi-criteria',
        domains: ['complex', 'frequency'],
        knowledgeTags: question.knowledgeTags,
        metadata: {
          kaq: {
            learningFactEligible: false,
            review: { state: 'provisional' },
          },
        },
      },
    }]);

    await submitAnswerDurably({
      userId: 'student-quiz',
      sessionId: 'session-quiz',
      questionId: question.id,
      selectedOption: correctOptionText!,
      timeSpent: 32,
      pathContext: {
        pathId: 'path-quiz-1',
        nodeId: 'adaptive-quiz:control-correction:precheck',
        goalId: 'control-correction',
        routeIntent: 'path-execution',
        questionScope: 'readiness',
      },
    }, db);

    expect(db.adaptiveAssessmentAnswer.findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({
        questionRef: expect.objectContaining({
          select: expect.objectContaining({
            metadata: true,
          }),
        }),
      }),
    }));
    const masteryRows = db.adaptiveMasteryUpdate.createMany.mock.calls[0][0].data;
    expect(masteryRows.length).toBeGreaterThan(0);
    expect(masteryRows.every((row: { answerId: string; priorMastery: number }) => (
      row.answerId === 'answer-quiz-1' && row.priorMastery === 0.35
    ))).toBe(true);
  });

  it('keeps legacy preset answers in reviewed mastery rebuild history', async () => {
    const db = createMockDb();
    const question = PRESET_QUESTIONS[0];
    const correctOptionText = question.options.find((option) => option.isCorrect)?.text;
    expect(correctOptionText).toBeTruthy();
    db.adaptiveAssessmentAnswer.findMany.mockResolvedValue([{
      id: 'answer-legacy-preset',
      userId: 'student-quiz',
      questionId: 'preset-q-legacy',
      selectedOptionKey: 'A',
      isCorrect: true,
      responseTimeSeconds: 28,
      answeredAt: new Date('2026-06-24T07:30:00.000Z'),
      session: {
        sessionKey: 'session-legacy-preset',
      },
      questionRef: {
        difficulty: 0.5,
        questionType: 'pole-to-behavior',
        domains: ['complex', 'time'],
        knowledgeTags: question.knowledgeTags,
        metadata: {},
      },
    }]);

    await submitAnswerDurably({
      userId: 'student-quiz',
      sessionId: 'session-quiz',
      questionId: question.id,
      selectedOption: correctOptionText!,
      timeSpent: 32,
      pathContext: {
        pathId: 'path-quiz-1',
        nodeId: 'adaptive-quiz:control-correction:precheck',
        goalId: 'control-correction',
        routeIntent: 'path-execution',
        questionScope: 'readiness',
      },
    }, db);

    const masteryRows = db.adaptiveMasteryUpdate.createMany.mock.calls[0][0].data;
    expect(masteryRows.length).toBeGreaterThan(0);
    expect(masteryRows.every((row: { answerId: string; priorMastery: number }) => (
      row.answerId === 'answer-quiz-1' && row.priorMastery > 0.35
    ))).toBe(true);
  });

  it('keeps generated provisional questions out of mastery updates and LearningFact materialization', async () => {
    const db = createMockDb();
    const generated = generateQuestion({
      targetKnowledgeTags: ['controller-tuning', 'robustness'],
      difficultyTarget: 0.7,
      domains: ['complex', 'frequency'],
      ownerUserId: 'student-generated',
      sessionId: 'session-generated',
    });
    const selectedOption = generated.options.find((option) => option.text === '先识别主导约束，再按跨域因果逐步调参')?.text
      ?? generated.options[0]?.text;
    expect(selectedOption).toBeTruthy();

    await submitAnswerDurably({
      userId: 'student-generated',
      sessionId: 'session-generated',
      questionId: generated.id,
      selectedOption: selectedOption!,
      timeSpent: 28,
      pathContext: {
        pathId: 'path-generated',
        nodeId: 'adaptive-quiz:generated-practice',
        goalId: 'control-correction',
        routeIntent: 'path-execution',
        questionScope: 'practice',
      },
    }, db);

    const itemRefCreate = db.adaptiveAssessmentItemRef.upsert.mock.calls[0][0].create;
    expect(itemRefCreate.metadata.kaq.review.state).toBe('provisional');
    expect(itemRefCreate.metadata.kaq.review.generationModel).toBe('rule-based-generator');
    expect(itemRefCreate.metadata.adaptiveAssessmentItemRef).toMatchObject({
      catalogBacked: false,
      reviewState: 'provisional',
      eligibilityState: 'generated-provisional',
      evidenceAuthority: 'low-stakes-practice-only',
    });
    expect(db.adaptiveMasteryUpdate.createMany).not.toHaveBeenCalled();
    expect(db.learningFact.createMany).not.toHaveBeenCalled();
  });

  it('rejects generated question submissions outside the owner session', async () => {
    const db = createMockDb();
    const generated = generateQuestion({
      targetKnowledgeTags: ['controller-tuning', 'robustness'],
      difficultyTarget: 0.7,
      domains: ['complex', 'frequency'],
      ownerUserId: 'student-generated',
      sessionId: 'session-generated',
    });

    await expect(submitAnswerDurably({
      userId: 'student-generated',
      sessionId: 'session-other',
      questionId: generated.id,
      selectedOption: '先识别主导约束，再按跨域因果逐步调参',
      timeSpent: 28,
    }, db)).rejects.toThrow('题目不存在');

    await expect(submitAnswerDurably({
      userId: 'student-other',
      sessionId: 'session-generated',
      questionId: generated.id,
      selectedOption: '先识别主导约束，再按跨域因果逐步调参',
      timeSpent: 28,
    }, db)).rejects.toThrow('题目不存在');
  });
});
