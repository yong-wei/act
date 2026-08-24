import { describe, expect, it, vi } from 'vitest';

import { assessmentItemSemanticReviewSourceHash } from '@/features/adaptive-assessment/adaptive-assessment-semantic-review';

import { resolveAdaptiveDiagnosisContext } from '../adaptive-diagnosis-context';
import { adaptiveAssessmentItemContentHash } from '../adaptive-assessment-item-content-hash';
import { microTutoringOptionAttributionReviewSourceHash } from '../micro-tutoring-option-attribution';
import { attributeWrongAnswerEvidence } from '../wrong-answer-attribution';

const RAW_PROMPT = 'RAW_PRIVATE_PROMPT';
const RAW_SELECTED_ANSWER = 'RAW_SELECTED_ANSWER';
const RAW_CORRECT_ANSWER = 'RAW_CORRECT_ANSWER';

function answer(overrides: Record<string, unknown> = {}) {
  const catalogContentHash = 'c'.repeat(64);
  const reviewDecisionWithoutHash = {
    catalogItemId: 'catalog-item-1',
    decisionKind: 'human-review' as const,
    outcome: 'approved' as const,
    reviewerId: 'reviewer:test',
    reviewedAt: '2026-07-31T07:00:00.000Z',
    reviewBatchId: 'wrong-answer-attribution-test.v1',
    sourceContentHash: catalogContentHash,
    selectedLearningGoalIds: ['stability-margin-frequency-analysis'],
    selectedKaqObjectiveIds: ['kaq-objective-1'],
    selectedGraphNodeIds: ['kn:autocontrol:stability-margin'],
    selectedStagePurpose: 'checkpoint' as const,
    difficulty: 0.5,
    cognitiveLevel: 'apply',
    misconceptionRefs: ['confuses-low-and-high-frequency'],
    remediationRefs: ['remediation-node-1'],
    metadataVersionRefs: { semanticReviewVersion: 'v1' },
    notes: 'Reviewed attribution boundary and evidence snapshot.',
  };
  const reviewDecision = {
    ...reviewDecisionWithoutHash,
    reviewSourceHash: assessmentItemSemanticReviewSourceHash(reviewDecisionWithoutHash),
  };
  const row = {
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
      contentHash: '',
      source: 'preset',
      questionType: 'multiple-choice',
      domains: ['frequency-domain'],
      knowledgeTags: ['steady-state-error'],
      difficulty: 0.5,
      optionCount: 2,
      metadata: {
        kaq: {
          immutableContentHash: 'kaq-content-hash-v1',
        },
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
          contentHashAlgorithm: 'sha256',
          sourceFamily: 'preset-adaptive-question',
          sourceId: 'question-1',
          sourceAnchor: 'test:question-1',
          sourceLineage: {
            sourceFamily: 'preset-adaptive-question',
            sourceId: 'question-1',
            sourcePath: 'test/questions.ts',
            sourceHash: catalogContentHash,
          },
          reviewState: 'path-eligible',
          eligibilityState: 'path-eligible',
          allowedStages: ['checkpoint'],
          questionRefs: {
            stem: RAW_PROMPT,
            answerKey: [RAW_CORRECT_ANSWER],
            rubricRef: 'rubric:test',
          },
          semanticRefs: {
            learningGoalIds: ['stability-margin-frequency-analysis'],
            kaqObjectiveIds: ['kaq-objective-1'],
            graphNodeIds: ['kn:autocontrol:stability-margin'],
            knowledgeTags: ['steady-state-error'],
            misconceptionTags: ['confuses-low-and-high-frequency'],
            remediationResourceNodeIds: ['remediation-node-1'],
            difficulty: 0.5,
            cognitiveLevel: 'apply',
            assessmentStage: 'checkpoint',
          },
          limitations: [],
          reviewDecision,
          versionRefs: { semanticReviewVersion: 'v1' },
          relationship: {
            relationship: 'answer-time-snapshot',
            immutable: true,
            mayReferenceCatalogItemId: true,
            mayReferenceContentHash: true,
            catalogUpdatesRewriteHistoricalAnswers: false,
          },
        },
      },
    },
  };
  rehashItemContent(row);
  return { ...row, ...overrides };
}

function rehashItemContent(row: any) {
  const metadata = row.questionRef.metadata;
  row.questionRef.contentHash = adaptiveAssessmentItemContentHash({
    source: row.questionRef.source,
    questionType: row.questionRef.questionType,
    domains: row.questionRef.domains,
    knowledgeTags: row.questionRef.knowledgeTags,
    difficulty: row.questionRef.difficulty,
    optionCount: row.questionRef.optionCount,
    kaqImmutableContentHash: metadata.kaq.immutableContentHash,
    adaptiveAssessmentItemRef: metadata.adaptiveAssessmentItemRef,
    questionSnapshot: metadata.questionSnapshot,
  });
}

function optionAttributionsFor(row: ReturnType<typeof answer>, overrides: Record<string, unknown> = {}) {
  const metadata = row.questionRef.metadata as any;
  const item = metadata.adaptiveAssessmentItemRef;
  const attribution = {
    catalogItemId: item.catalogItemId,
    contentHash: item.contentHash,
    optionKey: row.selectedOptionKey,
    learningGoalId: item.semanticRefs.learningGoalIds[0],
    misconceptionTag: item.semanticRefs.misconceptionTags[0],
    knowledgeNodeId: item.semanticRefs.graphNodeIds[0],
    version: 'micro-tutoring-option-attribution.v2',
    itemReviewSourceHash: item.reviewDecision.reviewSourceHash,
    reviewerId: 'assessment-content-reviewer:test',
    reviewerRole: 'assessment-content-reviewer',
    reviewedAt: '2026-08-20T00:00:00.000Z',
    reviewBatchId: 'micro-tutoring-option-attribution-review.test',
    evidenceSummary: 'Reviewed option attribution.',
    limitations: ['content-hash-bound'],
    ...overrides,
  };
  return [{
    ...attribution,
    reviewSourceHash: microTutoringOptionAttributionReviewSourceHash(attribution),
  }];
}

function setAssessmentStage(row: ReturnType<typeof answer>, input: {
  reviewStage: 'practice' | 'readiness-gate';
  allowedStage: 'low-stakes-practice' | 'readiness';
}) {
  const item = (row.questionRef.metadata as any).adaptiveAssessmentItemRef;
  item.reviewDecision.selectedStagePurpose = input.reviewStage;
  item.allowedStages = [input.allowedStage];
  item.semanticRefs.assessmentStage = input.allowedStage;
  rehashReviewDecision(item);
  rehashItemContent(row);
}

function reverseObjectKeyOrder(value: any): any {
  if (Array.isArray(value)) return value.map(reverseObjectKeyOrder);
  if (value === null || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, entryValue]) => [key, reverseObjectKeyOrder(entryValue)]),
  );
}

function persisted(overrides: Record<string, unknown> = {}) {
  return {
    id: 'attribution-1',
    answerId: 'answer-1',
    attributionVersion: 'wrong-answer-attribution.v2',
    userId: 'student-1',
    sessionId: 'session-1',
    questionRefId: 'item-ref-1',
    questionId: 'question-1',
    itemContentHash: 'a'.repeat(64),
    state: 'ATTRIBUTED',
    knowledgeNodeIds: ['kn:autocontrol:stability-margin'],
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

function rehashReviewDecision(item: any) {
  const { reviewSourceHash: _reviewSourceHash, ...decisionWithoutHash } = item.reviewDecision;
  item.reviewDecision = {
    ...decisionWithoutHash,
    reviewSourceHash: assessmentItemSemanticReviewSourceHash(decisionWithoutHash),
  };
}

function dbFor(
  row: ReturnType<typeof answer> | null,
  stored = persisted(),
  existingAttribution: ReturnType<typeof persisted> | null = null,
) {
  return {
    adaptiveAssessmentAnswer: {
      findFirst: vi.fn().mockResolvedValue(row),
      findMany: vi.fn().mockResolvedValue(row ? [row] : []),
    },
    wrongAnswerAttribution: {
      findFirst: vi.fn().mockResolvedValue(existingAttribution),
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

  it.each([
    ['a rejected review decision', (item: any) => { item.reviewDecision.outcome = 'rejected'; }],
    ['an invalid review source hash', (item: any) => { item.reviewDecision.reviewSourceHash = 'sha256:invalid'; }],
    ['a mismatched source lineage', (item: any) => { item.sourceLineage.sourceHash = 'b'.repeat(64); }],
    ['missing version references', (item: any) => { item.versionRefs = {}; }],
    ['an invalid snapshot relationship', (item: any) => { item.relationship.mayReferenceContentHash = false; }],
    ['a stage outside the allowed boundary', (item: any) => { item.allowedStages = ['readiness']; }],
    ['an unreviewed semantic binding', (item: any) => { item.semanticRefs.graphNodeIds.push('unreviewed-node'); }],
  ])('does not write or project attribution for %s', async (_label, damage) => {
    const row = answer();
    damage((row.questionRef.metadata as any).adaptiveAssessmentItemRef);
    rehashItemContent(row);
    const db = dbFor(row);

    await expect(attributeWrongAnswerEvidence({
      db,
      authenticatedUserId: 'student-1',
      answerId: 'answer-1',
    })).resolves.toBeNull();
    expect(db.wrongAnswerAttribution.upsert).not.toHaveBeenCalled();
  });

  it.each([
    ['semantic references', (metadata: any) => {
      const item = metadata.adaptiveAssessmentItemRef;
      item.semanticRefs.graphNodeIds = ['knowledge-node-tampered'];
      item.reviewDecision.selectedGraphNodeIds = ['knowledge-node-tampered'];
      rehashReviewDecision(item);
    }],
    ['review decision', (metadata: any) => {
      metadata.adaptiveAssessmentItemRef.reviewDecision.notes = 'Tampered after the answer was recorded.';
      rehashReviewDecision(metadata.adaptiveAssessmentItemRef);
    }],
    ['question snapshot', (metadata: any) => {
      metadata.questionSnapshot.prompt = 'TAMPERED_AFTER_ANSWER';
    }],
  ])('fails closed when persisted %s drift without a new item content hash', async (_label, damage) => {
    const row = answer();
    damage(row.questionRef.metadata);
    const db = dbFor(row);

    await expect(attributeWrongAnswerEvidence({
      db,
      authenticatedUserId: 'student-1',
      answerId: 'answer-1',
    })).resolves.toBeNull();
    expect(db.wrongAnswerAttribution.upsert).not.toHaveBeenCalled();
  });

  it('accepts a semantically equivalent JSONB snapshot with reordered object keys', async () => {
    const row = answer();
    const optionAttributions = optionAttributionsFor(row);
    row.questionRef.metadata = reverseObjectKeyOrder(row.questionRef.metadata);
    const db = dbFor(row);

    await expect(attributeWrongAnswerEvidence({
      db,
      authenticatedUserId: 'student-1',
      answerId: 'answer-1',
      optionAttributions,
    })).resolves.toMatchObject({ state: 'ATTRIBUTED' });
    expect(db.wrongAnswerAttribution.upsert).toHaveBeenCalledOnce();
  });

  it('persists and projects a deterministic governed attribution', async () => {
    const basePersisted = persisted();
    const row = answer();
    const db = dbFor(row, persisted({
      evidenceSummary: {
        ...(basePersisted.evidenceSummary as Record<string, unknown>),
        rawPrompt: RAW_PROMPT,
      },
    }));

    const result = await attributeWrongAnswerEvidence({
      db,
      authenticatedUserId: 'student-1',
      answerId: 'answer-1',
      optionAttributions: optionAttributionsFor(row),
    });

    expect(db.wrongAnswerAttribution.upsert).toHaveBeenCalledWith({
      where: {
        answerId_attributionVersion: {
          answerId: 'answer-1',
          attributionVersion: 'wrong-answer-attribution.v2',
        },
      },
      update: {},
      create: expect.objectContaining({
        state: 'ATTRIBUTED',
        knowledgeNodeIds: ['kn:autocontrol:stability-margin'],
        misconceptionTags: ['confuses-low-and-high-frequency'],
        confidence: 1,
        limitations: ['content-hash-bound'],
        nextAction: 'NONE',
      }),
    });
    expect(result).toMatchObject({
      state: 'ATTRIBUTED',
      attribution: {
        knowledgeNodeId: 'kn:autocontrol:stability-margin',
        misconceptionTag: 'confuses-low-and-high-frequency',
      },
      candidates: {
        knowledgeNodeIds: ['kn:autocontrol:stability-margin'],
        misconceptionTags: ['confuses-low-and-high-frequency'],
      },
      confidence: 1,
      attributionVersion: 'wrong-answer-attribution.v2',
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

  it.each([
    ['practice', 'low-stakes-practice'],
    ['readiness-gate', 'readiness'],
  ] as const)('normalizes the %s review stage through the real attribution path', async (
    reviewStage,
    allowedStage,
  ) => {
    const row = answer();
    setAssessmentStage(row, { reviewStage, allowedStage });
    const db = dbFor(row);
    const optionAttributions = optionAttributionsFor(row, {
      version: 'micro-tutoring-option-attribution.v3',
      assessmentStage: reviewStage,
    });

    await expect(attributeWrongAnswerEvidence({
      db,
      authenticatedUserId: 'student-1',
      answerId: row.id,
      optionAttributions,
    })).resolves.toMatchObject({ state: 'ATTRIBUTED' });
    expect(db.wrongAnswerAttribution.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ state: 'ATTRIBUTED' }),
    }));
  });

  it('returns an existing v1 attribution without writing a v2 record', async () => {
    const row = answer();
    const legacy = persisted({
      attributionVersion: 'wrong-answer-attribution.v1',
      itemContentHash: 'legacy-item-content-hash',
      knowledgeNodeIds: ['legacy-knowledge-node'],
      misconceptionTags: ['legacy-misconception'],
      evidenceSummary: {
        version: 'wrong-answer-evidence-summary.v1',
        outcome: 'incorrect',
        answeredAt: '2026-07-31T08:00:00.000Z',
        knowledgeNodeCount: 1,
        misconceptionCandidateCount: 1,
      },
      confidence: 0.5,
      limitations: ['legacy-attribution-preserved'],
      nextAction: 'MANUAL_REVIEW',
    });
    const db = dbFor(row, persisted(), legacy);

    const result = await attributeWrongAnswerEvidence({
      db,
      authenticatedUserId: 'student-1',
      answerId: 'answer-1',
      optionAttributions: optionAttributionsFor(row),
    });

    expect(db.wrongAnswerAttribution.findFirst).toHaveBeenCalledWith({
      where: {
        answerId: 'answer-1',
        attributionVersion: { in: ['wrong-answer-attribution.v1', 'wrong-answer-attribution.v2'] },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    expect(db.wrongAnswerAttribution.upsert).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      attributionVersion: 'wrong-answer-attribution.v1',
      attribution: {
        knowledgeNodeId: 'legacy-knowledge-node',
        misconceptionTag: 'legacy-misconception',
      },
      limitations: ['legacy-attribution-preserved'],
      nextAction: 'MANUAL_REVIEW',
    });
  });

  it('fails closed when the selected option has no unique current attribution', async () => {
    const row = answer();
    const stored = persisted({
      state: 'UNCERTAIN',
      knowledgeNodeIds: [],
      misconceptionTags: [],
      confidence: 0,
      limitations: ['option-attribution-unavailable'],
      nextAction: 'REPEAT_PRACTICE',
    });
    const db = dbFor(row, stored);

    const result = await attributeWrongAnswerEvidence({
      db,
      authenticatedUserId: 'student-1',
      answerId: 'answer-1',
      optionAttributions: [
        ...optionAttributionsFor(row),
        ...optionAttributionsFor(row),
      ],
    });

    expect(db.wrongAnswerAttribution.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        state: 'UNCERTAIN',
        knowledgeNodeIds: [],
        misconceptionTags: [],
        limitations: ['option-attribution-unavailable'],
      }),
    }));
    expect(result).toMatchObject({
      state: 'UNCERTAIN',
      attribution: null,
      nextAction: 'REPEAT_PRACTICE',
    });
  });

  it('uses the catalog knowledge node instead of a capability-domain review node', async () => {
    const multiObjective = answer();
    const metadata = multiObjective.questionRef.metadata as any;
    metadata.kaq.knowledgeNodeIds = ['kn:autocontrol:stability-margin'];
    metadata.adaptiveAssessmentItemRef.semanticRefs.learningGoalIds = [
      'stability-margin-frequency-analysis',
    ];
    metadata.adaptiveAssessmentItemRef.reviewDecision.selectedLearningGoalIds = [
      'stability-margin-frequency-analysis',
    ];
    metadata.adaptiveAssessmentItemRef.semanticRefs.graphNodeIds = [
      'cap:autocontrol:trade-off-engineering-constraints',
      'qual:autocontrol:safety-responsibility',
    ];
    metadata.adaptiveAssessmentItemRef.reviewDecision.selectedGraphNodeIds = [
      'cap:autocontrol:trade-off-engineering-constraints',
      'qual:autocontrol:safety-responsibility',
    ];
    rehashReviewDecision(metadata.adaptiveAssessmentItemRef);
    rehashItemContent(multiObjective);
    const optionAttributions = optionAttributionsFor(multiObjective, {
      knowledgeNodeId: 'kn:autocontrol:stability-margin',
    });
    const db = dbFor(multiObjective, persisted({
      knowledgeNodeIds: ['kn:autocontrol:stability-margin'],
    }));

    const result = await attributeWrongAnswerEvidence({
      db,
      authenticatedUserId: 'student-1',
      answerId: 'answer-1',
      optionAttributions,
    });

    expect(db.wrongAnswerAttribution.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        state: 'ATTRIBUTED',
        knowledgeNodeIds: ['kn:autocontrol:stability-margin'],
      }),
    }));
    expect(result).toMatchObject({
      state: 'ATTRIBUTED',
      attribution: {
        knowledgeNodeId: 'kn:autocontrol:stability-margin',
        misconceptionTag: 'confuses-low-and-high-frequency',
      },
    });
  });

  it('persists missing semantic evidence as uncertain and directs repeated practice', async () => {
    const incomplete = answer();
    const optionAttributions = optionAttributionsFor(incomplete);
    const metadata = incomplete.questionRef.metadata as any;
    metadata.adaptiveAssessmentItemRef.semanticRefs.misconceptionTags = [];
    metadata.questionSnapshot.misconceptionTags = [];
    rehashItemContent(incomplete);
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
      optionAttributions,
    });

    expect(db.wrongAnswerAttribution.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        state: 'UNCERTAIN',
        confidence: 0,
        limitations: ['option-attribution-unavailable'],
        nextAction: 'REPEAT_PRACTICE',
      }),
    }));
    expect(result?.attribution).toBeNull();
  });

  it('uses an immutable upsert so repeated requests share one answer-version record', async () => {
    const row = answer();
    const db = dbFor(row);
    const input = {
      db,
      authenticatedUserId: 'student-1',
      answerId: 'answer-1',
      optionAttributions: optionAttributionsFor(row),
    };

    await attributeWrongAnswerEvidence(input);
    await attributeWrongAnswerEvidence(input);

    expect(db.wrongAnswerAttribution.upsert).toHaveBeenCalledTimes(2);
    expect(db.wrongAnswerAttribution.upsert.mock.calls[0][0].update).toEqual({});
    expect(db.wrongAnswerAttribution.upsert.mock.calls[1][0].update).toEqual({});
  });

  it('adds the governed attribution to the existing adaptive diagnosis context', async () => {
    const row = answer();
    const db = dbFor(row);

    const context = await resolveAdaptiveDiagnosisContext({
      db,
      authenticatedUserId: 'student-1',
      answerId: 'answer-1',
      optionAttributions: optionAttributionsFor(row),
    });

    expect(context?.adaptiveAttempt).toMatchObject({
      answerId: 'answer-1',
      isCorrect: false,
    });
    expect(context?.wrongAnswerAttribution).toMatchObject({
      state: 'ATTRIBUTED',
      attribution: {
        knowledgeNodeId: 'kn:autocontrol:stability-margin',
        misconceptionTag: 'confuses-low-and-high-frequency',
      },
    });
  });
});
