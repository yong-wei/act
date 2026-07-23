import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path, { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import {
  buildKnowledgeNodeDetailFromGraph,
  buildKnowledgeGraphExpansionPayload,
  buildKnowledgeGraphManifestPayload,
  buildKnowledgeGraphRootPayload,
  getKnowledgeGraphVersion,
  loadKnowledgeGraphData,
  resetKnowledgeGraphSourceCacheForTests,
  toPublicKnowledgeGraphPayload,
  type UnifiedKnowledgeGraphPayload,
} from '@/lib/knowledge-graph-source';
import {
  buildRuntimeKnowledgeRelationInspectionItems,
  inspectRuntimeKnowledgeRelationCoverage,
  RuntimeKnowledgeRelationCoverageError,
  type RuntimeKnowledgeRelationLink,
} from '@/lib/knowledge-graph-relation-runtime';
import { deriveKnowledgeGraphRelationEvidenceState } from '@/features/knowledge/graph/relation-contract';
import {
  buildInitialGraphCache,
  mergeProgressiveGraphPayload,
} from '@/features/knowledge/progressive-graph-cache';
import {
  ACTKG_FIXTURE_VERSION_DIGEST,
  actkgGraphProjectionFixture,
  buildActkgProjectionDocument,
  type ActkgGraphProjectionDocument,
} from './fixtures/actkg/actkg-projection.fixture';

const ACTKG_GATE_ENV = 'KNOWLEDGE_GRAPH_ACTKG_PROJECTION_PATH';
const originalActkgGate = process.env[ACTKG_GATE_ENV];
const originalRuntimeRoot = process.env.KNOWLEDGE_RUNTIME_ROOT;
const temporaryRoots: string[] = [];

afterEach(async () => {
  resetKnowledgeGraphSourceCacheForTests();
  if (originalActkgGate === undefined) delete process.env[ACTKG_GATE_ENV];
  else process.env[ACTKG_GATE_ENV] = originalActkgGate;
  if (originalRuntimeRoot === undefined) delete process.env.KNOWLEDGE_RUNTIME_ROOT;
  else process.env.KNOWLEDGE_RUNTIME_ROOT = originalRuntimeRoot;
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function installActkgGate(document: ActkgGraphProjectionDocument | string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'actkg-projection-'));
  temporaryRoots.push(root);
  const projectionPath = join(root, 'projection.json');
  await writeFile(projectionPath, typeof document === 'string' ? document : JSON.stringify(document));
  process.env[ACTKG_GATE_ENV] = projectionPath;
  resetKnowledgeGraphSourceCacheForTests();
  return projectionPath;
}

const PRE_EXISTING_PUBLIC_NODE_KEYS = new Set([
  'id', 'name', 'nodeType', 'description', 'positionX', 'positionY', 'positionZ',
  'bloomLevel', 'knowledgeDim', 'tags', 'chapter', 'chapterName', 'expansion', 'importance',
]);
const PUBLIC_NODE_KEYS_WITH_PROJECTION = new Set([
  ...PRE_EXISTING_PUBLIC_NODE_KEYS,
  'semanticName', 'conceptKind', 'candidate', 'sourceCoverageCount',
]);
const PRE_EXISTING_PUBLIC_LINK_KEYS = new Set([
  'id', 'relation', 'relationType', 'sourceId', 'strength', 'targetId', 'motionEligible',
]);

describe('public payload projection contract on current sources', () => {
  it('keeps file-source nodes free of projection attributes and derives link evidenceState', async () => {
    delete process.env[ACTKG_GATE_ENV];
    resetKnowledgeGraphSourceCacheForTests();
    const graph = await loadKnowledgeGraphData();
    expect(graph.source).toBe('file');

    const payload = toPublicKnowledgeGraphPayload(graph);

    expect(payload.nodes.length).toBeGreaterThan(0);
    for (const node of payload.nodes) {
      expect('semanticName' in node).toBe(false);
      expect('conceptKind' in node).toBe(false);
      expect('candidate' in node).toBe(false);
      expect('sourceCoverageCount' in node).toBe(false);
      for (const key of Object.keys(node)) {
        expect(PRE_EXISTING_PUBLIC_NODE_KEYS.has(key)).toBe(true);
      }
    }

    // The runtime relations corpus carries no evidence-bearing fields, so every
    // derived link reports `unavailable` rather than omitting the field.
    expect(payload.links.length).toBeGreaterThan(0);
    for (const link of payload.links) {
      expect(link.evidenceState).toBe('unavailable');
      for (const key of Object.keys(link)) {
        expect(PRE_EXISTING_PUBLIC_LINK_KEYS.has(key) || key === 'evidenceState').toBe(true);
      }
    }
  });

  it('derives link evidenceState through the shared helper across the whole runtime corpus', async () => {
    delete process.env[ACTKG_GATE_ENV];
    resetKnowledgeGraphSourceCacheForTests();
    const graph = await loadKnowledgeGraphData();
    const inspectionLinks = graph.inspectionLinks ?? [];
    expect(inspectionLinks.length).toBeGreaterThan(16_000);

    for (const link of inspectionLinks) {
      expect(link.provenance.evidenceState).toBe(
        deriveKnowledgeGraphRelationEvidenceState(link.provenance.rawRelation)
      );
    }

    const publicPayload = toPublicKnowledgeGraphPayload(graph);
    for (const link of publicPayload.links) {
      expect(link.evidenceState === 'available' || link.evidenceState === 'unavailable').toBe(true);
    }
  });

  it('keeps inspector evidence derivation on the same shared helper', async () => {
    delete process.env[ACTKG_GATE_ENV];
    resetKnowledgeGraphSourceCacheForTests();
    const graph = await loadKnowledgeGraphData();
    const inspectionLinks = graph.inspectionLinks ?? [];
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const sampledNodeIds = [...new Set(inspectionLinks.slice(0, 200).map((link) => link.sourceId))].slice(0, 5);

    expect(sampledNodeIds.length).toBeGreaterThan(0);
    for (const nodeId of sampledNodeIds) {
      const items = buildRuntimeKnowledgeRelationInspectionItems(inspectionLinks, nodeById, nodeId);
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        const sourceLink = inspectionLinks.find((link) => link.id === item.relationId);
        expect(sourceLink).toBeDefined();
        expect(item.evidenceState).toBe(
          deriveKnowledgeGraphRelationEvidenceState(sourceLink!.provenance.rawRelation)
        );
        expect(item.evidenceState).toBe(sourceLink!.provenance.evidenceState);
      }
    }
  });

  it('reports available through the shared helper even when evidence sits outside the display summary', () => {
    const rawRelation = {
      id: 'relation-evidence-only',
      source_id: 'node-a',
      target_id: 'node-b',
      relation_type: 'related',
      evidence: ['推理依据'],
    };
    const link: RuntimeKnowledgeRelationLink = {
      id: 'relation-evidence-only',
      motionEligible: false,
      provenance: {
        canonicalType: 'related',
        detailSentence: { source: '本节点与另一节点相关', target: '本节点与另一节点相关' },
        evidenceState: deriveKnowledgeGraphRelationEvidenceState(rawRelation),
        evidenceText: '关系依据可用',
        rawRelation,
        rawType: 'related',
        relationId: 'relation-evidence-only',
        sourceId: 'node-a',
        targetId: 'node-b',
        visualKey: 'association|node-a|node-b',
      },
      relation: 'related',
      relationType: 'related',
      sourceId: 'node-a',
      strength: 1,
      targetId: 'node-b',
    };
    const nodeById = new Map([
      ['node-b', { id: 'node-b', name: '节点 B', nodeType: 'THEORY' }],
    ]);

    const items = buildRuntimeKnowledgeRelationInspectionItems([link], nodeById, 'node-a');

    // `evidence` carries no inspectable display text, but availability must still
    // agree with the projection rule instead of falling back to the summary shape.
    expect(items[0]?.evidenceState).toBe('available');
  });
});

describe('ActKG projection adapter', () => {
  it('leaves default source selection untouched when the gate is unset', async () => {
    delete process.env[ACTKG_GATE_ENV];
    resetKnowledgeGraphSourceCacheForTests();

    const graph = await loadKnowledgeGraphData();

    expect(graph.source).toBe('file');
  });

  it('maps a valid projection into the unified payload with projection-shaped fields', async () => {
    await installActkgGate(actkgGraphProjectionFixture);

    const graph = await loadKnowledgeGraphData();

    expect(graph.source).toBe('actkg-projection');
    expect(graph.nodes).toHaveLength(3);
    expect(graph.nodes.find((node) => node.id === 'ctc:C100001')).toMatchObject({
      name: '稳定性',
      semanticName: 'stability',
      conceptKind: 'system_property',
      candidate: false,
      sourceCoverageCount: 3,
    });
    expect(graph.nodes.find((node) => node.id === 'ctc:C100003')).toMatchObject({
      name: '阻尼比',
      candidate: true,
      sourceCoverageCount: 1,
    });

    const evidenceStateByRelationId = new Map(
      (graph.inspectionLinks ?? []).map((link) => [link.id, link.provenance.evidenceState])
    );
    expect(evidenceStateByRelationId).toEqual(new Map([
      ['ctl:L000001', 'available'],
      ['ctl:L000002', 'unavailable'],
      ['ctl:L000003', 'available'],
      ['ctl:L000004', 'unavailable'],
    ]));
    expect((graph.inspectionLinks ?? []).map((link) => link.relationType).sort()).toEqual([
      'association', 'contains', 'contains', 'prerequisite',
    ]);

    const payload = toPublicKnowledgeGraphPayload(graph);
    expect(payload.source).toBe('actkg-projection');
    expect(payload.truncated).toEqual({ nodes: false, links: false });
    expect(payload.nodes).toHaveLength(3);
    expect(payload.links).toHaveLength(4);
    for (const node of payload.nodes) {
      for (const key of Object.keys(node)) {
        expect(PUBLIC_NODE_KEYS_WITH_PROJECTION.has(key)).toBe(true);
      }
    }
    expect(payload.nodes.find((node) => node.id === 'ctc:C100001')).toMatchObject({
      semanticName: 'stability',
      conceptKind: 'system_property',
      candidate: false,
      sourceCoverageCount: 3,
    });
    expect(payload.links.map((link) => link.evidenceState).sort()).toEqual([
      'available', 'available', 'unavailable', 'unavailable',
    ]);
  });

  it('passes relation-contract and coverage validation through the existing pipeline', async () => {
    await installActkgGate(actkgGraphProjectionFixture);

    const graph = await loadKnowledgeGraphData();

    // Coverage validation is fail-closed: reaching here already proves the
    // projected relations survived the shared contract assertion. The runtime
    // links expose the canonical vocabulary end to end.
    expect(graph.links).toHaveLength(4);
    expect(new Set(graph.links.map((link) => link.relationType))).toEqual(
      new Set(['contains', 'prerequisite', 'association'])
    );
  });

  it('binds version_digest and release identity to graph version and shard identity', async () => {
    await installActkgGate(actkgGraphProjectionFixture);
    const graph = await loadKnowledgeGraphData();

    expect(graph.versionDigest).toBe(
      'ctkg:release/3f7c58760aa70011990af28977cd03e51ba7c985#sha256:fixture-digest-v1'
    );
    const graphVersion = getKnowledgeGraphVersion(graph);
    expect(graphVersion).toContain('actkg-projection');
    expect(graphVersion).toContain(ACTKG_FIXTURE_VERSION_DIGEST);

    const manifest = buildKnowledgeGraphManifestPayload(graph);
    expect(manifest.graphVersion).toBe(graphVersion);
    expect(manifest.source).toBe('actkg-projection');
    expect(manifest.rootShardKey).toBe(`${graphVersion}:shard:root:chapters`);

    const rootPayload = buildKnowledgeGraphRootPayload(graph);
    expect(rootPayload.graphVersion).toBe(graphVersion);
    expect(rootPayload.shardKey).toBe(`${graphVersion}:shard:root:chapters`);
  });

  it('invalidates stale shards and cached state through the existing version-change path', async () => {
    await installActkgGate(actkgGraphProjectionFixture);
    const graphV1 = await loadKnowledgeGraphData();

    let cache = buildInitialGraphCache([], []);
    cache = mergeProgressiveGraphPayload(cache, buildKnowledgeGraphRootPayload(graphV1));
    expect(cache.graphVersion).toBe(getKnowledgeGraphVersion(graphV1));
    cache = mergeProgressiveGraphPayload(
      cache,
      buildKnowledgeGraphExpansionPayload(graphV1, 'chapter-node:未分章')
    );
    expect(cache.domainNodeIdsByDomainId['chapter-node:未分章']?.length).toBeGreaterThan(0);

    const graphV2Promise = (async () => {
      await installActkgGate(buildActkgProjectionDocument({ version_digest: 'sha256:fixture-digest-v2' }));
      return loadKnowledgeGraphData();
    })();
    const graphV2 = await graphV2Promise;
    expect(getKnowledgeGraphVersion(graphV2)).not.toBe(getKnowledgeGraphVersion(graphV1));

    // A root reload on the new digest resets cached shards and node state.
    const reloaded = mergeProgressiveGraphPayload(cache, buildKnowledgeGraphRootPayload(graphV2));
    expect(reloaded.graphVersion).toBe(getKnowledgeGraphVersion(graphV2));
    expect(reloaded.domainNodeIdsByDomainId).toEqual({});
    expect(reloaded.loadedShardKeys).toEqual([`${getKnowledgeGraphVersion(graphV2)}:shard:root:chapters`]);

    // A stale non-root shard keyed to the previous digest is rejected outright.
    const staleMerge = mergeProgressiveGraphPayload(reloaded, {
      ...buildKnowledgeGraphRootPayload(graphV1),
      mode: 'remaining',
      shardKey: `${getKnowledgeGraphVersion(graphV1)}:shard:remaining:all`,
      filterSignature: 'all',
    });
    expect(staleMerge).toBe(reloaded);
  });

  it('lets the canonical contract win projected direction conflicts and records the override', async () => {
    await installActkgGate(actkgGraphProjectionFixture);
    const graph = await loadKnowledgeGraphData();

    const conflictLink = (graph.inspectionLinks ?? []).find((link) => link.id === 'ctl:L000004');
    expect(conflictLink).toBeDefined();
    expect(conflictLink!.provenance.rawRelation.projectedDirection).toBe('unordered');

    const detail = buildKnowledgeNodeDetailFromGraph(graph, 'ctc:C100001');
    const conflictItem = detail?.relatedNodes.find((item) => item.relationId === 'ctl:L000004');
    expect(conflictItem).toMatchObject({
      canonicalType: 'contains',
      direction: 'parent-to-child',
    });

    const agreementLink = (graph.inspectionLinks ?? []).find((link) => link.id === 'ctl:L000002');
    expect(agreementLink).toBeDefined();
    expect('projectedDirection' in agreementLink!.provenance.rawRelation).toBe(false);
  });

  it('fails closed with a descriptive error when the gated document is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'actkg-projection-missing-'));
    temporaryRoots.push(root);
    process.env[ACTKG_GATE_ENV] = join(root, 'absent.json');
    resetKnowledgeGraphSourceCacheForTests();

    const failure = await loadKnowledgeGraphData().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(RuntimeKnowledgeRelationCoverageError);
    const report = (failure as RuntimeKnowledgeRelationCoverageError).report;
    expect(report.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'ACTKG_PROJECTION_UNAVAILABLE', blocking: true }),
    ]));
    expect(report.diagnostics[0]?.message).toContain('absent.json');
  });

  it('fails closed on malformed JSON instead of falling back to another source', async () => {
    await installActkgGate('{not-json\n');

    const failure = await loadKnowledgeGraphData().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(RuntimeKnowledgeRelationCoverageError);
    expect((failure as RuntimeKnowledgeRelationCoverageError).report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'MALFORMED_ACTKG_PROJECTION', blocking: true }),
      ])
    );
  });

  it('fails closed when the projection declares an unpinned schema_version', async () => {
    await installActkgGate(buildActkgProjectionDocument({ schema_version: '999.0.0' }));

    const failure = await loadKnowledgeGraphData().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(RuntimeKnowledgeRelationCoverageError);
    expect((failure as RuntimeKnowledgeRelationCoverageError).report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'UNSUPPORTED_ACTKG_SCHEMA_VERSION', blocking: true }),
      ])
    );
  });

  it.each([
    ['missing version_digest', { ...actkgGraphProjectionFixture, version_digest: undefined } as unknown as ActkgGraphProjectionDocument],
    ['unknown relation_type', buildActkgProjectionDocument({
      links: [{
        id: 'ctl:L999999',
        relation_id: 'ctr:R999999',
        source_id: 'ctc:C100001',
        target_id: 'ctc:C100002',
        relation_type: 'unsupported' as never,
        relation_family: 'association',
        direction: 'unordered',
        evidence_state: 'available',
      }],
    })],
  ])('fails closed descriptively on schema-invalid projection: %s', async (_name, document) => {
    await installActkgGate(document);

    const failure = await loadKnowledgeGraphData().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(RuntimeKnowledgeRelationCoverageError);
    const diagnostics = (failure as RuntimeKnowledgeRelationCoverageError).report.diagnostics;
    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INVALID_ACTKG_PROJECTION', blocking: true }),
    ]));
    expect(diagnostics[0]?.message.length).toBeGreaterThan(0);
  });

  it('pins the vendored schema snapshot to the published ActKG projection vocabulary', () => {
    const schema = JSON.parse(readFileSync(
      path.join(process.cwd(), 'src/lib/knowledge-graph-actkg/ctkg-projection.schema.json'),
      'utf8'
    )) as {
      $id: string;
      $defs: Record<string, { enum?: string[]; required?: string[] }>;
    };

    expect(schema.$id).toBe('https://yong-wei.github.io/ActKG/ctkg/');
    expect(schema.$defs.ProjectedRelationType?.enum).toEqual(['contains', 'prerequisite', 'association']);
    expect(schema.$defs.EvidenceState?.enum).toEqual(['available', 'unavailable']);
    expect(schema.$defs.ProjectionDirection?.enum).toEqual(['parent_to_child', 'earlier_to_later', 'unordered']);
    expect(schema.$defs.GraphProjection?.required).toEqual(expect.arrayContaining([
      'id', 'projection_profile', 'source_dataset_hash', 'version_digest', 'lifecycle_status', 'schema_version',
    ]));
    expect(actkgGraphProjectionFixture.schema_version).toBe('0.1.0');
  });
});

describe('projection-shaped node attributes on unified payloads', () => {
  it('omits projection attributes entirely for sources that lack them', async () => {
    delete process.env[ACTKG_GATE_ENV];
    resetKnowledgeGraphSourceCacheForTests();
    const graph: UnifiedKnowledgeGraphPayload = await loadKnowledgeGraphData();

    for (const node of graph.nodes) {
      expect('semanticName' in node).toBe(false);
      expect('conceptKind' in node).toBe(false);
      expect('candidate' in node).toBe(false);
      expect('sourceCoverageCount' in node).toBe(false);
    }
  });
});

describe('merged visual edge evidence aggregation', () => {
  function node(id: string) {
    return {
      id,
      name: id,
      nodeType: 'THEORY' as const,
      description: '',
      positionX: 0,
      positionY: 0,
      positionZ: 0,
    };
  }
  function jsonl(...rows: Record<string, unknown>[]) {
    return `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`;
  }

  it('reports available when any contributing relation of a merged edge has evidence', () => {
    const runtime = inspectRuntimeKnowledgeRelationCoverage(jsonl(
      { id: 'aaa-unavailable', source_id: 'node-a', target_id: 'node-b', relation_type: 'supports' },
      { id: 'zzz-available', source_id: 'node-a', target_id: 'node-b', relation_type: 'supports', rationale: '作者依据' },
    ));

    expect(runtime.runtimeLinks).toHaveLength(1);
    // The representative keeps the first relation id, but the edge-level state
    // must aggregate over every contributing relation so the canvas and the
    // inspector never disagree about evidence availability.
    expect(runtime.runtimeLinks[0]?.provenance.relationId).toBe('aaa-unavailable');
    expect(runtime.runtimeLinks[0]?.provenance.evidenceState).toBe('available');

    const payload = toPublicKnowledgeGraphPayload({
      nodes: [node('node-a'), node('node-b')],
      links: runtime.runtimeLinks,
      inspectionLinks: runtime.inspectionLinks,
      source: 'file',
    });
    expect(payload.links[0]?.evidenceState).toBe('available');
  });

  it('stays unavailable when no contributing relation carries evidence', () => {
    const runtime = inspectRuntimeKnowledgeRelationCoverage(jsonl(
      { id: 'aaa-unavailable', source_id: 'node-a', target_id: 'node-b', relation_type: 'supports' },
      { id: 'zzz-unavailable', source_id: 'node-b', target_id: 'node-a', relation_type: 'supports' },
    ));

    expect(runtime.runtimeLinks).toHaveLength(1);
    expect(runtime.runtimeLinks[0]?.provenance.evidenceState).toBe('unavailable');
  });
});
