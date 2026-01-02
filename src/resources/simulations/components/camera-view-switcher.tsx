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
}: CameraViewSwitcherProps) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {/* 视角按钮组 */}
      <div className="flex bg-black/60 rounded-lg p-1 backdrop-blur-sm">
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
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
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
          className="bg-blue-500/20 text-blue-300 border-blue-500/50 backdrop-blur-sm"
        >
          <Move3d className="h-3 w-3 mr-1" />
          自由视角
        </Badge>
      )}
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
    <div className={cn('flex bg-black/60 rounded-lg p-0.5 backdrop-blur-sm', className)}>
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
                ? 'bg-white/20 text-white'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            )}
            title={mode.label}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
      {currentMode === 'free' && (
        <div className="p-1.5 text-blue-400" title="自由视角">
          <Move3d className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
