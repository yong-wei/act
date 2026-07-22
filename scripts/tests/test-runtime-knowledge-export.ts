import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function readJson(relativePath: string) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function readText(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const nodesPath = 'course-content/runtime/knowledge/graph/nodes.json';
const relationsPath = 'course-content/runtime/knowledge/graph/relations.jsonl';
const coveragePath = 'course-content/runtime/knowledge/cards/coverage.json';
const lessonId = '3-6';
const runtimeNodeId = '目标驱动PD校正_3_36002';
const runtimeNodeWithKnowledgeTypeId = '展示解与Pareto最小取舍_4_44006';
const runtimeNodeCardPath = `course-content/runtime/knowledge/cards/nodes/${runtimeNodeId}.md`;
const migratedConceptNodeCardPath = 'course-content/runtime/knowledge/cards/nodes/相角裕度_5_5a74b451.md';
const authoringConceptsDirPath = 'course-content/authoring/knowledge/cards/concepts';
const runtimeConceptsDirPath = 'course-content/runtime/knowledge/cards/concepts';
const lessonJsonPath = `course-content/runtime/lessons/${lessonId}/lesson.json`;
const graphOverlayPath = `course-content/runtime/lessons/${lessonId}/graph-overlay.json`;
const handoutPath = `course-content/runtime/lessons/${lessonId}/${lessonId}-handout.md`;

assert.equal(fs.existsSync(path.join(root, nodesPath)), true, '应导出 runtime 全局知识节点文件 nodes.json');
assert.equal(fs.existsSync(path.join(root, relationsPath)), true, '应导出 runtime 全局关系文件 relations.jsonl');
assert.equal(fs.existsSync(path.join(root, coveragePath)), true, '应导出知识卡片覆盖清单');
assert.equal(fs.existsSync(path.join(root, runtimeNodeCardPath)), true, '应导出 runtime 节点卡片 Markdown');
assert.equal(
  fs.existsSync(path.join(root, migratedConceptNodeCardPath)),
  true,
  '已匹配到知识节点的 legacy concepts 卡片应统一迁移为 runtime 节点 Markdown 卡片',
);
assert.equal(
  fs.existsSync(path.join(root, authoringConceptsDirPath)),
  false,
  'authoring 不应继续保留废弃的 cards/concepts MDX 目录',
);
assert.equal(
  fs.existsSync(path.join(root, runtimeConceptsDirPath)),
  false,
  'runtime 不应继续生成 cards/concepts MDX 目录',
);
assert.equal(fs.existsSync(path.join(root, lessonJsonPath)), true, `应导出 ${lessonId} lesson.json`);
assert.equal(fs.existsSync(path.join(root, graphOverlayPath)), true, `应导出 ${lessonId} graph-overlay.json`);
assert.equal(fs.existsSync(path.join(root, handoutPath)), true, `应导出 ${lessonId} handout.md`);

const nodes = readJson(nodesPath);
const coverage = readJson(coveragePath);
assert.equal(Array.isArray(nodes), true, 'runtime 节点文件应为数组');
assert.deepEqual(
  coverage.summary,
  { total: nodes.length, linked: nodes.length, missing_authoring: 0, invalid_mapping_or_runtime: 0, excluded: 0 },
  '知识卡片覆盖清单不得包含未分类节点或失效映射',
);
assert.equal(coverage.items.length, nodes.length, '覆盖清单应覆盖每个 runtime 图谱节点');
assert.equal(
  nodes.every((node: { id?: string; resources?: unknown[] }) => (
    Array.isArray(node.resources)
      && node.resources.includes(`course-content/runtime/knowledge/cards/nodes/${node.id}.md`)
      && fs.existsSync(path.join(root, `course-content/runtime/knowledge/cards/nodes/${node.id}.md`))
  )),
  true,
  '每个 runtime 图谱节点都必须指向存在且同 node_id 的知识卡片',
);
assert.equal(
  nodes.some((node: { id?: string; resources?: unknown[] }) => node.id === runtimeNodeId && Array.isArray(node.resources)),
  true,
  'runtime 节点文件应包含当前课次节点及其资源信息',
);
assert.equal(
  nodes.some((node: { id?: string; metadata?: { knowledge_type?: string } }) => (
    node.id === runtimeNodeWithKnowledgeTypeId && node.metadata?.knowledge_type === 'D'
  )),
  true,
  'runtime 节点 metadata 应保留作者态 knowledge_type',
);

const relations = readText(relationsPath)
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line) as { source_id?: string; target_id?: string });
assert.equal(
  relations.some((relation) => relation.source_id === runtimeNodeId || relation.target_id === runtimeNodeId),
  true,
  'runtime 关系文件应包含当前课次节点关系',
);

const lessonJson = readJson(lessonJsonPath);
assert.equal(lessonJson.lesson_id, lessonId, 'lesson.json 应标记当前课次');
assert.equal(Array.isArray(lessonJson.card_order), true, 'lesson.json 应保留卡片顺序');
assert.equal(typeof lessonJson.handout_path, 'string', 'lesson.json 应暴露讲义路径');
assert.equal(lessonJson.handout_path, `/course-runtime/lessons/${lessonId}/${lessonId}-handout.md`, 'handout_path 应走 course-runtime');

const graphOverlay = readJson(graphOverlayPath);
assert.deepEqual(
  graphOverlay.focus_node_ids,
  lessonJson.focus_node_ids,
  'graph-overlay 应与 lesson.json 共享 focus_node_ids',
);
assert.equal(Array.isArray(graphOverlay.nodes), true, 'graph-overlay 应包含课次局部节点');
assert.equal(Array.isArray(graphOverlay.links), true, 'graph-overlay 应包含课次局部关系');

const handout = readText(handoutPath);
assert.equal(
  handout.includes(`/course-runtime/lessons/${lessonId}/media/`),
  true,
  '导出的 handout 应将相对媒体路径改写为 course-runtime 路径',
);

const runtimeNodeCard = readText(runtimeNodeCardPath);
assert.equal(runtimeNodeCard.includes('目标驱动PD校正'), true, 'runtime 节点卡片应保留原始内容');

const migratedConceptNodeCard = readText(migratedConceptNodeCardPath);
assert.equal(migratedConceptNodeCard.includes('相角裕度'), true, '迁移后的 runtime 节点卡片应保留原始知识点内容');

console.log('runtime knowledge export test passed');
