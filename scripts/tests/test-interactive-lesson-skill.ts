import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const skillPath = path.join(
  process.cwd(),
  '.agents/skills/interactive-lesson/SKILL.md',
);
const skill = fs.readFileSync(skillPath, 'utf8');

assert.equal(
  skill.includes('学生端使用移动设备较多'),
  true,
  '互动课程技能应明确学生端以移动设备为主的设计约束',
);

assert.equal(
  skill.includes('内容更加紧凑'),
  true,
  '互动课程技能应要求移动端内容布局更紧凑',
);

assert.equal(
  skill.includes('浅色模式下，所有形状填充色全部采用浅色色系') &&
    skill.includes('所有文本全部采用较深的颜色'),
  true,
  '互动课程技能应记录精品课浅色模式的统一设计要求',
);

assert.equal(
  skill.includes('所有选择题形的互动') &&
    skill.includes('教师端显示选项的统计') &&
    skill.includes('显示答案的按钮') &&
    skill.includes('学生端能看到答案'),
  true,
  '互动课程技能应要求选择题类互动支持教师端统计与答案揭示联动',
);

assert.equal(
  skill.includes('所有文本型的互动') &&
    skill.includes('教师端显示词云') &&
    skill.includes('默认折叠的学生回复列表') &&
    skill.includes('按提交时间排序'),
  true,
  '互动课程技能应要求文本互动在教师端提供词云和默认折叠的回复列表',
);

assert.equal(
  skill.includes('当前在线学生清单默认折叠') &&
    skill.includes('折叠时只给出人数'),
  true,
  '互动课程技能应要求在线学生清单默认折叠且仅显示人数摘要',
);

assert.equal(
  skill.includes('打开AI助手应在页面上直接弹出对话框') &&
    skill.includes('不要跳转或调用现有的助手页面'),
  true,
  '互动课程技能应要求 AI 助手在页内对话框打开，而不是跳转到独立助手页',
);

assert.equal(
  skill.includes('当前默认基线不再是单一 `L-2c`') &&
    skill.includes('1-1') &&
    skill.includes('1-2') &&
    skill.includes('1-3') &&
    skill.includes('4-1'),
  true,
  '互动课程技能应明确当前基线不再是单一 L-2c，并列出已落地课程能力',
);

assert.equal(
  skill.includes('course-content/runtime') &&
    skill.includes('唯一来源') &&
    skill.includes('export-runtime.sh'),
  true,
  '互动课程技能应要求 runtime 为唯一运行时来源，并默认通过 export-runtime.sh 迁移',
);

assert.equal(
  skill.includes('首页') &&
    skill.includes('知识点网络') &&
    skill.includes('卡片预览') &&
    skill.includes('讲义入口'),
  true,
  '互动课程技能应要求课程首页包含知识点网络、卡片预览和讲义入口',
);

assert.equal(
  skill.includes('教师入口') &&
    skill.includes('自由浏览') &&
    skill.includes('学生入口') &&
    skill.includes('页面最上方'),
  true,
  '互动课程技能应要求教师入口、自由浏览和学生入口模块位于课程首页最上方',
);

assert.equal(
  skill.includes('箭头') &&
    skill.includes('前置') &&
    skill.includes('后置'),
  true,
  '互动课程技能应要求知识点网络用箭头表达前置与后置关系',
);

assert.equal(
  skill.includes('点击任意节点查看卡片正面内容，再用“详情”展开完整知识卡。'),
  true,
  '互动课程技能应固定知识点网络模块的提示文案',
);

assert.equal(
  skill.includes('详情') &&
    skill.includes('概览') &&
    skill.includes('标题保持不变') &&
    skill.includes('标题模块的右上角'),
  true,
  '互动课程技能应固化知识卡详情/概览切换与标题区右上角入口的统一规范',
);

assert.equal(
  skill.includes('导出为pdf') || skill.includes('导出 PDF'),
  true,
  '互动课程技能应要求讲义入口和讲义详情支持导出 PDF',
);

assert.equal(
  skill.includes('抽屉') &&
    skill.includes('没有知识卡片的不需要抽屉'),
  true,
  '互动课程技能应要求按编排设计把知识卡片插入对应互动页面，并且无卡片时不渲染抽屉',
);

assert.equal(
  (skill.includes('深色模式') || skill.includes('dark mode')) &&
    skill.includes('不要硬编码'),
  true,
  '互动课程技能应要求同时适配深色模式，并明确不要硬编码模块样式',
);

assert.equal(
  skill.includes('拒绝硬编码样式') || skill.includes('拒绝继续在模块内硬编码样式'),
  true,
  '互动课程技能应明确拒绝硬编码样式，要求统一通过深浅两套样式框架调度',
);

console.log('interactive lesson skill test passed');
