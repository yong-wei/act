import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const runtimeDir = path.join(root, 'course-content/runtime/lessons/legacy/L-2b/media');
const rawDir = path.join(root, 'course-content/authoring/lessons/legacy/L-2b/media/raw');

const expectedFiles = [
  'sh-01-pole-migration-locus.svg',
  'sh-02-root-locus-performance-zones.svg',
  'sh-03-root-locus-optimal-damping.svg',
  'h-04-example1-root-locus.svg',
  'h-05-example2-root-locus-crossing.svg',
];

for (const fileName of expectedFiles) {
  const filePath = path.join(runtimeDir, fileName);
  assert.equal(fs.existsSync(filePath), true, `${fileName} 应生成到 course-content/runtime/lessons/legacy/L-2b/media`);

  const content = fs.readFileSync(filePath, 'utf8').trim();
  assert.equal(content.length > 0, true, `${fileName} 不应为空文件`);
  assert.equal(content.includes('<svg'), true, `${fileName} 应包含 <svg 标记`);
  assert.equal(content.includes('</svg>'), true, `${fileName} 应包含 </svg> 标记`);
  assert.equal(content.includes('<text'), false, `${fileName} 应将系统字体嵌入 SVG 轮廓，避免浏览器缺字`);
}

for (const rawFileName of [
  'sh-01-pole-migration-locus.py',
  'sh-02-root-locus-performance-zones.py',
  'sh-03-root-locus-optimal-damping.py',
  'h-04-example1-root-locus.py',
  'h-05-example2-root-locus-crossing.py',
]) {
  const content = fs.readFileSync(path.join(rawDir, rawFileName), 'utf8');
  assert.equal(
    content.includes('configure_matplotlib_for_cjk'),
    true,
    `${rawFileName} 应显式配置系统中文字体并嵌入 SVG 导出`,
  );
}

console.log('l2b runtime media test passed');
