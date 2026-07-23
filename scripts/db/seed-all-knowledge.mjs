import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createPrismaClient } from '../lib/prisma-client.mjs';

const prisma = createPrismaClient();

const ROOT = process.cwd();
const RUNTIME_KNOWLEDGE_ROOT = process.env.KNOWLEDGE_RUNTIME_ROOT
  ? path.resolve(process.env.KNOWLEDGE_RUNTIME_ROOT)
  : path.join(ROOT, 'course-content', 'runtime', 'knowledge');
const RUNTIME_NODES_PATH = path.join(RUNTIME_KNOWLEDGE_ROOT, 'graph', 'nodes.json');
const RUNTIME_RELS_PATH = path.join(RUNTIME_KNOWLEDGE_ROOT, 'graph', 'relations.jsonl');
const RUNTIME_SOURCE_MARKER = 'course-content/runtime/knowledge/graph/nodes.json';
const RUNTIME_RELATION_SOURCE_MARKER = 'course-content/runtime/knowledge/graph/relations.jsonl';

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

export function validateRelationsStrict(relationsPath = RUNTIME_RELS_PATH, nodesPath = RUNTIME_NODES_PATH) {
  const result = spawnSync(process.execPath, [
    path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    path.join(ROOT, 'scripts', 'knowledge', 'check-runtime-relation-coverage.ts'),
    '--relations', relationsPath,
    '--nodes', nodesPath,
  ], { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Strict runtime relation validation failed before database sync:\n${result.stdout || result.stderr}`);
  }
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

async function upsertNodes(db, nodes) {
  const nodeIds = nodes.map((node) => node.id);
  for (const node of nodes) {
    const metadata = {
      ...(node.metadata && typeof node.metadata === 'object' && !Array.isArray(node.metadata) ? node.metadata : {}),
      source: RUNTIME_SOURCE_MARKER,
    };
    const chapter = typeof node.chapter === 'number' ? node.chapter : metadata.chapter;
    await db.knowledgeNode.upsert({
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

  await db.knowledgeNode.updateMany({
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
  const selectedRelations = new Map();

  for (const relation of relations) {
    const id = relation.id ?? relation.relation_id ?? relation.relationId;
    const sourceId = relation.source_id ?? relation.sourceId;
    const targetId = relation.target_id ?? relation.targetId;
    const relationType = relation.relation_type ?? relation.relationType ?? relation.type ?? relation.relation;
    if (typeof id !== 'string' || !id || id.trim() !== id) throw new Error('Invalid runtime relation id');
    if (typeof sourceId !== 'string' || !sourceId || sourceId.trim() !== sourceId) throw new Error(`Invalid source endpoint for ${id}`);
    if (typeof targetId !== 'string' || !targetId || targetId.trim() !== targetId) throw new Error(`Invalid target endpoint for ${id}`);
    if (typeof relationType !== 'string' || !relationType || relationType.trim() !== relationType) throw new Error(`Invalid relation type for ${id}`);
    if (!nodeIds.has(sourceId) || !nodeIds.has(targetId)) throw new Error(`Unknown relation endpoint for ${id}`);
    if (selectedRelations.has(id)) {
      throw new Error(`Duplicate runtime relation id: ${id}`);
    }
    selectedRelations.set(id, {
      id,
      sourceId,
      targetId,
      relation: relationType,
      strength: asNumber(relation.strength, 1),
      metadata: sanitizeRelationMetadata(relation),
    });
  }

  return { selectedRelations };
}

const SOURCE_METADATA_KEYS = new Set([
  'documentId', 'page', 'pageNumber', 'section', 'sectionId', 'sourceType', 'title', 'version',
]);

function boundedText(value, maxLength) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : undefined;
}

function sanitizeSourceMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const output = {};
  for (const key of Object.keys(value).sort()) {
    if (!SOURCE_METADATA_KEYS.has(key)) continue;
    const item = value[key];
    if (typeof item === 'number' && Number.isFinite(item)) output[key] = item;
    else {
      const text = boundedText(item, 200);
      if (text) output[key] = text;
    }
  }
  return Object.keys(output).length ? output : undefined;
}

export function sanitizeRelationMetadata(relation) {
  const metadata = { runtimeSource: RUNTIME_RELATION_SOURCE_MARKER };
  const rationale = boundedText(relation.rationale, 500);
  const sourceDocument = boundedText(relation.sourceDocument, 300);
  const sourceMetadata = sanitizeSourceMetadata(relation.sourceMetadata);
  if (rationale) metadata.rationale = rationale;
  if (sourceDocument) metadata.sourceDocument = sourceDocument;
  if (sourceMetadata) metadata.sourceMetadata = sourceMetadata;
  for (const key of ['source_chapter', 'target_chapter', 'sourceChapter', 'targetChapter']) {
    const value = relation[key];
    if ((typeof value === 'number' && Number.isFinite(value)) || typeof value === 'string') {
      metadata[key] = typeof value === 'string' ? value.slice(0, 100) : value;
    }
  }
  return metadata;
}

export async function upsertRelations(db, relations, nodeIds) {
  let written = 0;
  const { selectedRelations } = selectRelationsForDb(relations, nodeIds);
  const activeRelationIds = new Set();

  for (const relation of [...selectedRelations.values()].sort((left, right) => (
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0
  ))) {
    activeRelationIds.add(relation.id);
    await db.knowledgeLink.upsert({
      where: { id: relation.id },
      update: {
        relation: relation.relation,
        sourceId: relation.sourceId,
        targetId: relation.targetId,
        strength: relation.strength,
        metadata: relation.metadata,
      },
      create: {
        id: relation.id,
        sourceId: relation.sourceId,
        targetId: relation.targetId,
        relation: relation.relation,
        strength: relation.strength,
        metadata: relation.metadata,
      },
    });
    written += 1;
  }

  const existingLinks = await db.knowledgeLink.findMany({
    where: {
      metadata: {
        path: ['runtimeSource'],
        equals: RUNTIME_RELATION_SOURCE_MARKER,
      },
    },
    select: { id: true },
  });
  const staleLinks = existingLinks.filter((link) => !activeRelationIds.has(link.id));

  for (const link of staleLinks) {
    await db.knowledgeLink.delete({
      where: { id: link.id },
    });
  }

  return { written, deleted: staleLinks.length };
}

async function main() {
  const args = parseArgs();
  console.log('同步 runtime 知识图谱到数据库...');

  const nodes = await readJson(RUNTIME_NODES_PATH);
  validateRuntimeNodes(nodes, args);
  validateRelationsStrict();
  const relations = await readJsonl(RUNTIME_RELS_PATH);
  const result = await prisma.$transaction(async (tx) => {
    await upsertNodes(tx, nodes);
    return upsertRelations(tx, relations, new Set(nodes.map((node) => node.id)));
  }, { timeout: 30_000 });

  console.log(`已同步 ${nodes.length} 个知识节点`);
  console.log(`已同步 ${result.written} 条知识关系，删除 ${result.deleted} 条过期关系`);
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
