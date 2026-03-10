import { useCallback, useState } from 'react';
import type { CanvasTransform } from '../types';

interface UseCanvasTransformOptions {
  initialScale?: number;
  minScale?: number;
  maxScale?: number;
}

export function useCanvasTransform(options: UseCanvasTransformOptions = {}) {
  const { initialScale = 50, minScale = 10, maxScale = 200 } = options;

  const [transform, setTransform] = useState<CanvasTransform>({
    x: 0,
    y: 0,
    scale: initialScale,
  });

  const initializeCenter = useCallback((width: number, height: number) => {
    setTransform((prev) => ({
      ...prev,
      x: width / 2,
      y: height / 2,
    }));
  }, []);

  const handleWheel = useCallback(
    (e: WheelEvent, canvasRect: DOMRect) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;

      setTransform((prev) => {
        const newScale = Math.min(Math.max(prev.scale * delta, minScale), maxScale);

        // 计算鼠标位置相对于画布的坐标
        const mouseX = e.clientX - canvasRect.left;
        const mouseY = e.clientY - canvasRect.top;

        // 计算世界坐标
        const worldX = (mouseX - prev.x) / prev.scale;
        const worldY = (prev.y - mouseY) / prev.scale;

        // 调整位置使缩放中心保持不变
        return {
          x: mouseX - worldX * newScale,
          y: mouseY + worldY * newScale,
          scale: newScale,
        };
      });
    },
    [minScale, maxScale]
  );

  const handlePan = useCallback((dx: number, dy: number) => {
    setTransform((prev) => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy,
    }));
  }, []);

  const resetTransform = useCallback(
    (width: number, height: number) => {
      setTransform({
        x: width / 2,
        y: height / 2,
        scale: initialScale,
      });
    },
    [initialScale]
  );

  // 屏幕坐标转世界坐标
  const screenToWorld = useCallback(
    (screenX: number, screenY: number): { x: number; y: number } => {
      return {
        x: (screenX - transform.x) / transform.scale,
        y: (transform.y - screenY) / transform.scale,
      };
    },
    [transform]
  );

  // 世界坐标转屏幕坐标
  const worldToScreen = useCallback(
    (worldX: number, worldY: number): { x: number; y: number } => {
      return {
        x: transform.x + worldX * transform.scale,
        y: transform.y - worldY * transform.scale,
      };
    },
    [transform]
  );

  return {
    transform,
    setTransform,
    initializeCenter,
    handleWheel,
    handlePan,
    resetTransform,
    screenToWorld,
    worldToScreen,
  };
}
