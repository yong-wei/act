import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { sha256, stableStringify } from '../math-document-grading-contracts';

import {
  approveGradingRun,
  buildDocumentRubricDraftDedupeKey,
  buildStudentGradingFeedbackView,
  buildTeacherGradingWorkbenchView,
  calculateDocumentRubricGradingQualityMetrics,
  convertSubmissionDocument,
  createDraftRubricGrading,
  createDeterministicControlCorrectionEvaluatorOutput,
  createMarkItDownConversionAdapter,
  createSubmissionAsset,
  editCriterionGrade,
  parsePersistedDocumentRubricGradingDraft,
  previewApprovedGradingEvidence,
  textFixtureMarkItDownRunner,
  validateDocumentRubricGradingDraftInvariants,
  writeApprovedGradingEvidence,
  type RubricDefinition,
} from '../document-rubric-grading-workbench';
import { listEvidenceTimeline } from '../evidence-timeline';
import { buildFeedbackTaskContext } from '../../student-feedback-task-contract';
import { buildPipelineGradingWorkbenchView, buildPipelineReviewListItem, validatePipelineReviewContract, validatePipelineReviewEdits, validatePipelineRuntimeSource } from '../math-document-grading-review';
import { MemorySubmissionObjectStore } from '@/lib/assignments/submission-object-store';

const now = new Date('2026-06-04T08:00:00.000Z');

function asset() {
  return createSubmissionAsset({
    id: 'asset-1',
    studentId: 'student-1',
    classId: 'class-1',
    assignmentId: 'report-1',
    fileName: 'root-locus-report.pdf',
    mimeType: 'application/pdf',
    bytes: [
      'Root locus design explains damping ratio and settling time.',
      'Simulation validation shows overshoot below the target.',
      'Reflection connects controller gain with engineering tradeoffs.',
    ].join('\n'),
    uploadedAt: now.toISOString(),
  });
}

function rubric(): RubricDefinition {
  return {
    id: 'rubric-control-report',
    title: '控制设计报告评分量规',
    version: '2026.06',
    maxScore: 4,
    criteria: [
      {
        id: 'modeling',
        label: '模型与指标表达',
        weight: 0.4,
        evidenceRequirement: 'damping ratio',
        goalDimension: 'controlModeling',
        levels: [
          { id: 'novice', label: '待改进', score: 1, description: '指标缺失' },
          { id: 'proficient', label: '达标', score: 3, description: '指标基本完整' },
          { id: 'advanced', label: '优秀', score: 4, description: '指标和权衡清晰' },
        ],
      },
      {
        id: 'validation',
        label: '仿真验证',
        weight: 0.6,
        evidenceRequirement: 'Simulation validation',
        goalDimension: 'parameterDesign',
        levels: [
          { id: 'novice', label: '待改进', score: 1, description: '缺少验证' },
          { id: 'proficient', label: '达标', score: 3, description: '有基本验证' },
          { id: 'advanced', label: '优秀', score: 4, description: '验证充分' },
        ],
      },
    ],
  };
}

function mockEvidenceDb() {
  return {
    learningFact: {
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
    studentEvidenceFeatureCache: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

describe('document rubric grading workbench', () => {
  it('projects native pipeline evidence without creating an asset copy and preserves AI authority', () => {
    const criterion = { id: 'controlModeling', label: '模型', goalDimension: 'controlModeling', maxPoints: 4, evidenceDescription: '', feedbackGuidance: '', levels: [{ id: 'full', label: '满分', minPoints: 4, maxPoints: 4, description: '' }] };
    const rubricSnapshot = { schemaVersion: 'assignment-analytic-rubric.v1', id: 'rubric:question-1', version: 'sha256:question', maxScore: 4, criteria: [criterion] };
    const assignment = { id: 'assignment-1', courseContext: 'course-1' };
    const revision = { id: 'revision-1', assignmentId: 'assignment-1', assignment };
    const run: any = {
      id: 'run-native', state: 'AWAITING_REVIEW', questionId: 'question-1', answerAttemptId: 'attempt-1', answerEvidenceId: 'evidence-1', questionSnapshotHash: 'sha256:question', rubricId: rubricSnapshot.id, rubricVersion: rubricSnapshot.version, evaluatorId: 'evaluator-1', evaluatorVersion: 'eval-v1', retentionExpiresAt: new Date('2027-01-01T00:00:00Z'), createdAt: now, updatedAt: now,
      questionSnapshot: { assignmentRevisionId: 'revision-1', questionId: 'question-1', stableQuestionId: 'q1', responseType: 'SUBJECTIVE_TEXT', prompt: 'Explain.', referenceAnswer: 'Reference.', rubric: rubricSnapshot, contentHash: 'sha256:question' },
      rubricSnapshot,
      assessments: [{ id: 'assessment-1', criterionId: 'controlModeling', levelId: 'full', score: 4, confidence: 0.9, limitationState: 'none' }],
      annotations: [{ id: 'ann-1', assessmentId: 'assessment-1', criterionId: 'controlModeling', blockId: 'block-1', precision: 'SPAN', excerpt: '证据', spanStart: 0, spanEnd: 2, comment: 'AI anchor', authorRole: 'AI_DRAFT' }],
      answerEvidence: { id: 'evidence-1', attemptId: 'attempt-1', version: 1, anchorVersion: 'text-native.v1', sourceKind: 'TEXT_NATIVE', sourceHash: 'sha256:evidence', canonicalMarkdown: '仅从受治理证据读取', precision: 'SPAN', readiness: 'READY', retentionExpiresAt: new Date('2027-01-01T00:00:00Z'), limitations: [], blocks: [{ id: 'block-1', text: '证据', markdown: '证据', confidence: 0.9, sourceHash: 'sha256:block', precision: 'SPAN', spanStart: 0, spanEnd: 2, pageNumber: null }], sourceAsset: null, conversion: null },
      answerAttempt: { id: 'attempt-1', submittedAt: now, answer: { id: 'answer-1', assignmentQuestionId: 'question-1', submission: { studentId: 'student-1', assignmentRevisionId: 'revision-1', frozenStudentId: 'student-1', frozenAudienceClassId: 'class-1', revision, audience: { assignmentRevisionId: 'revision-1', classId: 'class-1', revision, class: { teacherId: 'teacher-1' } } } } },
      question: { id: 'question-1', assignmentRevisionId: 'revision-1', stableQuestionId: 'q1', responseType: 'SUBJECTIVE_TEXT', promptSnapshot: { text: 'Explain.' }, answerSnapshot: { text: 'Reference.' }, rubricSnapshot, contentHash: 'sha256:question', revision },
    };
    run.inputHash = sha256(stableStringify({ questionSnapshot: run.questionSnapshot, evidence: { id: run.answerEvidence.id, version: 1, sourceHash: run.answerEvidence.sourceHash, anchorVersion: run.answerEvidence.anchorVersion }, evaluator: { provider: run.evaluatorId, version: run.evaluatorVersion } }));

    const reasons = validatePipelineReviewContract(run);
    expect(reasons).toEqual([]);
    const view = buildPipelineGradingWorkbenchView(run);
    const listItem = buildPipelineReviewListItem(run);

    expect(view.asset).toMatchObject({ id: null, fileName: '文本作答', checksum: 'sha256:evidence' });
    expect(view.preview.markdown).toBe(run.answerEvidence.canonicalMarkdown);
    expect(view.annotations[0].reference.citationChip.authorityLevel).toBe('service-internal');
    expect(view.actions).toEqual(['approve']);
    expect(JSON.stringify(view)).not.toContain('bytes');
    expect(JSON.stringify(view)).not.toContain('mimeType');
    expect(listItem).toMatchObject({ gradingRunId: 'run-native', assignmentId: 'assignment-1', assignmentRevisionId: 'revision-1', sourceAssetId: null, fileName: '文本作答' });
    expect(JSON.stringify(listItem)).not.toContain(run.answerEvidence.canonicalMarkdown);
    const unavailableRun = structuredClone(run);
    unavailableRun.state = 'CONTENT_UNAVAILABLE';
    unavailableRun.blockedReasons = ['review-contract-rerun-required'];
    const unavailableItem = buildPipelineReviewListItem(unavailableRun);
    expect(unavailableItem).toMatchObject({ state: 'CONTENT_UNAVAILABLE', contentAvailable: false, rerunRequired: true });
    expect(JSON.stringify(unavailableItem)).not.toMatch(/仅从受治理证据读取|sha256:evidence|fileName|checksum/);
    const blockedRun = structuredClone(run);
    blockedRun.answerEvidence.readiness = 'BLOCKED';
    try {
      buildPipelineGradingWorkbenchView(blockedRun);
      throw new Error('expected-content-unavailable');
    } catch (error) {
      expect(error).toMatchObject({ message: 'grading-review-content-unavailable', reasons: expect.arrayContaining(['answer-evidence-content-unavailable']) });
      expect(JSON.stringify(error)).not.toContain(run.answerEvidence.canonicalMarkdown);
      expect(JSON.stringify(error)).not.toContain('sha256:evidence');
    }
    const unanchoredRun = structuredClone(run);
    unanchoredRun.annotations = [];
    expect(() => buildPipelineGradingWorkbenchView(unanchoredRun)).toThrow('grading-review-content-unavailable');
    run.state = 'APPROVED';
    run.teacherReviewedAt = now;
    const approvedView = buildPipelineGradingWorkbenchView(run);
    expect(approvedView.draftSummary).toMatchObject({ status: 'approved', requiresTeacherApproval: false });
    expect(approvedView.actions).toEqual([]);
    const uiSource = readFileSync(join(process.cwd(), 'src/features/assessment/document-rubric-grading-ui.tsx'), 'utf8');
    expect(uiSource).toContain('AI 证据已完成教师决策');
    expect(uiSource).toContain('当前展示 AI 评分证据与已完成的教师决策');
  });

  it('shares fail-closed runtime source validation for text evidence', async () => {
    const run: any = { answerEvidence: { sourceKind: 'TEXT_NATIVE', sourceHash: sha256('稳定文本') }, answerAttempt: { textSnapshot: '漂移文本', textSnapshotDeleteStrategy: 'delete-content', textSnapshotExpiresAt: new Date('2027-01-01T00:00:00Z') } };
    await expect(validatePipelineRuntimeSource(run, new MemorySubmissionObjectStore(), now)).resolves.toEqual(['runtime-text-source-unavailable']);
    run.answerAttempt.textSnapshot = '稳定文本';
    run.answerEvidence.sourceHash = sha256('稳定文本');
    await expect(validatePipelineRuntimeSource(run, new MemorySubmissionObjectStore(), now)).resolves.toEqual([]);
  });

  it('converts documents with MarkItDown metadata and span references when available', async () => {
    const converted = await convertSubmissionDocument({
      asset: asset(),
      adapter: createMarkItDownConversionAdapter({
        now,
        preserveSpanMapping: true,
        runner: (submission) => textFixtureMarkItDownRunner(submission, true),
      }),
      now,
    });

    expect(converted.status).toBe('converted');
    expect(converted.adapter).toBe('markitdown');
    expect(converted.referencePrecision).toBe('span');
    expect(converted.checksum).toBe(asset().checksum);
    expect(converted.blocks[0]).toEqual(expect.objectContaining({
      pageNumber: 1,
      spanStart: 0,
      confidence: 0.92,
    }));
  });

  it('falls back to block or page references when layout mapping is unavailable or conversion fails', async () => {
    const blockFallback = await convertSubmissionDocument({
      asset: asset(),
      adapter: createMarkItDownConversionAdapter({
        now,
        preserveSpanMapping: false,
        runner: (submission) => textFixtureMarkItDownRunner(submission, false),
      }),
      now,
    });
    const failed = await convertSubmissionDocument({
      asset: asset(),
      adapter: createMarkItDownConversionAdapter({ now, fail: true }),
      retryOf: blockFallback,
      now,
    });

    expect(blockFallback.status).toBe('fallback');
    expect(blockFallback.referencePrecision).toBe('block');
    expect(blockFallback.warnings).toContain('layout-span-mapping-unavailable');
    expect(failed.status).toBe('failed');
    expect(failed.referencePrecision).toBe('page');
    expect(failed.blocks).toEqual([expect.objectContaining({
      id: 'fallback-block-1',
      text: expect.stringContaining('Root locus design'),
      confidence: 0,
    })]);
    expect(failed.warnings).toEqual(expect.arrayContaining(['markitdown-conversion-failed', 'retry-fallback']));
  });

  it('supports v2 scoring-standard-only drafts and independent one-decimal teacher scores', async () => {
    const converted = await convertSubmissionDocument({
      asset: asset(),
      adapter: createMarkItDownConversionAdapter({
        now,
        runner: (submission) => textFixtureMarkItDownRunner(submission, true),
      }),
      now,
    });
    const standardRubric: RubricDefinition = {
      id: 'rubric-standard-v2',
      title: '评分标准',
      version: '2026.07',
      schemaVersion: 'assignment-scoring-rubric.v2',
      maxScore: 4,
      criteria: [{
        id: 'modeling',
        label: '模型表达',
        weight: 1,
        maxPoints: 4,
        scoringStandard: '依据阻尼比证据的正确性和完整性评分。',
        detailedRubricEnabled: false,
        evidenceRequirement: 'damping ratio',
        goalDimension: 'controlModeling',
        levels: [],
      }],
    };
    const run = createDraftRubricGrading({
      convertedDocument: converted,
      rubric: standardRubric,
      evaluatorOutput: {
        evaluatorId: 'fixture-v2',
        evaluatorVersion: 'v2',
        assessments: [{
          criterionId: 'modeling',
          levelId: null,
          score: 3.1,
          rationale: 'The submitted evidence identifies the damping ratio clearly.',
          confidence: 0.9,
          evidenceBlockIds: [converted.blocks[0].id],
          limitationState: 'none',
        }],
      },
      now,
    });
    expect(run.status).toBe('draft');
    expect(run.draftGrades[0]).toEqual(expect.objectContaining({ levelId: null, score: 3.1 }));

    const edited = editCriterionGrade(run, {
      criterionId: 'modeling',
      levelId: null,
      score: 3.9,
      comment: '教师根据完整证据调整分数。',
      reviewerId: 'teacher-1',
      rubric: standardRubric,
      now,
    });
    expect(edited.draftGrades[0].score).toBe(3.9);
    expect(() => editCriterionGrade(run, {
      criterionId: 'modeling',
      levelId: null,
      score: 3.95,
      comment: '非法精度。',
      reviewerId: 'teacher-1',
      rubric: standardRubric,
      now,
    })).toThrow('teacher-score-must-use-0.1-quantum');

    const submission = asset();
    const persisted = {
      id: edited.id,
      ownerUserId: submission.studentId,
      dedupeKey: buildDocumentRubricDraftDedupeKey(submission, edited),
      classId: submission.classId,
      sourceRefs: {
        asset: submission,
        classId: submission.classId,
        assignmentId: submission.assignmentId,
      },
      evidenceRefs: { convertedDocument: converted },
      summary: { run: edited, rubric: standardRubric },
    };
    const parsed = parsePersistedDocumentRubricGradingDraft(persisted);
    expect(parsed).not.toBeNull();
    expect(validateDocumentRubricGradingDraftInvariants({
      draft: persisted,
      parsed: parsed!,
    })).toEqual({ valid: true, reasons: [] });

    const approved = approveGradingRun(edited, {
      reviewerId: 'teacher-1',
      decision: 'approved',
      now,
    });
    const goalContext = {
      classId: submission.classId,
      assignmentId: submission.assignmentId,
      goalId: 'control-report',
      targetGoal: 'control-report',
    };
    expect(previewApprovedGradingEvidence({
      run: approved,
      rubric: standardRubric,
      studentId: submission.studentId,
      goalContext,
      sourceLogId: 'draft-v2-scoring-standard',
      now,
    })).toEqual(expect.objectContaining({
      status: 'preview',
      blocked: 0,
      facts: [expect.objectContaining({ score: 3.9 })],
    }));
    const db = {
      learningFact: {
        createMany: vi.fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
      },
      studentEvidenceFeatureCache: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    await expect(writeApprovedGradingEvidence({
      db,
      run: approved,
      rubric: standardRubric,
      studentId: submission.studentId,
      goalContext,
      sourceLogId: 'draft-v2-scoring-standard',
      now,
    })).resolves.toEqual(expect.objectContaining({ created: 1, skipped: 0 }));
    await expect(writeApprovedGradingEvidence({
      db,
      run: approved,
      rubric: standardRubric,
      studentId: submission.studentId,
      goalContext,
      sourceLogId: 'draft-v2-scoring-standard',
      now,
    })).resolves.toEqual(expect.objectContaining({ created: 0, skipped: 1 }));
  });

  it('does not clamp v2 teacher revisions to the selected AI level', () => {
    const run = {
      questionSnapshot: {
        rubric: {
          schemaVersion: 'assignment-scoring-rubric.v2',
          criteria: [{
            id: 'quality',
            maxPoints: 10,
            detailedRubricEnabled: true,
            levels: [
              { id: 'excellent', minPoints: 8, maxPoints: 10 },
              { id: 'pass', minPoints: 6, maxPoints: 7.9 },
            ],
          }],
        },
      },
    };
    expect(validatePipelineReviewEdits(run, [{
      criterionId: 'quality',
      levelId: 'excellent',
      score: 6.5,
      comment: '教师独立评分。',
    }])).toBeNull();
    expect(validatePipelineReviewEdits(run, [{
      criterionId: 'quality',
      levelId: 'excellent',
      score: 6.55,
      comment: '非法精度。',
    }])).toBe('评分编辑分数必须保留一位小数');
  });

  it('keeps failed conversion drafts anchored to an auditable fallback block', async () => {
    const submission = asset();
    const failed = await convertSubmissionDocument({
      asset: submission,
      adapter: createMarkItDownConversionAdapter({ now, fail: true }),
      now,
    });
    const draft = createDraftRubricGrading({ convertedDocument: failed, rubric: rubric(), now });
    const parsed = parsePersistedDocumentRubricGradingDraft({
      id: draft.id,
      ownerUserId: submission.studentId,
      dedupeKey: buildDocumentRubricDraftDedupeKey(submission, draft),
      classId: submission.classId,
      sourceRefs: {
        asset: submission,
        classId: submission.classId,
        assignmentId: submission.assignmentId,
      },
      evidenceRefs: {
        convertedDocument: failed,
      },
      summary: {
        run: draft,
        rubric: rubric(),
      },
    });

    expect(parsed).not.toBeNull();
    expect(failed.blocks).toHaveLength(1);
    expect(draft.draftGrades.every((grade) =>
      grade.evidenceRefs.every((reference) => reference.blockId === 'fallback-block-1')
    )).toBe(true);
    expect(validateDocumentRubricGradingDraftInvariants({
      draft: {
        id: draft.id,
        ownerUserId: submission.studentId,
        dedupeKey: buildDocumentRubricDraftDedupeKey(submission, draft),
        classId: submission.classId,
        sourceRefs: {
          asset: submission,
          classId: submission.classId,
          assignmentId: submission.assignmentId,
        },
        evidenceRefs: {
          convertedDocument: failed,
        },
        summary: {
          run: draft,
          rubric: rubric(),
        },
      },
      parsed: parsed!,
    })).toEqual({ valid: true, reasons: [] });

    const approved = approveGradingRun(draft, { reviewerId: 'teacher-1', decision: 'approved', now });
    const db = mockEvidenceDb();
    const writeback = await writeApprovedGradingEvidence({
      db,
      run: approved,
      rubric: rubric(),
      studentId: submission.studentId,
      goalContext: {
        classId: submission.classId,
        assignmentId: submission.assignmentId,
        goalId: 'control-report',
        targetGoal: 'control-report',
      },
      sourceLogId: 'draft-fallback-evidence',
      now,
    });
    const preview = previewApprovedGradingEvidence({
      run: approved,
      rubric: rubric(),
      studentId: submission.studentId,
      goalContext: {
        classId: submission.classId,
        assignmentId: submission.assignmentId,
        goalId: 'control-report',
        targetGoal: 'control-report',
      },
      sourceLogId: 'draft-fallback-evidence',
      now,
    });

    expect(writeback).toEqual({
      status: 'blocked-unreliable-evidence',
      created: 0,
      skipped: 0,
      blocked: 2,
      facts: [],
    });
    expect(preview).toEqual(expect.objectContaining({
      status: 'blocked-unreliable-evidence',
      blocked: 2,
      facts: [],
      affectedDimensions: [],
      dedupeKeys: [],
    }));
    expect(db.learningFact.createMany).not.toHaveBeenCalled();
    expect(db.studentEvidenceFeatureCache.deleteMany).not.toHaveBeenCalled();
  });

  it('keeps AI draft grading teacher-gated before writeback', async () => {
    const converted = await convertSubmissionDocument({
      asset: asset(),
      adapter: createMarkItDownConversionAdapter({
        now,
        preserveSpanMapping: true,
        runner: (submission) => textFixtureMarkItDownRunner(submission, true),
      }),
      now,
    });
    const draft = createDraftRubricGrading({ convertedDocument: converted, rubric: rubric(), now });

    expect(draft.status).toBe('draft');
    expect(draft.evaluator).toEqual({
      id: 'control-correction-rubric-v1-deterministic',
      version: '2026.06',
      status: 'valid',
      blockedReasons: [],
    });
    expect(draft.draftGrades).toHaveLength(2);
    expect(draft.draftGrades.map((grade) => grade.levelId)).toEqual(['advanced', 'advanced']);
    expect(createDeterministicControlCorrectionEvaluatorOutput({
      convertedDocument: converted,
      rubric: rubric(),
    }).assessments.map((assessment) => assessment.limitationState)).toEqual(['none', 'none']);
    expect(draft.draftGrades[0].evidenceRefs[0]).toEqual(expect.objectContaining({
      convertedDocumentId: converted.id,
      precision: 'span',
      checksum: converted.checksum,
      citationChip: expect.objectContaining({
        sourceType: 'grading-artifact',
        authorityLevel: 'teacher-authored',
        privacyVisibility: 'redacted',
        limitationState: null,
      }),
    }));
    const multiAnchorDraft = createDraftRubricGrading({
      convertedDocument: converted,
      rubric: rubric(),
      evaluatorOutput: {
        evaluatorId: 'multi-anchor-test-evaluator',
        evaluatorVersion: '2026.06',
        assessments: [
          {
            criterionId: 'modeling',
            levelId: 'advanced',
            score: 4,
            rationale: 'Modeling cites two anchors for damping ratio evidence.',
            confidence: 0.9,
            evidenceBlockIds: ['block-1', 'block-1'],
            limitationState: 'none',
          },
          {
            criterionId: 'validation',
            levelId: 'advanced',
            score: 4,
            rationale: 'Validation cites the simulation evidence anchor.',
            confidence: 0.9,
            evidenceBlockIds: ['block-2'],
            limitationState: 'none',
          },
        ],
      },
      now,
    });
    const multiAnchorIds = multiAnchorDraft.annotations.map((annotation) => annotation.id);
    expect(multiAnchorIds).toEqual([
      'annotation:modeling:block-1:1',
      'annotation:modeling:block-1:2',
      'annotation:validation:block-2:1',
    ]);
    expect(new Set(multiAnchorIds).size).toBe(multiAnchorIds.length);
    await expect(writeApprovedGradingEvidence({
      db: mockEvidenceDb(),
      run: draft,
      rubric: rubric(),
      studentId: asset().studentId,
      goalContext: {
        classId: 'class-1',
        assignmentId: 'report-1',
        goalId: 'control-report',
        targetGoal: 'control-report',
      },
      sourceLogId: 'draft-teacher-edit',
      now,
    })).resolves.toEqual({
      status: 'blocked-unapproved',
      created: 0,
      skipped: 0,
      blocked: 2,
      facts: [],
    });
    expect(previewApprovedGradingEvidence({
      run: draft,
      rubric: rubric(),
      studentId: asset().studentId,
      goalContext: {
        classId: 'class-1',
        assignmentId: 'report-1',
        goalId: 'control-report',
        targetGoal: 'control-report',
      },
      sourceLogId: 'draft-teacher-edit',
      now,
    })).toEqual(expect.objectContaining({
      status: 'blocked-unapproved',
      blocked: 2,
      facts: [],
      affectedDimensions: [],
    }));
  });

  it('blocks invalid evaluator output before teacher approval or writeback', async () => {
    const converted = await convertSubmissionDocument({
      asset: asset(),
      adapter: createMarkItDownConversionAdapter({
        now,
        preserveSpanMapping: true,
        runner: (submission) => textFixtureMarkItDownRunner(submission, true),
      }),
      now,
    });
    const draft = createDraftRubricGrading({
      convertedDocument: converted,
      rubric: rubric(),
      evaluatorOutput: {
        evaluatorId: 'test-evaluator',
        evaluatorVersion: '2026.06',
        assessments: [{
          criterionId: 'modeling',
          levelId: 'advanced',
          score: 4,
          rationale: 'sk-test-secret-leak',
          confidence: 0.9,
          evidenceBlockIds: ['missing-block-id'],
          limitationState: 'none',
        }],
      },
      now,
    });

    expect(draft.status).toBe('blocked');
    expect(draft.draftGrades).toEqual([]);
    expect(draft.evaluator).toEqual(expect.objectContaining({
      id: 'test-evaluator',
      status: 'blocked',
      blockedReasons: expect.arrayContaining([
        'evidence-anchor-missing',
        'unsafe-rationale',
        'criterion-assessment-missing',
      ]),
    }));
    expect(buildTeacherGradingWorkbenchView({
      asset: asset(),
      convertedDocument: converted,
      rubric: rubric(),
      run: draft,
    }).actions).toEqual(['retry-conversion']);
    await expect(writeApprovedGradingEvidence({
      db: mockEvidenceDb(),
      run: draft,
      rubric: rubric(),
      studentId: asset().studentId,
      sourceLogId: 'draft-blocked',
      goalContext: {
        classId: 'class-1',
        assignmentId: 'report-1',
        goalId: 'control-report',
        targetGoal: 'control-report',
      },
      now,
    })).resolves.toEqual({
      status: 'blocked-unapproved',
      created: 0,
      skipped: 0,
      blocked: 0,
      facts: [],
    });

    const mismatchedAnchor = createDraftRubricGrading({
      convertedDocument: converted,
      rubric: rubric(),
      evaluatorOutput: {
        evaluatorId: 'test-evaluator',
        evaluatorVersion: '2026.06',
        assessments: [
          {
            criterionId: 'modeling',
            levelId: 'advanced',
            score: 4,
            rationale: 'Uses a real converted block but not the required modeling anchor.',
            confidence: 0.9,
            evidenceBlockIds: ['block-2'],
            limitationState: 'none',
          },
          {
            criterionId: 'validation',
            levelId: 'advanced',
            score: 4,
            rationale: 'Uses validation evidence with the required anchor.',
            confidence: 0.9,
            evidenceBlockIds: ['block-2'],
            limitationState: 'none',
          },
        ],
      },
      now,
    });
    expect(mismatchedAnchor.status).toBe('blocked');
    expect(mismatchedAnchor.evaluator.blockedReasons).toContain('evidence-anchor-requirement-mismatch');

    const malformedAssessment = createDraftRubricGrading({
      convertedDocument: converted,
      rubric: rubric(),
      evaluatorOutput: {
        evaluatorId: 'test-evaluator',
        evaluatorVersion: '2026.06',
        assessments: [null as never],
      },
      now,
    });
    expect(malformedAssessment.status).toBe('blocked');
    expect(malformedAssessment.evaluator.blockedReasons).toEqual(expect.arrayContaining([
      'assessment-malformed',
      'criterion-assessment-missing',
    ]));

    const malformedAnchors = createDraftRubricGrading({
      convertedDocument: converted,
      rubric: rubric(),
      evaluatorOutput: {
        evaluatorId: 'test-evaluator',
        evaluatorVersion: '2026.06',
        assessments: [
          {
            criterionId: 'modeling',
            levelId: 'advanced',
            score: 4,
            rationale: 'Modeling evidence has malformed anchors and must be blocked.',
            confidence: 0.9,
            evidenceBlockIds: {} as never,
            limitationState: 'none',
          },
          {
            criterionId: 'validation',
            levelId: 'advanced',
            score: 4,
            rationale: 'Validation evidence is cited with the required anchor.',
            confidence: 0.9,
            evidenceBlockIds: ['block-2'],
            limitationState: 'none',
          },
        ],
      },
      now,
    });
    expect(malformedAnchors.status).toBe('blocked');
    expect(malformedAnchors.evaluator.blockedReasons).toContain('evidence-anchors-missing');

    const mismatchedScore = createDraftRubricGrading({
      convertedDocument: converted,
      rubric: rubric(),
      evaluatorOutput: {
        evaluatorId: 'test-evaluator',
        evaluatorVersion: '2026.06',
        assessments: [
          {
            criterionId: 'modeling',
            levelId: 'novice',
            score: 4,
            rationale: 'Modeling evidence is cited with an intentionally inconsistent score.',
            confidence: 0.9,
            evidenceBlockIds: ['block-1'],
            limitationState: 'none',
          },
          {
            criterionId: 'validation',
            levelId: 'advanced',
            score: 4,
            rationale: 'Validation evidence is cited with a consistent score.',
            confidence: 0.9,
            evidenceBlockIds: ['block-2'],
            limitationState: 'none',
          },
        ],
      },
      now,
    });
    expect(mismatchedScore.status).toBe('blocked');
    expect(mismatchedScore.evaluator.blockedReasons).toContain('score-level-mismatch');
  });

  it('supports teacher edits, approval, and governed evidence writeback', async () => {
    const converted = await convertSubmissionDocument({
      asset: asset(),
      adapter: createMarkItDownConversionAdapter({
        now,
        preserveSpanMapping: true,
        runner: (submission) => textFixtureMarkItDownRunner(submission, true),
      }),
      now,
    });
    const draft = createDraftRubricGrading({ convertedDocument: converted, rubric: rubric(), now });
    const edited = editCriterionGrade(draft, {
      criterionId: 'validation',
      levelId: 'advanced',
      score: 4,
      comment: '验证过程充分，图表和结论一致。',
      reviewerId: 'teacher-1',
      rubric: rubric(),
      now,
    });
    const approved = approveGradingRun(edited, {
      reviewerId: 'teacher-1',
      decision: 'approved',
      notes: '可以返回学生。',
      now,
    });
    const db = mockEvidenceDb();
    const writeback = await writeApprovedGradingEvidence({
      db,
      run: approved,
      rubric: rubric(),
      studentId: asset().studentId,
      goalContext: {
        classId: 'class-1',
        assignmentId: 'report-1',
        goalId: 'control-report',
        targetGoal: 'control-report',
      },
      sourceLogId: 'draft-teacher-edit',
      now,
    });
    const preview = previewApprovedGradingEvidence({
      run: approved,
      rubric: rubric(),
      studentId: asset().studentId,
      goalContext: {
        classId: 'class-1',
        assignmentId: 'report-1',
        goalId: 'control-report',
        targetGoal: 'control-report',
      },
      sourceLogId: 'draft-teacher-edit',
      now,
    });

    expect(approved.status).toBe('approved');
    expect(approved.teacherDiffs).toHaveLength(1);
    expect(approved.teacherDiffs[0]).toEqual(expect.objectContaining({
      criterionId: 'validation',
      fields: expect.arrayContaining(['comment']),
      aiDraft: expect.objectContaining({ levelId: 'advanced' }),
      teacherApproved: expect.objectContaining({ score: 4, comment: '验证过程充分，图表和结论一致。' }),
    }));
    expect(preview.status).toBe('preview');
    expect(preview.created).toBe(0);
    expect(preview.affectedDimensions).toContainEqual(expect.objectContaining({
      criterionId: 'validation',
      competencyDimension: 'parameterDesign',
      contribution: 0.6,
      sourceEventId: `grading:${encodeURIComponent(approved.id)}:validation:${encodeURIComponent(approved.rubricVersion)}`,
    }));
    expect(preview.dedupeKeys).toContain(`grading:${encodeURIComponent(approved.id)}:validation:${encodeURIComponent(approved.rubricVersion)}`);
    expect(approved.approvedGrades.find((grade) => grade.criterionId === 'validation')?.score).toBe(4);
    expect(writeback.status).toBe('written');
    expect(writeback.created).toBe(2);
    expect(writeback.skipped).toBe(0);
    expect(writeback.blocked).toBe(0);
    expect(writeback.facts).toContainEqual(expect.objectContaining({
      userId: 'student-1',
      factType: 'document_rubric_grading',
      sourceEventId: `grading:${encodeURIComponent(approved.id)}:validation:${encodeURIComponent(approved.rubricVersion)}`,
    }));
    expect(writeback.facts[0].contextJson.confidence).toBeLessThanOrEqual(0.92);
    expect(writeback.facts[0].contextJson).toEqual(expect.objectContaining({
      classId: 'class-1',
      assignmentId: 'report-1',
      feedbackSource: 'document-feedback',
      goalId: 'control-report',
      targetGoal: 'control-report',
      learningGoal: 'control-report',
      competencyDimension: 'controlModeling',
      teacherReview: expect.objectContaining({
        reviewerId: 'teacher-1',
        decision: 'approved',
        reviewedAt: approved.teacherReview.reviewedAt,
      }),
      teacherDiffs: [],
      evaluator: approved.evaluator,
      idempotencyKey: `${approved.id}:modeling:${approved.rubricVersion}`,
    }));
    expect(writeback.facts.find((fact) => fact.contextJson.criterionId === 'validation')?.contextJson.teacherDiffs)
      .toEqual(approved.teacherDiffs);
    expect(writeback.facts.find((fact) => fact.contextJson.criterionId === 'validation')?.contextJson.criterionLimitationState)
      .toBe('none');
    expect(writeback.facts.find((fact) => fact.contextJson.criterionId === 'validation')?.competencyContribution)
      .toEqual({ parameterDesign: 0.6 });
    expect(db.learningFact.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: expect.arrayContaining([
        expect.objectContaining({
          startedAt: expect.any(Date),
          finishedAt: expect.any(Date),
          competencyContribution: expect.objectContaining({ controlModeling: expect.any(Number) }),
        }),
      ]),
    }));
    expect(db.studentEvidenceFeatureCache.deleteMany).toHaveBeenCalledWith({ where: { userId: 'student-1' } });
  });

  it('preserves two-decimal teacher edits for historical v1 rubrics', async () => {
    const converted = await convertSubmissionDocument({
      asset: asset(),
      adapter: createMarkItDownConversionAdapter({
        now,
        preserveSpanMapping: true,
        runner: (submission) => textFixtureMarkItDownRunner(submission, true),
      }),
      now,
    });
    const legacyRubric = rubric();
    const draft = createDraftRubricGrading({
      convertedDocument: converted,
      rubric: legacyRubric,
      now,
    });
    const edited = editCriterionGrade(draft, {
      criterionId: 'validation',
      levelId: 'advanced',
      score: 3.55,
      comment: '保留历史评分精度。',
      reviewerId: 'teacher-1',
      rubric: legacyRubric,
      now,
    });

    expect(edited.draftGrades.find((grade) => grade.criterionId === 'validation')?.score).toBe(3.55);
  });

  it('keeps document feedback action source aligned with written learner evidence filters', async () => {
    const submission = asset();
    const converted = await convertSubmissionDocument({
      asset: submission,
      adapter: createMarkItDownConversionAdapter({
        now,
        preserveSpanMapping: true,
        runner: (documentAsset) => textFixtureMarkItDownRunner(documentAsset, true),
      }),
      now,
    });
    const approved = approveGradingRun(createDraftRubricGrading({
      convertedDocument: converted,
      rubric: rubric(),
      now,
    }), { reviewerId: 'teacher-1', decision: 'approved', now });
    const db = mockEvidenceDb();
    const writeback = await writeApprovedGradingEvidence({
      db,
      run: approved,
      rubric: rubric(),
      studentId: submission.studentId,
      goalContext: {
        classId: submission.classId,
        assignmentId: submission.assignmentId,
        goalId: 'control-report',
        targetGoal: 'control-report',
      },
      sourceLogId: 'draft-document-feedback',
      now,
    });
    const studentView = buildStudentGradingFeedbackView({
      asset: submission,
      convertedDocument: converted,
      rubric: rubric(),
      run: approved,
      viewerStudentId: submission.studentId,
    });
    const learnerRecordCard = studentView.actionCards.find((card) => card.destinationType === 'learner-record');
    const learnerRecordQuery = new URLSearchParams(learnerRecordCard?.href.split('?')[1] ?? '');
    const matchingFact = writeback.facts.find((fact) => (
      fact.contextJson.assignmentId === learnerRecordQuery.get('assignment') &&
      fact.contextJson.criterionId === learnerRecordQuery.get('criterion')
    ));
    expect(learnerRecordQuery.get('source')).toBe('document-feedback');
    expect(matchingFact?.contextJson.feedbackSource).toBe(learnerRecordQuery.get('source'));

    const timelineDb = {
      learningFact: {
        findMany: vi.fn().mockResolvedValue(writeback.facts.map((fact, index) => ({
          id: `fact-${index}`,
          moduleId: null,
          sessionId: null,
          lessonId: null,
          courseId: 'automatic-control',
          createdAt: now,
          ...fact,
        }))),
      },
      studentStepResponse: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const timeline = await listEvidenceTimeline({
      db: timelineDb,
      userId: submission.studentId,
      filters: {
        assignment: learnerRecordQuery.get('assignment') ?? undefined,
        criterion: learnerRecordQuery.get('criterion') ?? undefined,
        assignmentSource: learnerRecordQuery.get('source') ?? undefined,
      },
    });

    expect(timelineDb.learningFact.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          { contextJson: { path: ['assignmentId'], equals: submission.assignmentId } },
          expect.objectContaining({
            OR: expect.arrayContaining([
              { contextJson: { path: ['feedbackSource'], equals: 'document-feedback' } },
            ]),
          }),
        ]),
      }),
    }));
    expect(timeline.items.map((item) => item.id)).toContain('fact-0');
  });

  it('preserves limited evidence confidence and original AI draft across teacher edits', async () => {
    const converted = await convertSubmissionDocument({
      asset: asset(),
      adapter: createMarkItDownConversionAdapter({
        now,
        preserveSpanMapping: true,
        runner: (submission) => textFixtureMarkItDownRunner(submission, true),
      }),
      now,
    });
    const draft = createDraftRubricGrading({
      convertedDocument: converted,
      rubric: rubric(),
      evaluatorOutput: {
        evaluatorId: 'test-evaluator',
        evaluatorVersion: '2026.06',
        assessments: [
          {
            criterionId: 'modeling',
            levelId: 'novice',
            score: 1,
            rationale: 'Modeling evidence is present but has low confidence.',
            confidence: 0.4,
            evidenceBlockIds: ['block-1'],
            limitationState: 'low-confidence',
          },
          {
            criterionId: 'validation',
            levelId: 'advanced',
            score: 4,
            rationale: 'Validation evidence is cited with the required anchor.',
            confidence: 0.9,
            evidenceBlockIds: ['block-2'],
            limitationState: 'none',
          },
        ],
      },
      now,
    });

    const firstEdit = editCriterionGrade(draft, {
      criterionId: 'modeling',
      levelId: 'proficient',
      score: 3,
      comment: '教师认可低置信证据但只给达标。',
      reviewerId: 'teacher-1',
      rubric: rubric(),
      now,
    });
    const secondEdit = editCriterionGrade(firstEdit, {
      criterionId: 'modeling',
      levelId: 'advanced',
      score: 4,
      comment: '教师最终确认模型假设表达完整。',
      reviewerId: 'teacher-1',
      rubric: rubric(),
      now,
    });
    const annotationIds = secondEdit.annotations.map((annotation) => annotation.id);
    expect(annotationIds).toEqual([
      'annotation:modeling:block-1:1',
      'annotation:validation:block-2:1',
      'annotation:modeling:block-1:teacher:1:3',
      'annotation:modeling:block-1:teacher:1:4',
    ]);
    expect(new Set(annotationIds).size).toBe(annotationIds.length);
    const approved = approveGradingRun(secondEdit, { reviewerId: 'teacher-1', decision: 'approved', now });
    const preview = previewApprovedGradingEvidence({
      run: approved,
      rubric: rubric(),
      studentId: asset().studentId,
      goalContext: {
        classId: 'class-1',
        assignmentId: 'report-1',
        goalId: 'control-report',
        targetGoal: 'control-report',
      },
      sourceLogId: 'draft-limited-evidence',
      now,
    });

    expect(approved.teacherDiffs.find((diff) => diff.criterionId === 'modeling')).toEqual(expect.objectContaining({
      aiDraft: expect.objectContaining({ levelId: 'novice', score: 1 }),
      teacherApproved: expect.objectContaining({ levelId: 'advanced', score: 4 }),
    }));
    expect(approved.approvedGrades.find((grade) => grade.criterionId === 'modeling')).toEqual(expect.objectContaining({
      limitationState: 'low-confidence',
      confidence: 0.4,
      profileWritebackCandidate: expect.objectContaining({ confidence: 0.4 }),
    }));
    expect(preview.facts.find((fact) => fact.contextJson.criterionId === 'modeling')?.contextJson).toEqual(expect.objectContaining({
      criterionLimitationState: 'low-confidence',
      confidence: 0.4,
    }));
  });

  it('reports idempotent writeback skips when learning facts already exist', async () => {
    const converted = await convertSubmissionDocument({
      asset: asset(),
      adapter: createMarkItDownConversionAdapter({
        now,
        preserveSpanMapping: true,
        runner: (submission) => textFixtureMarkItDownRunner(submission, true),
      }),
      now,
    });
    const approved = approveGradingRun(
      createDraftRubricGrading({ convertedDocument: converted, rubric: rubric(), now }),
      { reviewerId: 'teacher-1', decision: 'approved', now },
    );
    const db = mockEvidenceDb();
    db.learningFact.createMany.mockResolvedValueOnce({ count: 0 });

    const writeback = await writeApprovedGradingEvidence({
      db,
      run: approved,
      rubric: rubric(),
      studentId: asset().studentId,
      goalContext: {
        classId: 'class-1',
        assignmentId: 'report-1',
        goalId: 'control-report',
        targetGoal: 'control-report',
      },
      sourceLogId: 'draft-idempotent-writeback',
      now,
    });

    expect(writeback).toEqual(expect.objectContaining({
      status: 'written',
      created: 0,
      skipped: 2,
      blocked: 0,
    }));
    expect(writeback.facts.map((fact) => fact.sourceEventId)).toEqual(expect.arrayContaining([
      `grading:${encodeURIComponent(approved.id)}:modeling:${encodeURIComponent(rubric().version)}`,
      `grading:${encodeURIComponent(approved.id)}:validation:${encodeURIComponent(rubric().version)}`,
    ]));
  });

  it('builds teacher workbench and student feedback views with access gating and Konling entry points', async () => {
    const submission = asset();
    const converted = await convertSubmissionDocument({
      asset: submission,
      adapter: createMarkItDownConversionAdapter({
        now,
        preserveSpanMapping: false,
        runner: (documentAsset) => textFixtureMarkItDownRunner(documentAsset, false),
      }),
      now,
    });
    const draft = createDraftRubricGrading({ convertedDocument: converted, rubric: rubric(), now });
    const returnedDraft = approveGradingRun(draft, { reviewerId: 'teacher-1', decision: 'returned', now });
    const edited = editCriterionGrade(draft, {
      criterionId: 'validation',
      levelId: 'advanced',
      score: 4,
      comment: '教师确认后返回。',
      reviewerId: 'teacher-1',
      now,
    });
    const returnedEdited = approveGradingRun(edited, { reviewerId: 'teacher-1', decision: 'returned', now });
    const approved = approveGradingRun(draft, { reviewerId: 'teacher-1', now });
    const teacherView = buildTeacherGradingWorkbenchView({
      asset: submission,
      convertedDocument: converted,
      rubric: rubric(),
      run: draft,
    });
    const hiddenStudentView = buildStudentGradingFeedbackView({
      asset: submission,
      convertedDocument: converted,
      rubric: rubric(),
      run: draft,
      viewerStudentId: 'student-1',
    });
    const visibleStudentView = buildStudentGradingFeedbackView({
      asset: submission,
      convertedDocument: converted,
      rubric: rubric(),
      run: approved,
      viewerStudentId: 'student-1',
    });
    const otherStudentView = buildStudentGradingFeedbackView({
      asset: submission,
      convertedDocument: converted,
      rubric: rubric(),
      run: approved,
      viewerStudentId: 'student-2',
    });
    const returnedDraftView = buildStudentGradingFeedbackView({
      asset: submission,
      convertedDocument: converted,
      rubric: rubric(),
      run: returnedDraft,
      viewerStudentId: 'student-1',
    });
    const returnedEditedView = buildStudentGradingFeedbackView({
      asset: submission,
      convertedDocument: converted,
      rubric: rubric(),
      run: returnedEdited,
      viewerStudentId: 'student-1',
    });

    expect(teacherView.conversion.referencePrecision).toBe('block');
    expect(teacherView.rubricTree.map((item) => item.criterionId)).toEqual(['modeling', 'validation']);
    expect(teacherView.annotations).toHaveLength(2);
    expect(teacherView.annotations[0]).toEqual(expect.objectContaining({
      criterionId: 'modeling',
      authorRole: 'ai-draft',
      reference: expect.objectContaining({ precision: 'block' }),
    }));
    expect(teacherView.actions).toEqual(expect.arrayContaining(['edit-criterion', 'approve', 'retry-conversion']));
    const approvedTeacherView = buildTeacherGradingWorkbenchView({
      asset: submission,
      convertedDocument: converted,
      rubric: rubric(),
      run: approved,
    });
    expect(approvedTeacherView.actions).not.toContain('approve');
    expect(teacherView.konlingEntryPoint.mode).toBe('grading-assistant');
    expect(teacherView.konlingEntryPoint.serverContext).toEqual(expect.objectContaining({
      gradingRunId: draft.id,
      assetId: submission.id,
      rubricId: rubric().id,
    }));
    expect(hiddenStudentView.status).toBe('hidden-unapproved');
    expect(visibleStudentView.status).toBe('visible');
    expect(visibleStudentView.rubricBreakdown).toHaveLength(2);
    expect(visibleStudentView.evidenceCapsules[0].confidence).toBeGreaterThan(0);
    expect(visibleStudentView.profileImpactSummary[0].goalDimension).toBe('controlModeling');
    expect(visibleStudentView.actionCards).toHaveLength(8);
    expect(visibleStudentView.actionCards.map((card) => card.destinationType)).toEqual(expect.arrayContaining([
      'learner-record',
      'path',
      'practice',
      'resource',
    ]));
    const resourceCardHref = visibleStudentView.actionCards.find((card) => card.destinationType === 'resource')?.href;
    expect(resourceCardHref).toContain('/interactive-learning/resources/lesson09-correction-precheck');
    expect(resourceCardHref).toContain('intent=revise');
    const resourceCardContext = buildFeedbackTaskContext(Object.fromEntries(
      new URLSearchParams(resourceCardHref?.split('?')[1] ?? ''),
    ));
    expect(resourceCardContext?.lifecycleState).toBe('revising');
    expect(visibleStudentView.actionCards.find((card) => card.destinationType === 'practice')?.href)
      .toContain('/assessment/adaptive-practice?intent=practice');
    for (const card of visibleStudentView.actionCards) {
      const query = new URLSearchParams(card.href.split('?')[1] ?? '');
      expect(query.get('assignment')).toBe(submission.assignmentId);
      expect(query.get('criterion')).toBe(card.criterionId);
      expect(query.get('source')).toBe('document-feedback');
      expect(query.get('status')).toBe('returned');
      expect(query.get('returnTo')).toBe(`/assessment/document-feedback?gradingRunId=${encodeURIComponent(approved.id)}`);
      expect(query.get('action') ?? query.get('intent')).toBeTruthy();
    }
    expect(visibleStudentView.konlingEntryPoint?.mode).toBe('feedback-explainer');
    expect(visibleStudentView.konlingEntryPoint?.serverContext).toEqual(expect.objectContaining({
      gradingRunId: approved.id,
      assignmentId: submission.assignmentId,
    }));
    expect(otherStudentView.status).toBe('hidden-unapproved');
    expect(returnedDraftView.status).toBe('hidden-unapproved');
    expect(returnedEditedView.status).toBe('visible');
  });

  it('calculates rubric grading quality metrics from teacher review outcomes', async () => {
    const submission = asset();
    const converted = await convertSubmissionDocument({
      asset: submission,
      adapter: createMarkItDownConversionAdapter({
        now,
        preserveSpanMapping: true,
        runner: (documentAsset) => textFixtureMarkItDownRunner(documentAsset, true),
      }),
      now,
    });
    const draft = createDraftRubricGrading({ convertedDocument: converted, rubric: rubric(), now });
    const edited = approveGradingRun(editCriterionGrade(draft, {
      criterionId: 'validation',
      levelId: 'proficient',
      score: 3,
      comment: '教师下调验证充分性。',
      reviewerId: 'teacher-1',
      rubric: rubric(),
      now,
    }), { reviewerId: 'teacher-1', decision: 'approved', now });
    const blocked = createDraftRubricGrading({
      convertedDocument: converted,
      rubric: rubric(),
      evaluatorOutput: {
        evaluatorId: 'test-evaluator',
        evaluatorVersion: '2026.06',
        assessments: [],
      },
      now,
    });

    expect(calculateDocumentRubricGradingQualityMetrics([edited, draft, blocked])).toEqual({
      sampleSize: 3,
      approvedCount: 1,
      blockedEvaluatorOutputs: 1,
      feedbackCoverageRate: 0.333,
      teacherOverrideRate: 0.5,
      averageAiTeacherScoreDelta: 0.5,
      agreementRate: 0.5,
    });
  });

  it.each([0, -1, Number.POSITIVE_INFINITY, Number.NaN])('rejects a persisted rubric with invalid maxScore %s', (maxScore) => {
    expect(parsePersistedDocumentRubricGradingDraft({
      id: 'draft-invalid-rubric', ownerUserId: 'student-1', dedupeKey: 'dedupe', classId: 'class-1',
      sourceRefs: { asset: asset(), classId: 'class-1', assignmentId: 'assignment-1' },
      evidenceRefs: { convertedDocument: { id: 'converted-1' } },
      summary: { run: { id: 'run-1' }, rubric: { ...rubric(), maxScore } },
    } as any)).toBeNull();
  });

  it('parses persisted grading annotations for real teacher workbench views', async () => {
    const submission = asset();
    const converted = await convertSubmissionDocument({
      asset: submission,
      adapter: createMarkItDownConversionAdapter({
        now,
        preserveSpanMapping: true,
        runner: (documentAsset) => textFixtureMarkItDownRunner(documentAsset, true),
      }),
      now,
    });
    const draft = createDraftRubricGrading({ convertedDocument: converted, rubric: rubric(), now });
    const parsed = parsePersistedDocumentRubricGradingDraft({
      id: draft.id,
      ownerUserId: submission.studentId,
      dedupeKey: buildDocumentRubricDraftDedupeKey(submission, draft),
      classId: submission.classId,
      sourceRefs: {
        asset: submission,
        classId: submission.classId,
        assignmentId: submission.assignmentId,
        goalId: 'control-report',
        targetGoal: 'control-report',
      },
      evidenceRefs: {
        convertedDocument: converted,
      },
      summary: {
        run: draft,
        rubric: rubric(),
      },
    });

    expect(parsed?.run.annotations).toHaveLength(2);
    expect(parsed?.run.annotations[0]).toEqual(expect.objectContaining({
      id: 'annotation:modeling:block-1:1',
      criterionId: 'modeling',
      authorRole: 'ai-draft',
      reference: expect.objectContaining({
        convertedDocumentId: converted.id,
        precision: 'span',
      }),
    }));
    expect(buildTeacherGradingWorkbenchView({
      asset: parsed!.asset,
      convertedDocument: parsed!.convertedDocument,
      rubric: parsed!.rubric,
      run: parsed!.run,
    }).annotations).toHaveLength(2);

    const { annotations: _annotations, ...legacyRun } = draft;
    const legacyParsed = parsePersistedDocumentRubricGradingDraft({
      id: draft.id,
      ownerUserId: submission.studentId,
      dedupeKey: buildDocumentRubricDraftDedupeKey(submission, draft),
      classId: submission.classId,
      sourceRefs: {
        asset: submission,
        classId: submission.classId,
        assignmentId: submission.assignmentId,
      },
      evidenceRefs: {
        convertedDocument: converted,
      },
      summary: {
        run: legacyRun,
        rubric: rubric(),
      },
    });
    expect(legacyParsed?.run.annotations).toEqual([]);
  });
});
