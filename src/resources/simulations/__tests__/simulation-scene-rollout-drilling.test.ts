import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const DRILLING = path.join(process.cwd(), 'src/resources/simulations/simulations/drilling-simulation.tsx');
const PROFILE = path.join(process.cwd(), 'src/resources/simulations/profiles/drilling-hysy981-scene.ts');

const read = (file: string) => readFileSync(file, 'utf8');

describe('drilling scene visual profile', () => {
  it('pins ship length, design speed, model url, and wake anchors', () => {
    const source = read(PROFILE);
    expect(source).toContain('shipLengthMeters: 114');
    expect(source).toContain('designSpeedKnots: 8');
    expect(source).toContain('/assets/models-opt/drilling-rig.glb');
    expect(source).toContain('wakeAnchors');
  });
});

describe('drilling pipeline integration', () => {
  it('mounts every pipeline layer in the drilling scene', () => {
    const source = read(DRILLING);
    for (const marker of [
      '<EnvironmentScene',
      'GerstnerWater',
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

  it('retires the legacy environment and camera controller from drilling', () => {
    const source = read(DRILLING);
    expect(source).not.toContain('MaritimeEnvironment');
    expect(source).not.toContain('UnifiedCameraController');
  });

  it('feeds the wake with body-frame speed magnitude and remounts it on reset', () => {
    const source = read(DRILLING);
    const rigStart = source.indexOf('WakeTrailRig');
    const rig = source.slice(rigStart, rigStart + 1600);
    expect(rig).toContain('worldSpeedSampler');
    expect(rig).toContain('Math.hypot(platformStateRef.current.u, platformStateRef.current.v)');
    expect(rig).toContain('key={resetToken}');
  });

  it('wires the optimized model with error boundary and culling workaround', () => {
    const source = read(DRILLING);
    expect(source).toContain('models-opt/drilling-rig.glb');
    expect(source).toContain('ModelAssetErrorBoundary');
    expect(source).toContain('frustumCulled = false');
  });

  it('gates the target marker behind the teaching-annotations toggle and keeps trajectory', () => {
    const source = read(DRILLING);
    expect(source).toContain('showAnnotations');
    expect(source).toContain('TeachingAnnotationsGate');
    expect(source).toContain('TargetMarker');
    expect(source).toContain('TrajectoryLine');
  });
});

describe('drilling heading convention adaptation', () => {
  it('feeds wake and camera samplers through the adapter on psi radians', () => {
    const source = read(DRILLING);
    expect(source).toContain('transformRef.current.heading = platformHeadingToSceneRad(toDegrees(platformStateRef.current.psi))');
    expect(source).toContain('headingSampler={() => platformHeadingToSceneRad(toDegrees(platformStateRef.current.psi))}');
    expect(source).not.toContain('headingSampler={() => toRadians(');
  });
});
