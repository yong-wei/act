'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';

import { ControlGraphCanvas } from './topology-graph/control-graph-canvas';
import { DetailSidebar } from './sidebar/detail-sidebar';
import { SearchBar } from './controls/search-bar';
import { ViewToggles } from './controls/view-toggles';
import { controlTheoryNodes } from './data/control-theory-nodes';
import { findControlMapSearchMatches } from './control-map-filters';
import { defaultViewState, zoneConfigs, type ViewState } from './types';

const OVERLAY_CLASS = 'simulation-light-panel pointer-events-auto';

export function ControlMapSystem() {
  const [viewState, setViewState] = useState<ViewState>(defaultViewState);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ nodeId: string; sequence: number } | null>(null);
  const focusSequence = useRef(0);

  const searchMatches = useMemo(() => findControlMapSearchMatches(controlTheoryNodes, viewState), [viewState]);

  const updateViewState = useCallback((updates: Partial<ViewState>) => {
    setViewState((prev) => ({ ...prev, ...updates }));
  }, []);

  const selectNode = useCallback((nodeId: string) => {
    setViewState((prev) => ({ ...prev, selectedNode: nodeId }));
    setIsSidebarOpen(true);
  }, []);

  const handleNodeClick = useCallback((nodeId: string) => {
    if (nodeId) {
      selectNode(nodeId);
    } else {
      setViewState((prev) => ({ ...prev, selectedNode: null }));
      setIsSidebarOpen(false);
    }
  }, [selectNode]);

  const handleNodeHover = useCallback((nodeId: string | null) => {
    setViewState((prev) => ({ ...prev, hoveredNode: nodeId }));
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setViewState((prev) => ({ ...prev, selectedNode: null }));
    setIsSidebarOpen(false);
  }, []);

  const focusNode = useCallback((nodeId: string) => {
    selectNode(nodeId);
    focusSequence.current += 1;
    setFocusRequest({ nodeId, sequence: focusSequence.current });
  }, [selectNode]);

  const handleSearchChange = useCallback((query: string) => {
    setViewState((prev) => ({ ...prev, searchQuery: query }));
  }, []);

  const handleSearchSubmit = useCallback(() => {
    const [first] = searchMatches;
    if (first) focusNode(first.id);
  }, [focusNode, searchMatches]);

  useEffect(() => {
    if (!isSidebarOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleCloseSidebar();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleCloseSidebar, isSidebarOpen]);

  const detailOpen = isSidebarOpen && viewState.selectedNode !== null;

  return (
    <ReactFlowProvider>
      <div className="relative flex min-h-[32rem] flex-1 overflow-hidden bg-platform-canvas" data-control-map-workspace="">
        <div className="absolute inset-0">
          <ControlGraphCanvas
            viewState={viewState}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
            focusRequest={focusRequest}
          />
        </div>

        <div className={`${OVERLAY_CLASS} absolute left-3 top-3 z-10 p-3`} data-control-map-legend="">
          <p className="mb-2 text-[11px] font-semibold tracking-[0.18em] text-platform-fg-muted">知识区域</p>
          <ul className="space-y-1.5">
            {Object.values(zoneConfigs).map((zone) => (
              <li key={zone.id} className="flex items-center gap-2">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: zone.color }} />
                <span className="text-xs text-platform-fg-primary">{zone.nameCn}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="pointer-events-none absolute bottom-3 right-3 top-3 z-20 flex w-[22rem] max-w-[calc(100%-1.5rem)] flex-col items-stretch gap-3">
          <div className={`${OVERLAY_CLASS} space-y-2.5 p-3`} data-control-map-toolbar="">
            <SearchBar
              value={viewState.searchQuery}
              onChange={handleSearchChange}
              matchCount={searchMatches.length}
              onSubmit={handleSearchSubmit}
            />
            <ViewToggles viewState={viewState} onViewStateChange={updateViewState} />
          </div>

          {detailOpen ? (
            <div className="pointer-events-auto flex min-h-0 flex-1 flex-col">
              <DetailSidebar
                nodeId={viewState.selectedNode}
                isDiscrete={!viewState.showContinuous && viewState.showDiscrete}
                onClose={handleCloseSidebar}
                onNavigate={focusNode}
              />
            </div>
          ) : null}
        </div>

        <p className="pointer-events-none absolute bottom-3 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-platform-border bg-platform-surface/85 px-3 py-1 text-[11px] text-platform-fg-secondary backdrop-blur md:block">
          点击节点查看详情 · 悬停高亮关联 · 滚轮缩放 · 拖拽平移 · 共 {Object.keys(zoneConfigs).length} 个知识区域
        </p>
      </div>
    </ReactFlowProvider>
  );
}
