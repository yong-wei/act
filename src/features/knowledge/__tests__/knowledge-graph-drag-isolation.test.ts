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
          labelMode: 'focus',
          layoutState: getEmptyKnowledgeGraphLayoutState(),
          fitViewVersion: 0,
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
    expect(rendererProps.cooldownTicks).toBe(0);
    expect(rendererProps).not.toHaveProperty('onEngineTick');
    await act(async () => root.unmount());
  });
});
