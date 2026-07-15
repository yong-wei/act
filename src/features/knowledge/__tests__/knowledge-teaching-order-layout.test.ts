import { describe, expect, it } from 'vitest';

import { buildKnowledgeTeachingOrderLayout } from '../graph/teaching-order-layout';
import { getKnowledgeNodeMaximumPresentationRadius } from '../graph/visual-config';
import type { KnowledgeNodeLabelMeasureText } from '../graph/node-label-layout';

const wideGlyphMeasure: KnowledgeNodeLabelMeasureText = (text) => Array.from(text).reduce(
  (width, character) => width + (character === 'W' || character === 'M' ? 16 : 10),
  0
);

const nodes = ['a', 'b', 'c', 'd', 'unordered'].map((id) => ({
  id,
  name: id,
  positionX: 0,
  positionY: 0,
  positionZ: 0,
}));

describe('knowledge teaching order layout', () => {
  it.each([
    ['virtual chapter', { id: 'chapter-node:virtual', metadata: { isVirtualChapter: true, nodeCount: 96 }, graphDegree: 2 }],
    ['core', { id: 'core', metadata: { importance: 5 }, graphDegree: 2 }],
    ['foundation', { id: 'foundation', metadata: { importance: 4 }, graphDegree: 2 }],
    ['high degree', { id: 'degree', metadata: {}, graphDegree: 80 }],
  ])('covers the focused %s presentation radius in collision bounds', (_case, node) => {
    const result = buildKnowledgeTeachingOrderLayout({
      nodes: [{ ...node, name: '知识节点' }],
      links: [],
      lessonOrderNodeIds: [node.id],
      viewportWidth: 320,
      viewportHeight: 270,
    });
    const radius = getKnowledgeNodeMaximumPresentationRadius(node);
    expect(result.collisionBoundsByNodeId[node.id].halfWidth).toBeGreaterThanOrEqual(radius);
    expect(result.collisionBoundsByNodeId[node.id].halfHeight).toBeGreaterThanOrEqual(radius);
  });
  it('keeps lesson order authoritative and reports opposing post-requisite constraints', () => {
    const result = buildKnowledgeTeachingOrderLayout({
      nodes,
      links: [
        { id: 'conflict', sourceId: 'b', targetId: 'a', relationType: 'leads_to' },
        { id: 'fill', sourceId: 'b', targetId: 'c', relationType: 'prerequisite' },
        { id: 'indirect-conflict', sourceId: 'c', targetId: 'a', relationType: 'follows' },
        { id: 'association', sourceId: 'd', targetId: 'a', relationType: 'related' },
      ],
      lessonOrderNodeIds: ['a', 'b'],
      viewportWidth: 900,
      viewportHeight: 600,
    });

    expect(result.orderNodeIds.slice(0, 3)).toEqual(['a', 'b', 'c']);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'LESSON_POST_REQUISITE_CONFLICT',
      relationId: 'conflict',
    }));
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'LESSON_POST_REQUISITE_CONFLICT',
      relationId: 'indirect-conflict',
    }));
    expect(result.unorderedNodeIds).toContain('d');
    expect(result.unorderedNodeIds).toContain('unordered');
    expect(Math.hypot(result.positions.a.x, result.positions.a.y)).toBeLessThan(
      Math.hypot(result.positions.c.x, result.positions.c.y)
    );
    expect(Math.max(...Object.values(result.positions).map(({ x, y }) => Math.hypot(x, y)))).toBeLessThanOrEqual(360);
    const positionedIds = Object.keys(result.positions);
    positionedIds.forEach((nodeId, index) => {
      positionedIds.slice(index + 1).forEach((otherNodeId) => {
        const left = result.positions[nodeId];
        const right = result.positions[otherNodeId];
        expect(Math.hypot(left.x - right.x, left.y - right.y)).toBeGreaterThanOrEqual(80);
      });
    });
  });

  it('uses only canonical post-requisite order without lesson context and condenses cycles', () => {
    const result = buildKnowledgeTeachingOrderLayout({
      nodes,
      links: [
        { id: 'ab', sourceId: 'a', targetId: 'b', relationType: 'leads_to' },
        { id: 'bc', sourceId: 'b', targetId: 'c', relationType: 'prerequisite' },
        { id: 'cb', sourceId: 'c', targetId: 'b', relationType: 'follows' },
      ],
      lessonOrderNodeIds: [],
      viewportWidth: 640,
      viewportHeight: 480,
    });

    expect(result.orderNodeIds[0]).toBe('a');
    expect(result.cycleGroups).toContainEqual(['b', 'c']);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'POST_REQUISITE_CYCLE' }));
    expect(Math.hypot(result.positions.b.x, result.positions.b.y)).toBeCloseTo(
      Math.hypot(result.positions.c.x, result.positions.c.y)
    );
  });

  it('diagnoses a single-node post-requisite self-loop as an SCC cycle', () => {
    const result = buildKnowledgeTeachingOrderLayout({
      nodes: [{ id: 'self', name: 'self' }],
      links: [{ id: 'self-loop', sourceId: 'self', targetId: 'self', relationType: 'follows' }],
      lessonOrderNodeIds: [],
      viewportWidth: 320,
      viewportHeight: 480,
    });

    expect(result.cycleGroups).toEqual([['self']]);
    expect(result.diagnostics).toContainEqual({ code: 'POST_REQUISITE_CYCLE', nodeIds: ['self'] });
  });

  it('returns finite fit bounds for a narrow viewport with 100 unordered long-label nodes', () => {
    const manyNodes = Array.from({ length: 100 }, (_, index) => ({
      id: `unordered-${index}`,
      name: `很长的无序知识节点名称-${index}-用于碰撞边界`,
    }));
    const result = buildKnowledgeTeachingOrderLayout({
      nodes: manyNodes,
      links: [],
      lessonOrderNodeIds: [],
      viewportWidth: 280,
      viewportHeight: 640,
    });

    expect(result.unorderedNodeIds).toHaveLength(100);
    expect(result.iterations).toBeLessThanOrEqual(512);
    expect(result.fitScale).toBeGreaterThan(0);
    expect(result.fitScale).toBeLessThanOrEqual(1);
    expect(result.bounds.width * result.fitScale).toBeLessThanOrEqual(280 - 48 + 0.001);
    expect(result.bounds.height * result.fitScale).toBeLessThanOrEqual(640 - 48 + 0.001);
    expect(result.bounds.width).toBeGreaterThan(0);
    expect(result.bounds.height).toBeGreaterThan(0);
    expect(Object.values(result.collisionBoundsByNodeId).every((bounds) => (
      bounds.halfWidth > 0 && bounds.halfHeight > 0
    ))).toBe(true);
    Object.values(result.positions).forEach(({ x, y }) => {
      expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(result.bounds.minX);
      expect(x).toBeLessThanOrEqual(result.bounds.maxX);
      expect(y).toBeGreaterThanOrEqual(result.bounds.minY);
      expect(y).toBeLessThanOrEqual(result.bounds.maxY);
    });
  });

  it('uses the shared wrapped-label rectangle in collision spacing and total bounds', () => {
    const result = buildKnowledgeTeachingOrderLayout({
      nodes: [
        { id: 'short', name: '短名' },
        { id: 'long', name: 'AnExtremelyLongUnbrokenEnglishKnowledgeConcept混合文本' },
      ],
      links: [],
      lessonOrderNodeIds: [],
      viewportWidth: 640,
      viewportHeight: 480,
    });

    expect(result.collisionBoundsByNodeId.long.halfWidth).toBeGreaterThan(
      result.collisionBoundsByNodeId.short.halfWidth
    );
    expect(result.bounds.width).toBeGreaterThanOrEqual(
      result.collisionBoundsByNodeId.long.halfWidth * 2
    );
  });

  it.each([
    [320, 270],
    [390, 844],
  ])('keeps teaching-label rectangles disjoint after mobile projection at %ix%i', (width, height) => {
    const mobileNodes = Array.from({ length: 12 }, (_, index) => ({
      id: `mobile-${index}`,
      name: index % 2 === 0 ? `WWWW概念MMMM-${index}` : `中文Mixed节点-${index}`,
    }));
    const result = buildKnowledgeTeachingOrderLayout({
      nodes: mobileNodes,
      links: mobileNodes.slice(1).map((node, index) => ({
        id: `mobile-link-${index}`,
        sourceId: mobileNodes[index].id,
        targetId: node.id,
        relationType: 'prerequisite',
      })),
      lessonOrderNodeIds: [],
      viewportWidth: width,
      viewportHeight: height,
      measureText: wideGlyphMeasure,
    });
    const rectangles = mobileNodes.map((node) => {
      const position = result.positions[node.id];
      const bounds = result.collisionBoundsByNodeId[node.id];
      return {
        left: position.x * result.fitScale - bounds.halfWidth * result.fitScale,
        right: position.x * result.fitScale + bounds.halfWidth * result.fitScale,
        top: position.y * result.fitScale - bounds.halfHeight * result.fitScale,
        bottom: position.y * result.fitScale + bounds.halfHeight * result.fitScale,
      };
    });

    rectangles.forEach((left, index) => rectangles.slice(index + 1).forEach((right) => {
      const overlaps = left.left < right.right && left.right > right.left
        && left.top < right.bottom && left.bottom > right.top;
      expect(overlaps).toBe(false);
    }));
  });

  it('keeps long chains radially ordered and wide branches in one depth band', () => {
    const chainNodes = Array.from({ length: 40 }, (_, index) => ({ id: `chain-${index}` }));
    const chain = buildKnowledgeTeachingOrderLayout({
      nodes: chainNodes,
      links: chainNodes.slice(1).map((node, index) => ({
        id: `chain-link-${index}`,
        sourceId: chainNodes[index].id,
        targetId: node.id,
        relationType: 'prerequisite',
      })),
      lessonOrderNodeIds: [],
      viewportWidth: 360,
      viewportHeight: 640,
    });
    const chainRadii = chainNodes.map((node) => Math.hypot(
      chain.positions[node.id].x,
      chain.positions[node.id].y
    ));
    expect(chainRadii.every((radius, index) => index === 0 || radius > chainRadii[index - 1])).toBe(true);

    const branchNodes = [{ id: 'root' }, ...Array.from({ length: 30 }, (_, index) => ({ id: `branch-${index}` }))];
    const branch = buildKnowledgeTeachingOrderLayout({
      nodes: branchNodes,
      links: branchNodes.slice(1).map((node, index) => ({
        id: `branch-link-${index}`,
        sourceId: 'root',
        targetId: node.id,
        relationType: 'leads_to',
      })),
      lessonOrderNodeIds: [],
      viewportWidth: 1024,
      viewportHeight: 480,
    });
    const branchRadii = branchNodes.slice(1).map((node) => Math.hypot(
      branch.positions[node.id].x,
      branch.positions[node.id].y
    ));
    expect(Math.max(...branchRadii) - Math.min(...branchRadii)).toBeLessThan(0.001);
  });
});
