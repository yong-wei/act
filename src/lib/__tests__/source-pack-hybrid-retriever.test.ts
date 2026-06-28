import { describe, expect, it } from 'vitest';

import {
  adaptLearningEvidenceChunk,
  adaptTextbookSearchDocument,
  evaluateSourcePackRetrieval,
  getSourcePackRetrievalProfile,
  retrieveSourcePack,
  sourcePackEvaluationFixtures,
  type SourcePackItem,
} from '../source-pack';
import type { LearningEvidenceCorpusChunk } from '../data-governance/learning-evidence-rag-corpus';
import type { TextbookRuntimeSearchDocument } from '../textbook-runtime-resources';

function item(overrides: Partial<SourcePackItem> = {}): SourcePackItem {
  return {
    id: 'item-root-locus',
    title: 'Root locus phase margin',
    sourceKind: 'textbook',
    modality: 'text',
    excerpt: 'Root locus and phase margin explain closed-loop pole movement.',
    inclusionRationale: 'Matches control-system concept evidence.',
    retrievalChunkId: 'chunk:root-locus',
    citationTargetId: 'citation:root-locus',
    scores: {
      relevance: 0.6,
      graphAlignment: 0.4,
      authority: 0.8,
      eligibility: 0.6,
      freshness: 0.7,
      final: 0.6,
    },
    access: {
      visibility: 'student',
      aiUseAllowed: true,
    },
    metadata: {
      reviewStatus: 'human-confirmed',
      knowledgeNodeRefs: ['kn-root-locus'],
      capabilityTargetRefs: ['cap-analysis'],
      resourceIds: ['res-root-locus'],
    },
    ...overrides,
  };
}

function canonicalChunk(): LearningEvidenceCorpusChunk {
  return {
    id: 'learning-evidence:canonical-root-locus',
    family: 'course-content',
    sourceType: 'course-content',
    sourceRef: {
      id: 'source:canonical-root-locus',
      ownerUserId: null,
      classId: null,
      goalId: null,
      resourceId: null,
    },
    spanRef: {
      kind: 'text-range',
      start: 0,
      end: 80,
      locator: 'root-locus',
    },
    display: {
      title: 'Canonical root locus evidence',
      href: '/course-runtime/unit-3/root-locus',
      capsule: 'Root locus evidence from canonical course content.',
    },
    citationAddress: {
      kind: 'text',
      sourceRefId: 'source:canonical-root-locus',
      href: '/course-runtime/unit-3/root-locus#canonical',
      locator: '#canonical',
      contentHash: 'sha256:canonical',
      mediaStartSeconds: null,
      mediaEndSeconds: null,
      imageRegion: null,
      interactiveStepId: null,
      simulationRunId: null,
      arenaTaskId: null,
      externalUrl: null,
    },
    content: {
      text: 'Root locus canonical explanation.',
      redactedSummary: 'Root locus canonical explanation.',
      hash: 'sha256:canonical',
    },
    resourceProjection: {
      resourceId: 'resource:canonical-root-locus',
      segmentRef: 'segment:canonical-root-locus',
      citationTargetRef: 'citation:canonical-root-locus',
      knowledgeNodeRefs: ['kn-root-locus'],
      capabilityTargetRefs: ['cap-analysis'],
    },
    privacyClass: 'public',
    confidence: 'high',
    freshness: {
      indexedAt: '2026-06-28T00:00:00Z',
      sourceUpdatedAt: '2026-06-27T00:00:00Z',
      expiresAt: null,
      stale: false,
    },
    authority: {
      level: 'canonical',
      knowledgeTags: ['root-locus'],
      pageAnchor: '/course-runtime/unit-3/root-locus#canonical',
      freshnessBucket: 'current',
      scopeRule: {
        visibility: 'public',
        allowedRoles: ['student', 'teacher', 'admin'],
      },
    },
    retrieval: {
      tags: ['root-locus'],
      goals: ['goal:root-locus'],
      useCases: ['konling'],
    },
  };
}

function textbookDoc(): TextbookRuntimeSearchDocument {
  return {
    id: 'textbook-root-locus',
    kind: 'chunk',
    title: 'Root locus textbook section',
    href: '/course-runtime/textbook/ch02/root-locus',
    text: 'Root locus explains closed-loop pole movement.',
    contentHash: 'sha256:textbook-root-locus',
    resourceProjection: {
      resourceId: 'res-textbook-root-locus',
      segmentRef: 'seg-textbook-root-locus',
      citationTargetRef: 'textbook:root-locus:citation',
      knowledgeNodeRefs: ['kn-root-locus'],
      capabilityTargetRefs: ['cap-analysis'],
    },
    citationAddress: {
      kind: 'text',
      sourceRefId: 'textbook:root-locus',
      href: '/course-runtime/textbook/ch02/root-locus#section',
      locator: '#section',
      contentHash: 'sha256:textbook-root-locus',
    },
    metadata: {
      bookId: 'dorf-modern-control-systems',
      sectionId: 'ch02-sec-root-locus',
      chapterId: 'ch02',
      chapterNumber: 2,
    },
  };
}

describe('source pack retrieval profiles', () => {
  it('defines requested profiles and aliases existing profile names', () => {
    expect(getSourcePackRetrievalProfile('handout-authoring').budgets.maxItems).toBeGreaterThan(4);
    expect(getSourcePackRetrievalProfile('assessment-item').rejectAnswerLeakage).toBe(true);
    expect(getSourcePackRetrievalProfile('konling-answer').requireCitationReady).toBe(true);
    expect(getSourcePackRetrievalProfile('path-planning').rankingWeights.graph).toBeGreaterThan(0);
    expect(getSourcePackRetrievalProfile('lesson-design').allowedSourceKinds).toContain('runtime-lesson');
    expect(getSourcePackRetrievalProfile('lesson-authoring').name).toBe('lesson-authoring');
    expect(getSourcePackRetrievalProfile('konling').name).toBe('konling');
  });

  it('filters Konling candidates before ranking by role, AI use, and citation readiness', () => {
    const result = retrieveSourcePack({
      query: 'root locus',
      profile: 'konling-answer',
      role: 'student',
      candidates: [
        item({ id: 'eligible', title: 'Root locus citation', citationTargetId: 'citation:eligible' }),
        item({ id: 'teacher-only', access: { visibility: 'teacher', aiUseAllowed: true } }),
        item({ id: 'ai-blocked', access: { visibility: 'student', aiUseAllowed: false } }),
        item({ id: 'not-citation-ready', citationTargetId: undefined }),
      ],
      now: new Date('2026-06-28T00:00:00Z'),
    });
    expect(result.pack.items.map((packItem) => packItem.id)).toEqual(['eligible']);
    expect(result.pack.limitations.map((limitation) => limitation.code)).toEqual(expect.arrayContaining([
      'profile-filtered-visibility',
      'profile-filtered-ai-use',
      'profile-filtered-citation-readiness',
    ]));
    expect(JSON.stringify(result.pack.limitations)).not.toContain('teacher-only');
    expect(JSON.stringify(result.pack.limitations)).not.toContain('ai-blocked');
    expect(JSON.stringify(result.pack.limitations)).not.toContain('not-citation-ready');
    expect(result.pack.coverage.eligibleItems).toBe(1);
    expect(result.pack.coverage.notes).toEqual(['3 candidate(s) were excluded by profile policy before ranking.']);
  });

  it('filters assessment evidence by review state, source type, AI use, and answer leakage', () => {
    const result = retrieveSourcePack({
      query: 'phase margin',
      profile: 'assessment-item',
      role: 'teacher',
      candidates: [
        item({ id: 'eligible-assessment', title: 'Phase margin prompt source' }),
        item({ id: 'provisional', metadata: { reviewStatus: 'generated-provisional' } }),
        item({ id: 'unknown-review-state', metadata: {} }),
        item({ id: 'learner-answer', sourceKind: 'learner-evidence' }),
        item({ id: 'answer-leakage', metadata: { reviewStatus: 'human-confirmed', answerLeakage: true } }),
        item({ id: 'ch01-answers-to-skills-check-039', title: 'Root locus reference', metadata: { reviewStatus: 'human-confirmed' } }),
        item({ id: 'answer-section-title', title: 'Answers to Skills Check', metadata: { reviewStatus: 'human-confirmed' } }),
        item({ id: 'metadata-answer-section', metadata: { reviewStatus: 'human-confirmed', sectionId: 'ch02-answers-to-skills-check-040' } }),
        item({ id: 'ai-disallowed', access: { visibility: 'student', aiUseAllowed: false } }),
      ],
      now: new Date('2026-06-28T00:00:00Z'),
    });
    expect(result.pack.items.map((packItem) => packItem.id)).toEqual(['eligible-assessment']);
    expect(result.pack.limitations.map((limitation) => limitation.code)).toEqual(expect.arrayContaining([
      'profile-filtered-review-state',
      'profile-filtered-source-kind',
      'profile-filtered-answer-leakage',
      'profile-filtered-ai-use',
    ]));
  });

  it('filters missing review state from controlled answer profiles', () => {
    const result = retrieveSourcePack({
      query: 'root locus',
      profile: 'konling-answer',
      role: 'student',
      candidates: [
        item({ id: 'reviewed', citationTargetId: 'citation:reviewed' }),
        item({ id: 'missing-review-state', citationTargetId: 'citation:missing-review-state', metadata: {} }),
      ],
      now: new Date('2026-06-28T00:00:00Z'),
    });
    expect(result.pack.items.map((packItem) => packItem.id)).toEqual(['reviewed']);
    expect(result.pack.limitations.map((limitation) => limitation.code)).toContain('profile-filtered-review-state');
    expect(JSON.stringify(result.pack.limitations)).not.toContain('missing-review-state');
  });

  it('redacts upstream limitation details from student-visible packs', () => {
    const result = retrieveSourcePack({
      query: 'root locus',
      profile: 'konling-answer',
      role: 'student',
      candidates: [item({ id: 'eligible', citationTargetId: 'citation:eligible' })],
      limitations: [{
        code: 'scope-excluded',
        severity: 'warning',
        message: 'Chunk teacher-only-raw-source was excluded from class scope.',
        source: 'corpus-adapters',
        recoverable: true,
      }, {
        code: 'upstream-blocking-internal',
        severity: 'blocking',
        message: 'Blocking internal-source-id should not be serialized.',
        source: 'corpus-adapters',
        recoverable: false,
      }],
      now: new Date('2026-06-28T00:00:00Z'),
    });
    expect(result.pack.limitations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'upstream-limitations-redacted',
        severity: 'blocking',
      }),
    ]));
    expect(JSON.stringify(result.pack.limitations)).not.toContain('teacher-only-raw-source');
    expect(JSON.stringify(result.pack.limitations)).not.toContain('scope-excluded');
    expect(JSON.stringify(result.pack.limitations)).not.toContain('internal-source-id');
    expect(JSON.stringify(result.pack.limitations)).not.toContain('upstream-blocking-internal');
  });

  it('preserves upstream limitation details for teacher packs', () => {
    const result = retrieveSourcePack({
      query: 'root locus',
      profile: 'handout-authoring',
      role: 'teacher',
      candidates: [item({ id: 'eligible', citationTargetId: 'citation:eligible' })],
      limitations: [{
        code: 'scope-excluded',
        severity: 'warning',
        message: 'Chunk teacher-only-source was excluded from class scope.',
        source: 'corpus-adapters',
        recoverable: true,
      }],
      now: new Date('2026-06-28T00:00:00Z'),
    });
    expect(result.pack.limitations.map((limitation) => limitation.code)).toContain('scope-excluded');
    expect(JSON.stringify(result.pack.limitations)).toContain('teacher-only-source');
  });

  it('treats unknown runtime roles as student-visible for upstream limitation redaction', () => {
    const result = retrieveSourcePack({
      query: 'root locus',
      profile: 'konling-answer',
      role: 'assistant' as never,
      candidates: [item({ id: 'eligible', citationTargetId: 'citation:eligible' })],
      limitations: [{
        code: 'scope-excluded',
        severity: 'info',
        message: 'Chunk runtime-unknown-role-source was excluded from class scope.',
        source: 'corpus-adapters',
        recoverable: true,
      }],
      now: new Date('2026-06-28T00:00:00Z'),
    });
    expect(result.pack.limitations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'upstream-limitations-redacted',
        severity: 'info',
      }),
    ]));
    expect(JSON.stringify(result.pack.limitations)).not.toContain('runtime-unknown-role-source');
  });

  it('keeps adapted textbook candidates eligible for controlled answer profiles', () => {
    const adapted = adaptTextbookSearchDocument(textbookDoc());
    const result = retrieveSourcePack({
      query: 'root locus',
      profile: 'konling-answer',
      role: 'student',
      candidates: [adapted.item],
      now: new Date('2026-06-28T00:00:00Z'),
    });
    expect(result.pack.items.map((packItem) => packItem.id)).toEqual(['textbook-root-locus']);
    expect(result.pack.limitations.map((limitation) => limitation.code)).not.toContain('profile-filtered-review-state');
  });

  it('keeps canonical LearningEvidence adapter output eligible for authoring retrieval', () => {
    const adapted = adaptLearningEvidenceChunk(canonicalChunk(), { role: 'teacher', useCase: 'konling' });
    expect(adapted.item).not.toBeNull();
    const result = retrieveSourcePack({
      query: 'root locus',
      profile: 'handout-authoring',
      role: 'teacher',
      candidates: adapted.item ? [adapted.item] : [],
      now: new Date('2026-06-28T00:00:00Z'),
    });
    expect(result.pack.items.map((packItem) => packItem.id)).toEqual(['learning-evidence:canonical-root-locus']);
    expect(result.pack.limitations.map((limitation) => limitation.code)).not.toContain('profile-filtered-review-state');
  });

  it('keeps path-planning citation evidence separate from path-eligible resources', () => {
    const result = retrieveSourcePack({
      query: 'root locus path',
      profile: 'path-planning',
      role: 'teacher',
      graphNodeRefs: ['kn-root-locus'],
      candidates: [
        item({
          id: 'path-resource',
          sourceKind: 'runtime-lesson',
          resourceNodeId: 'resource:root-locus',
          planningUnitId: 'planning:root-locus',
          scores: { ...item().scores, eligibility: 0.95 },
        }),
        item({
          id: 'citation-support',
          sourceKind: 'textbook',
          resourceNodeId: undefined,
          planningUnitId: undefined,
        }),
      ],
      now: new Date('2026-06-28T00:00:00Z'),
    });
    expect(result.pack.items.map((packItem) => packItem.id)).toContain('path-resource');
    expect(result.pack.items.map((packItem) => packItem.id)).toContain('citation-support');
    expect(result.pack.limitations.map((limitation) => limitation.code)).toContain('path-planning-citation-only-evidence');
  });
});

describe('source pack hybrid ranking', () => {
  it('preserves exact technical matches when semantic scores are weak', () => {
    const result = retrieveSourcePack({
      query: 'PID integral action',
      profile: 'handout-authoring',
      role: 'teacher',
      candidates: [
        item({
          id: 'exact-pid',
          title: 'PID integral action',
          excerpt: 'Integral action removes steady-state error.',
        }),
        item({
          id: 'semantic-only',
          title: 'Control overview',
          excerpt: 'General control-system discussion.',
        }),
      ],
      semanticScores: {
        'exact-pid': 0.01,
        'semantic-only': 0.95,
      },
      now: new Date('2026-06-28T00:00:00Z'),
    });
    expect(result.ranked[0].item.id).toBe('exact-pid');
    expect(result.pack.items[0].id).toBe('exact-pid');
  });

  it('preserves formula and exercise-id matches without semantic scores', () => {
    const result = retrieveSourcePack({
      query: 'exercise:pid-001 K/(s(Ts+1))',
      profile: 'assessment-item',
      role: 'teacher',
      candidates: [
        item({
          id: 'formula-match',
          title: 'Exercise PID-001 transfer function',
          excerpt: 'Use K/(s(Ts+1)) to identify the controlled object dynamics.',
          metadata: { reviewStatus: 'human-confirmed', resourceIds: ['exercise:pid-001'] },
        }),
        item({
          id: 'authority-only',
          title: 'Assessment overview',
          excerpt: 'General assessment guidance.',
          scores: { ...item().scores, authority: 1, relevance: 0.9, final: 0.9 },
        }),
      ],
      now: new Date('2026-06-28T00:00:00Z'),
    });
    expect(result.ranked[0].item.id).toBe('formula-match');
  });

  it('uses learner context refs as a ranking signal', () => {
    const result = retrieveSourcePack({
      query: 'steady state error',
      profile: 'konling-answer',
      role: 'student',
      learnerContextRefs: ['learner:needs-integral-action'],
      candidates: [
        item({
          id: 'generic-steady-state',
          title: 'Steady state error overview',
          citationTargetId: 'citation:generic-steady-state',
        }),
        item({
          id: 'learner-context-aligned',
          title: 'Steady state error integral action',
          citationTargetId: 'citation:learner-context-aligned',
          metadata: {
            reviewStatus: 'human-confirmed',
            knowledgeNodeRefs: ['kn-root-locus'],
            learnerContextRefs: ['learner:needs-integral-action'],
          },
        }),
      ],
      now: new Date('2026-06-28T00:00:00Z'),
    });
    expect(result.ranked[0].item.id).toBe('learner-context-aligned');
  });

  it('uses graph and capability context to rerank governed candidates', () => {
    const result = retrieveSourcePack({
      query: 'stability',
      profile: 'lesson-design',
      role: 'teacher',
      graphNodeRefs: ['kn-target'],
      capabilityTargetRefs: ['cap-target'],
      candidates: [
        item({
          id: 'lexical-only',
          title: 'Stability concept',
          metadata: { reviewStatus: 'human-confirmed', knowledgeNodeRefs: ['kn-other'] },
        }),
        item({
          id: 'graph-aligned',
          title: 'Stability graph evidence',
          metadata: { reviewStatus: 'human-confirmed', knowledgeNodeRefs: ['kn-target'], capabilityTargetRefs: ['cap-target'] },
        }),
      ],
      now: new Date('2026-06-28T00:00:00Z'),
    });
    expect(result.ranked[0].item.id).toBe('graph-aligned');
  });
});

describe('source pack assembly and evaluation', () => {
  it('bounds excerpts, diversifies repeated sources, and reports missing coverage', () => {
    const longExcerpt = 'Root locus '.repeat(80);
    const result = retrieveSourcePack({
      query: 'root locus',
      profile: 'konling-answer',
      role: 'student',
      topK: 3,
      graphNodeRefs: ['kn-root-locus', 'kn-missing'],
      candidates: [
        item({ id: 'same-resource-1', excerpt: longExcerpt, resourceNodeId: 'resource:same', retrievalChunkId: 'chunk:same:1', citationTargetId: 'citation:same:1' }),
        item({ id: 'same-resource-2', excerpt: longExcerpt, resourceNodeId: 'resource:same', retrievalChunkId: 'chunk:same:2', citationTargetId: 'citation:same:2' }),
        item({ id: 'image-resource', modality: 'image', sourceKind: 'runtime-lesson', retrievalChunkId: 'chunk:image', citationTargetId: 'citation:image' }),
      ],
      now: new Date('2026-06-28T00:00:00Z'),
    });
    expect(result.pack.items.every((packItem) => packItem.excerpt.length <= 220)).toBe(true);
    expect(result.pack.items.map((packItem) => packItem.id)).not.toContain('same-resource-2');
    expect(result.pack.coverage.eligibleItems).toBe(3);
    expect(result.pack.coverage.omittedItems).toBe(1);
    expect(result.pack.coverage.coverageRatio).toBe(2 / 3);
    expect(result.pack.limitations.map((limitation) => limitation.code)).toEqual(expect.arrayContaining([
      'source-pack-excerpt-truncated',
      'diversity-resource',
      'coverage-missing-knowledge-node',
    ]));
  });

  it('evaluates representative query fixtures and citation readiness', () => {
    expect(sourcePackEvaluationFixtures).toContain('phase margin');
    const evaluation = evaluateSourcePackRetrieval({
      id: 'root-locus-konling',
      minItems: 1,
      requiredCitationReady: true,
      requiredDiversity: false,
      input: {
        query: 'root locus',
        profile: 'konling-answer',
        role: 'student',
        candidates: [item({ id: 'citation-ready', citationTargetId: 'citation:ready' })],
        now: new Date('2026-06-28T00:00:00Z'),
      },
    });
    expect(evaluation.passed).toBe(true);
    expect(evaluation.failures).toEqual([]);
  });

  it('keeps non-ASCII course queries distinct in query ids', () => {
    const rootLocus = retrieveSourcePack({
      query: '根轨迹',
      profile: 'konling-answer',
      role: 'student',
      candidates: [item({ id: 'root-locus-cn', citationTargetId: 'citation:root-locus-cn' })],
      now: new Date('2026-06-28T00:00:00Z'),
    });
    const phaseMargin = retrieveSourcePack({
      query: '相位裕度',
      profile: 'konling-answer',
      role: 'student',
      candidates: [item({ id: 'phase-margin-cn', citationTargetId: 'citation:phase-margin-cn' })],
      now: new Date('2026-06-28T00:00:00Z'),
    });
    expect(rootLocus.pack.query.queryId).not.toBe(phaseMargin.pack.query.queryId);
    expect(rootLocus.pack.query.queryId).toContain('根轨迹');
    expect(phaseMargin.pack.query.queryId).toContain('相位裕度');
  });

  it('evaluates no-result failure modes with limitation evidence', () => {
    const evaluation = evaluateSourcePackRetrieval({
      id: 'konling-no-eligible-candidates',
      minItems: 1,
      requiredLimitationCodes: ['source-pack-no-eligible-candidates', 'profile-filtered-visibility'],
      input: {
        query: 'root locus',
        profile: 'konling-answer',
        role: 'student',
        candidates: [
          item({
            id: 'teacher-only-failure-mode',
            access: { visibility: 'teacher', aiUseAllowed: true },
          }),
        ],
        now: new Date('2026-06-28T00:00:00Z'),
      },
    });
    expect(evaluation.passed).toBe(false);
    expect(evaluation.limitationCodes).toEqual(expect.arrayContaining([
      'source-pack-no-eligible-candidates',
      'profile-filtered-visibility',
    ]));
    expect(JSON.stringify(evaluation)).not.toContain('teacher-only-failure-mode');
  });
});
