import { afterEach, describe, expect, it } from 'vitest';

import {
  getAdaptiveQuestionById,
  submitAnswerWithDetails,
} from '../adaptive-engine';
import {
  buildAdaptiveAssessmentItemCatalog,
} from '@/features/adaptive-assessment/adaptive-assessment-item-catalog';
import {
  generatedQuestionsFromStore,
  generatedReviewDecisionsFromStore,
} from '@/features/adaptive-assessment/generated-candidate-catalog';
import {
  replaceGeneratedRuntimeOverlay,
  resetGeneratedRuntimeOverlay,
} from '@/features/adaptive-assessment/adaptive-assessment-catalog-selector';
import {
  createGeneratedCandidate,
  createGeneratedCandidateStore,
  publishGeneratedCandidate,
  reviewGeneratedCandidate,
  type GeneratedCandidateContent,
  type GeneratedCandidateEnvelopeInput,
  type GeneratedCandidateStore,
} from '@/features/adaptive-assessment/generated-candidate-governance';

function validContent(overrides: Partial<GeneratedCandidateContent> = {}): GeneratedCandidateContent {
  return {
    stem: '校正方案必须同时核对哪组独立证据？',
    options: [
      { label: 'A', text: '缺口、补偿理由、参数和指标对比', isCorrect: true, explanation: '完整设计链。' },
      { label: 'B', text: '只看检查点截图', isCorrect: false, explanation: '不够。' },
      { label: 'C', text: '只看练习正确率', isCorrect: false, explanation: '不够。' },
    ],
    knowledgeTags: ['controller-tuning'],
    learningGoalIds: ['control-correction'],
    graphNodeIds: ['kn:autocontrol:controller-correction'],
    difficulty: 0.6,
    intendedStage: 'checkpoint',
    ...overrides,
  };
}

function envelope(content: GeneratedCandidateContent): GeneratedCandidateEnvelopeInput {
  return {
    generationKind: 'ai',
    createdByUserId: 'generator-1',
    generationServiceId: 'ai-service-1',
    provider: 'siliconflow',
    model: 'Qwen/Qwen3.5-35B-A3B',
    promptTemplateVersion: 'adaptive-question-template.v1',
    knowledgeSourceRefs: [{ ref: 'goal:control-correction', hash: 'abc123' }],
    generationParams: { temperature: 0 },
    content,
  };
}

function approvedPublishedStore() {
  const store = createGeneratedCandidateStore();
  const created = createGeneratedCandidate(store, envelope(validContent()));
  reviewGeneratedCandidate(store, {
    candidateId: created.record.candidateId,
    reviewerUserId: 'reviewer-1',
    reviewerRole: 'assessment-content-reviewer',
    outcome: 'approved',
    rationale: '答案、干扰项、目标和难度均核对通过。',
    itemDecisions: {
      answer: 'accept',
      distractors: 'accept',
      semantics: 'accept',
      stage: 'accept',
      source: 'accept',
    },
  });
  const receipt = publishGeneratedCandidate(store, {
    candidateId: created.record.candidateId,
    publisherUserId: 'publisher-1',
    catalogReleaseId: 'generated-catalog.r1',
  });
  return { store, created, receipt };
}

function hydrateOverlay(store: GeneratedCandidateStore) {
  const catalog = buildAdaptiveAssessmentItemCatalog({
    presetQuestions: [],
    checkpointQuestions: [],
    generatedCandidateStore: store,
    generatedQuestions: generatedQuestionsFromStore(store),
  });
  replaceGeneratedRuntimeOverlay({
    items: catalog.items.filter((item) => (
      item.sourceFamily === 'generated-adaptive-question' && item.eligibilityState === 'path-eligible'
    )),
    decisions: generatedReviewDecisionsFromStore(store),
  });
}

afterEach(() => {
  resetGeneratedRuntimeOverlay();
  globalThis.__adaptiveAssessmentStore = undefined;
});

describe('generated runtime question resolution', () => {
  it('serves a published generated catalog item as a runtime question with the same identity', () => {
    const { store, created, receipt } = approvedPublishedStore();
    hydrateOverlay(store);

    const question = getAdaptiveQuestionById(created.revision.revisionId);
    expect(question).not.toBeNull();
    expect(question?.id).toBe(created.revision.revisionId);
    expect(question?.stem).toBe(validContent().stem);
    expect(question?.options.map((option) => option.label)).toEqual(['A', 'B', 'C']);
    expect(question?.options.find((option) => option.isCorrect)?.text)
      .toBe('缺口、补偿理由、参数和指标对比');
    expect(question?.knowledgeTags).toEqual(['controller-tuning']);
    expect(question?.difficulty).toBe(0.6);
    expect(question?.generatedMetadata).toBeUndefined();

    const answered = submitAnswerWithDetails({
      userId: 'student-1',
      sessionId: 'session-1',
      questionId: created.revision.revisionId,
      selectedOption: '缺口、补偿理由、参数和指标对比',
      timeSpent: 42,
    });
    expect(answered.result.isCorrect).toBe(true);
    expect(answered.result.correctOption).toBe('A');
    expect(receipt.status).toBe('published');
  });

  it('does not serve unpublished or template-only generated content as a runtime question', () => {
    const store = createGeneratedCandidateStore();
    const created = createGeneratedCandidate(store, envelope(validContent()));
    hydrateOverlay(store);

    expect(getAdaptiveQuestionById(created.revision.revisionId)).toBeNull();
    expect(getAdaptiveQuestionById('generated-q-session-only')).toBeNull();
  });
});
