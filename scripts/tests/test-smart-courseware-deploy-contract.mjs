import assert from 'node:assert/strict';
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
