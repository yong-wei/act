import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { GET as getGraph } from '@/app/api/knowledge/graph/route';
import { GET as getDetail } from '@/app/api/knowledge/nodes/[id]/route';
import { GET as getNodes } from '@/app/api/knowledge/nodes/route';
import {
  buildKnowledgeNodeDetailFromGraph,
  buildKnowledgeGraphRemainingPayload,
  loadKnowledgeGraphData,
  loadKnowledgeGraphFromDatabase,
  loadKnowledgeGraphRootData,
  resetKnowledgeGraphSourceCacheForTests,
} from '@/lib/knowledge-graph-source';
import { assertRuntimeKnowledgeRelationCoverage } from '@/lib/knowledge-graph-relation-runtime';

describe.runIf(process.env.KNOWLEDGE_DB_FALLBACK_PROBE === '1')('production DB fallback ownership boundary', () => {
  it('uses only canonical runtime-owned relations across loader and real routes', async () => {
    resetKnowledgeGraphSourceCacheForTests();
    const expectedBlockingCode = process.env.KNOWLEDGE_DB_FALLBACK_EXPECT_422;
    if (expectedBlockingCode) {
      const responses = [
        await getGraph(new Request('http://localhost/api/knowledge/graph')),
        await getGraph(new Request('http://localhost/api/knowledge/graph?mode=root')),
        await getDetail(new Request('http://localhost/api/knowledge/nodes/node-a'), {
          params: Promise.resolve({ id: 'node-a' }),
        }),
        await getNodes(new Request('http://localhost/api/knowledge/nodes?source=db')),
      ];
      for (const response of responses) {
        expect(response.status).toBe(422);
        expect(await response.json()).toEqual(expect.objectContaining({
          code: 'KNOWLEDGE_RELATION_COVERAGE_BLOCKED',
          diagnostics: expect.arrayContaining([expect.objectContaining({ code: expectedBlockingCode })]),
        }));
      }
      return;
    }
    const graph = await loadKnowledgeGraphData();
    const root = await loadKnowledgeGraphRootData();
    const detail = buildKnowledgeNodeDetailFromGraph(graph, 'node-a');

    expect(graph.source).toBe('database');
    expect(graph.inspectionLinks?.map((link) => link.id).sort()).toEqual([
      'relation-applies', 'relation-supports',
    ]);
    expect(root.inspectionLinks?.map((link) => link.id).sort()).toEqual([
      'relation-applies', 'relation-supports',
    ]);
    expect(detail?.relatedNodes.map((item) => item.relationId).sort()).toEqual([
      'relation-applies', 'relation-supports',
    ]);
    expect(graph.versionLinkCount).toBe(2);

    const expectedRoot = process.env.KNOWLEDGE_EXPECTED_RUNTIME_ROOT!;
    const fileCoverage = assertRuntimeKnowledgeRelationCoverage(
      fs.readFileSync(path.join(expectedRoot, 'graph', 'relations.jsonl'), 'utf8'),
      { nodeIds: new Set(['node-a', 'node-b']) },
    );
    expect(graph.links.map(({ id, relation, sourceId, targetId }) => ({ id, relation, sourceId, targetId })))
      .toEqual(fileCoverage.runtimeLinks.map(({ id, relation, sourceId, targetId }) => ({ id, relation, sourceId, targetId })));
    const fileDetail = buildKnowledgeNodeDetailFromGraph({
      ...graph,
      links: fileCoverage.runtimeLinks,
      inspectionLinks: fileCoverage.inspectionLinks,
      source: 'file',
    }, 'node-a');
    expect(detail?.relatedNodes).toEqual(fileDetail?.relatedNodes);

    for (const requestUrl of [
      'http://localhost/api/knowledge/graph',
      'http://localhost/api/knowledge/graph?mode=root',
      'http://localhost/api/knowledge/graph?mode=remaining',
    ]) {
      const response = await getGraph(new Request(requestUrl));
      expect(response.status).toBe(200);
      expect(JSON.stringify(await response.json())).not.toMatch(/external-owned|mixed-owned/);
    }
    const detailResponse = await getDetail(new Request('http://localhost/api/knowledge/nodes/node-a'), {
      params: Promise.resolve({ id: 'node-a' }),
    });
    expect(detailResponse.status).toBe(200);
    const detailBody = await detailResponse.json();
    expect(detailBody.relatedNodes.map((item: { relationId: string }) => item.relationId).sort()).toEqual([
      'relation-applies', 'relation-supports',
    ]);
    const nodesResponse = await getNodes(new Request('http://localhost/api/knowledge/nodes?source=db'));
    expect(nodesResponse.status).toBe(200);
    const nodesBody = await nodesResponse.json();
    expect(nodesBody.map((item: { id: string }) => item.id).sort()).toEqual(['node-a', 'node-b']);
    expect(JSON.stringify(nodesBody)).not.toMatch(/external-a|external-b|metadata|content|resources/);
  });

  it.runIf(process.env.KNOWLEDGE_DB_CONCURRENCY_PROBE === '1')(
    'keeps payload and digest on one repeatable-read snapshot during a concurrent same-count update',
    async () => {
      const before = await loadKnowledgeGraphFromDatabase();
      const during = await loadKnowledgeGraphFromDatabase({
        afterNodesRead: async () => {
          const writer = new Client({ connectionString: process.env.DATABASE_URL });
          await writer.connect();
          try {
            await writer.query('BEGIN');
            await writer.query(`UPDATE "KnowledgeNode" SET "name" = 'Node A concurrent' WHERE "id" = 'node-a'`);
            await writer.query(`UPDATE "KnowledgeLink" SET "relation" = 'enables' WHERE "id" = 'relation-supports'`);
            await writer.query('COMMIT');
          } catch (error) {
            await writer.query('ROLLBACK').catch(() => {});
            throw error;
          } finally {
            await writer.end();
          }
        },
      });
      const after = await loadKnowledgeGraphFromDatabase();

      expect(during).toEqual(before);
      expect(after.versionLinkCount).toBe(before.versionLinkCount);
      expect(after.versionDigest).not.toBe(before.versionDigest);
      expect(after.nodes.find((node) => node.id === 'node-a')?.name).toBe('Node A concurrent');
      expect(after.inspectionLinks?.find((link) => link.id === 'relation-supports')?.relation).toBe('enables');
      expect(buildKnowledgeGraphRemainingPayload(after).graphVersion)
        .not.toBe(buildKnowledgeGraphRemainingPayload(before).graphVersion);
    },
  );
});
