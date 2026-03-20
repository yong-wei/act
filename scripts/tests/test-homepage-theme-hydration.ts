import assert from 'node:assert/strict';

import { getHomepageScenarioBackgroundClass } from '../../src/lib/homepage-theme';

assert.equal(
  getHomepageScenarioBackgroundClass({
    mounted: false,
    theme: 'light',
    scenarioGradient: 'from-[#0b1f3a] via-[#112b55] to-[#0c1836]',
  }),
  'bg-gradient-to-br from-[#0b1f3a] via-[#112b55] to-[#0c1836]',
  '未挂载时首页背景应返回稳定的首帧类名，避免 hydration mismatch',
);

assert.equal(
  getHomepageScenarioBackgroundClass({
    mounted: true,
    theme: 'light',
    scenarioGradient: 'from-[#0b1f3a] via-[#112b55] to-[#0c1836]',
  }),
  'bg-gradient-to-br from-sky-100 via-cyan-50 to-slate-100',
  '挂载后浅色模式应切换到浅色背景',
);

console.log('homepage theme hydration test passed');
