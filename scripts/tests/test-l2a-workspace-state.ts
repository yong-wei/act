import assert from 'node:assert/strict';

import {
  DEFAULT_L2A_WORKSPACE_STATE,
  classifySecondOrderFamily,
  computeSecondOrderMetrics,
} from '../../src/features/interactive/l2a-time-domain/workspace-model';

assert.equal(DEFAULT_L2A_WORKSPACE_STATE.zeta > 0, true, '默认阻尼比应为正数');
assert.equal(DEFAULT_L2A_WORKSPACE_STATE.wn > 0, true, '默认自然频率应为正数');

assert.equal(classifySecondOrderFamily(1.25), 'overdamped', 'ζ > 1 应判为过阻尼');
assert.equal(classifySecondOrderFamily(1), 'critical', 'ζ = 1 应判为临界阻尼');
assert.equal(classifySecondOrderFamily(0.35), 'underdamped', '0 < ζ < 1 应判为欠阻尼');
assert.equal(classifySecondOrderFamily(0), 'oscillatory', 'ζ = 0 应判为持续振荡');
assert.equal(classifySecondOrderFamily(-0.1), 'unstable', 'ζ < 0 应判为不稳定');

const underdampedMetrics = computeSecondOrderMetrics({ zeta: 0.35, wn: 2 });
assert.equal(underdampedMetrics.overshoot > 0, true, '欠阻尼系统应存在超调');
assert.equal(underdampedMetrics.settlingTime > underdampedMetrics.riseTime, true, '调节时间应大于上升时间');

const overdampedMetrics = computeSecondOrderMetrics({ zeta: 1.25, wn: 2 });
assert.equal(overdampedMetrics.overshoot, 0, '过阻尼系统超调应为 0');

console.log('l2a workspace state test passed');
