/**
 * Authority domain shard delivery (#1375).
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
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
import type { AuthoritativeV2Evidence } from '@/lib/authoritative-knowledge/contracts';
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
  projectAuthorityObject,
  createAuthorityLabelResolverContext,
  isSafeAuthorityLabel,
  resolveAuthorityLabel,
  stageAuthorityDomainShards,
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

const V018_RELEASE_ID = 'ctr:release:control-theory-engineering-v0.18';
const V018_SNAPSHOT_ID = 'snap-1b64a853dda5668d83d0d2f09cadf72937330ced6aa49611f8027a9d5ec008ed';
const V018_SNAPSHOT_HASH = '1b64a853dda5668d83d0d2f09cadf72937330ced6aa49611f8027a9d5ec008ed';
const V018_PROFILE_ID = 'ctr:profile:control-theory-engineering-v0.18:runtime-v3';
const V018_PROFILE_SHA256 = 'a442adfc5a73d9bacba53ce33016238be148917084e057ab979340279737bfe7';
const V018_CTF_ID = 'ctf:1ac3cc48c529fb9bb3fd0532';
const V018_CTF_DISPLAY_NAME = String.raw`m=\left.\frac{d g}{d x}\right|_{x(t)=x_{0}}`;

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

const V018_FORMULA_DISPLAY_NAMES = [
  'y(t)=\\frac{A}{2}\\left[H(j \\omega) e^{j \\omega t}+H(-j \\omega) e^{-j \\omega t}\\right]',
  'P=\\frac{1}{\\Delta} \\sum_{k=1}^{n} p_{k} \\Delta_{k}',
  '\\text{DC gain} = \\lim_{s \\rightarrow 0} G(s)',
  '\\ddot{\\theta} + \\frac{g}{l} \\theta = \\frac{T_c}{m l^2}',
  'G(s)=\\frac{b_{m} s^{-(n-m)}+b_{m-1} s^{-(n-m+1)}+\\cdots+b_{1} s^{-(n-1)}+b_{0} s^{-n}}{1+a_{n-1} s^{-1}+\\cdots+a_{1} s^{-(n-1)}+a_{0} s^{-n}}',
  'G(s)=\\frac{U(s)}{\\Omega(s)}=K_t',
  'G(s)=G_{1}(s) \\pm G_{2}(s)',
  '\\int u d v=u v-\\int v d u',
  '\\dot{x}(t)=a x(t)+b u(t)',
  'H(s)=\\frac{1}{s+k}',
  'm=\\left.\\frac{d g}{d x}\\right|_{x(t)=x_{0}}',
  '\\frac{V_{2}(s)}{V_{1}(s)}=-R C s',
  'G(s)=\\frac{U(s)}{\\Theta(s)}=K_1',
  'Y(s)=\\frac{k_{1}}{s-s_{1}}+\\frac{k_{2}}{s-s_{2}}',
  '\\dot{\\mathbf{x}}(t)=\\mathbf{A x}(t)+\\mathbf{B u}(t)',
  'T_{L}(s) = J s^{2} \\theta(s) + b s \\theta(s)',
  '\\frac{U_o(s)}{U_i(s)}=\\frac{1}{R_1 R_2 C_1 C_2 s^2 + (R_1 C_1 + R_2 C_2) s + 1}',
  'C(s)=\\frac{G(s)}{1 \\mp G(s) H(s)} R(s)=\\Phi(s) R(s)',
  'f(t)=\\sum_{i=1}^{n} C_{i} e^{p_{i} t} 1(t)',
  String.raw`K_{e q}(a)=\left\{\begin{array}{cl}\frac{2}{\pi}\left(k \sin ^{-1}\left(\frac{N}{a k}\right)+\frac{N}{a} \sqrt{1-\left(\frac{N}{k a}\right)^{2}}\right), & \frac{k a}{N}>1,  \\k, & \frac{k a}{N} \leq 1 .\end{array}\right.`,
] as const;

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

function v018FormulaCatalogRuntime() {
  const catalog = catalogRuntime();
  return {
    ...catalog,
    memberships: catalog.memberships.map((membership) => (
      membership.canonicalId === MODELING
        ? { ...membership, canonicalId: V018_CTF_ID }
        : membership
    )),
  };
}

function v018FormulaEngineeringBody(): AuthorityEngineeringBody {
  const engineering = engineeringBody();
  const replaceId = (id: string) => (id === MODELING ? V018_CTF_ID : id);
  return {
    ...engineering,
    objects: engineering.objects.map((object) => (
      object.canonicalId === MODELING
        ? {
          ...object,
          canonicalId: V018_CTF_ID,
          canonicalType: 'Formula',
          semanticName: V018_CTF_DISPLAY_NAME,
          payload: { displayName: V018_CTF_DISPLAY_NAME },
        }
        : object
    )),
    relations: engineering.relations.map((relation) => ({
      ...relation,
      sourceId: replaceId(relation.sourceId),
      targetId: replaceId(relation.targetId),
    })),
    v2Evidence: v018Evidence([]),
  };
}

function v018FormulaEnvelope(catalog: ReturnType<typeof v018FormulaCatalogRuntime>): AuthorityShardEnvelope {
  const base = envelope();
  return {
    ...base,
    authority: {
      ...base.authority,
      snapshotId: V018_SNAPSHOT_ID,
      snapshotHash: V018_SNAPSHOT_HASH,
      releaseId: V018_RELEASE_ID,
    },
    catalog: {
      catalogId: catalog.catalogId,
      catalogHash: catalog.catalogHash,
      catalogVersion: catalog.catalogVersion,
    },
  };
}

function v2Evidence(
  labels: Array<{
    entityId: string;
    label: string;
    labelType: 'canonical_preferred' | 'alternative';
  }>,
  releaseId = RELEASE_ID,
): AuthoritativeV2Evidence {
  const profiles = [
    { profileKey: 'act', manifestProfile: 'runtime', projectionKind: 'act_runtime_graph' },
    { profileKey: 'domain', manifestProfile: 'domain', projectionKind: 'domain_graph' },
    { profileKey: 'review', manifestProfile: 'review', projectionKind: 'review_graph' },
  ].map(({ profileKey, manifestProfile, projectionKind }) => ({
    releaseId,
    profileKey,
    manifestProfile,
    profileId: `${profileKey}-profile`,
    profileSha256: 'd'.repeat(64),
    projectionKind,
    profileVersion: 'v1',
    mappingContractVersion: 'actkg-map/v2',
    aggregationPolicy: 'preserve-all',
    payload: { profileKey },
  }));
  return {
    protocol: 'actkg-public-bundle/2',
    profiles,
    multilingualLabels: labels.map((row, ordinal) => ({
      releaseId,
      ordinal,
      entityId: row.entityId,
      language: 'zh-CN',
      label: row.label,
      labelType: row.labelType,
      terminologyAssertionId: `term-${ordinal}`,
      payload: {},
    })),
    admissionBinding: {
      releaseId,
      bundleReceiptId: 'bundle-receipt:test',
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

function v018Evidence(
  labels: Array<{
    entityId: string;
    label: string;
    labelType: 'canonical_preferred' | 'alternative';
  }>,
): AuthoritativeV2Evidence {
  const evidence = v2Evidence(labels, V018_RELEASE_ID);
  return {
    ...evidence,
    profiles: evidence.profiles.map((profile) => (
      profile.profileKey === 'act'
        ? { ...profile, profileId: V018_PROFILE_ID, profileSha256: V018_PROFILE_SHA256 }
        : profile
    )),
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
  it('stages an immutable shard closure without writing the active pointer', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'authority-shard-stage-'));
    tempRoots.push(root);
    const catalog = catalogRuntime();
    const materialized = buildAuthorityDomainShards({
      envelope: envelope({
        catalog: {
          catalogId: catalog.catalogId,
          catalogHash: catalog.catalogHash,
          catalogVersion: catalog.catalogVersion,
        },
      }),
      catalog,
      engineering: engineeringBody(),
      activatedAt: '2026-08-26T00:00:00.000Z',
    });
    const paths = {
      runtimeRoot: root,
      currentPath: path.join(root, 'current.json'),
      setsDir: path.join(root, 'sets'),
    };

    stageAuthorityDomainShards(paths, materialized);
    stageAuthorityDomainShards(paths, materialized);

    expect(existsSync(paths.currentPath)).toBe(false);
    expect(readFileSync(
      path.join(paths.setsDir, materialized.manifest.shardSetId, 'manifest.json'),
      'utf8',
    )).toContain(materialized.manifest.shardSetHash);
    writeFileSync(
      path.join(paths.setsDir, materialized.manifest.shardSetId, 'root.json'),
      '{}\n',
      'utf8',
    );
    expect(() => stageAuthorityDomainShards(paths, materialized)).toThrow(
      /refusing to overwrite staged Authority shard/u,
    );
  });

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
    expect(materialized.neighborhoods[NEIGHBOR]).toBeDefined();
    expect(materialized.details[NEIGHBOR]).toBeDefined();
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
      localeProfileVersion: expect.stringMatching(/^alp-[a-f0-9]{64}$/u),
      match: { authority: true, catalog: true, teaching: null },
    });
    expect(JSON.stringify(browserRoot)).not.toContain(SNAPSHOT_ID);
    expect(JSON.stringify(browserRoot)).not.toContain(RELEASE_ID);
    expect(JSON.stringify(browserRoot)).not.toContain(CATALOG_ID);
    const rootBytes = Buffer.byteLength(`${JSON.stringify(materialized.root)}\n`);
    expect(rootBytes).toBeLessThan(AUTHORITY_SHARD_PAYLOAD_BUDGETS.root);
    expect(rootBytes).toBeLessThan(80_000);
  });

  it('uses a controlled unavailable label when an Authority object has no human-readable label', () => {
    const projected = projectAuthorityObject({
      ...objectRow(MODELING, MODELING),
      payload: {},
    }, catalogRuntime());
    expect(projected.label).toBe('名称暂不可用');
    expect(projected.label).not.toBe(MODELING);
  });

  it('does not expose an internal semanticName slug when preferred labels are missing', () => {
    const projected = projectAuthorityObject({
      ...objectRow(MODELING, 'positive_feedback_inner_loop'),
      payload: {},
    }, catalogRuntime());
    expect(projected.label).toBe('名称暂不可用');
    expect(projected.label).not.toBe('positive_feedback_inner_loop');
  });

  it('resolves one preferred zh-CN label and deterministic safe aliases', () => {
    const objects = engineeringBody().objects;
    const context = createAuthorityLabelResolverContext({
      snapshot: {
        snapshotId: SNAPSHOT_ID,
        snapshotHash: SNAPSHOT_HASH,
        releaseId: RELEASE_ID,
      },
      objects,
      v2Evidence: v2Evidence([
        { entityId: MODELING, label: '系统建模', labelType: 'canonical_preferred' },
        { entityId: MODELING, label: '建模', labelType: 'alternative' },
        { entityId: MODELING, label: '对象到系统', labelType: 'alternative' },
        { entityId: MODELING, label: '建模', labelType: 'alternative' },
      ]),
    });
    expect(resolveAuthorityLabel(context, MODELING)).toEqual({
      status: 'available',
      label: '系统建模',
      aliases: ['对象到系统', '建模'],
    });
    expect(isSafeAuthorityLabel('系统建模')).toBe(true);
    expect(isSafeAuthorityLabel('positive_feedback_inner_loop')).toBe(false);
  });

  it('accepts only digest-bound r4 presentation evidence for mathematical natural-language labels', () => {
    const label = '易于推广至多输入和/或多输出系统的方法';
    const evidence = v2Evidence([{ entityId: MODELING, label, labelType: 'canonical_preferred' }]);
    const sourceHash = createHash('sha256').update(label).digest('hex');
    evidence.multilingualLabels[0] = {
      ...evidence.multilingualLabels[0]!,
      payload: {
        contract: 'actkg-r4-sealed-presentation-label/v1',
        entityId: MODELING,
        labelSha256: sourceHash,
        sourceArtifact: 'localized-content-index.jsonl',
        sourceArtifactSha256: 'a'.repeat(64),
        sourceRecordId: 'ctl10n:test',
        sourceRecordHash: 'b'.repeat(64),
        bundleDigest: 'c'.repeat(64),
        manifestSha256: 'd'.repeat(64),
      },
    };
    const snapshot = { snapshotId: SNAPSHOT_ID, snapshotHash: SNAPSHOT_HASH, releaseId: RELEASE_ID };
    const object = { ...objectRow(MODELING, label), canonicalType: 'DomainConcept' };
    expect(isSafeAuthorityLabel(label, object.canonicalType, true)).toBe(false);
    expect(resolveAuthorityLabel(createAuthorityLabelResolverContext({
      snapshot,
      objects: [object],
      v2Evidence: evidence,
    }), MODELING).label).toBe(label);

    const drifted = {
      ...evidence,
      multilingualLabels: [{ ...evidence.multilingualLabels[0]!, payload: { ...evidence.multilingualLabels[0]!.payload as object, labelSha256: 'e'.repeat(64) } }],
    };
    expect(resolveAuthorityLabel(createAuthorityLabelResolverContext({
      snapshot,
      objects: [object],
      v2Evidence: drifted,
    }), MODELING).status).toBe('unavailable');

    const locator = '../runtime/private';
    const locatorEvidence = v2Evidence([{ entityId: MODELING, label: locator, labelType: 'canonical_preferred' }]);
    locatorEvidence.multilingualLabels[0] = {
      ...locatorEvidence.multilingualLabels[0]!,
      payload: {
        contract: 'actkg-r4-sealed-presentation-label/v1',
        entityId: MODELING,
        labelSha256: createHash('sha256').update(locator).digest('hex'),
        sourceArtifact: 'domain-projection.json',
        sourceArtifactSha256: 'a'.repeat(64),
        sourceRecordId: MODELING,
        sourceRecordHash: 'b'.repeat(64),
        bundleDigest: 'c'.repeat(64),
        manifestSha256: 'd'.repeat(64),
      },
    };
    expect(resolveAuthorityLabel(createAuthorityLabelResolverContext({
      snapshot,
      objects: [{ ...objectRow(MODELING, locator), canonicalType: 'DomainConcept' }],
      v2Evidence: locatorEvidence,
    }), MODELING).status).toBe('unavailable');

    const formula = String.raw`.\\Phi(s)=G(s)/(1+G(s)H(s))`;
    const formulaEvidence = v2Evidence([{ entityId: MODELING, label: formula, labelType: 'canonical_preferred' }]);
    formulaEvidence.multilingualLabels[0] = {
      ...formulaEvidence.multilingualLabels[0]!,
      payload: {
        contract: 'actkg-r4-sealed-presentation-label/v1',
        entityId: MODELING,
        labelSha256: createHash('sha256').update(formula).digest('hex'),
        sourceArtifact: 'domain-projection.json',
        sourceArtifactSha256: 'a'.repeat(64),
        sourceRecordId: MODELING,
        sourceRecordHash: 'b'.repeat(64),
        bundleDigest: 'c'.repeat(64),
        manifestSha256: 'd'.repeat(64),
      },
    };
    expect(isSafeAuthorityLabel(formula, 'Formula', true)).toBe(false);
    expect(resolveAuthorityLabel(createAuthorityLabelResolverContext({
      snapshot,
      objects: [{ ...objectRow(MODELING, formula), canonicalType: 'Formula' }],
      v2Evidence: formulaEvidence,
    }), MODELING).label).toBe(formula);
  });

  it('accepts explicit leading LaTeX formulas but keeps path labels unsafe', () => {
    expect(isSafeAuthorityLabel('\\Phi(s)=...', 'Formula', true)).toBe(true);
    expect(isSafeAuthorityLabel('\\\\Phi(\\\\omega)=...', 'Formula', true)).toBe(true);
    expect(isSafeAuthorityLabel('\\(G(s)=1\\)', 'Formula', true)).toBe(true);
    expect(isSafeAuthorityLabel('\\\\begin{aligned} G(s)=1 \\\\end{aligned}', 'Formula', true)).toBe(true);
    expect(isSafeAuthorityLabel('\\frac{1}{s+1}', 'Formula', true)).toBe(true);
    expect(isSafeAuthorityLabel('\\alpha.ext', 'Formula', true)).toBe(true);
    expect(isSafeAuthorityLabel('\\sin\\omega', 'Formula', true)).toBe(true);
    expect(isSafeAuthorityLabel('\\dir\\file', 'Formula', true)).toBe(true);
    expect(isSafeAuthorityLabel('/runtime/formula')).toBe(false);
    expect(isSafeAuthorityLabel('C:\\runtime\\formula')).toBe(false);
    expect(isSafeAuthorityLabel('\\server\\share\\formula')).toBe(false);
    expect(isSafeAuthorityLabel('\\\\server\\share\\formula')).toBe(false);
    expect(isSafeAuthorityLabel('\\Users\\admin\\file(1)')).toBe(false);
    expect(isSafeAuthorityLabel('\\Windows\\System32\\file=1')).toBe(false);
    expect(isSafeAuthorityLabel('folder name\\file.txt')).toBe(false);
    expect(isSafeAuthorityLabel('folder\\file(1).txt')).toBe(false);
    expect(isSafeAuthorityLabel('\\Program Files\\app\\file.txt')).toBe(false);
    expect(isSafeAuthorityLabel('\\Users\\admin\\file{1}.txt')).toBe(false);
    expect(isSafeAuthorityLabel('\\\\server name\\share\\file.txt')).toBe(false);
    expect(isSafeAuthorityLabel('folder name/file.txt')).toBe(false);
    expect(isSafeAuthorityLabel('../runtime/formula')).toBe(false);
  });

  it('keeps every grouped-array dotted token fail-closed without a generic exception', () => {
    const formula = String.raw`1 .\end{array}\right.`;
    const noSpaceFormula = String.raw`1.\end{array}\right.`;
    const variableFormula = String.raw`x.\end{array}\right.`;
    const leadingFormula = String.raw`.\end{array}\right.`;
    for (const label of [formula, noSpaceFormula, variableFormula, leadingFormula]) {
      expect(isSafeAuthorityLabel(label, 'Formula', true)).toBe(false);
      expect(isSafeAuthorityLabel(label, 'Formula')).toBe(false);
      expect(isSafeAuthorityLabel(label, 'DomainConcept')).toBe(false);
    }

    const object = {
      ...objectRow(MODELING, formula),
      canonicalType: 'Formula',
      payload: { displayName: formula },
    };
    const context = createAuthorityLabelResolverContext({
      snapshot: { snapshotId: SNAPSHOT_ID, snapshotHash: SNAPSHOT_HASH, releaseId: RELEASE_ID },
      objects: [object],
      v2Evidence: v2Evidence([]),
    });
    expect(resolveAuthorityLabel(context, MODELING)).toEqual({
      status: 'unavailable',
      label: null,
      aliases: [],
    });

    for (const path of [
      String.raw`1 .\end{array}`,
      String.raw`.\end{array}`,
      String.raw`1 .\end{array}\file`,
      String.raw`1 .\end{array}\right.\file`,
      String.raw`x.\file`,
      String.raw`x./file`,
      String.raw`1 .\foo`,
      String.raw`1 .\End{array}\right.`,
      String.raw`1 .\end {array}\right.`,
      String.raw`1 .\end{array} \right.`,
      String.raw`1 .\end{array}\right. `,
      String.raw`1 .\end{array}\right`,
      String.raw`1 .\end{array}\right.X`,
      String.raw`1 .\end{array}\right./file`,
      String.raw`1 .\end{array}\right.\\server\share`,
      String.raw`1 .\end{array}\right. + 2 .\end{array}\right.`,
      String.raw`1 .\end\file`,
      String.raw`x.\file 1 .\end{array}\right.`,
      String.raw`x./file 1 .\end{array}\right.`,
    ]) {
      expect(isSafeAuthorityLabel(path, 'Formula', true)).toBe(false);
      expect(isSafeAuthorityLabel(path, 'DomainConcept')).toBe(false);
    }
  });

  it('keeps the controlled v0.18 Formula display set strict for dotted tokens', () => {
    expect(V018_FORMULA_DISPLAY_NAMES).toHaveLength(20);
    const dotted = V018_FORMULA_DISPLAY_NAMES.filter((label) => /\.\\/u.test(label));
    expect(dotted).toHaveLength(2);
    for (const label of dotted) {
      expect(isSafeAuthorityLabel(label, 'Formula', true)).toBe(false);
      expect(isSafeAuthorityLabel(label, 'Formula')).toBe(false);
      expect(isSafeAuthorityLabel(label, 'DomainConcept')).toBe(false);
    }
    for (const label of V018_FORMULA_DISPLAY_NAMES.filter((item) => !dotted.includes(item))) {
      expect(isSafeAuthorityLabel(label, 'Formula', true)).toBe(true);
      expect(isSafeAuthorityLabel(label, 'Formula')).toBe(false);
      expect(isSafeAuthorityLabel(label, 'DomainConcept')).toBe(false);
    }
  });

  it('anchors the fallback inventory to the real v0.18 Formula source scan', () => {
    const projection = JSON.parse(readFileSync(path.join(
      process.cwd(),
      'course-content/authoring/knowledge/releases/control-theory-engineering-v0.18/act-projection.json',
    ), 'utf8')) as {
      nodes: Array<{ entity_id?: string; entity_type?: string; display_name?: string }>;
    };
    const formulas = projection.nodes.filter((node) => node.entity_type === 'Formula');
    expect(formulas).toHaveLength(1779);
    const dotted = formulas.filter((node) => node.display_name?.includes('.\\'));
    expect(dotted).toHaveLength(11);
    expect(dotted.find((node) => node.entity_id === V018_CTF_ID)?.display_name).toBe(V018_CTF_DISPLAY_NAME);
    expect(dotted.find((node) => node.entity_id === 'ctkg:v3e-object-7c68147c796fde027aa88ac1')?.display_name).toContain('\\end{array}');

    const pinnedIds = [
      V018_CTF_ID,
      'ctf:224fe8007c92e0365df88c71',
      'ctf:98056be65217199a1b9bfad7',
      'ctf:aeac8b41a8dfab7e5ea9be5f',
      'ctkg:v3e-object-0796fedf8fa2a340f1d800ec',
      'ctkg:v3e-object-7e93787bebbb427bd59b0d98',
      'ctkg:v3e-object-82b673b7659603ab09a48818',
      'ctkg:v3e-object-cfd98dee3afa5c44a0f0c44f',
      'ctkg:v3e-object-093e69f52a564305cb43330f',
      'ctkg:v3e-object-a006a76a7e0bcccabddd6398',
    ];
    expect(pinnedIds).toHaveLength(10);
    for (const id of pinnedIds) {
      const row = dotted.find((node) => node.entity_id === id);
      expect(row?.display_name).toBeTypeOf('string');
      const context = createAuthorityLabelResolverContext({
        snapshot: {
          snapshotId: V018_SNAPSHOT_ID,
          snapshotHash: V018_SNAPSHOT_HASH,
          releaseId: V018_RELEASE_ID,
        },
        objects: [{
          ...objectRow(id, row?.display_name ?? ''),
          canonicalType: 'Formula',
          payload: { displayName: row?.display_name },
        }],
        v2Evidence: v018Evidence([]),
      });
      expect(resolveAuthorityLabel(context, id).status).toBe('available');
    }
    const hardRow = dotted.find((node) => node.entity_id === 'ctkg:v3e-object-7c68147c796fde027aa88ac1')!;
    const hardContext = createAuthorityLabelResolverContext({
      snapshot: {
        snapshotId: V018_SNAPSHOT_ID,
        snapshotHash: V018_SNAPSHOT_HASH,
        releaseId: V018_RELEASE_ID,
      },
      objects: [{
        ...objectRow(hardRow.entity_id!, hardRow.display_name!),
        canonicalType: 'Formula',
        payload: { displayName: hardRow.display_name },
      }],
      v2Evidence: v018Evidence([]),
    });
    expect(resolveAuthorityLabel(hardContext, hardRow.entity_id!).status).toBe('unavailable');
  });

  it('uses only the immutable record-bound v0.18 Formula fallback pin', () => {
    expect(isSafeAuthorityLabel(V018_CTF_DISPLAY_NAME, 'Formula', true)).toBe(false);
    const object = {
      ...objectRow(V018_CTF_ID, V018_CTF_DISPLAY_NAME),
      canonicalType: 'Formula',
      payload: { displayName: V018_CTF_DISPLAY_NAME },
    };
    const snapshot = {
      snapshotId: V018_SNAPSHOT_ID,
      snapshotHash: V018_SNAPSHOT_HASH,
      releaseId: V018_RELEASE_ID,
    };
    const context = createAuthorityLabelResolverContext({
      snapshot,
      objects: [object],
      v2Evidence: v018Evidence([]),
    });
    expect(resolveAuthorityLabel(context, V018_CTF_ID)).toEqual({
      status: 'available',
      label: V018_CTF_DISPLAY_NAME,
      aliases: [],
    });

    for (const driftedSnapshot of [
      { ...snapshot, snapshotId: 'snap-drift' },
      { ...snapshot, snapshotHash: 'f'.repeat(64) },
    ]) {
      expect(resolveAuthorityLabel(createAuthorityLabelResolverContext({
        snapshot: driftedSnapshot,
        objects: [object],
        v2Evidence: v018Evidence([]),
      }), V018_CTF_ID).status).toBe('unavailable');
    }
    expect(() => createAuthorityLabelResolverContext({
      snapshot: { ...snapshot, releaseId: 'ctr:release:drift' },
      objects: [object],
      v2Evidence: v018Evidence([]),
    })).toThrow(/profile|admission/u);

    for (const profileDrift of [
      { profileId: 'ctr:profile:drift', profileSha256: V018_PROFILE_SHA256 },
      { profileId: V018_PROFILE_ID, profileSha256: 'f'.repeat(64) },
    ]) {
      const evidence = v018Evidence([]);
      evidence.profiles = evidence.profiles.map((profile) => (
        profile.profileKey === 'act' ? { ...profile, ...profileDrift } : profile
      ));
      expect(resolveAuthorityLabel(createAuthorityLabelResolverContext({
        snapshot,
        objects: [object],
        v2Evidence: evidence,
      }), V018_CTF_ID).status).toBe('unavailable');
    }

    const preferred = createAuthorityLabelResolverContext({
      snapshot,
      objects: [object],
      v2Evidence: v018Evidence([
        { entityId: V018_CTF_ID, label: V018_CTF_DISPLAY_NAME, labelType: 'canonical_preferred' },
      ]),
    });
    expect(resolveAuthorityLabel(preferred, V018_CTF_ID).status).toBe('unavailable');

    const hardPath = createAuthorityLabelResolverContext({
      snapshot,
      objects: [{ ...object, payload: { displayName: 'm=folder/file.txt' } }],
      v2Evidence: v018Evidence([]),
    });
    expect(resolveAuthorityLabel(hardPath, V018_CTF_ID).status).toBe('unavailable');

    const changedType = createAuthorityLabelResolverContext({
      snapshot,
      objects: [{ ...object, canonicalType: 'DomainConcept' }],
      v2Evidence: v018Evidence([]),
    });
    expect(resolveAuthorityLabel(changedType, V018_CTF_ID).status).toBe('unavailable');

    const changedId = createAuthorityLabelResolverContext({
      snapshot,
      objects: [{ ...object, canonicalId: 'ctf:formula-drift' }],
      v2Evidence: v018Evidence([]),
    });
    expect(resolveAuthorityLabel(changedId, 'ctf:formula-drift').status).toBe('unavailable');

    const changedDisplayName = createAuthorityLabelResolverContext({
      snapshot,
      objects: [{ ...object, payload: { displayName: `${V018_CTF_DISPLAY_NAME} ` } }],
      v2Evidence: v018Evidence([]),
    });
    expect(resolveAuthorityLabel(changedDisplayName, V018_CTF_ID).status).toBe('unavailable');
  });

  it('materializes the pinned v0.18 Formula record without weakening ordinary labels', () => {
    const catalog = v018FormulaCatalogRuntime();
    const materialized = buildAuthorityDomainShards({
      envelope: v018FormulaEnvelope(catalog),
      catalog,
      engineering: v018FormulaEngineeringBody(),
    });
    expect(materialized.domainDefaults['system-modeling'].objects.find((object) => object.id === V018_CTF_ID)).toMatchObject({
      id: V018_CTF_ID,
      label: V018_CTF_DISPLAY_NAME,
    });
    expect(isSafeAuthorityLabel(V018_CTF_DISPLAY_NAME, 'DomainConcept', true)).toBe(false);
    expect(materialized.domainDefaults['time-domain-analysis'].objects.find((object) => object.id === TIME)?.label).toBe('时域对象');
  });

  it('rejects path evidence embedded anywhere before allowing Formula separators', () => {
    const embeddedPaths = [
      'x=folder/file.txt',
      'x=folder\\file.txt',
      'x=folder/subdir/file',
      'x=foo\\bar\\baz',
      '(folder/subdir/file)',
      '[folder/subdir/file]',
      '"folder/subdir/file"',
      '\'foo\\bar\\baz\'',
      ' folder/subdir/file ',
      'folder/subdir/file,',
      'folder/subdir/file;',
      'folder/subdir/file:',
      'x=(folder/subdir/file)',
      'x="foo\\bar\\baz"',
      'x= foo/bar/baz ;',
      'folder/file.txt',
      'foo\\bar.ext',
      'f=C:\\Users\\a.txt',
      'x=/runtime/formula',
      'x=../runtime/formula',
      'x=~/runtime/formula',
      'x=https://example.test/formula',
      'x=file:///runtime/formula',
      'x=\\\\server\\share\\file.txt',
      'x=\\\\server\\share',
    ];
    for (const label of embeddedPaths) {
      expect(isSafeAuthorityLabel(label, 'Formula', true)).toBe(false);
      expect(isSafeAuthorityLabel(label, 'DomainConcept')).toBe(false);
      expect(isSafeAuthorityLabel(label)).toBe(false);
    }
  });

  it.each([
    ['ASCII candidate', 'folder/subdir/file'],
    ['ASCII quotes', '"folder/subdir/file"'],
    ['Unicode double quotes', '“folder/subdir/file”'],
    ['Unicode single quotes', '‘foo\\bar\\baz’'],
    ['book-title brackets', '《folder/subdir/file》'],
    ['em dash context', '—folder/subdir/file—'],
    ['Chinese adjacency', '前folder/subdir/file后'],
    ['maximal candidate with an atomic suffix trap', 'folder/subdir/fileA/B/C'],
    ['reverse maximal candidate context', 'A/B/Cfolder/subdir/file'],
  ])('rejects a bounded relative path with %s', (_case, label) => {
    expect(isSafeAuthorityLabel(label, 'Formula', true)).toBe(false);
    expect(isSafeAuthorityLabel(label, 'Formula')).toBe(false);
    expect(isSafeAuthorityLabel(label, 'DomainConcept')).toBe(false);
  });

  it.each([
    ['A/B/C', 'A/B/C'],
    ['a/b/c', 'a/b/c'],
    ['x/y/z', 'x/y/z'],
    ['Chinese adjacency around atomic segments', '中文A/B/C中文'],
    ['non-leading reviewed formula', 'G(s)=K/(s(s+1))'],
    ['assignment context around atomic segments', 'x=A/B/C'],
    ['parenthesized atomic segments', '(a/b/c)'],
    ['quoted atomic segments', '"A/B/C"'],
  ])('keeps bounded single-character mathematical atoms: %s', (_case, label) => {
    expect(isSafeAuthorityLabel(label, 'Formula', true)).toBe(true);
    expect(isSafeAuthorityLabel(label, 'Formula')).toBe(false);
    expect(isSafeAuthorityLabel(label, 'DomainConcept')).toBe(false);
  });

  it.each([
    ['ordinary path', 'folder/subdir/file'],
    ['backslash path', 'foo\\bar\\baz'],
    ['parenthesized path', '(folder/subdir/file)'],
    ['quoted path', '"foo\\bar\\baz"'],
    ['two-segment filename', 'folder/file.txt'],
    ['backslash filename', 'foo\\bar.ext'],
  ])('rejects ordinary relative path structure: %s', (_case, label) => {
    expect(isSafeAuthorityLabel(label, 'Formula', true)).toBe(false);
    expect(isSafeAuthorityLabel(label, 'Formula')).toBe(false);
    expect(isSafeAuthorityLabel(label, 'DomainConcept')).toBe(false);
  });

  it('requires a trusted Formula profile for leading-backslash formulas', () => {
    const formulaSamples = [
      '\\Phi(s)=G(s)/(1+G(s)H(s))',
      '\\\\begin{aligned} G(s)=1 \\\\end{aligned}',
      '\\mathcal{L}\\{\\sin \\omega t\\}=\\int_{0}^{\\infty}(\\sin \\omega t)e^{-st}dt',
      '\\omega_{r}=\\omega_{n} \\sqrt{1-2 \\zeta^{2}}, \\quad \\zeta<0.707',
    ];
    for (const sample of formulaSamples) {
      expect(isSafeAuthorityLabel(sample, 'Formula', true)).toBe(true);
      expect(isSafeAuthorityLabel(sample, 'Formula')).toBe(false);
      expect(isSafeAuthorityLabel(sample, 'DomainConcept')).toBe(false);
      expect(isSafeAuthorityLabel(sample, 'Unknown')).toBe(false);
      expect(isSafeAuthorityLabel(sample)).toBe(false);
    }
  });

  it('allows only original LF and CRLF in trusted Formula runtime labels', () => {
    const lf = '\\begin{aligned}\nG(s)=1\n\\end{aligned}';
    const crlf = '\\begin{aligned}\r\nG(s)=1\r\n\\end{aligned}';
    expect(isSafeAuthorityLabel(lf, 'Formula', true)).toBe(true);
    expect(isSafeAuthorityLabel(crlf, 'Formula', true)).toBe(true);
    expect(isSafeAuthorityLabel(lf, 'Formula')).toBe(false);
    expect(isSafeAuthorityLabel(crlf, 'Formula')).toBe(false);

    const object = {
      ...objectRow(MODELING, crlf),
      canonicalType: 'Formula',
      payload: { displayName: crlf },
    };
    const context = createAuthorityLabelResolverContext({
      snapshot: { snapshotId: SNAPSHOT_ID, snapshotHash: SNAPSHOT_HASH, releaseId: RELEASE_ID },
      objects: [object],
      v2Evidence: v2Evidence([]),
    });
    expect(resolveAuthorityLabel(context, MODELING)).toMatchObject({
      status: 'available',
      label: crlf,
      aliases: [],
    });
  });

  it('rejects tabs, NUL, isolated CR, other C0 controls, and DEL', () => {
    const unsafe = [
      '\\Phi(s)=1\t',
      '\\Phi(s)=1\u0000',
      '\\Phi(s)=1\rnext',
      '\\Phi(s)=1\u0001',
      '\\Phi(s)=1\u000b',
      '\\Phi(s)=1\u000c',
      '\\Phi(s)=1\u001f',
      '\\Phi(s)=1\u007f',
    ];
    for (const label of unsafe) expect(isSafeAuthorityLabel(label, 'Formula', true)).toBe(false);
  });

  it('rejects rooted and UNC path-shaped labels even when Formula is claimed', () => {
    const pathLabels = [
      '\\Users{old}\\admin\\file.txt',
      '\\sin\\share\\file.txt',
    ];
    for (const label of pathLabels) {
      expect(isSafeAuthorityLabel(label, 'Formula', true)).toBe(false);
      expect(isSafeAuthorityLabel(label, 'DomainConcept')).toBe(false);
      expect(isSafeAuthorityLabel(label, 'Unknown')).toBe(false);
      expect(isSafeAuthorityLabel(label)).toBe(false);
    }
    for (const label of ['\\\\server name\\share\\file.txt', '\\Program Files\\app\\file.txt']) {
      expect(isSafeAuthorityLabel(label, 'Formula', true)).toBe(false);
    }
    expect(isSafeAuthorityLabel('\\\\server\\share\\formula', 'Formula', true)).toBe(false);
    expect(isSafeAuthorityLabel('\\Users\\file.txt', 'Formula', true)).toBe(false);
    expect(isSafeAuthorityLabel('\\\\server\\share', 'Formula', true)).toBe(false);
    for (const label of [
      'folder name\\file.txt',
      'folder\\file(1).txt',
      '\\Program Files\\app\\file.txt',
      '\\Users\\admin\\file{1}.txt',
      '\\\\server name\\share\\file.txt',
      'folder name/file.txt',
    ]) {
      expect(isSafeAuthorityLabel(label, 'Formula', true)).toBe(false);
      expect(isSafeAuthorityLabel(label, 'DomainConcept')).toBe(false);
    }
  });

  it('rejects path syntax and control characters for Formula labels', () => {
    const unsafe = [
      '/runtime/formula',
      '~/runtime/formula',
      './runtime/formula',
      '../runtime/formula',
      'C:\\runtime\\formula',
      'file:/runtime/formula',
      'https://example.test/formula',
      'folder name\\file.txt',
      'folder name/file.txt',
      'formula\u0000value',
    ];
    for (const label of unsafe) expect(isSafeAuthorityLabel(label, 'Formula', true)).toBe(false);
  });

  it('fails closed without leaking identity or payload for rejected labels', () => {
    const secretId = 'ctf:formula-path-secret';
    const secretPayload = 'payload-secret-not-for-display';
    const pathLabel = '\\Users{old}\\admin\\file.txt';
    const object = {
      ...objectRow(secretId, pathLabel),
      canonicalType: 'Formula',
      payload: { displayName: pathLabel, secret: secretPayload },
    };
    const context = createAuthorityLabelResolverContext({
      snapshot: { snapshotId: SNAPSHOT_ID, snapshotHash: SNAPSHOT_HASH, releaseId: RELEASE_ID },
      objects: [object],
      v2Evidence: v2Evidence([]),
    });
    const resolved = resolveAuthorityLabel(context, secretId);
    expect(resolved).toEqual({ status: 'unavailable', label: null, aliases: [] });
    expect(JSON.stringify(resolved)).not.toContain(secretId);
    expect(JSON.stringify(resolved)).not.toContain(secretPayload);
  });

  it('does not infer Formula type from payload text', () => {
    const object = {
      ...objectRow(MODELING, '\\Phi(s)=G(s)/(1+G(s)H(s))'),
      canonicalType: 'DomainConcept',
      payload: {
        displayName: '\\Phi(s)=G(s)/(1+G(s)H(s))',
        entityType: 'Formula',
        canonicalType: 'Formula',
      },
    };
    const context = createAuthorityLabelResolverContext({
      snapshot: { snapshotId: SNAPSHOT_ID, snapshotHash: SNAPSHOT_HASH, releaseId: RELEASE_ID },
      objects: [object],
      v2Evidence: v2Evidence([]),
    });
    expect(resolveAuthorityLabel(context, MODELING).status).toBe('unavailable');
  });

  it('uses the runtime displayName only when no preferred row exists', () => {
    const objects = engineeringBody().objects.map((object) => (
      object.canonicalId === MODELING
        ? { ...object, payload: { displayName: '运行时模型' } }
        : object
    ));
    const context = createAuthorityLabelResolverContext({
      snapshot: { snapshotId: SNAPSHOT_ID, snapshotHash: SNAPSHOT_HASH, releaseId: RELEASE_ID },
      objects,
      v2Evidence: v2Evidence([
        { entityId: MODELING, label: '模型别名', labelType: 'alternative' },
      ]),
    });
    expect(resolveAuthorityLabel(context, MODELING)).toEqual({
      status: 'available',
      label: '运行时模型',
      aliases: ['模型别名'],
    });
  });

  it('detaches resolver payloads from mutable engineering input', () => {
    const payload = { displayName: '初始运行时名称', nested: { source: 'fixture' } };
    const objects = engineeringBody().objects.map((object) => (
      object.canonicalId === MODELING ? { ...object, payload } : object
    ));
    const context = createAuthorityLabelResolverContext({
      snapshot: { snapshotId: SNAPSHOT_ID, snapshotHash: SNAPSHOT_HASH, releaseId: RELEASE_ID },
      objects,
      v2Evidence: v2Evidence([]),
    });
    payload.displayName = '被外部改写的名称';
    payload.nested.source = '被外部改写';
    expect(resolveAuthorityLabel(context, MODELING)).toMatchObject({
      status: 'available',
      label: '初始运行时名称',
      aliases: [],
    });
    expect(context.objects[0]!.canonicalType).toBe('DomainConcept');
    expect(Object.isFrozen(context.objects[0]!.payload)).toBe(true);
  });

  it('fails closed for unsafe candidates, duplicate preferred rows, and profile drift', () => {
    const objects = engineeringBody().objects;
    const unsafePreferred = createAuthorityLabelResolverContext({
      snapshot: { snapshotId: SNAPSHOT_ID, snapshotHash: SNAPSHOT_HASH, releaseId: RELEASE_ID },
      objects,
      v2Evidence: v2Evidence([
        { entityId: MODELING, label: 'node:internal', labelType: 'canonical_preferred' },
      ]),
    });
    expect(resolveAuthorityLabel(unsafePreferred, MODELING).status).toBe('unavailable');

    const unsafeAlias = createAuthorityLabelResolverContext({
      snapshot: { snapshotId: SNAPSHOT_ID, snapshotHash: SNAPSHOT_HASH, releaseId: RELEASE_ID },
      objects,
      v2Evidence: v2Evidence([
        { entityId: MODELING, label: '系统建模', labelType: 'canonical_preferred' },
        { entityId: MODELING, label: '', labelType: 'alternative' },
      ]),
    });
    expect(resolveAuthorityLabel(unsafeAlias, MODELING).status).toBe('unavailable');

    expect(() => createAuthorityLabelResolverContext({
      snapshot: { snapshotId: SNAPSHOT_ID, snapshotHash: SNAPSHOT_HASH, releaseId: RELEASE_ID },
      objects,
      v2Evidence: v2Evidence([
        { entityId: MODELING, label: '一个主标签', labelType: 'canonical_preferred' },
        { entityId: MODELING, label: '另一个主标签', labelType: 'canonical_preferred' },
      ]),
    })).toThrow(/duplicate preferred/u);

    expect(() => createAuthorityLabelResolverContext({
      snapshot: { snapshotId: SNAPSHOT_ID, snapshotHash: SNAPSHOT_HASH, releaseId: RELEASE_ID },
      objects,
      v2Evidence: v2Evidence([
        { entityId: MODELING, label: '一个标签', labelType: 'canonical_preferred' },
      ], 'other-release'),
    })).toThrow(/profile|admission|label row identity drifted/u);

    const bindingDrift = v2Evidence([
      { entityId: MODELING, label: '一个标签', labelType: 'canonical_preferred' },
    ]);
    bindingDrift.admissionBinding = { ...bindingDrift.admissionBinding, releaseId: 'other-release' };
    expect(() => createAuthorityLabelResolverContext({
      snapshot: { snapshotId: SNAPSHOT_ID, snapshotHash: SNAPSHOT_HASH, releaseId: RELEASE_ID },
      objects,
      v2Evidence: bindingDrift,
    })).toThrow(/admission binding/u);
  });

  it('materializes v2 label aliases without changing identity or relation endpoints', () => {
    const catalog = catalogRuntime();
    const built = envelope({
      catalog: { catalogId: catalog.catalogId, catalogHash: catalog.catalogHash, catalogVersion: catalog.catalogVersion },
    });
    const engineering = engineeringBody();
    const materialized = buildAuthorityDomainShards({
      envelope: built,
      catalog,
      engineering: {
        ...engineering,
        v2Evidence: v2Evidence([
          { entityId: MODELING, label: '系统建模', labelType: 'canonical_preferred' },
          { entityId: MODELING, label: '建模', labelType: 'alternative' },
          { entityId: NEIGHBOR, label: '邻域对象', labelType: 'canonical_preferred' },
          { entityId: NEIGHBOR, label: '邻域别名', labelType: 'alternative' },
        ]),
      },
    });
    expect(materialized.domainDefaults['system-modeling'].objects.find((object) => object.id === MODELING)).toMatchObject({
      id: MODELING,
      label: '系统建模',
      aliases: ['建模'],
    });
    expect(materialized.families['system-modeling:association'].relations[0]).toMatchObject({
      sourceId: MODELING,
      targetId: NEIGHBOR,
    });
    const family = materialized.families['system-modeling:association'];
    expect(family.boundaries.find((boundary) => boundary.canonicalId === NEIGHBOR)).toMatchObject({
      canonicalId: NEIGHBOR,
      aliases: ['邻域别名'],
    });
    let state = createEmptyAuthorityShardWorkspace();
    state = mergeAuthorityShard(state, projectAuthorityLearnerShard(materialized.root));
    state = mergeAuthorityShard(state, projectAuthorityLearnerShard(materialized.domainDefaults['system-modeling']));
    const mergedFamily = mergeAuthorityShard(state, projectAuthorityLearnerShard(family));
    expect(mergedFamily.rejectedShardKeys).not.toContain('relation-family:system-modeling:association');
    expect(mergedFamily.boundaryRefsByCanonicalId[NEIGHBOR]?.aliases).toEqual(['邻域别名']);
    expect(materialized.details[MODELING]?.node.aliases).toEqual(['建模']);
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

  it('rejects same-envelope label drift before overwriting the shard-store object', () => {
    const { materialized } = writeShards();
    let state = createEmptyAuthorityShardWorkspace();
    state = mergeAuthorityShard(state, projectAuthorityLearnerShard(materialized.root));
    state = mergeAuthorityShard(state, projectAuthorityLearnerShard(materialized.domainDefaults['system-modeling']));
    const original = state.objectsByCanonicalId[MODELING];
    const drifted = projectAuthorityLearnerShard({
      ...materialized.neighborhoods[MODELING],
      objects: materialized.neighborhoods[MODELING]!.objects.map((object) => (
        object.id === MODELING ? { ...object, label: '漂移名称' } : object
      )),
    });
    const rejected = mergeAuthorityShard(state, drifted);
    expect(rejected.rejectedShardKeys).toContain('node-neighborhood:ctc:modeling-test-object');
    expect(rejected.objectsByCanonicalId[MODELING]).toBe(original);
    expect(rejected.objectsByCanonicalId[MODELING]?.label).not.toBe('漂移名称');

    const aliasDrifted = projectAuthorityLearnerShard({
      ...materialized.neighborhoods[MODELING],
      objects: materialized.neighborhoods[MODELING]!.objects.map((object) => (
        object.id === MODELING ? { ...object, aliases: ['漂移别名'] } : object
      )),
    });
    const aliasRejected = mergeAuthorityShard(state, aliasDrifted);
    expect(aliasRejected.rejectedShardKeys).toContain('node-neighborhood:ctc:modeling-test-object');
    expect(aliasRejected.objectsByCanonicalId[MODELING]).toBe(original);
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
