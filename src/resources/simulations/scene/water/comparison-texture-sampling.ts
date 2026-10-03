import type { Node } from 'three/webgpu';
import { texture, vec2, mix, vec4 } from 'three/tsl';

/** 同源四点插值：不依赖设备是否支持浮点纹理线性过滤。域外历史为零。 */
export function sampleBilinearHistory(source: ReturnType<typeof texture>, at: Node<'vec2'>, size: number) {
  const grid = at.mul(size).sub(0.5);
  const base = grid.floor().add(0.5).div(size);
  const f = grid.fract();
  const cell = 1 / size;
  const value = mix(mix(source.sample(base), source.sample(base.add(vec2(cell, 0))), f.x),
    mix(source.sample(base.add(vec2(0, cell))), source.sample(base.add(vec2(cell))), f.x), f.y);
  const inside = at.x.greaterThan(0).and(at.x.lessThan(1)).and(at.y.greaterThan(0)).and(at.y.lessThan(1));
  return inside.select(value, vec4(0));
}

/** 背景 FFT 的周期采样；细网格不能继续使用最近邻阶梯高度。 */
export function sampleBilinearPeriodic(source: ReturnType<typeof texture>, at: Node<'vec2'>, size: number) {
  const grid = at.mul(size).sub(0.5), base = grid.floor().add(0.5).div(size), f = grid.fract();
  const cell = 1 / size;
  return mix(mix(source.sample(base.fract()), source.sample(base.add(vec2(cell, 0)).fract()), f.x),
    mix(source.sample(base.add(vec2(0, cell)).fract()), source.sample(base.add(vec2(cell)).fract()), f.x), f.y);
}
