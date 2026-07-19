import { beforeEach, describe, expect, it, vi } from 'vitest';

import { validCompositionInput } from '@/lib/smart-courseware/__tests__/fixtures';
import { SmartCoursewareError } from '@/lib/smart-courseware';
import { splitCoursewareStep } from '@/features/teacher/smart-courseware-editor';

const mocks = vi.hoisted(() => ({
  session: { user: { id: 'teacher-1', role: 'TEACHER' } } as { user?: { id: string; role: string } } | null,
  createDraft: vi.fn(),
  getDraft: vi.fn(),
  updateDraft: vi.fn(),
  getTeacherPreview: vi.fn(),
  getStudentPreview: vi.fn(),
  startJob: vi.fn(), enqueueJob: vi.fn(), getJob: vi.fn(),
  resumeJob: vi.fn(), retryJob: vi.fn(), cancelJob: vi.fn(),
  requestRegeneration: vi.fn(), generateCandidate: vi.fn(), acceptCandidate: vi.fn(),
  approveDraft: vi.fn(),
  orderingSecret: vi.fn(() => 'smart-courseware-route-test-secret-v1'),
}));

vi.mock('@/lib/auth', () => ({ getServerAuthSession: vi.fn(async () => mocks.session) }));
vi.mock('@/lib/prisma', () => ({ prisma: { marker: 'prisma' } }));
vi.mock('@/lib/smart-courseware/student-projection-secret', () => ({
  resolveSmartCoursewareOrderingSecret: mocks.orderingSecret,
}));
vi.mock('@/lib/smart-courseware', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/smart-courseware')>(),
  createSmartCoursewareDraft: mocks.createDraft,
  getSmartCoursewareDraft: mocks.getDraft,
  updateSmartCoursewareComposition: mocks.updateDraft,
  getSmartCoursewareTeacherProjection: mocks.getTeacherPreview,
  getSmartCoursewareStudentProjection: mocks.getStudentPreview,
  startCoursewareGenerationJob: mocks.startJob,
  enqueueCoursewareGenerationJob: mocks.enqueueJob,
  getCoursewareGenerationJob: mocks.getJob,
  resumeCoursewareGenerationJob: mocks.resumeJob,
  retryCoursewareGenerationJob: mocks.retryJob,
  cancelCoursewareGenerationJob: mocks.cancelJob,
  requestCoursewareModuleRegeneration: mocks.requestRegeneration,
  generateCoursewareModuleCandidate: mocks.generateCandidate,
  acceptCoursewareModuleCandidate: mocks.acceptCandidate,
  approveSmartCoursewareDraft: mocks.approveDraft,
}));

import { POST as createDraft } from '../drafts/route';
import { GET as getDraft, PATCH as updateDraft } from '../drafts/[draftId]/route';
import { GET as getTeacherPreview } from '../drafts/[draftId]/previews/teacher/route';
import { GET as getStudentPreview } from '../drafts/[draftId]/previews/student/route';
import { POST as startGeneration } from '../drafts/[draftId]/generation/route';
import { POST as transitionJob } from '../jobs/[jobId]/route';
import { POST as regenerateModule } from '../drafts/[draftId]/modules/[moduleId]/regeneration/route';
import { POST as acceptCandidate } from '../jobs/[jobId]/accept/route';
import { POST as approveDraft } from '../drafts/[draftId]/approve/route';

const context = { params: Promise.resolve({ draftId: 'draft-1' }) };

describe('smart courseware teacher routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = { user: { id: 'teacher-1', role: 'TEACHER' } };
  });

  it('creates an approved-plan-bound draft with an idempotency key', async () => {
    mocks.createDraft.mockResolvedValue({
      id: 'draft-1', planRevisionId: 'revision-1', planRevisionNumber: 2,
      planContentHash: 'hash', state: 'EDITABLE', version: 1,
      ownerId: 'PRIVATE_OWNER', creationIdempotencyKey: 'PRIVATE_KEY',
    });
    const response = await createDraft(new Request('http://localhost/api/teacher/smart-courseware/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ planRevisionId: 'revision-1', idempotencyKey: 'create-key-1' }),
    }));

    expect(response.status).toBe(201);
    expect(mocks.createDraft).toHaveBeenCalledWith(
      { marker: 'prisma' },
      { actor: { id: 'teacher-1', role: 'TEACHER' }, planRevisionId: 'revision-1', idempotencyKey: 'create-key-1' },
    );
    const body = await response.json();
    expect(body.draft).toMatchObject({ id: 'draft-1', planRevisionId: 'revision-1', version: 1 });
    expect(JSON.stringify(body)).not.toContain('PRIVATE_');
  });

  it('reads and updates only the whitelisted draft composition DTO', async () => {
    const row = {
      id: 'draft-1', planRevisionId: 'revision-1', planRevisionNumber: 2,
      planContentHash: 'hash', state: 'READY', version: 2,
      runtimeManifest: validCompositionInput().runtimeManifest,
      modules: [{ teacherMetadata: 'PRIVATE_MODULE' }], ownerId: 'PRIVATE_OWNER',
    };
    mocks.getDraft.mockResolvedValue(row);
    mocks.updateDraft.mockResolvedValue(row);

    const readResponse = await getDraft(new Request('http://localhost'), context);
    expect(readResponse.status).toBe(200);
    expect(JSON.stringify(await readResponse.json())).not.toContain('PRIVATE_');

    const composition = validCompositionInput();
    const updateResponse = await updateDraft(new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(composition),
    }), context);
    expect(updateResponse.status).toBe(200);
    expect(mocks.updateDraft).toHaveBeenCalledWith(
      { marker: 'prisma' },
      expect.objectContaining({ actor: { id: 'teacher-1', role: 'TEACHER' }, draftId: 'draft-1', expectedVersion: composition.expectedVersion }),
    );
  });

  it('submits a duration-preserving non-empty step split through the public PATCH route', async () => {
    const composition = validCompositionInput();
    const sourceStep = composition.runtimeManifest.stages[0].steps[0];
    const split = splitCoursewareStep({
      manifest: composition.runtimeManifest,
      moduleMetadata: composition.moduleMetadata,
      stepId: sourceStep.id,
      newStepId: 'step-split-route',
      newModuleIds: ['module-split-route'],
    });
    expect(split).not.toBeNull();
    mocks.updateDraft.mockResolvedValue({
      id: 'draft-1', planRevisionId: 'revision-1', planRevisionNumber: 1, planContentHash: 'hash',
      state: 'READY', version: 2, runtimeManifest: split!.manifest,
    });
    mocks.getTeacherPreview.mockResolvedValue({ draftId: 'draft-1', version: 2, planRevisionId: 'revision-1', runtimeManifest: split!.manifest, moduleMetadata: split!.moduleMetadata, validation: { valid: true, issues: [] } });
    const response = await updateDraft(new Request('http://localhost', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedVersion: 1, runtimeManifest: split!.manifest, moduleMetadata: split!.moduleMetadata }),
    }), context);
    expect(response.status).toBe(200);
    const submitted = mocks.updateDraft.mock.calls.at(-1)?.[1];
    expect(submitted.runtimeManifest.durationSeconds).toBe(composition.runtimeManifest.durationSeconds);
    expect(submitted.runtimeManifest.stages[0].durationSeconds).toBe(composition.runtimeManifest.stages[0].durationSeconds);
    expect(submitted.runtimeManifest.stages[0].steps[1].modules).toHaveLength(1);
    expect((await response.json()).preview.validation.valid).toBe(true);
  });

  it('keeps teacher sidecars out of the owner-only student preview response', async () => {
    mocks.getTeacherPreview.mockResolvedValue({
      schemaVersion: 'smart-courseware-authoring.v1', draftId: 'draft-1', version: 2,
      planRevisionId: 'revision-1', planContentHash: 'hash', runtimeManifest: {},
      moduleMetadata: [{ moduleId: 'module-1', teacherFields: { referenceAnswer: 'PRIVATE_ANSWER' } }],
      planLimitations: ['PRIVATE_PLAN_LIMITATION'],
      aiReview: { findings: [{ message: 'PRIVATE_AI_FINDING' }], suggestions: [] },
      generationAudit: [{ jobId: 'job-1', attempts: [{ serviceId: 'PRIVATE_PROVIDER', model: 'PRIVATE_MODEL' }] }],
      validation: { valid: true, contentHash: 'hash', issues: [] },
      providerAudit: 'PRIVATE_PROVIDER',
    });
    mocks.getStudentPreview.mockResolvedValue({
      schemaVersion: 'smart-courseware-authoring.v1', draftId: 'draft-1', version: 2,
      runtimeManifest: { steps: [] }, notice: 'ai-assisted-teacher-reviewed',
      moduleMetadata: 'PRIVATE_SIDECAR', providerAudit: 'PRIVATE_PROVIDER',
    });

    const teacherResponse = await getTeacherPreview(new Request('http://localhost'), context);
    const teacherJson = JSON.stringify(await teacherResponse.json());
    expect(teacherJson).toContain('PRIVATE_ANSWER');
    expect(teacherJson).toContain('PRIVATE_PLAN_LIMITATION');
    expect(teacherJson).toContain('PRIVATE_AI_FINDING');
    expect(teacherJson).toContain('PRIVATE_MODEL');
    expect(JSON.stringify(await getStudentPreview(new Request('http://localhost'), context).then((response) => response.json())))
      .not.toContain('PRIVATE_');
    expect(mocks.getStudentPreview).toHaveBeenCalledWith(
      { marker: 'prisma' },
      { actor: { id: 'teacher-1', role: 'TEACHER' }, draftId: 'draft-1' },
      { orderingPermutationSecret: 'smart-courseware-route-test-secret-v1' },
    );
  });

  it('denies student sessions before service access', async () => {
    mocks.session = { user: { id: 'student-1', role: 'STUDENT' } };
    const response = await getStudentPreview(new Request('http://localhost'), context);
    expect(response.status).toBe(403);
    expect(mocks.getStudentPreview).not.toHaveBeenCalled();
  });

  it('fails the student projection boundary closed when the server ordering secret is unavailable', async () => {
    mocks.orderingSecret.mockImplementationOnce(() => {
      throw new SmartCoursewareError('courseware-ordering-secret-unavailable', 503);
    });

    const response = await getStudentPreview(new Request('http://localhost'), context);

    expect(response.status).toBe(503);
    expect(mocks.getStudentPreview).not.toHaveBeenCalled();
  });

  it('does not reveal another teacher draft through the public route', async () => {
    mocks.session = { user: { id: 'teacher-2', role: 'TEACHER' } };
    mocks.getDraft.mockRejectedValueOnce(new SmartCoursewareError('courseware-draft-not-found', 404));
    const response = await getDraft(new Request('http://localhost'), context);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: 'courseware-draft-not-found' } });
  });

  it('starts, enqueues, and resumes generation without exposing job internals', async () => {
    const job = { id: 'job-1', draftId: 'draft-1', state: 'QUEUED', mode: 'FULL', ownerId: 'PRIVATE_OWNER', units: [] };
    mocks.startJob.mockResolvedValue(job);
    mocks.enqueueJob.mockResolvedValue({ queued: true, job });
    const startResponse = await startGeneration(new Request('http://localhost', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idempotencyKey: 'generation-key-1' }),
    }), context);
    expect(startResponse.status).toBe(202);
    expect(JSON.stringify(await startResponse.json())).not.toContain('PRIVATE_OWNER');

    mocks.resumeJob.mockResolvedValue({ ...job, state: 'RUNNING' });
    mocks.enqueueJob.mockResolvedValue({ queued: true, job: { ...job, state: 'RUNNING' } });
    const response = await transitionJob(new Request('http://localhost', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'resume', idempotencyKey: 'resume-key-1' }),
    }), { params: Promise.resolve({ jobId: 'job-1' }) });
    expect(response.status).toBe(200);
    expect(mocks.resumeJob).toHaveBeenCalledWith({ marker: 'prisma' }, expect.objectContaining({ jobId: 'job-1' }));
  });

  it('queues module generation without running the provider in the request and later accepts a candidate', async () => {
    const requested = { id: 'job-module-1', draftId: 'draft-1', state: 'QUEUED', mode: 'MODULE', targetModuleId: 'module-1', units: [] };
    const completed = { ...requested, state: 'COMPLETED', candidateRuntimeModule: { id: 'module-1' }, candidateHash: 'candidate-hash' };
    mocks.requestRegeneration.mockResolvedValue({ job: requested, delivery: { queued: true, errorCode: null } });
    const response = await regenerateModule(new Request('http://localhost', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idempotencyKey: 'regenerate-key-1' }),
    }), { params: Promise.resolve({ draftId: 'draft-1', moduleId: 'module-1' }) });
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ job: { state: 'QUEUED' }, delivery: { queued: true, errorCode: null } });
    expect(mocks.generateCandidate).not.toHaveBeenCalled();

    mocks.acceptCandidate.mockResolvedValue({ ...completed, acceptedAt: new Date('2026-07-19T00:00:00Z') });
    mocks.getTeacherPreview.mockResolvedValue({ draftId: 'draft-1', version: 3, runtimeManifest: {}, moduleMetadata: [], validation: { valid: true, issues: [] } });
    const acceptResponse = await acceptCandidate(new Request('http://localhost', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedDraftVersion: 2, expectedModuleHash: 'module-hash', idempotencyKey: 'accept-key-1' }),
    }), { params: Promise.resolve({ jobId: 'job-module-1' }) });
    expect(acceptResponse.status).toBe(200);
    expect(mocks.acceptCandidate).toHaveBeenCalledWith({ marker: 'prisma' }, expect.objectContaining({ expectedDraftVersion: 2, expectedModuleHash: 'module-hash' }));
    expect((await acceptResponse.json()).preview.version).toBe(3);
  });

  it('returns the MODULE queue delivery failure and retryable job state', async () => {
    const retryable = { id: 'job-module-retry', draftId: 'draft-1', state: 'RETRYABLE', mode: 'MODULE', targetModuleId: 'module-1', units: [] };
    mocks.requestRegeneration.mockResolvedValue({
      job: retryable,
      delivery: { queued: false, errorCode: 'courseware-queue-unavailable' },
    });

    const response = await regenerateModule(new Request('http://localhost', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idempotencyKey: 'regenerate-delivery-failure' }),
    }), { params: Promise.resolve({ draftId: 'draft-1', moduleId: 'module-1' }) });

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({
      job: { id: retryable.id, state: 'RETRYABLE' },
      delivery: { queued: false, errorCode: 'courseware-queue-unavailable' },
    });
  });

  it('approves the whole courseware while returning pending gaps without private approval internals', async () => {
    mocks.approveDraft.mockResolvedValue({
      id: 'courseware-revision-1', draftId: 'draft-1', revisionNumber: 1,
      planRevisionId: 'revision-1', planRevisionNumber: 2, planContentHash: 'plan-hash',
      manifestHash: 'manifest-hash', moduleMetadataHash: 'metadata-hash', contentHash: 'revision-hash',
      gapsSnapshot: [{ moduleId: 'module-1', gapIdentity: 'pending-gap-1' }],
      validationSnapshot: { valid: true }, approvedAt: new Date('2026-07-19T00:00:00Z'),
      ownerId: 'PRIVATE_OWNER', approvalIdempotencyKey: 'PRIVATE_KEY', approvalRequestHash: 'PRIVATE_REQUEST',
    });
    const response = await approveDraft(new Request('http://localhost', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idempotencyKey: 'approve-key-1' }),
    }), context);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.revision.gapsSnapshot).toEqual([{ moduleId: 'module-1', gapIdentity: 'pending-gap-1' }]);
    expect(JSON.stringify(body)).not.toContain('PRIVATE_');
  });
});
