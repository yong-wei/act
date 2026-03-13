import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const exporterSource = fs.readFileSync(
  path.join(root, 'src/lib/handout-pdf-export.ts'),
  'utf8',
);
const printPageSource = fs.readFileSync(
  path.join(root, 'src/app/interactive-learning/lessons/[lessonId]/handout-print/page.tsx'),
  'utf8',
);

assert.equal(
  exporterSource.includes('javaScriptEnabled: false'),
  false,
  '讲义打印页在当前 Next 渲染链路下仍需允许脚本执行，否则 PDF 只会导出加载占位',
);

assert.equal(
  exporterSource.includes("state: 'attached'") || exporterSource.includes('state: "attached"'),
  true,
  '服务端 PDF 导出等待打印页就绪时应只要求节点已挂载，避免因可见性判断导致超时',
);

assert.equal(
  printPageSource.includes('dangerouslySetInnerHTML') || printPageSource.includes('suppressHydrationWarning'),
  true,
  '讲义打印页的内联样式应避免触发 hydration mismatch',
);

console.log('test-handout-print-rendering passed');
