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
});
