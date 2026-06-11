import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  approveGradingRun,
  buildDocumentRubricDraftDedupeKey,
  convertSubmissionDocument,
  createDraftRubricGrading,
  createMarkItDownConversionAdapter,
  createSubmissionAsset,
  editCriterionGrade,
  textFixtureMarkItDownRunner,
  type ConvertedDocument,
  type DocumentRubricGradingRun,
  type DocumentSubmissionAsset,
  type RubricDefinition,
} from '../document-rubric-grading-workbench';
import {
  resolveKonlingTeachingAssistantScopeOverride,
  resolveKonlingTeachingAssistantServerModeContext,
} from '@/lib/konling-teaching-assistant-server-context';
import type { KonlingRuntimeContext, KonlingRuntimeScope } from '@/lib/konling-agent-runtime';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  prisma: {
    learningEvidenceDraft: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    class: {
      findUnique: vi.fn(),
    },
    studentProfile: {
      findFirst: vi.fn(),
    },
    teachingResource: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    learningFact: {
      createMany: vi.fn(),
    },
    studentEvidenceFeatureCache: {
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

import { POST as approvePOST } from '@/app/api/teacher/document-grading/approve/route';
import { POST as submissionPOST } from '@/app/api/teacher/document-grading/submissions/route';
import { POST as previewPOST } from '@/app/api/teacher/document-grading/writeback-preview/route';

const root = process.cwd();
const now = new Date('2026-06-04T08:00:00.000Z');

function source(path: string) {
  return readFileSync(join(root, path), 'utf8');
}

function postJson(body: unknown) {
  return approvePOST(new Request('http://localhost/api/teacher/document-grading/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

function postSubmissionJson(body: unknown) {
  return submissionPOST(new Request('http://localhost/api/teacher/document-grading/submissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

function postPreviewJson(body: unknown) {
  return previewPOST(new Request('http://localhost/api/teacher/document-grading/writeback-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
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
    ],
  };
}

async function gradingDraft() {
  const asset = createSubmissionAsset({
    id: 'asset-1',
    studentId: 'student-1',
    classId: 'class-1',
    assignmentId: 'report-1',
    fileName: 'root-locus-report.pdf',
    mimeType: 'application/pdf',
    bytes: 'Root locus design explains damping ratio and settling time.',
    uploadedAt: now.toISOString(),
  });
  const convertedDocument = await convertSubmissionDocument({
    asset,
    adapter: createMarkItDownConversionAdapter({
      now,
      preserveSpanMapping: true,
      runner: (submission) => textFixtureMarkItDownRunner(submission, true),
    }),
    now,
  });
  const draft = createDraftRubricGrading({ convertedDocument, rubric: rubric(), now });
  const run = editCriterionGrade(draft, {
    criterionId: 'modeling',
    levelId: 'advanced',
    score: 4,
    comment: '模型、指标和根轨迹解释完整。',
    reviewerId: 'teacher-1',
    now,
  });
  return persistedDraft({ asset, convertedDocument, run, rubric: rubric() });
}

function persistedDraft(input: {
  asset: DocumentSubmissionAsset;
  convertedDocument: ConvertedDocument;
  run: DocumentRubricGradingRun;
  rubric: RubricDefinition;
}) {
  return {
    id: input.run.id,
    ownerUserId: input.asset.studentId,
    sourceType: 'document_rubric_grading',
    sourceRefs: {
      asset: input.asset,
      classId: input.asset.classId,
      assignmentId: input.asset.assignmentId,
      goalId: 'control-report',
      targetGoal: 'control-report',
      learningGoal: 'control-report',
    },
    factType: 'document_rubric_grading',
    summary: {
      run: input.run,
      rubric: input.rubric,
    },
    evidenceRefs: {
      convertedDocument: input.convertedDocument,
    },
    provenance: {},
    confidence: 0.9,
    privacyScope: 'teacher_review',
    dedupeKey: buildDocumentRubricDraftDedupeKey(input.asset, input.run),
    reviewerState: 'pending',
    occurredAt: now,
    classId: input.asset.classId,
  };
}

function runtimeContext(): KonlingRuntimeContext {
  return {
    pageContext: {
      courseId: 'control-report',
      courseTitle: '控制报告',
      pageType: 'practice',
      stepId: 'document-grading',
      topic: '文档评分',
      learningObjectives: [],
      knowledgeType: 'X',
    },
    userProfile: {
      id: 'teacher-1',
      name: '教师',
      learningStyle: 'INTERACTIVE',
      cognitiveLevel: 4,
      abilityVector: {
        computational: 0.5,
        crossDomain: 0.5,
        design: 0.5,
        analysis: 0.5,
        evaluation: 0.5,
      },
    },
    learnerState: null,
    planContext: {
      currentPathId: null,
      activeNodeId: null,
      nextNodeIds: [],
      recentPathIds: [],
      completedNodeIds: [],
      status: 'missing',
    },
    memory: [],
    citationContext: {
      required: true,
      contentCitations: [],
      evidenceCitations: [],
      missingCitationClasses: [],
      lowConfidenceReasons: [],
      responseProtocol: {
        requiredOwners: ['answer'],
        minimum: { content: 1, evidenceWhenAvailable: 1 },
        fallbackWhenMissing: 'low-confidence',
      },
    },
    permittedTools: ['get_page_context', 'search_knowledge_graph'],
    missingContext: [],
    featureFlags: {
      learnerState: false,
      semanticMemory: false,
      strategyMemory: false,
    },
  };
}

function runtimeScope(overrides: Partial<KonlingRuntimeScope> = {}): KonlingRuntimeScope {
  return {
    authenticatedUserId: 'teacher-1',
    targetUserId: 'teacher-1',
    role: 'teacher',
    classId: 'class-1',
    courseId: 'control-report',
    pageId: 'document-grading',
    privacyScopes: ['teacher-scoped'],
    ...overrides,
  };
}

describe('document rubric grading routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.learningEvidenceDraft.findUnique.mockResolvedValue(null);
    mocks.prisma.learningEvidenceDraft.create.mockImplementation(async (input) => ({
      id: input.data.id,
      dedupeKey: input.data.dedupeKey,
      reviewerState: input.data.reviewerState,
    }));
    mocks.prisma.learningEvidenceDraft.update.mockImplementation(async (input) => ({
      id: input.where.id,
      dedupeKey: 'document-rubric:updated',
      reviewerState: input.data.reviewerState,
    }));
    mocks.prisma.learningFact.createMany.mockResolvedValue({ count: 1 });
    mocks.prisma.studentEvidenceFeatureCache.deleteMany.mockResolvedValue({ count: 1 });
    mocks.prisma.teachingResource.findFirst.mockResolvedValue(null);
  });

  it('creates persisted document grading submissions with conversion artifacts and draft assessment state', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-profile-1' });

    const response = await postSubmissionJson({
      studentId: 'student-1',
      classId: 'class-1',
      assignmentId: 'report-1',
      fileName: 'root-locus-report.md',
      mimeType: 'text/markdown',
      bytes: 'Root locus design explains damping ratio and settling time.',
      rubric: rubric(),
      goalId: 'control-report',
      targetGoal: 'control-report',
    });
    const payload = await response.json();
    const createInput = mocks.prisma.learningEvidenceDraft.create.mock.calls[0][0];

    expect(response.status).toBe(201);
    expect(payload).toEqual(expect.objectContaining({
      status: 'pending',
      gradingRunId: expect.stringContaining('grading:asset:student-1:report-1:'),
      teacherWorkbenchHref: expect.stringContaining('/teacher/grading-workbench?gradingRunId='),
      conversion: expect.objectContaining({
        adapter: 'markitdown',
        referencePrecision: 'span',
        warnings: [],
      }),
    }));
    expect(createInput.data).toEqual(expect.objectContaining({
      ownerUserId: 'student-1',
      sourceType: 'document_rubric_grading',
      factType: 'document_rubric_grading',
      privacyScope: 'teacher_review',
      reviewerState: 'pending',
      classId: 'class-1',
    }));
    expect(createInput.data.sourceRefs.asset).toEqual(expect.objectContaining({
      studentId: 'student-1',
      assignmentId: 'report-1',
      mimeType: 'text/markdown',
      checksum: expect.any(String),
    }));
    expect(createInput.data.evidenceRefs.convertedDocument).toEqual(expect.objectContaining({
      assetId: createInput.data.sourceRefs.asset.id,
      referencePrecision: 'span',
      warnings: [],
    }));
    expect(createInput.data.summary.run.draftGrades[0]).toEqual(expect.objectContaining({
      criterionId: 'modeling',
      evidenceRefs: expect.arrayContaining([
        expect.objectContaining({
          blockId: 'block-1',
          precision: 'span',
        }),
      ]),
    }));
    expect(createInput.data.provenance.conversion).toEqual(expect.objectContaining({
      status: 'converted',
      referencePrecision: 'span',
    }));
  });

  it('decodes base64 text submissions before conversion blocks and evidence excerpts are created', async () => {
    const text = 'Root locus design explains damping ratio and settling time.';
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-profile-1' });

    const response = await postSubmissionJson({
      studentId: 'student-1',
      classId: 'class-1',
      assignmentId: 'report-1',
      fileName: 'root-locus-report.md',
      mimeType: 'text/markdown',
      bytes: Buffer.from(text, 'utf8').toString('base64'),
      contentEncoding: 'base64',
      rubric: rubric(),
      goalId: 'control-report',
      targetGoal: 'control-report',
    });
    const createInput = mocks.prisma.learningEvidenceDraft.create.mock.calls[0][0];

    expect(response.status).toBe(201);
    expect(createInput.data.evidenceRefs.convertedDocument.blocks[0]).toEqual(expect.objectContaining({
      text,
      markdown: `- ${text}`,
      spanStart: 0,
      spanEnd: text.length,
    }));
    expect(createInput.data.summary.run.draftGrades[0].evidenceRefs[0]).toEqual(expect.objectContaining({
      excerpt: text,
      precision: 'span',
    }));
  });

  it('does not reset approved persisted grading drafts on duplicate submission processing', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-profile-1' });
    mocks.prisma.learningEvidenceDraft.findUnique.mockResolvedValue({
      id: 'grading:asset-1:rubric-control-report:2026.06',
      dedupeKey: 'document-rubric:asset-1:report-1:grading-1',
      ownerUserId: 'student-1',
      classId: 'class-1',
      sourceType: 'document_rubric_grading',
      reviewerState: 'approved',
    });

    const response = await postSubmissionJson({
      studentId: 'student-1',
      classId: 'class-1',
      assignmentId: 'report-1',
      fileName: 'root-locus-report.md',
      mimeType: 'text/markdown',
      bytes: 'Root locus design explains damping ratio and settling time.',
      rubric: rubric(),
      goalId: 'control-report',
      targetGoal: 'control-report',
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual(expect.objectContaining({
      status: 'approved',
      gradingRunId: 'grading:asset-1:rubric-control-report:2026.06',
      preservedReviewState: true,
    }));
    expect(mocks.prisma.learningEvidenceDraft.create).not.toHaveBeenCalled();
    expect(mocks.prisma.learningEvidenceDraft.update).not.toHaveBeenCalled();
  });

  it('rejects client-provided asset ids and mismatched pending dedupe owners', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-profile-1' });

    const assetIdResponse = await postSubmissionJson({
      assetId: 'asset:student-2:report-1:colliding',
      studentId: 'student-1',
      classId: 'class-1',
      assignmentId: 'report-1',
      fileName: 'root-locus-report.md',
      mimeType: 'text/markdown',
      bytes: 'Root locus design explains damping ratio.',
      rubric: rubric(),
    });
    expect(assetIdResponse.status).toBe(400);
    await expect(assetIdResponse.json()).resolves.toEqual({ error: '不允许客户端指定资产标识' });

    mocks.prisma.learningEvidenceDraft.findUnique.mockResolvedValue({
      id: 'grading:other',
      dedupeKey: 'document-rubric:other',
      ownerUserId: 'student-2',
      classId: 'class-1',
      sourceType: 'document_rubric_grading',
      reviewerState: 'pending',
    });
    const mismatchResponse = await postSubmissionJson({
      studentId: 'student-1',
      classId: 'class-1',
      assignmentId: 'report-1',
      fileName: 'root-locus-report.md',
      mimeType: 'text/markdown',
      bytes: 'Root locus design explains damping ratio.',
      rubric: rubric(),
    });

    expect(mismatchResponse.status).toBe(409);
    await expect(mismatchResponse.json()).resolves.toEqual({ error: '重复提交归属不一致' });
    expect(mocks.prisma.learningEvidenceDraft.create).not.toHaveBeenCalled();
    expect(mocks.prisma.learningEvidenceDraft.update).not.toHaveBeenCalled();
  });

  it('rejects incomplete rubric levels before draft grading is persisted', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });

    const response = await postSubmissionJson({
      studentId: 'student-1',
      classId: 'class-1',
      assignmentId: 'report-1',
      fileName: 'root-locus-report.md',
      mimeType: 'text/markdown',
      bytes: 'Root locus design explains damping ratio.',
      rubric: {
        ...rubric(),
        criteria: [{
          ...rubric().criteria[0],
          levels: [{}],
        }],
      },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: '缺少有效评分量规' });
    expect(mocks.prisma.class.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.learningEvidenceDraft.create).not.toHaveBeenCalled();
  });

  it('rejects unsupported rubric goal dimensions before draft grading is persisted', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });

    const response = await postSubmissionJson({
      studentId: 'student-1',
      classId: 'class-1',
      assignmentId: 'report-1',
      fileName: 'root-locus-report.md',
      mimeType: 'text/markdown',
      bytes: 'Root locus design explains damping ratio.',
      rubric: {
        ...rubric(),
        criteria: [{
          ...rubric().criteria[0],
          goalDimension: 'unsupported-dimension',
        }],
      },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: '缺少有效评分量规' });
    expect(mocks.prisma.class.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.learningEvidenceDraft.create).not.toHaveBeenCalled();
  });

  it('prevents students from providing or overriding grading rubrics', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });

    const response = await postSubmissionJson({
      studentId: 'student-1',
      classId: 'class-1',
      assignmentId: 'report-1',
      fileName: 'root-locus-report.md',
      mimeType: 'text/markdown',
      bytes: 'Root locus design explains damping ratio.',
      rubric: {
        ...rubric(),
        id: 'student-forged-rubric',
      },
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: '学生提交不能指定评分量规' });
    expect(mocks.prisma.class.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.learningEvidenceDraft.create).not.toHaveBeenCalled();
  });

  it('uses server assignment rubric for student submissions', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-profile-1' });
    mocks.prisma.teachingResource.findFirst.mockResolvedValue({
      config: {
        documentGrading: {
          rubric: {
            ...rubric(),
            id: 'server-rubric',
            version: 'server-v1',
          },
        },
      },
    });

    const response = await postSubmissionJson({
      studentId: 'student-1',
      classId: 'class-1',
      assignmentId: 'report-1',
      fileName: 'root-locus-report.md',
      mimeType: 'text/markdown',
      bytes: 'Root locus design explains damping ratio.',
    });
    const createInput = mocks.prisma.learningEvidenceDraft.create.mock.calls[0][0];

    expect(response.status).toBe(201);
    expect(mocks.prisma.teachingResource.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'report-1',
        teacherOnly: false,
      },
      select: {
        config: true,
      },
    });
    expect(createInput.data.summary.rubric).toEqual(expect.objectContaining({
      id: 'server-rubric',
      version: 'server-v1',
    }));
    expect(createInput.data.summary.run).toEqual(expect.objectContaining({
      rubricId: 'server-rubric',
      rubricVersion: 'server-v1',
    }));
  });

  it('rejects student submissions when the assignment has no server rubric', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-profile-1' });
    mocks.prisma.teachingResource.findFirst.mockResolvedValue({ config: {} });

    const response = await postSubmissionJson({
      studentId: 'student-1',
      classId: 'class-1',
      assignmentId: 'report-1',
      fileName: 'root-locus-report.md',
      mimeType: 'text/markdown',
      bytes: 'Root locus design explains damping ratio.',
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ error: '作业未配置服务端评分量规' });
    expect(mocks.prisma.learningEvidenceDraft.create).not.toHaveBeenCalled();
  });

  it('enforces ownership and class scope for submission creation', async () => {
    mocks.getServerAuthSession.mockResolvedValueOnce(null);
    expect((await postSubmissionJson({})).status).toBe(401);

    mocks.getServerAuthSession.mockResolvedValueOnce({ user: { id: 'student-2', role: 'STUDENT' } });
    mocks.prisma.class.findUnique.mockResolvedValueOnce({ id: 'class-1', teacherId: 'teacher-1' });
    const wrongStudentResponse = await postSubmissionJson({
      studentId: 'student-1',
      classId: 'class-1',
      assignmentId: 'report-1',
      fileName: 'root-locus-report.md',
      mimeType: 'text/markdown',
      bytes: 'Root locus design explains damping ratio.',
      rubric: rubric(),
    });
    expect(wrongStudentResponse.status).toBe(403);

    mocks.getServerAuthSession.mockResolvedValueOnce({ user: { id: 'teacher-2', role: 'TEACHER' } });
    mocks.prisma.class.findUnique.mockResolvedValueOnce({ id: 'class-1', teacherId: 'teacher-1' });
    const wrongTeacherResponse = await postSubmissionJson({
      studentId: 'student-1',
      classId: 'class-1',
      assignmentId: 'report-1',
      fileName: 'root-locus-report.md',
      mimeType: 'text/markdown',
      bytes: 'Root locus design explains damping ratio.',
      rubric: rubric(),
    });
    expect(wrongTeacherResponse.status).toBe(403);
    expect(mocks.prisma.learningEvidenceDraft.create).not.toHaveBeenCalled();
    expect(mocks.prisma.learningEvidenceDraft.update).not.toHaveBeenCalled();
  });

  it('protects student document feedback with session and student-role gates', () => {
    const page = source('src/app/assessment/document-feedback/page.tsx');

    expect(page).toContain('getServerAuthSession');
    expect(page).toContain("redirect('/login')");
    expect(page).toContain('UserRole.STUDENT');
    expect(page).toContain('validateDocumentRubricGradingDraftInvariants');
    expect(page).toContain('&& valid');
    expect(page).toContain('createHiddenStudentGradingFeedbackView');
    expect(page).not.toContain('viewerStudentId: asset.studentId');
  });

  it('resolves document grading assistant server context from an authorized persisted draft', async () => {
    const draft = await gradingDraft();
    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValue(draft);
    mocks.prisma.class.findUnique.mockResolvedValue({ teacherId: 'teacher-1' });

    await expect(resolveKonlingTeachingAssistantServerModeContext({
      db: mocks.prisma,
      modeId: 'grading-assistant',
      runtimeContext: runtimeContext(),
      scope: runtimeScope({ targetUserId: 'student-1' }),
      clientContextHints: {
        gradingRunId: draft.id,
        rubric: true,
      },
    })).resolves.toEqual(expect.objectContaining({
      rubric: true,
      'converted-document': true,
      'draft-grading-state': true,
      'teacher-review-state': true,
    }));

    mocks.prisma.class.findUnique.mockResolvedValue({ teacherId: 'teacher-2' });
    await expect(resolveKonlingTeachingAssistantServerModeContext({
      db: mocks.prisma,
      modeId: 'grading-assistant',
      runtimeContext: runtimeContext(),
      scope: runtimeScope({ targetUserId: 'student-1' }),
      clientContextHints: {
        gradingRunId: draft.id,
      },
    })).resolves.toEqual({});

    mocks.prisma.class.findUnique.mockResolvedValue({ teacherId: 'teacher-1' });
    await expect(resolveKonlingTeachingAssistantScopeOverride({
      db: mocks.prisma,
      modeId: 'grading-assistant',
      authenticatedUserId: 'teacher-1',
      role: 'TEACHER',
      clientContextHints: {
        gradingRunId: draft.id,
      },
    })).resolves.toEqual({
      targetUserId: 'student-1',
      classId: 'class-1',
    });
  });

  it('resolves grading assistant runtime scope to the graded student only after teacher authorization', async () => {
    const draft = await gradingDraft();
    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValue(draft);
    mocks.prisma.class.findUnique.mockResolvedValue({ teacherId: 'teacher-1' });

    await expect(resolveKonlingTeachingAssistantScopeOverride({
      db: mocks.prisma,
      modeId: 'grading-assistant',
      authenticatedUserId: 'teacher-1',
      role: 'TEACHER',
      clientContextHints: {
        gradingRunId: draft.id,
      },
    })).resolves.toEqual({
      targetUserId: 'student-1',
      classId: 'class-1',
    });

    mocks.prisma.class.findUnique.mockResolvedValue({ teacherId: 'teacher-2' });
    await expect(resolveKonlingTeachingAssistantScopeOverride({
      db: mocks.prisma,
      modeId: 'grading-assistant',
      authenticatedUserId: 'teacher-1',
      role: 'TEACHER',
      clientContextHints: {
        gradingRunId: draft.id,
      },
    })).resolves.toEqual({});
  });

  it('renders evidence capsules, Konling entry points, and a real approval action in UI surfaces', () => {
    const ui = source('src/features/assessment/document-rubric-grading-ui.tsx');
    const action = source('src/features/assessment/document-rubric-grading-actions.tsx');
    const teacherPage = source('src/app/teacher/grading-workbench/page.tsx');

    expect(ui).toContain('view.evidenceCapsules.map');
    expect(ui).toContain('view.konlingEntryPoint.promptContext');
    expect(action).toContain('/api/teacher/document-grading/approve');
    expect(action).toContain('JSON.stringify({ gradingRunId');
    expect(teacherPage).toContain('validateDocumentRubricGradingDraftInvariants');
    expect(teacherPage).toContain('if (!invariants.valid)');
    expect(teacherPage).toContain('prisma.studentProfile.findFirst');
  });

  it('rejects anonymous, student, and malformed approval requests', async () => {
    mocks.getServerAuthSession.mockResolvedValueOnce(null);
    expect((await postJson({ gradingRunId: 'grading-1' })).status).toBe(401);

    mocks.getServerAuthSession.mockResolvedValueOnce({ user: { id: 'student-1', role: 'STUDENT' } });
    expect((await postJson({ gradingRunId: 'grading-1' })).status).toBe(403);

    mocks.getServerAuthSession.mockResolvedValueOnce({ user: { id: 'teacher-1', role: 'TEACHER' } });
    expect((await postJson({})).status).toBe(400);

    mocks.getServerAuthSession.mockResolvedValueOnce({ user: { id: 'teacher-1', role: 'TEACHER' } });
    expect((await postJson({ gradingRunId: 'grading-1', decision: 'publish' })).status).toBe(400);
  });

  it('rejects teacher approval outside the class scope', async () => {
    const draft = await gradingDraft();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-2', role: 'TEACHER' } });
    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValue(draft);
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });

    const response = await postJson({ gradingRunId: draft.id });

    expect(response.status).toBe(403);
    expect(mocks.prisma.learningFact.createMany).not.toHaveBeenCalled();
  });

  it('rejects persisted drafts with forged nested ownership or object references', async () => {
    const draft = await gradingDraft();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-profile-1' });

    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValueOnce({
      ...draft,
      id: 'forged-run-id',
    });
    const forgedDraftRunResponse = await postJson({ gradingRunId: draft.id });
    expect(forgedDraftRunResponse.status).toBe(422);
    expect(await forgedDraftRunResponse.json()).toEqual(expect.objectContaining({
      reasons: expect.arrayContaining(['draft-run-id-mismatch']),
    }));

    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValueOnce({
      ...draft,
      ownerUserId: 'student-forged',
    });
    const forgedOwnerResponse = await postJson({ gradingRunId: draft.id });
    expect(forgedOwnerResponse.status).toBe(422);
    expect(await forgedOwnerResponse.json()).toEqual(expect.objectContaining({
      reasons: expect.arrayContaining(['draft-owner-user-mismatch']),
    }));

    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValueOnce({
      ...draft,
      summary: {
        ...draft.summary,
        run: {
          ...draft.summary.run,
          assetId: 'asset-forged',
        },
      },
    });
    const forgedRunResponse = await postJson({ gradingRunId: draft.id });
    expect(forgedRunResponse.status).toBe(422);
    expect(await forgedRunResponse.json()).toEqual(expect.objectContaining({
      reasons: expect.arrayContaining(['run-asset-mismatch']),
    }));

    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValueOnce({
      ...draft,
      sourceRefs: {
        ...draft.sourceRefs,
        classId: 'class-forged',
      },
    });
    const forgedClassResponse = await postJson({ gradingRunId: draft.id });
    expect(forgedClassResponse.status).toBe(422);
    expect(await forgedClassResponse.json()).toEqual(expect.objectContaining({
      reasons: expect.arrayContaining(['goal-context-class-asset-class-mismatch']),
    }));

    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValueOnce({
      ...draft,
      sourceRefs: {
        ...draft.sourceRefs,
        assignmentId: 'assignment-forged',
      },
    });
    const forgedAssignmentResponse = await postJson({ gradingRunId: draft.id });
    expect(forgedAssignmentResponse.status).toBe(422);
    expect(await forgedAssignmentResponse.json()).toEqual(expect.objectContaining({
      reasons: expect.arrayContaining(['goal-context-assignment-asset-assignment-mismatch']),
    }));

    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValueOnce({
      ...draft,
      sourceRefs: {
        ...draft.sourceRefs,
        assignmentId: 'assignment-forged',
        asset: {
          ...draft.sourceRefs.asset,
          assignmentId: 'assignment-forged',
        },
      },
    });
    const forgedConsistentAssignmentResponse = await postJson({ gradingRunId: draft.id });
    expect(forgedConsistentAssignmentResponse.status).toBe(422);
    expect(await forgedConsistentAssignmentResponse.json()).toEqual(expect.objectContaining({
      reasons: expect.arrayContaining(['draft-dedupe-key-mismatch']),
    }));

    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValueOnce({
      ...draft,
      sourceRefs: {
        ...draft.sourceRefs,
        assignmentId: 'report',
        asset: {
          ...draft.sourceRefs.asset,
          assignmentId: 'report',
        },
      },
    });
    const forgedSubstringAssignmentResponse = await postJson({ gradingRunId: draft.id });
    expect(forgedSubstringAssignmentResponse.status).toBe(422);
    expect(await forgedSubstringAssignmentResponse.json()).toEqual(expect.objectContaining({
      reasons: expect.arrayContaining(['draft-dedupe-key-mismatch']),
    }));

    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValueOnce({
      ...draft,
      evidenceRefs: {
        ...draft.evidenceRefs,
        convertedDocument: {
          ...draft.evidenceRefs.convertedDocument,
          assetId: 'asset-forged',
        },
      },
    });
    const forgedConvertedResponse = await postJson({ gradingRunId: draft.id });
    expect(forgedConvertedResponse.status).toBe(422);
    expect(await forgedConvertedResponse.json()).toEqual(expect.objectContaining({
      reasons: expect.arrayContaining(['converted-asset-mismatch']),
    }));

    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValueOnce({
      ...draft,
      evidenceRefs: {
        ...draft.evidenceRefs,
        convertedDocument: {
          ...draft.evidenceRefs.convertedDocument,
          checksum: 'forged-checksum',
        },
      },
    });
    const forgedChecksumResponse = await postJson({ gradingRunId: draft.id });
    expect(forgedChecksumResponse.status).toBe(422);
    expect(await forgedChecksumResponse.json()).toEqual(expect.objectContaining({
      reasons: expect.arrayContaining(['converted-asset-checksum-mismatch']),
    }));

    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValueOnce({
      ...draft,
      evidenceRefs: {
        ...draft.evidenceRefs,
        convertedDocument: {
          ...draft.evidenceRefs.convertedDocument,
          markdown: '- FORGED PREVIEW NOT FROM ASSET',
          blocks: draft.evidenceRefs.convertedDocument.blocks.map((block) => ({
            ...block,
            text: 'FORGED PREVIEW NOT FROM ASSET',
            markdown: '- FORGED PREVIEW NOT FROM ASSET',
          })),
        },
      },
      summary: {
        ...draft.summary,
        run: {
          ...draft.summary.run,
          draftGrades: draft.summary.run.draftGrades.map((grade: DocumentRubricGradingRun['draftGrades'][number]) => ({
            ...grade,
            evidenceRefs: grade.evidenceRefs.map((ref) => ({
              ...ref,
              excerpt: 'FORGED PREVIEW NOT FROM ASSET',
            })),
          })),
        },
      },
    });
    const forgedConvertedBlockResponse = await postJson({ gradingRunId: draft.id });
    expect(forgedConvertedBlockResponse.status).toBe(422);
    expect(await forgedConvertedBlockResponse.json()).toEqual(expect.objectContaining({
      reasons: expect.arrayContaining(['converted-block-source-mismatch']),
    }));

    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValueOnce({
      ...draft,
      evidenceRefs: {
        ...draft.evidenceRefs,
        convertedDocument: {
          ...draft.evidenceRefs.convertedDocument,
          markdown: 'FORGED PREVIEW NOT FROM ASSET',
        },
      },
    });
    const forgedMarkdownOnlyResponse = await postJson({ gradingRunId: draft.id });
    expect(forgedMarkdownOnlyResponse.status).toBe(422);
    expect(await forgedMarkdownOnlyResponse.json()).toEqual(expect.objectContaining({
      reasons: expect.arrayContaining(['converted-markdown-blocks-mismatch']),
    }));

    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValueOnce({
      ...draft,
      summary: {
        ...draft.summary,
        run: {
          ...draft.summary.run,
          draftGrades: draft.summary.run.draftGrades.map((grade: DocumentRubricGradingRun['draftGrades'][number]) => ({
            ...grade,
            evidenceRefs: grade.evidenceRefs.map((ref) => ({
              ...ref,
              convertedDocumentId: 'converted-forged',
            })),
          })),
        },
      },
    });
    const forgedEvidenceDocumentResponse = await postJson({ gradingRunId: draft.id });
    expect(forgedEvidenceDocumentResponse.status).toBe(422);
    expect(await forgedEvidenceDocumentResponse.json()).toEqual(expect.objectContaining({
      reasons: expect.arrayContaining(['evidence-converted-document-mismatch']),
    }));

    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValueOnce({
      ...draft,
      summary: {
        ...draft.summary,
        run: {
          ...draft.summary.run,
          draftGrades: draft.summary.run.draftGrades.map((grade: DocumentRubricGradingRun['draftGrades'][number]) => ({
            ...grade,
            evidenceRefs: grade.evidenceRefs.map((ref) => ({
              ...ref,
              checksum: 'forged-checksum',
            })),
          })),
        },
      },
    });
    const forgedEvidenceChecksumResponse = await postJson({ gradingRunId: draft.id });
    expect(forgedEvidenceChecksumResponse.status).toBe(422);
    expect(await forgedEvidenceChecksumResponse.json()).toEqual(expect.objectContaining({
      reasons: expect.arrayContaining(['evidence-checksum-mismatch']),
    }));

    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValueOnce({
      ...draft,
      summary: {
        ...draft.summary,
        run: {
          ...draft.summary.run,
          draftGrades: draft.summary.run.draftGrades.map((grade: DocumentRubricGradingRun['draftGrades'][number]) => ({
            ...grade,
            evidenceRefs: grade.evidenceRefs.map((ref) => ({
              ...ref,
              blockId: 'forged-block',
            })),
          })),
        },
      },
    });
    const forgedEvidenceResponse = await postJson({ gradingRunId: draft.id });
    expect(forgedEvidenceResponse.status).toBe(422);
    expect(await forgedEvidenceResponse.json()).toEqual(expect.objectContaining({
      reasons: expect.arrayContaining(['evidence-block-mismatch']),
    }));

    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValueOnce({
      ...draft,
      summary: {
        ...draft.summary,
        run: {
          ...draft.summary.run,
          draftGrades: draft.summary.run.draftGrades.map((grade: DocumentRubricGradingRun['draftGrades'][number]) => ({
            ...grade,
            evidenceRefs: grade.evidenceRefs.map((ref) => ({
              ...ref,
              excerpt: 'FORGED EVIDENCE TEXT NOT IN BLOCK',
            })),
          })),
        },
      },
    });
    const forgedEvidenceExcerptResponse = await postJson({ gradingRunId: draft.id });
    expect(forgedEvidenceExcerptResponse.status).toBe(422);
    expect(await forgedEvidenceExcerptResponse.json()).toEqual(expect.objectContaining({
      reasons: expect.arrayContaining(['evidence-excerpt-mismatch']),
    }));

    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValueOnce({
      ...draft,
      summary: {
        ...draft.summary,
        run: {
          ...draft.summary.run,
          draftGrades: draft.summary.run.draftGrades.map((grade: DocumentRubricGradingRun['draftGrades'][number]) => ({
            ...grade,
            evidenceRefs: grade.evidenceRefs.map((ref) => ({
              ...ref,
              pageNumber: 99,
            })),
          })),
        },
      },
    });
    const forgedEvidencePageResponse = await postJson({ gradingRunId: draft.id });
    expect(forgedEvidencePageResponse.status).toBe(422);
    expect(await forgedEvidencePageResponse.json()).toEqual(expect.objectContaining({
      reasons: expect.arrayContaining(['evidence-page-mismatch']),
    }));

    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValueOnce({
      ...draft,
      summary: {
        ...draft.summary,
        run: {
          ...draft.summary.run,
          draftGrades: draft.summary.run.draftGrades.map((grade: DocumentRubricGradingRun['draftGrades'][number]) => ({
            ...grade,
            evidenceRefs: grade.evidenceRefs.map((ref) => ({
              ...ref,
              precision: 'span',
            })),
          })),
        },
      },
      evidenceRefs: {
        ...draft.evidenceRefs,
        convertedDocument: {
          ...draft.evidenceRefs.convertedDocument,
          referencePrecision: 'block',
          blocks: draft.evidenceRefs.convertedDocument.blocks.map((block) => ({
            ...block,
            spanStart: undefined,
            spanEnd: undefined,
          })),
        },
      },
    });
    const forgedEvidencePrecisionResponse = await postJson({ gradingRunId: draft.id });
    expect(forgedEvidencePrecisionResponse.status).toBe(422);
    expect(await forgedEvidencePrecisionResponse.json()).toEqual(expect.objectContaining({
      reasons: expect.arrayContaining(['evidence-precision-mismatch']),
    }));

    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValueOnce({
      ...draft,
      summary: {
        ...draft.summary,
        run: {
          ...draft.summary.run,
          draftGrades: [
            ...draft.summary.run.draftGrades,
            {
              ...draft.summary.run.draftGrades[0],
              criterionId: 'forged-criterion',
              score: 99,
              profileWritebackCandidate: {
                goalDimension: 'engineeringDecision',
                contribution: 10,
                confidence: 1,
              },
            },
          ],
        },
      },
    });
    const forgedCriterionResponse = await postJson({ gradingRunId: draft.id });
    expect(forgedCriterionResponse.status).toBe(422);
    expect(await forgedCriterionResponse.json()).toEqual(expect.objectContaining({
      reasons: expect.arrayContaining(['grade-criterion-mismatch']),
    }));

    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValueOnce({
      ...draft,
      summary: {
        ...draft.summary,
        run: {
          ...draft.summary.run,
          rubricVersion: 'forged-version',
        },
      },
    });
    const forgedRubricResponse = await postJson({ gradingRunId: draft.id });
    expect(forgedRubricResponse.status).toBe(422);
    expect(await forgedRubricResponse.json()).toEqual(expect.objectContaining({
      reasons: expect.arrayContaining(['run-rubric-mismatch']),
    }));
    expect(mocks.prisma.learningFact.createMany).not.toHaveBeenCalled();
  });

  it('approves persisted grading runs and writes governed learning facts', async () => {
    const draft = await gradingDraft();
    const expectedRun = approveGradingRun(draft.summary.run, {
      reviewerId: 'teacher-1',
      decision: 'approved',
      now,
    });
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValue(draft);
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-profile-1' });

    const response = await postJson({
      gradingRunId: draft.id,
      run: { assetId: 'client-forged-asset' },
      rubric: { id: 'client-forged-rubric' },
      studentId: 'client-forged-student',
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual(expect.objectContaining({
      status: 'approved',
      gradingRunId: expectedRun.id,
      createdFacts: 1,
    }));
    expect(mocks.prisma.learningFact.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: expect.arrayContaining([
        expect.objectContaining({
          userId: 'student-1',
          factType: 'document_rubric_grading',
          competencyContribution: { controlModeling: expect.any(Number) },
          contextJson: expect.objectContaining({
            classId: 'class-1',
            assignmentId: 'report-1',
            goalId: 'control-report',
          }),
        }),
      ]),
    }));
    expect(mocks.prisma.studentEvidenceFeatureCache.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'student-1' },
    });
    expect(mocks.prisma.learningEvidenceDraft.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: draft.id },
      data: expect.objectContaining({ reviewerState: 'approved' }),
    }));
  });

  it('applies teacher criterion edits before approval writeback', async () => {
    const draft = await gradingDraft();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValue(draft);
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-profile-1' });

    const response = await postJson({
      gradingRunId: draft.id,
      decision: 'approved',
      edits: [{
        criterionId: 'modeling',
        levelId: 'novice',
        score: 1,
        comment: '教师修订：模型表达达标，但需要补充稳定裕度解释。',
      }],
    });
    const updateInput = mocks.prisma.learningEvidenceDraft.update.mock.calls[0][0];

    expect(response.status).toBe(200);
    expect(mocks.prisma.learningFact.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([
        expect.objectContaining({
          score: 1,
          competencyContribution: { controlModeling: 0.1 },
          sourceEventId: `${draft.id}:modeling:${draft.summary.run.rubricVersion}`,
        }),
      ]),
    }));
    expect(updateInput.data.summary.run.approvedGrades[0]).toEqual(expect.objectContaining({
      criterionId: 'modeling',
      levelId: 'novice',
      score: 1,
      comment: '教师修订：模型表达达标，但需要补充稳定裕度解释。',
      profileWritebackCandidate: expect.objectContaining({
        contribution: 0.1,
      }),
    }));
    expect(updateInput.data.summary.run.annotations).toContainEqual(expect.objectContaining({
      criterionId: 'modeling',
      authorRole: 'teacher',
      comment: '教师修订：模型表达达标，但需要补充稳定裕度解释。',
    }));
  });

  it('rejects teacher edits with rubric-out-of-range scores before writeback', async () => {
    const draft = await gradingDraft();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValue(draft);
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-profile-1' });

    const response = await postJson({
      gradingRunId: draft.id,
      decision: 'approved',
      edits: [{
        criterionId: 'modeling',
        levelId: 'advanced',
        score: 99,
        comment: '非法越界分数。',
      }],
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: '评分编辑分数超出量规范围' });
    expect(mocks.prisma.learningFact.createMany).not.toHaveBeenCalled();
    expect(mocks.prisma.learningEvidenceDraft.update).not.toHaveBeenCalled();
  });

  it('rejects edits against already approved grading runs without repeating writeback', async () => {
    const draft = await gradingDraft();
    const approved = approveGradingRun(draft.summary.run, {
      reviewerId: 'teacher-1',
      decision: 'approved',
      now,
    });
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValue({
      ...draft,
      summary: {
        ...draft.summary,
        run: approved,
      },
      reviewerState: 'approved',
    });
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-profile-1' });

    const response = await postJson({
      gradingRunId: draft.id,
      decision: 'approved',
      edits: [{
        criterionId: 'modeling',
        levelId: 'advanced',
        score: 4,
        comment: '试图在已批准评分上直接修改。',
      }],
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: '已批准评分不能直接编辑' });
    expect(mocks.prisma.learningFact.createMany).not.toHaveBeenCalled();
    expect(mocks.prisma.learningEvidenceDraft.update).not.toHaveBeenCalled();
  });

  it('previews approved writeback effects without creating learning facts', async () => {
    const draft = await gradingDraft();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValue(draft);
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-profile-1' });

    const response = await postPreviewJson({ gradingRunId: draft.id });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual(expect.objectContaining({
      status: 'preview',
      gradingRunId: draft.id,
      wouldCreateFacts: 1,
      blockedFacts: 0,
      evidenceSourceEventIds: expect.arrayContaining([
        `${draft.id}:modeling:${draft.summary.run.rubricVersion}`,
      ]),
      dedupeKeys: expect.arrayContaining([
        `${draft.id}:modeling:${draft.summary.run.rubricVersion}`,
      ]),
    }));
    expect(payload.affectedDimensions[0]).toEqual(expect.objectContaining({
      criterionId: 'modeling',
      competencyDimension: 'controlModeling',
      sourceEventId: `${draft.id}:modeling:${draft.summary.run.rubricVersion}`,
    }));
    expect(mocks.prisma.learningFact.createMany).not.toHaveBeenCalled();
    expect(mocks.prisma.learningEvidenceDraft.update).not.toHaveBeenCalled();
  });

  it('accepts base64 text submissions after decoding before block source validation', async () => {
    const text = 'Root locus design explains damping ratio and settling time.';
    const asset = createSubmissionAsset({
      id: 'asset-base64',
      studentId: 'student-1',
      classId: 'class-1',
      assignmentId: 'report-base64',
      fileName: 'base64-report.md',
      mimeType: 'text/markdown',
      bytes: Buffer.from(text, 'utf8').toString('base64'),
      contentEncoding: 'base64',
      uploadedAt: now.toISOString(),
    });
    const convertedDocument = await convertSubmissionDocument({
      asset,
      adapter: createMarkItDownConversionAdapter({
        now,
        preserveSpanMapping: true,
        runner: async () => ({
          markdown: `- ${text}`,
          referencePrecision: 'span',
          warnings: [],
          blocks: [{
            text,
            markdown: `- ${text}`,
            pageNumber: 1,
            confidence: 0.92,
            spanStart: 0,
            spanEnd: text.length,
          }],
        }),
      }),
      now,
    });
    const run = createDraftRubricGrading({ convertedDocument, rubric: rubric(), now });
    const draft = persistedDraft({ asset, convertedDocument, run, rubric: rubric() });
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValue(draft);
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-profile-1' });

    const response = await postJson({ gradingRunId: draft.id });

    expect(response.status).toBe(200);
    expect(mocks.prisma.learningFact.createMany).toHaveBeenCalled();
  });
});
