import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { effectiveBindingSpeedMps } from '../components/semantic-bindings-rig';

const SIMULATION_SOURCE = readFileSync(
  path.join(__dirname, '..', 'simulations', 'destroyer-simulation.tsx'),
  'utf8',
);
const WAKE_TRAIL_SOURCE = readFileSync(
  path.join(__dirname, '..', 'scene', 'wake', 'wake-trail.tsx'),
  'utf8',
);

describe('有效航速门控：仿真不推进时速度类视觉绑定归零', () => {
  it('advancing 为 false 时有效航速为 0（桨停转、天线回正）', () => {
    expect(effectiveBindingSpeedMps({ rudderDeg: 0, speedMps: 15, attainedCount: 0, advancing: false })).toBe(0);
  });

  it('advancing 为 true 时有效航速等于物理航速', () => {
    expect(effectiveBindingSpeedMps({ rudderDeg: 0, speedMps: 15, attainedCount: 0, advancing: true })).toBe(15);
  });

  it('advancing 缺省视为推进中（向后兼容）', () => {
    expect(effectiveBindingSpeedMps({ rudderDeg: 0, speedMps: 15, attainedCount: 0 })).toBe(15);
  });
});

describe('仿真引擎推进门控接线', () => {
  it('初始与重置状态均为不推进（停止时螺旋桨静止）', () => {
    const stateBlocks = SIMULATION_SOURCE.match(/attainedCount: 0,\s*\n\s*advancing: false,/g) ?? [];
    expect(stateBlocks.length).toBeGreaterThanOrEqual(2);
  });

  it('advancing 每帧按 运行中 && 运行时就绪 && 未播完 重算', () => {
    expect(SIMULATION_SOURCE).toContain(
      'simRef.current.advancing = isRunning && runtimeReady && !finishedRef.current;',
    );
  });

  it('仿真播完（simTime 超 duration）标记 finished 并关闭推进门控', () => {
    expect(SIMULATION_SOURCE).toContain('finishedRef.current = true;');
    expect(SIMULATION_SOURCE).toContain('simRef.current.advancing = false;');
  });

  it('尾迹发射航速经 advancing 门控（停止即零速，活跃度归零不再发射）', () => {
    const gated = SIMULATION_SOURCE.match(
      /worldSpeedSampler=\{\(\) => \(simRef\.current\.advancing \? simRef\.current\.speedMps : 0\)\}/g,
    ) ?? [];
    expect(gated.length).toBeGreaterThanOrEqual(2);
  });
});

describe('尾迹生命周期：停发后存量粒子继续老化直至完全消散', () => {
  it('发射受 playing 门控，老化与几何刷新在门控之外每帧执行', () => {
    // 发射门控谓词允许扩展（#2115 归因隔离叠加 !vesselFoamSuppressed）；
    // 契约锚定 if (playing 前缀而非完整谓词。
    const emitBlock = WAKE_TRAIL_SOURCE.indexOf('if (playing');
    const agingBlock = WAKE_TRAIL_SOURCE.indexOf('buffer.update(state.simTime, state.pathLength);');
    expect(emitBlock).toBeGreaterThan(-1);
    expect(agingBlock).toBeGreaterThan(emitBlock);
    // 老化调用不在 if (playing) 块内：其后不再有按 playing 的早退
    const tail = WAKE_TRAIL_SOURCE.slice(agingBlock);
    expect(tail).toContain('updateWakeTrailGeometry(handle, buffer, state.simTime, waterYSampler);');
    expect(tail).not.toContain('if (!playing');
  });

  it('早期冻结语义已移除（不再存在 !playing 整体早退）', () => {
    expect(WAKE_TRAIL_SOURCE).not.toContain('if (!playing || !buffer.style.enabled)');
  });
});
