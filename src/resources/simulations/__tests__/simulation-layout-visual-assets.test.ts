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
    // P1 复审修复：indexed（盒/柱/锥/球）与非 indexed（十二面体）统一转
    // non-indexed 后合并——直接 merge 会因属性不兼容返回 null（防波堤首帧异常）。
    expect(source).toContain('geometry.index ? geometry.toNonIndexed() : geometry');
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
    // 复审修复（二轮）：实例层级按**相机距离**动态迁移（非固定世界分区）——
    // 近相机实例进复合批、远实例进简化批（mesh.count 截断 + 滞回 0.85/1.15
    // + 0.25s 节拍）；尺度按类别非等比（防波堤 1400 是长度非高度）。
    expect(source).toContain('instanceLodDistanceMeters');
    expect(source).toContain('distance <= lodDistance * 0.85');
    expect(source).toContain('distance <= lodDistance * 1.15');
    expect(source).toContain('INSTANCE_REBUCKET_INTERVAL_SECONDS = 0.25');
    expect(source).toContain('mesh.count = batch.length');
    // 动态重写后重算包围球（防旧包围球视锥剔除让迁入对象消失）。
    expect(source).toContain('mesh.computeBoundingSphere();');
    expect(source).toContain('instanceScaleFor(object)');
    expect(source).toContain('new THREE.Vector3(object.scale, 14, Math.max(24, object.scale * 0.18))');
    expect(source).toContain('new THREE.Vector3(object.scale, 10, Math.max(8, object.scale * 0.3))');
  });

  it('gates the shallow consumer with a QA kill switch that skips per-fragment work', () => {
    const material = readSource('scene/water/gerstner-water-material.ts');
    expect(material).toContain('uShallowFxEnabled');
    expect(material).toContain('if (uShallowFxEnabled < 0.5 || uShoreSegmentCount <= 0.0');
    // 吸收/折射/浅水混色整体进入开关分支（关闭 = 全部逐片元计算停止）。
    expect(material).toContain('if (uShallowFxEnabled > 0.5) {');
    expect(material).toContain('float absorption = 1.0;');
    expect(material).toContain('vec2 refractionOffset = vec2(0.0);');
    const water = readSource('scene/water/gerstner-water.tsx');
    expect(water).toContain("get('qa-shallow') === 'off'");
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
    // 受控视觉折射（复审声明修正）：偏移同时作用于羽流边缘（水柱内容弯折）；
    // 非物理折射——无折射渲染通道（该断言钉住）。
    expect(material).toContain('length(vWorldPos.xz + refractionOffset - uPlumeCenter)');
    expect(material).not.toContain('refractionRenderTarget');
    // 深水（无岸线段）不进入浅水路径。
    expect(material).toContain('return vec2(0.0, 20.0)');
  });

  it('keeps ship-side occlusion via the existing hull exclusion (no shallow tint through the hull)', () => {
    const material = readSource('scene/water/gerstner-water-material.ts');
    expect(material).toContain('uHullExclusionCount > 0.0');
    expect(material).toContain('discard');
  });
});
