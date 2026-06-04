import { describe, expect, it } from 'vitest';
import {
  LEARNING_EVIDENCE_CORPUS_RETENTION_POLICY,
  retrieveLearningEvidenceCorpus,
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
    expect(LEARNING_EVIDENCE_CORPUS_RETENTION_POLICY).toMatchObject({
      rebuildTriggers: expect.arrayContaining(['source-updated', 'privacy-scope-changed']),
      invalidationSignals: expect.arrayContaining(['stale-source-hash', 'access-scope-revoked']),
      retention: expect.objectContaining({ learnerEvidenceDays: 180 }),
    });
  });

  it('retrieves student-visible evidence only inside the student scope and redacts raw text', () => {
    const results = retrieveLearningEvidenceCorpus(corpus, {
      role: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
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
      goalId: 'control-correction',
      useCase: 'konling',
    }, { tags: ['terminal-validation'] });
    expect(otherStudentResults).toEqual([]);

    const publicCourseForStudent = retrieveLearningEvidenceCorpus(corpus, {
      role: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
      goalId: 'control-correction',
      useCase: 'konling',
    }, { tags: ['control-correction'] });
    expect(publicCourseForStudent.map((item) => item.id)).toContain('chunk-course-1');

    const forgedTargetResults = retrieveLearningEvidenceCorpus(corpus, {
      role: 'student',
      userId: 'student-2',
      targetUserId: 'student-1',
      goalId: 'control-correction',
      useCase: 'konling',
      includePrivateText: true,
    }, { tags: ['terminal-validation'] });
    expect(forgedTargetResults).toEqual([]);
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
      goalId: 'control-correction',
      useCase: 'konling',
      includePrivateText: true,
    }, { tags: ['konling-memory'] });
    expect(service.map((item) => item.id)).toEqual(['chunk-service-memory']);
    expect(service[0].content.text).toBe('private Konling memory');

    const admin = retrieveLearningEvidenceCorpus(corpus, {
      role: 'admin',
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

  it('covers diagnosis, grading, and Konling citation use cases with verified refs', () => {
    const diagnosis = verifyLearningEvidenceCitations(corpus, {
      role: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
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
    expect(grading.status).toBe('verified');

    const konling = verifyLearningEvidenceCitations(corpus, {
      role: 'service',
      goalId: 'control-correction',
    }, [
      { chunkId: 'chunk-service-memory', useCase: 'konling' },
    ]);
    expect(konling.status).toBe('verified');
  });
});
