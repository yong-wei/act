import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import {
  disposeMarineEnvironmentRadiance,
  marineRadianceCacheSize,
  marineSunFrameForSubject,
  MARINE_ENVIRONMENT_IBL_INTENSITY,
  MARINE_SHADOW_BOUNDS_METERS,
  MARINE_SHADOW_SUN_DISTANCE_METERS,
  resolveMarineEnvironmentRadiance,
  worldSunDirection,
  type MarinePmremSource,
} from '@/resources/simulations/scene/environment/environment-radiance';
import { SCENE_ENVIRONMENT_PRESETS } from '@/resources/simulations/scene/environment/environment-presets';

const ROOT = process.cwd();

describe('world sun direction (#2099)', () => {
  it('derives a normalized sun direction from the preset', () => {
    for (const preset of SCENE_ENVIRONMENT_PRESETS) {
      const direction = worldSunDirection(preset);
      expect(direction.length()).toBeCloseTo(1, 9);
      const raw = new THREE.Vector3(...preset.sun.position);
      expect(direction.dot(raw.clone().normalize())).toBeCloseTo(1, 9);
    }
  });

  it('gives every preset a nonzero elevation (sun above horizon)', () => {
    for (const preset of SCENE_ENVIRONMENT_PRESETS) {
      expect(worldSunDirection(preset).y).toBeGreaterThan(0);
    }
  });
});

describe('subject-following sun frame (#2099)', () => {
  const preset = SCENE_ENVIRONMENT_PRESETS[0]!;

  it('positions the light along the sun direction at a fixed distance from the subject', () => {
    const frame = marineSunFrameForSubject(preset, { x: 1000, z: -2000 });
    expect(frame.targetPosition.x).toBe(1000);
    expect(frame.targetPosition.z).toBe(-2000);
    const offset = frame.lightPosition.clone().sub(frame.targetPosition);
    expect(offset.length()).toBeCloseTo(MARINE_SHADOW_SUN_DISTANCE_METERS, 6);
    expect(offset.normalize().dot(worldSunDirection(preset))).toBeCloseTo(1, 9);
  });

  it('keeps lighting spatially consistent when only the camera rotates (pure frame is camera-free)', () => {
    // 帧只依赖预设与主体位置：不读相机（旋转相机时光照不变、反射只随视线变化）。
    const subject = { x: 321, z: -555 };
    const first = marineSunFrameForSubject(preset, subject);
    const second = marineSunFrameForSubject(preset, subject);
    expect(second.direction.equals(first.direction)).toBe(true);
    expect(second.lightPosition.equals(first.lightPosition)).toBe(true);
  });

  it('translates the shadow frame with the subject, direction unchanged', () => {
    const near = marineSunFrameForSubject(preset, { x: 0, z: 0 });
    const far = marineSunFrameForSubject(preset, { x: 5000, z: 9000 });
    expect(far.direction.equals(near.direction)).toBe(true);
    expect(far.lightPosition.x - far.targetPosition.x).toBeCloseTo(
      near.lightPosition.x - near.targetPosition.x,
      6,
    );
  });
});

describe('environment radiance cache (#2099)', () => {
  it('reuses cached PMREM for an unchanged preset without regeneration', () => {
    disposeMarineEnvironmentRadiance();
    const generations: string[] = [];
    const source: MarinePmremSource = {
      fromSkyScene: (skyScene) => {
        generations.push(String((skyScene as unknown as { uuid: string }).uuid));
        return new THREE.Texture();
      },
    };
    const factory = () => new THREE.Scene();
    const first = resolveMarineEnvironmentRadiance(source, factory, 'open-sea');
    const second = resolveMarineEnvironmentRadiance(source, factory, 'open-sea');
    expect(second).toBe(first);
    expect(generations).toHaveLength(1);
    expect(marineRadianceCacheSize()).toBe(1);

    // 不同预设各自生成一次并缓存。
    resolveMarineEnvironmentRadiance(source, factory, 'storm-blue');
    resolveMarineEnvironmentRadiance(source, factory, 'storm-blue');
    expect(generations).toHaveLength(2);
    expect(marineRadianceCacheSize()).toBe(2);

    disposeMarineEnvironmentRadiance();
    expect(marineRadianceCacheSize()).toBe(0);
    // 释放后重新解析会再次生成（资源释放语义）。
    resolveMarineEnvironmentRadiance(source, factory, 'open-sea');
    expect(generations).toHaveLength(3);
    disposeMarineEnvironmentRadiance();
  });
});

describe('environment scene and fleet wiring (#2099 source contracts)', () => {
  it('wires scene.environment with cached PMREM, IBL de-weighting, and fitted subject shadows', () => {
    const source = readFileSync(
      path.join(ROOT, 'src/resources/simulations/scene/environment/environment-scene.tsx'),
      'utf-8',
    );
    expect(source).toContain('scene.environment = entry.texture;');
    expect(source).toContain(`scene.environmentIntensity = MARINE_ENVIRONMENT_IBL_INTENSITY;`);
    expect(source).toContain('MARINE_ENVIRONMENT_IBL_INTENSITY');
    // 主体跟随：位置 = 主体 + 方向 × 距离；target = 主体；显式阴影相机拟合。
    expect(source).toContain('sunLight.position.copy(frame.lightPosition);');
    expect(source).toContain('sunTarget.position.copy(frame.targetPosition);');
    expect(source).toContain('sunLight.target = sunTarget;');
    expect(source).toContain('shadow-camera-left={-MARINE_SHADOW_BOUNDS_METERS}');
    expect(source).toContain(`shadow-bias={-0.0004}`);
    expect(String(MARINE_SHADOW_BOUNDS_METERS)).toBe('260');
    expect(String(MARINE_ENVIRONMENT_IBL_INTENSITY)).toBe('0.85');
  });

  it('exposes the preset sun direction through the water color hook', () => {
    const source = readFileSync(
      path.join(ROOT, 'src/resources/simulations/scene/environment/environment-scene.tsx'),
      'utf-8',
    );
    expect(source).toContain('sunDirection: worldSunDirection(preset),');
  });

  it.each([
    'destroyer-simulation.tsx',
    'cruise-simulation.tsx',
    'dredger-simulation.tsx',
    'drilling-simulation.tsx',
    'icebreaker-simulation.tsx',
    'lng-simulation.tsx',
    'container-simulation.tsx',
  ])('%s passes the preset sun to water and the subject to the environment', (file) => {
    const source = readFileSync(
      path.join(ROOT, 'src/resources/simulations/simulations', file),
      'utf-8',
    );
    // 水面着色器与船体/天空共用同一预设太阳方向。
    expect(source).toContain('sunDirection={water.sunDirection}');
    // 环境场景阴影围绕本船主体。
    expect(source).toContain('subjectPositionSampler=');
  });
});
