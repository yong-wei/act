import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { getKnowledgeGraphRelationContract } from '../../src/features/knowledge/graph/relation-contract';

type JsonObject = Record<string, unknown>;

interface RuntimeNode extends JsonObject {
  id: string;
  name: string;
  nodeType: string;
  description: string;
  positionX: number;
  positionY: number;
  positionZ: number;
  chapter?: number;
  chapterName?: string;
  bloomLevel?: string;
  knowledgeDim?: string;
  tags?: string[];
  metadata?: JsonObject;
}

interface RuntimeRelation extends JsonObject {
  id: string;
  source_id: string;
  target_id: string;
  relation_type: string;
  strength?: number;
}

const repoRoot = process.cwd();
const fixtureRoot = join(repoRoot, 'tests/fixtures/knowledge-graph-task-7-4');
const nodesPath = join(repoRoot, 'course-content/runtime/knowledge/graph/nodes.json');
const relationsPath = join(repoRoot, 'course-content/runtime/knowledge/graph/relations.jsonl');
const overlayPaths = {
  '1-1': join(repoRoot, 'course-content/runtime/lessons/1-1/graph-overlay.json'),
  '5-3': join(repoRoot, 'course-content/runtime/lessons/5-3/graph-overlay.json'),
} as const;

function sha256(bytes: string | Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function jsonBytes(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function stableCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function publicNode(node: RuntimeNode, expansion: { state: 'expandable' | 'leaf'; revealableNeighborCount?: number }) {
  const importance = typeof node.metadata?.importance === 'number' ? node.metadata.importance : undefined;
  return {
    id: node.id,
    name: node.name,
    nodeType: node.nodeType,
    description: node.description,
    positionX: node.positionX,
    positionY: node.positionY,
    positionZ: node.positionZ,
    ...(node.bloomLevel ? { bloomLevel: node.bloomLevel } : {}),
    ...(node.knowledgeDim ? { knowledgeDim: node.knowledgeDim } : {}),
    ...(node.tags ? { tags: node.tags } : {}),
    ...(typeof node.chapter === 'number' ? { chapter: node.chapter } : {}),
    ...(node.chapterName ? { chapterName: node.chapterName } : {}),
    expansion,
    ...(importance !== undefined ? { importance } : {}),
  };
}

function publicLink(relation: RuntimeRelation) {
  return {
    id: relation.id,
    relation: relation.relation_type,
    relationType: relation.relation_type,
    sourceId: relation.source_id,
    targetId: relation.target_id,
    ...(typeof relation.strength === 'number' ? { strength: relation.strength } : {}),
  };
}

async function readInputs() {
  const [nodesBytes, relationsBytes, overlay11Bytes, overlay53Bytes] = await Promise.all([
    readFile(nodesPath, 'utf8'),
    readFile(relationsPath, 'utf8'),
    readFile(overlayPaths['1-1'], 'utf8'),
    readFile(overlayPaths['5-3'], 'utf8'),
  ]);
  const nodes = JSON.parse(nodesBytes) as RuntimeNode[];
  const relations = relationsBytes.split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line) as RuntimeRelation);
  return {
    nodes,
    relations,
    sourceBytes: { nodesBytes, relationsBytes, overlay11Bytes, overlay53Bytes },
    overlays: {
      '1-1': JSON.parse(overlay11Bytes) as { card_order: string[] },
      '5-3': JSON.parse(overlay53Bytes) as { card_order: string[] },
    },
  };
}

function domainStatistics(nodes: RuntimeNode[], relations: RuntimeRelation[]) {
  const groups = new Map<string, RuntimeNode[]>();
  for (const node of nodes) {
    const name = node.chapterName ?? '未分组';
    groups.set(name, [...(groups.get(name) ?? []), node]);
  }
  return [...groups.entries()].map(([name, domainNodes]) => {
    const ids = new Set(domainNodes.map((node) => node.id));
    const internalRelations = relations.filter((relation) => ids.has(relation.source_id) && ids.has(relation.target_id));
    const associationRelations = internalRelations.filter((relation) => (
      getKnowledgeGraphRelationContract(relation.relation_type)?.family === 'association'
    ));
    return { name, nodes: domainNodes, internalRelations, associationRelations };
  });
}

function makeLargestDomainFixture(nodes: RuntimeNode[], relations: RuntimeRelation[]) {
  const domains = domainStatistics(nodes, relations);
  const largest = [...domains].sort((left, right) => (
    right.nodes.length - left.nodes.length
    || right.internalRelations.length - left.internalRelations.length
    || stableCompare(left.name, right.name)
  ))[0];
  const densest = [...domains].sort((left, right) => (
    right.associationRelations.length - left.associationRelations.length
    || right.nodes.length - left.nodes.length
    || stableCompare(left.name, right.name)
  ))[0];
  if (!largest || !densest || largest.name !== '状态空间' || densest.name !== '状态空间') {
    throw new Error(`Reviewer formula drift: expected 状态空间 as largest and densest, received ${largest?.name}/${densest?.name}.`);
  }
  const graphVersion = sha256(jsonBytes({
    nodeBytes: sha256(jsonBytes(largest.nodes)),
    relationBytes: sha256(jsonBytes(largest.internalRelations)),
  })).slice(0, 16);
  const rootId = `chapter-node:${largest.name}`;
  const degree = new Map<string, number>();
  for (const relation of largest.internalRelations) {
    degree.set(relation.source_id, (degree.get(relation.source_id) ?? 0) + 1);
    degree.set(relation.target_id, (degree.get(relation.target_id) ?? 0) + 1);
  }
  const memberNodes = [...largest.nodes]
    .sort((left, right) => stableCompare(left.id, right.id))
    .map((node) => publicNode(node, (degree.get(node.id) ?? 0) > 0
      ? { state: 'expandable', revealableNeighborCount: degree.get(node.id)! }
      : { state: 'leaf' }));
  const rootNode = {
    id: rootId,
    name: largest.name,
    nodeType: 'THEORY',
    description: `${largest.name}（共 ${memberNodes.length} 个知识点，选择后可展开）`,
    positionX: 0,
    positionY: 0,
    positionZ: 1,
    chapter: 1,
    chapterName: largest.name,
    expansion: { state: 'expandable', revealableNeighborCount: memberNodes.length },
  };
  const links = [...largest.internalRelations].sort((left, right) => stableCompare(left.id, right.id)).map(publicLink);
  return {
    schemaVersion: 1,
    origin: 'course-content/runtime/knowledge/graph',
    selection: {
      largestDomainFormula: 'max(node_count), then max(internal_relation_count), then UTF-8 lexical domain name',
      densestAssociationFormula: 'max(internal_association_relation_count), then max(node_count), then UTF-8 lexical domain name',
      domainName: largest.name,
      nodeCount: memberNodes.length,
      internalRelationCount: links.length,
      internalAssociationRelationCount: largest.associationRelations.length,
      viewportCoverageMinimums: {
        '2D': { body: 40, label: 15 },
        '3D': { body: 100, label: 15 },
      },
    },
    graphVersion,
    rootPayload: {
      mode: 'root',
      graphVersion,
      shardKey: `${graphVersion}:shard:root:chapters`,
      filterSignature: 'all',
      nodes: [rootNode],
      links: [],
      rootCatalog: memberNodes.map((node) => ({
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.nodeType,
        domainId: rootId,
        chapterName: largest.name,
      })),
      rootSummaries: [{
        rootId,
        label: largest.name,
        chapterName: largest.name,
        nodeCount: memberNodes.length,
        linkCount: links.length,
        hasExpansion: true,
      }],
      source: 'file',
      truncated: { nodes: false, links: false, membershipLinks: false },
    },
    expansionPayload: {
      mode: 'expansion',
      domainId: rootId,
      graphVersion,
      shardKey: `${graphVersion}:shard:expansion:${rootId}`,
      filterSignature: 'all',
      nodes: [rootNode, ...memberNodes],
      links,
      membershipLinks: memberNodes.map((node) => ({
        id: `chapter-link:${rootId}->${node.id}`,
        sourceId: rootId,
        targetId: node.id,
        relation: 'contains',
        relationType: 'contains',
        strength: 1,
      })),
      source: 'file',
      truncated: { nodes: false, links: false, membershipLinks: false, corridorLinks: false },
    },
  };
}

function makeCases(
  nodes: RuntimeNode[],
  relations: RuntimeRelation[],
  overlays: Record<'1-1' | '5-3', { card_order: string[] }>,
  overlayBytes: Record<'1-1' | '5-3', string>,
) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const requiredIds = ['极点配置_9_b5578c51', '状态_9_279b716f', '阻尼比_3_b849784e', '超调量_3_fc3f5b17'];
  for (const id of requiredIds) if (!nodeById.has(id)) throw new Error(`Required reviewer fixture node is missing: ${id}`);
  const crossDomain = relations.find((relation) => (
    relation.source_id === '阻尼比_3_b849784e'
    && relation.target_id === '超调量_3_fc3f5b17'
    && relation.relation_type === 'leads_to'
  ));
  if (!crossDomain) throw new Error('Required real cross-domain 阻尼比→超调量 relation is missing.');
  const associationPressure = relations
    .filter((relation) => relation.source_id === '极点配置_9_b5578c51' || relation.target_id === '极点配置_9_b5578c51')
    .filter((relation) => getKnowledgeGraphRelationContract(relation.relation_type)?.family === 'association')
    .sort((left, right) => (right.strength ?? 1) - (left.strength ?? 1) || stableCompare(left.id, right.id));
  const corridor = relations
    .filter((relation) => relation.source_id === '状态_9_279b716f' || relation.target_id === '状态_9_279b716f')
    .filter((relation) => getKnowledgeGraphRelationContract(relation.relation_type)?.family === 'post-requisite')
    .sort((left, right) => (right.strength ?? 1) - (left.strength ?? 1) || stableCompare(left.id, right.id));
  const noOrderNodes = nodes.filter((node) => node.chapterName === '课程全景').map((node) => node.id).sort(stableCompare);
  return {
    schemaVersion: 1,
    cases: {
      lessons: (['1-1', '5-3'] as const).map((lessonId) => ({
        id: `lesson-${lessonId}`,
        origin: `course-content/runtime/lessons/${lessonId}/graph-overlay.json`,
        exactBytesSha256: sha256(overlayBytes[lessonId]),
        cardOrder: overlays[lessonId].card_order,
      })),
      densestAssociation: {
        id: 'association-pressure-pole-placement',
        origin: 'runtime',
        selectedNodeId: '极点配置_9_b5578c51',
        candidateEdgeIds: associationPressure.map((relation) => relation.id),
        expectedVisibleCap: 24,
      },
      corridor: {
        id: 'corridor-state',
        origin: 'runtime',
        selectedNodeId: '状态_9_279b716f',
        directPostRequisiteEdgeIds: corridor.map((relation) => relation.id),
        expectedNodeBoundary: 41,
        expectedEdgeBoundary: 96,
      },
      reciprocalScc: {
        id: 'synthetic-reciprocal-scc',
        origin: 'synthetic-task-7-4',
        reason: 'Runtime data does not guarantee a stable minimal reciprocal SCC fixture.',
        nodes: [
          { id: 'task-7-4-scc-a', name: 'SCC A' },
          { id: 'task-7-4-scc-b', name: 'SCC B' },
        ],
        links: [
          { id: 'task-7-4-scc-a-b', sourceId: 'task-7-4-scc-a', targetId: 'task-7-4-scc-b', relationType: 'prerequisite' },
          { id: 'task-7-4-scc-b-a', sourceId: 'task-7-4-scc-b', targetId: 'task-7-4-scc-a', relationType: 'prerequisite' },
        ],
      },
      noOrder: {
        id: 'no-order-course-panorama',
        origin: 'runtime',
        domainName: '课程全景',
        activeLessonId: null,
        orderSource: 'none',
        nodeIds: noOrderNodes,
      },
      crossDomain: {
        id: 'real-damping-ratio-to-overshoot',
        origin: 'runtime',
        relation: publicLink(crossDomain),
      },
    },
  };
}

async function generate() {
  const { nodes, relations, sourceBytes, overlays } = await readInputs();
  const largestDomain = makeLargestDomainFixture(nodes, relations);
  const cases = makeCases(nodes, relations, overlays, {
    '1-1': sourceBytes.overlay11Bytes,
    '5-3': sourceBytes.overlay53Bytes,
  });
  const largestDomainBytes = jsonBytes(largestDomain);
  const casesBytes = jsonBytes(cases);
  const manifest = {
    schemaVersion: 1,
    generator: 'scripts/knowledge/generate-knowledge-graph-task-7-4-fixtures.ts',
    sources: [
      { path: relative(repoRoot, nodesPath), exactBytesSha256: sha256(sourceBytes.nodesBytes) },
      { path: relative(repoRoot, relationsPath), exactBytesSha256: sha256(sourceBytes.relationsBytes) },
      { path: relative(repoRoot, overlayPaths['1-1']), exactBytesSha256: sha256(sourceBytes.overlay11Bytes) },
      { path: relative(repoRoot, overlayPaths['5-3']), exactBytesSha256: sha256(sourceBytes.overlay53Bytes) },
    ],
    fixtures: [
      { path: 'largest-domain.json', byteLength: Buffer.byteLength(largestDomainBytes), exactBytesSha256: sha256(largestDomainBytes) },
      { path: 'cases.json', byteLength: Buffer.byteLength(casesBytes), exactBytesSha256: sha256(casesBytes) },
    ],
  };
  return new Map([
    ['largest-domain.json', largestDomainBytes],
    ['cases.json', casesBytes],
    ['manifest.json', jsonBytes(manifest)],
  ]);
}

async function main() {
  const mode = process.argv[2];
  if (mode !== '--check' && mode !== '--write') throw new Error('Usage: tsx scripts/knowledge/generate-knowledge-graph-task-7-4-fixtures.ts --check|--write');
  const generated = await generate();
  if (mode === '--write') await mkdir(fixtureRoot, { recursive: true });
  const drift: string[] = [];
  for (const [name, bytes] of generated) {
    const path = join(fixtureRoot, name);
    if (mode === '--write') await writeFile(path, bytes);
    else if (await readFile(path, 'utf8').catch(() => null) !== bytes) drift.push(relative(repoRoot, path));
  }
  if (drift.length > 0) throw new Error(`Task 7.4 fixture drift: ${drift.join(', ')}`);
  process.stdout.write(`${mode === '--write' ? 'Wrote' : 'Verified'} ${generated.size} Task 7.4 fixture files.\n`);
}

void main();
