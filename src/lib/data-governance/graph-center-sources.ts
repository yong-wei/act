import 'server-only';

import { prisma } from '@/lib/prisma';
import {
  loadAllLessonRuntimeResourceCatalogEntries,
  type RuntimeLessonResourceCatalogEntry,
} from '@/lib/course-runtime';
import { getAllRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';
import {
  loadAllTextbookRuntimeResourceCatalogEntries,
  loadAllTextbookRuntimeSearchDocuments,
  type TextbookRuntimeResourceCatalogEntry,
  type TextbookRuntimeSearchDocument,
} from '@/lib/textbook-runtime-resources';
import {
  buildResourceNodeRegistryFromTeachingResources,
  loadRuntimeResourceProjectionInputs,
} from '@/lib/teacher-resource-node-data';
import type { RegisteredResourceNodeInput, ResourceNodeRegistry } from '@/lib/resource-node-registry';
import {
  CONTROL_CORRECTION_GOAL_ID,
  isAdaptiveLearnerStateServiceEnabled,
  readAdaptiveLearnerState,
  type AdaptiveLearnerStateRole,
} from './adaptive-learner-state-service';
import { textbookSearchDocumentsToLearningEvidenceCorpus } from './graph-center-evidence';
import {
  canReadGraphCenterClassOverlay,
  canReadGraphCenterLearnerOverlay,
  type GraphCenterClassOverlayInput,
  type GraphCenterLearnerOverlayInput,
  type ResourceFieldCompletionGraphSummary,
} from './graph-center';
import type { LearningEvidenceCorpusChunk } from './learning-evidence-rag-corpus';
import {
  teachingResourceWhereForGraphCenter,
  type GraphCenterViewerRole,
} from './graph-center-source-scope';
import resourceFieldCompletionSummary from '../../../course-content/runtime/resource-governance/resource-field-completion-summary.json';

export interface GraphCenterCoverageSources {
  resourceRegistry: ResourceNodeRegistry;
  evidenceCorpus: LearningEvidenceCorpusChunk[];
  learnerOverlay?: GraphCenterLearnerOverlayInput;
  classOverlay?: GraphCenterClassOverlayInput;
  resourceFieldCompletionSummary?: ResourceFieldCompletionGraphSummary;
}

interface TeachingResourceForGraphCenter {
  id: string;
  title: string;
  displayName: string | null;
  description: string | null;
  type: string;
  registryId: string | null;
  content: string | null;
  category: string | null;
  teacherOnly: boolean | null;
  config: unknown;
  knowledgeNodes: Array<{
    id: string;
    name: string;
    resources: unknown;
    tags: string[];
  }>;
}

export async function buildGraphCenterCoverageSources(input: {
  viewerRole: GraphCenterViewerRole;
  viewerUserId?: string | null;
  requestedLearnerId?: string | null;
  requestedClassId?: string | null;
}): Promise<GraphCenterCoverageSources> {
  const [teachingResources, runtimeLessons, runtimeTextbooks, runtimeResourceProjections, textbookDocuments, overlays] = await Promise.all([
    loadTeachingResourcesForGraphCenter(input.viewerRole, input.viewerUserId),
    loadAllLessonRuntimeResourceCatalogEntries().catch((): RuntimeLessonResourceCatalogEntry[] => []),
    loadAllTextbookRuntimeResourceCatalogEntries().catch((): TextbookRuntimeResourceCatalogEntry[] => []),
    loadRuntimeResourceProjectionInputs(),
    loadAllTextbookRuntimeSearchDocuments().catch((): TextbookRuntimeSearchDocument[] => []),
    buildGraphCenterOverlaySources(input),
  ]);
  const registeredResources = getAllRegisteredResourceMetadata();

  return {
    resourceRegistry: buildResourceNodeRegistryFromTeachingResources(
      teachingResources,
      registeredResources as RegisteredResourceNodeInput[],
      runtimeLessons,
      runtimeTextbooks,
      runtimeResourceProjections,
    ),
    evidenceCorpus: textbookSearchDocumentsToLearningEvidenceCorpus(textbookDocuments),
    resourceFieldCompletionSummary: resourceFieldCompletionSummary as unknown as ResourceFieldCompletionGraphSummary,
    ...overlays,
  };
}

async function buildGraphCenterOverlaySources(input: {
  viewerRole: GraphCenterViewerRole;
  viewerUserId?: string | null;
  requestedLearnerId?: string | null;
  requestedClassId?: string | null;
}): Promise<Pick<GraphCenterCoverageSources, 'learnerOverlay' | 'classOverlay'>> {
  const viewerRole = normalizeLearnerStateRole(input.viewerRole);
  if (!viewerRole || !input.viewerUserId || !isAdaptiveLearnerStateServiceEnabled()) {
    return {};
  }

  const requestedLearnerId = normalizeRequestId(input.requestedLearnerId);
  const [learnerOverlay, classOverlay] = await Promise.all([
    buildLearnerOverlayInput({
      viewerRole,
      viewerUserId: input.viewerUserId,
      requestedLearnerId,
      requestedClassId: input.requestedClassId,
    }),
    requestedLearnerId
      ? Promise.resolve(undefined)
      : buildClassOverlayInput({
          viewerRole,
          viewerUserId: input.viewerUserId,
          requestedClassId: input.requestedClassId,
        }),
  ]);

  return {
    ...(learnerOverlay ? { learnerOverlay } : {}),
    ...(classOverlay ? { classOverlay } : {}),
  };
}

async function buildLearnerOverlayInput(input: {
  viewerRole: AdaptiveLearnerStateRole;
  viewerUserId: string;
  requestedLearnerId?: string | null;
  requestedClassId?: string | null;
}): Promise<GraphCenterLearnerOverlayInput | undefined> {
  const requestedLearnerId = input.viewerRole === 'student'
    ? normalizeRequestId(input.requestedLearnerId) ?? input.viewerUserId
    : normalizeRequestId(input.requestedLearnerId);
  if (!requestedLearnerId) return undefined;

  if (input.viewerRole === 'student' && requestedLearnerId !== input.viewerUserId) {
    return {
      state: null,
      requestedLearnerId,
      viewerRole: input.viewerRole,
      authorized: false,
    };
  }

  const requestedClassId = normalizeRequestId(input.requestedClassId);
  const scope = await resolveLearnerOverlayScope({
    viewerRole: input.viewerRole,
    viewerUserId: input.viewerUserId,
    requestedLearnerId,
    requestedClassId,
  });
  const authorized = canReadGraphCenterLearnerOverlay({
    viewerRole: input.viewerRole,
    viewerUserId: input.viewerUserId,
    requestedLearnerId,
    teacherLearnerIds: scope.teacherLearnerIds,
  });

  if (!authorized) {
    return {
      state: null,
      requestedLearnerId,
      viewerRole: input.viewerRole,
      authorized: false,
    };
  }

  const state = await readAdaptiveLearnerState(prisma, {
    userId: requestedLearnerId,
    role: input.viewerRole,
    classId: scope.classId,
    goal: CONTROL_CORRECTION_GOAL_ID,
  });

  return {
    state,
    requestedLearnerId,
    classId: scope.classId,
    viewerRole: input.viewerRole,
    authorized: true,
  };
}

async function resolveLearnerOverlayScope(input: {
  viewerRole: AdaptiveLearnerStateRole;
  viewerUserId: string;
  requestedLearnerId: string;
  requestedClassId: string | null;
}): Promise<{
  classId: string | null;
  teacherLearnerIds?: string[];
}> {
  if (input.viewerRole === 'student') {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: input.viewerUserId },
      select: { classId: true },
    });
    return { classId: profile?.classId ?? null };
  }

  if (input.viewerRole === 'teacher') {
    if (!input.requestedClassId) return { classId: null, teacherLearnerIds: [] };
    const classData = await prisma.class.findUnique({
      where: { id: input.requestedClassId },
      select: { id: true, teacherId: true },
    });
    if (classData?.teacherId !== input.viewerUserId) {
      return { classId: null, teacherLearnerIds: [] };
    }

    const studentProfile = await prisma.studentProfile.findFirst({
      where: {
        userId: input.requestedLearnerId,
        classId: input.requestedClassId,
      },
      select: { userId: true, classId: true },
    });
    const authorized = Boolean(studentProfile);
    return {
      classId: authorized ? input.requestedClassId : null,
      teacherLearnerIds: authorized ? [input.requestedLearnerId] : [],
    };
  }

  const profile = input.requestedClassId
    ? await prisma.studentProfile.findFirst({
        where: {
          userId: input.requestedLearnerId,
          classId: input.requestedClassId,
        },
        select: { classId: true },
      })
    : await prisma.studentProfile.findUnique({
        where: { userId: input.requestedLearnerId },
        select: { classId: true },
      });
  return { classId: profile?.classId ?? input.requestedClassId };
}

async function buildClassOverlayInput(input: {
  viewerRole: AdaptiveLearnerStateRole;
  viewerUserId: string;
  requestedClassId?: string | null;
}): Promise<GraphCenterClassOverlayInput | undefined> {
  const requestedClassId = normalizeRequestId(input.requestedClassId);
  if (!requestedClassId || input.viewerRole === 'student') return undefined;

  const classData = await prisma.class.findUnique({
    where: { id: requestedClassId },
    select: { id: true, teacherId: true },
  });
  const teacherClassIds = classData?.teacherId === input.viewerUserId ? [requestedClassId] : [];
  const authorized = Boolean(classData) && canReadGraphCenterClassOverlay({
    viewerRole: input.viewerRole,
    requestedClassId,
    teacherClassIds,
  });

  if (!classData || !authorized) {
    return {
      classId: requestedClassId,
      viewerRole: input.viewerRole,
      authorized: false,
      learnerStates: [],
    };
  }

  const studentProfiles = await prisma.studentProfile.findMany({
    where: { classId: requestedClassId },
    select: { userId: true },
  });
  const learnerStates = await Promise.all(
    studentProfiles.map((student) => readAdaptiveLearnerState(prisma, {
      userId: student.userId,
      role: input.viewerRole,
      classId: requestedClassId,
      goal: CONTROL_CORRECTION_GOAL_ID,
    })),
  );

  return {
    classId: requestedClassId,
    viewerRole: input.viewerRole,
    authorized: true,
    learnerStates,
  };
}

function normalizeLearnerStateRole(role: GraphCenterViewerRole): AdaptiveLearnerStateRole | null {
  if (role === 'ADMIN') return 'admin';
  if (role === 'TEACHER') return 'teacher';
  if (role === 'STUDENT') return 'student';
  return null;
}

function normalizeRequestId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function loadTeachingResourcesForGraphCenter(
  viewerRole: GraphCenterViewerRole,
  viewerUserId?: string | null,
): Promise<TeachingResourceForGraphCenter[]> {
  const where = teachingResourceWhereForGraphCenter(viewerRole, viewerUserId);
  if (where === null) return [];
  return prisma.teachingResource.findMany({
    where,
    include: {
      knowledgeNodes: {
        select: {
          id: true,
          name: true,
          resources: true,
          tags: true,
        },
      },
    },
    orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }, { title: 'asc' }],
  }) as Promise<TeachingResourceForGraphCenter[]>;
}
