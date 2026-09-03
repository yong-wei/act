import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { SIMULATION_MODEL_REGISTRY, resolveRegisteredSimulationModel } from '@/lib/browser-delivery/client';
import { TYPE055_NANCHANG_101_V2 } from '../model-packages/type055-nanchang-101-v2';

/**
 * issue #1898 候选接入守卫：默认走旧模型、显式参数才启用候选、
 * 武器角色不进入首屏请求、受保护旧式场景与七模型 registry 不变。
 */

const DESTROYER = path.join(process.cwd(), 'src/resources/simulations/simulations/destroyer-simulation.tsx');
const LEGACY_DESTROYER = path.join(process.cwd(), 'src/resources/simulations/destroyer-simulation.tsx');

const read = (file: string) => readFileSync(file, 'utf-8');

function changedFiles(): string[] {
  const mergeBase = execSync('git merge-base HEAD origin/integration', { encoding: 'utf-8' }).trim();
  const output = execSync(`git diff --name-only ${mergeBase} HEAD`, { encoding: 'utf-8' });
  const unstaged = execSync('git diff --name-only', { encoding: 'utf-8' });
  const staged = execSync('git diff --name-only --cached', { encoding: 'utf-8' });
  return [...new Set([...output.split('\n'), ...unstaged.split('\n'), ...staged.split('\n')])].filter(Boolean);
}

describe('type055 candidate wiring keeps the legacy default', () => {
  it('keeps the seven-model registry resolution unchanged', () => {
    expect(Object.keys(SIMULATION_MODEL_REGISTRY).sort()).toEqual([
      'container', 'destroyer', 'dredger', 'drilling-rig', 'icebreaker', 'lng-carrier', 'luxury-liner',
    ]);
    expect(resolveRegisteredSimulationModel('destroyer').candidates).toEqual([
      '/assets/models-opt/destroyer.glb',
      '/assets/destroyer.glb',
    ]);
    // 版本化模型包与单文件 registry 共存但分离：不进入七模型 registry 键集
    expect(SIMULATION_MODEL_REGISTRY).not.toHaveProperty(TYPE055_NANCHANG_101_V2.packageId);
  });

  it('gates the candidate behind an explicit query parameter with the legacy default path intact', () => {
    const source = read(DESTROYER);
    expect(source).toContain('useType055V2CandidateEnabled');
    expect(source).toContain('isType055V2CandidateSearch');
    // 默认分支：现有候选链 + 既有渲染语义（保留 FallbackGltfModel 标记，驱动链测试也依赖）
    expect(source).toContain("candidates={MODEL.candidates}\n        render={(url) => <DestroyerModelScene url={url} simRef={simRef} />}");
    // 坐标基适配只在候选挂载处应用一次
    expect(source).toContain('basisYawRad={TYPE055_V2_BASIS_YAW_RAD}');
    // 定义（props 类型 + 解构默认）+ 候选挂载应用，不散落其它补偿旋转
    expect(source.match(/basisYawRad/g)?.length).toBeGreaterThanOrEqual(3);
    // 旧模型路径不应用基旋转
    expect(source).not.toContain('basisYawRad={0}');
  });

  it('applies the coordinate basis exactly once at the candidate mount', () => {
    const source = read(DESTROYER);
    // 组件内唯一的补偿旋转挂点：内层 <group rotation-y>
    expect(source).toContain('<group rotation-y={basisYawRad}>');
    expect(source).not.toMatch(/rotation\.set\([^)]*Math\.PI \/ 4/);
  });

  it('does not eagerly request payload, demo, or collision roles from the destroyer scene', () => {
    const source = read(DESTROYER);
    for (const role of ['payload', 'demo', 'collision'] as const) {
      const url = TYPE055_NANCHANG_101_V2.roles[role].url;
      expect(source, `${role} must not appear in destroyer scene`).not.toContain(url);
    }
    // 只有 ship LOD 参与档位选择（LOD 解析在共享 VersionedShipModel 内）
    expect(source).toContain('<VersionedShipModel');
    expect(source).toContain('descriptor={TYPE055_NANCHANG_101_V2}');
    // 预载仍指向旧 registry 主候选，但候选启用时跳过（首屏恰好一个 ship LOD）
    expect(source).toContain('useGLTF.preload(MODEL.primary)');
    expect(source).toContain('!isType055V2CandidateSearch(window.location.search)');
    expect(source).not.toContain('useGLTF.preload(TYPE055');
  });

  it('leaves the protected legacy simulation file untouched', () => {
    const changed = changedFiles();
    expect(changed, `protected legacy file changed: ${LEGACY_DESTROYER}`).not.toContain('src/resources/simulations/destroyer-simulation.tsx');
    expect(read(LEGACY_DESTROYER)).toContain('DestroyerSimulation');
  });

  it('keeps the simulation drive chain imports unchanged', () => {
    const source = read(DESTROYER);
    expect(source).toContain("import { SimulationClock } from '@/lib/simulation'");
    expect(source).toContain('buildDestroyerHifiStepRequest');
    expect(source).toContain('computeDestroyerHifiStep');
  });
});
