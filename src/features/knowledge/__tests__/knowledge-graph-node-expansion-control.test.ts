import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import * as layoutEngine from '../graph/layout-engine';

type ClampNodeExpansionControlPosition = (input: {
  nodeX: number;
  nodeY: number;
  viewportWidth: number;
  viewportHeight: number;
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
  it('keeps the 44px control inside the viewport while preserving the normal anchor distance', () => {
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
    });
    const nearEdge = clampPosition({
      nodeX: 4,
      nodeY: 4,
      viewportWidth: 320,
      viewportHeight: 240,
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
    expect(nearEdge!.left + 44).toBeLessThanOrEqual(312);
    expect(nearEdge!.top + 44).toBeLessThanOrEqual(232);
    expect(clampPosition({
      nodeX: Number.NaN,
      nodeY: 0,
      viewportWidth: 320,
      viewportHeight: 240,
    })).toBeNull();
  });

  it('renders one stable focusable DOM button with the complete accessible state contract', () => {
    const systemSource = readKnowledgeSource('knowledge-graph-system.tsx');
    const controlStart = systemSource.indexOf('data-knowledge-node-expansion-control');
    const controlSource = systemSource.slice(controlStart - 1800, controlStart + 2200);
    const fallbackPanelSource = systemSource.slice(
      systemSource.indexOf('data-knowledge-expansion-panel="selected-node"'),
      systemSource.indexOf('{isLoading ?')
    );

    expect(controlStart).toBeGreaterThan(0);
    expect(controlSource).toContain('<button');
    expect(controlSource).toContain('type="button"');
    expect(controlSource).toContain('aria-expanded={selectedNodeExpanded}');
    expect(controlSource).toContain('aria-busy={selectedNodeLoadingExpansion}');
    expect(controlSource).toContain('aria-disabled={selectedNodeExpansionActionDisabled}');
    expect(controlSource).toContain('aria-controls="knowledge-graph-canvas"');
    expect(controlSource).toContain('aria-describedby="knowledge-node-expansion-local-status"');
    expect(controlSource).toContain('data-anchor-node-id={visibleSelectedNode.id}');
    expect(controlSource).toContain('data-view-mode={viewMode}');
    expect(controlSource).toContain('data-state={selectedNodeExpansionState}');
    expect(controlSource).toContain('data-anchor-clamped="false"');
    expect(controlSource).toContain('min-h-11 min-w-11');
    expect(controlSource).toContain('focus-visible:');
    expect(controlSource).toContain('pointer-events-none');
    expect(controlSource).toContain('pointer-events-auto');
    expect(controlSource).not.toMatch(/\sdisabled=\{/);
    expect(controlSource).toContain('if (selectedNodeExpansionActionDisabled) return;');
    expect(controlSource).toContain('handleToggleSelectedExpansion();');
    expect(controlSource).toContain('selectedNodeExpansionActionLabel');
    expect(controlSource).toContain('visibleSelectedNode.name');
    expect(controlSource).toContain('id="knowledge-node-expansion-local-status"');
    expect(fallbackPanelSource).not.toContain('<button');
  });

  it('clears stale anchors across selection and mode changes and restores focus only to the initiating node', () => {
    const systemSource = readKnowledgeSource('knowledge-graph-system.tsx');

    expect(systemSource).toContain('activeProjectionIdentityRef');
    expect(systemSource).toContain('clearSelectedNodeProjection');
    expect(systemSource).toContain('data-anchor-node-id');
    expect(systemSource).toContain('data-view-mode');
    expect(systemSource).toContain('selectedNodeIdRef.current === nodeId');
    expect(systemSource).toContain('expansionActivationInFlightRef.current.has(nodeId)');
    expect(systemSource).toContain('expansionErrorByNodeId');
    expect(systemSource).toContain("data-state={selectedNodeExpansionState}");
    expect(systemSource).toContain("selectedNodeExpansionState = selectedNodeLoadingExpansion");
    expect(systemSource).toContain("? 'loading'");
    expect(systemSource).toContain("? 'error'");
    expect(systemSource).toContain("? 'unavailable'");
  });

  it('gives 2D and 3D renderers matching projection and focused-layout inputs', () => {
    const systemSource = readKnowledgeSource('knowledge-graph-system.tsx');
    const renderer2DSource = readKnowledgeSource('graph/knowledge-graph-2d.tsx');
    const renderer3DSource = readKnowledgeSource('graph/knowledge-graph-canvas.tsx');

    for (const rendererSource of [renderer2DSource, renderer3DSource]) {
      expect(rendererSource).toContain('expandedNodeIds: readonly string[];');
      expect(rendererSource).toContain('expandedDirectLinks: readonly KnowledgeLinkData[];');
      expect(rendererSource).toContain('onSelectedNodeScreenPosition:');
      expect(rendererSource).toContain('applyFocusedExpansionLayout({');
      expect(rendererSource).toContain('expandedNodeIds,');
      expect(rendererSource).toContain('directExpansionLinks: expandedDirectLinks,');
      expect(rendererSource).toContain('layoutState: layoutStateRef.current,');
      expect(rendererSource).toContain('runtimePositionsByNodeIdRef');
      expect(rendererSource).toContain('window.requestAnimationFrame(reportFrame)');
    }

    expect(renderer2DSource).toContain('fgRef.current.graph2ScreenCoords(graphX, graphY)');
    expect(renderer3DSource).toContain('fgRef.current.graph2ScreenCoords(graphX, graphY, graphZ)');
    expect(systemSource.match(/expandedNodeIds={expandedNodeIds}/g)).toHaveLength(2);
    expect(systemSource.match(/expandedDirectLinks={expandedDirectLinks}/g)).toHaveLength(2);
    expect(systemSource.match(/onSelectedNodeScreenPosition={handleSelectedNodeScreenPosition}/g)).toHaveLength(2);
    expect(systemSource).not.toContain('setFitViewVersion((current) => current + 1);\n      setExpandedNodeIds');
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
      expect(rendererSource).toContain('onEngineTick={snapshotRuntimePositions}');
      expect(rendererSource).toContain('onEngineStop={snapshotRuntimePositions}');
      expect(reporter).not.toContain('graphNodes.forEach');
      expect(reporter).not.toContain('runtimePositionsByNodeIdRef.current.set');
    });

    expect(systemSource).toContain('id="knowledge-graph-canvas"');
    expect(systemSource).toContain("expansionControlRef.current.dataset.anchorClamped = controlPosition.clamped ? 'true' : 'false';");
  });
});
