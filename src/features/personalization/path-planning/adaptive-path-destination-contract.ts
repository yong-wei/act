import { ARENA_CHALLENGE_TASKS } from '@/features/arena/data/seed-challenges';
import { isManifestCourseRouteSegment } from '@/features/interactive/shared/manifest-course-route-segments';
import { isStudentVisiblePathTarget } from '@/lib/student-visible-path-target';
import { parsePublishedResourceHref, PUBLISHED_RESOURCE_LABELS, publishedResourcePathType } from '@/lib/published-resource-reference';
import type { TeachingResourceType } from '@/lib/teaching-projection/contracts';

export type AdaptivePathDestinationDisposition =
  | 'destination-control'
  | 'path-center-explicit'
  | 'path-center-server-evidence'
  | 'external-fallback'
  | 'blocked';

export type AdaptivePathDestinationBlockReason =
  | 'unsafe-external-target'
  | 'invalid-path-center-target'
  | 'unsupported-resource-type'
  | 'non-student-visible-target'
  | 'missing-resource-source-context'
  | 'resource-source-mismatch';

export interface AdaptivePathDestinationContext {
  nodeId?: string | null;
  sourceKind?: string | null;
  sourceRef?: string | null;
}

export interface AdaptivePathDestinationContractResult {
  disposition: AdaptivePathDestinationDisposition;
  canonicalTarget: string | null;
  reason: AdaptivePathDestinationBlockReason | null;
}

const PATH_CENTER_RAW_RESOURCE_TYPES = new Set([
  'knowledge_card',
  'textbook_section',
  'slides',
  'handout',
]);

const INTEGRATED_ARENA_TASK_IDS = new Set(ARENA_CHALLENGE_TASKS.map((task) => task.id));

export function resolveAdaptivePathDestinationContract(
  resourceType: string,
  target: string,
  context: AdaptivePathDestinationContext = {},
): AdaptivePathDestinationContractResult {
  const published = parsePublishedResourceHref(target);
  if (published) {
    const type = published.resourceId.split(':')[1] as TeachingResourceType;
    const nodeId = context.nodeId ?? '';
    if (!(type in PUBLISHED_RESOURCE_LABELS) || publishedResourcePathType(type) !== resourceType
      || context.sourceKind !== 'teaching_projection' || context.sourceRef !== published.resourceId
      || !/^published-resource:[a-f0-9]{64}:act:/.test(nodeId) || !nodeId.endsWith(':' + published.resourceId)) {
      return { disposition: 'blocked', canonicalTarget: null, reason: 'resource-source-mismatch' };
    }
    return { disposition: 'destination-control', canonicalTarget: target, reason: null };
  }
  if (resourceType === 'external_resource') {
    return isSafeExternalTarget(target)
      ? { disposition: 'external-fallback', canonicalTarget: target, reason: null }
      : { disposition: 'blocked', canonicalTarget: null, reason: 'unsafe-external-target' };
  }

  const rawTarget = normalizePathCenterOwnedRawTarget(target);
  if (rawTarget) {
    if (!PATH_CENTER_RAW_RESOURCE_TYPES.has(resourceType)) {
      return { disposition: 'blocked', canonicalTarget: rawTarget, reason: 'unsupported-resource-type' };
    }
    return {
      disposition: ['knowledge_card', 'textbook_section', 'slides', 'handout'].includes(resourceType)
        ? 'path-center-explicit'
        : 'path-center-server-evidence',
      canonicalTarget: rawTarget,
      reason: null,
    };
  }

  const canonicalTarget = canonicalizeAdaptivePathInternalHref(target);
  if (!canonicalTarget) {
    return { disposition: 'blocked', canonicalTarget: null, reason: 'invalid-path-center-target' };
  }
  if (!isStudentVisiblePathTarget(canonicalTarget)) {
    return { disposition: 'blocked', canonicalTarget, reason: 'non-student-visible-target' };
  }

  const pathname = new URL(canonicalTarget, 'https://act.local').pathname;
  let hasVerifiedInteractiveResourceContext = false;
  if (pathname.startsWith('/interactive-learning/resources/')) {
    const sourceResult = validateInteractiveResourceSourceContext(pathname, context);
    if (sourceResult) {
      return { disposition: 'blocked', canonicalTarget, reason: sourceResult };
    }
    hasVerifiedInteractiveResourceContext = true;
  }

  if (!hasIntegratedJourneyDestination(resourceType, canonicalTarget, hasVerifiedInteractiveResourceContext)) {
    return { disposition: 'blocked', canonicalTarget, reason: 'unsupported-resource-type' };
  }
  return { disposition: 'destination-control', canonicalTarget, reason: null };
}

export function resolveAdaptivePathCenterOwnedTargetHref(resourceType: string, target: string): string | null {
  if (resourceType === 'external_resource') return isSafeExternalTarget(target) ? target : null;
  if (!PATH_CENTER_RAW_RESOURCE_TYPES.has(resourceType)) return null;
  return normalizePathCenterOwnedRawTarget(target);
}

export function canonicalizeAdaptivePathInternalHref(target: string): string | null {
  if (!target.startsWith('/') || target.startsWith('//') || target.includes('\\') || /[\s\p{Cc}]/u.test(target)) {
    return null;
  }
  const rawPathname = target.split(/[?#]/, 1)[0] ?? target;
  if (!rawPathname.split('/').filter(Boolean).every((segment) => isSafeEncodedPathSegment(segment))) return null;
  try {
    const parsed = new URL(target, 'https://act.local');
    if (parsed.origin !== 'https://act.local') return null;
    if (!parsed.pathname.split('/').filter(Boolean).every((segment) => isSafeEncodedPathSegment(segment))) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

function normalizePathCenterOwnedRawTarget(target: string): string | null {
  const normalized = target.startsWith('course-content/runtime/')
    ? `/${target.replace(/^course-content\/runtime\//, 'course-runtime/')}`
    : target;
  if (!normalized.startsWith('/') || normalized.startsWith('//') || /[\s\p{Cc}]/u.test(normalized)) return null;
  try {
    const parsed = new URL(normalized, 'https://act.local');
    if (parsed.origin !== 'https://act.local' || !parsed.pathname.startsWith('/course-runtime/')) return null;
    if (!parsed.pathname.split('/').filter(Boolean).every((segment) => isSafeEncodedPathSegment(segment))) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

function isSafeEncodedPathSegment(segment: string): boolean {
  let decoded = segment;
  for (let index = 0; index < 8; index += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      return false;
    }
  }
  try {
    if (decodeURIComponent(decoded) !== decoded) return false;
  } catch {
    return false;
  }
  return decoded !== '..' && !decoded.includes('/') && !decoded.includes('\\') && !/[\p{Cc}]/u.test(decoded);
}

function isSafeExternalTarget(target: string): boolean {
  try {
    const url = new URL(target);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateInteractiveResourceSourceContext(
  pathname: string,
  context: AdaptivePathDestinationContext,
): AdaptivePathDestinationBlockReason | null {
  const match = /^\/interactive-learning\/resources\/([^/]+)$/.exec(pathname);
  if (!match) return 'resource-source-mismatch';
  const resourceId = decodeURIComponent(match[1]);
  const nodeId = context.nodeId?.trim();
  const sourceKind = context.sourceKind?.trim();
  const sourceRef = context.sourceRef?.trim();
  if (!nodeId || !sourceKind || !sourceRef) return 'missing-resource-source-context';
  const expectedNodePrefix = sourceKind === 'resource_registry'
    ? 'registry'
    : sourceKind === 'teaching_resource'
      ? 'teaching-resource'
      : null;
  if (!expectedNodePrefix) return 'resource-source-mismatch';
  return sourceRef === resourceId && nodeId === `${expectedNodePrefix}:${resourceId}`
    ? null
    : 'resource-source-mismatch';
}

export function readGovernedCourseStudentDemoStep(target: string): string | null {
  try {
    const parsed = new URL(target, 'https://act.local');
    const match = /^\/interactive-learning\/courses\/([^/]+)\/student\/demo$/.exec(parsed.pathname);
    if (!match || !isManifestCourseRouteSegment(match[1])) {
      return null;
    }
    const step = parsed.searchParams.get('step')?.trim();
    return step || null;
  } catch {
    return null;
  }
}

function isGovernedCourseStudentDemoStep(target: string): boolean {
  return readGovernedCourseStudentDemoStep(target) !== null;
}

export function isGovernedHandoutPrintTarget(target: string): boolean {
  try {
    const parsed = new URL(target, 'https://act.local');
    return /^\/interactive-learning\/lessons\/[A-Za-z0-9][A-Za-z0-9._-]{0,127}\/handout-print$/.test(parsed.pathname);
  } catch {
    return false;
  }
}

function hasIntegratedJourneyDestination(
  resourceType: string,
  target: string,
  hasVerifiedInteractiveResourceContext: boolean,
): boolean {
  const pathname = new URL(target, 'https://act.local').pathname;
  if (resourceType === 'knowledge_card' || resourceType === 'knowledge_node') {
    return pathname === '/knowledge' || pathname.startsWith('/knowledge/') ||
      (resourceType === 'knowledge_card' && hasVerifiedInteractiveResourceContext);
  }
  if (resourceType === 'interactive_lesson') {
    return pathname.startsWith('/interactive-learning/courses/');
  }
  if (['lesson_step', 'slides', 'handout', 'quiz', 'textbook_section'].includes(resourceType)) {
    return pathname.startsWith('/interactive-learning/resources/')
      || (resourceType === 'quiz' && pathname === '/assessment/adaptive-practice')
      || (resourceType === 'lesson_step' && isGovernedCourseStudentDemoStep(target))
      || (resourceType === 'handout' && isGovernedHandoutPrintTarget(target));
  }
  if (resourceType === 'video' || resourceType === 'audio') {
    const courseSegment = pathname.split('/')[3];
    return (pathname.startsWith('/interactive-learning/courses/') && isManifestCourseRouteSegment(courseSegment))
      || pathname.startsWith('/interactive-learning/resources/');
  }
  if (resourceType === 'exercise') {
    const courseSegment = pathname.split('/')[3];
    return pathname === '/assessment/adaptive-practice'
      || (pathname.startsWith('/interactive-learning/courses/') && isManifestCourseRouteSegment(courseSegment))
      || pathname.startsWith('/profile/growth');
  }
  if (['adaptive_quiz', 'checkpoint', 'reflection', 'konling', 'ai_intervention', 'intervention'].includes(resourceType)) {
    return pathname === '/assessment/adaptive-practice';
  }
  if (resourceType === 'control_workbench') {
    return pathname === '/interactive-learning/control-workbench';
  }
  if (resourceType === 'simulation') {
    return pathname.startsWith('/simulations/')
      || hasVerifiedInteractiveResourceContext
      || isGovernedCourseStudentDemoStep(target);
  }
  if (resourceType === 'arena_task') {
    const match = /^\/arena\/challenges\/([^/?#]+)$/.exec(pathname);
    return Boolean(match?.[1] && INTEGRATED_ARENA_TASK_IDS.has(match[1]));
  }
  return false;
}
