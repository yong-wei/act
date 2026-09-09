import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const verifiedAccounts = read('scripts/db/verified-test-accounts.mjs');
const passwordOverrideTest = read('scripts/tests/test-account-password-overrides.mjs');
const validationDoc = read('.agents/skills/interactive-lesson/references/closed-loop-browser-validation.md');
const opsDoc = read('.agents/skills/server-ops/references/test-accounts.md');
const demoSeed = read('scripts/db/seed-demo-user.mjs');
const productionScript = read('scripts/db/ensure-production-test-accounts.sh');
const e2eHarness = read('scripts/tests/run-smart-lesson-real-e2e.ts');
const e2eSeed = read('scripts/tests/smart-lesson-e2e-acceptance-seed.ts');
const experimentLib = read('scripts/experiments/smart-lesson-research/lib.mjs');
const experimentAdmin = read('scripts/experiments/smart-lesson-research/admin-auth.mjs');
const compactSpacingQa = read('scripts/tests/capture-compact-spacing-qa.mjs');

const teacherPassword = 'TestTeacher@Just2026!';
const demoPassword = 'DemoStudent@Just2026!';
const adminPassword = 'admin@Just';

assert.equal(
  verifiedAccounts.includes("loginId: 'demo'")
    && verifiedAccounts.includes(demoPassword)
    && verifiedAccounts.includes("loginId: 'test_teacher'")
    && verifiedAccounts.includes(teacherPassword)
    && verifiedAccounts.includes("loginId: 'admin'")
    && verifiedAccounts.includes(adminPassword),
  true,
  '三角色验证账号真源应同时包含学生、教师和管理员登录名与密码',
);

assert.equal(
  demoSeed.includes('ensureVerifiedTestAccounts') && demoSeed.includes('verified-test-accounts.mjs'),
  true,
  'demo 种子脚本应从验证账号真源写入三角色账号',
);

assert.equal(
  passwordOverrideTest.includes('VERIFIED_TEST_ACCOUNTS')
    && passwordOverrideTest.includes('verified-test-accounts.mjs'),
  true,
  '固定账号密码校验脚本应从三角色真源读取密码',
);

assert.equal(
  validationDoc.includes(teacherPassword)
    && validationDoc.includes(demoPassword)
    && validationDoc.includes(adminPassword),
  true,
  '浏览器验收参考文档应写入三角色测试账号密码',
);

assert.equal(
  opsDoc.includes('ensure-production-test-accounts.sh')
    && opsDoc.includes(demoPassword)
    && opsDoc.includes(teacherPassword)
    && opsDoc.includes(adminPassword),
  true,
  'server-ops 测试账号文档应指向生产修复脚本并列出三角色密码',
);

assert.equal(
  productionScript.includes(demoPassword)
    && productionScript.includes(teacherPassword)
    && productionScript.includes(adminPassword),
  true,
  '生产测试账号脚本应使用同一组三角色密码',
);

assert.equal(
  e2eHarness.includes("from './smart-lesson-e2e-acceptance-seed'")
    && e2eSeed.includes("from '../db/verified-test-accounts.mjs'")
    && e2eSeed.includes('PROJECTION_INDEPENDENT_LEARNER_MINIMUM')
    && e2eSeed.includes("accountByKey('teacher')")
    && e2eSeed.includes("accountByKey('student')"),
  true,
  '智能备课真实 E2E 播种应从三角色真源引用教师与学生，并按独立学习者下限填充班级',
);

assert.equal(
  experimentLib.includes("from '../../db/verified-test-accounts.mjs'")
    && experimentLib.includes('credentialsFor(\'teacher\'')
    && experimentAdmin.includes("from '../../db/verified-test-accounts.mjs'")
    && experimentAdmin.includes('credentialsFor(\'admin\''),
  true,
  '智能备课实验 runner 应从三角色真源读取教师与管理员登录',
);

assert.equal(
  compactSpacingQa.includes("from '../db/verified-test-accounts.mjs'")
    && compactSpacingQa.includes('accountByKey(\'teacher\')'),
  true,
  '紧凑间距 QA 应从三角色真源读取教师登录',
);

const playwrightCredentials = read('tests/verified-test-credentials.ts');
assert.equal(
  playwrightCredentials.includes("from '../scripts/db/verified-test-accounts.mjs'")
    && playwrightCredentials.includes('export function verifiedAuthForm')
    && playwrightCredentials.includes('export function verifiedCredentials'),
  true,
  'Playwright 凭据助手应从三角色真源导出登录字段',
);

const studyQaCapture = read('scripts/tests/capture-study-qa-review-evidence.mjs');
assert.equal(
  studyQaCapture.includes("from '../db/verified-test-accounts.mjs'")
    && studyQaCapture.includes("accountByKey('admin')"),
  true,
  'Study QA 证据捕获应从三角色真源读取管理员登录',
);

const textbookCoaching = read('tests/textbook-resource-coaching.spec.ts');
const textbookReader = read('tests/unified-textbook-reader.spec.ts');
assert.equal(
  textbookCoaching.includes("from '../scripts/db/verified-test-accounts.mjs'")
    && textbookCoaching.includes("credentialsFor('admin'")
    && textbookReader.includes("from '../scripts/db/verified-test-accounts.mjs'")
    && textbookReader.includes("credentialsFor('admin'"),
  true,
  '教材阅读器验收应从三角色真源读取管理员登录',
);

const forbiddenPasswords = [teacherPassword, demoPassword, adminPassword];
for (const name of fs.readdirSync(path.join(root, 'tests'))) {
  if (!name.endsWith('.spec.ts')) continue;
  const text = read(path.join('tests', name));
  for (const password of forbiddenPasswords) {
    assert.equal(
      text.includes(password),
      false,
      `${name} 不得硬编码三角色密码，应从 verified-test-accounts 引用`,
    );
  }
}

console.log('browser validation accounts test passed');
