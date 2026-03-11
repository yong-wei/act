import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  L2A_LESSON_STEPS,
  L2A_WORKSPACE_PERSIST_STEP_IDS,
  L2A_WORKSPACE_VISIBLE_STEP_IDS,
} from '../../src/lib/l2a-course';

const root = process.cwd();
const studentPagePath = path.join(root, 'src/features/interactive/l2a-time-domain/student-page.tsx');
const teacherPagePath = path.join(root, 'src/features/interactive/l2a-time-domain/teacher-page.tsx');
const studentPageContent = fs.readFileSync(studentPagePath, 'utf8');
const teacherPageContent = fs.readFileSync(teacherPagePath, 'utf8');

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

const expectedWorkspaceVisibleIds = [
  'participatory-families-2',
  'participatory-metrics-2',
  'participatory-zeta',
  'participatory-wn',
  'participatory-table',
  'participatory-limit',
];

assert.deepEqual(
  L2A_LESSON_STEPS.map((step) => step.id),
  expectedIds,
  'L-2a 步骤顺序应与互动设计文档保持一致',
);

for (const stepId of expectedIds) {
  assert.equal(L2A_WORKSPACE_PERSIST_STEP_IDS.has(stepId), true, `${stepId} 应保持工作区状态常驻`);
}

assert.deepEqual(
  Array.from(L2A_WORKSPACE_VISIBLE_STEP_IDS),
  expectedWorkspaceVisibleIds,
  '仅探索、测量与参数调节相关环节应显示双面板工作区',
);

for (const stepId of ['knowledge-map', 'bridge-in-1', 'objective', 'pre-assessment', 'post-assessment', 'summary']) {
  assert.equal(L2A_WORKSPACE_VISIBLE_STEP_IDS.has(stepId), false, `${stepId} 不应显示双面板工作区`);
}

assert.equal(
  studentPageContent.includes('showWorkspace ?') || studentPageContent.includes('L2A_WORKSPACE_VISIBLE_STEP_IDS.has'),
  true,
  '学生端应按环节条件显示工作区',
);

assert.equal(
  teacherPageContent.includes('showWorkspace ?') || teacherPageContent.includes('L2A_WORKSPACE_VISIBLE_STEP_IDS.has'),
  true,
  '教师端应按环节条件显示工作区',
);

console.log('l2a step config test passed');
