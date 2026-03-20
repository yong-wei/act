import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const studentPagePath = 'src/features/interactive/unit-1-2-structure-graph/student-page.tsx';
const teacherPagePath = 'src/features/interactive/unit-1-2-structure-graph/teacher-page.tsx';
const coursePath = 'src/lib/unit-1-2-course.ts';
const aiContextPath = 'src/lib/unit-1-2-ai-contexts.ts';

const studentPage = read(studentPagePath);
const teacherPage = read(teacherPagePath);
const courseFile = read(coursePath);
const aiContextFile = read(aiContextPath);

assert.equal(
  studentPage.includes('useStudentLessonSession') &&
    studentPage.includes('useCourseEventTracking') &&
    studentPage.includes('updatePageContext'),
  true,
  '1-2 学生页应接入 useStudentLessonSession、useCourseEventTracking 与全局 AI page context',
);

assert.equal(
  teacherPage.includes('useTeacherLessonSession') &&
    teacherPage.includes('useCourseEventTracking'),
  true,
  '1-2 教师页应接入 useTeacherLessonSession 与 useCourseEventTracking',
);

assert.equal(
  studentPage.includes('fetch(`/api/session/${sessionId}/state?scope=student-view`)'),
  false,
  '1-2 学生页应通过统一 state hook 读取 student-view，而不是页面内直接 fetch',
);

assert.equal(
  teacherPage.includes('fetch(`/api/session/${sessionId}/state`)'),
  false,
  '1-2 教师页应通过统一 state hook 读取 teacher-view，而不是页面内直接 fetch',
);

assert.equal(
  courseFile.includes("studentStateKey: 'course'") &&
    courseFile.includes("teacherStateKey: 'teacher-sync'") &&
    courseFile.includes('buildTeacherSyncPayload'),
  true,
  '1-2 课程适配层应显式声明 stateKey，并提供 teacher-sync payload builder',
);

assert.equal(
  aiContextFile.includes('getUnit12StepAIContext') &&
    aiContextFile.includes('quickQuestions') &&
    aiContextFile.includes('systemPromptExtension'),
  true,
  '1-2 应提供步骤级 AI 上下文配置',
);

console.log('test-1-2-session-framework-adoption passed');
