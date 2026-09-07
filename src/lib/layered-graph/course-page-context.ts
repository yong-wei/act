/**
 * Server-side course page context for layered graph + Teaching Projection.
 *
 * Resolves active/candidate projection artifacts into a LayeredGraphPayload and
 * maps teaching resources to existing registry / course launch targets. Course
 * pages must receive this payload instead of reconstructing the empty
 * lesson-runtime Legacy adapter on the client.
 */

import path from 'node:path';

import { DEFAULT_AUTHORITY_ROOT_RELATIVE } from '@/lib/authoritative-knowledge/authority-snapshot';
import { resolveAuthorityStorePaths } from '@/lib/authoritative-knowledge/authority-store';
import type { RuntimeLessonEntryBundle } from '@/lib/course-bundle';
import { buildLessonHandoutPrintPath } from '@/lib/handout-pdf';
import {
  resolveInteractiveLessonIdentity,
  type InteractiveLessonIdentityRecord,
} from '@/lib/interactive-lesson-identity';
import { TEXTBOOK_ID_ALIASES } from '@/lib/engineering-textbook-mapping';
import { getRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';
import { unitTokenFromResourceId } from '@/lib/teaching-projection/runtime-full-binding';
import { fromResourceIdToken } from '@/lib/teaching-projection/textbook-locators/identity';
import { buildTextbookReaderHref } from '@/lib/textbook-reader';
import {
  DEFAULT_TEACHING_PROJECTION_RUNTIME_RELATIVE,
  type TeachingCoreNodeRuntime,
  type TeachingResourceRuntime,
} from '@/lib/teaching-projection/contracts';
import { resolveTeachingProjectionStorePaths } from '@/lib/teaching-projection/store';
import {
  isLegacyGraphOverlayReaderPermitted,
  isProductionLegacyFallbackPermitted,
} from '@/lib/legacy-knowledge-runtime-retirement';
import {
  overlayLiveTeachingPins,
  readAgreedLiveCourseProjection,
} from '@/lib/teaching-projection/live-course-pointer';
import {
  projectionPinsFromSelection,
  resolveCourseRuntimeProductionSelection,
} from '@/lib/versioned-knowledge-activation';

import type {
  LayeredGraphPayload,
  LayeredGraphScope,
} from './contracts';
import {
  resolveCourseLayeredGraph,
  type CourseLayeredGraphConsumerInput,
} from './consumers';
import { resolveExerciseStepMapping } from './exercise-step-map';
import { buildCoursePackageLayeredScope } from './scope';

export { buildCoursePackageLayeredScope } from './scope';

export interface CoursePageLayeredGraphContext {
  payload: LayeredGraphPayload;
  scope: LayeredGraphScope;
  resourceLaunchTargets: Record<string, string | null>;
  resourceRegistryIds: Record<string, string>;
  /** True when Teaching Projection source is active/candidate/pinned with ready|fallback status. */
  hasTeachingProjection: boolean;
}

export interface ResolveCoursePageLayeredGraphContextInput {
  scope: LayeredGraphScope;
  /**
   * Optional lesson runtime used only as an explicit Legacy fallback when no
   * active/candidate/pinned Teaching Projection is available.
   */
  lessonRuntime?: RuntimeLessonEntryBundle | null;
  repoRoot?: string;
  authorityRoot?: string;
  projectionRoot?: string;
  authorityPaths?: CourseLayeredGraphConsumerInput['authorityPaths'];
  projectionPaths?: CourseLayeredGraphConsumerInput['projectionPaths'];
  pinnedProjectionId?: string | null;
  pinnedProjectionHash?: string | null;
  candidateProjectionId?: string | null;
  /** Optional Authority pin from a teaching consumer activation (#1276). */
  authoritySnapshotId?: string | null;
  authoritySnapshotHash?: string | null;
  authorityReleaseId?: string | null;
  /**
   * When provided, use this consumer production selection instead of the
   * default course-runtime selection (e.g. Konling injects its own).
   */
  consumerActivationSelection?: ReturnType<
    typeof resolveCourseRuntimeProductionSelection
  > | null;
  /**
   * When true (default), absent projection may fall back to lesson-runtime
   * overlay as an explicit Legacy adapter — never mixed with another release.
   */
  allowLegacyFallback?: boolean;
}

/**
 * Production-preferred Authority root:
 * 1) ACT_AUTHORITY_STORE_ROOT / AUTHORITY_STORE_ROOT env (volume mount)
 * 2) repo default relative path (image-packaged activation gate output)
 */
export function resolveConfiguredAuthorityRoot(repoRoot = process.cwd()): string {
  const fromEnv =
    process.env.ACT_AUTHORITY_STORE_ROOT?.trim()
    || process.env.AUTHORITY_STORE_ROOT?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(repoRoot, DEFAULT_AUTHORITY_ROOT_RELATIVE);
}

/**
 * Production-preferred Teaching Projection root:
 * 1) ACT_TEACHING_PROJECTION_STORE_ROOT / TEACHING_PROJECTION_STORE_ROOT env
 * 2) repo default runtime relative path (image-packaged activation gate output)
 */
export function resolveConfiguredTeachingProjectionRoot(
  repoRoot = process.cwd(),
): string {
  const fromEnv =
    process.env.ACT_TEACHING_PROJECTION_STORE_ROOT?.trim()
    || process.env.TEACHING_PROJECTION_STORE_ROOT?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(repoRoot, DEFAULT_TEACHING_PROJECTION_RUNTIME_RELATIVE);
}

export function resolveDefaultAuthorityStorePaths(repoRoot = process.cwd()) {
  return resolveAuthorityStorePaths(resolveConfiguredAuthorityRoot(repoRoot));
}

export function resolveDefaultTeachingProjectionStorePaths(
  repoRoot = process.cwd(),
) {
  return resolveTeachingProjectionStorePaths(
    resolveConfiguredTeachingProjectionRoot(repoRoot),
  );
}

function resolveLessonIdentityFromToken(
  token: string,
): InteractiveLessonIdentityRecord | null {
  const attempts = [
    { kind: 'runtimeLessonDir' as const, value: token },
    { kind: 'canonicalId' as const, value: token },
    { kind: 'lessonKey' as const, value: token },
    { kind: 'routeSegment' as const, value: token },
  ];
  for (const attempt of attempts) {
    const resolved = resolveInteractiveLessonIdentity(attempt);
    if (resolved.status === 'resolved') {
      return resolved.record;
    }
  }
  return null;
}

function extractLessonKeyFromResource(
  resource: TeachingResourceRuntime,
): string | null {
  const parts = resource.resourceId.split(':');
  // act:<type>:<lessonKey> or act:step:<lessonKey>:<stepId>
  if (parts.length < 3 || parts[0] !== 'act') return null;
  if (resource.resourceType === 'step' || resource.resourceType === 'lesson' || resource.resourceType === 'handout') {
    return parts[2] ?? null;
  }
  return null;
}

function extractStepIdFromResource(
  resource: TeachingResourceRuntime,
): string | null {
  if (resource.resourceType !== 'step') return null;
  const parts = resource.resourceId.split(':');
  return parts[3] ?? null;
}

function textbookSectionReaderHref(resourceId: string): string | null {
  const token = resourceId.slice('act:textbook-section:'.length);
  if (!token || token.includes(':')) return null;
  try {
    const segments = fromResourceIdToken(token).split(':');
    if (segments.length < 2 || segments.some((segment) => !segment)) return null;
    const alias = TEXTBOOK_ID_ALIASES.find((row) => row.readerBookId === segments[0]);
    return alias
      ? buildTextbookReaderHref({
          bookId: alias.readerBookId,
          edition: alias.edition,
          unitPath: segments.slice(1),
        })
      : null;
  } catch {
    return null;
  }
}

function resolveSimulationRegistryId(key: string): string | null {
  const parts = key.split('-');
  for (let length = parts.length; length > 0; length -= 1) {
    const candidate = parts.slice(0, length).join('-');
    if (getRegisteredResourceMetadata(candidate)) return candidate;
  }
  return null;
}

/**
 * Map Teaching Projection resources to existing course/registry launch routes.
 * Never invents routes from Canonical node IDs.
 */
export function buildTeachingResourceLaunchMaps(
  resources: readonly TeachingResourceRuntime[],
  options?: {
    exerciseStepByResourceId?: Readonly<Record<string, {
      lessonKey: string;
      stepId: string;
    }>>;
  },
): {
  resourceLaunchTargets: Record<string, string | null>;
  resourceRegistryIds: Record<string, string>;
} {
  const resourceLaunchTargets: Record<string, string | null> = {};
  const resourceRegistryIds: Record<string, string> = {};

  for (const resource of resources) {
    const lessonToken = extractLessonKeyFromResource(resource)
      ?? (['video', 'audio', 'podcast', 'exercise'].includes(resource.resourceType)
        ? unitTokenFromResourceId(resource.resourceId)
        : null);
    const identity = lessonToken
      ? resolveLessonIdentityFromToken(lessonToken)
      : null;
    const routeSegment = identity?.routeSegments[0] ?? null;
    const runtimeLessonDir = identity?.runtimeLessonDir ?? lessonToken;

    switch (resource.resourceType) {
      case 'lesson':
      case 'video':
      case 'audio':
      case 'podcast': {
        if (routeSegment) {
          resourceLaunchTargets[resource.resourceId] =
            `/interactive-learning/courses/${routeSegment}`;
          resourceRegistryIds[resource.resourceId] = routeSegment;
        }
        break;
      }
      case 'handout': {
        if (runtimeLessonDir) {
          resourceLaunchTargets[resource.resourceId] =
            buildLessonHandoutPrintPath(runtimeLessonDir);
          resourceRegistryIds[resource.resourceId] = `handout:${runtimeLessonDir}`;
        }
        break;
      }
      case 'step': {
        const stepId = extractStepIdFromResource(resource);
        if (routeSegment && stepId) {
          resourceLaunchTargets[resource.resourceId] =
            `/interactive-learning/courses/${routeSegment}/student/demo?step=${stepId}`;
          resourceRegistryIds[resource.resourceId] = `${routeSegment}:${stepId}`;
        }
        break;
      }
      case 'exercise': {
        const mapping = options?.exerciseStepByResourceId?.[resource.resourceId]
          ?? resolveExerciseStepMapping(resource.resourceId);
        const exerciseIdentity = mapping
          ? resolveLessonIdentityFromToken(mapping.lessonKey)
          : null;
        const exerciseRoute = exerciseIdentity?.routeSegments[0];
        if (exerciseRoute && mapping?.stepId) {
          resourceLaunchTargets[resource.resourceId] =
            `/interactive-learning/courses/${exerciseRoute}/student/demo?step=${mapping.stepId}`;
          resourceRegistryIds[resource.resourceId] = `${exerciseRoute}:${mapping.stepId}`;
        } else if (routeSegment) {
          resourceLaunchTargets[resource.resourceId] =
            `/interactive-learning/courses/${routeSegment}`;
          resourceRegistryIds[resource.resourceId] = routeSegment;
        }
        break;
      }
      case 'simulation': {
        if (!resource.resourceId.startsWith('act:simulation:')) break;
        const key = resource.resourceId.slice('act:simulation:'.length);
        if (key.startsWith('arena-task-')) {
          resourceLaunchTargets[resource.resourceId] = `/arena/challenges/task-${key.slice('arena-task-'.length)}`;
          resourceRegistryIds[resource.resourceId] = key;
          break;
        }
        if (key.startsWith('sim-scene-') && getRegisteredResourceMetadata(key)) {
          resourceLaunchTargets[resource.resourceId] = `/simulations/${key.slice('sim-scene-'.length)}`;
          resourceRegistryIds[resource.resourceId] = key;
          break;
        }
        const registryId = resolveSimulationRegistryId(key);
        const metadata = registryId ? getRegisteredResourceMetadata(registryId) : null;
        if (key.startsWith('odyssey-level-') || metadata?.id === 'control-odyssey-v1' || key.includes('control-odyssey')) {
          resourceLaunchTargets[resource.resourceId] = '/interactive-learning/control-odyssey';
          resourceRegistryIds[resource.resourceId] = metadata?.id ?? 'control-odyssey-v1';
        } else if (metadata) {
          resourceLaunchTargets[resource.resourceId] = `/interactive-learning/resources/${metadata.id}`;
          resourceRegistryIds[resource.resourceId] = metadata.id;
        }
        break;
      }
      case 'card':
      case 'infographic': {
        resourceRegistryIds[resource.resourceId] = 'viewer-shell';
        break;
      }
      case 'textbook-section': {
        const href = textbookSectionReaderHref(resource.resourceId);
        if (href) resourceLaunchTargets[resource.resourceId] = href;
        break;
      }
      default:
        break;
    }
  }

  return { resourceLaunchTargets, resourceRegistryIds };
}

function buildLessonRuntimeLegacyProjection(input: {
  lessonRuntime: RuntimeLessonEntryBundle;
  scope: LayeredGraphScope;
}): NonNullable<CourseLayeredGraphConsumerInput['legacyProjection']> {
  const overlay = input.lessonRuntime.graphOverlay;
  const lessonId =
    overlay?.lesson_id
    || input.lessonRuntime.lesson?.lesson_id
    || input.scope.lessonKey
    || 'lesson';
  const projectionId = `legacy-runtime-graph-overlay:${lessonId}`;
  const coreNodes: TeachingCoreNodeRuntime[] =
    (overlay?.nodes ?? []).map((node) => ({
      canonicalId: node.id,
      pathEligible: true,
      cardPolicy: 'optional' as const,
      moduleId: null,
      scopeId: input.scope.scopeId,
      rationale: null,
      projectionStatus: 'PROJECTED' as const,
    }));

  return {
    projectionId,
    projectionHash: `legacy:${lessonId}`,
    authorityReleaseId: 'legacy-runtime-graph-overlay',
    scopeId: input.scope.scopeId,
    resources: [],
    bindings: [],
    prerequisites: [],
    coreNodes,
    cards: [],
    notProjectedCanonicalIds: [],
  };
}

/**
 * Resolve the course-page layered graph context from Authority + Teaching
 * Projection stores. Prefer active/candidate projection; only then allow an
 * explicit lesson-runtime Legacy fallback.
 */
export function resolveCoursePageLayeredGraphContext(
  input: ResolveCoursePageLayeredGraphContextInput,
): CoursePageLayeredGraphContext {
  const repoRoot = input.repoRoot ?? process.cwd();
  const authorityPaths =
    input.authorityPaths
    ?? resolveAuthorityStorePaths(
      input.authorityRoot
        ?? resolveConfiguredAuthorityRoot(repoRoot),
    );
  const projectionPaths =
    input.projectionPaths
    ?? resolveTeachingProjectionStorePaths(
      input.projectionRoot
        ?? resolveConfiguredTeachingProjectionRoot(repoRoot),
    );

  // #1276 course-runtime consumer activation: replacing consumer current.json
  // changes the Authority/Projection combination used by course pages.
  // Prefer an explicit consumer selection injected by Konling (or tests).
  const courseActivation =
    input.consumerActivationSelection
    ?? resolveCourseRuntimeProductionSelection({ repoRoot });
  const coursePins = overlayLiveTeachingPins(
    projectionPinsFromSelection(courseActivation),
    readAgreedLiveCourseProjection(repoRoot, { projectionRoot: projectionPaths.root }),
  );

  // Corrupted / mismatched activation evidence must fail closed — never fall
  // through to global Authority/Projection current pointers.
  if (courseActivation.mode === 'unavailable') {
    const payload = resolveCourseLayeredGraph({
      authorityPaths,
      projectionPaths,
      scope: input.scope,
      // Impossible pins force Authority/Projection load failure.
      candidateProjectionId: '__consumer-activation-unavailable__',
      allowLegacyFallback: false,
      legacyProjection: null,
      authoritySnapshotId: '__consumer-activation-unavailable__',
      authoritySnapshotHash: '0'.repeat(64),
      authorityReleaseId: '__consumer-activation-unavailable__',
    });
    return {
      payload,
      scope: input.scope,
      resourceLaunchTargets: {},
      resourceRegistryIds: {},
      hasTeachingProjection: false,
    };
  }

  let pinnedProjectionId = input.pinnedProjectionId ?? null;
  let pinnedProjectionHash = input.pinnedProjectionHash ?? null;
  let candidateProjectionId = input.candidateProjectionId ?? null;
  let authoritySnapshotId = input.authoritySnapshotId ?? null;
  let authoritySnapshotHash = input.authoritySnapshotHash ?? null;
  let authorityReleaseId = input.authorityReleaseId ?? null;

  if (courseActivation.mode === 'use-combination') {
    // READY combination: force the selected Authority+Projection pair.
    if (coursePins.projectionId) {
      candidateProjectionId = coursePins.projectionId;
      pinnedProjectionId = coursePins.projectionId;
      pinnedProjectionHash = coursePins.projectionHash;
    }
    authoritySnapshotId = coursePins.authoritySnapshotId;
    authoritySnapshotHash = coursePins.authoritySnapshotHash;
    authorityReleaseId = coursePins.authorityReleaseId;
  } else if (courseActivation.mode === 'pin-combination') {
    // PINNED/SHADOW/BLOCKED: force prior combination; clear candidates so
    // resolver cannot prefer a newer projection over the pin.
    candidateProjectionId = null;
    if (coursePins.projectionId) {
      pinnedProjectionId = coursePins.projectionId;
      pinnedProjectionHash = coursePins.projectionHash;
    }
    authoritySnapshotId = coursePins.authoritySnapshotId;
    authoritySnapshotHash = coursePins.authoritySnapshotHash;
    authorityReleaseId = coursePins.authorityReleaseId;
  }
  // mode === 'absent': keep caller / global defaults (no activation store).

  // #1277: after legacy retirement, production dual-authority is refuse-closed.
  // Historical adapters remain available via explicit historical/audit modes.
  const retirementAllowsLegacy =
    isProductionLegacyFallbackPermitted()
    && isLegacyGraphOverlayReaderPermitted();
  const allowLegacyFallback =
    retirementAllowsLegacy && input.allowLegacyFallback !== false;
  const legacyProjection =
    allowLegacyFallback && input.lessonRuntime
      ? buildLessonRuntimeLegacyProjection({
          lessonRuntime: input.lessonRuntime,
          scope: input.scope,
        })
      : null;

  const payload = resolveCourseLayeredGraph({
    authorityPaths,
    projectionPaths,
    scope: input.scope,
    pinnedProjectionId,
    pinnedProjectionHash,
    candidateProjectionId,
    authoritySnapshotId,
    authoritySnapshotHash,
    authorityReleaseId,
    allowLegacyFallback: Boolean(legacyProjection),
    legacyProjection,
  });

  const { resourceLaunchTargets, resourceRegistryIds } =
    buildTeachingResourceLaunchMaps(payload.teachingResources.resources);

  const teachingStatus = payload.teachingResources.identity.status;
  const hasTeachingProjection =
    teachingStatus === 'ready'
    || (teachingStatus === 'fallback'
      && payload.fallback?.kind === 'pinned-previous');

  return {
    payload,
    scope: input.scope,
    resourceLaunchTargets,
    resourceRegistryIds,
    hasTeachingProjection,
  };
}
