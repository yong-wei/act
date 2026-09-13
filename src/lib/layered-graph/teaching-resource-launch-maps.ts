import {
  resolveInteractiveLessonIdentity,
  type InteractiveLessonIdentityRecord,
} from '@/lib/interactive-lesson-identity';
import { TEXTBOOK_ID_ALIASES } from '@/lib/engineering-textbook-mapping/aliases';
import { resolveLegacyTextbookResource } from '@/lib/engineering-textbook-mapping/legacy-resource-resolutions';
import { buildLessonHandoutPrintPath } from '@/lib/handout-pdf';
import { getRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';
import { unitTokenFromResourceId } from '@/lib/teaching-projection/runtime-full-binding';
import { fromResourceIdToken } from '@/lib/teaching-projection/textbook-locators/identity';
import type { TeachingResourceRuntime } from '@/lib/teaching-projection/contracts';
import type { BindingAnchor } from '@/lib/resource-binding-release/contracts';
import { buildLessonMediaDeepLinkQuery } from '@/features/interactive/shared/lesson-media-deep-link';

import { resolveExerciseStepMapping } from './exercise-step-map';

/** The identity fields launch mapping needs; satisfied by both projection and anchored resources. */
export type LaunchableResource = Pick<TeachingResourceRuntime, 'resourceId' | 'resourceType'> & {
  unitId?: string | null;
};

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

function mediaOrExerciseLessonToken(resourceId: string): string | null {
  const token = resourceId.split(':').slice(2).join(':');
  if (!token) return null;
  if (resolveLessonIdentityFromToken(token)) return token;
  return unitTokenFromResourceId(resourceId);
}

function extractLessonKeyFromResource(
  resource: LaunchableResource,
): string | null {
  if (resource.unitId) return resource.unitId;
  const parts = resource.resourceId.split(':');
  if (parts.length < 3 || parts[0] !== 'act') return null;
  if (resource.resourceType === 'step' || resource.resourceType === 'lesson' || resource.resourceType === 'handout') {
    return parts[2] ?? null;
  }
  return null;
}

function extractStepIdFromResource(
  resource: LaunchableResource,
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
    if (!alias || segments.slice(1).some((segment) => !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(segment))) {
      return null;
    }
    return `/${[
      'textbooks',
      alias.readerBookId,
      encodeURIComponent(alias.edition),
      ...segments.slice(1).map(encodeURIComponent),
    ].join('/')}`;
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
  resources: readonly LaunchableResource[],
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
    const legacyTextbook = resource.resourceType === 'textbook-chapter' || resource.resourceType === 'textbook-section'
      ? resolveLegacyTextbookResource(resource.resourceId) : null;
    if (legacyTextbook) {
      resourceLaunchTargets[resource.resourceId] = '/textbooks/' + [legacyTextbook.bookId, legacyTextbook.edition,
        ...legacyTextbook.structuralPath].map(encodeURIComponent).join('/');
      continue;
    }
    const lessonToken = extractLessonKeyFromResource(resource)
      ?? (['video', 'audio', 'podcast', 'exercise'].includes(resource.resourceType)
        ? mediaOrExerciseLessonToken(resource.resourceId) ?? unitTokenFromResourceId(resource.resourceId)
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

/**
 * Launch address for one anchored binding: the same application route as the
 * resource, plus the position parameter the anchor names. Delivery URLs (OSS,
 * gateway, ESA) never appear here; the lesson entry page resolves media itself.
 */
export function resolveAnchoredLaunchHref(
  resource: LaunchableResource,
  anchor: BindingAnchor,
  baseHref: string | null,
): string | null {
  const lessonToken = extractLessonKeyFromResource(resource)
    ?? (['video', 'audio', 'podcast'].includes(resource.resourceType)
      ? mediaOrExerciseLessonToken(resource.resourceId) ?? unitTokenFromResourceId(resource.resourceId)
      : null);
  const identity = lessonToken ? resolveLessonIdentityFromToken(lessonToken) : null;
  const routeSegment = identity?.routeSegments[0] ?? null;
  const runtimeLessonDir = identity?.runtimeLessonDir ?? lessonToken;
  switch (anchor.kind) {
    case 'step':
      return routeSegment
        ? `/interactive-learning/courses/${routeSegment}/student/demo?step=${encodeURIComponent(anchor.stepId)}`
        : baseHref;
    case 'heading':
      return runtimeLessonDir
        ? `${buildLessonHandoutPrintPath(runtimeLessonDir)}#${encodeURIComponent(anchor.headingId)}`
        : baseHref;
    case 'time': {
      if (!routeSegment) return baseHref;
      const query = buildLessonMediaDeepLinkQuery({
        mediaId: anchor.mediaId,
        startSeconds: anchor.startSeconds,
        mediaSha256: anchor.mediaSha256,
      });
      return `/interactive-learning/courses/${routeSegment}?${query}`;
    }
    case 'section':
    case 'whole':
    default:
      return baseHref;
  }
}

/** Learner-facing anchor label (step number, section title, time range, textbook section). */
export function anchorDisplayLabel(anchor: BindingAnchor): string | null {
  switch (anchor.kind) {
    case 'step':
    case 'heading':
    case 'time':
    case 'section':
      return anchor.label;
    default:
      return null;
  }
}
