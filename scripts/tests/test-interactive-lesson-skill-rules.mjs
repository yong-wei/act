import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

const skillPath = '.codex/skills/interactive-lesson-implementation/SKILL.md';
const designSkillPath = '.codex/skills/interactive-design/SKILL.md';
const teacherSpecPath =
  '.codex/skills/interactive-lesson-implementation/references/browser-validation-teacher-subagent.md';
const studentSpecPath =
  '.codex/skills/interactive-lesson-implementation/references/browser-validation-student-subagent.md';
const entryPatternPath =
  '.codex/skills/interactive-lesson-implementation/references/runtime-entry-page-pattern.md';
const mediaIndexContractPath =
  '.codex/skills/interactive-lesson-implementation/references/runtime-media-index-contract.md';

const skill = read(skillPath);
const designSkill = read(designSkillPath);

assert.equal(
  skill.includes('课程实现后，必须在互动课程总入口页注册精品课程入口'),
  true,
  '技能主文件应明确要求：课程实现后必须注册互动课程入口',
);

assert.equal(
  skill.includes('review_lesson_content.py') &&
    skill.includes('--strict-implementation-contract'),
  true,
  '技能主文件应要求通过严格实现契约校验脚本，不能忽略作者态契约与本地实现漂移',
);

assert.equal(
  skill.includes('browser-validation-teacher-subagent.md') &&
    skill.includes('browser-validation-student-subagent.md'),
  true,
  '技能主文件应显式指向教师端/学生端子代理规范文件',
);

assert.equal(
  skill.includes('runtime-entry-page-pattern.md') &&
    skill.includes('runtime-media-index-contract.md'),
  true,
  '技能主文件应显式指向入口页模式与 runtime 媒体索引契约参考文件',
);

assert.equal(
  skill.includes('主代理不需要读取这两个子代理规范文件'),
  true,
  '技能主文件应说明主代理只负责分派，不需要读取两个子代理规范文件',
);

assert.equal(exists(teacherSpecPath), true, '应新增教师端浏览器验收子代理规范文件');
assert.equal(exists(studentSpecPath), true, '应新增学生端浏览器验收子代理规范文件');
assert.equal(exists(entryPatternPath), true, '应新增入口页样式基线参考文件');
assert.equal(exists(mediaIndexContractPath), true, '应新增 runtime 媒体索引契约参考文件');

const teacherSpec = read(teacherSpecPath);
const studentSpec = read(studentSpecPath);
const entryPattern = read(entryPatternPath);
const mediaIndexContract = read(mediaIndexContractPath);

assert.equal(
  teacherSpec.includes('npm run startup') && studentSpec.includes('npm run startup'),
  true,
  '教师端/学生端子代理规范都应固定要求使用 npm run startup 作为浏览器验收基线',
);

assert.equal(
  teacherSpec.includes('TestTeacher@Just2026!') && studentSpec.includes('DemoStudent@Just2026!'),
  true,
  '子代理规范应写明复杂密码测试账号，避免浏览器弱密码提示干扰',
);

assert.equal(
  teacherSpec.includes('window.confirm') &&
    teacherSpec.includes('结束课堂') &&
    studentSpec.includes('弱密码') &&
    studentSpec.includes('保存密码'),
  true,
  '子代理规范应覆盖结束课堂确认框与浏览器密码弹窗的处理要求',
);

assert.equal(
  entryPattern.includes('2-1') &&
    entryPattern.includes('《闲聊自控》播客') &&
    entryPattern.includes('课前预习台') &&
    entryPattern.includes('不要在页面里硬编码媒体说明文案'),
  true,
  '入口页参考文件应固定 2-1 当前模式，并明确运行态文案与音频播客口径',
);

assert.equal(
  mediaIndexContract.includes('# <lesson>-handout.md') &&
    mediaIndexContract.includes('runtime/lessons/<lesson>/media/<lesson>-media.md') &&
    mediaIndexContract.includes('第一条 `- ` 行作为用户可见标题') &&
    mediaIndexContract.includes('页面真值必须是 runtime `media/<lesson>-media.md`'),
  true,
  'runtime 媒体索引契约参考文件应明确文档格式、标题解析和 runtime-first 真值规则',
);

assert.equal(
  designSkill.includes('前测不得考察本单元知识') &&
    designSkill.includes('只考察进入本单元学习所需的基础能力'),
  true,
  'interactive-design 技能应明确前测只考察基础能力，禁止考察本单元知识',
);

assert.equal(
  skill.includes('前测页面不设置单独的前测内容模块或范围模块') &&
    skill.includes('标题模块文案中注明考察内容') &&
    skill.includes('标题模块后直接进入教师控制、作答题组或其他真实互动模块'),
  true,
  'interactive-lesson-implementation 技能应明确前测页不设置单独范围模块',
);

console.log('interactive lesson skill rules test passed');
