import { describe, expect, it, vi } from 'vitest';

import {
  generatedCoursewareRedisIdentityMatches,
  resolveGeneratedCoursewareSessionBinding,
} from '../classroom-runtime';

const boundSession = {
  id: 'session-1',
  planId: 'projection-plan-v1',
  coursewarePublicationRevisionId: 'publication-v1',
  coursewareDisplayName: '互动课件第1版（基于教案第2版）',
  coursewareRevisionNumber: 1,
  coursewarePlanRevisionNumber: 2,
  manifestHash: 'manifest-v1',
};

const publicationV1 = {
  id: 'publication-v1',
  displayName: boundSession.coursewareDisplayName,
  revisionNumber: 1,
  planRevisionNumber: 2,
  manifestHash: 'manifest-v1',
  projectedLessonPlans: [{
    id: 'projection-plan-v1',
    generatedCoursewareManifestHash: 'manifest-v1',
  }],
};

describe('generated classroom immutable runtime binding', () => {
  it('keeps legacy planId sessions fully compatible without publication queries', async () => {
    const db = runtimeDb(publicationV1);
    await expect(resolveGeneratedCoursewareSessionBinding(db as never, {
      ...boundSession,
      coursewarePublicationRevisionId: null,
      coursewareDisplayName: null,
      coursewareRevisionNumber: null,
      coursewarePlanRevisionNumber: null,
      manifestHash: null,
    })).resolves.toEqual({ ok: true, generated: false, identity: null });
    expect(db.smartCoursewarePublicationRevision.findUnique).not.toHaveBeenCalled();
  });

  it('resolves the exact v1 id even when v2 exists and requires Redis to retain that identity', async () => {
    const db = runtimeDb(publicationV1);
    const result = await resolveGeneratedCoursewareSessionBinding(db as never, boundSession);
    expect(db.smartCoursewarePublicationRevision.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'publication-v1' },
    }));
    expect(result).toMatchObject({ ok: true, identity: {
      publicationRevisionId: 'publication-v1', revisionNumber: 1, manifestHash: 'manifest-v1',
    } });
    if (!result.ok || !result.identity) throw new Error('expected generated identity');
    expect(generatedCoursewareRedisIdentityMatches({
      coursewarePublicationRevisionId: 'publication-v1',
      manifestHash: 'manifest-v1',
      coursewareDisplayName: boundSession.coursewareDisplayName,
      coursewareRevisionNumber: '1',
      coursewarePlanRevisionNumber: '2',
      planId: 'projection-plan-v1',
    }, result.identity)).toBe(true);
    expect(generatedCoursewareRedisIdentityMatches({
      coursewarePublicationRevisionId: 'publication-v2',
      manifestHash: 'manifest-v2',
    }, result.identity)).toBe(false);
  });

  it('returns product recovery and idempotently records manifest corruption', async () => {
    const db = runtimeDb(publicationV1);
    const corrupted = { ...boundSession, manifestHash: 'tampered-manifest' };
    const first = await resolveGeneratedCoursewareSessionBinding(db as never, corrupted);
    const second = await resolveGeneratedCoursewareSessionBinding(db as never, corrupted);
    expect(first).toMatchObject({ ok: false, recovery: {
      kind: 'generated-courseware-integrity-recovery',
      code: 'generated-courseware-manifest-hash-mismatch',
    } });
    expect(second).toEqual(first);
    const fingerprints = db.classSessionIntegrityIncident.upsert.mock.calls.map(([call]) =>
      call.where.sessionId_fingerprint.fingerprint);
    expect(new Set(fingerprints).size).toBe(1);
    expect(db.classSessionIntegrityIncident.upsert).toHaveBeenLastCalledWith(expect.objectContaining({
      update: { occurrenceCount: { increment: 1 } },
    }));
  });

  it('does not accept a projection plan from another publication', async () => {
    const db = runtimeDb(publicationV1);
    const result = await resolveGeneratedCoursewareSessionBinding(db as never, {
      ...boundSession,
      planId: 'projection-plan-v2',
    });
    expect(result).toMatchObject({ ok: false, recovery: {
      code: 'generated-courseware-plan-projection-mismatch',
    } });
  });
});

function runtimeDb(publication: typeof publicationV1 | null) {
  return {
    smartCoursewarePublicationRevision: {
      findUnique: vi.fn().mockResolvedValue(publication),
    },
    classSessionIntegrityIncident: {
      upsert: vi.fn(async ({ create, update }) => ({ ...create, ...update })),
    },
  };
}
