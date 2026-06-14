import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function readJson(relativePath: string) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

const runtimeConceptsDir = 'course-content/runtime/knowledge/cards/concepts';
const nodesPath = 'course-content/runtime/knowledge/graph/nodes.json';
const migratedNodeCardPath = 'course-content/runtime/knowledge/cards/nodes/相角裕度_5_5a74b451.md';

function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const current = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(current);
    return [current];
  });
}

assert.equal(
  fs.existsSync(path.join(root, runtimeConceptsDir)),
  false,
  'runtime 不应继续生成废弃的 cards/concepts MDX 目录',
);

assert.equal(
  fs.existsSync(path.join(root, migratedNodeCardPath)),
  true,
  '作者态引用过的 legacy concepts 内容应已迁移为节点 Markdown 卡片',
);

const nodes = readJson(nodesPath) as Array<{ id: string; resources?: unknown[] }>;
const phaseMarginNode = nodes.find((node) => node.id === '相角裕度_5_5a74b451');
const runtimeLessonJsonFiles = listFiles(path.join(root, 'course-content/runtime/lessons'))
  .filter((file) => file.endsWith('.json'));

assert.equal(Boolean(phaseMarginNode), true, 'runtime 节点文件应包含相角裕度节点');
assert.equal(
  phaseMarginNode?.resources?.includes(migratedNodeCardPath),
  true,
  'runtime 节点资源应引用迁移后的节点 Markdown 卡片',
);
assert.equal(
  JSON.stringify(phaseMarginNode?.resources ?? []).includes('/cards/concepts/'),
  false,
  'runtime 节点资源不应继续引用 concepts MDX 卡片',
);

for (const file of runtimeLessonJsonFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const relativeFile = path.relative(root, file);
  assert.equal(text.includes('.mdx'), false, `${relativeFile} 不应继续引用 MDX 卡片`);
  assert.equal(text.includes('cards/concepts'), false, `${relativeFile} 不应继续引用废弃 concepts 卡片目录`);
  assert.equal(text.includes('content/concepts'), false, `${relativeFile} 不应继续引用废弃 content/concepts 目录`);
}

for (const node of nodes) {
  const resources = Array.isArray(node.resources) ? node.resources : [];
  for (const resource of resources) {
    const resourcePath = typeof resource === 'string'
      ? resource
      : resource && typeof resource === 'object' && typeof (resource as { path?: unknown }).path === 'string'
        ? String((resource as { path: string }).path)
        : null;
    if (!resourcePath?.includes('course-content/runtime/knowledge/cards/nodes/')) continue;
    assert.equal(
      fs.existsSync(path.join(root, resourcePath)),
      true,
      `runtime 节点 ${node.id} 引用的 Markdown 卡片不存在：${resourcePath}`,
    );
  }
}

console.log('runtime concepts deprecation test passed');
