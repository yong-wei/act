import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const studentPagePath = 'src/features/interactive/lsum-design-feasible-domain/student-page.tsx';
const teacherPagePath = 'src/features/interactive/lsum-design-feasible-domain/teacher-page.tsx';
const coursePath = 'src/lib/lsum-course.ts';

const studentPage = read(studentPagePath);
const teacherPage = read(teacherPagePath);
const courseFile = read(coursePath);

assert.equal(
  studentPage.includes('useStudentLessonSession') &&
    studentPage.includes('useCourseEventTracking'),
  true,
  'L-sum 学生页应接入 useStudentLessonSession 与 useCourseEventTracking'
);

assert.equal(
  teacherPage.includes('useTeacherLessonSession') &&
    teacherPage.includes('useCourseEventTracking'),
  true,
  'L-sum 教师页应接入 useTeacherLessonSession 与 useCourseEventTracking'
);

assert.equal(
  studentPage.includes('setInterval(() => {\n      void syncSession();\n      void syncStates();\n    }, 5000)'),
  false,
  'L-sum 学生页不应继续手写双轮询定时器'
);

assert.equal(
  teacherPage.includes('setInterval(() => {\n      void fetchSession();\n      void fetchStates();\n    }, 5000)'),
  false,
  'L-sum 教师页不应继续手写双轮询定时器'
);

assert.equal(
  studentPage.includes('fetch(`/api/session/${sessionId}/state?scope=student-view`)'),
  false,
  'L-sum 学生页应通过统一 state hook 读取 student-view，而不是页面内直接 fetch'
);

assert.equal(
  teacherPage.includes('fetch(`/api/session/${sessionId}/state`)'),
  false,
  'L-sum 教师页应通过统一 state hook 读取 teacher-view，而不是页面内直接 fetch'
);

assert.equal(
  courseFile.includes("studentStateKey: 'course'") &&
    courseFile.includes("teacherStateKey: 'teacher-sync'") &&
    courseFile.includes('buildTeacherSyncPayload'),
  true,
  'L-sum 课程适配层应显式声明 stateKey，并提供 teacher-sync payload builder'
);

console.log('lsum session framework adoption test passed');
