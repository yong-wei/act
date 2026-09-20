'use client';

/**
 * 贴水折线：线状覆盖层（航迹/期望航线/实际路径）随 Gerstner 波面逐点抬升，
 * 不再固定在水平面上被涌浪淹没（ADR：贴水航迹）。与尾迹共用同一 CPU 波面采样语义。
 */

import { useRef, useState } from 'react';
import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';

import { useMarineFrameRunner, useMarineVisualTime } from '../frame/marine-frame-provider';
import { useSceneQuality } from '../quality';
import {
  createNearFieldSurfaceQuery,
  DEFAULT_GERSTNER_SEA_STATE,
  gerstnerAmplitudeScale,
  GERSTNER_WATER_BASE_Y,
} from '../water';

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
  /** 水面网格跟随原点（舰位）采样：提供后按与可见水面同一坐标基准抬升。 */
  readonly waterOriginSampler?: () => { readonly x: number; readonly z: number };
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
  waterOriginSampler,
}: WaterHuggingLineProps) {
  const { params } = useSceneQuality();
  const [lifted, setLifted] = useState<readonly [number, number, number][]>([]);
  const frameCountRef = useRef(0);

  const marineVisualTime = useMarineVisualTime();
  // 水面原点（二轮复审）：显式采样器 > 海洋帧 renderOrigin（跟船水面网格）> 世界原点。
  const marineFrame = useMarineFrameRunner();

  useFrame((frameState, delta) => {
    frameCountRef.current += 1;
    if (frameCountRef.current % 3 !== 0) return;
    const time = marineVisualTime(frameState, delta);
    const origin = waterOriginSampler?.() ?? marineFrame?.latest()?.renderOrigin ?? { x: 0, z: 0 };
    const amplitudeScale = gerstnerAmplitudeScale(DEFAULT_GERSTNER_SEA_STATE);
    const stride = params.waterTier === 'low' ? 2 : 1;
    // 贴水线取近场可见曲面（#2098）：带限波组 + 包络，档位无关。
    const query = createNearFieldSurfaceQuery(amplitudeScale, origin.x, origin.z, time);
    let lastY = GERSTNER_WATER_BASE_Y + epsilon;
    const next: [number, number, number][] = points.map((point, index) => {
      if (index % stride === 0) {
        lastY = query.heightAt(point.x, point.z) + epsilon;
      }
      return [point.x, lastY, point.z];
    });
    setLifted(next);
  });

  if (points.length < 2 || lifted.length < 2) return null;
  return (
    <Line name="marine-trail"
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
