import 'server-only';

import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { readActiveRuntimeReleaseManifest } from '@/lib/runtime-active-release';
import {
  isPublicTeachingMediaPath,
  loadRuntimeMediaDirectory,
  RUNTIME_PUBLIC_MEDIA_TYPES,
  runtimePublicMediaObject,
} from '@/lib/runtime-media-storage';

export { isPublicTeachingMediaPath } from '@/lib/runtime-media-storage';

const SHA256 = /^[a-f0-9]{64}$/;
const RELEASE_ID = /^runtime-[a-f0-9]{20,80}$/;
const TYPES = RUNTIME_PUBLIC_MEDIA_TYPES;

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
};

let cached: { key: string; loaded: LoadedIndex | null } | undefined;

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

async function loadIndex(): Promise<LoadedIndex | null> {
  const filename = process.env.ACT_PUBLIC_TEACHING_MEDIA_INDEX_PATH?.trim()
    || path.join(/*turbopackIgnore: true*/ process.cwd(), 'act-runtime-state', 'public-teaching-media', 'current.json');
  try {
    const metadata = await stat(/*turbopackIgnore: true*/ filename);
    if (!metadata.isFile()) return null;
    const key = `${filename}:${metadata.dev}:${metadata.ino}:${metadata.mtimeMs}:${metadata.size}`;
    if (cached?.key === key) return cached.loaded;
    const index = parsePublicTeachingMediaIndex(JSON.parse(await readFile(/*turbopackIgnore: true*/ filename, 'utf8')));
    if (!index) {
      cached = { key, loaded: null };
      return null;
    }
    const byPath = new Map(index.objects.map((object) => [object.path, object]));
    const loaded = { index, byPath };
    cached = { key, loaded };
    return loaded;
  } catch {
    return null;
  }
}

export async function publicTeachingMediaUrlForDigest(
  sha256: string,
  mediaType?: string,
  sizeBytes?: number,
): Promise<string | null> {
  if (process.env.ACT_PUBLIC_TEACHING_MEDIA_ESA_ENABLED === '0') return null;
  const object = runtimePublicMediaObject(sha256, mediaType, sizeBytes);
  return object ? `https://static.adapt-learn.online/${object.objectKey}` : null;
}

export async function publicTeachingMediaUrlForBuffer(
  content: Buffer,
  mediaType: string,
): Promise<string | null> {
  return publicTeachingMediaUrlForDigest(createHash('sha256').update(content).digest('hex'), mediaType, content.length);
}

type SelectedFile = { sha256: string; sizeBytes: number };
let selectedCache: { key: string; files: Promise<Map<string, SelectedFile>> } | undefined;

async function selectedFile(runtimePath: string): Promise<SelectedFile | null> {
  const root = process.env.ACT_RUNTIME_ROOT?.trim()
    || path.join(/*turbopackIgnore: true*/ process.cwd(), 'course-content', 'runtime');
  const receipt = process.env.ACT_RUNTIME_ACTIVE_RECEIPT_PATH?.trim()
    || path.join(root, 'act-runtime-active-receipt.json');
  try {
    const marker = path.join(root, '.act-runtime-release.v2.json');
    const metadata = await Promise.all([
      stat(/*turbopackIgnore: true*/ marker),
      stat(/*turbopackIgnore: true*/ receipt),
    ]);
    if (metadata.some(item => !item.isFile())) return null;
    const key = [root, receipt, ...metadata.flatMap(item => [item.dev, item.ino, item.mtimeMs, item.size])].join(':');
    if (selectedCache?.key !== key) {
      const files = readActiveRuntimeReleaseManifest(root, receipt).then(manifest => new Map(
        manifest?.files.map(item => [item.path, { sha256: item.sha256, sizeBytes: item.sizeBytes }]) ?? [],
      )).catch(error => {
        if (selectedCache?.key === key) selectedCache = undefined;
        throw error;
      });
      // 多个图片请求共用一次完整清单校验，选择变化后按文件身份刷新。
      selectedCache = { key, files };
    }
    return (await selectedCache.files).get(runtimePath) ?? null;
  } catch {
    return null;
  }
}

export async function publicTeachingMediaUrlForPath(runtimePath: string): Promise<string | null> {
  if (!isPublicTeachingMediaPath(runtimePath)) return null;
  if (loadRuntimeMediaDirectory()?.canonical) {
    const binding = await selectedFile(runtimePath);
    return binding ? publicTeachingMediaUrlForDigest(binding.sha256, TYPES[path.posix.extname(runtimePath).toLowerCase()], binding.sizeBytes) : null;
  }
  const loaded = await loadIndex();
  const object = loaded?.byPath.get(runtimePath);
  if (!loaded || !object) return null;
  const receiptPath = process.env.ACT_RUNTIME_ACTIVE_RECEIPT_PATH?.trim()
    || path.join(/*turbopackIgnore: true*/ process.cwd(), 'course-content', 'runtime', 'act-runtime-active-receipt.json');
  try {
    const receipt = JSON.parse(await readFile(/*turbopackIgnore: true*/ receiptPath, 'utf8'));
    if (receipt.schemaVersion !== 'runtime-release-active-receipt.v1'
      || receipt.selection?.releaseId !== loaded.index.sourceRuntime.releaseId
      || receipt.selection?.manifestSha256 !== loaded.index.sourceRuntime.manifestSha256) return null;
    return publicTeachingMediaUrlForDigest(object.sha256, object.mediaType, object.sizeBytes);
  } catch {
    return null;
  }
}
