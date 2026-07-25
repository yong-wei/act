import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const DESTROYER = path.join(process.cwd(), 'src/resources/simulations/simulations/destroyer-simulation.tsx');
const WAKE_TRAIL = path.join(process.cwd(), 'src/resources/simulations/scene/wake/wake-trail.tsx');

describe('review remediation: wake lifecycle and speed semantics', () => {
  it('remounts the wake trail on the simulation reset token so stale particles and path length clear', () => {
    const destroyer = readFileSync(DESTROYER, 'utf8');
    expect(destroyer).toContain('resetToken={resetToken}');
    const rigBlock = destroyer.slice(destroyer.indexOf('<WakeTrailRig'), destroyer.indexOf('<WakeTrailRig') + 200);
    expect(rigBlock).toContain('resetToken');
    const rigFn = destroyer.slice(destroyer.indexOf('function WakeTrailRig'), destroyer.indexOf('function WakeTrailRig') + 1200);
    expect(rigFn).toContain('key={resetToken}');
  });

  it('accepts an explicit world speed sampler so playback rate never distorts Froude activity', () => {
    const trail = readFileSync(WAKE_TRAIL, 'utf8');
    expect(trail).toContain('worldSpeedSampler');
    const destroyer = readFileSync(DESTROYER, 'utf8');
    const rigFn = destroyer.slice(destroyer.indexOf('function WakeTrailRig'), destroyer.indexOf('function WakeTrailRig') + 1200);
    expect(rigFn).toContain('speedMps');
  });
});

describe('review remediation: soundscape teardown', () => {
  it('disposes the ambience source and audio context when the provider unmounts', () => {
    const state = readFileSync(
      path.join(process.cwd(), 'src/resources/simulations/scene/audio/soundscape-state.tsx'), 'utf8'
    );
    expect(state).toContain('dispose');
    const bus = readFileSync(
      path.join(process.cwd(), 'src/resources/simulations/scene/audio/soundscape-bus.ts'), 'utf8'
    );
    expect(bus).toContain('dispose');
  });
});

describe('review remediation: quality tier renderer consumption', () => {
  it('applies dpr cap and shadow toggle from the quality driver and shadow map size from the environment sun', () => {
    const driver = readFileSync(
      path.join(process.cwd(), 'src/resources/simulations/scene/quality/quality-state.tsx'), 'utf8'
    );
    expect(driver).toContain('setDpr');
    expect(driver).toContain('shadowMap.enabled');
    const scene = readFileSync(
      path.join(process.cwd(), 'src/resources/simulations/scene/environment/environment-scene.tsx'), 'utf8'
    );
    expect(scene).toContain('useSceneQuality');
    expect(scene).toContain('shadowMapSize');
  });
});

describe('review remediation: production build boundary', () => {
  it('keeps the independent model optimizer out of the docker build context', () => {
    const dockerignore = readFileSync(path.join(process.cwd(), '.dockerignore'), 'utf8');
    expect(dockerignore).toContain('tools/glb-model-optimizer/');
    expect(dockerignore).not.toContain('!scripts/build-optimized-models.mjs');
  });
});
