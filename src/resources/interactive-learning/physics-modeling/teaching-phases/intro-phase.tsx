'use client';

/**
 * 阶段一：导入与拆解
 * Phase 1: Introduction & Decomposition
 *
 * 时长: 0-10 分钟
 * 目标: 让学生直观感受惯性、阻力和弹性对动态过程的影响
 */

import { useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, ChevronRight, Ship, Waves } from 'lucide-react';

interface IntroPhaseProps {
  seaState: number;
  onSeaStateChange: (level: number) => void;
  onComplete: () => void;
  aiMessage?: string;
}

export function IntroPhase({
  seaState,
  onSeaStateChange,
  onComplete,
  aiMessage,
}: IntroPhaseProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showDecompose, setShowDecompose] = useState(false);

  const handlePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleDecompose = useCallback(() => {
    setShowDecompose(true);
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* 标题区 */}
      <div className="border-b border-slate-800 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20 text-amber-500">
            <Ship className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">阶段一：看见看不见的力</h2>
            <p className="text-sm text-slate-400">
              透视舵机的物理骨架，感受惯性、阻力和弹性
            </p>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex flex-1 gap-6 p-6">
        {/* 左侧：3D 视图占位 */}
        <div className="flex-1 rounded-2xl border border-slate-700 bg-slate-900/50 p-4">
          <div className="relative h-full w-full overflow-hidden rounded-xl bg-gradient-to-b from-slate-800 to-slate-900">
            {/* 占位图：舵机示意 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 h-48 w-48 rounded-2xl bg-slate-800/50 p-8">
                  {/* 简化的舵机示意图 */}
                  <svg viewBox="0 0 100 100" className="h-full w-full">
                    {/* 舵叶 */}
                    <rect
                      x="40"
                      y="20"
                      width="20"
                      height="60"
                      rx="4"
                      fill="#f59e0b"
                      opacity={isPlaying ? '1' : '0.5'}
                      className={isPlaying ? 'animate-pulse' : ''}
                    />
                    {/* 舵轴 */}
                    <circle cx="50" cy="50" r="8" fill="#64748b" />
                    {/* 液压缸 */}
                    <rect x="15" y="45" width="20" height="10" rx="2" fill="#3b82f6" />
                    <rect x="65" y="45" width="20" height="10" rx="2" fill="#3b82f6" />
                    {/* 海水波纹 */}
                    <path
                      d={`M10 85 Q25 ${80 - seaState} 40 85 T70 85 T100 85`}
                      stroke="#06b6d4"
                      strokeWidth="2"
                      fill="none"
                      opacity="0.5"
                    />
                  </svg>
                </div>
                <p className="text-slate-400">
                  {showDecompose
                    ? '🔧 拆解模式：查看内部结构'
                    : '052D 驱逐舰舵机系统'}
                </p>
              </div>
            </div>

            {/* 海况指示 */}
            <div className="absolute left-4 top-4 rounded-lg bg-slate-800/80 px-3 py-2 backdrop-blur">
              <div className="flex items-center gap-2 text-sm">
                <Waves className="h-4 w-4 text-cyan-500" />
                <span className="text-slate-400">海况等级:</span>
                <span className="font-mono text-cyan-500">{seaState}</span>
              </div>
            </div>

            {/* 播放控制 */}
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
              <button
                onClick={handlePlay}
                className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-amber-400"
              >
                {isPlaying ? (
                  <>
                    <Pause className="h-4 w-4" />
                    暂停
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    播放
                  </>
                )}
              </button>
              <button
                onClick={() => setIsPlaying(false)}
                className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-600"
              >
                <RotateCcw className="h-4 w-4" />
                重置
              </button>
            </div>
          </div>
        </div>

        {/* 右侧：控制面板 */}
        <div className="w-80 space-y-4">
          {/* 海况控制 */}
          <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
            <h3 className="mb-3 text-sm font-medium text-slate-300">海况调节</h3>
            <input
              type="range"
              min="1"
              max="9"
              value={seaState}
              onChange={(e) => onSeaStateChange(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
            <div className="mt-2 flex justify-between text-xs text-slate-500">
              <span>1级 (平静)</span>
              <span>9级 (狂暴)</span>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              {seaState <= 3
                ? '🌊 平静海面，舵机响应良好'
                : seaState <= 6
                  ? '💨 中等海况，注意舵角滞后'
                  : '🌀 恶劣海况，舵机难以回中！'}
            </p>
          </div>

          {/* 拆解按钮 */}
          <button
            onClick={handleDecompose}
            className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-left transition-colors hover:bg-amber-500/20"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-amber-500">🔧 拆解模式</h3>
                <p className="mt-1 text-xs text-slate-400">
                  透视舵机内部，理解物理结构
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-amber-500" />
            </div>
          </button>

          {/* AI 提示 */}
          {aiMessage && (
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
                  🤖
                </div>
                <div>
                  <p className="text-xs font-medium text-blue-400">建模导师</p>
                  <p className="mt-1 text-sm text-slate-300">{aiMessage}</p>
                </div>
              </div>
            </div>
          )}

          {/* 继续按钮 */}
          <button
            onClick={onComplete}
            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 font-medium text-slate-900 transition-all hover:from-amber-400 hover:to-orange-400"
          >
            进入物理工坊 →
          </button>
        </div>
      </div>
    </div>
  );
}
