'use client';

/**
 * LevelSelector - 关卡选择组件
 *
 * 显示所有关卡，支持选择和查看难度
 */

import { memo, useEffect } from 'react';
import { X, Lock, CheckCircle, Star } from 'lucide-react';
import type { LevelConfig, Difficulty } from '../types';

interface LevelSelectorProps {
  /** 所有关卡配置 */
  levels: LevelConfig[];
  /** 当前关卡ID */
  currentLevelId: string;
  /** 已完成的关卡ID列表 */
  completedLevels?: string[];
  /** 选择关卡回调 */
  onSelect: (level: LevelConfig) => void;
  /** 关闭回调 */
  onClose: () => void;
}

/**
 * 难度配置
 */
const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; color: string; stars: number }> = {
  tutorial: { label: '教程', color: 'text-green-400 bg-green-500/20', stars: 0 },
  easy: { label: '简单', color: 'text-blue-400 bg-blue-500/20', stars: 1 },
  medium: { label: '中等', color: 'text-amber-400 bg-amber-500/20', stars: 2 },
  hard: { label: '困难', color: 'text-orange-400 bg-orange-500/20', stars: 3 },
  expert: { label: '专家', color: 'text-red-400 bg-red-500/20', stars: 4 },
};

export const LevelSelector = memo(function LevelSelector({
  levels,
  currentLevelId,
  completedLevels = [],
  onSelect,
  onClose,
}: LevelSelectorProps) {
  // 锁定背景滚动 (同时锁定 html 和 body 以兼容不同浏览器)
  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, []);

  // 检查关卡是否解锁
  const isLevelUnlocked = (level: LevelConfig, index: number): boolean => {
    // 第一关始终解锁
    if (index === 0) return true;
    // 如果前一关已完成则解锁
    const prevLevel = levels[index - 1];
    return prevLevel ? completedLevels.includes(prevLevel.id) : true;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl">
        {/* 头部 */}
        <div className="flex-none flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">选择关卡</h2>
          <button type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="关闭"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        {/* 关卡列表 */}
        <div 
          className="flex-1 min-h-0 overflow-y-auto p-4"
          style={{ overscrollBehavior: 'contain' }}
        >
          <div className="grid gap-3">
            {levels.map((level, index) => {
              const isUnlocked = isLevelUnlocked(level, index);
              const isCompleted = completedLevels.includes(level.id);
              const isCurrent = level.id === currentLevelId;
              const diffConfig = DIFFICULTY_CONFIG[level.difficulty];

              return (
                <button type="button"
                  key={level.id}
                  onClick={() => isUnlocked && onSelect(level)}
                  disabled={!isUnlocked}
                  className={`
                    relative w-full text-left p-4 rounded-xl border-2 transition-all
                    ${
                      isCurrent
                        ? 'border-blue-500 bg-blue-500/10'
                        : isUnlocked
                        ? 'border-slate-600 bg-slate-700/50 hover:border-slate-500 hover:bg-slate-700'
                        : 'border-slate-700 bg-slate-800/50 opacity-60 cursor-not-allowed'
                    }
                  `}
                >
                  <div className="flex items-start justify-between">
                    {/* 关卡信息 */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-slate-400">
                          关卡 {index + 1}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${diffConfig.color}`}
                        >
                          {diffConfig.label}
                        </span>
                        {isCompleted && (
                          <CheckCircle className="h-4 w-4 text-green-400" />
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-1">
                        {level.name}
                      </h3>
                      <p className="text-sm text-slate-400 line-clamp-2">
                        {level.description}
                      </p>

                      {/* 关卡参数 */}
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        <span>
                          {level.gridSize.rows}×{level.gridSize.cols} 棋盘
                        </span>
                        <span>{level.initialDrops} 初始水滴</span>
                      </div>
                    </div>

                    {/* 难度星级 / 锁定图标 */}
                    <div className="ml-4">
                      {isUnlocked ? (
                        <div className="flex gap-0.5">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < diffConfig.stars
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-slate-600'
                              }`}
                            />
                          ))}
                        </div>
                      ) : (
                        <Lock className="h-6 w-6 text-slate-500" />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});

export default LevelSelector;
