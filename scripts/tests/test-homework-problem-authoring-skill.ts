import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const skillPath = path.join(root, '.codex/skills/homework-problem-authoring/SKILL.md');
const contractPath = path.join(
  root,
  '.codex/skills/homework-problem-authoring/references/output-contract.md',
);

const skill = fs.readFileSync(skillPath, 'utf8');
const contract = fs.existsSync(contractPath) ? fs.readFileSync(contractPath, 'utf8') : '';

assert.equal(
  skill.includes('3 个独立的出题智能体') &&
    skill.includes('裁判智能体') &&
    skill.includes('3 个独立的作答智能体'),
  true,
  '出题技能必须固化 3 个出题智能体 + 1 个裁判 + 3 个作答智能体的基本流程',
);

assert.equal(
  skill.includes('临时目录') &&
    skill.includes('临时文件') &&
    skill.includes('禁止读取项目文件'),
  true,
  '出题技能必须明确通过临时文件交接，并禁止出题/作答子代理读取项目文件',
);

assert.equal(
  skill.includes('计算题（C）') &&
    skill.includes('跨域题（X）') &&
    skill.includes('设计题（D）'),
  true,
  '出题技能必须写明 C/X/D 三类题的大体一致标准',
);

assert.equal(
  skill.includes('再次启动三个智能体独立作答') &&
    skill.includes('比例占优'),
  true,
  '出题技能必须写明首轮不一致时的第二轮作答与占优规则',
);

assert.equal(
  skill.includes('extract_homework_question.py') &&
    skill.includes('course-content/syllabus-refactor/homework-framework.md') &&
    contract.includes('draft-1.json') &&
    contract.includes('solver-1.json') &&
    contract.includes('final-package.md'),
  true,
  '出题技能应引用新的作业框架真值文件、题号提取脚本，并在参考文件中给出临时产物约定',
);

console.log('homework problem authoring skill test passed');
