import { describe, expect, it, vi } from 'vitest';

import {
  computeVisualWaterPose,
  createMarineFrameRunner,
  createMarineVisualClock,
  marineWorldToRenderLocal,
  resolveMarineVisualPose,
  type MarineFrameInputs,
  type MarinePoseOwnership,
} from '@/resources/simulations/scene/frame/marine-frame';

function fixtureInputs(overrides: Partial<MarineFrameInputs> = {}): MarineFrameInputs {
  return {
    worldPoseSampler: () => ({ x: 100, z: -40, headingRad: 0.5 }),
    simulationTimeSampler: () => 42,
    advancingSampler: () => true,
    waterSampler: (worldX, worldZ, timeSeconds) => Math.sin(worldX * 0.01 + worldZ * 0.02 + timeSeconds * 0.3),
    ownership: { heave: 'visual-water', pitch: 'visual-water', roll: 'visual-water' },
    ...overrides,
  };
}

describe('marine visual clock (#2097)', () => {
  it('advances monotonically from injected deltas without reading wall clocks', () => {
    const clock = createMarineVisualClock();
    clock.advance(1 / 60);
    clock.advance(1 / 60);
    expect(clock.timeSeconds()).toBeCloseTo(2 / 60, 12);
  });

  it('ignores non-finite and non-positive deltas', () => {
    const clock = createMarineVisualClock({ initialTimeSeconds: 10 });
    clock.advance(Number.NaN);
    clock.advance(-5);
    clock.advance(0);
    expect(clock.timeSeconds()).toBe(10);
  });

  it('seeks to an injected deterministic time and resets to the epoch', () => {
    const clock = createMarineVisualClock({ initialTimeSeconds: 3 });
    clock.seek(120.5);
    expect(clock.timeSeconds()).toBe(120.5);
    clock.reset();
    expect(clock.timeSeconds()).toBe(3);
  });
});

describe('marine frame runner (#2097)', () => {
  it('freezes one read-only snapshot per frame and reuses it for same-stamp consumers', () => {
    const runner = createMarineFrameRunner(fixtureInputs());
    const first = runner.consumeFrame(1, 1 / 60);
    const second = runner.consumeFrame(1, 1 / 60);
    expect(second).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);

    const nextFrame = runner.consumeFrame(2, 1 / 60);
    expect(nextFrame).not.toBe(first);
    expect(nextFrame.visualTimeSeconds).toBeCloseTo(2 / 60, 12);
  });

  it('binds water sampling to the frozen visual time and world coordinates', () => {
    const waterSampler = vi.fn((x: number, z: number, t: number) => x + z + t);
    const runner = createMarineFrameRunner(fixtureInputs({ waterSampler }));
    const snapshot = runner.consumeFrame(1, 2);
    const height = snapshot.sampleWaterHeight(5, 7);
    expect(height).toBe(5 + 7 + 2);
    expect(waterSampler).toHaveBeenCalledWith(5, 7, 2);
  });

  it('carries environment preset and quality tier identity without changing ownership', () => {
    const runner = createMarineFrameRunner(fixtureInputs({
      environmentPresetIdSampler: () => 'storm-blue',
      qualityTierSampler: () => 'low',
    }));
    const snapshot = runner.consumeFrame(1, 1 / 60);
    expect(snapshot.environmentPresetId).toBe('storm-blue');
    expect(snapshot.qualityTier).toBe('low');
    // 预设/画质只携带身份信息：姿态所有权声明不随之变化。
    expect(snapshot.ownership).toEqual({ heave: 'visual-water', pitch: 'visual-water', roll: 'visual-water' });
    const unstyled = createMarineFrameRunner(fixtureInputs()).consumeFrame(1, 1 / 60);
    expect(unstyled.environmentPresetId).toBeNull();
    expect(unstyled.qualityTier).toBeNull();
  });

  it('latest() returns the most recent snapshot and null before the first frame', () => {
    const runner = createMarineFrameRunner(fixtureInputs());
    expect(runner.latest()).toBeNull();
    const snapshot = runner.consumeFrame(1, 1 / 60);
    expect(runner.latest()).toBe(snapshot);
  });

  it('keeps visual time advancing while advancing=false (pause keeps the environment alive)', () => {
    const runner = createMarineFrameRunner(fixtureInputs({ advancingSampler: () => false }));
    const paused = runner.consumeFrame(1, 1 / 60);
    expect(paused.advancing).toBe(false);
    expect(paused.visualTimeSeconds).toBeCloseTo(1 / 60, 12);
  });

  it('reproduces identical state for identical time, epoch, and inputs (deterministic replay)', () => {
    const pose = { x: 12, z: 34, headingRad: 1.2 };
    let time = 0;
    const buildRunner = () => createMarineFrameRunner(fixtureInputs({
      worldPoseSampler: () => pose,
      simulationTimeSampler: () => time,
      waterSampler: (worldX, worldZ, t) => Math.sin(worldX + worldZ * 0.5 + t),
    }));
    const drive = (runner: ReturnType<typeof buildRunner>, stamps: number[], delta: number) =>
      stamps.map((stamp) => {
        const snapshot = runner.consumeFrame(stamp, delta);
        return snapshot.sampleWaterHeight(pose.x, pose.z);
      });

    const left = drive(buildRunner(), [1, 2, 3, 4], 1 / 60);
    time += 10;
    const right = drive(buildRunner(), [1, 2, 3, 4], 1 / 60);
    expect(right).toEqual(left);
  });
});

describe('pose ownership resolution (#2097)', () => {
  const visualWater = { heave: 1.5, pitch: 0.05, roll: -0.08 };
  const telemetry = { heave: 0.9, pitch: 0.01, roll: 0.12 };

  it('displays telemetry-owned motion read-only without adding a visual response', () => {
    const ownership: MarinePoseOwnership = { heave: 'telemetry', pitch: 'telemetry', roll: 'telemetry' };
    const resolved = resolveMarineVisualPose({ ownership, visualWater, telemetry });
    expect(resolved).toEqual(telemetry);
  });

  it('uses the shared wave field for visual-water-owned degrees of freedom', () => {
    const ownership: MarinePoseOwnership = { heave: 'visual-water', pitch: 'visual-water', roll: 'visual-water' };
    expect(resolveMarineVisualPose({ ownership, visualWater, telemetry })).toEqual(visualWater);
  });

  it('keeps fixed degrees of freedom at zero regardless of inputs', () => {
    const ownership: MarinePoseOwnership = { heave: 'fixed', pitch: 'fixed', roll: 'fixed' };
    expect(resolveMarineVisualPose({ ownership, visualWater, telemetry })).toEqual({
      heave: 0,
      pitch: 0,
      roll: 0,
    });
  });

  it('mixes ownership per degree of freedom (cruise numerical roll scenario)', () => {
    const ownership: MarinePoseOwnership = { heave: 'visual-water', pitch: 'visual-water', roll: 'telemetry' };
    const resolved = resolveMarineVisualPose({ ownership, visualWater, telemetry });
    expect(resolved.heave).toBe(visualWater.heave);
    expect(resolved.pitch).toBe(visualWater.pitch);
    // 数值横摇保持只读：既不被覆盖，也不叠加视觉响应。
    expect(resolved.roll).toBe(telemetry.roll);
  });

  it('falls back to zero when telemetry is missing for a telemetry-owned dof', () => {
    const ownership: MarinePoseOwnership = { heave: 'telemetry', pitch: 'telemetry', roll: 'telemetry' };
    expect(resolveMarineVisualPose({ ownership, visualWater })).toEqual({ heave: 0, pitch: 0, roll: 0 });
  });
});

describe('world coordinates and render origin (#2097)', () => {
  it('keeps wave phase anchored to the world point when the render origin moves', () => {
    const waves = (worldX: number, worldZ: number, timeSeconds: number) =>
      Math.sin(worldX * 0.05 + worldZ * 0.03 + timeSeconds);
    const worldPoint = { x: 777, z: -321 };
    const time = 8.25;

    const originA = { x: 0, z: 0 };
    const originB = { x: 700, z: -300 };
    const localA = marineWorldToRenderLocal(worldPoint.x, worldPoint.z, originA);
    const localB = marineWorldToRenderLocal(worldPoint.x, worldPoint.z, originB);
    // 渲染局部坐标不同……
    expect(localA).not.toEqual(localB);
    // ……但同一世界点 + 同一时间的波相位（世界坐标采样）保持不变。
    const sampleAt = (origin: { x: number; z: number }) =>
      waves(origin.x + marineWorldToRenderLocal(worldPoint.x, worldPoint.z, origin).x,
        origin.z + marineWorldToRenderLocal(worldPoint.x, worldPoint.z, origin).z, time);
    expect(sampleAt(originA)).toBeCloseTo(sampleAt(originB), 12);
  });

  it('derives hull pose from the shared sampler as a pure function of pose and time', () => {
    const sampler = (x: number, z: number) => Math.sin(x * 0.02) + Math.cos(z * 0.01);
    const pose = { x: 50, z: 20, headingRad: Math.PI / 3 };
    const dims = { length: 180, width: 20 };
    const first = computeVisualWaterPose(sampler, pose, dims);
    const replay = computeVisualWaterPose(sampler, pose, dims);
    expect(replay).toEqual(first);
    expect(first.heave).toBeCloseTo(sampler(pose.x, pose.z), 12);
    // 艏艉采样差为零（对称采样点同高）时姿态为零。
    const flatSampler = () => 3.5;
    expect(computeVisualWaterPose(flatSampler, pose, dims)).toEqual({ heave: 3.5, pitch: 0, roll: 0 });
  });
});
