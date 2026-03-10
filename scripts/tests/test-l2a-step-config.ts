import assert from 'node:assert/strict';

import {
  L2A_LESSON_STEPS,
  L2A_WORKSPACE_PERSIST_STEP_IDS,
  L2A_WORKSPACE_VISIBLE_STEP_IDS,
} from '../../src/lib/l2a-course';

const expectedIds = [
  'knowledge-map',
  'bridge-in-1',
  'bridge-in-2',
  'objective',
  'pre-assessment',
  'participatory-intro-1',
  'participatory-families-1',
  'participatory-families-2',
  'participatory-intro-2',
  'participatory-metrics-1',
  'participatory-metrics-2',
  'participatory-intro-3',
  'participatory-zeta',
  'participatory-wn',
  'participatory-table',
  'participatory-limit',
  'post-assessment',
  'summary',
];

assert.deepEqual(
  L2A_LESSON_STEPS.map((step) => step.id),
  expectedIds,
  'L-2a 步骤顺序应与互动设计文档保持一致',
);

for (const stepId of expectedIds) {
  assert.equal(L2A_WORKSPACE_PERSIST_STEP_IDS.has(stepId), true, `${stepId} 应保持左侧工作区常驻`);
  assert.equal(L2A_WORKSPACE_VISIBLE_STEP_IDS.has(stepId), true, `${stepId} 应显示左侧工作区`);
}

console.log('l2a step config test passed');
