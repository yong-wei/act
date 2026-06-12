import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ResourceNode } from '@/lib/resource-node-registry';
import type { ControlCorrectionTeacherReport } from '../control-correction-teacher-report';
import type { RoleBasedLearningDiagnosis } from '../role-based-learning-diagnosis';
import {
  activateCourseEnhancementPack,
  activatePersistedCourseEnhancementPack,
  archiveCourseEnhancementPack,
  archivePersistedCourseEnhancementPack,
  buildTeacherPrepPackInsertionPayload,
  buildTeacherPrepPackExportPayload,
  buildCourseEnhancementPackPreview,
  createCourseEnhancementPackFromPrepPack,
  type CourseEnhancementRuntimeContext,
  type CourseEnhancementPackPersistenceRecord,
  type CourseEnhancementPackPersistenceClient,
  generateTeacherPrepPack,
  isTeacherPrepPackInsertionEligible,
  loadCourseEnhancementPack,
  mergeCourseEnhancementPackOverlay,
  persistCourseEnhancementPack,
  recordCourseEnhancementPackImpactEvidence,
  rollbackCourseEnhancementPack,
  rollbackPersistedCourseEnhancementPack,
  reviewTeacherPrepPackItem,
  validateTeacherPrepPack,
  validateCourseEnhancementPack,
  validateTeacherPrepPackItem,
} from '../teacher-prep-pack-generation';

const now = new Date('2026-06-05T00:00:00.000Z');
const TEST_CONTEXT_SECRET = 'test-konling-mode-context-secret-for-prep-pack';

function resourceNode(input: Partial<ResourceNode> & { id: string; title: string; type: ResourceNode['type'] }): ResourceNode {
  const base: ResourceNode = {
    id: input.id,
    title: input.title,
    description: null,
    type: input.type,
    courseModule: 'control-correction',
    sourceKind: 'resource_registry',
    sourceRef: input.id,
    sourceRefs: [{ kind: 'resource_registry', ref: input.id }],
    renderTarget: null,
    launchTarget: `/resources/${input.id}`,
    planningMetadata: {
      prerequisites: [],
      estimatedTimeMinutes: 9,
      cognitiveLoad: 'medium',
      knowledgeCoverage: ['controlModeling', 'simulation'],
      abilityImpact: { controlModeling: 0.6, parameterDesign: 0.4 },
      cost: { effort: 'medium', requiresTeacherReview: true },
      availability: 'available',
      teacherPolicy: 'allowed',
      privacyLevel: 'student-visible',
      terminalConstraints: [],
      evidenceInstrumentation: ['learning-fact'],
    },
    sourceOfRecord: {
      content: 'resource_registry',
      catalogMetadata: 'resource_registry',
      planningMetadata: 'ResourceNode',
    },
    eligibility: { pathEligible: true, reasons: [], auditIssues: [] },
  };
  return {
    ...base,
    ...input,
    id: input.id,
    title: input.title,
    type: input.type,
  };
}

function diagnosis(): RoleBasedLearningDiagnosis {
  return {
    version: 'role-based-learning-diagnosis.v1',
    view: 'teacher-class',
    goalId: 'control-correction',
    generatedAt: now.toISOString(),
    materialization: {
      version: 'role-based-learning-diagnosis.v1',
      inputs: ['feature-cache', 'learning-evidence-corpus'],
      refresh: 'on-evidence-change-or-request',
    },
    claims: [{
      id: 'claim-control-modeling',
      dimensionId: 'controlModeling',
      judgment: 'needs-attention',
      teacherExplanation: '班级控制建模证据不足。',
      rootCause: '模型指标表达薄弱。',
      evidenceRefs: [{
        chunkId: 'chunk-diagnosis-1',
        sourceType: 'diagnosis',
        displayTitle: '控制建模诊断',
        displayHref: null,
        confidence: 'high',
        capsule: '班级层面控制建模需要补强。',
        citationChip: {
          chunkId: 'chunk-diagnosis-1',
          displayTitle: '控制建模诊断',
          displayHref: null,
          sourceType: 'diagnosis',
          authorityLevel: 'teacher-authored',
          confidence: 'high',
          freshnessBucket: 'current',
          privacyVisibility: 'redacted',
          limitationState: null,
        },
      }],
      sourceCoverage: { diagnosis: 'ready' },
      metrics: {
        score: 0.58,
        percentile: { state: 'available', percentile: 42, sampleSize: 30, fallback: 'none' },
        growthPercentile: { state: 'unavailable', percentile: null, sampleSize: 0, fallback: 'cold-start' },
      },
      confidence: { state: 'high', score: 0.86, evidenceCount: 3, sourceCompleteness: 0.8 },
      evidenceWindow: { generatedAt: now.toISOString(), sourceLastUpdatedAt: now.toISOString(), stale: false },
      limitations: [],
      nextActions: [{ kind: 'teacher-intervention', label: '安排补强', href: null }],
      privacyClass: 'teacher-visible',
      materializationVersion: 'role-based-learning-diagnosis.v1',
    }],
    limitations: [],
    rootCauseClusters: [{
      id: 'cluster-modeling',
      dimensionId: 'controlModeling',
      label: '控制建模与指标表达',
      affectedPopulation: 12,
      denominator: 30,
      confidence: 'high',
      evidenceCoverage: { ready: 24, stale: 2, missing: 4, lowConfidence: 0 },
      interventionPriority: 'high',
      drilldownRefs: [],
    }],
    drilldownRefs: [],
    auditRefs: [],
    redactionPolicy: {
      rawPayloads: 'omitted',
      ordinaryViews: 'redacted-summaries-only',
    },
  };
}

function teacherReport(): ControlCorrectionTeacherReport {
  const metric = (id: string, label: string, value: number) => ({
    id,
    label,
    value,
    denominator: 30,
    includedPopulation: Math.round(value * 30),
    excludedPopulation: 0,
    exclusionReasons: [],
    calculationWindow: { start: now.toISOString(), end: now.toISOString() },
    confidence: 'medium' as const,
    sourceCoverage: { readyStudents: 25, staleStudents: 2, missingStudents: 3, lowConfidenceStudents: 0 },
    methodology: `${label} uses governed aggregate evidence.`,
  });
  return {
    version: 'control-correction-teacher-report.v1',
    goalId: 'control-correction',
    classInfo: { id: 'class-1', name: '控制 1 班', studentCount: 30 },
    generatedAt: now.toISOString(),
    metrics: {
      simulationPassRate: metric('simulationPassRate', '仿真通过率', 0.45),
      arenaValidSubmissionRate: metric('arenaValidSubmissionRate', 'Arena 有效提交率', 0.52),
    } as ControlCorrectionTeacherReport['metrics'],
    studentDrilldowns: [],
    resourceContribution: [],
    konlingEntryPoint: {
      mode: 'class-summarizer',
      promptContext: 'class-report:class-1:control-correction',
      serverContext: {
        classId: 'class-1',
        classReportId: 'class-1:control-correction',
      },
    },
    methodologyNotes: ['aggregate only'],
    redactionPolicyNotes: ['no raw traces'],
  };
}

function courseEnhancementPersistenceClient(): {
  client: CourseEnhancementPackPersistenceClient;
  records: Map<string, CourseEnhancementPackPersistenceRecord>;
} {
  const records = new Map<string, CourseEnhancementPackPersistenceRecord>();
  const toRecord = (
    data: Parameters<CourseEnhancementPackPersistenceClient['courseEnhancementPack']['upsert']>[0]['create'],
    previous?: CourseEnhancementPackPersistenceRecord,
  ): CourseEnhancementPackPersistenceRecord => ({
    id: data.id,
    teacherId: data.teacherId,
    classId: data.classId,
    goalId: data.goalId,
    lessonId: data.lessonId,
    sourcePrepPackId: data.sourcePrepPackId,
    diagnosisSnapshotId: data.diagnosisSnapshotId,
    status: data.status,
    source: data.source as CourseEnhancementPackPersistenceRecord['source'],
    items: data.items as CourseEnhancementPackPersistenceRecord['items'],
    auditLog: data.auditLog as CourseEnhancementPackPersistenceRecord['auditLog'],
    teacherFeedback: data.teacherFeedback as CourseEnhancementPackPersistenceRecord['teacherFeedback'],
    activatedAt: data.activatedAt,
    rolledBackAt: data.rolledBackAt,
    archivedAt: data.archivedAt,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  });
  return {
    records,
    client: {
      courseEnhancementPack: {
        async upsert(args) {
          const previous = Array.from(records.values()).find((record) => record.sourcePrepPackId === args.where.sourcePrepPackId);
          const record = previous
            ? toRecord({ ...previous, ...args.update, id: previous.id, teacherId: previous.teacherId, classId: previous.classId, goalId: previous.goalId, lessonId: previous.lessonId, sourcePrepPackId: previous.sourcePrepPackId }, previous)
            : toRecord(args.create);
          records.set(record.id, record);
          return record;
        },
        async findUnique(args) {
          return records.get(args.where.id) ?? null;
        },
        async update(args) {
          const previous = records.get(args.where.id);
          if (!previous) throw new Error(`missing record ${args.where.id}`);
          const record = toRecord({
            ...previous,
            ...args.data,
            id: previous.id,
            teacherId: previous.teacherId,
            classId: previous.classId,
            goalId: previous.goalId,
            lessonId: previous.lessonId,
            sourcePrepPackId: previous.sourcePrepPackId,
            diagnosisSnapshotId: previous.diagnosisSnapshotId,
          }, previous);
          records.set(record.id, record);
          return record;
        },
      },
    },
  };
}

describe('teacher prep pack generation', () => {
  let originalContextSecret: string | undefined;

  beforeEach(() => {
    originalContextSecret = process.env.KONLING_MODE_CONTEXT_SECRET;
    process.env.KONLING_MODE_CONTEXT_SECRET = TEST_CONTEXT_SECRET;
  });

  afterEach(() => {
    if (originalContextSecret === undefined) {
      delete process.env.KONLING_MODE_CONTEXT_SECRET;
      return;
    }
    process.env.KONLING_MODE_CONTEXT_SECRET = originalContextSecret;
  });

  it('generates resource-linked candidates from weak diagnosis clusters and report metrics', () => {
    const pack = generateTeacherPrepPack({
      teacherId: 'teacher-1',
      classId: 'class-1',
      goalId: 'control-correction',
      nextLesson: { lessonId: 'lesson-2', title: '根轨迹校正', plannedAt: now.toISOString() },
      diagnosis: diagnosis(),
      teacherReport: teacherReport(),
      resourceNodes: [
        resourceNode({ id: 'quiz-modeling', title: '控制建模互动题', type: 'quiz' }),
        resourceNode({ id: 'sim-terminal', title: 'simulation terminal validation', type: 'simulation' }),
        resourceNode({ id: 'arena-review', title: 'arena task review', type: 'arena_task' }),
      ],
      now,
    });

    expect(pack.status).toBe('draft');
    expect(pack.methodology.teacherReviewRequired).toBe(true);
    expect(pack.konlingEntryPoint).toEqual(expect.objectContaining({
      mode: 'prep-coauthor',
      serverContext: expect.objectContaining({
        prepPackId: 'prep-pack:teacher-1:class-1:control-correction:lesson-2:2026-06-05',
        classId: 'class-1',
        goalId: 'control-correction',
      }),
    }));
    expect(pack.candidates.map((item) => item.itemType)).toEqual(expect.arrayContaining([
      'interactive-question',
      'teacher-note',
      'micro-simulation',
      'arena-task',
    ]));
    expect(pack.candidates[0]).toEqual(expect.objectContaining({
      review: expect.objectContaining({ state: 'draft' }),
      affectedGroup: expect.objectContaining({ count: 12, denominator: 30 }),
      insertionTarget: expect.objectContaining({ lessonId: 'lesson-2' }),
      confidence: expect.objectContaining({ state: 'high' }),
    }));
    expect(pack.candidates.every((item) => item.evidenceBasis.length > 0)).toBe(true);
    expect(pack.candidates.every((item) => item.evidenceBasis.every((basis) => basis.citationChip))).toBe(true);
    expect(pack.candidates[0].evidenceBasis.find((basis) => basis.sourceType === 'role-diagnosis')?.citationChip).toEqual(expect.objectContaining({
      sourceType: 'diagnosis',
      authorityLevel: 'verified',
    }));
    expect(pack.candidates[0].evidenceBasis[0].citationChip).toEqual(expect.objectContaining({
      authorityLevel: expect.any(String),
      freshnessBucket: 'current',
      limitationState: null,
    }));
    expect(validateTeacherPrepPack(pack)).toEqual([]);
  });

  it('backfills citation chips for legacy diagnosis evidence refs', () => {
    const legacyDiagnosis = diagnosis();
    delete (legacyDiagnosis.claims[0].evidenceRefs[0] as { citationChip?: unknown }).citationChip;

    const pack = generateTeacherPrepPack({
      teacherId: 'teacher-1',
      classId: 'class-1',
      goalId: 'control-correction',
      nextLesson: { lessonId: 'lesson-2', title: '根轨迹校正', plannedAt: now.toISOString() },
      diagnosis: legacyDiagnosis,
      resourceNodes: [resourceNode({ id: 'quiz-modeling', title: '控制建模互动题', type: 'quiz' })],
      now,
    });

    const legacyEvidence = pack.candidates[0].evidenceBasis.find((basis) => basis.sourceId === 'chunk-diagnosis-1');
    expect(legacyEvidence?.citationChip).toEqual(expect.objectContaining({
      chunkId: 'chunk-diagnosis-1',
      displayTitle: '控制建模诊断',
      sourceType: 'diagnosis',
      authorityLevel: 'verified',
      privacyVisibility: 'redacted',
    }));
    expect(validateTeacherPrepPack(pack)).toEqual([]);
  });

  it('requires teacher approval before export or insertion eligibility', () => {
    const pack = generateTeacherPrepPack({
      teacherId: 'teacher-1',
      classId: 'class-1',
      goalId: 'control-correction',
      nextLesson: { lessonId: 'lesson-2', title: '根轨迹校正', plannedAt: now.toISOString() },
      diagnosis: diagnosis(),
      resourceNodes: [resourceNode({ id: 'quiz-modeling', title: '控制建模互动题', type: 'quiz' })],
      now,
    });
    const draftExport = buildTeacherPrepPackExportPayload({ pack, now });
    const draftInsertion = buildTeacherPrepPackInsertionPayload({ pack, now });
    const approvedItem = reviewTeacherPrepPackItem({
      item: pack.candidates[0],
      reviewerId: 'teacher-1',
      teacherId: pack.teacherId,
      decision: 'approve',
      notes: '加入课堂参与环节。',
      now,
    });
    const rejectedItem = reviewTeacherPrepPackItem({
      item: pack.candidates[0],
      reviewerId: 'teacher-1',
      teacherId: pack.teacherId,
      decision: 'reject',
      notes: '本节不使用。',
      now,
    });
    const reviewedPack = { ...pack, candidates: [approvedItem, rejectedItem] };
    const exportPayload = buildTeacherPrepPackExportPayload({ pack: reviewedPack, now });
    const insertionPayload = buildTeacherPrepPackInsertionPayload({ pack: reviewedPack, now });

    expect(draftExport.items).toHaveLength(0);
    expect(draftInsertion.items).toHaveLength(0);
    expect(approvedItem.review.state).toBe('approved');
    expect(rejectedItem.review.state).toBe('rejected');
    expect(isTeacherPrepPackInsertionEligible(approvedItem, reviewedPack)).toBe(true);
    expect(isTeacherPrepPackInsertionEligible(rejectedItem, reviewedPack)).toBe(false);
    expect(exportPayload.items).toHaveLength(1);
    expect(exportPayload.items[0].id).toBe(approvedItem.id);
    expect(insertionPayload.items).toHaveLength(1);
    expect(insertionPayload.items[0].linkedResource.nodeId).toBe('quiz-modeling');
  });

  it('requires a valid authorized reviewer before approval can unlock export or insertion', () => {
    const pack = generateTeacherPrepPack({
      teacherId: 'teacher-1',
      classId: 'class-1',
      goalId: 'control-correction',
      nextLesson: { lessonId: 'lesson-2', title: '根轨迹校正', plannedAt: now.toISOString() },
      diagnosis: diagnosis(),
      resourceNodes: [resourceNode({ id: 'quiz-modeling', title: '控制建模互动题', type: 'quiz' })],
      now,
    });
    const emptyReviewer = reviewTeacherPrepPackItem({
      item: pack.candidates[0],
      reviewerId: '   ',
      teacherId: pack.teacherId,
      decision: 'approve',
      now,
    });
    const unauthorizedReviewer = reviewTeacherPrepPackItem({
      item: pack.candidates[0],
      reviewerId: 'teacher-2',
      teacherId: pack.teacherId,
      authorizedReviewerIds: ['teacher-1'],
      decision: 'approve',
      now,
    });
    const forgedApproved = {
      ...pack.candidates[0],
      review: { state: 'approved' as const, reviewerId: 'teacher-2', reviewedAt: now.toISOString(), notes: null },
    };

    expect(emptyReviewer.review.state).toBe('edited');
    expect(unauthorizedReviewer.review.state).toBe('edited');
    expect(validateTeacherPrepPackItem(forgedApproved)).toEqual([]);
    expect(buildTeacherPrepPackExportPayload({
      pack: { ...pack, candidates: [emptyReviewer, unauthorizedReviewer, forgedApproved] },
      now,
    }).items).toHaveLength(0);
    expect(buildTeacherPrepPackInsertionPayload({
      pack: { ...pack, candidates: [emptyReviewer, unauthorizedReviewer, forgedApproved] },
      now,
    }).items).toHaveLength(0);
  });

  it('redacts private evidence and marks unsupported candidates as draft resource requests', () => {
    const pack = generateTeacherPrepPack({
      teacherId: 'teacher-1',
      classId: 'class-1',
      goalId: 'control-correction',
      nextLesson: { lessonId: 'lesson-2', title: '根轨迹校正', plannedAt: now.toISOString() },
      pathOutcomes: [{ id: 'path-1', deviationCount: 2 }],
      gradingSummaries: [{
        id: 'grading-1',
        title: '报告批改',
        averageScore: 1,
        maxScore: 4,
        confidence: 'medium',
        redactedSummary: 'raw answer body and private Konling memory secret=abc should not leak',
      }],
      resourceNodes: [],
      now,
    });

    expect(pack.candidates.length).toBeGreaterThan(0);
    expect(pack.candidates.every((item) => item.insertionTarget.type === 'draft-resource-request')).toBe(true);
    expect(pack.candidates.every((item) => item.draftResourceRequest?.requiredReview)).toBe(true);
    expect(JSON.stringify(pack)).not.toMatch(/raw answer body|private Konling memory|secret=abc/i);
    expect(validateTeacherPrepPack(pack)).toEqual([]);
  });

  it('generates teacher-note candidates but keeps unsupported notes out of automatic insertion', () => {
    const pack = generateTeacherPrepPack({
      teacherId: 'teacher-1',
      classId: 'class-1',
      goalId: 'control-correction',
      nextLesson: { lessonId: 'lesson-2', title: '根轨迹校正', plannedAt: now.toISOString() },
      diagnosis: diagnosis(),
      resourceNodes: [],
      now,
    });
    const teacherNote = pack.candidates.find((item) => item.itemType === 'teacher-note');
    expect(teacherNote).toBeDefined();
    expect(teacherNote?.insertionTarget.type).toBe('draft-resource-request');

    const approvedNote = reviewTeacherPrepPackItem({
      item: teacherNote!,
      reviewerId: 'teacher-1',
      teacherId: pack.teacherId,
      decision: 'approve',
      now,
    });
    expect(approvedNote.review.state).toBe('approved');
    expect(buildTeacherPrepPackExportPayload({
      pack: { ...pack, candidates: [approvedNote] },
      now,
    }).items).toHaveLength(1);
    expect(buildTeacherPrepPackInsertionPayload({
      pack: { ...pack, candidates: [approvedNote] },
      now,
    }).items).toHaveLength(0);
  });

  it('redacts hyphenated forbidden privacy tokens before approved export', () => {
    const pack = generateTeacherPrepPack({
      teacherId: 'teacher-1',
      classId: 'class-1',
      goalId: 'control-correction',
      nextLesson: { lessonId: 'lesson-2', title: '根轨迹校正', plannedAt: now.toISOString() },
      gradingSummaries: [{
        id: 'grading-1',
        title: '报告批改',
        averageScore: 1,
        maxScore: 4,
        confidence: 'medium',
        redactedSummary: 'raw-answer-body private-Konling-memory hidden-arena-internals raw-high-frequency-trace secret=abc',
      }],
      resourceNodes: [],
      now,
    });
    const approved = reviewTeacherPrepPackItem({
      item: pack.candidates[0],
      reviewerId: 'teacher-1',
      teacherId: pack.teacherId,
      decision: 'approve',
      now,
    });
    const exportPayload = buildTeacherPrepPackExportPayload({
      pack: { ...pack, candidates: [approved] },
      now,
    });

    expect(validateTeacherPrepPack({ ...pack, candidates: [approved] })).toEqual([]);
    expect(JSON.stringify(exportPayload.items)).not.toMatch(/raw-answer-body|private-konling-memory|hidden-arena-internals|raw-high-frequency-trace|secret=abc/i);
    expect(exportPayload.items[0].evidenceBasis[0].capsule).toContain('[redacted]');
  });

  it('does not turn unrelated available resources into insertable source support', () => {
    const pack = generateTeacherPrepPack({
      teacherId: 'teacher-1',
      classId: 'class-1',
      goalId: 'control-correction',
      nextLesson: { lessonId: 'lesson-2', title: '根轨迹校正', plannedAt: now.toISOString() },
      diagnosis: diagnosis(),
      resourceNodes: [
        resourceNode({
          id: 'unrelated-quiz',
          title: 'Unrelated Quiz',
          type: 'quiz',
          courseModule: 'other-module',
          planningMetadata: {
            ...resourceNode({ id: 'template', title: 'template', type: 'quiz' }).planningMetadata,
            knowledgeCoverage: ['unrelated'],
            abilityImpact: { unrelated: 0.3 },
          },
        }),
      ],
      now,
    });

    expect(pack.candidates[0].linkedResource).toBeUndefined();
    expect(pack.candidates[0].insertionTarget.type).toBe('draft-resource-request');
    expect(validateTeacherPrepPack(pack)).toEqual([]);
  });

  it('rejects ineligible or cross-module resources for automatic insertion support', () => {
    const ineligible = resourceNode({
      id: 'blocked-quiz',
      title: '控制建模互动题',
      type: 'quiz',
      eligibility: {
        pathEligible: false,
        reasons: ['not governed'],
        auditIssues: [{ code: 'unavailable-resource', message: 'blocked', severity: 'blocking' }],
      },
    });
    const pack = generateTeacherPrepPack({
      teacherId: 'teacher-1',
      classId: 'class-1',
      goalId: 'control-correction',
      nextLesson: { lessonId: 'lesson-2', title: '根轨迹校正', plannedAt: now.toISOString() },
      diagnosis: diagnosis(),
      resourceNodes: [ineligible],
      now,
    });

    expect(pack.candidates[0].linkedResource).toBeUndefined();
    expect(pack.candidates[0].insertionTarget.type).toBe('draft-resource-request');
  });

  it('sanitizes review patches and blocks invalid approved exports', () => {
    const pack = generateTeacherPrepPack({
      teacherId: 'teacher-1',
      classId: 'class-1',
      goalId: 'control-correction',
      nextLesson: { lessonId: 'lesson-2', title: '根轨迹校正', plannedAt: now.toISOString() },
      diagnosis: diagnosis(),
      resourceNodes: [resourceNode({ id: 'quiz-modeling', title: '控制建模互动题', type: 'quiz' })],
      now,
    });
    const patched = reviewTeacherPrepPackItem({
      item: pack.candidates[0],
      reviewerId: 'teacher-1',
      teacherId: pack.teacherId,
      decision: 'approve',
      patch: {
        title: 'secret=abc raw answer body',
        estimatedTimeMinutes: -1,
      },
      now,
    });
    const exportPayload = buildTeacherPrepPackExportPayload({
      pack: { ...pack, candidates: [patched] },
      now,
    });

    expect(patched.title).not.toContain('secret=abc');
    expect(patched.review.state).toBe('edited');
    expect(validateTeacherPrepPackItem(patched)).toContain('item-missing-estimated-time');
    expect(exportPayload.items).toHaveLength(0);
  });

  it('does not generate weak metric candidates from null values and validates numeric bounds', () => {
    const report = teacherReport();
    report.metrics.simulationPassRate = {
      ...report.metrics.simulationPassRate,
      value: null,
      includedPopulation: 0,
    };
    const pack = generateTeacherPrepPack({
      teacherId: 'teacher-1',
      classId: 'class-1',
      goalId: 'control-correction',
      nextLesson: { lessonId: 'lesson-2', title: '根轨迹校正', plannedAt: now.toISOString() },
      teacherReport: report,
      resourceNodes: [resourceNode({ id: 'sim-terminal', title: 'simulation terminal validation', type: 'simulation' })],
      now,
    });
    const invalid = {
      ...pack.candidates[0],
      affectedGroup: { ...pack.candidates[0].affectedGroup, count: 99 },
      confidence: { ...pack.candidates[0].confidence, score: 2 },
      methodologyNotes: [],
    };

    expect(pack.candidates.map((item) => item.itemType)).not.toContain('micro-simulation');
    expect(validateTeacherPrepPackItem(invalid)).toEqual(expect.arrayContaining([
      'item-invalid-affected-group',
      'item-invalid-confidence-score',
      'item-missing-methodology',
    ]));
  });

  it('creates previewable runtime enhancement packs only from approved insertable prep items', () => {
    const pack = generateTeacherPrepPack({
      teacherId: 'teacher-1',
      classId: 'class-1',
      goalId: 'control-correction',
      nextLesson: { lessonId: 'lesson-2', title: '根轨迹校正', plannedAt: now.toISOString() },
      diagnosis: diagnosis(),
      resourceNodes: [resourceNode({ id: 'quiz-modeling', title: '控制建模互动题', type: 'quiz' })],
      now,
    });
    const approved = reviewTeacherPrepPackItem({
      item: pack.candidates[0],
      reviewerId: 'teacher-1',
      teacherId: pack.teacherId,
      decision: 'approve',
      patch: { insertionTarget: { type: 'lesson-stage', lessonId: 'lesson-2', lessonStage: 'participatory-learning' } },
      now,
    });
    const rejected = reviewTeacherPrepPackItem({
      item: pack.candidates[0],
      reviewerId: 'teacher-1',
      teacherId: pack.teacherId,
      decision: 'reject',
      now,
    });
    const enhancementPack = createCourseEnhancementPackFromPrepPack({
      prepPack: { ...pack, candidates: [pack.candidates[0], approved, rejected] },
      teacherId: 'teacher-1',
      diagnosisSnapshotId: 'diagnosis-snapshot-1',
      sourceEvidenceRefs: ['diagnosis:claim-control-modeling'],
      now,
    });
    const preview = buildCourseEnhancementPackPreview({
      pack: enhancementPack,
      runtimeContext: {
        lessonId: 'lesson-2',
        classId: 'class-1',
        stages: [{ id: 'stage-participatory', stage: 'participatory-learning', stepIds: ['step-quiz'] }],
        lessonStepIds: ['step-quiz'],
        resourceNodeIds: ['quiz-modeling'],
        classSessionIds: ['session-1'],
      },
    });

    expect(enhancementPack.status).toBe('review-ready');
    expect(enhancementPack.source).toEqual(expect.objectContaining({
      prepPackId: pack.id,
      diagnosisSnapshotId: 'diagnosis-snapshot-1',
    }));
    expect(enhancementPack.items).toHaveLength(1);
    expect(enhancementPack.items[0]).toEqual(expect.objectContaining({
      prepPackItemId: approved.id,
      linkedResource: expect.objectContaining({ nodeId: 'quiz-modeling' }),
      lifecycle: expect.objectContaining({ state: 'approved' }),
    }));
    expect(validateCourseEnhancementPack(enhancementPack)).toEqual([]);
    expect(preview.publishState).toBe('preview-only');
    expect(preview.diff.addedOverlayItems).toHaveLength(1);
    expect(preview.diff.addedOverlayItems[0]).toEqual(expect.objectContaining({
      evidenceBasis: expect.any(Array),
      privacyScope: 'aggregate-and-redacted-only',
    }));
  });

  it('activates and merges authorized class overlays without mutating the base runtime manifest', () => {
    const pack = generateTeacherPrepPack({
      teacherId: 'teacher-1',
      classId: 'class-1',
      goalId: 'control-correction',
      nextLesson: { lessonId: 'lesson-2', title: '根轨迹校正', plannedAt: now.toISOString() },
      diagnosis: diagnosis(),
      resourceNodes: [resourceNode({ id: 'quiz-modeling', title: '控制建模互动题', type: 'quiz' })],
      now,
    });
    const approved = reviewTeacherPrepPackItem({
      item: pack.candidates[0],
      reviewerId: 'teacher-1',
      teacherId: pack.teacherId,
      decision: 'approve',
      patch: { insertionTarget: { type: 'lesson-stage', lessonId: 'lesson-2', lessonStage: 'participatory-learning' } },
      now,
    });
    const enhancementPack = createCourseEnhancementPackFromPrepPack({
      prepPack: { ...pack, candidates: [approved] },
      teacherId: 'teacher-1',
      now,
    });
    const runtimeContext = {
      lessonId: 'lesson-2',
      classId: 'class-1',
      stages: [{ id: 'stage-participatory', stage: 'participatory-learning' as const, stepIds: ['step-quiz'] }],
      lessonStepIds: ['step-quiz'],
      resourceNodeIds: ['quiz-modeling'],
      classSessionIds: ['session-1'],
    };
    const active = activateCourseEnhancementPack({
      pack: enhancementPack,
      teacherId: 'teacher-1',
      runtimeContext,
      now,
    });
    const baseRuntime = {
      lessonId: 'lesson-2',
      classId: 'class-1',
      stages: [{ id: 'stage-participatory', stage: 'PARTICIPATORY', overlayItems: [] as unknown[] }],
      resources: [{ nodeId: 'quiz-modeling', title: '控制建模互动题' }],
    };
    const beforeMerge = JSON.stringify(baseRuntime);
    const merged = mergeCourseEnhancementPackOverlay({
      baseRuntime,
      classId: 'class-1',
      packs: [active, { ...active, classId: 'other-class', id: 'other-pack' }],
    });

    expect(active.status).toBe('active');
    expect(active.items[0].activation).toEqual(expect.objectContaining({
      activatedBy: 'teacher-1',
      rolledBackAt: null,
    }));
    expect(JSON.stringify(baseRuntime)).toBe(beforeMerge);
    expect(merged).not.toBe(baseRuntime);
    expect(merged.enhancementOverlays).toHaveLength(1);
    expect(merged.enhancementOverlays[0]).not.toHaveProperty('evidenceBasis');
    expect(merged.enhancementOverlays[0]).not.toHaveProperty('sourceEvidenceRefs');
    expect(merged.enhancementOverlays[0]).not.toHaveProperty('prepPackId');
    expect(merged.enhancementOverlays[0]).not.toHaveProperty('prepPackItemId');
    expect(merged.stages[0].overlayItems).toEqual([
      expect.objectContaining({
        packId: active.id,
        itemId: active.items[0].id,
      }),
    ]);
  });

  it('accepts lesson-step resources whose source refs include the lesson prefix', () => {
    const pack = generateTeacherPrepPack({
      teacherId: 'teacher-1',
      classId: 'class-1',
      goalId: 'control-correction',
      nextLesson: { lessonId: 'lesson-2', title: '根轨迹校正', plannedAt: now.toISOString() },
      diagnosis: diagnosis(),
      resourceNodes: [resourceNode({
        id: 'lesson-step-node',
        title: 'controlModeling lesson step',
        type: 'lesson_step',
        sourceKind: 'runtime_lesson_step',
        sourceRef: 'lesson-2:step-quiz',
      })],
      now,
    });
    const candidate = pack.candidates.find((item) => item.insertionTarget.type === 'lesson-step');
    expect(candidate?.insertionTarget).toEqual(expect.objectContaining({
      type: 'lesson-step',
      lessonStepId: 'step-quiz',
    }));
    const approved = reviewTeacherPrepPackItem({
      item: candidate!,
      reviewerId: 'teacher-1',
      teacherId: pack.teacherId,
      decision: 'approve',
      now,
    });
    const enhancementPack = createCourseEnhancementPackFromPrepPack({
      prepPack: { ...pack, candidates: [approved] },
      teacherId: 'teacher-1',
      now,
    });
    const active = activateCourseEnhancementPack({
      pack: enhancementPack,
      teacherId: 'teacher-1',
      runtimeContext: {
        lessonId: 'lesson-2',
        classId: 'class-1',
        stages: [{ id: 'stage-participatory', stage: 'participatory-learning', stepIds: ['step-quiz'] }],
        lessonStepIds: ['step-quiz'],
        resourceNodeIds: ['lesson-step-node'],
        classSessionIds: ['session-1'],
      },
      now,
    });
    const merged = mergeCourseEnhancementPackOverlay({
      baseRuntime: {
        lessonId: 'lesson-2',
        classId: 'class-1',
        stages: [{ id: 'stage-participatory', stage: 'participatory-learning', stepIds: ['step-quiz'], overlayItems: [] as unknown[] }],
      },
      classId: 'class-1',
      packs: [active],
    });

    expect(merged.stages[0].overlayItems).toEqual([
      expect.objectContaining({ itemId: active.items[0].id }),
    ]);
  });

  it('excludes teacher-export approvals from runtime enhancement packs', () => {
    const pack = generateTeacherPrepPack({
      teacherId: 'teacher-1',
      classId: 'class-1',
      goalId: 'control-correction',
      nextLesson: { lessonId: 'lesson-2', title: '根轨迹校正', plannedAt: now.toISOString() },
      diagnosis: diagnosis(),
      teacherReport: teacherReport(),
      resourceNodes: [
        resourceNode({ id: 'quiz-modeling', title: '控制建模互动题', type: 'quiz' }),
        resourceNode({ id: 'sim-terminal', title: 'simulation terminal validation', type: 'simulation' }),
      ],
      now,
    });
    const insertableCandidates = pack.candidates.filter((item) => item.linkedResource && item.insertionTarget.type !== 'draft-resource-request');
    const runtimeApproved = reviewTeacherPrepPackItem({
      item: insertableCandidates[0],
      reviewerId: 'teacher-1',
      teacherId: pack.teacherId,
      decision: 'approve',
      now,
    });
    const exportApproved = reviewTeacherPrepPackItem({
      item: insertableCandidates[1],
      reviewerId: 'teacher-1',
      teacherId: pack.teacherId,
      decision: 'approve',
      patch: { insertionTarget: { type: 'teacher-export', lessonId: 'lesson-2' } },
      now,
    });

    const enhancementPack = createCourseEnhancementPackFromPrepPack({
      prepPack: { ...pack, candidates: [runtimeApproved, exportApproved] },
      teacherId: 'teacher-1',
      now,
    });

    expect(enhancementPack.items.map((item) => item.prepPackItemId)).toEqual([runtimeApproved.id]);
    expect(enhancementPack.items.some((item) => item.prepPackItemId === exportApproved.id)).toBe(false);
  });

  it('blocks invalid insertion targets and removes overlays after rollback while preserving impact evidence', () => {
    const pack = generateTeacherPrepPack({
      teacherId: 'teacher-1',
      classId: 'class-1',
      goalId: 'control-correction',
      nextLesson: { lessonId: 'lesson-2', title: '根轨迹校正', plannedAt: now.toISOString() },
      diagnosis: diagnosis(),
      resourceNodes: [resourceNode({ id: 'quiz-modeling', title: '控制建模互动题', type: 'quiz' })],
      now,
    });
    const approved = reviewTeacherPrepPackItem({
      item: pack.candidates[0],
      reviewerId: 'teacher-1',
      teacherId: pack.teacherId,
      decision: 'approve',
      patch: { insertionTarget: { type: 'lesson-step', lessonId: 'lesson-2', lessonStepId: 'missing-step' } },
      now,
    });
    const enhancementPack = createCourseEnhancementPackFromPrepPack({
      prepPack: { ...pack, candidates: [approved] },
      teacherId: 'teacher-1',
      now,
    });

    expect(() => activateCourseEnhancementPack({
      pack: enhancementPack,
      teacherId: 'teacher-1',
      runtimeContext: {
        lessonId: 'lesson-2',
        classId: 'class-1',
        stages: [{ id: 'stage-participatory', stage: 'participatory-learning', stepIds: ['step-quiz'] }],
        lessonStepIds: ['step-quiz'],
        resourceNodeIds: ['quiz-modeling'],
        classSessionIds: ['session-1'],
      },
      now,
    })).toThrow(/invalid insertion target/i);

    const validPack = createCourseEnhancementPackFromPrepPack({
      prepPack: { ...pack, candidates: [reviewTeacherPrepPackItem({
        item: pack.candidates[0],
        reviewerId: 'teacher-1',
        teacherId: pack.teacherId,
        decision: 'approve',
        now,
      })] },
      teacherId: 'teacher-1',
      now,
    });
    const active = activateCourseEnhancementPack({
      pack: validPack,
      teacherId: 'teacher-1',
      runtimeContext: {
        lessonId: 'lesson-2',
        classId: 'class-1',
        stages: [{ id: 'stage-participatory', stage: 'participatory-learning', stepIds: ['step-quiz'] }],
        lessonStepIds: ['step-quiz'],
        resourceNodeIds: ['quiz-modeling'],
        classSessionIds: ['session-1'],
      },
      now,
    });
    const withEvidence = recordCourseEnhancementPackImpactEvidence({
      pack: active,
      itemId: active.items[0].id,
      evidenceRef: {
        sourceType: 'learning-fact',
        sourceId: 'learning-fact-1',
        displayTitle: '课后互动完成度',
        collectedAt: now.toISOString(),
        safeForTeacherReport: true,
      },
      teacherFeedback: { teacherId: 'teacher-1', note: '课堂补强有效', recordedAt: now.toISOString() },
    });
    expect(() => recordCourseEnhancementPackImpactEvidence({
      pack: active,
      itemId: 'missing-overlay-item',
      evidenceRef: {
        sourceType: 'learning-fact',
        sourceId: 'learning-fact-missing',
        displayTitle: '无效补强证据',
        collectedAt: now.toISOString(),
        safeForTeacherReport: true,
      },
      teacherFeedback: { teacherId: 'teacher-1', note: '无效条目', recordedAt: now.toISOString() },
    })).toThrow(/unknown enhancement pack item/i);
    const rolledBack = rollbackCourseEnhancementPack({
      pack: withEvidence,
      teacherId: 'teacher-1',
      reason: '下轮课不再使用',
      now,
    });
    const merged = mergeCourseEnhancementPackOverlay({
      baseRuntime: {
        lessonId: 'lesson-2',
        classId: 'class-1',
        stages: [{ id: 'stage-participatory', stage: 'participatory-learning', overlayItems: [] as unknown[] }],
      },
      classId: 'class-1',
      packs: [rolledBack],
    });

    expect(rolledBack.status).toBe('rolled-back');
    expect(rolledBack.items[0].impactEvidence).toEqual([
      expect.objectContaining({ sourceId: 'learning-fact-1' }),
    ]);
    expect(rolledBack.teacherFeedback).toEqual([
      expect.objectContaining({ note: '课堂补强有效' }),
    ]);
    expect(merged.enhancementOverlays).toHaveLength(0);
    expect(merged.stages[0].overlayItems).toEqual([]);
  });

  it('archives enhancement packs without publishing archived overlays to runtime', () => {
    const pack = generateTeacherPrepPack({
      teacherId: 'teacher-1',
      classId: 'class-1',
      goalId: 'control-correction',
      nextLesson: { lessonId: 'lesson-2', title: '根轨迹校正', plannedAt: now.toISOString() },
      diagnosis: diagnosis(),
      resourceNodes: [resourceNode({ id: 'quiz-modeling', title: '控制建模互动题', type: 'quiz' })],
      now,
    });
    const approved = reviewTeacherPrepPackItem({
      item: pack.candidates[0],
      reviewerId: 'teacher-1',
      teacherId: pack.teacherId,
      decision: 'approve',
      now,
    });
    const enhancementPack = createCourseEnhancementPackFromPrepPack({
      prepPack: { ...pack, candidates: [approved] },
      teacherId: 'teacher-1',
      now,
    });
    const archived = archiveCourseEnhancementPack({
      pack: enhancementPack,
      teacherId: 'teacher-1',
      reason: '学期归档',
      now,
    });
    const merged = mergeCourseEnhancementPackOverlay({
      baseRuntime: {
        lessonId: 'lesson-2',
        classId: 'class-1',
        stages: [{ id: 'stage-participatory', stage: 'participatory-learning', overlayItems: [] as unknown[] }],
      },
      classId: 'class-1',
      packs: [archived],
    });

    expect(archived.status).toBe('archived');
    expect(archived.auditLog.at(-1)).toEqual(expect.objectContaining({
      action: 'archive',
      detail: '学期归档',
    }));
    expect(() => rollbackCourseEnhancementPack({
      pack: archived,
      teacherId: 'teacher-1',
      reason: '归档后撤回',
      now,
    })).toThrow(/archived enhancement pack cannot be rolled back/i);
    expect(merged.enhancementOverlays).toHaveLength(0);
  });

  it('rejects unauthorized enhancement pack actors', () => {
    const pack = generateTeacherPrepPack({
      teacherId: 'teacher-1',
      classId: 'class-1',
      goalId: 'control-correction',
      nextLesson: { lessonId: 'lesson-2', title: '根轨迹校正', plannedAt: now.toISOString() },
      diagnosis: diagnosis(),
      resourceNodes: [resourceNode({ id: 'quiz-modeling', title: '控制建模互动题', type: 'quiz' })],
      now,
    });
    const approved = reviewTeacherPrepPackItem({
      item: pack.candidates[0],
      reviewerId: 'teacher-1',
      teacherId: pack.teacherId,
      decision: 'approve',
      now,
    });

    expect(() => createCourseEnhancementPackFromPrepPack({
      prepPack: { ...pack, candidates: [approved] },
      teacherId: 'teacher-2',
      now,
    })).toThrow(/unauthorized enhancement pack create/i);

    const enhancementPack = createCourseEnhancementPackFromPrepPack({
      prepPack: { ...pack, candidates: [approved] },
      teacherId: 'teacher-1',
      now,
    });
    expect(() => rollbackCourseEnhancementPack({
      pack: enhancementPack,
      teacherId: 'teacher-2',
      reason: 'unauthorized',
      now,
    })).toThrow(/unauthorized enhancement pack rollback/i);
    expect(() => archiveCourseEnhancementPack({
      pack: enhancementPack,
      teacherId: 'teacher-2',
      reason: 'unauthorized',
      now,
    })).toThrow(/unauthorized enhancement pack archive/i);
  });

  it('keeps active overlays scoped to their lesson and class session', () => {
    const pack = generateTeacherPrepPack({
      teacherId: 'teacher-1',
      classId: 'class-1',
      goalId: 'control-correction',
      nextLesson: { lessonId: 'lesson-2', title: '根轨迹校正', plannedAt: now.toISOString() },
      diagnosis: diagnosis(),
      resourceNodes: [resourceNode({ id: 'quiz-modeling', title: '控制建模互动题', type: 'quiz' })],
      now,
    });
    const approved = reviewTeacherPrepPackItem({
      item: pack.candidates[0],
      reviewerId: 'teacher-1',
      teacherId: pack.teacherId,
      decision: 'approve',
      patch: { insertionTarget: { type: 'class-session', lessonId: 'lesson-2', classSessionId: 'session-1' } },
      now,
    });
    const enhancementPack = createCourseEnhancementPackFromPrepPack({
      prepPack: { ...pack, candidates: [approved] },
      teacherId: 'teacher-1',
      now,
    });
    expect(() => activateCourseEnhancementPack({
      pack: enhancementPack,
      teacherId: 'teacher-1',
      runtimeContext: {
        lessonId: 'lesson-2',
        classId: 'other-class',
        stages: [{ id: 'stage-participatory', stage: 'participatory-learning', stepIds: ['step-quiz'] }],
        lessonStepIds: ['step-quiz'],
        resourceNodeIds: ['quiz-modeling'],
        classSessionIds: ['session-1'],
      },
      now,
    })).toThrow(/invalid enhancement pack class context/i);
    expect(() => activateCourseEnhancementPack({
      pack: enhancementPack,
      teacherId: 'teacher-1',
      runtimeContext: {
        lessonId: 'lesson-3',
        classId: 'class-1',
        stages: [{ id: 'stage-participatory', stage: 'participatory-learning', stepIds: ['step-quiz'] }],
        lessonStepIds: ['step-quiz'],
        resourceNodeIds: ['quiz-modeling'],
        classSessionIds: ['session-1'],
      },
      now,
    })).toThrow(/invalid enhancement pack lesson context/i);
    const active = activateCourseEnhancementPack({
      pack: enhancementPack,
      teacherId: 'teacher-1',
      runtimeContext: {
        lessonId: 'lesson-2',
        classId: 'class-1',
        stages: [{ id: 'stage-participatory', stage: 'participatory-learning', stepIds: ['step-quiz'] }],
        lessonStepIds: ['step-quiz'],
        resourceNodeIds: ['quiz-modeling'],
        classSessionIds: ['session-1'],
      },
      now,
    });
    const wrongLesson = mergeCourseEnhancementPackOverlay({
      baseRuntime: { lessonId: 'lesson-3', classId: 'class-1', stages: [] },
      classId: 'class-1',
      sessionId: 'session-1',
      packs: [active],
    });
    const wrongSession = mergeCourseEnhancementPackOverlay({
      baseRuntime: { lessonId: 'lesson-2', classId: 'class-1', stages: [] },
      classId: 'class-1',
      sessionId: 'session-2',
      packs: [active],
    });
    const missingSession = mergeCourseEnhancementPackOverlay({
      baseRuntime: { lessonId: 'lesson-2', classId: 'class-1', stages: [] },
      classId: 'class-1',
      packs: [active],
    });
    const correctScope = mergeCourseEnhancementPackOverlay({
      baseRuntime: {
        lessonId: 'lesson-2',
        classId: 'class-1',
        stages: [{ id: 'stage-participatory', stage: 'participatory-learning', overlayItems: [] as unknown[] }],
      },
      classId: 'class-1',
      sessionId: 'session-1',
      packs: [active],
    });

    expect(wrongLesson.enhancementOverlays).toHaveLength(0);
    expect(wrongSession.enhancementOverlays).toHaveLength(0);
    expect(missingSession.enhancementOverlays).toHaveLength(0);
    expect(correctScope.enhancementOverlays).toHaveLength(1);
  });

  it('rejects class-session overlays when supplied step or resource anchors are absent', () => {
    const pack = generateTeacherPrepPack({
      teacherId: 'teacher-1',
      classId: 'class-1',
      goalId: 'control-correction',
      nextLesson: { lessonId: 'lesson-2', title: '根轨迹校正', plannedAt: now.toISOString() },
      diagnosis: diagnosis(),
      resourceNodes: [resourceNode({ id: 'quiz-modeling', title: '控制建模互动题', type: 'quiz' })],
      now,
    });
    const missingStep = reviewTeacherPrepPackItem({
      item: pack.candidates[0],
      reviewerId: 'teacher-1',
      teacherId: pack.teacherId,
      decision: 'approve',
      patch: { insertionTarget: { type: 'class-session', lessonId: 'lesson-2', lessonStepId: 'missing-step' } },
      now,
    });
    const missingStepPack = createCourseEnhancementPackFromPrepPack({
      prepPack: { ...pack, candidates: [missingStep] },
      teacherId: 'teacher-1',
      now,
    });
    const missingResource = reviewTeacherPrepPackItem({
      item: pack.candidates[0],
      reviewerId: 'teacher-1',
      teacherId: pack.teacherId,
      decision: 'approve',
      patch: { insertionTarget: { type: 'class-session', lessonId: 'lesson-2', resourceNodeId: 'missing-resource' } },
      now,
    });
    const missingResourcePack = createCourseEnhancementPackFromPrepPack({
      prepPack: { ...pack, candidates: [missingResource] },
      teacherId: 'teacher-1',
      now,
    });
    const missingAnchor = reviewTeacherPrepPackItem({
      item: pack.candidates[0],
      reviewerId: 'teacher-1',
      teacherId: pack.teacherId,
      decision: 'approve',
      patch: { insertionTarget: { type: 'class-session', lessonId: 'lesson-2' } },
      now,
    });
    const missingAnchorPack = createCourseEnhancementPackFromPrepPack({
      prepPack: { ...pack, candidates: [missingAnchor] },
      teacherId: 'teacher-1',
      now,
    });
    const runtimeContext: CourseEnhancementRuntimeContext = {
      lessonId: 'lesson-2',
      classId: 'class-1',
      stages: [{ id: 'stage-participatory', stage: 'participatory-learning', stepIds: ['step-quiz'] }],
      lessonStepIds: ['step-quiz'],
      resourceNodeIds: ['quiz-modeling'],
      classSessionIds: ['session-1'],
    };

    expect(() => activateCourseEnhancementPack({
      pack: missingStepPack,
      teacherId: 'teacher-1',
      runtimeContext,
      now,
    })).toThrow(/missing-lesson-step/i);
    expect(() => activateCourseEnhancementPack({
      pack: missingResourcePack,
      teacherId: 'teacher-1',
      runtimeContext,
      now,
    })).toThrow(/missing-resource-node/i);
    expect(() => activateCourseEnhancementPack({
      pack: missingAnchorPack,
      teacherId: 'teacher-1',
      runtimeContext,
      now,
    })).toThrow(/missing-class-session-anchor/i);
  });

  it('persists, reloads, activates, rolls back, and archives enhancement packs through the Prisma delegate contract', async () => {
    const { client, records } = courseEnhancementPersistenceClient();
    const pack = generateTeacherPrepPack({
      teacherId: 'teacher-1',
      classId: 'class-1',
      goalId: 'control-correction',
      nextLesson: { lessonId: 'lesson-2', title: '根轨迹校正', plannedAt: now.toISOString() },
      diagnosis: diagnosis(),
      resourceNodes: [resourceNode({ id: 'quiz-modeling', title: '控制建模互动题', type: 'quiz' })],
      now,
    });
    const approved = reviewTeacherPrepPackItem({
      item: pack.candidates[0],
      reviewerId: 'teacher-1',
      teacherId: pack.teacherId,
      decision: 'approve',
      now,
    });
    const enhancementPack = createCourseEnhancementPackFromPrepPack({
      prepPack: { ...pack, candidates: [approved] },
      teacherId: 'teacher-1',
      now,
    });

    const persisted = await persistCourseEnhancementPack(client, enhancementPack);
    const reloaded = await loadCourseEnhancementPack(client, enhancementPack.id);
    const activated = await activatePersistedCourseEnhancementPack({
      client,
      packId: enhancementPack.id,
      teacherId: 'teacher-1',
      runtimeContext: {
        lessonId: 'lesson-2',
        classId: 'class-1',
        stages: [{ id: 'stage-participatory', stage: 'participatory-learning', stepIds: ['step-quiz'] }],
        lessonStepIds: ['step-quiz'],
        resourceNodeIds: ['quiz-modeling'],
        classSessionIds: ['session-1'],
      },
      now,
    });
    const rolledBack = await rollbackPersistedCourseEnhancementPack({
      client,
      packId: enhancementPack.id,
      teacherId: 'teacher-1',
      reason: '复盘后撤回',
      now,
    });
    const archived = await archivePersistedCourseEnhancementPack({
      client,
      packId: enhancementPack.id,
      teacherId: 'teacher-1',
      reason: '归档',
      now,
    });

    expect(persisted.id).toMatch(/^course-enhancement-pack:[a-z0-9]+$/);
    expect(reloaded).toEqual(expect.objectContaining({
      id: enhancementPack.id,
      source: expect.objectContaining({ prepPackId: pack.id }),
    }));
    expect(records.get(enhancementPack.id)).toEqual(expect.objectContaining({
      sourcePrepPackId: pack.id,
      status: 'archived',
      archivedAt: now,
    }));
    expect(activated.status).toBe('active');
    expect(rolledBack.status).toBe('rolled-back');
    expect(archived.status).toBe('archived');
  });

  it('upserts enhancement persistence by source prep pack even when reviewed items change', async () => {
    const { client, records } = courseEnhancementPersistenceClient();
    const pack = generateTeacherPrepPack({
      teacherId: 'teacher-1',
      classId: 'class-1',
      goalId: 'control-correction',
      nextLesson: { lessonId: 'lesson-2', title: '根轨迹校正', plannedAt: now.toISOString() },
      diagnosis: diagnosis(),
      teacherReport: teacherReport(),
      resourceNodes: [
        resourceNode({ id: 'quiz-modeling', title: '控制建模互动题', type: 'quiz' }),
        resourceNode({ id: 'sim-terminal', title: 'simulation terminal validation', type: 'simulation' }),
      ],
      now,
    });
    const insertableCandidates = pack.candidates.filter((item) => item.linkedResource && item.insertionTarget.type !== 'draft-resource-request');
    const firstApproved = reviewTeacherPrepPackItem({
      item: insertableCandidates[0],
      reviewerId: 'teacher-1',
      teacherId: pack.teacherId,
      decision: 'approve',
      now,
    });
    const firstPack = createCourseEnhancementPackFromPrepPack({
      prepPack: { ...pack, candidates: [firstApproved] },
      teacherId: 'teacher-1',
      diagnosisSnapshotId: 'snapshot-1',
      now,
    });
    const secondApproved = reviewTeacherPrepPackItem({
      item: insertableCandidates[1],
      reviewerId: 'teacher-1',
      teacherId: pack.teacherId,
      decision: 'approve',
      now,
    });
    const secondPack = createCourseEnhancementPackFromPrepPack({
      prepPack: { ...pack, candidates: [firstApproved, secondApproved] },
      teacherId: 'teacher-1',
      diagnosisSnapshotId: 'snapshot-2',
      now,
    });

    await persistCourseEnhancementPack(client, firstPack);
    const updated = await persistCourseEnhancementPack(client, secondPack);

    expect(secondPack.id).toBe(firstPack.id);
    expect(records.size).toBe(1);
    expect(records.get(firstPack.id)).toEqual(expect.objectContaining({
      diagnosisSnapshotId: 'snapshot-2',
      source: expect.objectContaining({ diagnosisSnapshotId: 'snapshot-2' }),
    }));
    expect(updated.items.map((item) => item.prepPackItemId)).toEqual([
      firstApproved.id,
      secondApproved.id,
    ]);
  });

  it('keeps same-day prep pack persistence separate for different teachers and lessons', async () => {
    const { client, records } = courseEnhancementPersistenceClient();
    const baseInput = {
      classId: 'class-1',
      goalId: 'control-correction',
      diagnosis: diagnosis(),
      teacherReport: teacherReport(),
      resourceNodes: [resourceNode({ id: 'quiz-modeling', title: '控制建模互动题', type: 'quiz' })],
      now,
    };
    const firstPack = generateTeacherPrepPack({
      ...baseInput,
      teacherId: 'teacher-1',
      nextLesson: { lessonId: 'lesson-2', title: '根轨迹校正', plannedAt: now.toISOString() },
    });
    const secondTeacherPack = generateTeacherPrepPack({
      ...baseInput,
      teacherId: 'teacher-2',
      nextLesson: { lessonId: 'lesson-2', title: '根轨迹校正', plannedAt: now.toISOString() },
    });
    const secondLessonPack = generateTeacherPrepPack({
      ...baseInput,
      teacherId: 'teacher-1',
      nextLesson: { lessonId: 'lesson-3', title: '频域校正', plannedAt: now.toISOString() },
    });
    const approvedFirst = reviewTeacherPrepPackItem({
      item: firstPack.candidates[0],
      reviewerId: 'teacher-1',
      teacherId: firstPack.teacherId,
      decision: 'approve',
      now,
    });
    const approvedSecondTeacher = reviewTeacherPrepPackItem({
      item: secondTeacherPack.candidates[0],
      reviewerId: 'teacher-2',
      teacherId: secondTeacherPack.teacherId,
      decision: 'approve',
      now,
    });
    const approvedSecondLesson = reviewTeacherPrepPackItem({
      item: secondLessonPack.candidates[0],
      reviewerId: 'teacher-1',
      teacherId: secondLessonPack.teacherId,
      decision: 'approve',
      now,
    });

    const firstEnhancement = createCourseEnhancementPackFromPrepPack({
      prepPack: { ...firstPack, candidates: [approvedFirst] },
      teacherId: 'teacher-1',
      now,
    });
    const secondTeacherEnhancement = createCourseEnhancementPackFromPrepPack({
      prepPack: { ...secondTeacherPack, candidates: [approvedSecondTeacher] },
      teacherId: 'teacher-2',
      now,
    });
    const secondLessonEnhancement = createCourseEnhancementPackFromPrepPack({
      prepPack: { ...secondLessonPack, candidates: [approvedSecondLesson] },
      teacherId: 'teacher-1',
      now,
    });

    expect(new Set([firstPack.id, secondTeacherPack.id, secondLessonPack.id]).size).toBe(3);

    await persistCourseEnhancementPack(client, firstEnhancement);
    await persistCourseEnhancementPack(client, secondTeacherEnhancement);
    await persistCourseEnhancementPack(client, secondLessonEnhancement);

    expect(records.size).toBe(3);
    expect(records.get(firstEnhancement.id)).toEqual(expect.objectContaining({
      teacherId: 'teacher-1',
      lessonId: 'lesson-2',
      sourcePrepPackId: firstPack.id,
    }));
    expect(records.get(secondTeacherEnhancement.id)).toEqual(expect.objectContaining({
      teacherId: 'teacher-2',
      lessonId: 'lesson-2',
      sourcePrepPackId: secondTeacherPack.id,
    }));
    expect(records.get(secondLessonEnhancement.id)).toEqual(expect.objectContaining({
      teacherId: 'teacher-1',
      lessonId: 'lesson-3',
      sourcePrepPackId: secondLessonPack.id,
    }));
  });
});
