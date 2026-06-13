import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';

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
      sourceEventId: `${approved.id}:validation:${approved.rubricVersion}`,
    }));
    expect(preview.dedupeKeys).toContain(`${approved.id}:validation:${approved.rubricVersion}`);
    expect(approved.approvedGrades.find((grade) => grade.criterionId === 'validation')?.score).toBe(4);
    expect(writeback.status).toBe('written');
    expect(writeback.created).toBe(2);
    expect(writeback.skipped).toBe(0);
    expect(writeback.blocked).toBe(0);
    expect(writeback.facts).toContainEqual(expect.objectContaining({
      userId: 'student-1',
      factType: 'document_rubric_grading',
      sourceEventId: `${approved.id}:validation:${approved.rubricVersion}`,
    }));
    expect(writeback.facts[0].contextJson.confidence).toBeLessThanOrEqual(0.92);
    expect(writeback.facts[0].contextJson).toEqual(expect.objectContaining({
      classId: 'class-1',
      assignmentId: 'report-1',
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
      now,
    });

    expect(writeback).toEqual(expect.objectContaining({
      status: 'written',
      created: 0,
      skipped: 2,
      blocked: 0,
    }));
    expect(writeback.facts.map((fact) => fact.sourceEventId)).toEqual(expect.arrayContaining([
      `${approved.id}:modeling:${approved.rubricVersion}`,
      `${approved.id}:validation:${approved.rubricVersion}`,
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
    expect(visibleStudentView.actionCards.find((card) => card.destinationType === 'resource')?.href)
      .toContain('/interactive-learning/resources/lesson09-correction-precheck');
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
      id: 'annotation:modeling:1',
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
