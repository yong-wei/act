import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const filePath = path.join(root, 'src/features/interactive/l2b-root-locus/step-panels.tsx');
const source = fs.readFileSync(filePath, 'utf8');

assert(
  source.includes('DialogDescription'),
  'L-2b 页内 AI 助手弹窗应提供 DialogDescription，避免 Radix DialogContent 控制台告警',
);

assert(
  source.includes('页内 AI 助手用于在当前课程页内直接提问'),
  'L-2b 页内 AI 助手弹窗应提供对话框说明文本',
);

console.log('l2b ai dialog a11y test passed');
