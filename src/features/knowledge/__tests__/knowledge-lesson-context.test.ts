import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  resolveKnowledgeLessonLocation,
  resolveInitialKnowledgeNodeId,
} from '@/features/knowledge/graph/node-activation';
import { resolveExactRuntimeLessonContext } from '@/lib/knowledge-lesson-context';
import { loadKnowledgeGraphData } from '@/lib/knowledge-graph-source';
import {
  buildKnowledgeLessonOverlayRevision,
  normalizeKnowledgeLessonOverlayLinks,
} from '@/lib/knowledge-lesson-overlay';

const tempRoots: string[] = [];

function createRuntimeLesson(lessonId: string, overlay: Record<string, unknown> = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-lesson-context-'));
  tempRoots.push(root);
  const lessonDir = path.join(root, lessonId);
  fs.mkdirSync(lessonDir, { recursive: true });
  fs.writeFileSync(path.join(lessonDir, 'graph-overlay.json'), JSON.stringify({
    lesson_id: lessonId,
    card_order: ['a', 'missing', 'b', 'a'],
    links: [],
    ...overlay,
  }));
  return root;
}

const canonicalGraph = {
  graphVersion: 'graph-v1',
  nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
  links: [
    { id: 'ab', sourceId: 'a', targetId: 'b', relationType: 'leads_to', strength: 0.8 },
    { id: 'bc-1', sourceId: 'b', targetId: 'c', relationType: 'prerequisite', strength: 0.7 },
    { id: 'bc-2', sourceId: 'b', targetId: 'c', relationType: 'prerequisite', strength: 0.6 },
    { id: 'ca', sourceId: 'c', targetId: 'a', relationType: 'related', strength: 0.5 },
  ],
};

describe('knowledge lesson context helpers', () => {
  afterEach(() => {
    while (tempRoots.length) fs.rmSync(tempRoots.pop()!, { recursive: true, force: true });
  });

  it('accepts only an exact existing runtime lesson directory identity', async () => {
    const runtimeLessonsDir = createRuntimeLesson('1-1');

    await expect(resolveExactRuntimeLessonContext('1-1', canonicalGraph, runtimeLessonsDir)).resolves.toMatchObject({
      lessonId: '1-1',
      cardOrderNodeIds: ['a', 'b'],
    });
    await expect(resolveExactRuntimeLessonContext('unit-1-1', canonicalGraph, runtimeLessonsDir)).resolves.toBeNull();
    await expect(resolveExactRuntimeLessonContext('../1-1', canonicalGraph, runtimeLessonsDir)).resolves.toBeNull();
    await expect(resolveExactRuntimeLessonContext(' 1-1 ', canonicalGraph, runtimeLessonsDir)).resolves.toBeNull();

    fs.rmSync(path.join(runtimeLessonsDir, '1-1'), { recursive: true, force: true });
    await expect(resolveExactRuntimeLessonContext('1-1', canonicalGraph, runtimeLessonsDir)).resolves.toBeNull();
  });

  it('rejects an actual lesson-directory symlink and graph-overlay file symlink', async () => {
    const runtimeLessonsDir = createRuntimeLesson('real-lesson');
    const caseLessonDir = path.join(runtimeLessonsDir, 'lesson-case');
    fs.mkdirSync(caseLessonDir);
    fs.writeFileSync(path.join(caseLessonDir, 'graph-overlay.json'), JSON.stringify({
      lesson_id: 'lesson-case', card_order: ['a'], links: [],
    }));
    await expect(resolveExactRuntimeLessonContext('Lesson-Case', canonicalGraph, runtimeLessonsDir)).resolves.toBeNull();
    fs.symlinkSync(
      path.join(runtimeLessonsDir, 'real-lesson'),
      path.join(runtimeLessonsDir, 'lesson-alias'),
      'dir'
    );
    await expect(resolveExactRuntimeLessonContext('lesson-alias', canonicalGraph, runtimeLessonsDir)).resolves.toBeNull();

    const overlayPath = path.join(runtimeLessonsDir, 'real-lesson', 'graph-overlay.json');
    const symlinkTarget = path.join(runtimeLessonsDir, 'external-overlay.json');
    fs.renameSync(overlayPath, symlinkTarget);
    fs.symlinkSync(symlinkTarget, overlayPath, 'file');
    await expect(resolveExactRuntimeLessonContext('real-lesson', canonicalGraph, runtimeLessonsDir)).resolves.toBeNull();
  });

  it('returns only sanitized context and reports every ineligible overlay mapping', async () => {
    const runtimeLessonsDir = createRuntimeLesson('1-1', {
      links: [
        { id: 'ab', sourceId: 'a', targetId: 'b', relationType: 'leads_to', strength: 0.8 },
        { id: 'same-triple-different-id', sourceId: 'a', targetId: 'b', relationType: 'leads_to', strength: 0.8 },
        { id: 'reverse', sourceId: 'b', targetId: 'a', relationType: 'leads_to' },
        { id: 'missing', sourceId: 'a', targetId: 'c', relationType: 'leads_to' },
        { id: 'stale', sourceId: 'c', targetId: 'a', relationType: 'related' },
        { id: 'ambiguous', sourceId: 'b', targetId: 'c', relationType: 'prerequisite' },
        { id: 'chapter-link:x', sourceId: 'a', targetId: 'b', relationType: 'contains' },
      ],
      private_notes: 'must not escape',
    });

    const context = await resolveExactRuntimeLessonContext('1-1', canonicalGraph, runtimeLessonsDir);

    expect(Object.keys(context ?? {}).sort()).toEqual([
      'cardOrderNodeIds',
      'lessonId',
      'mappingGaps',
      'overlayRevision',
    ]);
    expect(context).not.toHaveProperty('links');
    expect(context).not.toHaveProperty('private_notes');
    expect(context?.mappingGaps.cardOrder.map((gap) => gap.reason)).toEqual(['missing', 'duplicate']);
    expect(context?.mappingGaps.links.map((gap) => gap.reason).sort()).toEqual([
      'ambiguous',
      'duplicate',
      'missing',
      'reverse',
      'stale',
      'synthetic',
    ]);
  });

  it('shares exact canonical UTF-8 bytes and digests with the Python golden vectors', () => {
    const fixture = JSON.parse(fs.readFileSync(
      path.join(process.cwd(), 'course-content/contracts/knowledge-lesson-overlay-golden.json'),
      'utf8'
    )) as {
      vectors: Array<{ input: { lessonId: string; cardOrder: string[]; links: Record<string, unknown>[] }; canonicalUtf8: string; sha256: string }>;
      invalidVectors: Array<{ links: Record<string, unknown>[] }>;
    };

    fixture.vectors.forEach((vector) => {
      const links = normalizeKnowledgeLessonOverlayLinks(vector.input.links);
      const revision = buildKnowledgeLessonOverlayRevision({
        lessonId: vector.input.lessonId,
        cardOrder: vector.input.cardOrder,
        links,
      });
      expect(revision.canonicalUtf8).toBe(vector.canonicalUtf8);
      expect(revision.sha256).toBe(vector.sha256);
    });
    fixture.invalidVectors.forEach((vector) => {
      expect(() => normalizeKnowledgeLessonOverlayLinks(vector.links)).toThrow(/relationId/);
    });
  });

  it('resolves the checked-in 1-1 runtime overlay against the current canonical graph', async () => {
    const graph = await loadKnowledgeGraphData();
    const context = await resolveExactRuntimeLessonContext('1-1', graph);

    expect(context?.lessonId).toBe('1-1');
    expect(context?.overlayRevision).toMatch(/^[0-9a-f]{64}$/);
    expect(context?.cardOrderNodeIds.length).toBeGreaterThan(0);
    expect(Object.keys(context ?? {}).sort()).toEqual([
      'cardOrderNodeIds',
      'lessonId',
      'mappingGaps',
      'overlayRevision',
    ]);
  });

  it('matches exported overlay and runtime-loader revisions for all reconciled lessons', async () => {
    const graph = await loadKnowledgeGraphData();
    for (const lessonId of ['1-1', '4-2', '5-2']) {
      const overlay = JSON.parse(fs.readFileSync(path.join(
        process.cwd(),
        'course-content/runtime/lessons',
        lessonId,
        'graph-overlay.json'
      ), 'utf8')) as { lesson_id: string; card_order: string[]; links: Record<string, unknown>[] };
      const context = await resolveExactRuntimeLessonContext(lessonId, graph);
      const exportedRevision = buildKnowledgeLessonOverlayRevision({
        lessonId: overlay.lesson_id,
        cardOrder: overlay.card_order,
        links: normalizeKnowledgeLessonOverlayLinks(overlay.links),
      }).sha256;
      expect(context?.overlayRevision, lessonId).toBe(exportedRevision);
    }
  });

  it('normalizes a trusted lesson launch into the canonical query without guessing from prose', () => {
    expect(resolveKnowledgeLessonLocation('?node=a-1', '1-1')).toEqual({
      lessonId: '1-1',
      search: '?node=a-1&lessonId=1-1',
    });
    expect(resolveKnowledgeLessonLocation('?node=a-1&title=Lesson%201-1', null)).toEqual({
      lessonId: null,
      search: '?node=a-1&title=Lesson+1-1',
    });
    expect(resolveKnowledgeLessonLocation('?lessonId=..%2F1-1&node=a-1', null)).toEqual({
      lessonId: null,
      search: '?node=a-1',
    });
    expect(resolveKnowledgeLessonLocation('?lessonId=1-1&lessonId=2-1', null)).toEqual({
      lessonId: null,
      search: '',
    });
  });

  it('keeps node over nodeId over initial precedence when lessonId coexists', () => {
    expect(resolveInitialKnowledgeNodeId('?lessonId=1-1&node=preferred&nodeId=legacy', 'initial')).toBe('preferred');
    expect(resolveInitialKnowledgeNodeId('?lessonId=1-1&nodeId=legacy', 'initial')).toBe('legacy');
    expect(resolveInitialKnowledgeNodeId('?lessonId=1-1', 'initial')).toBe('initial');
  });
});
