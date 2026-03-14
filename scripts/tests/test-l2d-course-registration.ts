import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const l2dCourse = read('src/lib/l2d-course.ts');
const learningCatalog = read('src/features/interactive/learning-catalog.ts');
const presetIndex = read('src/features/teacher/preset-lessons/presets/index.ts');
const classroomRoute = read('src/lib/classroom-session-route.ts');

assert.equal(
  l2dCourse.includes("export const L2D_ROUTE_SEGMENT = 'l2d-three-domain-linkage-practice'"),
  true,
  'L-2d 课程配置应导出固定路由段',
);

assert.equal(
  l2dCourse.includes("export const L2D_COURSE_TITLE = 'L-2d：三域联动探索 · 平台操作初体验'"),
  true,
  'L-2d 课程配置应导出课程标题',
);

assert.equal(
  l2dCourse.includes('export const L2D_LESSON_STEPS'),
  true,
  'L-2d 课程配置应定义步骤清单',
);

assert.equal(
  learningCatalog.includes('L2D_PREMIUM_LESSON_CARD'),
  true,
  '互动课程目录应挂接 L-2d 精品课程卡片',
);

assert.equal(
  presetIndex.includes('L2D_THREE_DOMAIN_LINKAGE_PRACTICE_PRESET'),
  true,
  '预设课索引应注册 L-2d 预设课',
);

assert.equal(
  classroomRoute.includes('L2D_COURSE_TITLE') && classroomRoute.includes('L2D_ROUTE_SEGMENT'),
  true,
  '课堂码路由解析应识别 L-2d 精品课',
);

console.log('l2d course registration test passed');
