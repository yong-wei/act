import 'server-only';

import type { Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  buildLessonHandoutMarkdownFilename,
  buildLessonHandoutPdfFilename,
} from '@/lib/lesson-artifact-names';
import {
  parseRuntimeLessonMediaDocument as parseRuntimeLessonMediaDocumentImpl,
  type RuntimeLessonMediaDocument,
  type RuntimeLessonMediaResource,
} from '@/lib/runtime-lesson-media-document';

export {
  parseRuntimeLessonMediaDocument,
  parseRuntimeLessonMediaIndex,
} from '@/lib/runtime-lesson-media-document';
export type {
  RuntimeLessonMediaAccessMode,
  RuntimeLessonMediaDocument,
  RuntimeLessonMediaEmbedMode,
  RuntimeLessonMediaKind,
  RuntimeLessonMediaResource,
  RuntimeLessonMediaStatus,
} from '@/lib/runtime-lesson-media-document';

import {
  normalizeInteractiveRuntimeManifest,
  type InteractiveRuntimeManifest,
} from '@/lib/interactive-lesson-manifest';
import { resolveInteractiveLessonIdentity } from '@/lib/interactive-lesson-identity';
import {
  readReadableContentText,
  resolveRuntimeContentPath,
  tryResolveRuntimeContentPath,
} from '@/lib/runtime-content-path';
import { findRuntimeMediaReleaseObject, readActiveRuntimeReleaseManifest } from '@/lib/runtime-active-release';
import {
  CourseBundleDriftError,
  type SessionBundleBinding,
} from '@/lib/course-bundle/contract';
import { readBoundResourceBytes } from '@/lib/course-bundle/blob-reader';

type RuntimeNode = {
  id: string;
  name: string;
  nodeType: string;
  description: string;
  bloomLevel?: string;
  knowledgeDim?: string;
  metadata?: Record<string, unknown>;
  content?: Record<string, unknown>;
  resources?: unknown[];
  chapter?: number;
  chapterName?: string;
  positionX: number;
  positionY: number;
  positionZ: number;
  tags?: string[];
};

type RuntimeLink = {
  id: string;
  sourceId: string;
  targetId: string;
  relation: string;
  relationType?: string;
  strength?: number;
};

type RuntimeKnowledgeGroup = {
  group_name?: string;
  title?: string;
  step_ids: string[];
  node_ids: string[];
};

type RuntimeLessonJson = {
  lesson_id: string;
  title: string;
  card_order: string[];
  entry_nodes?: string[];
  summary_nodes?: string[];
  handout_path?: string;
  handout_source_path?: string;
  handout_pdf_path?: string;
  handout_pdf_source_path?: string;
  media_index_path?: string;
  media_index_source_path?: string;
  sequence?: {
    groups?: RuntimeKnowledgeGroup[];
    card_order?: string[];
  };
  interactive_manifest_path?: string;
  interactive_manifest_source_path?: string;
};

type RuntimeGraphOverlay = {
  lesson_id: string;
  focus_node_ids: string[];
  entry_nodes?: string[];
  summary_nodes?: string[];
  card_order?: string[];
  groups?: RuntimeKnowledgeGroup[];
  nodes: RuntimeNode[];
  links: RuntimeLink[];
};

export interface RuntimeLessonEntryNode extends RuntimeNode {
  frontContent: string;
}

export interface RuntimeLessonEntryBundle {
  lesson: RuntimeLessonJson;
  graphOverlay: {
    lesson_id: string;
    focus_node_ids: string[];
    entry_nodes?: string[];
    summary_nodes?: string[];
    card_order: string[];
    groups: RuntimeKnowledgeGroup[];
    nodes: RuntimeLessonEntryNode[];
    links: RuntimeLink[];
  };
  handoutPath: string;
  handoutSourcePath: string;
  handoutPdfPath: string | null;
  handoutPreview: string;
  handoutSummary: string;
  mediaResources: RuntimeLessonMediaResource[];
  interactiveManifest: InteractiveRuntimeManifest | null;
}

export interface RuntimeLessonResourceCatalogEntry {
  lesson: {
    lesson_id: string;
    title: string;
  };
  graphOverlay: {
    lesson_id: string;
    focus_node_ids: string[];
    entry_nodes?: string[];
    summary_nodes?: string[];
    card_order: string[];
    groups: RuntimeKnowledgeGroup[];
    nodes: Array<Pick<RuntimeNode, 'id' | 'name'>>;
  };
  handoutPath: string;
  handoutSourcePath: string;
  handoutSourceHash?: string | null;
  handoutSourceVersionRef?: string | null;
  handoutPdfPath: string | null;
  mediaResources: RuntimeLessonMediaResource[];
}

const LESSON_ID_MAP_PATH = path.join(
  process.cwd(),
  'course-content',
  'authoring',
  'shared',
  'lesson-id-map.json',
);
const RUNTIME_LESSONS_DIR = path.join(process.cwd(), 'course-content', 'runtime', 'lessons');

let runtimeLessonDirIndexPromise: Promise<Record<string, string>> | null = null;

async function readJson<T>(absolutePath: string): Promise<T> {
  const content = await fs.readFile(absolutePath, 'utf8');
  return JSON.parse(content) as T;
}

async function readText(absolutePath: string): Promise<string> {
  return fs.readFile(absolutePath, 'utf8');
}

async function fileExists(absolutePath: string): Promise<boolean> {
  try {
    await fs.access(absolutePath);
    return true;
  } catch (error) {
    if (!isMissingPathError(error)) {
      throw error;
    }
    return false;
  }
}

function isMissingPathError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as NodeJS.ErrnoException).code === 'ENOENT';
}

async function resolveExistingSourcePath(candidates: string[]) {
  for (const candidate of Array.from(new Set(candidates))) {
    const resolved = tryResolveRuntimeContentPath(candidate);
    if (resolved && await fileExists(resolved.absolutePath)) {
      return resolved.projectPath;
    }
  }
  const firstResolvedCandidate = candidates.map(tryResolveRuntimeContentPath).find(Boolean);
  if (!firstResolvedCandidate) {
    throw new Error('No valid runtime content source path candidate was provided.');
  }
  return firstResolvedCandidate.projectPath;
}

async function loadRuntimeLessonDirIndex() {
  if (!runtimeLessonDirIndexPromise) {
    runtimeLessonDirIndexPromise = readJson<{
      entries?: Array<{ request_ids?: string[]; runtime_lesson_dir?: string }>;
    }>(LESSON_ID_MAP_PATH).then((payload) => {
      const index: Record<string, string> = {};
      for (const entry of payload.entries ?? []) {
        const runtimeLessonDir = entry.runtime_lesson_dir;
        if (!runtimeLessonDir) {
          continue;
        }
        for (const requestId of entry.request_ids ?? []) {
          index[String(requestId)] = runtimeLessonDir;
        }
      }
      return index;
    });
  }
  return runtimeLessonDirIndexPromise;
}

async function loadRuntimeLessonFragmentsFromContent(): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(RUNTIME_LESSONS_DIR, { withFileTypes: true });
  } catch (error) {
    if (!isMissingPathError(error)) {
      throw error;
    }
    return [];
  }

  const candidates = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const lessonJsonChecks = await Promise.all(
    candidates.map(async (candidate) => {
      const lessonJsonPath = path.join(RUNTIME_LESSONS_DIR, candidate, 'lesson.json');
      return await fileExists(lessonJsonPath) ? candidate : null;
    }),
  );
  return lessonJsonChecks.filter((candidate): candidate is string => Boolean(candidate));
}

async function loadRuntimeLessonFragments(): Promise<string[]> {
  const [index, filesystemFragments] = await Promise.all([
    loadRuntimeLessonDirIndex(),
    loadRuntimeLessonFragmentsFromContent(),
  ]);
  const fragments = Array.from(new Set([
    ...Object.values(index),
    ...filesystemFragments,
  ]));
  const existingFragments = await Promise.all(
    fragments.map(async (fragment) => {
      const lessonJsonPath = path.join(RUNTIME_LESSONS_DIR, fragment, 'lesson.json');
      return await fileExists(lessonJsonPath) ? fragment : null;
    }),
  );
  return existingFragments
    .filter((fragment): fragment is string => Boolean(fragment))
    .sort((left, right) => left.localeCompare(right));
}

async function resolveLessonRuntimeFragment(lessonId: string, binding?: SessionBundleBinding) {
  const resolved = resolveInteractiveLessonIdentity(binding?.canonicalLessonId ?? lessonId);
  if (resolved.status === 'resolved') {
    return resolved.record.runtimeLessonDir;
  }
  // Session-bound reads never fall back to the authoring id map or a raw
  // directory name: identity must come from the captured binding.
  if (binding) {
    throw new CourseBundleDriftError(
      'resource-hash-drift',
      `Captured canonical lesson id "${binding.canonicalLessonId}" no longer resolves to a runtime lesson.`,
    );
  }

  const index = await loadRuntimeLessonDirIndex();
  return index[lessonId] ?? lessonId;
}

function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^---\n[\s\S]*?\n---\n/, '');
}

function extractSection(markdown: string, heading: string): string | null {
  const pattern = new RegExp(`^##\\s+${heading}\\s*$([\\s\\S]*?)(?=^##\\s+|\\Z)`, 'm');
  const match = markdown.match(pattern);
  return match?.[1]?.trim() ?? null;
}

function fallbackFrontContent(markdown: string): string {
  const content = stripFrontmatter(markdown).trim();
  const lines = content.split('\n').filter(Boolean);
  return lines.slice(0, 8).join('\n').trim();
}

function createHandoutPreview(markdown: string): string {
  const stripped = stripFrontmatter(markdown)
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\$[^$]+\$/g, '')
    .replace(/[*#>`_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.slice(0, 180);
}

function createHandoutSummary({
  lessonTitle,
  nodeNames,
}: {
  lessonTitle: string;
  nodeNames: string[];
}) {
  const summaryTopics = nodeNames.slice(0, 3).join('、');
  if (!summaryTopics) {
    return `${lessonTitle}配套讲义，适合在课前快速建立本课知识主线。`;
  }
  return `围绕${summaryTopics}展开的配套讲义，适合在课前快速建立概念、图像与计算线索。`;
}

export async function projectRuntimeMediaResources(
  runtimeLessonPath: string,
  resources: RuntimeLessonMediaResource[],
  binding?: SessionBundleBinding,
) {
  const activeRelease = await readActiveRuntimeReleaseManifest();
  const boundObjects = new Map(
    (binding?.resourceHashes.mediaObjects ?? []).map((object) => [object.path, object]),
  );
  // A bound session keeps serving its captured release. The active manifest is
  // only consulted when it still is the captured release.
  const activeUsable = !binding
    || (activeRelease !== null && activeRelease.releaseId === binding.runtimeReleaseId);
  return resources.map((resource) => {
    const runtimePath = `${runtimeLessonPath}/media/${resource.filename}`;
    // Media-index URLs are source evidence, not a client delivery fallback.
    // In particular, an external index may contain a time-limited URL that
    // must never be serialized into a lesson payload.
    if (binding) {
      const boundObject = boundObjects.get(runtimePath);
      if (!boundObject?.sha256) return { ...resource, url: null, status: 'pending' as const };
      const activeObject = activeUsable
        ? activeRelease && findRuntimeMediaReleaseObject(activeRelease, runtimePath)
        : null;
      return {
        ...resource,
        url: activeObject
          ? `/api/course-runtime/assets/${runtimePath}`
          : `/api/course-runtime/assets/${runtimePath}?releaseId=${encodeURIComponent(binding.runtimeReleaseId)}`,
        sha256: boundObject.sha256,
        status: 'ready' as const,
        ...(activeObject ? { objectKey: activeObject.objectKey, sizeBytes: activeObject.sizeBytes } : {}),
      };
    }
    const releaseObject = activeRelease && findRuntimeMediaReleaseObject(activeRelease, runtimePath);
    if (!releaseObject) return { ...resource, url: null, status: 'pending' as const };
    return {
      ...resource,
      url: `/api/course-runtime/assets/${runtimePath}`,
      objectKey: releaseObject.objectKey,
      sha256: releaseObject.sha256,
      sizeBytes: releaseObject.sizeBytes,
      status: 'ready' as const,
    };
  });
}

async function loadFrontContentForNode(
  node: RuntimeNode,
  boundCards?: Map<string, string>,
) {
  const resourcePath = (node.resources ?? []).find((item): item is string =>
    typeof item === 'string' && item.endsWith('.md'),
  );
  if (!resourcePath) {
    return node.description;
  }

  try {
    // Bound knowledge cards prefer mounted bytes that still match the capture
    // and fall back to the content-addressed blob so an active-release switch
    // keeps serving the captured card content.
    const markdown = boundCards
      ? await readBoundCardContent(resourcePath, boundCards)
      : await readReadableContentText(resourcePath);
    return extractSection(markdown, '首页') ?? fallbackFrontContent(markdown) ?? node.description;
  } catch (error) {
    if (error instanceof CourseBundleDriftError) throw error;
    return node.description;
  }
}

async function readBoundCardContent(resourcePath: string, boundCards: Map<string, string>) {
  const expectedCardHash = boundCards.get(resourcePath);
  if (expectedCardHash === undefined) {
    throw new CourseBundleDriftError(
      'resource-hash-drift',
      `Session-bound knowledge card "${resourcePath}" does not match the captured bundle.`,
    );
  }
  const bound = await readBoundResourceBytes({
    candidatePaths: [resourcePath],
    expectedSha256: expectedCardHash,
  });
  if (!bound) {
    throw new CourseBundleDriftError(
      'resource-hash-drift',
      `Session-bound knowledge card "${resourcePath}" does not match the captured bundle.`,
    );
  }
  return bound.bytes.toString('utf8');
}

function boundResourceDrift(kind: string): CourseBundleDriftError {
  return new CourseBundleDriftError(
    'resource-hash-drift',
    `Session-bound runtime resource "${kind}" does not match the captured bundle.`,
  );
}

export async function loadLessonRuntimeEntry(
  lessonId: string,
  options?: { binding?: SessionBundleBinding },
): Promise<RuntimeLessonEntryBundle> {
  const binding = options?.binding;
  const runtimeLessonFragment = await resolveLessonRuntimeFragment(lessonId, binding);
  const lessonDir = resolveRuntimeContentPath(`lessons/${runtimeLessonFragment}`);

  let lessonSource: string;
  let graphOverlaySource: string;
  if (binding) {
    // Release-pinned reads: mounted bytes must match the capture; otherwise the
    // content-addressed blob serves the captured bytes. Only a real absence or
    // an unverifiable blob becomes drift.
    const lessonBound = await readBoundResourceBytes({
      candidatePaths: [`${lessonDir.projectPath}/lesson.json`],
      expectedSha256: binding.resourceHashes.lesson,
    });
    const graphBound = await readBoundResourceBytes({
      candidatePaths: [`${lessonDir.projectPath}/graph-overlay.json`],
      expectedSha256: binding.resourceHashes.graphOverlay,
    });
    if (!lessonBound || !graphBound) throw boundResourceDrift(!lessonBound ? 'lesson' : 'graphOverlay');
    lessonSource = lessonBound.bytes.toString('utf8');
    graphOverlaySource = graphBound.bytes.toString('utf8');
  } else {
    [lessonSource, graphOverlaySource] = await Promise.all([
      readText(resolveRuntimeContentPath(`${lessonDir.runtimePath}/lesson.json`).absolutePath),
      readText(resolveRuntimeContentPath(`${lessonDir.runtimePath}/graph-overlay.json`).absolutePath),
    ]);
  }
  const lesson = JSON.parse(lessonSource) as RuntimeLessonJson;
  const graphOverlay = JSON.parse(graphOverlaySource) as RuntimeGraphOverlay;

  const handoutFilename = buildLessonHandoutMarkdownFilename(lessonId);
  const handoutPdfFilename = buildLessonHandoutPdfFilename(lessonId);
  const handoutCandidates = [
    lesson.handout_source_path,
    `course-content/runtime/lessons/${runtimeLessonFragment}/${handoutFilename}`,
    `course-content/runtime/lessons/${runtimeLessonFragment}/handout.md`,
  ].filter((candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0);
  const handoutPdfCandidates = [
    lesson.handout_pdf_source_path,
    `course-content/runtime/lessons/${runtimeLessonFragment}/${handoutPdfFilename}`,
    `course-content/runtime/lessons/${runtimeLessonFragment}/handout.pdf`,
  ].filter((candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0);
  const mediaIndexCandidates = [
    lesson.media_index_source_path,
    `course-content/runtime/lessons/${runtimeLessonFragment}/media/${lessonId}-media.md`,
  ].filter((candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0);
  const interactiveManifestCandidates = [
    lesson.interactive_manifest_source_path,
    `course-content/runtime/lessons/${runtimeLessonFragment}/interactive-manifest.json`,
  ].filter((candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0);

  let handoutSourcePath: string;
  let handoutPath: string;
  let handoutMarkdown: string;
  let handoutPdfSourcePath: string;
  let handoutPdfPath: string | null;
  let mediaIndexSource: string | null;
  let manifestSource: string | null;
  if (binding) {
    const handoutBound = await readBoundResourceBytes({
      candidatePaths: handoutCandidates,
      expectedSha256: binding.resourceHashes.handoutMarkdown,
    });
    if (!handoutBound) throw boundResourceDrift('handoutMarkdown');
    handoutSourcePath = handoutCandidates[0];
    handoutMarkdown = handoutBound.bytes.toString('utf8');
    // A captured-blob handout has no mounted delivery URL: the preview and
    // summary still render the captured bytes; the full download degrades.
    handoutPath = handoutBound.source === 'mounted'
      ? (lesson.handout_path && handoutSourcePath === handoutCandidates[0]
        ? lesson.handout_path
        : `/course-runtime/lessons/${runtimeLessonFragment}/${path.basename(handoutCandidates[0])}`)
      : '';

    const pdfBound = binding.resourceHashes.handoutPdf !== undefined
      ? await readBoundResourceBytes({
        candidatePaths: handoutPdfCandidates,
        expectedSha256: binding.resourceHashes.handoutPdf,
      })
      : null;
    if (binding.resourceHashes.handoutPdf !== undefined && !pdfBound) {
      throw boundResourceDrift('handoutPdf');
    }
    handoutPdfSourcePath = handoutPdfCandidates[0];
    handoutPdfPath = pdfBound
      ? (pdfBound.source === 'mounted'
        ? (lesson.handout_pdf_path && handoutPdfSourcePath === handoutPdfCandidates[0]
          ? lesson.handout_pdf_path
          : `/course-runtime/lessons/${runtimeLessonFragment}/${path.basename(handoutPdfCandidates[0])}`)
        // Blob-served PDFs go through the content-addressed blob route: the
        // media assets API only accepts lessons/<lesson>/media/ paths.
        : `/api/course-runtime/blob-assets/${binding.resourceHashes.handoutPdf}`)
      : null;

    const mediaIndexBound = binding.resourceHashes.mediaIndex !== undefined
      ? await readBoundResourceBytes({
        candidatePaths: mediaIndexCandidates,
        expectedSha256: binding.resourceHashes.mediaIndex,
      })
      : null;
    if (binding.resourceHashes.mediaIndex !== undefined && !mediaIndexBound) {
      throw boundResourceDrift('mediaIndex');
    }
    mediaIndexSource = mediaIndexBound ? mediaIndexBound.bytes.toString('utf8') : null;

    const manifestBound = binding.resourceHashes.interactiveManifest !== undefined
      ? await readBoundResourceBytes({
        candidatePaths: interactiveManifestCandidates,
        expectedSha256: binding.resourceHashes.interactiveManifest,
      })
      : null;
    if (binding.resourceHashes.interactiveManifest !== undefined && !manifestBound) {
      throw boundResourceDrift('interactiveManifest');
    }
    manifestSource = manifestBound ? manifestBound.bytes.toString('utf8') : null;
  } else {
    const preferredHandoutSourcePath = handoutCandidates[0];
    handoutSourcePath = await resolveExistingSourcePath(handoutCandidates);
    handoutPath = lesson.handout_path && handoutSourcePath === preferredHandoutSourcePath
      ? lesson.handout_path
      : `/course-runtime/lessons/${runtimeLessonFragment}/${path.basename(handoutSourcePath)}`;
    handoutMarkdown = await readReadableContentText(handoutSourcePath);
    const preferredHandoutPdfSourcePath = handoutPdfCandidates[0];
    handoutPdfSourcePath = await resolveExistingSourcePath(handoutPdfCandidates);
    const handoutPdfPathCandidate =
      lesson.handout_pdf_path && handoutPdfSourcePath === preferredHandoutPdfSourcePath
        ? lesson.handout_pdf_path
        : `/course-runtime/lessons/${runtimeLessonFragment}/${path.basename(handoutPdfSourcePath)}`;
    const [handoutPdfExists, mediaIndexExists, interactiveManifestExists] = await Promise.all([
      fileExists(resolveRuntimeContentPath(handoutPdfSourcePath).absolutePath),
      fileExists(resolveRuntimeContentPath(mediaIndexCandidates[0]).absolutePath),
      fileExists(resolveRuntimeContentPath(interactiveManifestCandidates[0]).absolutePath),
    ]);
    handoutPdfPath = handoutPdfExists ? handoutPdfPathCandidate : null;
    mediaIndexSource = mediaIndexExists
      ? await readReadableContentText(mediaIndexCandidates[0])
      : null;
    manifestSource = interactiveManifestExists
      ? await readText(resolveRuntimeContentPath(interactiveManifestCandidates[0]).absolutePath)
      : null;
  }

  const handoutPreview = createHandoutPreview(handoutMarkdown);
  const mediaDocument = mediaIndexSource !== null
    ? parseRuntimeLessonMediaDocumentImpl(mediaIndexSource)
    : { handoutSummary: null, mediaResources: [] };
  const mediaResources = await projectRuntimeMediaResources(lessonDir.runtimePath, mediaDocument.mediaResources, binding);
  const interactiveManifest = manifestSource !== null
    ? normalizeInteractiveRuntimeManifest(JSON.parse(manifestSource))
    : null;
  const boundCards = binding
    ? new Map(
      (binding.resourceHashes.knowledgeCardFiles ?? [])
        .filter((card): card is { path: string; sha256: string } => card.sha256 !== null)
        .map((card) => [card.path, card.sha256]),
    )
    : undefined;

  const nodesWithFront = await Promise.all(
    graphOverlay.nodes.map(async (node) => ({
      ...node,
      frontContent: await loadFrontContentForNode(node, boundCards),
    })),
  );

  return {
    lesson,
    graphOverlay: {
      lesson_id: graphOverlay.lesson_id,
      focus_node_ids: graphOverlay.focus_node_ids,
      entry_nodes: graphOverlay.entry_nodes ?? [],
      summary_nodes: graphOverlay.summary_nodes ?? [],
      card_order: graphOverlay.card_order ?? lesson.card_order ?? [],
      groups: graphOverlay.groups ?? lesson.sequence?.groups ?? [],
      nodes: nodesWithFront,
      links: graphOverlay.links,
    },
    handoutPath,
    handoutSourcePath,
    handoutPdfPath,
    handoutPreview,
    handoutSummary:
      mediaDocument.handoutSummary
      ?? createHandoutSummary({
        lessonTitle: lesson.title,
        nodeNames: nodesWithFront
          .filter((node) => (graphOverlay.card_order ?? lesson.card_order ?? []).includes(node.id))
          .sort(
            (left, right) =>
              (graphOverlay.card_order ?? lesson.card_order ?? []).indexOf(left.id)
              - (graphOverlay.card_order ?? lesson.card_order ?? []).indexOf(right.id),
          )
          .map((node) => node.name),
      }),
    mediaResources,
    interactiveManifest,
  };
}

export async function loadLessonRuntimeResourceCatalogEntry(
  lessonId: string,
): Promise<RuntimeLessonResourceCatalogEntry> {
  const runtimeLessonFragment = await resolveLessonRuntimeFragment(lessonId);
  const lessonDir = resolveRuntimeContentPath(`lessons/${runtimeLessonFragment}`);
  const [lesson, graphOverlay] = await Promise.all([
    readJson<RuntimeLessonJson>(resolveRuntimeContentPath(`${lessonDir.runtimePath}/lesson.json`).absolutePath),
    readJson<RuntimeGraphOverlay>(resolveRuntimeContentPath(`${lessonDir.runtimePath}/graph-overlay.json`).absolutePath),
  ]);
  const canonicalLessonId = lesson.lesson_id || graphOverlay.lesson_id || lessonId;
  const handoutFilename = buildLessonHandoutMarkdownFilename(canonicalLessonId);
  const handoutPdfFilename = buildLessonHandoutPdfFilename(canonicalLessonId);
  const preferredHandoutSourcePath =
    lesson.handout_source_path ?? `course-content/runtime/lessons/${runtimeLessonFragment}/${handoutFilename}`;
  const fallbackHandoutSourcePath = `course-content/runtime/lessons/${runtimeLessonFragment}/handout.md`;
  const handoutSourcePath = await resolveExistingSourcePath([
    preferredHandoutSourcePath,
    `course-content/runtime/lessons/${runtimeLessonFragment}/${handoutFilename}`,
    fallbackHandoutSourcePath,
  ]);
  const handoutPath = lesson.handout_path && handoutSourcePath === preferredHandoutSourcePath
    ? lesson.handout_path
    : `/course-runtime/lessons/${runtimeLessonFragment}/${path.basename(handoutSourcePath)}`;
  const preferredHandoutPdfSourcePath =
    lesson.handout_pdf_source_path ?? `course-content/runtime/lessons/${runtimeLessonFragment}/${handoutPdfFilename}`;
  const handoutPdfSourcePath = await resolveExistingSourcePath([
    preferredHandoutPdfSourcePath,
    `course-content/runtime/lessons/${runtimeLessonFragment}/${handoutPdfFilename}`,
    `course-content/runtime/lessons/${runtimeLessonFragment}/handout.pdf`,
  ]);
  const handoutPdfPathCandidate =
    lesson.handout_pdf_path && handoutPdfSourcePath === preferredHandoutPdfSourcePath
      ? lesson.handout_pdf_path
      : `/course-runtime/lessons/${runtimeLessonFragment}/${path.basename(handoutPdfSourcePath)}`;
  const mediaIndexSourcePath =
    lesson.media_index_source_path
    ?? `course-content/runtime/lessons/${runtimeLessonFragment}/media/${canonicalLessonId}-media.md`;
  const [handoutPdfExists, mediaIndexExists] = await Promise.all([
    fileExists(resolveRuntimeContentPath(handoutPdfSourcePath).absolutePath),
    fileExists(resolveRuntimeContentPath(mediaIndexSourcePath).absolutePath),
  ]);
  const mediaDocument = mediaIndexExists
    ? parseRuntimeLessonMediaDocumentImpl(await readReadableContentText(mediaIndexSourcePath))
    : { handoutSummary: null, mediaResources: [] };

  return {
    lesson: {
      lesson_id: canonicalLessonId,
      title: lesson.title,
    },
    graphOverlay: {
      lesson_id: graphOverlay.lesson_id,
      focus_node_ids: graphOverlay.focus_node_ids,
      entry_nodes: graphOverlay.entry_nodes ?? [],
      summary_nodes: graphOverlay.summary_nodes ?? [],
      card_order: graphOverlay.card_order ?? lesson.card_order ?? [],
      groups: graphOverlay.groups ?? lesson.sequence?.groups ?? [],
      nodes: graphOverlay.nodes.map((node) => ({
        id: node.id,
        name: node.name,
      })),
    },
    handoutPath,
    handoutSourcePath,
    handoutPdfPath: handoutPdfExists ? handoutPdfPathCandidate : null,
    mediaResources: await projectRuntimeMediaResources(lessonDir.runtimePath, mediaDocument.mediaResources),
  };
}

export async function loadAllLessonRuntimeEntries(): Promise<RuntimeLessonEntryBundle[]> {
  const lessonIds = await loadRuntimeLessonFragments();
  return Promise.all(lessonIds.map((lessonId) => loadLessonRuntimeEntry(lessonId)));
}

export async function loadAllLessonRuntimeResourceCatalogEntries(): Promise<RuntimeLessonResourceCatalogEntry[]> {
  const lessonIds = await loadRuntimeLessonFragments();
  return Promise.all(lessonIds.map((lessonId) => loadLessonRuntimeResourceCatalogEntry(lessonId)));
}
