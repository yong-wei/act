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
  content.includes('GovernedBlockMath'),
  true,
  'resource panel should use shared governed KaTeX for formulas'
);

assert.equal(
  content.includes('expandedRelationGroups'),
  true,
  'resource panel should support collapsible relation groups'
);

assert.equal(
  content.includes('node.inspectionSentence') && content.includes('node.evidenceState'),
  true,
  'resource panel should render the shared directional sentence and explicit evidence state'
);

assert.equal(
  content.includes("node.cycleState === 'cyclic'")
    && content.includes('循环依赖，需共同理解或待审查'),
  true,
  'resource panel should surface cyclic dependency inspection state'
);

assert.equal(
  content.includes('node.relationId ?? node.canonicalType ?? node.relation'),
  true,
  'resource panel should retain multiple relation provenance records for one neighboring node'
);

console.log('knowledge resource panel format test passed');
