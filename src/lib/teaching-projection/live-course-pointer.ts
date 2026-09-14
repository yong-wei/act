/**
 * Live course Teaching Projection agreed by current.json + inspector sidecar.
 * Used so Konling / path / RAG follow B′ without rewriting sealed consumer-activation.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { DEFAULT_DOMAIN_TEACHING_RUNTIME_RELATIVE } from '@/lib/authority-domain-shards/teaching';
import {
  DEFAULT_RESOURCE_BINDING_RUNTIME_RELATIVE,
  RESOURCE_BINDING_RELEASE_CURRENT_CONTRACT,
  RESOURCE_BINDING_RELEASE_FILES,
} from '@/lib/resource-binding-release/contracts';
import { buildPublishedResourceHref } from '@/lib/published-resource-reference';
import { DEFAULT_TEACHING_PROJECTION_RUNTIME_RELATIVE } from './contracts';

export interface AgreedLiveCourseProjection {
  projectionId: string;
  projectionHash: string;
  authorityReleaseId: string;
}

function readJson<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

function resolveCourseProjectionRoot(repoRoot: string, projectionRoot?: string): string {
  if (projectionRoot && projectionRoot.trim()) return resolve(projectionRoot);
  const fromEnv =
    process.env.ACT_TEACHING_PROJECTION_STORE_ROOT?.trim()
    || process.env.TEACHING_PROJECTION_STORE_ROOT?.trim();
  if (fromEnv) return resolve(fromEnv);
  return resolve(repoRoot, DEFAULT_TEACHING_PROJECTION_RUNTIME_RELATIVE);
}

export function resolveConfiguredTeachingProjectionRoot(
  repoRoot = process.cwd(),
  projectionRoot?: string,
): string {
  return resolveCourseProjectionRoot(repoRoot, projectionRoot);
}

export function readAgreedLiveCourseProjection(
  repoRoot = process.cwd(),
  options: { projectionRoot?: string } = {},
): AgreedLiveCourseProjection | null {
  const current = readJson<{
    projectionId?: string;
    projectionHash?: string;
    authorityReleaseId?: string;
  }>(join(resolveCourseProjectionRoot(repoRoot, options.projectionRoot), 'current.json'));
  const overlay = readJson<{ projectionId?: string; projectionHash?: string }>(
    join(repoRoot, DEFAULT_DOMAIN_TEACHING_RUNTIME_RELATIVE, 'current.json'),
  );
  if (
    !current?.projectionId
    || !current.projectionHash
    || !current.authorityReleaseId
    || !overlay?.projectionId
  ) {
    return null;
  }
  const sidecar = readJson<{
    envelopeProjectionId?: string;
    envelopeProjectionHash?: string;
    courseProjectionId?: string;
    courseProjectionHash?: string;
    authorityReleaseId?: string;
  }>(join(
    repoRoot,
    DEFAULT_DOMAIN_TEACHING_RUNTIME_RELATIVE,
    'releases',
    overlay.projectionId,
    'inspector-sidecar.json',
  ));
  if (
    sidecar?.envelopeProjectionId !== overlay.projectionId
    || sidecar.courseProjectionId !== current.projectionId
    || sidecar.courseProjectionHash !== current.projectionHash
    || sidecar.authorityReleaseId !== current.authorityReleaseId
  ) {
    return null;
  }
  return {
    projectionId: current.projectionId,
    projectionHash: current.projectionHash,
    authorityReleaseId: current.authorityReleaseId,
  };
}

export function buildLivePublishedResourceHref(
  resourceId: string,
  repoRoot = process.cwd(),
): string | null {
  const live = readAgreedLiveCourseProjection(repoRoot);
  if (!live) return null;
  const manifest = readJson<{
    authoritySnapshotId?: string;
    authoritySnapshotHash?: string;
  }>(join(
    resolveCourseProjectionRoot(repoRoot),
    'releases',
    live.projectionId,
    'projection-manifest.json',
  ));
  if (!manifest?.authoritySnapshotId || !manifest.authoritySnapshotHash) return null;
  try {
    return buildPublishedResourceHref({
      resourceId,
      projectionId: live.projectionId,
      projectionHash: live.projectionHash,
      snapshotId: manifest.authoritySnapshotId,
      snapshotHash: manifest.authoritySnapshotHash,
    });
  } catch {
    return null;
  }
}

export function overlayLiveTeachingPins<T extends {
  projectionId: string | null;
  projectionHash: string | null;
  authorityReleaseId: string | null;
}>(pins: T, live: AgreedLiveCourseProjection | null): T {
  if (
    !live
    || !pins.projectionId
    || !pins.authorityReleaseId
    || pins.authorityReleaseId !== live.authorityReleaseId
  ) {
    return pins;
  }
  return {
    ...pins,
    projectionId: live.projectionId,
    projectionHash: live.projectionHash,
  };
}

export interface AgreedLiveResourceBindingRelease {
  bindingReleaseId: string;
  bindingHash: string;
  authorityReleaseId: string;
}

/**
 * Live anchored resource binding release: `resource-bindings/current.json` must name a
 * staged release whose manifest carries the same hash, a passed gate, and the same
 * Authority release as the live course projection. Anything else means "no live
 * binding release" and resource consumers must not overlay it.
 */
export function readAgreedLiveResourceBindingRelease(
  repoRoot = process.cwd(),
  options: { projectionRoot?: string } = {},
): AgreedLiveResourceBindingRelease | null {
  const live = readAgreedLiveCourseProjection(repoRoot, options);
  if (!live) return null;
  const pointer = readJson<{
    contract?: string;
    bindingReleaseId?: string;
    bindingHash?: string;
    authorityReleaseId?: string;
  }>(join(repoRoot, DEFAULT_RESOURCE_BINDING_RUNTIME_RELATIVE, 'current.json'));
  if (
    pointer?.contract !== RESOURCE_BINDING_RELEASE_CURRENT_CONTRACT
    || !pointer.bindingReleaseId
    || !pointer.bindingHash
    || pointer.authorityReleaseId !== live.authorityReleaseId
  ) {
    return null;
  }
  const manifest = readJson<{
    bindingReleaseId?: string;
    bindingHash?: string;
    authorityReleaseId?: string;
    gatePassed?: boolean;
  }>(join(
    repoRoot,
    DEFAULT_RESOURCE_BINDING_RUNTIME_RELATIVE,
    'releases',
    pointer.bindingReleaseId,
    RESOURCE_BINDING_RELEASE_FILES.manifest,
  ));
  if (
    manifest?.bindingReleaseId !== pointer.bindingReleaseId
    || manifest.bindingHash !== pointer.bindingHash
    || manifest.authorityReleaseId !== live.authorityReleaseId
    || manifest.gatePassed !== true
  ) {
    return null;
  }
  return {
    bindingReleaseId: pointer.bindingReleaseId,
    bindingHash: pointer.bindingHash,
    authorityReleaseId: live.authorityReleaseId,
  };
}

export function overlayLiveBindingPins<T extends {
  authorityReleaseId: string | null;
  bindingReleaseId?: string | null;
  bindingHash?: string | null;
}>(pins: T, live: AgreedLiveResourceBindingRelease | null): T {
  if (!live || !pins.authorityReleaseId || pins.authorityReleaseId !== live.authorityReleaseId) {
    return pins;
  }
  return { ...pins, bindingReleaseId: live.bindingReleaseId, bindingHash: live.bindingHash };
}
