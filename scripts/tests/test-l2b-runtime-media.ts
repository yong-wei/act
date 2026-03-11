import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const runtimeDir = path.join(root, 'course-content/runtime/lessons/L-2b/media');

const expectedFiles = [
  'sh-01-pole-migration-locus.svg',
  'sh-02-root-locus-performance-zones.svg',
  'sh-03-root-locus-optimal-damping.svg',
  'h-04-example1-root-locus.svg',
  'h-05-example2-root-locus-crossing.svg',
];

for (const fileName of expectedFiles) {
  const filePath = path.join(runtimeDir, fileName);
  assert.equal(fs.existsSync(filePath), true, `${fileName} 应生成到 course-content/runtime/lessons/L-2b/media`);

  const content = fs.readFileSync(filePath, 'utf8').trim();
  assert.equal(content.length > 0, true, `${fileName} 不应为空文件`);
  assert.equal(content.includes('<svg'), true, `${fileName} 应包含 <svg 标记`);
  assert.equal(content.includes('</svg>'), true, `${fileName} 应包含 </svg> 标记`);
}

console.log('l2b runtime media test passed');
