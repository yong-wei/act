'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { CanvasTransform, Point2D } from './types';
import { defaultCanvasConfig } from './types';

interface MappedPlaneCanvasProps {
  transform: CanvasTransform;
  mappedPoints: Point2D[];
  windingNumber: number | null;
  onWheel: (e: WheelEvent, rect: DOMRect) => void;
  onPan: (dx: number, dy: number) => void;
}

export function MappedPlaneCanvas({
  transform,
  mappedPoints,
  windingNumber,
  onWheel,
  onPan,
}: MappedPlaneCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPanningRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  // 绘制网格
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const config = defaultCanvasConfig;
    const { x: centerX, y: centerY, scale } = transform;

    let gridSize = 1;
    if (scale < 20) gridSize = 2;
    if (scale < 10) gridSize = 5;
    if (scale > 100) gridSize = 0.5;

    ctx.strokeStyle = config.gridColor;
    ctx.lineWidth = 0.5;

    const minX = Math.floor(-centerX / scale / gridSize) * gridSize;
    const maxX = Math.ceil((width - centerX) / scale / gridSize) * gridSize;
    const minY = Math.floor((centerY - height) / scale / gridSize) * gridSize;
    const maxY = Math.ceil(centerY / scale / gridSize) * gridSize;

    for (let x = minX; x <= maxX; x += gridSize) {
      const screenX = centerX + x * scale;
      ctx.beginPath();
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, height);
      ctx.stroke();
    }

    for (let y = minY; y <= maxY; y += gridSize) {
      const screenY = centerY - y * scale;
      ctx.beginPath();
      ctx.moveTo(0, screenY);
      ctx.lineTo(width, screenY);
      ctx.stroke();
    }
  }, [transform]);

  // 绘制坐标轴
  const drawAxes = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const config = defaultCanvasConfig;
    const { x: centerX, y: centerY, scale } = transform;

    ctx.strokeStyle = config.axisColor;
    ctx.lineWidth = 1.5;

    // X轴
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Y轴
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, height);
    ctx.stroke();

    // 箭头
    const arrowSize = 8;
    ctx.beginPath();
    ctx.moveTo(width - arrowSize, centerY - arrowSize / 2);
    ctx.lineTo(width, centerY);
    ctx.lineTo(width - arrowSize, centerY + arrowSize / 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(centerX - arrowSize / 2, arrowSize);
    ctx.lineTo(centerX, 0);
    ctx.lineTo(centerX + arrowSize / 2, arrowSize);
    ctx.stroke();

    // 刻度
    ctx.fillStyle = config.axisColor;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    let tickInterval = 1;
    if (scale < 20) tickInterval = 2;
    if (scale > 100) tickInterval = 0.5;

    for (let x = -Math.floor(centerX / scale / tickInterval) * tickInterval; x <= Math.ceil((width - centerX) / scale / tickInterval) * tickInterval; x += tickInterval) {
      if (Math.abs(x) < 0.01) continue;
      const screenX = centerX + x * scale;
      ctx.fillText(x.toFixed(x % 1 === 0 ? 0 : 1), screenX, centerY + 5);
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let y = -Math.floor((height - centerY) / scale / tickInterval) * tickInterval; y <= Math.ceil(centerY / scale / tickInterval) * tickInterval; y += tickInterval) {
      if (Math.abs(y) < 0.01) continue;
      const screenY = centerY - y * scale;
      ctx.fillText(y.toFixed(y % 1 === 0 ? 0 : 1) + 'i', centerX - 5, screenY);
    }

    ctx.font = '12px sans-serif';
    ctx.fillText('Re', width - 20, centerY + 20);
    ctx.fillText('Im', centerX + 20, 15);
  }, [transform]);

  // 绘制原点标记
  const drawOriginMarker = useCallback((ctx: CanvasRenderingContext2D) => {
    const { x: centerX, y: centerY } = transform;

    // 绘制原点十字标记
    ctx.strokeStyle = '#f59e0b'; // amber-500
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);

    const size = 12;
    ctx.beginPath();
    ctx.moveTo(centerX - size, centerY);
    ctx.lineTo(centerX + size, centerY);
    ctx.moveTo(centerX, centerY - size);
    ctx.lineTo(centerX, centerY + size);
    ctx.stroke();

    ctx.setLineDash([]);

    // 绘制小圆点
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
    ctx.fill();
  }, [transform]);

  // 绘制映射曲线
  const drawMappedContour = useCallback((ctx: CanvasRenderingContext2D) => {
    if (mappedPoints.length < 2) return;

    const config = defaultCanvasConfig;
    const { x: centerX, y: centerY, scale } = transform;

    ctx.strokeStyle = config.mappedColor;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const firstPoint = mappedPoints[0];
    ctx.moveTo(centerX + firstPoint.x * scale, centerY - firstPoint.y * scale);

    for (let i = 1; i < mappedPoints.length; i++) {
      const point = mappedPoints[i];
      if (isFinite(point.x) && isFinite(point.y)) {
        ctx.lineTo(centerX + point.x * scale, centerY - point.y * scale);
      }
    }

    ctx.stroke();
  }, [transform, mappedPoints]);

  // 主绘制函数
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;

    ctx.fillStyle = defaultCanvasConfig.bgColor;
    ctx.fillRect(0, 0, width, height);

    drawGrid(ctx, width, height);
    drawAxes(ctx, width, height);
    drawOriginMarker(ctx);
    drawMappedContour(ctx);
  }, [drawGrid, drawAxes, drawOriginMarker, drawMappedContour]);

  // 初始化
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      draw();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [draw]);

  useEffect(() => {
    draw();
  }, [draw]);

  // 事件处理
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      onWheel(e, canvas.getBoundingClientRect());
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 2) {
        isPanningRef.current = true;
        lastPosRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isPanningRef.current) {
        const dx = e.clientX - lastPosRef.current.x;
        const dy = e.clientY - lastPosRef.current.y;
        onPan(dx, dy);
        lastPosRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseUp = () => {
      isPanningRef.current = false;
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    canvas.addEventListener('contextmenu', handleContextMenu);

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
      canvas.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [onWheel, onPan]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/80">
      <div className="absolute left-3 top-3 z-10 rounded-lg bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
        F(F(s)) 平面 (映射平面)
      </div>
      <div className="absolute bottom-3 left-3 z-10 rounded-lg bg-slate-900/90 px-3 py-1.5 text-xs text-slate-400 backdrop-blur-sm">
        滚轮缩放 / 右键拖动
      </div>
      {windingNumber !== null && (
        <div className="absolute right-3 top-3 z-10 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-400 backdrop-blur-sm">
          绕原点圈数: {windingNumber}
        </div>
      )}
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
