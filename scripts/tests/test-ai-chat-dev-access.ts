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

assert.equal(
  routeSource.includes('buildAIChatErrorResponse') &&
    routeSource.includes('AI_SERVICE_UNAVAILABLE') &&
    routeSource.includes('getErrorMessage: getAIStreamErrorMessage') &&
    !routeSource.includes("message: error instanceof Error ? error.message : '未知错误'"),
  true,
  'AI chat API 不应把外部模型或 curl 原始错误直接返回给学生端，应返回可控的服务不可用消息',
);

console.log('ai chat dev access test passed');
