import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const readSource = (relative: string) =>
  readFileSync(path.join(ROOT, 'src/resources/simulations', relative), 'utf8');

describe('recognizable environment assets (#2119)', () => {
  it('replaces single-primitive placeholders with composite silhouettes', () => {
    const source = readSource('scene/environment/scene-layout-objects.tsx');
    // 岸桥=门吊桁架（四腿+顶梁+前伸臂+配重+机房），岛屿=多峰，码头=桩基，储罐=穹顶。
    expect(source).toContain('buildCraneGeometry');
    expect(source).toContain('buildIslandGeometry');
    expect(source).toContain('buildPierGeometry');
    expect(source).toContain('buildTankGeometry');
    expect(source).toContain('buildBuoyGeometry');
    expect(source).toContain('buildBreakwaterGeometry');
    expect(source).toContain('mergeGeometries');
    // 不再是单一锥体/立柱占位：复合几何由 ≥3 个基元合并。
    const craneMerge = source.slice(
      source.indexOf('function buildCraneGeometry'),
      source.indexOf('function buildIslandGeometry'),
    );
    // 四腿循环 + 顶梁/前伸臂/配重/机房 = 8 个部件（5 处调用点，腿为循环）。
    expect(craneMerge.split('unitBox(').length - 1).toBeGreaterThanOrEqual(5);
  });

  it('shares composite geometry per kind (cache) and disposes only per-object simplified levels', () => {
    const source = readSource('scene/environment/scene-layout-objects.tsx');
    expect(source).toContain('COMPOSITE_CACHE');
    expect(source).toContain('level.object as THREE.Mesh).geometry.dispose()');
  });
});

describe('real distance LOD and instancing (#2119)', () => {
  it('uses THREE.LOD with two levels and scale-aware switch distance', () => {
    const source = readSource('scene/environment/scene-layout-objects.tsx');
    expect(source).toContain('new THREE.LOD()');
    expect(source).toContain('node.addLevel');
    expect(source).toContain('lodDistanceFor');
    expect(source).toContain('simplifiedGeometryFor');
  });

  it('batches repeated kinds into instanced meshes with near/far distance levels', () => {
    const source = readSource('scene/environment/scene-layout-objects.tsx');
    expect(source).toContain('INSTANCING_THRESHOLD = 2');
    expect(source).toContain('<instancedMesh');
    expect(source).toContain('mesh.setMatrixAt(index, matrix)');
    expect(source).toContain('mesh.instanceMatrix.needsUpdate = true');
    // 复审修复：实例批次按世界分区两级（近区复合轮廓/远区简化基元），
    // 远区细节可测量下降；尺度按类别非等比（防波堤 1400 是长度非高度）。
    expect(source).toContain('INSTANCE_NEAR_RADIUS_METERS = 2500');
    expect(source).toContain('instanceScaleFor(object)');
    expect(source).toContain('new THREE.Vector3(object.scale, 14, Math.max(24, object.scale * 0.18))');
    expect(source).toContain('new THREE.Vector3(object.scale, 10, Math.max(8, object.scale * 0.3))');
  });

  it('exposes an actual draw-call measurement probe', () => {
    const source = readSource('scene/environment/scene-layout-objects.tsx');
    expect(source).toContain("has('qa', 'marine-layout')");
    expect(source).toContain('gl.info.render.calls');
    expect(source).toContain('__marineLayoutStats');
  });
});

describe('depth-graded shallow-water consumer (#2119)', () => {
  it('uses estimated water depth for bounded absorption instead of a flat tint', () => {
    const material = readSource('scene/water/gerstner-water-material.ts');
    expect(material).toContain('vec2 shoreEffects(vec2 worldXZ)');
    expect(material).toContain('exp(-max(shoreFx.y, 0.2) * 0.55)');
    expect(material).toContain('mix(vec3(0.28, 0.52, 0.5), color, absorption)');
    // 有界折射：浅水梯度上偏移泡沫细节采样 ≤0.35m（片元近似，非渲染 pass）。
    expect(material).toContain('refractionOffset');
    expect(material).toContain('(1.0 - absorption) * 0.35');
    expect(material).toContain('foamDetail(vWorldPos.xz + refractionOffset)');
    // 深水（无岸线段）不进入浅水路径。
    expect(material).toContain('return vec2(0.0, 20.0)');
  });

  it('keeps ship-side occlusion via the existing hull exclusion (no shallow tint through the hull)', () => {
    const material = readSource('scene/water/gerstner-water-material.ts');
    expect(material).toContain('uHullExclusionCount > 0.0');
    expect(material).toContain('discard');
  });
});
