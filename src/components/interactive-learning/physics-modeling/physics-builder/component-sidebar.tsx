'use client';

/**
 * 元件侧边栏
 * Component Sidebar for Physics Builder
 */

import { memo } from 'react';
import { Box, Activity, Zap, Battery, Circle } from 'lucide-react';
import type { BuilderMode, ComponentDefinition } from '../types';
import { MECHANICAL_COMPONENTS, ELECTRICAL_COMPONENTS } from '../types';

interface ComponentSidebarProps {
  mode: BuilderMode;
  onDragStart: (
    event: React.DragEvent,
    componentType: ComponentDefinition['type']
  ) => void;
}

/** 元件卡片 */
function ComponentCard({
  component,
  onDragStart,
}: {
  component: ComponentDefinition;
  onDragStart: (
    event: React.DragEvent,
    componentType: ComponentDefinition['type']
  ) => void;
}) {
  const handleDragStart = (event: React.DragEvent) => {
    onDragStart(event, component.type);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="group flex cursor-grab items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/50 p-3 transition-all hover:border-amber-500/50 hover:bg-slate-800 active:cursor-grabbing"
    >
      {/* 图标 */}
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-700/50 text-slate-400 group-hover:text-amber-500">
        <ComponentIcon type={component.type} />
      </div>

      {/* 信息 */}
      <div className="flex-1">
        <div className="text-sm font-medium text-slate-200">{component.name}</div>
        <div className="text-xs text-slate-500">
          符号: <span className="font-mono text-amber-500">{component.symbol}</span>
        </div>
      </div>
    </div>
  );
}

/** 元件图标 */
function ComponentIcon({ type }: { type: ComponentDefinition['type'] }) {
  switch (type) {
    case 'mass':
      return <Box className="h-5 w-5" />;
    case 'spring':
    case 'resistor':
      return <Activity className="h-5 w-5" />;
    case 'damper':
    case 'inductor':
      return <Zap className="h-5 w-5" />;
    case 'force_source':
    case 'voltage_source':
      return <Battery className="h-5 w-5" />;
    case 'capacitor':
      return <Circle className="h-5 w-5" />;
    default:
      return <Box className="h-5 w-5" />;
  }
}

/** 侧边栏组件 */
function ComponentSidebarComponent({ mode, onDragStart }: ComponentSidebarProps) {
  const components =
    mode === 'mechanical' ? MECHANICAL_COMPONENTS : ELECTRICAL_COMPONENTS;

  const title = mode === 'mechanical' ? '机械元件库' : '电气元件库';
  const description =
    mode === 'mechanical'
      ? '拖拽元件到画布，构建弹簧-质量-阻尼系统'
      : '拖拽元件到画布，构建RLC电路';

  return (
    <div className="flex h-full w-64 flex-col border-r border-slate-800 bg-slate-900/50">
      {/* 标题 */}
      <div className="border-b border-slate-800 p-4">
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>

      {/* 元件列表 */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-2">
          {components.map((component) => (
            <ComponentCard
              key={component.type}
              component={component}
              onDragStart={onDragStart}
            />
          ))}
        </div>
      </div>

      {/* 提示 */}
      <div className="border-t border-slate-800 p-3">
        <div className="rounded-lg bg-amber-500/10 p-3">
          <p className="text-xs text-amber-500/80">
            💡 提示：连接元件后，下方会自动生成对应的微分方程
          </p>
        </div>
      </div>
    </div>
  );
}

export const ComponentSidebar = memo(ComponentSidebarComponent);
