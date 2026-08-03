/**
 * Course and classroom consumers of layered graph + Teaching Projection (#1273).
 */

import type { AuthorityStorePaths } from '@/lib/authoritative-knowledge/authority-store';
import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import type { TeachingProjectionStorePaths } from '@/lib/teaching-projection/store';

import type {
  LayeredGraphAuthorityInput,
  LayeredGraphPayload,
  LayeredGraphProjectionInput,
  LayeredGraphResolveRequest,
  LayeredGraphScope,
} from './contracts';
import {
  resolveStepDrawerContent,
  resolveStepDrawerEntries,
  type ResolveStepDrawerInput,
  type StepDrawerResolution,
} from './drawer';
import { buildLayeredGraphPayload } from './payload';
import {
  resolveLayeredGraphAuthorityInput,
  resolveTeachingProjectionForScope,
} from './resolver';

export interface CourseLayeredGraphConsumerInput {
  authorityPaths: AuthorityStorePaths;
  projectionPaths: TeachingProjectionStorePaths;
  scope: LayeredGraphScope;
  /** Pin used when active projection is unavailable. */
  pinnedProjectionId?: string | null;
  pinnedProjectionHash?: string | null;
  candidateProjectionId?: string | null;
  allowLegacyFallback?: boolean;
  legacyProjection?: Parameters<
    typeof resolveTeachingProjectionForScope
  >[0]['legacyProjection'];
}

/**
 * Resolve a course/classroom scoped layered payload.
 * Engineering loads independently; teaching is scoped and never mixed.
 */
export function resolveCourseLayeredGraph(
  input: CourseLayeredGraphConsumerInput,
): LayeredGraphPayload {
  const authority = resolveLayeredGraphAuthorityInput(input.authorityPaths);
  const request: LayeredGraphResolveRequest = {
    scope: input.scope,
    includeTeaching: true,
    pinnedProjectionId: input.pinnedProjectionId,
    pinnedProjectionHash: input.pinnedProjectionHash,
    candidateProjectionId: input.candidateProjectionId,
    allowLegacyFallback: input.allowLegacyFallback ?? false,
    requiredAuthorityReleaseId: authority.releaseId,
  };
  const projection = resolveTeachingProjectionForScope({
    projectionPaths: input.projectionPaths,
    request,
    legacyProjection: input.legacyProjection,
  });
  return buildLayeredGraphPayload({ authority, projection, request });
}

/**
 * Engineering-only consumer: teaching layers report absent without blocking.
 */
export function resolveEngineeringOnlyLayeredGraph(input: {
  authorityPaths: AuthorityStorePaths;
  projectionPaths: TeachingProjectionStorePaths;
}): LayeredGraphPayload {
  const authority = resolveLayeredGraphAuthorityInput(input.authorityPaths);
  const request: LayeredGraphResolveRequest = {
    includeTeaching: false,
  };
  const projection = resolveTeachingProjectionForScope({
    projectionPaths: input.projectionPaths,
    request,
  });
  return buildLayeredGraphPayload({ authority, projection, request });
}

/**
 * Course lesson/step resource resolution used by runtime entry points.
 */
export function resolveCourseScopeResources(input: {
  payload: LayeredGraphPayload;
  lessonKey?: string | null;
  stepId?: string | null;
}): {
  resources: LayeredGraphPayload['teachingResources']['resources'];
  bindings: LayeredGraphPayload['teachingResources']['bindings'];
  status: string;
  projectionId: string | null;
  scopeId: string | null;
} {
  let resources = input.payload.teachingResources.resources;
  let bindings = input.payload.teachingResources.bindings;

  if (input.stepId) {
    resources = resources.filter(
      (resource) =>
        resource.resourceType !== 'step'
        || resource.resourceId.endsWith(`:${input.stepId}`)
        || resource.resourceId.includes(`:${input.stepId}`),
    );
    const resourceIds = new Set(resources.map((resource) => resource.resourceId));
    bindings = bindings.filter((binding) => resourceIds.has(binding.resourceId));
  } else if (input.lessonKey) {
    resources = resources.filter(
      (resource) =>
        resource.resourceId.includes(`:${input.lessonKey}`)
        || resource.sourcePath?.includes(input.lessonKey!) === true,
    );
    const resourceIds = new Set(resources.map((resource) => resource.resourceId));
    bindings = bindings.filter((binding) => resourceIds.has(binding.resourceId));
  }

  return {
    resources,
    bindings,
    status: input.payload.teachingResources.identity.status,
    projectionId: input.payload.teachingResources.identity.projectionId,
    scopeId: input.payload.teachingResources.identity.scopeId,
  };
}

/**
 * Classroom knowledge drawer: step knowledgeRefs → optional card / summary.
 */
export function resolveClassroomStepDrawer(
  input: ResolveStepDrawerInput,
): StepDrawerResolution | null {
  return resolveStepDrawerContent(input);
}

export function resolveClassroomStepDrawerEntries(
  input: Omit<ResolveStepDrawerInput, 'selectedCanonicalId'>,
): StepDrawerResolution[] {
  return resolveStepDrawerEntries(input);
}

/**
 * Map lesson-runtime graph-overlay groups to step knowledgeRefs (Canonical IDs).
 * Mirrors StepKnowledgeDrawer legacy step→node resolution, including step-N
 * sequence translation when overlay step ids are legacy numbered placeholders.
 */
export function extractStepKnowledgeRefsFromLessonRuntime(
  lessonRuntime: RuntimeLessonEntryBundle,
  currentStepId: string,
  orderedStepIds: readonly string[],
): string[] {
  const directMap = new Map<string, string[]>();

  for (const group of lessonRuntime.graphOverlay.groups) {
    for (const stepId of group.step_ids) {
      directMap.set(stepId, [...group.node_ids]);
    }
  }

  if (orderedStepIds.every((stepId) => directMap.has(stepId))) {
    return directMap.get(currentStepId) ?? [];
  }

  const flatStepIds = lessonRuntime.graphOverlay.groups.flatMap(
    (group) => group.step_ids,
  );
  const looksLikeLegacySequence = flatStepIds.every((stepId) =>
    /^step-\d+$/i.test(stepId),
  );
  if (!looksLikeLegacySequence || flatStepIds.length !== orderedStepIds.length) {
    return directMap.get(currentStepId) ?? [];
  }

  const fallbackMap = new Map<string, string[]>();
  for (const group of lessonRuntime.graphOverlay.groups) {
    const translatedStepIds = group.step_ids
      .map((stepId) => {
        const match = /^step-(\d+)$/i.exec(stepId);
        if (!match) return null;
        const index = Number(match[1]) - 1;
        return orderedStepIds[index] ?? null;
      })
      .filter((stepId): stepId is string => Boolean(stepId));

    for (const stepId of translatedStepIds) {
      fallbackMap.set(stepId, [...group.node_ids]);
    }
  }

  return fallbackMap.get(currentStepId) ?? [];
}

/**
 * Legacy adapter payload from lesson runtime graph overlay so shipped course
 * pages can run the layered drawer path before Teaching Projection stores are
 * activated. Explicit fallback provenance — never mixed with another release.
 */
export function buildLessonRuntimeLayeredPayload(input: {
  lessonRuntime: RuntimeLessonEntryBundle;
  scope: LayeredGraphScope;
}): LayeredGraphPayload {
  const lessonId =
    input.lessonRuntime.graphOverlay.lesson_id
    || input.lessonRuntime.lesson.lesson_id
    || input.scope.lessonKey
    || 'lesson';
  const projectionId = `legacy-runtime-graph-overlay:${lessonId}`;
  const authority: LayeredGraphAuthorityInput = {
    status: 'unavailable',
    releaseId: null,
    releaseSetId: null,
    snapshotId: null,
    snapshotHash: null,
    engineering: null,
    reason: 'course-page-uses-lesson-runtime-legacy-adapter',
  };
  const projection: LayeredGraphProjectionInput = {
    status: 'fallback',
    source: 'legacy',
    projectionId,
    projectionHash: null,
    authorityReleaseId: null,
    scopeId: input.scope.scopeId,
    manifest: null,
    resources: [],
    bindings: [],
    prerequisites: [],
    coreNodes: input.lessonRuntime.graphOverlay.nodes.map((node) => ({
      canonicalId: node.id,
      pathEligible: true,
      cardPolicy: 'optional' as const,
      moduleId: null,
      scopeId: input.scope.scopeId,
      rationale: null,
      projectionStatus: 'PROJECTED' as const,
    })),
    cards: [],
    notProjectedCanonicalIds: [],
    reasons: ['using-lesson-runtime-graph-overlay-legacy'],
    fallback: {
      kind: 'legacy',
      adapterId: 'legacy-lesson-runtime-graph-overlay',
      authorityReleaseId: null,
      projectionId,
      projectionHash: null,
      scopeId: input.scope.scopeId,
      reasons: ['using-lesson-runtime-graph-overlay-legacy'],
    },
  };
  return buildLayeredGraphPayload({
    authority,
    projection,
    request: {
      scope: input.scope,
      includeTeaching: true,
    },
  });
}

/**
 * Course/classroom page entry: resolve layered drawer entries for the current
 * step via step.knowledgeRefs → canonicalId → optional card.
 *
 * When a Teaching Projection `payload` is provided it is used; otherwise the
 * lesson-runtime graph overlay is adapted as an explicit Legacy fallback so the
 * shipped StepKnowledgeDrawer path still exercises the layered resolver.
 */
export function resolveCoursePageLayeredDrawerEntries(input: {
  lessonRuntime: RuntimeLessonEntryBundle;
  currentStepId: string;
  orderedStepIds: readonly string[];
  scope: LayeredGraphScope;
  /** Optional pre-resolved Teaching Projection layered payload. */
  payload?: LayeredGraphPayload | null;
  resourceLaunchTargets?: ResolveStepDrawerInput['resourceLaunchTargets'];
  resourceRegistryIds?: ResolveStepDrawerInput['resourceRegistryIds'];
}): StepDrawerResolution[] {
  const knowledgeRefs = extractStepKnowledgeRefsFromLessonRuntime(
    input.lessonRuntime,
    input.currentStepId,
    input.orderedStepIds,
  );
  if (knowledgeRefs.length === 0) return [];

  const payload =
    input.payload
    ?? buildLessonRuntimeLayeredPayload({
      lessonRuntime: input.lessonRuntime,
      scope: {
        ...input.scope,
        stepId: input.currentStepId,
        knowledgeRefs,
      },
    });

  const canonicalTitles: Record<string, string> = {};
  const canonicalDescriptions: Record<string, string> = {};
  for (const node of input.lessonRuntime.graphOverlay.nodes) {
    canonicalTitles[node.id] = node.name;
    if (node.description) {
      canonicalDescriptions[node.id] = node.description;
    }
  }

  return resolveClassroomStepDrawerEntries({
    payload,
    stepId: input.currentStepId,
    knowledgeRefs,
    resourceLaunchTargets: input.resourceLaunchTargets,
    resourceRegistryIds: input.resourceRegistryIds,
    canonicalTitles,
    canonicalDescriptions,
  });
}
