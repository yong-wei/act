/**
 * Recover source content identity for a production-active Runtime media
 * projection from the selected Runtime Release v2 manifest.  This bridge is
 * deliberately narrower than a formal binding: it proves only the immutable
 * delivered media byte and the active media-index structural address.
 */

import { projectionDigest } from '@/lib/teaching-projection/hash';

import { LatestAuthorityCutoverError, type ActiveRuntimeReleaseIdentity } from './contracts';

export interface RuntimeManifestMediaFile {
  readonly path: string;
  readonly sha256: string;
}

export interface RuntimeMediaIndexSource {
  readonly lessonKey: string;
  readonly runtimePath: string;
  readonly sha256: string;
  readonly filenames: readonly string[];
}

export interface MissingRuntimeMediaProjection {
  readonly id: string;
  readonly sourceHash: null;
}

export interface RuntimeMediaSourceBridgeItem {
  readonly resourceId: string;
  readonly lessonKey: string;
  readonly mediaId: string;
  readonly sourceIdentityState: 'RECOVERED_FROM_ACTIVE_RUNTIME_MANIFEST' | 'MISSING_RUNTIME_ASSET';
  readonly runtimePath: string | null;
  readonly contentSha256: string | null;
  readonly mediaIndexPath: string;
  readonly mediaIndexSha256: string;
  readonly sourceIdentity: string | null;
  readonly blockerCodes: readonly string[];
}

export interface RuntimeMediaSourceBridge {
  readonly contract: 'active-runtime-media-source-bridge/v1';
  readonly activeRelease: ActiveRuntimeReleaseIdentity;
  readonly items: readonly RuntimeMediaSourceBridgeItem[];
  readonly recoveredCount: number;
  readonly missingCount: number;
  readonly bridgeHash: string;
}

function fail(code: string, message: string): never {
  throw new LatestAuthorityCutoverError(code, message);
}

function assertDigest(value: string, label: string): void {
  if (!/^[a-f0-9]{64}$/u.test(value)) fail('runtime-media-source-invalid', `${label} must be a SHA-256 digest.`);
}

function parseResourceId(resourceId: string): { lessonKey: string; mediaId: string } {
  const match = /^runtime-media:([^:]+):([^:]+)$/u.exec(resourceId);
  if (!match) fail('runtime-media-source-invalid', `Invalid runtime media resource id: ${resourceId}`);
  return { lessonKey: match[1]!, mediaId: match[2]! };
}

/**
 * Reconcile source-less media records with the exact selected manifest.  A
 * filename is admissible only when it is declared by the matching active
 * lesson media index and resolves to one manifest object; duplicate or absent
 * declarations remain unresolved rather than guessing from a display name.
 */
export function buildRuntimeMediaSourceBridge(input: {
  readonly activeRelease: ActiveRuntimeReleaseIdentity;
  readonly manifestFiles: readonly RuntimeManifestMediaFile[];
  readonly mediaIndexes: readonly RuntimeMediaIndexSource[];
  readonly missingProjections: readonly MissingRuntimeMediaProjection[];
}): RuntimeMediaSourceBridge {
  const manifestByPath = new Map<string, RuntimeManifestMediaFile>();
  for (const file of input.manifestFiles) {
    if (!file.path || manifestByPath.has(file.path)) fail('runtime-media-source-invalid', `Duplicate runtime manifest path: ${file.path}`);
    assertDigest(file.sha256, `Runtime manifest hash for ${file.path}`);
    manifestByPath.set(file.path, file);
  }
  const indexes = new Map<string, RuntimeMediaIndexSource>();
  for (const index of input.mediaIndexes) {
    const expectedPath = `lessons/${index.lessonKey}/media/${index.lessonKey}-media.md`;
    if (index.runtimePath !== expectedPath || indexes.has(index.lessonKey)) {
      fail('runtime-media-source-invalid', `Invalid or duplicate media index for lesson ${index.lessonKey}`);
    }
    const manifest = manifestByPath.get(index.runtimePath);
    if (!manifest || manifest.sha256 !== index.sha256) {
      fail('runtime-media-source-invalid', `Media index ${index.runtimePath} does not match the active runtime manifest.`);
    }
    if (new Set(index.filenames).size !== index.filenames.length) {
      fail('runtime-media-source-invalid', `Media index ${index.runtimePath} repeats a filename.`);
    }
    indexes.set(index.lessonKey, index);
  }

  const seen = new Set<string>();
  const items = input.missingProjections.map((projection) => {
    if (seen.has(projection.id)) fail('runtime-media-source-invalid', `Duplicate media projection ${projection.id}`);
    seen.add(projection.id);
    const { lessonKey, mediaId } = parseResourceId(projection.id);
    const index = indexes.get(lessonKey);
    if (!index) fail('runtime-media-source-invalid', `Missing active media index for ${projection.id}`);
    const filenames = index.filenames.filter((filename) => filename.replace(/\.[^.]+$/u, '') === mediaId);
    if (filenames.length !== 1) {
      return {
        resourceId: projection.id,
        lessonKey,
        mediaId,
        sourceIdentityState: 'MISSING_RUNTIME_ASSET' as const,
        runtimePath: null,
        contentSha256: null,
        mediaIndexPath: index.runtimePath,
        mediaIndexSha256: index.sha256,
        sourceIdentity: null,
        blockerCodes: ['active-runtime-media-file-missing'],
      };
    }
    const runtimePath = `lessons/${lessonKey}/media/${filenames[0]}`;
    const manifest = manifestByPath.get(runtimePath);
    if (!manifest) {
      return {
        resourceId: projection.id,
        lessonKey,
        mediaId,
        sourceIdentityState: 'MISSING_RUNTIME_ASSET' as const,
        runtimePath: null,
        contentSha256: null,
        mediaIndexPath: index.runtimePath,
        mediaIndexSha256: index.sha256,
        sourceIdentity: null,
        blockerCodes: ['active-runtime-media-file-missing'],
      };
    }
    const sourceIdentity = `runtime-release:${input.activeRelease.releaseId}:${runtimePath}:sha256:${manifest.sha256}`;
    return {
      resourceId: projection.id,
      lessonKey,
      mediaId,
      sourceIdentityState: 'RECOVERED_FROM_ACTIVE_RUNTIME_MANIFEST' as const,
      runtimePath,
      contentSha256: manifest.sha256,
      mediaIndexPath: index.runtimePath,
      mediaIndexSha256: index.sha256,
      sourceIdentity,
      blockerCodes: [],
    };
  }).sort((left, right) => left.resourceId.localeCompare(right.resourceId));
  const recoveredCount = items.filter((item) => item.sourceIdentityState === 'RECOVERED_FROM_ACTIVE_RUNTIME_MANIFEST').length;
  const missingCount = items.length - recoveredCount;
  const bridgeHash = projectionDigest({
    contract: 'active-runtime-media-source-bridge/v1',
    activeRelease: input.activeRelease,
    items,
    recoveredCount,
    missingCount,
  });
  return {
    contract: 'active-runtime-media-source-bridge/v1',
    activeRelease: input.activeRelease,
    items,
    recoveredCount,
    missingCount,
    bridgeHash,
  };
}
