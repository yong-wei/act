'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Info } from 'lucide-react';
import { ReactFlowProvider } from 'reactflow';

import { ControlGraphCanvas } from './topology-graph/control-graph-canvas';
import { DetailSidebar } from './sidebar/detail-sidebar';
import { SearchBar } from './controls/search-bar';
import { ViewToggles } from './controls/view-toggles';
import { defaultViewState, zoneConfigs, type ViewState } from './types';

export function ControlMapSystem() {
  const [viewState, setViewState] = useState<ViewState>(defaultViewState);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const updateViewState = useCallback((updates: Partial<ViewState>) => {
    setViewState((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleNodeClick = useCallback((nodeId: string) => {
    if (nodeId) {
      setViewState((prev) => ({ ...prev, selectedNode: nodeId }));
      setIsSidebarOpen(true);
    } else {
      setViewState((prev) => ({ ...prev, selectedNode: null }));
      setIsSidebarOpen(false);
    }
  }, []);

  const handleNodeHover = useCallback((nodeId: string | null) => {
    setViewState((prev) => ({ ...prev, hoveredNode: nodeId }));
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setViewState((prev) => ({ ...prev, selectedNode: null }));
    setIsSidebarOpen(false);
  }, []);

  const handleNavigate = useCallback((nodeId: string) => {
    setViewState((prev) => ({ ...prev, selectedNode: nodeId }));
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setViewState((prev) => ({ ...prev, searchQuery: query }));
  }, []);

  return (
    <ReactFlowProvider>
      <div className="flex h-screen flex-col bg-slate-950">
        {/* 顶部导航 */}
        <header className="z-10 border-b border-slate-800">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <Link
                href="/interactive-learning"
                className="flex items-center gap-2 text-slate-400 transition-colors hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-sm">返回</span>
              </Link>
              <div className="h-4 w-px bg-slate-700" />
              <h1 className="text-lg font-semibold text-white">控制理论地图</h1>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-64">
                <SearchBar value={viewState.searchQuery} onChange={handleSearchChange} />
              </div>
              <ViewToggles viewState={viewState} onViewStateChange={updateViewState} />
            </div>
          </div>
        </header>

        {/* 主内容区域 */}
        <main className="relative flex flex-1 overflow-hidden">
          {/* 图例 */}
          <div className="absolute left-4 top-4 z-10 rounded-xl border border-slate-700/50 bg-slate-900/90 p-3 backdrop-blur-sm">
            <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
              <Info className="h-3.5 w-3.5" />
              <span>知识区域图例</span>
            </div>
            <div className="space-y-1.5">
              {Object.values(zoneConfigs).map((zone) => (
                <div key={zone.id} className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded"
                    style={{ backgroundColor: zone.color }}
                  />
                  <span className="text-xs text-slate-300">{zone.nameCn}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 图谱画布 */}
          <div className="flex-1">
            <ControlGraphCanvas
              viewState={viewState}
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
            />
          </div>

          {/* 详情侧边栏 */}
          {isSidebarOpen && viewState.selectedNode && (
            <DetailSidebar
              nodeId={viewState.selectedNode}
              isDiscrete={!viewState.showContinuous && viewState.showDiscrete}
              onClose={handleCloseSidebar}
              onNavigate={handleNavigate}
            />
          )}
        </main>

        {/* 底部提示 */}
        <footer className="border-t border-slate-800 px-6 py-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>点击节点查看详情 · 悬停高亮关联节点 · 滚轮缩放 · 拖拽平移</span>
            <span>共 {Object.keys(zoneConfigs).length} 个知识区域</span>
          </div>
        </footer>
      </div>
    </ReactFlowProvider>
  );
}
