import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const DREDGER = path.join(process.cwd(), 'src/resources/simulations/simulations/dredger-simulation.tsx');
const PROFILE = path.join(process.cwd(), 'src/resources/simulations/profiles/dredger-tianjing-scene.ts');

const read = (file: string) => readFileSync(file, 'utf8');

describe('dredger scene visual profile', () => {
  it('pins ship length, design speed, model url, and wake anchors', () => {
    const source = read(PROFILE);
    expect(source).toContain('shipLengthMeters: 127.5');
    expect(source).toContain('designSpeedKnots: 12');
    expect(source).toContain('/assets/models-opt/dredger.glb');
    expect(source).toContain('wakeAnchors');
  });
});

describe('dredger pipeline integration', () => {
  it('mounts every pipeline layer in the dredger scene', () => {
    const source = read(DREDGER);
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
      'EnvironmentPresetSwitcher',
      'SoundscapeMuteToggle',
      'TeachingAnnotationsToggle',
      'SceneQualitySelect',
    ]) {
      expect(source, `missing ${marker}`).toContain(marker);
    }
  });

  it('retires the legacy environment and camera controller from dredger', () => {
    const source = read(DREDGER);
    expect(source).not.toContain('MaritimeEnvironment');
    expect(source).not.toContain('UnifiedCameraController');
  });

  it('feeds the wake with body-frame speed magnitude and remounts it on reset', () => {
    const source = read(DREDGER);
    const rigStart = source.indexOf('WakeTrailRig');
    const rig = source.slice(rigStart, rigStart + 1600);
    expect(rig).toContain('worldSpeedSampler');
    expect(rig).toContain('Math.hypot(mmgStateRef.current.u, mmgStateRef.current.v)');
    expect(rig).toContain('key={resetToken}');
  });

  it('wires the optimized model with error boundary and culling workaround', () => {
    const source = read(DREDGER);
    expect(source).toContain('models-opt/dredger.glb');
    expect(source).toContain('ModelAssetErrorBoundary');
    expect(source).toContain('frustumCulled = false');
  });

  it('aligns the model bow with the platform kinematics (X-axis GLB)', () => {
    const source = read(DREDGER);
    expect(source).toContain('groupRef.current.rotation.y = -heading;');
    expect(source).not.toContain('-heading + Math.PI / 2 + Math.PI');
  });

  it('gates the target marker behind the teaching-annotations toggle and keeps trajectory', () => {
    const source = read(DREDGER);
    expect(source).toContain('showAnnotations');
    expect(source).toContain('TeachingAnnotationsGate');
    expect(source).toContain('TargetMarker');
    expect(source).toContain('TrajectoryLine');
  });
});

describe('dredger heading convention adaptation', () => {
  it('feeds wake and camera samplers through the adapter on psi radians', () => {
    const source = read(DREDGER);
    expect(source).toContain('transformRef.current.heading = platformHeadingToSceneRad(toDegrees(mmgStateRef.current.psi))');
    expect(source).toContain('headingSampler={() => platformHeadingToSceneRad(toDegrees(mmgStateRef.current.psi))}');
    expect(source).not.toContain('headingSampler={() => toRadians(');
  });
});
