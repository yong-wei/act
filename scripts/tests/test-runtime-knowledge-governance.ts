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
const knowledgeNodesRoute = read('src/app/api/knowledge/nodes/route.ts');
const knowledgeGraphSource = read('src/lib/knowledge-graph-source.ts');
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
  seedAllKnowledge.includes("path: ['runtimeSource']")
    && seedAllKnowledge.includes('equals: RUNTIME_RELATION_SOURCE_MARKER'),
  true,
  '过期 KnowledgeLink 清理必须限定显式 runtime relation ownership 标记',
);
assert.equal(
  seedAllKnowledge.includes('selectRelationsForDb')
    && seedAllKnowledge.includes('validateRelationsStrict()')
    && seedAllKnowledge.includes('prisma.$transaction(async (tx)')
    && seedAllKnowledge.includes('where: { id: relation.id }')
    && seedAllKnowledge.includes('metadata: relation.metadata')
    && !seedAllKnowledge.includes('sourceId_targetId'),
  true,
  'KnowledgeLink seed 必须按 relation id 无损保留同端点多语义与 provenance',
);

assert.equal(
  knowledgeNodeRoute.includes('buildKnowledgeNodeDetailFromGraph(graph, params.id)')
    && knowledgeGraphSource.includes("path: ['source'], equals: RUNTIME_NODE_SOURCE_MARKER"),
  true,
  '单知识节点 API 应从已过滤 active 节点的共享 graph source 构建详情',
);
assert.equal(
  knowledgeGraphSource.includes("where: { metadata: { path: ['runtimeSource'], equals: RUNTIME_RELATION_SOURCE_MARKER } }")
    && !knowledgeGraphSource.includes('targetNode: { isActive: true }')
    && !knowledgeGraphSource.includes('sourceNode: { isActive: true }')
    && knowledgeNodesRoute.includes('loadKnowledgeGraphData()')
    && knowledgeNodesRoute.includes('.map(toPublicKnowledgeGraphNode)')
    && !knowledgeNodesRoute.includes('prisma.knowledgeNode.findMany'),
  true,
  '共享 graph source 应读取全部 runtime 关系并让节点列表复用 runtime-only sanitized loader',
);
assert.equal(
  knowledgeGraphSource.includes('prisma.$transaction(async (tx)')
    && knowledgeGraphSource.includes("isolationLevel: 'RepeatableRead'")
    && knowledgeGraphSource.includes('loadDatabaseRelationVersionEvidence(db)')
    && !knowledgeGraphSource.includes('loadDatabaseRelationVersionEvidence()'),
  true,
  'DB graph payload 与 relation fingerprint 必须来自同一 RepeatableRead 快照',
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
