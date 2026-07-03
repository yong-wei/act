import { promises as fs, type Dirent } from 'node:fs';
import path from 'node:path';

type RuntimeLessonMediaKind = 'video' | 'audio' | 'slides' | 'pdf' | 'other';
type RuntimeLessonMediaAccessMode = 'dialog' | 'new_tab';
type RuntimeLessonMediaEmbedMode = 'iframe' | 'none';
type RuntimeLessonMediaStatus = 'ready' | 'pending';

export interface ScriptRuntimeLessonResourceCatalogEntry {
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
    groups: Array<{ step_ids: string[]; node_ids: string[] }>;
    nodes: Array<{ id: string; name: string }>;
  };
  handoutPath: string;
  handoutSourcePath: string;
  handoutPdfPath: string | null;
  mediaResources: Array<{
    id: string;
    title: string;
    filename: string;
    kind: RuntimeLessonMediaKind;
    url: string | null;
    accessMode: RuntimeLessonMediaAccessMode;
    embedMode: RuntimeLessonMediaEmbedMode;
    status: RuntimeLessonMediaStatus;
    featured: boolean;
  }>;
}

type RuntimeKnowledgeGroup = {
  step_ids: string[];
  node_ids: string[];
};

type RuntimeLessonJson = {
  lesson_id?: string;
  title?: string;
  handout_path?: string;
  handout_source_path?: string;
  handout_pdf_path?: string | null;
  handout_pdf_source_path?: string;
  media_index_source_path?: string;
  card_order?: string[];
  sequence?: {
    groups?: RuntimeKnowledgeGroup[];
    card_order?: string[];
  };
};

type RuntimeGraphOverlay = {
  lesson_id?: string;
  focus_node_ids?: string[];
  entry_nodes?: string[];
  summary_nodes?: string[];
  card_order?: string[];
  groups?: RuntimeKnowledgeGroup[];
  nodes?: Array<{ id: string; name: string }>;
};

const LESSON_ID_MAP_PATH = path.join(
  process.cwd(),
  'course-content',
  'authoring',
  'shared',
  'lesson-id-map.json',
);
const RUNTIME_LESSONS_DIR = path.join(process.cwd(), 'course-content', 'runtime', 'lessons');

async function readJson<T>(absolutePath: string): Promise<T> {
  const content = await fs.readFile(absolutePath, 'utf8');
  return JSON.parse(content) as T;
}

async function fileExists(absolutePath: string): Promise<boolean> {
  try {
    await fs.access(absolutePath);
    return true;
  } catch (error) {
    if (!isMissingPathError(error)) throw error;
    return false;
  }
}

function isMissingPathError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as NodeJS.ErrnoException).code === 'ENOENT';
}

async function loadRuntimeLessonDirIndex() {
  const payload = await readJson<{
    entries?: Array<{ request_ids?: string[]; runtime_lesson_dir?: string }>;
  }>(LESSON_ID_MAP_PATH);
  const index: Record<string, string> = {};
  for (const entry of payload.entries ?? []) {
    const runtimeLessonDir = entry.runtime_lesson_dir;
    if (!runtimeLessonDir) continue;
    for (const requestId of entry.request_ids ?? []) {
      index[String(requestId)] = runtimeLessonDir;
    }
  }
  return index;
}

async function loadRuntimeLessonFragmentsFromContent(): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(RUNTIME_LESSONS_DIR, { withFileTypes: true });
  } catch (error) {
    if (!isMissingPathError(error)) throw error;
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
  const missingIndexedFragments = Object.values(index).filter((fragment) => !existingFragments.includes(fragment));
  if (missingIndexedFragments.length > 0) {
    throw new Error(`Missing runtime lesson JSON for mapped lessons: ${uniqueSorted(missingIndexedFragments).join(', ')}`);
  }
  return existingFragments
    .filter((fragment): fragment is string => Boolean(fragment))
    .sort((left, right) => left.localeCompare(right));
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function inferRuntimeMediaKind(filename: string): RuntimeLessonMediaKind {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.mp4' || ext === '.webm') return 'video';
  if (ext === '.m4a' || ext === '.mp3' || ext === '.wav') return 'audio';
  if (ext === '.pdf' && /(^|[-_])slides(?:[-_.]|$)/i.test(path.basename(filename))) return 'slides';
  if (ext === '.pdf') return 'pdf';
  return 'other';
}

function normalizeRuntimeMediaId(filename: string) {
  return filename.replace(/\.[^.]+$/, '');
}

function isLessonHandoutMarkdownFilename(filename: string): boolean {
  return /(?:^|[-_])handout\.md$/i.test(filename);
}

function isRuntimeMediaFilename(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return [
    '.mp4',
    '.webm',
    '.m4a',
    '.mp3',
    '.wav',
    '.pdf',
    '.png',
    '.jpg',
    '.jpeg',
    '.svg',
    '.gif',
    '.webp',
  ].includes(ext);
}

function parseRuntimeLessonMediaResources(
  markdown: string,
): ScriptRuntimeLessonResourceCatalogEntry['mediaResources'] {
  const resources: ScriptRuntimeLessonResourceCatalogEntry['mediaResources'] = [];
  const seenFilenames = new Set<string>();
  const lines = markdown.split(/\r?\n/);
  let currentFilename: string | null = null;
  let currentTitle: string | null = null;
  let currentUrl: string | null = null;

  const flushCurrent = () => {
    if (!currentFilename) return;
    const kind = inferRuntimeMediaKind(currentFilename);
    if (!isLessonHandoutMarkdownFilename(currentFilename) && !seenFilenames.has(currentFilename)) {
      seenFilenames.add(currentFilename);
      resources.push({
        id: normalizeRuntimeMediaId(currentFilename),
        title: currentTitle ?? currentFilename,
        filename: currentFilename,
        kind,
        url: currentUrl,
        accessMode: kind === 'pdf' || kind === 'slides' ? 'new_tab' : 'dialog',
        embedMode: kind === 'pdf' || kind === 'slides' ? 'none' : 'iframe',
        status: currentUrl ? 'ready' : 'pending',
        featured: currentFilename.includes('-course.'),
      });
    }
    currentFilename = null;
    currentTitle = null;
    currentUrl = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      flushCurrent();
      const filename = headingMatch[1].trim();
      if (!isRuntimeMediaFilename(filename)) continue;
      currentFilename = filename;
      currentTitle = null;
      currentUrl = null;
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
  return resources;
}

async function findExistingProjectPath(candidates: string[]) {
  for (const candidate of Array.from(new Set(candidates))) {
    if (await fileExists(path.join(process.cwd(), candidate))) return candidate;
  }
  return null;
}

async function resolveRequiredProjectPath(candidates: string[], label: string) {
  const existingPath = await findExistingProjectPath(candidates);
  if (existingPath) return existingPath;
  throw new Error(`${label} missing. Checked: ${Array.from(new Set(candidates)).join(', ')}`);
}

export async function loadAllLessonRuntimeResourceCatalogEntriesForAudit(): Promise<
  ScriptRuntimeLessonResourceCatalogEntry[]
> {
  const lessonFragments = await loadRuntimeLessonFragments();
  return Promise.all(lessonFragments.map(loadLessonRuntimeResourceCatalogEntryForAudit));
}

async function loadLessonRuntimeResourceCatalogEntryForAudit(
  runtimeLessonFragment: string,
): Promise<ScriptRuntimeLessonResourceCatalogEntry> {
  const lessonDir = path.join(RUNTIME_LESSONS_DIR, runtimeLessonFragment);
  const [lesson, graphOverlay] = await Promise.all([
    readJson<RuntimeLessonJson>(path.join(lessonDir, 'lesson.json')),
    readJson<RuntimeGraphOverlay>(path.join(lessonDir, 'graph-overlay.json')),
  ]);
  const canonicalLessonId = lesson.lesson_id || graphOverlay.lesson_id || runtimeLessonFragment;
  const handoutFilename = `${canonicalLessonId}-handout.md`;
  const handoutPdfFilename = `${canonicalLessonId}-handout.pdf`;
  const preferredHandoutSourcePath =
    lesson.handout_source_path ?? `course-content/runtime/lessons/${runtimeLessonFragment}/${handoutFilename}`;
  const handoutSourcePath = await resolveRequiredProjectPath([
    preferredHandoutSourcePath,
    `course-content/runtime/lessons/${runtimeLessonFragment}/${handoutFilename}`,
    `course-content/runtime/lessons/${runtimeLessonFragment}/handout.md`,
  ], `Missing runtime handout for ${runtimeLessonFragment}`);
  const handoutPath = lesson.handout_path && handoutSourcePath === preferredHandoutSourcePath
    ? lesson.handout_path
    : `/course-runtime/lessons/${runtimeLessonFragment}/${path.basename(handoutSourcePath)}`;
  const preferredHandoutPdfSourcePath =
    lesson.handout_pdf_source_path ?? `course-content/runtime/lessons/${runtimeLessonFragment}/${handoutPdfFilename}`;
  const handoutPdfSourcePath = await findExistingProjectPath([
    preferredHandoutPdfSourcePath,
    `course-content/runtime/lessons/${runtimeLessonFragment}/${handoutPdfFilename}`,
    `course-content/runtime/lessons/${runtimeLessonFragment}/handout.pdf`,
  ]);
  const handoutPdfPathCandidate =
    handoutPdfSourcePath && lesson.handout_pdf_path && handoutPdfSourcePath === preferredHandoutPdfSourcePath
      ? lesson.handout_pdf_path
      : handoutPdfSourcePath
        ? `/course-runtime/lessons/${runtimeLessonFragment}/${path.basename(handoutPdfSourcePath)}`
        : null;
  const mediaIndexSourcePath =
    lesson.media_index_source_path
    ?? `course-content/runtime/lessons/${runtimeLessonFragment}/media/${canonicalLessonId}-media.md`;
  const [mediaIndexExists] = await Promise.all([
    fileExists(path.join(process.cwd(), mediaIndexSourcePath)),
  ]);
  const mediaResources = mediaIndexExists
    ? parseRuntimeLessonMediaResources(await fs.readFile(path.join(process.cwd(), mediaIndexSourcePath), 'utf8'))
    : [];

  return {
    lesson: {
      lesson_id: canonicalLessonId,
      title: lesson.title ?? canonicalLessonId,
    },
    graphOverlay: {
      lesson_id: graphOverlay.lesson_id ?? canonicalLessonId,
      focus_node_ids: graphOverlay.focus_node_ids ?? [],
      entry_nodes: graphOverlay.entry_nodes ?? [],
      summary_nodes: graphOverlay.summary_nodes ?? [],
      card_order: graphOverlay.card_order ?? lesson.card_order ?? [],
      groups: graphOverlay.groups ?? lesson.sequence?.groups ?? [],
      nodes: (graphOverlay.nodes ?? []).map((node) => ({
        id: node.id,
        name: node.name,
      })),
    },
    handoutPath,
    handoutSourcePath,
    handoutPdfPath: handoutPdfPathCandidate,
    mediaResources,
  };
}
