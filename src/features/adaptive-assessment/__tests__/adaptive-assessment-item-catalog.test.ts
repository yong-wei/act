import { describe, expect, it } from 'vitest';

import { buildGeneratedQuestion, PRESET_QUESTIONS } from '@/features/assessment/adaptive-question-bank';

import {
  buildAdaptiveAssessmentItemCatalog,
  loadAdaptiveAssessmentCatalogSources,
} from '../adaptive-assessment-item-catalog';
import type { CheckpointAuthoredQuestionRecord } from '../learning-goal-checkpoint-question-sets';

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
    expect(byFamily.get('checkpoint-authored-question')).toMatchObject({
      sourceTotal: 87,
      importedTotal: 87,
      blockedTotal: 0,
      limitationReasons: [],
    });
    expect(artifacts.items.length).toBeGreaterThanOrEqual(50 + 167 + 226 + 87);
    expect(artifacts.items.some((item) => item.sourceFamily === 'kaq-foundation-reviewed')).toBe(false);
    expect(artifacts.items.filter((item) => item.sourceFamily === 'checkpoint-authored-question')).toHaveLength(87);
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
      checkpointQuestions: [],
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

  it('registers authored checkpoint items as reviewed path-eligible catalog records', () => {
    const artifacts = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [],
      checkpointQuestions: undefined,
    });
    const authoredItem = artifacts.items.find((item) =>
      item.sourceFamily === 'checkpoint-authored-question' &&
      item.sourceId === 'feedback-loop-concept-foundations-readiness-01'
    );

    expect(authoredItem).toMatchObject({
      reviewState: 'path-eligible',
      eligibilityState: 'path-eligible',
      allowedStages: expect.arrayContaining(['low-stakes-practice', 'readiness']),
      semanticRefs: {
        learningGoalIds: ['feedback-loop-concept-foundations'],
        cognitiveLevel: 'apply',
      },
      questionRefs: {
        answerKey: ['A'],
        choiceMode: 'single',
      },
    });
    expect(authoredItem?.allowedStages).not.toContain('remediation');
    expect(authoredItem?.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('does not trust stale K/A/Q review metadata for path eligibility', async () => {
    const sources = await loadAdaptiveAssessmentCatalogSources();
    const staleReview = sources.kaqReviewedItems.find((item) => item.questionId === 'preset-q-01');
    expect(staleReview).toBeTruthy();
    const artifacts = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [PRESET_QUESTIONS[0]],
      checkpointQuestions: [],
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

  it('does not trust K/A/Q review metadata with stale version references', async () => {
    const sources = await loadAdaptiveAssessmentCatalogSources();
    const staleReview = sources.kaqReviewedItems.find((item) => item.questionId === 'preset-q-01');
    expect(staleReview).toBeTruthy();
    const artifacts = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [PRESET_QUESTIONS[0]],
      checkpointQuestions: [],
      kaqReviewedItems: [{
        ...staleReview!,
        metadata: {
          ...staleReview!.metadata,
          versionRefs: {
            ...staleReview!.metadata?.versionRefs,
            objectiveCatalogVersion: 'stale-objective-catalog.v0',
          },
        },
      }],
    });
    const item = artifacts.items[0];

    expect(item.reviewState).toBe('imported-unreviewed');
    expect(item.allowedStages).toEqual(['low-stakes-practice']);
    expect(item.limitations).toEqual(expect.arrayContaining([
      'kaq-review-version-ref-mismatch',
      'not-path-eligible',
    ]));
  });

  it('keeps iCourse content hashes stable when only governance metadata changes', () => {
    const baseRecord = {
      question_id: 'icourse-q-1',
      question_kind: 'single-choice',
      choice_mode: 'single',
      stem: '单位阶跃响应的稳态误差由哪个量决定？',
      options: [
        { key: 'A', text: '系统型别', is_correct: true },
        { key: 'B', text: '采样周期', is_correct: false },
      ],
      correct_answers: ['A'],
      knowledge_tags: ['steady-state-error'],
      adaptive_metadata: {
        difficulty_seed: 0.42,
        review_status: 'verified',
      },
      search_text: '治理检索文本',
      source_bundle: {
        exportedAt: '2026-07-01T00:00:00.000Z',
      },
    };
    const artifacts = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [],
      icourseObjectiveBankItems: [
        baseRecord,
        {
          ...baseRecord,
          question_id: 'icourse-q-1-copy',
          adaptive_metadata: {
            ...baseRecord.adaptive_metadata,
            review_status: 'pending',
          },
          search_text: '更新后的检索文本',
          source_bundle: {
            exportedAt: '2026-07-02T00:00:00.000Z',
          },
        },
      ],
      icourseObjectiveBankIndexTotal: 2,
    });

    const [first, second] = artifacts.items
      .filter((item) => item.sourceFamily === 'icourse-objective-bank')
      .sort((left, right) => left.sourceId.localeCompare(right.sourceId));

    expect(first.contentHash).toBe(second.contentHash);
    expect(first.lineage.sourceHash).toBe(second.lineage.sourceHash);
    expect(first.reviewState).toBe('semantically-reviewed');
    expect(second.reviewState).toBe('imported-unreviewed');
  });

  it('changes iCourse content hashes when option text changes', () => {
    const baseRecord = {
      question_id: 'icourse-q-option-1',
      question_kind: 'single-choice',
      choice_mode: 'single',
      stem: '闭环系统稳定性与哪一项最直接相关？',
      options: [
        { key: 'A', text: '闭环特征根位置', is_correct: true },
        { key: 'B', text: '输入信号颜色', is_correct: false },
      ],
      correct_answers: ['A'],
      knowledge_tags: ['stability'],
      adaptive_metadata: {
        difficulty_seed: 0.35,
        review_status: 'verified',
      },
    };
    const artifacts = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [],
      icourseObjectiveBankItems: [
        baseRecord,
        {
          ...baseRecord,
          question_id: 'icourse-q-option-2',
          options: [
            { key: 'A', text: '闭环极点位置', is_correct: true },
            { key: 'B', text: '输入信号颜色', is_correct: false },
          ],
        },
      ],
      icourseObjectiveBankIndexTotal: 2,
    });

    const [first, second] = artifacts.items
      .filter((item) => item.sourceFamily === 'icourse-objective-bank')
      .sort((left, right) => left.sourceId.localeCompare(right.sourceId));

    expect(first.contentHash).not.toBe(second.contentHash);
    expect(first.lineage.sourceHash).not.toBe(second.lineage.sourceHash);
  });

  it('keeps checkpoint content hashes stable when only review audit fields change', () => {
    const baseRecord: CheckpointAuthoredQuestionRecord = {
      id: 'checkpoint-audit-hash-1',
      learningGoalId: 'control-correction',
      learningGoalTitle: '控制系统校正设计',
      stagePurpose: 'checkpoint',
      stem: '校正设计完成后，哪一项最适合作为检查点题？',
      options: [
        { key: 'A', text: '检查相位裕度与稳态误差是否同时满足要求', isCorrect: true, explanation: '检查点题应验证设计指标是否闭环满足。' },
        { key: 'B', text: '只观察开环增益是否最大', isCorrect: false, explanation: '开环增益不是完整校正目标。' },
      ],
      answerKeys: ['A'],
      explanation: '校正设计检查点需要围绕闭环性能指标进行验证。',
      difficulty: 0.55,
      cognitiveLevel: 'analyze',
      kaqObjectiveIds: ['knowledge:autocontrol:controller-correction'],
      graphNodeIds: ['kn:autocontrol:controller-correction'],
      knowledgeTags: ['controller-correction'],
      misconceptionTags: ['open-loop-gain-only'],
      remediationResourceNodeIds: ['registry:lesson09-correction-precheck'],
      reviewedAt: '2026-07-03T00:00:00.000Z',
      reviewerId: 'reviewer:checkpoint-content',
      reviewBatchId: 'learning-goal-checkpoint-question-sets.v1',
      sourceRef: 'unit-test:checkpoint-audit-hash-1',
    };
    const firstArtifacts = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [],
      checkpointQuestions: [baseRecord],
      kaqReviewedItems: [],
    });
    const secondArtifacts = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [],
      checkpointQuestions: [{
        ...baseRecord,
        reviewedAt: '2026-07-04T00:00:00.000Z',
        reviewerId: 'reviewer:governance-audit',
        reviewBatchId: 'learning-goal-checkpoint-question-sets.audit-only.v2',
      } as CheckpointAuthoredQuestionRecord],
      kaqReviewedItems: [],
    });

    const first = firstArtifacts.items.find((item) => item.sourceFamily === 'checkpoint-authored-question');
    const second = secondArtifacts.items.find((item) => item.sourceFamily === 'checkpoint-authored-question');

    expect(first?.contentHash).toBe(second?.contentHash);
    expect(first?.lineage.sourceHash).toBe(second?.lineage.sourceHash);
  });

  it('changes checkpoint content hashes when authored question content changes', () => {
    const baseRecord: CheckpointAuthoredQuestionRecord = {
      id: 'checkpoint-content-hash-1',
      learningGoalId: 'control-correction',
      learningGoalTitle: '控制系统校正设计',
      stagePurpose: 'checkpoint',
      stem: '校正设计完成后，哪一项最适合作为检查点题？',
      options: [
        { key: 'A', text: '检查相位裕度与稳态误差是否同时满足要求', isCorrect: true, explanation: '检查点题应验证设计指标是否闭环满足。' },
        { key: 'B', text: '只观察开环增益是否最大', isCorrect: false, explanation: '开环增益不是完整校正目标。' },
      ],
      answerKeys: ['A'],
      explanation: '校正设计检查点需要围绕闭环性能指标进行验证。',
      difficulty: 0.55,
      cognitiveLevel: 'analyze',
      kaqObjectiveIds: ['knowledge:autocontrol:controller-correction'],
      graphNodeIds: ['kn:autocontrol:controller-correction'],
      knowledgeTags: ['controller-correction'],
      misconceptionTags: ['open-loop-gain-only'],
      remediationResourceNodeIds: ['registry:lesson09-correction-precheck'],
      reviewedAt: '2026-07-03T00:00:00.000Z',
      reviewerId: 'reviewer:checkpoint-content',
      reviewBatchId: 'learning-goal-checkpoint-question-sets.v1',
      sourceRef: 'unit-test:checkpoint-content-hash-1',
    };
    const firstArtifacts = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [],
      checkpointQuestions: [baseRecord],
      kaqReviewedItems: [],
    });
    const secondArtifacts = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [],
      checkpointQuestions: [{
        ...baseRecord,
        stem: '校正设计完成后，哪一项最适合作为终结性检查点题？',
      }],
      kaqReviewedItems: [],
    });

    const first = firstArtifacts.items.find((item) => item.sourceFamily === 'checkpoint-authored-question');
    const second = secondArtifacts.items.find((item) => item.sourceFamily === 'checkpoint-authored-question');

    expect(first?.contentHash).not.toBe(second?.contentHash);
    expect(first?.lineage.sourceHash).not.toBe(second?.lineage.sourceHash);
  });
});
