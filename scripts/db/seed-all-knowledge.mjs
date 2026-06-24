import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createPrismaClient } from '../lib/prisma-client.mjs';

const prisma = createPrismaClient();

const ROOT = process.cwd();
const RUNTIME_KNOWLEDGE_ROOT = path.join(ROOT, 'course-content', 'runtime', 'knowledge');
const RUNTIME_NODES_PATH = path.join(RUNTIME_KNOWLEDGE_ROOT, 'graph', 'nodes.json');
const RUNTIME_RELS_PATH = path.join(RUNTIME_KNOWLEDGE_ROOT, 'graph', 'relations.jsonl');
const RUNTIME_SOURCE_MARKER = 'course-content/runtime/knowledge/graph/nodes.json';

const NODE_TYPES = new Set(['THEORY', 'SCENARIO', 'ETHICS']);
const BLOOM_LEVELS = new Set(['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE']);
const KNOWLEDGE_DIMS = new Set(['FACTUAL', 'CONCEPTUAL', 'PROCEDURAL', 'METACOGNITIVE']);

const CATEGORY_DIM_MAP = new Map([
  ['事实性', 'FACTUAL'],
  ['概念性', 'CONCEPTUAL'],
  ['程序性', 'PROCEDURAL'],
  ['元认知', 'METACOGNITIVE'],
  ['模型性', 'CONCEPTUAL'],
  ['方法性', 'PROCEDURAL'],
  ['场景性', 'FACTUAL'],
  ['实践性', 'PROCEDURAL'],
  ['评价性', 'METACOGNITIVE'],
  ['系统建模', 'CONCEPTUAL'],
  ['数学工具', 'PROCEDURAL'],
  ['典型环节', 'CONCEPTUAL'],
]);

export function parseArgs(argv = process.argv.slice(2)) {
  return {
    allowEmptyRuntimeGraph: argv.includes('--allow-empty-runtime-graph'),
  };
}

function asString(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asNumber(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeNodeType(value) {
  const normalized = asString(value, 'THEORY');
  return NODE_TYPES.has(normalized) ? normalized : 'THEORY';
}

function normalizeBloomLevel(value) {
  const normalized = asString(value, 'UNDERSTAND');
  return BLOOM_LEVELS.has(normalized) ? normalized : 'UNDERSTAND';
}

function normalizeKnowledgeDim(value, metadata) {
  const normalized = asString(value);
  if (KNOWLEDGE_DIMS.has(normalized)) return normalized;
  const category = asString(metadata?.category);
  return CATEGORY_DIM_MAP.get(category) ?? CATEGORY_DIM_MAP.get(normalized) ?? 'CONCEPTUAL';
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, 'utf8');
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

export function validateRuntimeNodes(nodes, options = {}) {
  if (!Array.isArray(nodes)) {
    throw new Error('runtime knowledge nodes must be an array');
  }
  if (nodes.length === 0 && !options.allowEmptyRuntimeGraph) {
    throw new Error(
      'runtime knowledge nodes is empty; refusing to deactivate runtime-owned knowledge without --allow-empty-runtime-graph',
    );
  }
}

function normalizeResources(resources) {
  return Array.isArray(resources) ? resources : [];
}

function normalizeTags(tags, chapter) {
  const values = Array.isArray(tags) ? tags.filter((item) => typeof item === 'string') : [];
  if (typeof chapter === 'number') values.push(`chapter-${chapter}`);
  return Array.from(new Set(values));
}

async function upsertNodes(nodes) {
  const nodeIds = nodes.map((node) => node.id);
  for (const node of nodes) {
    const metadata = node.metadata && typeof node.metadata === 'object' ? node.metadata : {};
    const chapter = typeof node.chapter === 'number' ? node.chapter : metadata.chapter;
    await prisma.knowledgeNode.upsert({
      where: { id: node.id },
      update: {
        name: asString(node.name, node.id),
        nodeType: normalizeNodeType(node.nodeType),
        description: asString(node.description, asString(metadata.definition, asString(node.name, node.id))),
        bloomLevel: normalizeBloomLevel(node.bloomLevel),
        knowledgeDim: normalizeKnowledgeDim(node.knowledgeDim, metadata),
        positionX: asNumber(node.positionX),
        positionY: asNumber(node.positionY),
        positionZ: asNumber(node.positionZ, typeof chapter === 'number' ? chapter : 0),
        content: node.content && typeof node.content === 'object' ? node.content : {},
        metadata,
        resources: normalizeResources(node.resources),
        tags: normalizeTags(node.tags, chapter),
        isActive: true,
      },
      create: {
        id: node.id,
        name: asString(node.name, node.id),
        nodeType: normalizeNodeType(node.nodeType),
        description: asString(node.description, asString(metadata.definition, asString(node.name, node.id))),
        bloomLevel: normalizeBloomLevel(node.bloomLevel),
        knowledgeDim: normalizeKnowledgeDim(node.knowledgeDim, metadata),
        positionX: asNumber(node.positionX),
        positionY: asNumber(node.positionY),
        positionZ: asNumber(node.positionZ, typeof chapter === 'number' ? chapter : 0),
        content: node.content && typeof node.content === 'object' ? node.content : {},
        metadata,
        resources: normalizeResources(node.resources),
        tags: normalizeTags(node.tags, chapter),
        isActive: true,
      },
    });
  }

  await prisma.knowledgeNode.updateMany({
    where: {
      id: { notIn: nodeIds },
      isActive: true,
      metadata: {
        path: ['source'],
        equals: RUNTIME_SOURCE_MARKER,
      },
    },
    data: { isActive: false },
  });
}

export function selectRelationsForDb(relations, nodeIds) {
  let skipped = 0;
  const selectedRelations = new Map();
  const relationTypesByPair = new Map();

  for (const relation of relations) {
    const sourceId = asString(relation.source_id ?? relation.sourceId);
    const targetId = asString(relation.target_id ?? relation.targetId);
    if (!sourceId || !targetId || !nodeIds.has(sourceId) || !nodeIds.has(targetId)) {
      skipped += 1;
      continue;
    }
    const key = `${sourceId}::${targetId}`;
    const relationType = asString(relation.relation_type ?? relation.relation, 'related');
    const relationTypes = relationTypesByPair.get(key) ?? new Set();
    relationTypes.add(relationType);
    relationTypesByPair.set(key, relationTypes);
    const normalized = {
      sourceId,
      targetId,
      relation: relationType,
      strength: asNumber(relation.strength, 1),
    };
    const existing = selectedRelations.get(key);
    if (
      !existing
      || normalized.strength > existing.strength
      || (normalized.strength === existing.strength && normalized.relation.localeCompare(existing.relation) < 0)
    ) {
      selectedRelations.set(key, normalized);
    }
  }

  const collapsed = [...relationTypesByPair.values()].filter((types) => types.size > 1).length;
  return { selectedRelations, skipped, collapsed };
}

async function upsertRelations(relations, nodeIds) {
  let written = 0;
  const { selectedRelations, skipped, collapsed } = selectRelationsForDb(relations, nodeIds);
  const activeRelationKeys = new Set();

  // KnowledgeLink is unique by source/target in the current Prisma schema, so
  // database sync stores one deterministic representative relation per pair.
  // The full multi-relation graph remains in runtime relations.jsonl.
  for (const relation of selectedRelations.values()) {
    const { sourceId, targetId } = relation;
    activeRelationKeys.add(`${sourceId}::${targetId}`);
    await prisma.knowledgeLink.upsert({
      where: {
        sourceId_targetId: {
          sourceId,
          targetId,
        },
      },
      update: {
        relation: relation.relation,
      },
      create: {
        sourceId,
        targetId,
        relation: relation.relation,
      },
    });
    written += 1;
  }

  const existingLinks = await prisma.knowledgeLink.findMany({
    where: {
      sourceNode: {
        is: {
          metadata: {
            path: ['source'],
            equals: RUNTIME_SOURCE_MARKER,
          },
        },
      },
      targetNode: {
        is: {
          metadata: {
            path: ['source'],
            equals: RUNTIME_SOURCE_MARKER,
          },
        },
      },
    },
    select: { sourceId: true, targetId: true },
  });
  const staleLinks = existingLinks.filter((link) => !activeRelationKeys.has(`${link.sourceId}::${link.targetId}`));

  for (const link of staleLinks) {
    await prisma.knowledgeLink.delete({
      where: {
        sourceId_targetId: {
          sourceId: link.sourceId,
          targetId: link.targetId,
        },
      },
    });
  }

  return { written, skipped, deleted: staleLinks.length, collapsed };
}

async function main() {
  const args = parseArgs();
  console.log('同步 runtime 知识图谱到数据库...');

  const nodes = await readJson(RUNTIME_NODES_PATH);
  validateRuntimeNodes(nodes, args);
  const relations = await readJsonl(RUNTIME_RELS_PATH);

  await upsertNodes(nodes);
  const result = await upsertRelations(relations, new Set(nodes.map((node) => node.id)));

  console.log(`已同步 ${nodes.length} 个知识节点`);
  console.log(`已同步 ${result.written} 条知识关系，跳过 ${result.skipped} 条缺端点关系，删除 ${result.deleted} 条过期关系`);
  if (result.collapsed > 0) {
    console.log(`已按数据库唯一键折叠 ${result.collapsed} 组多类型端点关系；完整关系语义保留在 runtime relations.jsonl`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
