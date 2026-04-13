import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  INTERACTIVE_COURSE_MODULES,
} from '../../src/features/interactive/learning-catalog';

const root = process.cwd();
const pagePath = path.join(root, 'src/app/interactive-learning/courses/page.tsx');
const pageContent = fs.readFileSync(pagePath, 'utf8');

assert.equal(
  INTERACTIVE_COURSE_MODULES.length,
  3,
  '互动课程页当前应展示模块2、模块3和模块4三个分组',
);

assert.equal(
  INTERACTIVE_COURSE_MODULES[0]?.lessons.length,
  4,
  '模块2分组应展示 4 个单元入口',
);

assert.equal(
  INTERACTIVE_COURSE_MODULES[1]?.lessons.some((lesson) => lesson.id === 'unit-2-1-modeling-language'),
  false,
  '模块3分组不应展示 2-1 入口',
);

assert.equal(
  INTERACTIVE_COURSE_MODULES[0]?.lessons.some((lesson) => lesson.id === 'unit-2-1-modeling-language'),
  true,
  '模块2分组应展示 2-1 入口',
);

assert.equal(
  INTERACTIVE_COURSE_MODULES[1]?.lessons.some((lesson) => lesson.id === 'unit-3-9-cross-domain-mapping-lab'),
  true,
  '模块3分组应展示 3-9 入口',
);

assert.equal(
  INTERACTIVE_COURSE_MODULES[2]?.lessons.some((lesson) => lesson.id === 'unit-4-1-design-task-expression'),
  true,
  '模块4分组应展示 4-1 入口',
);

assert.equal(
  INTERACTIVE_COURSE_MODULES.some((module) =>
    module.lessons.some((lesson) => lesson.id === 'unit-1-3-time-domain-response')
  ),
  false,
  'unit-1-3 现阶段不应出现在互动课程首页分组中',
);

assert.equal(
  INTERACTIVE_COURSE_MODULES.map((module) => module.title).join('|'),
  '模块2|模块3|模块4',
  '互动课程页数据分组应明确命名为模块2、模块3与模块4',
);

assert.equal(
  pageContent.includes('INTERACTIVE_COURSE_MODULES.map'),
  true,
  '互动课程页应基于模块分组数据渲染页面内容',
);

assert.equal(
  pageContent.includes('<details') || pageContent.includes('归档课程') || pageContent.includes('展开归档课程'),
  false,
  '互动课程页不应继续保留归档课程折叠区',
);

assert.equal(
  pageContent.includes('interactive-course-hub-shell') &&
    pageContent.includes('interactive-course-hub-module-card') &&
    pageContent.includes('interactive-course-hub-unit-badge'),
  true,
  '互动课程入口页应继续使用全局语义样式类承载模块分组布局',
);

assert.equal(
  /bg-slate-950|bg-slate-900|text-white|border-white\/10|from-cyan-500\/10|to-slate-900\/70/.test(pageContent),
  false,
  '互动课程入口页不应继续硬编码深色卡片与深色渐变',
);

console.log('interactive courses page test passed');
