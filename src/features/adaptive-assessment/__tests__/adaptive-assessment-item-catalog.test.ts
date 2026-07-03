import { describe, expect, it } from 'vitest';

import { buildGeneratedQuestion, PRESET_QUESTIONS } from '@/features/assessment/adaptive-question-bank';

import {
  buildAdaptiveAssessmentItemCatalog,
  loadAdaptiveAssessmentCatalogSources,
} from '../adaptive-assessment-item-catalog';

describe('adaptive assessment item catalog', () => {
  it('registers current repository question source families and counts', async () => {
    const sources = await loadAdaptiveAssessmentCatalogSources();
    const artifacts = buildAdaptiveAssessmentItemCatalog({
      acqStaticQuestions: sources.acqStaticQuestions,
      icourseObjectiveBankItems: sources.icourseObjectiveBankItems,
      icourseObjectiveBankIndexTotal: sources.icourseObjectiveBankIndexTotal,
      kaqReviewedItems: sources.kaqReviewedItems,
    });
    const byFamily = new Map(artifacts.manifest.sourceFamilies.map((family) => [family.family, family]));

    expect(byFamily.get('preset-adaptive-question')).toMatchObject({
      sourceTotal: 50,
      importedTotal: 50,
      blockedTotal: 0,
    });
    expect(byFamily.get('acq-static-question')).toMatchObject({
      sourceTotal: 167,
      importedTotal: 167,
      blockedTotal: 0,
    });
    expect(byFamily.get('icourse-objective-bank')).toMatchObject({
      sourceTotal: 226,
      importedTotal: 226,
      blockedTotal: 0,
    });
    expect(byFamily.get('kaq-foundation-reviewed')?.sourceTotal).toBeGreaterThan(0);
    expect(byFamily.get('kaq-foundation-reviewed')).toMatchObject({
      role: 'review-overlay',
      appliesToFamily: 'preset-adaptive-question',
      importedTotal: 0,
      blockedTotal: 0,
      reviewOverlayTotal: expect.any(Number),
    });
    expect(byFamily.get('prisma-question')).toMatchObject({
      sourceTotal: null,
      importedTotal: 0,
      limitationReasons: ['prisma-question-count-requires-database-query'],
    });
    expect(byFamily.get('generated-adaptive-question')?.limitationReasons).toContain('generated-provisional-not-path-eligible');
    expect(byFamily.get('checkpoint-authored-question')?.limitationReasons).toContain('future-checkpoint-items-not-authored-in-this-change');
    expect(artifacts.items.length).toBeGreaterThanOrEqual(50 + 167 + 226);
    expect(artifacts.items.some((item) => item.sourceFamily === 'kaq-foundation-reviewed')).toBe(false);
  });

  it('keeps catalog identity separate from immutable answer-time snapshots', () => {
    const generatedQuestion = buildGeneratedQuestion(
      'generated-q-catalog-test',
      '生成题只用于低风险练习。',
      0.45,
      ['time'],
      ['generated-practice'],
    );
    const artifacts = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [PRESET_QUESTIONS[0]],
      prismaQuestions: [{
        id: 'prisma-question-1',
        stem: 'Prisma 题干',
        type: 'multi-criteria',
        domains: ['time'],
        difficulty: 0.3,
        knowledgeTags: ['prisma-source'],
        correctAnswer: 'A',
        explanation: '解释',
        source: 'manual',
        validationStatus: 'validated',
      }],
      prismaQuestionSourceTotal: 1,
      generatedQuestions: [{ question: generatedQuestion }],
    });
    const prismaItem = artifacts.items.find((item) => item.sourceFamily === 'prisma-question');
    const generatedItem = artifacts.items.find((item) => item.sourceFamily === 'generated-adaptive-question');

    expect(prismaItem).toMatchObject({
      reviewState: 'semantically-reviewed',
      eligibilityState: 'semantically-reviewed',
      allowedStages: ['low-stakes-practice'],
      adaptiveAssessmentItemRef: {
        relationship: 'answer-time-snapshot',
        immutable: true,
        catalogUpdatesRewriteHistoricalAnswers: false,
      },
    });
    expect(generatedItem).toMatchObject({
      reviewState: 'generated-provisional',
      eligibilityState: 'generated-provisional',
      allowedStages: ['low-stakes-practice'],
      limitations: ['generated-provisional-not-path-eligible'],
    });
    expect(generatedItem?.allowedStages).not.toContain('checkpoint');
    expect(generatedItem?.allowedStages).not.toContain('terminal-validation');
  });

  it('uses reviewed K/A/Q metadata to mark only explicit preset items as path eligible', async () => {
    const sources = await loadAdaptiveAssessmentCatalogSources();
    const artifacts = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: PRESET_QUESTIONS.slice(0, 2),
      kaqReviewedItems: sources.kaqReviewedItems,
    });
    const eligibleItem = artifacts.items.find((item) => item.sourceId === 'preset-q-01');

    expect(eligibleItem).toMatchObject({
      reviewState: 'path-eligible',
      eligibilityState: 'path-eligible',
      questionRefs: {
        answerKey: expect.any(Array),
      },
    });
    expect(eligibleItem?.allowedStages).toEqual(expect.arrayContaining(['low-stakes-practice', 'readiness']));
    expect(eligibleItem?.allowedStages).not.toContain('terminal-validation');
    expect(eligibleItem?.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(eligibleItem?.semanticRefs.learningGoalIds).toContain('control-correction');
  });

  it('does not trust stale K/A/Q review metadata for path eligibility', async () => {
    const sources = await loadAdaptiveAssessmentCatalogSources();
    const staleReview = sources.kaqReviewedItems.find((item) => item.questionId === 'preset-q-01');
    expect(staleReview).toBeTruthy();
    const artifacts = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [PRESET_QUESTIONS[0]],
      kaqReviewedItems: [{
        ...staleReview!,
        metadata: {
          ...staleReview!.metadata,
          review: {
            ...staleReview!.metadata?.review,
            sourceHash: 'stale-source-hash',
          },
        },
      }],
    });
    const item = artifacts.items[0];

    expect(item.reviewState).toBe('imported-unreviewed');
    expect(item.eligibilityState).toBe('imported-unreviewed');
    expect(item.allowedStages).toEqual(['low-stakes-practice']);
    expect(item.limitations).toEqual(expect.arrayContaining([
      'kaq-review-source-hash-mismatch',
      'not-path-eligible',
    ]));
  });
});
