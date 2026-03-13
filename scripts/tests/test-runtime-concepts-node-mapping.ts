import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const mappedConceptPath = 'course-content/runtime/knowledge/cards/concepts/相角裕度_5_5a74b451.mdx';
const oldSlugPath = 'course-content/runtime/knowledge/cards/concepts/phase-margin.mdx';
const nodesPath = 'course-content/runtime/knowledge/graph/nodes.json';

assert.equal(
  fs.existsSync(path.join(root, mappedConceptPath)),
  true,
  'runtime concepts 卡片应按匹配到的 node_id 重命名',
);

const nodes = JSON.parse(read(nodesPath)) as Array<{ id: string; resources?: string[] }>;
const phaseMarginNode = nodes.find((node) => node.id === '相角裕度_5_5a74b451');

assert.equal(
  Boolean(phaseMarginNode),
  true,
  'runtime 节点文件应包含相角裕度节点',
);

assert.equal(
  phaseMarginNode?.resources?.includes(mappedConceptPath),
  true,
  'runtime 节点资源应直接映射到 node_id 形式的 concepts 卡片路径',
);

assert.equal(
  phaseMarginNode?.resources?.includes('course-content/runtime/knowledge/cards/concepts/phase-margin.mdx'),
  false,
  'runtime 节点资源不应继续引用旧 slug 命名的 concepts 卡片',
);

assert.equal(
  fs.existsSync(path.join(root, oldSlugPath)),
  false,
  '已映射的 concepts 卡片不应继续保留旧 slug 文件名',
);

console.log('runtime concepts node mapping test passed');
