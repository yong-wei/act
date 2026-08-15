import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { parseRuntimeLessonMediaDocument } from '@/lib/runtime-lesson-media-document';
import type { AnyActRuntimeReleaseManifest } from '@/lib/runtime-release';
import { stableStringify } from '@/lib/aggregate-governance/hash';

export interface RuntimeReleaseMediaClosureEntry {
  lessonId: string;
  filename: string;
  runtimePath: string;
  objectKey: string | null;
  sha256: string | null;
  sizeBytes: number | null;
  legacyUrlPresent: boolean;
  state: 'published' | 'pending' | 'external-only' | 'missing-from-release';
}

export interface RuntimeReleaseMediaClosure {
  schemaVersion: 'runtime-release-media-closure.v1';
  releaseId: string;
  sourceRevision: string;
  treeSha256: string;
  manifestSha256: string;
  publishedEntries: number;
  legacyFallbackEntries: number;
  pendingEntries: number;
  failures: number;
  ready: boolean;
  entries: RuntimeReleaseMediaClosureEntry[];
}

export class RuntimeReleaseMediaClosureError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'RuntimeReleaseMediaClosureError';
  }
}

function compareCodePoints(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isSafeFilename(value: string) {
  return value === path.posix.basename(value)
    && !value.includes('\\')
    && value !== '.'
    && value !== '..';
}

async function isFile(absolutePath: string) {
  try {
    return (await stat(absolutePath)).isFile();
  } catch {
    return false;
  }
}

export async function buildRuntimeReleaseMediaClosure(input: {
  runtimeRoot: string;
  manifest: AnyActRuntimeReleaseManifest;
}): Promise<RuntimeReleaseMediaClosure> {
  const lessonsRoot = path.join(input.runtimeRoot, 'lessons');
  const manifestFiles = new Map(input.manifest.files.map((file) => [file.path, file]));
  let lessonEntries;
  try {
    lessonEntries = await readdir(lessonsRoot, { withFileTypes: true });
  } catch {
    throw new RuntimeReleaseMediaClosureError('runtime-release-media-closure-lessons-missing', 'Runtime release source has no lessons directory.');
  }
  const entries: RuntimeReleaseMediaClosureEntry[] = [];
  for (const lessonEntry of lessonEntries.filter((entry) => entry.isDirectory()).sort((left, right) => compareCodePoints(left.name, right.name))) {
    const lessonId = lessonEntry.name;
    const mediaRoot = path.join(lessonsRoot, lessonId, 'media');
    let mediaEntries;
    try {
      mediaEntries = await readdir(mediaRoot, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const mediaEntry of mediaEntries.filter((entry) => entry.isFile() && /^.+-media\.md$/u.test(entry.name)).sort((left, right) => compareCodePoints(left.name, right.name))) {
      const document = await readFile(path.join(mediaRoot, mediaEntry.name), 'utf8');
      for (const resource of parseRuntimeLessonMediaDocument(document).mediaResources) {
        if (!isSafeFilename(resource.filename)) {
          throw new RuntimeReleaseMediaClosureError('runtime-release-media-closure-filename-invalid', `Runtime media filename is invalid: ${lessonId}/${resource.filename}`);
        }
        const runtimePath = `lessons/${lessonId}/media/${resource.filename}`;
        const localPresent = await isFile(path.join(mediaRoot, resource.filename));
        const manifestFile = manifestFiles.get(runtimePath) ?? null;
        const state = localPresent
          ? manifestFile ? 'published' : 'missing-from-release'
          : resource.url ? 'external-only' : 'pending';
        entries.push({
          lessonId,
          filename: resource.filename,
          runtimePath,
          objectKey: manifestFile?.objectKey ?? null,
          sha256: manifestFile?.sha256 ?? null,
          sizeBytes: manifestFile?.sizeBytes ?? null,
          legacyUrlPresent: Boolean(resource.url),
          state,
        });
      }
    }
  }
  entries.sort((left, right) => compareCodePoints(`${left.lessonId}\0${left.filename}`, `${right.lessonId}\0${right.filename}`));
  const failures = entries.filter((entry) => entry.state === 'external-only' || entry.state === 'missing-from-release').length;
  return {
    schemaVersion: 'runtime-release-media-closure.v1',
    releaseId: input.manifest.releaseId,
    sourceRevision: input.manifest.sourceRevision,
    treeSha256: input.manifest.treeSha256,
    manifestSha256: input.manifest.manifestSha256,
    publishedEntries: entries.filter((entry) => entry.state === 'published').length,
    legacyFallbackEntries: entries.filter((entry) => entry.state === 'published' && entry.legacyUrlPresent).length,
    pendingEntries: entries.filter((entry) => entry.state === 'pending').length,
    failures,
    ready: failures === 0,
    entries,
  };
}

export function serializeRuntimeReleaseMediaClosure(closure: RuntimeReleaseMediaClosure) {
  return `${stableStringify(closure)}\n`;
}
