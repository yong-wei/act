import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const target = path.join(
  process.cwd(),
  'src/features/knowledge/resource-panel/resource-panel.tsx'
);
const content = fs.readFileSync(target, 'utf8');

assert.equal(
  content.includes('扩展字段'),
  false,
  'resource panel should not render a generic 扩展字段 section'
);

assert.equal(
  content.includes('难度：'),
  true,
  'resource panel should render 难度 label badge'
);

assert.equal(
  content.includes('重要性：'),
  true,
  'resource panel should render 重要性 label badge'
);

assert.equal(
  content.includes('示例'),
  true,
  'resource panel should render 示例 section'
);

assert.equal(
  content.includes('公式'),
  true,
  'resource panel should render 公式 section'
);

assert.equal(
  content.includes('BlockMath'),
  true,
  'resource panel should use react-katex BlockMath for formulas'
);

assert.equal(
  content.includes('expandedRelationGroups'),
  true,
  'resource panel should support collapsible relation groups'
);

console.log('knowledge resource panel format test passed');
