/**
 * Capture the complete logical-resource / non-resource inventory of the
 * production-active Runtime Release. Historical worktrees, blob counts, and
 * type-filtered database scans cannot substitute for this capture.
 */

import {
  LatestAuthorityCutoverError,
  type ActiveBaselineEntry,
  type ActiveRuntimeReleaseIdentity,
} from './contracts';
import { buildActiveBaseline } from './denominator';

export interface RuntimeManifestFile {
  readonly path: string;
  readonly sha256: string;
}

export interface ProductionTeachingResource {
  readonly id: string;
  readonly type: string;
  readonly registryId: string | null;
}

export interface CaptureActiveLogicalInventoryInput {
  readonly activeRelease: ActiveRuntimeReleaseIdentity;
  readonly manifestFiles: readonly RuntimeManifestFile[];
  readonly teachingResources: readonly ProductionTeachingResource[];
  readonly lessonItemResourceIds: readonly string[];
  readonly classified: readonly ActiveBaselineEntry[];
}

function fail(code: string, message: string): never {
  throw new LatestAuthorityCutoverError(code, message);
}

/**
 * Freeze the complete active logical inventory. Every registryId-bearing
 * TeachingResource and every Runtime manifest file must receive an explicit
 * resource or non-resource classification. STATIC_MEDIA referenced by a
 * LessonItem must be in-course; unreferenced STATIC_MEDIA cannot be dropped
 * by type filter.
 */
export function captureActiveLogicalInventory(
  input: CaptureActiveLogicalInventoryInput,
): ReturnType<typeof buildActiveBaseline> {
  const classified = input.classified;
  const byEntry = new Map(classified.map((entry) => [entry.entryId, entry]));
  if (byEntry.size !== classified.length) {
    fail('inventory-entry-duplicate', 'Classified inventory repeats an entryId.');
  }

  const registryResources = input.teachingResources.filter(
    (row) => typeof row.registryId === 'string' && row.registryId.length > 0,
  );
  for (const resource of registryResources) {
    const match = classified.find(
      (entry) => entry.dbResourceId === resource.id || entry.registryId === resource.registryId,
    );
    if (!match) {
      fail(
        'inventory-db-resource-missing',
        `TeachingResource ${resource.id} (type ${resource.type}, registry ${resource.registryId}) has no classified inventory entry.`,
      );
    }
    if (resource.type === 'STATIC_MEDIA') {
      const inCourse = input.lessonItemResourceIds.includes(resource.id);
      if (inCourse && match.courseScope !== 'in-course') {
        fail(
          'inventory-static-media-unscoped',
          `STATIC_MEDIA ${resource.id} is referenced by a LessonItem and must be classified in-course.`,
        );
      }
      if (!inCourse && match.courseScope !== 'out-of-course' && match.classification !== 'non-resource') {
        fail(
          'inventory-static-media-implicit-drop',
          `STATIC_MEDIA ${resource.id} is outside the current lesson set and needs an explicit out-of-course or non-resource decision.`,
        );
      }
      if (match.classification === 'resource' && match.courseScope === 'in-course' && !match.resourceId) {
        fail(
          'inventory-static-media-unbound',
          `In-course STATIC_MEDIA ${resource.id} must bind a logical resource identity.`,
        );
      }
    }
  }

  const classifiedRuntimePaths = new Set(
    classified
      .map((entry) => entry.runtimePath)
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
  );
  for (const file of input.manifestFiles) {
    if (classifiedRuntimePaths.has(file.path)) continue;
    const leftover = classified.find(
      (entry) => entry.classification === 'non-resource' && entry.entryId === `non-resource:${file.path}`,
    );
    if (!leftover) {
      fail(
        'inventory-manifest-unclassified',
        `Runtime manifest file ${file.path} has no resource binding and no explicit non-resource disposition.`,
      );
    }
  }

  const newOverBaseline = classified.filter(
    (entry) => entry.classification === 'resource' && entry.entryId.startsWith('delta:NEW:'),
  );
  if (newOverBaseline.length > 0) {
    fail(
      'inventory-baseline-marked-new',
      `Active baseline entries cannot be classified as NEW: ${newOverBaseline.map((entry) => entry.entryId).join(', ')}`,
    );
  }

  return buildActiveBaseline({
    activeRelease: input.activeRelease,
    entries: classified,
  });
}
