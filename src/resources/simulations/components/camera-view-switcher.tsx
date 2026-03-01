'use client';

/**
 * 相机视角切换 UI 组件
 * 提供三种预设视角按钮和自由视角状态显示
 */

import { Video, Eye, Compass, Move3d } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CameraMode, CameraView } from './camera-controller';

export interface CameraViewSwitcherProps {
  /** 当前相机模式 */
  currentMode: CameraMode;
  /** 模式变化回调 */
  onModeChange: (mode: CameraMode) => void;
  /** 自定义样式类名 */
  className?: string;
  /** 是否显示自由视角标签 */
  showFreeLabel?: boolean;
  /** 按钮大小 */
  size?: 'sm' | 'default' | 'lg';
  /** 网格是否启用 */
  gridEnabled?: boolean;
  /** 切换网格显示 */
  onToggleGrid?: () => void;
}

const viewModes: Array<{
  id: CameraView;
  label: string;
  shortLabel: string;
  icon: typeof Video;
  description: string;
}> = [
  {
    id: 'chase',
    label: '主视角',
    shortLabel: '主',
    icon: Video,
    description: '从船尾跟随',
  },
  {
    id: 'overhead',
    label: '俯瞰',
    shortLabel: '俯',
    icon: Eye,
    description: '从上方俯视',
  },
  {
    id: 'tactical',
    label: '战术',
    shortLabel: '战',
    icon: Compass,
    description: '45度斜视',
  },
];

/**
 * 相机视角切换器
 * 显示三个预设视角按钮，当处于自由视角时显示状态标签
 */
export function CameraViewSwitcher({
  currentMode,
  onModeChange,
  className,
  showFreeLabel = true,
  size = 'sm',
  gridEnabled,
  onToggleGrid,
}: CameraViewSwitcherProps) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {/* 视角按钮组 */}
      <div className="flex rounded-xl border border-slate-200/90 bg-slate-50/92 p-1 shadow-lg shadow-slate-950/20 backdrop-blur-sm">
        {viewModes.map((mode) => {
          const Icon = mode.icon;
          const isActive = currentMode === mode.id;

          return (
            <Button
              key={mode.id}
              variant={isActive ? 'secondary' : 'ghost'}
              size={size}
              onClick={() => onModeChange(mode.id)}
              className={cn(
                'transition-all',
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-200 hover:text-slate-900'
              )}
              title={`${mode.label} - ${mode.description}`}
            >
              <Icon className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">{mode.label}</span>
              <span className="sm:hidden">{mode.shortLabel}</span>
            </Button>
          );
        })}
      </div>

      {/* 自由视角状态标签 */}
      {showFreeLabel && currentMode === 'free' && (
        <Badge
          variant="outline"
          className="border-sky-300 bg-sky-50 text-sky-700 backdrop-blur-sm"
        >
          <Move3d className="h-3 w-3 mr-1" />
          自由视角
        </Badge>
      )}

      {onToggleGrid ? (
        <Button
          variant={gridEnabled ? 'secondary' : 'ghost'}
          size={size}
          onClick={onToggleGrid}
          className={cn(
            'rounded-xl border border-slate-200/90 bg-slate-50/92 shadow-lg shadow-slate-950/20 backdrop-blur-sm transition-all',
            gridEnabled
              ? 'bg-slate-900 text-white hover:bg-slate-800'
              : 'text-slate-700 hover:bg-slate-200 hover:text-slate-900'
          )}
          title={gridEnabled ? '关闭网格' : '开启网格'}
          aria-label={gridEnabled ? '关闭网格' : '开启网格'}
        >
          <span className="mr-1 text-xs">#</span>
          <span className="hidden sm:inline">{gridEnabled ? '网格开' : '网格关'}</span>
          <span className="sm:hidden">网</span>
        </Button>
      ) : null}
    </div>
  );
}

/**
 * 紧凑版视角切换器（仅图标）
 */
export function CameraViewSwitcherCompact({
  currentMode,
  onModeChange,
  className,
}: Omit<CameraViewSwitcherProps, 'showFreeLabel' | 'size'>) {
  return (
    <div className={cn('flex rounded-lg border border-slate-200 bg-slate-50/92 p-0.5 backdrop-blur-sm', className)}>
      {viewModes.map((mode) => {
        const Icon = mode.icon;
        const isActive = currentMode === mode.id;

        return (
          <button
            key={mode.id}
            onClick={() => onModeChange(mode.id)}
            className={cn(
              'p-1.5 rounded transition-all',
              isActive
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-200 hover:text-slate-900'
            )}
            title={mode.label}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
      {currentMode === 'free' && (
        <div className="p-1.5 text-sky-700" title="自由视角">
          <Move3d className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
