import { access } from 'node:fs/promises';
import path from 'node:path';

import {
  AGGREGATE_RELEASE_SET_LOCK_PATH,
  loadAndValidateAggregateRelease,
  type ValidatedAggregateRelease,
} from './ctkg-0-2-aggregate-release';
import {
  DEFAULT_PUBLIC_BUNDLE_LOCK_PATH,
  PublicBundleRejection,
  loadAndValidatePublicBundleV1,
} from './public-bundle-v1';
import type {
  CompatibilityAssessment,
  PublicBundleRouteDecision,
  ValidatedActKGBundle,
} from './public-bundle-types';

const MANIFEST_NAME = 'bundle-manifest.json';

export type RoutedPublicBundleResult =
  | {
    route: PublicBundleRouteDecision;
    kind: 'legacy-exact-v0.2';
    validated: ValidatedAggregateRelease;
  }
  | {
    route: PublicBundleRouteDecision;
    kind: 'actkg-public-bundle/1';
    validated: ValidatedActKGBundle;
  };

async function manifestExists(bundleDirectory: string): Promise<boolean> {
  try {
    await access(path.join(bundleDirectory, MANIFEST_NAME));
    return true;
  } catch {
    return false;
  }
}

/**
 * Deterministic public-bundle router.
 *
 * - Presence of bundle-manifest.json forces the standard adapter.
 * - Standard validation failure never falls back to the historical adapter.
 * - No directory scanning or "latest version" selection.
 */
export async function decidePublicBundleRoute(options: {
  root?: string;
  controlledPath: string;
}): Promise<PublicBundleRouteDecision> {
  const root = path.resolve(options.root ?? process.cwd());
  const controlledPath = options.controlledPath;
  const absolute = path.resolve(root, controlledPath);
  const hasManifest = await manifestExists(absolute);
  if (hasManifest) {
    return {
      kind: 'actkg-public-bundle/1',
      controlledPath,
      hasManifest: true,
      reason: 'bundle-manifest.json is present; standard adapter is mandatory',
    };
  }
  return {
    kind: 'legacy-exact-v0.2',
    controlledPath,
    hasManifest: false,
    reason: 'no bundle-manifest.json; only the frozen historical exact adapter may apply',
  };
}

export async function routeAndValidatePublicBundle(options: {
  root?: string;
  controlledPath: string;
  lockPath?: string;
  allowCandidateBundle?: boolean;
  /**
   * Explicit historical lock path when routing a no-Manifest package.
   * Defaults to the frozen CTKG 0.2 aggregate lock.
   */
  legacyLockPath?: string;
  /**
   * Optional explicit capture revision for the historical adapter only.
   * Production callers should omit this so the frozen loader resolves a clean
   * real Git HEAD. Tests may pass a real HEAD (or a fixture revision) when the
   * surrounding tree is intentionally dirty.
   */
  captureRevision?: string;
} = {
  controlledPath: 'course-content/authoring/knowledge/releases/control-theory-engineering-v0.2',
}): Promise<RoutedPublicBundleResult> {
  const root = path.resolve(options.root ?? process.cwd());
  const route = await decidePublicBundleRoute({
    root,
    controlledPath: options.controlledPath,
  });

  if (route.kind === 'actkg-public-bundle/1') {
    try {
      const validated = await loadAndValidatePublicBundleV1({
        root,
        lockPath: options.lockPath ?? DEFAULT_PUBLIC_BUNDLE_LOCK_PATH,
        bundlePath: options.controlledPath,
        allowCandidateBundle: options.allowCandidateBundle,
      });
      return {
        route,
        kind: 'actkg-public-bundle/1',
        validated,
      };
    } catch (error) {
      if (error instanceof PublicBundleRejection) {
        // Fail closed: never fall back to the historical adapter after a
        // standard path was selected by Manifest presence.
        throw error;
      }
      const assessment: CompatibilityAssessment = {
        code: 'INTEGRITY_REJECTED',
        reasons: [error instanceof Error ? error.message : 'standard Bundle validation failed'],
        matchedIdentities: [],
      };
      throw new PublicBundleRejection(assessment);
    }
  }

  // Historical path: only the frozen no-Manifest adapter is eligible.
  // Never forge a capture revision here; default to the loader's clean-HEAD resolve.
  const validated = await loadAndValidateAggregateRelease({
    root,
    releasePath: options.controlledPath,
    ...(options.captureRevision ? { captureRevision: options.captureRevision } : {}),
  });
  // Guard: the historical adapter must remain on its own lock, not Lock v3.
  if (options.legacyLockPath && options.legacyLockPath !== AGGREGATE_RELEASE_SET_LOCK_PATH) {
    throw new Error('historical exact adapter only accepts the frozen v0.2 ReleaseSet lock');
  }
  return {
    route,
    kind: 'legacy-exact-v0.2',
    validated,
  };
}

export { PublicBundleRejection, loadAndValidatePublicBundleV1, DEFAULT_PUBLIC_BUNDLE_LOCK_PATH };
