import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { platformHeadingToSceneRad } from '../scene/heading';

const LNG = path.join(process.cwd(), 'src/resources/simulations/simulations/lng-simulation.tsx');
const PROFILE = path.join(process.cwd(), 'src/resources/simulations/profiles/lng-changheng-scene.ts');

const read = (file: string) => readFileSync(file, 'utf8');

describe('lng scene visual profile', () => {
  it('pins ship length, design speed, model url, and wake anchors', () => {
    const source = read(PROFILE);
    expect(source).toContain('shipLengthMeters: 295');
    expect(source).toContain('designSpeedKnots: 19');
    expect(source).toContain("resolveRegisteredSimulationModel('lng-carrier')");
    expect(source).toContain('wakeAnchors');
  });
});

describe('lng pipeline integration', () => {
  it('mounts every pipeline layer in the lng scene', () => {
    const source = read(LNG);
    for (const marker of [
      '<EnvironmentScene',
      '<WakeTrail',
      '<StayPutCameraController',
      'SceneEnvironmentProvider',
      'SceneSoundscapeProvider',
      'TeachingAnnotationsProvider',
      'SceneQualityProvider',
      '<ScenePostEffects',
      'SceneQualityAttributes',
    ]) {
      expect(source, `missing ${marker}`).toContain(marker);
    }
  });

  it('retires the legacy environment and camera controller from lng', () => {
    const source = read(LNG);
    expect(source).not.toContain('MaritimeEnvironment');
    expect(source).not.toContain('UnifiedCameraController');
  });

  it('feeds the wake with model-speed semantics and remounts it on reset', () => {
    const source = read(LNG);
    const rigStart = source.indexOf('WakeTrailRig');
    const rig = source.slice(rigStart, rigStart + 1600);
    expect(rig).toContain('worldSpeedSampler');
    expect(rig).toContain('state.speed');
    expect(rig).toContain('key={resetToken}');
  });

  it('wires the optimized model with error boundary and culling workaround', () => {
    const source = read(LNG);
    expect(source).toContain('VersionedFleetShip');
    expect(source).toContain("logicalId=\"lng-carrier\"");
  });

  it('gates the heading indicator behind the teaching-annotations toggle', () => {
    const source = read(LNG);
    expect(source).toContain('showAnnotations');
    expect(source).toContain('TeachingAnnotationsGate');
    expect(source).toContain('HeadingIndicator');
  });
});

describe('heading convention adaptation', () => {
  it('maps platform kinematics heading to the scene forward convention', () => {
    // 平台运动学 forward = (cos h, 0, sin h)（度）；场景管线 forward = (sin h', 0, cos h')（弧度）。
    expect(platformHeadingToSceneRad(0)).toBeCloseTo(Math.PI / 2, 10);
    expect(platformHeadingToSceneRad(90)).toBeCloseTo(0, 10);
    expect(platformHeadingToSceneRad(180)).toBeCloseTo(-Math.PI / 2, 10);
    for (const deg of [30, 137, 220, 359]) {
      const sceneRad = platformHeadingToSceneRad(deg);
      const platformRad = (deg * Math.PI) / 180;
      expect(Math.sin(sceneRad)).toBeCloseTo(Math.cos(platformRad), 10);
      expect(Math.cos(sceneRad)).toBeCloseTo(Math.sin(platformRad), 10);
    }
  });

  it('feeds wake and camera samplers through the adapter, never bare toRadians', () => {
    const source = read(LNG);
    expect(source).toContain('transformRef.current.heading = platformHeadingToSceneRad(state.heading)');
    expect(source).toContain('headingSampler={() => platformHeadingToSceneRad(state.heading)}');
    expect(source).not.toContain('headingSampler={() => toRadians(');
  });
});
