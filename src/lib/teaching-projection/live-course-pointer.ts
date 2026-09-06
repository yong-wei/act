/**
 * Live course Teaching Projection agreed by current.json + inspector sidecar.
 * Used so Konling / path / RAG follow B′ without rewriting sealed consumer-activation.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DEFAULT_DOMAIN_TEACHING_RUNTIME_RELATIVE } from '@/lib/authority-domain-shards/teaching';
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

export function readAgreedLiveCourseProjection(
  repoRoot = process.cwd(),
): AgreedLiveCourseProjection | null {
  const current = readJson<{
    projectionId?: string;
    projectionHash?: string;
    authorityReleaseId?: string;
  }>(join(repoRoot, DEFAULT_TEACHING_PROJECTION_RUNTIME_RELATIVE, 'current.json'));
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
