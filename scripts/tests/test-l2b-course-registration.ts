import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const l2bCourse = read('src/lib/l2b-course.ts');
const learningCatalog = read('src/features/interactive/learning-catalog.ts');
const presetIndex = read('src/features/teacher/preset-lessons/presets/index.ts');
const classroomRoute = read('src/lib/classroom-session-route.ts');

assert.equal(
  l2bCourse.includes("export const L2B_ROUTE_SEGMENT = 'l2b-root-locus-fasttrack'"),
  true,
  'L-2b 课程配置应导出固定路由段',
);

assert.equal(
  l2bCourse.includes("export const L2B_COURSE_TITLE = 'L-2b：根轨迹直觉速通 · 极点迁移的几何感知'"),
  true,
  'L-2b 课程配置应导出课程标题',
);

assert.equal(
  l2bCourse.includes('export const L2B_LESSON_STEPS'),
  true,
  'L-2b 课程配置应定义步骤清单',
);

assert.equal(
  learningCatalog.includes('L2B_PREMIUM_LESSON_CARD'),
  true,
  '互动课程目录应挂接 L-2b 精品课程卡片',
);

assert.equal(
  presetIndex.includes('L2B_ROOT_LOCUS_FASTTRACK_PRESET'),
  true,
  '预设课索引应注册 L-2b 预设课',
);

assert.equal(
  classroomRoute.includes('L2B_COURSE_TITLE') && classroomRoute.includes('L2B_ROUTE_SEGMENT'),
  true,
  '课堂码路由解析应识别 L-2b 精品课',
);

console.log('l2b course registration test passed');
