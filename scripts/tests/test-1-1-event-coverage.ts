import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const studentPagePath = 'src/features/interactive/unit-1-1-laplace/student-page.tsx';
const teacherPagePath = 'src/features/interactive/unit-1-1-laplace/teacher-page.tsx';
const stepPanelsPath = 'src/features/interactive/unit-1-1-laplace/step-panels.tsx';
const workspacePath = 'src/features/interactive/unit-1-1-laplace/workspace.tsx';

const studentPage = read(studentPagePath);
const teacherPage = read(teacherPagePath);
const stepPanels = read(stepPanelsPath);
const workspace = read(workspacePath);

assert.equal(
  studentPage.includes('trackStepView') &&
    studentPage.includes('trackStepLeave') &&
    teacherPage.includes('trackStepView') &&
    teacherPage.includes('trackStepLeave'),
  true,
  '1-1 教师/学生页都应将步骤浏览接入统一事件流',
);

assert.equal(
  studentPage.includes('trackCourseEvent') &&
    studentPage.includes('attemptKey') &&
    studentPage.includes('lesson_submit') === false,
  true,
  '1-1 学生页提交与重提应通过统一 builder 落库，并显式区分 attemptKey',
);

assert.equal(
  studentPage.includes('COURSE_EVENT_TYPES.AI_PANEL_OPEN') &&
    studentPage.includes('COURSE_EVENT_TYPES.AI_QUERY_SUBMIT') &&
    teacherPage.includes('COURSE_EVENT_TYPES.AI_PANEL_OPEN') &&
    teacherPage.includes('COURSE_EVENT_TYPES.AI_QUERY_SUBMIT'),
  true,
  '1-1 教师/学生页都应记录 AI 面板打开与提问事件',
);

assert.equal(
  stepPanels.includes('onAiEvent') &&
    stepPanels.includes('onEvent: onAiEvent'),
  true,
  '1-1 页内 AI 助手应通过 onAiEvent 接入统一课程事件链',
);

assert.equal(
  workspace.includes('onParameterChange'),
  true,
  '1-1 极点联动或参数滑块工作区应把参数变化抛给页面层，进入统一事件链',
);

assert.equal(
  studentPage.includes('tracking.emit(') ||
    teacherPage.includes('tracking.emit(') ||
    stepPanels.includes('tracking.emit(') ||
    workspace.includes('tracking.emit('),
  false,
  '1-1 课程页不应继续直接拼 tracking.emit(...) 课程语义事件',
);

console.log('test-1-1-event-coverage passed');
