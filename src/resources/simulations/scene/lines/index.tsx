'use client';

/**
 * 贴水折线：线状覆盖层（航迹/期望航线/实际路径）随 Gerstner 波面逐点抬升，
 * 不再固定在水平面上被涌浪淹没（ADR：贴水航迹）。与尾迹共用同一 CPU 波面采样语义。
 */

import { useRef, useState } from 'react';
import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';

import { useSceneQuality } from '../quality';
import { computeGerstnerDisplacement, GERSTNER_WAVE_SETS } from '../water';

export interface WaterHuggingLineProps {
  /** 世界 XZ 顶点序列（顺序即连线顺序）。 */
  readonly points: readonly { readonly x: number; readonly z: number }[];
  readonly color: string;
  readonly lineWidth?: number;
  readonly dashed?: boolean;
  readonly dashSize?: number;
  readonly gapSize?: number;
  readonly opacity?: number;
  readonly transparent?: boolean;
  /** 波面以上的抬升量（米），避免与水面共面闪烁。 */
  readonly epsilon?: number;
}

/** 顶点经 Gerstner 采样贴波面的折线；低档抽稀采样，隔帧更新控制开销。 */
export function WaterHuggingLine({
  points,
  color,
  lineWidth = 2,
  dashed = false,
  dashSize,
  gapSize,
  opacity,
  transparent,
  epsilon = 0.3,
}: WaterHuggingLineProps) {
  const { params } = useSceneQuality();
  const [lifted, setLifted] = useState<readonly [number, number, number][]>([]);
  const frameCountRef = useRef(0);

  useFrame((frameState) => {
    frameCountRef.current += 1;
    if (frameCountRef.current % 3 !== 0) return;
    const time = frameState.clock.getElapsedTime();
    const waveSet = GERSTNER_WAVE_SETS[params.waterTier];
    const stride = params.waterTier === 'low' ? 2 : 1;
    let lastY = epsilon;
    const next: [number, number, number][] = points.map((point, index) => {
      if (index % stride === 0) {
        lastY = computeGerstnerDisplacement(waveSet, point.x, point.z, time).y + epsilon;
      }
      return [point.x, lastY, point.z];
    });
    setLifted(next);
  });

  if (points.length < 2 || lifted.length < 2) return null;
  return (
    <Line
      points={lifted as [number, number, number][]}
      color={color}
      lineWidth={lineWidth}
      dashed={dashed}
      dashSize={dashSize}
      gapSize={gapSize}
      opacity={opacity}
      transparent={transparent}
    />
  );
}
