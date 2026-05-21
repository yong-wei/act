import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const schedulerSource = fs.readFileSync(
  path.join(root, 'scripts/workers/scheduler.ts'),
  'utf8',
);
const workerClientSource = fs.readFileSync(
  path.join(root, 'src/lib/data-governance/worker-client.ts'),
  'utf8',
);

assert.doesNotMatch(
  schedulerSource,
  /EVENT_INGESTION:\s*'\/\*\/5 \* \* \* \*'/,
  'scheduler 不应继续保留白天每 5 分钟的 event-ingestion 调度',
);

assert.match(
  schedulerSource,
  /ACTIVE_STUDENT_SNAPSHOT|student.*15 \* \* \* \*/is,
  'scheduler 必须把活跃学生快照改为每小时一次',
);

assert.match(
  schedulerSource,
  /CLASS_SNAPSHOT|class.*30 3 \* \* \*/is,
  'scheduler 必须把班级快照改为每天一次的凌晨任务',
);

assert.match(
  schedulerSource,
  /EVIDENCE_FEATURE_CACHE_REBUILD|evidence.*45 4 \* \* \*/is,
  'scheduler 必须注册每日 evidence feature cache 重建任务',
);

assert.doesNotMatch(
  schedulerSource,
  /take:\s*100[\s\S]*studentQueue\.add/,
  'scheduler 不应继续对 100 个学生逐个注册 repeatable job',
);

assert.match(
  workerClientSource,
  /removeOnComplete/,
  'BullMQ job 必须限制 completed 历史保留量',
);

assert.match(
  workerClientSource,
  /removeOnFail/,
  'BullMQ job 必须限制 failed 历史保留量',
);

console.log('data governance scheduling contract passed');
