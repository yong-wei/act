/**
 * Production binding for Konling Teaching Projection (#1274 P1).
 *
 * Server-side only: resolves Authority + Teaching Projection into a layered
 * payload for Konling runtime entry points. Client hints remain advisory;
 * authorization is revalidated against the resolved scope.
 *
 * Production artifact roots (in order):
 * 1. explicit layeredGraphPayload from a trusted server caller
 * 2. ACT_AUTHORITY_STORE_ROOT / ACT_TEACHING_PROJECTION_STORE_ROOT env mounts
 * 3. image-packaged defaults under course-content/... (activation-gate output)
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildCoursePackageLayeredScope,
  resolveConfiguredAuthorityRoot,
  resolveConfiguredTeachingProjectionRoot,
  resolveCoursePageLayeredGraphContext,
} from '@/lib/layered-graph/course-page-context';
import type { LayeredGraphPayload, LayeredGraphScope } from '@/lib/layered-graph/contracts';
import { resolveInteractiveLessonIdentity } from '@/lib/interactive-lesson-identity';
import {
  overlayLiveTeachingPins,
  readAgreedLiveCourseProjection,
} from '@/lib/teaching-projection/live-course-pointer';
import {
  projectionPinsFromSelection,
  resolveKonlingProductionSelection,
} from '@/lib/versioned-knowledge-activation';

import type { KonlingTeachingProjectionClientHints } from '@/lib/konling-teaching-projection-context';

export interface KonlingTeachingProjectionBinding {
  payload: LayeredGraphPayload | null;
  scope: LayeredGraphScope | null;
  permittedScopeIds: string[];
  authorized: boolean;
  /** How the binding was obtained. */
  source:
    | 'explicit-payload'
    | 'course-page-layered-graph'
    | 'absent-no-course'
    | 'production-artifacts-missing'
    | 'resolve-failed';
  reasons: string[];
  /** Resolved production store roots (for diagnostics / tests). */
  authorityRoot?: string | null;
  projectionRoot?: string | null;
}

function storePointerPresent(root: string): boolean {
  return existsSync(join(root, 'current.json'));
}

function resolvePackageCanonicalId(courseId: string): {
  packageCanonicalId: string;
  lessonKey: string | null;
} {
  const attempts = [
    { kind: 'routeSegment' as const, value: courseId },
    { kind: 'canonicalId' as const, value: courseId },
    { kind: 'lessonKey' as const, value: courseId },
    { kind: 'runtimeLessonDir' as const, value: courseId },
    { kind: 'presetKey' as const, value: courseId },
  ];
  for (const attempt of attempts) {
    const resolved = resolveInteractiveLessonIdentity(attempt);
    if (resolved.status === 'resolved') {
      return {
        packageCanonicalId: resolved.record.canonicalId,
        lessonKey:
          resolved.record.runtimeLessonDir
          || resolved.record.lessonKeys[0]
          || resolved.record.canonicalId,
      };
    }
  }
  return { packageCanonicalId: courseId, lessonKey: courseId };
}

/**
 * Map Konling course/page/resource identity to a layered-graph scope.
 * Returns null when no course is available (engineering-only continuation).
 */
export function resolveKonlingTeachingProjectionScope(input: {
  courseId?: string | null;
  pageId?: string | null;
  resourceId?: string | null;
  stepId?: string | null;
  knowledgeRefs?: readonly string[] | null;
}): LayeredGraphScope | null {
  const courseId = input.courseId?.trim();
  if (!courseId) return null;
  const { packageCanonicalId, lessonKey } = resolvePackageCanonicalId(courseId);
  const stepId =
    input.stepId?.trim()
    || (input.pageId && input.pageId !== 'adaptive-path-center'
      ? input.pageId.trim()
      : null)
    || null;
  return buildCoursePackageLayeredScope({
    packageCanonicalId,
    lessonKey,
    stepId,
    knowledgeRefs: input.knowledgeRefs ?? undefined,
  });
}

/**
 * Extract advisory teaching-projection client hints from opaque page/mode
 * context. Values are revalidated by resolveKonlingTeachingProjectionContext.
 */
export function extractKonlingTeachingProjectionClientHints(
  value: unknown,
): KonlingTeachingProjectionClientHints | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const asString = (key: string): string | null => {
    const raw = record[key];
    return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
  };
  const asStringArray = (key: string): string[] | null => {
    const raw = record[key];
    if (!Array.isArray(raw)) return null;
    const values = raw
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
    return values.length > 0 ? values : null;
  };

  const hints: KonlingTeachingProjectionClientHints = {
    authorityReleaseId: asString('authorityReleaseId'),
    projectionId: asString('projectionId'),
    scopeId: asString('scopeId') ?? asString('courseScopeId'),
    lessonKey: asString('lessonKey'),
    stepId: asString('stepId'),
    cardId: asString('cardId') ?? asString('activeCardId'),
    evidenceCutoff: asString('evidenceCutoff'),
    canonicalIds: asStringArray('canonicalIds') ?? asStringArray('knowledgeRefs'),
    resourceIds: asStringArray('resourceIds'),
    signedCanonicalIds:
      asStringArray('signedCanonicalIds')
      ?? asStringArray('signedKnowledgeRefs'),
  };

  if (
    hints.authorityReleaseId
    || hints.projectionId
    || hints.scopeId
    || hints.lessonKey
    || hints.stepId
    || hints.cardId
    || hints.evidenceCutoff
    || hints.canonicalIds
    || hints.resourceIds
    || hints.signedCanonicalIds
  ) {
    return hints;
  }
  return null;
}

/**
 * Resolve the production Teaching Projection binding for Konling.
 * Fail-closed on resolve errors: payload null, teaching absent, engineering may continue.
 */
export function resolveKonlingTeachingProjectionBinding(input: {
  courseId?: string | null;
  pageId?: string | null;
  resourceId?: string | null;
  stepId?: string | null;
  knowledgeRefs?: readonly string[] | null;
  /** Explicit payload from a trusted server caller wins. */
  layeredGraphPayload?: LayeredGraphPayload | null;
  /** Role-authorized: student owns session / teacher in class / admin. */
  authorized?: boolean;
  pinnedProjectionId?: string | null;
  pinnedProjectionHash?: string | null;
  candidateProjectionId?: string | null;
  allowLegacyFallback?: boolean;
  repoRoot?: string;
}): KonlingTeachingProjectionBinding {
  const authorized = input.authorized !== false;

  if (input.layeredGraphPayload) {
    const scope = input.layeredGraphPayload.requestedScope
      ?? resolveKonlingTeachingProjectionScope(input);
    return {
      payload: input.layeredGraphPayload,
      scope,
      permittedScopeIds: scope?.scopeId ? [scope.scopeId] : [],
      authorized,
      source: 'explicit-payload',
      reasons: ['explicit-layered-graph-payload'],
    };
  }

  const scope = resolveKonlingTeachingProjectionScope(input);
  if (!scope) {
    return {
      payload: null,
      scope: null,
      permittedScopeIds: [],
      authorized,
      source: 'absent-no-course',
      reasons: ['no-course-scope-for-teaching-projection'],
    };
  }

  const repoRoot = input.repoRoot ?? process.cwd();
  const authorityRoot = resolveConfiguredAuthorityRoot(repoRoot);
  const projectionRoot = resolveConfiguredTeachingProjectionRoot(repoRoot);

  // Fail closed with an explicit production-artifacts reason when neither
  // image-packaged stores nor env mounts expose activation-gate outputs.
  const authorityReady = storePointerPresent(authorityRoot);
  const projectionReady = storePointerPresent(projectionRoot);
  if (!authorityReady || !projectionReady) {
    return {
      payload: null,
      scope,
      permittedScopeIds: scope.scopeId ? [scope.scopeId] : [],
      authorized,
      source: 'production-artifacts-missing',
      authorityRoot,
      projectionRoot,
      reasons: [
        !authorityReady
          ? `authority-store-missing:${authorityRoot}`
          : 'authority-store-present',
        !projectionReady
          ? `teaching-projection-store-missing:${projectionRoot}`
          : 'teaching-projection-store-present',
        'package-or-mount-activation-gate-artifacts',
      ],
    };
  }

  // #1276 konling consumer activation: pin / select Authority+Projection from
  // the activation pointer so replacing current.json changes Konling reads.
  const konlingActivation = resolveKonlingProductionSelection({ repoRoot });
  const konlingPins = overlayLiveTeachingPins(
    projectionPinsFromSelection(konlingActivation),
    readAgreedLiveCourseProjection(repoRoot, { projectionRoot }),
  );

  if (konlingActivation.mode === 'unavailable') {
    return {
      payload: null,
      scope,
      permittedScopeIds: scope.scopeId ? [scope.scopeId] : [],
      authorized,
      source: 'resolve-failed',
      authorityRoot,
      projectionRoot,
      reasons: [
        'konling-activation-unavailable',
        ...konlingActivation.reasons,
      ],
    };
  }

  let pinnedProjectionId = input.pinnedProjectionId ?? null;
  let pinnedProjectionHash = input.pinnedProjectionHash ?? null;
  let candidateProjectionId = input.candidateProjectionId ?? null;
  let authoritySnapshotId: string | null = null;
  let authoritySnapshotHash: string | null = null;
  let authorityReleaseId: string | null = null;

  if (konlingActivation.mode === 'use-combination') {
    // Force selected combination; do not let caller override READY pins.
    if (konlingPins.projectionId) {
      candidateProjectionId = konlingPins.projectionId;
      pinnedProjectionId = konlingPins.projectionId;
      pinnedProjectionHash = konlingPins.projectionHash;
    }
    authoritySnapshotId = konlingPins.authoritySnapshotId;
    authoritySnapshotHash = konlingPins.authoritySnapshotHash;
    authorityReleaseId = konlingPins.authorityReleaseId;
  } else if (konlingActivation.mode === 'pin-combination') {
    // Force prior combination; clear candidates and ignore caller projection.
    candidateProjectionId = null;
    if (konlingPins.projectionId) {
      pinnedProjectionId = konlingPins.projectionId;
      pinnedProjectionHash = konlingPins.projectionHash;
    }
    authoritySnapshotId = konlingPins.authoritySnapshotId;
    authoritySnapshotHash = konlingPins.authoritySnapshotHash;
    authorityReleaseId = konlingPins.authorityReleaseId;
  }

  try {
    const context = resolveCoursePageLayeredGraphContext({
      scope,
      // #1277: course-page context enforces the retirement gate; default remains
      // permissive only until production dual-authority is retired.
      allowLegacyFallback: input.allowLegacyFallback ?? true,
      pinnedProjectionId,
      pinnedProjectionHash,
      candidateProjectionId,
      authoritySnapshotId,
      authoritySnapshotHash,
      authorityReleaseId,
      // Use Konling's own selection so course-runtime does not override it.
      consumerActivationSelection: konlingActivation,
      repoRoot,
      authorityRoot,
      projectionRoot,
    });
    return {
      payload: context.payload,
      scope: context.scope,
      permittedScopeIds: context.scope.scopeId ? [context.scope.scopeId] : [],
      authorized,
      source: 'course-page-layered-graph',
      authorityRoot,
      projectionRoot,
      reasons: [
        ...(context.hasTeachingProjection
          ? ['teaching-projection-resolved', 'production-default-store-paths']
          : ['teaching-projection-absent-or-fallback-only', 'production-default-store-paths']),
        ...(konlingActivation.mode !== 'absent'
          ? [`konling-activation:${konlingActivation.mode}`]
          : []),
      ],
    };
  } catch (error) {
    return {
      payload: null,
      scope,
      permittedScopeIds: scope.scopeId ? [scope.scopeId] : [],
      authorized,
      source: 'resolve-failed',
      authorityRoot,
      projectionRoot,
      reasons: [
        `teaching-projection-resolve-failed:${
          error instanceof Error ? error.message : 'unknown'
        }`,
      ],
    };
  }
}
