import { describe, expect, it } from 'vitest';
import {
  LEARNING_EVIDENCE_CORPUS_RETENTION_POLICY,
  buildLearningEvidenceCitationAuditPayloads,
  buildLearningEvidenceCitationChips,
  createLearningEvidenceCorpusChunk,
  retrieveLearningEvidenceCorpus,
  resolveLearningEvidenceCitationAddress,
  validateLearningEvidenceCorpusChunk,
  verifyLearningEvidenceCitations,
  type LearningEvidenceCorpusChunk,
} from '../learning-evidence-rag-corpus';

function chunk(overrides: Partial<LearningEvidenceCorpusChunk> = {}): LearningEvidenceCorpusChunk {
  return {
    id: 'chunk-course-1',
    family: 'course-content',
    sourceType: 'course-content',
    sourceRef: {
      id: 'unit-4-1',
      ownerUserId: null,
      classId: null,
      goalId: 'control-correction',
      resourceId: 'course-content/runtime/unit-4-1',
    },
    spanRef: { kind: 'text-range', start: 0, end: 48, locator: 'handout#p1' },
    display: {
      title: '控制校正讲义',
      href: '/interactive-learning/courses/unit-4-1',
      capsule: '控制校正的稳态误差和超调量约束。',
    },
    content: {
      text: '控制校正的稳态误差和超调量约束。',
      redactedSummary: '控制校正核心约束。',
      hash: 'hash-course-1',
    },
    privacyClass: 'public',
    confidence: 'high',
    freshness: {
      indexedAt: '2026-06-04T00:00:00.000Z',
      sourceUpdatedAt: '2026-06-03T00:00:00.000Z',
      expiresAt: null,
      stale: false,
    },
    authority: {
      level: 'canonical',
      knowledgeTags: ['control-correction', 'steady-state-error'],
      pageAnchor: 'handout#p1',
      freshnessBucket: 'current',
      scopeRule: {
        visibility: 'public',
        allowedRoles: ['student', 'teacher', 'admin', 'service'],
      },
      conflictGroup: null,
      conflictSignal: null,
    },
    retrieval: {
      tags: ['control-correction', 'steady-state-error'],
      goals: ['control-correction'],
      useCases: ['diagnosis', 'konling', 'grading', 'prep-pack'],
    },
    ...overrides,
  };
}

const corpus: LearningEvidenceCorpusChunk[] = [
  chunk(),
  chunk({
    id: 'chunk-student-path',
    family: 'path-evidence',
    sourceType: 'path-summary',
    sourceRef: { id: 'path-1', ownerUserId: 'student-1', classId: 'class-1', goalId: 'control-correction' },
    spanRef: { kind: 'record', locator: 'terminalValidation' },
    display: { title: '学生路径终端验证', href: '/learning-paths/path-1', capsule: '终端验证已完成。' },
    content: { text: 'raw answer body should not be returned', redactedSummary: '终端验证已完成。', hash: 'hash-path-1' },
    privacyClass: 'student-visible',
    confidence: 'medium',
    authority: {
      level: 'learner-evidence',
      knowledgeTags: [],
      pageAnchor: 'terminalValidation',
      freshnessBucket: 'current',
      scopeRule: {
        visibility: 'student-visible',
        allowedRoles: ['student', 'teacher', 'admin', 'service'],
        ownerRequired: true,
        classRequired: true,
      },
      conflictGroup: null,
      conflictSignal: null,
    },
    retrieval: { tags: ['terminal-validation'], goals: ['control-correction'], useCases: ['diagnosis', 'konling', 'recommendation'] },
  }),
  chunk({
    id: 'chunk-teacher-report',
    family: 'report',
    sourceType: 'teacher-report',
    sourceRef: { id: 'report-1', ownerUserId: null, classId: 'class-1', goalId: 'control-correction' },
    spanRef: { kind: 'summary', locator: 'cohort.metrics' },
    display: { title: '班级控制校正报告', href: '/teacher/classes/class-1/reports/control-correction', capsule: '班级 Arena 有效提交率偏低。' },
    content: { text: 'teacher report internal detail', redactedSummary: '班级 Arena 有效提交率偏低。', hash: 'hash-report-1' },
    privacyClass: 'teacher-visible',
    confidence: 'medium',
    authority: {
      level: 'teacher-authored',
      knowledgeTags: [],
      pageAnchor: 'cohort.metrics',
      freshnessBucket: 'current',
      scopeRule: {
        visibility: 'teacher-visible',
        allowedRoles: ['teacher', 'admin', 'service'],
        classRequired: true,
      },
      conflictGroup: null,
      conflictSignal: null,
    },
    retrieval: { tags: ['teacher-report'], goals: ['control-correction'], useCases: ['teacher-report', 'prep-pack', 'recommendation'] },
  }),
  chunk({
    id: 'chunk-grading',
    family: 'grading',
    sourceType: 'grading-artifact',
    sourceRef: { id: 'grading-1', ownerUserId: 'student-1', classId: 'class-1', goalId: 'control-correction' },
    spanRef: { kind: 'record', locator: 'rubric.block.1' },
    display: { title: '评分量规块', href: null, capsule: '根轨迹设计量规证据。' },
    content: { text: 'rubric score internals', redactedSummary: '根轨迹设计量规证据。', hash: 'hash-grading-1' },
    privacyClass: 'teacher-visible',
    confidence: 'high',
    authority: {
      level: 'teacher-authored',
      knowledgeTags: [],
      pageAnchor: 'rubric.block.1',
      freshnessBucket: 'current',
      scopeRule: {
        visibility: 'teacher-visible',
        allowedRoles: ['teacher', 'admin', 'service'],
        ownerRequired: true,
        classRequired: true,
      },
      conflictGroup: null,
      conflictSignal: null,
    },
    retrieval: { tags: ['grading'], goals: ['control-correction'], useCases: ['grading', 'prep-pack'] },
  }),
  chunk({
    id: 'chunk-service-memory',
    family: 'path-evidence',
    sourceType: 'path-summary',
    sourceRef: { id: 'private-memory', ownerUserId: 'student-1', classId: 'class-1', goalId: 'control-correction' },
    spanRef: { kind: 'summary', locator: 'konling.memory.private' },
    display: { title: '私有控灵记忆', href: null, capsule: '私有记忆稳定引用。' },
    content: { text: 'private Konling memory', redactedSummary: '私有记忆稳定引用。', hash: 'hash-memory-1' },
    privacyClass: 'service-only',
    confidence: 'medium',
    authority: {
      level: 'service-internal',
      knowledgeTags: [],
      pageAnchor: 'konling.memory.private',
      freshnessBucket: 'current',
      scopeRule: {
        visibility: 'service-only',
        allowedRoles: ['service'],
        ownerRequired: true,
        classRequired: true,
        privilegedDiagnostics: true,
      },
      conflictGroup: null,
      conflictSignal: null,
    },
    retrieval: { tags: ['konling-memory'], goals: ['control-correction'], useCases: ['konling'] },
  }),
];

describe('learning evidence RAG corpus contract', () => {
  it('requires governed provenance, display, hash, confidence, and freshness metadata', () => {
    expect(validateLearningEvidenceCorpusChunk(corpus[0])).toEqual([]);
    expect(validateLearningEvidenceCorpusChunk(chunk({
      id: '',
      sourceRef: { id: '' },
      content: { text: null, redactedSummary: null, hash: '' },
    }))).toEqual(expect.arrayContaining([
      'missing-id',
      'missing-source-ref',
      'missing-content-hash',
      'missing-retrievable-text',
    ]));
    const missingAuthority = chunk({ id: 'missing-authority' });
    delete (missingAuthority as unknown as { authority?: unknown }).authority;
    expect(validateLearningEvidenceCorpusChunk(missingAuthority)).toEqual(expect.arrayContaining([
      'missing-authority-level',
      'missing-authority-knowledge-tags',
      'missing-authority-freshness-bucket',
      'missing-authority-scope-rule',
    ]));
    expect(validateLearningEvidenceCorpusChunk(chunk({
      id: 'bad-authority',
      sourceType: 'course-content',
      authority: {
        level: 'learner-evidence',
        knowledgeTags: [],
        pageAnchor: null,
        freshnessBucket: 'current',
        scopeRule: {
          visibility: 'student-visible',
          allowedRoles: ['student'],
          ownerRequired: true,
        },
        conflictGroup: null,
        conflictSignal: null,
      },
    }))).toEqual(expect.arrayContaining([
      'authority-source-type-mismatch',
      'knowledge-source-missing-tags',
      'scope-privacy-mismatch',
    ]));
    expect(LEARNING_EVIDENCE_CORPUS_RETENTION_POLICY).toMatchObject({
      rebuildTriggers: expect.arrayContaining(['source-updated', 'privacy-scope-changed']),
      invalidationSignals: expect.arrayContaining(['stale-source-hash', 'access-scope-revoked']),
      retention: expect.objectContaining({ learnerEvidenceDays: 180 }),
    });
    expect(validateLearningEvidenceCorpusChunk({
      id: 'malformed',
      family: 'path-evidence',
      sourceType: 'path-summary',
    } as LearningEvidenceCorpusChunk)).toEqual(expect.arrayContaining([
      'missing-source-ref',
      'missing-display-title',
      'missing-display-capsule',
      'missing-span-ref',
      'missing-content-hash',
      'missing-indexed-at',
      'missing-privacy-class',
      'missing-confidence',
      'missing-retrieval-tags',
      'missing-retrieval-goals',
      'missing-retrieval-use-cases',
      'missing-retrievable-text',
    ]));
  });

  it('retrieves student-visible evidence only inside the student scope and redacts raw text', () => {
    const results = retrieveLearningEvidenceCorpus(corpus, {
      role: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'konling',
    }, { tags: ['terminal-validation'] });

    expect(results.map((item) => item.id)).toEqual(['chunk-student-path']);
    expect(results[0].content.text).toBeNull();
    expect(results[0].content.redactedSummary).toBe('终端验证已完成。');

    const otherStudentResults = retrieveLearningEvidenceCorpus(corpus, {
      role: 'student',
      userId: 'student-2',
      targetUserId: 'student-2',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'konling',
    }, { tags: ['terminal-validation'] });
    expect(otherStudentResults).toEqual([]);

    const publicCourseForStudent = retrieveLearningEvidenceCorpus(corpus, {
      role: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'konling',
    }, { tags: ['control-correction'] });
    expect(publicCourseForStudent.map((item) => item.id)).toContain('chunk-course-1');

    const forgedTargetResults = retrieveLearningEvidenceCorpus(corpus, {
      role: 'student',
      userId: 'student-2',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'konling',
      includePrivateText: true,
    }, { tags: ['terminal-validation'] });
    expect(forgedTargetResults).toEqual([]);

    const missingClassScopeResults = retrieveLearningEvidenceCorpus(corpus, {
      role: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
      goalId: 'control-correction',
      useCase: 'konling',
    }, { tags: ['terminal-validation'] });
    expect(missingClassScopeResults).toEqual([]);
  });

  it('ranks by authority, freshness, scope, use case, and query match before raw confidence', () => {
    const highConfidenceLearnerEvidence = chunk({
      id: 'learner-high-confidence',
      family: 'path-evidence',
      sourceType: 'path-summary',
      sourceRef: { id: 'path-high', ownerUserId: 'student-1', classId: 'class-1', goalId: 'control-correction' },
      display: { title: '学习路径摘要', href: null, capsule: '稳态误差 需要个人复习。' },
      content: { text: '稳态误差 个人路径证据', redactedSummary: '稳态误差 个人路径证据', hash: 'hash-learner-high' },
      privacyClass: 'student-visible',
      confidence: 'high',
      authority: {
        level: 'learner-evidence',
        knowledgeTags: [],
        pageAnchor: 'path-high',
        freshnessBucket: 'current',
        scopeRule: {
          visibility: 'student-visible',
          allowedRoles: ['student', 'teacher', 'admin', 'service'],
          ownerRequired: true,
          classRequired: true,
        },
        conflictGroup: null,
        conflictSignal: null,
      },
      retrieval: { tags: ['steady-state-error'], goals: ['control-correction'], useCases: ['diagnosis', 'konling'] },
    });
    const staleCanonical = chunk({
      id: 'stale-canonical',
      confidence: 'medium',
      freshness: { indexedAt: '2026-06-04T00:00:00.000Z', sourceUpdatedAt: '2025-06-04T00:00:00.000Z', expiresAt: null, stale: true },
      authority: {
        ...chunk().authority,
        freshnessBucket: 'stale',
      },
    });
    const currentCanonical = chunk({
      id: 'current-canonical',
      confidence: 'medium',
      display: { title: '稳态误差权威讲义', href: '/unit', capsule: '稳态误差 课程讲义。' },
      content: { text: '稳态误差 课程讲义标准解释', redactedSummary: '稳态误差标准解释', hash: 'hash-current-canonical' },
      authority: {
        ...chunk().authority,
        pageAnchor: 'handout#steady-state-error',
      },
    });

    const results = retrieveLearningEvidenceCorpus([
      highConfidenceLearnerEvidence,
      staleCanonical,
      currentCanonical,
    ], {
      role: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'konling',
    }, { text: '稳态误差', tags: ['steady-state-error'] });

    expect(results.map((item) => item.id)).toEqual([
      'current-canonical',
      'stale-canonical',
      'learner-high-confidence',
    ]);
  });

  it('validates resource projection metadata for governed retrieval chunks', () => {
    const projectedHandout = chunk({
      id: 'resource-handout-segment',
      resourceProjection: {
        resourceId: 'course-content/runtime/unit-4-1',
        segmentRef: 'unit-4-1#section-steady-state-error',
        citationTargetRef: 'handout#p1',
        knowledgeNodeRefs: ['knowledge:steady-state-error'],
        capabilityTargetRefs: ['capability:steady-state-error-analysis'],
        mediaTimeRange: null,
        exerciseAnchor: null,
        contentHash: 'hash-course-1',
      },
    });
    const projectedVideo = chunk({
      id: 'resource-video-segment',
      sourceType: 'runtime-handout',
      family: 'runtime-handout',
      spanRef: { kind: 'text-range', locator: 'video-transcript#steady-state-error', start: 120, end: 180 },
      citationAddress: {
        kind: 'video',
        sourceRefId: 'unit-4-1-video',
        href: '/interactive-learning/courses/unit-4-1#video',
        mediaStartSeconds: 120,
        mediaEndSeconds: 180,
      },
      resourceProjection: {
        resourceId: 'course-content/runtime/unit-4-1',
        segmentRef: 'video-transcript#steady-state-error',
        citationTargetRef: 'video@120-180',
        knowledgeNodeRefs: ['knowledge:steady-state-error'],
        capabilityTargetRefs: ['capability:steady-state-error-analysis'],
        mediaTimeRange: { startSeconds: 120, endSeconds: 180 },
        exerciseAnchor: null,
        contentHash: 'hash-course-1',
      },
    });
    const malformedProjection = chunk({
      id: 'malformed-resource-projection',
      resourceProjection: {
        resourceId: 'course-content/runtime/unit-4-1',
        segmentRef: '',
        citationTargetRef: 'handout#p1',
        knowledgeNodeRefs: ['knowledge:steady-state-error'],
        capabilityTargetRefs: 'capability:steady-state-error-analysis',
        mediaTimeRange: { startSeconds: 20, endSeconds: 10 },
        exerciseAnchor: null,
        contentHash: 'hash-course-1',
      } as unknown as LearningEvidenceCorpusChunk['resourceProjection'],
    });

    expect(validateLearningEvidenceCorpusChunk(projectedHandout)).toEqual([]);
    expect(validateLearningEvidenceCorpusChunk(projectedVideo)).toEqual([]);
    expect(validateLearningEvidenceCorpusChunk(malformedProjection)).toContain('invalid-resource-projection');
  });

  it('keeps exact lexical resource matches eligible when semantic scores are weak', () => {
    const exactFormula = chunk({
      id: 'formula-resource-segment',
      display: { title: '稳态误差公式', href: '/unit#ess', capsule: '包含 e_ss = 1 / (1 + Kp)。' },
      content: { text: '单位阶跃输入下 e_ss = 1 / (1 + Kp)。', redactedSummary: '稳态误差公式。', hash: 'hash-formula' },
      resourceProjection: {
        resourceId: 'course-content/runtime/unit-4-1',
        segmentRef: 'formula#steady-state-error',
        citationTargetRef: 'formula#ess',
        knowledgeNodeRefs: ['knowledge:steady-state-error'],
        capabilityTargetRefs: ['capability:steady-state-error-analysis'],
        mediaTimeRange: null,
        exerciseAnchor: null,
        contentHash: 'hash-formula',
      },
    });
    const semanticOnly = chunk({
      id: 'semantic-only-resource',
      display: { title: '误差分析拓展', href: '/unit#semantic', capsule: '语义相关但不含查询公式。' },
      content: { text: '分析系统型别和输入信号之间的关系。', redactedSummary: '误差分析拓展。', hash: 'hash-semantic' },
      resourceProjection: {
        resourceId: 'course-content/runtime/unit-4-1',
        segmentRef: 'section#error-analysis',
        citationTargetRef: 'handout#semantic',
        knowledgeNodeRefs: ['knowledge:steady-state-error'],
        capabilityTargetRefs: ['capability:steady-state-error-analysis'],
        mediaTimeRange: null,
        exerciseAnchor: null,
        contentHash: 'hash-semantic',
      },
    });

    const results = retrieveLearningEvidenceCorpus([semanticOnly, exactFormula], {
      role: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'konling',
    }, {
      text: 'e_ss = 1 / (1 + Kp)',
      semanticScores: { 'semantic-only-resource': 0.92, 'formula-resource-segment': 0.05 },
    });

    expect(results.map((item) => item.id)).toEqual([
      'formula-resource-segment',
      'semantic-only-resource',
    ]);
  });

  it('uses capability context without bypassing privacy scope', () => {
    const matchingCapability = chunk({
      id: 'matching-capability-resource',
      retrieval: { tags: ['steady-state-error'], goals: ['control-correction'], useCases: ['recommendation'] },
      resourceProjection: {
        resourceId: 'course-content/runtime/unit-4-1',
        segmentRef: 'exercise#ess-1',
        citationTargetRef: 'exercise#ess-1',
        knowledgeNodeRefs: ['knowledge:steady-state-error'],
        capabilityTargetRefs: ['capability:steady-state-error-analysis'],
        mediaTimeRange: null,
        exerciseAnchor: 'exercise#ess-1',
        contentHash: 'hash-course-1',
      },
    });
    const unrelatedCapability = chunk({
      id: 'unrelated-capability-resource',
      display: { title: '频域裕度', href: '/unit#margin', capsule: '相角裕度练习。' },
      content: { text: '相角裕度和幅值裕度。', redactedSummary: '频域裕度练习。', hash: 'hash-margin' },
      resourceProjection: {
        resourceId: 'course-content/runtime/unit-5-1',
        segmentRef: 'exercise#margin-1',
        citationTargetRef: 'exercise#margin-1',
        knowledgeNodeRefs: ['knowledge:stability-margin'],
        capabilityTargetRefs: ['capability:stability-margin-analysis'],
        mediaTimeRange: null,
        exerciseAnchor: 'exercise#margin-1',
        contentHash: 'hash-margin',
      },
    });
    const privateLearnerEvidence = chunk({
      id: 'private-learner-capability',
      family: 'path-evidence',
      sourceType: 'path-summary',
      sourceRef: { id: 'private-path', ownerUserId: 'student-2', classId: 'class-1', goalId: 'control-correction' },
      spanRef: { kind: 'record', locator: 'terminalValidation' },
      display: { title: '其他学生证据', href: null, capsule: '其他学生的能力证据。' },
      content: { text: '其他学生原始证据', redactedSummary: '其他学生证据。', hash: 'hash-private-learner' },
      privacyClass: 'student-visible',
      confidence: 'high',
      authority: {
        level: 'learner-evidence',
        knowledgeTags: [],
        pageAnchor: 'terminalValidation',
        freshnessBucket: 'current',
        scopeRule: {
          visibility: 'student-visible',
          allowedRoles: ['student', 'teacher', 'admin', 'service'],
          ownerRequired: true,
          classRequired: true,
        },
        conflictGroup: null,
        conflictSignal: null,
      },
      retrieval: { tags: ['steady-state-error'], goals: ['control-correction'], useCases: ['recommendation'] },
      resourceProjection: {
        resourceId: 'learner-path/private-path',
        segmentRef: 'terminalValidation',
        citationTargetRef: 'terminalValidation',
        knowledgeNodeRefs: ['knowledge:steady-state-error'],
        capabilityTargetRefs: ['capability:steady-state-error-analysis'],
        mediaTimeRange: null,
        exerciseAnchor: null,
        contentHash: 'hash-private-learner',
      },
    });

    const results = retrieveLearningEvidenceCorpus([
      unrelatedCapability,
      privateLearnerEvidence,
      matchingCapability,
    ], {
      role: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'recommendation',
    }, {
      capabilityTargetRefs: ['capability:steady-state-error-analysis'],
    });

    expect(results.map((item) => item.id)).toEqual(['matching-capability-resource']);
  });

  it('keeps legacy unprojected chunks compatible while reranking projected context matches', () => {
    const projectedMatch = chunk({
      id: 'projected-capability-match',
      retrieval: { tags: ['steady-state-error'], goals: ['control-correction'], useCases: ['recommendation'] },
      resourceProjection: {
        resourceId: 'course-content/runtime/unit-4-1',
        segmentRef: 'exercise#ess-2',
        citationTargetRef: 'exercise#ess-2',
        knowledgeNodeRefs: ['knowledge:steady-state-error'],
        capabilityTargetRefs: ['capability:steady-state-error-analysis'],
        mediaTimeRange: null,
        exerciseAnchor: 'exercise#ess-2',
        contentHash: 'hash-course-1',
      },
    });
    const legacyKnowledge = chunk({
      id: 'legacy-unprojected-knowledge',
      retrieval: { tags: ['steady-state-error'], goals: ['control-correction'], useCases: ['recommendation'] },
      resourceProjection: undefined,
    });

    const results = retrieveLearningEvidenceCorpus([legacyKnowledge, projectedMatch], {
      role: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'recommendation',
    }, {
      capabilityTargetRefs: ['capability:steady-state-error-analysis'],
    });

    expect(results.map((item) => item.id)).toEqual([
      'projected-capability-match',
      'legacy-unprojected-knowledge',
    ]);
  });

  it('does not admit weak semantic scores without lexical or context support', () => {
    const exactFormula = chunk({
      id: 'formula-resource-segment',
      display: { title: '稳态误差公式', href: '/unit#ess', capsule: '包含 e_ss = 1 / (1 + Kp)。' },
      content: { text: '单位阶跃输入下 e_ss = 1 / (1 + Kp)。', redactedSummary: '稳态误差公式。', hash: 'hash-formula-weak' },
    });
    const weakSemantic = chunk({
      id: 'weak-semantic-resource',
      display: { title: '误差分析拓展', href: '/unit#semantic-weak', capsule: '语义较弱且不含查询公式。' },
      content: { text: '分析系统型别和输入信号之间的关系。', redactedSummary: '误差分析拓展。', hash: 'hash-semantic-weak' },
    });

    const results = retrieveLearningEvidenceCorpus([weakSemantic, exactFormula], {
      role: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'konling',
    }, {
      text: 'e_ss = 1 / (1 + Kp)',
      semanticScores: { 'weak-semantic-resource': 0.05 },
    });

    expect(results.map((item) => item.id)).toEqual(['formula-resource-segment']);
  });

  it('uses the semantic threshold as the candidate gate for pure vector retrieval', () => {
    const strongSemantic = chunk({
      id: 'strong-semantic-resource',
      display: { title: '强语义候选', href: '/unit#strong-semantic', capsule: '语义向量命中稳态误差。' },
      content: { text: '系统型别决定阶跃输入下的稳态误差。', redactedSummary: '稳态误差语义命中。', hash: 'hash-strong-semantic' },
    });
    const unscoredCanonical = chunk({
      id: 'unscored-canonical-resource',
      display: { title: '未评分权威资料', href: '/unit#unscored', capsule: '权威但未进入向量候选。' },
      content: { text: '权威资料内容。', redactedSummary: '权威资料。', hash: 'hash-unscored-canonical' },
    });
    const weakSemantic = chunk({
      id: 'weak-semantic-resource',
      display: { title: '弱语义候选', href: '/unit#weak-semantic', capsule: '语义分数低于候选门槛。' },
      content: { text: '低相关内容。', redactedSummary: '低相关内容。', hash: 'hash-weak-semantic-only' },
    });

    const results = retrieveLearningEvidenceCorpus([unscoredCanonical, weakSemantic, strongSemantic], {
      role: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'konling',
    }, {
      semanticScores: {
        'strong-semantic-resource': 0.72,
        'weak-semantic-resource': 0.05,
      },
    });

    expect(results.map((item) => item.id)).toEqual(['strong-semantic-resource']);
  });

  it('prioritizes teaching knowledge for concepts while including authorized learner evidence in recommendations', () => {
    const teachingKnowledge = chunk({
      id: 'concept-teaching-knowledge',
      display: { title: '稳态误差概念解释', href: '/unit#concept', capsule: '稳态误差由系统型别和输入决定。' },
      content: { text: '稳态误差由系统型别和输入决定。', redactedSummary: '稳态误差概念。', hash: 'hash-concept' },
      resourceProjection: {
        resourceId: 'course-content/runtime/unit-4-1',
        segmentRef: 'concept#steady-state-error',
        citationTargetRef: 'handout#concept',
        knowledgeNodeRefs: ['knowledge:steady-state-error'],
        capabilityTargetRefs: ['capability:steady-state-error-analysis'],
        mediaTimeRange: null,
        exerciseAnchor: null,
        contentHash: 'hash-concept',
      },
    });
    const learnerEvidence = chunk({
      id: 'recommendation-learner-evidence',
      family: 'path-evidence',
      sourceType: 'path-summary',
      sourceRef: { id: 'path-recommendation', ownerUserId: 'student-1', classId: 'class-1', goalId: 'control-correction' },
      spanRef: { kind: 'record', locator: 'terminalValidation' },
      display: { title: '个人能力证据', href: '/learning-paths/path-recommendation', capsule: '稳态误差终端验证仍需复习。' },
      content: { text: '学生在稳态误差终端验证中仍需复习。', redactedSummary: '稳态误差终端验证仍需复习。', hash: 'hash-recommendation-learner' },
      privacyClass: 'student-visible',
      confidence: 'medium',
      authority: {
        level: 'learner-evidence',
        knowledgeTags: [],
        pageAnchor: 'terminalValidation',
        freshnessBucket: 'current',
        scopeRule: {
          visibility: 'student-visible',
          allowedRoles: ['student', 'teacher', 'admin', 'service'],
          ownerRequired: true,
          classRequired: true,
        },
        conflictGroup: null,
        conflictSignal: null,
      },
      retrieval: { tags: ['steady-state-error'], goals: ['control-correction'], useCases: ['recommendation'] },
      resourceProjection: {
        resourceId: 'learner-path/path-recommendation',
        segmentRef: 'terminalValidation',
        citationTargetRef: 'terminalValidation',
        knowledgeNodeRefs: ['knowledge:steady-state-error'],
        capabilityTargetRefs: ['capability:steady-state-error-analysis'],
        mediaTimeRange: null,
        exerciseAnchor: null,
        contentHash: 'hash-recommendation-learner',
      },
    });

    const conceptResults = retrieveLearningEvidenceCorpus([learnerEvidence, teachingKnowledge], {
      role: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'konling',
    }, {
      text: '稳态误差',
      knowledgeNodeRefs: ['knowledge:steady-state-error'],
      capabilityTargetRefs: ['capability:steady-state-error-analysis'],
    });
    const recommendationResults = retrieveLearningEvidenceCorpus([teachingKnowledge, learnerEvidence], {
      role: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'recommendation',
    }, {
      text: '稳态误差',
      knowledgeNodeRefs: ['knowledge:steady-state-error'],
      capabilityTargetRefs: ['capability:steady-state-error-analysis'],
    });

    expect(conceptResults[0]?.id).toBe('concept-teaching-knowledge');
    expect(recommendationResults.map((item) => item.id)).toContain('recommendation-learner-evidence');
    expect(recommendationResults.find((item) => item.id === 'recommendation-learner-evidence')?.content.text).toBeNull();
  });

  it('builds authority metadata for every supported corpus source type', () => {
    const cases: Array<Pick<LearningEvidenceCorpusChunk, 'family' | 'sourceType' | 'privacyClass'> & { id: string }> = [
      { id: 'builder-course', family: 'course-content', sourceType: 'course-content', privacyClass: 'public' },
      { id: 'builder-card', family: 'knowledge-card', sourceType: 'knowledge-card', privacyClass: 'public' },
      { id: 'builder-handout', family: 'runtime-handout', sourceType: 'runtime-handout', privacyClass: 'public' },
      { id: 'builder-path', family: 'path-evidence', sourceType: 'path-summary', privacyClass: 'student-visible' },
      { id: 'builder-diagnosis', family: 'diagnosis', sourceType: 'diagnosis', privacyClass: 'service-only' },
      { id: 'builder-grading', family: 'grading', sourceType: 'grading-artifact', privacyClass: 'teacher-visible' },
      { id: 'builder-simulation', family: 'simulation-arena', sourceType: 'simulation-summary', privacyClass: 'student-visible' },
      { id: 'builder-arena', family: 'simulation-arena', sourceType: 'arena-summary', privacyClass: 'student-visible' },
      { id: 'builder-report', family: 'report', sourceType: 'teacher-report', privacyClass: 'teacher-visible' },
    ];

    const built = cases.map((item) => createLearningEvidenceCorpusChunk({
      ...chunk({
        id: item.id,
        family: item.family,
        sourceType: item.sourceType,
        privacyClass: item.privacyClass,
        sourceRef: {
          id: item.id,
          ownerUserId: item.privacyClass === 'public' || item.privacyClass === 'teacher-visible' ? null : 'student-1',
          classId: item.privacyClass === 'public' ? null : 'class-1',
          goalId: 'control-correction',
        },
        retrieval: {
          tags: ['control-correction'],
          goals: ['control-correction'],
          useCases: item.sourceType === 'teacher-report'
            ? ['teacher-report']
            : item.sourceType === 'grading-artifact'
              ? ['grading']
              : ['diagnosis'],
        },
      }),
      authority: undefined,
    }));

    expect(built.every((item) => validateLearningEvidenceCorpusChunk(item).length === 0)).toBe(true);
    expect(built.find((item) => item.sourceType === 'course-content')?.authority).toMatchObject({
      level: 'canonical',
      knowledgeTags: expect.arrayContaining(['control-correction']),
      scopeRule: expect.objectContaining({ visibility: 'public' }),
    });
    expect(built.find((item) => item.sourceType === 'teacher-report')?.authority).toMatchObject({
      level: 'teacher-authored',
      scopeRule: expect.objectContaining({ visibility: 'teacher-visible', classRequired: true }),
    });
    expect(built.find((item) => item.sourceType === 'diagnosis')?.authority).toMatchObject({
      level: 'service-internal',
      scopeRule: expect.objectContaining({ visibility: 'service-only', privilegedDiagnostics: true }),
    });
  });

  it('constrains privileged retrieval to the requested learner owner when targetUserId is present', () => {
    const otherLearnerChunk = chunk({
      id: 'chunk-student-2-path',
      family: 'path-evidence',
      sourceType: 'path-summary',
      sourceRef: { id: 'path-2', ownerUserId: 'student-2', classId: 'class-1', goalId: 'control-correction' },
      spanRef: { kind: 'record', locator: 'terminalValidation' },
      display: { title: '另一个学生路径', href: null, capsule: '另一个学生终端验证。' },
      content: { text: 'student 2 private path', redactedSummary: '另一个学生终端验证。', hash: 'hash-path-2' },
      privacyClass: 'student-visible',
      confidence: 'medium',
      retrieval: { tags: ['terminal-validation'], goals: ['control-correction'], useCases: ['konling'] },
    });
    const teacher = retrieveLearningEvidenceCorpus([...corpus, otherLearnerChunk], {
      role: 'teacher',
      userId: 'teacher-1',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'konling',
    }, { tags: ['terminal-validation'] });
    expect(teacher.map((item) => item.id)).toEqual(['chunk-student-path']);

    const service = retrieveLearningEvidenceCorpus([...corpus, otherLearnerChunk], {
      role: 'service',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'konling',
      includePrivateText: true,
    }, { tags: ['konling-memory', 'terminal-validation'] });
    expect(service.map((item) => item.id)).toEqual(expect.arrayContaining(['chunk-service-memory', 'chunk-student-path']));
    expect(service.map((item) => item.id)).not.toContain('chunk-student-2-path');

    const ownerlessStudentVisible = chunk({
      id: 'chunk-ownerless-path',
      family: 'path-evidence',
      sourceType: 'path-summary',
      sourceRef: { id: 'ownerless-path', ownerUserId: null, classId: 'class-1', goalId: 'control-correction' },
      privacyClass: 'student-visible',
      retrieval: { tags: ['terminal-validation'], goals: ['control-correction'], useCases: ['konling'] },
    });
    const ownerlessResults = retrieveLearningEvidenceCorpus([...corpus, ownerlessStudentVisible], {
      role: 'teacher',
      userId: 'teacher-1',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'konling',
    }, { tags: ['terminal-validation'] });
    expect(ownerlessResults.map((item) => item.id)).not.toContain('chunk-ownerless-path');
  });

  it('enforces teacher, admin, and service visibility boundaries', () => {
    const teacher = retrieveLearningEvidenceCorpus(corpus, {
      role: 'teacher',
      userId: 'teacher-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'teacher-report',
    });
    expect(teacher.map((item) => item.id)).toEqual(['chunk-teacher-report']);
    expect(teacher[0].content.text).toBeNull();

    const outsideTeacher = retrieveLearningEvidenceCorpus(corpus, {
      role: 'teacher',
      userId: 'teacher-2',
      classIds: ['class-2'],
      goalId: 'control-correction',
      useCase: 'teacher-report',
    });
    expect(outsideTeacher).toEqual([]);

    const service = retrieveLearningEvidenceCorpus(corpus, {
      role: 'service',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'konling',
      includePrivateText: true,
    }, { tags: ['konling-memory'] });
    expect(service.map((item) => item.id)).toEqual(['chunk-service-memory']);
    expect(service[0].content.text).toBe('private Konling memory');

    const admin = retrieveLearningEvidenceCorpus(corpus, {
      role: 'admin',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'grading',
    }, { tags: ['grading'] });
    expect(admin.map((item) => item.id)).toEqual(['chunk-grading']);

    const teacherPrivateText = retrieveLearningEvidenceCorpus(corpus, {
      role: 'teacher',
      userId: 'teacher-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'teacher-report',
      includePrivateText: true,
    });
    expect(teacherPrivateText[0].content.text).toBeNull();

    const rawTextOnlyMatch = retrieveLearningEvidenceCorpus(corpus, {
      role: 'teacher',
      userId: 'teacher-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'teacher-report',
    }, { text: 'teacher report internal detail' });
    expect(rawTextOnlyMatch).toEqual([]);
  });

  it('rejects fake, inaccessible, unsupported, mismatched, and hash-invalid citations', () => {
    const result = verifyLearningEvidenceCitations(corpus, {
      role: 'teacher',
      userId: 'teacher-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
    }, [
      { chunkId: 'chunk-grading', sourceType: 'grading-artifact', useCase: 'grading', quoteHash: 'hash-grading-1' },
      { chunkId: 'fake-chunk', useCase: 'konling' },
      { chunkId: 'chunk-service-memory', useCase: 'konling' },
      { chunkId: 'chunk-teacher-report', useCase: 'konling' },
      { chunkId: 'chunk-course-1', sourceType: 'teacher-report', useCase: 'diagnosis' },
      { chunkId: 'chunk-student-path', useCase: 'diagnosis', quoteHash: 'wrong-hash' },
    ]);

    expect(result.status).toBe('rejected');
    expect(result.verifiedRefs).toEqual([
      expect.objectContaining({ chunkId: 'chunk-grading', sourceType: 'grading-artifact' }),
    ]);
    expect(result.limitations).toEqual(expect.arrayContaining([
      { chunkId: 'fake-chunk', reason: 'missing-chunk' },
      { chunkId: 'chunk-service-memory', reason: 'privacy-violation' },
      { chunkId: 'chunk-teacher-report', reason: 'unsupported-source-type' },
      { chunkId: 'chunk-course-1', reason: 'source-type-mismatch' },
      { chunkId: 'chunk-student-path', reason: 'quote-hash-mismatch' },
    ]));
  });

  it('downgrades low-authority citations and reports missing learner evidence or conflicts', () => {
    const lowAuthorityCourse = chunk({
      id: 'low-authority-course',
      confidence: 'high',
      authority: {
        ...chunk().authority,
        level: 'contextual',
      },
    });
    const canonicalSupport = chunk({
      id: 'canonical-support',
      content: { text: '根轨迹设计支持该说法。', redactedSummary: '根轨迹设计支持该说法。', hash: 'hash-support' },
      authority: {
        ...chunk().authority,
        conflictGroup: 'root-locus-claim',
        conflictSignal: 'supports',
      },
    });
    const canonicalContradiction = chunk({
      id: 'canonical-contradiction',
      content: { text: '根轨迹设计反驳该说法。', redactedSummary: '根轨迹设计反驳该说法。', hash: 'hash-contradiction' },
      authority: {
        ...chunk().authority,
        conflictGroup: 'root-locus-claim',
        conflictSignal: 'contradicts',
      },
    });

    const result = verifyLearningEvidenceCitations([
      lowAuthorityCourse,
      canonicalSupport,
      canonicalContradiction,
    ], {
      role: 'teacher',
      userId: 'teacher-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'diagnosis',
    }, [
      { chunkId: 'low-authority-course', useCase: 'diagnosis' },
      { chunkId: 'canonical-support', useCase: 'diagnosis' },
      { chunkId: 'canonical-contradiction', useCase: 'diagnosis' },
    ], {
      minimumAuthority: 'canonical',
      requireLearnerEvidence: true,
      detectConflicts: true,
    });

    expect(result.status).toBe('downgraded');
    expect(result.limitations).toEqual(expect.arrayContaining([
      { chunkId: 'low-authority-course', reason: 'insufficient-authority' },
      { chunkId: 'learner-evidence', reason: 'missing-learner-evidence' },
      { chunkId: 'root-locus-claim', reason: 'conflicting-source' },
      { chunkId: 'canonical-support', reason: 'conflicting-source' },
      { chunkId: 'canonical-contradiction', reason: 'conflicting-source' },
    ]));
    const chips = buildLearningEvidenceCitationChips(result, {
      role: 'teacher',
      userId: 'teacher-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'diagnosis',
    });
    expect(chips.filter((chip) => chip.chunkId.startsWith('canonical-')).map((chip) => chip.limitationState)).toEqual([
      'conflicting-source',
      'conflicting-source',
    ]);
  });

  it('detects conflicts from visible retrieval candidates even when the model cites only one side', () => {
    const canonicalSupport = chunk({
      id: 'candidate-support',
      content: { text: '根轨迹设计支持该说法。', redactedSummary: '根轨迹设计支持该说法。', hash: 'hash-support' },
      authority: {
        ...chunk().authority,
        conflictGroup: 'candidate-conflict',
        conflictSignal: 'supports',
      },
    });
    const canonicalContradiction = chunk({
      id: 'candidate-contradiction',
      content: { text: '根轨迹设计反驳该说法。', redactedSummary: '根轨迹设计反驳该说法。', hash: 'hash-contradiction' },
      authority: {
        ...chunk().authority,
        conflictGroup: 'candidate-conflict',
        conflictSignal: 'contradicts',
      },
    });

    const result = verifyLearningEvidenceCitations([
      canonicalSupport,
      canonicalContradiction,
    ], {
      role: 'teacher',
      userId: 'teacher-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'diagnosis',
    }, [
      { chunkId: 'candidate-support', useCase: 'diagnosis' },
    ], {
      detectConflicts: true,
    });

    expect(result.status).toBe('downgraded');
    expect(result.verifiedRefs).toEqual([
      expect.objectContaining({ chunkId: 'candidate-support' }),
    ]);
    expect(result.limitations).toEqual(expect.arrayContaining([
      { chunkId: 'candidate-conflict', reason: 'conflicting-source' },
      { chunkId: 'candidate-support', reason: 'conflicting-source' },
      { chunkId: 'candidate-contradiction', reason: 'conflicting-source' },
    ]));
    expect(buildLearningEvidenceCitationChips(result, {
      role: 'teacher',
      userId: 'teacher-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'diagnosis',
    })[0]).toEqual(expect.objectContaining({
      chunkId: 'candidate-support',
      limitationState: 'conflicting-source',
    }));
  });

  it('builds shared CitationChip payloads without leaking privileged scope diagnostics to students', () => {
    const privilegedExternal = chunk({
      id: 'privileged-external',
      citationAddress: {
        kind: 'external',
        sourceRefId: 'private-external-1',
        href: 'https://private.example/path',
        externalUrl: 'https://private.example/path',
      },
    });
    const verification = verifyLearningEvidenceCitations(corpus, {
      role: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'diagnosis',
    }, [
      { chunkId: 'chunk-course-1', useCase: 'diagnosis' },
      { chunkId: 'chunk-student-path', useCase: 'diagnosis' },
    ]);

    const chips = buildLearningEvidenceCitationChips(verification, {
      role: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'diagnosis',
    });

    expect(chips).toEqual([
      expect.objectContaining({
        chunkId: 'chunk-course-1',
        displayTitle: '控制校正讲义',
        sourceType: 'course-content',
        authorityLevel: 'canonical',
        confidence: 'high',
        freshnessBucket: 'current',
        privacyVisibility: 'public',
        limitationState: null,
      }),
      expect.objectContaining({
        chunkId: 'chunk-student-path',
        sourceType: 'path-summary',
        authorityLevel: 'learner-evidence',
        privacyVisibility: 'redacted',
        limitationState: null,
      }),
    ]);
    expect(JSON.stringify(chips)).not.toContain('ownerRequired');
    expect(JSON.stringify(chips)).not.toContain('classRequired');
    expect(JSON.stringify(chips)).not.toContain('allowedRoles');
    expect(JSON.stringify(chips)).not.toContain('raw answer body');

    const privilegedVerification = {
      status: 'verified',
      verifiedRefs: [
        {
          chunkId: 'privileged-external',
          sourceType: privilegedExternal.sourceType,
          displayTitle: privilegedExternal.display.title,
          displayHref: privilegedExternal.display.href,
          addressKind: privilegedExternal.citationAddress?.kind,
          citationAddress: privilegedExternal.citationAddress,
          confidence: privilegedExternal.confidence,
          capsule: privilegedExternal.display.capsule,
          authorityLevel: privilegedExternal.authority.level,
          freshnessBucket: privilegedExternal.authority.freshnessBucket,
          privacyVisibility: 'privileged',
        },
      ],
      limitations: [],
    } satisfies ReturnType<typeof verifyLearningEvidenceCitations>;
    expect(buildLearningEvidenceCitationChips(privilegedVerification, {
      role: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'diagnosis',
    })[0]).toEqual(expect.objectContaining({
      displayHref: null,
      citationAddress: expect.objectContaining({
        href: null,
        externalUrl: null,
      }),
    }));

    const legacyVerification = {
      status: 'verified',
      verifiedRefs: [
        {
          chunkId: 'legacy-path-ref',
          sourceType: 'path-summary',
          displayTitle: '旧式诊断路径证据',
          displayHref: '/learning-paths/path-1',
          confidence: 'medium',
          capsule: '终端验证已完成。',
          authorityLevel: 'learner-evidence',
          freshnessBucket: 'current',
          privacyVisibility: 'redacted',
        },
      ],
      limitations: [],
    } satisfies ReturnType<typeof verifyLearningEvidenceCitations>;
    expect(buildLearningEvidenceCitationChips(legacyVerification, {
      role: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'diagnosis',
    })[0]).toEqual(expect.objectContaining({
      addressKind: 'interactive',
      citationAddress: expect.objectContaining({
        kind: 'interactive',
        sourceRefId: 'legacy-path-ref',
        href: '/learning-paths/path-1',
      }),
    }));
  });

  it('resolves citations through server-owned address payloads', () => {
    const imageChunk = chunk({
      id: 'image-address',
      citationAddress: {
        kind: 'image',
        sourceRefId: 'image-1',
        href: '/course-assets/unit-4-1/root-locus.png#region=a',
        locator: 'figure.root-locus',
        imageRegion: { x: 12, y: 20, width: 180, height: 96 },
      },
    });
    const videoChunk = chunk({
      id: 'video-address',
      citationAddress: {
        kind: 'video',
        sourceRefId: 'video-1',
        href: '/course-media/unit-4-1.mp4?t=42',
        locator: 'video#lead-compensator',
        mediaStartSeconds: 42,
        mediaEndSeconds: 58,
      },
    });
    const audioChunk = chunk({
      id: 'audio-address',
      citationAddress: {
        kind: 'audio',
        sourceRefId: 'audio-1',
        href: '/course-media/unit-4-1-explain.mp3?t=12',
        locator: 'audio#margin-explanation',
        mediaStartSeconds: 12,
        mediaEndSeconds: 24,
      },
    });
    const interactiveChunk = chunk({
      id: 'interactive-address',
      family: 'path-evidence',
      sourceType: 'path-summary',
      sourceRef: { id: 'path-1', ownerUserId: 'student-1', classId: 'class-1', goalId: 'control-correction' },
      spanRef: { kind: 'record', locator: 'path.step.simulation' },
      display: { title: '路径仿真步骤', href: '/learning-paths/path-1?step=simulation', capsule: '仿真步骤已完成。' },
      privacyClass: 'student-visible',
      authority: {
        ...chunk().authority,
        level: 'learner-evidence',
        knowledgeTags: [],
        scopeRule: {
          visibility: 'student-visible',
          allowedRoles: ['student', 'teacher', 'admin', 'service'],
          ownerRequired: true,
          classRequired: true,
        },
      },
      retrieval: { tags: ['path-step'], goals: ['control-correction'], useCases: ['diagnosis', 'konling', 'recommendation'] },
      citationAddress: {
        kind: 'interactive',
        sourceRefId: 'path-1',
        href: '/learning-paths/path-1?step=simulation',
        locator: 'path.step.simulation',
        interactiveStepId: 'simulation',
      },
    });

    const result = verifyLearningEvidenceCitations([
      imageChunk,
      videoChunk,
      audioChunk,
      interactiveChunk,
    ], {
      role: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'diagnosis',
    }, [
      { chunkId: 'image-address', useCase: 'diagnosis', addressKind: 'image' },
      { chunkId: 'video-address', useCase: 'diagnosis', addressKind: 'video' },
      { chunkId: 'audio-address', useCase: 'diagnosis', addressKind: 'audio' },
      { chunkId: 'interactive-address', useCase: 'diagnosis', addressKind: 'interactive' },
    ]);

    expect(result.status).toBe('verified');
    expect(result.verifiedRefs.map((ref) => ref.addressKind)).toEqual(['image', 'video', 'audio', 'interactive']);
    expect(resolveLearningEvidenceCitationAddress(videoChunk).address).toEqual(expect.objectContaining({
      kind: 'video',
      mediaStartSeconds: 42,
      mediaEndSeconds: 58,
      contentHash: 'hash-course-1',
    }));
    expect(buildLearningEvidenceCitationChips(result, {
      role: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'diagnosis',
    })).toEqual(expect.arrayContaining([
      expect.objectContaining({
        chunkId: 'image-address',
        addressKind: 'image',
        citationAddress: expect.objectContaining({
          imageRegion: { x: 12, y: 20, width: 180, height: 96 },
        }),
      }),
      expect.objectContaining({
        chunkId: 'interactive-address',
        addressKind: 'interactive',
        citationAddress: expect.objectContaining({ interactiveStepId: 'simulation' }),
      }),
    ]));
  });

  it('rejects unsafe or kind-incompatible citation addresses', () => {
    const unsafeExternal = chunk({
      id: 'unsafe-external',
      citationAddress: {
        kind: 'external',
        sourceRefId: 'external-1',
        href: 'javascript:alert(1)',
        externalUrl: 'javascript:alert(1)',
      },
    });
    const unsafeHrefWithSafeExternalUrl = chunk({
      id: 'unsafe-href-with-safe-external-url',
      citationAddress: {
        kind: 'external',
        sourceRefId: 'external-2',
        href: 'javascript:alert(1)',
        externalUrl: 'https://example.com/resource',
      },
    });
    const textChunk = chunk({
      id: 'text-address',
    });

    const result = verifyLearningEvidenceCitations([unsafeExternal, unsafeHrefWithSafeExternalUrl, textChunk], {
      role: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'diagnosis',
    }, [
      { chunkId: 'unsafe-external', useCase: 'diagnosis', addressKind: 'external' },
      { chunkId: 'unsafe-href-with-safe-external-url', useCase: 'diagnosis', addressKind: 'external' },
      { chunkId: 'text-address', useCase: 'diagnosis', addressKind: 'image' },
    ]);

    expect(result.status).toBe('rejected');
    expect(result.verifiedRefs).toEqual([]);
    expect(result.limitations).toEqual(expect.arrayContaining([
      { chunkId: 'unsafe-external', reason: 'unsafe-address' },
      { chunkId: 'unsafe-href-with-safe-external-url', reason: 'unsafe-address' },
      { chunkId: 'text-address', reason: 'address-kind-mismatch' },
    ]));
  });

  it('rejects runtime citation addresses with missing required fields', () => {
    const incompleteAddress = chunk({
      id: 'incomplete-address',
      citationAddress: {
        sourceRefId: 'broken-address',
        href: '/broken-address',
      } as LearningEvidenceCorpusChunk['citationAddress'],
    });

    expect(validateLearningEvidenceCorpusChunk(incompleteAddress)).toContain('invalid-citation-address');

    const result = verifyLearningEvidenceCitations([incompleteAddress], {
      role: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'diagnosis',
    }, [
      { chunkId: 'incomplete-address', useCase: 'diagnosis' },
    ]);

    expect(result.status).toBe('rejected');
    expect(result.verifiedRefs).toEqual([]);
    expect(result.limitations).toContainEqual({
      chunkId: 'incomplete-address',
      reason: 'unsupported-source-type',
    });
  });

  it('downgrades citation addresses with stale content hashes', () => {
    const staleAddress = chunk({
      id: 'stale-address',
      citationAddress: {
        kind: 'text',
        sourceRefId: 'unit-4-1',
        href: '/interactive-learning/courses/unit-4-1',
        contentHash: 'old-hash',
      },
    });

    const result = verifyLearningEvidenceCitations([staleAddress], {
      role: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'diagnosis',
    }, [
      { chunkId: 'stale-address', useCase: 'diagnosis' },
    ]);

    expect(result.status).toBe('downgraded');
    expect(result.verifiedRefs).toEqual([
      expect.objectContaining({
        chunkId: 'stale-address',
        citationAddress: expect.objectContaining({ contentHash: 'old-hash' }),
      }),
    ]);
    expect(result.limitations).toContainEqual({
      chunkId: 'stale-address',
      reason: 'stale-source',
    });
  });

  it('preserves explicit null hrefs on server-owned citation addresses', () => {
    const unresolvedAddress = chunk({
      id: 'explicit-null-address',
      citationAddress: {
        kind: 'text',
        sourceRefId: 'unit-4-1',
        href: null,
        locator: 'handout#missing-anchor',
      },
    });

    const result = verifyLearningEvidenceCitations([unresolvedAddress], {
      role: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'diagnosis',
    }, [
      { chunkId: 'explicit-null-address', useCase: 'diagnosis' },
    ]);

    expect(result.status).toBe('downgraded');
    expect(result.verifiedRefs).toEqual([
      expect.objectContaining({
        displayHref: null,
        citationAddress: expect.objectContaining({ href: null }),
      }),
    ]);
    expect(result.limitations).toContainEqual({
      chunkId: 'explicit-null-address',
      reason: 'unresolved-address',
    });
  });

  it('rejects invalid media timestamp ranges in citation addresses', () => {
    const invalidVideoRange = chunk({
      id: 'invalid-video-range',
      citationAddress: {
        kind: 'video',
        sourceRefId: 'video-1',
        href: '/course-media/unit-4-1.mp4?t=-10',
        mediaStartSeconds: -10,
        mediaEndSeconds: 2,
      },
    });
    const reversedAudioRange = chunk({
      id: 'reversed-audio-range',
      citationAddress: {
        kind: 'audio',
        sourceRefId: 'audio-1',
        href: '/course-media/unit-4-1.mp3?t=24',
        mediaStartSeconds: 24,
        mediaEndSeconds: 12,
      },
    });

    expect(validateLearningEvidenceCorpusChunk(invalidVideoRange)).toContain('invalid-citation-address');
    expect(validateLearningEvidenceCorpusChunk(reversedAudioRange)).toContain('invalid-citation-address');
  });

  it('downgrades restricted citations whose server-owned address cannot be opened', () => {
    const verification = verifyLearningEvidenceCitations(corpus, {
      role: 'teacher',
      userId: 'teacher-1',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'grading',
    }, [
      { chunkId: 'chunk-grading', useCase: 'grading' },
    ]);

    expect(verification.status).toBe('downgraded');
    expect(verification.limitations).toEqual(expect.arrayContaining([
      { chunkId: 'chunk-grading', reason: 'unresolved-address' },
    ]));
    expect(buildLearningEvidenceCitationChips(verification, {
      role: 'teacher',
      userId: 'teacher-1',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'grading',
    })).toEqual([
      expect.objectContaining({
        chunkId: 'chunk-grading',
        displayHref: null,
        addressKind: 'text',
        limitationState: 'unresolved-address',
      }),
    ]);
  });

  it('builds citation audit payloads for verified, rejected, redacted, and degraded citations', () => {
    const lowAuthorityCourse = chunk({
      id: 'low-authority-course',
      confidence: 'high',
      authority: {
        ...chunk().authority,
        level: 'contextual',
      },
    });
    const lowConfidenceCourse = chunk({
      id: 'low-confidence-course',
      confidence: 'low',
    });

    const verification = verifyLearningEvidenceCitations([
      ...corpus,
      lowAuthorityCourse,
      lowConfidenceCourse,
    ], {
      role: 'teacher',
      userId: 'teacher-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'diagnosis',
    }, [
      { chunkId: 'chunk-course-1', useCase: 'diagnosis' },
      { chunkId: 'low-authority-course', useCase: 'diagnosis' },
      { chunkId: 'low-confidence-course', useCase: 'diagnosis' },
      { chunkId: 'chunk-student-path', useCase: 'diagnosis' },
      { chunkId: 'fake-chunk', useCase: 'diagnosis' },
    ], {
      minimumAuthority: 'canonical',
      exposePrivacyRedaction: true,
    });

    const audit = buildLearningEvidenceCitationAuditPayloads(verification, {
      role: 'teacher',
      userId: 'teacher-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'diagnosis',
    });

    expect(audit).toEqual(expect.arrayContaining([
      expect.objectContaining({
        chunkId: 'chunk-course-1',
        outcome: 'verified',
        citationChip: expect.objectContaining({ limitationState: null }),
      }),
      expect.objectContaining({
        chunkId: 'low-authority-course',
        outcome: 'downgraded',
        reason: 'insufficient-authority',
        citationChip: expect.objectContaining({ limitationState: 'insufficient-authority' }),
      }),
      expect.objectContaining({
        chunkId: 'low-confidence-course',
        outcome: 'downgraded',
        reason: 'low-confidence-source',
        reasons: ['low-confidence-source'],
        citationChip: expect.objectContaining({ confidence: 'low', limitationState: 'low-confidence-source' }),
      }),
      expect.objectContaining({
        chunkId: 'chunk-student-path',
        outcome: 'downgraded',
        reason: 'insufficient-authority',
        reasons: expect.arrayContaining(['insufficient-authority', 'privacy-redacted']),
        citationChip: expect.objectContaining({ privacyVisibility: 'redacted', limitationState: 'insufficient-authority' }),
      }),
      expect.objectContaining({
        chunkId: 'fake-chunk',
        outcome: 'rejected',
        reason: 'missing-chunk',
        citationChip: null,
      }),
    ]));
  });

  it('downgrades stale and expired citations in chips and audit payloads', () => {
    const staleCourse = chunk({
      id: 'stale-course',
      freshness: {
        indexedAt: '2026-03-01T00:00:00.000Z',
        sourceUpdatedAt: '2026-02-01T00:00:00.000Z',
        expiresAt: null,
        stale: true,
      },
      authority: {
        ...chunk().authority,
        freshnessBucket: 'stale',
      },
    });
    const expiredCourse = chunk({
      id: 'expired-course',
      freshness: {
        indexedAt: '2026-01-01T00:00:00.000Z',
        sourceUpdatedAt: '2025-12-01T00:00:00.000Z',
        expiresAt: '2026-01-15T00:00:00.000Z',
        stale: true,
      },
      authority: {
        ...chunk().authority,
        freshnessBucket: 'expired',
      },
    });
    const verification = verifyLearningEvidenceCitations([staleCourse, expiredCourse], {
      role: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'diagnosis',
    }, [
      { chunkId: 'stale-course', useCase: 'diagnosis' },
      { chunkId: 'expired-course', useCase: 'diagnosis' },
    ]);

    expect(verification.status).toBe('downgraded');
    expect(verification.limitations).toEqual(expect.arrayContaining([
      { chunkId: 'stale-course', reason: 'stale-source' },
      { chunkId: 'expired-course', reason: 'expired-source' },
    ]));
    expect(buildLearningEvidenceCitationChips(verification, {
      role: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'diagnosis',
    }).map((chip) => [chip.chunkId, chip.limitationState])).toEqual([
      ['stale-course', 'stale-source'],
      ['expired-course', 'expired-source'],
    ]);
    expect(buildLearningEvidenceCitationAuditPayloads(verification, {
      role: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'diagnosis',
    })).toEqual(expect.arrayContaining([
      expect.objectContaining({ chunkId: 'stale-course', outcome: 'downgraded', reason: 'stale-source' }),
      expect.objectContaining({ chunkId: 'expired-course', outcome: 'downgraded', reason: 'expired-source' }),
    ]));
  });

  it('keeps global downgrade limitations downgraded in citation audit payloads', () => {
    const verification = verifyLearningEvidenceCitations([chunk()], {
      role: 'teacher',
      userId: 'teacher-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'diagnosis',
    }, [
      { chunkId: 'chunk-course-1', useCase: 'diagnosis' },
    ], {
      requireLearnerEvidence: true,
    });

    expect(buildLearningEvidenceCitationAuditPayloads(verification, {
      role: 'teacher',
      userId: 'teacher-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'diagnosis',
    })).toEqual(expect.arrayContaining([
      expect.objectContaining({
        chunkId: 'learner-evidence',
        outcome: 'downgraded',
        reason: 'missing-learner-evidence',
        citationChip: null,
      }),
    ]));
  });

  it('rejects citations outside user, goal, class, allowed source, and use-case scope', () => {
    const forgedStudent = verifyLearningEvidenceCitations(corpus, {
      role: 'student',
      userId: 'student-2',
      targetUserId: 'student-1',
      goalId: 'control-correction',
    }, [
      { chunkId: 'chunk-student-path', useCase: 'konling' },
    ]);
    expect(forgedStudent.status).toBe('rejected');
    expect(forgedStudent.limitations).toContainEqual({ chunkId: 'chunk-student-path', reason: 'inaccessible-source' });

    const wrongGoal = verifyLearningEvidenceCitations(corpus, {
      role: 'teacher',
      userId: 'teacher-1',
      classIds: ['class-1'],
      goalId: 'different-goal',
    }, [
      { chunkId: 'chunk-student-path', useCase: 'konling' },
    ]);
    expect(wrongGoal.limitations).toContainEqual({ chunkId: 'chunk-student-path', reason: 'inaccessible-source' });

    const outsideClassChunk = chunk({
      id: 'chunk-class-2-report',
      family: 'report',
      sourceType: 'teacher-report',
      sourceRef: { id: 'report-2', classId: 'class-2', goalId: 'control-correction' },
      display: { title: '另一个班级报告', href: null, capsule: '跨班报告。' },
      content: { text: 'class 2 raw detail', redactedSummary: '跨班报告。', hash: 'hash-class-2' },
      privacyClass: 'teacher-visible',
      authority: {
        level: 'teacher-authored',
        knowledgeTags: [],
        pageAnchor: 'cohort.metrics',
        freshnessBucket: 'current',
        scopeRule: {
          visibility: 'teacher-visible',
          allowedRoles: ['teacher', 'admin', 'service'],
          classRequired: true,
        },
        conflictGroup: null,
        conflictSignal: null,
      },
      retrieval: { tags: ['teacher-report'], goals: ['control-correction'], useCases: ['teacher-report'] },
    });
    const scopedService = verifyLearningEvidenceCitations([...corpus, outsideClassChunk], {
      role: 'service',
      classIds: ['class-1'],
      goalId: 'control-correction',
    }, [
      { chunkId: 'chunk-class-2-report', useCase: 'teacher-report' },
    ]);
    expect(scopedService.limitations).toContainEqual({ chunkId: 'chunk-class-2-report', reason: 'inaccessible-source' });

    const unsupportedFilter = verifyLearningEvidenceCitations(corpus, {
      role: 'teacher',
      userId: 'teacher-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      allowedSourceTypes: ['teacher-report'],
    }, [
      { chunkId: 'chunk-grading', useCase: 'grading' },
    ]);
    expect(unsupportedFilter.limitations).toContainEqual({ chunkId: 'chunk-grading', reason: 'unsupported-source-type' });

    const chunkUseCaseMismatch = verifyLearningEvidenceCitations(corpus, {
      role: 'teacher',
      userId: 'teacher-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
    }, [
      { chunkId: 'chunk-teacher-report', useCase: 'konling' },
    ]);
    expect(chunkUseCaseMismatch.limitations).toContainEqual({ chunkId: 'chunk-teacher-report', reason: 'unsupported-source-type' });

    const callerUseCaseMismatch = verifyLearningEvidenceCitations(corpus, {
      role: 'teacher',
      userId: 'teacher-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'konling',
    }, [
      { chunkId: 'chunk-teacher-report', useCase: 'teacher-report' },
    ]);
    expect(callerUseCaseMismatch.limitations).toContainEqual({ chunkId: 'chunk-teacher-report', reason: 'unsupported-source-type' });

    const ownerMismatch = verifyLearningEvidenceCitations(corpus, {
      role: 'service',
      targetUserId: 'student-2',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'konling',
    }, [
      { chunkId: 'chunk-student-path', useCase: 'konling' },
    ]);
    expect(ownerMismatch.limitations).toContainEqual({ chunkId: 'chunk-student-path', reason: 'inaccessible-source' });
  });

  it('skips malformed corpus records instead of interrupting retrieval or verification', () => {
    const malformed = {
      id: 'malformed',
      family: 'path-evidence',
      sourceType: 'path-summary',
    } as LearningEvidenceCorpusChunk;

    const results = retrieveLearningEvidenceCorpus([malformed, ...corpus], {
      role: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'konling',
    });
    expect(results.map((item) => item.id)).not.toContain('malformed');

    const verification = verifyLearningEvidenceCitations([malformed, ...corpus], {
      role: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'konling',
    }, [
      { chunkId: 'malformed', useCase: 'konling' },
    ]);
    expect(verification.status).toBe('rejected');
    expect(verification.limitations).toContainEqual({ chunkId: 'malformed', reason: 'unsupported-source-type' });

    const missingRetrieval = chunk({
      id: 'missing-retrieval',
    });
    delete (missingRetrieval as unknown as { retrieval?: unknown }).retrieval;
    expect(validateLearningEvidenceCorpusChunk(missingRetrieval)).toEqual(expect.arrayContaining([
      'missing-retrieval-tags',
      'missing-retrieval-goals',
      'missing-retrieval-use-cases',
    ]));
    expect(retrieveLearningEvidenceCorpus([missingRetrieval, ...corpus], {
      role: 'teacher',
      userId: 'teacher-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'konling',
    }).map((item) => item.id)).not.toContain('missing-retrieval');

    const malformedRetrievalItems = chunk({
      id: 'malformed-retrieval-items',
      retrieval: {
        tags: [123] as unknown as string[],
        goals: [null] as unknown as string[],
        useCases: ['unknown-use-case'] as unknown as ['konling'],
      },
    });
    expect(validateLearningEvidenceCorpusChunk(malformedRetrievalItems)).toEqual(expect.arrayContaining([
      'missing-retrieval-tags',
      'missing-retrieval-goals',
      'missing-retrieval-use-cases',
    ]));
    expect(retrieveLearningEvidenceCorpus([malformedRetrievalItems, ...corpus], {
      role: 'teacher',
      userId: 'teacher-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'konling',
    }, { tags: ['x'] }).map((item) => item.id)).not.toContain('malformed-retrieval-items');

    const malformedEnums = chunk({
      id: 'malformed-enums',
      privacyClass: 'service_only' as unknown as 'service-only',
      confidence: 'certain' as unknown as 'high',
      retrieval: { tags: ['konling-memory'], goals: ['control-correction'], useCases: ['konling'] },
    });
    expect(validateLearningEvidenceCorpusChunk(malformedEnums)).toEqual(expect.arrayContaining([
      'missing-privacy-class',
      'missing-confidence',
    ]));
    expect(retrieveLearningEvidenceCorpus([malformedEnums, ...corpus], {
      role: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'konling',
    }, { tags: ['konling-memory'] }).map((item) => item.id)).not.toContain('malformed-enums');
    expect(verifyLearningEvidenceCitations([malformedEnums, ...corpus], {
      role: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'konling',
    }, [
      { chunkId: 'malformed-enums', useCase: 'konling' },
    ]).limitations).toContainEqual({ chunkId: 'malformed-enums', reason: 'unsupported-source-type' });

    const missingSpanRef = chunk({ id: 'missing-span-ref' });
    delete (missingSpanRef as unknown as { spanRef?: unknown }).spanRef;
    expect(validateLearningEvidenceCorpusChunk(missingSpanRef)).toContain('missing-span-ref');
    const spanVerification = verifyLearningEvidenceCitations([missingSpanRef, ...corpus], {
      role: 'teacher',
      userId: 'teacher-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'konling',
    }, [
      { chunkId: 'missing-span-ref', useCase: 'konling', spanRef: { kind: 'record', locator: 'x' } },
    ]);
    expect(spanVerification.limitations).toContainEqual({ chunkId: 'missing-span-ref', reason: 'unsupported-source-type' });

    const incompatibleUseCase = chunk({
      id: 'incompatible-use-case',
      family: 'report',
      sourceType: 'teacher-report',
      retrieval: { tags: ['teacher-report'], goals: ['control-correction'], useCases: ['konling'] },
    });
    expect(validateLearningEvidenceCorpusChunk(incompatibleUseCase)).toContain('source-use-case-mismatch');
    expect(retrieveLearningEvidenceCorpus([incompatibleUseCase, ...corpus], {
      role: 'teacher',
      userId: 'teacher-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
      useCase: 'konling',
    }, { tags: ['teacher-report'] }).map((item) => item.id)).not.toContain('incompatible-use-case');
  });

  it('covers diagnosis, grading, and Konling citation use cases with citation refs', () => {
    const diagnosis = verifyLearningEvidenceCitations(corpus, {
      role: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
    }, [
      { chunkId: 'chunk-course-1', useCase: 'diagnosis', quoteHash: 'hash-course-1' },
      { chunkId: 'chunk-student-path', useCase: 'diagnosis', spanRef: { kind: 'record', locator: 'terminalValidation' } },
    ]);
    expect(diagnosis.status).toBe('verified');

    const grading = verifyLearningEvidenceCitations(corpus, {
      role: 'teacher',
      userId: 'teacher-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
    }, [
      { chunkId: 'chunk-grading', useCase: 'grading' },
    ]);
    expect(grading.status).toBe('downgraded');
    expect(grading.limitations).toEqual(expect.arrayContaining([
      { chunkId: 'chunk-grading', reason: 'unresolved-address' },
    ]));

    const konling = verifyLearningEvidenceCitations(corpus, {
      role: 'service',
      targetUserId: 'student-1',
      classIds: ['class-1'],
      goalId: 'control-correction',
    }, [
      { chunkId: 'chunk-service-memory', useCase: 'konling' },
    ]);
    expect(konling.status).toBe('downgraded');
    expect(konling.limitations).toEqual(expect.arrayContaining([
      { chunkId: 'chunk-service-memory', reason: 'unresolved-address' },
    ]));
  });
});
