import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ResourceNode } from '@/lib/resource-node-registry';
import type { ControlCorrectionTeacherReport } from '../control-correction-teacher-report';
import type { RoleBasedLearningDiagnosis } from '../role-based-learning-diagnosis';
import {
  buildTeacherPrepPackInsertionPayload,
  buildTeacherPrepPackExportPayload,
  generateTeacherPrepPack,
  isTeacherPrepPackInsertionEligible,
  reviewTeacherPrepPackItem,
  validateTeacherPrepPack,
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
        prepPackId: 'prep-pack:class-1:control-correction:2026-06-05',
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
});
