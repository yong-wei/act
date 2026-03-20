import assert from 'node:assert/strict';

import { getL2BStep } from '../../src/lib/l2b-course';
import { selectTeacherSummaryActivity } from '../../src/features/interactive/l2b-root-locus/activity-utils';

const precheck = getL2BStep('precheck');
const migrationTable = getL2BStep('migration-table');
const knowledgeMap = getL2BStep('knowledge-map');

assert.equal(
  selectTeacherSummaryActivity(precheck)?.kind,
  'quiz',
  '前测页教师端汇总应回退到学生侧 quiz activity，而不是读取教师侧空 activity',
);

assert.equal(
  selectTeacherSummaryActivity(migrationTable)?.kind,
  'form',
  '表单页教师端汇总应回退到学生侧 form activity',
);

assert.equal(
  selectTeacherSummaryActivity(knowledgeMap),
  undefined,
  '纯展示页不应渲染教师端互动汇总',
);

console.log('l2b teacher summary test passed');
