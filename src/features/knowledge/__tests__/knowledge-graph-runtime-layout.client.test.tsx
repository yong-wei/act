// @vitest-environment jsdom

/**
 * Runtime layout hook contract (#1739): explicit pins survive manual
 * reflow, unpinning returns nodes to force ownership and reheats the
 * engine, and layout stores stay isolated per dimension.
 */

import { act, useEffect } from "react";
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { useKnowledgeGraphRuntimeLayout } from '../graph/use-knowledge-graph-runtime-layout';

let container: HTMLDivElement;
let root: Root;
let hook: ReturnType<typeof useKnowledgeGraphRuntimeLayout>;

function Probe() {
  const value = useKnowledgeGraphRuntimeLayout({ dimension: '2d' });
  // 渲染期保持纯净；在 effect 中把 hook 快照发布给测试。
  useEffect(() => {
    hook = value;
  });
  return null;
}

function ProbeDimension({ dimension }: { dimension: '2d' | '3d' }) {
  const value = useKnowledgeGraphRuntimeLayout({ dimension });
  useEffect(() => {
    hook = value;
  });
  return null;
}

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function mountProbe() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<Probe />);
  });
}

describe('knowledge graph runtime layout ownership (#1739)', () => {
  it('stores drag-end positions as pins and unpins without touching siblings', () => {
    mountProbe();
    act(() => {
      hook.handleNodeDragEnd({ id: 'node-a', x: 12, y: 34 } as never);
      hook.handleNodeDragEnd({ id: 'node-b', x: 56, y: 78 } as never);
    });
    expect(hook.pinnedNodeIds).toEqual(new Set(['node-a', 'node-b']));
    expect(hook.layoutState.positionsByNodeId['node-a']).toMatchObject({ x: 12, y: 34, pinned: true });

    const reheatBefore = hook.engineReheatRevision;
    act(() => {
      hook.unpinNode('node-a');
    });
    expect(hook.pinnedNodeIds).toEqual(new Set(['node-b']));
    expect(hook.engineReheatRevision).toBe(reheatBefore + 1);

    // Unpinning an unpinned node is a no-op and does not reheat.
    act(() => {
      hook.unpinNode('node-a');
    });
    expect(hook.engineReheatRevision).toBe(reheatBefore + 1);

    act(() => {
      hook.unpinNode();
    });
    expect(hook.pinnedNodeIds.size).toBe(0);
    expect(hook.engineReheatRevision).toBe(reheatBefore + 2);
  });

  it('preserves explicit pins across manual reflow', () => {
    mountProbe();
    act(() => {
      hook.handleNodeDragEnd({ id: 'node-a', x: 12, y: 34 } as never);
    });
    act(() => {
      hook.requestRelayout();
    });
    expect(hook.pinnedNodeIds).toEqual(new Set(['node-a']));
    expect(hook.relayoutVersion).toBe(1);
  });

  it('isolates pins per dimension through the returned store', () => {
    mountProbe();
    act(() => {
      hook.handleNodeDragEnd({ id: 'node-a', x: 12, y: 34 } as never);
    });
    expect(hook.layoutState.positionsByNodeId['node-a']).toBeDefined();
  });

  it('keeps 2d and 3d pin stores separate', () => {
    // 同一 hook 实例随 dimension prop 切换 store（真实运行时的隔离方式）。
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<ProbeDimension dimension="2d" />);
    });
    act(() => {
      hook.handleNodeDragEnd({ id: 'node-a', x: 12, y: 34 } as never);
    });
    expect(hook.layoutState.positionsByNodeId['node-a']).toBeDefined();

    act(() => {
      root.render(<ProbeDimension dimension="3d" />);
    });
    expect(hook.layoutState.positionsByNodeId['node-a']).toBeUndefined();
    expect(hook.pinnedNodeIds.size).toBe(0);
    act(() => {
      hook.handleNodeDragEnd({ id: 'node-b', x: -7, y: 9 } as never);
    });
    expect(hook.layoutState.positionsByNodeId['node-b']).toMatchObject({ x: -7, y: 9, pinned: true });

    // 切回 2D 后原 pin 仍在（维度会话隔离 #1739 任务 2.4）。
    act(() => {
      root.render(<ProbeDimension dimension="2d" />);
    });
    expect(hook.layoutState.positionsByNodeId['node-a']).toBeDefined();
    expect(hook.layoutState.positionsByNodeId['node-b']).toBeUndefined();
  });
});
