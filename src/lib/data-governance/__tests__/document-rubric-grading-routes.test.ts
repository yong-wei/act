import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

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
import { sha256, stableStringify } from '../math-document-grading-contracts';
import { assertPipelineReviewActor, buildPipelineReviewFacts, validatePipelineReviewContract } from '../math-document-grading-review';
import { calculateCompetencyVector } from '../competency-engine';
import { mapLearningFactsToPortraitEvidence } from '../portrait-v2-incremental-update';
import { getLocalTestSubmissionObjectStore } from '@/lib/assignments/submission-object-store';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
    learningEvidenceDraft: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    gradingRun: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    gradingAuditEvent: {
      create: vi.fn(),
    },
    gradingRequestIdempotency: {
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    gradingCriterionAssessment: {
      updateMany: vi.fn(),
    },
    assignmentRevision: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    class: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    studentProfile: {
      findFirst: vi.fn(),
    },
    teachingResource: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    learningFact: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    studentEvidenceFeatureCache: {
      deleteMany: vi.fn(),
    },
    learningMaterializationRebuildRequest: {
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
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
import { GET as gradingListGET } from '@/app/api/teacher/document-grading/pipeline/grading/route';

const root = process.cwd();
const now = new Date('2026-06-04T08:00:00.000Z');

function source(path: string) {
  return readFileSync(join(root, path), 'utf8');
}

function postJson(body: unknown, origin: string | null = 'http://localhost') {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (origin !== null) headers.set('Origin', origin);
  return approvePOST(new Request('http://localhost/api/teacher/document-grading/approve', {
    method: 'POST',
    headers,
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
    updatedAt: now,
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

function pipelineRun() {
  const criteria = [
    { id: 'controlModeling', label: '模型', goalDimension: 'controlModeling', maxPoints: 4, evidenceDescription: '', feedbackGuidance: '', levels: [{ id: 'full-model', label: '满分', minPoints: 4, maxPoints: 4, description: '' }] },
    { id: 'custom-proof', label: '自定义证明', goalDimension: 'engineeringDecision', maxPoints: 6, evidenceDescription: '', feedbackGuidance: '', levels: [{ id: 'full-proof', label: '满分', minPoints: 6, maxPoints: 6, description: '' }] },
  ];
  const rubric = { schemaVersion: 'assignment-analytic-rubric.v1', id: 'rubric:question-1', version: 'sha256:question', maxScore: 10, criteria };
  const revision = () => ({ id: 'revision-1', assignmentId: 'assignment-1', assignment: { id: 'assignment-1', authorId: 'teacher-author', courseContext: 'course-control' } });
  const question = { id: 'question-1', assignmentRevisionId: 'revision-1', stableQuestionId: 'q1', responseType: 'SUBJECTIVE_TEXT', promptSnapshot: { text: 'Explain.' }, answerSnapshot: { text: 'Reference.' }, rubricSnapshot: rubric, contentHash: 'sha256:question', revision: revision() };
  const run: any = {
    id: 'pipeline-run-1', state: 'AWAITING_REVIEW', teacherReviewedAt: null, questionId: 'question-1', answerAttemptId: 'attempt-1', answerEvidenceId: 'evidence-1', questionSnapshotHash: 'sha256:question',
    rubricId: rubric.id, rubricVersion: rubric.version, evaluatorId: 'evaluator-1', evaluatorVersion: 'eval-v1', idempotencyKey: 'idem-1', createdAt: now, updatedAt: now,
    questionSnapshot: { assignmentRevisionId: 'revision-1', questionId: 'question-1', stableQuestionId: 'q1', responseType: 'SUBJECTIVE_TEXT', prompt: 'Explain.', referenceAnswer: 'Reference.', rubric, contentHash: 'sha256:question' },
    rubricSnapshot: structuredClone(rubric),
    assessments: [
      { id: 'a1', criterionId: 'controlModeling', levelId: 'full-model', score: 4, rationale: 'model', confidence: 0.9, limitationState: 'none' },
      { id: 'a2', criterionId: 'custom-proof', levelId: 'full-proof', score: 6, rationale: 'proof', confidence: 0.8, limitationState: 'none' },
    ],
    annotations: [{ id: 'ann-1', assessmentId: 'a1', criterionId: 'controlModeling', blockId: 'block-1', precision: 'SPAN', authorRole: 'AI_DRAFT', excerpt: '受治理', spanStart: 0, spanEnd: 3, comment: 'anchor' }, { id: 'ann-2', assessmentId: 'a2', criterionId: 'custom-proof', blockId: 'block-1', precision: 'SPAN', authorRole: 'AI_DRAFT', excerpt: '正文', spanStart: 3, spanEnd: 5, comment: 'anchor' }],
    answerEvidence: { id: 'evidence-1', attemptId: 'attempt-1', sourceKind: 'DOCUMENT', sourceAssetId: 'asset-1', conversionId: 'conversion-1', sourceHash: 'sha256:evidence', canonicalMarkdown: '受治理正文', precision: 'SPAN', readiness: 'READY', limitations: [], blocks: [{ id: 'block-1', text: '受治理正文', markdown: '受治理正文', confidence: 0.9, sourceHash: 'sha256:block', precision: 'SPAN', spanStart: 0, spanEnd: 5, pageNumber: null }], sourceAsset: { id: 'asset-1', answerId: 'answer-1', attemptId: 'attempt-1', objectKey: 'submissions/asset-1', state: 'FINALIZED', scanState: 'CLEAN', lifecycleBlockedAt: null, tombstonedAt: null, deletionIntentAt: null, originalName: 'answer.pdf', mimeType: 'application/pdf', checksum: 'sha256:asset' }, conversion: { id: 'conversion-1', attemptId: 'attempt-1', assetId: 'asset-1', state: 'SUCCEEDED', lifecycleBlockedAt: null, canonicalMarkdown: '受治理正文', outputChecksum: sha256('受治理正文'), adapter: 'markitdown', warningCodes: [] } },
    answerAttempt: { id: 'attempt-1', answerId: 'answer-1', submittedAt: now, answer: { id: 'answer-1', assignmentQuestionId: 'question-1', submission: { studentId: 'student-1', assignmentRevisionId: 'revision-1', frozenStudentId: 'student-1', frozenAudienceClassId: 'class-1', revision: revision(), audience: { assignmentRevisionId: 'revision-1', classId: 'class-1', revision: revision(), class: { teacherId: 'teacher-1' } } } } },
    question,
    lifecyclePolicyVersion: 'retention.v1', lifecycleDeleteStrategy: 'retain-governed-record', lifecycleGovernedRecordRule: 'legal-evidence.v1', retentionExpiresAt: null,
  };
  run.answerEvidence.version = 1;
  run.answerEvidence.anchorVersion = 'document-anchor.v1';
  for (const record of [run.answerEvidence, run.answerEvidence.conversion]) {
    record.lifecycleDeleteStrategy = 'retain-governed-record';
    record.lifecycleGovernedRecordRule = 'legal-evidence.v1';
    record.retentionExpiresAt = null;
  }
  run.answerEvidence.sourceAsset.retentionDeleteStrategy = 'retain-governed-record';
  run.answerEvidence.sourceAsset.governedRecordRule = 'legal-evidence.v1';
  run.answerEvidence.sourceAsset.retentionExpiresAt = null;
  run.answerEvidence.conversion.sourceChecksum = 'sha256:asset';
  run.answerEvidence.sourceHash = 'sha256:asset';
  run.inputHash = sha256(stableStringify({ questionSnapshot: run.questionSnapshot, evidence: { id: run.answerEvidence.id, version: run.answerEvidence.version, sourceHash: run.answerEvidence.sourceHash, anchorVersion: run.answerEvidence.anchorVersion }, evaluator: { provider: run.evaluatorId, version: run.evaluatorVersion } }));
  return run;
}

describe('document rubric grading routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXTAUTH_URL', 'http://localhost');
    getLocalTestSubmissionObjectStore().objects.clear();
    getLocalTestSubmissionObjectStore().put({ key: 'submissions/asset-1', ownerId: 'student-1', answerId: 'answer-1', attemptId: 'attempt-1', sizeBytes: 1, mimeType: 'application/pdf', checksum: 'sha256:asset', scanState: 'CLEAN' });
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback({ ...mocks.prisma, $transaction: undefined }));
    mocks.prisma.learningEvidenceDraft.findUnique.mockResolvedValue(null);
    mocks.prisma.gradingRun.findUnique.mockResolvedValue(null);
    mocks.prisma.gradingRun.findMany.mockResolvedValue([]);
    mocks.prisma.assignmentRevision.findMany.mockResolvedValue([]);
    mocks.prisma.class.findMany.mockResolvedValue([]);
    mocks.prisma.learningFact.findMany.mockResolvedValue([]);
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
    mocks.prisma.learningEvidenceDraft.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.gradingRun.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.gradingAuditEvent.create.mockResolvedValue({ id: 'audit-1' });
    mocks.prisma.gradingRequestIdempotency.findFirst.mockResolvedValue(null);
    mocks.prisma.gradingRequestIdempotency.create.mockImplementation(async ({ data }) => ({ id: 'review-request-1', ...data }));
    mocks.prisma.gradingCriterionAssessment.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.assignmentRevision.findUnique.mockResolvedValue({ assignment: { authorId: 'teacher-author', reviewGrants: [] } });
    mocks.prisma.learningFact.createMany.mockResolvedValue({ count: 1 });
    mocks.prisma.studentEvidenceFeatureCache.deleteMany.mockResolvedValue({ count: 1 });
    mocks.prisma.learningMaterializationRebuildRequest.findUnique.mockResolvedValue(null);
    mocks.prisma.learningMaterializationRebuildRequest.create.mockResolvedValue({});
    mocks.prisma.teachingResource.findFirst.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ['cross-origin', 'https://attacker.example'],
    ['missing-origin', null],
  ])('rejects authenticated approval requests with %s Origin', async (_case, origin) => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });

    const response = await postJson({ gradingRunId: 'grading-run-1' }, origin);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'invalid-origin' });
    expect(mocks.prisma.learningEvidenceDraft.findFirst).not.toHaveBeenCalled();
    expect(mocks.prisma.learningFact.createMany).not.toHaveBeenCalled();
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
      gradingRunId: expect.stringContaining('grading:asset:student-1:class-1:report-1:'),
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
      id: expect.stringContaining('asset:student-1:class-1:report-1:'),
      studentId: 'student-1',
      classId: 'class-1',
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

  it('scopes duplicate document grading submissions by class', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.class.findUnique
      .mockResolvedValueOnce({ id: 'class-1', teacherId: 'teacher-1' })
      .mockResolvedValueOnce({ id: 'class-2', teacherId: 'teacher-1' });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-profile-1' });

    const first = await postSubmissionJson({
      studentId: 'student-1',
      classId: 'class-1',
      assignmentId: 'report-1',
      fileName: 'root-locus-report.md',
      mimeType: 'text/markdown',
      bytes: 'Root locus design explains damping ratio and settling time.',
      rubric: rubric(),
    });
    const second = await postSubmissionJson({
      studentId: 'student-1',
      classId: 'class-2',
      assignmentId: 'report-1',
      fileName: 'root-locus-report.md',
      mimeType: 'text/markdown',
      bytes: 'Root locus design explains damping ratio and settling time.',
      rubric: rubric(),
    });
    const firstCreate = mocks.prisma.learningEvidenceDraft.create.mock.calls[0][0];
    const secondCreate = mocks.prisma.learningEvidenceDraft.create.mock.calls[1][0];

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(firstCreate.data.sourceRefs.asset.id).toEqual(expect.stringContaining('asset:student-1:class-1:report-1:'));
    expect(secondCreate.data.sourceRefs.asset.id).toEqual(expect.stringContaining('asset:student-1:class-2:report-1:'));
    expect(firstCreate.data.dedupeKey).not.toBe(secondCreate.data.dedupeKey);
    expect(firstCreate.data.summary.run.id).not.toBe(secondCreate.data.summary.run.id);
    expect(mocks.prisma.learningEvidenceDraft.findUnique).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { dedupeKey: firstCreate.data.dedupeKey },
    }));
    expect(mocks.prisma.learningEvidenceDraft.findUnique).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { dedupeKey: secondCreate.data.dedupeKey },
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

  it('returns an existing draft when duplicate submission creation races on dedupe key', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-profile-1' });
    mocks.prisma.learningEvidenceDraft.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'grading:raced-existing',
        dedupeKey: 'document-rubric:raced-existing',
        reviewerState: 'pending',
      });
    mocks.prisma.learningEvidenceDraft.create.mockRejectedValueOnce({ code: 'P2002' });

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

    expect(response.status).toBe(201);
    expect(payload).toEqual(expect.objectContaining({
      status: 'pending',
      gradingRunId: 'grading:raced-existing',
      dedupeKey: 'document-rubric:raced-existing',
    }));
    expect(mocks.prisma.learningEvidenceDraft.create).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.learningEvidenceDraft.findUnique).toHaveBeenCalledTimes(2);
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

  it('rejects malformed required submission fields before runtime conversion', async () => {
    mocks.getServerAuthSession.mockResolvedValueOnce({ user: { id: 'teacher-1', role: 'TEACHER' } });
    const malformedFileName = await postSubmissionJson({
      studentId: 'student-1',
      classId: 'class-1',
      assignmentId: 'report-1',
      fileName: [],
      mimeType: 'text/markdown',
      bytes: 'Root locus design explains damping ratio.',
      rubric: rubric(),
    });

    mocks.getServerAuthSession.mockResolvedValueOnce({ user: { id: 'teacher-1', role: 'TEACHER' } });
    const malformedBytes = await postSubmissionJson({
      studentId: 'student-1',
      classId: 'class-1',
      assignmentId: 'report-1',
      fileName: 'root-locus-report.md',
      mimeType: 'text/markdown',
      bytes: {},
      rubric: rubric(),
    });

    expect(malformedFileName.status).toBe(400);
    await expect(malformedFileName.json()).resolves.toEqual({ error: '缺少文件名' });
    expect(malformedBytes.status).toBe(400);
    await expect(malformedBytes.json()).resolves.toEqual({ error: '缺少文件内容' });
    expect(mocks.prisma.class.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.learningEvidenceDraft.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate rubric criterion and level identifiers before persistence', async () => {
    mocks.getServerAuthSession.mockResolvedValueOnce({ user: { id: 'teacher-1', role: 'TEACHER' } });
    const duplicateCriterionResponse = await postSubmissionJson({
      studentId: 'student-1',
      classId: 'class-1',
      assignmentId: 'report-1',
      fileName: 'root-locus-report.md',
      mimeType: 'text/markdown',
      bytes: 'Root locus design explains damping ratio.',
      rubric: {
        ...rubric(),
        criteria: [
          rubric().criteria[0],
          {
            ...rubric().criteria[0],
            label: '重复指标',
          },
        ],
      },
    });

    mocks.getServerAuthSession.mockResolvedValueOnce({ user: { id: 'teacher-1', role: 'TEACHER' } });
    const duplicateLevelResponse = await postSubmissionJson({
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
          levels: [
            rubric().criteria[0].levels[0],
            {
              ...rubric().criteria[0].levels[0],
              label: '重复等级',
            },
          ],
        }],
      },
    });

    expect(duplicateCriterionResponse.status).toBe(400);
    expect(duplicateLevelResponse.status).toBe(400);
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

  it('prevents students from providing grading goal attribution fields', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });

    const response = await postSubmissionJson({
      studentId: 'student-1',
      classId: 'class-1',
      assignmentId: 'report-1',
      fileName: 'root-locus-report.md',
      mimeType: 'text/markdown',
      bytes: 'Root locus design explains damping ratio.',
      goalId: 'forged-goal',
      targetGoal: 'forged-target',
      learningGoal: 'forged-learning-goal',
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: '学生提交不能指定学习目标归因' });
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
        lessonItems: {
          some: {
            plan: {
              sessions: {
                some: {
                  classId: 'class-1',
                },
              },
            },
          },
        },
      },
      select: {
        config: true,
        lessonItems: {
          where: {
            plan: {
              sessions: {
                some: {
                  classId: 'class-1',
                },
              },
            },
          },
          select: {
            overrideConfig: true,
          },
        },
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

  it('prefers class-published lesson item override rubric for student submissions', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-profile-1' });
    mocks.prisma.teachingResource.findFirst.mockResolvedValue({
      config: {
        documentGrading: {
          rubric: {
            ...rubric(),
            id: 'resource-rubric',
            version: 'resource-v1',
          },
        },
      },
      lessonItems: [{
        overrideConfig: {
          documentGrading: {
            goalId: 'override-goal',
            targetGoal: 'override-target',
            learningGoal: 'override-learning-goal',
            rubric: {
              ...rubric(),
              id: 'override-rubric',
              version: 'override-v1',
            },
          },
        },
      }],
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
    expect(createInput.data.summary.rubric).toEqual(expect.objectContaining({
      id: 'override-rubric',
      version: 'override-v1',
    }));
    expect(createInput.data.summary.run).toEqual(expect.objectContaining({
      rubricId: 'override-rubric',
      rubricVersion: 'override-v1',
    }));
    expect(createInput.data.sourceRefs).toEqual(expect.objectContaining({
      goalId: 'override-goal',
      targetGoal: 'override-target',
      learningGoal: 'override-learning-goal',
    }));
  });

  it('merges lesson item goal overrides with resource-level student rubric', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-profile-1' });
    mocks.prisma.teachingResource.findFirst.mockResolvedValue({
      config: {
        documentGrading: {
          goalId: 'resource-goal',
          targetGoal: 'resource-target',
          learningGoal: 'resource-learning-goal',
          rubric: {
            ...rubric(),
            id: 'resource-rubric',
            version: 'resource-v1',
          },
        },
      },
      lessonItems: [{
        overrideConfig: {
          documentGrading: {
            goalId: 'override-goal',
            targetGoal: 'override-target',
            learningGoal: 'override-learning-goal',
          },
        },
      }],
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
    expect(createInput.data.summary.rubric).toEqual(expect.objectContaining({
      id: 'resource-rubric',
      version: 'resource-v1',
    }));
    expect(createInput.data.summary.run).toEqual(expect.objectContaining({
      rubricId: 'resource-rubric',
      rubricVersion: 'resource-v1',
    }));
    expect(createInput.data.sourceRefs).toEqual(expect.objectContaining({
      goalId: 'override-goal',
      targetGoal: 'override-target',
      learningGoal: 'override-learning-goal',
    }));
  });

  it('rejects student submissions when the assignment resource is not published to the class', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-profile-1' });
    mocks.prisma.teachingResource.findFirst.mockResolvedValue(null);

    const response = await postSubmissionJson({
      studentId: 'student-1',
      classId: 'class-1',
      assignmentId: 'foreign-resource',
      fileName: 'root-locus-report.md',
      mimeType: 'text/markdown',
      bytes: 'Root locus design explains damping ratio.',
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ error: '作业未配置服务端评分量规' });
    expect(mocks.prisma.teachingResource.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'foreign-resource',
        teacherOnly: false,
        lessonItems: expect.any(Object),
      }),
    }));
    expect(mocks.prisma.learningEvidenceDraft.create).not.toHaveBeenCalled();
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

  it('rejects invalid server rubric identifiers for student submissions', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-profile-1' });
    mocks.prisma.teachingResource.findFirst.mockResolvedValue({
      config: {
        documentGrading: {
          rubric: {
            ...rubric(),
            criteria: [{
              ...rubric().criteria[0],
              levels: [
                rubric().criteria[0].levels[0],
                {
                  ...rubric().criteria[0].levels[0],
                  label: '重复等级',
                },
              ],
            }],
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

  it('renders evidence capsules and wires teacher approval to the guarded route', () => {
    const ui = source('src/features/assessment/document-rubric-grading-ui.tsx');
    const action = source('src/features/assessment/document-rubric-grading-actions.tsx');
    const teacherPage = source('src/app/(teacher-report-ledger)/teacher/grading-workbench/page.tsx');

    expect(ui).toContain('view.evidenceCapsules.map');
    expect(ui).toContain('entryPoint={view.konlingEntryPoint}');
    expect(ui).toContain('gradingRunId={view.gradingRunId}');
    expect(action).toContain("fetch('/api/teacher/document-grading/approve'");
    expect(action).toContain('edits: selectModifiedDocumentGradingEdits(criteria, edits)');
    expect(action).toContain('AI 原值');
    expect(action).toContain('证据锚点为只读');
    expect(action).toContain('type="number"');
    expect(action).toContain('教师评语');
    expect(action).toContain('提交中');
    expect(action).toContain('审批成功');
    expect(action).toContain('审批文档评分失败');
    expect(action).toContain('disabled={state === \'submitting\' || state === \'success\'}');
    expect(action).toContain("payload?.status !== 'approved'");
    expect(action).toContain('payload?.gradingRunId !== gradingRunId');
    expect(action).toContain('router.refresh()');
    expect(ui).toContain('key={`approve:${view.gradingRunId}`}');
    expect(action).not.toContain('data-legacy-document-grading-approval-disabled="true"');
    expect(teacherPage).toContain('validateDocumentRubricGradingDraftInvariants');
    expect(teacherPage).toContain('if (!invariants.valid)');
    expect(teacherPage).toContain('prisma.studentProfile.findFirst');
    expect(teacherPage).toContain('assertPipelineReviewActor');
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

  it('approves a native pipeline run with governed dimensions, course ownership, and a privacy-safe decision-verification audit summary', async () => {
    const run = pipelineRun();
    run.answerAttempt.submittedAt = new Date('2025-01-01T00:00:00.000Z');
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findUnique.mockResolvedValue(run);
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'profile-1' });
    mocks.prisma.learningFact.createMany.mockResolvedValue({ count: 2 });

    const response = await postJson({ gradingRunId: run.id, decision: 'approved', edits: [
      { criterionId: 'controlModeling', levelId: 'full-model', score: 4, comment: '确认模型证据' },
      { criterionId: 'custom-proof', levelId: 'full-proof', score: 6, comment: '确认证明' },
    ] });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: 'approved', createdFacts: 2 });
    const facts = mocks.prisma.learningFact.createMany.mock.calls[0][0].data;
    expect(facts).toEqual([
      expect.objectContaining({ outcome: 'success', score: 1, courseId: 'course-control', sourceEventId: expect.stringMatching(/^adaptive-assessment:document-rubric-grading:/), competencyContribution: { controlModeling: 1 }, contextJson: expect.objectContaining({ assessmentId: 'a1', assignmentId: 'assignment-1', assignmentRevisionId: 'revision-1', rawScore: 4, maxPoints: 4, normalizedScore: 1, rubricWeight: 0.4, evidenceAuthority: 'ai-draft', decisionAuthority: 'teacher-reviewed', reviewState: 'approved', privacyScope: 'student-private', evidenceAnchorPrivacyScope: 'teacher-review' }) }),
      expect.objectContaining({ outcome: 'success', score: 1, courseId: 'course-control', competencyContribution: { engineeringDecision: 1 }, contextJson: expect.objectContaining({ rawScore: 6, maxPoints: 6, normalizedScore: 1, rubricWeight: 0.6, competencyDimension: 'engineeringDecision', evidenceAuthority: 'ai-draft', decisionAuthority: 'teacher-reviewed' }) }),
    ]);
    expect(JSON.stringify(facts)).not.toContain('reviewerId');
    expect(mocks.prisma.gradingRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: run.id, state: 'AWAITING_REVIEW', teacherReviewedAt: null },
      data: expect.objectContaining({ state: 'APPROVED', teacherReviewedAt: expect.any(Date) }),
    }));
    expect(mocks.prisma.gradingCriterionAssessment.updateMany).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.gradingCriterionAssessment.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ teacherScore: 4, teacherLevelId: 'full-model', teacherReviewedAt: expect.any(Date) }) }));
    expect(mocks.prisma.gradingAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      action: 'grading-run.teacher-reviewed', assignmentId: expect.not.stringContaining('revision-1'), actorPseudoId: expect.not.stringContaining('teacher-1'),
      metadata: expect.objectContaining({ decision: 'approved', rubric: { idDigest: expect.any(String), version: 'sha256:question' }, evaluator: { idDigest: expect.any(String), version: 'eval-v1' }, assignmentRevisionDigest: expect.any(String), replayKey: expect.any(String), sourceEventDigests: expect.any(Array), factVerification: { count: 2, allGoverned: true }, gradeChanges: expect.arrayContaining([expect.objectContaining({ criterionDigest: expect.any(String), ai: expect.any(Object), final: expect.any(Object), diff: expect.any(Object), anchorDigests: expect.any(Array) })]) }),
    }) }));
    expect(JSON.stringify(mocks.prisma.gradingAuditEvent.create.mock.calls[0][0])).not.toContain('teacher-1');
    expect(JSON.stringify(mocks.prisma.gradingAuditEvent.create.mock.calls[0][0])).not.toMatch(/ann-1|assessment-1|block-1/);
    const auditMetadata = mocks.prisma.gradingAuditEvent.create.mock.calls[0][0].data.metadata;
    expect(JSON.stringify(auditMetadata)).not.toMatch(/"score"|"contribution"|"factAt"|"outcome"/);
    expect(JSON.stringify(auditMetadata)).not.toContain('feedbackDigest');
    expect(mocks.prisma.learningEvidenceDraft.create).not.toHaveBeenCalled();
    expect(mocks.prisma.learningMaterializationRebuildRequest.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'student-1', classIds: ['class-1'], status: 'PENDING' }),
    }));
    expect(mocks.prisma.$transaction.mock.calls.at(-1)?.[1]).toEqual({ isolationLevel: 'Serializable' });
  });

  it('replays the same native approval request and rejects different edits after approval', async () => {
    const run = pipelineRun();
    const edits = [
      { criterionId: 'controlModeling', levelId: 'full-model', score: 4, comment: '确认模型证据' },
      { criterionId: 'custom-proof', levelId: 'full-proof', score: 6, comment: '确认证明' },
    ];
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findUnique.mockResolvedValue(run);
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'profile-1' });
    mocks.prisma.learningFact.createMany.mockResolvedValue({ count: 2 });

    const first = await postJson({ gradingRunId: run.id, decision: 'approved', edits });
    expect(first.status).toBe(200);
    const reservation = mocks.prisma.gradingRequestIdempotency.create.mock.calls[0][0].data;
    expect(reservation.idempotencyKey).not.toContain('grading-review:');
    expect(reservation.expiresAt).toBeInstanceOf(Date);
    run.state = 'APPROVED';
    run.teacherReviewedAt = now;
    mocks.prisma.gradingRequestIdempotency.findFirst.mockResolvedValue({ ...reservation, resourceId: run.id });

    const replay = await postJson({ gradingRunId: run.id, decision: 'approved', edits });
    expect(replay.status).toBe(200);
    await expect(replay.json()).resolves.toMatchObject({ status: 'approved', createdFacts: 0, skippedFacts: 2 });
    expect(mocks.prisma.learningFact.createMany).toHaveBeenCalledTimes(1);

    const conflict = await postJson({ gradingRunId: run.id, decision: 'approved', edits: [{ ...edits[0], comment: '不同内容' }, edits[1]] });
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toEqual({ error: 'grading-review-conflict' });
  });

  it('rejects teacher comments longer than 4000 characters', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    const response = await postJson({ gradingRunId: 'pipeline-run-1', edits: [{ criterionId: 'controlModeling', levelId: 'full-model', score: 4, comment: 'x'.repeat(4001) }] });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: '评分编辑无效' });
    expect(mocks.prisma.gradingRun.findUnique).not.toHaveBeenCalled();
  });

  it('blocks native writeback for missing governed dimensions or course ownership without clearing cache', async () => {
    const run = pipelineRun();
    delete (run.questionSnapshot.rubric.criteria[1] as any).goalDimension;
    (run.question.revision.assignment as any).courseContext = null;
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findUnique.mockResolvedValue(run);
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'profile-1' });

    for (const call of [postPreviewJson({ gradingRunId: run.id }), postJson({ gradingRunId: run.id, decision: 'approved' })]) {
      const response = await call;
      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual(expect.objectContaining({ reasons: expect.arrayContaining(['course-id-missing', 'goal-dimension-missing:custom-proof']) }));
    }
    expect(mocks.prisma.learningFact.createMany).not.toHaveBeenCalled();
    expect(mocks.prisma.studentEvidenceFeatureCache.deleteMany).not.toHaveBeenCalled();
  });

  it('blocks rubric and anchor drift before native writeback', async () => {
    const run = pipelineRun();
    run.rubricVersion = 'stale-version';
    run.annotations[0].blockId = 'foreign-block';
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findUnique.mockResolvedValue(run);
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'profile-1' });

    const response = await postJson({ gradingRunId: run.id, decision: 'approved' });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ reasons: expect.arrayContaining(['rubric-version-mismatch', 'annotation-block-mismatch:ann-1']) }));
    expect(mocks.prisma.gradingRun.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ['run-answer-question-mismatch', (run: any) => { run.questionId = 'question-drift'; }],
    ['revision-lineage-mismatch', (run: any) => { run.answerAttempt.answer.submission.assignmentRevisionId = 'revision-drift'; }],
    ['evidence-attempt-mismatch', (run: any) => { run.answerEvidence.attemptId = 'attempt-drift'; }],
    ['question-snapshot-hash-mismatch', (run: any) => { run.questionSnapshotHash = 'sha256:drift'; }],
    ['rubric-snapshot-content-mismatch', (run: any) => { run.rubricSnapshot.criteria[0].label = '漂移量规'; }],
    ['course-lineage-drift', (run: any) => { run.answerAttempt.answer.submission.revision.assignment.courseContext = 'course-drift'; }],
  ])('blocks native cross-table drift: %s', async (reason, mutate) => {
    const run = pipelineRun();
    mutate(run);
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findUnique.mockResolvedValue(run);
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'profile-1' });
    const response = await postJson({ gradingRunId: run.id, decision: 'approved' });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ reasons: expect.arrayContaining([reason]) }));
    expect(mocks.prisma.learningFact.createMany).not.toHaveBeenCalled();
  });

  it.each([
    ['submission-student-drift', (run: any) => { run.answerAttempt.answer.submission.studentId = 'student-drift'; }],
    ['source-asset-lineage-mismatch', (run: any) => { run.answerEvidence.sourceAsset.answerId = 'answer-drift'; }],
    ['source-asset-lineage-mismatch', (run: any) => { run.answerEvidence.sourceAsset.attemptId = 'attempt-drift'; }],
    ['conversion-lineage-mismatch', (run: any) => { run.answerEvidence.conversion.assetId = 'asset-drift'; }],
    ['conversion-lineage-mismatch', (run: any) => { run.answerEvidence.conversion.attemptId = 'attempt-drift'; }],
    ['grading-run-content-unavailable', (run: any) => { run.lifecycleBlockedAt = now; }],
    ['answer-evidence-content-unavailable', (run: any) => { run.answerEvidence.readiness = 'BLOCKED'; }],
    ['answer-evidence-content-unavailable', (run: any) => { run.answerEvidence.tombstonedAt = now; }],
    ['answer-evidence-content-unavailable', (run: any) => { run.answerEvidence.lifecycleBlockedAt = now; }],
    ['source-asset-content-unavailable', (run: any) => { run.answerEvidence.sourceAsset.scanState = 'PENDING'; }],
    ['source-asset-content-unavailable', (run: any) => { run.answerEvidence.sourceAsset.state = 'CONTENT_UNAVAILABLE'; }],
    ['source-asset-content-unavailable', (run: any) => { run.answerEvidence.sourceAsset.lifecycleBlockedAt = now; }],
    ['conversion-content-unavailable', (run: any) => { run.answerEvidence.conversion.state = 'BLOCKED'; }],
    ['conversion-content-unavailable', (run: any) => { run.answerEvidence.conversion.lifecycleBlockedAt = now; }],
  ])('fails closed for unavailable native review content: %s', async (reason, mutate) => {
    const run = pipelineRun();
    mutate(run);
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findUnique.mockResolvedValue(run);
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'profile-1' });
    const preview = await postPreviewJson({ gradingRunId: run.id });
    expect(preview.status).toBe(409);
    await expect(preview.json()).resolves.toEqual(expect.objectContaining({ reasons: expect.arrayContaining([reason]) }));
    const approve = await postJson({ gradingRunId: run.id, decision: 'approved' });
    expect(approve.status).toBe(409);
    expect(mocks.prisma.learningFact.createMany).not.toHaveBeenCalled();
  });

  it('rolls back before CAS when the student leaves the frozen class during approval', async () => {
    const run = pipelineRun();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findUnique.mockResolvedValue(run);
    mocks.prisma.studentProfile.findFirst.mockResolvedValueOnce({ id: 'profile-1' }).mockResolvedValueOnce(null);
    const response = await postJson({ gradingRunId: run.id, decision: 'approved' });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'grading-review-student-scope-changed' });
    expect(mocks.prisma.gradingRun.updateMany).not.toHaveBeenCalled();
    expect(mocks.prisma.learningFact.createMany).not.toHaveBeenCalled();
  });

  it('blocks criteria without a governed evidence anchor in workbench writeback paths', async () => {
    const run = pipelineRun();
    run.annotations = run.annotations.filter((annotation: any) => annotation.criterionId !== 'custom-proof');
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findUnique.mockResolvedValue(run);
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'profile-1' });
    for (const response of [await postPreviewJson({ gradingRunId: run.id }), await postJson({ gradingRunId: run.id, decision: 'approved' })]) {
      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual(expect.objectContaining({ reasons: expect.arrayContaining(['criterion-evidence-anchor-missing:custom-proof']) }));
    }
    expect(mocks.prisma.learningFact.createMany).not.toHaveBeenCalled();
  });

  it.each([
    ['grading-run-retention-expired', (run: any) => { run.retentionExpiresAt = now; }],
    ['answer-evidence-retention-expired', (run: any) => { run.answerEvidence.retentionExpiresAt = now; }],
    ['source-asset-retention-expired', (run: any) => { run.answerEvidence.sourceAsset.retentionExpiresAt = now; }],
    ['conversion-retention-expired', (run: any) => { run.answerEvidence.conversion.retentionExpiresAt = now; }],
    ['frozen-input-hash-mismatch', (run: any) => { run.inputHash = 'sha256:drift'; }],
    ['frozen-source-checksum-mismatch', (run: any) => { run.answerEvidence.conversion.sourceChecksum = 'sha256:drift'; }],
  ])('blocks expired or drifted frozen input before writeback: %s', async (reason, mutate) => {
    const run = pipelineRun();
    mutate(run);
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findUnique.mockResolvedValue(run);
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'profile-1' });
    const response = await postJson({ gradingRunId: run.id, decision: 'approved' });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ reasons: expect.arrayContaining([reason]) }));
    expect(mocks.prisma.learningFact.createMany).not.toHaveBeenCalled();
  });

  it('classifies zero as failure and a positive sub-threshold score as partial', async () => {
    const run = pipelineRun();
    run.assessments[0].score = 0;
    run.assessments[1].score = 3;
    run.questionSnapshot.rubric.criteria[0].levels[0].minPoints = 0;
    run.questionSnapshot.rubric.criteria[1].levels[0].minPoints = 0;
    run.rubricSnapshot = structuredClone(run.questionSnapshot.rubric);
    run.question.rubricSnapshot = structuredClone(run.questionSnapshot.rubric);
    run.inputHash = sha256(stableStringify({ questionSnapshot: run.questionSnapshot, evidence: { id: run.answerEvidence.id, version: run.answerEvidence.version, sourceHash: run.answerEvidence.sourceHash, anchorVersion: run.answerEvidence.anchorVersion }, evaluator: { provider: run.evaluatorId, version: run.evaluatorVersion } }));
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findUnique.mockResolvedValue(run);

    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'profile-1' });
    mocks.prisma.learningFact.createMany.mockResolvedValue({ count: 2 });
    const response = await postJson({ gradingRunId: run.id, decision: 'approved' });
    expect(response.status).toBe(200);
    const facts = mocks.prisma.learningFact.createMany.mock.calls[0][0].data;
    expect(facts.map((fact: any) => fact.outcome)).toEqual(['failure', 'partial']);
  });

  it('does not mark unchanged full-form teacher comments as changed', async () => {
    const run = pipelineRun();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findUnique.mockResolvedValue(run);
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'profile-1' });
    mocks.prisma.gradingRun.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.gradingCriterionAssessment.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.learningFact.createMany.mockResolvedValue({ count: 2 });
    const edits = run.assessments.map((assessment: any) => ({ criterionId: assessment.criterionId, levelId: assessment.levelId, score: assessment.score, comment: '' }));
    const response = await postJson({ gradingRunId: run.id, decision: 'approved', edits });
    expect(response.status).toBe(200);
    const changes = mocks.prisma.gradingAuditEvent.create.mock.calls[0][0].data.metadata.gradeChanges;
    expect(changes.every((change: any) => change.diff.feedbackChanged === false)).toBe(true);
  });

  it('rejects a repeated excerpt anchored to the wrong global span in a second block', async () => {
    const run = pipelineRun();
    run.answerEvidence.blocks.push({ ...run.answerEvidence.blocks[0], id: 'block-2', spanStart: 10, spanEnd: 15 });
    run.annotations[0] = { ...run.annotations[0], blockId: 'block-2', spanStart: 0, spanEnd: 3 };
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findUnique.mockResolvedValue(run);
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'profile-1' });
    const response = await postPreviewJson({ gradingRunId: run.id });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ reasons: expect.arrayContaining([expect.stringContaining('annotation-span-mismatch')]) }));
  });

  it('fails closed for missing runtime objects and malformed persisted AI evidence', async () => {
    const missingObjectRun = pipelineRun();
    getLocalTestSubmissionObjectStore().objects.clear();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findUnique.mockResolvedValue(missingObjectRun);
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'profile-1' });
    const missingObject = await postJson({ gradingRunId: missingObjectRun.id, decision: 'approved' });
    expect(missingObject.status).toBe(409);
    await expect(missingObject.json()).resolves.toEqual({ error: 'grading-review-runtime-source-unavailable' });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();

    const malformedRun = pipelineRun();
    malformedRun.assessments[0].confidence = 1.1;
    malformedRun.annotations[0].excerpt = '';
    malformedRun.annotations[0].spanEnd = malformedRun.annotations[0].spanStart;
    mocks.prisma.gradingRun.findUnique.mockResolvedValue(malformedRun);
    const malformed = await postPreviewJson({ gradingRunId: malformedRun.id });
    expect(malformed.status).toBe(409);
    await expect(malformed.json()).resolves.toEqual(expect.objectContaining({ reasons: expect.arrayContaining(['assessment-confidence-invalid:controlModeling', expect.stringContaining('anchor-excerpt-empty'), expect.stringContaining('annotation-span-mismatch')]) }));
  });

  it('retries one P2034 serialization conflict with Serializable isolation', async () => {
    const run = pipelineRun();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findUnique.mockResolvedValue(run);
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'profile-1' });
    mocks.prisma.gradingRun.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.gradingCriterionAssessment.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.learningFact.createMany.mockResolvedValue({ count: 2 });
    mocks.prisma.$transaction.mockRejectedValueOnce({ code: 'P2034' }).mockImplementation(async (callback) => callback(mocks.prisma));
    const response = await postJson({ gradingRunId: run.id, decision: 'approved' });
    expect(response.status).toBe(200);
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.$transaction.mock.calls.every((call) => call[1]?.isolationLevel === 'Serializable')).toBe(true);
  });

  it('returns 409 after two P2034 serialization conflicts', async () => {
    const run = pipelineRun();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findUnique.mockResolvedValue(run);
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'profile-1' });
    mocks.prisma.$transaction.mockRejectedValue({ code: 'P2034' });
    const response = await postJson({ gradingRunId: run.id, decision: 'approved' });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'grading-review-conflict' });
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.learningFact.createMany).not.toHaveBeenCalled();
  });

  it('treats identical source facts as replay-safe and rejects changed persisted semantics', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T12:00:00.000Z'));
    const run = pipelineRun();
    const facts = buildPipelineReviewFacts({ run, edits: [], reviewedAt: new Date() });
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findUnique.mockResolvedValue(run);
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'profile-1' });
    mocks.prisma.gradingRun.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.gradingCriterionAssessment.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.learningFact.findMany.mockResolvedValue(facts);
    const replay = await postJson({ gradingRunId: run.id, decision: 'approved' });
    expect(replay.status).toBe(200);
    await expect(replay.json()).resolves.toMatchObject({ createdFacts: 0, skippedFacts: 2 });
    expect(mocks.prisma.learningFact.createMany).not.toHaveBeenCalled();

    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findUnique.mockResolvedValue(run);
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'profile-1' });
    mocks.prisma.gradingRun.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.gradingCriterionAssessment.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.prisma));
    mocks.prisma.learningFact.findMany.mockResolvedValue([{ ...facts[0], moduleId: 'forged-module' }]);
    const conflict = await postJson({ gradingRunId: run.id, decision: 'approved' });
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toEqual({ error: 'grading-review-fact-conflict' });
    vi.useRealTimers();
  });

  it('keeps the legacy submissions writer disabled in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const response = await postSubmissionJson({ bytes: 'must-not-write' });
    expect(response.status).toBe(410);
    expect(mocks.prisma.learningEvidenceDraft.create).not.toHaveBeenCalled();
  });

  it.each([
    ['assignment author', 'teacher-author', [{ id: 'unused' }]],
    ['active review grant', 'teacher-granted', [{ id: 'grant-1' }]],
  ])('approves natively for %s through the shared pipeline scope', async (_label, actorId, grants) => {
    const run = pipelineRun();
    run.answerAttempt.answer.submission.audience.class.teacherId = 'teacher-current';
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: actorId, role: 'TEACHER' } });
    mocks.prisma.gradingRun.findUnique.mockResolvedValue(run);
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'profile-1' });
    mocks.prisma.learningFact.createMany.mockResolvedValue({ count: 2 });
    mocks.prisma.assignmentRevision.findUnique.mockResolvedValue({ assignment: { authorId: 'teacher-author', reviewGrants: actorId === 'teacher-author' ? [] : grants } });

    const response = await postJson({ gradingRunId: run.id, decision: 'approved' });
    expect(response.status).toBe(200);
  });

  it.each(['revoked', 'expired'])('rejects native approval when an initially valid grant becomes %s inside the transaction', async () => {
    const run = pipelineRun();
    run.answerAttempt.answer.submission.audience.class.teacherId = 'teacher-current';
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-granted', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findUnique.mockResolvedValue(run);
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'profile-1' });
    mocks.prisma.assignmentRevision.findUnique
      .mockResolvedValueOnce({ assignment: { authorId: 'teacher-author', reviewGrants: [{ id: 'grant-1' }] } })
      .mockResolvedValueOnce({ assignment: { authorId: 'teacher-author', reviewGrants: [] } });
    const response = await postJson({ gradingRunId: run.id, decision: 'approved' });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'grading-forbidden' });
    expect(mocks.prisma.gradingRun.updateMany).not.toHaveBeenCalled();
    expect(mocks.prisma.learningFact.createMany).not.toHaveBeenCalled();
  });

  it.each(['expired', 'revoked'])('rejects a native reviewer with an %s grant', async () => {
    const run = pipelineRun();
    run.answerAttempt.answer.submission.audience.class.teacherId = 'teacher-current';
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-granted', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findUnique.mockResolvedValue(run);
    mocks.prisma.assignmentRevision.findUnique.mockResolvedValue({ assignment: { authorId: 'teacher-author', reviewGrants: [] } });

    const response = await postPreviewJson({ gradingRunId: run.id });
    expect(response.status).toBe(403);
    expect(mocks.prisma.assignmentRevision.findUnique.mock.calls[0][0].select.assignment.select.reviewGrants.where).toEqual(expect.objectContaining({ teacherId: 'teacher-granted', revokedAt: null, OR: expect.any(Array) }));
  });

  it('rejects frozen and live audience class drift before review authorization', async () => {
    const run = pipelineRun();
    run.answerAttempt.answer.submission.audience.classId = 'class-drifted';
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findUnique.mockResolvedValue(run);
    const response = await postPreviewJson({ gradingRunId: run.id });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'grading-review-class-drift' });
  });

  it('lists only awaiting-review runs visible through shared author or grant authorization', async () => {
    const run = pipelineRun();
    run.answerAttempt.answer.submission.audience.class.teacherId = 'teacher-current';
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-author', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findMany.mockResolvedValue([run]);
    mocks.prisma.assignmentRevision.findUnique.mockResolvedValue({ assignment: { authorId: 'teacher-author', reviewGrants: [] } });
    const response = await gradingListGET();
    expect(response!.status).toBe(200);
    await expect(response!.json()).resolves.toMatchObject({ items: [{ gradingRunId: run.id, state: 'AWAITING_REVIEW' }] });
    expect(mocks.prisma.gradingRun.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ state: { in: ['AWAITING_REVIEW', 'CONTENT_UNAVAILABLE'] }, OR: expect.any(Array) }) }));
    const malformed = { ...pipelineRun(), id: 'run-malformed', state: 'CONTENT_UNAVAILABLE', question: null, answerAttempt: null };
    mocks.prisma.gradingRun.findMany.mockResolvedValue([malformed, run]);
    const resilientResponse = await gradingListGET();
    expect(resilientResponse!.status).toBe(200);
    await expect(resilientResponse!.json()).resolves.toMatchObject({ items: [{ gradingRunId: run.id }] });
  });

  it('filters author-visible grading rows whose submission lineage is mismatched', async () => {
    const run = pipelineRun();
    run.question.revision.assignment.authorId = 'teacher-author';
    run.answerAttempt.answer.submission.revision.assignment.id = 'different-assignment';
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-author', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findMany.mockResolvedValue([run]);
    const response = await gradingListGET();
    expect(response!.status).toBe(200);
    await expect(response!.json()).resolves.toEqual({ items: [] });
    expect(mocks.prisma.assignmentRevision.findUnique).not.toHaveBeenCalled();
  });

  it('lists an authorized content-unavailable history row without frozen review payloads', async () => {
    const run = pipelineRun();
    run.state = 'CONTENT_UNAVAILABLE';
    run.questionSnapshot = null;
    run.rubricSnapshot = null;
    run.assessments = [];
    run.annotations = [];
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findMany.mockResolvedValue([run]);
    const response = await gradingListGET();
    expect(response!.status).toBe(200);
    await expect(response!.json()).resolves.toMatchObject({ items: [{ gradingRunId: run.id, state: 'CONTENT_UNAVAILABLE', contentAvailable: false }] });
  });

  it('filters a content-unavailable history row with mismatched frozen ownership', async () => {
    const run = pipelineRun();
    run.state = 'CONTENT_UNAVAILABLE';
    run.questionSnapshot = null;
    run.rubricSnapshot = null;
    run.answerAttempt.answer.submission.frozenStudentId = 'different-student';
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findMany.mockResolvedValue([run]);
    const response = await gradingListGET();
    expect(response!.status).toBe(200);
    await expect(response!.json()).resolves.toEqual({ items: [] });
  });

  it('lists a GC-redacted content-unavailable run using only its minimal authorization snapshot', async () => {
    const run = pipelineRun();
    run.state = 'CONTENT_UNAVAILABLE';
    run.authorizationSnapshot = { version: 'grading-authorization.v1', classId: 'class-1', assignmentId: 'assignment-1', assignmentRevisionId: 'revision-1' };
    run.answerAttempt = null;
    run.answerEvidence = null;
    run.question = null;
    run.questionSnapshot = null;
    run.rubricSnapshot = null;
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findMany.mockResolvedValue([run]);
    mocks.prisma.class.findMany.mockResolvedValue([{ id: 'class-1' }]);
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });
    mocks.prisma.assignmentRevision.findUnique.mockResolvedValue({ assignment: { id: 'assignment-1', authorId: 'teacher-author', reviewGrants: [] } });
    await expect(assertPipelineReviewActor({ db: mocks.prisma, run, actor: { id: 'teacher-1', role: 'TEACHER' }, now })).resolves.toBeUndefined();
    const response = await gradingListGET();
    expect(response!.status).toBe(200);
    await expect(response!.json()).resolves.toMatchObject({ items: [{ gradingRunId: run.id, classId: 'class-1', assignmentId: 'assignment-1', rerunRequired: true }] });
    expect(mocks.prisma.gradingRun.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          { authorizationSnapshot: { path: ['classId'], equals: 'class-1' } },
        ]),
      }),
      take: 50,
    }));
    const listQuery = mocks.prisma.gradingRun.findMany.mock.calls.at(-1)?.[0];
    expect(listQuery.where.OR).not.toContainEqual({ state: 'CONTENT_UNAVAILABLE' });
  });

  it.each([0, -1, Number.POSITIVE_INFINITY])('returns a governed review error for invalid rubric maxScore %s', async (maxScore) => {
    const run = pipelineRun();
    run.questionSnapshot.rubric.maxScore = maxScore;
    run.rubricSnapshot.maxScore = maxScore;
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findUnique.mockResolvedValue(run);
    const response = await postPreviewJson({ gradingRunId: run.id });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: 'grading-review-contract-drift', reasons: expect.arrayContaining(['rubric-max-score-invalid']) });
  });

  it('rejects a rubric whose maxScore differs from the criterion total', async () => {
    const run = pipelineRun();
    run.questionSnapshot.rubric.maxScore = 11;
    run.rubricSnapshot.maxScore = 11;
    run.question.rubricSnapshot.maxScore = 11;
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findUnique.mockResolvedValue(run);
    const response = await postPreviewJson({ gradingRunId: run.id });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ reasons: expect.arrayContaining(['rubric-max-score-total-mismatch']) });
  });

  it.each(['returned', 'rejected'])('rejects unsupported native %s decisions without affecting legacy semantics', async (decision) => {
    const run = pipelineRun();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findUnique.mockResolvedValue(run);
    const response = await postJson({ gradingRunId: run.id, decision });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'native-grading-decision-unsupported' });
    expect(mocks.prisma.gradingRun.updateMany).not.toHaveBeenCalled();
  });

  it('rejects duplicate criterion edits and scores outside the selected level band', async () => {
    const run = pipelineRun();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findUnique.mockResolvedValue(run);
    const duplicate = { criterionId: 'controlModeling', levelId: 'full-model', score: 4, comment: '' };
    const duplicateResponse = await postJson({ gradingRunId: run.id, edits: [duplicate, duplicate] });
    expect(duplicateResponse.status).toBe(400);
    const bandResponse = await postJson({ gradingRunId: run.id, edits: [{ ...duplicate, score: 3 }] });
    expect(bandResponse.status).toBe(400);
  });

  it('rolls back native pipeline approval before facts and audit when the CAS fence loses', async () => {
    const run = pipelineRun();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findUnique.mockResolvedValue(run);
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'profile-1' });
    mocks.prisma.gradingRun.updateMany.mockResolvedValue({ count: 0 });

    const response = await postJson({ gradingRunId: run.id, decision: 'approved' });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'grading-review-conflict' });
    expect(mocks.prisma.learningFact.createMany).not.toHaveBeenCalled();
    expect(mocks.prisma.gradingAuditEvent.create).not.toHaveBeenCalled();
  });

  it('previews native pipeline writeback without mutating the run or copying evidence', async () => {
    const run = pipelineRun();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findUnique.mockResolvedValue(run);

    const response = await postPreviewJson({ gradingRunId: run.id });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: 'preview', gradingRunId: run.id, wouldCreateFacts: 2 });
    expect(mocks.prisma.gradingRun.updateMany).not.toHaveBeenCalled();
    expect(mocks.prisma.learningEvidenceDraft.create).not.toHaveBeenCalled();
  });

  it('approves persisted grading runs and writes governed learning facts', async () => {
    const draft = await gradingDraft();
    draft.summary.run.createdAt = '2025-01-01T00:00:00.000Z';
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
      skippedFacts: 0,
      blockedFacts: 0,
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
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.learningEvidenceDraft.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: draft.id, reviewerState: 'pending' }),
      data: expect.objectContaining({ reviewerState: 'approved' }),
    }));
    expect(mocks.prisma.learningMaterializationRebuildRequest.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'student-1', classIds: ['class-1'], reason: 'legacy-document-grading-approved' }) });
  });

  it('keeps a full-score low-weight criterion at full performance in both portrait engines', () => {
    const run = pipelineRun();
    run.questionSnapshot.rubric.criteria[0].maxPoints = 1;
    run.questionSnapshot.rubric.criteria[1].maxPoints = 9;
    run.questionSnapshot.rubric.maxScore = 10;
    run.assessments[0].score = 1;
    const fact: any = { id: 'fact-low-weight-full', createdAt: now, ...buildPipelineReviewFacts({ run, edits: [], reviewedAt: now })[0] };
    expect(fact.competencyContribution.controlModeling).toBe(1);
    expect(fact.contextJson.rubricWeight).toBe(0.1);
    expect(fact.contextJson.evidenceGovernance).not.toHaveProperty('profileWeight');
    expect(calculateCompetencyVector([fact], 'all').controlModeling.score).toBe(100);
    expect(mapLearningFactsToPortraitEvidence([fact]).evidence[0].contributions.controlModelingRepresentation).toBe(1);
  });

  it.each([undefined, null, [], {}, 'invalid', 1])('rejects malformed or empty frozen rubric criteria without throwing: %j', (criteria) => {
    const run = pipelineRun();
    run.questionSnapshot.rubric.criteria = criteria as any;
    run.rubricSnapshot.criteria = criteria as any;
    expect(validatePipelineReviewContract(run, now)).toContain('rubric-criteria-invalid');
  });

  it('rejects blocked evaluator grading runs before approval writeback', async () => {
    const draft = await gradingDraft();
    const blockedRun = createDraftRubricGrading({
      convertedDocument: draft.evidenceRefs.convertedDocument as ConvertedDocument,
      rubric: draft.summary.rubric,
      evaluatorOutput: {
        evaluatorId: 'blocked-test-evaluator',
        evaluatorVersion: '2026.06',
        assessments: [],
      },
      now,
    });
    const blockedDraft = {
      ...draft,
      id: blockedRun.id,
      dedupeKey: buildDocumentRubricDraftDedupeKey(draft.sourceRefs.asset as DocumentSubmissionAsset, blockedRun),
      summary: {
        ...draft.summary,
        run: blockedRun,
      },
    };
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValue(blockedDraft);
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-profile-1' });

    const response = await postJson({
      gradingRunId: blockedRun.id,
      decision: 'approved',
    });
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual(expect.objectContaining({
      error: '评分草稿存在阻塞的评估器输出，需要重新转换或重新评估后再审批',
      reasons: expect.arrayContaining(['criterion-assessment-missing']),
    }));
    expect(mocks.prisma.learningFact.createMany).not.toHaveBeenCalled();
    expect(mocks.prisma.learningEvidenceDraft.updateMany).not.toHaveBeenCalled();
  });

  it('reports skipped facts for idempotent approval writeback duplicates', async () => {
    const draft = await gradingDraft();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValue(draft);
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-profile-1' });
    mocks.prisma.learningFact.createMany.mockResolvedValueOnce({ count: 0 });

    const response = await postJson({
      gradingRunId: draft.id,
      decision: 'approved',
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual(expect.objectContaining({
      status: 'approved',
      createdFacts: 0,
      skippedFacts: 1,
      blockedFacts: 0,
      evidenceSourceEventIds: [`${draft.id}:modeling:${draft.summary.run.rubricVersion}`],
    }));
  });

  it('reports blocked facts when a grading run is returned without writeback', async () => {
    const draft = await gradingDraft();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValue(draft);
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-profile-1' });

    const response = await postJson({
      gradingRunId: draft.id,
      decision: 'returned',
      notes: '请补充模型说明。',
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual(expect.objectContaining({
      status: 'returned',
      createdFacts: 0,
      skippedFacts: 0,
      blockedFacts: 1,
      evidenceSourceEventIds: [],
    }));
    expect(mocks.prisma.learningFact.createMany).not.toHaveBeenCalled();
    expect(mocks.prisma.learningEvidenceDraft.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ reviewerState: 'returned' }),
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
    const updateInput = mocks.prisma.learningEvidenceDraft.updateMany.mock.calls[0][0];

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

  it('fences concurrent approvals so the losing edit returns 409 without writing facts', async () => {
    const draft = await gradingDraft();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValue(draft);
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-profile-1' });

    let reviewerState = 'pending';
    let committedScore: number | null = null;
    mocks.prisma.learningEvidenceDraft.updateMany.mockImplementation(async (input: any) => {
      if (input.where.reviewerState !== reviewerState) return { count: 0 };
      reviewerState = input.data.reviewerState;
      committedScore = input.data.summary.run.approvedGrades[0].score;
      return { count: 1 };
    });

    const responses = await Promise.all([
      postJson({
        gradingRunId: draft.id,
        decision: 'approved',
        edits: [{ criterionId: 'modeling', levelId: 'novice', score: 1, comment: '并发审批版本一。' }],
      }),
      postJson({
        gradingRunId: draft.id,
        decision: 'approved',
        edits: [{ criterionId: 'modeling', levelId: 'advanced', score: 4, comment: '并发审批版本二。' }],
      }),
    ]);

    const statuses = responses.map((response) => response.status).sort((left, right) => left - right);
    expect(statuses).toEqual([200, 409]);
    const conflictResponse = responses.find((response) => response.status === 409);
    expect(conflictResponse).toBeDefined();
    await expect(conflictResponse!.json()).resolves.toEqual({ error: 'grading-review-conflict' });
    expect(mocks.prisma.learningFact.createMany).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.learningFact.createMany.mock.calls[0][0].data[0].score).toBe(committedScore);
    expect(mocks.prisma.learningEvidenceDraft.updateMany).toHaveBeenCalledTimes(2);
  });

  it('rejects legacy approval when pending draft regeneration advances updatedAt before CAS', async () => {
    const draft = await gradingDraft();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValue(draft);
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-profile-1' });
    mocks.prisma.learningEvidenceDraft.updateMany.mockImplementation(async ({ where }: any) => ({
      count: where.updatedAt?.getTime?.() === new Date(draft.updatedAt).getTime() ? 0 : 1,
    }));

    const response = await postJson({ gradingRunId: draft.id, decision: 'approved' });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'grading-review-conflict' });
    expect(mocks.prisma.learningEvidenceDraft.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: draft.id, reviewerState: 'pending', updatedAt: new Date(draft.updatedAt) }),
    }));
    expect(mocks.prisma.learningFact.createMany).not.toHaveBeenCalled();
  });

  it('rechecks legacy teacher authorization inside the Serializable approval transaction', async () => {
    const draft = await gradingDraft();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValue(draft);
    mocks.prisma.class.findUnique
      .mockResolvedValueOnce({ id: 'class-1', teacherId: 'teacher-1' })
      .mockResolvedValueOnce({ id: 'class-1', teacherId: 'teacher-2' });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-profile-1' });

    const response = await postJson({ gradingRunId: draft.id, decision: 'approved' });

    expect(response.status).toBe(403);
    expect(mocks.prisma.learningFact.createMany).not.toHaveBeenCalled();
    expect(mocks.prisma.$transaction.mock.calls.at(-1)?.[1]).toEqual({ isolationLevel: 'Serializable' });
  });

  it('rejects legacy approval when the student leaves the class inside the transaction', async () => {
    const draft = await gradingDraft();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValue(draft);
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });
    mocks.prisma.studentProfile.findFirst
      .mockResolvedValueOnce({ id: 'student-profile-1' })
      .mockResolvedValueOnce(null);

    const response = await postJson({ gradingRunId: draft.id, decision: 'approved' });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'grading-review-membership-changed' });
    expect(mocks.prisma.learningFact.createMany).not.toHaveBeenCalled();
  });

  it.each([
    [{ unexpected: true }, 'object'],
    [['note'], 'array'],
    ['x'.repeat(2001), 'oversized'],
  ])('rejects invalid approval notes (%s)', async (notes, _label) => {
    const run = pipelineRun();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findUnique.mockResolvedValue(run);
    const response = await postJson({ gradingRunId: run.id, decision: 'approved', notes });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: '审批备注无效' });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('trims approval notes for native and legacy reviews', async () => {
    const run = pipelineRun();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findUnique.mockResolvedValue(run);
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'profile-1' });
    const native = await postJson({ gradingRunId: run.id, decision: 'approved', notes: '  reviewed  ' });
    expect(native.status).toBe(200);
    expect(mocks.prisma.gradingAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ metadata: expect.objectContaining({ notesPresent: true }) }) }));

    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback({ ...mocks.prisma, $transaction: undefined }));
    const draft = await gradingDraft();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.gradingRun.findUnique.mockResolvedValue(null);
    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValue(draft);
    mocks.prisma.learningEvidenceDraft.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.learningFact.createMany.mockResolvedValue({ count: 1 });
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-profile-1' });
    const legacy = await postJson({ gradingRunId: draft.id, decision: 'returned', notes: '  revise  ' });
    expect(legacy.status).toBe(200);
    expect(mocks.prisma.learningEvidenceDraft.updateMany.mock.calls[0][0].data.summary.run.teacherReview.notes).toBe('revise');
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
    expect(mocks.prisma.learningEvidenceDraft.updateMany).not.toHaveBeenCalled();
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
    expect(mocks.prisma.learningEvidenceDraft.updateMany).not.toHaveBeenCalled();
  });

  it('rejects approval replay for already approved grading runs before transaction or fact write', async () => {
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

    const response = await postJson({ gradingRunId: draft.id });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'grading-review-already-approved' });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.prisma.learningEvidenceDraft.updateMany).not.toHaveBeenCalled();
    expect(mocks.prisma.learningFact.createMany).not.toHaveBeenCalled();
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

  it('rejects blocked evaluator grading runs before writeback preview', async () => {
    const draft = await gradingDraft();
    const blockedRun = createDraftRubricGrading({
      convertedDocument: draft.evidenceRefs.convertedDocument as ConvertedDocument,
      rubric: draft.summary.rubric,
      evaluatorOutput: {
        evaluatorId: 'blocked-test-evaluator',
        evaluatorVersion: '2026.06',
        assessments: [],
      },
      now,
    });
    const blockedDraft = {
      ...draft,
      id: blockedRun.id,
      dedupeKey: buildDocumentRubricDraftDedupeKey(draft.sourceRefs.asset as DocumentSubmissionAsset, blockedRun),
      summary: {
        ...draft.summary,
        run: blockedRun,
      },
    };
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValue(blockedDraft);
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-profile-1' });

    const response = await postPreviewJson({ gradingRunId: blockedRun.id });
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual(expect.objectContaining({
      error: '评分草稿存在阻塞的评估器输出，需要重新转换或重新评估后再预览写回',
      reasons: expect.arrayContaining(['criterion-assessment-missing']),
    }));
    expect(mocks.prisma.learningFact.createMany).not.toHaveBeenCalled();
    expect(mocks.prisma.learningEvidenceDraft.update).not.toHaveBeenCalled();
  });

  it('applies teacher edits to writeback preview without persisting them', async () => {
    const draft = await gradingDraft();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.learningEvidenceDraft.findFirst.mockResolvedValue(draft);
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-profile-1' });

    const response = await postPreviewJson({
      gradingRunId: draft.id,
      edits: [{
        criterionId: 'modeling',
        levelId: 'novice',
        score: 1,
        comment: '预览修订：模型说明仍需补充。',
      }],
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual(expect.objectContaining({
      status: 'preview',
      gradingRunId: draft.id,
      wouldCreateFacts: 1,
      blockedFacts: 0,
    }));
    expect(payload.affectedDimensions[0]).toEqual(expect.objectContaining({
      criterionId: 'modeling',
      competencyDimension: 'controlModeling',
      contribution: 0.1,
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
