import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const skillPath = path.join(root, '.codex/skills/interactive-lesson-implementation/SKILL.md');
const checkScriptPath = path.join(
  root,
  '.codex/skills/interactive-lesson-implementation/scripts/check_contract_alignment.py',
);

const skill = fs.readFileSync(skillPath, 'utf8');

assert.equal(
  skill.includes('check_contract_alignment.py') &&
    skill.includes('实现完成后必须通过该脚本测试'),
  true,
  '互动课程技能应要求在实现完成后运行并通过契约一致性校验脚本',
);

assert.equal(
  skill.includes('python3 .codex/skills/interactive-lesson-implementation/scripts/check_contract_alignment.py'),
  true,
  '互动课程技能应给出一致性校验脚本的固定 python3 命令',
);

assert.equal(
  fs.existsSync(checkScriptPath),
  true,
  '互动课程技能目录下应提供契约一致性校验脚本',
);

console.log('interactive contract alignment skill test passed');
