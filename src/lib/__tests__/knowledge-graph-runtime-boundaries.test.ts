import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    knowledgeLink: { findMany: vi.fn(async () => []) },
    knowledgeNode: { findMany: vi.fn(async () => []) },
    $queryRaw: vi.fn(async () => [{ linkCount: BigInt(0), fingerprint: '' }]),
  },
}));

import {
  buildDatabaseKnowledgeGraphPayload,
  buildKnowledgeGraphActiveFilterPayload,
  buildKnowledgeGraphExpansionPayload,
  buildKnowledgeGraphRemainingPayload,
  buildKnowledgeGraphRootPayload,
  buildKnowledgeNodeDetailFromGraph,
  loadKnowledgeGraphData,
  PUBLIC_DETAIL_BYTE_BUDGET,
  PUBLIC_GRAPH_BYTE_BUDGET,
  InvalidKnowledgeGraphIdentityError,
  toPublicKnowledgeGraphPayload,
  toPublicKnowledgeGraphNode,
  type UnifiedKnowledgeGraphPayload,
  type UnifiedKnowledgeNode,
} from '@/lib/knowledge-graph-source';
import {
  buildInitialGraphCache,
  mergeProgressiveGraphPayload,
  selectCanvasKnowledgeRelationLinks,
} from '@/features/knowledge/progressive-graph-cache';
import {
  inspectRuntimeKnowledgeRelationCoverage,
  PUBLIC_DIAGNOSTICS_BYTE_BUDGET,
  RUNTIME_KNOWLEDGE_RELATION_CONTRACT_COVERAGE,
  RuntimeKnowledgeRelationCoverageError,
  toPublicRuntimeKnowledgeDiagnostics,
} from '@/lib/knowledge-graph-relation-runtime';

function node(id: string, chapterName = '系统模型'): UnifiedKnowledgeNode {
  return {
    id,
    name: id,
    nodeType: 'THEORY',
    description: id,
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    chapter: 2,
    chapterName,
  };
}

function databaseGraph(links: Array<{
  id: string;
  metadata?: Record<string, unknown>;
  relation: string;
  sourceId: string;
  strength?: number;
  targetId: string;
}>) {
  const databaseNodes = [node('node-a'), node('node-b')].map((item) => ({
    ...item,
    bloomLevel: null,
    knowledgeDim: null,
    metadata: {},
    content: {},
    resources: [],
    tags: [],
  }));
  return buildDatabaseKnowledgeGraphPayload(
    databaseNodes,
    links,
    { includeLinks: true, relationVersion: { linkCount: links.length, fingerprint: 'fixture' } }
  );
}

describe('knowledge graph navigation membership boundary', () => {
  it('keeps expansion membership for bookkeeping but excludes it from cache relations and renderer input', () => {
    const graph: UnifiedKnowledgeGraphPayload = {
      nodes: [node('node-a'), node('node-b')],
      links: inspectRuntimeKnowledgeRelationCoverage(`${JSON.stringify({
        id: 'canonical-relation',
        source_id: 'node-a',
        target_id: 'node-b',
        relation_type: 'related',
      })}\n`).runtimeLinks,
      source: 'file',
      versionDigest: 'fixture',
    };

    const payload = buildKnowledgeGraphExpansionPayload(graph, 'chapter-node:系统模型');
    expect(payload.membershipLinks).toHaveLength(2);
    expect(payload.membershipLinks?.every((link) => link.id.startsWith('chapter-link:'))).toBe(true);
    expect(payload.links[0].id).toMatch(/^visual:/);

    const rootCache = mergeProgressiveGraphPayload(
      buildInitialGraphCache([], []),
      buildKnowledgeGraphRootPayload(graph)
    );
    const cache = mergeProgressiveGraphPayload(rootCache, payload);
    expect(Object.values(cache.linksByKey)[0].id).toMatch(/^visual:/);
    expect(Object.values(cache.membershipLinksByKey)).toHaveLength(2);
    expect(selectCanvasKnowledgeRelationLinks([
      ...Object.values(cache.linksByKey),
      ...Object.values(cache.membershipLinksByKey),
    ])).toHaveLength(1);
  });
});

describe('knowledge graph public DTO boundary', () => {
  it('strips server-only provenance and unknown sensitive fields from graph links', () => {
    const runtime = inspectRuntimeKnowledgeRelationCoverage(`${JSON.stringify({
      id: 'relation-secret-fixture',
      source_id: 'node-a',
      target_id: 'node-b',
      relation_type: 'supports',
      rationale: '可公开摘要',
      sourceDocument: 'document-1',
      sourceMetadata: { title: '评审文档', secret: 'do-not-leak' },
      secret: 'raw-secret',
      accessToken: 'token-secret',
    })}\n`);
    const graph: UnifiedKnowledgeGraphPayload = {
      nodes: [node('node-a'), node('node-b')],
      links: runtime.runtimeLinks,
      inspectionLinks: runtime.inspectionLinks,
      source: 'file',
    };

    const dto = toPublicKnowledgeGraphPayload(graph);
    expect(Object.keys(dto.links[0]).sort()).toEqual([
      'evidenceState',
      'id',
      'motionEligible',
      'relation',
      'sourceId',
      'targetId',
    ]);
    expect(dto.links[0].evidenceState).toBe('available');
    expect(JSON.stringify(dto)).not.toMatch(/raw-secret|token-secret|do-not-leak|rawRelation|provenance/);

    const detail = buildKnowledgeNodeDetailFromGraph(graph, 'node-a');
    expect(detail?.relatedNodes).toHaveLength(1);
    expect(Object.keys(detail!.relatedNodes[0]).sort()).toEqual([
      'canonicalType',
      'category',
      'direction',
      'evidenceState',
      'family',
      'id',
      'inspectionSentence',
      'name',
      'nodeType',
      'rationale',
      'rawType',
      'relationId',
      'sourceDocument',
      'sourceId',
      'sourceMetadata',
      'strength',
      'targetId',
      'visualMergeCount',
      'visualMergeKey',
    ]);
    expect(detail?.relatedNodes[0]).toEqual(expect.objectContaining({
      rawType: 'supports',
      rationale: '可公开摘要',
      sourceDocument: 'document-1',
      sourceMetadata: { title: '评审文档' },
    }));
    expect(JSON.stringify(detail?.relatedNodes)).not.toMatch(/raw-secret|token-secret|do-not-leak/);
  });

  it('keeps the current full public graph payload below four megabytes', async () => {
    const graph = await loadKnowledgeGraphData();
    const bytes = Buffer.byteLength(JSON.stringify(toPublicKnowledgeGraphPayload(graph)), 'utf8');

    expect(graph.inspectionLinks).toHaveLength(16_571);
    expect(graph.versionLinkCount).toBe(16_571);
    expect(graph.links.length).toBeLessThan(graph.inspectionLinks!.length);
    expect(bytes).toBeLessThan(4_000_000);
  });
});

describe('database fallback relation contract and inspection', () => {
  it('retains multiple semantics for one neighbor and exposes cycle-safe directional inspection', () => {
    const graph = databaseGraph([
      { id: 'post-a-b', sourceId: 'node-a', targetId: 'node-b', relation: 'prerequisite' },
      { id: 'post-b-a', sourceId: 'node-b', targetId: 'node-a', relation: 'follows' },
      { id: 'supports-a-b', sourceId: 'node-a', targetId: 'node-b', relation: 'supports' },
    ]);

    expect(graph.links).toHaveLength(3);
    expect(graph.links.filter((link) => link.motionEligible === false)).toHaveLength(3);
    const detail = buildKnowledgeNodeDetailFromGraph(graph, 'node-a');
    expect(detail?.relatedNodes.map((item) => item.relationId).sort()).toEqual([
      'post-a-b',
      'post-b-a',
      'supports-a-b',
    ]);
    expect(detail?.relatedNodes.find((item) => item.relationId === 'supports-a-b'))
      .toEqual(expect.objectContaining({
        direction: 'unordered',
        evidenceState: 'unavailable',
        family: 'association',
        inspectionSentence: '本节点支撑目标结论',
      }));
    expect(detail?.relatedNodes.filter((item) => item.cycleState === 'cyclic')).toHaveLength(2);
  });

  it('merges same-endpoint associations for public/cache/display while inspection keeps every semantic', () => {
    const graph = databaseGraph([
      { id: 'supports-a-b', sourceId: 'node-a', targetId: 'node-b', relation: 'supports' },
      { id: 'applies-a-b', sourceId: 'node-a', targetId: 'node-b', relation: 'applies_to' },
    ]);
    const dto = toPublicKnowledgeGraphPayload(graph);
    const rootPayload = buildKnowledgeGraphRootPayload(graph);
    const payload = buildKnowledgeGraphExpansionPayload(graph, rootPayload.rootSummaries![0].rootId);
    const rootCache = mergeProgressiveGraphPayload(
      buildInitialGraphCache([], []),
      rootPayload
    );
    const cache = mergeProgressiveGraphPayload(rootCache, payload);

    expect(graph.links).toHaveLength(1);
    expect(dto.links).toHaveLength(1);
    expect(payload.links).toHaveLength(1);
    expect(selectCanvasKnowledgeRelationLinks(Object.values(cache.linksByKey))).toHaveLength(1);
    expect(buildKnowledgeNodeDetailFromGraph(graph, 'node-a')?.relatedNodes).toHaveLength(2);
    expect(buildKnowledgeNodeDetailFromGraph(graph, 'node-a')?.relatedNodes).toEqual([
      expect.objectContaining({ visualMergeCount: 2, visualMergeKey: 'association|node-a|node-b' }),
      expect.objectContaining({ visualMergeCount: 2, visualMergeKey: 'association|node-a|node-b' }),
    ]);
  });

  it('round-trips DB relation provenance for same-endpoint semantics through runtime inspection', () => {
    const graph = databaseGraph([
      {
        id: 'supports-db', sourceId: 'node-a', targetId: 'node-b', relation: 'supports', strength: 0.8,
        metadata: { rationale: '数据库支撑依据', source_chapter: 2, target_chapter: 3, secret: 'server-only' },
      },
      {
        id: 'applies-db', sourceId: 'node-a', targetId: 'node-b', relation: 'applies_to', strength: 0.9,
        metadata: { sourceDocument: '数据库来源文档' },
      },
    ]);
    const detail = buildKnowledgeNodeDetailFromGraph(graph, 'node-a')!;

    expect(graph.links).toHaveLength(1);
    expect(graph.inspectionLinks).toHaveLength(2);
    expect(detail.relatedNodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        relationId: 'supports-db', rationale: '数据库支撑依据', evidenceState: 'available',
        sourceChapter: 2, targetChapter: 3,
      }),
      expect.objectContaining({ relationId: 'applies-db', sourceDocument: '数据库来源文档' }),
    ]));
    expect(JSON.stringify(detail)).not.toContain('server-only');
  });

  it('keeps chapter-only runtime detail evidence unavailable', () => {
    const graph = databaseGraph([{
      id: 'chapter-only-db', sourceId: 'node-a', targetId: 'node-b', relation: 'related',
      metadata: { source_chapter: 2, target_chapter: 3 },
    }]);

    const relation = buildKnowledgeNodeDetailFromGraph(graph, 'node-a')?.relatedNodes[0];
    expect(relation).toEqual(expect.objectContaining({
      evidenceState: 'unavailable',
      sourceChapter: 2,
      targetChapter: 3,
    }));
    expect(relation?.sourceMetadata).toBeUndefined();
  });

  it('whitelists and bounds oversized public nodes and detail output', () => {
    const oversized = {
      ...node('node-a'),
      name: 'n'.repeat(2_000),
      description: 'd'.repeat(10_000),
      tags: Array.from({ length: 100 }, (_, index) => `tag-${index}-${'x'.repeat(600)}`),
      metadata: { secret: 'metadata-secret' },
      resources: [{ token: 'resource-token' }],
      content: { private: 'content-private' },
      secret: 'top-secret',
    } as UnifiedKnowledgeNode & { secret: string };
    const graph: UnifiedKnowledgeGraphPayload = { nodes: [oversized, node('node-b')], links: [], source: 'database' };
    const dto = toPublicKnowledgeGraphPayload(graph);
    const detail = buildKnowledgeNodeDetailFromGraph(graph, 'node-a');

    expect(Object.keys(dto.nodes[0]).sort()).toEqual([
      'chapter', 'chapterName', 'description', 'id', 'name', 'nodeType',
      'positionX', 'positionY', 'positionZ', 'tags',
    ]);
    expect(dto.nodes[0].name).toHaveLength(200);
    expect(dto.nodes[0].description).toHaveLength(800);
    expect(dto.nodes[0].tags).toHaveLength(10);
    expect(JSON.stringify({ dto, detail })).not.toMatch(/metadata-secret|resource-token|content-private|top-secret/);
    expect(dto.truncated).toEqual({ nodes: false, links: false });
  });

  it('publishes only bounded canonical numeric importance without exposing metadata', () => {
    const publicNode = toPublicKnowledgeGraphNode({
      ...node('important-node'),
      metadata: { importance: 5, secret: 'server-only' },
    });
    expect(publicNode.importance).toBe(5);
    expect(publicNode).not.toHaveProperty('metadata');
    expect(JSON.stringify(publicNode)).not.toContain('server-only');
    expect(toPublicKnowledgeGraphNode({ ...node('four'), metadata: { importance: 4 } }).importance).toBe(4);
    expect(toPublicKnowledgeGraphNode({ ...node('string'), metadata: { importance: 'core' } })).not.toHaveProperty('importance');
  });

  it('reports deterministic truncation for database growth and diagnostics', () => {
    const nodes = Array.from({ length: 20_001 }, (_, index) => node(`node-${index}`));
    const dto = toPublicKnowledgeGraphPayload({ nodes, links: [], source: 'database' });
    const diagnostic = {
      blocking: true,
      code: 'X'.repeat(200),
      message: 'm'.repeat(2_000),
      relationIds: Array.from({ length: 80 }, (_, index) => `relation-${index}`),
      stage: 'loading' as const,
    };
    const bounded = toPublicRuntimeKnowledgeDiagnostics({
      contractCoverage: RUNTIME_KNOWLEDGE_RELATION_CONTRACT_COVERAGE,
      coverage: [],
      counts: { inputLines: 0, parsedRelations: 0, projectedRelations: 0, visualEdges: 0 },
      diagnostics: Array.from({ length: 101 }, () => diagnostic),
      ok: false,
      stageAgreement: true,
    });

    expect(dto.nodes).toHaveLength(20_000);
    expect(dto.truncated.nodes).toBe(true);
    expect(bounded.diagnostics.length).toBeGreaterThan(0);
    expect(Buffer.byteLength(JSON.stringify(bounded), 'utf8')).toBeLessThanOrEqual(PUBLIC_DIAGNOSTICS_BYTE_BUDGET);
    expect(bounded.truncated).toBe(true);
    expect(bounded.diagnostics[0].code).toHaveLength(100);
    expect(bounded.diagnostics[0].message).toHaveLength(500);
    expect(bounded.diagnostics[0].relationIds).toHaveLength(50);
  });

  it('produces stable endpoint-closed output from shuffled 52MB input', () => {
    const huge = Array.from({ length: 26_000 }, (_, index) => ({
      ...node(`node-${String(index).padStart(5, '0')}`),
      description: `${index}-${'界'.repeat(700)}`,
    }));
    const links = huge.slice(1).map((item, index) => ({
      id: `visual:${index}`,
      sourceId: huge[index].id,
      targetId: item.id,
      relation: 'related',
      relationType: 'related',
      strength: 1,
    }));
    const forward = toPublicKnowledgeGraphPayload({ nodes: huge, links, source: 'database' });
    const reversed = toPublicKnowledgeGraphPayload({ nodes: [...huge].reverse(), links: [...links].reverse(), source: 'database' });
    const ids = new Set(forward.nodes.map((item) => item.id));

    expect(Buffer.byteLength(JSON.stringify(forward), 'utf8')).toBeLessThanOrEqual(PUBLIC_GRAPH_BYTE_BUDGET);
    expect(forward.truncated.nodes).toBe(true);
    expect(forward).toEqual(reversed);
    expect(forward.links.every((link) => ids.has(link.sourceId) && ids.has(link.targetId))).toBe(true);
  });

  it('keeps active-filter, remaining, and ordinary expansion final JSON below four megabytes', () => {
    const nodes = Array.from({ length: 8_000 }, (_, index) => ({
      ...node(index === 0 ? 'requested' : `node-${String(index).padStart(5, '0')}`),
      description: '界'.repeat(700),
    }));
    const links = nodes.slice(1).map((target, index) => ({
      id: `pressure-${String(index).padStart(5, '0')}`,
      sourceId: 'requested',
      targetId: target.id,
      relation: 'prerequisite',
      relationType: 'prerequisite',
      strength: 1,
    }));
    const graph: UnifiedKnowledgeGraphPayload = { nodes, links, source: 'database' };
    const payloads = [
      buildKnowledgeGraphActiveFilterPayload(graph),
      buildKnowledgeGraphRemainingPayload(graph),
      buildKnowledgeGraphExpansionPayload(graph, 'requested'),
    ];

    payloads.forEach((payload) => {
      const nodeIds = new Set(payload.nodes.map((item) => item.id));
      expect(Buffer.byteLength(JSON.stringify(payload), 'utf8')).toBeLessThanOrEqual(PUBLIC_GRAPH_BYTE_BUDGET);
      expect(payload.truncated.nodes || payload.truncated.links).toBe(true);
      expect(payload.links.every((link) => nodeIds.has(link.sourceId) && nodeIds.has(link.targetId))).toBe(true);
    });
    expect(payloads[2].nodes.some((item) => item.id === 'requested')).toBe(true);
  });

  it('rejects an overlong derived chapter root identity', () => {
    const graph: UnifiedKnowledgeGraphPayload = {
      nodes: [node('node-a', '章'.repeat(201))], links: [], source: 'database',
    };
    expect(() => buildKnowledgeGraphExpansionPayload(graph, `chapter-node:${'章'.repeat(201)}`))
      .toThrow(InvalidKnowledgeGraphIdentityError);
  });

  it('preserves safe fields needed by panel, challenge preview, and knowledge cards', () => {
    const rich = {
      ...node('node-a'),
      metadata: {
        difficulty: 4, importance: 5, launchTarget: '/arena/challenges/task-1',
        lessonId: 'lesson-1', content: 'card content', formulas: { continuous: 'G(s)' },
        applications: ['ship'], previewTitle: '挑战预览', taskId: 'task-1', secret: 'no',
      },
      content: { challengePreview: 'preview', summary: 'summary', private: 'no' },
      resources: [{ type: 'infograph', path: '/safe.png', lessonId: 'lesson-1', token: 'no' }],
    };
    const detail = buildKnowledgeNodeDetailFromGraph({ nodes: [rich], links: [], source: 'database' }, 'node-a')!;

    expect(detail.metadata).toEqual(expect.objectContaining({
      difficulty: 4, importance: 5, launchTarget: '/arena/challenges/task-1',
      lessonId: 'lesson-1', previewTitle: '挑战预览', taskId: 'task-1',
    }));
    expect(detail.content).toEqual({ challengePreview: 'preview', summary: 'summary' });
    expect(detail.resources).toEqual([{ lessonId: 'lesson-1', path: '/safe.png', type: 'infograph' }]);
    expect(JSON.stringify(detail)).not.toMatch(/secret|token|private/);
    expect(Buffer.byteLength(JSON.stringify(detail), 'utf8')).toBeLessThanOrEqual(PUBLIC_DETAIL_BYTE_BUDGET);
  });

  it('keeps requested and chapter root nodes while synchronizing truncated membership closure', () => {
    const chapterNodes = Array.from({ length: 20_001 }, (_, index) => node(
      index === 20_000 ? 'requested-z' : `node-${String(index).padStart(5, '0')}`
    ));
    const graph: UnifiedKnowledgeGraphPayload = { nodes: chapterNodes, links: [], source: 'database' };
    const chapter = buildKnowledgeGraphExpansionPayload(graph, 'chapter-node:系统模型');
    const requested = buildKnowledgeGraphExpansionPayload(graph, 'requested-z');
    const chapterNodeIds = new Set(chapter.nodes.map((item) => item.id));

    expect(chapter.nodes[0].id).toBe('chapter-node:系统模型');
    expect(chapter.truncated.nodes).toBe(true);
    expect(chapter.truncated.membershipLinks).toBe(true);
    expect(chapter.membershipLinks?.every((link) => (
      chapterNodeIds.has(link.sourceId) && chapterNodeIds.has(link.targetId)
    ))).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(chapter), 'utf8')).toBeLessThanOrEqual(PUBLIC_GRAPH_BYTE_BUDGET);
    expect(requested.nodes.some((item) => item.id === 'requested-z')).toBe(true);
  });

  it('budgets recursive detail base fields against the final 256KB serialization', () => {
    const nested = Array.from({ length: 10 }, () => Object.fromEntries([
      'applications', 'content', 'description', 'href', 'label', 'previewDescription',
      'previewTitle', 'summary', 'title', 'type',
    ].map((key) => [key, '界'.repeat(500)])));
    const metadata = Object.fromEntries([
      'applications', 'content', 'formulas', 'preview',
    ].map((key) => [key, nested]));
    const content = Object.fromEntries([
      'applications', 'challenge', 'challengePreview', 'examples', 'formulas',
    ].map((key) => [key, nested]));
    const resources = Array.from({ length: 10 }, () => Object.fromEntries([
      'challengeId', 'lessonId', 'nodeId', 'path', 'registryId', 'taskId', 'title', 'type', 'url',
    ].map((key) => [key, '界'.repeat(500)])));
    const detail = buildKnowledgeNodeDetailFromGraph({
      nodes: [{ ...node('node-a'), metadata, content, resources }], links: [], source: 'database',
    }, 'node-a')!;

    expect(Buffer.byteLength(JSON.stringify(detail), 'utf8')).toBeLessThanOrEqual(PUBLIC_DETAIL_BYTE_BUDGET);
    expect(Object.values(detail.truncated).some(Boolean)).toBe(true);
    expect(JSON.stringify(detail)).not.toMatch(/secret|token|private/);
  });

  it('rejects overlong canonical node ids consistently across every graph endpoint builder', () => {
    const overlongId = `node-${'x'.repeat(201)}`;
    const graph: UnifiedKnowledgeGraphPayload = {
      nodes: [node(overlongId)], links: [], source: 'database',
    };
    const builders = [
      () => toPublicKnowledgeGraphPayload(graph),
      () => buildKnowledgeGraphRemainingPayload(graph),
      () => buildKnowledgeGraphActiveFilterPayload(graph),
      () => buildKnowledgeGraphExpansionPayload(graph, overlongId),
      () => buildKnowledgeGraphExpansionPayload(graph, 'chapter-node:系统模型'),
      () => buildKnowledgeNodeDetailFromGraph(graph, overlongId),
    ];

    builders.forEach((build) => expect(build).toThrow(InvalidKnowledgeGraphIdentityError));
    expect(() => databaseGraph([])).toThrow(RuntimeKnowledgeRelationCoverageError);
    expect(() => buildDatabaseKnowledgeGraphPayload([
      {
        ...node(overlongId), bloomLevel: null, knowledgeDim: null,
        metadata: {}, content: {}, resources: [], tags: [],
      },
    ], [], { includeLinks: true, relationVersion: { linkCount: 0, fingerprint: 'overlong' } }))
      .toThrow(InvalidKnowledgeGraphIdentityError);
  });

  it('blocks reverse child relations in the database fallback', () => {
    expect(() => databaseGraph([
      { id: 'child-a-b', sourceId: 'node-a', targetId: 'node-b', relation: 'contains' },
      { id: 'child-b-a', sourceId: 'node-b', targetId: 'node-a', relation: 'contains' },
    ])).toThrow(RuntimeKnowledgeRelationCoverageError);
  });
});
