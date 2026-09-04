/**
 * 仿真循环调度契约（Issue #1945）。
 *
 * 覆盖：SimulationClock accumulator 跨帧守恒（不因分帧余数丢弃而欠计），
 * 以及 container/lng/cruise 三页仿真循环引用稳定——循环回调依赖不含每帧
 * 变化状态，运行期间 effect 不 teardown 重建，时钟不因 reset 丢弃余数。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { SimulationClock } from '@/lib/simulation/clock';
import { SIMULATION_FIXED_STEP_SECONDS, SIMULATION_MAX_SUB_STEPS } from '@/resources/simulations/lib/simulation-timing';

const simsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'simulations',
);

describe('SimulationClock accumulator 守恒（#1945）', () => {
  it('分帧推进的余数跨帧保留，累计步进时间不欠计', () => {
    const clock = new SimulationClock({ dt: SIMULATION_FIXED_STEP_SECONDS, maxSubSteps: SIMULATION_MAX_SUB_STEPS });
    let stepped = 0;
    // 60Hz 帧的典型 delta 略大于固定步长：每帧余数约 0.3ms 必须保留到下一帧，
    // 否则 600 帧（约 10.2s 仿真时间）累计欠计可达数个步长。
    const frameDt = 0.017;
    const frames = 600;
    for (let frame = 0; frame < frames; frame += 1) {
      clock.advance(frameDt, () => {
        stepped += SIMULATION_FIXED_STEP_SECONDS;
      });
    }
    const expected = frames * frameDt;
    expect(Math.abs(stepped - expected)).toBeLessThan(SIMULATION_FIXED_STEP_SECONDS);
  });

  it('reset 只在边界清零 accumulator，循环内 reset 每帧丢余数可检出', () => {
    // 反例锁定 bug 模式：每帧 advance 后 reset，累计步进显著欠计。
    const clock = new SimulationClock({ dt: SIMULATION_FIXED_STEP_SECONDS, maxSubSteps: SIMULATION_MAX_SUB_STEPS });
    let stepped = 0;
    const frameDt = 0.017;
    const frames = 600;
    for (let frame = 0; frame < frames; frame += 1) {
      clock.advance(frameDt, () => {
        stepped += SIMULATION_FIXED_STEP_SECONDS;
      });
      clock.reset();
    }
    // 每帧只走 1 步（余数被丢），欠计至少 10%。
    expect(frames * frameDt - stepped).toBeGreaterThan(0.1);
  });
});

describe('仿真循环引用稳定（#1945）', () => {
  const loops: Array<{ file: string; callback: string; effectGuard: string }> = [
    { file: 'container-simulation.tsx', callback: 'simulationLoop', effectGuard: 'clockRef.current.reset()' },
    { file: 'lng-simulation.tsx', callback: 'simulationStep', effectGuard: 'clockRef.current.reset()' },
    { file: 'cruise-simulation.tsx', callback: 'simulate', effectGuard: 'lastTimeRef.current = performance.now()' },
  ];

  it.each(loops)('$file 循环回调依赖稳定且每帧状态不进入依赖数组', ({ file, callback, effectGuard }) => {
    const source = fs.readFileSync(path.join(simsDir, file), 'utf8');

    // 循环回调 useCallback 依赖必须为空数组：每帧变化量（time/speed 等）走 ref。
    const loopMatch = source.match(new RegExp(`const ${callback} = useCallback\\([\\s\\S]*?\\n  }, \\[([^\\]]*)\\]`));
    expect(loopMatch, `${file} 缺少 ${callback} useCallback`).not.toBeNull();
    expect(loopMatch![1].trim(), `${file} ${callback} 依赖必须为空`).toBe('');

    // 启动 effect 只允许依赖低频启停状态与稳定回调，不得依赖每帧时间状态。
    const effectMatch = source.match(new RegExp(
      `\\}, \\[state\\.isRunning, state\\.isPaused, ${callback}\\]\\);|\\}, \\[simState\\.isRunning, simState\\.isPaused, ${callback}\\]\\);`
    ));
    expect(effectMatch, `${file} 启动 effect 依赖必须只含启停状态与稳定回调`).not.toBeNull();
    // 循环回调内部不得调用 clock.reset（每帧 reset 丢 accumulator）。
    const loopBody = loopMatch![0];
    expect(loopBody, `${file} ${callback} 内不得 reset 时钟`).not.toContain('reset()');
    // reset/基线重定只出现在启动 effect（effectGuard 至少出现一次）。
    expect(source).toContain(effectGuard);
  });
});
