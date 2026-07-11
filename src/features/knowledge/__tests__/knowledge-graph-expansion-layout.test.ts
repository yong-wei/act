import { describe, expect, it } from 'vitest';

import type { KnowledgeLinkData } from '../knowledge-graph-system';
import {
  applyFocusedExpansionLayout,
  calculateFocusedExpansionRevealTranslation,
  commitKnowledgeGraphRelayoutVersion,
  createFocusedExpansionRevealSignature,
  resolveFocusedExpansionRevealTarget,
  selectFocusedExpansionGraphNodes,
  translateKnowledgeGraphCameraPose,
  freezeKnowledgeGraphDragFrame,
  type KnowledgeGraphPositionedNode,
} from '../graph/layout-engine';
import {
  clearKnowledgeGraphLayoutPins,
  getEmptyKnowledgeGraphLayoutState,
  storeKnowledgeGraphNodePosition,
  syncKnowledgeGraphMutableNodePositions,
} from '../graph/layout-state';
import { createKnowledgeExpansionCommitQueue } from '../graph/node-activation';

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
  return Object.fromEntries(
    [...nodes]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((node) => [node.id, { x: node.x, y: node.y }])
  );
}

function distanceFrom(node: KnowledgeGraphPositionedNode, center: { x: number; y: number }) {
  return Math.hypot((node.x ?? 0) - center.x, (node.y ?? 0) - center.y);
}

describe('knowledge graph focused expansion layout', () => {
  it('places newly revealed neighbors in a deterministic bounded sector instead of a complete ring', () => {
    const childIds = ['child-d', 'child-b', 'child-a', 'child-c'];
    const nodes = [graphNode('center'), ...childIds.map((id) => graphNode(id))];
    const directExpansionLinks = childIds.map((id) => expansionLink(`link-${id}`, 'center', id));

    const laidOut = applyFocusedExpansionLayout({
      nodes,
      expandedNodeIds: ['center'],
      directExpansionLinks,
      layoutState: getEmptyKnowledgeGraphLayoutState(),
      activationSequenceByCenterId: { center: 1 },
    });
    const angles = laidOut.slice(1).map((node) => Math.atan2(node.y ?? 0, node.x ?? 0));

    expect(Math.max(...angles) - Math.min(...angles)).toBeLessThanOrEqual(Math.PI);
    expect(coordinatesById(applyFocusedExpansionLayout({
      nodes: [...nodes].reverse(),
      expandedNodeIds: ['center'],
      directExpansionLinks: [...directExpansionLinks].reverse(),
      layoutState: getEmptyKnowledgeGraphLayoutState(),
      activationSequenceByCenterId: { center: 1 },
    }))).toEqual(coordinatesById(laidOut));
  });

  it('uses activation intent order and stable center ids for overlapping provenance claims', () => {
    const nodes = [
      graphNode('center-a', -100, 0, { x: -100, y: 0 }),
      graphNode('center-b', 100, 0, { x: 100, y: 0 }),
      graphNode('shared'),
    ];
    const links = [
      expansionLink('b-shared', 'center-b', 'shared'),
      expansionLink('a-shared', 'center-a', 'shared'),
    ];
    const first = applyFocusedExpansionLayout({
      nodes,
      expandedNodeIds: ['center-b', 'center-a'],
      directExpansionLinks: links,
      layoutState: getEmptyKnowledgeGraphLayoutState(),
      activationSequenceByCenterId: { 'center-a': 1, 'center-b': 2 },
    });
    const reversedResponse = applyFocusedExpansionLayout({
      nodes,
      expandedNodeIds: ['center-b', 'center-a'],
      directExpansionLinks: [...links].reverse(),
      layoutState: getEmptyKnowledgeGraphLayoutState(),
      activationSequenceByCenterId: { 'center-a': 1, 'center-b': 2 },
    });

    expect(coordinatesById(reversedResponse)).toEqual(coordinatesById(first));
    expect(first.find((node) => node.id === 'shared')?.__knowledgeAutomaticAnchor).toMatchObject({
      provenanceCenterId: 'center-a',
      activationSequence: 1,
    });
  });

  it('keeps first-reveal coordinates when a later overlapping payload merges', () => {
    const first = applyFocusedExpansionLayout({
      nodes: [graphNode('center-a', -100, 0), graphNode('center-b', 100, 0), graphNode('shared')],
      expandedNodeIds: ['center-a'],
      directExpansionLinks: [expansionLink('a-shared', 'center-a', 'shared')],
      layoutState: getEmptyKnowledgeGraphLayoutState(),
      activationSequenceByCenterId: { 'center-a': 1 },
      materializedNodeIds: ['shared'],
    });
    const shared = first.find((node) => node.id === 'shared')!;
    const later = applyFocusedExpansionLayout({
      nodes: first,
      expandedNodeIds: ['center-a', 'center-b'],
      directExpansionLinks: [
        expansionLink('b-shared', 'center-b', 'shared'),
        expansionLink('a-shared', 'center-a', 'shared'),
      ],
      layoutState: getEmptyKnowledgeGraphLayoutState(),
      activationSequenceByCenterId: { 'center-a': 1, 'center-b': 2 },
      materializedNodeIds: ['shared'],
    });
    expect(later.find((node) => node.id === 'shared')).toMatchObject({ x: shared.x, y: shared.y });
  });

  it('materializes overlapping deferred responses in intent order when response order is reversed', async () => {
    const queue = createKnowledgeExpansionCommitQueue();
    const base = [graphNode('center-a', -100, 0), graphNode('center-b', 100, 0), graphNode('shared')];
    let current = base;
    queue.register(1);
    queue.register(2);
    let resolveFirst!: () => void;
    let resolveSecond!: () => void;
    const firstResponse = new Promise<void>((resolve) => { resolveFirst = resolve; }).then(() => {
      queue.settle(1, () => {
        current = applyFocusedExpansionLayout({
          nodes: current,
          expandedNodeIds: ['center-a'],
          directExpansionLinks: [expansionLink('a-shared', 'center-a', 'shared')],
          layoutState: getEmptyKnowledgeGraphLayoutState(),
          activationSequenceByCenterId: { 'center-a': 1, 'center-b': 2 },
          materializedNodeIds: ['shared'],
        });
      });
    });
    const secondResponse = new Promise<void>((resolve) => { resolveSecond = resolve; }).then(() => {
      queue.settle(2, () => {
        current = applyFocusedExpansionLayout({
          nodes: current,
          expandedNodeIds: ['center-a', 'center-b'],
          directExpansionLinks: [
            expansionLink('b-shared', 'center-b', 'shared'),
            expansionLink('a-shared', 'center-a', 'shared'),
          ],
          layoutState: getEmptyKnowledgeGraphLayoutState(),
          activationSequenceByCenterId: { 'center-a': 1, 'center-b': 2 },
          materializedNodeIds: ['shared'],
        });
      });
    });
    resolveSecond();
    await secondResponse;
    expect(current).toBe(base);
    resolveFirst();
    await firstResponse;
    expect(current.find((node) => node.id === 'shared')?.__knowledgeAutomaticAnchor).toMatchObject({
      activationSequence: 1,
      provenanceCenterId: 'center-a',
    });
  });

  it('uses historical anchored sectors as occupied space for later expansion', () => {
    const historical = {
      ...graphNode('historical', 96, 0, { x: 96, y: 0 }),
      __knowledgeAutomaticAnchor: {
        id: 'historical', x: 96, y: 0, activationSequence: 1, provenanceCenterId: 'older-center',
      },
    };
    const laidOut = applyFocusedExpansionLayout({
      nodes: [graphNode('center'), historical, graphNode('new-child')],
      expandedNodeIds: ['center'],
      directExpansionLinks: [expansionLink('new', 'center', 'new-child')],
      layoutState: getEmptyKnowledgeGraphLayoutState(),
      activationSequenceByCenterId: { center: 2 },
      materializedNodeIds: ['historical', 'new-child'],
    });
    expect(laidOut.find((node) => node.id === 'new-child')?.x).not.toBeCloseTo(96);
  });

  it('chooses the same canonical multi-edge relation for every payload permutation', () => {
    const nodes = [graphNode('center'), graphNode('a'), graphNode('b')];
    const links = [
      { ...expansionLink('weak-a', 'center', 'a'), relation: 'related', density: 'weak' },
      { ...expansionLink('structure-a', 'a', 'center'), relation: 'contains', density: 'structure' },
      { ...expansionLink('context-b', 'center', 'b'), relation: 'prerequisite', density: 'context' },
    ] as unknown as KnowledgeLinkData[];
    const input = {
      nodes,
      expandedNodeIds: ['center'],
      layoutState: getEmptyKnowledgeGraphLayoutState(),
      activationSequenceByCenterId: { center: 1 },
    };
    expect(coordinatesById(applyFocusedExpansionLayout({ ...input, directExpansionLinks: links })))
      .toEqual(coordinatesById(applyFocusedExpansionLayout({ ...input, directExpansionLinks: [...links].reverse() })));
  });

  it('clears stale runtime provenance on graph-version invalidation', () => {
    const runtime = new Map([['node', { x: 1, y: 2, __knowledgeAutomaticAnchor: { id: 'node', x: 1, y: 2, provenanceCenterId: 'old' } }]]);
    expect(commitKnowledgeGraphRelayoutVersion({
      committedVersion: 'graph-v1', nextVersion: 'graph-v2', runtimePositions: runtime,
    })).toBe('graph-v2');
    expect(runtime.size).toBe(0);
  });

  it('keeps an already established neighbor coordinate and only reveals its additional arc', () => {
    const existing = graphNode('existing', 30, 40, { x: 130, y: 140 });
    const laidOut = applyFocusedExpansionLayout({
      nodes: [graphNode('center'), existing],
      expandedNodeIds: ['center'],
      directExpansionLinks: [expansionLink('additional-arc', 'center', 'existing')],
      layoutState: getEmptyKnowledgeGraphLayoutState(),
      activationSequenceByCenterId: { center: 1 },
      materializedNodeIds: [],
    });

    expect(laidOut[1]).toBe(existing);
    expect(laidOut[1]).toMatchObject({ x: 130, y: 140, positionX: 30, positionY: 40 });
  });

  it('uses additional arcs for dense sectors and changes only the dragged node', () => {
    const childIds = Array.from({ length: 14 }, (_, index) => `child-${index}`);
    const laidOut = applyFocusedExpansionLayout({
      nodes: [graphNode('center'), ...childIds.map((id) => graphNode(id))],
      expandedNodeIds: ['center'],
      directExpansionLinks: childIds.map((id) => expansionLink(`link-${id}`, 'center', id)),
      layoutState: getEmptyKnowledgeGraphLayoutState(),
      activationSequenceByCenterId: { center: 1 },
    });
    const radii = new Set(laidOut.slice(1).map((node) => Math.round(distanceFrom(node, { x: 0, y: 0 }))));
    const dragged = [...laidOut];
    freezeKnowledgeGraphDragFrame(dragged, { id: 'child-0', x: 700, y: 800, z: 4 });

    expect(radii.size).toBeGreaterThan(1);
    expect(dragged.find((node) => node.id === 'child-0')).toMatchObject({
      x: 700, y: 800, z: 4, fx: 700, fy: 800, fz: 4,
    });
    laidOut.filter((node) => node.id !== 'child-0').forEach((node) => {
      expect(dragged.find((candidate) => candidate.id === node.id)).toBe(node);
    });
  });

  it('freezes every non-dragged runtime node during a drag frame', () => {
    const nodes = [graphNode('dragged', 0, 0, { x: 10, y: 20 }), graphNode('stable', 0, 0, { x: 30, y: 40 })];
    const stable = nodes[1];
    freezeKnowledgeGraphDragFrame(nodes, { id: 'dragged', x: 70, y: 80 });
    expect(nodes[0]).toMatchObject({ x: 70, y: 80, fx: 70, fy: 80 });
    expect(nodes[1]).toBe(stable);
    expect(nodes[1]).toMatchObject({ x: 30, y: 40, fx: 30, fy: 40 });
  });
  it('calculates a bounded viewport translation for an expansion ring near the bottom edge', () => {
    const reveal = calculateFocusedExpansionRevealTranslation({
      points: [
        { x: 660, y: 792 },
        { x: 660, y: 696 },
        { x: 756, y: 792 },
        { x: 660, y: 888 },
        { x: 564, y: 792 },
      ],
      viewportWidth: 1320,
      viewportHeight: 847,
      padding: 48,
    });

    expect(reveal).toEqual({ x: 0, y: -89, fullyVisible: true });
  });

  it('does not pan an already visible expansion and bounds oversized reveals', () => {
    expect(calculateFocusedExpansionRevealTranslation({
      points: [
        { x: 300, y: 300 },
        { x: 300, y: 204 },
        { x: 396, y: 300 },
        { x: 300, y: 396 },
        { x: 204, y: 300 },
      ],
      viewportWidth: 800,
      viewportHeight: 600,
      padding: 48,
    })).toEqual({ x: 0, y: 0, fullyVisible: true });

    const cornerReveal = calculateFocusedExpansionRevealTranslation({
      points: [
        { x: 580, y: 580 },
        { x: 900, y: 900 },
      ],
      viewportWidth: 600,
      viewportHeight: 600,
      padding: 48,
    });

    expect(cornerReveal?.fullyVisible).toBe(false);
    expect(Math.hypot(cornerReveal?.x ?? 0, cornerReveal?.y ?? 0)).toBeCloseTo(120);
  });

  it('changes the reveal signature when delayed direct links arrive but ignores link order', () => {
    const directLinks = [
      expansionLink('link-b', 'center', 'child-b'),
      expansionLink('link-a', 'child-a', 'center'),
    ];

    expect(createFocusedExpansionRevealSignature(['center'], [])).not.toBe(
      createFocusedExpansionRevealSignature(['center'], directLinks)
    );
    expect(createFocusedExpansionRevealSignature(['center'], directLinks)).toBe(
      createFocusedExpansionRevealSignature(['center'], [...directLinks].reverse())
    );
  });

  it('reveals only the latest newly expanded neighborhood and creates a new cached re-expand intent', () => {
    expect(resolveFocusedExpansionRevealTarget([], ['center-a'])).toBe('center-a');
    expect(resolveFocusedExpansionRevealTarget(['center-a'], ['center-a', 'center-b'])).toBe('center-b');
    expect(resolveFocusedExpansionRevealTarget(['center-a', 'center-b'], ['center-b'])).toBeNull();
    expect(resolveFocusedExpansionRevealTarget([], ['center-b'])).toBe('center-b');
  });

  it('translates a 3D camera and target without changing their distance or direction', () => {
    const translated = translateKnowledgeGraphCameraPose({
      cameraPosition: { x: 10, y: 20, z: 30 },
      target: { x: 1, y: 2, z: 3 },
      translation: { x: -4, y: 5, z: 6 },
    });
    const originalVector = { x: 9, y: 18, z: 27 };
    const translatedVector = {
      x: translated.cameraPosition.x - translated.target.x,
      y: translated.cameraPosition.y - translated.target.y,
      z: translated.cameraPosition.z - translated.target.z,
    };

    expect(translated).toEqual({
      cameraPosition: { x: 6, y: 25, z: 36 },
      target: { x: -3, y: 7, z: 9 },
    });
    expect(translatedVector).toEqual(originalVector);
    expect(Math.hypot(translatedVector.x, translatedVector.y, translatedVector.z)).toBeCloseTo(
      Math.hypot(originalVector.x, originalVector.y, originalVector.z)
    );
  });

  it('falls back to current graph data while the renderer ref still lacks a delayed child', () => {
    const staleRefNodes = [graphNode('center')];
    const currentNodes = [graphNode('center'), graphNode('child')];
    const readyRefNodes = [graphNode('center'), graphNode('child', 5, 6)];

    expect(selectFocusedExpansionGraphNodes({
      refNodes: staleRefNodes,
      currentNodes,
      requiredNodeIds: ['center', 'child'],
    })).toBe(currentNodes);
    expect(selectFocusedExpansionGraphNodes({
      refNodes: readyRefNodes,
      currentNodes,
      requiredNodeIds: ['center', 'child'],
    })).toBe(readyRefNodes);
  });

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
    const angles = children
      .map((node) => (Math.atan2((node.y ?? 0) - 200, (node.x ?? 0) - 100) + Math.PI * 2) % (Math.PI * 2))
      .sort((left, right) => left - right);
    const gaps = angles.map((angle, index) => (
      (angles[(index + 1) % angles.length] - angle + Math.PI * 2) % (Math.PI * 2)
    ));
    expect(Math.PI * 2 - Math.max(...gaps)).toBeLessThanOrEqual(Math.PI);
  });

  it('uses an existing automatic center anchor before runtime and initial coordinates', () => {
    const center = {
      ...graphNode('center', -500, -600, { x: 10, y: 20 }),
      __knowledgeAutomaticAnchor: {
        id: 'center',
        x: 300,
        y: 400,
      },
    };

    const laidOut = applyFocusedExpansionLayout({
      nodes: [center, graphNode('child')],
      expandedNodeIds: ['center'],
      directExpansionLinks: [expansionLink('direct', 'center', 'child')],
      layoutState: getEmptyKnowledgeGraphLayoutState(),
    });

    expect(laidOut[0]).toBe(center);
    expect(distanceFrom(laidOut[1], { x: 300, y: 400 })).toBeCloseTo(96);
    expect(laidOut[1]).toMatchObject({ x: 396, y: 400, fx: 396, fy: 400 });
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
    const reversedInput = applyFocusedExpansionLayout({
      nodes: [nodes[0], ...nodes.slice(1).reverse()],
      expandedNodeIds: ['center'],
      directExpansionLinks: [...links].reverse().map((link) => ({
        ...link,
        sourceId: link.targetId,
        targetId: link.sourceId,
      })),
      layoutState: getEmptyKnowledgeGraphLayoutState(),
    });
    const radii = laidOut
      .filter((node) => node.id.startsWith('child-'))
      .map((node) => Number(distanceFrom(node, { x: 0, y: 0 }).toFixed(6)));
    const uniqueRadii = [...new Set(radii)].sort((a, b) => a - b);

    expect(uniqueRadii).toHaveLength(2);
    expect(uniqueRadii[0]).toBeGreaterThan(0);
    expect(uniqueRadii[1]).toBeLessThan(uniqueRadii[0] * 3);
    expect(coordinatesById(reversedInput)).toEqual(coordinatesById(laidOut));
  });

  it('applies user pins before focused placement and preserves unrelated coordinates', () => {
    const unrelated = graphNode('unrelated', 12, 18, { x: 31, y: 41 });
    const unrelatedPinned = graphNode('unrelated-pinned', 22, 28, { x: 51, y: 61 });
    const grandchild = graphNode('grandchild', 71, 81, { x: 91, y: 101 });
    const nodes = [
      graphNode('center', -1, -2, { x: 10, y: 20 }),
      graphNode('auto-child', 300, 400, { x: 500, y: 600 }),
      graphNode('pinned-child', 30, 40, { x: 50, y: 60 }),
      unrelated,
      unrelatedPinned,
      grandchild,
    ];
    const centerPinned = storeKnowledgeGraphNodePosition(undefined, {
      id: 'center',
      x: 400,
      y: 500,
    });
    const childPinned = storeKnowledgeGraphNodePosition(centerPinned, {
      id: 'pinned-child',
      x: 900,
      y: 950,
    });
    const layoutState = storeKnowledgeGraphNodePosition(childPinned, {
      id: 'unrelated-pinned',
      x: 1000,
      y: 1050,
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
    expect(byId.get('unrelated-pinned')).toBe(unrelatedPinned);
    expect(byId.get('unrelated-pinned')).toMatchObject({
      x: 51,
      y: 61,
      positionX: 22,
      positionY: 28,
    });
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

  it('records a focused automatic anchor when a direct child was pinned before expansion', () => {
    const userPinned = storeKnowledgeGraphNodePosition(undefined, {
      id: 'child',
      x: 700,
      y: 800,
    });
    const focusedNodes = applyFocusedExpansionLayout({
      nodes: [graphNode('center'), graphNode('child')],
      expandedNodeIds: ['center'],
      directExpansionLinks: [expansionLink('direct', 'center', 'child')],
      layoutState: userPinned,
    });
    const focusedChild = focusedNodes[1];

    expect(focusedChild).toMatchObject({
      x: 700,
      y: 800,
      __knowledgeAutomaticAnchor: { id: 'child', y: 0 },
    });
    expect(focusedChild.__knowledgeAutomaticAnchor?.x).toBeCloseTo(96);

    syncKnowledgeGraphMutableNodePositions(focusedNodes, userPinned);
    syncKnowledgeGraphMutableNodePositions(focusedNodes, clearKnowledgeGraphLayoutPins(userPinned));
    expect(focusedChild).toMatchObject({ x: 96, y: 0, fx: 96, fy: 0 });
  });
});
