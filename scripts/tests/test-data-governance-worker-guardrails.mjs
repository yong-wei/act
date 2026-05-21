import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workerSource = fs.readFileSync(
  path.join(root, 'scripts/workers/data-governance-worker.ts'),
  'utf8',
);

assert.match(
  workerSource,
  /COOLDOWN_FILE/,
  'data governance worker 必须定义冷却文件，避免基础设施故障后立即重启继续刷日志',
);

assert.match(
  workerSource,
  /isInfrastructureError|isRedisInfrastructureError|isRecoverableInfrastructureError/,
  'data governance worker 必须显式识别 Redis\/BullMQ 基础设施错误',
);

assert.match(
  workerSource,
  /unhandledRejection/,
  'data governance worker 必须处理未捕获的 Promise 拒绝，防止错误栈无限刷日志',
);

assert.match(
  workerSource,
  /uncaughtException/,
  'data governance worker 必须处理未捕获异常，防止错误栈无限刷日志',
);

assert.match(
  workerSource,
  /throttle|rateLimit|logWindow|dedup|summaryCount/,
  'data governance worker 必须对同类基础设施错误做日志节流或聚合',
);

assert.match(
  workerSource,
  /refreshStudentEvidenceFeatureCache/,
  'student snapshot worker 必须在快照处理闭环中刷新 StudentEvidenceFeatureCache',
);

assert.match(
  workerSource,
  /rebuildStudentEvidenceFeatureCache/,
  'data governance worker 必须支持 StudentEvidenceFeatureCache 全量重建任务',
);

assert.match(
  workerSource,
  /evidence-feature-cache/,
  'data governance worker 必须注册 evidence-feature-cache 队列',
);

console.log('data governance worker guardrails contract passed');
