import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createLessonKnowledgeMapLayout,
  getVisibleKnowledgeMapLinks,
} from '@/features/interactive/shared/lesson-entry-knowledge-map-layout';

type RawGraphOverlay = {
  groups?: RawKnowledgeGroup[];
  card_order?: string[];
  nodes: Array<{
    id: string;
    name: string;
    nodeType?: string;
    description?: string;
    positionX?: number;
    positionY?: number;
    positionZ?: number;
  }>;
  links: Array<{ id: string; sourceId: string; targetId: string; relation: string }>;
};

type RawKnowledgeGroup = {
  group_name?: string;
  title?: string;
  step_ids: string[];
  node_ids: string[];
};

const repoRoot = process.cwd();

function loadOverlay(lessonId: string): RawGraphOverlay {
  return JSON.parse(
    readFileSync(join(repoRoot, 'course-content/runtime/lessons', lessonId, 'graph-overlay.json'), 'utf8'),
  ) as RawGraphOverlay;
}

function expectNoNodeOverlap(layout: ReturnType<typeof createLessonKnowledgeMapLayout>) {
  for (let i = 0; i < layout.nodes.length; i += 1) {
    for (let j = i + 1; j < layout.nodes.length; j += 1) {
      const a = layout.nodes[i];
      const b = layout.nodes[j];
      const overlapX = Math.abs(a.x - b.x) < layout.nodeWidth;
      const overlapY = Math.abs(a.y - b.y) < layout.nodeHeight;
      expect(overlapX && overlapY, `${a.node.id} overlaps ${b.node.id}`).toBe(false);
    }
  }
}

function getGroupTitle(group: RawKnowledgeGroup | undefined, index: number) {
  return group?.group_name ?? group?.title ?? `阶段 ${index + 1}`;
}

describe('lesson entry knowledge map layout', () => {
  it.each(['2-2', '2-3', '4-3', '5-2', '5-3'])('creates stable non-overlapping roadmap positions for lesson %s', (lessonId) => {
    const overlay = loadOverlay(lessonId);
    const layout = createLessonKnowledgeMapLayout({
      nodes: overlay.nodes,
      links: overlay.links,
      groups: overlay.groups ?? [],
      cardOrder: overlay.card_order ?? [],
    });

    expect(layout.nodes).toHaveLength(overlay.nodes.length);
    expect(new Set(layout.nodes.map((item) => item.node.id)).size).toBe(overlay.nodes.length);
    expect(layout.columns.map((column) => column.title)).toContain(getGroupTitle(overlay.groups?.[0], 0));
    expect(layout.width).toBeGreaterThan(layout.nodeWidth * layout.columns.length);
    expect(layout.height).toBeGreaterThan(layout.nodeHeight);
    expectNoNodeOverlap(layout);
  });

  it('uses the first group occurrence as the node home and sorts each column by card order', () => {
    const overlay = loadOverlay('4-3');
    const firstGroup = overlay.groups?.[0];
    expect(firstGroup).toBeTruthy();

    const layout = createLessonKnowledgeMapLayout({
      nodes: overlay.nodes,
      links: overlay.links,
      groups: overlay.groups ?? [],
      cardOrder: overlay.card_order ?? [],
    });

    const firstColumn = layout.columns[0];
    expect(firstColumn.title).toBe(getGroupTitle(firstGroup, 0));
    expect(firstColumn.nodeIds).toEqual(
      (firstGroup?.node_ids ?? [])
        .filter((nodeId, index, source) => source.indexOf(nodeId) === index)
        .sort((a, b) => (overlay.card_order ?? []).indexOf(a) - (overlay.card_order ?? []).indexOf(b)),
    );

    for (const nodeId of firstGroup?.node_ids ?? []) {
      expect(layout.nodeById.get(nodeId)?.columnIndex).toBe(0);
    }
  });

  it('uses title-only runtime groups when group_name is absent', () => {
    const overlay = loadOverlay('5-2');
    expect(overlay.groups?.[0]?.group_name).toBeUndefined();
    expect(overlay.groups?.[0]?.title).toBe('非线性边界入口');

    const layout = createLessonKnowledgeMapLayout({
      nodes: overlay.nodes,
      links: overlay.links,
      groups: overlay.groups ?? [],
      cardOrder: overlay.card_order ?? [],
    });

    expect(layout.columns[0].title).toBe('非线性边界入口');
    expect(layout.columns[0].id).toBe('1-非线性边界入口');
  });

  it('falls back to a related-knowledge column and filters links with missing endpoints', () => {
    const layout = createLessonKnowledgeMapLayout({
      nodes: [
        { id: 'b', name: 'B', nodeType: 'METHOD' },
        { id: 'a', name: 'A', nodeType: 'THEORY' },
        { id: 'c', name: 'C', nodeType: 'CASE' },
      ],
      links: [
        { id: 'a-b', sourceId: 'a', targetId: 'b', relation: 'prerequisite' },
        { id: 'ghost-c', sourceId: 'ghost', targetId: 'c', relation: 'related' },
      ],
      groups: [],
      cardOrder: ['a'],
    });

    expect(layout.columns).toHaveLength(1);
    expect(layout.columns[0].title).toBe('相关知识');
    expect(layout.columns[0].nodeIds).toEqual(['a', 'b', 'c']);
    expect(layout.validLinks.map((link) => link.id)).toEqual(['a-b']);
    expect(layout.nodeById.get('a')).toMatchObject({ outgoingCount: 1, incomingCount: 0 });
    expect(layout.nodeById.get('b')).toMatchObject({ outgoingCount: 0, incomingCount: 1 });
  });

  it('shows one-hop relations by default and all valid relations only in inspection mode', () => {
    const overlay = loadOverlay('2-2');
    const selectedNodeId = overlay.card_order?.[0] ?? overlay.nodes[0].id;
    const layout = createLessonKnowledgeMapLayout({
      nodes: overlay.nodes,
      links: overlay.links,
      groups: overlay.groups ?? [],
      cardOrder: overlay.card_order ?? [],
    });

    const focusedLinks = getVisibleKnowledgeMapLinks(layout, selectedNodeId, false);
    const allLinks = getVisibleKnowledgeMapLinks(layout, selectedNodeId, true);

    expect(focusedLinks.length).toBeGreaterThan(0);
    expect(focusedLinks.length).toBeLessThan(allLinks.length);
    expect(focusedLinks.every((link) => link.sourceId === selectedNodeId || link.targetId === selectedNodeId)).toBe(true);
    expect(allLinks).toHaveLength(layout.validLinks.length);
    expect(focusedLinks.map((link) => link.relationLabel).filter(Boolean)).toEqual(
      expect.arrayContaining(['后置']),
    );
    for (const link of focusedLinks) {
      const dx = link.target.centerX - link.source.centerX;
      const dy = link.target.centerY - link.source.centerY;
      const distanceSquared = dx * dx + dy * dy;
      const startProjection = (link.x1 - link.source.centerX) * dx + (link.y1 - link.source.centerY) * dy;
      const endProjection = (link.x2 - link.source.centerX) * dx + (link.y2 - link.source.centerY) * dy;
      expect(startProjection).toBeGreaterThanOrEqual(0);
      expect(endProjection).toBeLessThanOrEqual(distanceSquared);
      expect(startProjection).toBeLessThan(endProjection);
    }
  });
});
