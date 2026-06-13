import { describe, expect, it } from 'vitest';
import {
  materializeControlCorrectionDiagnosisReport,
  type DiagnosisReportSnapshot,
} from '../control-correction-diagnosis-profile';
import {
  ROLE_BASED_LEARNING_DIAGNOSIS_VERSION,
  materializeRoleBasedLearningDiagnosis,
  validateRoleBasedLearningDiagnosis,
  type RoleBasedLearningDiagnosisInput,
} from '../role-based-learning-diagnosis';
import type { LearningEvidenceAuthorityMetadata, LearningEvidenceCorpusChunk, LearningEvidenceRetrievalRole } from '../learning-evidence-rag-corpus';

const now = new Date('2026-06-04T10:00:00.000Z');

function evidence(overrides: Partial<LearningEvidenceCorpusChunk> = {}): LearningEvidenceCorpusChunk {
  const base: LearningEvidenceCorpusChunk = {
    id: 'chunk-path-1',
    family: 'path-evidence',
    sourceType: 'path-summary',
    sourceRef: { id: 'path-1', ownerUserId: 'student-1', classId: 'class-1', goalId: 'control-correction' },
    spanRef: { kind: 'summary', locator: 'path.execution.allTime' },
    display: { title: '校正路径终端验证', href: '/profile/path/path-1', capsule: '终端仿真验证通过率偏低。' },
    content: { text: 'raw path trace with hidden payload', redactedSummary: '终端仿真验证通过率偏低。', hash: 'hash-path-1' },
    privacyClass: 'student-visible',
    confidence: 'medium',
    freshness: { indexedAt: now.toISOString(), sourceUpdatedAt: now.toISOString(), expiresAt: null, stale: false },
    authority: {
      level: 'learner-evidence',
      knowledgeTags: [],
      pageAnchor: 'path.execution.allTime',
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
    retrieval: { tags: ['control-correction', 'terminal-validation'], goals: ['control-correction'], useCases: ['diagnosis', 'konling'] },
    ...overrides,
  };
  return {
    ...base,
    authority: overrides.authority ?? authorityFor(base),
  };
}

function authorityFor(chunk: LearningEvidenceCorpusChunk): LearningEvidenceAuthorityMetadata {
  const allowedRolesByPrivacy: Record<LearningEvidenceCorpusChunk['privacyClass'], LearningEvidenceRetrievalRole[]> = {
    public: ['student', 'teacher', 'admin', 'service'],
    'student-visible': ['student', 'teacher', 'admin', 'service'],
    'teacher-visible': ['teacher', 'admin', 'service'],
    'admin-only': ['admin', 'service'],
    'service-only': ['service'],
  };
  const level: LearningEvidenceAuthorityMetadata['level'] =
    chunk.privacyClass === 'service-only' ? 'service-internal' :
      chunk.sourceType === 'teacher-report' || chunk.sourceType === 'grading-artifact' ? 'teacher-authored' :
        'learner-evidence';
  return {
    level,
    knowledgeTags: [],
    pageAnchor: chunk.spanRef.locator ?? null,
    freshnessBucket: chunk.freshness.stale ? 'stale' : 'current',
    scopeRule: {
      visibility: chunk.privacyClass,
      allowedRoles: allowedRolesByPrivacy[chunk.privacyClass],
      ownerRequired: Boolean(chunk.sourceRef.ownerUserId),
      classRequired: Boolean(chunk.sourceRef.classId),
      privilegedDiagnostics: chunk.privacyClass === 'service-only' || undefined,
    },
    conflictGroup: null,
    conflictSignal: null,
  };
}

const goalSlice = {
  goalId: 'control-correction',
  payloadVersion: 'control-correction-goal-slice.v1',
  generatedAt: now.toISOString(),
  targetLevels: ['application'],
  dimensions: [
    {
      id: 'modeling',
      targetLevel: 'application',
      score: 62,
      sourceCoverage: {
        assessment: 'sufficient',
        simulation: 'partial',
        arena: 'missing',
        reflection: 'partial',
        aiCollaboration: 'missing',
      },
      evidenceCount: 3,
      freshness: 'current',
      evidenceProvenance: {
        assessment: 'assessment-backed',
        simulation: 'governed-replay',
        arena: 'missing',
        reflection: 'governed-reflection',
        aiCollaboration: 'missing',
      },
      confidence: { state: 'medium', score: 0.66, evidenceCount: 3, sourceCompleteness: 0.58 },
      privacy: {
        score: 'student-visible',
        sourceCoverage: 'teacher-scoped',
        confidence: 'student-visible',
        teacherExplanation: 'teacher-scoped',
        auditRefs: 'internal',
        rawPayloads: 'internal',
      },
      fallbackMarkers: ['arena-evidence-missing'],
    },
  ],
  pathContext: {
    activePathId: 'path-1',
    activePathStatus: 'active',
    currentNodeId: 'node-terminal',
    terminalValidationState: 'needs-validation',
    recentPathIds: ['path-1'],
    noActivePath: false,
  },
  privacyClasses: {
    student: 'student-visible',
    teacher: 'teacher-scoped',
    admin: 'admin',
    audit: 'audit',
    internal: 'internal',
  },
};

const baseInput: RoleBasedLearningDiagnosisInput = {
  view: 'student',
  goalId: 'control-correction',
  userId: 'student-1',
  classId: 'class-1',
  goalSlice,
  learnerState: {
    userId: 'student-1',
    generatedAt: now.toISOString(),
    goalSlices: { controlCorrection: goalSlice },
  },
  featureCache: {
    userId: 'student-1',
    features: {
      pathExecution: {
        allTime: {
          evidenceCount: 4,
          terminalValidation: { state: 'needs-validation' },
          sourceReferences: [{ sourceType: 'LearningPathExecution', id: 'exec-1' }],
        },
      },
    },
    freshness: { sourceLastUpdatedAt: now.toISOString(), stale: false },
  },
  pathOutcomeSummary: {
    pathId: 'path-1',
    status: 'active',
    terminalValidationState: 'needs-validation',
    deviationCount: 1,
    interventionCount: 2,
  },
  gradingSummary: {
    status: 'unavailable',
    unavailableReason: 'document-grading-workbench-not-present',
  },
  evidenceCorpus: [evidence()],
  now,
};

describe('role-based learning diagnosis materialization', () => {
  it('materializes a student diagnosis with evidence, confidence, limitations, and redacted content', () => {
    const diagnosis = materializeRoleBasedLearningDiagnosis(baseInput);

    expect(diagnosis.version).toBe(ROLE_BASED_LEARNING_DIAGNOSIS_VERSION);
    expect(diagnosis.view).toBe('student');
    expect(diagnosis.claims[0]).toMatchObject({
      dimensionId: 'modeling',
      confidence: { state: 'medium' },
      privacyClass: 'student-visible',
      sourceCoverage: {
        assessment: 'sufficient',
        simulation: 'partial',
        arena: 'missing',
      },
    });
    expect(diagnosis.claims[0].evidenceRefs).toEqual([
      expect.objectContaining({ chunkId: 'chunk-path-1', sourceType: 'path-summary' }),
    ]);
    expect(diagnosis.claims[0].evidenceRefs[0].citationChip).toEqual(expect.objectContaining({
      chunkId: 'chunk-path-1',
      authorityLevel: 'learner-evidence',
      freshnessBucket: 'current',
      privacyVisibility: 'redacted',
      limitationState: null,
    }));
    expect(JSON.stringify(diagnosis.claims[0].evidenceRefs[0].citationChip)).not.toContain('ownerRequired');
    expect(diagnosis.claims[0].nextActions[0]).toMatchObject({
      kind: 'learning-path',
      href: null,
      unavailableReason: 'path-detail-route-unavailable',
    });
    expect(diagnosis.limitations.map((item) => item.reason)).toContain('document-grading-workbench-not-present');
    expect(JSON.stringify(diagnosis)).not.toContain('raw path trace');
    expect(validateRoleBasedLearningDiagnosis(diagnosis)).toEqual([]);
  });

  it('materializes a teacher class diagnosis with clusters, denominators, intervention priority, and scoped drilldowns', () => {
    const diagnosis = materializeRoleBasedLearningDiagnosis({
      ...baseInput,
      view: 'teacher-class',
      teacherClassIds: ['class-1'],
      teacherReport: {
        classInfo: { id: 'class-1', name: '自动控制 1 班', studentCount: 32 },
        metrics: {
          simulationPassRate: {
            id: 'simulationPassRate',
            label: '仿真通过率',
            value: 0.41,
            denominator: 22,
            confidence: 'medium',
            sourceCoverage: { readyStudents: 18, staleStudents: 2, missingStudents: 4, lowConfidenceStudents: 3 },
          },
        },
        studentDrilldowns: [
          { userId: 'student-1', name: '学生一', evidenceState: 'ready', path: { pathId: 'path-1' } },
        ],
      },
    });

    expect(diagnosis.view).toBe('teacher-class');
    expect(diagnosis.claims[0].studentExplanation).toBeUndefined();
    expect(diagnosis.rootCauseClusters[0]).toMatchObject({
      dimensionId: 'modeling',
      affectedPopulation: 18,
      denominator: 32,
      interventionPriority: 'high',
    });
    expect(diagnosis.drilldownRefs).toEqual([
      { kind: 'student-consultation', userId: 'student-1', href: '/teacher/classes/class-1/students/student-1' },
    ]);
    expect(JSON.stringify(diagnosis)).not.toContain('raw path trace');
    expect(validateRoleBasedLearningDiagnosis(diagnosis)).toEqual([]);
  });

  it('downgrades claims when evidence is stale, low confidence, or path evidence is missing', () => {
    const diagnosis = materializeRoleBasedLearningDiagnosis({
      ...baseInput,
      evidenceCorpus: [evidence({ confidence: 'low', freshness: { indexedAt: now.toISOString(), sourceUpdatedAt: now.toISOString(), expiresAt: null, stale: true } })],
      pathOutcomeSummary: null,
    });

    expect(diagnosis.claims[0].confidence.state).toBe('low');
    expect(diagnosis.claims[0].limitations.map((item) => item.reason)).toEqual(expect.arrayContaining([
      'stale-evidence',
      'low-confidence',
      'no-active-path',
    ]));
    expect(validateRoleBasedLearningDiagnosis(diagnosis)).toEqual([]);
  });

  it('keeps service diagnostics auditable while ordinary views omit raw private payloads', () => {
    const serviceOnly = evidence({
      id: 'chunk-service-1',
      family: 'diagnosis',
      sourceType: 'diagnosis',
      sourceRef: { id: 'diagnosis-raw-1', ownerUserId: 'student-1', classId: 'class-1', goalId: 'control-correction' },
      content: { text: 'private memory and raw feature payload', redactedSummary: '内部诊断摘要', hash: 'hash-private-1' },
      privacyClass: 'service-only',
      retrieval: { tags: ['control-correction'], goals: ['control-correction'], useCases: ['diagnosis'] },
    });

    const student = materializeRoleBasedLearningDiagnosis({ ...baseInput, evidenceCorpus: [serviceOnly, evidence()] });
    const service = materializeRoleBasedLearningDiagnosis({ ...baseInput, view: 'service', evidenceCorpus: [serviceOnly, evidence()] });

    expect(JSON.stringify(student)).not.toContain('private memory');
    expect(service.auditRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({ chunkId: 'chunk-service-1', privacyClass: 'service-only' }),
    ]));
    expect(validateRoleBasedLearningDiagnosis(service)).toEqual([]);
  });

  it('does not let teacher-student diagnosis fall back to class-wide learner evidence without a target student', () => {
    const otherStudentEvidence = evidence({
      id: 'chunk-path-2',
      sourceRef: { id: 'path-2', ownerUserId: 'student-2', classId: 'class-1', goalId: 'control-correction' },
      display: { title: '另一个学生的路径证据', href: '/profile/path/path-2', capsule: '另一个学生的偏离证据。' },
      content: { text: 'student-2 raw trace', redactedSummary: '另一个学生的偏离证据。', hash: 'hash-path-2' },
    });

    const withoutTarget = materializeRoleBasedLearningDiagnosis({
      ...baseInput,
      view: 'teacher-student',
      userId: null,
      targetUserId: null,
      evidenceCorpus: [evidence(), otherStudentEvidence],
    });
    const targeted = materializeRoleBasedLearningDiagnosis({
      ...baseInput,
      view: 'teacher-student',
      userId: null,
      targetUserId: 'student-1',
      teacherClassIds: ['class-1'],
      evidenceCorpus: [evidence(), otherStudentEvidence],
    });

    expect(withoutTarget.claims[0].evidenceRefs).toEqual([]);
    expect(withoutTarget.claims[0].rootCause).toBe('缺少明确目标学生，未读取个人路径或诊断证据。');
    expect(withoutTarget.claims[0].nextActions[0]).toMatchObject({
      kind: 'learning-path',
      href: null,
      unavailableReason: 'missing-target-student',
    });
    expect(withoutTarget.claims[0].nextActions.every((action) => action.href === null && action.unavailableReason)).toBe(true);
    expect(withoutTarget.materialization.inputs).toEqual(['grading-summary']);
    expect(withoutTarget.claims[0].confidence.evidenceCount).toBe(0);
    expect(withoutTarget.claims[0].limitations.map((item) => item.reason)).toContain('missing-citation');
    expect(withoutTarget.claims[0].limitations.map((item) => item.reason)).toContain('missing-target-student');
    expect(JSON.stringify(withoutTarget)).not.toContain('path-1');
    expect(JSON.stringify(withoutTarget)).not.toContain('student-2');
    expect(targeted.claims[0].evidenceRefs.map((ref) => ref.chunkId)).toEqual(['chunk-path-1']);
  });

  it('lets teacher-class diagnosis use class-scoped learner evidence without treating teacher userId as target learner', () => {
    const diagnosis = materializeRoleBasedLearningDiagnosis({
      ...baseInput,
      view: 'teacher-class',
      userId: 'teacher-1',
      targetUserId: null,
      teacherClassIds: ['class-1'],
      teacherReport: {
        classInfo: { id: 'class-1', name: '自动控制 1 班', studentCount: 32 },
        metrics: {},
        studentDrilldowns: [],
      },
    });

    expect(diagnosis.claims[0].evidenceRefs.map((ref) => ref.chunkId)).toEqual(['chunk-path-1']);
    expect(diagnosis.claims[0].limitations.map((item) => item.reason)).not.toContain('missing-citation');
  });

  it('does not let teacher fallback diagnosis read class evidence outside teacherClassIds', () => {
    const diagnosis = materializeRoleBasedLearningDiagnosis({
      ...baseInput,
      view: 'teacher-class',
      userId: 'teacher-1',
      targetUserId: null,
      teacherClassIds: ['class-2'],
      teacherReport: {
        classInfo: { id: 'class-1', name: '自动控制 1 班', studentCount: 32 },
        metrics: {},
        studentDrilldowns: [],
      },
    });

    expect(diagnosis.claims[0].evidenceRefs).toEqual([]);
    expect(diagnosis.claims[0].limitations.map((item) => item.reason)).toContain('missing-citation');
  });

  it('keeps service audit refs aligned with goal-scoped evidence even without duplicate goal tags', () => {
    const goalOnlyServiceEvidence = evidence({
      id: 'chunk-service-goal-only',
      family: 'diagnosis',
      sourceType: 'diagnosis',
      sourceRef: { id: 'diagnosis-service-1', ownerUserId: 'student-1', classId: 'class-1', goalId: 'control-correction' },
      privacyClass: 'service-only',
      content: { text: 'private service diagnosis payload', redactedSummary: '内部诊断摘要', hash: 'hash-service-goal-only' },
      retrieval: { tags: ['terminal-validation'], goals: ['control-correction'], useCases: ['diagnosis'] },
    });

    const diagnosis = materializeRoleBasedLearningDiagnosis({
      ...baseInput,
      view: 'service',
      evidenceCorpus: [goalOnlyServiceEvidence],
    });

    expect(diagnosis.auditRefs).toEqual([
      expect.objectContaining({ chunkId: 'chunk-service-goal-only', privacyClass: 'service-only' }),
    ]);
  });

  it('preserves explicit service target student scope for personal diagnosis and audit refs', () => {
    const otherStudentEvidence = evidence({
      id: 'chunk-service-other-student',
      family: 'diagnosis',
      sourceType: 'diagnosis',
      sourceRef: { id: 'diagnosis-service-2', ownerUserId: 'student-2', classId: 'class-1', goalId: 'control-correction' },
      privacyClass: 'service-only',
      content: { text: 'student-2 private diagnosis payload', redactedSummary: '另一个学生内部摘要', hash: 'hash-service-other' },
      retrieval: { tags: ['terminal-validation'], goals: ['control-correction'], useCases: ['diagnosis'] },
    });
    const targetEvidence = evidence({
      id: 'chunk-service-target-student',
      family: 'diagnosis',
      sourceType: 'diagnosis',
      sourceRef: { id: 'diagnosis-service-1', ownerUserId: 'student-1', classId: 'class-1', goalId: 'control-correction' },
      privacyClass: 'service-only',
      content: { text: 'student-1 private diagnosis payload', redactedSummary: '目标学生内部摘要', hash: 'hash-service-target' },
      retrieval: { tags: ['terminal-validation'], goals: ['control-correction'], useCases: ['diagnosis'] },
    });

    const diagnosis = materializeRoleBasedLearningDiagnosis({
      ...baseInput,
      view: 'service',
      userId: 'service-worker',
      targetUserId: 'student-1',
      evidenceCorpus: [otherStudentEvidence, targetEvidence],
    });

    expect(diagnosis.claims[0].evidenceRefs.map((ref) => ref.chunkId)).toEqual(['chunk-service-target-student']);
    expect(diagnosis.auditRefs.map((ref) => ref.chunkId)).toEqual(['chunk-service-target-student']);
    expect(JSON.stringify(diagnosis)).not.toContain('student-2 private');
  });

  it('uses goal scope rather than requiring a duplicate goal tag for diagnosis evidence', () => {
    const goalOnlyEvidence = evidence({
      retrieval: { tags: ['terminal-validation'], goals: ['control-correction'], useCases: ['diagnosis'] },
    });

    const diagnosis = materializeRoleBasedLearningDiagnosis({
      ...baseInput,
      evidenceCorpus: [goalOnlyEvidence],
    });

    expect(diagnosis.claims[0].evidenceRefs.map((ref) => ref.chunkId)).toEqual(['chunk-path-1']);
    expect(diagnosis.claims[0].limitations.map((item) => item.reason)).not.toContain('missing-citation');
  });

  it('downgrades diagnosis freshness when the governed feature cache is stale', () => {
    const diagnosis = materializeRoleBasedLearningDiagnosis({
      ...baseInput,
      featureCache: {
        ...baseInput.featureCache,
        freshness: { sourceLastUpdatedAt: '2026-05-01T00:00:00.000Z', stale: true },
      },
    });

    expect(diagnosis.claims[0].evidenceWindow.stale).toBe(true);
    expect(diagnosis.claims[0].limitations.map((item) => item.reason)).toContain('stale-evidence');
    expect(validateRoleBasedLearningDiagnosis(diagnosis)).toEqual([]);
  });

  it('projects governed report snapshots when available and exposes missing-snapshot fallback otherwise', () => {
    const reportSnapshot: DiagnosisReportSnapshot = materializeControlCorrectionDiagnosisReport({
      subject: { kind: 'student', userId: 'student-1', classId: 'class-1' },
      goalId: 'control-correction',
      generatedAt: now,
      evidenceRecords: [{
        id: 'snapshot-evidence-1',
        sourceFamily: 'adaptive-assessment',
        indicatorIds: ['time-response-settling-control'],
        value: 0.72,
        confidence: 'high',
        updatedAt: now.toISOString(),
        provenance: { classId: 'class-1', userId: 'student-1', goalId: 'control-correction' },
        evidenceRef: { chunkId: 'chunk-snapshot-1', sourceType: 'diagnosis', title: '治理指标快照' },
      }],
      now,
    });
    const teacherScopedSnapshot: DiagnosisReportSnapshot = materializeControlCorrectionDiagnosisReport({
      subject: { kind: 'student', userId: 'student-1', classId: 'class-1' },
      goalId: 'control-correction',
      generatedAt: now,
      evidenceRecords: [{
        id: 'snapshot-teacher-evidence',
        sourceFamily: 'grading-fact',
        indicatorIds: ['reflection-error-correction'],
        value: 'proficient',
        confidence: 'high',
        updatedAt: now.toISOString(),
        provenance: { classId: 'class-1', userId: 'student-1', goalId: 'control-correction' },
        evidenceRef: {
          chunkId: 'teacher-private-ref',
          sourceType: 'grading-artifact',
          title: '教师私有批注',
          href: '/teacher/private-comment',
          capsule: '仅教师可见',
          privacyVisibility: 'teacher-scoped',
        },
      }],
      now,
    });

    const projected = materializeRoleBasedLearningDiagnosis({
      ...baseInput,
      goalSlice: null,
      evidenceCorpus: [],
      diagnosisReportSnapshot: reportSnapshot,
    });
    const fallback = materializeRoleBasedLearningDiagnosis({
      ...baseInput,
      goalSlice: null,
      evidenceCorpus: [],
      diagnosisReportSnapshot: null,
    });

    expect(projected.materialization.inputs).toContain('control-correction-diagnosis-report-snapshot');
    expect(projected.claims[0]).toEqual(expect.objectContaining({
      dimensionId: 'time-domain-analysis',
      evidenceRefs: [expect.objectContaining({ chunkId: 'chunk-snapshot-1' })],
    }));
    expect(projected.limitations.map((item) => item.reason)).not.toContain('missing-snapshot');
    expect(fallback.limitations.map((item) => item.reason)).toContain('missing-snapshot');
    expect(fallback.materialization.inputs).not.toContain('control-correction-diagnosis-report-snapshot');
    expect(materializeRoleBasedLearningDiagnosis({
      ...baseInput,
      goalSlice: null,
      evidenceCorpus: [],
      diagnosisReportSnapshot: teacherScopedSnapshot,
    }).claims.flatMap((claim) => claim.evidenceRefs)).toEqual([]);
    expect(validateRoleBasedLearningDiagnosis(projected)).toEqual([]);
    expect(validateRoleBasedLearningDiagnosis(fallback)).toEqual([]);
  });

  it('projects diagnosis observation freshness and limitation states into visible citation chips', () => {
    const snapshot = materializeControlCorrectionDiagnosisReport({
      subject: { kind: 'student', userId: 'student-1', classId: 'class-1' },
      goalId: 'control-correction',
      generatedAt: now,
      evidenceRecords: [{
        id: 'snapshot-stale-evidence',
        sourceFamily: 'adaptive-assessment',
        indicatorIds: ['time-response-settling-control'],
        value: 0.72,
        confidence: 'low',
        updatedAt: '2026-03-01T00:00:00.000Z',
        provenance: { classId: 'class-1', userId: 'student-1', goalId: 'control-correction' },
        evidenceRef: { chunkId: 'chunk-stale-snapshot', sourceType: 'diagnosis', title: '过期治理指标快照' },
      }],
      now,
    });

    const diagnosis = materializeRoleBasedLearningDiagnosis({
      ...baseInput,
      goalSlice: null,
      evidenceCorpus: [],
      diagnosisReportSnapshot: snapshot,
    });

    const evidence = diagnosis.claims[0].evidenceRefs[0];
    expect(evidence).toEqual(expect.objectContaining({
      chunkId: 'chunk-stale-snapshot',
      confidence: 'low',
      citationChip: expect.objectContaining({
        freshnessBucket: 'stale',
        limitationState: 'stale-source',
      }),
    }));
  });

  it('keeps legacy diagnosis snapshots without observations usable in role projections', () => {
    const { observations: _observations, ...legacySnapshot } = materializeControlCorrectionDiagnosisReport({
      subject: { kind: 'student', userId: 'student-1', classId: 'class-1' },
      goalId: 'control-correction',
      generatedAt: now,
      evidenceRecords: [{
        id: 'snapshot-legacy-evidence',
        sourceFamily: 'adaptive-assessment',
        indicatorIds: ['time-response-settling-control'],
        value: 0.72,
        confidence: 'high',
        updatedAt: now.toISOString(),
        provenance: { classId: 'class-1', userId: 'student-1', goalId: 'control-correction' },
        evidenceRef: { chunkId: 'chunk-legacy-snapshot', sourceType: 'diagnosis', title: '旧版治理指标快照' },
      }],
      now,
    });

    expect(() => materializeRoleBasedLearningDiagnosis({
      ...baseInput,
      goalSlice: null,
      evidenceCorpus: [],
      diagnosisReportSnapshot: legacySnapshot as DiagnosisReportSnapshot,
    })).not.toThrow();
  });

  it.each([
    ['studentAnswer in title', { title: 'studentAnswer hidden answer', href: '/profile/path/safe', capsule: 'safe capsule' }, 'studentAnswer'],
    ['rawTracePayload in title', { title: 'rawTracePayload secret', href: '/profile/path/safe', capsule: 'safe capsule' }, 'rawTracePayload'],
    ['rawPayload in capsule', { title: 'safe title', href: '/profile/path/safe', capsule: 'rawPayload secret' }, 'rawPayload'],
    ['rawDiagnostics in capsule', { title: 'safe title', href: '/profile/path/safe', capsule: 'rawDiagnostics secret' }, 'rawDiagnostics'],
    ['raw query key in href', { title: 'safe title', href: '/profile/path?raw=true', capsule: 'safe capsule' }, 'raw=true'],
    ['rawTracePayload query key in href', { title: 'safe title', href: '/profile/path?rawTracePayload=secret', capsule: 'safe capsule' }, 'rawTracePayload'],
    ['privateKonlingMemory query key in href', { title: 'safe title', href: '/profile/path?privateKonlingMemory=secret', capsule: 'safe capsule' }, 'privateKonlingMemory'],
    ['private Konling memory in capsule', { title: 'safe title', href: '/profile/path/safe', capsule: 'private Konling memory raw dialogue' }, 'private Konling memory'],
  ])('redacts sensitive diagnosis snapshot evidence reference display text: %s', (_caseName, evidenceRef, forbiddenText) => {
    const snapshot = materializeControlCorrectionDiagnosisReport({
      subject: { kind: 'student', userId: 'student-1', classId: 'class-1' },
      goalId: 'control-correction',
      generatedAt: now,
      evidenceRecords: [{
        id: 'snapshot-sensitive-evidence',
        sourceFamily: 'adaptive-assessment',
        indicatorIds: ['time-response-settling-control'],
        value: 0.72,
        confidence: 'high',
        updatedAt: now.toISOString(),
        provenance: { classId: 'class-1', userId: 'student-1', goalId: 'control-correction' },
        evidenceRef: {
          chunkId: 'chunk-sensitive',
          sourceType: 'diagnosis',
          ...evidenceRef,
        },
      }],
      now,
    });

    const diagnosis = materializeRoleBasedLearningDiagnosis({
      ...baseInput,
      goalSlice: null,
      evidenceCorpus: [],
      diagnosisReportSnapshot: snapshot,
    });

    const evidence = diagnosis.claims[0].evidenceRefs[0];
    if (evidenceRef.title !== 'safe title') {
      expect(evidence.displayTitle).toBe('证据摘要已脱敏');
      expect(evidence.citationChip.displayTitle).toBe('证据摘要已脱敏');
    }
    if (evidenceRef.href !== '/profile/path/safe') {
      expect(evidence.displayHref).toBeNull();
      expect(evidence.citationChip.displayHref).toBeNull();
    }
    if (evidenceRef.capsule !== 'safe capsule') {
      expect(evidence.capsule).toBe('证据摘要已脱敏');
    }
    const serializedRef = JSON.stringify(evidence);
    expect(serializedRef).not.toContain(forbiddenText);
  });

  it('does not project snapshots across student or teacher authorization boundaries', () => {
    const otherStudentSnapshot = materializeControlCorrectionDiagnosisReport({
      subject: { kind: 'student', userId: 'student-2', classId: 'class-1' },
      goalId: 'control-correction',
      generatedAt: now,
      evidenceRecords: [{
        id: 'student-2-secret',
        sourceFamily: 'adaptive-assessment',
        indicatorIds: ['time-response-settling-control'],
        value: 0.9,
        confidence: 'high',
        updatedAt: now.toISOString(),
        provenance: { classId: 'class-1', userId: 'student-2', goalId: 'control-correction' },
        evidenceRef: { chunkId: 'student-2-secret', sourceType: 'diagnosis', title: 'student-2-secret' },
      }],
      now,
    });
    const classSnapshot = materializeControlCorrectionDiagnosisReport({
      subject: { kind: 'class', classId: 'class-9' },
      goalId: 'control-correction',
      generatedAt: now,
      evidenceRecords: [{
        id: 'class-9-secret',
        sourceFamily: 'adaptive-assessment',
        indicatorIds: ['time-response-settling-control'],
        value: 0.9,
        confidence: 'high',
        updatedAt: now.toISOString(),
        provenance: { classId: 'class-9', goalId: 'control-correction' },
        evidenceRef: { chunkId: 'class-9-secret', sourceType: 'diagnosis', title: 'class-9-secret' },
      }],
      now,
    });

    const student = materializeRoleBasedLearningDiagnosis({
      ...baseInput,
      userId: 'student-1',
      targetUserId: 'student-2',
      goalSlice: null,
      evidenceCorpus: [],
      diagnosisReportSnapshot: otherStudentSnapshot,
    });
    const teacher = materializeRoleBasedLearningDiagnosis({
      ...baseInput,
      view: 'teacher-class',
      userId: 'teacher-1',
      classId: 'class-9',
      teacherClassIds: ['class-1'],
      goalSlice: null,
      evidenceCorpus: [],
      diagnosisReportSnapshot: classSnapshot,
    });

    expect(JSON.stringify(student)).not.toContain('student-2-secret');
    expect(student.materialization.inputs).not.toContain('control-correction-diagnosis-report-snapshot');
    expect(student.limitations.map((item) => item.reason)).toContain('missing-snapshot');
    expect(JSON.stringify(teacher)).not.toContain('class-9-secret');
    expect(teacher.materialization.inputs).not.toContain('control-correction-diagnosis-report-snapshot');
    expect(teacher.limitations.map((item) => item.reason)).toContain('missing-snapshot');
  });
});
