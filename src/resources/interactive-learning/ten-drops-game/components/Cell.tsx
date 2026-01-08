'use client';

/**
 * Cell - 单个格子组件
 *
 * 显示格子状态、水滴数量（通过大小表示），处理点击交互
 */

import { memo, useMemo } from 'react';
import type { CellState } from '../types';
import { WaterDrop } from './WaterDrop';

interface CellProps {
  /** 格子状态 */
  cell: CellState;
  /** 行号 */
  row: number;
  /** 列号 */
  col: number;
  /** 点击回调 */
  onClick: (row: number, col: number) => void;
  /** 是否禁用交互 */
  disabled?: boolean;
  /** 格子大小 */
  cellSize?: number;
}

/**
 * 根据填充程度返回背景色
 */
function getFillColor(drops: number, capacity: number): string {
  if (drops === 0) return 'bg-slate-800/50';

  const fillRatio = drops / capacity;

  if (fillRatio >= 1) return 'bg-amber-500/10'; // 临界状态
  if (fillRatio >= 0.75) return 'bg-blue-500/10'; // 接近满载
  return 'bg-slate-800/80'; // 普通
}

/**
 * 根据容量返回边框样式
 */
function getCapacityBorder(capacity: number): string {
  // 简化边框，让水滴更突出
  return 'border-slate-700/50 hover:border-blue-500/50';
}

export const Cell = memo(function Cell({
  cell,
  row,
  col,
  onClick,
  disabled = false,
  cellSize = 60,
}: CellProps) {
  const { drops, capacity, isExploding } = cell;

  // 计算样式
  const fillColor = useMemo(() => getFillColor(drops, capacity), [drops, capacity]);
  const borderColor = useMemo(() => getCapacityBorder(capacity), [capacity]);

  // 是否接近满载（显示摇晃动画）
  // 当水滴数 >= 4 (即即将爆炸) 或者 达到容量极限时摇晃
  const isNearFull = drops >= 4 || (drops >= capacity && drops > 0);

  // 动画类
  const animationClass = isExploding ? 'animate-cell-explode' : '';

  // 处理点击
  const handleClick = () => {
    if (!disabled) {
      onClick(row, col);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`
        relative rounded-xl border transition-all duration-200
        ${fillColor} ${borderColor} ${animationClass}
        ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-slate-700/80 active:scale-95'}
        flex items-center justify-center overflow-visible
      `}
      style={{
        width: cellSize,
        height: cellSize,
      }}
      aria-label={`格子 (${row + 1}, ${col + 1}): ${drops} 水滴`}
    >
      {/* 容量指示器（仅在调试或教学模式下可能有用，这里保留但淡化） */}
      {/* <span className="absolute top-1 right-1 text-[8px] text-slate-700 font-mono opacity-0 hover:opacity-100 transition-opacity">
        {capacity}
      </span> */}

      {/* 单个大水滴容器 */}
      <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none w-full h-full">
        {drops > 0 && (
          <WaterDrop
            level={drops}
            isWobbling={isNearFull}
            // 每次点击导致 drops 变化时，React key 变化会触发重新挂载动画吗？
            // 最好不需要 key，让 CSS transition 处理大小变化
            // 但如果需要 "appear" 动画，可能需要 key
            // 这里我们依赖 WaterDrop 内部的 transition
          />
        )}
      </div>

      {/* 涟漪效果（爆炸时） */}
      {isExploding && (
        <div className="absolute inset-0 rounded-xl bg-blue-400/30 animate-ripple z-0" />
      )}
    </button>
  );
});

export default Cell;