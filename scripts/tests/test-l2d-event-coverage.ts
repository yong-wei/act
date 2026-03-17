import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const studentPagePath = 'src/features/interactive/l2d-three-domain-linkage/student-page.tsx';
const teacherPagePath = 'src/features/interactive/l2d-three-domain-linkage/teacher-page.tsx';
const workspacePath = 'src/features/interactive/l2d-three-domain-linkage/workspace.tsx';

const studentPage = read(studentPagePath);
const teacherPage = read(teacherPagePath);
const workspace = read(workspacePath);

assert.equal(
  studentPage.includes('trackStepView') &&
    studentPage.includes('trackStepLeave') &&
    teacherPage.includes('trackStepView') &&
    teacherPage.includes('trackStepLeave'),
  true,
  'L-2d 教师/学生页都应将步骤浏览接入统一事件流'
);

assert.equal(
  studentPage.includes('trackCourseEvent') &&
    studentPage.includes('attemptKey') &&
    studentPage.includes('lesson_submit') === false,
  true,
  'L-2d 学生页的提交事件应通过统一 builder 落库，并显式区分 attemptKey'
);

assert.equal(
  studentPage.includes('trackWorkspaceParamChange') &&
    teacherPage.includes('trackWorkspaceParamChange'),
  true,
  'L-2d 教师/学生页都应记录工作区参数变化事件'
);

assert.equal(
  workspace.includes('onParameterChange') &&
    workspace.includes("source: 'slider'") &&
    workspace.includes("source: 'root-locus'"),
  true,
  'L-2d 工作区应把参数变化来源抛给页面层，进入统一事件链'
);

assert.equal(
  studentPage.includes('tracking.emit(') || teacherPage.includes('tracking.emit(') || workspace.includes('tracking.emit('),
  false,
  'L-2d 课程页不应继续直接拼 tracking.emit(...) 事件'
);

console.log('l2d event coverage test passed');
