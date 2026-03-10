'use client';

/**
 * ChampagneTowerPIP - 香槟塔画中画组件
 *
 * 显示在仿真界面角落的小窗口，实时展示香槟塔的摇晃状态。
 * 使用简化的2D可视化表示香槟塔的倾斜角度。
 */

import { useEffect, useRef } from 'react';
import { Wine, AlertTriangle, Sparkles } from 'lucide-react';
import type { ChampagneTowerState } from '../types';
import { getChampagneTowerVisuals } from './hooks/useChampagneTower';

interface ChampagneTowerPIPProps {
  state: ChampagneTowerState;
  /** 是否最小化 */
  minimized?: boolean;
  /** 位置 */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** 点击回调 */
  onClick?: () => void;
}

export function ChampagneTowerPIP({
  state,
  minimized = false,
  position = 'top-right',
  onClick,
}: ChampagneTowerPIPProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visuals = getChampagneTowerVisuals(state);

  // 位置样式
  const positionStyles: Record<string, string> = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  };

  // 绘制香槟塔
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || minimized) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height - 20;

    // 清空画布
    ctx.clearRect(0, 0, width, height);

    // 保存状态
    ctx.save();

    // 移动到底部中心并旋转
    ctx.translate(centerX, centerY);
    ctx.rotate(state.angle);

    // 绘制底座
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // 绘制香槟塔层次（从下到上，逐渐变小）
    const layers = [
      { y: -5, radius: 25, glasses: 4 },
      { y: -25, radius: 20, glasses: 3 },
      { y: -45, radius: 15, glasses: 2 },
      { y: -60, radius: 8, glasses: 1 },
    ];

    layers.forEach((layer) => {
      // 层底座
      ctx.fillStyle = state.isFalling ? '#fecaca' : '#e2e8f0';
      ctx.beginPath();
      ctx.ellipse(0, layer.y, layer.radius, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // 酒杯
      const glassColor = state.isFalling ? '#f87171' : '#fcd34d';
      const glassWidth = layer.radius / layer.glasses;

      for (let i = 0; i < layer.glasses; i++) {
        const x = (i - (layer.glasses - 1) / 2) * glassWidth * 1.5;

        // 杯身
        ctx.fillStyle = glassColor;
        ctx.beginPath();
        ctx.moveTo(x - 4, layer.y - 2);
        ctx.lineTo(x - 6, layer.y - 12);
        ctx.lineTo(x + 6, layer.y - 12);
        ctx.lineTo(x + 4, layer.y - 2);
        ctx.closePath();
        ctx.fill();

        // 杯口高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.ellipse(x, layer.y - 12, 5, 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // 恢复状态
    ctx.restore();

    // 如果正在倒塌，添加碎片效果
    if (state.isFalling) {
      ctx.fillStyle = '#fcd34d';
      for (let i = 0; i < 10; i++) {
        const x = centerX + (Math.random() - 0.5) * 60;
        const y = height - 30 - Math.random() * 40;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // 倒塌文字
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💥 倒塌!', centerX, 20);
    }
  }, [state, minimized]);

  if (minimized) {
    return (
      <button
        onClick={onClick}
        className={`absolute ${positionStyles[position]} z-50 p-2 rounded-full transition-all ${
          state.isFalling
            ? 'bg-red-500 animate-pulse'
            : state.stability < 0.5
            ? 'bg-amber-500'
            : 'bg-slate-700'
        }`}
      >
        <Wine className="h-5 w-5 text-white" />
      </button>
    );
  }

  return (
    <div
      className={`absolute ${positionStyles[position]} z-50 transition-all`}
      onClick={onClick}
    >
      <div
        className={`rounded-lg overflow-hidden shadow-lg border-2 transition-colors ${
          state.isFalling
            ? 'border-red-500 bg-red-900/90'
            : state.stability < 0.3
            ? 'border-amber-500 bg-amber-900/90'
            : state.stability < 0.6
            ? 'border-yellow-500 bg-slate-900/90'
            : 'border-emerald-500 bg-slate-900/90'
        }`}
      >
        {/* 标题栏 */}
        <div
          className={`flex items-center justify-between px-3 py-1.5 text-xs font-medium ${
            state.isFalling
              ? 'bg-red-500 text-white'
              : state.stability < 0.5
              ? 'bg-amber-500 text-white'
              : 'bg-slate-800 text-slate-300'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Wine className="h-3.5 w-3.5" />
            <span>香槟塔监控</span>
          </div>
          {state.isFalling && (
            <AlertTriangle className="h-3.5 w-3.5 animate-pulse" />
          )}
          {!state.isFalling && state.stability > 0.8 && (
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          )}
        </div>

        {/* 画布 */}
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={120}
            height={100}
            className="block"
          />

          {/* 角度指示器 */}
          <div className="absolute bottom-1 left-1 right-1 flex justify-between items-center text-[10px]">
            <span className="text-slate-500">-5°</span>
            <div
              className={`px-1.5 py-0.5 rounded text-xs font-mono ${
                state.isFalling
                  ? 'bg-red-500 text-white'
                  : Math.abs(visuals.angleDeg) > 3
                  ? 'bg-amber-500 text-white'
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              {visuals.angleDeg.toFixed(1)}°
            </div>
            <span className="text-slate-500">+5°</span>
          </div>
        </div>

        {/* 状态栏 */}
        <div className="px-3 py-1.5 border-t border-slate-700">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">稳定性</span>
            <span
              className="font-medium"
              style={{ color: visuals.statusColor }}
            >
              {visuals.statusText} ({visuals.stabilityPercent}%)
            </span>
          </div>
          {/* 稳定性进度条 */}
          <div className="mt-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${visuals.stabilityPercent}%`,
                backgroundColor: visuals.statusColor,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChampagneTowerPIP;
