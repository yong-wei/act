'use client';

/**
 * 天空穹顶组件
 * 使用顶点着色的渐变天空球
 */

import { useMemo } from 'react';
import * as THREE from 'three';

interface SkyDomeProps {
  /** 地平线颜色 */
  horizonColor?: string;
  /** 天顶颜色 */
  zenithColor?: string;
  /** 球体半径 */
  radius?: number;
}

export function SkyDome({
  horizonColor = '#d4e8f7',
  zenithColor = '#4a7ba7',
  radius = 10000,
}: SkyDomeProps) {
  const geometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(radius, 64, 64);
    const colors: number[] = [];
    const positions = geo.attributes.position;

    const horizon = new THREE.Color(horizonColor);
    const zenith = new THREE.Color(zenithColor);

    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      const normalizedY = (y / radius + 1) / 2;

      const blendFactor = Math.pow(Math.max(0, normalizedY - 0.5) * 2, 0.6);
      const color = horizon.clone().lerp(zenith, blendFactor);

      colors.push(color.r, color.g, color.b);
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geo;
  }, [horizonColor, zenithColor, radius]);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} />
    </mesh>
  );
}
