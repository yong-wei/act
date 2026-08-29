/**
 * Protected historical and immutable surfaces (#1592).
 */

import type {
  ProtectedSurface,
  ProtectedSurfaceScan,
  RetirementCandidate,
} from './contracts';
import { retirementDigest } from './hash';

export function pathIsProtected(
  filePath: string,
  surfaces: readonly ProtectedSurface[],
): ProtectedSurface | null {
  const normalized = filePath.replace(/\\/gu, '/');
  for (const surface of surfaces) {
    for (const prefix of surface.paths) {
      const needle = prefix.replace(/\\/gu, '/');
      if (normalized === needle || normalized.startsWith(`${needle}/`)) {
        return surface;
      }
    }
  }
  return null;
}

export function scanProtectedSurfaces(input: {
  captureRevision: string;
  candidates: readonly RetirementCandidate[];
  protectedSurfaces: readonly ProtectedSurface[];
  presentPaths: readonly string[];
}): ProtectedSurfaceScan {
  const present = new Set(input.presentPaths.map((p) => p.replace(/\\/gu, '/')));
  const missingProtected: string[] = [];
  for (const surface of input.protectedSurfaces) {
    const anyPresent = surface.paths.some((prefix) => {
      const needle = prefix.replace(/\\/gu, '/');
      for (const path of present) {
        if (path === needle || path.startsWith(`${needle}/`) || needle.startsWith(`${path}/`)) {
          return true;
        }
      }
      return false;
    });
    if (!anyPresent) missingProtected.push(surface.id);
  }

  const reachableFromProtected: string[] = [];
  for (const candidate of input.candidates) {
    const hit = pathIsProtected(candidate.sourcePath, input.protectedSurfaces);
    if (hit) reachableFromProtected.push(candidate.id);
  }

  const intact = missingProtected.length === 0;
  const body = {
    captureRevision: input.captureRevision,
    intact,
    reachableFromProtected: [...reachableFromProtected].sort(),
    missingProtected: [...missingProtected].sort(),
  };
  return {
    ...body,
    scanDigest: retirementDigest(body),
  };
}

export function candidateBlockedByProtection(
  candidate: RetirementCandidate,
  scan: ProtectedSurfaceScan,
): boolean {
  return scan.reachableFromProtected.includes(candidate.id);
}
