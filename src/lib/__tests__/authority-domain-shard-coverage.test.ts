/**
 * Three-level Authority shard denominator and bounded overview (#1738).
 *
 * The visible-domain denominator is the exact active catalog — never the
 * historical REGISTERED_PEER_DOMAIN_IDS constant — and every domain default
 * is a bounded DomainConcept overview whose secondary members stay reachable
 * only through the sealed search index and one-hop/detail closure.
 */

import { mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  REGISTERED_PEER_DOMAIN_IDS,
  buildAuthorityDomainCatalog,
  type AuthorityDomainCatalogAuthoring,
} from '@/lib/authority-domain-catalog';
import {
  AUTHORITY_DOMAIN_DEFAULT_OBJECT_LIMIT,
  AUTHORITY_DOMAIN_DEFAULT_TYPES,
  AUTHORITY_SHARD_ENVELOPE_CONTRACT,
  AUTHORITY_SHARD_PAYLOAD_BUDGETS,
  buildAuthorityDomainShards,
  createTeachingOverlay,
  loadDomainDefaultShard,
  loadDomainSearchIndexShard,
  loadNodeDetailShard,
  loadNodeNeighborhoodShard,
  loadRootShard,
  loadShardSetCoverage,
  projectAuthorityLearnerShard,
  shardDigest,
  shardSha256,
  stageAuthorityDomainShards,
  teachingCoverageFromState,
  writeAuthorityDomainShards,
  type AuthorityShardEnvelope,
  type AuthorityDomainSearchEntry,
} from '@/lib/authority-domain-shards';
import type { AuthorityEngineeringBody } from '@/lib/authoritative-knowledge/authority-snapshot';
import type { AuthoritativeV2Evidence } from '@/lib/authoritative-knowledge/contracts';
import {
  createEmptyAuthorityShardWorkspace,
  mergeAuthorityShard,
  resetAuthorityShardDomain,
} from '@/features/knowledge/active-authority-shard-store';
import {
  selectAuthorityDomainOverviewScope,
  createActiveAuthorityGraphModel,
} from '@/features/knowledge/active-authority-presentation';

const SNAPSHOT_HASH = 'a'.repeat(64);
const SNAPSHOT_ID = `snap-${SNAPSHOT_HASH}`;
const RELEASE_ID = 'ctr:release:test-coverage';
const RELEASE_SET_ID = 'release-set-test-coverage';
const CATALOG_ID = 'adc-test-coverage';

// A v0.37 domain that is NOT part of the historical eight-domain constant.
const NONLINEAR_DOMAIN = 'nonlinear-system-analysis';
const MODELING = 'ctc:modeling-concept';
const MODELING_FORMULA = 'ctc:modeling-formula';
const MODELING_STATEMENT = 'ctc:modeling-statement';
const MODELING_MODEL = 'ctc:modeling-system-model';
const MODELING_REPRESENTATION = 'ctc:modeling-representation';
const NONLINEAR_CONCEPT = 'ctc:nonlinear-concept';
const NONLINEAR_FORMULA = 'ctc:nonlinear-formula';
const EXTERNAL_NEIGHBOR = 'ctc:external-neighbor';

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

function envelopeFor(catalog: { catalogId: string; catalogHash: string; catalogVersion: string }): AuthorityShardEnvelope {
  return {
    contract: AUTHORITY_SHARD_ENVELOPE_CONTRACT,
    authority: {
      snapshotId: SNAPSHOT_ID,
      snapshotHash: SNAPSHOT_HASH,
      releaseId: RELEASE_ID,
      releaseSetId: RELEASE_SET_ID,
      activationId: 'activation-test-coverage',
      activationHash: 'b'.repeat(64),
      projectionId: null,
      projectionHash: null,
    },
    catalog: {
      catalogId: catalog.catalogId,
      catalogHash: catalog.catalogHash,
      catalogVersion: catalog.catalogVersion,
    },
    teaching: {
      status: 'unavailable',
      projectionId: null,
      projectionHash: null,
      teachingCacheFamily: null,
    },
    match: { authority: true, catalog: true, teaching: null },
  };
}

function objectRow(
  canonicalId: string,
  canonicalType: string,
  label: string,
) {
  return {
    canonicalId,
    ordinal: 1,
    canonicalType,
    semanticName: label,
    reviewStatus: 'approved',
    publicationStatus: 'published',
    lifecycleStatus: 'active',
    payload: { displayName: label, description: `${label}描述` },
  };
}

function relationRow(
  relationId: string,
  relationType: string,
  sourceId: string,
  targetId: string,
) {
  return {
    relationId,
    ordinal: 1,
    qualityTier: 'GOLD',
    sourceId,
    targetId,
    relationType,
    reviewStatus: 'approved',
    publicationStatus: 'published',
    direct: true,
    payload: { direction: 'source_to_target' },
  };
}

function coverageCatalog() {
  const domains = [
    { domainId: 'system-modeling', order: 1, displayName: '系统建模', summary: '建模概览', presentationRole: 'domain' as const, visualRole: 'modeling' as const },
    { domainId: NONLINEAR_DOMAIN, order: 2, displayName: '非线性系统分析', summary: '非线性概览', presentationRole: 'domain' as const, visualRole: 'nonlinear-analysis' as const },
    { domainId: 'time-domain-analysis', order: 3, displayName: '时域分析', summary: '时域概览', presentationRole: 'domain' as const, visualRole: 'time' as const },
  ];
  const authoring: AuthorityDomainCatalogAuthoring = {
    contract: 'act-authority-domain-display-catalog-authoring/v1',
    catalogVersion: '1.0.0-coverage-test',
    reviewStatus: 'reviewed',
    authorityBinding: {
      snapshotId: SNAPSHOT_ID,
      snapshotHash: SNAPSHOT_HASH,
      releaseId: RELEASE_ID,
      releaseSetId: RELEASE_SET_ID,
    },
    domains,
    aggregate: {
      entryId: 'control-theory-integration',
      order: 0,
      displayName: '综合',
      summary: '汇总',
      presentationRole: 'aggregate',
      visualRole: 'aggregate',
    },
    memberships: [
      { canonicalId: MODELING, domainIds: ['system-modeling'], preferredDomainId: 'system-modeling' },
      { canonicalId: MODELING_FORMULA, domainIds: ['system-modeling'], preferredDomainId: 'system-modeling' },
      { canonicalId: MODELING_STATEMENT, domainIds: ['system-modeling'], preferredDomainId: 'system-modeling' },
      { canonicalId: MODELING_MODEL, domainIds: ['system-modeling'], preferredDomainId: 'system-modeling' },
      { canonicalId: MODELING_REPRESENTATION, domainIds: ['system-modeling'], preferredDomainId: 'system-modeling' },
      { canonicalId: NONLINEAR_CONCEPT, domainIds: [NONLINEAR_DOMAIN], preferredDomainId: NONLINEAR_DOMAIN },
      { canonicalId: NONLINEAR_FORMULA, domainIds: [NONLINEAR_DOMAIN], preferredDomainId: NONLINEAR_DOMAIN },
    ],
  };
  const memberCounts = [
    { canonicalId: MODELING },
    { canonicalId: MODELING_FORMULA },
    { canonicalId: MODELING_STATEMENT },
    { canonicalId: MODELING_MODEL },
    { canonicalId: MODELING_REPRESENTATION },
    { canonicalId: NONLINEAR_CONCEPT },
    { canonicalId: NONLINEAR_FORMULA },
  ];
  return buildAuthorityDomainCatalog(authoring, memberCounts);
}

function v2EvidenceLabels(): AuthoritativeV2Evidence {
  const entities = [
    [MODELING, '系统建模'],
    [MODELING_FORMULA, 'G(s)=1/s'],
    [MODELING_STATEMENT, '建模陈述'],
    [MODELING_MODEL, '闭环模型'],
    [MODELING_REPRESENTATION, '框图表示'],
    [NONLINEAR_CONCEPT, '非线性概念'],
    [NONLINEAR_FORMULA, '\\dot{x}=Ax+Bu'],
    [EXTERNAL_NEIGHBOR, '外部邻域对象'],
  ] as const;
  return {
    protocol: 'actkg-public-bundle/2',
    profiles: [
      {
        releaseId: RELEASE_ID,
        profileKey: 'act',
        manifestProfile: 'runtime',
        projectionKind: 'act_runtime_graph',
        profileId: 'act-profile',
        profileSha256: 'd'.repeat(64),
        profileVersion: 'v1',
        mappingContractVersion: 'actkg-map/v2',
        aggregationPolicy: 'preserve-all',
        payload: { profileKey: 'act' },
      },
    ],
    multilingualLabels: entities.map(([entityId, label], ordinal) => ({
      releaseId: RELEASE_ID,
      ordinal,
      entityId,
      language: 'zh-CN',
      label,
      labelType: 'canonical_preferred' as const,
      terminologyAssertionId: `term-${ordinal}`,
      payload: {},
    })),
    admissionBinding: {
      releaseId: RELEASE_ID,
      bundleReceiptId: 'bundle-receipt:coverage-test',
      protocol: 'actkg-public-bundle/2',
      provenance: 'registry',
      verificationScope: 'admission-time',
      verifiedDuringLoad: false,
      registryIdentity: {},
      upstreamRepository: {},
      publicationRevision: {},
      sourceRevision: {},
      bundleIdentity: {},
      bindingDigest: 'e'.repeat(64),
    },
  };
}

function coverageEngineering(): AuthorityEngineeringBody {
  return {
    objects: [
      objectRow(MODELING, 'DomainConcept', '系统建模'),
      objectRow(MODELING_FORMULA, 'Formula', 'G(s)=1/s'),
      objectRow(MODELING_STATEMENT, 'KnowledgeStatement', '建模陈述'),
      objectRow(MODELING_MODEL, 'SystemModel', '闭环模型'),
      objectRow(MODELING_REPRESENTATION, 'ModelRepresentation', '框图表示'),
      objectRow(NONLINEAR_CONCEPT, 'DomainConcept', '非线性概念'),
      objectRow(NONLINEAR_FORMULA, 'Formula', '\\dot{x}=Ax+Bu'),
      objectRow(EXTERNAL_NEIGHBOR, 'DomainConcept', '外部邻域对象'),
    ],
    relations: [
      relationRow('rel-has-formula', 'has_formula', MODELING, MODELING_FORMULA),
      relationRow('rel-has-model', 'has_component', MODELING, MODELING_MODEL),
      relationRow('rel-is-a', 'is_a', NONLINEAR_CONCEPT, EXTERNAL_NEIGHBOR),
    ],
    sourceMappings: [],
    sourceObjects: [],
    evidence: [],
    releaseEntries: [],
    upstreamRagReferences: [],
    releaseComponents: [],
    projectionIdentities: [],
    linkMetadata: [],
    v2Evidence: v2EvidenceLabels(),
  };
}

function materializeCoverage() {
  const catalog = coverageCatalog();
  return buildAuthorityDomainShards({
    envelope: envelopeFor(catalog),
    catalog,
    engineering: coverageEngineering(),
    teaching: createTeachingOverlay(null, {
      coverageByDomain: {
        'system-modeling': teachingCoverageFromState('system-modeling', 'partial'),
      },
    }),
    activatedAt: '2026-08-31T00:00:00.000Z',
  });
}

function writeCoverageShards() {
  const root = mkdtempSync(path.join(tmpdir(), 'act-authority-coverage-'));
  tempRoots.push(root);
  const shardPaths = {
    runtimeRoot: root,
    currentPath: path.join(root, 'current.json'),
    setsDir: path.join(root, 'sets'),
  };
  const catalog = coverageCatalog();
  const materialized = buildAuthorityDomainShards({
    envelope: envelopeFor(catalog),
    catalog,
    engineering: coverageEngineering(),
    teaching: createTeachingOverlay(null, {
      coverageByDomain: {
        'system-modeling': teachingCoverageFromState('system-modeling', 'partial'),
      },
    }),
    activatedAt: '2026-08-31T00:00:00.000Z',
  });
  writeAuthorityDomainShards(shardPaths, materialized);
  return { shardPaths, materialized, catalog };
}

describe('three-level authority shard denominator (#1738)', () => {
  it('derives the domain denominator from the exact active catalog, not the historical constant', () => {
    const materialized = materializeCoverage();
    expect(REGISTERED_PEER_DOMAIN_IDS).not.toContain(NONLINEAR_DOMAIN);
    expect(materialized.manifest.counts.domainDefault).toBe(3);
    expect(materialized.manifest.counts.searchIndex).toBe(3);
    expect(Object.keys(materialized.domainDefaults).sort()).toEqual(
      [NONLINEAR_DOMAIN, 'system-modeling', 'time-domain-analysis'].sort(),
    );
    expect(materialized.domainDefaults[NONLINEAR_DOMAIN].objects.map((row) => row.id)).toEqual([
      NONLINEAR_CONCEPT,
    ]);
    expect(materialized.root.root.domains).toHaveLength(3);
    expect(materialized.coverage.catalogDomainCount).toBe(3);
    expect(materialized.coverage.defaultShardCount).toBe(3);
  });

  it('keeps the domain default a bounded DomainConcept-only overview', () => {
    const materialized = materializeCoverage();
    const modeling = materialized.domainDefaults['system-modeling'];
    expect(modeling.objects.map((row) => row.id)).toEqual([MODELING]);
    expect(modeling.objects.every((row) => (
      (AUTHORITY_DOMAIN_DEFAULT_TYPES as readonly string[]).includes(row.canonicalType)
    ))).toBe(true);
    for (const secondary of [MODELING_FORMULA, MODELING_STATEMENT, MODELING_MODEL, MODELING_REPRESENTATION]) {
      expect(modeling.objects.map((row) => row.id)).not.toContain(secondary);
    }
    expect(modeling.objects.length).toBeLessThanOrEqual(AUTHORITY_DOMAIN_DEFAULT_OBJECT_LIMIT);
    const bytes = Buffer.byteLength(`${JSON.stringify(modeling)}\n`);
    expect(bytes).toBeLessThan(AUTHORITY_SHARD_PAYLOAD_BUDGETS['domain-default']);
    expect(materialized.coverage.domains.find((row) => row.domainId === 'system-modeling'))
      .toMatchObject({
        catalogMemberCount: 5,
        overviewObjectCount: 1,
        overviewTypes: ['DomainConcept'],
        searchEntryCount: 5,
      });
  });

  it('keeps teaching relations in the overview only between overview members', () => {
    const published = materializeCoverage();
    // The default carries no teaching edge pointing at a secondary endpoint;
    // such endpoints are disclosed only at the selected node level.
    for (const domain of Object.values(published.domainDefaults)) {
      const overviewIds = new Set(domain.objects.map((object) => object.id));
      for (const relation of domain.teachingRelations) {
        expect(overviewIds.has(relation.sourceId)).toBe(true);
        expect(overviewIds.has(relation.targetId)).toBe(true);
      }
    }
  });

  it('seals one identity-safe search index row for every member including secondary types', () => {
    const materialized = materializeCoverage();
    const index = materialized.searchIndexes['system-modeling'];
    expect(index.entries.map((row) => row.id).sort()).toEqual([
      MODELING,
      MODELING_FORMULA,
      MODELING_MODEL,
      MODELING_REPRESENTATION,
      MODELING_STATEMENT,
    ].sort());
    const types = new Set(index.entries.map((row: AuthorityDomainSearchEntry) => row.canonicalType));
    expect(types).toEqual(new Set([
      'DomainConcept',
      'Formula',
      'KnowledgeStatement',
      'SystemModel',
      'ModelRepresentation',
    ]));
    for (const entry of index.entries) {
      const record = entry as unknown as Record<string, unknown>;
      expect(record.description).toBeUndefined();
      expect(record.payload).toBeUndefined();
    }
    const bytes = Buffer.byteLength(`${JSON.stringify(index)}\n`);
    expect(bytes).toBeLessThan(AUTHORITY_SHARD_PAYLOAD_BUDGETS['domain-search-index']);
  });

  it('closes every member with a neighborhood and detail shard under one receipt', () => {
    const materialized = materializeCoverage();
    expect(materialized.coverage.closure.complete).toBe(true);
    for (const id of [MODELING, MODELING_FORMULA, MODELING_STATEMENT, MODELING_MODEL, MODELING_REPRESENTATION, NONLINEAR_CONCEPT, NONLINEAR_FORMULA]) {
      expect(materialized.neighborhoods[id]).toBeDefined();
      expect(materialized.details[id]).toBeDefined();
    }
    expect(materialized.manifest.counts.coverage).toBe(1);
  });

  it('fails qualification on duplicate or non-peer catalog domains', () => {
    // Defense-in-depth: the catalog builder validates first, but the
    // materializer must still fail closed on a runtime catalog whose
    // denominator contains a duplicate or non-peer domain entry.
    const base = coverageCatalog();
    const engineering = coverageEngineering();
    const duplicated = {
      ...base,
      domains: [...base.domains, base.domains[1]!],
    };
    expect(() => buildAuthorityDomainShards({
      envelope: envelopeFor(duplicated),
      catalog: duplicated,
      engineering,
    })).toThrow(/declared more than once/u);
    const invalid = {
      ...base,
      domains: [...base.domains, {
        ...base.domains[1]!,
        domainId: 'control-theory-integration',
      }],
    };
    expect(() => buildAuthorityDomainShards({
      envelope: envelopeFor(invalid),
      catalog: invalid,
      engineering,
    })).toThrow(/not a registered peer domain/u);
  });

  it('fails qualification when a domain overview exceeds the explicit object budget', () => {
    const base = coverageCatalog();
    const overflowIds = Array.from(
      { length: AUTHORITY_DOMAIN_DEFAULT_OBJECT_LIMIT + 1 },
      (_, index) => `${NONLINEAR_DOMAIN}-concept-${index}`,
    );
    const overflowed = {
      ...base,
      memberships: [
        ...base.memberships,
        ...overflowIds.map((canonicalId) => ({
          canonicalId,
          domainIds: [NONLINEAR_DOMAIN],
          preferredDomainId: NONLINEAR_DOMAIN,
        })),
      ],
    };
    const engineering = coverageEngineering();
    engineering.objects.push(
      ...overflowIds.map((id, index) => objectRow(id, 'DomainConcept', `概念${index}`)),
    );
    expect(() => buildAuthorityDomainShards({
      envelope: envelopeFor(overflowed),
      catalog: overflowed,
      engineering,
    })).toThrow(/exceeds the explicit object budget/u);
  });

  it('loads the search index and coverage receipt through the sealed loader', () => {
    const { shardPaths, materialized, catalog } = writeCoverageShards();
    const options = {
      shardPaths,
      identity: {
        envelope: envelopeFor(catalog),
        catalog,
        teachingPointer: null,
      },
    };
    const index = loadDomainSearchIndexShard(NONLINEAR_DOMAIN, options);
    expect(index.domainId).toBe(NONLINEAR_DOMAIN);
    expect(index.entries.map((row) => row.id)).toContain(NONLINEAR_FORMULA);
    const coverage = loadShardSetCoverage(options);
    expect(coverage.catalogDomainCount).toBe(3);
    const root = loadRootShard(options);
    expect(root.root.domains).toHaveLength(3);
    const domain = loadDomainDefaultShard(NONLINEAR_DOMAIN, options);
    expect(domain.objects.map((row) => row.id)).toEqual([NONLINEAR_CONCEPT]);
  });

  it('fails closed when the coverage receipt does not close the catalog denominator', () => {
    const { shardPaths, materialized, catalog } = writeCoverageShards();
    const setDir = path.join(shardPaths.setsDir, materialized.manifest.shardSetId);
    const coveragePath = path.join(setDir, 'coverage.json');
    const doctored = {
      ...materialized.coverage,
      defaultShardCount: 2,
    };
    writeFileSync(coveragePath, `${JSON.stringify(doctored, null, 2)}\n`, 'utf8');
    const manifestPath = path.join(setDir, 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as typeof materialized.manifest;
    const files = {
      ...manifest.files,
      'coverage.json': shardSha256(`${JSON.stringify(doctored, null, 2)}\n`),
    };
    const shardSetHash = shardDigest({ envelope: manifest.envelope, files });
    const nextManifest = {
      ...manifest,
      files,
      shardSetHash,
      shardSetId: `ads-${shardSetHash}`,
    };
    writeFileSync(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');
    writeFileSync(
      shardPaths.currentPath,
      `${JSON.stringify({ ...materialized.pointer, shardSetId: nextManifest.shardSetId, shardSetHash }, null, 2)}\n`,
      'utf8',
    );
    renameSync(setDir, path.join(shardPaths.setsDir, nextManifest.shardSetId));
    const options = {
      shardPaths,
      identity: { envelope: envelopeFor(catalog), catalog, teachingPointer: null },
    };
    expect(() => loadShardSetCoverage(options)).toThrow(/does not close the catalog denominator/u);
  });

  it('stages the coverage receipt with the immutable shard closure', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'act-authority-coverage-stage-'));
    tempRoots.push(root);
    const paths = {
      runtimeRoot: root,
      currentPath: path.join(root, 'current.json'),
      setsDir: path.join(root, 'sets'),
    };
    const materialized = materializeCoverage();
    stageAuthorityDomainShards(paths, materialized);
    expect(readFileSync(
      path.join(paths.setsDir, materialized.manifest.shardSetId, 'coverage.json'),
      'utf8',
    )).toContain('coverage-receipt');
  });

  it('bounds browser memory to the active domain and restores the overview deterministically', () => {
    const materialized = materializeCoverage();
    let state = createEmptyAuthorityShardWorkspace();
    state = mergeAuthorityShard(state, projectAuthorityLearnerShard(materialized.root));
    state = mergeAuthorityShard(
      state,
      projectAuthorityLearnerShard(materialized.domainDefaults['system-modeling']),
    );
    expect(state.domainOverviewIds).toEqual([MODELING]);
    expect(Object.keys(state.objectsByCanonicalId)).toEqual([MODELING]);
    // Real navigation resets the domain shell before the next default; the
    // next domain response then bounds memory to its own members.
    state = resetAuthorityShardDomain(state);
    state = mergeAuthorityShard(
      state,
      projectAuthorityLearnerShard(materialized.domainDefaults[NONLINEAR_DOMAIN]),
    );
    // Entering another domain drops the previous domain's objects instead of
    // accumulating an unbounded cross-domain cache.
    expect(Object.keys(state.objectsByCanonicalId).sort()).toEqual([NONLINEAR_CONCEPT].sort());
    expect(state.domainOverviewIds).toEqual([NONLINEAR_CONCEPT]);
    const model = createActiveAuthorityGraphModel({
      nodes: Object.values(state.objectsByCanonicalId),
      relations: [],
    });
    expect(selectAuthorityDomainOverviewScope(model, state.domainOverviewIds))
      .toEqual(new Set([NONLINEAR_CONCEPT]));
    const reset = resetAuthorityShardDomain(state);
    expect(reset.domainOverviewIds).toEqual([]);
  });
});

describe('fifteen-domain runtime shard closure (#1738)', () => {
  it('loads every root-to-domain path with a bounded concept overview', () => {
    const root = loadRootShard();
    const catalog = JSON.parse(readFileSync(
      path.join(process.cwd(), 'course-content/runtime/knowledge/authority-domain-catalog/catalog.json'),
      'utf8',
    )) as { domains: Array<{ domainId: string }> };
    const expected = catalog.domains.map((domain) => domain.domainId).sort();
    expect(root.root.domains).toHaveLength(expected.length);
    expect(root.root.aggregate.domainCount).toBe(expected.length);
    for (const domainId of expected) {
      const domain = loadDomainDefaultShard(domainId);
      expect(domain.domainId).toBe(domainId);
      expect(domain.objects.length).toBeGreaterThan(0);
      expect(domain.objects.every((object) => (
        (AUTHORITY_DOMAIN_DEFAULT_TYPES as readonly string[]).includes(object.canonicalType)
      ))).toBe(true);
      const overviewIds = new Set([...domain.objects, ...(domain.teachingBoundaryObjects ?? [])].map((object) => object.id));
      for (const relation of domain.teachingRelations) {
        expect(overviewIds.has(relation.sourceId)).toBe(true);
        expect(overviewIds.has(relation.targetId)).toBe(true);
      }
      const index = loadDomainSearchIndexShard(domainId);
      expect(index.entries.length).toBeGreaterThanOrEqual(domain.objects.length);
    }
  });

  it('keeps representative secondary objects reachable through search and one-hop closure', () => {
    const coverage = loadShardSetCoverage();
    const secondaryTypes = ['Formula', 'KnowledgeStatement', 'SystemModel', 'ModelRepresentation'] as const;
    const found = new Map<string, string>();
    for (const domain of coverage.domains) {
      const index = loadDomainSearchIndexShard(domain.domainId);
      for (const type of secondaryTypes) {
        if (found.has(type)) continue;
        const entry = index.entries.find((row) => row.canonicalType === type);
        if (entry) found.set(type, entry.id);
      }
    }
    expect([...found.keys()].sort()).toEqual([...secondaryTypes].sort());
    for (const [type, nodeId] of found) {
      const neighborhood = loadNodeNeighborhoodShard(nodeId);
      expect(neighborhood.objects.some((object) => object.id === nodeId && object.canonicalType === type)).toBe(true);
      const detail = loadNodeDetailShard(nodeId);
      expect(detail.node.canonicalType).toBe(type);
    }
  });

  it('bounds the search index byte budget for the largest domain', () => {
    const largest = loadDomainSearchIndexShard('state-space-control-analysis-and-design');
    expect(largest.entries.length).toBeGreaterThan(
      loadDomainDefaultShard('state-space-control-analysis-and-design').objects.length,
    );
    const bytes = Buffer.byteLength(`${JSON.stringify(largest)}\n`);
    expect(bytes).toBeLessThan(AUTHORITY_SHARD_PAYLOAD_BUDGETS['domain-search-index']);
  });
});

describe('pre-change denominator baseline (#1738 task 1.1)', () => {
  it('anchors the recorded baseline to the sealed historical shard set', () => {
    const baseline = JSON.parse(readFileSync(path.join(
      process.cwd(),
      'openspec/changes/archive/2026-09-01-establish-three-level-authority-graph-navigation/baseline.json',
    ), 'utf8')) as {
      sourceShardSetId: string;
      catalogDomainCount: number;
      sealedDomainDefaultCount: number;
      missingDomainDefaults: string[];
      domains: Array<{
        domainId: string;
        defaultObjectCount: number;
        defaultBytes: number;
        hasDefault: boolean;
      }>;
    };
    expect(baseline.catalogDomainCount).toBe(15);
    expect(baseline.sealedDomainDefaultCount).toBe(8);
    expect(baseline.missingDomainDefaults).toHaveLength(7);
    for (const domainId of baseline.missingDomainDefaults) {
      expect(REGISTERED_PEER_DOMAIN_IDS).not.toContain(domainId);
    }
    const oldSetRoot = path.join(
      process.cwd(),
      'course-content/runtime/knowledge/authority-domain-shards/sets',
      baseline.sourceShardSetId,
    );
    for (const row of baseline.domains) {
      const relative = `domains/${row.domainId}/default.json`;
      const filePath = path.join(oldSetRoot, relative);
      if (row.hasDefault) {
        const raw = readFileSync(filePath, 'utf8');
        const shard = JSON.parse(raw) as {
          objects: Array<{ canonicalType: string }>;
        };
        expect(shard.objects.length).toBe(row.defaultObjectCount);
        expect(Buffer.byteLength(raw, 'utf8')).toBe(row.defaultBytes);
      } else {
        expect(() => readFileSync(filePath)).toThrow();
      }
    }
    // The historical heterogeneous defaults were complete-domain dumps.
    const largest = baseline.domains.reduce((left, right) => (
      right.defaultObjectCount > left.defaultObjectCount ? right : left
    ));
    expect(largest.defaultObjectCount).toBe(1300);
  });
});
