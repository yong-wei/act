'use client';
import { useEffect, useMemo } from 'react';
import { useThree, type ThreeElements } from '@react-three/fiber';
import { Line as LegacyLine, type LineProps } from '@react-three/drei';
import { Line2NodeMaterial } from 'three/webgpu';
import { Line2 } from 'three/addons/lines/webgpu/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';

function NodeLine({ points, color = 'white', lineWidth = 1, dashed = false, dashSize = 1, gapSize = 1, opacity = 1, transparent = false, ...props }: LineProps) {
  const bundle = useMemo(() => {
    const geometry = new LineGeometry();
    const coordinates = points.flatMap(point => typeof point === 'number' ? [point]
      : 'x' in point ? [point.x, point.y, 'z' in point ? point.z : 0] : [point[0], point[1], point[2] ?? 0]);
    geometry.setPositions(coordinates);
    const material = new Line2NodeMaterial({ color, linewidth: lineWidth, dashed, dashSize, gapSize, opacity, transparent });
    const line = new Line2(geometry, material);
    line.computeLineDistances();
    return { geometry, material, line };
  }, [points, color, lineWidth, dashed, dashSize, gapSize, opacity, transparent]);
  useEffect(() => () => { bundle.geometry.dispose(); bundle.material.dispose(); }, [bundle]);
  return <primitive object={bundle.line} {...props as Omit<ThreeElements['primitive'], 'object'>} />;
}
export function MarineLine(props: LineProps) {
  const renderer = useThree(state => state.gl);
  return 'isWebGPURenderer' in renderer ? <NodeLine {...props} /> : <LegacyLine {...props} />;
}
