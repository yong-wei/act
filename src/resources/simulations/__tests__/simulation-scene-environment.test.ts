import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ENVIRONMENT_PRESET_ID,
  SCENE_ENVIRONMENT_PRESETS,
} from '../scene/environment/environment-presets';

const ENV_DIR = path.join(process.cwd(), 'src/resources/simulations/scene/environment');
const PUBLIC_ENV_DIR = path.join(process.cwd(), 'public/assets/simulation-scene/environment');

const readSource = (file: string) => readFileSync(path.join(ENV_DIR, file), 'utf8');

describe('environment preset catalog', () => {
  it('offers exactly five presets sharing the video environment language', () => {
    expect(SCENE_ENVIRONMENT_PRESETS.map((preset) => preset.id)).toEqual([
      'open-sea',
      'dawn-haze',
      'sunset-warm',
      'overcast',
      'storm-blue',
    ]);
    expect(SCENE_ENVIRONMENT_PRESETS.map((preset) => preset.label)).toEqual([
      '开阔海',
      '薄雾黎明',
      '暖色日落',
      '阴云',
      '风暴蓝',
    ]);
    expect(DEFAULT_ENVIRONMENT_PRESET_ID).toBe('open-sea');
  });

  it('references only environment textures that exist on disk', () => {
    for (const preset of SCENE_ENVIRONMENT_PRESETS) {
      for (const texture of [preset.skyTexture, preset.horizonTexture, preset.cloudTexture]) {
        const relative = texture.replace('/assets/simulation-scene/environment/', '');
        expect(
          existsSync(path.join(PUBLIC_ENV_DIR, relative)),
          `${preset.id} references missing texture ${texture}`
        ).toBe(true);
      }
    }
  });

  it('carries complete lighting, fog, and water parameters per preset', () => {
    for (const preset of SCENE_ENVIRONMENT_PRESETS) {
      expect(preset.hemisphere.intensity).toBeGreaterThan(0);
      expect(preset.sun.intensity).toBeGreaterThan(0);
      expect(preset.sun.position).toHaveLength(3);
      expect(4500 * preset.fog.nearScale).toBeLessThan(18000 * preset.fog.farScale);
      expect(preset.water.waterColor).toMatch(/^#/);
      expect(preset.water.deepColor).toMatch(/^#/);
      expect(preset.water.horizonColor).toMatch(/^#/);
    }
  });
});

describe('environment scene body is theme-decoupled', () => {
  it('drives scene body from the preset rather than the platform theme', () => {
    const scene = readSource('environment-scene.tsx');
    expect(scene).toContain('<fog attach="fog"');
    expect(scene).not.toContain('SIMULATION_SCENE_THEMES');
    expect(scene).not.toContain('sceneTheme');
  });

  it('mounts EnvironmentScene with a manual preset switcher in the sample experiment', () => {
    const destroyer = readFileSync(
      path.join(process.cwd(), 'src/resources/simulations/simulations/destroyer-simulation.tsx'), 'utf8'
    );
    expect(destroyer).toContain('<EnvironmentScene');
    expect(destroyer).toContain('EnvironmentPresetSwitcher');
    expect(destroyer).not.toContain('function SkyDome(');
    expect(destroyer).not.toContain('function ProceduralClouds(');
  });

  it('keeps the module free of Remotion coupling', () => {
    for (const file of ['environment-presets.ts', 'environment-scene.tsx', 'environment-state.tsx']) {
      const source = readSource(file);
      expect(source).not.toContain('remotion');
      expect(source).not.toContain('@remotion');
    }
  });
});
