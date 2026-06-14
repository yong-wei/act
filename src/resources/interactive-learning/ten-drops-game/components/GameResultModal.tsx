'use client';

/**
 * GameResultModal - 游戏结果弹窗
 *
 * 显示胜利或失败信息，提供重试和下一关选项
 */

import { memo } from 'react';
import { Trophy, RefreshCw, ChevronRight, Frown } from 'lucide-react';
import type { GameStatus } from '../types';

interface GameResultModalProps {
  /** 游戏状态 */
  status: GameStatus;
  /** 得分 */
  score: number;
  /** 剩余水滴 */
  dropsRemaining: number;
  /** 最大连锁 */
  maxChain: number;
  /** 重新开始回调 */
  onRestart: () => void;
  /** 下一关回调 */
  onNextLevel?: () => void;
  /** 是否有下一关 */
  hasNextLevel?: boolean;
  /** 教育提示（胜利时显示） */
  educationalHint?: string;
}

export const GameResultModal = memo(function GameResultModal({
  status,
  score,
  dropsRemaining,
  maxChain,
  onRestart,
  onNextLevel,
  hasNextLevel = false,
  educationalHint,
}: GameResultModalProps) {
  if (status !== 'won' && status !== 'lost') {
    return null;
  }

  const isWon = status === 'won';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className={`
          relative max-w-md w-full mx-4 p-6 rounded-2xl shadow-2xl
          ${isWon ? 'bg-gradient-to-br from-slate-800 to-slate-900' : 'bg-slate-800'}
          border ${isWon ? 'border-amber-500/30' : 'border-red-500/30'}
        `}
      >
        {/* 图标 */}
        <div className="flex justify-center mb-4">
          {isWon ? (
            <div className="p-4 rounded-full bg-amber-500/20 animate-victory-bounce">
              <Trophy className="h-12 w-12 text-amber-400" />
            </div>
          ) : (
            <div className="p-4 rounded-full bg-red-500/20">
              <Frown className="h-12 w-12 text-red-400" />
            </div>
          )}
        </div>

        {/* 标题 */}
        <h2
          className={`text-2xl font-bold text-center mb-2 ${
            isWon ? 'text-amber-400' : 'text-red-400'
          }`}
        >
          {isWon ? '恭喜通关！' : '水滴耗尽'}
        </h2>

        {/* 统计信息 */}
        {isWon ? (
          <div className="grid grid-cols-3 gap-4 my-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{score}</div>
              <div className="text-xs text-slate-400">得分</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{dropsRemaining}</div>
              <div className="text-xs text-slate-400">剩余水滴</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">{maxChain}</div>
              <div className="text-xs text-slate-400">最大连锁</div>
            </div>
          </div>
        ) : (
          <p className="text-center text-slate-300 my-4">
            再试一次，注意观察连锁反应来赚取更多水滴！
          </p>
        )}

        {/* 教育提示 */}
        {isWon && educationalHint && (
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg mb-4">
            <p className="text-sm text-blue-300">
              <span className="font-medium">💡 学习心得：</span> {educationalHint}
            </p>
          </div>
        )}

        {/* 按钮 */}
        <div className="flex gap-3 mt-6">
          <button type="button"
            onClick={onRestart}
            className={`
              flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg
              font-medium transition-all
              ${
                isWon
                  ? 'bg-slate-700 hover:bg-slate-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }
            `}
          >
            <RefreshCw className="h-4 w-4" />
            {isWon ? '再玩一次' : '重新挑战'}
          </button>

          {isWon && hasNextLevel && onNextLevel && (
            <button type="button"
              onClick={onNextLevel}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium transition-all"
            >
              下一关
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export default GameResultModal;
