import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';

const { getServerAuthSession } = vi.hoisted(() => ({ getServerAuthSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getServerAuthSession }));

import { GET as GET_ASSIGNMENT, PATCH as PATCH_ASSIGNMENT } from '../[assignmentId]/route';
import { POST as PUBLISH_ASSIGNMENT } from '../[assignmentId]/publish/route';
import { POST as NEXT_DRAFT } from '../[assignmentId]/next-draft/route';
import { POST as SELECT_CATALOG_QUESTION } from '../question-catalog/route';
import { POST as CREATE_ASSIGNMENT } from '../route';
import { prisma } from '@/lib/prisma';

const enabled = process.env.ASSIGNMENT_REAL_DB_TEST === '1';
const origin = 'https://assignment-real-db.test';
const teacherId = 'assignment-real-db-teacher';
const classId = 'assignment-real-db-class';
const algorithmVersion = 'assignment-real-db-catalog-v1';
const sourceId = 'assignment-real-db-source';
const schemaName = `assignment901_it_${process.pid}_${randomBytes(4).toString('hex')}`;
let adminUrl = '';

describe.runIf(enabled)('assignment authoring self-contained isolated database integration', () => {
  beforeAll(async () => {
    const baseUrl = process.env.ASSIGNMENT_TEST_DATABASE_BASE_URL ?? process.env.DATABASE_URL;
    if (!baseUrl) throw new Error('ASSIGNMENT_TEST_DATABASE_BASE_URL-or-DATABASE_URL-required');
    assertTemporaryAssignmentSchema(schemaName);
    const admin = new URL(baseUrl);
    admin.searchParams.delete('schema');
    adminUrl = admin.toString();
    const schemaUrl = new URL(adminUrl);
    schemaUrl.searchParams.set('schema', schemaName);
    const pool = new Pool({ connectionString: adminUrl });
    try {
      await pool.query(`CREATE SCHEMA "${schemaName}"`);
      process.env.DATABASE_URL = schemaUrl.toString();
      process.env.NEXTAUTH_URL = origin;
      process.env.NEXTAUTH_SECRET = 'assignment-real-db-lineage-secret';
      execFileSync('npx', ['prisma', 'db', 'push', '--url', schemaUrl.toString()], { cwd: process.cwd(), env: process.env, stdio: 'pipe' });
    } catch (error) {
      await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      throw error;
    } finally {
      await pool.end();
    }
    getServerAuthSession.mockResolvedValue({ user: { id: teacherId, role: 'TEACHER' } });
    await prisma.user.create({ data: { id: teacherId, name: '隔离测试教师', role: 'TEACHER' } });
    await prisma.class.create({ data: { id: classId, name: '隔离测试班级', code: 'A901DB', teacherId } });
    await prisma.adaptiveAssessmentAlgorithmVersion.create({ data: { version: algorithmVersion, family: 'assignment-test', parameters: {} } });
    await prisma.adaptiveAssessmentItemRef.create({ data: {
      id: sourceId, questionId: 'control-correction-checkpoint-01', contentHash: '5ae0d4bab205672561a6ea4c82388f21aa876252eeb52e4d71456152c201e1c4',
      source: 'checkpoint-authored-question', questionType: 'subjective-text', domains: ['feedback-control'], knowledgeTags: ['校正'], difficulty: 0.68,
      optionCount: 3, algorithmVersion, metadata: {},
    } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    if (!adminUrl) return;
    assertTemporaryAssignmentSchema(schemaName);
    const pool = new Pool({ connectionString: adminUrl });
    try { await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`); } finally { await pool.end(); }
  });

  it('rejects public and non-temporary cleanup targets', () => {
    expect(() => assertTemporaryAssignmentSchema('public')).toThrow('unsafe-assignment-test-schema');
    expect(() => assertTemporaryAssignmentSchema('assignment_data')).toThrow('unsafe-assignment-test-schema');
  });

  it('persists exact governed lineage and rejects every tampered identity field', async () => {
    const catalogResponse = await SELECT_CATALOG_QUESTION(request('/api/teacher/assignments/question-catalog', 'POST', { sourceId })) as Response;
    expect(catalogResponse.status).toBe(200);
    const { question } = await catalogResponse.json() as { question: Record<string, unknown> & { source: Record<string, unknown> } };
    const expectedSource = {
      parentSourceId: sourceId,
      parentSourceVersion: algorithmVersion,
      parentSourceHash: `sha256:${'5ae0d4bab205672561a6ea4c82388f21aa876252eeb52e4d71456152c201e1c4'}`,
      catalogItemId: 'adaptive-assessment-item:checkpoint-authored-question:control-correction-checkpoint-01',
      originalSourceFamily: 'checkpoint-authored-question', reviewState: 'path-eligible', eligibilityState: 'path-eligible',
      allowedStages: ['checkpoint', 'low-stakes-practice'], limitations: [], selectionProof: expect.stringMatching(/^hmac-sha256:/), contentHash: expect.stringMatching(/^sha256:/),
    };
    expect(question.source).toMatchObject(expectedSource);

    for (const [field, value] of [
      ['selectionProof', `hmac-sha256:${'0'.repeat(64)}`], ['parentSourceHash', `sha256:${'0'.repeat(64)}`],
      ['parentSourceVersion', 'forged-version'], ['reviewState', 'imported-unreviewed'],
    ] as const) {
      const tampered = structuredClone(question);
      tampered.source[field] = value;
      const response = await CREATE_ASSIGNMENT(request('/api/teacher/assignments', 'POST', { draft: draftWith(tampered, `篡改 ${field}`) })) as Response;
      expect(response.status, field).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ error: 'governed-source-mismatch' });
    }

    const authoredQuestion = nonDefaultQuestion(question);
    const createDraft = draftWith(authoredQuestion, '真实数据库作业', '创建阶段的非默认说明。');
    const createResponse = await CREATE_ASSIGNMENT(request('/api/teacher/assignments', 'POST', { draft: createDraft })) as Response;
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json();
    const assignmentId = created.assignment.id as string;
    const revisionId = created.assignment.revisions[0].id as string;
    const createdQuestion = created.assignment.revisions[0].questions[0];
    assertRevisionDraft(created.assignment.revisions[0], createDraft);
    assertPersistedSource(createdQuestion, question.source);
    const createdDerivativeHash = createdQuestion.sourceHash;
    const createdQuestionHash = createdQuestion.contentHash;
    const createdRevisionHash = created.assignment.revisions[0].contentHash;
    expect(createdRevisionHash).toMatch(/^sha256:/);

    const editedQuestion = structuredClone(authoredQuestion);
    editedQuestion.prompt = '编辑后的非默认题面：上传完整设计报告。';
    editedQuestion.referenceAnswer = '编辑后的参考答案：模型、指标、校正参数与验证证据。';
    editedQuestion.rubric.criteria[1].feedbackGuidance = '编辑后反馈：逐项核对验证证据。';
    const editDraft = draftWith(editedQuestion, '真实数据库作业 v2', '编辑后的非默认说明。');
    const editBody = { revisionId, expectedVersion: 1, draft: editDraft };
    const editResponse = await PATCH_ASSIGNMENT(request(`/api/teacher/assignments/${assignmentId}`, 'PATCH', editBody), context(assignmentId)) as Response;
    expect(editResponse.status).toBe(200);
    const edited = await editResponse.json();
    assertRevisionDraft(edited.revision, editDraft);
    assertPersistedSource(edited.revision.questions[0], question.source);
    expect(edited.revision.questions[0].sourceHash).not.toBe(createdDerivativeHash);
    const editedDerivativeHash = edited.revision.questions[0].sourceHash;
    expect(edited.revision.questions[0].contentHash).not.toBe(createdQuestionHash);
    expect(edited.revision.contentHash).not.toBe(createdRevisionHash);
    const editedQuestionHash = edited.revision.questions[0].contentHash;
    const editedRevisionHash = edited.revision.contentHash;
    expect((await PATCH_ASSIGNMENT(request(`/api/teacher/assignments/${assignmentId}`, 'PATCH', editBody), context(assignmentId)) as Response).status).toBe(409);

    const publishResponse = await PUBLISH_ASSIGNMENT(request(`/api/teacher/assignments/${assignmentId}/publish`, 'POST', {
      revisionId, expectedVersion: 2, idempotencyKey: 'assignment-real-db-publish-0001', audiences: [{ classId, availableAt: '2099-01-01T00:00:00.000Z', dueAt: '2099-01-02T00:00:00.000Z' }],
    }), context(assignmentId)) as Response;
    const published = await publishResponse.json();
    expect(publishResponse.status, JSON.stringify(published)).toBe(200);
    assertRevisionDraft(published.revision, editDraft);
    assertPersistedSource(published.revision.questions[0], question.source);
    expect(published.revision.questions[0].sourceHash).toBe(editedDerivativeHash);
    expect(published.revision.questions[0].contentHash).toBe(editedQuestionHash);
    expect(published.revision.contentHash).toBe(editedRevisionHash);

    const reload = await GET_ASSIGNMENT(new Request(`${origin}/api/teacher/assignments/${assignmentId}`), context(assignmentId)) as Response;
    const reloaded = await reload.json();
    expect(reloaded.assignment.revisions[0]).toMatchObject({ id: revisionId, state: 'PUBLISHED', version: 3, frozenAt: expect.any(String) });
    assertRevisionDraft(reloaded.assignment.revisions[0], editDraft);
    assertPersistedSource(reloaded.assignment.revisions[0].questions[0], question.source);
    expect(reloaded.assignment.revisions[0].questions[0].sourceHash).toBe(editedDerivativeHash);
    expect(reloaded.assignment.revisions[0].questions[0].contentHash).toBe(editedQuestionHash);
    expect(reloaded.assignment.revisions[0].contentHash).toBe(editedRevisionHash);
    expect((await PATCH_ASSIGNMENT(request(`/api/teacher/assignments/${assignmentId}`, 'PATCH', { revisionId, expectedVersion: 3, draft: editDraft }), context(assignmentId)) as Response).status).toBe(400);

    const [nextLeft, nextRight] = await Promise.all([
      NEXT_DRAFT(request(`/api/teacher/assignments/${assignmentId}/next-draft`, 'POST', {}), context(assignmentId)),
      NEXT_DRAFT(request(`/api/teacher/assignments/${assignmentId}/next-draft`, 'POST', {}), context(assignmentId)),
    ]) as Response[];
    expect([nextLeft.status, nextRight.status]).toEqual([200, 200]);
    const leftPayload = await nextLeft.json();
    const rightPayload = await nextRight.json();
    expect(leftPayload.revision.id).toBe(rightPayload.revision.id);
    expect(rightPayload.revision.questions).toEqual(leftPayload.revision.questions);
    assertRevisionDraft(leftPayload.revision, editDraft);
    assertPersistedSource(leftPayload.revision.questions[0], question.source);
    expect(leftPayload.revision.questions[0].sourceHash).toBe(editedDerivativeHash);
    expect(leftPayload.revision.questions[0].contentHash).toBe(editedQuestionHash);
    expect(leftPayload.revision.contentHash).toBe(editedRevisionHash);
  });
});

export function assertTemporaryAssignmentSchema(value: string): void {
  if (!/^assignment901_it_[a-zA-Z0-9_]+$/.test(value) || value === 'public') throw new Error('unsafe-assignment-test-schema');
}

function draftWith(question: Record<string, unknown>, title: string, instructions = '真实路由与持久化链路。') {
  return { title, instructions, totalPoints: Number(question.points), latePolicy: { version: 1, mode: 'ALLOW', penaltyPercentPerDay: 2.5 }, responsePolicy: { version: 1, allowedResponseTypes: ['SUBJECTIVE_TEXT', 'SUBJECTIVE_FILE'] }, resubmissionPolicy: { version: 1, maxAttempts: 3, untilDueAt: false }, solutionReleasePolicy: { version: 1, mode: 'AT_TIME', releaseAt: '2099-01-01T12:00:00.000Z', audienceClassIds: [classId], includeReferenceAnswer: true, includeStudentVisibleGuidance: true }, questions: [question] };
}

function nonDefaultQuestion(question: Record<string, unknown> & { source: Record<string, unknown> }) {
  return { ...question, stableQuestionId: 'catalog-non-default-decimal', responseType: 'SUBJECTIVE_FILE', points: 2.5, prompt: '非默认题面：上传校正设计报告。', referenceAnswer: '非默认参考答案：包含模型、参数与验证结果。', rubric: { schemaVersion: 'assignment-analytic-rubric.v1', criteria: [
    { id: 'model-evidence', label: '模型证据', maxPoints: 1.25, evidenceDescription: '提供对象模型与指标证据。', feedbackGuidance: '核对模型来源和指标单位。', studentVisibleGuidance: '说明模型与目标。', levels: [{ id: 'model-high', label: '充分', minPoints: 0.76, maxPoints: 1.25, description: '模型证据完整。' }, { id: 'model-low', label: '待完善', minPoints: 0, maxPoints: 0.75, description: '模型证据存在缺口。' }] },
    { id: 'verification-evidence', label: '验证证据', maxPoints: 1.25, evidenceDescription: '提供校正前后对比。', feedbackGuidance: '核对时域与频域验证。', studentVisibleGuidance: '展示验证过程。', levels: [{ id: 'verification-high', label: '充分', minPoints: 0.51, maxPoints: 1.25, description: '验证证据完整。' }, { id: 'verification-low', label: '待完善', minPoints: 0, maxPoints: 0.5, description: '验证证据存在缺口。' }] },
  ] } };
}

function assertRevisionDraft(revision: Record<string, unknown>, draft: ReturnType<typeof draftWith>) {
  expect(revision).toMatchObject({ title: draft.title, instructions: draft.instructions });
  expect(Number(revision.totalPoints)).toBe(draft.totalPoints);
  expect(revision.latePolicy).toEqual(draft.latePolicy);
  expect(revision.responsePolicy).toEqual(draft.responsePolicy);
  expect(revision.resubmissionPolicy).toEqual(draft.resubmissionPolicy);
  expect(revision.solutionReleasePolicy).toEqual(draft.solutionReleasePolicy);
  const row = (revision.questions as Array<Record<string, unknown>>)[0];
  const expected = draft.questions[0] as Record<string, unknown>;
  expect(row).toMatchObject({ stableQuestionId: expected.stableQuestionId, responseType: expected.responseType });
  expect(Number(row.points)).toBe(expected.points);
  expect(row.promptSnapshot).toEqual({ text: expected.prompt });
  expect(row.answerSnapshot).toEqual({ text: expected.referenceAnswer });
  expect(row.rubricSnapshot).toEqual(expected.rubric);
}

function assertPersistedSource(row: Record<string, unknown>, source: Record<string, unknown>) {
  expect(row).toMatchObject({ sourceId, sourceVersion: algorithmVersion, sourceHash: expect.stringMatching(/^sha256:/), sourceReviewState: source.reviewState, sourceCatalogItemId: source.catalogItemId, sourceOriginalFamily: source.originalSourceFamily, sourceSelectionProof: source.selectionProof, contentHash: expect.stringMatching(/^sha256:/) });
  expect(row.sourceLineage).toMatchObject({ parentSourceId: sourceId, parentSourceVersion: algorithmVersion, parentSourceHash: source.parentSourceHash, catalogItemId: source.catalogItemId, originalSourceFamily: source.originalSourceFamily, reviewState: source.reviewState, eligibilityState: 'path-eligible', allowedStages: ['checkpoint', 'low-stakes-practice'], limitations: [] });
}

function request(path: string, method: string, body: unknown) { return new Request(`${origin}${path}`, { method, headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
function context(assignmentId: string) { return { params: Promise.resolve({ assignmentId }) }; }
