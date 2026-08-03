/**
 * Course and classroom consumers of layered graph + Teaching Projection (#1273).
 */

import type { AuthorityStorePaths } from '@/lib/authoritative-knowledge/authority-store';
import type { TeachingProjectionStorePaths } from '@/lib/teaching-projection/store';

import type {
  LayeredGraphPayload,
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
