import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import type { KnowledgeNodeData } from '../knowledge-graph-system';
import {
  applyKnowledgeGraphStoredPositions,
  clearKnowledgeGraphLayoutPins,
  getKnowledgeGraphRuntimeNodePosition,
  markKnowledgeGraphAutomaticNodeAnchors,
  removeKnowledgeGraphNodePin,
  storeKnowledgeGraphNodePosition,
  syncKnowledgeGraphMutableNodePositions,
} from '../graph/layout-state';
import { resolveResourcePanelSelectionState } from '../resource-panel/resource-panel';

function graphNode(id: string, x = 0, y = 0): KnowledgeNodeData {
  return {
    id,
    name: id,
    nodeType: 'THEORY',
    description: `${id} description`,
    positionX: x,
    positionY: y,
    positionZ: 0,
  };
}

describe('knowledge graph interaction state stability', () => {
  it('stores dragged coordinates by node id and reapplies them as pinned graph coordinates', () => {
    const state = storeKnowledgeGraphNodePosition(undefined, {
      id: 'node-a',
      x: 128,
      y: -64,
      z: 9,
    });

    const [nodeA, nodeB] = applyKnowledgeGraphStoredPositions(
      [graphNode('node-a'), graphNode('node-b')],
      state
    );

    expect(state.version).toBe(1);
    expect(state.positionsByNodeId['node-a']).toMatchObject({
      x: 128,
      y: -64,
      z: 9,
      pinned: true,
    });
    expect(nodeA).toMatchObject({
      x: 128,
      y: -64,
      z: 9,
      fx: 128,
      fy: -64,
      fz: 9,
      positionX: 128,
      positionY: -64,
      positionZ: 9,
    });
    expect(nodeB).toEqual(graphNode('node-b'));
  });

  it('keeps pinned coordinates through hover, selection, inspector, and visible filter changes', () => {
    const pinned = storeKnowledgeGraphNodePosition(undefined, {
      id: 'node-a',
      x: 32,
      y: 48,
    });

    const afterHover = applyKnowledgeGraphStoredPositions(
      [graphNode('node-a'), graphNode('node-c')],
      pinned
    );
    const afterSelection = applyKnowledgeGraphStoredPositions(
      [graphNode('node-a'), graphNode('node-d')],
      pinned
    );

    expect(afterHover[0]).toMatchObject({ id: 'node-a', x: 32, y: 48, fx: 32, fy: 48 });
    expect(afterSelection[0]).toMatchObject({ id: 'node-a', x: 32, y: 48, fx: 32, fy: 48 });
    expect(pinned.version).toBe(1);
  });

  it('removes pins only through explicit unpin or clear-pins commands', () => {
    const pinnedA = storeKnowledgeGraphNodePosition(undefined, { id: 'node-a', x: 1, y: 2 });
    const pinnedBoth = storeKnowledgeGraphNodePosition(pinnedA, { id: 'node-b', x: 3, y: 4 });

    const withoutA = removeKnowledgeGraphNodePin(pinnedBoth, 'node-a');
    const cleared = clearKnowledgeGraphLayoutPins(withoutA);

    expect(Object.keys(pinnedBoth.positionsByNodeId).sort()).toEqual(['node-a', 'node-b']);
    expect(Object.keys(withoutA.positionsByNodeId)).toEqual(['node-b']);
    expect(withoutA.version).toBe(3);
    expect(cleared.positionsByNodeId).toEqual({});
    expect(cleared.version).toBe(4);
  });

  it('preserves automatic layout anchors while syncing user-pinned mutable coordinates', () => {
    const pinned = storeKnowledgeGraphNodePosition(undefined, { id: 'node-a', x: 10, y: 20 });
    const mutableNodes = [
      {
        ...graphNode('chapter-node:基本概念', -200, -300),
        fx: -200,
        fy: -300,
      },
      graphNode('node-a'),
    ];

    syncKnowledgeGraphMutableNodePositions(mutableNodes, pinned);

    expect(mutableNodes[0]).toMatchObject({
      id: 'chapter-node:基本概念',
      fx: -200,
      fy: -300,
      positionX: -200,
      positionY: -300,
    });
    expect(mutableNodes[1]).toMatchObject({
      id: 'node-a',
      x: 10,
      y: 20,
      fx: 10,
      fy: 20,
      __knowledgeUserPinned: true,
    });
  });

  it('preserves existing z-axis anchors when a 2D pin only stores x and y', () => {
    const pinnedFrom2D = storeKnowledgeGraphNodePosition(undefined, { id: 'node-a', x: 14, y: -18 });
    const mutableNodes = [
      {
        ...graphNode('node-a', 0, 0),
        z: 0,
        fz: 0,
        positionZ: 0,
      },
    ];

    syncKnowledgeGraphMutableNodePositions(mutableNodes, pinnedFrom2D);

    expect(mutableNodes[0]).toMatchObject({
      id: 'node-a',
      x: 14,
      y: -18,
      fx: 14,
      fy: -18,
      z: 0,
      fz: 0,
      positionZ: 0,
      __knowledgeUserPinned: true,
    });
  });

  it('restores chapter automatic anchors after clearing a user pin', () => {
    const mutableNodes = [
      {
        ...graphNode('chapter-node:基本概念', -200, -300),
        x: -200,
        y: -300,
        z: 0,
        fx: -200,
        fy: -300,
        fz: 0,
        positionZ: 0,
      },
    ];
    markKnowledgeGraphAutomaticNodeAnchors(mutableNodes);

    const userPinned = storeKnowledgeGraphNodePosition(undefined, {
      id: 'chapter-node:基本概念',
      x: 40,
      y: 50,
      z: 12,
    });
    syncKnowledgeGraphMutableNodePositions(mutableNodes, userPinned);
    syncKnowledgeGraphMutableNodePositions(mutableNodes, clearKnowledgeGraphLayoutPins(userPinned));

    expect(mutableNodes[0]).toMatchObject({
      id: 'chapter-node:基本概念',
      x: -200,
      y: -300,
      z: 0,
      fx: -200,
      fy: -300,
      fz: 0,
      positionX: -200,
      positionY: -300,
      positionZ: 0,
    });
    expect(mutableNodes[0]).not.toHaveProperty('__knowledgeUserPinned');
  });

  it('only releases coordinates that were created by a user pin', () => {
    const mutableNodes = [
      {
        ...graphNode('node-a', 10, 20),
        x: 10,
        y: 20,
        fx: 10,
        fy: 20,
        __knowledgeUserPinned: true as const,
      },
      {
        ...graphNode('chapter-node:系统模型', -40, -50),
        fx: -40,
        fy: -50,
      },
    ];

    syncKnowledgeGraphMutableNodePositions(mutableNodes, {
      version: 2,
      positionsByNodeId: {},
    });

    expect(mutableNodes[0]).not.toHaveProperty('fx');
    expect(mutableNodes[0]).not.toHaveProperty('fy');
    expect(mutableNodes[0]).not.toHaveProperty('__knowledgeUserPinned');
    expect(mutableNodes[1]).toMatchObject({ fx: -40, fy: -50 });
  });

  it('only exposes runtime graph coordinates for pinning when the renderer supplied x and y', () => {
    expect(getKnowledgeGraphRuntimeNodePosition(graphNode('source-only', 7, 8))).toBeNull();
    expect(getKnowledgeGraphRuntimeNodePosition({
      ...graphNode('runtime-node', 7, 8),
      x: 31,
      y: -22,
      z: 4,
    })).toEqual({
      id: 'runtime-node',
      x: 31,
      y: -22,
      z: 4,
    });
  });

  it('keeps hover and selection out of graph filtering, membership, and layout derivation', () => {
    const systemSource = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/knowledge-graph-system.tsx'),
      'utf8'
    );
    const rendererSource = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-2d.tsx'),
      'utf8'
    );
    const canvasSource = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-canvas.tsx'),
      'utf8'
    );
    const globalStylesSource = readFileSync(
      path.join(process.cwd(), 'src/app/globals.css'),
      'utf8'
    );
    const globalSidebarSource = readFileSync(
      path.join(process.cwd(), 'src/components/ai/global-ai-sidebar.tsx'),
      'utf8'
    );

    expect(systemSource).toContain('const [explicitFocusNodeId, setExplicitFocusNodeId] = useState<string | null>(null);');
    expect(systemSource).toContain('hoverAnimationFrameRef');
    expect(systemSource).toContain('window.requestAnimationFrame');
    expect(systemSource).toContain('const graphFilterFocusNodeId = explicitFocusNodeId && nodeFilterIdSet.has(explicitFocusNodeId)');
    expect(systemSource).not.toContain('const focusNodeId = hoveredNode?.id ?? selectedNode?.id ?? null;');
    expect(systemSource).not.toContain('focusNodeId: hoveredNode?.id ?? selectedNode?.id ?? null');
    expect(systemSource).not.toContain('onNodeHover={setHoveredNode}');
    expect(systemSource).toContain('onNodeDragEnd={handleNodeDragEnd}');
    expect(systemSource).toContain('data-knowledge-layout-version={layoutState.version}');
    expect(systemSource).toContain('data-knowledge-visible-node-count={displayNodes.length}');
    expect(systemSource).toContain('data-knowledge-pinned-node-count={pinnedNodeCount}');
    expect(systemSource).toContain('data-knowledge-pinned-layout-signature={pinnedLayoutSignature}');
    expect(systemSource).toContain('const displaySelectedNode = selectedNode');
    expect(systemSource).toContain('? { ...displaySelectedNode, ...selectedNode }');
    expect(systemSource).toContain("data-knowledge-selected-node-id={visibleSelectedNode?.id ?? ''}");
    expect(systemSource).toContain('data-knowledge-konling-context-source="server-owned"');
    expect(systemSource).toContain('const [requestedNodeId, setRequestedNodeId] = useState<string | null>(initialRequestedNodeId);');
    expect(systemSource).toContain("const konlingContextStatus = visibleSelectedNode");
    expect(systemSource).toContain("requestedNodeId");
    expect(systemSource).toContain('data-knowledge-konling-context-status={konlingContextStatus}');
    expect(systemSource).toContain('updatePageContext({');
    expect(systemSource).toContain('knowledgeWorkspaceHint: {');
    expect(systemSource).toContain("selectedNodeId: visibleSelectedNode?.id ?? null");
    expect(systemSource).toContain('requestedNodeId,');
    expect(systemSource).toContain('status: konlingContextStatus,');
    expect(systemSource).toContain("searchQuery.trim() ? '搜索词已启用' : ''");
    expect(systemSource).toContain('activeFilters: [knowledgeWorkspaceFilterSummary]');
    expect(systemSource).not.toContain('activeFilters: [activeFilterSummary]');
    expect(systemSource).toContain('selectedNodeRelationCount,');
    expect(systemSource).toContain('data-knowledge-hover-context-policy="preview-only-not-durable-context"');
    expect(systemSource).toContain('data-knowledge-shared-dock-collision-policy="avoid-local-tools-and-inspector"');
    expect(globalStylesSource).toContain('right: calc(1.5rem + clamp(22.5rem, 30vw, 28.75rem)) !important;');
    expect(globalStylesSource).toContain('body:has([data-knowledge-inspector="floating-right-edge"]) [data-global-ai-sidebar="open"][data-konling-assistant-surface="global-sidebar"]');
    expect(globalStylesSource).toContain('body:has([data-knowledge-inspector="floating-right-edge"]) [data-page-floating-controls]');
    expect(globalStylesSource).toContain('height: calc(100vh - 8rem) !important;');
    expect(globalStylesSource).toContain('[data-knowledge-mobile-inspector-policy="suspend"]');
    expect(globalStylesSource).toContain('display: none !important;');
    expect(globalSidebarSource).toContain('knowledgeInspectorAvoidanceActive');
    expect(globalSidebarSource).toContain('data-konling-inspector-avoidance');
    expect(globalSidebarSource).toContain('data-knowledge-mobile-inspector-policy');
    expect(globalSidebarSource).toContain("document.querySelector('[data-knowledge-inspector=\"floating-right-edge\"]')");
    expect(globalSidebarSource).toContain("height: 'calc(100vh - 8rem)'");
    expect(readFileSync(path.join(process.cwd(), 'src/components/shared/page-floating-controls.tsx'), 'utf8')).toContain('data-platform-floating-dock-inspector-avoidance');
    expect(systemSource).toContain('data-knowledge-layout-control="relayout"');
    expect(systemSource).toContain('data-knowledge-layout-control="clear-pins"');
    expect(systemSource).toContain("data-knowledge-layout-control={selectedNodeFocused ? 'clear-focus-node' : 'set-focus-node'}");
    expect(systemSource).toContain('setExplicitFocusNodeId((current) => current === visibleSelectedNode.id ? null : visibleSelectedNode.id)');
    expect(systemSource).toContain('const [relayoutVersion, setRelayoutVersion] = useState(0);');
    expect(systemSource).toContain('setRelayoutVersion((current) => current + 1);');
    expect(systemSource).toContain('expansionCommitQueueRef.current.clear();');
    expect(systemSource).toContain('setActivationSequenceByCenterId({});');
    expect(systemSource).toContain('setActivationSequenceByCenterId((current) => ({ ...current, [nodeId]: activationSequence }));');
    expect(systemSource).not.toContain('current[nodeId] === undefined');
    expect(systemSource).toContain('setMaterializedNodeIds([]);');
    expect(systemSource).toContain('selectedNodePinUnavailable');
    expect(systemSource).not.toContain('__knowledgeGraphProductQaDragSelectedNode');
    expect(rendererSource).toContain('__knowledgeGraphProductQaSelectedNodeDragPoints');
    expect(rendererSource).toContain("new URLSearchParams(window.location.search).get('qa') === 'knowledge-product'");
    expect(rendererSource).toContain('fgRef.current.graph2ScreenCoords(graphX, graphY)');
    expect(rendererSource).toContain('nodePointerAreaPaint={paintNodePointerArea}');
    expect(systemSource).toContain('mobileToolPanelRef.current?.focus()');
    expect(systemSource).toContain('mobileToolToggleRef.current?.focus()');
    expect(systemSource).not.toContain('x: graphNode.x ?? visibleSelectedNode.positionX');
    expect(systemSource).not.toContain('y: graphNode.y ?? visibleSelectedNode.positionY');
    expect(rendererSource).toContain('onNodeDragEnd={handleNodeDragEnd}');
    expect(rendererSource).toContain('onNodeDrag={handleNodeDrag}');
    expect(rendererSource).toContain('freezeKnowledgeGraphDragFrame(graphNodes, node as RuntimeKnowledgeGraphNode)');
    expect(rendererSource).toContain('cooldownTicks={0}');
    expect(rendererSource).toContain('committedGraphVersionRef.current !== graphVersion');
    expect(rendererSource).toContain('runtimePositionsByNodeIdRef.current.clear();');
    expect(rendererSource).not.toContain('applyKnowledgeGraphStoredPositions(');
    expect(rendererSource).toContain('syncKnowledgeGraphMutableNodePositions(currentNodes, layoutState);');
    expect(rendererSource).toContain('}, [nodes, links, relayoutVersion, layoutState, expandedNodeIds, expandedDirectLinks, activationSequenceByCenterId, materializedNodeIds, graphVersion]);');
    expect(rendererSource).toContain('}, [graphData, layoutState]);');
    expect(rendererSource).not.toContain('}, [layoutState, nodes, links]);');
    expect(canvasSource).not.toContain('applyKnowledgeGraphStoredPositions(');
    expect(canvasSource).toContain('syncKnowledgeGraphMutableNodePositions(currentNodes, layoutState);');
    expect(canvasSource).toContain('onNodeDrag={handleNodeDrag}');
    expect(canvasSource).toContain('freezeKnowledgeGraphDragFrame(graphNodes, node as RuntimeKnowledgeGraphNode)');
    expect(canvasSource).toContain('cooldownTicks={0}');
    expect(canvasSource).toContain('committedGraphVersionRef.current !== graphVersion');
    expect(canvasSource).toContain('runtimePositionsByNodeIdRef.current.clear();');
    expect(canvasSource).toContain('}, [nodes, links, relayoutVersion, layoutState, expandedNodeIds, expandedDirectLinks, activationSequenceByCenterId, materializedNodeIds, graphVersion]);');
    expect(canvasSource).toContain('}, [graphData, layoutState]);');
    expect(canvasSource).not.toContain('}, [layoutState, nodes, links]);');
  });

  it('registers interaction-state browser evidence in the commercial governance gate', () => {
    const governanceSource = readFileSync(
      path.join(process.cwd(), 'scripts/tests/test-commercial-ui-governance.ts'),
      'utf8'
    );

    expect(governanceSource).toContain('KNOWLEDGE_GRAPH_INTERACTION_STATE_EVIDENCE_PATH');
    expect(governanceSource).toContain('artifacts/knowledge-graph-interaction-state-485/browser-evidence.json');
    expect(governanceSource).toContain('validateKnowledgeGraphInteractionStateEvidence');
    expect(governanceSource).toContain('pinnedLayoutSignature');
    expect(governanceSource).toContain('layoutVersion');
    expect(governanceSource).toContain('currentRunBaseline');
    expect(governanceSource).toContain("'set-focus-node'");
    expect(governanceSource).toContain('currentRunInteractionHarness');
    expect(governanceSource).toContain('preservedZAxisAnchorFor2DPin');
  });

  it('keeps knowledge graph desktop tools in one compact local command system', () => {
    const systemSource = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/knowledge-graph-system.tsx'),
      'utf8'
    );

    expect(systemSource).toContain("type KnowledgeMobileTool = 'chapter-directory' | 'relation-filters' | 'legend' | 'view-layout';");
    expect(systemSource).toContain('type KnowledgeDesktopTool = KnowledgeMobileTool;');
    expect(systemSource).toContain('const [desktopActiveTool, setDesktopActiveTool] = useState<KnowledgeDesktopTool | null>(null);');
    expect(systemSource).toContain('data-knowledge-desktop-command-system="compact"');
    expect(systemSource).toContain('data-knowledge-local-tool-shell="desktop"');
    expect(systemSource).toContain('KNOWLEDGE_WORKSPACE_STYLE');
    expect(systemSource).toContain('KNOWLEDGE_LOCAL_TOOL_PANEL_CLASS');
    expect(systemSource).toContain('data-knowledge-local-tool-summary="desktop"');
    expect(systemSource).toContain('data-knowledge-command-trigger={item.id}');
    expect(systemSource).toContain('data-knowledge-desktop-tool-panel={desktopActiveTool}');
    expect(systemSource).toContain('data-knowledge-local-tool-panel={desktopActiveTool}');
    expect(systemSource).toContain('aria-controls={`${DESKTOP_TOOL_PANEL_ID_PREFIX}-${item.id}`}');
    expect(systemSource).toContain('handleDesktopToolPanelKeyDown');
    expect(systemSource).toContain("if (event.key !== 'Escape') return;");
    expect(systemSource).toContain('desktopToolTriggerRefs.current[previousTool]?.focus();');
    expect(systemSource).toContain("desktopActiveTool === 'chapter-directory'");
    expect(systemSource).toContain("desktopActiveTool === 'relation-filters'");
    expect(systemSource).toContain("desktopActiveTool === 'legend'");
    expect(systemSource).toContain("desktopActiveTool === 'view-layout'");
    expect(systemSource).toContain('data-knowledge-local-panel="relation-filters"');
    expect(systemSource).not.toContain("desktopActiveTool && desktopActiveTool !== 'relation-filters'");
    expect(systemSource).not.toContain('data-knowledge-desktop-panel="relation-filters"');
    expect(systemSource).not.toContain('top-[8.5rem]');
    expect(systemSource).toContain("['view-layout', '视图']");
    expect(systemSource).toContain("mobileActiveTool === 'view-layout'");
    expect(systemSource).toContain('data-knowledge-mobile-drawer="view-layout"');
    expect(systemSource).toContain('data-knowledge-local-panel="view-layout-controls"');
    expect(systemSource).toContain('data-knowledge-active-filter-summary={activeFilterSummary}');
    expect(systemSource).not.toContain('desktopChapterDirectoryOpen');
    expect(systemSource).not.toContain('desktopRelationFiltersOpen');
    expect(systemSource).not.toContain('data-knowledge-local-panel="view-mode-switch"');
    expect(systemSource).not.toContain('data-knowledge-local-panel="layout-controls"');
  });

  it('registers the knowledge route with the shared AI floating dock inventory', () => {
    const navigationSource = readFileSync(
      path.join(process.cwd(), 'src/lib/platform-role-navigation.ts'),
      'utf8'
    );

    expect(navigationSource).toContain("href: '/knowledge'");
    expect(navigationSource).toContain("floatingDock: 'collapsed'");
    expect(navigationSource).toContain("component: 'GlobalAIFloatingButton'");
    expect(navigationSource).toContain("disposition: 'registered-shared-dock'");
    expect(navigationSource).toContain('Konling knowledge workspace entry registers through PageFloatingControlsProvider');
  });

  it('passes knowledge workspace hints through the real Konling chat routes', () => {
    const globalSidebarSource = readFileSync(
      path.join(process.cwd(), 'src/components/ai/global-ai-sidebar.tsx'),
      'utf8'
    );
    const chatRouteSource = readFileSync(
      path.join(process.cwd(), 'src/app/api/ai/chat/route.ts'),
      'utf8'
    );
    const sessionMessagesRouteSource = readFileSync(
      path.join(process.cwd(), 'src/app/api/ai/sessions/[id]/messages/route.ts'),
      'utf8'
    );

    expect(globalSidebarSource).toContain('knowledgeWorkspaceHint: knowledgeWorkspaceHint ?? assistantEntryPoint?.serverContext');
    expect(chatRouteSource).toContain('knowledgeWorkspaceHint,');
    expect(chatRouteSource).toContain('normalizeKonlingKnowledgeWorkspaceHint');
    expect(chatRouteSource).toContain('knowledgeWorkspaceHint ?? modeClientContextHints');
    expect(sessionMessagesRouteSource).toContain('knowledgeWorkspaceHint');
    expect(sessionMessagesRouteSource).toContain('normalizeKonlingKnowledgeWorkspaceHint');
    expect(sessionMessagesRouteSource).toContain('knowledgeWorkspaceHint ?? modeClientContextHints');
  });

  it('renders selected knowledge nodes through a stable inspector hierarchy', () => {
    const resourcePanelSource = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/resource-panel/resource-panel.tsx'),
      'utf8'
    );

    expect(resourcePanelSource).toContain('data-knowledge-inspector="floating-right-edge"');
    expect(resourcePanelSource).toContain('data-knowledge-inspector-responsive="desktop-floating-mobile-sheet"');
    expect(resourcePanelSource).toContain('data-knowledge-inspector-focus-contract="mobile-trap-escape-return"');
    expect(resourcePanelSource).toContain('data-knowledge-inspector-dock-safe-area="bottom-padding"');
    expect(resourcePanelSource).toContain('role="dialog"');
    expect(resourcePanelSource).toContain('handleInspectorKeyDown');
    expect(resourcePanelSource).toContain("if (event.key === 'Escape')");
    expect(resourcePanelSource).toContain("window.matchMedia(MOBILE_INSPECTOR_QUERY).matches");
    expect(resourcePanelSource).toContain('closeButtonRef.current?.focus();');
    expect(resourcePanelSource).toContain('}, [selectedNode.id]);');
    expect(resourcePanelSource).toContain("document.querySelector<HTMLElement>('[data-knowledge-canvas-primary=\"true\"]')?.focus();");
    expect(resourcePanelSource).toContain('lg:w-[var(--knowledge-inspector-width,clamp(22.5rem,30vw,28.75rem))]');
    expect(resourcePanelSource).toContain('lg:fixed');
    expect(resourcePanelSource).toContain('bottom-20');
    expect(resourcePanelSource).toContain('lg:bottom-20');
    expect(resourcePanelSource).not.toContain('lg:relative');
    expect(resourcePanelSource).not.toContain('lg:shrink-0');
    expect(resourcePanelSource).toContain('data-knowledge-inspector-section="header"');
    expect(resourcePanelSource).toContain('data-knowledge-inspector-section="semantic-metadata"');
    expect(resourcePanelSource).toContain('data-knowledge-inspector-section="summary"');
    expect(resourcePanelSource).toContain('data-knowledge-inspector-section="infograph-preview"');
    expect(resourcePanelSource).toContain('data-knowledge-inspector-section="relation-overview"');
    expect(resourcePanelSource).toContain('data-knowledge-inspector-section="learning-actions"');
    expect(resourcePanelSource).toContain('data-knowledge-inspector-section="evidence-sources"');
    expect(resourcePanelSource).not.toContain('w-[min(22rem,calc(100vw-1rem))]');
  });

  it('registers #487 browser evidence as a governance hard gate', () => {
    const governanceSource = readFileSync(
      path.join(process.cwd(), 'scripts/tests/test-commercial-ui-governance.ts'),
      'utf8'
    );

    expect(governanceSource).toContain('KNOWLEDGE_WORKSPACE_TOOLS_INSPECTOR_EVIDENCE_PATH');
    expect(governanceSource).toContain('artifacts/knowledge-workspace-tools-inspector-487/browser-evidence.json');
    expect(governanceSource).toContain('validateKnowledgeWorkspaceToolsInspectorEvidence');
    expect(governanceSource).toContain('desktopToolPaths');
    expect(governanceSource).toContain('openedFocusWithinPanel');
    expect(governanceSource).toContain('focusReturnedToTrigger');
    expect(governanceSource).toContain('mobileInspector');
    expect(governanceSource).toContain('focusReturnedToCanvas');
    expect(governanceSource).toContain('inspectorDockSafeArea');
  });

  it('resets resource inspector detail state when selection changes without remounting the panel', () => {
    const ordinaryState = resolveResourcePanelSelectionState(graphNode('node-a'));
    const chapterState = resolveResourcePanelSelectionState({
      ...graphNode('chapter-node:根轨迹分析'),
      metadata: { isVirtualChapter: true },
    });

    expect(ordinaryState).toEqual({
      nodeDetail: null,
      nodeDetailOwnerId: null,
      isLoading: true,
      isCardOpen: false,
      expandedRelationGroups: {},
    });
    expect(chapterState).toEqual({
      nodeDetail: {
        ...graphNode('chapter-node:根轨迹分析'),
        metadata: { isVirtualChapter: true },
      },
      nodeDetailOwnerId: 'chapter-node:根轨迹分析',
      isLoading: false,
      isCardOpen: false,
      expandedRelationGroups: {},
    });
  });
});
