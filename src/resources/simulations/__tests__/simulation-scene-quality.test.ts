import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createQualityGovernor,
  probeDefaultQualityTier,
  QUALITY_FRAME_BUDGET_MS,
  SCENE_QUALITY_TIERS,
  type QualityTierId,
} from '../scene/quality/quality-tiers';

describe('quality tier catalog', () => {
  it('scales post, particles, shadows, and water down across tiers', () => {
    expect(SCENE_QUALITY_TIERS.high.postEnabled).toBe(true);
    expect(SCENE_QUALITY_TIERS.medium.postEnabled).toBe(true);
    expect(SCENE_QUALITY_TIERS.low.postEnabled).toBe(false);
    expect(SCENE_QUALITY_TIERS.high.particleScale).toBeGreaterThan(SCENE_QUALITY_TIERS.medium.particleScale);
    expect(SCENE_QUALITY_TIERS.medium.particleScale).toBeGreaterThan(SCENE_QUALITY_TIERS.low.particleScale);
    expect(SCENE_QUALITY_TIERS.high.shadowMapSize).toBeGreaterThan(SCENE_QUALITY_TIERS.low.shadowMapSize);
    expect(SCENE_QUALITY_TIERS.high.waterTier).toBe('high');
    expect(SCENE_QUALITY_TIERS.medium.waterTier).toBe('medium');
    expect(SCENE_QUALITY_TIERS.low.waterTier).toBe('low');
  });
});

describe('probe default quality tier', () => {
  it('maps device capability signals to a default tier', () => {
    expect(probeDefaultQualityTier({ isMobile: false, hardwareConcurrency: 12, devicePixelRatio: 2 })).toBe('high');
    expect(probeDefaultQualityTier({ isMobile: false, hardwareConcurrency: 4, devicePixelRatio: 1 })).toBe('medium');
    expect(probeDefaultQualityTier({ isMobile: true, hardwareConcurrency: 4, devicePixelRatio: 3 })).toBe('low');
    expect(probeDefaultQualityTier({ isMobile: false, hardwareConcurrency: 12, devicePixelRatio: 2, softwareRenderer: true })).toBe('low');
  });
});

describe('quality governor auto-degradation', () => {
  const FRAME_OVER_BUDGET = QUALITY_FRAME_BUDGET_MS + 8;

  it('degrades one tier after sustained over-budget frames and honors cooldown', () => {
    const governor = createQualityGovernor({ initialTier: 'high' });
    let nowMs = 0;
    const feed = (frames: number, frameMs: number) => {
      for (let index = 0; index < frames; index += 1) {
        nowMs += frameMs;
        governor.reportFrame(frameMs, nowMs);
      }
    };
    feed(50, FRAME_OVER_BUDGET);
    expect(governor.tier).toBe('medium');
    const cooldownTier = governor.tier;
    feed(10, FRAME_OVER_BUDGET);
    expect(governor.tier).toBe(cooldownTier);
  });

  it('does not degrade while frames stay within budget', () => {
    const governor = createQualityGovernor({ initialTier: 'high' });
    let nowMs = 0;
    for (let index = 0; index < 60; index += 1) {
      nowMs += 12;
      governor.reportFrame(12, nowMs);
    }
    expect(governor.tier).toBe('high');
  });

  it('lets manual override win over probing and auto-degradation', () => {
    const governor = createQualityGovernor({ initialTier: 'high' });
    governor.setOverride('low');
    expect(governor.tier).toBe('low');
    let nowMs = 0;
    for (let index = 0; index < 90; index += 1) {
      nowMs += 12;
      governor.reportFrame(12, nowMs);
    }
    expect(governor.tier).toBe('low');
    governor.setOverride(null);
  });
});

describe('sample experiment quality wiring', () => {
  it('drives water, wake, and post effects from the quality context in the sample experiment', () => {
    const destroyer = readFileSync(
      path.join(process.cwd(), 'src/resources/simulations/simulations/destroyer-simulation.tsx'), 'utf8'
    );
    expect(destroyer).toContain('SceneQualityProvider');
    expect(destroyer).toContain('useSceneQuality');
    expect(destroyer).toContain('ScenePostEffects');
    const post = readFileSync(
      path.join(process.cwd(), 'src/resources/simulations/scene/post/scene-post-effects.tsx'), 'utf8'
    );
    expect(post).toContain('@react-three/postprocessing');
  });
});

describe('model optimization pipeline', () => {
  it('isolates GLB production dependencies from the application build', () => {
    const pkg = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    const rootDependencies = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(pkg.scripts.build).not.toContain('models:produce');
    expect(pkg.scripts['models:produce']).toContain('tools/glb-model-optimizer');
    expect(rootDependencies).not.toHaveProperty('@gltf-transform/core');
    expect(rootDependencies).not.toHaveProperty('@gltf-transform/extensions');
    expect(rootDependencies).not.toHaveProperty('@gltf-transform/functions');
    expect(rootDependencies).not.toHaveProperty('meshoptimizer');

    const toolPkg = JSON.parse(readFileSync(
      path.join(process.cwd(), 'tools/glb-model-optimizer/package.json'), 'utf8'
    ));
    expect(toolPkg.dependencies).toMatchObject({
      '@gltf-transform/core': expect.any(String),
      '@gltf-transform/extensions': expect.any(String),
      '@gltf-transform/functions': expect.any(String),
      meshoptimizer: expect.any(String),
    });

    const syncScript = readFileSync(
      path.join(process.cwd(), 'scripts/dev/sync-local-worktree-config.sh'), 'utf8'
    );
    expect(syncScript).toContain('public/assets/models-opt');
  });

  it('uses independently produced meshopt assets and wires the decoder at runtime', () => {
    const simulationDirectory = path.join(process.cwd(), 'src/resources/simulations/simulations');
    const runtimeSources = readdirSync(simulationDirectory)
      .filter((name) => name.endsWith('.tsx'))
      .map((name) => readFileSync(path.join(simulationDirectory, name), 'utf8'))
      .join('\n');
    const modelNames = readdirSync(path.join(process.cwd(), 'public/assets'))
      .filter((name) => name.endsWith('.glb'));

    for (const modelName of modelNames) {
      expect(runtimeSources).toContain(`/assets/models-opt/${modelName}`);
    }

    const destroyer = readFileSync(
      path.join(simulationDirectory, 'destroyer-simulation.tsx'), 'utf8'
    );
    expect(destroyer).toContain('models-opt/destroyer.glb');
    expect(destroyer).toContain('useGLTF(url, true, true)');
    expect(destroyer).toContain('ModelAssetErrorBoundary');
  });

  it('keeps the original GLB as a documented fallback when optimization fails', () => {
    const script = readFileSync(
      path.join(process.cwd(), 'tools/glb-model-optimizer/optimize-models.mjs'), 'utf8'
    );
    expect(script).toContain('fallback');
  });
});

describe('progressive scene loading', () => {
  it('shows a progress-driven model placeholder instead of text-only loading', () => {
    const placeholder = readFileSync(
      path.join(process.cwd(), 'src/resources/simulations/components/model-loading-placeholder.tsx'), 'utf8'
    );
    expect(placeholder).toContain('useProgress');
  });
});
