import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const target = path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-2d.tsx');
const content = fs.readFileSync(target, 'utf8');

assert.equal(
  content.includes("document.documentElement.classList.contains('light')"),
  true,
  'knowledge-graph-2d should detect light theme from root class'
);

assert.equal(
  content.includes('#0f172a'),
  true,
  'knowledge-graph-2d should use dark text color in light theme'
);

console.log('knowledge graph theme test passed');
