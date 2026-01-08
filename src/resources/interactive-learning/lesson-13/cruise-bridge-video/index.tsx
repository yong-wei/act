'use client';

/**
 * CruiseBridgeVideo - 邮轮导入视频组件
 *
 * 用途：BOPPPS 教学流程的 Bridge-in 阶段
 * 功能：分屏对比快艇与邮轮的舒适度差异
 * - 左侧：快艇场景（CSS 颠簸动画）
 * - 右侧：邮轮宴会场景（稳定）
 * - AI 旁白文字叠加
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Ship,
  Sailboat,
  Wine,
  AlertTriangle,
  Play,
  Volume2,
  VolumeX,
  ChevronRight,
} from 'lucide-react';

export interface CruiseBridgeVideoProps {
  /** 自动播放 */
  autoPlay?: boolean;
  /** 播放时长（秒）*/
  duration?: number;
  /** 完成回调 */
  onComplete?: () => void;
  /** 是否显示完成按钮 */
  showCompleteButton?: boolean;
  /** AI 旁白文字 */
  narration?: string;
}

// 默认 AI 旁白
const DEFAULT_NARRATION =
  '控制不仅是让机器动起来，更是为了"人"的尊严。在豪华邮轮上，乘客的舒适体验是控制系统设计的第一要务。';

export function CruiseBridgeVideo({
  autoPlay = true,
  duration = 10,
  onComplete,
  showCompleteButton = true,
  narration = DEFAULT_NARRATION,
}: CruiseBridgeVideoProps) {
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [progress, setProgress] = useState(0);
  const [showNarration, setShowNarration] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 播放进度控制
  useEffect(() => {
    if (!isPlaying) return;

    // 延迟显示旁白
    const narrationTimer = setTimeout(() => {
      setShowNarration(true);
    }, 1500);

    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 100 / (duration * 10);
        if (next >= 100) {
          clearInterval(intervalRef.current!);
          return 100;
        }
        return next;
      });
    }, 100);

    return () => {
      clearTimeout(narrationTimer);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, duration]);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const handleComplete = useCallback(() => {
    onComplete?.();
  }, [onComplete]);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950">
      {/* 分屏容器 */}
      <div className="flex h-full">
        {/* 左侧：快艇场景 */}
        <div className="relative w-1/2 border-r border-slate-700 overflow-hidden">
          <SpeedboatScene isPlaying={isPlaying} />
          <div className="absolute bottom-4 left-4 z-20">
            <div className="rounded-lg bg-red-500/20 px-3 py-1.5 backdrop-blur-sm border border-red-500/30">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">快艇 · 剧烈颠簸</span>
              </div>
            </div>
          </div>
        </div>

        {/* 右侧：邮轮宴会场景 */}
        <div className="relative w-1/2 overflow-hidden">
          <CruiseBanquetScene isPlaying={isPlaying} />
          <div className="absolute bottom-4 right-4 z-20">
            <div className="rounded-lg bg-emerald-500/20 px-3 py-1.5 backdrop-blur-sm border border-emerald-500/30">
              <div className="flex items-center gap-2 text-emerald-400">
                <Ship className="h-4 w-4" />
                <span className="text-sm font-medium">邮轮 · 稳如平地</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI 旁白叠加层 */}
      {showNarration && (
        <div className="absolute bottom-20 left-1/2 z-30 -translate-x-1/2 max-w-2xl">
          <div className="animate-fadeIn rounded-xl bg-slate-900/95 p-4 shadow-2xl border border-sky-500/30 backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 rounded-full bg-sky-500/20 p-2">
                <Volume2 className="h-5 w-5 text-sky-400" />
              </div>
              <div>
                <p className="text-sm text-sky-400 font-medium mb-1">AI 旁白</p>
                <p className="text-white leading-relaxed">{narration}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 进度条 */}
      {isPlaying && (
        <div className="absolute bottom-0 left-0 right-0 z-40">
          <div className="h-1 bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* 控制栏 */}
      <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
        <button
          onClick={handleToggleMute}
          className="rounded-full bg-slate-800/80 p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors backdrop-blur-sm"
        >
          {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </div>

      {/* 开始播放按钮（未自动播放时） */}
      {!isPlaying && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
          <button
            onClick={handlePlay}
            className="flex items-center gap-3 rounded-2xl bg-sky-600 px-8 py-4 text-lg font-medium text-white shadow-lg hover:bg-sky-500 transition-all hover:scale-105"
          >
            <Play className="h-6 w-6" />
            开始观看
          </button>
        </div>
      )}

      {/* 完成按钮 */}
      {showCompleteButton && progress >= 100 && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 animate-fadeIn">
          <button
            onClick={handleComplete}
            className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-8 py-4 text-lg font-medium text-white shadow-lg hover:bg-emerald-500 transition-all hover:scale-105"
          >
            继续下一步
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* 标题 */}
      <div className="absolute top-4 left-1/2 z-30 -translate-x-1/2">
        <div className="rounded-full bg-slate-900/90 px-6 py-2 backdrop-blur-sm border border-slate-700">
          <h2 className="text-lg font-bold text-white">
            🚤 快艇 vs 🛳️ 邮轮：舒适度的天壤之别
          </h2>
        </div>
      </div>
    </div>
  );
}

/**
 * 快艇场景组件 - 模拟颠簸效果
 */
function SpeedboatScene({ isPlaying }: { isPlaying: boolean }) {
  return (
    <div
      className={`relative h-full w-full bg-gradient-to-b from-sky-800 to-slate-900 ${
        isPlaying ? 'animate-shake' : ''
      }`}
    >
      {/* 水面 */}
      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-blue-900 to-blue-700 overflow-hidden">
        {/* 波浪效果 */}
        <div className="absolute inset-0 opacity-50">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="absolute h-8 w-full bg-gradient-to-r from-transparent via-blue-500/30 to-transparent"
              style={{
                top: `${20 + i * 15}%`,
                animation: `wave ${2 + i * 0.3}s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* 快艇图标 */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className={`${isPlaying ? 'animate-boat-shake' : ''}`}>
          <Sailboat className="h-32 w-32 text-slate-300 drop-shadow-lg" />
        </div>
      </div>

      {/* 乘客反应 - 文字提示 */}
      <div className="absolute left-1/2 top-1/4 -translate-x-1/2 text-center">
        <p className={`text-4xl ${isPlaying ? 'animate-pulse' : ''}`}>😱</p>
        <p className="mt-2 text-sm text-red-300">乘客尖叫！</p>
      </div>

      {/* 浪花喷溅 */}
      {isPlaying && (
        <div className="absolute left-1/4 top-1/2 -translate-y-1/2">
          <div className="animate-splash">
            💦
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 邮轮宴会场景组件 - 稳定平静
 */
function CruiseBanquetScene({ isPlaying }: { isPlaying: boolean }) {
  return (
    <div className="relative h-full w-full bg-gradient-to-b from-amber-900/30 to-slate-900">
      {/* 宴会厅背景 */}
      <div className="absolute inset-0 bg-gradient-to-b from-amber-950/50 to-slate-950">
        {/* 吊灯效果 */}
        <div className="absolute left-1/4 top-10 h-20 w-1 bg-gradient-to-b from-amber-300 to-transparent opacity-60" />
        <div className="absolute left-3/4 top-10 h-20 w-1 bg-gradient-to-b from-amber-300 to-transparent opacity-60" />
        <div className="absolute left-1/4 top-8 h-4 w-4 rounded-full bg-amber-300/80 shadow-lg shadow-amber-300/50 animate-glow" />
        <div className="absolute left-3/4 top-8 h-4 w-4 rounded-full bg-amber-300/80 shadow-lg shadow-amber-300/50 animate-glow" />
      </div>

      {/* 红酒杯 - 纹丝不动 */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="flex items-end gap-8">
          <div className="text-center">
            <Wine className="h-20 w-20 text-rose-400 drop-shadow-lg" />
            <p className="mt-2 text-xs text-amber-200">红酒杯</p>
          </div>
          <div className="text-center">
            <div className="flex flex-col items-center">
              {/* 香槟塔简化表示 */}
              <div className="grid grid-cols-3 gap-0.5">
                <div className="h-4 w-4 rounded-full bg-amber-300/40" />
                <div className="h-4 w-4 rounded-full bg-amber-300/60" />
                <div className="h-4 w-4 rounded-full bg-amber-300/40" />
              </div>
              <div className="grid grid-cols-4 gap-0.5 mt-0.5">
                <div className="h-4 w-4 rounded-full bg-amber-300/50" />
                <div className="h-4 w-4 rounded-full bg-amber-300/70" />
                <div className="h-4 w-4 rounded-full bg-amber-300/70" />
                <div className="h-4 w-4 rounded-full bg-amber-300/50" />
              </div>
              <div className="grid grid-cols-5 gap-0.5 mt-0.5">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-4 w-4 rounded-full bg-amber-300/60" />
                ))}
              </div>
            </div>
            <p className="mt-2 text-xs text-amber-200">香槟塔</p>
          </div>
          <div className="text-center">
            <Wine className="h-20 w-20 text-rose-400 drop-shadow-lg" />
            <p className="mt-2 text-xs text-amber-200">红酒杯</p>
          </div>
        </div>
      </div>

      {/* 稳定提示 */}
      <div className="absolute left-1/2 top-1/4 -translate-x-1/2 text-center">
        <p className="text-4xl">🎻</p>
        <p className="mt-2 text-sm text-amber-200">小提琴悠扬演奏</p>
      </div>

      {/* 乘客反应 */}
      <div className="absolute right-8 bottom-1/3 text-center">
        <p className="text-3xl">😌</p>
        <p className="mt-1 text-xs text-amber-200">宾客惬意</p>
      </div>

      {/* 稳定状态指示器 */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <div className="flex items-center gap-2 rounded-full bg-emerald-500/20 px-4 py-2 border border-emerald-500/30">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-emerald-300">侧向加速度: 0.02g</span>
        </div>
      </div>
    </div>
  );
}

export default CruiseBridgeVideo;
