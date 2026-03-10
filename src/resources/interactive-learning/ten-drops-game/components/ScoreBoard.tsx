'use client';

/**
 * ScoreBoard - 得分面板组件
 *
 * 显示步数、连锁数、游戏状态
 */

import { memo } from 'react';
import { Droplets, Link2, Trophy, AlertTriangle } from 'lucide-react';
import type { GameStatus } from '../types';

interface ScoreBoardProps {
  /** 当前可用水滴 */
  dropsAvailable: number;
  /** 初始水滴 */
  initialDrops: number;
  /** 当前连锁数 */
  chainCount: number;
  /** 本局最大连锁 */
  maxChainReached: number;
  /** 游戏状态 */
  gameStatus: GameStatus;
  /** 得分（胜利时显示） */
  score?: number;
}

export const ScoreBoard = memo(function ScoreBoard({
  dropsAvailable,
  initialDrops,
  chainCount,
  maxChainReached,
  gameStatus,
  score = 0,
}: ScoreBoardProps) {
  // 是否水滴不足
  const isLowDrops = dropsAvailable <= 2 && dropsAvailable > 0;

  // 状态文本
  const getStatusText = () => {
    switch (gameStatus) {
      case 'idle':
        return '准备开始';
      case 'playing':
        return '游戏中';
      case 'processing':
        return '连锁反应中...';
      case 'won':
        return '胜利！';
      case 'lost':
        return '水滴用尽';
      default:
        return '';
    }
  };

  // 状态颜色
  const getStatusColor = () => {
    switch (gameStatus) {
      case 'won':
        return 'text-green-400';
      case 'lost':
        return 'text-red-400';
      case 'processing':
        return 'text-amber-400';
      default:
        return 'text-slate-300';
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 p-3 bg-slate-800/50 rounded-lg">
      {/* 水滴资源 */}
      <div className="flex items-center gap-2">
        <Droplets className={`h-5 w-5 ${isLowDrops ? 'text-amber-400' : 'text-blue-400'}`} />
        <div className="flex flex-col">
          <span className="text-xs text-slate-400">可用水滴</span>
          <span className={`text-lg font-bold ${isLowDrops ? 'text-amber-400' : 'text-white'}`}>
            {dropsAvailable}
          </span>
        </div>
        {isLowDrops && (
          <AlertTriangle className="h-4 w-4 text-amber-400 animate-pulse" />
        )}
      </div>

      {/* 分隔符 */}
      <div className="h-8 w-px bg-slate-600 hidden md:block" />

      {/* 连锁数 */}
      <div className="flex items-center gap-2">
        <Link2 className="h-5 w-5 text-purple-400" />
        <div className="flex flex-col">
          <span className="text-xs text-slate-400">连锁</span>
          <div className="flex items-baseline gap-1">
            <span className={`text-lg font-bold ${chainCount > 0 ? 'text-purple-400' : 'text-white'}`}>
              {chainCount}
            </span>
            {maxChainReached > 0 && (
              <span className="text-xs text-slate-500">
                (最高 {maxChainReached})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 分隔符 */}
      <div className="h-8 w-px bg-slate-600 hidden md:block" />

      {/* 状态 / 得分 */}
      <div className="flex items-center gap-2">
        {gameStatus === 'won' ? (
          <>
            <Trophy className="h-5 w-5 text-amber-400 animate-victory-bounce" />
            <div className="flex flex-col">
              <span className="text-xs text-slate-400">得分</span>
              <span className="text-lg font-bold text-amber-400">{score}</span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center">
            <span className="text-xs text-slate-400">状态</span>
            <span className={`text-sm font-medium ${getStatusColor()}`}>
              {getStatusText()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

export default ScoreBoard;
