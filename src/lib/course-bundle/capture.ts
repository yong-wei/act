import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  buildLessonHandoutMarkdownFilename,
  buildLessonHandoutPdfFilename,
} from '@/lib/lesson-artifact-names';
import {
  parseRuntimeLessonMediaDocument,
  type RuntimeLessonMediaResource,
} from '@/lib/runtime-lesson-media-document';
import { readActiveRuntimeReleaseManifest } from '@/lib/runtime-active-release';
import { runtimeReleaseManifestObjectKey } from '@/lib/runtime-release';
import { resolveInteractiveLessonIdentity } from '@/lib/interactive-lesson-identity';
import {
  resolveRuntimeContentPath,
} from '@/lib/runtime-content-path';
import {
  CourseBundleCaptureError,
  computeCourseBundleDigest,
  computeCourseBundleIdentityProjectionHash,
  hashOrderedPathDigest,
  sha256Hex,
  UNRELEASED_WORKTREE_RELEASE_ID,
  UNRELEASED_WORKTREE_SOURCE_REVISION,
  type CourseBundleIdentity,
  type CourseBundleResourceHashes,
} from './contract';

type RuntimeLessonJson = {
  lesson_id?: string;
  handout_source_path?: string;
  handout_pdf_source_path?: string;
  media_index_source_path?: string;
};

type RuntimeGraphOverlayNode = {
  resources?: unknown[];
};

type RuntimeGraphOverlay = {
  lesson_id?: string;
  nodes?: RuntimeGraphOverlayNode[];
};

async function readOptionalFile(absolutePath: string): Promise<string | null> {
  try {
    return await readFile(absolutePath, 'utf8');
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function firstExistingSourcePath(candidates: string[]): Promise<string | null> {
  for (const candidate of Array.from(new Set(candidates))) {
    const resolved = resolveRuntimeContentPath(candidate);
    if (await readOptionalFile(resolved.absolutePath) !== null) {
      return candidate;
    }
  }
  return null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function collectKnowledgeCardReferences(graphOverlay: RuntimeGraphOverlay): string[] {
  const references: string[] = [];
  for (const node of graphOverlay.nodes ?? []) {
    for (const resource of node.resources ?? []) {
      if (typeof resource === 'string' && resource.includes('/knowledge/cards/')) {
        references.push(resource);
      }
    }
  }
  return Array.from(new Set(references)).sort();
}

/**
 * Capture the immutable bundle identity for an ordinary runtime-first lesson.
 * Reads only registry-resolved runtime content — never authoring files, the
 * authoring id map, or a title-derived directory.
 */
export async function captureRuntimeCourseBundleIdentity(
  canonicalLessonId: string,
): Promise<CourseBundleIdentity> {
  const identity = resolveInteractiveLessonIdentity({ kind: 'canonicalId', value: canonicalLessonId });
  if (identity.status !== 'resolved') {
    throw new CourseBundleCaptureError(
      'identity-unsupported',
      `Canonical lesson id "${canonicalLessonId}" is not registered.`,
    );
  }
  const record = identity.record;
  const runtimeLessonDir = record.runtimeLessonDir;
  const lessonDir = resolveRuntimeContentPath(`lessons/${runtimeLessonDir}`);

  const lessonSource = await readOptionalFile(
    resolveRuntimeContentPath(`${lessonDir.runtimePath}/lesson.json`).absolutePath,
  );
  if (lessonSource === null) {
    throw new CourseBundleCaptureError('lesson-json-missing', `lesson.json is missing for "${canonicalLessonId}".`);
  }
  const graphOverlaySource = await readOptionalFile(
    resolveRuntimeContentPath(`${lessonDir.runtimePath}/graph-overlay.json`).absolutePath,
  );
  if (graphOverlaySource === null) {
    throw new CourseBundleCaptureError('graph-overlay-missing', `graph-overlay.json is missing for "${canonicalLessonId}".`);
  }

  const lesson = JSON.parse(lessonSource) as RuntimeLessonJson;
  const graphOverlay = JSON.parse(graphOverlaySource) as RuntimeGraphOverlay;
  const lessonCanonicalId = lesson.lesson_id ?? '';
  const overlayCanonicalId = graphOverlay.lesson_id ?? '';
  if (
    lessonCanonicalId !== canonicalLessonId
    || overlayCanonicalId !== canonicalLessonId
  ) {
    throw new CourseBundleCaptureError(
      'canonical-id-mismatch',
      `Runtime lesson identity (${lessonCanonicalId}/${overlayCanonicalId}) does not match requested canonical id "${canonicalLessonId}".`,
    );
  }

  const handoutMarkdownFilename = buildLessonHandoutMarkdownFilename(canonicalLessonId);
  const handoutPdfFilename = buildLessonHandoutPdfFilename(canonicalLessonId);
  const handoutSourcePath = await firstExistingSourcePath([
    ...(isString(lesson.handout_source_path) ? [lesson.handout_source_path] : []),
    `course-content/runtime/lessons/${runtimeLessonDir}/${handoutMarkdownFilename}`,
    `course-content/runtime/lessons/${runtimeLessonDir}/handout.md`,
  ]);
  const handoutPdfSourcePath = await firstExistingSourcePath([
    ...(isString(lesson.handout_pdf_source_path) ? [lesson.handout_pdf_source_path] : []),
    `course-content/runtime/lessons/${runtimeLessonDir}/${handoutPdfFilename}`,
    `course-content/runtime/lessons/${runtimeLessonDir}/handout.pdf`,
  ]);
  const mediaIndexSourcePath = await firstExistingSourcePath([
    ...(isString(lesson.media_index_source_path) ? [lesson.media_index_source_path] : []),
    `course-content/runtime/lessons/${runtimeLessonDir}/media/${canonicalLessonId}-media.md`,
  ]);
  const interactiveManifestSourcePath = await firstExistingSourcePath([
    `course-content/runtime/lessons/${runtimeLessonDir}/interactive-manifest.json`,
  ]);

  const resourceHashes: CourseBundleResourceHashes = {
    schemaVersion: 'course-bundle-resource-hashes.v1',
    lesson: sha256Hex(lessonSource),
    graphOverlay: sha256Hex(graphOverlaySource),
  };
  if (interactiveManifestSourcePath !== null) {
    resourceHashes.interactiveManifest = sha256Hex(
      await readFile(resolveRuntimeContentPath(interactiveManifestSourcePath).absolutePath, 'utf8'),
    );
  }
  if (handoutSourcePath !== null) {
    resourceHashes.handoutMarkdown = sha256Hex(
      await readFile(resolveRuntimeContentPath(handoutSourcePath).absolutePath, 'utf8'),
    );
  }
  if (handoutPdfSourcePath !== null) {
    resourceHashes.handoutPdf = sha256Hex(
      await readFile(resolveRuntimeContentPath(handoutPdfSourcePath).absolutePath),
    );
  }

  let mediaResources: RuntimeLessonMediaResource[] = [];
  if (mediaIndexSourcePath !== null) {
    const mediaIndexSource = await readFile(
      resolveRuntimeContentPath(mediaIndexSourcePath).absolutePath,
      'utf8',
    );
    resourceHashes.mediaIndex = sha256Hex(mediaIndexSource);
    mediaResources = parseRuntimeLessonMediaDocument(mediaIndexSource).mediaResources;
  }

  const cardReferences = collectKnowledgeCardReferences(graphOverlay);
  if (cardReferences.length > 0) {
    const cardItems: Array<{ path: string; sha256: string | null }> = [];
    for (const reference of cardReferences) {
      const cardSource = await readOptionalFile(resolveRuntimeContentPath(reference).absolutePath);
      cardItems.push({ path: reference, sha256: cardSource === null ? null : sha256Hex(cardSource) });
    }
    resourceHashes.knowledgeCardFiles = cardItems;
    resourceHashes.knowledgeCards = hashOrderedPathDigest(cardItems);
  }

  const activeRelease = await readActiveRuntimeReleaseManifest();
  if (mediaResources.length > 0) {
    const mediaItems = mediaResources.map((resource) => {
      const runtimePath = `lessons/${runtimeLessonDir}/media/${resource.filename}`;
      const releaseObject = activeRelease?.files.find((file) => file.path === runtimePath) ?? null;
      return { path: runtimePath, sha256: releaseObject?.sha256 ?? null };
    });
    resourceHashes.mediaObjects = mediaItems;
    resourceHashes.media = hashOrderedPathDigest(mediaItems);
  }

  const bundleDigest = computeCourseBundleDigest({ canonicalLessonId, resourceHashes });
  const identityProjectionHash = computeCourseBundleIdentityProjectionHash({
    schemaVersion: 'course-bundle-identity-projection.v1',
    canonicalLessonId,
    runtimeLessonDir,
    routeSegment: record.routeSegments[0] ?? null,
    aliasFamily: {
      lessonKeys: record.lessonKeys,
      presetKeys: record.presetKeys,
      evidenceAliases: record.evidenceAliases,
    },
  });

  if (activeRelease) {
    return {
      bundleId: canonicalLessonId,
      canonicalLessonId,
      runtimeReleaseId: activeRelease.releaseId,
      runtimeTreeSha256: activeRelease.treeSha256,
      runtimeManifestSha256: activeRelease.manifestSha256,
      runtimeSourceRevision: activeRelease.sourceRevision,
      runtimeObjectLocator: {
        schemaVersion: activeRelease.schemaVersion,
        releaseManifestObjectKey: runtimeReleaseManifestObjectKey(activeRelease.releaseId),
        fileCount: activeRelease.fileCount,
        totalBytes: activeRelease.totalBytes,
      },
      bundleDigest,
      identityProjectionHash,
      manifestHash: resourceHashes.interactiveManifest ?? null,
      resourceHashes,
    };
  }

  return {
    bundleId: canonicalLessonId,
    canonicalLessonId,
    runtimeReleaseId: UNRELEASED_WORKTREE_RELEASE_ID,
    // No mounted release: the content-addressed bundle digest is the tree locator.
    runtimeTreeSha256: bundleDigest,
    runtimeManifestSha256: null,
    runtimeSourceRevision: UNRELEASED_WORKTREE_SOURCE_REVISION,
    runtimeObjectLocator: null,
    bundleDigest,
    identityProjectionHash,
    manifestHash: resourceHashes.interactiveManifest ?? null,
    resourceHashes,
  };
}

/** Resolve the runtime lesson directory bound to a canonical id without fallbacks. */
export function resolveBoundRuntimeLessonDir(canonicalLessonId: string): string | null {
  const identity = resolveInteractiveLessonIdentity({ kind: 'canonicalId', value: canonicalLessonId });
  return identity.status === 'resolved' ? identity.record.runtimeLessonDir : null;
}

export function runtimeLessonAbsolutePath(runtimeLessonDir: string, ...segments: string[]): string {
  return path.join(resolveRuntimeContentPath(`lessons/${runtimeLessonDir}`).absolutePath, ...segments);
}
