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
const runtimeNodeCardPath = 'course-content/runtime/knowledge/cards/nodes/极点迁移_4_L2b001.md';
const runtimeConceptPath = 'course-content/runtime/knowledge/cards/concepts/相角裕度_5_5a74b451.mdx';
const legacyConceptPath = 'course-content/runtime/knowledge/cards/concepts/phase-margin.mdx';
const lessonJsonPath = 'course-content/runtime/lessons/legacy/L-2b/lesson.json';
const graphOverlayPath = 'course-content/runtime/lessons/legacy/L-2b/graph-overlay.json';
const handoutPath = 'course-content/runtime/lessons/legacy/L-2b/L-2b-handout.md';

assert.equal(fs.existsSync(path.join(root, nodesPath)), true, '应导出 runtime 全局知识节点文件 nodes.json');
assert.equal(fs.existsSync(path.join(root, relationsPath)), true, '应导出 runtime 全局关系文件 relations.jsonl');
assert.equal(fs.existsSync(path.join(root, runtimeNodeCardPath)), true, '应导出 runtime 节点卡片 Markdown');
assert.equal(
  fs.existsSync(path.join(root, runtimeConceptPath)),
  true,
  '应迁移 content/concepts 到 runtime/cards/concepts，并对已匹配节点的卡片改为 node_id 命名',
);
assert.equal(
  fs.existsSync(path.join(root, legacyConceptPath)),
  false,
  '已匹配到知识节点的 concepts 卡片不应继续保留旧文件名',
);
assert.equal(fs.existsSync(path.join(root, lessonJsonPath)), true, '应导出 L-2b lesson.json');
assert.equal(fs.existsSync(path.join(root, graphOverlayPath)), true, '应导出 L-2b graph-overlay.json');
assert.equal(fs.existsSync(path.join(root, handoutPath)), true, '应导出 L-2b handout.md');

const nodes = readJson(nodesPath);
assert.equal(Array.isArray(nodes), true, 'runtime 节点文件应为数组');
assert.equal(
  nodes.some((node: { id?: string; resources?: unknown[] }) => node.id === '极点迁移_4_L2b001' && Array.isArray(node.resources)),
  true,
  'runtime 节点文件应包含 L-2b 节点及其资源信息',
);

const relations = readText(relationsPath)
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line) as { source_id?: string; target_id?: string });
assert.equal(
  relations.some((relation) => relation.source_id === '极点迁移_4_L2b001' || relation.target_id === '极点迁移_4_L2b001'),
  true,
  'runtime 关系文件应包含 L-2b 新节点关系',
);

const lessonJson = readJson(lessonJsonPath);
assert.equal(lessonJson.lesson_id, 'L-2b', 'lesson.json 应标记当前课次');
assert.equal(Array.isArray(lessonJson.card_order), true, 'lesson.json 应保留卡片顺序');
assert.equal(typeof lessonJson.handout_path, 'string', 'lesson.json 应暴露讲义路径');
assert.equal(lessonJson.handout_path, '/course-runtime/lessons/legacy/L-2b/L-2b-handout.md', 'handout_path 应走 course-runtime');

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
  handout.includes('/course-runtime/lessons/legacy/L-2b/media/sh-01-pole-migration-locus.svg'),
  true,
  '导出的 handout 应将相对媒体路径改写为 course-runtime 路径',
);

const runtimeNodeCard = readText(runtimeNodeCardPath);
assert.equal(runtimeNodeCard.includes('极点迁移'), true, 'runtime 节点卡片应保留原始内容');

const runtimeConcept = readText(runtimeConceptPath);
assert.equal(runtimeConcept.includes('相角裕度'), true, 'runtime concepts 卡片应保留兼容内容');

console.log('runtime knowledge export test passed');
