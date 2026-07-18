// @vitest-environment jsdom

import React, { forwardRef, useImperativeHandle } from 'react';
import { fireEvent } from '@testing-library/dom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const captured = vi.hoisted(() => ({
  twoD: {} as Record<string, unknown>,
  threeD: {} as Record<string, unknown>,
  twoDZoom: 1,
}));

function forceGraphMock(kind: 'twoD' | 'threeD') {
  return forwardRef(function ForceGraph(props: Record<string, unknown>, ref) {
    captured[kind] = props;
    useImperativeHandle(ref, () => ({
      graphData: () => props.graphData,
      graph2ScreenCoords: (x: number, y: number) => ({
        x: kind === 'twoD' ? x * captured.twoDZoom : x,
        y: kind === 'twoD' ? y * captured.twoDZoom : y,
      }),
      screen2GraphCoords: (x: number, y: number) => ({
        x: x / captured.twoDZoom,
        y: y / captured.twoDZoom,
      }),
      d3Force: () => ({ strength: () => undefined, distance: () => undefined }),
      refresh: () => undefined,
    }));
    return React.createElement('canvas', { 'data-testid': `canvas-${kind}` });
  });
}

vi.mock('react-force-graph-2d', () => ({ default: forceGraphMock('twoD') }));
vi.mock('react-force-graph-3d', () => ({ default: forceGraphMock('threeD') }));

import { KnowledgeGraph2D } from '../graph/knowledge-graph-2d';
import { KnowledgeGraphCanvas } from '../graph/knowledge-graph-canvas';
import { getEmptyKnowledgeGraphLayoutState } from '../graph/layout-state';

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('PointerEvent', class extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  });
});

const node = {
  id: 'n1', name: 'Node', nodeType: 'THEORY' as const, description: '',
  positionX: 20, positionY: 20, positionZ: 0, x: 20, y: 20, z: 0,
};
const nodeTwo = { ...node, id: 'n2', name: 'Node 2', positionX: 100, x: 100 };
const link = {
  id: 'edge-1', sourceId: 'n1', targetId: 'n2', source: node, target: nodeTwo,
  relation: 'related', relationType: 'related', strength: 1,
};

function props(onBackgroundClick: () => void) {
  return {
    nodes: [node, nodeTwo], links: [link], selectedNode: null, hoveredNode: null,
    onNodeClick: () => undefined, onNodeHover: () => undefined,
    onNodeDragEnd: () => undefined, onBackgroundClick,
    labelMode: 'focus' as const, layoutState: getEmptyKnowledgeGraphLayoutState(),
    fitViewRequest: { id: 0, target: 'root' as const }, relayoutVersion: 0, expandedNodeIds: [],
    expandedDirectLinks: [], activationSequenceByCenterId: {}, materializedNodeIds: [],
    graphVersion: 'v1', width: 400, height: 300,
  };
}

afterEach(() => {
  document.body.innerHTML = '';
  captured.twoD = {};
  captured.threeD = {};
  captured.twoDZoom = 1;
  vi.unstubAllGlobals();
});

describe.each([
  ['2D', KnowledgeGraph2D, 'twoD'],
  ['3D', KnowledgeGraphCanvas, 'threeD'],
] as const)('%s renderer multi-pointer blank dismissal', (_label, Renderer, kind) => {
  it('cancels all blank candidates when a stationary second pointer overlaps a primary pan', async () => {
    const onBackgroundClick = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => root.render(React.createElement(Renderer, props(onBackgroundClick))));
    const canvas = container.querySelector('canvas')!;

    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 205, clientY: 200 });
    fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 240, clientY: 220 });
    fireEvent.pointerUp(canvas, { pointerId: 2, clientX: 240, clientY: 220 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 205, clientY: 200 });
    await act(async () => (captured[kind].onBackgroundClick as () => void)());

    expect(onBackgroundClick).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });

  it('isolates unknown cancel but cancels the sequence for a control, node, or edge second pointer', async () => {
    const onBackgroundClick = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => root.render(React.createElement(Renderer, props(onBackgroundClick))));
    const canvas = container.querySelector('canvas')!;
    const control = document.createElement('button');
    container.querySelector('[data-knowledge-graph-renderer]')!.appendChild(control);

    const secondPointers = [
      { target: control, x: 0, y: 0 },
      { target: canvas, x: 20, y: 20 },
      { target: canvas, x: 60, y: 20 },
    ];
    for (const [index, second] of secondPointers.entries()) {
      const primaryId = 10 + index * 2;
      const secondaryId = primaryId + 1;
      fireEvent.pointerDown(canvas, { pointerId: primaryId, clientX: 200, clientY: 200 });
      fireEvent.pointerCancel(canvas, { pointerId: 99 });
      fireEvent.pointerDown(second.target, {
        pointerId: secondaryId, clientX: second.x, clientY: second.y,
      });
      fireEvent.pointerUp(canvas, { pointerId: primaryId, clientX: 200, clientY: 200 });
      fireEvent.pointerCancel(second.target, { pointerId: secondaryId });
      await act(async () => (captured[kind].onBackgroundClick as () => void)());
    }

    expect(onBackgroundClick).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });

  it('preserves the single-pointer inclusive four-pixel click contract', async () => {
    const onBackgroundClick = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => root.render(React.createElement(Renderer, props(onBackgroundClick))));
    const canvas = container.querySelector('canvas')!;

    fireEvent.pointerDown(canvas, { pointerId: 7, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(canvas, { pointerId: 7, clientX: 204, clientY: 200 });
    fireEvent.pointerUp(canvas, { pointerId: 7, clientX: 204, clientY: 200 });
    await act(async () => (captured[kind].onBackgroundClick as () => void)());

    expect(onBackgroundClick).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
  });
});

describe('2D renderer shape-aware blank dismissal', () => {
  it.each([0.5, 3])('keeps circle, square, and hexagon bodies non-blank at zoom %s', async (zoom) => {
    captured.twoDZoom = zoom;
    const onBackgroundClick = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const shapeNodes = [
      { ...node, id: 'circle', nodeType: 'THEORY' as const, x: 40, y: 40, positionX: 40, positionY: 40 },
      { ...node, id: 'square', nodeType: 'SCENARIO' as const, x: 120, y: 40, positionX: 120, positionY: 40 },
      { ...node, id: 'hexagon', nodeType: 'ETHICS' as const, x: 200, y: 40, positionX: 200, positionY: 40 },
    ];
    await act(async () => root.render(React.createElement(KnowledgeGraph2D, {
      ...props(onBackgroundClick),
      nodes: shapeNodes,
      links: [],
    })));
    const canvas = container.querySelector('canvas')!;
    const renderedNodes = (captured.twoD.graphData as { nodes: Array<{ id: string; x: number; y: number }> }).nodes;

    for (const [index, shapeNode] of renderedNodes.entries()) {
      const pointerId = index + 1;
      fireEvent.pointerDown(canvas, {
        pointerId,
        clientX: shapeNode.x * zoom,
        clientY: shapeNode.y * zoom,
      });
      fireEvent.pointerUp(canvas, {
        pointerId,
        clientX: shapeNode.x * zoom,
        clientY: shapeNode.y * zoom,
      });
      await act(async () => (captured.twoD.onBackgroundClick as () => void)());
    }
    expect(onBackgroundClick).not.toHaveBeenCalled();

    fireEvent.pointerDown(canvas, { pointerId: 9, clientX: 360, clientY: 260 });
    fireEvent.pointerUp(canvas, { pointerId: 9, clientX: 360, clientY: 260 });
    await act(async () => (captured.twoD.onBackgroundClick as () => void)());
    expect(onBackgroundClick).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
  });
});
