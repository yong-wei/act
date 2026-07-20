import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const deployScript = fs.readFileSync('deploy/podman/deploy.sh', 'utf8');

assert.equal(
  deployScript.includes('-e SMART_COURSEWARE_ORDERING_SECRET="$SMART_COURSEWARE_ORDERING_SECRET"'),
  true,
  '应用容器必须显式接收学生排序投影 HMAC 密钥',
);
const sharedEnv = deployScript.slice(deployScript.indexOf('SHARED_ENV_ARGS=('), deployScript.indexOf('GRADING_AUDIT_ENV_ARGS=()'));
const appEnv = deployScript.slice(deployScript.indexOf('APP_ENV_ARGS=('), deployScript.indexOf('if [ -n "${NEXTAUTH_URL:-}" ]'));
assert.equal(sharedEnv.includes('SMART_COURSEWARE_ORDERING_SECRET'), false, '共享容器不得接收学生排序投影密钥');
assert.equal(appEnv.includes('SMART_COURSEWARE_ORDERING_SECRET'), true, '应用环境必须接收学生排序投影密钥');

const validationFunction = deployScript.match(/^require_smart_courseware_ordering_secret\(\) \{[\s\S]*?^\}/m)?.[0];
assert.ok(validationFunction, '部署脚本必须定义课件排序密钥校验函数');

function validateOrderingSecret(secret) {
  return spawnSync('bash', ['-s', '--', secret], {
    encoding: 'utf8',
    input: `${validationFunction}\nNODE_ENV=production\nSMART_COURSEWARE_ORDERING_SECRET="$1"\nrequire_smart_courseware_ordering_secret\n`,
  });
}

for (const [label, secret] of [
  ['empty', ''],
  ['whitespace-only', ' '.repeat(40)],
  ['placeholder', 'replace-with-strong-courseware-ordering-secret'],
  ['whitespace-prefixed placeholder', '  replace-with-strong-courseware-ordering-secret  '],
  ['short', 'x'.repeat(31)],
  ['whitespace-padded short', `  ${'x'.repeat(28)}  `],
]) {
  const result = validateOrderingSecret(secret);
  assert.notEqual(result.status, 0, `production 部署必须拒绝 ${label} 排序密钥`);
  assert.equal(`${result.stdout}${result.stderr}`.includes(secret) && secret.length > 0, false, '校验错误不得输出密钥');
}

const validSecret = 'v'.repeat(32);
const valid = validateOrderingSecret(validSecret);
assert.equal(valid.status, 0, 'production 部署必须接受至少 32 bytes 的非占位排序密钥');
assert.equal(`${valid.stdout}${valid.stderr}`.includes(validSecret), false, '成功校验不得输出密钥');
assert.ok(
  deployScript.lastIndexOf('  require_smart_courseware_ordering_secret')
    < deployScript.indexOf('if [ "$MODE" = "--all" ] || [ "$MODE" = "--db-only" ]; then'),
  '排序密钥必须在修改现有容器前完成校验',
);
