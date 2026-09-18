import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const FLEET = [
  'destroyer-simulation.tsx',
  'cruise-simulation.tsx',
  'container-simulation.tsx',
  'lng-simulation.tsx',
  'dredger-simulation.tsx',
  'drilling-simulation.tsx',
  'icebreaker-simulation.tsx',
];

describe('fleet unified marine stack (#2104 contracts)', () => {
  it.each(FLEET)('%s samples wake water through the shared near-field surface query', (file) => {
    const source = readFileSync(path.join(ROOT, 'src/resources/simulations/simulations', file), 'utf-8');
    expect(source, file).toContain('createNearFieldSurfaceQuery');
    // 实验内不再自带解析波场采样（统一近场可见曲面，与 GPU 同参数）。
    expect(source, file).not.toContain('computeGerstnerDisplacement');
  });

  it.each(FLEET)('%s mounts the full unified stack (water sun / subject shadows / layout / evidence)', (file) => {
    const source = readFileSync(path.join(ROOT, 'src/resources/simulations/simulations', file), 'utf-8');
    expect(source, file).toContain('sunDirection={water.sunDirection}');
    expect(source, file).toContain('subjectPositionSampler=');
    expect(source, file).toContain('layoutId="');
    expect(source, file).toContain('MarinePerformanceEvidenceProbe');
    expect(source, file).toContain('EnvironmentScene');
    expect(source, file).toContain('GerstnerWater');
  });

  it('keeps per-package adaptation only in profiles/tasks (no second renderer stack)', () => {
    for (const file of FLEET) {
      const source = readFileSync(path.join(ROOT, 'src/resources/simulations/simulations', file), 'utf-8');
      // 不引入实验专属水面/天空/渲染器：全部来自共享 scene 模块。
      expect(source, file).not.toContain('ShaderMaterial');
      expect(source, file).not.toContain('PMREMGenerator');
      expect(source, file).not.toContain('new THREE.WebGLRenderer');
    }
  });

  it('memoizes the near-field query per frame across the fleet', () => {
    for (const file of FLEET) {
      const source = readFileSync(path.join(ROOT, 'src/resources/simulations/simulations', file), 'utf-8');
      if (file === 'destroyer-simulation.tsx') continue; // 055 帧基座内建记忆化
      expect(source, file).toContain('wakeQueryCacheRef');
    }
  });
});
