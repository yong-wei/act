import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  AGGREGATE_RELEASE_SET_LOCK_PATH,
  loadAndValidateAggregateRelease,
  type ValidatedAggregateRelease,
} from './ctkg-0-2-aggregate-release';
import {
  LEGACY_V02_ADAPTER_CAPTURE_PATHS,
  resolveTrustedCaptureRevision,
} from './capture-revision';
import {
  DEFAULT_PUBLIC_BUNDLE_LOCK_PATH,
  PublicBundleRejection,
  loadAndValidatePublicBundleV1,
} from './public-bundle-v1';
import { loadAndValidatePublicBundleV2 } from './public-bundle-v2';
import type {
  CompatibilityAssessment,
  PublicBundleRouteDecision,
  ValidatedActKGBundle,
  ValidatedActKGBundleV2,
} from './public-bundle-types';

const MANIFEST_NAME = 'bundle-manifest.json';
const V1_PROTOCOL = 'actkg-public-bundle/1';
const V2_PROTOCOL = 'actkg-public-bundle/2';

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
  }
  | {
    route: PublicBundleRouteDecision;
    kind: 'actkg-public-bundle/2';
    validated: ValidatedActKGBundleV2;
  };

async function manifestExists(bundleDirectory: string): Promise<boolean> {
  try {
    await access(path.join(bundleDirectory, MANIFEST_NAME));
    return true;
  } catch {
    return false;
  }
}

function rejectCapture(reason: string): never {
  throw new PublicBundleRejection({
    code: 'INTEGRITY_REJECTED',
    reasons: [reason],
    matchedIdentities: [],
  });
}

function rejectRoute(code: CompatibilityAssessment['code'], reason: string): never {
  throw new PublicBundleRejection({
    code,
    reasons: [reason],
    matchedIdentities: [],
  });
}

/**
 * Bounded Manifest protocol parse. Integrity-only: no adapter, no fallback.
 */
export async function parseDeclaredPublicBundleProtocol(options: {
  root: string;
  controlledPath: string;
}): Promise<'actkg-public-bundle/1' | 'actkg-public-bundle/2'> {
  const manifestPath = path.join(path.resolve(options.root), options.controlledPath, MANIFEST_NAME);
  let raw: string;
  try {
    raw = await readFile(manifestPath, 'utf8');
  } catch {
    rejectRoute('INTEGRITY_REJECTED', 'standard Bundle is missing bundle-manifest.json');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    rejectRoute('INTEGRITY_REJECTED', 'bundle-manifest.json is not valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    rejectRoute('INTEGRITY_REJECTED', 'bundle-manifest.json must be an object');
  }
  const version = (parsed as { bundle_contract_version?: unknown }).bundle_contract_version;
  if (typeof version !== 'string' || version.length === 0) {
    rejectRoute('INTEGRITY_REJECTED', 'bundle-manifest.json is missing bundle_contract_version');
  }
  if (version === V1_PROTOCOL) return V1_PROTOCOL;
  if (version === V2_PROTOCOL) return V2_PROTOCOL;
  rejectRoute(
    'ADAPTER_UPDATE_REQUIRED',
    `unsupported bundle_contract_version ${version}`,
  );
}

/**
 * Deterministic public-bundle router.
 *
 * - Presence of bundle-manifest.json forces the standard route.
 * - After Manifest integrity parse, the declared protocol selects v1 or v2.
 * - Unknown or failed standard routes never fall back to another adapter.
 * - No directory scanning or "latest version" selection.
 * - Both routes resolve a trusted capture revision via real process Git before
 *   any adapter runs. Callers cannot inject a Git runner.
 */
export async function decidePublicBundleRoute(options: {
  root?: string;
  controlledPath: string;
}): Promise<PublicBundleRouteDecision> {
  const root = path.resolve(options.root ?? process.cwd());
  const controlledPath = options.controlledPath;
  const absolute = path.resolve(root, controlledPath);
  const hasManifest = await manifestExists(absolute);
  if (!hasManifest) {
    return {
      kind: 'legacy-exact-v0.2',
      controlledPath,
      hasManifest: false,
      reason: 'no bundle-manifest.json; only the frozen historical exact adapter may apply',
    };
  }
  const protocol = await parseDeclaredPublicBundleProtocol({ root, controlledPath });
  return {
    kind: protocol,
    controlledPath,
    hasManifest: true,
    reason: `bundle-manifest.json declares ${protocol}; that adapter is mandatory`,
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
   * Optional expected capture revision. Equality-only after clean protected
   * inputs and real HEAD resolution. Never authorizes dirty trees or forged
   * digests for either the standard or historical route.
   */
  captureRevision?: string;
  /**
   * Git work tree for capture-revision binding. Defaults to `root`.
   */
  gitRoot?: string;
} = {
  controlledPath: 'course-content/authoring/knowledge/releases/control-theory-engineering-v0.2',
}): Promise<RoutedPublicBundleResult> {
  for (const field of ['admissionEvidence', 'proof', 'registry']) {
    if (field in options) {
      throw new PublicBundleRejection({
        code: 'INTEGRITY_REJECTED',
        reasons: [`public bundle router rejects caller-controlled ${field}`],
        matchedIdentities: [],
      });
    }
  }
  const root = path.resolve(options.root ?? process.cwd());
  const gitRoot = path.resolve(options.gitRoot ?? root);
  const route = await decidePublicBundleRoute({
    root,
    controlledPath: options.controlledPath,
  });

  if (route.kind === 'actkg-public-bundle/2') {
    try {
      const validated = await loadAndValidatePublicBundleV2({
        root,
        bundlePath: options.controlledPath,
        gitRoot,
        ...(options.captureRevision ? { captureRevision: options.captureRevision } : {}),
      });
      return {
        route,
        kind: 'actkg-public-bundle/2',
        validated,
      };
    } catch (error) {
      if (error instanceof PublicBundleRejection) {
        // Fail closed: a declared v2 package never falls back to v1 or legacy.
        throw error;
      }
      const assessment: CompatibilityAssessment = {
        code: 'INTEGRITY_REJECTED',
        reasons: [error instanceof Error ? error.message : 'Bundle v2 validation failed'],
        matchedIdentities: [],
      };
      throw new PublicBundleRejection(assessment);
    }
  }

  if (route.kind === 'actkg-public-bundle/1') {
    try {
      // Standard adapter re-resolves capture with package-specific tracked paths
      // using real process Git only.
      const validated = await loadAndValidatePublicBundleV1({
        root,
        lockPath: options.lockPath ?? DEFAULT_PUBLIC_BUNDLE_LOCK_PATH,
        bundlePath: options.controlledPath,
        allowCandidateBundle: options.allowCandidateBundle,
        gitRoot,
        ...(options.captureRevision ? { captureRevision: options.captureRevision } : {}),
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

  // Historical path: resolve trusted capture here so the frozen loader never
  // receives an untrusted external SHA that would bypass its own clean check.
  const trustedCaptureRevision = resolveTrustedCaptureRevision({
    gitRoot,
    trackedPaths: [
      ...LEGACY_V02_ADAPTER_CAPTURE_PATHS,
      options.controlledPath,
    ],
    expectedCaptureRevision: options.captureRevision,
    fail: rejectCapture,
  });

  const validated = await loadAndValidateAggregateRelease({
    root,
    releasePath: options.controlledPath,
    // Only the already-verified real HEAD is forwarded.
    captureRevision: trustedCaptureRevision,
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

export {
  PublicBundleRejection,
  loadAndValidatePublicBundleV1,
  DEFAULT_PUBLIC_BUNDLE_LOCK_PATH,
};
export { loadAndValidatePublicBundleV2 };
