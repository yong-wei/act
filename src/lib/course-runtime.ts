import 'server-only';

import fs from 'node:fs/promises';
import path from 'node:path';

import {
  normalizeInteractiveRuntimeManifest,
  type InteractiveRuntimeManifest,
} from '@/lib/interactive-lesson-manifest';

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
    groups?: Array<{ group_name: string; step_ids: string[]; node_ids: string[] }>;
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
  groups?: Array<{ group_name: string; step_ids: string[]; node_ids: string[] }>;
  nodes: RuntimeNode[];
  links: RuntimeLink[];
};

export interface RuntimeLessonEntryNode extends RuntimeNode {
  frontContent: string;
}

export type RuntimeLessonMediaKind = 'video' | 'audio' | 'pdf' | 'other';
export type RuntimeLessonMediaAccessMode = 'dialog' | 'new_tab';
export type RuntimeLessonMediaEmbedMode = 'iframe' | 'none';
export type RuntimeLessonMediaStatus = 'ready' | 'pending';

export interface RuntimeLessonMediaResource {
  id: string;
  title: string;
  filename: string;
  kind: RuntimeLessonMediaKind;
  url: string | null;
  accessMode: RuntimeLessonMediaAccessMode;
  embedMode: RuntimeLessonMediaEmbedMode;
  status: RuntimeLessonMediaStatus;
  featured: boolean;
}

export interface RuntimeLessonMediaDocument {
  handoutSummary: string | null;
  mediaResources: RuntimeLessonMediaResource[];
}

export interface RuntimeLessonEntryBundle {
  lesson: RuntimeLessonJson;
  graphOverlay: {
    lesson_id: string;
    focus_node_ids: string[];
    entry_nodes?: string[];
    summary_nodes?: string[];
    card_order: string[];
    groups: Array<{ group_name: string; step_ids: string[]; node_ids: string[] }>;
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

const RUNTIME_ROOT = path.join(process.cwd(), 'course-content', 'runtime');
const LESSON_ID_MAP_PATH = path.join(
  process.cwd(),
  'course-content',
  'authoring',
  'shared',
  'lesson-id-map.json',
);

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
  } catch {
    return false;
  }
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

async function resolveLessonRuntimeFragment(lessonId: string) {
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

function inferRuntimeMediaKind(filename: string): RuntimeLessonMediaKind {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.mp4' || ext === '.webm') return 'video';
  if (ext === '.m4a' || ext === '.mp3' || ext === '.wav') return 'audio';
  if (ext === '.pdf') return 'pdf';
  return 'other';
}

function normalizeRuntimeMediaId(filename: string) {
  return filename.replace(/\.[^.]+$/, '');
}

export function parseRuntimeLessonMediaIndex(markdown: string): RuntimeLessonMediaResource[] {
  return parseRuntimeLessonMediaDocument(markdown).mediaResources;
}

export function parseRuntimeLessonMediaDocument(markdown: string): RuntimeLessonMediaDocument {
  const resources: RuntimeLessonMediaResource[] = [];
  const lines = markdown.split(/\r?\n/);
  let currentFilename: string | null = null;
  let currentTitle: string | null = null;
  let currentUrl: string | null = null;
  let handoutSummary: string | null = null;
  let inHandoutSection = false;

  const flushCurrent = () => {
    if (!currentFilename) return;
    const kind = inferRuntimeMediaKind(currentFilename);
    if (currentFilename === 'handout.md') {
      currentFilename = null;
      currentTitle = null;
      currentUrl = null;
      return;
    }
    resources.push({
      id: normalizeRuntimeMediaId(currentFilename),
      title: currentTitle ?? currentFilename,
      filename: currentFilename,
      kind,
      url: currentUrl,
      accessMode: kind === 'pdf' ? 'new_tab' : 'dialog',
      embedMode: kind === 'pdf' ? 'none' : 'iframe',
      status: currentUrl ? 'ready' : 'pending',
      featured: currentFilename.includes('-course.'),
    });
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith('# ')) {
      flushCurrent();
      currentFilename = line.slice(2).trim();
      currentTitle = null;
      currentUrl = null;
      inHandoutSection = currentFilename === 'handout.md';
      continue;
    }
    if (inHandoutSection) {
      if (line) {
        handoutSummary = handoutSummary ? `${handoutSummary} ${line}` : line;
      }
      continue;
    }
    if (currentFilename && !currentTitle && line.startsWith('- ')) {
      currentTitle = line.slice(2).trim();
      continue;
    }
    if (currentFilename && !currentUrl && /^https?:\/\//i.test(line)) {
      currentUrl = line;
    }
  }

  flushCurrent();
  return {
    handoutSummary,
    mediaResources: resources,
  };
}

async function loadFrontContentForNode(node: RuntimeNode): Promise<string> {
  const resourcePath = (node.resources ?? []).find((item): item is string =>
    typeof item === 'string' && (item.endsWith('.md') || item.endsWith('.mdx')),
  );
  if (!resourcePath) {
    return node.description;
  }

  try {
    const markdown = await readText(path.join(process.cwd(), resourcePath));
    return extractSection(markdown, '首页') ?? fallbackFrontContent(markdown) ?? node.description;
  } catch {
    return node.description;
  }
}

export async function loadLessonRuntimeEntry(lessonId: string): Promise<RuntimeLessonEntryBundle> {
  const runtimeLessonFragment = await resolveLessonRuntimeFragment(lessonId);
  const lessonDir = path.join(RUNTIME_ROOT, 'lessons', runtimeLessonFragment);
  const [lesson, graphOverlay] = await Promise.all([
    readJson<RuntimeLessonJson>(path.join(lessonDir, 'lesson.json')),
    readJson<RuntimeGraphOverlay>(path.join(lessonDir, 'graph-overlay.json')),
  ]);

  const handoutSourcePath =
    lesson.handout_source_path ?? `course-content/runtime/lessons/${runtimeLessonFragment}/handout.md`;
  const handoutPath = lesson.handout_path ?? `/course-runtime/lessons/${runtimeLessonFragment}/handout.md`;
  const handoutPdfSourcePath =
    lesson.handout_pdf_source_path ?? `course-content/runtime/lessons/${runtimeLessonFragment}/handout.pdf`;
  const handoutPdfPathCandidate =
    lesson.handout_pdf_path ?? `/course-runtime/lessons/${runtimeLessonFragment}/handout.pdf`;
  const mediaIndexSourcePath =
    lesson.media_index_source_path ?? `course-content/runtime/lessons/${runtimeLessonFragment}/media/${lessonId}-media.md`;
  const interactiveManifestSourcePath =
    lesson.interactive_manifest_source_path
    ?? `course-content/runtime/lessons/${runtimeLessonFragment}/interactive-manifest.json`;
  const handoutMarkdown = await readText(path.join(process.cwd(), handoutSourcePath));
  const handoutPreview = createHandoutPreview(handoutMarkdown);
  const [handoutPdfExists, mediaIndexExists, interactiveManifestExists] = await Promise.all([
    fileExists(path.join(process.cwd(), handoutPdfSourcePath)),
    fileExists(path.join(process.cwd(), mediaIndexSourcePath)),
    fileExists(path.join(process.cwd(), interactiveManifestSourcePath)),
  ]);
  const mediaDocument = mediaIndexExists
    ? parseRuntimeLessonMediaDocument(await readText(path.join(process.cwd(), mediaIndexSourcePath)))
    : { handoutSummary: null, mediaResources: [] };
  const mediaResources = mediaDocument.mediaResources;
  const interactiveManifest = interactiveManifestExists
    ? normalizeInteractiveRuntimeManifest(
        await readJson(path.join(process.cwd(), interactiveManifestSourcePath)),
      )
    : null;

  const nodesWithFront = await Promise.all(
    graphOverlay.nodes.map(async (node) => ({
      ...node,
      frontContent: await loadFrontContentForNode(node),
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
    handoutPdfPath: handoutPdfExists ? handoutPdfPathCandidate : null,
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
