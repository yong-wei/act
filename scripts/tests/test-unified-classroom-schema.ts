import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const schemaPath = path.join(root, 'prisma/schema.prisma');
const typesPath = path.join(root, 'src/lib/classroom-analytics/types.ts');
const schema = fs.readFileSync(schemaPath, 'utf8');

function hasPattern(pattern: RegExp) {
  return pattern.test(schema);
}

assert.equal(
  hasPattern(/stateKey\s+String\s+@default\("course"\)/),
  true,
  'StudentState 应新增 stateKey，默认值为 course'
);

assert.equal(
  hasPattern(/lessonKey\s+String\?/),
  true,
  'StudentState / 报告模型应包含 lessonKey 字段'
);

assert.equal(
  hasPattern(/lastClientEventAt\s+DateTime\?/),
  true,
  'StudentState 应新增 lastClientEventAt'
);

assert.equal(
  schema.includes('@@unique([sessionId, userId, stateKey])'),
  true,
  'StudentState 唯一键应升级为 sessionId + userId + stateKey'
);

assert.equal(
  hasPattern(/resourceId\s+String\?/),
  true,
  'InteractionLog 应允许 resourceId 为空'
);

assert.equal(
  hasPattern(/resourceKey\s+String\b/),
  true,
  'InteractionLog 应新增必填 resourceKey'
);

assert.equal(
  hasPattern(/stepId\s+String\?/),
  true,
  'InteractionLog 应新增 stepId'
);

assert.equal(
  hasPattern(/actorRole\s+String\?/),
  true,
  'InteractionLog 应新增 actorRole'
);

assert.equal(
  hasPattern(/clientEventAt\s+DateTime\?/),
  true,
  'InteractionLog 应新增 clientEventAt'
);

assert.equal(
  hasPattern(/attemptKey\s+String\?/),
  true,
  'InteractionLog 应新增 attemptKey'
);

assert.equal(
  schema.includes('model ClassSessionReport {'),
  true,
  '应新增 ClassSessionReport 模型'
);

assert.equal(
  schema.includes('model StudentSessionReport {'),
  true,
  '应新增 StudentSessionReport 模型'
);

assert.equal(
  fs.existsSync(typesPath),
  true,
  '应新增 src/lib/classroom-analytics/types.ts 统一类型文件'
);
