import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  LEGACY_LESSONS,
  PREMIUM_LESSONS,
} from '../../src/features/interactive/learning-catalog';

const root = process.cwd();
const pagePath = path.join(root, 'src/app/interactive-learning/courses/page.tsx');
const pageContent = fs.readFileSync(pagePath, 'utf8');

assert.equal(
  PREMIUM_LESSONS.some((lesson) => lesson.id === 'l2a-time-domain-fasttrack'),
  true,
  '精品课程分组中应新增 L-2a 重构课程入口',
);

assert.equal(
  PREMIUM_LESSONS.some((lesson) => lesson.id === 'cruise-comfort-boppps'),
  true,
  '精品课程分组中应保留柔性之海课程入口',
);

assert.equal(
  PREMIUM_LESSONS.some((lesson) => lesson.id === 'l2d-three-domain-linkage-practice'),
  true,
  '精品课程分组中应补齐 L-2d 三域联动实践课程入口',
);

assert.equal(
  LEGACY_LESSONS.length >= 10,
  true,
  '旧 lessonXX 系列应独立归入 legacy lessons 分组',
);

assert.equal(
  pageContent.includes('<details') || pageContent.includes('Accordion'),
  true,
  '互动课程页应提供默认折叠的旧课程下拉区',
);

assert.equal(
  pageContent.includes('默认收起') || pageContent.includes('展开旧版章节课程') || pageContent.includes('旧版章节课程'),
  true,
  '互动课程页应明确标识旧 lessonXX 系列为折叠区内容',
);

assert.equal(
  pageContent.includes('interactive-course-hub-shell') &&
    pageContent.includes('interactive-course-hub-premium-card') &&
    pageContent.includes('interactive-course-hub-legacy-shell'),
  true,
  '互动课程入口页应改用全局语义样式类，而不是散落的局部颜色硬编码',
);

assert.equal(
  /bg-slate-950|bg-slate-900|text-white|border-white\/10|from-cyan-500\/10|to-slate-900\/70/.test(pageContent),
  false,
  '互动课程入口页不应继续硬编码深色卡片与深色渐变',
);

console.log('interactive courses page test passed');
