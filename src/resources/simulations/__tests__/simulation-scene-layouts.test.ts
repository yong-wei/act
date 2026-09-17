import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  MARINE_SCENE_LAYOUTS,
  shorelineAmplitudeAttenuation,
  type MarineSceneLayoutId,
} from '@/resources/simulations/scene/environment/scene-layouts';

// 实验→布局映射（装配层知识，测试侧登记；共享模块不得硬编码实验 id）。
const LAYOUT_SUPPORT: Record<string, MarineSceneLayoutId> = {
  destroyer: 'open-sea-distant-islands',
  cruise: 'harbor-entrance-channel',
  container: 'harbor-entrance-channel',
  lng: 'harbor-entrance-channel',
  dredger: 'shallow-construction-site',
  drilling: 'offshore-operations-area',
  icebreaker: 'polar-ice-field',
};

const ROOT = process.cwd();

describe('marine scene layouts (#2102)', () => {
  const FIVE: MarineSceneLayoutId[] = [
    'open-sea-distant-islands',
    'harbor-entrance-channel',
    'shallow-construction-site',
    'offshore-operations-area',
    'polar-ice-field',
  ];

  it('declares five representative layouts with labeled ids', () => {
    for (const id of FIVE) {
      const layout = MARINE_SCENE_LAYOUTS[id];
      expect(layout, id).toBeDefined();
      expect(layout.id).toBe(id);
      expect(layout.label.length).toBeGreaterThan(0);
      expect(layout.objects.length).toBeGreaterThan(0);
    }
  });

  it('keeps every environment object world anchored with finite coordinates and positive scale', () => {
    for (const layout of Object.values(MARINE_SCENE_LAYOUTS)) {
      for (const object of layout.objects) {
        expect(Number.isFinite(object.x)).toBe(true);
        expect(Number.isFinite(object.z)).toBe(true);
        expect(object.scale).toBeGreaterThan(0);
      }
    }
  });

  it('assigns every vessel a supported layout (assembly-level mapping)', () => {
    // 七船型全部有至少一个挂载布局（装配层映射，见 it.each 源码契约）。
    for (const required of ['destroyer', 'cruise', 'container', 'lng', 'dredger', 'drilling', 'icebreaker']) {
      expect(LAYOUT_SUPPORT[required], required).toBeDefined();
    }
    expect(LAYOUT_SUPPORT.icebreaker).toBe('polar-ice-field');
  });

  it('keeps visual-only extensions out of numerical semantics', () => {
    // 布局声明只含视觉字段：无任务参数、无数值扰动、无碰撞规则。
    const layout = MARINE_SCENE_LAYOUTS['shallow-construction-site'];
    expect(layout.sedimentPlume).toBeDefined();
    expect(Object.keys(layout).sort()).toEqual(
      expect.arrayContaining(['id', 'label', 'objects', 'shoreSegments']),
    );
    const declared = Object.keys(layout);
    for (const forbidden of ['disturbance', 'forces', 'collision', 'taskParams']) {
      expect(declared).not.toContain(forbidden);
    }
    expect(MARINE_SCENE_LAYOUTS['polar-ice-field'].iceCoverage).toBeLessThanOrEqual(1);
  });
});

describe('shoreline amplitude attenuation (#2102, render input)', () => {
  const shore = [{ id: 's', from: [-1000, 0] as const, to: [1000, 0] as const, shoreDepthMeters: 5 }];

  it('is 1 far from any shore and reduced smoothly near it', () => {
    expect(shorelineAmplitudeAttenuation(shore, 0, 5000, 400)).toBe(1);
    expect(shorelineAmplitudeAttenuation(shore, 0, 0, 400)).toBeCloseTo(0.15, 9);
    const mid = shorelineAmplitudeAttenuation(shore, 0, 200, 400);
    expect(mid).toBeGreaterThan(0.15);
    expect(mid).toBeLessThan(1);
  });

  it('returns 1 for layouts without shore segments (open sea unchanged)', () => {
    expect(shorelineAmplitudeAttenuation([], 0, 0, 400)).toBe(1);
    expect(shorelineAmplitudeAttenuation(MARINE_SCENE_LAYOUTS['open-sea-distant-islands'].shoreSegments, 300, -400, 400)).toBe(1);
  });

  it('decreases monotonically toward the shore', () => {
    let previous = 1;
    for (let d = 400; d >= 0; d -= 50) {
      const value = shorelineAmplitudeAttenuation(shore, 0, d, 400);
      expect(value).toBeLessThanOrEqual(previous + 1e-12);
      previous = value;
    }
  });
});

describe('visual extension slots have runtime consumers (#2102 contracts)', () => {
  it('renders the sediment plume and gates ice floes by coverage', () => {
    const source = readFileSync(
      path.join(ROOT, 'src/resources/simulations/scene/environment/scene-layout-objects.tsx'),
      'utf-8',
    );
    expect(source).toContain('SedimentPlumeDisc');
    expect(source).toContain('layout.sedimentPlume.radiusMeters');
    // 冰况密度门控：运行态覆盖优先（iceCoverageOverride），缺省退回声明密度。
    expect(source).toContain('iceCoverageOverride?.() ?? layout.iceCoverage ?? 1');
    // 羽流贴水合成：深度测试关闭 + 高 renderOrder（波峰波谷下持续可见）。
    expect(source).toContain('depthTest: false');
    expect(source).toContain('renderOrder={10}');
  });

  it('drives polar ice visibility from live ice condition state', () => {
    const source = readFileSync(
      path.join(ROOT, 'src/resources/simulations/simulations/icebreaker-simulation.tsx'),
      'utf-8',
    );
    // 冰区模式关闭 → 覆盖 0（无冰块）；开启 → 冰厚映射密度。
    expect(source).toContain('config.iceModeEnabled && config.iceThickness > 0 ? Math.min(1, config.iceThickness / 1.5) : 0');
    expect(source).toContain('iceCoverageOverride={() => iceCoverage}');
  });

  it('feeds shore segments into the near-field water amplitude (GPU mirror of the pure function)', () => {
    const material = readFileSync(
      path.join(ROOT, 'src/resources/simulations/scene/water/gerstner-water-material.ts'),
      'utf-8',
    );
    expect(material).toContain('uShoreSegments');
    expect(material).toContain('shoreAttenuation = 0.15 + 0.85 * t * t * (3.0 - 2.0 * t);');
    expect(material).toContain('float ampRaw = uWaves[base + 2] * effectiveAmplitudeScale;');
    // 带岸线布局的船型把声明段传入水面。
    const cruise = readFileSync(
      path.join(ROOT, 'src/resources/simulations/simulations/cruise-simulation.tsx'),
      'utf-8',
    );
    expect(cruise).toContain("shoreSegments={MARINE_SCENE_LAYOUTS['harbor-entrance-channel'].shoreSegments}");
    const dredger = readFileSync(
      path.join(ROOT, 'src/resources/simulations/simulations/dredger-simulation.tsx'),
      'utf-8',
    );
    expect(dredger).toContain("shoreSegments={MARINE_SCENE_LAYOUTS['shallow-construction-site'].shoreSegments}");
  });

  it('keeps the GPU attenuation formula equal to the CPU reference', () => {
    // GPU：0.15 + 0.85·t²(3−2t)；CPU：shorelineAmplitudeAttenuation 同式（带外 1、岸边 0.15）。
    const shore = [{ id: 's', from: [-1000, 0] as const, to: [1000, 0] as const, shoreDepthMeters: 5 }];
    for (const distance of [0, 100, 200, 300, 400]) {
      const t = distance / 400;
      const gpu = 0.15 + 0.85 * t * t * (3 - 2 * t);
      expect(shorelineAmplitudeAttenuation(shore, 0, distance, 400)).toBeCloseTo(gpu, 12);
    }
  });
});

describe('layout mounting reuses the shared rendering stack (#2102 contracts)', () => {
  it.each([
    ['destroyer-simulation.tsx', 'open-sea-distant-islands'],
    ['cruise-simulation.tsx', 'harbor-entrance-channel'],
    ['container-simulation.tsx', 'harbor-entrance-channel'],
    ['lng-simulation.tsx', 'harbor-entrance-channel'],
    ['dredger-simulation.tsx', 'shallow-construction-site'],
    ['drilling-simulation.tsx', 'offshore-operations-area'],
    ['icebreaker-simulation.tsx', 'polar-ice-field'],
  ])('%s mounts its supported layout on the shared stack', (file, layout) => {
    expect(LAYOUT_SUPPORT[file.replace('-simulation.tsx', '')]).toBe(layout);
    const source = readFileSync(path.join(ROOT, 'src/resources/simulations/simulations', file), 'utf-8');
    expect(source).toContain(`layoutId="${layout}"`);
    // 不引入第二套海洋/渲染器：布局组件来自共享 environment 模块（多行或单行导入均可）。
    expect(source.match(/MarineSceneLayoutObjects[,}]/)).not.toBeNull();
    expect(source).toContain("from '../scene/environment'");
  });

  it('renders world-anchored objects with static world positions (no camera follow)', () => {
    const source = readFileSync(
      path.join(ROOT, 'src/resources/simulations/scene/environment/scene-layout-objects.tsx'),
      'utf-8',
    );
    // 世界坐标静态放置；不挂相机/船位采样器（视差正确）。
    expect(source).toContain('position={[object.x, (object.y ?? 0) + (isIce ? 0.2 : 0), object.z]}');
    expect(source).not.toContain('positionSampler');
    expect(source).not.toContain('camera');
  });
});
