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

const lsumCoursePath = 'src/lib/lsum-course.ts';
const learningCatalogPath = 'src/features/interactive/learning-catalog.ts';
const presetIndexPath = 'src/features/teacher/preset-lessons/presets/index.ts';
const classroomRoutePath = 'src/lib/classroom-session-route.ts';
const entryRoutePath = 'src/app/interactive-learning/courses/lsum-design-feasible-domain/page.tsx';
const teacherRoutePath = 'src/app/interactive-learning/courses/lsum-design-feasible-domain/teacher/[sessionId]/page.tsx';
const studentRoutePath = 'src/app/interactive-learning/courses/lsum-design-feasible-domain/student/[sessionId]/page.tsx';
const presetFilePath = 'src/features/teacher/preset-lessons/presets/lsum-design-feasible-domain.ts';

assert.equal(exists(lsumCoursePath), true, '应新增 L-sum 课程配置文件');

const lsumCourse = read(lsumCoursePath);
const learningCatalog = read(learningCatalogPath);
const presetIndex = read(presetIndexPath);
const classroomRoute = read(classroomRoutePath);

assert.equal(
  lsumCourse.includes("export const LSUM_ROUTE_SEGMENT = 'lsum-design-feasible-domain'"),
  true,
  'L-sum 课程配置应导出固定路由段',
);

assert.equal(
  lsumCourse.includes("export const LSUM_COURSE_TITLE = 'L-sum：设计可行域——让约束成为指南针'"),
  true,
  'L-sum 课程配置应导出课程标题',
);

assert.equal(
  lsumCourse.includes('export const LSUM_LESSON_STEPS'),
  true,
  'L-sum 课程配置应定义步骤清单',
);

assert.equal(
  learningCatalog.includes('LSUM_PREMIUM_LESSON_CARD'),
  true,
  '互动课程目录应挂接 L-sum 精品课程卡片',
);

assert.equal(exists(presetFilePath), true, '应新增 L-sum 预设课文件');
assert.equal(
  presetIndex.includes('LSUM_DESIGN_FEASIBLE_DOMAIN_PRESET'),
  true,
  '预设课索引应注册 L-sum 预设课',
);

assert.equal(
  classroomRoute.includes('LSUM_COURSE_TITLE') && classroomRoute.includes('LSUM_ROUTE_SEGMENT'),
  true,
  '课堂码路由解析应识别 L-sum 精品课',
);

assert.equal(exists(entryRoutePath), true, '应新增 L-sum 课程入口路由');
assert.equal(exists(teacherRoutePath), true, '应新增 L-sum 教师页路由');
assert.equal(exists(studentRoutePath), true, '应新增 L-sum 学生页路由');

console.log('lsum course registration test passed');
