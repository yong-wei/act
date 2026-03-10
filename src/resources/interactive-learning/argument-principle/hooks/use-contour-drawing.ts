import { useState, useCallback, useRef } from 'react';
import type { Point2D, ContourType, ContourParams } from '../types';

interface UseContourDrawingOptions {
  screenToWorld: (x: number, y: number) => Point2D;
}

export function useContourDrawing({ screenToWorld }: UseContourDrawingOptions) {
  const [worldPoints, setWorldPoints] = useState<Point2D[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [contourParams, setContourParams] = useState<ContourParams>({
    type: 'circle',
    radius: 2,
    width: 2,
    height: 2,
  });

  const lastPointRef = useRef<Point2D | null>(null);

  // 生成圆形轮廓点
  const generateCircleContour = useCallback((radius: number, numPoints = 200): Point2D[] => {
    const points: Point2D[] = [];
    for (let i = 0; i <= numPoints; i++) {
      const angle = (2 * Math.PI * i) / numPoints;
      points.push({
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
      });
    }
    return points;
  }, []);

  // 生成半圆延直线轮廓点 (Nyquist轮廓)
  const generateSemicircleContour = useCallback((radius: number, numPoints = 200): Point2D[] => {
    const points: Point2D[] = [];
    const halfPoints = Math.floor(numPoints / 2);

    // 沿虚轴从 -R*i 到 +R*i
    for (let i = 0; i <= halfPoints; i++) {
      const y = -radius + (2 * radius * i) / halfPoints;
      points.push({ x: 0.001, y }); // 稍微偏离虚轴
    }

    // 右半平面的半圆
    for (let i = 1; i < halfPoints; i++) {
      const angle = Math.PI / 2 - (Math.PI * i) / halfPoints;
      points.push({
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
      });
    }

    // 闭合回到起点
    points.push(points[0]);

    return points;
  }, []);

  // 生成矩形轮廓点
  const generateRectangleContour = useCallback(
    (width: number, height: number, numPoints = 200): Point2D[] => {
      const points: Point2D[] = [];
      const perSide = Math.floor(numPoints / 4);

      // 底边 (从左到右)
      for (let i = 0; i <= perSide; i++) {
        points.push({
          x: -width / 2 + (width * i) / perSide,
          y: -height / 2,
        });
      }

      // 右边 (从下到上)
      for (let i = 1; i <= perSide; i++) {
        points.push({
          x: width / 2,
          y: -height / 2 + (height * i) / perSide,
        });
      }

      // 顶边 (从右到左)
      for (let i = 1; i <= perSide; i++) {
        points.push({
          x: width / 2 - (width * i) / perSide,
          y: height / 2,
        });
      }

      // 左边 (从上到下)
      for (let i = 1; i < perSide; i++) {
        points.push({
          x: -width / 2,
          y: height / 2 - (height * i) / perSide,
        });
      }

      // 闭合
      points.push(points[0]);

      return points;
    },
    []
  );

  // 生成轮廓点
  const generateContour = useCallback(
    (params: ContourParams): Point2D[] => {
      switch (params.type) {
        case 'circle':
          return generateCircleContour(params.radius);
        case 'semicircle':
          return generateSemicircleContour(params.radius);
        case 'rectangle':
          return generateRectangleContour(params.width, params.height);
        case 'manual':
          return worldPoints;
        default:
          return [];
      }
    },
    [generateCircleContour, generateSemicircleContour, generateRectangleContour, worldPoints]
  );

  // 开始手动绘制
  const startDrawing = useCallback(
    (screenX: number, screenY: number) => {
      if (contourParams.type !== 'manual') return;

      setIsDrawing(true);
      const worldPoint = screenToWorld(screenX, screenY);
      setWorldPoints([worldPoint]);
      lastPointRef.current = worldPoint;
    },
    [contourParams.type, screenToWorld]
  );

  // 继续绘制
  const continueDrawing = useCallback(
    (screenX: number, screenY: number) => {
      if (!isDrawing || contourParams.type !== 'manual') return;

      const worldPoint = screenToWorld(screenX, screenY);

      // 只有当距离上一个点足够远时才添加
      if (lastPointRef.current) {
        const dx = worldPoint.x - lastPointRef.current.x;
        const dy = worldPoint.y - lastPointRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.05) return; // 最小间距
      }

      setWorldPoints((prev) => [...prev, worldPoint]);
      lastPointRef.current = worldPoint;
    },
    [isDrawing, contourParams.type, screenToWorld]
  );

  // 结束绘制
  const endDrawing = useCallback(() => {
    if (!isDrawing) return;

    setIsDrawing(false);

    // 自动闭合曲线
    setWorldPoints((prev) => {
      if (prev.length > 2) {
        return [...prev, prev[0]];
      }
      return prev;
    });

    lastPointRef.current = null;
  }, [isDrawing]);

  // 清除手动绘制的点
  const clearManualPoints = useCallback(() => {
    setWorldPoints([]);
    lastPointRef.current = null;
  }, []);

  // 更新轮廓参数
  const updateContourParams = useCallback((updates: Partial<ContourParams>) => {
    setContourParams((prev) => ({ ...prev, ...updates }));
  }, []);

  return {
    worldPoints,
    isDrawing,
    contourParams,
    generateContour,
    startDrawing,
    continueDrawing,
    endDrawing,
    clearManualPoints,
    updateContourParams,
    setContourParams,
  };
}
