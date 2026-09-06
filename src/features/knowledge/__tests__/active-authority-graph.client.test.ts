// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { KnowledgeGraphWorkspace } from '../knowledge-graph-workspace';
import {
  selectActiveAuthorityMembership,
} from '../active-authority-graph';
import {
  createEmptyAuthorityShardWorkspace,
  enableAuthorityShardFamily,
  invalidateTeachingBearingShards,
  mergeAuthorityShard,
  rememberAuthorityShardPositions,
  resetAuthorityShardDomain,
  shardIdentityDrift,
  selectAuthorityShardObject,
  visibleAuthorityShardRelations,
} from '../active-authority-shard-store';
import {
  parseSafeApiEvidenceV1,
  safeApiHasResponsiveNoActiveNode,
} from '../../../../scripts/tests/test-commercial-ui-governance';
import type {
  AuthorityShardPublicEnvelope,
  EngineeringRelationFamily,
  PublicAuthorityDomainDefaultShard,
  PublicAuthorityNodeNeighborhoodShard,
  PublicAuthorityRelationFamilyShard,
  PublicAuthorityRootShard,
} from '@/lib/authority-domain-shards/contracts';
import type { RegisteredPeerDomainId } from '@/lib/authority-domain-catalog/contracts';

const canvas = {
  projectionVersion: 'act.canvas.v2' as const,
  source: {
    authorityState: 'active' as const,
    releaseSetId: 'internal-release-set',
    releaseId: 'internal-release',
    productionAuthoritative: false as const,
    historical: false as const,
    releaseHash: 'a'.repeat(64),
    schemaVersion: '0.2.0',
    projectionDigest: null,
    sourceDatasetHash: 'b'.repeat(64),
  },
  release: { label: 'Engineering Authority', version: 'v0.12', scope: 'engineering' },
  fields: { included: ['node.id'], hidden: ['node.payload'] },
  coverage: {
    status: 'partial' as const,
    objectCount: 4,
    relationCount: 2,
    goldRelationCount: 1,
    silverRelationCount: 1,
    sourceObjectCount: 0,
    evidenceSegmentCount: 0,
  },
  teachingSemantics: { status: 'unavailable' as const, message: '教学关系尚未发布' as const },
  nodes: [
    {
      id: 'node-concept', canonicalType: 'DomainConcept', label: '稳定性', aliases: [], description: '稳定性描述',
      governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: 'active' },
      semanticSupport: { supported: true, readOnly: true as const },
    },
    {
      id: 'node-formula', canonicalType: 'Formula', label: '特征方程', aliases: [], description: null,
      governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: 'active' },
      semanticSupport: { supported: true, readOnly: true as const },
    },
    {
      id: 'node-model', canonicalType: 'SystemModel', label: '闭环模型', aliases: [], description: null,
      governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: 'active' },
      semanticSupport: { supported: true, readOnly: true as const },
    },
    {
      id: 'node-isolated', canonicalType: 'KnowledgeStatement', label: '孤立陈述', aliases: [], description: null,
      governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: 'active' },
      semanticSupport: { supported: true, readOnly: true as const },
    },
    // Unsupported data is not displayed and must not leak its raw values.
    {
      id: 'node-unknown', canonicalType: 'future_internal_type', label: 'future_internal_type', aliases: [], description: null,
      governance: { reviewStatus: 'future_internal_status', publicationStatus: null, lifecycleStatus: null },
      semanticSupport: { supported: true, readOnly: true as const },
    },
  ],
  relations: [
    {
      id: 'relation-association', predicate: 'association', sourceId: 'node-concept', targetId: 'node-formula', direction: 'unordered', direct: null,
      qualityTier: 'GOLD', governance: { reviewStatus: null, publicationStatus: null }, semanticSupport: { supported: true, readOnly: true as const },
    },
    {
      id: 'relation-applies', predicate: 'applies_to', sourceId: 'node-concept', targetId: 'node-model', direction: 'source_to_target', direct: null,
      qualityTier: 'SILVER', governance: { reviewStatus: null, publicationStatus: null }, semanticSupport: { supported: true, readOnly: true as const },
    },
    {
      id: 'relation-unknown', predicate: 'future_internal_predicate', sourceId: 'node-concept', targetId: 'node-formula', direction: 'future_internal_direction', direct: null,
      qualityTier: 'FUTURE_INTERNAL_TIER', governance: { reviewStatus: null, publicationStatus: null }, semanticSupport: { supported: true, readOnly: true as const },
    },
  ],
  provenance: {
    authority: {
      consumerId: 'engineering-graph' as const,
      snapshotId: 'internal-snapshot', snapshotHash: 'c'.repeat(64),
      releaseId: 'internal-release', releaseSetId: 'internal-release-set',
    },
    activation: { mode: 'use-combination' as const, status: 'READY' as const, activationId: 'internal-activation', activationHash: 'd'.repeat(64) },
    projection: { status: 'not-applicable' as const, projectionId: null, projectionHash: null },
  },
};

const shardEnvelope: AuthorityShardPublicEnvelope = {
  contract: 'act-authority-shard-envelope/v1' as const,
  authorityCatalogVersion: 'acv-test-shards',
  teachingVersion: null,
  localeProfileVersion: 'alp-test-historical-zh-CN',
  match: { authority: true as const, catalog: true as const, teaching: null },
};

function teachingEnvelope(
  teachingVersion: string,
  teachingMatch = true,
): AuthorityShardPublicEnvelope {
  return {
    ...shardEnvelope,
    teachingVersion,
    match: { ...shardEnvelope.match, teaching: teachingMatch },
  };
}

const rootShard = {
  shardClass: 'root' as const,
  envelope: shardEnvelope,
  root: {
    kind: 'presentation-root-catalog' as const,
    domains: [
      {
        kind: 'presentation-domain' as const,
        order: 1,
        displayName: '系统建模',
        summary: '从对象到系统模型',
        presentationRole: 'domain' as const,
        visualRole: 'modeling' as const,
        memberCount: 4,
      },
    ],
    aggregate: {
      kind: 'presentation-aggregate' as const,
      order: 0,
      displayName: '控制理论综合',
      summary: '汇总入口',
      presentationRole: 'aggregate' as const,
      visualRole: 'aggregate' as const,
      domainCount: 8,
    },
  },
} satisfies PublicAuthorityRootShard;

const frequencyRootDomain = {
  kind: 'presentation-domain' as const,
  order: 2,
  displayName: '频域分析',
  summary: '从频率响应观察系统性质',
  presentationRole: 'domain' as const,
  visualRole: 'frequency' as const,
  memberCount: 1,
};

const crossDomainRootShard = {
  ...rootShard,
  root: {
    ...rootShard.root,
    domains: [...rootShard.root.domains, frequencyRootDomain],
  },
} satisfies PublicAuthorityRootShard;

function shardObject(
  node: (typeof canvas.nodes)[number],
  domainId: RegisteredPeerDomainId = 'system-modeling',
  visualRole: 'modeling' | 'frequency' = 'modeling',
) {
  return {
    ...node,
    memberships: [{
      domainId,
      visualRole,
      preferred: true,
    }],
  };
}

function shardObjectWithMemberships(
  node: (typeof canvas.nodes)[number],
  memberships: readonly { domainId: RegisteredPeerDomainId; visualRole: 'modeling' | 'frequency'; preferred: boolean }[],
) {
  return { ...node, memberships };
}

type TestTeachingCoverageState = 'available' | 'partial' | 'empty' | 'unavailable';

const defaultTeachingCoverage = {
  status: 'unavailable' as TestTeachingCoverageState,
  domainId: 'system-modeling' as const,
  relationCount: 0,
  coreNodeCount: 0,
  uncoveredCoreNodeCount: 0,
  note: '教学关系暂不可用',
};

function teachingRelation(id: string, sourceId = 'node-concept', targetId = 'node-formula') {
  return {
    ...canvas.relations[0],
    id,
    predicate: 'PREREQUISITE' as const,
    sourceId,
    targetId,
    direction: 'source_to_target' as const,
    layer: 'ACT_TEACHING' as const,
    relationFamily: 'teaching-prerequisite' as const,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function mockResponse<T>(payload: T) {
  return { ok: true, status: 200, json: async () => payload };
}

/** Server-shaped bounded domain search over label + optional type (#1738). */
function domainSearchPayload(
  entries: Array<{ id: string; canonicalType: string; label: string }>,
  url: string,
) {
  const params = new URL(url, 'https://act.local').searchParams;
  const query = params.get('q') ?? '';
  const canonicalType = params.get('type');
  const pageSize = Math.max(1, Number.parseInt(params.get('limit') ?? '12', 10) || 12);
  const page = Math.max(0, Number.parseInt(params.get('page') ?? '0', 10) || 0);
  const needle = query.trim().toLocaleLowerCase('zh-CN');
  const matched = entries
    .filter((entry) => !canonicalType || entry.canonicalType === canonicalType)
    .filter((entry) => !needle || entry.label.toLocaleLowerCase('zh-CN').includes(needle))
    .sort((left, right) => left.label.localeCompare(right.label, 'zh-CN') || left.id.localeCompare(right.id));
  const start = page * pageSize;
  return {
    contract: 'act-authority-domain-search/v1' as const,
    envelope: shardEnvelope,
    domainId: 'system-modeling',
    query,
    canonicalType,
    page,
    pageSize,
    total: matched.length,
    hits: matched.slice(start, start + pageSize).map((entry) => ({
      id: entry.id,
      canonicalType: entry.canonicalType,
      label: entry.label,
      aliases: [] as string[],
      memberships: [{ domainId: 'system-modeling' as const, visualRole: 'modeling' as const, preferred: true }],
    })),
  };
}

async function settleDomainSearch() {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 300));
  });
}

function domainDefaultShard(
  nodes = canvas.nodes,
  _relations: typeof canvas.relations = [],
  options: {
    envelope?: AuthorityShardPublicEnvelope;
    teachingRelations?: readonly ReturnType<typeof teachingRelation>[];
    teachingCoverage?: Partial<Omit<typeof defaultTeachingCoverage, 'domainId'>> & { domainId?: RegisteredPeerDomainId };
    domainId?: RegisteredPeerDomainId;
    visualRole?: 'modeling' | 'frequency';
  } = {},
): PublicAuthorityDomainDefaultShard {
  const domainId = options.domainId ?? 'system-modeling';
  const visualRole = options.visualRole ?? 'modeling';
  return {
    shardClass: 'domain-default' as const,
    envelope: options.envelope ?? shardEnvelope,
    domainId,
    visualRole,
    objects: nodes.map((node) => shardObject(node, domainId, visualRole)),
    teachingRelations: options.teachingRelations ?? [],
    teachingCoverage: { ...defaultTeachingCoverage, domainId, ...options.teachingCoverage },
  };
}

function familyShard(
  family: EngineeringRelationFamily,
  relations: typeof canvas.relations,
  envelope: AuthorityShardPublicEnvelope = shardEnvelope,
  domainId: RegisteredPeerDomainId = 'system-modeling',
): PublicAuthorityRelationFamilyShard {
  const visualRole = domainId === 'frequency-domain-analysis' ? 'frequency' : 'modeling';
  return {
    shardClass: 'relation-family' as const,
    envelope,
    domainId,
    family,
    objects: canvas.nodes.map((node) => shardObject(node, domainId, visualRole)),
    relations: relations.map((relation) => ({ ...relation, layer: 'ENGINEERING' as const, relationFamily: family })),
    boundaries: [],
  };
}

function neighborhoodShard(
  nodeId: string,
  envelope: AuthorityShardPublicEnvelope = shardEnvelope,
): PublicAuthorityNodeNeighborhoodShard {
  return {
    shardClass: 'node-neighborhood' as const,
    envelope,
    nodeId,
    limit: 32,
    truncated: false,
    objects: canvas.nodes.map((node) => shardObject(node)),
    relations: canvas.relations.map((relation) => ({
      ...relation,
      layer: 'ENGINEERING' as const,
      relationFamily: relation.predicate === 'association'
        ? 'association' as const
        : 'application-and-analysis' as const,
    })),
    boundaries: [],
  };
}

function nodeDetail(nodeId: string) {
  const names: Record<string, { type: string; label: string; description: string | null }> = {
    'node-concept': { type: 'DomainConcept', label: '稳定性', description: '稳定性描述' },
    'node-formula': { type: 'Formula', label: '特征方程', description: null },
    'node-model': { type: 'SystemModel', label: '闭环模型', description: null },
    'node-isolated': { type: 'KnowledgeStatement', label: '孤立陈述', description: null },
  };
  const current = names[nodeId] ?? names['node-concept'];
  return {
    projectionVersion: 'act.node-detail.v2' as const,
    source: canvas.source,
    role: 'STUDENT' as const,
    fields: { included: ['node.id'], hidden: ['node.payload'] },
    node: {
      id: nodeId,
      canonicalType: current.type,
      label: current.label,
      description: current.description,
      governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: 'active' },
      adjacency: nodeId === 'node-isolated' ? [] : [{
        relationId: 'relation-association', predicate: 'association', direction: 'unordered', qualityTier: 'GOLD', neighborId: 'node-formula', traversal: 'outgoing' as const, readOnly: true as const,
      }],
      sources: [{ sourceEditionId: 'internal-edition', sectionId: 'internal-section' }],
      semanticSupport: { supported: true, readOnly: true as const },
    },
    provenance: canvas.provenance,
  };
}

describe('active Authority knowledge workspace client boundary', () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;
  let detailLearningContentMode: 'available' | 'unavailable';

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    detailLearningContentMode = 'available';
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const nodeId = decodeURIComponent(url.split('/').pop() ?? 'node-concept');
      if (url.endsWith('/api/knowledge/shards/active')) {
        return { ok: true, status: 200, json: async () => rootShard };
      }
      if (url.includes('/domains/') && url.includes('/search')) {
        return {
          ok: true,
          status: 200,
          json: async () => domainSearchPayload(
            canvas.nodes.map((node) => ({ id: node.id, canonicalType: node.canonicalType, label: node.label })),
            url,
          ),
        };
      }
      if (url.includes('/domains/') && url.includes('/families/association')) {
        return { ok: true, status: 200, json: async () => familyShard('association', [canvas.relations[0]]) };
      }
      if (url.includes('/domains/') && url.includes('/families/application-and-analysis')) {
        return { ok: true, status: 200, json: async () => familyShard('application-and-analysis', [canvas.relations[1]]) };
      }
      if (url.includes('/domains/')) {
        return { ok: true, status: 200, json: async () => domainDefaultShard() };
      }
      if (url.includes('/neighborhoods/')) {
        return { ok: true, status: 200, json: async () => neighborhoodShard(nodeId) };
      }
      if (url.includes('/shards/active/nodes/')) {
        return { ok: true, status: 200, json: async () => ({
          shardClass: 'node-detail',
          envelope: shardEnvelope,
          node: {
            ...nodeDetail(nodeId).node,
            teachingFields: {},
            media: { cardAvailable: false, infographAvailable: false },
            learningContent: detailLearningContentMode === 'unavailable'
              ? {
                card: { state: 'missing', message: '当前节点暂无已发布学习卡片。' },
                infograph: { state: 'missing', message: '当前节点暂无可用信息图。' },
              }
              : nodeId === 'node-formula'
              ? {
                card: { state: 'blocked', message: '该学习卡片仍在完善中。' },
                infograph: { state: 'missing', message: '当前节点暂无可用信息图。' },
              }
              : {
                card: {
                  state: 'available',
                  summary: '稳定性描述用于判断系统响应是否收敛。',
                  insight: '先观察响应，再判断稳定性。',
                  explanation: '稳定性反映系统在扰动后的响应趋势。',
                },
                infograph: { state: 'available', alternativeText: '稳定性 信息图' },
              },
          },
        }) };
      }
      throw new Error(`unexpected product request ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  async function enterModelingDomain(options: { families?: boolean } = {}) {
    const button = container.querySelector<HTMLButtonElement>('[data-authority-domain-entry="modeling"]');
    expect(button).not.toBeNull();
    await act(async () => button!.click());
    await act(async () => Promise.resolve());
    if (options.families === false) return;
    const mobileToolsToggle = container.querySelector<HTMLButtonElement>('[data-active-authority-mobile-tools-toggle="true"]');
    const restoreMobileTools = mobileToolsToggle?.getAttribute('aria-expanded') === 'false';
    if (restoreMobileTools) {
      await act(async () => mobileToolsToggle!.click());
    }
    for (const family of ['association', 'application-and-analysis'] as const) {
      const familyButton = container.querySelector<HTMLButtonElement>(`[data-authority-relation-family="${family}"]`);
      expect(familyButton).not.toBeNull();
      await act(async () => familyButton!.click());
    }
    if (restoreMobileTools) {
      await act(async () => mobileToolsToggle!.click());
    }
    await act(async () => Promise.resolve());
  }

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('prefers an explicit owning membership and falls back deterministically', () => {
    const memberships = [
      { domainId: 'system-modeling', visualRole: 'modeling', preferred: false },
      { domainId: 'frequency-domain-analysis', visualRole: 'frequency', preferred: false },
    ] as const;
    expect(selectActiveAuthorityMembership(memberships)?.visualRole).toBe('modeling');
    expect(selectActiveAuthorityMembership([
      ...memberships,
      { domainId: 'system-modeling', visualRole: 'modeling', preferred: true },
    ])?.visualRole).toBe('modeling');
    expect(selectActiveAuthorityMembership([
      { domainId: 'classical-control-design', visualRole: 'design', preferred: false },
      { domainId: 'root-locus', visualRole: 'root-locus', preferred: true },
    ], 'classical-control-design')?.visualRole).toBe('design');
  });

  it('invalidates changed Teaching identity without resetting engineering workspace state', () => {
    const oldEnvelope = teachingEnvelope('teaching-v1');
    const nextEnvelope = teachingEnvelope('teaching-v2');
    let workspace = createEmptyAuthorityShardWorkspace();
    workspace = mergeAuthorityShard(workspace, { ...rootShard, envelope: oldEnvelope });
    workspace = mergeAuthorityShard(workspace, domainDefaultShard(canvas.nodes, [], {
      envelope: oldEnvelope,
      teachingRelations: [teachingRelation('teaching-old')],
      teachingCoverage: {
        status: 'available',
        relationCount: 1,
        coreNodeCount: 2,
        uncoveredCoreNodeCount: 0,
        note: '旧教学覆盖',
      },
    }));
    workspace = mergeAuthorityShard(workspace, familyShard('association', [canvas.relations[0]], oldEnvelope));
    workspace = enableAuthorityShardFamily(workspace, 'association');
    workspace = rememberAuthorityShardPositions(workspace, { 'node-concept': { x: 144, y: 288 } });
    workspace = selectAuthorityShardObject(workspace, 'node-concept');

    const invalidated = invalidateTeachingBearingShards(workspace, nextEnvelope);
    expect(invalidated.envelope).toEqual(nextEnvelope);
    expect(invalidated.objectsByCanonicalId['node-concept']).toBeDefined();
    expect(invalidated.relationsByLayerKey['ENGINEERING:relation-association']).toBeDefined();
    expect(invalidated.relationsByLayerKey['ACT_TEACHING:teaching-old']).toBeUndefined();
    expect(invalidated.teachingCoverageByDomain).toEqual({});
    expect(invalidated.loadedShardKeys).toContain('root');
    expect(invalidated.loadedShardKeys).toContain('relation-family:system-modeling:association');
    expect(invalidated.loadedShardKeys).not.toContain('domain-default:system-modeling');
    expect(invalidated.positionsByCanonicalId['node-concept']).toEqual({ x: 144, y: 288 });
    expect(invalidated.selectedCanonicalId).toBe('node-concept');
    expect(invalidated.inspectorOpen).toBe(true);
    expect(invalidated.enabledFamilies).toEqual(['association']);

    const refreshed = mergeAuthorityShard(invalidated, domainDefaultShard(canvas.nodes, [], {
      envelope: nextEnvelope,
      teachingRelations: [teachingRelation('teaching-new')],
      teachingCoverage: {
        status: 'partial',
        relationCount: 1,
        coreNodeCount: 2,
        uncoveredCoreNodeCount: 1,
        note: '新教学覆盖',
      },
    }));
    expect(refreshed.relationsByLayerKey['ACT_TEACHING:teaching-new']).toBeDefined();
    expect(refreshed.relationsByLayerKey['ACT_TEACHING:teaching-old']).toBeUndefined();
    expect(refreshed.relationsByLayerKey['ENGINEERING:relation-association']).toBeDefined();
    expect(refreshed.teachingCoverageByDomain['system-modeling']?.note).toBe('新教学覆盖');
    expect(refreshed.loadedShardKeys).toContain('domain-default:system-modeling');
    expect(refreshed.positionsByCanonicalId['node-concept']).toEqual({ x: 144, y: 288 });
    expect(refreshed.selectedCanonicalId).toBe('node-concept');
    expect(refreshed.inspectorOpen).toBe(true);
  });

  it('resets domain relations and Teaching coverage without losing graph selection state', () => {
    const teachingA = teachingRelation('teaching-a');
    const teachingB = teachingRelation('teaching-b', 'node-model', 'node-formula');
    const relationA = { ...canvas.relations[0], id: 'relation-a' };
    const relationB = { ...canvas.relations[1], id: 'relation-b' };
    let workspace = createEmptyAuthorityShardWorkspace();
    workspace = mergeAuthorityShard(workspace, rootShard);
    workspace = mergeAuthorityShard(workspace, domainDefaultShard(canvas.nodes, [], {
      teachingRelations: [teachingA],
      teachingCoverage: { status: 'available', relationCount: 1, note: 'A 教学覆盖' },
    }));
    workspace = mergeAuthorityShard(workspace, familyShard('association', [relationA]));
    workspace = enableAuthorityShardFamily(workspace, 'association');
    workspace = rememberAuthorityShardPositions(workspace, { 'node-concept': { x: 144, y: 288 } });
    workspace = selectAuthorityShardObject(workspace, 'node-concept');

    expect(visibleAuthorityShardRelations(workspace).map((relation) => relation.id)).toEqual(['teaching-a', 'relation-a']);

    workspace = resetAuthorityShardDomain(workspace);
    expect(visibleAuthorityShardRelations(workspace)).toEqual([]);
    expect(workspace.relationsByLayerKey).toEqual({});
    expect(workspace.teachingCoverageByDomain).toEqual({});
    expect(workspace.loadedShardKeys).toEqual(['root']);
    expect(workspace.enabledFamilies).toEqual([]);
    expect(workspace.positionsByCanonicalId['node-concept']).toEqual({ x: 144, y: 288 });
    expect(workspace.selectedCanonicalId).toBe('node-concept');
    expect(workspace.inspectorOpen).toBe(true);

    workspace = mergeAuthorityShard(workspace, domainDefaultShard(canvas.nodes, [], {
      domainId: 'frequency-domain-analysis',
      visualRole: 'frequency',
      teachingRelations: [teachingB],
      teachingCoverage: {
        domainId: 'frequency-domain-analysis',
        status: 'partial',
        relationCount: 1,
        note: 'B 教学覆盖',
      },
    }));
    expect(workspace.relationsByLayerKey['ACT_TEACHING:teaching-a']).toBeUndefined();
    expect(workspace.relationsByLayerKey['ACT_TEACHING:teaching-b']).toBeDefined();
    expect(workspace.teachingCoverageByDomain['system-modeling']).toBeUndefined();
    expect(workspace.teachingCoverageByDomain['frequency-domain-analysis']?.note).toBe('B 教学覆盖');
    expect(workspace.enabledFamilies).toEqual([]);
    expect(visibleAuthorityShardRelations(workspace).map((relation) => relation.id)).toEqual(['teaching-b']);

    workspace = mergeAuthorityShard(
      workspace,
      familyShard('association', [relationB], shardEnvelope, 'frequency-domain-analysis'),
    );
    expect(visibleAuthorityShardRelations(workspace).map((relation) => relation.id)).toEqual(['teaching-b']);
    workspace = enableAuthorityShardFamily(workspace, 'association');
    expect(visibleAuthorityShardRelations(workspace).map((relation) => relation.id)).toEqual(['teaching-b', 'relation-b']);
  });

  it('drops a late old domain-default response after a newer Teaching identity wins', async () => {
    const oldEnvelope = teachingEnvelope('teaching-v1');
    const nextEnvelope = teachingEnvelope('teaching-v2');
    const oldDomainResponse = deferred<ReturnType<typeof domainDefaultShard>>();
    const nextDomainResponse = deferred<ReturnType<typeof domainDefaultShard>>();
    let domainRequestCount = 0;

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/knowledge/shards/active')) {
        return { ok: true, status: 200, json: async () => ({ ...rootShard, envelope: oldEnvelope }) };
      }
      if (url.includes('/domains/')) {
        domainRequestCount += 1;
        if (domainRequestCount === 1) return oldDomainResponse.promise.then(mockResponse);
        if (domainRequestCount === 2) return nextDomainResponse.promise.then(mockResponse);
        return {
          ok: true,
          status: 200,
          json: async () => domainDefaultShard(canvas.nodes, [], {
            envelope: nextEnvelope,
            teachingRelations: [teachingRelation('teaching-new', 'node-concept', 'node-model')],
            teachingCoverage: { status: 'partial', relationCount: 1, note: '新教学覆盖' },
          }),
        };
      }
      throw new Error(`unexpected product request ${url}`);
    });

    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    const entry = container.querySelector<HTMLButtonElement>('[data-authority-domain-entry="modeling"]');
    expect(entry).not.toBeNull();
    await act(async () => entry!.click());
    await act(async () => entry!.click());
    expect(domainRequestCount).toBe(2);

    nextDomainResponse.resolve({
      ...domainDefaultShard(canvas.nodes, [], {
        envelope: nextEnvelope,
        teachingRelations: [teachingRelation('teaching-new', 'node-concept', 'node-model')],
        teachingCoverage: { status: 'partial', relationCount: 1, note: '新教学覆盖' },
      }),
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(domainRequestCount).toBe(3);
    expect(container.querySelector('[data-active-authority-relation="teaching-new"]')).not.toBeNull();

    oldDomainResponse.resolve({
      ...domainDefaultShard(canvas.nodes, [], {
        envelope: oldEnvelope,
        teachingRelations: [teachingRelation('teaching-old', 'node-concept', 'node-model')],
        teachingCoverage: { status: 'available', relationCount: 1, note: '旧教学覆盖' },
      }),
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(domainRequestCount).toBe(3);
    expect(container.querySelector('[data-active-authority-relation="teaching-new"]')).not.toBeNull();
    expect(container.querySelector('[data-active-authority-relation="teaching-old"]')).toBeNull();
    // 面板教学行按新 coverage 的 partial 状态提示，旧身份不再渲染。
    expect(container.querySelector('[data-authority-teaching-coverage="true"]')?.textContent).toContain('仅有部分教学关系已发布');
  });

  it('clears the workspace and stays unavailable on Authority/catalog drift from an engineering shard', async () => {
    const driftEnvelope: AuthorityShardPublicEnvelope = {
      ...shardEnvelope,
      authorityCatalogVersion: 'acv-drifted',
      match: { ...shardEnvelope.match, teaching: null },
    };
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/knowledge/shards/active')) return mockResponse(rootShard);
      if (url.includes('/domains/') && url.includes('/families/association')) {
        return mockResponse(familyShard('association', [canvas.relations[0]], driftEnvelope));
      }
      if (url.includes('/domains/')) return mockResponse(domainDefaultShard());
      throw new Error(`unexpected product request ${url}`);
    });

    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain({ families: false });
    const familyButton = container.querySelector<HTMLButtonElement>('[data-authority-relation-family="association"]');
    expect(familyButton).not.toBeNull();
    await act(async () => familyButton!.click());
    await act(async () => Promise.resolve());
    expect(container.querySelector('[data-active-graph-stage]')).toBeNull();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).toContain('当前知识图谱身份发生漂移');
  });

  it('renders a single-semantic login wall with callback CTA when the root shard returns 401', async () => {
    window.history.replaceState({}, '', '/knowledge');
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/knowledge/shards/active')) return { ok: false, status: 401, json: async () => ({}) };
      throw new Error(`unexpected product request ${url}`);
    });

    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());

    const wall = container.querySelector('[data-graph-login-wall="true"]');
    expect(wall).not.toBeNull();
    expect(container.textContent).toContain('请先登录后查看知识图谱');
    expect(container.textContent).not.toContain('当前知识图谱不可用');
    expect(container.textContent).not.toContain('未请求另一套图谱数据');
    expect(container.textContent).not.toContain('重试当前图谱');
    const cta = wall!.querySelector<HTMLAnchorElement>('a[href]');
    expect(cta).not.toBeNull();
    expect(cta!.getAttribute('href')).toBe('/login?callbackUrl=%2Fknowledge');
    expect(cta!.textContent).toBe('前往登录');
  });

  it('keeps the retry error state without a login wall when the root shard fails with 503', async () => {
    window.history.replaceState({}, '', '/knowledge');
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/knowledge/shards/active')) return { ok: false, status: 503, json: async () => ({}) };
      throw new Error(`unexpected product request ${url}`);
    });

    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());

    expect(container.querySelector('[data-graph-login-wall="true"]')).toBeNull();
    expect(container.textContent).not.toContain('请先登录后查看知识图谱');
    expect(container.textContent).not.toContain('前往登录');
    expect(container.textContent).toContain('当前知识图谱暂时无法加载');
    expect(container.textContent).toContain('当前知识图谱不可用');
    expect(container.textContent).toContain('重试当前图谱');
  });

  it('projects a shard-absent root failure as content-not-ready with a legacy entry instead of a bare retry', async () => {
    // 320px 视口失败态：错误卡片与 legacy 入口不依赖宽度条件渲染。
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/knowledge/shards/active')) {
        return { ok: false, status: 404, json: async () => ({ error: '当前 Authority 分片暂时无法加载。', code: 'ACTIVE_SHARD_SHARD_ABSENT' }) };
      }
      throw new Error(`unexpected product request ${url}`);
    });

    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student',
      candidateAllowed: false,
      controlledVerification: false,
      legacy: createElement('div', { 'data-legacy-marker': 'true' }, 'legacy graph'),
    })));
    await act(async () => Promise.resolve());

    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).toContain('知识数据尚未发布完成');
    expect(container.textContent).not.toContain('当前知识图谱暂时无法加载');
    expect(container.textContent).not.toContain('重试当前图谱');
    const legacyAction = container.querySelector<HTMLButtonElement>('[data-error-action="legacy"]');
    expect(legacyAction).not.toBeNull();
    expect(legacyAction!.textContent).toContain('查看旧版图谱');
    expect(container.querySelector('[data-legacy-marker="true"]')?.closest('[hidden]')).not.toBeNull();

    await act(async () => legacyAction!.click());
    expect(container.querySelector('[data-knowledge-graph-mode="legacy"]')).not.toBeNull();
    expect(container.querySelector('[data-legacy-marker="true"]')?.closest('[hidden]')).toBeNull();
  });

  it('projects an activation-absent root failure as content-not-ready', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/knowledge/shards/active')) {
        return { ok: false, status: 503, json: async () => ({ error: '当前 Authority 激活证据不可用。', code: 'ACTIVE_GRAPH_ACTIVATION_ABSENT' }) };
      }
      throw new Error(`unexpected product request ${url}`);
    });

    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());

    expect(container.textContent).toContain('知识数据尚未发布完成');
    expect(container.textContent).not.toContain('重试当前图谱');
  });

  it('projects a relation-family shard-absent failure as content-not-ready', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/knowledge/shards/active')) return mockResponse(rootShard);
      if (url.includes('/domains/') && url.includes('/families/association')) {
        return { ok: false, status: 404, json: async () => ({ error: '当前 Authority 分片暂时无法加载。', code: 'ACTIVE_SHARD_SHARD_ABSENT' }) };
      }
      if (url.includes('/domains/')) return mockResponse(domainDefaultShard());
      throw new Error(`unexpected product request ${url}`);
    });

    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain({ families: false });
    const familyButton = container.querySelector<HTMLButtonElement>('[data-authority-relation-family="association"]');
    expect(familyButton).not.toBeNull();
    await act(async () => familyButton!.click());
    await act(async () => Promise.resolve());

    const failure = container.querySelector('[data-authority-family-failure="association"]');
    expect(failure).not.toBeNull();
    expect(failure!.textContent).toContain('知识数据尚未发布完成');
    expect(failure!.textContent).not.toContain('暂时无法加载');
    expect(container.querySelector('[data-authority-family-retry="association"]')).toBeNull();
  });

  it('keeps the retry guidance for transient root failures without a failure code', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/knowledge/shards/active')) {
        return { ok: false, status: 503, json: async () => ({ error: '当前 Authority 分片暂时无法加载。', code: 'ACTIVE_SHARD_UNAVAILABLE' }) };
      }
      throw new Error(`unexpected product request ${url}`);
    });

    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());

    expect(container.textContent).toContain('当前知识图谱暂时无法加载');
    expect(container.textContent).toContain('重试当前图谱');
    expect(container.querySelector('[data-error-action="legacy"]')).toBeNull();
  });

  it('fails closed when a relation-family response reports identity drift without an envelope', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/knowledge/shards/active')) return mockResponse(rootShard);
      if (url.includes('/domains/') && url.includes('/families/association')) {
        return { ok: false, status: 409, json: async () => ({}) };
      }
      if (url.includes('/domains/')) return mockResponse(domainDefaultShard());
      throw new Error(`unexpected product request ${url}`);
    });

    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain({ families: false });
    const familyButton = container.querySelector<HTMLButtonElement>('[data-authority-relation-family="association"]');
    expect(familyButton).not.toBeNull();
    await act(async () => familyButton!.click());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(container.querySelector('[data-active-graph-stage]')).toBeNull();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).toContain('当前知识图谱身份发生漂移');
  });

  it('rolls back an optimistic relation-family enable and exposes a retry after a load failure', async () => {
    let failures = 0;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/knowledge/shards/active')) return mockResponse(rootShard);
      if (url.includes('/domains/') && url.includes('/families/association')) {
        if (failures++ === 0) return { ok: false, status: 503, json: async () => ({}) };
        return mockResponse(familyShard('association', [canvas.relations[0]]));
      }
      if (url.includes('/domains/')) return mockResponse(domainDefaultShard());
      throw new Error(`unexpected product request ${url}`);
    });

    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain({ families: false });
    const familyButton = container.querySelector<HTMLButtonElement>('[data-authority-relation-family="association"]');
    expect(familyButton).not.toBeNull();
    await act(async () => familyButton!.click());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(familyButton?.dataset.authorityFamilyEnabled).toBe('false');
    expect(container.querySelector('[data-authority-family-failure="association"]')).not.toBeNull();
    const retry = container.querySelector<HTMLButtonElement>('[data-authority-family-retry="association"]');
    expect(retry).not.toBeNull();
    await act(async () => retry!.click());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(container.querySelector('[data-authority-family-failure="association"]')).toBeNull();
    expect(familyButton?.dataset.authorityFamilyEnabled).toBe('true');
  });

  it('fails closed when a neighborhood response reports identity drift without an envelope', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      const nodeId = decodeURIComponent(url.split('/').pop() ?? 'node-concept');
      if (url.endsWith('/api/knowledge/shards/active')) return mockResponse(rootShard);
      if (url.includes('/domains/')) return mockResponse(domainDefaultShard());
      if (url.includes('/neighborhoods/')) return { ok: false, status: 409, json: async () => ({}) };
      if (url.includes('/shards/active/nodes/')) {
        return mockResponse({
          shardClass: 'node-detail', envelope: shardEnvelope,
          node: { ...nodeDetail(nodeId).node, teachingFields: {}, media: { cardAvailable: false, infographAvailable: false } },
        });
      }
      throw new Error(`unexpected product request ${url}`);
    });

    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain({ families: false });
    const node = container.querySelector<SVGGElement>('[data-active-authority-node="node-concept"]');
    expect(node).not.toBeNull();
    await act(async () => node!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(container.querySelector('[data-active-graph-stage]')).toBeNull();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).toContain('当前知识图谱身份发生漂移');
  });

  it('keeps the canvas visible and exposes a retry after a neighborhood load failure', async () => {
    let failures = 0;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      const nodeId = decodeURIComponent(url.split('/').pop() ?? 'node-concept');
      if (url.endsWith('/api/knowledge/shards/active')) return mockResponse(rootShard);
      if (url.includes('/domains/')) return mockResponse(domainDefaultShard());
      if (url.includes('/neighborhoods/')) {
        if (failures++ === 0) return { ok: false, status: 503, json: async () => ({}) };
        return mockResponse(neighborhoodShard(nodeId));
      }
      if (url.includes('/shards/active/nodes/')) {
        return mockResponse({
          shardClass: 'node-detail', envelope: shardEnvelope,
          node: { ...nodeDetail(nodeId).node, teachingFields: {}, media: { cardAvailable: false, infographAvailable: false } },
        });
      }
      throw new Error(`unexpected product request ${url}`);
    });

    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain({ families: false });
    const node = container.querySelector<SVGGElement>('[data-active-authority-node="node-concept"]');
    expect(node).not.toBeNull();
    await act(async () => node!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(container.querySelector('[data-active-graph-stage="authority"]')).not.toBeNull();
    expect(container.querySelector('[data-authority-neighborhood-failure="node-concept"]')).not.toBeNull();
    const retry = container.querySelector<HTMLButtonElement>('[data-authority-neighborhood-retry="node-concept"]');
    expect(retry).not.toBeNull();
    await act(async () => retry!.click());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(container.querySelector('[data-authority-neighborhood-failure="node-concept"]')).toBeNull();
  });

  it('routes a node-detail 200 Authority/catalog drift through the global reset', async () => {
    const driftEnvelope: AuthorityShardPublicEnvelope = {
      ...shardEnvelope,
      authorityCatalogVersion: 'acv-node-detail-drift',
      match: { ...shardEnvelope.match, teaching: null },
    };
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      const nodeId = decodeURIComponent(url.split('/').pop() ?? 'node-concept');
      if (url.endsWith('/api/knowledge/shards/active')) return mockResponse(rootShard);
      if (url.includes('/domains/')) return mockResponse(domainDefaultShard());
      if (url.includes('/neighborhoods/')) return mockResponse(neighborhoodShard(nodeId));
      if (url.includes('/shards/active/nodes/')) {
        return mockResponse({
          shardClass: 'node-detail', envelope: driftEnvelope,
          node: { ...nodeDetail(nodeId).node, teachingFields: {}, media: { cardAvailable: false, infographAvailable: false } },
        });
      }
      throw new Error(`unexpected product request ${url}`);
    });

    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain({ families: false });
    const node = container.querySelector<SVGGElement>('[data-active-authority-node="node-concept"]');
    expect(node).not.toBeNull();
    await act(async () => node!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(container.querySelector('[data-active-graph-stage]')).toBeNull();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).toContain('当前知识图谱身份发生漂移');
  });

  it('fails closed when a node-detail response reports identity drift without an envelope', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      const nodeId = decodeURIComponent(url.split('/').pop() ?? 'node-concept');
      if (url.endsWith('/api/knowledge/shards/active')) return mockResponse(rootShard);
      if (url.includes('/domains/')) return mockResponse(domainDefaultShard());
      if (url.includes('/neighborhoods/')) return mockResponse(neighborhoodShard(nodeId));
      if (url.includes('/shards/active/nodes/')) return { ok: false, status: 409, json: async () => ({}) };
      throw new Error(`unexpected product request ${url}`);
    });

    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain({ families: false });
    const node = container.querySelector<SVGGElement>('[data-active-authority-node="node-concept"]');
    expect(node).not.toBeNull();
    await act(async () => node!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(container.querySelector('[data-active-graph-stage]')).toBeNull();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).toContain('当前知识图谱身份发生漂移');
  });

  it('invalidates Teaching caches when family, neighborhood, or detail observes a new identity', () => {
    const oldEnvelope = teachingEnvelope('teaching-v1');
    const engineeringEnvelope = teachingEnvelope('teaching-v2');
    let workspace = createEmptyAuthorityShardWorkspace();
    workspace = mergeAuthorityShard(workspace, { ...rootShard, envelope: oldEnvelope });
    workspace = mergeAuthorityShard(workspace, domainDefaultShard(canvas.nodes, [], {
      envelope: oldEnvelope,
      teachingRelations: [teachingRelation('teaching-old')],
      teachingCoverage: { status: 'available', relationCount: 1, note: '旧教学覆盖' },
    }));
    const engineeringFamily = familyShard('association', [canvas.relations[0]], engineeringEnvelope);
    const engineeringNeighborhood = neighborhoodShard('node-concept', engineeringEnvelope);
    const engineeringDetail = {
      shardClass: 'node-detail' as const,
      envelope: engineeringEnvelope,
      node: {
        ...nodeDetail('node-concept').node,
        teachingFields: {},
        media: { cardAvailable: false as const, infographAvailable: false as const },
      },
    };
    workspace = rememberAuthorityShardPositions(workspace, { 'node-concept': { x: 90, y: 180 } });
    workspace = selectAuthorityShardObject(workspace, 'node-concept');
    workspace = invalidateTeachingBearingShards(workspace, engineeringFamily.envelope);
    expect(shardIdentityDrift(workspace, engineeringFamily)).toBeNull();
    workspace = mergeAuthorityShard(workspace, engineeringFamily);
    workspace = mergeAuthorityShard(workspace, engineeringNeighborhood);
    workspace = mergeAuthorityShard(workspace, engineeringDetail);

    expect(workspace.envelope).toEqual(engineeringEnvelope);
    expect(workspace.relationsByLayerKey['ACT_TEACHING:teaching-old']).toBeUndefined();
    expect(workspace.teachingCoverageByDomain).toEqual({});
    expect(workspace.detailsByCanonicalId['node-concept']).toBeDefined();
    expect(workspace.positionsByCanonicalId['node-concept']).toEqual({ x: 90, y: 180 });
    expect(workspace.selectedCanonicalId).toBe('node-concept');
    expect(workspace.relationsByLayerKey['ENGINEERING:relation-association']).toBeDefined();
  });

  it('renders a semantic active canvas and keeps active/Legacy responses independent', async () => {
    await act(async () => {
      root.render(createElement(KnowledgeGraphWorkspace, {
        viewerRole: 'student', candidateAllowed: false, controlledVerification: false,
        legacy: createElement('div', { 'data-legacy': 'true' }, '历史 Legacy 图谱'),
      }));
    });
    await act(async () => Promise.resolve());
    expect(container.querySelector('[data-authority-shard-root="true"]')).not.toBeNull();
    await enterModelingDomain();
    expect(container.querySelector('[data-active-authority-graph="true"]')).not.toBeNull();
    expect(container.querySelector('[data-active-graph-stage="authority"]')).not.toBeNull();
    expect(container.textContent).toContain('当前知识图谱');
    expect(container.querySelector('[aria-label="新版语义关系画布"]')).not.toBeNull();
    expect(container.querySelector('[data-active-inspector-surface]')).toBeNull();
    expect(container.textContent).not.toContain('internal-release');
    expect(container.textContent).not.toContain('internal-snapshot');
    expect(container.textContent).not.toContain('future_internal');
    expect(container.querySelector('[data-active-authority-node="node-unknown"]')).toBeNull();
    expect(container.querySelectorAll('[data-active-authority-relation]').length).toBe(2);

    const node = container.querySelector<SVGGElement>('[data-active-authority-node="node-concept"]');
    expect(node).not.toBeNull();
    await act(async () => {
      node!.focus();
    });
    expect(document.activeElement).toBe(node);
    await act(async () => node!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => Promise.resolve());
    const detail = container.querySelector('[data-active-node-detail]');
    expect(detail).not.toBeNull();
    expect(container.querySelector('[data-active-inspector-surface="desktop-overlay"]')).not.toBeNull();
    expect(container.querySelector('[data-active-authority-node-type-label]')).toBeNull();
    expect(container.querySelector('[data-active-authority-node-label-placement="below"]')).not.toBeNull();
    expect(document.activeElement).toBe(detail);
    expect(container.textContent).toContain('来源定位暂不可用');
    expect(container.textContent).not.toContain('internal-edition');
    expect(container.textContent).not.toContain('node-formula');
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise((resolve) => window.setTimeout(resolve, 5));
    });
    expect(document.activeElement).toBe(node);

    const modelNode = container.querySelector<SVGGElement>('[data-active-authority-node="node-model"]');
    expect(modelNode).not.toBeNull();
    await act(async () => modelNode!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => Promise.resolve());
    expect(container.querySelector('[data-active-node-detail="node-model"]')).not.toBeNull();
    expect(container.querySelector('[data-active-authority-toolbar="true"]')).not.toBeNull();
    // #1742 review：筛选/搜索 chrome 移出全局工具栏，挂在独立 chrome 行。
    expect(container.querySelector('[data-knowledge-workspace-toolbar="true"] [data-active-authority-toolbar="true"]')).toBeNull();
    expect(container.querySelector('[data-knowledge-workspace-chrome-slot="true"] [data-active-authority-toolbar="true"]')).not.toBeNull();
    expect(container.querySelector('[data-knowledge-layout-control="fit-view"]')).not.toBeNull();
    expect(container.querySelector('[data-authority-relation-family="teaching-order"]')).not.toBeNull();

    await act(async () => {
      [...container.querySelectorAll('button')].find((button) => button.textContent === '旧版')!.click();
    });
    expect(container.querySelector('[data-legacy="true"]')).not.toBeNull();
    await act(async () => {
      [...container.querySelectorAll('button')].find((button) => button.textContent === '新版')!.click();
    });
    await act(async () => Promise.resolve());
    expect(container.querySelector('[data-active-authority-graph="true"]')).not.toBeNull();
    expect(container.querySelector('[data-active-node-detail="node-model"]')).not.toBeNull();
    const requested = fetchMock.mock.calls.map(([url]) => String(url));
    expect(requested[0]).toBe('/api/knowledge/shards/active');
    expect(requested).toContain('/api/knowledge/shards/active/domains/modeling');
    expect(requested).toContain('/api/knowledge/shards/active/nodes/node-concept');
    expect(requested.some((url) => url.includes('/graph/active'))).toBe(false);
    expect(requested.every((url) => url.includes('/active'))).toBe(true);
  });

  it('contains mobile inspector keyboard focus in a dialog drawer', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => {
      window.dispatchEvent(new Event('resize'));
      await Promise.resolve();
    });
    await enterModelingDomain({ families: false });
    const node = container.querySelector<SVGGElement>('[data-active-authority-node="node-concept"]');
    expect(node).not.toBeNull();
    await act(async () => node!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => Promise.resolve());
    const drawer = container.querySelector('[data-active-inspector-surface="mobile-drawer"]');
    expect(drawer).not.toBeNull();
    expect(drawer?.getAttribute('role')).toBe('dialog');
    expect(drawer?.getAttribute('aria-modal')).toBe('true');
    expect(drawer?.getAttribute('data-active-inspector-focus-contract')).toBe('mobile-contained-drawer');
    expect(container.querySelector('[data-active-authority-main]')?.hasAttribute('inert')).toBe(true);
  });

  it('renders selection-bound learning content and keeps semantic detail usable after an image failure', async () => {
    await act(async () => {
      root.render(createElement(KnowledgeGraphWorkspace, {
        viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
      }));
    });
    await act(async () => Promise.resolve());
    await enterModelingDomain({ families: false });
    const node = container.querySelector<SVGGElement>('[data-active-authority-node="node-concept"]');
    expect(node).not.toBeNull();
    await act(async () => node!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(container.textContent).toContain('知识卡');
    expect(container.textContent).toContain('稳定性描述用于判断系统响应是否收敛。');
    expect(container.querySelector('img[alt="稳定性 信息图"]')).not.toBeNull();
    expect(container.textContent).not.toContain('internal-release');
    expect(container.textContent).not.toContain('internal-snapshot');

    const image = container.querySelector<HTMLImageElement>('img[alt="稳定性 信息图"]');
    expect(image).not.toBeNull();
    const imageUrl = new URL(image!.src);
    expect(imageUrl.pathname).toBe('/api/knowledge/shards/active/nodes/node-concept/infograph');
    expect(imageUrl.searchParams.has('url')).toBe(false);
    expect(image?.getAttribute('srcset')).toBeNull();
    expect(imageUrl.pathname).not.toBe('/_next/image');
    await act(async () => image?.dispatchEvent(new Event('error')));
    expect(container.textContent).not.toContain('当前信息图暂时不可用。');
    expect(container.textContent).toContain('稳定性反映系统在扰动后的响应趋势。');
    expect(container.querySelector('[aria-labelledby="active-detail-infograph"]')).toBeNull();
  });

  it('omits optional learning panels when the current Teaching envelope is unavailable', async () => {
    detailLearningContentMode = 'unavailable';
    await act(async () => {
      root.render(createElement(KnowledgeGraphWorkspace, {
        viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
      }));
    });
    await act(async () => Promise.resolve());
    await enterModelingDomain({ families: false });
    const node = container.querySelector<SVGGElement>('[data-active-authority-node="node-concept"]');
    expect(node).not.toBeNull();
    await act(async () => node!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(container.querySelector('[data-active-node-detail="node-concept"]')).not.toBeNull();
    expect(container.querySelector('[aria-labelledby="active-detail-card"]')).toBeNull();
    expect(container.querySelector('[aria-labelledby="active-detail-infograph"]')).toBeNull();
    const requested = fetchMock.mock.calls.map(([url]) => String(url));
    expect(requested).toContain('/api/knowledge/shards/active/nodes/node-concept');
    expect(requested.some((url) => url.includes('/infograph'))).toBe(false);
  });

  it('renders catalog-driven circular root entries with no connectors or internal identifiers', async () => {
    const expandedRoot = {
      ...rootShard,
      root: {
        ...rootShard.root,
        domains: [
          ...rootShard.root.domains,
          frequencyRootDomain,
          {
            kind: 'presentation-domain' as const,
            order: 3,
            displayName: '  ',
            summary: '',
            presentationRole: 'domain' as const,
            visualRole: 'state-space' as const,
            memberCount: 1,
          },
        ],
      },
    };
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/knowledge/shards/active')) return mockResponse(expandedRoot);
      throw new Error(`unexpected product request ${url}`);
    });

    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());

    const rootCanvas = container.querySelector('[data-authority-root-canvas="true"]');
    expect(rootCanvas).not.toBeNull();
    expect(rootCanvas?.getAttribute('data-active-authority-runtime')).toBe('force-graph');
    expect(rootCanvas?.querySelector('[data-knowledge-runtime-canvas]')).not.toBeNull();
    expect(container.querySelectorAll('[data-authority-domain-entry]')).toHaveLength(3);
    expect(container.querySelector('[data-authority-aggregate-entry="true"]')).not.toBeNull();
    expect(rootCanvas?.querySelectorAll('svg, line, polyline, [data-authority-root-edge]')).toHaveLength(0);
    expect(container.textContent).not.toContain('state-space');
    expect(container.textContent).not.toContain('internal-release');
    const modelingButton = container.querySelector('[data-authority-domain-entry="modeling"]');
    expect(modelingButton?.getAttribute('aria-label')).toBe('系统建模');
    expect(container.querySelector('[data-authority-domain-entry="state-space"]')?.getAttribute('aria-label')).toBe('该领域暂不可用');
    const requested = fetchMock.mock.calls.map(([url]) => String(url));
    expect(requested).toEqual(['/api/knowledge/shards/active']);
  });

  it('renders the aggregate entry and keeps secondary objects behind explicit disclosure', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/knowledge/shards/active')) return mockResponse(rootShard);
      if (url.includes('/domains/')) {
        return mockResponse(domainDefaultShard(canvas.nodes, [], {
          teachingRelations: [teachingRelation('teaching-primary', 'node-concept', 'node-model')],
          teachingCoverage: { status: 'available', relationCount: 1, coreNodeCount: 2, note: '已发布教学顺序' },
        }));
      }
      throw new Error(`unexpected product request ${url}`);
    });

    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    expect(container.querySelector('[data-authority-aggregate-entry="true"]')).not.toBeNull();

    await enterModelingDomain({ families: false });
    expect(container.querySelector('[data-authority-relation-family="teaching-order"]')).not.toBeNull();
    expect(container.querySelector('[data-active-authority-filter-panel="true"]')).not.toBeNull();
    expect(container.querySelector('[data-active-authority-filter-placement="compact-bottom-left"]')).not.toBeNull();
    expect(container.querySelector('[data-active-authority-toolbar="true"] [data-active-authority-filter-panel="true"]')).toBeNull();
    expect(container.querySelector('[data-authority-relation-legend="true"]')).toBeNull();
    expect(container.querySelector('[data-active-authority-relation="teaching-primary"]')).not.toBeNull();
    expect(container.querySelector('[data-active-authority-node="node-concept"]')).not.toBeNull();
    expect(container.querySelector('[data-active-authority-node="node-model"]')).not.toBeNull();
    expect(container.querySelector('[data-active-authority-node="node-formula"]')).not.toBeNull();
    expect(container.querySelector('[data-active-authority-node="node-isolated"]')).not.toBeNull();

    // 多选类型筛选：隐藏 Formula 只影响该类型，可逆恢复（#1742）。
    const formulaToggle = container.querySelector<HTMLButtonElement>('[data-active-authority-type-filter="Formula"]');
    expect(formulaToggle).not.toBeNull();
    expect(container.querySelector('[data-active-authority-type-filter="DomainConcept"]')).not.toBeNull();
    await act(async () => formulaToggle!.click());
    expect(container.querySelector('[data-active-authority-node="node-formula"]')).toBeNull();
    expect(container.querySelector('[data-active-authority-node="node-concept"]')).not.toBeNull();
    await act(async () => formulaToggle!.click());
    expect(container.querySelector('[data-active-authority-node="node-formula"]')).not.toBeNull();
  });

  it('materializes both endpoints of published teaching relations even when one is a secondary type', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/knowledge/shards/active')) return mockResponse(rootShard);
      if (url.includes('/domains/')) {
        return mockResponse(domainDefaultShard(canvas.nodes, [], {
          teachingRelations: [teachingRelation('teaching-formula', 'node-concept', 'node-formula')],
          teachingCoverage: { status: 'available', relationCount: 1, coreNodeCount: 2, note: '已发布教学顺序' },
        }));
      }
      throw new Error(`unexpected product request ${url}`);
    });

    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain({ families: false });
    expect(container.querySelector('[data-active-authority-relation="teaching-formula"]')).not.toBeNull();
    expect(container.querySelector('[data-active-authority-node="node-concept"]')).not.toBeNull();
    expect(container.querySelector('[data-active-authority-node="node-formula"]')).not.toBeNull();
  });

  it('loads each enabled engineering group from the active domain shard endpoint', async () => {
    const families = [
      'structure',
      'derivation-and-representation',
      'application-and-analysis',
      'association',
    ] as const;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/knowledge/shards/active')) return mockResponse(rootShard);
      if (url.includes('/domains/') && url.includes('/families/')) {
        const family = families.find((entry) => url.endsWith(`/families/${entry}`));
        if (family) return mockResponse(familyShard(family, [canvas.relations[0]]));
      }
      if (url.includes('/domains/')) return mockResponse(domainDefaultShard());
      throw new Error(`unexpected product request ${url}`);
    });

    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain({ families: false });

    for (const family of families) {
      const control = container.querySelector<HTMLButtonElement>(`[data-authority-relation-family="${family}"]`);
      expect(control).not.toBeNull();
      await act(async () => control!.click());
    }
    await act(async () => Promise.resolve());

    const requests = fetchMock.mock.calls.map(([url]) => String(url));
    for (const family of families) {
      expect(requests).toContain(`/api/knowledge/shards/active/domains/modeling/families/${family}`);
      expect(container.querySelector<HTMLButtonElement>(`[data-authority-relation-family="${family}"]`)?.dataset.authorityFamilyEnabled).toBe('true');
    }
  });

  it('supports search, type filtering, isolated nodes, selection and zoom controls', async () => {
    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain();
    const search = container.querySelector<HTMLInputElement>('#active-authority-search')!;
    await act(async () => {
      search.value = '孤立';
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await settleDomainSearch();
    const result = container.querySelector<HTMLButtonElement>('[data-active-authority-search-result="node-isolated"]');
    expect(result).not.toBeNull();
    await act(async () => result!.click());
    await act(async () => Promise.resolve());
    expect(container.querySelector('[data-active-authority-node="node-isolated"]')).not.toBeNull();
    expect(container.textContent).toContain('暂无已发布关系');
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise((resolve) => window.setTimeout(resolve, 5));
    });
    expect(document.activeElement?.getAttribute('data-active-authority-node')).toBe('node-isolated');
    expect(container.querySelector('[data-active-authority-dimension="2d"]')).not.toBeNull();
    expect(container.querySelector('[data-active-authority-dimension="3d"]')).not.toBeNull();
    expect(container.querySelector('[data-active-authority-runtime="force-graph"]')).not.toBeNull();
    // 单选类型下拉已退役：类型筛选在专用面板内多选、独立可逆（#1742）。
    expect(container.querySelector('#active-authority-type-filter')).toBeNull();
    const formulaToggle = container.querySelector<HTMLButtonElement>('[data-active-authority-type-filter="Formula"]');
    expect(formulaToggle?.getAttribute('aria-checked')).toBe('true');
    await act(async () => formulaToggle!.click());
    expect(formulaToggle?.getAttribute('aria-checked')).toBe('false');
    expect(container.querySelector('[data-active-authority-node="node-formula"]')).toBeNull();
    await act(async () => formulaToggle!.click());
    expect(container.querySelector('[data-active-authority-node="node-formula"]')).not.toBeNull();
  });

  it('keeps the node directory screen-reader-only with explicit empty states when relations are unavailable', async () => {
    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain({ families: true });

    // Teaching 不可用/零边不再展开底部可见目录（#1742）；画布与显式
    // 筛选/空态控件保持可见产品表面。
    expect(container.querySelector('[data-active-authority-node-directory="visible"]')).toBeNull();
    const directory = container.querySelector<HTMLElement>('[data-active-authority-node-directory="semantic"]');
    expect(directory).not.toBeNull();
    expect(container.querySelector('[data-active-authority-visible-node="true"]')).toBeNull();
    expect(container.querySelector('[data-active-authority-runtime="force-graph"]')).not.toBeNull();
    expect(container.querySelector('[data-active-authority-filter-panel="true"]')).not.toBeNull();
    expect(container.querySelector('[data-authority-teaching-coverage="true"]')?.textContent).toContain('教学关系暂不可用');

    // 语义目录按钮仍可聚焦、可选择（screen-reader 通道不降级）。
    const node = container.querySelector<HTMLButtonElement>('[data-active-authority-semantic-nodes] [data-active-authority-node="node-concept"]');
    expect(node).not.toBeNull();
    expect(node?.textContent).toContain('稳定性');

    await act(async () => node!.click());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(node?.dataset.activeAuthorityNodeSelected).toBe('true');

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise((resolve) => window.setTimeout(resolve, 5));
    });
    expect(document.activeElement).toBe(node);
  });

  it('preserves selection, disclosure and detail state across reversible type toggles', async () => {
    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain();

    const concept = container.querySelector<HTMLButtonElement>('[data-active-authority-semantic-nodes] [data-active-authority-node="node-concept"]');
    await act(async () => concept!.click());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(container.querySelector('[data-active-node-detail="node-concept"]')).not.toBeNull();

    const formulaToggle = container.querySelector<HTMLButtonElement>('[data-active-authority-type-filter="Formula"]');
    await act(async () => formulaToggle!.click());
    // 隐藏 Formula 只隐藏该类型；选择、详情与已披露邻域保持稳定。
    expect(container.querySelector('[data-active-authority-node="node-formula"]')).toBeNull();
    expect(container.querySelector('[data-active-authority-node="node-concept"]')).not.toBeNull();
    expect(container.querySelector('[data-active-authority-node="node-model"]')).not.toBeNull();
    expect(container.querySelector('[data-active-node-detail="node-concept"]')).not.toBeNull();

    await act(async () => formulaToggle!.click());
    expect(container.querySelector('[data-active-authority-node="node-formula"]')).not.toBeNull();
    expect(container.querySelector('[data-active-node-detail="node-concept"]')).not.toBeNull();
  });

  it('switches the open filter panel as one locale-owned surface while preserving filter values', async () => {
    const bilingualRoot = {
      ...rootShard,
      localeCapability: {
        availableLocales: ['zh-CN', 'en'] as const,
        bilingualReady: true,
        englishUnavailableReason: null,
        mode: 'complete-locale' as const,
        languageComponentDigest: 'a'.repeat(64),
      },
    };
    const englishEnvelope: AuthorityShardPublicEnvelope = {
      ...shardEnvelope,
      localeProfileVersion: 'alp-test-complete-en',
    };
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      const path = url.split('?')[0] ?? '';
      if (url.includes('locale=en')) {
        // 事务性刷新要求全部英文分片共享同一 locale envelope（#1741）。
        if (path.endsWith('/api/knowledge/shards/active')) {
          return mockResponse({ ...bilingualRoot, envelope: englishEnvelope });
        }
        return mockResponse(domainDefaultShard(canvas.nodes, [], { envelope: englishEnvelope }));
      }
      if (path.endsWith('/api/knowledge/shards/active')) return mockResponse(bilingualRoot);
      if (url.includes('/domains/')) return mockResponse(domainDefaultShard());
      throw new Error(`unexpected product request ${url}`);
    });

    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain({ families: false });

    const panel = container.querySelector<HTMLElement>('[data-active-authority-filter-panel="true"]');
    expect(panel?.textContent).toContain('对象类型');
    expect(panel?.textContent).toContain('领域概念');
    const formulaToggle = container.querySelector<HTMLButtonElement>('[data-active-authority-type-filter="Formula"]');
    await act(async () => formulaToggle!.click());
    expect(formulaToggle?.getAttribute('aria-checked')).toBe('false');

    const english = container.querySelector<HTMLButtonElement>('[data-graph-language="en"]');
    expect(english?.disabled).toBe(false);
    await act(async () => english!.click());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    // 面板所有可见与可访问标签随 locale 整体切换，不混语言。
    const switchedPanel = container.querySelector<HTMLElement>('[data-active-authority-filter-panel="true"]');
    expect(switchedPanel?.textContent).toContain('Object types');
    expect(switchedPanel?.textContent).toContain('Domain concept');
    expect(switchedPanel?.textContent).not.toContain('领域概念');
    // 类型隐藏状态按稳定身份保留。
    expect(
      container.querySelector<HTMLButtonElement>('[data-active-authority-type-filter="Formula"]')
        ?.getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('toggles teaching relations reversibly from the filter panel', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/knowledge/shards/active')) return mockResponse(rootShard);
      if (url.includes('/domains/')) {
        return mockResponse(domainDefaultShard(canvas.nodes, [], {
          teachingRelations: [teachingRelation('teaching-panel', 'node-concept', 'node-model')],
          teachingCoverage: { status: 'available', relationCount: 1, coreNodeCount: 2, note: '已发布教学顺序' },
        }));
      }
      throw new Error(`unexpected product request ${url}`);
    });

    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain({ families: false });

    const teachingToggle = container.querySelector<HTMLButtonElement>('[data-authority-relation-family="teaching-order"]');
    expect(teachingToggle?.getAttribute('aria-checked')).toBe('true');
    expect(container.querySelector('[data-active-authority-relation="teaching-panel"]')).not.toBeNull();

    // 教学层独立可逆：隐藏后教学边消失，对象与其他关系保持（#1742 review）。
    await act(async () => teachingToggle!.click());
    expect(teachingToggle?.getAttribute('aria-checked')).toBe('false');
    expect(container.querySelector('[data-active-authority-relation="teaching-panel"]')).toBeNull();
    expect(container.querySelector('[data-active-authority-node="node-concept"]')).not.toBeNull();

    await act(async () => teachingToggle!.click());
    expect(teachingToggle?.getAttribute('aria-checked')).toBe('true');
    expect(container.querySelector('[data-active-authority-relation="teaching-panel"]')).not.toBeNull();
  });

  it('keeps the mobile large-domain directory in sync with hidden node types', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
    const nodes = [
      ...Array.from({ length: 50 }, (_, index) => ({
        id: `large-concept-${index + 1}`,
        canonicalType: 'DomainConcept',
        label: `大域概念 ${String(index + 1).padStart(2, '0')}`,
        aliases: [],
        description: null,
        governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: 'active' },
        semanticSupport: { supported: true, readOnly: true as const },
      })),
      {
        id: 'large-formula',
        canonicalType: 'Formula',
        label: '大域公式',
        aliases: [],
        description: null,
        governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: 'active' },
        semanticSupport: { supported: true, readOnly: true as const },
      },
    ];
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/knowledge/shards/active')) return mockResponse(rootShard);
      if (url.includes('/domains/')) return mockResponse(domainDefaultShard(nodes));
      throw new Error(`unexpected product request ${url}`);
    });

    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 10)));
    await enterModelingDomain({ families: false });

    // 超过 compact 阈值的大域保持可浏览目录（#1739），且目录与画布共用
    // 类型可见性：隐藏 DomainConcept 后目录只列未隐藏类型（#1742 review）。
    const directory = container.querySelector('[data-active-authority-node-directory="visible"]');
    expect(directory).not.toBeNull();
    expect(directory?.querySelector('[data-active-authority-node="large-concept-1"]')).not.toBeNull();

    // 面板在 compact 折叠抽屉内，先展开再切换类型。
    const mobileToolsToggle = container.querySelector<HTMLButtonElement>('[data-active-authority-mobile-tools-toggle="true"]');
    await act(async () => mobileToolsToggle!.click());
    const conceptToggle = container.querySelector<HTMLButtonElement>('[data-active-authority-type-filter="DomainConcept"]');
    await act(async () => conceptToggle!.click());
    const filteredDirectory = container.querySelector('[data-active-authority-node-directory="visible"]');
    expect(filteredDirectory?.querySelector('[data-active-authority-node="large-concept-1"]')).toBeNull();
    expect(filteredDirectory?.querySelector('[data-active-authority-node="large-formula"]')).not.toBeNull();
  });

  it('keeps the compact tools drawer focus-trapped and restores focus on close', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 10)));
    await enterModelingDomain({ families: false });

    const toggle = container.querySelector<HTMLButtonElement>('[data-active-authority-mobile-tools-toggle="true"]');
    await act(async () => toggle!.click());
    const drawer = container.querySelector<HTMLElement>('[data-active-authority-mobile-drawer="true"]');
    expect(drawer).not.toBeNull();

    // Tab 循环被限制在抽屉内（trap）。
    const search = container.querySelector<HTMLInputElement>('#active-authority-search')!;
    search.focus();
    await act(async () => {
      search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    });
    expect(drawer?.contains(document.activeElement)).toBe(true);

    // Escape 关闭抽屉并把焦点还给折叠开关，不退出已选邻域（restore）。
    await act(async () => {
      document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await Promise.resolve();
    });
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
  });

  it('enters a boundary node owning domain before selecting it and loading its neighborhood', async () => {
    const crossRelation = {
      ...canvas.relations[0],
      id: 'relation-cross-domain',
      sourceId: 'node-concept',
      targetId: 'node-formula',
    };
    const sourceObject = shardObject(canvas.nodes[0]);
    const boundaryObject = shardObjectWithMemberships(canvas.nodes[1], [{
      domainId: 'frequency-domain-analysis',
      visualRole: 'frequency',
      preferred: true,
    }]);
    const crossFamily = {
      shardClass: 'relation-family' as const,
      envelope: shardEnvelope,
      domainId: 'system-modeling' as const,
      family: 'association' as const,
      objects: [sourceObject, boundaryObject],
      relations: [{ ...crossRelation, layer: 'ENGINEERING' as const, relationFamily: 'association' as const }],
      boundaries: [{
        canonicalId: 'node-formula',
        label: '特征方程',
        canonicalType: 'Formula',
        adjacentDomainIds: ['frequency-domain-analysis'] as const,
      }],
    } satisfies PublicAuthorityRelationFamilyShard;
    const crossNeighborhood = {
      ...neighborhoodShard('node-formula'),
      objects: [sourceObject, boundaryObject],
      relations: [{ ...crossRelation, layer: 'ENGINEERING' as const, relationFamily: 'association' as const }],
      boundaries: [{
        canonicalId: 'node-concept',
        label: '稳定性',
        canonicalType: 'DomainConcept',
        adjacentDomainIds: ['system-modeling'] as const,
      }],
    } satisfies PublicAuthorityNodeNeighborhoodShard;

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      const nodeId = decodeURIComponent(url.split('/').pop() ?? 'node-formula');
      if (url.endsWith('/api/knowledge/shards/active')) return mockResponse(crossDomainRootShard);
      if (url.includes('/domains/') && url.includes('/families/association')) return mockResponse(crossFamily);
      if (url.includes('/domains/frequency')) {
        return mockResponse(domainDefaultShard([canvas.nodes[1]], [], {
          domainId: 'frequency-domain-analysis',
          visualRole: 'frequency',
        }));
      }
      if (url.includes('/domains/modeling')) {
        return mockResponse(domainDefaultShard([canvas.nodes[0]], [], {
          domainId: 'system-modeling',
          visualRole: 'modeling',
        }));
      }
      if (url.includes('/neighborhoods/')) return mockResponse({ ...crossNeighborhood, nodeId });
      if (url.includes('/shards/active/nodes/')) {
        return mockResponse({
          shardClass: 'node-detail',
          envelope: shardEnvelope,
          node: {
            ...nodeDetail(nodeId).node,
            teachingFields: {},
            media: { cardAvailable: false, infographAvailable: false },
          },
        });
      }
      throw new Error(`unexpected product request ${url}`);
    });

    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain({ families: false });
    const familyButton = container.querySelector<HTMLButtonElement>('[data-authority-relation-family="association"]');
    expect(familyButton).not.toBeNull();
    await act(async () => familyButton!.click());
    await act(async () => Promise.resolve());

    expect(container.querySelector('[data-active-authority-node="node-formula"]')).toBeNull();
    const boundaryEntry = container.querySelector<HTMLButtonElement>('[data-authority-boundary-node="node-formula"]');
    expect(boundaryEntry).not.toBeNull();
    await act(async () => boundaryEntry!.click());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const requested = fetchMock.mock.calls.map(([url]) => String(url));
    const modelingIndex = requested.indexOf('/api/knowledge/shards/active/domains/modeling');
    const frequencyIndex = requested.indexOf('/api/knowledge/shards/active/domains/frequency');
    const neighborhoodIndex = requested.indexOf('/api/knowledge/shards/active/neighborhoods/node-formula');
    const detailIndex = requested.indexOf('/api/knowledge/shards/active/nodes/node-formula');
    expect(modelingIndex).toBeGreaterThanOrEqual(0);
    expect(frequencyIndex).toBeGreaterThan(modelingIndex);
    expect(neighborhoodIndex).toBeGreaterThan(frequencyIndex);
    expect(detailIndex).toBeGreaterThan(frequencyIndex);
    expect(container.querySelector('[data-active-node-detail="node-formula"]')).not.toBeNull();
    expect(container.querySelector<SVGGElement>('[data-active-authority-node="node-formula"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('does not select or load a boundary neighborhood when its owning domain fails', async () => {
    const crossRelation = {
      ...canvas.relations[0],
      id: 'relation-cross-domain-failure',
      sourceId: 'node-concept',
      targetId: 'node-formula',
    };
    const sourceObject = shardObject(canvas.nodes[0]);
    const boundaryObject = shardObjectWithMemberships(canvas.nodes[1], [{
      domainId: 'frequency-domain-analysis',
      visualRole: 'frequency',
      preferred: true,
    }]);
    const crossFamily = {
      ...familyShard('association', [crossRelation]),
      objects: [sourceObject, boundaryObject],
      boundaries: [{
        canonicalId: 'node-formula',
        label: '特征方程',
        canonicalType: 'Formula',
        adjacentDomainIds: ['frequency-domain-analysis'] as const,
      }],
    } satisfies PublicAuthorityRelationFamilyShard;

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/knowledge/shards/active')) return mockResponse(crossDomainRootShard);
      if (url.includes('/domains/') && url.includes('/families/association')) return mockResponse(crossFamily);
      if (url.includes('/domains/frequency')) return { ok: false, status: 500, json: async () => ({}) };
      if (url.includes('/domains/modeling')) return mockResponse(domainDefaultShard([canvas.nodes[0]]));
      throw new Error(`unexpected product request ${url}`);
    });

    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain({ families: false });
    const familyButton = container.querySelector<HTMLButtonElement>('[data-authority-relation-family="association"]');
    expect(familyButton).not.toBeNull();
    await act(async () => familyButton!.click());
    await act(async () => Promise.resolve());

    expect(container.querySelector('[data-active-authority-node="node-formula"]')).toBeNull();
    const boundaryEntry = container.querySelector<HTMLButtonElement>('[data-authority-boundary-node="node-formula"]');
    expect(boundaryEntry).not.toBeNull();
    await act(async () => boundaryEntry!.click());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const requested = fetchMock.mock.calls.map(([url]) => String(url));
    expect(requested).toContain('/api/knowledge/shards/active/domains/frequency');
    expect(requested.some((url) => url.includes('/neighborhoods/node-formula'))).toBe(false);
    expect(requested.some((url) => url.includes('/shards/active/nodes/node-formula'))).toBe(false);
    expect(container.querySelector('[data-active-node-detail="node-formula"]')).toBeNull();
  });

  it('restores the bounded concept overview after leaving a search-disclosed neighborhood', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      const nodeId = decodeURIComponent(url.split('/').pop() ?? 'node-concept');
      if (url.endsWith('/api/knowledge/shards/active')) {
        return { ok: true, status: 200, json: async () => rootShard };
      }
      if (url.includes('/domains/') && url.includes('/search')) {
        return {
          ok: true,
          status: 200,
          json: async () => domainSearchPayload(
            canvas.nodes.map((node) => ({ id: node.id, canonicalType: node.canonicalType, label: node.label })),
            url,
          ),
        };
      }
      if (url.includes('/domains/')) {
        // Server-bounded overview: the default carries concepts only.
        return { ok: true, status: 200, json: async () => domainDefaultShard([canvas.nodes[0]!]) };
      }
      if (url.includes('/neighborhoods/')) {
        return { ok: true, status: 200, json: async () => neighborhoodShard(nodeId) };
      }
      if (url.includes('/shards/active/nodes/')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            shardClass: 'node-detail',
            envelope: shardEnvelope,
            node: { ...nodeDetail(nodeId).node, teachingFields: {}, media: { cardAvailable: false, infographAvailable: false } },
          }),
        };
      }
      throw new Error(`unexpected product request ${url}`);
    });

    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain({ families: false });

    // Level two: only the server-bounded DomainConcept overview shows.
    expect(container.querySelector('[data-active-authority-node="node-concept"]')).not.toBeNull();
    expect(container.querySelector('[data-active-authority-node="node-formula"]')).toBeNull();

    // Level three: an undisclosed Formula arrives through bounded search and
    // its one-hop neighborhood, not through the domain default.
    const search = container.querySelector<HTMLInputElement>('#active-authority-search')!;
    await act(async () => {
      search.value = '特征';
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await settleDomainSearch();
    const result = container.querySelector<HTMLButtonElement>('[data-active-authority-search-result="node-formula"]');
    expect(result).not.toBeNull();
    await act(async () => result!.click());
    await act(async () => Promise.resolve());
    await act(async () => Promise.resolve());
    expect(container.querySelector('[data-active-authority-node="node-formula"]')).not.toBeNull();
    expect(container.querySelector('[data-active-node-detail="node-formula"]')).not.toBeNull();

    // Leaving the neighborhood restores the same overview deterministically.
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise((resolve) => window.setTimeout(resolve, 5));
    });
    expect(container.querySelector('[data-active-authority-node="node-formula"]')).toBeNull();
    expect(container.querySelector('[data-active-authority-node="node-concept"]')).not.toBeNull();
    expect(container.querySelector('[data-active-node-detail="node-formula"]')).toBeNull();
  });

  it('keeps a selected node and its real cross-type one-hop graph after a search-disclosed selection', async () => {
    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain();

    // 搜索定位是独立发现动作：选择结果披露真实一跳邻域并清空类型隐藏，
    // 避免邻域对象刚物化就被面板隐藏（#1742 解耦 search 与 type 筛选）。
    const formulaToggle = container.querySelector<HTMLButtonElement>('[data-active-authority-type-filter="Formula"]');
    await act(async () => formulaToggle!.click());
    expect(formulaToggle?.getAttribute('aria-checked')).toBe('false');
    const search = container.querySelector<HTMLInputElement>('#active-authority-search')!;
    await act(async () => {
      search.value = '稳定性';
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await settleDomainSearch();
    const result = container.querySelector<HTMLButtonElement>('[data-active-authority-search-result="node-concept"]');
    expect(result).not.toBeNull();

    await act(async () => result!.click());
    await act(async () => Promise.resolve());

    const detail = container.querySelector('[data-active-node-detail="node-concept"]');
    expect(detail).not.toBeNull();
    expect(document.activeElement).toBe(detail);
    expect(container.querySelector('[data-active-authority-node="node-concept"]')).not.toBeNull();
    expect(container.querySelector('[data-active-authority-node="node-formula"]')).not.toBeNull();
    expect(container.querySelector('[data-active-authority-node="node-model"]')).not.toBeNull();
    expect(container.querySelector('[data-active-authority-relation="relation-association"]')).not.toBeNull();
    expect(container.querySelector('[data-active-authority-relation="relation-applies"]')).not.toBeNull();
    expect(container.querySelector<HTMLButtonElement>('[data-active-authority-type-filter="Formula"]')?.getAttribute('aria-checked')).toBe('true');
  });

  it('clips edges to the target shape and only directed relations render an arrow', async () => {
    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain();

    const directed = container.querySelector('[data-active-authority-relation="relation-applies"]');
    const unordered = container.querySelector('[data-active-authority-relation="relation-association"]');
    expect(directed?.getAttribute('data-active-authority-relation-kind')).toBe('directed');
    expect(unordered?.getAttribute('data-active-authority-relation-kind')).toBe('undirected');

  });

  it('does not describe an unordered association with outgoing or incoming traversal', async () => {
    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain();
    const node = container.querySelector<SVGGElement>('[data-active-authority-node="node-concept"]');
    expect(node).not.toBeNull();
    await act(async () => node!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => Promise.resolve());
    const detail = container.querySelector('[data-active-node-detail="node-concept"]');
    expect(detail?.textContent).toContain('关联关系');
    expect(detail?.textContent).toContain('关联关系 · 特征方程');
    expect(detail?.textContent).not.toContain('出向 · 由前者指向后者 · 特征方程');
    expect(detail?.textContent).not.toContain('入向 · 由前者指向后者 · 特征方程');
  });

  it('emphasizes only real incident edges for the selected node', async () => {
    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain();
    const node = container.querySelector<SVGGElement>('[data-active-authority-node="node-formula"]');
    expect(node).not.toBeNull();
    await act(async () => node!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => Promise.resolve());

    const incident = container.querySelector<SVGGElement>('[data-active-authority-relation="relation-association"]');
    const nonIncident = container.querySelector<SVGGElement>('[data-active-authority-relation="relation-applies"]');
    expect(incident?.getAttribute('data-active-authority-relation-selected')).toBe('true');
    expect(nonIncident?.getAttribute('data-active-authority-relation-selected')).toBe('false');
    expect(incident).not.toBeNull();
    expect(nonIncident).not.toBeNull();
  });

  it('moves detail focus when selecting a second node without closing the inspector', async () => {
    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain();
    const firstNode = container.querySelector<SVGGElement>('[data-active-authority-node="node-concept"]');
    expect(firstNode).not.toBeNull();
    await act(async () => firstNode!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => Promise.resolve());
    expect(document.activeElement).toBe(container.querySelector('[data-active-node-detail="node-concept"]'));

    const secondNode = container.querySelector<SVGGElement>('[data-active-authority-node="node-formula"]');
    expect(secondNode).not.toBeNull();
    await act(async () => secondNode!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 0)));
    expect(container.querySelector('[data-active-node-detail="node-formula"]')).not.toBeNull();
    expect(document.activeElement).toBe(container.querySelector('[data-active-node-detail="node-formula"]'));
  });

  it('allows the thirteenth readable same-type search result to be selected', async () => {
    const nodes = Array.from({ length: 13 }, (_, index) => ({
      id: `search-node-${index + 1}`,
      canonicalType: 'Formula',
      label: `可读公式 ${String(index + 1).padStart(2, '0')}`,
      aliases: [],
      description: null,
      governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: 'active' },
      semanticSupport: { supported: true, readOnly: true as const },
    }));
    const searchableCanvas = {
      ...canvas,
      coverage: { ...canvas.coverage, objectCount: nodes.length, relationCount: 0, goldRelationCount: 0, silverRelationCount: 0 },
      nodes,
      relations: [],
    };
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      const nodeId = decodeURIComponent(url.split('/').pop() ?? 'search-node-1');
      if (url.endsWith('/api/knowledge/shards/active')) {
        return { ok: true, status: 200, json: async () => rootShard };
      }
      if (url.includes('/domains/') && url.includes('/search')) {
        return {
          ok: true,
          status: 200,
          json: async () => domainSearchPayload(
            nodes.map((node) => ({ id: node.id, canonicalType: node.canonicalType, label: node.label })),
            url,
          ),
        };
      }
      if (url.includes('/domains/')) {
        return { ok: true, status: 200, json: async () => domainDefaultShard(nodes) };
      }
      if (url.includes('/shards/active/nodes/') || url.includes('/neighborhoods/')) {
        return {
          ok: true,
          status: 200,
          json: async () => url.includes('/neighborhoods/')
            ? { ...neighborhoodShard(nodeId), objects: nodes.map((node) => shardObject(node)), relations: [] }
            : { shardClass: 'node-detail', envelope: shardEnvelope, node: { ...nodeDetail(nodeId).node, teachingFields: {}, media: { cardAvailable: false, infographAvailable: false } } },
        };
      }
      throw new Error(`unexpected product request ${url}`);
    });

    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain({ families: false });

    const search = container.querySelector<HTMLInputElement>('#active-authority-search')!;
    await act(async () => {
      search.value = '可读公式';
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await settleDomainSearch();
    const resultList = container.querySelector<HTMLElement>('[data-active-search-results]');
    expect(resultList?.getAttribute('data-active-search-result-total')).toBe('13');
    expect(container.querySelectorAll('[data-active-authority-search-result]').length).toBe(12);
    expect(container.textContent).toContain('已显示 12 / 13 个匹配对象');
    const loadMore = container.querySelector<HTMLButtonElement>('[data-active-authority-search-load-more]');
    expect(loadMore).not.toBeNull();
    await act(async () => loadMore!.click());
    await act(async () => Promise.resolve());
    expect(container.querySelectorAll('[data-active-authority-search-result]').length).toBe(13);
    const thirteenth = container.querySelector<HTMLButtonElement>('[data-active-authority-search-result="search-node-13"]');
    expect(thirteenth).not.toBeNull();

    await act(async () => thirteenth!.click());
    await act(async () => Promise.resolve());

    expect(container.querySelector('[data-active-authority-node="search-node-13"]')).not.toBeNull();
    expect(container.querySelector('[data-active-node-detail="search-node-13"]')).not.toBeNull();
  });

  it('keeps thousand-result search DOM bounded while exposing an explicit next page', async () => {
    const nodes = Array.from({ length: 1000 }, (_, index) => ({
      id: `thousand-node-${index + 1}`,
      canonicalType: 'Formula',
      label: `千级对象 ${String(index + 1).padStart(4, '0')}`,
      aliases: [],
      description: null,
      governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: 'active' },
      semanticSupport: { supported: true, readOnly: true as const },
    }));
    const searchableCanvas = {
      ...canvas,
      coverage: { ...canvas.coverage, objectCount: nodes.length, relationCount: 0, goldRelationCount: 0, silverRelationCount: 0 },
      nodes,
      relations: [],
    };
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/knowledge/shards/active')) {
        return { ok: true, status: 200, json: async () => rootShard };
      }
      if (url.includes('/domains/') && url.includes('/search')) {
        return {
          ok: true,
          status: 200,
          json: async () => domainSearchPayload(
            nodes.map((node) => ({ id: node.id, canonicalType: node.canonicalType, label: node.label })),
            url,
          ),
        };
      }
      if (url.includes('/domains/')) {
        return { ok: true, status: 200, json: async () => domainDefaultShard(nodes) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          shardClass: 'node-detail',
          envelope: shardEnvelope,
          node: {
            ...nodeDetail(url.split('/').pop() ?? 'thousand-node-1').node,
            teachingFields: {},
            media: { cardAvailable: false, infographAvailable: false },
          },
        }),
      };
    });

    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain({ families: false });

    const search = container.querySelector<HTMLInputElement>('#active-authority-search')!;
    await act(async () => {
      search.value = '千级对象';
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await settleDomainSearch();
    const resultList = container.querySelector<HTMLElement>('[data-active-search-results]');
    expect(resultList?.getAttribute('data-active-search-result-total')).toBe('1000');
    expect(container.querySelectorAll('[data-active-authority-search-result]').length).toBe(12);
    expect(container.querySelector('[data-active-authority-search-result="thousand-node-13"]')).toBeNull();
    const loadMore = container.querySelector<HTMLButtonElement>('[data-active-authority-search-load-more]');
    expect(loadMore?.getAttribute('aria-label')).toContain('还剩988项');

    await act(async () => loadMore!.click());
    await act(async () => Promise.resolve());
    expect(container.querySelectorAll('[data-active-authority-search-result]').length).toBe(24);
    expect(container.querySelector('[data-active-authority-search-result="thousand-node-13"]')).not.toBeNull();
  });

  it('uses a compact mobile graph coordinate space and keeps node labels readable', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 10)));
    await enterModelingDomain({ families: false });

    const canvas = container.querySelector('[data-active-authority-runtime="force-graph"]');
    expect(canvas).not.toBeNull();
    expect(container.querySelector('[data-active-authority-viewport="compact"]')).not.toBeNull();
    // 零边/Teaching 不可用不再展开可见目录；节点保持 sr-only 语义通道
    // （#1742）。mobile 大域（超 compact 上限）的可浏览目录语义不受影响。
    expect(container.querySelector('[data-active-authority-node-directory="visible"]')).toBeNull();
    expect(container.querySelector('[data-active-authority-node-directory="semantic"]')).not.toBeNull();
    expect(container.querySelector('[data-active-authority-dimension="2d"]')).not.toBeNull();
    expect(container.querySelector('[data-active-authority-header="true"]')).not.toBeNull();
    expect(container.querySelector('[data-active-authority-title="true"]')).not.toBeNull();
    expect(container.querySelector('[data-active-authority-toolbar="true"]')).not.toBeNull();
    const mobileToolsToggle = container.querySelector<HTMLButtonElement>('[data-active-authority-mobile-tools-toggle="true"]');
    expect(mobileToolsToggle?.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('#active-authority-mobile-tools')).toBeNull();

    await act(async () => mobileToolsToggle!.click());
    expect(mobileToolsToggle?.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('#active-authority-mobile-tools')).not.toBeNull();

    const association = container.querySelector<HTMLButtonElement>('[data-authority-relation-family="association"]');
    expect(association).not.toBeNull();
    await act(async () => association!.click());
    await act(async () => Promise.resolve());
    expect(container.querySelector('[data-active-authority-relation]')).not.toBeNull();
    expect(container.querySelectorAll('[data-active-authority-node]').length).toBeLessThanOrEqual(6);

    const graphSource = readFileSync(path.join(process.cwd(), 'src/features/knowledge/active-authority-graph.tsx'), 'utf8');
    const workspaceSource = readFileSync(path.join(process.cwd(), 'src/features/knowledge/knowledge-graph-workspace.tsx'), 'utf8');
    // #1742 review：工具栏避让（pt-12/pt-14）由 workspace chrome 行统一承担。
    expect(workspaceSource).toContain('pt-12 max-[639px]:pt-14');
    expect(graphSource).toContain('max-[639px]:flex-nowrap');
    expect(graphSource).toContain('max-[639px]:overflow-x-auto');
    expect(graphSource).toContain('selectInitialPrimaryDomainScope(model, visibleNodeLimit)');
    expect(graphSource).toContain('expandActiveAuthorityOneHop(model, current, disclosedRelation.sourceKey, visibleNodeLimit)');
    expect(graphSource).toContain('materializeActiveNodeScope(model, selectedNodeKey, visibleNodeLimit)');
    const runtimeViewSource = readFileSync(path.join(process.cwd(), 'src/features/knowledge/active-authority-runtime-view.tsx'), 'utf8');
    expect(runtimeViewSource).toContain('labelPriority: compactLabelPriority');
  });

  it('keeps a semantic node click selectable after pointerdown on the node', async () => {
    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'student', candidateAllowed: false, controlledVerification: false, legacy: null,
    })));
    await act(async () => Promise.resolve());
    await enterModelingDomain();

    const node = container.querySelector<SVGGElement>('[data-active-authority-node="node-formula"]');
    expect(node).not.toBeNull();
    await act(async () => {
      node!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      node!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await act(async () => Promise.resolve());

    expect(container.querySelector('[data-active-node-detail="node-formula"]')).not.toBeNull();
    const requested = fetchMock.mock.calls.map(([url]) => String(url));
    expect(requested[0]).toBe('/api/knowledge/shards/active');
    expect(requested).toContain('/api/knowledge/shards/active/nodes/node-formula');
    expect(requested.some((url) => url.includes('/graph/active'))).toBe(false);
  });

  it('shows candidate only as an explicit administrator diagnostic', async () => {
    await act(async () => root.render(createElement(KnowledgeGraphWorkspace, {
      viewerRole: 'admin', candidateAllowed: true, controlledVerification: true, legacy: null,
    })));
    await act(async () => Promise.resolve());
    expect(container.querySelector('[data-active-authority-graph="true"]')).not.toBeNull();
    expect(container.textContent).toContain('受控候选诊断');
    const modeSwitch = container.querySelector<HTMLElement>('[data-knowledge-mode-switch="true"]');
    expect(modeSwitch).not.toBeNull();
    expect(modeSwitch?.className).toContain('max-[639px]:flex-nowrap');
    expect(modeSwitch?.className).toContain('max-[639px]:overflow-x-auto');
    const modeButtons = [...container.querySelectorAll<HTMLButtonElement>('[data-knowledge-mode]')];
    expect(modeButtons).toHaveLength(3);
    expect(modeButtons.every((button) => button.className.includes('shrink-0') && button.className.includes('whitespace-nowrap'))).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('/api/knowledge/shards/active', expect.any(Object));
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes('/graph/active'))).toBe(true);
  });

  it('keeps the active component browser-safe and free of server or Legacy resolver imports', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/features/knowledge/active-authority-graph.tsx'), 'utf8');
    const presentationSource = readFileSync(path.join(process.cwd(), 'src/features/knowledge/active-authority-presentation.ts'), 'utf8');
    const captureSource = readFileSync(path.join(process.cwd(), 'scripts/tests/capture-knowledge-workspace-product-qa.ts'), 'utf8');
    expect(source).not.toMatch(/from ['"][^'"]*(authoritative-knowledge|layered-graph|activation-store|resolver|knowledge-graph-system|knowledge-graph-2d|knowledge-graph-3d)/u);
    expect(presentationSource).not.toMatch(/from ['"][^'"]*(authoritative-knowledge|layered-graph|activation-store|resolver|knowledge-graph-system|knowledge-graph-2d|knowledge-graph-3d)/u);
    expect(source).not.toContain('node:fs');
    expect(presentationSource).not.toContain('node:fs');
    expect(captureSource).toContain('source.releaseSetId === authorityRecord.releaseSetId');
    expect(captureSource).toContain('source.releaseId === authorityRecord.releaseId');
    expect(captureSource).toContain("'src/lib/authority-domain-shards/labels.ts'");
    expect(captureSource).toContain("'/api/knowledge/shards/active/nodes/:node'");
    expect(captureSource).toContain("'/api/knowledge/nodes/:node'");
    expect(captureSource).toContain("if (method !== 'GET') return null;");
    expect(captureSource).toContain("if (!encodedNodeKey || encodedNodeKey.includes('/')) return null;");
    expect(captureSource).toContain("page.on('response', onResponse)");
    expect(captureSource).toContain('createKnowledgeApiProbe');
    expect(captureSource).toContain("page.off('response', onResponse)");
    expect(captureSource).toContain("unknown Knowledge API endpoint observed");
    expect(captureSource).not.toContain('__ACT_KNOWLEDGE_PRODUCT_QA_API__');
    expect(captureSource).not.toContain('__ACT_KNOWLEDGE_PRODUCT_QA_ACTIVE_IDENTITY_TOKENS__');
    expect(captureSource).not.toContain('window.fetch =');
    expect(captureSource).toContain('safe-api-evidence/v1');
    expect(captureSource).toContain('function projectSafeApiEvidence');
    expect(captureSource).toContain('function assertSafeApiEvidenceV1');
    expect(captureSource).toContain('type SensitiveValueMatcher');
    expect(captureSource).toContain('createSensitiveValueMatcher');
    expect(captureSource).toContain('createSensitiveValueMatcher(await readActiveSurfaceIdentityTokens(page, probe))');
    expect(captureSource).toContain('createSensitiveValueMatcher(sensitiveTokens)');
    expect(captureSource).toContain('.split(/\\\\s+/u)');
    expect(captureSource).not.toContain('.split(/\\s+/u)');
    expect(captureSource).not.toContain('const tokenVariants = (token: string) =>');
    expect(captureSource).toContain("throw new Error('unknown Knowledge API endpoint cannot be projected')");
    expect(captureSource).not.toContain('cannot be projected: ${pathName}');
    expect(captureSource).toContain('encodeURIComponent(token)');
    expect(captureSource).toContain('decodeURIComponent(token)');
    expect(captureSource).toContain('matchesJsonText');
    expect(captureSource).toContain('sensitiveMatcher.matches(value)');
    expect(captureSource).toContain("['aria-label', 'aria-description', 'title', 'data-tooltip', 'data-tooltip-content']");
    expect(captureSource).toContain('__ACT_KNOWLEDGE_PRODUCT_QA_COPY_PAYLOADS__');
    expect(captureSource).toContain('requestCount');
    expect(captureSource).toContain('forbiddenDataAbsent');
    expect(captureSource).toContain('activeNodeRequestObserved');
    expect(captureSource).toContain('expectedActiveNodeKey');
    expect(captureSource).toContain('activeNodeIdentityMatches');
    expect(captureSource).toContain("await probe.waitForPath('/api/knowledge/shards/active/nodes/:node');");
    expect(captureSource).toContain('provenanceIntegrityMatches');
    const maliciousOpaqueId = 'node/opaque-id?raw=1';
    expect(encodeURIComponent(maliciousOpaqueId)).toContain('%2F');
    expect(captureSource).toContain('dynamic server token');
    const rawLocatorAndEnum = 'sourceLocator future_internal_predicate';
    expect(rawLocatorAndEnum).toContain('sourceLocator');
    expect(rawLocatorAndEnum).toContain('future_internal_predicate');
    const governanceSource = readFileSync(path.join(process.cwd(), 'scripts/tests/test-commercial-ui-governance.ts'), 'utf8');
    expect(governanceSource).toContain('function parseSafeApiEvidenceV1');
    expect(governanceSource).toContain('exactKeys(record');
    expect(governanceSource).toContain('safeApiSequenceEntry');
    expect(governanceSource).toContain('safeApiHasHealthyActiveIsolation');
    expect(governanceSource).toContain('safeActiveSurfaceScanPassed');
    expect(captureSource).toContain('semanticNodeFocusedBeforeClick');
    expect(captureSource).toContain('if (!pathName.startsWith(prefix)) return null;');
    expect(captureSource).toContain('detailPanelFocusedAfterOpen');
    expect(captureSource).toContain('nodeLabelReadability');
    expect(captureSource).toContain('data-knowledge-2d-dom-label-layer');
    expect(captureSource).toContain('minPixelSize');
    expect(captureSource).toContain('activeNodeLabelGeometryValid');
    expect(captureSource).toContain('nodeGeometryWithinSvgCount');
    expect(captureSource).toContain('relationGeometryWithinSvgCount');
    expect(captureSource).toContain('activeSvgGeometryRectValid');
    expect(captureSource).toContain('rectWithinActiveSvg');
    expect(captureSource).toContain("state.name === 'active-mobile'");
    expect(captureSource).toContain('titleControlsOverlap');
    expect(captureSource).toContain('nodeGeometryWithinViewportCount');
    expect(captureSource).toContain('MIN_ACTIVE_MOBILE_VIEWPORT_CANVAS_HEIGHT');
    expect(captureSource).toContain('MIN_ACTIVE_MOBILE_VIEWPORT_CANVAS_PAINT_PIXELS');
    expect(captureSource).toContain('rendererViewportVisibleHeight');
    expect(captureSource).toContain('rendererVisiblePaintPixelCount');
    expect(captureSource).toContain('nodeLabelsReadable');
    expect(captureSource).toContain('mobileToolsExpanded');
    expect(captureSource).toContain('active mobile first-viewport geometry contract failed');
    expect(captureSource).toContain('active mobile first-viewport geometry contract failed in role:${role}');
    expect(captureSource).toContain('firstViewport: {');
    const workspaceSource = readFileSync(path.join(process.cwd(), 'src/features/knowledge/knowledge-graph-workspace.tsx'), 'utf8');
    expect(workspaceSource).toContain('data-knowledge-mode-switch="true"');
    expect(workspaceSource).toContain('max-[639px]:overflow-x-auto');
    expect(workspaceSource).toContain('shrink-0 whitespace-nowrap');
    expect(workspaceSource).not.toMatch(/selector|learning.?state|current\.json/iu);
    const activeGraphSource = readFileSync(path.join(process.cwd(), 'src/features/knowledge/active-authority-graph.tsx'), 'utf8');
    expect(activeGraphSource).toContain('data-active-authority-boundary-toggle="true"');
    expect(activeGraphSource).toContain('boundaryDirectoryExpanded');
    expect(activeGraphSource).toContain('data-active-authority-mobile-tools-toggle="true"');
    expect(activeGraphSource).toContain('mobileGraphControlsExpanded');
    expect(governanceSource).toContain('initial-controls-not-collapsed');
  });

  it('fails closed before slicing unrelated Knowledge API paths', () => {
    const captureSource = readFileSync(path.join(process.cwd(), 'scripts/tests/capture-knowledge-workspace-product-qa.ts'), 'utf8');
    const helperStart = captureSource.indexOf('function canonicalAuthorityShardPath');
    const guardOffset = captureSource.indexOf('if (!pathName.startsWith(prefix)) return null;', helperStart);
    const sliceOffset = captureSource.indexOf("const segments = pathName.slice(prefix.length).split('/');", helperStart);
    expect(helperStart).toBeGreaterThanOrEqual(0);
    expect(guardOffset).toBeGreaterThan(helperStart);
    expect(sliceOffset).toBeGreaterThan(guardOffset);
    expect(captureSource).toContain("if (pathName === '/api/knowledge/shards/active')");
    expect(captureSource).toContain("'/api/knowledge/shards/active/nodes/:node'");
    expect(captureSource).toContain("if (pathName.startsWith('/api/knowledge/nodes/v2')) return null;");
  });

  it('uses endpoint-specific source identity requirements for active API evidence', () => {
    const captureSource = readFileSync(path.join(process.cwd(), 'scripts/tests/capture-knowledge-workspace-product-qa.ts'), 'utf8');
    expect(captureSource).toContain('const shardEnvelopeValid = isActiveShardResponse');
    expect(captureSource).toContain("shardEnvelope.contract === 'act-authority-shard-envelope/v1'");
    expect(captureSource).toContain('typeof shardEnvelope.authorityCatalogVersion === \'string\'');
    expect(captureSource).toContain('typeof shardEnvelope.teachingVersion === \'string\'');
    expect(captureSource).toContain('objectRecord(shardEnvelope.match).authority === true');
    expect(captureSource).toContain('objectRecord(shardEnvelope.match).catalog === true');
    expect(captureSource).toContain('isActiveShardResponse ? shardEnvelopeValid');
  });

  it('accepts only the exact safe API evidence schema and rejects opaque leakage', () => {
    const safeEvidence = {
      schemaVersion: 'safe-api-evidence/v1',
      roleClass: 'student',
      sequence: [{ endpointClass: 'active-canvas', status: 200, requestCount: 1 }],
      checks: {
        activeNodeRequestObserved: false,
        activeCanvasIdentityVerified: true,
        activeNodeIdentityVerified: false,
        provenanceIdentityVerified: true,
        roleRequestIsolationVerified: true,
        forbiddenDataAbsent: true,
      },
    } as const;
    expect(parseSafeApiEvidenceV1(safeEvidence)).toEqual(safeEvidence);
    expect(parseSafeApiEvidenceV1({
      ...safeEvidence,
      checks: { ...safeEvidence.checks, activeNodeRequestObserved: true, activeNodeIdentityVerified: false },
      sequence: [
        { endpointClass: 'active-canvas', status: 200, requestCount: 1 },
        { endpointClass: 'active-node', status: 500, requestCount: 1 },
      ],
    })).toBeDefined();
    expect(parseSafeApiEvidenceV1({
      ...safeEvidence,
      checks: { ...safeEvidence.checks, activeNodeRequestObserved: true, activeNodeIdentityVerified: true },
      sequence: [
        { endpointClass: 'active-canvas', status: 200, requestCount: 1 },
        { endpointClass: 'active-node', status: 200, requestCount: 1 },
      ],
    })).toBeDefined();
    expect(parseSafeApiEvidenceV1({
      ...safeEvidence,
      checks: { ...safeEvidence.checks, activeNodeRequestObserved: false, activeNodeIdentityVerified: true },
    })).toBeUndefined();
    expect(parseSafeApiEvidenceV1({
      ...safeEvidence,
      checks: { ...safeEvidence.checks, activeNodeRequestObserved: true, activeNodeIdentityVerified: false },
      sequence: [
        { endpointClass: 'active-canvas', status: 200, requestCount: 1 },
        { endpointClass: 'active-node', status: 500, requestCount: 1 },
      ],
    })).toBeDefined();
    expect(parseSafeApiEvidenceV1({
      ...safeEvidence,
      sequence: [
        { endpointClass: 'active-canvas', status: 200, requestCount: 1 },
        { endpointClass: 'active-node', status: 200, requestCount: 1 },
      ],
    })).toBeUndefined();
    const responsiveDetailArtifact = parseSafeApiEvidenceV1({
      ...safeEvidence,
      checks: {
        ...safeEvidence.checks,
        activeNodeRequestObserved: true,
        activeNodeIdentityVerified: true,
      },
      sequence: [
        { endpointClass: 'active-canvas', status: 200, requestCount: 1 },
        { endpointClass: 'active-node', status: 200, requestCount: 1 },
      ],
    });
    expect(safeApiHasResponsiveNoActiveNode(responsiveDetailArtifact)).toBe(false);
    expect(safeApiHasResponsiveNoActiveNode(parseSafeApiEvidenceV1(safeEvidence))).toBe(true);
    expect(parseSafeApiEvidenceV1({ ...safeEvidence, opaqueNodeId: 'node/secret?raw=1' })).toBeUndefined();
    expect(parseSafeApiEvidenceV1({
      ...safeEvidence,
      opaqueNodeId: encodeURIComponent('node/secret?raw=1'),
    })).toBeUndefined();
    expect(parseSafeApiEvidenceV1({
      ...safeEvidence,
      sequence: [{ endpointClass: 'unknown-endpoint', status: 200, requestCount: 1 }],
    })).toBeUndefined();
    expect(parseSafeApiEvidenceV1({
      ...safeEvidence,
      checks: { ...safeEvidence.checks, sourceLocator: 'internal/section' },
    })).toBeUndefined();
  });
});
