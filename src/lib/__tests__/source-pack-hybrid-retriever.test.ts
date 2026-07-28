import { describe, expect, it } from 'vitest';

import {
  adaptLearningEvidenceChunk,
  adaptResourceProjectionRow,
  adaptTextbookStructureUnit,
  evaluateSourcePackRetrieval,
  getSourcePackRetrievalProfile,
  retrieveSourcePack,
  serializeSourcePackJson,
  sourcePackEvaluationFixtures,
  type SourcePackItem,
} from '../source-pack';
import type { LearningEvidenceCorpusChunk } from '../data-governance/learning-evidence-rag-corpus';
import type { RuntimeResourceProjectionArtifactRow } from '../runtime-resource-projections';
import type { TextbookStructureUnitProjection } from '../structured-textbook-runtime';

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

function projectionRow(overrides: Partial<RuntimeResourceProjectionArtifactRow> = {}): RuntimeResourceProjectionArtifactRow {
  return {
    artifactVersion: 'runtime-resource-projections.v1',
    id: 'projection:citation-target:root-locus',
    resourceNodeId: 'resource:root-locus',
    family: 'runtime-handout',
    resourceType: 'textbook_section',
    sourceKind: 'runtime_handout',
    sourceRef: 'runtime-handout:root-locus',
    sourcePathOrUrl: '/course-runtime/root-locus',
    sourceRecord: 'runtime-handout:root-locus',
    sourceHash: 'sha256:root-locus',
    sourceVersionRef: 'runtime.v1',
    projectionLevel: 'CitationTarget',
    routeTarget: '/course-runtime/root-locus',
    renderTarget: '/course-runtime/root-locus',
    title: 'Root locus citation target',
    graphNodeRefs: {
      knowledge: ['kn-root-locus'],
      capability: ['cap-analysis'],
      quality: [],
    },
    estimatedTimeMinutes: 4,
    evidenceInstrumentation: ['view:root-locus'],
    privacyScope: 'student-visible',
    teacherPolicy: 'allowed',
    evidenceContract: {
      eventSource: true,
      eventType: true,
      clientEventIdPolicy: true,
      attemptKey: true,
      sourceLogId: true,
      dedupeKey: true,
      timestamps: true,
      learningFactPolicy: true,
      confidencePolicy: true,
      privacyScope: true,
      complete: true,
    },
    reviewAudit: {
      status: 'human-confirmed',
      reviewerId: 'teacher-001',
      reviewerRole: 'teacher',
      reviewedAt: '2026-06-28T00:00:00.000Z',
      reviewBatchId: 'review-batch:root-locus',
      reviewedSourceHash: 'sha256:root-locus',
      reviewedVersionRef: 'runtime.v1',
      generationToolOrModel: null,
      promptOrManifestHash: null,
      confidence: 0.95,
      staleInvalidationRule: 'source-hash-change',
    },
    reviewConcluded: true,
    semanticConfirmed: true,
    segmentRefs: ['segment:root-locus'],
    citationTargets: ['source-pack-citation:root-locus'],
    retrievalChunk: {
      id: 'retrieval-chunk:root-locus',
      pathEligible: false,
      reason: 'resource-node-planning-audit-required',
    },
    pathEligibility: {
      current: false,
      afterCompletion: false,
      masteryAffecting: false,
      blockedBy: ['missing-path-target'],
    },
    groundingEligibility: {
      retrievalReady: true,
      citationReady: true,
      authoringTriageReady: true,
    },
    versionRefs: {
      artifactVersioningVersion: 'kaq-artifact-versioning.v1',
      resourceRegistryVersion: 'resource-node-registry.v1',
      resourceProjectionVersion: 'resource-semantic-projection.v1',
    },
    ...overrides,
  };
}

function textbookDoc(): TextbookStructureUnitProjection {
  return {
    id: 'textbook-unit:dorf-modern-control-systems@14th-global-edition/chapter-chapter-02/section-2.1',
    kind: 'section',
    title: 'Root locus textbook section',
    href: '/textbooks/dorf-modern-control-systems/14th%20Global%20Edition/chapter-chapter-02/section-2.1',
    text: 'Root locus explains closed-loop pole movement.',
    contentHash: 'sha256:textbook-root-locus',
    identity: {
      bookId: 'dorf-modern-control-systems',
      edition: '14th Global Edition',
      sourceRevision: 'revision-001',
      unitId: 'textbook-unit:dorf-modern-control-systems@14th-global-edition/chapter-chapter-02/section-2.1',
      fragmentId: null,
    },
    fragments: [],
    resourceProjection: {
      resourceId: 'res-textbook-root-locus',
      segmentRef: 'seg-textbook-root-locus',
      citationTargetRef: 'textbook:root-locus:citation',
      knowledgeNodeRefs: ['kn-root-locus'],
      capabilityTargetRefs: ['cap-analysis'],
      contentHash: 'sha256:textbook-root-locus',
      versionRefs: {
        artifactVersioningVersion: 'kaq-artifact-versioning.v1',
      },
    },
    citationAddress: {
      kind: 'text',
      sourceRefId: 'textbook-unit:dorf-modern-control-systems@14th-global-edition/chapter-chapter-02/section-2.1',
      href: '/textbooks/dorf-modern-control-systems/14th%20Global%20Edition/chapter-chapter-02/section-2.1',
      locator: 'textbook-unit:dorf-modern-control-systems@14th-global-edition/chapter-chapter-02/section-2.1',
      contentHash: 'sha256:textbook-root-locus',
    },
    metadata: {
      bookId: 'dorf-modern-control-systems',
      edition: '14th Global Edition',
      sourceRevision: 'revision-001',
      unitId: 'textbook-unit:dorf-modern-control-systems@14th-global-edition/chapter-chapter-02/section-2.1',
      chapterId: 'ch02',
      naturalNumber: '2.1',
      structuralPath: ['chapter-chapter-02', 'section-2.1'],
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
    expect(getSourcePackRetrievalProfile('konling-answer').allowedReviewStatuses).toContain('model-cleared');
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

  it('requires verified hydrated citations for citation-ready profiles', () => {
    const result = retrieveSourcePack({
      query: 'root locus',
      profile: 'konling-answer',
      role: 'student',
      candidates: [
        item({
          id: 'verified-citation',
          citationTargetId: 'citation:verified',
          citation: {
            citationTargetId: 'citation:verified',
            sourceId: 'source:verified',
            displayTitle: 'Verified source',
            href: '/course-runtime/verified',
            resolver: 'course-runtime',
            verified: true,
          },
        }),
        item({
          id: 'unverified-citation',
          citationTargetId: 'citation:unverified',
          citation: {
            citationTargetId: 'citation:unverified',
            sourceId: 'source:unverified',
            displayTitle: 'Unverified source',
            href: undefined,
            verified: false,
          },
        }),
      ],
      now: new Date('2026-06-28T00:00:00Z'),
    });

    expect(result.pack.items.map((packItem) => packItem.id)).toEqual(['verified-citation']);
    expect(result.pack.limitations.map((limitation) => limitation.code)).toContain('profile-filtered-citation-readiness');
    expect(JSON.stringify(result.pack.limitations)).not.toContain('unverified-citation');
  });

  it('omits filtered candidate semantic scores from student-visible query filters', () => {
    const result = retrieveSourcePack({
      query: 'root locus',
      profile: 'konling-answer',
      role: 'student',
      candidates: [
        item({ id: 'eligible', title: 'Root locus citation', citationTargetId: 'citation:eligible' }),
        item({
          id: 'teacher-only',
          title: 'Teacher only source',
          citationTargetId: 'citation:teacher-only',
          access: { visibility: 'teacher', aiUseAllowed: true },
        }),
        item({
          id: 'restricted-source',
          title: 'Restricted source',
          citationTargetId: 'citation:restricted-source',
          access: { visibility: 'restricted', aiUseAllowed: true },
        }),
      ],
      semanticScores: {
        eligible: 0.7,
        'teacher-only': 0.99,
        'restricted-source': 0.98,
      },
      now: new Date('2026-06-28T00:00:00Z'),
    });
    expect(result.pack.query.filters).toMatchObject({
      'semanticScore:eligible': 0.7,
    });
    expect(result.pack.query.filters).not.toHaveProperty('semanticScore:teacher-only');
    expect(result.pack.query.filters).not.toHaveProperty('semanticScore:restricted-source');
    expect(JSON.stringify(result.pack)).not.toContain('teacher-only');
    expect(JSON.stringify(result.pack)).not.toContain('restricted-source');
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
        recoverable: false,
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
    const adapted = adaptTextbookStructureUnit(textbookDoc());
    const result = retrieveSourcePack({
      query: 'root locus',
      profile: 'konling-answer',
      role: 'student',
      candidates: [adapted.item],
      now: new Date('2026-06-28T00:00:00Z'),
    });
    expect(result.pack.items.map((packItem) => packItem.id)).toEqual([textbookDoc().id]);
    expect(result.pack.limitations.map((limitation) => limitation.code)).not.toContain('profile-filtered-review-state');
  });

  it('rejects high-authority konling-answer chunks without answer relevance', () => {
    const result = retrieveSourcePack({
      query: 'I have a problem understanding Nyquist stability margin',
      profile: 'konling-answer',
      role: 'student',
      candidates: [
        item({
          id: 'ch01-advanced-problems-031__chunk-001',
          title: 'ADVANCED PROBLEMS',
          excerpt: 'Problems for synthesizing introductory examples and design discussion.',
          citationTargetId: 'citation:advanced-problems-031',
          retrievalChunkId: 'textbook-search:ch01-advanced-problems-031__chunk-001',
          scores: {
            relevance: 0.95,
            graphAlignment: 0.95,
            authority: 1,
            eligibility: 0.95,
            freshness: 0.9,
            final: 0.95,
          },
          metadata: {
            reviewStatus: 'canonical',
            knowledgeNodeRefs: ['broad-control-system'],
            capabilityTargetRefs: ['general-problem-solving'],
          },
        }),
        item({
          id: 'nyquist-relevant',
          title: 'Nyquist stability margin',
          excerpt: 'Nyquist stability margin and phase crossover evidence.',
          citationTargetId: 'citation:nyquist-relevant',
          retrievalChunkId: 'textbook-search:nyquist-relevant',
          metadata: {
            reviewStatus: 'canonical',
            knowledgeNodeRefs: ['kn-nyquist'],
          },
        }),
      ],
      now: new Date('2026-07-08T00:00:00Z'),
    });

    expect(result.pack.items.map((packItem) => packItem.id)).toEqual(['nyquist-relevant']);
    expect(JSON.stringify(result.pack)).not.toContain('ch01-advanced-problems-031__chunk-001');
    expect(result.pack.items[0].metadata).toMatchObject({
      answerRelevancePassed: true,
      answerRelevanceBasis: 'query-lexical',
    });
    expect(result.pack.limitations.map((limitation) => limitation.code)).toContain('answer-citation-insufficient-relevance');
  });

  it('keeps Chinese technical query matches without graph refs', () => {
    const result = retrieveSourcePack({
      query: '传递函数怎么理解？',
      profile: 'konling-answer',
      role: 'student',
      candidates: [
        item({
          id: 'transfer-function-cn',
          title: '传递函数',
          excerpt: '传递函数描述系统输入与输出之间的动态关系。',
          citationTargetId: 'citation:transfer-function-cn',
          retrievalChunkId: 'textbook-search:transfer-function-cn',
          metadata: {
            reviewStatus: 'canonical',
          },
        }),
        item({
          id: 'ch01-advanced-problems-031__chunk-001',
          title: 'ADVANCED PROBLEMS',
          excerpt: 'Problems for synthesizing introductory examples and design discussion.',
          citationTargetId: 'citation:advanced-problems-031',
          retrievalChunkId: 'textbook-search:ch01-advanced-problems-031__chunk-001',
          scores: { ...item().scores, graphAlignment: 1, authority: 1 },
          metadata: {
            reviewStatus: 'canonical',
          },
        }),
      ],
      now: new Date('2026-07-08T00:00:00Z'),
    });

    expect(result.pack.items.map((packItem) => packItem.id)).toEqual(['transfer-function-cn']);
    expect(result.ranked[0].item.metadata).toMatchObject({
      answerRelevanceBasis: 'query-lexical',
      answerRelevanceMatch: 'token:传递函数',
    });
    expect(result.pack.items[0].metadata).toMatchObject({
      answerRelevancePassed: true,
      answerRelevanceBasis: 'query-lexical',
    });
    expect(result.pack.items[0].metadata).not.toHaveProperty('answerRelevanceMatch');
    expect(result.pack.limitations.map((limitation) => limitation.code)).toContain('answer-citation-insufficient-relevance');
  });

  it.each([
    ['稳定性怎么判断？', '稳定性'],
    ['阻尼比如何影响响应？', '阻尼比'],
    ['单位阶跃响应怎么看？', '单位阶跃响应'],
  ])('keeps high-frequency Chinese answer terms without graph refs: %s', (query, term) => {
    const result = retrieveSourcePack({
      query,
      profile: 'konling-answer',
      role: 'student',
      candidates: [
        item({
          id: `cn-${term}`,
          title: term,
          excerpt: `${term} 是控制系统分析中的核心概念。`,
          citationTargetId: `citation:cn-${term}`,
          retrievalChunkId: `textbook-search:cn-${term}`,
          metadata: {
            reviewStatus: 'canonical',
          },
        }),
      ],
      now: new Date('2026-07-08T00:00:00Z'),
    });

    expect(result.pack.items.map((packItem) => packItem.id)).toEqual([`cn-${term}`]);
    expect(result.ranked[0].item.metadata).toMatchObject({
      answerRelevanceBasis: 'query-lexical',
      answerRelevanceMatch: `token:${term}`,
    });
    expect(result.pack.items[0].metadata).toMatchObject({
      answerRelevancePassed: true,
      answerRelevanceBasis: 'query-lexical',
    });
    expect(result.pack.items[0].metadata).not.toHaveProperty('answerRelevanceMatch');
    expect(result.pack.items[0].metadata).not.toHaveProperty('answerRelevanceQueryHash');
  });

  it('does not treat short Chinese terms in generic problem rows as sufficient answer relevance', () => {
    const result = retrieveSourcePack({
      query: '闭环',
      profile: 'konling-answer',
      role: 'student',
      candidates: [
        item({
          id: 'ch01-advanced-problems-031__chunk-001',
          title: 'ADVANCED PROBLEMS',
          excerpt: '包含若干开环和闭环系统设计综合习题，用于章节复习。',
          citationTargetId: 'citation:advanced-problems-031',
          retrievalChunkId: 'textbook-search:ch01-advanced-problems-031__chunk-001',
          scores: { ...item().scores, graphAlignment: 1, authority: 1 },
          metadata: {
            reviewStatus: 'canonical',
          },
        }),
      ],
      now: new Date('2026-07-08T00:00:00Z'),
    });

    expect(result.pack.items).toEqual([]);
    expect(result.pack.limitations.map((limitation) => limitation.code)).toEqual(expect.arrayContaining([
      'answer-citation-insufficient-relevance',
      'coverage-missing-answer-context',
    ]));
  });

  it('keeps short Chinese terms when they appear in reference text', () => {
    const result = retrieveSourcePack({
      query: '闭环',
      profile: 'konling-answer',
      role: 'student',
      candidates: [
        item({
          id: 'closed-loop-cn',
          title: '闭环',
          excerpt: '系统输出经过反馈后作用于输入端。',
          citationTargetId: 'citation:closed-loop-cn',
          retrievalChunkId: 'textbook-search:closed-loop-cn',
          metadata: {
            reviewStatus: 'canonical',
          },
        }),
      ],
      now: new Date('2026-07-08T00:00:00Z'),
    });

    expect(result.pack.items.map((packItem) => packItem.id)).toEqual(['closed-loop-cn']);
    expect(result.pack.items[0].metadata).toMatchObject({
      answerRelevancePassed: true,
      answerRelevanceBasis: 'query-exact',
    });
  });

  it.each([
    'root',
    'root cause of my error',
  ])('does not treat a standalone root token as sufficient answer relevance: %s', (query) => {
    const result = retrieveSourcePack({
      query,
      profile: 'konling-answer',
      role: 'student',
      candidates: [
        item({
          id: 'root-locus-reference',
          title: 'Root locus',
          excerpt: 'Root locus explains closed-loop pole movement.',
          citationTargetId: 'citation:root-locus-reference',
          retrievalChunkId: 'textbook-search:root-locus-reference',
          metadata: {
            reviewStatus: 'canonical',
          },
        }),
      ],
      now: new Date('2026-07-08T00:00:00Z'),
    });

    expect(result.pack.items).toEqual([]);
    expect(result.pack.limitations.map((limitation) => limitation.code)).toEqual(expect.arrayContaining([
      'answer-citation-insufficient-relevance',
      'coverage-missing-answer-context',
    ]));
  });

  it('reports missing answer context when no konling-answer item passes relevance', () => {
    const result = retrieveSourcePack({
      query: 'I have a problem understanding Nyquist stability margin',
      profile: 'konling-answer',
      role: 'student',
      candidates: [
        item({
          id: 'ch01-advanced-problems-031__chunk-001',
          title: 'ADVANCED PROBLEMS',
          excerpt: 'Problems for synthesizing introductory examples and design discussion.',
          citationTargetId: 'citation:advanced-problems-031',
          retrievalChunkId: 'textbook-search:ch01-advanced-problems-031__chunk-001',
          scores: { ...item().scores, graphAlignment: 1, authority: 1 },
          metadata: {
            reviewStatus: 'canonical',
            knowledgeNodeRefs: ['broad-control-system'],
          },
        }),
      ],
      now: new Date('2026-07-08T00:00:00Z'),
    });

    expect(result.pack.items).toEqual([]);
    expect(result.pack.limitations.map((limitation) => limitation.code)).toEqual(expect.arrayContaining([
      'answer-citation-insufficient-relevance',
      'coverage-missing-answer-context',
    ]));
  });

  it('redacts private answer-relevance match details from student-visible packs', () => {
    const result = retrieveSourcePack({
      query: 'unrelated prompt',
      profile: 'konling-answer',
      role: 'student',
      learnerContextRefs: ['learner:private-sar-ref'],
      candidates: [
        item({
          id: 'learner-context-only',
          title: 'Personalized guidance',
          excerpt: 'Guidance that is selected only through learner context.',
          citationTargetId: 'citation:learner-context-only',
          metadata: {
            reviewStatus: 'canonical',
            learnerContextRefs: ['learner:private-sar-ref'],
          },
        }),
      ],
      now: new Date('2026-07-08T00:00:00Z'),
    });

    expect(result.pack.items).toEqual([
      expect.objectContaining({
        id: 'learner-context-only',
        metadata: expect.objectContaining({
          answerRelevancePassed: true,
          answerRelevanceBasis: 'learner-context-ref',
        }),
      }),
    ]);
    expect(JSON.stringify(result.pack.items[0].metadata)).not.toContain('learner:private-sar-ref');
    expect(result.pack.items[0].metadata).not.toHaveProperty('answerRelevanceMatch');
    expect(result.pack.items[0].metadata).not.toHaveProperty('answerRelevanceQueryHash');
  });

  it('does not apply the answer relevance gate to non-answer profiles', () => {
    const result = retrieveSourcePack({
      query: 'Nyquist stability margin',
      profile: 'handout-authoring',
      role: 'teacher',
      candidates: [
        item({
          id: 'ch01-advanced-problems-031__chunk-001',
          title: 'ADVANCED PROBLEMS',
          excerpt: 'Problems for synthesizing introductory examples and design discussion.',
          citationTargetId: 'citation:advanced-problems-031',
          retrievalChunkId: 'textbook-search:ch01-advanced-problems-031__chunk-001',
          scores: { ...item().scores, graphAlignment: 1, authority: 1 },
          metadata: {
            reviewStatus: 'canonical',
            knowledgeNodeRefs: ['broad-control-system'],
          },
        }),
      ],
      now: new Date('2026-07-08T00:00:00Z'),
    });

    expect(result.pack.items.map((packItem) => packItem.id)).toEqual(['ch01-advanced-problems-031__chunk-001']);
    expect(result.pack.limitations.map((limitation) => limitation.code)).not.toContain('answer-citation-insufficient-relevance');
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

  it('allows CitationTarget projection rows as citation-only path-planning evidence', () => {
    const adapted = adaptResourceProjectionRow(projectionRow({
      projectionLevel: 'CitationTarget',
      pathEligibility: {
        current: false,
        afterCompletion: false,
        masteryAffecting: false,
        blockedBy: ['missing-path-target'],
      },
    }));

    expect(adapted.item.sourceKind).toBe('reference');
    expect(adapted.item.resourceNodeId).toBeUndefined();
    expect(adapted.item.planningUnitId).toBeUndefined();

    const result = retrieveSourcePack({
      query: 'root locus path',
      profile: 'path-planning',
      role: 'teacher',
      graphNodeRefs: ['kn-root-locus'],
      resourceIds: ['resource:root-locus'],
      candidates: [adapted.item],
      now: new Date('2026-06-28T00:00:00Z'),
    });

    expect(result.pack.items.map((packItem) => packItem.id)).toEqual(['projection:citation-target:root-locus']);
    expect(result.pack.items[0].sourceKind).toBe('reference');
    expect(result.pack.items[0].resourceNodeId).toBeUndefined();
    expect(result.pack.limitations.map((limitation) => limitation.code)).toContain('path-planning-citation-only-evidence');
    expect(result.pack.limitations.map((limitation) => limitation.code)).toContain('coverage-missing-resource');
    expect(result.pack.limitations.map((limitation) => limitation.code)).not.toContain('profile-filtered-source-kind');
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

  it('reports missing resource, learning goal, and quality target coverage', () => {
    const result = retrieveSourcePack({
      query: 'stability',
      profile: 'lesson-design',
      role: 'teacher',
      resourceIds: ['resource-missing'],
      learningGoalIds: ['goal-missing'],
      qualityTargetRefs: ['quality-missing'],
      candidates: [
        item({
          id: 'general-stability',
          title: 'Stability concept',
          metadata: { reviewStatus: 'human-confirmed', resourceIds: ['resource-present'] },
        }),
      ],
      now: new Date('2026-06-28T00:00:00Z'),
    });
    expect(result.pack.limitations.map((limitation) => limitation.code)).toEqual(expect.arrayContaining([
      'coverage-missing-resource',
      'coverage-missing-learning-goal',
      'coverage-missing-quality-target',
      'coverage-missing-modality',
    ]));
  });

  it('reports missing modality coverage declared by the retrieval profile', () => {
    const textOnly = retrieveSourcePack({
      query: 'stability',
      profile: 'lesson-design',
      role: 'teacher',
      candidates: [
        item({
          id: 'text-stability',
          title: 'Text stability concept',
          modality: 'text',
          metadata: { reviewStatus: 'human-confirmed' },
        }),
      ],
      now: new Date('2026-06-28T00:00:00Z'),
    });
    expect(textOnly.pack.limitations.filter((limitation) => limitation.code === 'coverage-missing-modality').map((limitation) => limitation.message)).toEqual([
      'No selected Source Pack item covers modality image.',
      'No selected Source Pack item covers modality interactive.',
    ]);

    const complete = retrieveSourcePack({
      query: 'stability',
      profile: 'lesson-design',
      role: 'teacher',
      candidates: [
        item({ id: 'text-stability', modality: 'text', retrievalChunkId: 'chunk:text', citationTargetId: 'citation:text', metadata: { reviewStatus: 'human-confirmed', resourceId: 'resource:text' } }),
        item({ id: 'image-stability', modality: 'image', sourceKind: 'runtime-lesson', retrievalChunkId: 'chunk:image', citationTargetId: 'citation:image', metadata: { reviewStatus: 'human-confirmed', resourceId: 'resource:image' } }),
        item({ id: 'interactive-stability', modality: 'interactive', sourceKind: 'simulation', retrievalChunkId: 'chunk:interactive', citationTargetId: 'citation:interactive', metadata: { reviewStatus: 'human-confirmed', resourceId: 'resource:interactive' } }),
      ],
      now: new Date('2026-06-28T00:00:00Z'),
    });
    expect(complete.pack.limitations.map((limitation) => limitation.code)).not.toContain('coverage-missing-modality');
  });

  it('does not report resource coverage missing when selected items carry resource refs', () => {
    const result = retrieveSourcePack({
      query: 'stability',
      profile: 'lesson-design',
      role: 'teacher',
      resourceIds: [
        'resource-node-present',
        'planning-unit-present',
        'resource-metadata-single',
        'resource-metadata-array',
      ],
      candidates: [
        item({
          id: 'resource-node-item',
          title: 'Stability resource node',
          retrievalChunkId: 'chunk:resource-node',
          citationTargetId: 'citation:resource-node',
          resourceNodeId: 'resource-node-present',
          metadata: { reviewStatus: 'human-confirmed' },
        }),
        item({
          id: 'planning-unit-item',
          title: 'Stability planning unit',
          sourceKind: 'runtime-lesson',
          retrievalChunkId: 'chunk:planning-unit',
          citationTargetId: 'citation:planning-unit',
          planningUnitId: 'planning-unit-present',
          metadata: { reviewStatus: 'human-confirmed' },
        }),
        item({
          id: 'resource-metadata-single-item',
          title: 'Stability single metadata resource',
          sourceKind: 'knowledge-card',
          retrievalChunkId: 'chunk:metadata-single',
          citationTargetId: 'citation:metadata-single',
          metadata: { reviewStatus: 'human-confirmed', resourceId: 'resource-metadata-single' },
        }),
        item({
          id: 'resource-metadata-array-item',
          title: 'Stability array metadata resource',
          sourceKind: 'exercise',
          retrievalChunkId: 'chunk:metadata-array',
          citationTargetId: 'citation:metadata-array',
          metadata: { reviewStatus: 'human-confirmed', resourceIds: ['resource-metadata-array'] },
        }),
      ],
      now: new Date('2026-06-28T00:00:00Z'),
    });
    expect(result.pack.limitations.map((limitation) => limitation.code)).not.toContain('coverage-missing-resource');
  });

  it('reranks single resourceId metadata into selected coverage', () => {
    const competitors = Array.from({ length: 8 }, (_, index) => item({
      id: `competitor-${index}`,
      title: `General candidate ${index}`,
      excerpt: 'General course material.',
      sourceKind: 'reference',
      retrievalChunkId: `chunk:competitor-${index}`,
      citationTargetId: `citation:competitor-${index}`,
      scores: { ...item().scores, relevance: 0.45, graphAlignment: 0, authority: 0.45, freshness: 0.45, eligibility: 0.45, final: 0.45 },
      metadata: { reviewStatus: 'human-confirmed' },
    }));
    const candidates = [
      ...competitors,
      item({
        id: 'resource-metadata-single-item',
        title: 'Target resource metadata',
        excerpt: 'Target course material.',
        sourceKind: 'textbook',
        retrievalChunkId: 'chunk:metadata-single',
        citationTargetId: 'citation:metadata-single',
        scores: { ...item().scores, relevance: 0.05, graphAlignment: 0, authority: 0.05, freshness: 0.05, eligibility: 0.05, final: 0.05 },
        metadata: { reviewStatus: 'human-confirmed', resourceId: 'resource-metadata-single' },
      }),
    ];
    const withoutResourceContext = retrieveSourcePack({
      query: 'neutral topic',
      profile: 'lesson-design',
      role: 'teacher',
      topK: 3,
      candidates,
      now: new Date('2026-06-28T00:00:00Z'),
    });
    expect(withoutResourceContext.pack.items.map((packItem) => packItem.id)).not.toContain('resource-metadata-single-item');

    const result = retrieveSourcePack({
      query: 'neutral topic',
      profile: 'lesson-design',
      role: 'teacher',
      topK: 3,
      resourceIds: ['resource-metadata-single'],
      candidates,
      now: new Date('2026-06-28T00:00:00Z'),
    });
    expect(result.pack.items.map((packItem) => packItem.id)).toContain('resource-metadata-single-item');
    expect(result.pack.limitations.map((limitation) => limitation.code)).not.toContain('coverage-missing-resource');
  });

  it('persists fused rank score into selected pack items', () => {
    const result = retrieveSourcePack({
      query: 'rare exact stability phrase',
      profile: 'lesson-design',
      role: 'teacher',
      topK: 1,
      candidates: [
        item({
          id: 'high-raw-final',
          title: 'General stability reference',
          excerpt: 'General course material.',
          scores: { ...item().scores, relevance: 0.95, graphAlignment: 0, authority: 0.95, freshness: 0.95, eligibility: 0.95, final: 0.95 },
          metadata: { reviewStatus: 'human-confirmed' },
        }),
        item({
          id: 'exact-low-raw-final',
          title: 'Rare exact stability phrase',
          excerpt: 'The rare exact stability phrase is explained here.',
          sourceKind: 'reference',
          retrievalChunkId: 'chunk:exact-low-final',
          citationTargetId: 'citation:exact-low-final',
          scores: { ...item().scores, relevance: 0.05, graphAlignment: 0, authority: 0.05, freshness: 0.05, eligibility: 0.05, final: 0.05 },
          metadata: { reviewStatus: 'human-confirmed' },
        }),
      ],
      now: new Date('2026-06-28T00:00:00Z'),
    });

    expect(result.pack.items.map((packItem) => packItem.id)).toEqual(['exact-low-raw-final']);
    expect(result.pack.items[0].scores.final).toBe(result.ranked[0].score);
    expect(result.pack.items[0].scores.final).toBeGreaterThan(0.05);
  });

  it('includes ranking and coverage context in Source Pack query filters', () => {
    const candidates = [
      item({
        id: 'context-resource-a',
        metadata: {
          reviewStatus: 'human-confirmed',
          resourceId: 'resource-a',
          learningGoalIds: ['goal-a'],
          qualityTargetRefs: ['quality-a'],
        },
      }),
      item({
        id: 'context-resource-b',
        title: 'Alternate context resource',
        retrievalChunkId: 'chunk:context-b',
        citationTargetId: 'citation:context-b',
        metadata: {
          reviewStatus: 'human-confirmed',
          resourceId: 'resource-b',
          learningGoalIds: ['goal-b'],
          qualityTargetRefs: ['quality-b'],
        },
      }),
    ];
    const first = retrieveSourcePack({
      query: 'context',
      profile: 'lesson-design',
      role: 'teacher',
      topK: 1,
      resourceIds: ['resource-a'],
      learningGoalIds: ['goal-a'],
      qualityTargetRefs: ['quality-a'],
      semanticScores: { 'context-resource-a': 0.8 },
      candidates,
      now: new Date('2026-06-28T00:00:00Z'),
    });
    const sameContextDifferentOrder = retrieveSourcePack({
      query: 'context',
      profile: 'lesson-design',
      role: 'teacher',
      topK: 1,
      resourceIds: ['resource-a'],
      learningGoalIds: ['goal-a'],
      qualityTargetRefs: ['quality-a'],
      semanticScores: { 'context-resource-a': 0.8 },
      candidates: [...candidates].reverse(),
      now: new Date('2026-06-28T00:00:00Z'),
    });
    const second = retrieveSourcePack({
      query: 'context',
      profile: 'lesson-design',
      role: 'teacher',
      topK: 1,
      resourceIds: ['resource-b'],
      learningGoalIds: ['goal-b'],
      qualityTargetRefs: ['quality-b'],
      semanticScores: { 'context-resource-b': 0.8 },
      candidates,
      now: new Date('2026-06-28T00:00:00Z'),
    });

    expect(first.pack.query.filters).toMatchObject({
      resourceIds: ['resource-a'],
      learningGoalIds: ['goal-a'],
      qualityTargetRefs: ['quality-a'],
      'semanticScore:context-resource-a': 0.8,
    });
    expect(first.pack.audit.queryHash).toBe(sameContextDifferentOrder.pack.audit.queryHash);
    expect(first.pack.packId).toBe(sameContextDifferentOrder.pack.packId);
    expect(first.pack.audit.queryHash).not.toBe(second.pack.audit.queryHash);
    expect(first.pack.packId).not.toBe(second.pack.packId);
  });

  it('normalizes duplicated context refs before ranking and coverage', () => {
    const candidates = [
      item({
        id: 'dedupe-context-a',
        metadata: {
          reviewStatus: 'human-confirmed',
          resourceId: 'resource-a',
          knowledgeNodeRefs: ['kn-a'],
          capabilityTargetRefs: ['cap-a'],
          qualityTargetRefs: ['quality-a'],
          learningGoalIds: ['goal-a'],
        },
      }),
    ];
    const deduped = retrieveSourcePack({
      query: 'context',
      profile: 'lesson-design',
      role: 'teacher',
      topK: 1,
      graphNodeRefs: ['kn-a', 'kn-missing'],
      capabilityTargetRefs: ['cap-a'],
      qualityTargetRefs: ['quality-a'],
      learningGoalIds: ['goal-a'],
      resourceIds: ['resource-a', 'resource-missing'],
      learnerContextRefs: ['learner-a'],
      semanticScores: { 'dedupe-context-a': 0.8054 },
      candidates,
      now: new Date('2026-06-28T00:00:00Z'),
    });
    const duplicated = retrieveSourcePack({
      query: 'context',
      profile: 'lesson-design',
      role: 'teacher',
      topK: 1,
      graphNodeRefs: ['kn-missing', 'kn-a', 'kn-a'],
      capabilityTargetRefs: ['cap-a', 'cap-a'],
      qualityTargetRefs: ['quality-a', 'quality-a'],
      learningGoalIds: ['goal-a', 'goal-a'],
      resourceIds: ['resource-missing', 'resource-a', 'resource-a'],
      learnerContextRefs: ['learner-a', 'learner-a'],
      semanticScores: { 'dedupe-context-a': 0.80544, ignored: Number.NaN },
      candidates,
      now: new Date('2026-06-28T00:00:00Z'),
    });

    expect(deduped.pack.query.filters).toMatchObject({
      graphNodeRefs: ['kn-a', 'kn-missing'],
      resourceIds: ['resource-a', 'resource-missing'],
      learnerContextRefs: ['learner-a'],
      'semanticScore:dedupe-context-a': 0.805,
    });
    expect(deduped.pack.query.filters).toEqual(duplicated.pack.query.filters);
    expect(deduped.pack.audit.queryHash).toBe(duplicated.pack.audit.queryHash);
    expect(deduped.pack.items[0].scores.final).toBe(duplicated.pack.items[0].scores.final);
    expect(deduped.pack.limitations.map((limitation) => limitation.code)).toEqual(
      duplicated.pack.limitations.map((limitation) => limitation.code),
    );
  });

  it('does not serialize learner context refs into student-visible query filters', () => {
    const result = retrieveSourcePack({
      query: 'root locus answer',
      profile: 'konling-answer',
      role: 'student',
      learnerContextRefs: ['diagnosis:learner-1:root-locus', 'personalization:learner-1'],
      candidates: [
        item({
          id: 'student-safe-citation',
          title: 'Root locus citation',
          sourceKind: 'textbook',
          citation: {
            citationTargetId: 'citation:root-locus',
            sourceId: 'textbook:root-locus',
            displayTitle: 'Root locus citation',
            href: '/course-runtime/textbook/root-locus',
            resolver: 'course-runtime',
            verified: true,
          },
          metadata: {
            reviewStatus: 'human-confirmed',
            learnerContextRefs: ['diagnosis:learner-1:root-locus'],
          },
        }),
      ],
      now: new Date('2026-06-28T00:00:00Z'),
    });

    expect(result.pack.items.map((packItem) => packItem.id)).toEqual(['student-safe-citation']);
    expect(result.pack.query.filters).not.toHaveProperty('learnerContextRefs');
    expect(result.pack.items[0].metadata).not.toHaveProperty('learnerContextRefs');
    expect(serializeSourcePackJson(result.pack)).not.toContain('learner-1');
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

  it('uses metadata resource ids for resource diversity budgets', () => {
    const result = retrieveSourcePack({
      query: 'root locus',
      profile: 'konling-answer',
      role: 'student',
      topK: 3,
      candidates: [
        item({
          id: 'same-resource-chunk-1',
          retrievalChunkId: 'chunk:same:1',
          citationTargetId: 'citation:same:1',
          metadata: { reviewStatus: 'human-confirmed', resourceId: 'resource:same' },
        }),
        item({
          id: 'same-resource-chunk-2',
          retrievalChunkId: 'chunk:same:2',
          citationTargetId: 'citation:same:2',
          metadata: { reviewStatus: 'human-confirmed', resourceIds: ['resource:same'] },
        }),
      ],
      now: new Date('2026-06-28T00:00:00Z'),
    });
    expect(result.pack.items).toHaveLength(1);
    expect(result.pack.items[0].id).toMatch(/^same-resource-chunk-/);
    expect(result.pack.limitations.map((limitation) => limitation.code)).toContain('diversity-resource');
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
