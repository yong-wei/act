import 'server-only';

import fs from 'node:fs/promises';
import path from 'node:path';

type RuntimeNode = {
  id: string;
  name: string;
  nodeType: string;
  description: string;
  bloomLevel?: string;
  knowledgeDim?: string;
  metadata?: Record<string, unknown>;
  content?: Record<string, unknown>;
  resources?: string[];
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
  sequence?: {
    groups?: Array<{ group_name: string; step_ids: string[]; node_ids: string[] }>;
    card_order?: string[];
  };
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
  handoutPreview: string;
  handoutSummary: string;
}

const RUNTIME_ROOT = path.join(process.cwd(), 'course-content', 'runtime');

async function readJson<T>(absolutePath: string): Promise<T> {
  const content = await fs.readFile(absolutePath, 'utf8');
  return JSON.parse(content) as T;
}

async function readText(absolutePath: string): Promise<string> {
  return fs.readFile(absolutePath, 'utf8');
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

async function loadFrontContentForNode(node: RuntimeNode): Promise<string> {
  const resourcePath = (node.resources ?? []).find((item) => item.endsWith('.md') || item.endsWith('.mdx'));
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
  const lessonDir = path.join(RUNTIME_ROOT, 'lessons', lessonId);
  const [lesson, graphOverlay] = await Promise.all([
    readJson<RuntimeLessonJson>(path.join(lessonDir, 'lesson.json')),
    readJson<RuntimeGraphOverlay>(path.join(lessonDir, 'graph-overlay.json')),
  ]);

  const handoutSourcePath = lesson.handout_source_path ?? `course-content/runtime/lessons/${lessonId}/handout.md`;
  const handoutPath = lesson.handout_path ?? `/course-runtime/lessons/${lessonId}/handout.md`;
  const handoutMarkdown = await readText(path.join(process.cwd(), handoutSourcePath));
  const handoutPreview = createHandoutPreview(handoutMarkdown);

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
    handoutPreview,
    handoutSummary: createHandoutSummary({
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
  };
}
