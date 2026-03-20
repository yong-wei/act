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
const teacherSpecPath =
  '.codex/skills/interactive-lesson-implementation/references/browser-validation-teacher-subagent.md';
const studentSpecPath =
  '.codex/skills/interactive-lesson-implementation/references/browser-validation-student-subagent.md';

const skill = read(skillPath);

assert.equal(
  skill.includes('课程实现后，必须在互动课程总入口页注册精品课程入口'),
  true,
  '技能主文件应明确要求：课程实现后必须注册互动课程入口',
);

assert.equal(
  skill.includes('browser-validation-teacher-subagent.md') &&
    skill.includes('browser-validation-student-subagent.md'),
  true,
  '技能主文件应显式指向教师端/学生端子代理规范文件',
);

assert.equal(
  skill.includes('主代理不需要读取这两个子代理规范文件'),
  true,
  '技能主文件应说明主代理只负责分派，不需要读取两个子代理规范文件',
);

assert.equal(exists(teacherSpecPath), true, '应新增教师端浏览器验收子代理规范文件');
assert.equal(exists(studentSpecPath), true, '应新增学生端浏览器验收子代理规范文件');

const teacherSpec = read(teacherSpecPath);
const studentSpec = read(studentSpecPath);

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

console.log('interactive lesson skill rules test passed');
