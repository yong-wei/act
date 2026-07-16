import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/nextjs-dynamic-error', () => ({ rethrowIfNextDynamicError: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    knowledgeLink: { findMany: vi.fn(() => { throw new Error('unexpected DB fallback'); }) },
    knowledgeNode: {
      findMany: vi.fn(() => { throw new Error('unexpected DB fallback'); }),
      update: vi.fn(),
    },
    $queryRaw: vi.fn(() => { throw new Error('unexpected DB fallback'); }),
  },
}));

import { GET as getGraph } from '@/app/api/knowledge/graph/route';
import { GET as getNode } from '@/app/api/knowledge/nodes/[id]/route';
import { resetKnowledgeGraphSourceCacheForTests } from '@/lib/knowledge-graph-source';

const tempRoots: string[] = [];

function installRuntime(relations: string, nodes: unknown = [
  { id: 'node-a', name: 'A', nodeType: 'THEORY', description: 'A' },
  { id: 'node-b', name: 'B', nodeType: 'THEORY', description: 'B' },
]): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-route-contract-'));
  tempRoots.push(root);
  const graphRoot = path.join(root, 'graph');
  fs.mkdirSync(graphRoot);
  fs.writeFileSync(path.join(graphRoot, 'nodes.json'), typeof nodes === 'string' ? nodes : JSON.stringify(nodes));
  fs.writeFileSync(path.join(graphRoot, 'relations.jsonl'), relations);
  process.env.KNOWLEDGE_RUNTIME_ROOT = root;
  resetKnowledgeGraphSourceCacheForTests();
  return graphRoot;
}

describe('knowledge relation coverage route observability', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => {
    delete process.env.KNOWLEDGE_RUNTIME_ROOT;
    resetKnowledgeGraphSourceCacheForTests();
    while (tempRoots.length) fs.rmSync(tempRoots.pop()!, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it.each([
    ['malformed', '{bad-json\n', 'MALFORMED_RELATION_JSONL'],
    ['unknown type', `${JSON.stringify({ id: 'r', source_id: 'node-a', target_id: 'node-b', relation_type: 'unknown' })}\n`, 'UNKNOWN_RELATION_TYPE'],
    ['duplicate id', `${JSON.stringify({ id: 'r', source_id: 'node-a', target_id: 'node-b', relation_type: 'related' })}\n${JSON.stringify({ id: 'r', source_id: 'node-b', target_id: 'node-a', relation_type: 'related' })}\n`, 'DUPLICATE_RELATION_ID'],
    ['reverse child', `${JSON.stringify({ id: 'c1', source_id: 'node-a', target_id: 'node-b', relation_type: 'contains' })}\n${JSON.stringify({ id: 'c2', source_id: 'node-b', target_id: 'node-a', relation_type: 'contains' })}\n`, 'REVERSE_CHILD_RELATION'],
    ['empty source', '\n  \n', 'EMPTY_RUNTIME_RELATIONS'],
  ])('blocks real %s input for root, full, and detail before returning nodes', async (_name, relations, code) => {
    installRuntime(relations);
    const responses = [
      await getGraph(new Request('http://localhost/api/knowledge/graph?mode=root')),
      await getGraph(new Request('http://localhost/api/knowledge/graph')),
      await getNode(new Request('http://localhost/api/knowledge/nodes/node-a'), {
        params: Promise.resolve({ id: 'node-a' }),
      }),
    ];
    for (const response of responses) {
      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body).toEqual(expect.objectContaining({
        code: 'KNOWLEDGE_RELATION_COVERAGE_BLOCKED',
        diagnostics: expect.arrayContaining([expect.objectContaining({ code })]),
      }));
      expect(body).not.toHaveProperty('nodes');
    }
  });

  it.each([
    ['malformed nodes', '{bad-json', 'MALFORMED_RUNTIME_NODES'],
    ['empty nodes', [], 'EMPTY_RUNTIME_NODES'],
    ['duplicate node id', [
      { id: 'node-a', name: 'A' }, { id: 'node-a', name: 'B' },
    ], 'DUPLICATE_RUNTIME_NODE_ID'],
    ['blank node id', [{ id: '  ', name: 'A' }], 'INVALID_RUNTIME_NODE_ID'],
    ['overlong node id', [{ id: `node-${'x'.repeat(201)}`, name: 'A' }], 'INVALID_RUNTIME_NODE_ID'],
  ])('blocks present-but-invalid %s without database fallback', async (_name, nodes, code) => {
    installRuntime(`${JSON.stringify({ id: 'r', source_id: 'node-a', target_id: 'node-b', relation_type: 'related' })}\n`, nodes);
    const responses = [
      await getGraph(new Request('http://localhost/api/knowledge/graph?mode=root')),
      await getGraph(new Request('http://localhost/api/knowledge/graph')),
      await getNode(new Request('http://localhost/api/knowledge/nodes/node-a'), { params: Promise.resolve({ id: 'node-a' }) }),
    ];
    expect(responses.map((response) => response.status)).toEqual([422, 422, 422]);
    for (const response of responses) {
      expect(await response.json()).toEqual(expect.objectContaining({
        diagnostics: expect.arrayContaining([expect.objectContaining({ code })]),
      }));
    }
  });

  it('revalidates empty, malformed, and unknown mutations inside the cache TTL without a cache reset', async () => {
    const valid = `${JSON.stringify({ id: 'r', source_id: 'node-a', target_id: 'node-b', relation_type: 'related' })}\n`;
    const graphRoot = installRuntime(valid);
    for (const [content, code] of [
      ['', 'EMPTY_RUNTIME_RELATIONS'],
      ['{bad-json\n', 'MALFORMED_RELATION_JSONL'],
      [`${JSON.stringify({ id: 'r', source_id: 'node-a', target_id: 'node-b', relation_type: 'now-unknown' })}\n`, 'UNKNOWN_RELATION_TYPE'],
    ] as const) {
      fs.writeFileSync(path.join(graphRoot, 'relations.jsonl'), valid);
      expect((await getGraph(new Request('http://localhost/api/knowledge/graph?mode=root'))).status).toBe(200);
      fs.writeFileSync(path.join(graphRoot, 'relations.jsonl'), content);
      const response = await getGraph(new Request('http://localhost/api/knowledge/graph?mode=root'));
      expect(response.status).toBe(422);
      expect(await response.json()).toEqual(expect.objectContaining({
        diagnostics: expect.arrayContaining([expect.objectContaining({ code })]),
      }));
    }
  });

  it('blocks a partially absent canonical file source instead of falling back to DB', async () => {
    const graphRoot = installRuntime(`${JSON.stringify({
      id: 'r', source_id: 'node-a', target_id: 'node-b', relation_type: 'related',
    })}\n`);
    fs.rmSync(path.join(graphRoot, 'relations.jsonl'));
    const response = await getGraph(new Request('http://localhost/api/knowledge/graph?mode=root'));
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual(expect.objectContaining({
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: 'INCOMPLETE_RUNTIME_GRAPH_SOURCE' })]),
    }));
  });

  it('rejects an unknown graph mode before loading graph data', async () => {
    const response = await getGraph(new Request('http://localhost/api/knowledge/graph?mode=secret'));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Unknown graph mode.' });
  });

  it('requires expansion requests to identify a top-level domain', async () => {
    const missing = await getGraph(new Request('http://localhost/api/knowledge/graph?mode=expansion'));
    const ordinaryNode = await getGraph(new Request(
      'http://localhost/api/knowledge/graph?mode=expansion&domainId=node-a'
    ));

    expect(missing.status).toBe(400);
    expect(await missing.json()).toEqual({ error: 'Missing domainId for domain expansion shard.' });
    expect(ordinaryNode.status).toBe(400);
    expect(await ordinaryNode.json()).toEqual({ error: 'Invalid domainId for domain expansion shard.' });
  });

  it('rejects a syntactically valid domain that is absent from the canonical root catalog', async () => {
    installRuntime(
      `${JSON.stringify({ id: 'r', source_id: 'node-a', target_id: 'node-b', relation_type: 'related' })}\n`,
      [
        { id: 'node-a', name: 'A', nodeType: 'THEORY', description: 'A', chapterName: '系统模型' },
        { id: 'node-b', name: 'B', nodeType: 'THEORY', description: 'B', chapterName: '系统模型' },
      ]
    );

    const response = await getGraph(new Request(
      `http://localhost/api/knowledge/graph?mode=expansion&domainId=${encodeURIComponent('chapter-node:不存在')}`
    ));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Knowledge graph domain not found.' });
  });

  it('returns a domain-scoped expansion shard with explicit domain identity', async () => {
    installRuntime(
      `${JSON.stringify({ id: 'r', source_id: 'node-a', target_id: 'node-b', relation_type: 'related' })}\n`,
      [
        { id: 'node-a', name: 'A', nodeType: 'THEORY', description: 'A', chapterName: '系统模型' },
        { id: 'node-b', name: 'B', nodeType: 'THEORY', description: 'B', chapterName: '系统模型' },
        { id: 'node-c', name: 'C', nodeType: 'THEORY', description: 'C', chapterName: '稳定性' },
      ]
    );

    const domainId = 'chapter-node:系统模型';
    const response = await getGraph(new Request(
      `http://localhost/api/knowledge/graph?mode=expansion&domainId=${encodeURIComponent(domainId)}`
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(expect.objectContaining({
      mode: 'expansion',
      domainId,
      shardKey: expect.stringContaining(`:shard:expansion:${domainId}`),
    }));
    expect(body.nodes.map((node: { id: string }) => node.id)).toEqual([domainId, 'node-a', 'node-b']);
    expect(body.links).toEqual([
      expect.objectContaining({ sourceId: 'node-a', targetId: 'node-b', relation: 'related' }),
    ]);
  });

  it('returns only an exact server-verified runtime lesson identity on the root route', async () => {
    installRuntime(`${JSON.stringify({
      id: 'r', source_id: 'node-a', target_id: 'node-b', relation_type: 'related',
    })}\n`);

    const valid = await getGraph(new Request(
      'http://localhost/api/knowledge/graph?mode=root&lessonId=1-1'
    ));
    const deleted = await getGraph(new Request(
      'http://localhost/api/knowledge/graph?mode=root&lessonId=deleted-lesson'
    ));
    const traversing = await getGraph(new Request(
      'http://localhost/api/knowledge/graph?mode=root&lessonId=..%2F1-1'
    ));
    const duplicated = await getGraph(new Request(
      'http://localhost/api/knowledge/graph?mode=root&lessonId=1-1&lessonId=2-1'
    ));

    expect(await valid.json()).toEqual(expect.objectContaining({
      lessonContext: expect.objectContaining({ lessonId: '1-1' }),
    }));
    expect(await deleted.json()).toEqual(expect.objectContaining({ lessonContext: null }));
    expect(await traversing.json()).toEqual(expect.objectContaining({ lessonContext: null }));
    expect(await duplicated.json()).toEqual(expect.objectContaining({ lessonContext: null }));
  });
});
