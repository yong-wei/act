import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function exists(relativePath: string) {
  return fs.existsSync(path.join(root, relativePath));
}

const coursePath = 'src/lib/unit-1-1-course.ts';
const learningCatalogPath = 'src/features/interactive/learning-catalog.ts';
const presetIndexPath = 'src/features/teacher/preset-lessons/presets/index.ts';
const classroomRoutePath = 'src/lib/classroom-session-route.ts';
const entryRoutePath = 'src/app/interactive-learning/courses/unit-1-1-laplace-transfer-function/page.tsx';
const teacherRoutePath = 'src/app/interactive-learning/courses/unit-1-1-laplace-transfer-function/teacher/[sessionId]/page.tsx';
const studentRoutePath = 'src/app/interactive-learning/courses/unit-1-1-laplace-transfer-function/student/[sessionId]/page.tsx';
const presetFilePath = 'src/features/teacher/preset-lessons/presets/unit-1-1-laplace-transfer-function.ts';

assert.equal(exists(coursePath), true, '应新增 1-1 课程配置文件');

const courseFile = read(coursePath);
const learningCatalog = read(learningCatalogPath);
const presetIndex = read(presetIndexPath);
const classroomRoute = read(classroomRoutePath);

assert.equal(
  courseFile.includes("export const UNIT_1_1_ROUTE_SEGMENT = 'unit-1-1-laplace-transfer-function'"),
  true,
  '1-1 课程配置应导出固定路由段',
);

assert.equal(
  courseFile.includes("export const UNIT_1_1_COURSE_TITLE = '1-1：拉氏变换与传递函数——从微分方程到代数方程'"),
  true,
  '1-1 课程配置应导出课程标题',
);

assert.equal(
  courseFile.includes('export const UNIT_1_1_LESSON_STEPS'),
  true,
  '1-1 课程配置应定义步骤清单',
);

assert.equal(
  learningCatalog.includes('UNIT_1_1_PREMIUM_LESSON_CARD'),
  true,
  '互动课程目录应挂接 1-1 精品课程卡片',
);

assert.equal(exists(presetFilePath), true, '应新增 1-1 预设课文件');
assert.equal(
  presetIndex.includes('UNIT_1_1_LAPLACE_TRANSFER_FUNCTION_PRESET'),
  true,
  '预设课索引应注册 1-1 预设课',
);

assert.equal(
  classroomRoute.includes('UNIT_1_1_COURSE_TITLE') && classroomRoute.includes('UNIT_1_1_ROUTE_SEGMENT'),
  true,
  '课堂码路由解析应识别 1-1 精品课',
);

assert.equal(exists(entryRoutePath), true, '应新增 1-1 课程入口路由');
assert.equal(exists(teacherRoutePath), true, '应新增 1-1 教师页路由');
assert.equal(exists(studentRoutePath), true, '应新增 1-1 学生页路由');

console.log('test-1-1-course-registration passed');
