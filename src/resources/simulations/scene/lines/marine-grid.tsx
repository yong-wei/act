'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, MeshBasicNodeMaterial, type Mesh } from 'three/webgpu';
import { positionWorld, cameraPosition, vec4, float, abs, fract, fwidth, min, max, mix } from 'three/tsl';
import { Grid as LegacyGrid, type GridProps } from '@react-three/drei';

function NodeGrid({ args = [10000, 10000], cellSize = 100, cellThickness = 0.5, cellColor = '#888888',
  sectionSize = 500, sectionThickness = 1, sectionColor = '#bbbbbb', fadeDistance = 9000, fadeStrength = 1,
  infiniteGrid = false, ...props }: GridProps) {
  const mesh = useRef<Mesh>(null);
  const material = useMemo(() => {
    const grid = (size: number, width: number) => {
      const at = positionWorld.xz.div(size);
      const distance = abs(fract(at.sub(0.5)).sub(0.5)).div(fwidth(at).max(1e-5));
      return float(1).sub(min(distance.x, distance.y).div(width)).clamp();
    };
    const cell = grid(cellSize, cellThickness); const section = grid(sectionSize, sectionThickness);
    const fade = float(1).sub(positionWorld.xz.sub(cameraPosition.xz).length().div(fadeDistance)).clamp().pow(fadeStrength);
    const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
    material.fragmentNode = vec4(mix(vec4(new Color(cellColor), 1).rgb, vec4(new Color(sectionColor), 1).rgb, section), max(cell, section).mul(fade));
    return material;
  }, [cellSize, cellThickness, cellColor, sectionSize, sectionThickness, sectionColor, fadeDistance, fadeStrength]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(state => { if (infiniteGrid && mesh.current) { mesh.current.position.x = state.camera.position.x; mesh.current.position.z = state.camera.position.z; } });
  return <mesh {...props} ref={mesh} rotation={[-Math.PI / 2, 0, 0]} material={material}><planeGeometry args={args} /></mesh>;
}
export function MarineGrid(props: GridProps) {
  const renderer = useThree(state => state.gl);
  return 'isWebGPURenderer' in renderer ? <NodeGrid {...props} /> : <LegacyGrid {...props} />;
}
