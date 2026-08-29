import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  courseBundleRevision: {
    findUnique: vi.fn(),
    aggregate: vi.fn(),
    create: vi.fn(),
  },
  classSessionIntegrityIncident: {
    upsert: vi.fn(),
  },
}));

vi.mock('server-only', () => ({}));

import { prisma } from '@/lib/prisma';
vi.mock('@/lib/prisma', () => ({
  prisma: {
    courseBundleRevision: mocks.courseBundleRevision,
    classSessionIntegrityIncident: mocks.classSessionIntegrityIncident,
  },
}));

import type { CourseBundleIdentity } from '../course-bundle/contract';
import {
  classifySessionBundleBinding,
  generatedCoursewareBundleIdentity,
  persistCourseBundleRevision,
  planProjectionBundleIdentity,
  verifySessionCourseBundleBinding,
} from '../course-bundle/session-binding';

function identity(overrides: Partial<CourseBundleIdentity> = {}): CourseBundleIdentity {
  return {
    bundleId: '1-1',
    canonicalLessonId: '1-1',
    runtimeReleaseId: 'rel-1',
    runtimeTreeSha256: 't'.repeat(64),
    runtimeManifestSha256: 'm'.repeat(64),
    runtimeSourceRevision: 'rev-1',
    runtimeObjectLocator: null,
    bundleDigest: 'd'.repeat(64),
    identityProjectionHash: 'i'.repeat(64),
    manifestHash: 'c'.repeat(64),
    resourceHashes: {
      schemaVersion: 'course-bundle-resource-hashes.v1',
      lesson: 'a'.repeat(64),
      graphOverlay: 'b'.repeat(64),
    },
    ...overrides,
  };
}

function persistedRevision(value: Partial<Record<string, unknown>> = {}) {
  const base = identity();
  return {
    id: 'rev-id',
    bundleId: base.bundleId,
    canonicalLessonId: base.canonicalLessonId,
    bundleRevision: 1,
    runtimeReleaseId: base.runtimeReleaseId,
    runtimeTreeSha256: base.runtimeTreeSha256,
    runtimeManifestSha256: base.runtimeManifestSha256,
    runtimeSourceRevision: base.runtimeSourceRevision,
    runtimeObjectLocator: base.runtimeObjectLocator,
    bundleDigest: base.bundleDigest,
    identityProjectionHash: base.identityProjectionHash,
    manifestHash: base.manifestHash,
    resourceHashes: base.resourceHashes,
    qualification: 'course-bundle-revision-v1',
    capturedAt: new Date(0),
    ...value,
  };
}

const tx = mocks as unknown as {
  courseBundleRevision: typeof mocks.courseBundleRevision;
};

describe('persistCourseBundleRevision', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('reuses the existing revision for identical content and locator (content addressing)', async () => {
    mocks.courseBundleRevision.findUnique.mockResolvedValue(persistedRevision());
    const revision = await persistCourseBundleRevision(tx as never, identity());
    expect(revision.id).toBe('rev-id');
    expect(mocks.courseBundleRevision.create).not.toHaveBeenCalled();
    expect(mocks.courseBundleRevision.findUnique).toHaveBeenCalledWith({
      where: {
        bundleId_bundleDigest_runtimeReleaseId_runtimeTreeSha256: {
          bundleId: '1-1',
          bundleDigest: 'd'.repeat(64),
          runtimeReleaseId: 'rel-1',
          runtimeTreeSha256: 't'.repeat(64),
        },
      },
    });
  });

  it('does not reuse a revision when only the release locator changed', async () => {
    mocks.courseBundleRevision.findUnique.mockResolvedValue(null);
    mocks.courseBundleRevision.aggregate.mockResolvedValue({ _max: { bundleRevision: 1 } });
    mocks.courseBundleRevision.create.mockResolvedValue(persistedRevision({ bundleRevision: 2 }));
    await persistCourseBundleRevision(tx as never, identity({
      runtimeReleaseId: 'rel-2',
      runtimeTreeSha256: 'n'.repeat(64),
    }));
    expect(mocks.courseBundleRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ runtimeReleaseId: 'rel-2', bundleRevision: 2 }),
      }),
    );
  });

  it('allocates the next monotonic revision for new content', async () => {
    mocks.courseBundleRevision.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mocks.courseBundleRevision.aggregate.mockResolvedValue({ _max: { bundleRevision: 3 } });
    mocks.courseBundleRevision.create.mockResolvedValue(persistedRevision({ bundleRevision: 4 }));
    const revision = await persistCourseBundleRevision(tx as never, identity());
    expect(mocks.courseBundleRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ bundleRevision: 4, bundleId: '1-1' }),
      }),
    );
    expect(revision.bundleRevision).toBe(4);
  });

  it('stores Prisma.JsonNull when the unreleased worktree locator is absent', async () => {
    mocks.courseBundleRevision.findUnique.mockResolvedValue(null);
    mocks.courseBundleRevision.aggregate.mockResolvedValue({ _max: { bundleRevision: 0 } });
    mocks.courseBundleRevision.create.mockResolvedValue(persistedRevision());
    await persistCourseBundleRevision(tx as never, identity({ runtimeObjectLocator: null }));
    expect(mocks.courseBundleRevision.create.mock.calls[0][0].data.runtimeObjectLocator).toBe(Prisma.JsonNull);
  });

  it('recovers when a concurrent writer inserts the same digest first', async () => {
    const raced = persistedRevision({ bundleRevision: 2 });
    mocks.courseBundleRevision.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(raced);
    mocks.courseBundleRevision.aggregate.mockResolvedValue({ _max: { bundleRevision: 1 } });
    const violation = Object.assign(new Error('unique'), { code: 'P2002' });
    mocks.courseBundleRevision.create.mockRejectedValue(violation);
    const revision = await persistCourseBundleRevision(tx as never, identity());
    expect(revision).toBe(raced);
  });
});

describe('verifySessionCourseBundleBinding', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns the revision when denormalized fields match', async () => {
    const revision = persistedRevision();
    mocks.courseBundleRevision.findUnique.mockResolvedValue(revision);
    const verified = await verifySessionCourseBundleBinding(prisma as never, {
      id: 'session-1',
      courseBundleRevisionId: 'rev-id',
      bundleRuntimeReleaseId: 'rel-1',
      bundleDigest: 'd'.repeat(64),
      manifestHash: 'c'.repeat(64),
    });
    expect(verified).toBe(revision);
  });

  it('fails closed when the revision record is missing', async () => {
    mocks.courseBundleRevision.findUnique.mockResolvedValue(null);
    await expect(verifySessionCourseBundleBinding(prisma as never, {
      id: 'session-1',
      courseBundleRevisionId: 'gone',
      bundleRuntimeReleaseId: 'rel-1',
      bundleDigest: 'd'.repeat(64),
      manifestHash: 'c'.repeat(64),
    })).rejects.toThrow(/missing course bundle revision/);
    expect(mocks.classSessionIntegrityIncident.upsert).toHaveBeenCalled();
  });

  it('fails closed on denormalized release drift and never falls back to plan/title', async () => {
    mocks.courseBundleRevision.findUnique.mockResolvedValue(persistedRevision());
    await expect(verifySessionCourseBundleBinding(prisma as never, {
      id: 'session-1',
      courseBundleRevisionId: 'rev-id',
      bundleRuntimeReleaseId: 'rel-switched',
      bundleDigest: 'd'.repeat(64),
      manifestHash: 'c'.repeat(64),
    })).rejects.toThrow(/drifted/);
  });

  it('fails closed on digest drift', async () => {
    mocks.courseBundleRevision.findUnique.mockResolvedValue(persistedRevision());
    await expect(verifySessionCourseBundleBinding(prisma as never, {
      id: 'session-1',
      courseBundleRevisionId: 'rev-id',
      bundleRuntimeReleaseId: 'rel-1',
      bundleDigest: 'x'.repeat(64),
      manifestHash: 'c'.repeat(64),
    })).rejects.toThrow(/drifted/);
  });

  it('rejects a session without any binding instead of guessing', async () => {
    await expect(verifySessionCourseBundleBinding(prisma as never, {
      id: 'session-legacy',
      courseBundleRevisionId: null,
      bundleRuntimeReleaseId: null,
      bundleDigest: null,
      manifestHash: null,
    })).rejects.toThrow(/no course bundle binding/);
  });
});

describe('session bundle classification', () => {
  it('classifies missing bindings as legacy-incomplete', () => {
    expect(classifySessionBundleBinding({
      id: 's1',
      courseBundleRevisionId: null,
      bundleRuntimeReleaseId: null,
      bundleDigest: null,
      manifestHash: null,
    })).toBe('legacy-incomplete');
    expect(classifySessionBundleBinding({
      id: 's2',
      courseBundleRevisionId: 'rev',
      bundleRuntimeReleaseId: 'rel',
      bundleDigest: 'd',
      manifestHash: null,
    })).toBe('bound');
  });
});

describe('plan projection bundle identity', () => {
  it('excludes the mutable title and covers item ordering and references', () => {
    const a = planProjectionBundleIdentity('plan-1', [
      { stage: 'BRIDGE_IN', order: 2, resourceId: 'r2', knowledgeNodeId: null, overrideConfig: null },
      { stage: 'BRIDGE_IN', order: 1, resourceId: 'r1', knowledgeNodeId: null, overrideConfig: null },
    ]);
    const b = planProjectionBundleIdentity('plan-1', [
      { stage: 'BRIDGE_IN', order: 1, resourceId: 'r1', knowledgeNodeId: null, overrideConfig: null },
      { stage: 'BRIDGE_IN', order: 2, resourceId: 'r2', knowledgeNodeId: null, overrideConfig: null },
    ]);
    const changed = planProjectionBundleIdentity('plan-1', [
      { stage: 'BRIDGE_IN', order: 1, resourceId: 'r1-changed', knowledgeNodeId: null, overrideConfig: null },
      { stage: 'BRIDGE_IN', order: 2, resourceId: 'r2', knowledgeNodeId: null, overrideConfig: null },
    ]);
    expect(a.bundleDigest).toBe(b.bundleDigest);
    expect(a.bundleDigest).not.toBe(changed.bundleDigest);
    expect(a.bundleId).toBe('plan:plan-1');
  });
});

describe('generated courseware bundle identity', () => {
  it('mirrors the publication revision contract', () => {
    const identityValue = generatedCoursewareBundleIdentity({
      id: 'pub-1',
      manifestHash: 'm'.repeat(64),
      contentHash: 'c'.repeat(64),
      sourceRevision: 'src-1',
    });
    expect(identityValue.bundleDigest).toBe('c'.repeat(64));
    expect(identityValue.manifestHash).toBe('m'.repeat(64));
    expect(identityValue.runtimeReleaseId).toBe('pub-1');
    expect(identityValue.bundleId).toBe('generated-courseware:pub-1');
  });
});
