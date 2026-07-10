import { describe, expect, it } from 'vitest';

import type { KnowledgeLinkData } from '../knowledge-graph-system';
import {
  applyFocusedExpansionLayout,
  type KnowledgeGraphPositionedNode,
} from '../graph/layout-engine';
import {
  clearKnowledgeGraphLayoutPins,
  getEmptyKnowledgeGraphLayoutState,
  storeKnowledgeGraphNodePosition,
  syncKnowledgeGraphMutableNodePositions,
} from '../graph/layout-state';

function graphNode(
  id: string,
  positionX = 0,
  positionY = 0,
  runtime?: { x: number; y: number }
): KnowledgeGraphPositionedNode {
  return {
    id,
    name: id,
    nodeType: 'THEORY',
    description: `${id} description`,
    positionX,
    positionY,
    positionZ: 0,
    ...runtime,
  };
}

function expansionLink(id: string, sourceId: string, targetId: string): KnowledgeLinkData {
  return {
    id,
    sourceId,
    targetId,
    relation: 'contains',
  };
}

function coordinatesById(nodes: KnowledgeGraphPositionedNode[]) {
  return Object.fromEntries(nodes.map((node) => [node.id, { x: node.x, y: node.y }]));
}

function distanceFrom(node: KnowledgeGraphPositionedNode, center: { x: number; y: number }) {
  return Math.hypot((node.x ?? 0) - center.x, (node.y ?? 0) - center.y);
}

describe('knowledge graph focused expansion layout', () => {
  it('arranges direct children deterministically around the expanded runtime center', () => {
    const nodes = [
      graphNode('center', -500, -600, { x: 100, y: 200 }),
      graphNode('child-d', 400, 400),
      graphNode('child-b', 200, 200),
      graphNode('child-a', 100, 100),
      graphNode('child-c', 300, 300),
    ];
    const links = [
      expansionLink('d', 'center', 'child-d'),
      expansionLink('b', 'center', 'child-b'),
      expansionLink('a', 'center', 'child-a'),
      expansionLink('c', 'center', 'child-c'),
    ];
    const input = {
      nodes,
      expandedNodeIds: ['center'],
      layoutState: getEmptyKnowledgeGraphLayoutState(),
    };

    const first = applyFocusedExpansionLayout({ ...input, directExpansionLinks: links });
    const repeated = applyFocusedExpansionLayout({
      ...input,
      directExpansionLinks: [...links].reverse(),
    });
    const children = first.filter((node) => node.id.startsWith('child-'));

    expect(coordinatesById(repeated)).toEqual(coordinatesById(first));
    expect(first[0]).toBe(nodes[0]);
    expect(
      new Set(children.map((node) => distanceFrom(node, { x: 100, y: 200 }).toFixed(6))).size
    ).toBe(1);
    expect(
      children.reduce((sum, node) => sum + (node.x ?? 0), 0) / children.length
    ).toBeCloseTo(100);
    expect(
      children.reduce((sum, node) => sum + (node.y ?? 0), 0) / children.length
    ).toBeCloseTo(200);
  });

  it('spills large direct-child sets into stable bounded rings', () => {
    const childIds = Array.from(
      { length: 12 },
      (_, index) => `child-${String(index).padStart(2, '0')}`
    );
    const nodes = [graphNode('center', 0, 0), ...childIds.map((id) => graphNode(id))];
    const links = childIds.map((id) => expansionLink(`link-${id}`, 'center', id));

    const laidOut = applyFocusedExpansionLayout({
      nodes,
      expandedNodeIds: ['center'],
      directExpansionLinks: links,
      layoutState: getEmptyKnowledgeGraphLayoutState(),
    });
    const radii = laidOut
      .filter((node) => node.id.startsWith('child-'))
      .map((node) => Number(distanceFrom(node, { x: 0, y: 0 }).toFixed(6)));
    const uniqueRadii = [...new Set(radii)].sort((a, b) => a - b);

    expect(uniqueRadii).toHaveLength(2);
    expect(uniqueRadii[0]).toBeGreaterThan(0);
    expect(uniqueRadii[1]).toBeLessThan(uniqueRadii[0] * 3);
  });

  it('applies user pins before focused placement and preserves unrelated coordinates', () => {
    const unrelated = graphNode('unrelated', 12, 18, { x: 31, y: 41 });
    const grandchild = graphNode('grandchild', 71, 81, { x: 91, y: 101 });
    const nodes = [
      graphNode('center', -1, -2, { x: 10, y: 20 }),
      graphNode('auto-child', 300, 400, { x: 500, y: 600 }),
      graphNode('pinned-child', 30, 40, { x: 50, y: 60 }),
      unrelated,
      grandchild,
    ];
    const centerPinned = storeKnowledgeGraphNodePosition(undefined, {
      id: 'center',
      x: 400,
      y: 500,
    });
    const layoutState = storeKnowledgeGraphNodePosition(centerPinned, {
      id: 'pinned-child',
      x: 900,
      y: 950,
    });

    const laidOut = applyFocusedExpansionLayout({
      nodes,
      expandedNodeIds: ['center'],
      directExpansionLinks: [
        expansionLink('direct-a', 'center', 'auto-child'),
        expansionLink('direct-pinned', 'center', 'pinned-child'),
        expansionLink('not-direct', 'auto-child', 'grandchild'),
      ],
      layoutState,
    });
    const byId = new Map(laidOut.map((node) => [node.id, node]));

    expect(byId.get('center')).toMatchObject({ x: 400, y: 500, fx: 400, fy: 500 });
    expect(byId.get('pinned-child')).toMatchObject({ x: 900, y: 950, fx: 900, fy: 950 });
    expect(byId.get('auto-child')).not.toMatchObject({ x: 500, y: 600 });
    expect(distanceFrom(byId.get('auto-child')!, { x: 400, y: 500 })).toBeGreaterThan(0);
    expect(byId.get('unrelated')).toBe(unrelated);
    expect(byId.get('unrelated')).toMatchObject({ x: 31, y: 41, positionX: 12, positionY: 18 });
    expect(byId.get('grandchild')).toBe(grandchild);
    expect(byId.get('grandchild')).toMatchObject({ x: 91, y: 101, positionX: 71, positionY: 81 });
  });

  it('restores focused automatic anchors after a user pin is cleared', () => {
    const focusedNodes = applyFocusedExpansionLayout({
      nodes: [graphNode('center'), graphNode('child')],
      expandedNodeIds: ['center'],
      directExpansionLinks: [expansionLink('direct', 'center', 'child')],
      layoutState: getEmptyKnowledgeGraphLayoutState(),
    });
    const focusedChild = focusedNodes[1];
    const focusedPosition = { x: focusedChild.x, y: focusedChild.y };
    const userPinned = storeKnowledgeGraphNodePosition(undefined, {
      id: 'child',
      x: 700,
      y: 800,
    });

    syncKnowledgeGraphMutableNodePositions(focusedNodes, userPinned);
    expect(focusedChild).toMatchObject({ x: 700, y: 800, fx: 700, fy: 800 });

    syncKnowledgeGraphMutableNodePositions(focusedNodes, clearKnowledgeGraphLayoutPins(userPinned));
    expect(focusedChild).toMatchObject({
      ...focusedPosition,
      fx: focusedPosition.x,
      fy: focusedPosition.y,
    });
  });
});
