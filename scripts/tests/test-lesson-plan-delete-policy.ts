import assert from 'node:assert/strict';
import {
  buildLessonPlanDeleteConflictMessage,
  canDeleteLessonPlan,
} from '../../src/lib/lesson-plan-delete-policy';

function testCanDeleteWhenUnused() {
  const result = canDeleteLessonPlan(0);
  assert.equal(result, true, '无课堂引用时应允许删除');
}

function testBlockDeleteWhenReferenced() {
  const result = canDeleteLessonPlan(1);
  assert.equal(result, false, '有课堂引用时应禁止删除');
}

function testConflictMessageIncludesCount() {
  const msg = buildLessonPlanDeleteConflictMessage(3);
  assert.equal(msg, '该教案已被 3 次课堂记录引用，无法删除。请改为归档或保留历史记录。');
}

function main() {
  testCanDeleteWhenUnused();
  testBlockDeleteWhenReferenced();
  testConflictMessageIncludesCount();
  console.log('lesson plan delete policy tests passed');
}

main();
