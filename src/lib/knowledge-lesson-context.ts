import 'server-only';

import fs from 'node:fs/promises';
import path from 'node:path';

import { normalizeExactKnowledgeLessonId } from './knowledge-lesson-identity';
import {
  buildKnowledgeLessonOverlayRevision,
  KnowledgeLessonOverlayValidationError,
  normalizeKnowledgeLessonOverlayLinks,
  type KnowledgeLessonMappingGaps,
  type NormalizedKnowledgeLessonLink,
  type SanitizedKnowledgeLessonContext,
} from './knowledge-lesson-overlay';

const DEFAULT_RUNTIME_LESSONS_DIR = path.join(
  process.cwd(),
  'course-content',
  'runtime',
  'lessons'
);

function isMissingPath(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as NodeJS.ErrnoException).code === 'ENOENT';
}

export async function resolveExactRuntimeLessonContext(
  requestedLessonId: string | null | undefined,
  graph: {
    graphVersion?: string;
    nodes: ReadonlyArray<{ id: string }>;
    links: readonly unknown[];
    inspectionLinks?: readonly unknown[];
  },
  runtimeLessonsDir = DEFAULT_RUNTIME_LESSONS_DIR
): Promise<SanitizedKnowledgeLessonContext | null> {
  const lessonId = normalizeExactKnowledgeLessonId(requestedLessonId);
  if (!lessonId) return null;

  try {
    const lessonDir = path.join(runtimeLessonsDir, lessonId);
    const overlayPath = path.join(lessonDir, 'graph-overlay.json');
    const [directory, overlayFile] = await Promise.all([
      fs.lstat(lessonDir),
      fs.lstat(overlayPath),
    ]);
    if (
      !directory.isDirectory()
      || directory.isSymbolicLink()
      || !overlayFile.isFile()
      || overlayFile.isSymbolicLink()
    ) return null;

    const overlay = JSON.parse(await fs.readFile(overlayPath, 'utf8')) as Record<string, unknown>;
    if (!overlay || typeof overlay !== 'object' || Array.isArray(overlay)) return null;
    if (
      overlay.lesson_id !== lessonId
      || !Array.isArray(overlay.card_order)
      || overlay.card_order.length === 0
      || !Array.isArray(overlay.links)
    ) {
      return null;
    }
    const cardOrder = overlay.card_order.map((value) => {
      if (typeof value !== 'string' || !value || value.trim() !== value) {
        throw new KnowledgeLessonOverlayValidationError('card_order must contain exact node ids.');
      }
      return value;
    });
    const links = normalizeKnowledgeLessonOverlayLinks(overlay.links);
    const overlayRevision = buildKnowledgeLessonOverlayRevision({ lessonId, cardOrder, links }).sha256;
    const canonicalNodeIds = new Set(graph.nodes.map((node) => node.id));
    const cardOrderNodeIds: string[] = [];
    const seenCardOrderIds = new Set<string>();
    const mappingGaps: KnowledgeLessonMappingGaps = { cardOrder: [], links: [] };
    for (const nodeId of cardOrder) {
      if (!canonicalNodeIds.has(nodeId)) {
        mappingGaps.cardOrder.push({ nodeId, reason: 'missing' });
      } else if (seenCardOrderIds.has(nodeId)) {
        mappingGaps.cardOrder.push({ nodeId, reason: 'duplicate' });
      } else {
        seenCardOrderIds.add(nodeId);
        cardOrderNodeIds.push(nodeId);
      }
    }

    const canonicalLinks = normalizeKnowledgeLessonOverlayLinks(graph.inspectionLinks ?? graph.links);
    const canonicalByTriple = new Map<string, NormalizedKnowledgeLessonLink[]>();
    for (const link of canonicalLinks) {
      const key = `${link.sourceId}\u0000${link.targetId}\u0000${link.normalizedType}`;
      canonicalByTriple.set(key, [...(canonicalByTriple.get(key) ?? []), link]);
    }
    const seenOverlayTriples = new Set<string>();
    for (const link of links) {
      const key = `${link.sourceId}\u0000${link.targetId}\u0000${link.normalizedType}`;
      const reverseKey = `${link.targetId}\u0000${link.sourceId}\u0000${link.normalizedType}`;
      let reason: KnowledgeLessonMappingGaps['links'][number]['reason'] | null = null;
      const matches = canonicalByTriple.get(key) ?? [];
      if (
        link.relationId.startsWith('chapter-link:')
        || link.sourceId.startsWith('chapter-node:')
        || link.targetId.startsWith('chapter-node:')
      ) {
        reason = 'synthetic';
      } else if (matches.length === 0) {
        reason = (canonicalByTriple.get(reverseKey)?.length ?? 0) > 0 ? 'reverse' : 'missing';
      } else if (matches.length > 1) {
        reason = 'ambiguous';
      } else if (seenOverlayTriples.has(key)) {
        reason = 'duplicate';
      } else if (link.relationId && link.relationId !== matches[0].relationId) {
        reason = 'stale';
      }
      if (matches.length === 1) seenOverlayTriples.add(key);
      if (reason) mappingGaps.links.push({ ...link, reason });
    }

    return { lessonId, overlayRevision, cardOrderNodeIds, mappingGaps };
  } catch (error) {
    if (isMissingPath(error)) return null;
    if (error instanceof SyntaxError || error instanceof KnowledgeLessonOverlayValidationError) return null;
    throw error;
  }
}
