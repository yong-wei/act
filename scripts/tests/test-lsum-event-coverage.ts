import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const studentPagePath = 'src/features/interactive/lsum-design-feasible-domain/student-page.tsx';
const teacherPagePath = 'src/features/interactive/lsum-design-feasible-domain/teacher-page.tsx';
const stepPanelsPath = 'src/features/interactive/lsum-design-feasible-domain/step-panels.tsx';

const studentPage = read(studentPagePath);
const teacherPage = read(teacherPagePath);
const stepPanels = read(stepPanelsPath);

assert.equal(
  studentPage.includes('trackStepView') &&
    studentPage.includes('trackStepLeave') &&
    teacherPage.includes('trackStepView') &&
    teacherPage.includes('trackStepLeave'),
  true,
  'L-sum 教师/学生页都应将步骤浏览接入统一事件流'
);

assert.equal(
  studentPage.includes('trackCourseEvent') &&
    studentPage.includes('attemptKey') &&
    studentPage.includes('lesson_submit') === false,
  true,
  'L-sum 学生页提交与重复修改应通过统一 builder 落库，并显式区分 attemptKey'
);

assert.equal(
  stepPanels.includes('onAiEvent') &&
    stepPanels.includes('useInteractiveAI') &&
    stepPanels.includes('onEvent: onAiEvent'),
  true,
  'L-sum AI 助手应通过 onAiEvent 接入统一课程事件链'
);

assert.equal(
  studentPage.includes('COURSE_EVENT_TYPES.AI_PANEL_OPEN') &&
    studentPage.includes('COURSE_EVENT_TYPES.AI_QUERY_SUBMIT') &&
    teacherPage.includes('COURSE_EVENT_TYPES.AI_PANEL_OPEN') &&
    teacherPage.includes('COURSE_EVENT_TYPES.AI_QUERY_SUBMIT'),
  true,
  'L-sum 教师/学生页都应记录 AI 面板打开与提问事件'
);

assert.equal(
  studentPage.includes('tracking.emit(') || teacherPage.includes('tracking.emit(') || stepPanels.includes('tracking.emit('),
  false,
  'L-sum 课程页不应继续直接拼 tracking.emit(...) 课程语义事件'
);

console.log('lsum event coverage test passed');
