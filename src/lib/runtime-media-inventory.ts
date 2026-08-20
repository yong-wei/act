import { createHash } from 'node:crypto';
import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

import { parseRuntimeLessonMediaDocument, type RuntimeLessonMediaKind } from '@/lib/runtime-lesson-media-document';
import type { ActRuntimeBlobReleaseManifest } from '@/lib/runtime-release';
import { stableStringify } from '@/lib/aggregate-governance/hash';

export const RUNTIME_BLOB_HELPER_NAME = '.act-runtime-blobs';

const MEDIA_EXTENSIONS = new Set(['.mp4', '.webm', '.m4a', '.mp3', '.wav', '.pdf', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif']);

export interface RuntimeMediaInventoryEntry {
  lessonId: string;
  filename: string;
  kind: RuntimeLessonMediaKind;
  runtimePresent: boolean;
  processedPresent: boolean;
  legacyUrlPresent: boolean;
  legacyUrlHost: string | null;
  unresolved: boolean;
}

export interface RuntimeMediaInventory {
  schemaVersion: 'runtime-media-inventory.v1';
  sourceRevision: string;
  runtimeMediaFiles: number;
  runtimeMediaBytes: number;
  runtimeMediaByExtension: Record<string, number>;
  mediaIndexFiles: number;
  declaredMediaEntries: number;
  runtimePresent: number;
  processedPresent: number;
  legacyUrlPresent: number;
  unresolved: number;
  entries: RuntimeMediaInventoryEntry[];
  digest: string;
}

export class RuntimeMediaInventoryError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'RuntimeMediaInventoryError';
  }
}

function compareCodePoints(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isReservedRuntimeBlobHelperPath(relativePath: string) {
  const normalized = relativePath.replace(/\\/g, '/');
  return normalized === RUNTIME_BLOB_HELPER_NAME || normalized.startsWith(`${RUNTIME_BLOB_HELPER_NAME}/`);
}

async function walkFiles(
  root: string,
  current = root,
  blobBackedFiles: Map<string, { sizeBytes: number; sha256: string }> | null = null,
  blobRoot: string | null = null,
): Promise<string[]> {
  const entries = (await readdir(current, { withFileTypes: true })).sort((left, right) => compareCodePoints(left.name, right.name));
  const files: string[] = [];
  for (const entry of entries) {
    const absolutePath = path.join(current, entry.name);
    const relativePath = path.relative(root, absolutePath).replace(/\\/g, '/');
    if (current === root && entry.name === RUNTIME_BLOB_HELPER_NAME) {
      continue;
    }
    if (isReservedRuntimeBlobHelperPath(relativePath)) {
      throw new RuntimeMediaInventoryError('runtime-media-inventory-reserved-path', `Reserved helper path is not a logical runtime path: ${relativePath}`);
    }
    if (entry.isSymbolicLink()) {
      const expected = blobBackedFiles?.get(relativePath);
      if (!expected || !blobRoot) throw new RuntimeMediaInventoryError('runtime-media-inventory-symlink', `Symlink is not allowed: ${relativePath}`);
      const target = await realpath(absolutePath).catch(() => null);
      if (!target || path.relative(blobRoot, target).startsWith('..') || path.isAbsolute(path.relative(blobRoot, target))) {
        throw new RuntimeMediaInventoryError('runtime-media-inventory-symlink', `Symlink escapes the validated blob root: ${relativePath}`);
      }
      const contents = await readFile(absolutePath);
      if (contents.byteLength !== expected.sizeBytes || createHash('sha256').update(contents).digest('hex') !== expected.sha256) {
        throw new RuntimeMediaInventoryError('runtime-media-inventory-symlink', `Symlink content differs from the validated blob manifest: ${relativePath}`);
      }
      files.push(absolutePath);
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...await walkFiles(root, absolutePath, blobBackedFiles, blobRoot));
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
  return files;
}

function safeFilename(value: string) {
  return value === path.basename(value)
    && !value.includes('\\')
    && value !== '.'
    && value !== '..';
}

function legacyUrlHost(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value).host || null;
  } catch {
    return null;
  }
}

async function isFile(absolutePath: string) {
  try {
    return (await stat(absolutePath)).isFile();
  } catch {
    return false;
  }
}

export async function buildRuntimeMediaInventory(input: {
  runtimeRoot: string;
  authoringLessonsRoot: string;
  sourceRevision: string;
  blobManifest?: ActRuntimeBlobReleaseManifest;
  blobRoot?: string;
}): Promise<RuntimeMediaInventory> {
  if (!/^[0-9a-f]{40}$/i.test(input.sourceRevision)) throw new RuntimeMediaInventoryError('runtime-media-inventory-source-revision-invalid', 'sourceRevision must be a 40-character Git SHA.');
  if (Boolean(input.blobManifest) !== Boolean(input.blobRoot)) {
    throw new RuntimeMediaInventoryError('runtime-media-inventory-blob-contract-invalid', 'blobManifest and blobRoot must be provided together.');
  }
  const blobRoot = input.blobRoot ? await realpath(input.blobRoot).catch(() => null) : null;
  if (input.blobRoot && !blobRoot) throw new RuntimeMediaInventoryError('runtime-media-inventory-blob-contract-invalid', 'blobRoot must resolve to a readable directory.');
  const blobBackedFiles = input.blobManifest
    ? new Map(input.blobManifest.files.map((file) => [file.path, { sizeBytes: file.sizeBytes, sha256: file.sha256 }]))
    : null;
  if (blobBackedFiles) {
    for (const logicalPath of blobBackedFiles.keys()) {
      if (logicalPath.split('/').includes(RUNTIME_BLOB_HELPER_NAME) || isReservedRuntimeBlobHelperPath(logicalPath)) {
        throw new RuntimeMediaInventoryError('runtime-media-inventory-reserved-path', `Reserved helper path is not a logical runtime path: ${logicalPath}`);
      }
    }
  }
  const allRuntimeFiles = await walkFiles(input.runtimeRoot, input.runtimeRoot, blobBackedFiles, blobRoot);
  const runtimeMediaFiles = allRuntimeFiles.filter((file) => MEDIA_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const runtimeMediaByExtension = Object.fromEntries([...new Set(runtimeMediaFiles.map((file) => path.extname(file).toLowerCase()))]
    .sort(compareCodePoints)
    .map((extension) => [extension, runtimeMediaFiles.filter((file) => path.extname(file).toLowerCase() === extension).length]));
  const mediaIndexFiles = allRuntimeFiles
    .filter((file) => /^lessons\/[^/]+\/media\/[^/]+-media\.md$/u.test(path.relative(input.runtimeRoot, file).replace(/\\/g, '/')))
    .sort((left, right) => compareCodePoints(left, right));
  const entries: RuntimeMediaInventoryEntry[] = [];
  for (const indexPath of mediaIndexFiles) {
    const relativeIndex = path.relative(input.runtimeRoot, indexPath).replace(/\\/g, '/');
    const lessonId = relativeIndex.split('/')[1];
    const document = parseRuntimeLessonMediaDocument(await readFile(indexPath, 'utf8'));
    for (const resource of document.mediaResources) {
      const validFilename = safeFilename(resource.filename);
      const runtimePresent = validFilename && await isFile(path.join(path.dirname(indexPath), resource.filename));
      const processedPresent = validFilename && await isFile(path.join(input.authoringLessonsRoot, lessonId, 'media', 'processed', resource.filename));
      const legacyUrlPresent = Boolean(resource.url);
      entries.push({
        lessonId,
        filename: resource.filename,
        kind: resource.kind,
        runtimePresent,
        processedPresent,
        legacyUrlPresent,
        legacyUrlHost: legacyUrlHost(resource.url),
        unresolved: !runtimePresent && !processedPresent && !legacyUrlPresent,
      });
    }
  }
  entries.sort((left, right) => compareCodePoints(`${left.lessonId}\0${left.filename}`, `${right.lessonId}\0${right.filename}`));
  const withoutDigest = {
    schemaVersion: 'runtime-media-inventory.v1' as const,
    sourceRevision: input.sourceRevision.toLowerCase(),
    runtimeMediaFiles: runtimeMediaFiles.length,
    runtimeMediaBytes: (await Promise.all(runtimeMediaFiles.map(async (file) => (await stat(file)).size))).reduce((total, size) => total + size, 0),
    runtimeMediaByExtension,
    mediaIndexFiles: mediaIndexFiles.length,
    declaredMediaEntries: entries.length,
    runtimePresent: entries.filter((entry) => entry.runtimePresent).length,
    processedPresent: entries.filter((entry) => entry.processedPresent).length,
    legacyUrlPresent: entries.filter((entry) => entry.legacyUrlPresent).length,
    unresolved: entries.filter((entry) => entry.unresolved).length,
    entries,
  };
  return {
    ...withoutDigest,
    digest: createHash('sha256').update(stableStringify(withoutDigest)).digest('hex'),
  };
}

export function serializeRuntimeMediaInventory(inventory: RuntimeMediaInventory) {
  return `${stableStringify(inventory)}\n`;
}
