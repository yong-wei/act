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
