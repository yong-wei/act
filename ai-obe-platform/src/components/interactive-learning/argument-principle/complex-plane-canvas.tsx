'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { CanvasTransform, ComplexNumber, Point2D } from './types';
import { defaultCanvasConfig } from './types';

interface ComplexPlaneCanvasProps {
  transform: CanvasTransform;
  zeros: ComplexNumber[];
  poles: ComplexNumber[];
  contourPoints: Point2D[];
  isManualMode: boolean;
  onWheel: (e: WheelEvent, rect: DOMRect) => void;
  onPan: (dx: number, dy: number) => void;
  onDrawStart: (x: number, y: number) => void;
  onDrawContinue: (x: number, y: number) => void;
  onDrawEnd: () => void;
}

export function ComplexPlaneCanvas({
  transform,
  zeros,
  poles,
  contourPoints,
  isManualMode,
  onWheel,
  onPan,
  onDrawStart,
  onDrawContinue,
  onDrawEnd,
}: ComplexPlaneCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPanningRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  // 绘制网格
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const config = defaultCanvasConfig;
    const { x: centerX, y: centerY, scale } = transform;

    // 计算网格间距
    let gridSize = 1;
    if (scale < 20) gridSize = 2;
    if (scale < 10) gridSize = 5;
    if (scale > 100) gridSize = 0.5;
    if (scale > 200) gridSize = 0.2;

    ctx.strokeStyle = config.gridColor;
    ctx.lineWidth = 0.5;

    // 计算可见范围
    const minX = Math.floor(-centerX / scale / gridSize) * gridSize;
    const maxX = Math.ceil((width - centerX) / scale / gridSize) * gridSize;
    const minY = Math.floor((centerY - height) / scale / gridSize) * gridSize;
    const maxY = Math.ceil(centerY / scale / gridSize) * gridSize;

    // 绘制垂直线
    for (let x = minX; x <= maxX; x += gridSize) {
      const screenX = centerX + x * scale;
      ctx.beginPath();
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, height);
      ctx.stroke();
    }

    // 绘制水平线
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

    // 绘制箭头
    const arrowSize = 8;

    // X轴箭头
    ctx.beginPath();
    ctx.moveTo(width - arrowSize, centerY - arrowSize / 2);
    ctx.lineTo(width, centerY);
    ctx.lineTo(width - arrowSize, centerY + arrowSize / 2);
    ctx.stroke();

    // Y轴箭头
    ctx.beginPath();
    ctx.moveTo(centerX - arrowSize / 2, arrowSize);
    ctx.lineTo(centerX, 0);
    ctx.lineTo(centerX + arrowSize / 2, arrowSize);
    ctx.stroke();

    // 绘制刻度标签
    ctx.fillStyle = config.axisColor;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // X轴刻度
    let tickInterval = 1;
    if (scale < 20) tickInterval = 2;
    if (scale > 100) tickInterval = 0.5;

    for (let x = -Math.floor(centerX / scale / tickInterval) * tickInterval; x <= Math.ceil((width - centerX) / scale / tickInterval) * tickInterval; x += tickInterval) {
      if (Math.abs(x) < 0.01) continue;
      const screenX = centerX + x * scale;
      ctx.fillText(x.toFixed(x % 1 === 0 ? 0 : 1), screenX, centerY + 5);
    }

    // Y轴刻度
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let y = -Math.floor((height - centerY) / scale / tickInterval) * tickInterval; y <= Math.ceil(centerY / scale / tickInterval) * tickInterval; y += tickInterval) {
      if (Math.abs(y) < 0.01) continue;
      const screenY = centerY - y * scale;
      ctx.fillText(y.toFixed(y % 1 === 0 ? 0 : 1) + 'i', centerX - 5, screenY);
    }

    // 轴标签
    ctx.font = '12px sans-serif';
    ctx.fillText('Re', width - 20, centerY + 20);
    ctx.fillText('Im', centerX + 20, 15);
  }, [transform]);

  // 绘制零点和极点
  const drawPolesAndZeros = useCallback((ctx: CanvasRenderingContext2D) => {
    const config = defaultCanvasConfig;
    const { x: centerX, y: centerY, scale } = transform;

    // 绘制零点 (绿色圆圈)
    ctx.strokeStyle = config.zeroColor;
    ctx.lineWidth = 2;
    zeros.forEach((zero) => {
      const screenX = centerX + zero.re * scale;
      const screenY = centerY - zero.im * scale;
      ctx.beginPath();
      ctx.arc(screenX, screenY, 6, 0, Math.PI * 2);
      ctx.stroke();
    });

    // 绘制极点 (红色叉号)
    ctx.strokeStyle = config.poleColor;
    ctx.lineWidth = 2;
    poles.forEach((pole) => {
      const screenX = centerX + pole.re * scale;
      const screenY = centerY - pole.im * scale;
      const size = 6;
      ctx.beginPath();
      ctx.moveTo(screenX - size, screenY - size);
      ctx.lineTo(screenX + size, screenY + size);
      ctx.moveTo(screenX + size, screenY - size);
      ctx.lineTo(screenX - size, screenY + size);
      ctx.stroke();
    });
  }, [transform, zeros, poles]);

  // 绘制轮廓线
  const drawContour = useCallback((ctx: CanvasRenderingContext2D) => {
    if (contourPoints.length < 2) return;

    const config = defaultCanvasConfig;
    const { x: centerX, y: centerY, scale } = transform;

    ctx.strokeStyle = config.contourColor;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const firstPoint = contourPoints[0];
    ctx.moveTo(centerX + firstPoint.x * scale, centerY - firstPoint.y * scale);

    for (let i = 1; i < contourPoints.length; i++) {
      const point = contourPoints[i];
      ctx.lineTo(centerX + point.x * scale, centerY - point.y * scale);
    }

    ctx.stroke();
  }, [transform, contourPoints]);

  // 主绘制函数
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;

    // 清除画布
    ctx.fillStyle = defaultCanvasConfig.bgColor;
    ctx.fillRect(0, 0, width, height);

    // 绘制各层
    drawGrid(ctx, width, height);
    drawAxes(ctx, width, height);
    drawPolesAndZeros(ctx);
    drawContour(ctx);
  }, [drawGrid, drawAxes, drawPolesAndZeros, drawContour]);

  // 初始化画布尺寸
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

  // 重绘
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
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (e.button === 2) {
        // 右键拖动
        isPanningRef.current = true;
        lastPosRef.current = { x: e.clientX, y: e.clientY };
      } else if (e.button === 0 && isManualMode) {
        // 左键绘制
        onDrawStart(x, y);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isPanningRef.current) {
        const dx = e.clientX - lastPosRef.current.x;
        const dy = e.clientY - lastPosRef.current.y;
        onPan(dx, dy);
        lastPosRef.current = { x: e.clientX, y: e.clientY };
      } else if (isManualMode) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        onDrawContinue(x, y);
      }
    };

    const handleMouseUp = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
      }
      onDrawEnd();
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
  }, [isManualMode, onWheel, onPan, onDrawStart, onDrawContinue, onDrawEnd]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/80">
      <div className="absolute left-3 top-3 z-10 rounded-lg bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
        F(s) 平面 (源平面)
      </div>
      <div className="absolute bottom-3 left-3 z-10 rounded-lg bg-slate-900/90 px-3 py-1.5 text-xs text-slate-400 backdrop-blur-sm">
        {isManualMode ? '左键绘制' : '滚轮缩放'} / 右键拖动
      </div>
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
