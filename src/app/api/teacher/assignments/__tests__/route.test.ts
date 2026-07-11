import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NEXTAUTH_SECRET ??= 'assignment-route-test-lineage-secret';

const { getServerAuthSession, createAssignmentDraft, createNextDraftRevision, updateAssignmentDraft, publishAssignmentRevision, findFirstAssignment, findCatalogRef, findCatalogRefs, findManagedClasses } = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  createAssignmentDraft: vi.fn(),
  createNextDraftRevision: vi.fn(),
  updateAssignmentDraft: vi.fn(),
  publishAssignmentRevision: vi.fn(),
  findFirstAssignment: vi.fn(),
  findCatalogRef: vi.fn(),
  findCatalogRefs: vi.fn(),
  findManagedClasses: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getServerAuthSession }));
vi.mock('@/lib/assignments/assignment-service', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/assignments/assignment-service')>(),
  createAssignmentDraft,
  createNextDraftRevision,
  updateAssignmentDraft,
  publishAssignmentRevision,
}));
vi.mock('@/lib/prisma', () => ({ prisma: { assignment: { findMany: vi.fn(async () => []), findFirst: findFirstAssignment }, adaptiveAssessmentItemRef: { findUnique: findCatalogRef, findMany: findCatalogRefs }, class: { findMany: findManagedClasses } } }));

import { POST } from '../route';
import { POST as POST_NEXT_DRAFT } from '../[assignmentId]/next-draft/route';
import { GET as GET_ASSIGNMENT, PATCH as PATCH_ASSIGNMENT } from '../[assignmentId]/route';
import { POST as PUBLISH_ASSIGNMENT } from '../[assignmentId]/publish/route';
import { GET as LIST_CATALOG_QUESTIONS, POST as SELECT_CATALOG_QUESTION } from '../question-catalog/route';
import { GET as LIST_MANAGED_CLASSES } from '../managed-classes/route';

function draft() {
  return {
    title: '控制系统作业', instructions: '完成分析。', totalPoints: 20,
    latePolicy: { version: 1, mode: 'CLOSED' },
    responsePolicy: { version: 1, allowedResponseTypes: ['SUBJECTIVE_TEXT'] },
    resubmissionPolicy: { version: 1, maxAttempts: 1, untilDueAt: true },
    solutionReleasePolicy: { version: 1, mode: 'PRIVATE' },
    questions: [{
      stableQuestionId: 'question-1', responseType: 'SUBJECTIVE_TEXT', points: 20,
      prompt: '说明校正过程。', referenceAnswer: '给出校正网络和验证结果。',
      source: { family: 'MANUAL', authoringMarker: 'assignment-authoring' },
      rubric: { schemaVersion: 'assignment-analytic-rubric.v1', criteria: [{
        id: 'design', label: '设计', maxPoints: 20, evidenceDescription: '可复核设计证据。', feedbackGuidance: '指出设计缺口。',
        levels: [{ id: 'complete', label: '完整', minPoints: 0, maxPoints: 20, description: '证据完整。' }],
      }] },
    }],
  };
}

function post(body: unknown, origin = 'https://act.example') {
  return new Request('https://act.example/api/teacher/assignments', {
    method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(body),
  });
}

describe('teacher assignment mutation route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    createAssignmentDraft.mockResolvedValue({ id: 'assignment-1' });
    createNextDraftRevision.mockResolvedValue({ id: 'revision-2', state: 'DRAFT', revisionNumber: 2 });
    updateAssignmentDraft.mockResolvedValue({ id: 'revision-1', state: 'DRAFT', version: 2 });
    publishAssignmentRevision.mockResolvedValue({ id: 'revision-1', state: 'PUBLISHED', version: 3, frozenAt: new Date('2026-07-11T00:00:00Z') });
    findFirstAssignment.mockResolvedValue({ id: 'assignment-1', revisions: [{ id: 'revision-1', state: 'PUBLISHED', version: 3, frozenAt: new Date('2026-07-11T00:00:00Z'), questions: [], audiences: [] }] });
    findCatalogRef.mockResolvedValue({ id: 'source-1', questionId: 'control-correction-checkpoint-01', contentHash: '5ae0d4bab205672561a6ea4c82388f21aa876252eeb52e4d71456152c201e1c4', algorithmVersion: 'catalog-v1' });
    findCatalogRefs.mockResolvedValue([
      { id: 'source-1', questionId: 'control-correction-checkpoint-01', contentHash: '5ae0d4bab205672561a6ea4c82388f21aa876252eeb52e4d71456152c201e1c4', algorithmVersion: 'catalog-v1' },
      { id: 'source-ineligible', questionId: 'AC-Q-0001', contentHash: 'd71f098353d20cf581944978fa5b2883cef1e7ca3fc37653b81b2837cbd5f0ac', algorithmVersion: 'catalog-v1' },
    ]);
    findManagedClasses.mockResolvedValue([{ id: 'class-1', name: '自控 2401', code: 'AC2401', year: '2026', semester: '春' }]);
  });

  it('requires authentication and teacher authorization', async () => {
    getServerAuthSession.mockResolvedValue(null);
    expect(((await POST(post({ draft: draft() }))) as Response).status).toBe(401);
    getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    expect(((await POST(post({ draft: draft() }))) as Response).status).toBe(403);
  });

  it('rejects cross-origin mutations before calling the service', async () => {
    const response = await POST(post({ draft: draft() }, 'https://evil.example')) as Response;
    expect(response.status).toBe(400);
    expect(createAssignmentDraft).not.toHaveBeenCalled();
  });

  it('rejects unknown runtime-schema fields with no partial mutation', async () => {
    const response = await POST(post({ draft: draft(), forgedRole: 'ADMIN' })) as Response;
    expect(response.status).toBe(400);
    expect(createAssignmentDraft).not.toHaveBeenCalled();
  });

  it('returns an explicit 400 for duplicate stable question ids', async () => {
    const duplicate = draft();
    duplicate.questions = [duplicate.questions[0], duplicate.questions[0]];
    const response = await POST(post({ draft: duplicate })) as Response;
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'invalid-payload', details: expect.arrayContaining(['duplicate-stable-question-id']) });
    expect(createAssignmentDraft).not.toHaveBeenCalled();
  });

  it('creates a bounded authorized draft', async () => {
    const response = await POST(post({ courseContext: 'feedback-control', draft: draft() })) as Response;
    expect(response.status).toBe(201);
    expect(createAssignmentDraft).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      actor: { id: 'teacher-1', role: 'TEACHER' }, courseContext: 'feedback-control',
    }));
  });

  it('enforces the actual UTF-8 body bound without trusting Content-Length', async () => {
    const request = new Request('https://act.example/api/teacher/assignments', {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://act.example' },
      body: JSON.stringify({ padding: '界'.repeat(100_000) }),
    });
    expect(request.headers.get('content-length')).toBeNull();
    const response = await POST(request) as Response;
    expect(response.status).toBe(413);
    expect(createAssignmentDraft).not.toHaveBeenCalled();
  });

  it('uses the protected idempotent next-draft service for published editing', async () => {
    const response = await POST_NEXT_DRAFT(new Request('https://act.example/api/teacher/assignments/assignment-1/next-draft', {
      method: 'POST', headers: { origin: 'https://act.example' },
    }), { params: Promise.resolve({ assignmentId: 'assignment-1' }) }) as Response;
    expect(response.status).toBe(200);
    expect(createNextDraftRevision).toHaveBeenCalledWith(expect.anything(), { actor: { id: 'teacher-1', role: 'TEACHER' }, assignmentId: 'assignment-1' });
  });

  it('wires create, edit, conflict, publish, and immutable reload through real route handlers', async () => {
    expect((await POST(post({ draft: draft() })) as Response).status).toBe(201);
    const patchRequest = () => new Request('https://act.example/api/teacher/assignments/assignment-1', { method: 'PATCH', headers: { origin: 'https://act.example' }, body: JSON.stringify({ revisionId: 'revision-1', expectedVersion: 1, draft: draft() }) });
    expect((await PATCH_ASSIGNMENT(patchRequest(), { params: Promise.resolve({ assignmentId: 'assignment-1' }) }) as Response).status).toBe(200);
    updateAssignmentDraft.mockRejectedValueOnce(new (await import('@/lib/assignments/assignment-domain')).AssignmentDomainError('version-conflict'));
    expect((await PATCH_ASSIGNMENT(patchRequest(), { params: Promise.resolve({ assignmentId: 'assignment-1' }) }) as Response).status).toBe(409);
    const publish = new Request('https://act.example/api/teacher/assignments/assignment-1/publish', { method: 'POST', headers: { origin: 'https://act.example' }, body: JSON.stringify({ revisionId: 'revision-1', expectedVersion: 2, idempotencyKey: 'publish-assignment-route-1', audiences: [{ classId: 'class-1', availableAt: '2026-07-12T00:00:00.000Z', dueAt: '2026-07-13T00:00:00.000Z' }] }) });
    expect((await PUBLISH_ASSIGNMENT(publish, { params: Promise.resolve({ assignmentId: 'assignment-1' }) }) as Response).status).toBe(200);
    const reload = await GET_ASSIGNMENT(new Request('https://act.example/api/teacher/assignments/assignment-1'), { params: Promise.resolve({ assignmentId: 'assignment-1' }) }) as Response;
    expect(reload.status).toBe(200);
    await expect(reload.json()).resolves.toMatchObject({ assignment: { revisions: [{ state: 'PUBLISHED', version: 3, frozenAt: expect.any(String) }] } });
  });

  it('materializes a complete assignment-owned derivative instead of trusting preview lineage', async () => {
    const response = await SELECT_CATALOG_QUESTION(new Request('https://act.example/api/teacher/assignments/question-catalog', { method: 'POST', headers: { origin: 'https://act.example' }, body: JSON.stringify({ sourceId: 'source-1' }) })) as Response;
    expect(response.status).toBe(200);
    const payload = await response.json() as { question: Record<string, unknown> & { source: Record<string, unknown> } };
    expect(payload.question.referenceAnswer).toContain('A');
    expect(payload.question.source).toMatchObject({ family: 'ASSIGNMENT_DERIVATIVE', parentSourceId: 'source-1', parentSourceVersion: 'catalog-v1', catalogItemId: 'adaptive-assessment-item:checkpoint-authored-question:control-correction-checkpoint-01', originalSourceFamily: 'checkpoint-authored-question', reviewState: 'path-eligible', eligibilityState: 'path-eligible', limitations: [] });
    expect(payload.question.source).toHaveProperty('parentSourceHash');
    expect(payload.question.source).toHaveProperty('contentHash');
    expect(payload.question.source).toHaveProperty('selectionProof');
  });

  it('rejects an imported-unreviewed catalog item server-side', async () => {
    findCatalogRef.mockResolvedValueOnce({ id: 'source-ineligible', questionId: 'AC-Q-0001', contentHash: 'd71f098353d20cf581944978fa5b2883cef1e7ca3fc37653b81b2837cbd5f0ac', algorithmVersion: 'catalog-v1' });
    const response = await SELECT_CATALOG_QUESTION(new Request('https://act.example/api/teacher/assignments/question-catalog', { method: 'POST', headers: { origin: 'https://act.example' }, body: JSON.stringify({ sourceId: 'source-ineligible' }) })) as Response;
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'catalog-item-ineligible', details: expect.arrayContaining(['not-path-eligible']) });
  });

  it('omits imported-unreviewed items from the assignment authoring catalog list', async () => {
    const response = await LIST_CATALOG_QUESTIONS() as Response;
    expect(response.status).toBe(200);
    const payload = await response.json() as { items: Array<{ sourceId: string }> };
    expect(payload.items.some((item) => item.sourceId === 'source-1')).toBe(true);
    expect(payload.items.some((item) => item.sourceId === 'source-ineligible')).toBe(false);
  });

  it('returns only the authenticated teacher managed active classes', async () => {
    const response = await LIST_MANAGED_CLASSES() as Response;
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ classes: [{ id: 'class-1', name: '自控 2401', code: 'AC2401', year: '2026', semester: '春' }] });
    expect(findManagedClasses).toHaveBeenCalledWith(expect.objectContaining({ where: { teacherId: 'teacher-1', isActive: true }, select: { id: true, name: true, code: true, year: true, semester: true } }));
  });
});
