import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  resolvePublishedResourceFeature: vi.fn(),
  readPathPlannerLearnerStateForSubject: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getServerAuthSession: mocks.getServerAuthSession }));
vi.mock('@/lib/prisma', () => ({ prisma: { interactionLog: { upsert: mocks.upsert } } }));
vi.mock('@/lib/published-resource-index', () => ({
  resolvePublishedResourceFeature: mocks.resolvePublishedResourceFeature,
}));
vi.mock('@/features/personalization/learner-state/public-api', () => ({
  readPathPlannerLearnerStateForSubject: mocks.readPathPlannerLearnerStateForSubject,
}));

import { POST } from '@/app/api/learning-resources/feedback/route';
import { buildPublishedResourceHref, type PublishedResourceIdentity } from '@/lib/published-resource-reference';

const PROJECTION_HASH = 'a'.repeat(64);
const SNAPSHOT_HASH = 'b'.repeat(64);
const RESOURCE_VERSION = 'd'.repeat(64);
const INDEX_ID = 'c'.repeat(64);

const resourceIdentity: PublishedResourceIdentity = {
  resourceId: 'act:card:feedback-fixture',
  projectionId: `proj-${PROJECTION_HASH}`,
  projectionHash: PROJECTION_HASH,
  snapshotId: `snap-${SNAPSHOT_HASH}`,
  snapshotHash: SNAPSHOT_HASH,
  runtimeReleaseId: null,
};

const resource = {
  identity: resourceIdentity,
  version: RESOURCE_VERSION,
  executable: true,
  canonicalIds: ['kn-feedback'],
};

function postFeedback(body: unknown) {
  return POST(new Request('http://localhost/api/learning-resources/feedback', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    reference: buildPublishedResourceHref(resourceIdentity),
    rating: 'hard',
    eventId: '11111111-1111-4111-8111-111111111111',
    ...overrides,
  };
}

describe('POST /api/learning-resources/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    mocks.resolvePublishedResourceFeature.mockResolvedValue({
      current: true, resource, index: { indexId: INDEX_ID },
    });
    mocks.readPathPlannerLearnerStateForSubject.mockResolvedValue(null);
    mocks.upsert.mockResolvedValue({
      userId: 'student-1', resourceKey: resourceIdentity.resourceId,
      eventData: { rating: 'hard', resourceFeatureRef: { resourceVersion: RESOURCE_VERSION } },
    });
  });

  it('requires an authenticated student and rejects malformed feedback', async () => {
    mocks.getServerAuthSession.mockResolvedValueOnce(null);
    expect((await postFeedback(validBody())).status).toBe(401);
    expect(mocks.upsert).not.toHaveBeenCalled();

    mocks.getServerAuthSession.mockResolvedValueOnce({ user: { id: 'teacher-1', role: 'TEACHER' } });
    expect((await postFeedback(validBody())).status).toBe(403);

    expect((await postFeedback({ ...validBody(), eventId: 'not-a-uuid' })).status).toBe(400);
    expect((await postFeedback({ ...validBody(), rating: 'unknown' })).status).toBe(400);
  });

  it('rejects an invalid or stale published reference before writing', async () => {
    const malformed = await postFeedback({ ...validBody(), reference: '/learning-resources/forged' });
    expect(malformed.status).toBe(409);
    expect(mocks.resolvePublishedResourceFeature).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();

    mocks.resolvePublishedResourceFeature.mockResolvedValueOnce({ current: false, resource, index: { indexId: INDEX_ID } });
    const stale = await postFeedback(validBody({ eventId: '22222222-2222-4222-8222-222222222222' }));
    expect(stale.status).toBe(409);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('uses a stable user-scoped event identity for idempotent retries', async () => {
    const body = validBody();
    expect((await postFeedback(body)).status).toBe(200);
    expect((await postFeedback(body)).status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledTimes(2);
    expect(mocks.upsert.mock.calls[0][0].where).toEqual(mocks.upsert.mock.calls[1][0].where);
    expect(mocks.upsert.mock.calls[0][0].update).toEqual({});
    expect(mocks.upsert.mock.calls[0][0].create).toEqual(expect.objectContaining({
      userId: 'student-1', resourceKey: resourceIdentity.resourceId,
      clientEventId: body.eventId, eventType: 'resource_difficulty_feedback', actorRole: 'STUDENT',
    }));
  });

  it('reports an idempotency conflict when the same event identity has another payload', async () => {
    mocks.upsert.mockResolvedValueOnce({
      userId: 'student-1', resourceKey: resourceIdentity.resourceId,
      eventData: { rating: 'easy', resourceFeatureRef: { resourceVersion: RESOURCE_VERSION } },
    });
    const response = await postFeedback(validBody());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: '该反馈标识已用于另一条记录。' });
  });

  it('stores subjective difficulty feedback without writing mastery evidence', async () => {
    mocks.readPathPlannerLearnerStateForSubject.mockResolvedValue({ knowledgeMastery: {
      tags: { 'kn-feedback': { posteriorMastery: 0.91, confidence: 0.8, evidenceCount: 4 } },
    } });
    const response = await postFeedback(validBody({ eventId: '33333333-3333-4333-8333-333333333333' }));
    expect(response.status).toBe(200);
    expect(mocks.readPathPlannerLearnerStateForSubject).toHaveBeenCalledWith('student-1');
    const create = mocks.upsert.mock.calls[0][0].create;
    expect(create.eventData).toEqual(expect.objectContaining({
      schemaVersion: 'resource-feedback/v1', rating: 'hard',
      resourceFeatureRef: expect.objectContaining({ learnerPreparedness: 0.91 }),
    }));
    expect(create).not.toHaveProperty('mastery');
    expect(create).not.toHaveProperty('learningFact');
    expect(create.eventData).not.toHaveProperty('posteriorMastery');
  });
});
