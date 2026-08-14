import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { parseRuntimeLessonMediaDocument, type RuntimeLessonMediaKind } from '@/lib/runtime-lesson-media-document';
import { stableStringify } from '@/lib/aggregate-governance/hash';

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

async function walkFiles(root: string, current = root): Promise<string[]> {
  const entries = (await readdir(current, { withFileTypes: true })).sort((left, right) => compareCodePoints(left.name, right.name));
  const files: string[] = [];
  for (const entry of entries) {
    const absolutePath = path.join(current, entry.name);
    if (entry.isSymbolicLink()) throw new RuntimeMediaInventoryError('runtime-media-inventory-symlink', `Symlink is not allowed: ${path.relative(root, absolutePath)}`);
    if (entry.isDirectory()) {
      files.push(...await walkFiles(root, absolutePath));
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
}): Promise<RuntimeMediaInventory> {
  if (!/^[0-9a-f]{40}$/i.test(input.sourceRevision)) throw new RuntimeMediaInventoryError('runtime-media-inventory-source-revision-invalid', 'sourceRevision must be a 40-character Git SHA.');
  const allRuntimeFiles = await walkFiles(input.runtimeRoot);
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
