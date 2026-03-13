import assert from 'node:assert/strict';

import { extractAITextFromStreamChunk } from '../../src/features/interactive/hooks/ai-stream';

assert.equal(
  extractAITextFromStreamChunk('0:"你好，世界"'),
  '你好，世界',
  '应能解析 Vercel AI SDK 的 0: 文本帧',
);

assert.equal(
  extractAITextFromStreamChunk('data: {"content":"hello"}'),
  'hello',
  '应兼容 data: JSON 帧',
);

assert.equal(
  extractAITextFromStreamChunk('data: [DONE]'),
  '',
  'DONE 帧不应产生文本',
);

console.log('interactive ai stream test passed');
