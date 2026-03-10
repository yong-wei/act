'use client';

/**
 * TargetEnvelopeEditor - 目标包络绘制器
 *
 * 允许用户在画布上绘制期望的航迹包络范围
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';

export interface EnvelopePoint {
  time: number; // 时间点 (秒)
  heading: number; // 目标航向 (度)
  tolerance: number; // 允许误差 (度)
}

interface TargetEnvelopeEditorProps {
  duration: number; // 仿真总时长 (秒)
  initialHeading: number; // 初始航向
  onEnvelopeChange?: (envelope: EnvelopePoint[]) => void;
  className?: string;
}

export function TargetEnvelopeEditor({
  duration,
  initialHeading,
  onEnvelopeChange,
  className = '',
}: TargetEnvelopeEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<EnvelopePoint[]>([
    { time: 0, heading: initialHeading, tolerance: 10 },
    { time: duration, heading: initialHeading, tolerance: 10 },
  ]);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // 画布尺寸
  const width = 600;
  const height = 300;
  const padding = { top: 40, right: 40, bottom: 50, left: 60 };

  // 坐标转换
  const timeToX = useCallback(
    (time: number) => {
      return padding.left + (time / duration) * (width - padding.left - padding.right);
    },
    [duration, padding.left, padding.right, width]
  );

  const headingToY = useCallback((heading: number) => {
    // 航向范围 -180 到 180
    const normalizedHeading = ((heading + 180) % 360) - 180;
    return padding.top + ((180 - normalizedHeading) / 360) * (height - padding.top - padding.bottom);
  }, [height, padding.bottom, padding.top]);

  const xToTime = useCallback(
    (x: number) => {
      return Math.max(0, Math.min(duration, ((x - padding.left) / (width - padding.left - padding.right)) * duration));
    },
    [duration, padding.left, padding.right, width]
  );

  const yToHeading = useCallback((y: number) => {
    return 180 - ((y - padding.top) / (height - padding.top - padding.bottom)) * 360;
  }, [height, padding.bottom, padding.top]);

  // 绘制画布
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清空画布
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // 绘制网格
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;

    // 垂直网格线（时间）
    for (let t = 0; t <= duration; t += 30) {
      const x = timeToX(t);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();

      // 时间标签
      ctx.fillStyle = '#64748b';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${t}s`, x, height - padding.bottom + 15);
    }

    // 水平网格线（航向）
    for (let h = -180; h <= 180; h += 45) {
      const y = headingToY(h);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // 航向标签
      ctx.fillStyle = '#64748b';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${h}°`, padding.left - 8, y + 4);
    }

    // 绘制零度参考线
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding.left, headingToY(0));
    ctx.lineTo(width - padding.right, headingToY(0));
    ctx.stroke();

    // 绘制包络区域
    if (points.length >= 2) {
      // 上边界
      ctx.beginPath();
      ctx.moveTo(timeToX(points[0].time), headingToY(points[0].heading + points[0].tolerance));
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(timeToX(points[i].time), headingToY(points[i].heading + points[i].tolerance));
      }
      // 下边界（反向）
      for (let i = points.length - 1; i >= 0; i--) {
        ctx.lineTo(timeToX(points[i].time), headingToY(points[i].heading - points[i].tolerance));
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
      ctx.fill();

      // 目标航向线
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(timeToX(points[0].time), headingToY(points[0].heading));
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(timeToX(points[i].time), headingToY(points[i].heading));
      }
      ctx.stroke();

      // 绘制控制点
      points.forEach((point, index) => {
        const x = timeToX(point.time);
        const y = headingToY(point.heading);

        // 误差范围指示器
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, headingToY(point.heading - point.tolerance));
        ctx.lineTo(x, headingToY(point.heading + point.tolerance));
        ctx.stroke();

        // 控制点
        ctx.fillStyle = selectedPointIndex === index ? '#f59e0b' : '#fbbf24';
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();

        // 控制点边框
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 数值标签
        ctx.fillStyle = '#fff';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${point.heading.toFixed(0)}°`, x, y - 15);
      });
    }

    // 坐标轴标题
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('时间 (秒)', width / 2, height - 10);

    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('航向 (度)', 0, 0);
    ctx.restore();
  }, [
    points,
    selectedPointIndex,
    duration,
    timeToX,
    headingToY,
    height,
    width,
    padding.bottom,
    padding.left,
    padding.right,
    padding.top,
  ]);

  useEffect(() => {
    draw();
  }, [draw]);

  // 鼠标事件处理
  const handleMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 检查是否点击了控制点
    for (let i = 0; i < points.length; i++) {
      const px = timeToX(points[i].time);
      const py = headingToY(points[i].heading);
      const distance = Math.sqrt((x - px) ** 2 + (y - py) ** 2);

      if (distance < 12) {
        setSelectedPointIndex(i);
        setIsDragging(true);
        return;
      }
    }

    // 添加新控制点
    const time = xToTime(x);
    const heading = yToHeading(y);

    // 找到插入位置
    let insertIndex = points.findIndex((p) => p.time > time);
    if (insertIndex === -1) insertIndex = points.length;

    const newPoints = [...points];
    newPoints.splice(insertIndex, 0, { time, heading, tolerance: 10 });
    setPoints(newPoints);
    setSelectedPointIndex(insertIndex);
    onEnvelopeChange?.(newPoints);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || selectedPointIndex === null) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newPoints = [...points];
    const point = newPoints[selectedPointIndex];

    // 第一个和最后一个点的时间固定
    if (selectedPointIndex !== 0 && selectedPointIndex !== points.length - 1) {
      point.time = xToTime(x);
    }
    point.heading = Math.max(-180, Math.min(180, yToHeading(y)));

    // 确保点按时间排序
    newPoints.sort((a, b) => a.time - b.time);
    setSelectedPointIndex(newPoints.findIndex((p) => p === point));

    setPoints(newPoints);
    onEnvelopeChange?.(newPoints);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDeletePoint = () => {
    if (selectedPointIndex === null || selectedPointIndex === 0 || selectedPointIndex === points.length - 1) {
      return; // 不能删除首尾点
    }

    const newPoints = points.filter((_, i) => i !== selectedPointIndex);
    setPoints(newPoints);
    setSelectedPointIndex(null);
    onEnvelopeChange?.(newPoints);
  };

  const handleToleranceChange = (delta: number) => {
    if (selectedPointIndex === null) return;

    const newPoints = [...points];
    newPoints[selectedPointIndex].tolerance = Math.max(
      5,
      Math.min(45, newPoints[selectedPointIndex].tolerance + delta)
    );
    setPoints(newPoints);
    onEnvelopeChange?.(newPoints);
  };

  const presetTurnRight90 = () => {
    const newPoints: EnvelopePoint[] = [
      { time: 0, heading: initialHeading, tolerance: 10 },
      { time: 30, heading: initialHeading, tolerance: 10 },
      { time: 90, heading: initialHeading + 90, tolerance: 15 },
      { time: duration, heading: initialHeading + 90, tolerance: 10 },
    ];
    setPoints(newPoints);
    onEnvelopeChange?.(newPoints);
  };

  const presetSineWave = () => {
    const newPoints: EnvelopePoint[] = [
      { time: 0, heading: initialHeading, tolerance: 10 },
      { time: duration * 0.25, heading: initialHeading + 30, tolerance: 15 },
      { time: duration * 0.5, heading: initialHeading, tolerance: 10 },
      { time: duration * 0.75, heading: initialHeading - 30, tolerance: 15 },
      { time: duration, heading: initialHeading, tolerance: 10 },
    ];
    setPoints(newPoints);
    onEnvelopeChange?.(newPoints);
  };

  return (
    <div className={`rounded-xl border border-slate-700 bg-slate-900 p-4 ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-white">目标航迹包络</h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={presetTurnRight90}
            className="text-xs"
          >
            90°右转
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={presetSineWave}
            className="text-xs"
          >
            正弦波
          </Button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="cursor-crosshair rounded-lg"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      {selectedPointIndex !== null && (
        <div className="mt-4 flex items-center gap-4 rounded-lg bg-slate-800 p-3">
          <div className="text-sm text-slate-400">
            时间: <span className="text-white">{points[selectedPointIndex].time.toFixed(1)}s</span>
          </div>
          <div className="text-sm text-slate-400">
            航向: <span className="text-white">{points[selectedPointIndex].heading.toFixed(1)}°</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            误差带:
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleToleranceChange(-5)}
              className="h-6 w-6 p-0"
            >
              -
            </Button>
            <span className="w-8 text-center text-white">
              ±{points[selectedPointIndex].tolerance}°
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleToleranceChange(5)}
              className="h-6 w-6 p-0"
            >
              +
            </Button>
          </div>
          {selectedPointIndex !== 0 && selectedPointIndex !== points.length - 1 && (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDeletePoint}
              className="ml-auto"
            >
              删除点
            </Button>
          )}
        </div>
      )}

      <p className="mt-2 text-xs text-slate-500">
        点击画布添加控制点，拖动调整位置。选中点后可调整误差带宽度。
      </p>
    </div>
  );
}

export default TargetEnvelopeEditor;
