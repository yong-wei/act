import { describe, expect, it } from 'vitest';

import { buildAdaptiveAssessmentItemCatalog } from '../adaptive-assessment-item-catalog';
import { buildGeneratedQuestion } from '@/features/assessment/adaptive-question-bank';
import {
  createGeneratedCandidate,
  createGeneratedCandidateStore,
  publicGeneratedCandidateSummary,
  publishGeneratedCandidate,
  restoreGeneratedCandidateStore,
  retireGeneratedPublication,
  reviewGeneratedCandidate,
  reviseGeneratedCandidate,
  rollbackGeneratedPublication,
  runGeneratedCandidatePrecheck,
  serializeGeneratedCandidateStore,
  type GeneratedCandidateContent,
  type GeneratedCandidateEnvelopeInput,
} from '../generated-candidate-governance';

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
    intendedStage: 'low-stakes-practice',
    ...overrides,
  };
}

function envelope(content: GeneratedCandidateContent, kind: GeneratedCandidateEnvelopeInput['generationKind'] = 'ai'): GeneratedCandidateEnvelopeInput {
  return {
    generationKind: kind,
    createdByUserId: 'generator-1',
    generationServiceId: kind === 'ai' ? 'ai-service-1' : undefined,
    provider: kind === 'ai' ? 'siliconflow' : null,
    model: kind === 'ai' ? 'Qwen/Qwen3.5-35B-A3B' : 'rule-based-generator',
    promptTemplateVersion: 'adaptive-question-template.v1',
    promptText: kind === 'ai' ? 'SECRET_PROMPT_DO_NOT_PUBLISH' : undefined,
    modelResponseText: kind === 'ai' ? 'SECRET_MODEL_RESPONSE' : undefined,
    knowledgeSourceRefs: [{ ref: 'goal:control-correction', hash: 'abc123' }],
    generationParams: { temperature: 0 },
    content,
  };
}

describe('generated candidate governance', () => {
  it('keeps template practice out of publication and uses a truthful generation kind', () => {
    const store = createGeneratedCandidateStore();
    const created = createGeneratedCandidate(store, envelope(validContent(), 'template'));
    expect(created.record.generationKind).toBe('template');
    expect(created.record.status).toBe('awaiting-human-review');
    expect(created.findings).toEqual([]);
  });

  it('does not auto-approve a passing precheck', () => {
    const findings = runGeneratedCandidatePrecheck(validContent());
    expect(findings).toEqual([]);
    const store = createGeneratedCandidateStore();
    const created = createGeneratedCandidate(store, envelope(validContent(), 'ai'));
    expect(created.record.status).toBe('awaiting-human-review');
    expect(created.record.status).not.toBe('approved');
  });

  it('rejects approval without complete item-by-item decisions', () => {
    const store = createGeneratedCandidateStore();
    const created = createGeneratedCandidate(store, envelope(validContent(), 'ai'));
    expect(() => reviewGeneratedCandidate(store, {
      candidateId: created.record.candidateId,
      reviewerUserId: 'reviewer-1',
      reviewerRole: 'teacher',
      outcome: 'approved',
      rationale: '只看了答案。',
      itemDecisions: { answer: 'accept' },
    })).toThrow(/逐项接受/);
  });

  it('rejects generator self-review and model-service review', () => {
    const store = createGeneratedCandidateStore();
    const created = createGeneratedCandidate(store, envelope(validContent(), 'ai'));
    expect(() => reviewGeneratedCandidate(store, {
      candidateId: created.record.candidateId,
      reviewerUserId: 'generator-1',
      reviewerRole: 'teacher',
      outcome: 'approved',
      rationale: '自审',
      itemDecisions: { answer: 'accept' },
    })).toThrow(/生成者不能批准/);
    expect(() => reviewGeneratedCandidate(store, {
      candidateId: created.record.candidateId,
      reviewerUserId: 'ai-service-1',
      reviewerRole: 'teacher',
      outcome: 'approved',
      rationale: '模型自审',
      itemDecisions: { answer: 'accept' },
    })).toThrow(/生成服务不能批准/);
  });

  it('survives a serialized restart and keeps private prompt text out of public summaries', () => {
    const store = createGeneratedCandidateStore();
    const created = createGeneratedCandidate(store, envelope(validContent(), 'ai'));
    const summary = publicGeneratedCandidateSummary(created.record, created.revision);
    const serialized = serializeGeneratedCandidateStore(store);
    expect(serialized).not.toContain('SECRET_PROMPT_DO_NOT_PUBLISH');
    expect(serialized).not.toContain('SECRET_MODEL_RESPONSE');
    expect(JSON.stringify(summary)).not.toContain('SECRET_PROMPT_DO_NOT_PUBLISH');
    expect(summary.promptHash).toEqual(expect.any(String));
    const restored = restoreGeneratedCandidateStore(serialized);
    expect(restored.candidates[0]?.candidateId).toBe(created.record.candidateId);
    expect(restored.revisions[0]?.envelope.contentHash).toBe(created.revision.envelope.contentHash);
  });

  it('requires a current human approval before publication and keeps historical receipts after retire', async () => {
    const store = createGeneratedCandidateStore();
    const created = createGeneratedCandidate(store, envelope(validContent(), 'ai'));
    expect(() => publishGeneratedCandidate(store, {
      candidateId: created.record.candidateId,
      publisherUserId: 'publisher-1',
      catalogReleaseId: 'generated-catalog.r1',
    })).toThrow(/只有当前人工批准/);

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
    expect(receipt.status).toBe('published');
    expect(receipt.receiptHash).toMatch(/^[a-f0-9]{64}$/);

    const question = buildGeneratedQuestion(
      created.revision.revisionId,
      created.revision.content.stem,
      created.revision.content.difficulty,
      ['time'],
      created.revision.content.knowledgeTags,
      {
        learningGoalIds: created.revision.content.learningGoalIds,
        graphNodeIds: created.revision.content.graphNodeIds,
        intendedStage: created.revision.content.intendedStage,
      },
    );
    question.options = created.revision.content.options;
    const catalog = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [],
      checkpointQuestions: [],
      generatedCandidateStore: store,
      generatedQuestions: [{
        question,
        generationKind: 'ai',
      }],
    });
    const publishedItem = catalog.items.find((item) => item.catalogItemId === receipt.catalogItemId);
    expect(publishedItem).toMatchObject({
      reviewState: 'path-eligible',
      eligibilityState: 'path-eligible',
      versionRefs: expect.objectContaining({
        generatedPublicationReceiptHash: receipt.receiptHash,
      }),
    });
    const { mkdtempSync, readFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { writeGeneratedCatalogRelease } = await import('../generated-candidate-catalog');
    const dir = mkdtempSync(join(tmpdir(), 'generated-catalog-'));
    writeGeneratedCatalogRelease(store, dir, catalog.items.filter((item) => item.eligibilityState === 'path-eligible'));
    const release = JSON.parse(readFileSync(join(dir, 'course-content/runtime/resource-governance/generated-assessment-catalog-release.json'), 'utf8')) as { catalogItemIds: string[] };
    expect(release.catalogItemIds).toContain(receipt.catalogItemId);
    rmSync(dir, { recursive: true, force: true });

    const retired = retireGeneratedPublication(store, {
      receiptId: receipt.receiptId,
      actorUserId: 'reviewer-1',
      reason: 'found-defect',
    });
    expect(retired.status).toBe('retired');
    expect(store.events.some((event) => event.status === 'published')).toBe(true);
    expect(store.events.some((event) => event.status === 'retired')).toBe(true);
    expect(store.receipts[0]?.receiptHash).toBe(receipt.receiptHash);
  });

  it('stales the previous approval when content changes and does not rewrite the old receipt identity', () => {
    const store = createGeneratedCandidateStore();
    const created = createGeneratedCandidate(store, envelope(validContent(), 'human'));
    reviewGeneratedCandidate(store, {
      candidateId: created.record.candidateId,
      reviewerUserId: 'reviewer-1',
      reviewerRole: 'teacher',
      outcome: 'approved',
      rationale: '人工候选通过。',
      itemDecisions: {
        answer: 'accept',
        distractors: 'accept',
        semantics: 'accept',
        stage: 'accept',
        source: 'accept',
      },
    });
    const firstReceipt = publishGeneratedCandidate(store, {
      candidateId: created.record.candidateId,
      publisherUserId: 'publisher-1',
      catalogReleaseId: 'generated-catalog.r1',
    });
    reviseGeneratedCandidate(store, created.record.candidateId, {
      promptTemplateVersion: 'adaptive-question-template.v1',
      knowledgeSourceRefs: [{ ref: 'goal:control-correction', hash: 'abc123' }],
      generationParams: { temperature: 0 },
      content: validContent({ stem: '修订后的题干必须重新审核。' }),
    });
    expect(store.reviews[0]?.stale).toBe(true);
    expect(() => publishGeneratedCandidate(store, {
      candidateId: created.record.candidateId,
      publisherUserId: 'publisher-1',
      catalogReleaseId: 'generated-catalog.r2',
    })).toThrow(/只有当前人工批准/);
    expect(firstReceipt.catalogItemId).toContain(created.revision.revisionId);
    rollbackGeneratedPublication(store, {
      receiptId: firstReceipt.receiptId,
      actorUserId: 'reviewer-1',
      reason: 'superseded',
    });
    expect(store.receipts[0]?.status).toBe('rolled-back');
    expect(store.receipts[0]?.receiptHash).toBe(firstReceipt.receiptHash);
  });

  it('keeps runtime generated questions provisional without a publication receipt', () => {
    const generatedQuestion = buildGeneratedQuestion(
      'generated-q-no-receipt',
      '生成题只用于低风险练习。',
      0.45,
      ['time'],
      ['generated-practice'],
    );
    const artifacts = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [],
      checkpointQuestions: [],
      generatedQuestions: [{ question: generatedQuestion, generationKind: 'template' }],
    });
    expect(artifacts.items[0]).toMatchObject({
      reviewState: 'generated-provisional',
      eligibilityState: 'generated-provisional',
      limitations: expect.arrayContaining([
        'generated-provisional-not-path-eligible',
        'missing-generated-publication-receipt',
      ]),
    });
  });
});
