'use client';

import { useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

import { useMarineVisualTime } from '../frame/marine-frame-provider';
import { WaterHuggingLine } from '../lines';
import {
  ANNOTATION_STYLE,
  appendTrailPoint,
  shouldRecordTrailPoint,
} from './annotation-logic';

export interface ActualPathTrailProps {
  /** 逐帧采样船舶世界位置。 */
  readonly positionSampler: () => { readonly x: number; readonly y?: number; readonly z: number };
  /** 重置令牌：变化时清空轨迹。 */
  readonly resetToken?: number | string;
}

/** 实际航迹线：默认常驻的教学锚点（积分语义可视化），随 Gerstner 波面贴水呈现。 */
export function ActualPathTrail({ positionSampler, resetToken }: ActualPathTrailProps) {
  const [points, setPoints] = useState<THREE.Vector3[]>([]);
  const lastRecordRef = useRef(0);
  const lastResetRef = useRef(resetToken);

  const marineVisualTime = useMarineVisualTime();

  useFrame((state, delta) => {
    if (lastResetRef.current !== resetToken) {
      lastResetRef.current = resetToken;
      setPoints([]);
      return;
    }
    const now = marineVisualTime(state, delta);
    if (!shouldRecordTrailPoint(lastRecordRef.current, now)) return;
    lastRecordRef.current = now;
    const position = positionSampler();
    setPoints((previous) => appendTrailPoint(previous, new THREE.Vector3(position.x, 0, position.z)));
  });

  if (points.length < 2) return null;

  return (
    <WaterHuggingLine
      points={points}
      color={ANNOTATION_STYLE.trail.color}
      lineWidth={ANNOTATION_STYLE.trail.lineWidth}
      transparent
      opacity={ANNOTATION_STYLE.trail.opacity}
      waterOriginSampler={positionSampler}
    />
  );
}
