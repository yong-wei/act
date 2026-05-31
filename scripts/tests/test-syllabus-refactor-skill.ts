import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const skillPath = path.join(root, '.codex/skills/syllabus-refactor/SKILL.md');
const skill = fs.readFileSync(skillPath, 'utf8');

assert.equal(
  skill.includes('作业题目重构入口') &&
    skill.includes('course-content/syllabus-refactor/homework-framework.md'),
  true,
  '大纲重构技能必须提供课程级作业题目重构入口，并指向统一作业框架文件',
);

assert.equal(
  skill.includes('作业基本规范') &&
    skill.includes('7 次作业') &&
    skill.includes('开放性题目主线') &&
    skill.includes('期末考试题库'),
  true,
  '大纲重构技能必须写明新的作业基本规范与题库定位',
);

assert.equal(
  skill.includes('作业开始时') &&
    skill.includes('学生已经学习的知识点') &&
    skill.includes('避免能力失配') &&
    skill.includes('禁止越界知识'),
  true,
  '大纲重构技能必须要求按作业开始时刻校验已学知识与禁止越界知识，避免能力失配',
);

assert.equal(
  skill.includes('逐个审核题目') &&
    skill.includes('内容和边界') &&
    skill.includes('每次只处理一个题号') &&
    skill.includes('先审核，再出题'),
  true,
  '大纲重构技能必须把作业设计协议改为逐题审核，先审核边界再进入正式出题',
);

assert.equal(
  skill.includes('homework') &&
    skill.includes('只有在逐题审核通过后') &&
    skill.includes('按题号生成完整习题'),
  true,
  '大纲重构技能必须写明与 homework 的交接条件',
);

console.log('syllabus refactor skill test passed');
