import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdaptiveLearnerState } from '@/features/personalization/learner-state/public-api';

const mocks = vi.hoisted(() => ({
  classFindUnique: vi.fn(),
  studentProfileFindFirst: vi.fn(),
  studentProfileFindMany: vi.fn(),
  studentProfileFindUnique: vi.fn(),
  teachingResourceFindMany: vi.fn(),
  isAdaptiveLearnerStateServiceEnabled: vi.fn(),
  readLearnerState: vi.fn(),
  loadAllLessonRuntimeResourceCatalogEntries: vi.fn(),
  loadAllTextbookStructureRuntimeCatalogEntries: vi.fn(),
  loadAllTextbookStructureUnitProjections: vi.fn(),
  loadRuntimeResourceProjectionInputs: vi.fn(),
  getAllRegisteredResourceMetadata: vi.fn(),
  buildResourceNodeRegistryFromTeachingResources: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    class: {
      findUnique: mocks.classFindUnique,
    },
    studentProfile: {
      findFirst: mocks.studentProfileFindFirst,
      findMany: mocks.studentProfileFindMany,
      findUnique: mocks.studentProfileFindUnique,
    },
    teachingResource: {
      findMany: mocks.teachingResourceFindMany,
    },
  },
}));

vi.mock('@/lib/course-bundle', () => ({
  loadAllLessonRuntimeResourceCatalogEntries: mocks.loadAllLessonRuntimeResourceCatalogEntries,
  loadAllTextbookStructureRuntimeCatalogEntries: mocks.loadAllTextbookStructureRuntimeCatalogEntries,
  loadAllTextbookStructureUnitProjections: mocks.loadAllTextbookStructureUnitProjections,
}));

vi.mock('@/lib/resource-registry-metadata', () => ({
  getAllRegisteredResourceMetadata: mocks.getAllRegisteredResourceMetadata,
}));

vi.mock('@/lib/teacher-resource-node-data', () => ({
  buildResourceNodeRegistryFromTeachingResources: mocks.buildResourceNodeRegistryFromTeachingResources,
  loadRuntimeResourceProjectionInputs: mocks.loadRuntimeResourceProjectionInputs,
}));

vi.mock('@/features/personalization/learner-state/public-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/personalization/learner-state/public-api')>();
  return {
    ...actual,
    isAdaptiveLearnerStateServiceEnabled: mocks.isAdaptiveLearnerStateServiceEnabled,
    readLearnerState: mocks.readLearnerState,
  };
});

import { buildGraphCenterCoverageSources } from '../graph-center-sources';

describe('graph center production sources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAdaptiveLearnerStateServiceEnabled.mockReturnValue(true);
    mocks.teachingResourceFindMany.mockResolvedValue([]);
    mocks.loadAllLessonRuntimeResourceCatalogEntries.mockResolvedValue([]);
    mocks.loadAllTextbookStructureRuntimeCatalogEntries.mockResolvedValue([]);
    mocks.loadAllTextbookStructureUnitProjections.mockResolvedValue([]);
    mocks.loadRuntimeResourceProjectionInputs.mockResolvedValue([]);
    mocks.getAllRegisteredResourceMetadata.mockReturnValue([]);
    mocks.buildResourceNodeRegistryFromTeachingResources.mockReturnValue({ resources: {}, nodes: {} });
    mocks.studentProfileFindMany.mockResolvedValue([]);
  });

  it('wires a signed-in student into their learner graph overlay source', async () => {
    const state = learnerState('student-1', 'class-1');
    const runtimeProjection = {
      id: 'runtime-step:1-1:step-01',
      sourceRef: '1-1:step-01',
    };
    mocks.studentProfileFindUnique.mockResolvedValue({ classId: 'class-1' });
    mocks.readLearnerState.mockResolvedValue(state);
    mocks.loadRuntimeResourceProjectionInputs.mockResolvedValue([runtimeProjection]);

    const sources = await buildGraphCenterCoverageSources({
      viewerRole: 'STUDENT',
      viewerUserId: 'student-1',
    });

    expect(sources.learnerOverlay).toMatchObject({
      state,
      requestedLearnerId: 'student-1',
      viewerRole: 'student',
      authorized: true,
    });
    expect(mocks.readLearnerState).toHaveBeenCalledWith({
      userId: 'student-1',
      role: 'student',
      classId: 'class-1',
      goal: 'control-correction',
    });
    expect(mocks.buildResourceNodeRegistryFromTeachingResources).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      expect.any(Array),
      expect.any(Array),
      [runtimeProjection],
    );
  });

  it('surfaces runtime projection sidecar loader failures instead of silently dropping projections', async () => {
    const parseError = new SyntaxError('invalid runtime projection sidecar');
    mocks.loadRuntimeResourceProjectionInputs.mockRejectedValue(parseError);

    await expect(buildGraphCenterCoverageSources({
      viewerRole: 'TEACHER',
      viewerUserId: 'teacher-1',
    })).rejects.toBe(parseError);

    expect(mocks.buildResourceNodeRegistryFromTeachingResources).not.toHaveBeenCalled();
  });

  it('rejects a student learner overlay request for another learner instead of rewriting it', async () => {
    const sources = await buildGraphCenterCoverageSources({
      viewerRole: 'STUDENT',
      viewerUserId: 'student-1',
      requestedLearnerId: 'student-2',
    });

    expect(sources.learnerOverlay).toMatchObject({
      state: null,
      requestedLearnerId: 'student-2',
      viewerRole: 'student',
      authorized: false,
    });
    expect(mocks.studentProfileFindUnique).not.toHaveBeenCalled();
    expect(mocks.readLearnerState).not.toHaveBeenCalled();
  });

  it('wires an owned class into teacher class graph overlay sources', async () => {
    const firstState = learnerState('student-1', 'class-1');
    const secondState = learnerState('student-2', 'class-1');
    mocks.classFindUnique.mockResolvedValue({
      id: 'class-1',
      teacherId: 'teacher-1',
    });
    mocks.studentProfileFindMany.mockResolvedValue([
      { userId: 'student-1' },
      { userId: 'student-2' },
    ]);
    mocks.readLearnerState
      .mockResolvedValueOnce(firstState)
      .mockResolvedValueOnce(secondState);

    const sources = await buildGraphCenterCoverageSources({
      viewerRole: 'TEACHER',
      viewerUserId: 'teacher-1',
      requestedClassId: 'class-1',
    });

    expect(sources.classOverlay).toMatchObject({
      classId: 'class-1',
      viewerRole: 'teacher',
      authorized: true,
      learnerStates: [firstState, secondState],
    });
    expect(mocks.classFindUnique).toHaveBeenCalledWith({
      where: { id: 'class-1' },
      select: { id: true, teacherId: true },
    });
    expect(mocks.studentProfileFindMany).toHaveBeenCalledWith({
      where: { classId: 'class-1' },
      select: { userId: true },
    });
    expect(mocks.readLearnerState).toHaveBeenCalledTimes(2);
    expect(mocks.readLearnerState).toHaveBeenNthCalledWith(1, {
      userId: 'student-1',
      role: 'teacher',
      classId: 'class-1',
      goal: 'control-correction',
    });
  });

  it('wires an owned learner into teacher learner graph overlay sources', async () => {
    const state = learnerState('student-1', 'class-1');
    mocks.classFindUnique.mockResolvedValue({
      id: 'class-1',
      teacherId: 'teacher-1',
    });
    mocks.studentProfileFindFirst.mockResolvedValue({ userId: 'student-1', classId: 'class-1' });
    mocks.readLearnerState.mockResolvedValue(state);

    const sources = await buildGraphCenterCoverageSources({
      viewerRole: 'TEACHER',
      viewerUserId: 'teacher-1',
      requestedClassId: 'class-1',
      requestedLearnerId: 'student-1',
    });

    expect(sources.learnerOverlay).toMatchObject({
      state,
      requestedLearnerId: 'student-1',
      viewerRole: 'teacher',
      authorized: true,
    });
    expect(mocks.studentProfileFindFirst).toHaveBeenCalledWith({
      where: {
        userId: 'student-1',
        classId: 'class-1',
      },
      select: { userId: true, classId: true },
    });
    expect(mocks.readLearnerState).toHaveBeenCalledWith({
      userId: 'student-1',
      role: 'teacher',
      classId: 'class-1',
      goal: 'control-correction',
    });
    expect(mocks.studentProfileFindMany).not.toHaveBeenCalled();
    expect(sources.classOverlay).toBeUndefined();
  });

  it('does not read learner membership before teacher class ownership is proven', async () => {
    mocks.classFindUnique.mockResolvedValue({
      id: 'class-1',
      teacherId: 'teacher-2',
    });

    const sources = await buildGraphCenterCoverageSources({
      viewerRole: 'TEACHER',
      viewerUserId: 'teacher-1',
      requestedClassId: 'class-1',
      requestedLearnerId: 'student-1',
    });

    expect(sources.learnerOverlay).toMatchObject({
      requestedLearnerId: 'student-1',
      viewerRole: 'teacher',
      authorized: false,
      state: null,
    });
    expect(mocks.studentProfileFindFirst).not.toHaveBeenCalled();
    expect(mocks.readLearnerState).not.toHaveBeenCalled();
  });

  it('does not read learner states for a teacher outside the requested class scope', async () => {
    mocks.classFindUnique.mockResolvedValue({
      id: 'class-1',
      teacherId: 'teacher-2',
    });

    const sources = await buildGraphCenterCoverageSources({
      viewerRole: 'TEACHER',
      viewerUserId: 'teacher-1',
      requestedClassId: 'class-1',
    });

    expect(sources.classOverlay).toMatchObject({
      classId: 'class-1',
      viewerRole: 'teacher',
      authorized: false,
      learnerStates: [],
    });
    expect(mocks.classFindUnique).toHaveBeenCalledWith({
      where: { id: 'class-1' },
      select: { id: true, teacherId: true },
    });
    expect(mocks.studentProfileFindMany).not.toHaveBeenCalled();
    expect(mocks.readLearnerState).not.toHaveBeenCalled();
  });
});

function learnerState(userId: string, classId: string): AdaptiveLearnerState {
  return {
    userId,
    roleScope: {
      role: 'student',
      classId,
      privacyScopes: ['student-visible'],
    },
    generatedAt: '2026-06-21T00:00:00.000Z',
  } as AdaptiveLearnerState;
}
