'use client';

/**
 * 相机视角切换 UI 组件
 * 提供三种预设视角按钮和自由视角状态显示
 */

import { Video, Eye, Compass, Move3d, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CameraView } from './camera-controller';

export interface CameraViewOption {
  readonly id: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly icon: typeof Video;
  readonly description: string;
}

export interface CameraViewSwitcherProps {
  /** 当前相机模式 */
  currentMode: string;
  /** 模式变化回调 */
  onModeChange: (mode: string) => void;
  /** 预设视角按钮列表（缺省为 主视角/俯瞰/战术 三档） */
  views?: readonly CameraViewOption[];
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
  /** 当前仿真速度倍率 */
  speedScale?: number;
  /** 调整仿真速度倍率 */
  onSpeedChange?: (nextSpeedScale: number) => void;
  /** 最小仿真速度倍率 */
  minSpeedScale?: number;
  /** 最大仿真速度倍率 */
  maxSpeedScale?: number;
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

const commandButtonInactiveClass =
  'text-platform-fg-secondary hover:bg-platform-action-hover hover:text-platform-fg-primary';
const commandValueClass = 'text-platform-fg-primary';

/**
 * 相机视角切换器
 * 显示三个预设视角按钮，当处于自由视角时显示状态标签
 */
export function CameraViewSwitcher({
  currentMode,
  onModeChange,
  views,
  className,
  showFreeLabel = true,
  size = 'sm',
  gridEnabled,
  onToggleGrid,
  speedScale = 1,
  onSpeedChange,
  minSpeedScale = 0.5,
  maxSpeedScale = 8,
}: CameraViewSwitcherProps) {
  const modes = views ?? viewModes;
  const speedPresets = [0.5, 1, 2, 4, 8].filter((value) => value >= minSpeedScale && value <= maxSpeedScale);

  const findNextSpeed = (direction: -1 | 1): number => {
    if (speedPresets.length === 0) {
      return speedScale;
    }
    const exactIndex = speedPresets.findIndex((value) => Math.abs(value - speedScale) < 1e-6);
    if (exactIndex >= 0) {
      const nextIndex = Math.min(speedPresets.length - 1, Math.max(0, exactIndex + direction));
      return speedPresets[nextIndex];
    }
    if (direction > 0) {
      return speedPresets.find((value) => value > speedScale) ?? speedPresets[speedPresets.length - 1];
    }
    const reversed = [...speedPresets].reverse();
    return reversed.find((value) => value < speedScale) ?? speedPresets[0];
  };

  const handleDecrease = () => {
    if (!onSpeedChange) {
      return;
    }
    onSpeedChange(findNextSpeed(-1));
  };

  const handleIncrease = () => {
    if (!onSpeedChange) {
      return;
    }
    onSpeedChange(findNextSpeed(1));
  };

  return (
    <div className={cn('flex items-center gap-1 max-[360px]:gap-0', className)} data-simulation-local-bottom-tool-strip="camera-controls">
      {/* 视角按钮组 */}
      <div
        className="simulation-command-restore-handle flex shrink-0 p-1"
        data-simulation-local-bottom-toolbar
        data-simulation-local-bottom-tool-segment="view-switcher"
        data-command-deck-bottom-tools="edge-adjacent"
      >
        {modes.map((mode) => {
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
                  ? 'bg-platform-fg-primary text-platform-fg-inverse'
                  : commandButtonInactiveClass
              )}
              title={`${mode.label} - ${mode.description}`}
            >
              <Icon className="h-4 w-4 mr-1 max-[360px]:mr-0" />
              <span className="hidden sm:inline">{mode.label}</span>
              <span className="sm:hidden max-[360px]:hidden">{mode.shortLabel}</span>
            </Button>
          );
        })}
      </div>

      {/* 自由视角状态标签 */}
      {showFreeLabel && currentMode === 'free' && (
        <Badge
          variant="outline"
          className="border-platform-action-primary bg-platform-action-subtle text-platform-action-primary backdrop-blur-sm"
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
            'shrink-0 rounded-xl border border-platform-border-strong bg-platform-surface-overlay/86 shadow-lg backdrop-blur-sm transition-all max-[360px]:px-2',
            gridEnabled
              ? 'bg-platform-fg-primary text-platform-fg-inverse'
              : commandButtonInactiveClass
          )}
          title={gridEnabled ? '关闭网格' : '开启网格'}
          aria-label={gridEnabled ? '关闭网格' : '开启网格'}
          data-simulation-local-bottom-tool-segment="grid-toggle"
        >
          <span className="mr-1 text-xs">#</span>
          <span className="hidden sm:inline">{gridEnabled ? '网格开' : '网格关'}</span>
          <span className="sm:hidden">网</span>
        </Button>
      ) : null}

      {onSpeedChange ? (
        <div
          className="simulation-command-restore-handle flex shrink-0 items-center gap-1 p-1 max-[360px]:gap-0 max-[360px]:p-0"
          data-simulation-local-bottom-tool-segment="speed-controls"
        >
          <Button
            variant="ghost"
            size={size}
            onClick={handleDecrease}
            className={commandButtonInactiveClass}
            title="减速"
            aria-label="减速"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className={cn('min-w-11 text-center text-xs font-semibold max-[360px]:min-w-8', commandValueClass)}>{speedScale.toFixed(1)}x</span>
          <Button
            variant="ghost"
            size={size}
            onClick={handleIncrease}
            className={commandButtonInactiveClass}
            title="加速"
            aria-label="加速"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
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
    <div className={cn('flex rounded-lg border border-platform-border-strong bg-platform-surface-overlay/86 p-0.5 backdrop-blur-sm', className)}>
      {viewModes.map((mode) => {
        const Icon = mode.icon;
        const isActive = currentMode === mode.id;

        return (
          <button type="button"
            key={mode.id}
            onClick={() => onModeChange(mode.id)}
            className={cn(
              'p-1.5 rounded transition-all',
              isActive
                ? 'bg-platform-fg-primary text-platform-fg-inverse'
                : commandButtonInactiveClass
            )}
            title={mode.label}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
      {currentMode === 'free' && (
        <div className="p-1.5 text-platform-action-primary" title="自由视角">
          <Move3d className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
