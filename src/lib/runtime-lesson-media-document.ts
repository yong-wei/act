import {
  isLessonHandoutMarkdownFilename,
} from '@/lib/lesson-artifact-names';

export type RuntimeLessonMediaKind = 'video' | 'audio' | 'slides' | 'pdf' | 'other';
export type RuntimeLessonMediaAccessMode = 'dialog' | 'new_tab';
export type RuntimeLessonMediaEmbedMode = 'iframe' | 'none';
export type RuntimeLessonMediaStatus = 'ready' | 'pending';

export interface RuntimeLessonMediaResource {
  id: string;
  title: string;
  filename: string;
  kind: RuntimeLessonMediaKind;
  url: string | null;
  legacyUrl?: string | null;
  objectKey?: string;
  sha256?: string;
  sizeBytes?: number;
  accessMode: RuntimeLessonMediaAccessMode;
  embedMode: RuntimeLessonMediaEmbedMode;
  status: RuntimeLessonMediaStatus;
  featured: boolean;
}

export interface RuntimeLessonMediaDocument {
  handoutSummary: string | null;
  mediaResources: RuntimeLessonMediaResource[];
}

function filenameExtension(filename: string) {
  const name = filename.split('/').at(-1) ?? filename;
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

function inferRuntimeMediaKind(filename: string): RuntimeLessonMediaKind {
  const ext = filenameExtension(filename);
  if (ext === '.mp4' || ext === '.webm') return 'video';
  if (ext === '.m4a' || ext === '.mp3' || ext === '.wav') return 'audio';
  if (ext === '.pdf' && /(^|[-_])slides(?:[-_.]|$)/i.test(filename.split('/').at(-1) ?? filename)) return 'slides';
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
    if (isLessonHandoutMarkdownFilename(currentFilename)) {
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
      accessMode: kind === 'pdf' || kind === 'slides' ? 'new_tab' : 'dialog',
      embedMode: kind === 'pdf' || kind === 'slides' ? 'none' : 'iframe',
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
      inHandoutSection = isLessonHandoutMarkdownFilename(currentFilename);
      continue;
    }
    if (inHandoutSection) {
      if (line) handoutSummary = handoutSummary ? `${handoutSummary} ${line}` : line;
      continue;
    }
    if (currentFilename && !currentTitle && line.startsWith('- ')) {
      currentTitle = line.slice(2).trim();
      continue;
    }
    if (currentFilename && !currentUrl && /^https?:\/\//i.test(line)) currentUrl = line;
  }

  flushCurrent();
  return { handoutSummary, mediaResources: resources };
}
