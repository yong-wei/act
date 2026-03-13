import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const routeSource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/api/ai/chat/route.ts'),
  'utf8',
);

assert.equal(
  routeSource.includes("process.env.NODE_ENV === 'development'") &&
    routeSource.includes("lessonContext?.stage === 'interactive'"),
  true,
  '本地开发调试互动课程时，AI chat API 应允许无登录态的互动课请求通过，避免 demo 页面直接 401',
);

console.log('ai chat dev access test passed');
