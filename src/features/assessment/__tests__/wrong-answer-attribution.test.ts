import { describe, expect, it, vi } from 'vitest';

import { resolveAdaptiveDiagnosisContext } from '../adaptive-diagnosis-context';
import { attributeWrongAnswerEvidence } from '../wrong-answer-attribution';

const RAW_PROMPT = 'RAW_PRIVATE_PROMPT';
const RAW_SELECTED_ANSWER = 'RAW_SELECTED_ANSWER';
const RAW_CORRECT_ANSWER = 'RAW_CORRECT_ANSWER';

function answer(overrides: Record<string, unknown> = {}) {
  const itemContentHash = 'a'.repeat(64);
  const catalogContentHash = 'c'.repeat(64);
  return {
    id: 'answer-1',
    userId: 'student-1',
    sessionId: 'session-1',
    questionRefId: 'item-ref-1',
    questionId: 'question-1',
    selectedOptionKey: RAW_SELECTED_ANSWER,
    correctOptionKey: RAW_CORRECT_ANSWER,
    isCorrect: false,
    answeredAt: new Date('2026-07-31T08:00:00.000Z'),
    session: {
      id: 'session-1',
      userId: 'student-1',
    },
    questionRef: {
      id: 'item-ref-1',
      questionId: 'question-1',
      contentHash: itemContentHash,
      metadata: {
        questionSnapshot: {
          version: 'adaptive-question-snapshot.v1',
          prompt: RAW_PROMPT,
          options: [
            { key: RAW_CORRECT_ANSWER, label: 'A', text: 'raw option A', explanation: 'raw explanation A' },
            { key: RAW_SELECTED_ANSWER, label: 'B', text: 'raw option B', explanation: 'raw explanation B' },
          ],
          correctOptionKey: RAW_CORRECT_ANSWER,
          explanation: 'raw overall explanation',
          knowledgeTags: ['steady-state-error'],
          misconceptionTags: ['confuses-low-and-high-frequency'],
          remediationResources: [],
        },
        adaptiveAssessmentItemRef: {
          catalogBacked: true,
          catalogItemId: 'catalog-item-1',
          snapshotVersion: 'adaptive-assessment-item-ref.v1',
          contentHash: catalogContentHash,
          reviewState: 'path-eligible',
          eligibilityState: 'path-eligible',
          semanticRefs: {
            graphNodeIds: ['knowledge-node-1'],
            misconceptionTags: ['confuses-low-and-high-frequency'],
          },
          relationship: {
            relationship: 'answer-time-snapshot',
            immutable: true,
            catalogUpdatesRewriteHistoricalAnswers: false,
          },
        },
      },
    },
    ...overrides,
  };
}

function persisted(overrides: Record<string, unknown> = {}) {
  return {
    id: 'attribution-1',
    answerId: 'answer-1',
    attributionVersion: 'wrong-answer-attribution.v1',
    userId: 'student-1',
    sessionId: 'session-1',
    questionRefId: 'item-ref-1',
    questionId: 'question-1',
    itemContentHash: 'a'.repeat(64),
    state: 'ATTRIBUTED',
    knowledgeNodeIds: ['knowledge-node-1'],
    misconceptionTags: ['confuses-low-and-high-frequency'],
    evidenceSummary: {
      version: 'wrong-answer-evidence-summary.v1',
      outcome: 'incorrect',
      answeredAt: '2026-07-31T08:00:00.000Z',
      knowledgeNodeCount: 1,
      misconceptionCandidateCount: 1,
    },
    evidenceRefs: [
      'adaptive-assessment-answer:answer-1',
      'adaptive-assessment-session:session-1',
      `adaptive-assessment-item:item-ref-1:${'a'.repeat(64)}`,
    ],
    confidence: 1,
    limitations: [],
    nextAction: 'NONE',
    createdAt: new Date('2026-07-31T08:01:00.000Z'),
    ...overrides,
  };
}

function dbFor(row: ReturnType<typeof answer> | null, stored = persisted()) {
  return {
    adaptiveAssessmentAnswer: {
      findFirst: vi.fn().mockResolvedValue(row),
      findMany: vi.fn().mockResolvedValue(row ? [row] : []),
    },
    wrongAnswerAttribution: {
      upsert: vi.fn().mockResolvedValue(stored),
    },
  };
}

describe('attributeWrongAnswerEvidence', () => {
  it('fails closed without writing when the answer is not owned by the authenticated student', async () => {
    const db = dbFor(null);

    await expect(attributeWrongAnswerEvidence({
      db,
      authenticatedUserId: 'student-1',
      answerId: 'answer-owned-by-another-student',
    })).resolves.toBeNull();

    expect(db.adaptiveAssessmentAnswer.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'answer-owned-by-another-student', userId: 'student-1' },
    }));
    expect(db.wrongAnswerAttribution.upsert).not.toHaveBeenCalled();
  });

  it.each([
    ['a correct answer', answer({ isCorrect: true })],
    ['a mismatched session owner', answer({ session: { id: 'session-1', userId: 'student-2' } })],
    ['an unavailable item version', answer({
      questionRef: {
        ...answer().questionRef,
        contentHash: 'invalid-content-hash',
      },
    })],
    ['a mismatched answer key', answer({ correctOptionKey: 'DIFFERENT_KEY' })],
  ])('fails closed without writing for %s', async (_label, row) => {
    const db = dbFor(row);

    await expect(attributeWrongAnswerEvidence({
      db,
      authenticatedUserId: 'student-1',
      answerId: 'answer-1',
    })).resolves.toBeNull();
    expect(db.wrongAnswerAttribution.upsert).not.toHaveBeenCalled();
  });

  it('persists and projects a deterministic governed attribution', async () => {
    const basePersisted = persisted();
    const db = dbFor(answer(), persisted({
      evidenceSummary: {
        ...(basePersisted.evidenceSummary as Record<string, unknown>),
        rawPrompt: RAW_PROMPT,
      },
    }));

    const result = await attributeWrongAnswerEvidence({
      db,
      authenticatedUserId: 'student-1',
      answerId: 'answer-1',
    });

    expect(db.wrongAnswerAttribution.upsert).toHaveBeenCalledWith({
      where: {
        answerId_attributionVersion: {
          answerId: 'answer-1',
          attributionVersion: 'wrong-answer-attribution.v1',
        },
      },
      update: {},
      create: expect.objectContaining({
        state: 'ATTRIBUTED',
        knowledgeNodeIds: ['knowledge-node-1'],
        misconceptionTags: ['confuses-low-and-high-frequency'],
        confidence: 1,
        limitations: [],
        nextAction: 'NONE',
      }),
    });
    expect(result).toMatchObject({
      state: 'ATTRIBUTED',
      attribution: {
        knowledgeNodeId: 'knowledge-node-1',
        misconceptionTag: 'confuses-low-and-high-frequency',
      },
      candidates: {
        knowledgeNodeIds: ['knowledge-node-1'],
        misconceptionTags: ['confuses-low-and-high-frequency'],
      },
      confidence: 1,
      attributionVersion: 'wrong-answer-attribution.v1',
    });

    const serializedWriteAndResult = JSON.stringify({
      write: db.wrongAnswerAttribution.upsert.mock.calls,
      result,
    });
    expect(serializedWriteAndResult).not.toContain(RAW_PROMPT);
    expect(serializedWriteAndResult).not.toContain(RAW_SELECTED_ANSWER);
    expect(serializedWriteAndResult).not.toContain(RAW_CORRECT_ANSWER);
    expect(serializedWriteAndResult).not.toContain('raw explanation');
  });

  it('projects ambiguous candidates as uncertain rather than factual attribution', async () => {
    const ambiguous = answer();
    const metadata = ambiguous.questionRef.metadata as any;
    metadata.adaptiveAssessmentItemRef.semanticRefs.graphNodeIds = ['knowledge-node-1', 'knowledge-node-2'];
    const stored = persisted({
      state: 'UNCERTAIN',
      knowledgeNodeIds: ['knowledge-node-1', 'knowledge-node-2'],
      confidence: 0.5,
      limitations: ['multiple-reviewed-attribution-candidates'],
      nextAction: 'MANUAL_REVIEW',
    });
    const db = dbFor(ambiguous, stored);

    const result = await attributeWrongAnswerEvidence({
      db,
      authenticatedUserId: 'student-1',
      answerId: 'answer-1',
    });

    expect(result).toMatchObject({
      state: 'UNCERTAIN',
      attribution: null,
      confidence: 0.5,
      limitations: ['multiple-reviewed-attribution-candidates'],
      nextAction: 'MANUAL_REVIEW',
    });
  });

  it('persists missing semantic evidence as uncertain and directs repeated practice', async () => {
    const incomplete = answer();
    const metadata = incomplete.questionRef.metadata as any;
    metadata.adaptiveAssessmentItemRef.semanticRefs.misconceptionTags = [];
    metadata.questionSnapshot.misconceptionTags = [];
    const stored = persisted({
      state: 'UNCERTAIN',
      misconceptionTags: [],
      confidence: 0,
      limitations: ['missing-reviewed-semantic-binding'],
      nextAction: 'REPEAT_PRACTICE',
    });
    const db = dbFor(incomplete, stored);

    const result = await attributeWrongAnswerEvidence({
      db,
      authenticatedUserId: 'student-1',
      answerId: 'answer-1',
    });

    expect(db.wrongAnswerAttribution.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        state: 'UNCERTAIN',
        confidence: 0,
        limitations: ['missing-reviewed-semantic-binding'],
        nextAction: 'REPEAT_PRACTICE',
      }),
    }));
    expect(result?.attribution).toBeNull();
  });

  it('uses an immutable upsert so repeated requests share one answer-version record', async () => {
    const db = dbFor(answer());
    const input = {
      db,
      authenticatedUserId: 'student-1',
      answerId: 'answer-1',
    };

    await attributeWrongAnswerEvidence(input);
    await attributeWrongAnswerEvidence(input);

    expect(db.wrongAnswerAttribution.upsert).toHaveBeenCalledTimes(2);
    expect(db.wrongAnswerAttribution.upsert.mock.calls[0][0].update).toEqual({});
    expect(db.wrongAnswerAttribution.upsert.mock.calls[1][0].update).toEqual({});
  });

  it('adds the governed attribution to the existing adaptive diagnosis context', async () => {
    const db = dbFor(answer());

    const context = await resolveAdaptiveDiagnosisContext({
      db,
      authenticatedUserId: 'student-1',
      answerId: 'answer-1',
    });

    expect(context?.adaptiveAttempt).toMatchObject({
      answerId: 'answer-1',
      isCorrect: false,
    });
    expect(context?.wrongAnswerAttribution).toMatchObject({
      state: 'ATTRIBUTED',
      attribution: {
        knowledgeNodeId: 'knowledge-node-1',
        misconceptionTag: 'confuses-low-and-high-frequency',
      },
    });
  });
});
