import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import * as layoutEngine from '../graph/layout-engine';

type ClampNodeExpansionControlPosition = (input: {
  nodeX: number;
  nodeY: number;
  viewportWidth: number;
  viewportHeight: number;
  controlWidth: number;
  controlHeight: number;
  avoidRects?: Array<{ left: number; top: number; right: number; bottom: number }>;
}) => {
  left: number;
  top: number;
  centerX: number;
  centerY: number;
  clamped: boolean;
} | null;

const readKnowledgeSource = (relativePath: string) => readFileSync(
  path.join(process.cwd(), 'src/features/knowledge', relativePath),
  'utf8'
);

describe('knowledge graph node-local expansion control', () => {
  it('preserves live unrelated coordinates when expansion inputs rebuild graphData before engine stop', () => {
    const preserveLiveCoordinates = (
      layoutEngine as typeof layoutEngine & {
        preserveKnowledgeGraphLiveNodeCoordinates?: (input: {
          nodes: layoutEngine.KnowledgeGraphPositionedNode[];
          liveNodes: layoutEngine.KnowledgeGraphPositionedNode[];
        }) => layoutEngine.KnowledgeGraphPositionedNode[];
      }
    ).preserveKnowledgeGraphLiveNodeCoordinates;
    expect(preserveLiveCoordinates).toBeTypeOf('function');
    if (!preserveLiveCoordinates) return;

    const node = (id: string, x = 0, y = 0): layoutEngine.KnowledgeGraphPositionedNode => ({
      id,
      name: id,
      nodeType: 'THEORY',
      description: id,
      positionX: x,
      positionY: y,
      positionZ: 0,
      x,
      y,
    });
    const unrelatedBase = node('unrelated', -10, -20);
    const newChild = node('new-child', 400, 500);
    const rebuiltNodes = [node('center'), newChild, unrelatedBase];
    const liveNodes = [
      { ...node('center'), x: 12, y: 18 },
      { ...node('unrelated'), x: 137, y: -42, vx: 3, vy: -2 },
      { ...node('removed'), x: 999, y: 999 },
    ];

    const preserved = preserveLiveCoordinates({ nodes: rebuiltNodes, liveNodes });
    const laidOut = layoutEngine.applyFocusedExpansionLayout({
      nodes: preserved,
      expandedNodeIds: ['center'],
      directExpansionLinks: [{
        id: 'center-child',
        sourceId: 'center',
        targetId: 'new-child',
        relation: 'contains',
      }],
      layoutState: { version: 0, positionsByNodeId: {} },
    });
    const byId = new Map(laidOut.map((item) => [item.id, item]));

    expect(byId.get('unrelated')).toMatchObject({ x: 137, y: -42, vx: 3, vy: -2 });
    expect(byId.get('unrelated')).not.toBe(unrelatedBase);
    expect(byId.get('new-child')).not.toMatchObject({ x: 400, y: 500 });
    expect(byId.has('removed')).toBe(false);
  });

  it('drops both live and cached coordinates only for explicit relayout rebuilds', () => {
    const baseNodes: layoutEngine.KnowledgeGraphPositionedNode[] = [{
      id: 'node-1',
      name: 'node-1',
      nodeType: 'THEORY',
      description: 'node-1',
      positionX: 10,
      positionY: 20,
      positionZ: 0,
      x: 10,
      y: 20,
    }];
    const liveNodes = [{ ...baseNodes[0], x: 300, y: 400, vx: 5, vy: -3 }];

    const runtimePositions = new Map<string, Partial<layoutEngine.KnowledgeGraphLivePositionedNode>>([
      ['node-1', { x: 500, y: 600, vx: 7, vy: -4 }],
    ]);

    expect(layoutEngine.resolveKnowledgeGraphRuntimeNodeCoordinates({
      nodes: baseNodes,
      liveNodes,
      runtimePositionsByNodeId: runtimePositions,
      preserve: false,
    })).toBe(baseNodes);

    expect(layoutEngine.resolveKnowledgeGraphRuntimeNodeCoordinates({
      nodes: baseNodes,
      liveNodes,
      runtimePositionsByNodeId: runtimePositions,
      preserve: true,
    })[0]).toMatchObject({ x: 300, y: 400, vx: 5, vy: -3 });
    expect(layoutEngine.resolveKnowledgeGraphRuntimeNodeCoordinates({
      nodes: baseNodes,
      liveNodes: undefined,
      runtimePositionsByNodeId: runtimePositions,
      preserve: true,
    })[0]).toMatchObject({ x: 500, y: 600, vx: 7, vy: -4 });

    expect(layoutEngine.commitKnowledgeGraphRelayoutVersion({
      committedVersion: 0,
      nextVersion: 0,
      runtimePositions,
    })).toBe(0);
    expect(runtimePositions.size).toBe(1);

    expect(layoutEngine.commitKnowledgeGraphRelayoutVersion({
      committedVersion: 0,
      nextVersion: 1,
      runtimePositions,
    })).toBe(1);
    expect(runtimePositions.size).toBe(0);

    runtimePositions.set('node-1', { x: 700, y: 800 });
    expect(layoutEngine.commitKnowledgeGraphRelayoutVersion({
      committedVersion: 1,
      nextVersion: 2,
      runtimePositions,
    })).toBe(2);
    expect(runtimePositions.size).toBe(0);

    const twoDimensionalSource = readKnowledgeSource('graph/knowledge-graph-2d.tsx');
    const threeDimensionalSource = readKnowledgeSource('graph/knowledge-graph-canvas.tsx');
    expect(twoDimensionalSource).toContain('resolveKnowledgeGraphRuntimeNodeCoordinates');
    expect(twoDimensionalSource).toContain('commitKnowledgeGraphRelayoutVersion');
    expect(twoDimensionalSource).toContain(
      'const preserveRuntimeCoordinates = committedRelayoutVersionRef.current === relayoutVersion;'
    );
    expect(twoDimensionalSource).toContain('preserve: preserveRuntimeCoordinates');
    expect(threeDimensionalSource).toContain('resolveKnowledgeGraphRuntimeNodeCoordinates');
    expect(threeDimensionalSource).toContain('commitKnowledgeGraphRelayoutVersion');
    expect(threeDimensionalSource).toContain(
      'const preserveRuntimeCoordinates = committedRelayoutVersionRef.current === relayoutVersion;'
    );
    expect(threeDimensionalSource).toContain('preserve: preserveRuntimeCoordinates');
  });

  it('re-centers an expanded neighborhood when the pinned center version changes', () => {
    const nodes: layoutEngine.KnowledgeGraphPositionedNode[] = [
      {
        id: 'center',
        name: 'center',
        nodeType: 'THEORY',
        description: 'center',
        positionX: 0,
        positionY: 0,
        positionZ: 0,
      },
      {
        id: 'child',
        name: 'child',
        nodeType: 'THEORY',
        description: 'child',
        positionX: 0,
        positionY: 0,
        positionZ: 0,
      },
    ];
    const input = {
      nodes,
      expandedNodeIds: ['center'],
      directExpansionLinks: [{
        id: 'center-child',
        sourceId: 'center',
        targetId: 'child',
        relation: 'contains',
      }],
    };
    const first = layoutEngine.applyFocusedExpansionLayout({
      ...input,
      layoutState: {
        version: 1,
        positionsByNodeId: { center: { x: 0, y: 0, pinned: true } },
      },
    });
    const moved = layoutEngine.applyFocusedExpansionLayout({
      ...input,
      layoutState: {
        version: 2,
        positionsByNodeId: { center: { x: 120, y: 40, pinned: true } },
      },
    });
    const firstChild = first.find((node) => node.id === 'child')!;
    const movedChild = moved.find((node) => node.id === 'child')!;

    expect(movedChild.x! - firstChild.x!).toBe(120);
    expect(movedChild.y! - firstChild.y!).toBe(40);

    const twoDimensionalSource = readKnowledgeSource('graph/knowledge-graph-2d.tsx');
    const threeDimensionalSource = readKnowledgeSource('graph/knowledge-graph-canvas.tsx');
    expect(twoDimensionalSource).toContain(
      '[nodes, links, relayoutVersion, layoutState.version, expandedNodeIds, expandedDirectLinks]'
    );
    expect(threeDimensionalSource).toContain(
      '[nodes, links, relayoutVersion, layoutState.version, expandedNodeIds, expandedDirectLinks]'
    );
  });

  it('keeps the measured control inside all viewport edges while preserving the normal anchor distance', () => {
    const clampPosition = (
      layoutEngine as typeof layoutEngine & {
        clampNodeExpansionControlPosition?: ClampNodeExpansionControlPosition;
      }
    ).clampNodeExpansionControlPosition;

    expect(clampPosition).toBeTypeOf('function');
    if (!clampPosition) return;

    const centered = clampPosition({
      nodeX: 300,
      nodeY: 220,
      viewportWidth: 800,
      viewportHeight: 600,
      controlWidth: 72,
      controlHeight: 44,
    });
    const nearEdge = clampPosition({
      nodeX: 4,
      nodeY: 4,
      viewportWidth: 320,
      viewportHeight: 240,
      controlWidth: 72,
      controlHeight: 52,
    });
    const nearOppositeEdge = clampPosition({
      nodeX: 319,
      nodeY: 239,
      viewportWidth: 320,
      viewportHeight: 240,
      controlWidth: 72,
      controlHeight: 52,
    });

    expect(centered).not.toBeNull();
    expect(Math.hypot(
      centered!.centerX - 300,
      centered!.centerY - 220
    )).toBeGreaterThanOrEqual(24);
    expect(Math.hypot(
      centered!.centerX - 300,
      centered!.centerY - 220
    )).toBeLessThanOrEqual(64);
    expect(centered!.clamped).toBe(false);
    expect(nearEdge).toMatchObject({ left: 8, clamped: true });
    expect(nearEdge!.top).toBeGreaterThanOrEqual(8);
    expect(nearEdge!.left + 72).toBeLessThanOrEqual(312);
    expect(nearEdge!.top + 52).toBeLessThanOrEqual(232);
    expect(nearOppositeEdge!.left).toBeGreaterThanOrEqual(8);
    expect(nearOppositeEdge!.top).toBeGreaterThanOrEqual(8);
    expect(nearOppositeEdge!.left + 72).toBeLessThanOrEqual(312);
    expect(nearOppositeEdge!.top + 52).toBeLessThanOrEqual(232);
    expect(clampPosition({
      nodeX: Number.NaN,
      nodeY: 0,
      viewportWidth: 320,
      viewportHeight: 240,
      controlWidth: 72,
      controlHeight: 52,
    })).toBeNull();
  });

  it('moves the node-local control around a visible narrow-screen tool panel', () => {
    const clampPosition = (
      layoutEngine as typeof layoutEngine & {
        clampNodeExpansionControlPosition?: ClampNodeExpansionControlPosition;
      }
    ).clampNodeExpansionControlPosition;
    expect(clampPosition).toBeTypeOf('function');
    if (!clampPosition) return;

    const positioned = clampPosition({
      nodeX: 144,
      nodeY: 393,
      viewportWidth: 288,
      viewportHeight: 502,
      controlWidth: 50,
      controlHeight: 44,
      avoidRects: [{ left: 13, top: 13, right: 275, bottom: 429 }],
    });

    expect(positioned).not.toBeNull();
    expect(positioned!.top).toBeGreaterThanOrEqual(429);
    expect(positioned!.top + 44).toBeLessThanOrEqual(494);
    expect(Math.hypot(positioned!.centerX - 144, positioned!.centerY - 393)).toBeLessThanOrEqual(64);
    expect(positioned!.clamped).toBe(true);

    const projectedBehindToolbar = clampPosition({
      nodeX: 144,
      nodeY: 70,
      viewportWidth: 288,
      viewportHeight: 502,
      controlWidth: 50,
      controlHeight: 44,
      avoidRects: [{ left: 12, top: 12, right: 276, bottom: 96 }],
    });
    expect(projectedBehindToolbar).not.toBeNull();
    expect(projectedBehindToolbar!.top).toBeGreaterThanOrEqual(104);
    expect(Math.hypot(
      projectedBehindToolbar!.centerX - 144,
      projectedBehindToolbar!.centerY - 70
    )).toBeLessThanOrEqual(64);
    expect(projectedBehindToolbar!.clamped).toBe(true);

    const impossibleNearCorner = clampPosition({
      nodeX: 0,
      nodeY: 0,
      viewportWidth: 288,
      viewportHeight: 502,
      controlWidth: 50,
      controlHeight: 44,
      avoidRects: [{ left: 0, top: 0, right: 60, bottom: 100 }],
    });
    expect(impossibleNearCorner).not.toBeNull();
    const impossibleControlRect = {
      left: impossibleNearCorner!.left,
      top: impossibleNearCorner!.top,
      right: impossibleNearCorner!.left + 50,
      bottom: impossibleNearCorner!.top + 44,
    };
    const impossibleObstacleRect = { left: 0, top: 0, right: 60, bottom: 100 };
    expect(
      impossibleControlRect.right <= impossibleObstacleRect.left
      || impossibleObstacleRect.right <= impossibleControlRect.left
      || impossibleControlRect.bottom <= impossibleObstacleRect.top
      || impossibleObstacleRect.bottom <= impossibleControlRect.top
    ).toBe(true);
    expect(Math.hypot(
      impossibleNearCorner!.centerX,
      impossibleNearCorner!.centerY
    )).toBeGreaterThan(64);
    expect(impossibleNearCorner!.clamped).toBe(true);
  });

  it('keeps per-frame projection work bounded and snapshots all runtime coordinates only on engine events', () => {
    const systemSource = readKnowledgeSource('knowledge-graph-system.tsx');
    const rendererSources = [
      readKnowledgeSource('graph/knowledge-graph-2d.tsx'),
      readKnowledgeSource('graph/knowledge-graph-canvas.tsx'),
    ];

    rendererSources.forEach((rendererSource) => {
      const reporter = rendererSource.slice(
        rendererSource.indexOf('const reportSelectedNodeScreenPosition'),
        rendererSource.indexOf('useEffect(() => {', rendererSource.indexOf('const reportSelectedNodeScreenPosition'))
      );
      expect(rendererSource).toContain('const snapshotRuntimePositions = useCallback(() => {');
      expect(rendererSource).not.toContain('onEngineTick={snapshotRuntimePositions}');
      expect(rendererSource).toContain('onEngineStop={snapshotRuntimePositions}');
      expect(reporter).not.toContain('graphNodes.forEach');
      expect(reporter).not.toContain('runtimePositionsByNodeIdRef.current.set');
    });

    expect(systemSource).toContain('id="knowledge-graph-canvas"');
    expect(systemSource).toContain("expansionControlRef.current.dataset.anchorClamped = controlPosition.clamped ? 'true' : 'false';");
    expect(systemSource).toContain('visibleSelectedNode && !mobileToolPanelOpen');
    const projectionHandler = systemSource.slice(
      systemSource.indexOf('const handleSelectedNodeScreenPosition'),
      systemSource.indexOf('useEffect(() => {', systemSource.indexOf('const handleSelectedNodeScreenPosition'))
    );
    expect(projectionHandler).not.toContain('querySelectorAll');
    expect(projectionHandler).not.toContain('getBoundingClientRect');
    expect(projectionHandler).not.toContain('getComputedStyle');
  });

  it('uses a bounded local reveal in both renderers without fitting the whole graph', () => {
    const twoDimensionalSource = readKnowledgeSource('graph/knowledge-graph-2d.tsx');
    const threeDimensionalSource = readKnowledgeSource('graph/knowledge-graph-canvas.tsx');

    expect(twoDimensionalSource).toContain('calculateFocusedExpansionRevealTranslation');
    expect(twoDimensionalSource).toContain('screen2GraphCoords');
    expect(twoDimensionalSource).toContain('centerAt');
    expect(threeDimensionalSource).toContain('calculateFocusedExpansionRevealTranslation');
    expect(threeDimensionalSource).toContain('cameraPosition');
    expect(twoDimensionalSource).not.toContain('expandedNodeIds.length > 0 && fgRef.current?.zoomToFit');
    expect(threeDimensionalSource).not.toContain('expandedNodeIds.length > 0 && fgRef.current?.zoomToFit');
  });
});
