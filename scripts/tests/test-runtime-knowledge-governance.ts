import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readJson(relativePath: string) {
  return JSON.parse(read(relativePath));
}

function listSourceFiles(relativeDir: string): string[] {
  const absoluteDir = path.join(root, relativeDir);
  if (!fs.existsSync(absoluteDir)) return [];
  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const current = path.join(absoluteDir, entry.name);
    const relative = path.relative(root, current);
    if (entry.isDirectory()) return listSourceFiles(relative);
    return /\.(?:ts|tsx|js|jsx)$/.test(entry.name) ? [relative] : [];
  });
}

const seedAllKnowledge = read('scripts/db/seed-all-knowledge.mjs');
const showcaseSeed = read('scripts/db/seed-extracurricular-showcase.mjs');
const knowledgeNodeRoute = read('src/app/api/knowledge/nodes/[id]/route.ts');
const runtimeNodes = readJson('course-content/runtime/knowledge/graph/nodes.json') as Array<{ id: string }>;
const runtimeNodeIds = new Set(runtimeNodes.map((node) => node.id));

assert.equal(
  seedAllKnowledge.includes("const RUNTIME_SOURCE_MARKER = 'course-content/runtime/knowledge/graph/nodes.json'"),
  true,
  'seed-all-knowledge 应声明 runtime 知识图谱来源标记',
);
assert.equal(
  seedAllKnowledge.includes('validateRuntimeNodes(nodes, args)')
    && seedAllKnowledge.includes('refusing to deactivate runtime-owned knowledge without --allow-empty-runtime-graph'),
  true,
  'seed-all-knowledge 默认应拒绝空 runtime graph，避免误失活所有 runtime-owned 节点',
);
assert.equal(
  seedAllKnowledge.includes("id: { notIn: nodeIds }")
    && seedAllKnowledge.includes("path: ['source']")
    && seedAllKnowledge.includes('equals: RUNTIME_SOURCE_MARKER')
    && seedAllKnowledge.includes('data: { isActive: false }'),
  true,
  '过期 KnowledgeNode 只能按 runtime source marker 失活，不能全量失活数据库外部节点',
);
assert.equal(
  seedAllKnowledge.includes('sourceNode: {\n        is: {\n          metadata:')
    && seedAllKnowledge.includes('targetNode: {\n        is: {\n          metadata:'),
  true,
  '过期 KnowledgeLink 清理必须限定 source/target 都属于 runtime-owned 节点',
);
assert.equal(
  seedAllKnowledge.includes('selectRelationsForDb')
    && seedAllKnowledge.includes('database sync stores one deterministic representative relation per pair')
    && seedAllKnowledge.includes('完整关系语义保留在 runtime relations.jsonl'),
  true,
  '当前 KnowledgeLink 唯一键只能保存端点对代表关系，seed 脚本必须显式声明折叠策略',
);

assert.equal(
  knowledgeNodeRoute.includes('where: { id: params.id, isActive: true }'),
  true,
  '单知识节点 API 不应返回 inactive 节点',
);
assert.equal(
  knowledgeNodeRoute.includes('targetNode: { is: { isActive: true } }')
    && knowledgeNodeRoute.includes('sourceNode: { is: { isActive: true } }'),
  true,
  '单知识节点 API 应过滤 inactive 关联节点',
);

const nodeIdsBlocks = [...showcaseSeed.matchAll(/nodeIds:\s*\[([^\]]*)\]/g)];
assert.equal(nodeIdsBlocks.length > 0, true, '演示学习路径 seed 应包含 nodeIds 配置');
for (const match of nodeIdsBlocks) {
  const ids = [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]);
  for (const id of ids) {
    assert.equal(id.startsWith('node-'), false, `演示学习路径不应继续引用旧 node-* ID: ${id}`);
    if (id.startsWith('level-') || id === 'control-odyssey' || id === 'engineering-case-reading') continue;
    assert.equal(runtimeNodeIds.has(id), true, `演示学习路径引用的知识节点不存在于 runtime graph: ${id}`);
  }
}

const productionKnowledgeFiles = [
  ...listSourceFiles('src/features/teacher/preset-lessons/presets'),
  ...listSourceFiles('src/resources/interactive-learning'),
];

for (const relativeFile of productionKnowledgeFiles) {
  const text = read(relativeFile);
  const knowledgeNodeIds = [
    ...[...text.matchAll(/knowledgeNodeId:\s*'([^']+)'/g)].map((match) => match[1]),
    ...[...text.matchAll(/useKnowledgeCard\('([^']+)'\)/g)].map((match) => match[1]),
  ];
  if (relativeFile.includes('knowledge-deck')) {
    knowledgeNodeIds.push(...[...text.matchAll(/\bid:\s*'([^']+)'/g)].map((match) => match[1]));
  }

  for (const id of knowledgeNodeIds) {
    assert.equal(id.startsWith('node-'), false, `${relativeFile} 不应继续引用旧 node-* 知识节点 ID: ${id}`);
    assert.equal(runtimeNodeIds.has(id), true, `${relativeFile} 引用的知识节点不存在于 runtime graph: ${id}`);
  }
}

console.log('runtime knowledge governance test passed');
