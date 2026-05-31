import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const lessonSkill = read('.codex/skills/lesson/SKILL.md');
const lessonHandoutStep = read('.codex/skills/lesson/references/step3-handout.md');
const refineSkill = read('.agents/skills/refine/SKILL.md');
const interactiveDesignSkill = read('.codex/skills/interactive-design/SKILL.md');
const reviewSkill = read('.codex/skills/lesson-content-review/SKILL.md');
const syllabusSkill = read('.codex/skills/syllabus-refactor/SKILL.md');

const courseOverridePath = path.join(root, 'course-content/AGENTS.override.md');
const lessonsOverridePath = path.join(root, 'course-content/authoring/lessons/AGENTS.override.md');
const syllabusOverridePath = path.join(root, 'course-content/syllabus-refactor/AGENTS.override.md');

assert.equal(
  lessonSkill.includes('hidden constraints') &&
    lessonSkill.includes('clean brief') &&
    lessonSkill.includes('去污染重写'),
  true,
  'lesson 技能必须把人读文档生成链改成 hidden constraints -> clean brief -> prose -> 去污染重写',
);

assert.equal(
  lessonHandoutStep.includes('阶段A｜抽取 clean brief') &&
    lessonHandoutStep.includes('阶段B｜生成 prose 初稿') &&
    lessonHandoutStep.includes('阶段C｜去污染重写'),
  true,
  '讲义步骤参考必须显式拆成 clean brief、prose 初稿与去污染重写三个阶段',
);

assert.equal(
  refineSkill.includes('最后一道文风清扫工序') &&
    refineSkill.includes('返回 `lesson`') &&
    refineSkill.includes('不靠润色强行补救'),
  true,
  'refine 技能必须降级为最后一道清扫工序，并在结构性污染时回退到生成阶段',
);

assert.equal(
  interactiveDesignSkill.includes('clean brief') &&
    interactiveDesignSkill.includes('页面蓝图 prose') &&
    interactiveDesignSkill.includes('子代理只接收 brief'),
  true,
  'interactive-design 技能必须先抽 clean brief，再写页面蓝图 prose，并支持 brief 隔离',
);

assert.equal(
  reviewSkill.includes('污染信号') &&
    reviewSkill.includes('需回到生成阶段重写') &&
    reviewSkill.includes('可交给 `refine` 清扫'),
  true,
  'lesson-content-review 技能必须补充污染信号审查，并区分回到生成阶段与交给 refine 清扫',
);

assert.equal(
  syllabusSkill.includes('clean brief') &&
    syllabusSkill.includes('供下游人读稿使用') &&
    syllabusSkill.includes('隐含约束'),
  true,
  'syllabus-refactor 技能必须为下游人读文档产出 clean brief，而不是直接传递工程口吻',
);

assert.equal(fs.existsSync(courseOverridePath), true, 'course-content 总闸门 override 文件必须存在');
assert.equal(fs.existsSync(lessonsOverridePath), true, 'course-content/authoring/lessons 必须新增 override 文件');
assert.equal(fs.existsSync(syllabusOverridePath), true, 'course-content/syllabus-refactor 必须新增 override 文件');

const courseOverride = read('course-content/AGENTS.override.md');
const lessonsOverride = read('course-content/authoring/lessons/AGENTS.override.md');
const syllabusOverride = read('course-content/syllabus-refactor/AGENTS.override.md');

assert.equal(
  courseOverride.includes('隐藏版 brief') &&
    courseOverride.includes('去污染重写') &&
    courseOverride.includes('只能作为**隐含约束**'),
  true,
  'course-content 总闸门必须明确 hidden brief / 去污染重写 / 隐含约束三项总原则',
);

assert.equal(
  lessonsOverride.includes('{unit}-handout.md') &&
    lessonsOverride.includes('{unit}-teacher-handout.md') &&
    lessonsOverride.includes('{unit}-interactive-page.md'),
  true,
  'lessons 目录 override 必须分别约束 handout、teacher-handout 与 interactive-page 三类人读文档',
);

assert.equal(
  syllabusOverride.includes('module-skeletons.md') &&
    syllabusOverride.includes('unit-design-details') &&
    syllabusOverride.includes('项目管理文风'),
  true,
  'syllabus-refactor 目录 override 必须约束模块设计文稿的人读表达，压制项目管理文风',
);

console.log('human readable document skill test passed');
