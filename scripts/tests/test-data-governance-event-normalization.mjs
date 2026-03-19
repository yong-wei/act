import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const routeSource = fs.readFileSync(
  path.join(root, 'src/app/api/interactive/events/route.ts'),
  'utf8',
);
const eventTypesSource = fs.readFileSync(
  path.join(root, 'src/lib/data-governance/event-types.ts'),
  'utf8',
);
const normalizationSource = fs.readFileSync(
  path.join(root, 'src/lib/data-governance/event-normalization.ts'),
  'utf8',
);

assert.match(
  routeSource,
  /resolveCanonicalEventType/,
  '互动事件入口必须读取课程事件提供的 payload.eventType',
);

assert.match(
  routeSource,
  /isCoreEvent\(/,
  '互动事件入口必须基于规范化后的事件类型判断是否为 core event',
);

assert.match(
  eventTypesSource,
  /eventType:\s*'lesson_submit'[\s\S]*?priority:\s*'core'/,
  'lesson_submit 必须被登记为 core event',
);

assert.match(
  eventTypesSource,
  /eventType:\s*'lesson_resubmit'[\s\S]*?priority:\s*'core'/,
  'lesson_resubmit 必须被登记为 core event',
);

assert.match(
  normalizationSource,
  /lesson_submit[\s\S]*question|question[\s\S]*lesson_submit/s,
  '数据治理 worker 必须把 lesson_submit 映射为 question 类型事实',
);

assert.match(
  normalizationSource,
  /lesson_resubmit[\s\S]*question|question[\s\S]*lesson_resubmit/s,
  '数据治理 worker 必须把 lesson_resubmit 映射为 question 类型事实',
);

console.log('data governance event normalization contract passed');
