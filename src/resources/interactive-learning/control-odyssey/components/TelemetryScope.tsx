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
    const displayU = -shipU;
    appendTelemetry({ r: shipR, y: shipY, u: displayU, distance });
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
      
      const topPadding = 18;
      const bottomPadding = 12;
      const uAreaHeight = Math.max(22, Math.round(h * 0.22));
      const mainPlotBottom = Math.max(topPadding + 10, h - uAreaHeight - bottomPadding);
      const mainPlotHeight = Math.max(10, mainPlotBottom - topPadding);
      const uPlotTop = mainPlotBottom;
      const uPlotHeight = Math.max(12, h - bottomPadding - uPlotTop);

      // 水平中线（主图）
      ctx.beginPath();
      ctx.moveTo(0, topPadding + mainPlotHeight / 2);
      ctx.lineTo(w, topPadding + mainPlotHeight / 2);
      ctx.stroke();

      if (historyRef.current.length < 2) {
        animationId = requestAnimationFrame(render);
        return;
      }

      const distanceSpan = Math.max(maxDistance, 1);
      const signalValues = historyRef.current.flatMap((pt) => [pt.r, pt.y]);
      let minSignal = Math.min(...signalValues);
      let maxSignal = Math.max(...signalValues);
      if (!Number.isFinite(minSignal) || !Number.isFinite(maxSignal)) {
        minSignal = 0;
        maxSignal = VIEWPORT_HEIGHT;
      }
      if (maxSignal === minSignal) {
        maxSignal += 1;
        minSignal -= 1;
      }
      const range = maxSignal - minSignal;
      const padding = Math.max(10, range * 0.12);
      minSignal -= padding;
      maxSignal += padding;
      const scaleY = (val: number) =>
        topPadding + ((val - minSignal) / (maxSignal - minSignal)) * mainPlotHeight;

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

      // 3. 绘制控制量 U (底部红色实线)
      const uValues = historyRef.current.map((pt) => pt.u);
      let minU = Math.min(...uValues);
      let maxU = Math.max(...uValues);
      if (!Number.isFinite(minU) || !Number.isFinite(maxU)) {
        minU = -1;
        maxU = 1;
      }
      if (maxU === minU) {
        maxU += 1;
        minU -= 1;
      }
      const uRange = maxU - minU;
      const uPadding = Math.max(0.1, uRange * 0.18);
      minU -= uPadding;
      maxU += uPadding;
      const scaleU = (val: number) =>
        uPlotTop + ((maxU - val) / (maxU - minU)) * uPlotHeight;

      ctx.beginPath();
      ctx.strokeStyle = '#f43f5e'; // rose-500
      ctx.lineWidth = 1.5;
      historyRef.current.forEach((pt, i) => {
        const x = (pt.distance / distanceSpan) * w;
        const uY = scaleU(pt.u);
        if (i === 0) ctx.moveTo(x, uY);
        else ctx.lineTo(x, uY);
      });
      ctx.stroke();

      // 绘制 U 的零位基准线
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.2)';
      const uZero = Math.min(Math.max(scaleU(0), uPlotTop), h - bottomPadding);
      ctx.moveTo(0, uZero);
      ctx.lineTo(w, uZero);
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
        <span>给定航线R(t)</span>
        <span className="inline-flex items-center">
          <span className="inline-block w-[3em] border-t-2 border-dashed border-slate-200/70" />
        </span>
        <span>实际航线Y(t)</span>
        <span className="inline-flex items-center">
          <span className="inline-block w-[3em] h-0.5 bg-blue-500/70" />
        </span>
        <span>控制信号U(t)</span>
        <span className="inline-flex items-center">
          <span className="inline-block w-[3em] h-0.5 bg-rose-500/70" />
        </span>
      </div>
    </div>
  );
};
