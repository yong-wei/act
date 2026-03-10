'use client';

/**
 * GameGrid - 游戏网格组件
 *
 * 组装所有格子，处理整体布局
 */

import { memo, useCallback, useEffect, useState } from 'react';
import type { GameBoard, Direction } from '../types';
import { DIRECTION_VECTORS } from '../types';
import { Cell } from './Cell';
import { FlyingDrop } from '../utils/game-logic';
import { FlyingDropIcon } from './FlyingDropIcon';

interface GameGridProps {
  /** 棋盘数据 */
  board: GameBoard;
  /** 点击格子回调 */
  onCellClick: (row: number, col: number) => void;
  /** 是否禁用交互 */
  disabled?: boolean;
  /** 网格尺寸配置 */
  gridSize: { rows: number; cols: number };
  /** 飞行中的水滴 */
  activeFlyingDrops?: FlyingDrop[];
}

const ROTATION_MAP: Record<string, number> = {
  up: 0,
  right: 90,
  down: 180,
  left: 270,
};
const ROTATION_OFFSET = 180;

/**
 * 飞行水滴组件
 */
const Projectile = memo(function Projectile({
  drop,
  cellSize,
  gap,
  gridRows,
  gridCols
}: {
  drop: FlyingDrop;
  cellSize: number;
  gap: number;
  gridRows: number;
  gridCols: number;
}) {
  const [position, setPosition] = useState({
    top: drop.from.row * (cellSize + gap),
    left: drop.from.col * (cellSize + gap),
  });

  useEffect(() => {
    // 下一帧触发移动
    const timer = requestAnimationFrame(() => {
      let targetRow, targetCol;

      if (drop.to) {
        targetRow = drop.to.row;
        targetCol = drop.to.col;
      } else {
        // 飞出边界：往那个方向多飞一格
        const vec = DIRECTION_VECTORS[drop.direction];
        // 简单处理：飞出当前网格范围
        let r = drop.from.row;
        let c = drop.from.col;
        while(r >= -1 && r <= gridRows && c >= -1 && c <= gridCols) {
             r += vec.row;
             c += vec.col;
        }
        targetRow = r;
        targetCol = c;
      }

      setPosition({
        top: targetRow * (cellSize + gap),
        left: targetCol * (cellSize + gap),
      });
    });

    return () => cancelAnimationFrame(timer);
  }, [drop, cellSize, gap, gridRows, gridCols]);

  return (
    <div
      className="absolute z-20 transition-all duration-500 linear"
      style={{
        top: position.top,
        left: position.left,
        width: cellSize,
        height: cellSize,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `rotate(${(ROTATION_MAP[drop.direction] + ROTATION_OFFSET) % 360}deg)`,
      }}
    >
      <FlyingDropIcon size={cellSize * 0.5} />
    </div>
  );
});

export const GameGrid = memo(function GameGrid({
  board,
  onCellClick,
  disabled = false,
  gridSize,
  activeFlyingDrops = [],
}: GameGridProps) {
  // 根据网格大小计算格子尺寸
  const getCellSize = useCallback(() => {
    const maxCols = gridSize.cols;
    // 基础尺寸，根据列数缩放
    if (maxCols <= 4) return 70;
    if (maxCols <= 5) return 60;
    if (maxCols <= 6) return 55;
    return 48;
  }, [gridSize.cols]);

  const cellSize = getCellSize();
  const gap = 6;

  // 计算网格总宽度
  const gridWidth = gridSize.cols * cellSize + (gridSize.cols - 1) * gap;
  const gridHeight = gridSize.rows * cellSize + (gridSize.rows - 1) * gap;

  if (board.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-400">
        加载中...
      </div>
    );
  }

  return (
    <div
      className="relative inline-block p-4 bg-slate-900/50 rounded-xl border border-slate-700/50"
      style={{ width: gridWidth + 32 }} // 32 = padding (16 * 2)
    >
      <div
        className="grid relative"
        style={{
          gridTemplateColumns: `repeat(${gridSize.cols}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${gridSize.rows}, ${cellSize}px)`,
          gap: `${gap}px`,
        }}
        role="grid"
        aria-label="游戏棋盘"
      >
        {board.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <Cell
              key={`${rowIndex}-${colIndex}`}
              cell={cell}
              row={rowIndex}
              col={colIndex}
              onClick={onCellClick}
              disabled={disabled}
              cellSize={cellSize}
            />
          ))
        )}
        
        {/* 飞行投射物层 */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ width: gridWidth, height: gridHeight }}>
           {activeFlyingDrops.map((drop) => (
             <Projectile 
               key={drop.id} 
               drop={drop} 
               cellSize={cellSize} 
               gap={gap} 
               gridRows={gridSize.rows}
               gridCols={gridSize.cols}
             />
           ))}
        </div>
      </div>
    </div>
  );
});

export default GameGrid;
