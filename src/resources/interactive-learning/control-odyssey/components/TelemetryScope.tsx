'use client';

import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../store/game-store';
import { VIEWPORT_HEIGHT } from '../engine/level-generator';
import { appendTelemetry, clearTelemetry, getTelemetryHistory } from '../engine/telemetry-history';

interface TelemetryScopeProps {
  height?: number;
}

export const TelemetryScope: React.FC<TelemetryScopeProps> = ({ height = 100 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const historyRef = useRef(getTelemetryHistory());

  // 订阅高频变化
  const shipY = useGameStore(state => state.shipY);
  const shipU = useGameStore(state => state.shipU);
  const shipR = useGameStore(state => state.shipR); // 期望值 (暂时没在 store 里充分利用，先预留)
  const gameState = useGameStore(state => state.gameState);
  const distance = useGameStore(state => state.distance);
  const maxDistance = useGameStore(state => state.maxDistance);

  useEffect(() => {
    if (gameState !== 'RUNNING') return;

    // 推入新数据
    appendTelemetry({ r: shipR, y: shipY, u: shipU, distance });
  }, [shipY, shipU, shipR, distance, gameState]);

  // 监听重置，清空曲线
  useEffect(() => {
    if (gameState === 'IDLE') {
      clearTelemetry();
    }
  }, [gameState]);

  // 渲染循环
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置 Canvas 尺寸
    // 这里简单处理，实际可能需要 ResizeObserver
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = height;
    }

    let animationId: number;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // 背景网格
      ctx.fillStyle = '#020617'; // slate-950
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#1e293b'; // slate-800
      ctx.lineWidth = 1;
      
      // 水平中线
      ctx.beginPath();
      ctx.moveTo(0, h/2);
      ctx.lineTo(w, h/2);
      ctx.stroke();

      if (historyRef.current.length < 2) {
        animationId = requestAnimationFrame(render);
        return;
      }

      const distanceSpan = Math.max(maxDistance, 1);

      // 1. 绘制期望值 R (白色虚线)
      // 需要将 VIEWPORT_HEIGHT (0-400) 映射到 Canvas 高度 (0-100)
      // 注意：游戏坐标 Y=0 在上，Canvas 坐标 Y=0 也在上。
      // 但通常波形图 Y 轴向上为正？这里保持屏幕坐标系直观对应：
      // 游戏中船在上面，波形图也在上面。
      const scaleY = (val: number) => (val / VIEWPORT_HEIGHT) * h;

      ctx.beginPath();
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.9)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      historyRef.current.forEach((pt, i) => {
        const x = (pt.distance / distanceSpan) * w;
        const y = scaleY(pt.r); // 假设 R 也是屏幕坐标
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 1;

      // 2. 绘制实际输出 Y (蓝色实线)
      ctx.beginPath();
      ctx.strokeStyle = '#3b82f6'; // blue-500
      ctx.lineWidth = 2;
      historyRef.current.forEach((pt, i) => {
        const x = (pt.distance / distanceSpan) * w;
        const y = scaleY(pt.y);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // 3. 绘制控制量 U (底部红色/绿色实线)
      // U 是 -1 到 1
      ctx.beginPath();
      ctx.strokeStyle = '#f43f5e'; // rose-500
      ctx.lineWidth = 1.5;
      historyRef.current.forEach((pt, i) => {
        const x = (pt.distance / distanceSpan) * w;
        // 将 U (-1 到 1) 映射到绘图区域 (底部 30px 范围)
        const uY = h - 20 - (pt.u * 15);
        if (i === 0) ctx.moveTo(x, uY);
        else ctx.lineTo(x, uY);
      });
      ctx.stroke();

      // 绘制 U 的零位基准线
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.2)';
      ctx.moveTo(0, h - 20);
      ctx.lineTo(w, h - 20);
      ctx.stroke();

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationId);
  }, [height, maxDistance]);

  // 暴露一个方法供外部清空
  useEffect(() => {
    const handleClear = () => {
      clearTelemetry();
    };
    window.addEventListener('control-odyssey-clear-scope', handleClear);
    return () => window.removeEventListener('control-odyssey-clear-scope', handleClear);
  }, []);

  return (
    <div className="w-full relative border-t border-slate-800 bg-slate-950/80">
      <canvas ref={canvasRef} className="block w-full" style={{ height }} />
      <div className="absolute top-1 left-2 text-[10px] text-slate-400 font-mono pointer-events-none flex items-center gap-2">
        <span>图例：给定航线 R(t)</span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 border border-slate-200/60" />
          <span>亮白虚线</span>
        </span>
        <span>系统响应 Y(t)</span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 bg-blue-500/70" />
          <span>蓝色实线</span>
        </span>
        <span>控制信号 U(t)</span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 bg-rose-500/70" />
          <span>红色</span>
        </span>
      </div>
    </div>
  );
};
