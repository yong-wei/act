import 'server-only';

import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const SHA256 = /^[a-f0-9]{64}$/;
const RELEASE_ID = /^runtime-[a-f0-9]{20,80}$/;
const TYPES: Readonly<Record<string, string>> = {
  '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.pdf': 'application/pdf', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
};

export interface PublicTeachingMediaObject {
  path: string;
  sha256: string;
  sizeBytes: number;
  mediaType: string;
  publicEligible: true;
}

export interface PublicTeachingMediaIndex {
  schemaVersion: 'act-public-teaching-media/v1';
  verified: true;
  sourceRuntime: { releaseId: string; manifestSha256: string };
  objects: PublicTeachingMediaObject[];
}

type LoadedIndex = {
  index: PublicTeachingMediaIndex;
  byPath: Map<string, PublicTeachingMediaObject>;
  byDigest: Map<string, PublicTeachingMediaObject[]>;
};

let cached: { key: string; loaded: LoadedIndex | null } | undefined;

export function isPublicTeachingMediaPath(value: string): boolean {
  if (value.includes('\\') || value.includes('\0') || value.split('/').some((part) => !part || part.startsWith('.'))) return false;
  const extension = path.posix.extname(value).toLowerCase();
  if (!TYPES[extension]) return false;
  return /^lessons\/[^/]+\/media\/[^/]+$/u.test(value)
    || (/^lessons\/[^/]+\/[^/]+$/u.test(value) && extension === '.pdf')
    || (/^resources\/textbooks\/[a-z0-9][a-z0-9-]{0,95}\/assets\/[^/]+\/[^/]+$/u.test(value)
      && TYPES[extension].startsWith('image/'))
    || (/^knowledge\/infographs\/(?:authority\/)?nodes\/[^/]+$/u.test(value) && extension === '.png');
}

export function parsePublicTeachingMediaIndex(value: unknown): PublicTeachingMediaIndex | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const index = value as Partial<PublicTeachingMediaIndex>;
  if (index.schemaVersion !== 'act-public-teaching-media/v1' || index.verified !== true
    || !index.sourceRuntime || !RELEASE_ID.test(index.sourceRuntime.releaseId)
    || !SHA256.test(index.sourceRuntime.manifestSha256) || !Array.isArray(index.objects)
    || index.objects.length === 0) return null;
  const paths = new Set<string>();
  for (const object of index.objects) {
    if (!object || typeof object.path !== 'string' || !isPublicTeachingMediaPath(object.path)
      || object.publicEligible !== true || !SHA256.test(object.sha256)
      || !Number.isSafeInteger(object.sizeBytes) || object.sizeBytes < 0
      || TYPES[path.posix.extname(object.path).toLowerCase()] !== object.mediaType
      || paths.has(object.path)) return null;
    paths.add(object.path);
  }
  return index as PublicTeachingMediaIndex;
}

function objectUrl(object: PublicTeachingMediaObject): string {
  const extension = path.posix.extname(object.path).toLowerCase();
  return `https://static.adapt-learn.online/teaching-media/sha256/${object.sha256}/asset${extension}`;
}

async function loadIndex(): Promise<LoadedIndex | null> {
  const filename = process.env.ACT_PUBLIC_TEACHING_MEDIA_INDEX_PATH?.trim()
    || path.join(process.cwd(), 'act-runtime-state', 'public-teaching-media', 'current.json');
  try {
    const metadata = await stat(filename);
    if (!metadata.isFile()) return null;
    const key = `${filename}:${metadata.dev}:${metadata.ino}:${metadata.mtimeMs}:${metadata.size}`;
    if (cached?.key === key) return cached.loaded;
    const index = parsePublicTeachingMediaIndex(JSON.parse(await readFile(filename, 'utf8')));
    if (!index) {
      cached = { key, loaded: null };
      return null;
    }
    const byPath = new Map(index.objects.map((object) => [object.path, object]));
    const byDigest = new Map<string, PublicTeachingMediaObject[]>();
    for (const object of index.objects) {
      byDigest.set(object.sha256, [...(byDigest.get(object.sha256) ?? []), object]);
    }
    const loaded = { index, byPath, byDigest };
    cached = { key, loaded };
    return loaded;
  } catch {
    return null;
  }
}

export async function publicTeachingMediaUrlForDigest(
  sha256: string,
  mediaType?: string,
): Promise<string | null> {
  if (!SHA256.test(sha256)) return null;
  const loaded = await loadIndex();
  const object = loaded?.byDigest.get(sha256)?.find((item) => !mediaType || item.mediaType === mediaType);
  return object ? objectUrl(object) : null;
}

export async function publicTeachingMediaUrlForBuffer(
  content: Buffer,
  mediaType: string,
): Promise<string | null> {
  return publicTeachingMediaUrlForDigest(createHash('sha256').update(content).digest('hex'), mediaType);
}

export async function publicTeachingMediaUrlForPath(runtimePath: string): Promise<string | null> {
  if (!isPublicTeachingMediaPath(runtimePath)) return null;
  const loaded = await loadIndex();
  const object = loaded?.byPath.get(runtimePath);
  if (!loaded || !object) return null;
  const receiptPath = process.env.ACT_RUNTIME_ACTIVE_RECEIPT_PATH?.trim()
    || path.join(process.cwd(), 'course-content', 'runtime', 'act-runtime-active-receipt.json');
  try {
    const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
    if (receipt.schemaVersion !== 'runtime-release-active-receipt.v1'
      || receipt.selection?.releaseId !== loaded.index.sourceRuntime.releaseId
      || receipt.selection?.manifestSha256 !== loaded.index.sourceRuntime.manifestSha256) return null;
    return objectUrl(object);
  } catch {
    return null;
  }
}
