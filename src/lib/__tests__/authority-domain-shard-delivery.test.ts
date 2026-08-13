/**
 * Authority domain shard delivery (#1375).
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  REGISTERED_PEER_DOMAIN_IDS,
  buildAuthorityDomainCatalog,
  type AuthorityDomainCatalogAuthoring,
} from '@/lib/authority-domain-catalog';
import {
  composeDomainTeachingProjection,
  teachingCacheFamilyFor,
  type DomainTeachingComposedArtifacts,
} from '@/lib/teaching-projection/domain-fragments';
import type { AuthorityEngineeringBody } from '@/lib/authoritative-knowledge/authority-snapshot';
import {
  AUTHORITY_SHARD_ENVELOPE_CONTRACT,
  AUTHORITY_SHARD_PAYLOAD_BUDGETS,
  buildAuthorityDomainShards,
  canonicalIdToken,
  createRecordingShardIo,
  createTeachingOverlay,
  defaultShardIo,
  loadDomainDefaultShard,
  loadNodeDetailShard,
  loadNodeNeighborhoodShard,
  loadRelationFamilyShard,
  loadRootShard,
  loadOptionalDomainTeachingProjection,
  projectAuthorityLearnerShard,
  teachingCoverageFromState,
  writeAuthorityDomainShards,
  type AuthorityShardEnvelope,
} from '@/lib/authority-domain-shards';
import {
  createEmptyAuthorityShardWorkspace,
  mergeAuthorityShard,
  selectAuthorityShardObject,
  rememberAuthorityShardPositions,
  validateIncomingShard,
} from '@/features/knowledge/active-authority-shard-store';

const SNAPSHOT_HASH = 'a'.repeat(64);
const SNAPSHOT_ID = `snap-${SNAPSHOT_HASH}`;
const RELEASE_ID = 'ctr:release:test-shards';
const RELEASE_SET_ID = 'release-set-test-shards';
const CATALOG_ID = 'adc-test-shards';

const MODELING = 'ctc:modeling-test-object';
const TIME = 'ctc:time-test-object';
const SHARED = 'ctc:shared-test-object';
const NEIGHBOR = 'ctc:neighbor-test-object';

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

function envelope(overrides: Partial<AuthorityShardEnvelope> = {}): AuthorityShardEnvelope {
  return {
    contract: AUTHORITY_SHARD_ENVELOPE_CONTRACT,
    authority: {
      snapshotId: SNAPSHOT_ID,
      snapshotHash: SNAPSHOT_HASH,
      releaseId: RELEASE_ID,
      releaseSetId: RELEASE_SET_ID,
      activationId: 'activation-test',
      activationHash: 'b'.repeat(64),
      projectionId: null,
      projectionHash: null,
    },
    catalog: {
      catalogId: CATALOG_ID,
      catalogHash: 'c'.repeat(64),
      catalogVersion: '1.0.0-test',
    },
    teaching: {
      status: 'unavailable',
      projectionId: null,
      projectionHash: null,
      teachingCacheFamily: null,
    },
    match: { authority: true, catalog: true, teaching: null },
    ...overrides,
  };
}

function catalogRuntime() {
  const visualByDomain = {
    'system-modeling': 'modeling',
    'time-domain-analysis': 'time',
    'stability-analysis': 'stability',
    'frequency-domain-analysis': 'frequency',
    'root-locus': 'root-locus',
    'classical-control-design': 'design',
    'discrete-time-control-analysis': 'discrete',
    'state-space-control-analysis-and-design': 'state-space',
  } as const;
  const displayNames = [
    '系统建模',
    '时域分析',
    '稳定性分析',
    '频域分析',
    '根轨迹',
    '经典控制设计',
    '离散控制分析',
    '状态空间控制',
  ] as const;
  const authoring: AuthorityDomainCatalogAuthoring = {
    contract: 'act-authority-domain-display-catalog-authoring/v1',
    catalogVersion: '1.0.0-test',
    reviewStatus: 'reviewed',
    authorityBinding: {
      snapshotId: SNAPSHOT_ID,
      snapshotHash: SNAPSHOT_HASH,
      releaseId: RELEASE_ID,
      releaseSetId: RELEASE_SET_ID,
    },
    domains: REGISTERED_PEER_DOMAIN_IDS.map((domainId, index) => ({
      domainId,
      order: index + 1,
      displayName: displayNames[index],
      summary: `${displayNames[index]}概览`,
      presentationRole: 'domain',
      visualRole: visualByDomain[domainId],
    })),
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
      { canonicalId: TIME, domainIds: ['time-domain-analysis'], preferredDomainId: 'time-domain-analysis' },
      { canonicalId: SHARED, domainIds: ['system-modeling', 'time-domain-analysis'], preferredDomainId: 'system-modeling' },
    ],
  };
  return buildAuthorityDomainCatalog(authoring, [
    { canonicalId: MODELING },
    { canonicalId: TIME },
    { canonicalId: SHARED },
  ]);
}

function objectRow(canonicalId: string, label: string) {
  return {
    canonicalId,
    ordinal: 1,
    canonicalType: 'DomainConcept',
    semanticName: label,
    reviewStatus: 'approved',
    publicationStatus: 'published',
    lifecycleStatus: 'active',
    payload: { displayName: label, description: `${label} desc` },
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

function engineeringBody(): AuthorityEngineeringBody {
  return {
    objects: [
      objectRow(MODELING, '建模对象'),
      objectRow(TIME, '时域对象'),
      objectRow(SHARED, '跨域对象'),
      objectRow(NEIGHBOR, '邻域对象'),
    ],
    relations: [
      relationRow('rel-assoc', 'association', MODELING, NEIGHBOR),
      relationRow('rel-part', 'part_of', SHARED, MODELING),
      relationRow('rel-apply', 'applies_to', TIME, NEIGHBOR),
    ],
    sourceMappings: [],
    sourceObjects: [],
    evidence: [],
    releaseEntries: [],
    upstreamRagReferences: [],
    releaseComponents: [],
    projectionIdentities: [],
    linkMetadata: [],
  };
}

function publishedTeachingArtifacts(): {
  artifacts: DomainTeachingComposedArtifacts;
  pointer: {
    contract: 'act-domain-teaching-projection-current/v1';
    projectionId: string;
    projectionHash: string;
    authorityReleaseId: string;
    authorityDigest: string;
    teachingCacheFamily: string;
    activatedAt: string;
  };
} {
  const fragmentPath = path.join(
    process.cwd(),
    'course-content/authoring/knowledge/teaching-projection/domain-fragments/first-fragment.json',
  );
  const fragment = JSON.parse(readFileSync(fragmentPath, 'utf8')) as DomainTeachingComposedArtifacts['fragments'][number];
  const artifacts = composeDomainTeachingProjection({
    fragments: [fragment],
    authoringRevision: fragment.authoringRevision,
    authorityBinding: fragment.authorityBinding,
    authoritySelection: fragment.authoritySelection,
  });
  return {
    artifacts,
    pointer: {
      contract: 'act-domain-teaching-projection-current/v1',
      projectionId: artifacts.manifest.projectionId,
      projectionHash: artifacts.manifest.projectionHash,
      authorityReleaseId: artifacts.manifest.authorityBinding.releaseId,
      authorityDigest: artifacts.manifest.authorityDigest,
      teachingCacheFamily: teachingCacheFamilyFor(artifacts.manifest),
      activatedAt: '2026-08-13T00:00:00.000Z',
    },
  };
}

function writeShards(
  teaching = createTeachingOverlay(null),
  envelopeOverride?: AuthorityShardEnvelope,
) {
  const root = mkdtempSync(path.join(tmpdir(), 'act-authority-shards-'));
  tempRoots.push(root);
  const shardPaths = {
    runtimeRoot: root,
    currentPath: path.join(root, 'current.json'),
    setsDir: path.join(root, 'sets'),
  };
  const catalog = catalogRuntime();
  const built = envelopeOverride ?? envelope({
    catalog: {
      catalogId: catalog.catalogId,
      catalogHash: catalog.catalogHash,
      catalogVersion: catalog.catalogVersion,
    },
  });
  const materialized = buildAuthorityDomainShards({
    envelope: built,
    catalog,
    engineering: engineeringBody(),
    teaching,
    activatedAt: '2026-08-13T00:00:00.000Z',
  });
  writeAuthorityDomainShards(shardPaths, materialized);
  return { shardPaths, materialized, catalog, envelope: built };
}

function writeTeachingProjectionFixture(root: string) {
  const published = publishedTeachingArtifacts();
  const relative = 'teaching-projection';
  const releaseDir = path.join(root, relative, 'releases', published.pointer.projectionId);
  mkdirSync(path.join(releaseDir, 'fragments'), { recursive: true });
  writeFileSync(
    path.join(root, relative, 'current.json'),
    `${JSON.stringify(published.pointer, null, 2)}\n`,
  );
  writeFileSync(
    path.join(releaseDir, 'manifest.json'),
    `${JSON.stringify(published.artifacts.manifest, null, 2)}\n`,
  );
  for (const fragment of published.artifacts.fragments) {
    writeFileSync(
      path.join(releaseDir, 'fragments', `${fragment.fragmentId}.json`),
      `${JSON.stringify(fragment, null, 2)}\n`,
    );
  }
  return { ...published, relative };
}

describe('authority domain shard delivery', () => {
  it('materializes five shard classes with bounded payloads and equivalent facts', () => {
    const { materialized } = writeShards();
    expect(materialized.root.shardClass).toBe('root');
    expect(JSON.stringify(materialized.root)).not.toMatch(/engineering\.json|canonicalId|system-modeling/u);
    expect(materialized.domainDefaults['system-modeling'].objects.map((row) => row.id).sort()).toEqual(
      [MODELING, SHARED].sort(),
    );
    expect(materialized.domainDefaults['system-modeling'].teachingRelations).toEqual([]);
    expect(materialized.domainDefaults['system-modeling'].teachingCoverage.status).toBe('unavailable');
    expect(materialized.domainDefaults['system-modeling'].teachingCoverage.note).toBe('教学关系暂不可用');
    const association = materialized.families['system-modeling:association'];
    expect(association.relations.map((row) => row.id)).toEqual(['rel-assoc']);
    expect(association.relations[0]?.sourceId).toBe(MODELING);
    expect(association.relations[0]?.targetId).toBe(NEIGHBOR);
    expect(association.relations[0]?.predicate).toBe('association');
    const neighborhood = materialized.neighborhoods[MODELING];
    expect(neighborhood.relations).toHaveLength(2);
    expect(neighborhood.truncated).toBe(false);
    expect(materialized.details[MODELING]?.node.media).toEqual({
      cardAvailable: false,
      infographAvailable: false,
    });
    expect(materialized.root.envelope.authority.projectionId).toBeNull();
    const browserRoot = projectAuthorityLearnerShard(materialized.root);
    expect(browserRoot.envelope).toEqual({
      contract: AUTHORITY_SHARD_ENVELOPE_CONTRACT,
      authorityCatalogVersion: expect.stringMatching(/^acv-[a-f0-9]{64}$/u),
      teachingVersion: null,
      match: { authority: true, catalog: true, teaching: null },
    });
    expect(JSON.stringify(browserRoot)).not.toContain(SNAPSHOT_ID);
    expect(JSON.stringify(browserRoot)).not.toContain(RELEASE_ID);
    expect(JSON.stringify(browserRoot)).not.toContain(CATALOG_ID);
    const rootBytes = Buffer.byteLength(`${JSON.stringify(materialized.root)}\n`);
    expect(rootBytes).toBeLessThan(AUTHORITY_SHARD_PAYLOAD_BUDGETS.root);
    expect(rootBytes).toBeLessThan(80_000);
  });

  it('loads root and domain-default without opening engineering.json', () => {
    const { shardPaths, materialized, catalog, envelope: expected } = writeShards();
    const recording = createRecordingShardIo(defaultShardIo);
    const options = {
      shardPaths,
      io: recording.io,
      identity: {
        envelope: expected,
        catalog,
        teachingPointer: null,
      },
    };
    const root = loadRootShard(options);
    const domain = loadDomainDefaultShard('system-modeling', options);
    expect(root.shardClass).toBe('root');
    expect(domain.objects.map((row) => row.id).sort()).toEqual([MODELING, SHARED].sort());
    expect(recording.reads.some((filePath) => filePath.includes('engineering.json'))).toBe(false);
    expect(materialized.pointer.snapshotId).toBe(expected.authority.snapshotId);
  });

  it('resolves the pointer through an immutable composed Teaching artifact', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'act-teaching-projection-'));
    tempRoots.push(root);
    const fixture = writeTeachingProjectionFixture(root);
    const resolved = loadOptionalDomainTeachingProjection({
      repoRoot: root,
      relative: fixture.relative,
    });
    expect(resolved.pointer?.projectionId).toBe(fixture.pointer.projectionId);
    expect(resolved.artifacts?.manifest.projectionHash).toBe(fixture.artifacts.manifest.projectionHash);
    expect(resolved.artifacts?.relations.length).toBe(fixture.artifacts.relations.length);
    const overlay = createTeachingOverlay(resolved.pointer, { artifacts: resolved.artifacts });
    expect(overlay.relations('system-modeling')).toHaveLength(4);
    expect(overlay.coverage('system-modeling').status).toBe('available');

    writeFileSync(
      path.join(root, fixture.relative, 'current.json'),
      `${JSON.stringify({ ...fixture.pointer, projectionHash: '0'.repeat(64) }, null, 2)}\n`,
    );
    const mismatched = loadOptionalDomainTeachingProjection({
      repoRoot: root,
      relative: fixture.relative,
    });
    expect(mismatched.pointer?.projectionId).toBe(fixture.pointer.projectionId);
    expect(mismatched.artifacts).toBeNull();
  });

  it('fails closed on mixed identity and missing shards', () => {
    const { shardPaths, materialized, catalog, envelope: expected } = writeShards();
    const options = {
      shardPaths,
      identity: { envelope: expected, catalog, teachingPointer: null },
    };
    const raw = JSON.parse(readFileSync(shardPaths.currentPath, 'utf8')) as Record<string, unknown>;
    writeFileSync(
      shardPaths.currentPath,
      `${JSON.stringify({ ...raw, snapshotId: 'other-snapshot' }, null, 2)}\n`,
    );
    expect(() => loadRootShard(options)).toThrow(/does not match the active Authority\/catalog identity/u);
    writeFileSync(shardPaths.currentPath, `${JSON.stringify(raw, null, 2)}\n`);
    writeFileSync(
      shardPaths.currentPath,
      `${JSON.stringify({ ...raw, teachingProjectionId: 'unexpected-teaching-projection' }, null, 2)}\n`,
    );
    const staleTeachingRoot = loadRootShard(options);
    expect(staleTeachingRoot.envelope.teaching.projectionId).toBeNull();
    writeFileSync(shardPaths.currentPath, `${JSON.stringify(raw, null, 2)}\n`);
    const manifestPath = path.join(shardPaths.setsDir, materialized.manifest.shardSetId, 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { files: Record<string, string> };
    writeFileSync(
      manifestPath,
      `${JSON.stringify({ ...manifest, files: { ...manifest.files, 'root.json': '0'.repeat(64) } }, null, 2)}\n`,
    );
    expect(() => loadRootShard(options)).toThrow(/manifest seal is invalid/u);
    writeFileSync(manifestPath, `${JSON.stringify(materialized.manifest, null, 2)}\n`);
    rmSync(path.join(shardPaths.setsDir, materialized.manifest.shardSetId, 'root.json'));
    expect(() => loadRootShard(options)).toThrow(/unavailable|tamper/u);
  });

  it('keeps engineering available for partial, empty and unavailable teaching', () => {
    const catalog = catalogRuntime();
    const built = envelope({
      catalog: {
        catalogId: catalog.catalogId,
        catalogHash: catalog.catalogHash,
        catalogVersion: catalog.catalogVersion,
      },
    });
    const cases = [
      createTeachingOverlay(null),
      createTeachingOverlay(null, {
        coverageByDomain: {
          'system-modeling': teachingCoverageFromState('system-modeling', 'empty'),
        },
      }),
      (() => {
        const published = publishedTeachingArtifacts();
        const artifacts: DomainTeachingComposedArtifacts = {
          ...published.artifacts,
          relations: [
            {
              edgeId: 'teach-1',
              sourceNodeId: MODELING,
              targetNodeId: SHARED,
              layer: 'ACT_TEACHING',
              relationType: 'PREREQUISITE',
              strength: 'REQUIRED',
              domainKeys: ['system-modeling'],
              evidenceRefs: [],
              curatorId: null,
              curatorRationale: null,
              authorDecisionId: null,
              edgeDigest: 'f'.repeat(64),
              presentationFamily: 'teaching-prerequisite',
            },
          ],
          coverage: published.artifacts.coverage.map((entry) => entry.domainId === 'system-modeling'
            ? {
                ...entry,
                coverage: 'partial' as const,
                relationCount: 1,
                coreNodeCount: 2,
                uncoveredCoreNodeCount: 1,
                note: '该领域仅有部分教学关系已发布',
              }
            : entry),
        };
        return createTeachingOverlay(published.pointer, { artifacts });
      })(),
    ] as const;

    for (const teaching of cases) {
      const materialized = buildAuthorityDomainShards({
        envelope: built,
        catalog,
        engineering: engineeringBody(),
        teaching,
      });
      const domain = materialized.domainDefaults['system-modeling'];
      expect(domain.objects.length).toBe(2);
      expect(materialized.families['system-modeling:association'].relations).toHaveLength(1);
      expect(domain.teachingCoverage.status === 'unavailable'
        || domain.teachingCoverage.status === 'empty'
        || domain.teachingCoverage.status === 'partial').toBe(true);
      if (domain.teachingCoverage.status !== 'partial') {
        expect(domain.teachingRelations).toEqual([]);
      } else {
        expect(domain.teachingRelations).toHaveLength(1);
        expect(domain.teachingRelations[0]?.layer).toBe('ACT_TEACHING');
      }
    }
  });

  it('keeps engineering shards readable while a sealed Teaching set is stale', () => {
    const published = publishedTeachingArtifacts();
    const catalog = catalogRuntime();
    const teachingV1 = {
      status: 'available' as const,
      projectionId: published.pointer.projectionId,
      projectionHash: published.pointer.projectionHash,
      teachingCacheFamily: published.pointer.teachingCacheFamily,
    };
    const envelopeV1 = envelope({
      catalog: {
        catalogId: catalog.catalogId,
        catalogHash: catalog.catalogHash,
        catalogVersion: catalog.catalogVersion,
      },
      teaching: teachingV1,
      match: { authority: true, catalog: true, teaching: true },
    });
    const sealedV1 = writeShards(
      createTeachingOverlay(published.pointer, { artifacts: published.artifacts }),
      envelopeV1,
    );
    const envelopeV2 = envelope({
      catalog: {
        catalogId: catalog.catalogId,
        catalogHash: catalog.catalogHash,
        catalogVersion: catalog.catalogVersion,
      },
      teaching: {
        status: 'unavailable',
        projectionId: 'proj-v2',
        projectionHash: '2'.repeat(64),
        teachingCacheFamily: 'teaching-domain-proj:proj-v2:2222222222222222',
      },
      match: { authority: true, catalog: true, teaching: false },
    });
    const staleOptions = {
      shardPaths: sealedV1.shardPaths,
      identity: {
        envelope: envelopeV2,
        catalog,
        teachingPointer: published.pointer,
      },
    };
    const staleRoot = loadRootShard(staleOptions);
    const staleDomain = loadDomainDefaultShard('system-modeling', staleOptions);
    const staleFamily = loadRelationFamilyShard('system-modeling', 'association', staleOptions);
    const staleNeighborhood = loadNodeNeighborhoodShard(MODELING, staleOptions);
    const staleDetail = loadNodeDetailShard(MODELING, staleOptions);
    expect(staleRoot.envelope.teaching.projectionId).toBe('proj-v2');
    expect(staleRoot.envelope.teaching.status).toBe('unavailable');
    expect(staleDomain.teachingRelations).toEqual([]);
    expect(staleDomain.teachingCoverage.status).toBe('unavailable');
    expect(staleFamily.relations).toHaveLength(1);
    expect(staleNeighborhood.relations.length).toBeGreaterThan(0);
    expect(staleDetail.node.id).toBe(MODELING);

    const pointerV2 = {
      ...published.pointer,
      projectionId: 'proj-v2',
      projectionHash: '2'.repeat(64),
      teachingCacheFamily: 'teaching-domain-proj:proj-v2:2222222222222222',
    };
    const envelopeV2Matched = {
      ...envelopeV2,
      match: { authority: true as const, catalog: true as const, teaching: true as const },
    };
    const matching = writeShards(
      createTeachingOverlay(pointerV2, { artifacts: published.artifacts }),
      envelopeV2Matched,
    );
    const matchingOptions = {
      shardPaths: matching.shardPaths,
      identity: { envelope: envelopeV2Matched, catalog, teachingPointer: pointerV2 },
    };
    const matchingDomain = loadDomainDefaultShard('system-modeling', matchingOptions);
    expect(matchingDomain.teachingRelations.length).toBeGreaterThan(0);
    expect(matchingDomain.envelope.match.teaching).toBe(true);
  });

  it('merges canonical objects once and rejects mismatched envelopes', () => {
    const { materialized } = writeShards();
    let state = createEmptyAuthorityShardWorkspace();
    const root = projectAuthorityLearnerShard(materialized.root);
    const modeling = projectAuthorityLearnerShard(materialized.domainDefaults['system-modeling']);
    const time = projectAuthorityLearnerShard(materialized.domainDefaults['time-domain-analysis']);
    expect(validateIncomingShard(state, modeling)).toBe('reject');
    state = mergeAuthorityShard(state, root);
    state = mergeAuthorityShard(state, modeling);
    state = selectAuthorityShardObject(state, SHARED);
    state = rememberAuthorityShardPositions(state, { [SHARED]: { x: 12, y: 24 } });
    const afterTime = mergeAuthorityShard(state, time);
    expect(Object.keys(afterTime.objectsByCanonicalId)).toContain(SHARED);
    expect(afterTime.objectsByCanonicalId[SHARED]?.memberships.map((item) => item.domainId).sort()).toEqual(
      ['system-modeling', 'time-domain-analysis'],
    );
    expect(afterTime.selectedCanonicalId).toBe(SHARED);
    expect(afterTime.positionsByCanonicalId[SHARED]).toEqual({ x: 12, y: 24 });
    const mismatched = projectAuthorityLearnerShard({
      ...materialized.families['system-modeling:association'],
      envelope: envelope({
        authority: {
          ...materialized.root.envelope.authority,
          snapshotId: 'other',
        },
      }),
    });
    const rejected = mergeAuthorityShard(afterTime, mismatched);
    expect(rejected.rejectedShardKeys.some((key) => key.includes('relation-family'))).toBe(true);
    expect(rejected.selectedCanonicalId).toBe(SHARED);
    expect(rejected.objectsByCanonicalId[SHARED]).toBe(afterTime.objectsByCanonicalId[SHARED]);
  });

  it('uses collision-resistant file tokens for opaque node ids', () => {
    expect(canonicalIdToken('ctc:node/a')).not.toBe(canonicalIdToken('ctc:node_a'));
    expect(canonicalIdToken('ctc:node/a')).toMatch(/^node-[a-f0-9]{64}$/u);
  });
});

describe('committed Authority shard runtime', () => {
  it('serves live root and domain-default without engineering.json when shards are published', () => {
    const currentPath = path.join(
      process.cwd(),
      'course-content/runtime/knowledge/authority-domain-shards/current.json',
    );
    let current: { shardSetId?: string } | null = null;
    try {
      current = JSON.parse(readFileSync(currentPath, 'utf8')) as { shardSetId?: string };
    } catch {
      current = null;
    }
    if (!current?.shardSetId) {
      expect(current).toBeNull();
      return;
    }
    const reads: string[] = [];
    const io = {
      exists: defaultShardIo.exists,
      readFile(filePath: string) {
        reads.push(filePath);
        return defaultShardIo.readFile(filePath);
      },
    };
    const root = loadRootShard({ io });
    const domain = loadDomainDefaultShard('modeling', { io });
    expect(root.shardClass).toBe('root');
    expect(domain.shardClass).toBe('domain-default');
    expect(root.envelope.authority.projectionId).toBeNull();
    expect(reads.some((filePath) => filePath.endsWith('engineering.json'))).toBe(false);
    const family = loadRelationFamilyShard('modeling', 'association', { io });
    expect(family.family).toBe('association');
    const firstObject = domain.objects[0];
    if (firstObject) {
      const neighborhood = loadNodeNeighborhoodShard(firstObject.id, { io });
      expect(neighborhood.nodeId).toBe(firstObject.id);
      expect(neighborhood.relations.length).toBeLessThanOrEqual(32);
    }
  });
});
