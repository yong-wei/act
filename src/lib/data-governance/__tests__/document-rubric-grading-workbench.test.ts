import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';

import {
  approveGradingRun,
  buildStudentGradingFeedbackView,
  buildTeacherGradingWorkbenchView,
  convertSubmissionDocument,
  createDraftRubricGrading,
  createMarkItDownConversionAdapter,
  createSubmissionAsset,
  editCriterionGrade,
  textFixtureMarkItDownRunner,
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
    expect(failed.warnings).toEqual(expect.arrayContaining(['markitdown-conversion-failed', 'retry-fallback']));
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
    expect(draft.draftGrades).toHaveLength(2);
    expect(draft.draftGrades[0].evidenceRefs[0]).toEqual(expect.objectContaining({
      convertedDocumentId: converted.id,
      precision: 'span',
      checksum: converted.checksum,
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
    })).resolves.toEqual({ status: 'blocked-unapproved', created: 0, facts: [] });
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

    expect(approved.status).toBe('approved');
    expect(approved.approvedGrades.find((grade) => grade.criterionId === 'validation')?.score).toBe(4);
    expect(writeback.status).toBe('written');
    expect(writeback.created).toBe(2);
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
    }));
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
    expect(visibleStudentView.konlingEntryPoint?.mode).toBe('feedback-explainer');
    expect(visibleStudentView.konlingEntryPoint?.serverContext).toEqual(expect.objectContaining({
      gradingRunId: approved.id,
      assignmentId: submission.assignmentId,
    }));
    expect(otherStudentView.status).toBe('hidden-unapproved');
    expect(returnedDraftView.status).toBe('hidden-unapproved');
    expect(returnedEditedView.status).toBe('visible');
  });
});
