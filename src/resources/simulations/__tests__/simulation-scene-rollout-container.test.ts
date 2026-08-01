import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const CONTAINER = path.join(process.cwd(), 'src/resources/simulations/simulations/container-simulation.tsx');
const PROFILE = path.join(process.cwd(), 'src/resources/simulations/profiles/container-msc-scene.ts');

const read = (file: string) => readFileSync(file, 'utf8');

describe('container scene visual profile', () => {
  it('pins ship length, design speed, model url, and wake anchors', () => {
    const source = read(PROFILE);
    expect(source).toContain('shipLengthMeters: 399.9');
    expect(source).toContain('designSpeedKnots: 20');
    expect(source).toContain('/assets/models-opt/container.glb');
    expect(source).toContain('wakeAnchors');
  });
});

describe('container pipeline integration', () => {
  it('mounts every pipeline layer in the container scene', () => {
    const source = read(CONTAINER);
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

  it('retires the legacy environment and camera controller from container', () => {
    const source = read(CONTAINER);
    expect(source).not.toContain('MaritimeEnvironment');
    expect(source).not.toContain('UnifiedCameraController');
  });

  it('feeds the wake with model-speed semantics and remounts it on reset', () => {
    const source = read(CONTAINER);
    const rigStart = source.indexOf('WakeTrailRig');
    const rig = source.slice(rigStart, rigStart + 1600);
    expect(rig).toContain('worldSpeedSampler');
    expect(rig).toContain('state.speed');
    expect(rig).toContain('key={resetToken}');
  });

  it('wires the optimized model with error boundary and culling workaround', () => {
    const source = read(CONTAINER);
    expect(source).toContain('models-opt/container.glb');
    expect(source).toContain('ModelAssetErrorBoundary');
    expect(source).toContain('frustumCulled = false');
  });

  it('gates the heading indicator behind the teaching-annotations toggle and keeps wind indicator', () => {
    const source = read(CONTAINER);
    expect(source).toContain('showAnnotations');
    expect(source).toContain('TeachingAnnotationsGate');
    expect(source).toContain('HeadingIndicator');
    expect(source).toContain('WindIndicator');
  });
});

describe('container heading convention adaptation', () => {
  it('feeds wake and camera samplers through the adapter, never bare toRadians', () => {
    const source = read(CONTAINER);
    expect(source).toContain('transformRef.current.heading = platformHeadingToSceneRad(state.heading)');
    expect(source).toContain('headingSampler={() => platformHeadingToSceneRad(state.heading)}');
    expect(source).not.toContain('headingSampler={() => toRadians(');
  });
});
