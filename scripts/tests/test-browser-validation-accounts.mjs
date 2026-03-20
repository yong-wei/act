import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const fixedPasswordScript = read('scripts/db/update-fixed-account-passwords.mjs');
const passwordOverrideTest = read('scripts/tests/test-account-password-overrides.mjs');
const validationDoc = read('.codex/skills/interactive-lesson-implementation/references/closed-loop-browser-validation.md');
const demoSeed = read('scripts/db/seed-demo-user.mjs');

const teacherPassword = 'TestTeacher@Just2026!';
const demoPassword = 'DemoStudent@Just2026!';

assert.equal(
  fixedPasswordScript.includes("label: 'teacher-test_teacher'") && fixedPasswordScript.includes(teacherPassword),
  true,
  '固定密码脚本应接管 test_teacher 的复杂密码',
);

assert.equal(
  fixedPasswordScript.includes("label: 'student-demo'") && fixedPasswordScript.includes(demoPassword),
  true,
  '固定密码脚本应接管 demo 的复杂密码',
);

assert.equal(
  passwordOverrideTest.includes(teacherPassword) && passwordOverrideTest.includes(demoPassword),
  true,
  '固定账号密码校验脚本应验证 test_teacher 与 demo 的复杂密码',
);

assert.equal(
  demoSeed.includes(demoPassword),
  true,
  'demo 种子脚本应使用新的复杂密码，避免浏览器弱密码提示',
);

assert.equal(
  validationDoc.includes(teacherPassword) && validationDoc.includes(demoPassword),
  true,
  '浏览器验收参考文档应写入新的复杂测试账号密码',
);

console.log('browser validation accounts test passed');
