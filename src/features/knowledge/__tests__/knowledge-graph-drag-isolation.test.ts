// @vitest-environment jsdom

import React, { forwardRef, useImperativeHandle } from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

let rendererProps: Record<string, unknown> = {};
const runtimeNodes = [
  { id: 'dragged', name: 'dragged', x: 10, y: 20, fx: 10, fy: 20 },
  { id: 'stable', name: 'stable', x: 30, y: 40, fx: 30, fy: 40 },
];

vi.mock('react-force-graph-2d', () => ({
  default: forwardRef(function ControlledForceGraph(props: Record<string, unknown>, ref) {
    rendererProps = props;
    useImperativeHandle(ref, () => ({
      graphData: () => ({ nodes: runtimeNodes }),
      d3Force: () => ({ strength: () => undefined, distance: () => undefined }),
      refresh: () => undefined,
    }));
    return React.createElement('div', { 'data-testid': 'controlled-force-graph' });
  }),
}));

import { KnowledgeGraph2D } from '../graph/knowledge-graph-2d';
import { getEmptyKnowledgeGraphLayoutState } from '../graph/layout-state';

afterEach(() => {
  document.body.innerHTML = '';
  rendererProps = {};
});

describe('controlled knowledge graph drag isolation', () => {
  it('keeps every non-dragged coordinate fixed without restarting cooldown', async () => {
    const onBackgroundClick = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(KnowledgeGraph2D, {
          nodes: runtimeNodes.map((node) => ({
            ...node,
            nodeType: 'THEORY' as const,
            description: node.name,
            positionX: node.x,
            positionY: node.y,
            positionZ: 0,
          })),
          links: [],
          selectedNode: null,
          hoveredNode: null,
          onNodeClick: () => undefined,
          onNodeHover: () => undefined,
          onNodeDragEnd: () => undefined,
          onBackgroundClick,
          labelMode: 'focus',
          layoutState: getEmptyKnowledgeGraphLayoutState(),
          fitViewRequest: { id: 0, target: 'root' },
          relayoutVersion: 0,
          expandedNodeIds: [],
          expandedDirectLinks: [],
          activationSequenceByCenterId: {},
          materializedNodeIds: [],
          graphVersion: 'graph-v1',
        }));
    });
    const stableBefore = { x: runtimeNodes[1].x, y: runtimeNodes[1].y };
    (rendererProps.onNodeDrag as (node: typeof runtimeNodes[number]) => void)({
      ...runtimeNodes[0], x: 70, y: 80,
    });

    expect(runtimeNodes[0]).toMatchObject({ x: 70, y: 80, fx: 70, fy: 80 });
    expect(runtimeNodes[1]).toMatchObject(stableBefore);
    // #1739: the live engine runs a bounded cooldown, never a zero-tick one.
    expect(rendererProps.cooldownTicks).toBeGreaterThan(0);
    expect(rendererProps.warmupTicks).toBeGreaterThan(0);
    expect(typeof rendererProps.onEngineTick).toBe('function');
    (rendererProps.onEngineTick as () => void)();
    expect(runtimeNodes[1]).toMatchObject(stableBefore);
    // Drag end releases the isolation frame: the non-dragged node returns to
    // force ownership while the dragged node keeps its coordinates.
    (rendererProps.onNodeDragEnd as (node: typeof runtimeNodes[number]) => void)({
      ...runtimeNodes[0], x: 70, y: 80,
    });
    expect(runtimeNodes[1].fx).toBeUndefined();
    expect(runtimeNodes[1].fy).toBeUndefined();
    expect(runtimeNodes[1]).toMatchObject(stableBefore);
    expect(runtimeNodes[0]).toMatchObject({ x: 70, y: 80 });
    expect(rendererProps).not.toHaveProperty('onZoom');
    expect(typeof rendererProps.onBackgroundClick).toBe('function');
    await act(async () => (rendererProps.onBackgroundClick as () => void)());
    expect(rendererProps).not.toHaveProperty('onManipulationStart');
    expect(onBackgroundClick).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });
});
