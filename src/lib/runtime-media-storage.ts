import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const RUNTIME_PUBLIC_MEDIA_HELPER_NAME = '.act-runtime-public-media';
export const RUNTIME_PUBLIC_MEDIA_BUCKET = 'act-course-models';
export const RUNTIME_PUBLIC_MEDIA_PREFIX = 'teaching-media/sha256/';
export const RUNTIME_PUBLIC_MEDIA_TYPES: Readonly<Record<string, string>> = {
  '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.pdf': 'application/pdf', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
};
const SHA256 = /^[a-f0-9]{64}$/;
const RELEASE_ID = /^runtime-[a-f0-9]{20,80}$/;

export interface RuntimePublicMediaObject {
  sha256: string;
  sizeBytes: number;
  mediaType: string;
  objectKey: string;
  publicEligible: true;
}

export interface RuntimePublicMediaDirectory {
  schemaVersion: 'act-public-teaching-media/v2';
  verified: true;
  legacyCopiesAvailable: boolean;
  objects: RuntimePublicMediaObject[];
}

export type LoadedRuntimeMediaDirectory = {
  canonical: boolean;
  directory: RuntimePublicMediaDirectory;
  byDigest: Map<string, RuntimePublicMediaObject>;
};

export function isPublicTeachingMediaPath(value: string): boolean {
  if (value.includes('\\') || value.includes('\0') || value.split('/').some(part => !part || part.startsWith('.'))) return false;
  const extension = path.posix.extname(value).toLowerCase();
  if (!RUNTIME_PUBLIC_MEDIA_TYPES[extension]) return false;
  return /^lessons\/[^/]+\/media\/[^/]+$/u.test(value)
    || (/^lessons\/[^/]+\/[^/]+$/u.test(value) && extension === '.pdf')
    || (/^resources\/textbooks\/[a-z0-9][a-z0-9-]{0,95}\/assets\/[^/]+\/[^/]+$/u.test(value)
      && RUNTIME_PUBLIC_MEDIA_TYPES[extension].startsWith('image/'))
    || (/^knowledge\/infographs\/(?:authority\/)?nodes\/[^/]+$/u.test(value) && extension === '.png');
}

export function parseRuntimeMediaDirectory(value: unknown): LoadedRuntimeMediaDirectory | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const canonical = raw.schemaVersion === 'act-public-teaching-media/v2';
  if ((!canonical && raw.schemaVersion !== 'act-public-teaching-media/v1') || raw.verified !== true
    || !Array.isArray(raw.objects) || (canonical && typeof raw.legacyCopiesAvailable !== 'boolean')) return null;
  if (!canonical) {
    const identity = raw.sourceRuntime as Record<string, unknown> | undefined;
    if (!identity || typeof identity.releaseId !== 'string' || !RELEASE_ID.test(identity.releaseId)
      || typeof identity.manifestSha256 !== 'string' || !SHA256.test(identity.manifestSha256) || !raw.objects.length) return null;
  }
  const paths = new Set<string>();
  const byDigest = new Map<string, RuntimePublicMediaObject>();
  for (const row of raw.objects) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
    const item = row as Record<string, unknown>;
    if (typeof item.sha256 !== 'string' || !SHA256.test(item.sha256)
      || !Number.isSafeInteger(item.sizeBytes) || (item.sizeBytes as number) < 0
      || item.publicEligible !== true || typeof item.mediaType !== 'string') return null;
    let objectKey: string;
    if (canonical) {
      if (typeof item.objectKey !== 'string') return null;
      objectKey = item.objectKey;
    } else {
      if (typeof item.path !== 'string' || !isPublicTeachingMediaPath(item.path) || paths.has(item.path)) return null;
      paths.add(item.path);
      objectKey = `${RUNTIME_PUBLIC_MEDIA_PREFIX}${item.sha256}/asset${path.posix.extname(item.path).toLowerCase()}`;
    }
    const extension = path.posix.extname(objectKey);
    if (objectKey !== `${RUNTIME_PUBLIC_MEDIA_PREFIX}${item.sha256}/asset${extension}`
      || RUNTIME_PUBLIC_MEDIA_TYPES[extension] !== item.mediaType) return null;
    const object: RuntimePublicMediaObject = {
      sha256: item.sha256, sizeBytes: item.sizeBytes as number,
      mediaType: item.mediaType, objectKey, publicEligible: true,
    };
    const previous = byDigest.get(object.sha256);
    if (previous && (previous.sizeBytes !== object.sizeBytes || previous.mediaType !== object.mediaType
      || previous.objectKey !== object.objectKey || canonical)) return null;
    byDigest.set(object.sha256, object);
  }
  return {
    canonical, byDigest,
    directory: { schemaVersion: 'act-public-teaching-media/v2', verified: true,
      legacyCopiesAvailable: canonical ? raw.legacyCopiesAvailable as boolean : true,
      objects: Array.from(byDigest.values()) },
  };
}

export function runtimeMediaDirectoryPath(): string {
  return process.env.ACT_PUBLIC_TEACHING_MEDIA_INDEX_PATH?.trim()
    || path.join(/*turbopackIgnore: true*/ process.cwd(), 'act-runtime-state', 'public-teaching-media', 'current.json');
}

let cached: { key: string; loaded: LoadedRuntimeMediaDirectory | null } | undefined;

export function loadRuntimeMediaDirectory(): LoadedRuntimeMediaDirectory | null {
  const filename = runtimeMediaDirectoryPath();
  try {
    const metadata = lstatSync(/*turbopackIgnore: true*/ filename);
    if (!metadata.isFile() || metadata.isSymbolicLink()) return null;
    const key = `${filename}:${metadata.dev}:${metadata.ino}:${metadata.mtimeMs}:${metadata.size}`;
    if (cached?.key === key) return cached.loaded;
    const loaded = parseRuntimeMediaDirectory(JSON.parse(readFileSync(/*turbopackIgnore: true*/ filename, 'utf8')));
    cached = { key, loaded };
    return loaded;
  } catch {
    return null;
  }
}

export function runtimePublicMediaObject(
  sha256: string,
  mediaType?: string,
  sizeBytes?: number,
): RuntimePublicMediaObject | null {
  if (!SHA256.test(sha256)) return null;
  const item = loadRuntimeMediaDirectory()?.byDigest.get(sha256);
  return item && (!mediaType || item.mediaType === mediaType)
    && (sizeBytes === undefined || item.sizeBytes === sizeBytes) ? item : null;
}

/** 历史v1只是分发副本索引；只有完成目录迁移的v2可成为正文位置。 */
export function canonicalRuntimeMediaLocation(objectKey: string): { bucket: string; objectKey: string } | null {
  const digest = /^runtime\/blobs\/sha256\/([a-f0-9]{64})$/u.exec(objectKey)?.[1];
  if (!digest) return null;
  const loaded = loadRuntimeMediaDirectory();
  const object = loaded?.canonical && loaded.byDigest.get(digest);
  return object ? { bucket: RUNTIME_PUBLIC_MEDIA_BUCKET, objectKey: object.objectKey } : null;
}

export function canonicalRuntimeMediaPath(runtimeRoot: string, sha256: string): string | null {
  const location = canonicalRuntimeMediaLocation(`runtime/blobs/sha256/${sha256}`);
  if (!location) return null;
  return path.join(runtimeRoot, RUNTIME_PUBLIC_MEDIA_HELPER_NAME,
    ...location.objectKey.slice(RUNTIME_PUBLIC_MEDIA_PREFIX.length).split('/'));
}
