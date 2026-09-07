import { describe, expect, it } from 'vitest';

import type { LayeredGraphPayload } from '@/lib/layered-graph/contracts';
import {
  KONLING_ENGINEERING_NEIGHBORHOOD_MAX_ENTRIES,
  KONLING_ENGINEERING_RAG_PREDICATE_ALLOWLIST,
  buildKonlingEngineeringNeighborhood,
  buildKonlingEngineeringNeighborhoodGroundingLines,
} from '@/lib/konling-engineering-graph';

function makePayload(overrides: {
  nodes?: Array<{ canonicalId: string; semanticName: string | null }>;
  relations?: Array<{ relationId: string; sourceId: string; targetId: string; relationType: string }>;
  status?: string;
}): LayeredGraphPayload {
  const status = overrides.status ?? 'ready';
  return {
    contract: 'act-layered-graph-payload/v1',
    engineering: {
      identity: {
        layer: 'engineering',
        status,
        authorityReleaseId: 'ctr:release:test-1',
        authoritySnapshotId: 'snap-1',
        authoritySnapshotHash: 'hash-1',
        projectionId: null,
        projectionHash: null,
        scopeId: null,
        reasons: [],
      },
      nodes: (overrides.nodes ?? [
        { canonicalId: 'ctc:focus-1', semanticName: '根轨迹' },
        { canonicalId: 'ctc:neighbor-1', semanticName: '开环增益' },
        { canonicalId: 'ctc:far-away', semanticName: '无关节点' },
      ]).map((node, index) => ({
        canonicalId: node.canonicalId,
        ordinal: index,
        canonicalType: 'DomainConcept',
        semanticName: node.semanticName,
        reviewStatus: null,
        publicationStatus: null,
        lifecycleStatus: null,
        payload: {},
      })),
      relations: (overrides.relations ?? [
        { relationId: 'rel-1', sourceId: 'ctc:focus-1', targetId: 'ctc:neighbor-1', relationType: 'is_a' },
        { relationId: 'rel-2', sourceId: 'ctc:neighbor-1', targetId: 'ctc:focus-1', relationType: 'used_to_analyze' },
        { relationId: 'rel-3', sourceId: 'ctc:focus-1', targetId: 'ctc:far-away', relationType: 'prerequisite' },
        { relationId: 'rel-4', sourceId: 'ctc:far-away', targetId: 'ctc:neighbor-2', relationType: 'is_a' },
      ]).map((relation, index) => ({
        relationId: relation.relationId,
        ordinal: index,
        qualityTier: 'GOLD',
        sourceId: relation.sourceId,
        targetId: relation.targetId,
        relationType: relation.relationType,
        reviewStatus: null,
        publicationStatus: null,
        direct: true,
        payload: {},
      })),
      predicates: [...new Set((overrides.relations ?? [
        { relationType: 'is_a' },
      ]).map((relation) => relation.relationType))],
    },
    teachingPrerequisites: {
      identity: {
        layer: 'teachingPrerequisites',
        status: 'absent',
        authorityReleaseId: null,
        authoritySnapshotId: null,
        authoritySnapshotHash: null,
        projectionId: null,
        projectionHash: null,
        scopeId: null,
        reasons: ['absent'],
      },
      edges: [],
    },
    teachingResources: {
      identity: {
        layer: 'teachingResources',
        status: 'absent',
        authorityReleaseId: null,
        authoritySnapshotId: null,
        authoritySnapshotHash: null,
        projectionId: null,
        projectionHash: null,
        scopeId: null,
        reasons: ['absent'],
      },
      resources: [],
      bindings: [],
      coreNodes: [],
      cards: [],
      notProjectedCanonicalIds: [],
    },
    fallback: null,
    requestedScope: null,
  };
}

describe('konling-engineering-graph 邻域', () => {
  it('谓词白名单为 canonical RAG 治理谓词集，且不含先后修 prerequisite', () => {
    expect(KONLING_ENGINEERING_RAG_PREDICATE_ALLOWLIST).toContain('is_a');
    expect(KONLING_ENGINEERING_RAG_PREDICATE_ALLOWLIST).toContain('association');
    expect(KONLING_ENGINEERING_RAG_PREDICATE_ALLOWLIST).not.toContain('prerequisite');
  });

  it('以焦点为白名单提取有界邻域：方向、谓词白名单与焦外关系排除', () => {
    const neighborhood = buildKonlingEngineeringNeighborhood({
      payload: makePayload({}),
      focusCanonicalIds: ['ctc:focus-1'],
    });
    expect(neighborhood.status).toBe('ready');
    expect(neighborhood.authorityReleaseId).toBe('ctr:release:test-1');
    // rel-3 的 prerequisite 谓词不在白名单；rel-4 两端都不在焦点内。
    expect(neighborhood.entries.map((entry) => entry.relationId)).toEqual(['rel-1', 'rel-2']);
    expect(neighborhood.entries[0]).toMatchObject({
      predicate: 'is_a',
      direction: 'outgoing',
      focusCanonicalId: 'ctc:focus-1',
      neighborCanonicalId: 'ctc:neighbor-1',
      neighborLabel: '开环增益',
    });
    expect(neighborhood.entries[1]).toMatchObject({
      predicate: 'used_to_analyze',
      direction: 'incoming',
      neighborCanonicalId: 'ctc:neighbor-1',
    });
    expect(neighborhood.truncatedCount).toBe(0);
  });

  it('超限确定性截断并记录 truncatedCount', () => {
    const relations = Array.from({ length: KONLING_ENGINEERING_NEIGHBORHOOD_MAX_ENTRIES + 5 }, (_, index) => ({
      relationId: `rel-bulk-${String(index).padStart(3, '0')}`,
      sourceId: 'ctc:focus-1',
      targetId: `ctc:neighbor-${index}`,
      relationType: 'is_a',
    }));
    const neighborhood = buildKonlingEngineeringNeighborhood({
      payload: makePayload({
        relations,
        nodes: [
          { canonicalId: 'ctc:focus-1', semanticName: '焦点' },
          ...relations.map((relation) => ({ canonicalId: relation.targetId, semanticName: null })),
        ],
      }),
      focusCanonicalIds: ['ctc:focus-1'],
    });
    expect(neighborhood.entries).toHaveLength(KONLING_ENGINEERING_NEIGHBORHOOD_MAX_ENTRIES);
    expect(neighborhood.truncatedCount).toBe(5);
    // 确定性排序：relationId 升序。
    expect(neighborhood.entries[0]!.relationId).toBe('rel-bulk-000');
  });

  it('工程层缺失/非 ready/焦点为空时显式不可用', () => {
    expect(buildKonlingEngineeringNeighborhood({ payload: null, focusCanonicalIds: ['x'] }))
      .toMatchObject({ status: 'unavailable', reasons: ['engineering-layer-payload-missing'] });
    expect(buildKonlingEngineeringNeighborhood({ payload: makePayload({ status: 'unavailable' }), focusCanonicalIds: ['x'] }))
      .toMatchObject({ status: 'unavailable', reasons: ['engineering-layer-unavailable'] });
    expect(buildKonlingEngineeringNeighborhood({ payload: makePayload({}), focusCanonicalIds: [] }))
      .toMatchObject({ status: 'unavailable', reasons: ['engineering-focus-canonical-ids-empty'] });
  });

  it('grounding 行自证工程域并携带出处与截断计数', () => {
    const ready = buildKonlingEngineeringNeighborhood({
      payload: makePayload({}),
      focusCanonicalIds: ['ctc:focus-1'],
    });
    const lines = buildKonlingEngineeringNeighborhoodGroundingLines(ready);
    expect(lines[0]).toBe('engineering-graph:status=ready authorityReleaseId=ctr:release:test-1 entries=2 truncated=0');
    expect(lines[1]).toBe('ctc:focus-1 -->[is_a] ctc:neighbor-1 (开环增益) rel=rel-1');

    const unavailableLines = buildKonlingEngineeringNeighborhoodGroundingLines({
      status: 'unavailable',
      authorityReleaseId: null,
      entries: [],
      truncatedCount: 0,
      predicateAllowlist: KONLING_ENGINEERING_RAG_PREDICATE_ALLOWLIST,
      reasons: ['engineering-layer-payload-missing'],
    });
    expect(unavailableLines).toEqual([
      'engineering-graph:status=unavailable reason=engineering-layer-payload-missing',
    ]);
  });
});
