/**
 * Authority domain display catalog (#1369 / Issue #1369).
 */

import {
  createHash,
  randomUUID,
} from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  readActiveDomainCatalog,
  readActiveDomainRootPresentation,
} from '@/app/api/knowledge/_active-authority';
import {
  AGGREGATE_ENTRY_ID,
  DomainCatalogBuildError,
  DomainCatalogLoadError,
  DomainCatalogValidationError,
  REGISTERED_PEER_DOMAIN_IDS,
  assertRootPresentationExcludesAuthorityIdentity,
  buildAuthorityDomainCatalog,
  buildAuthorityDomainRootPresentation,
  catalogDigest,
  loadAuthorityDomainCatalogRuntime,
  loadAuthorityDomainRootPresentation,
  materializeAuthorityDomainCatalogRuntime,
  resolveAuthorityDomainCatalogPaths,
  resolvePreferredNavigationDomain,
  runtimeCatalogNormalizedBytes,
  validateAuthorityDomainCatalogAuthoring,
  verifyAuthorityDomainCatalogRuntime,
  type AuthorityDomainCatalogAuthoring,
  type AuthorityNodeEndpoint,
  type RegisteredPeerDomainId,
} from '@/lib/authority-domain-catalog';
import {
  resolveActiveEngineeringGraphAuthority,
  resolveConfiguredAuthorityRoot,
} from '@/lib/authoritative-knowledge/engineering-authority-consumers';
import { resolveAuthorityStorePaths } from '@/lib/authoritative-knowledge/authority-store';

const repoRoot = process.cwd();
/** Git `authority/current.json` and isolated catalog fixtures. Not the live catalog. */
const SNAPSHOT_ID =
  'snap-7f4cdd1084af419a3e83787661e3017662dc253a9ffc864a9bb97a96085cc4c7';
const SNAPSHOT_HASH =
  '7f4cdd1084af419a3e83787661e3017662dc253a9ffc864a9bb97a96085cc4c7';
const RELEASE_ID = 'ctr:release:control-theory-engineering-v0.9';
const RELEASE_SET_ID =
  'actkg-authoritative-candidate-25eccfea581c79a83fa95ec9dd08fa98a9eeae1cc27da1d8549b57d1bf52c6b6';
const SUCCESSOR_SNAPSHOT_ID =
  'snap-e2d8b92f6095a7b79036cc0808952fd42e2077ff3b5cf0a36291fd0bc7f26aae';
const SUCCESSOR_SNAPSHOT_HASH =
  'e2d8b92f6095a7b79036cc0808952fd42e2077ff3b5cf0a36291fd0bc7f26aae';
const SUCCESSOR_RELEASE_ID = 'ctr:release:control-theory-engineering-v0.37';

const SAMPLE_IDS = {
  modeling: 'ctc:modeling-00d2998755974a1329049aac',
  time: 'ctkg:v3e-canonical-312d1dfa7e96b9cc6f46e253',
  stability: 'ctkg:v3e-canonical-ec8dceb901656a3a0a32d12b',
  frequency: 'ctkg:v3e-canonical-504581e399675b9792ab8502',
  rootLocus: 'ctkg:v3e-object-003aff0599f6e3790bfdb93a',
  classical: 'ctc:v11g-e85c0145d63244c46853c9cf',
  discrete: 'ctkg:v3e-object-0e5df270abeaa062e3a81d33',
  stateSpace: 'ctkg:v3e-object-0bb7941e989275e607a110d0',
  multiDomain: 'ctkg:v3e-object-31fd73d9e24d1077744bf193',
  multiDomainTimeStability: 'ctc:v11g-1c9f955b68fd25e1f4ad86f6',
} as const;

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

function tempCatalogPaths() {
  const root = mkdtempSync(path.join(tmpdir(), 'act-domain-catalog-'));
  tempRoots.push(root);
  const authoringRoot = path.join(root, 'authoring');
  const runtimeRoot = path.join(root, 'runtime');
  mkdirSync(authoringRoot, { recursive: true });
  mkdirSync(runtimeRoot, { recursive: true });
  return {
    authoringRoot,
    runtimeRoot,
    authoringCatalogPath: path.join(authoringRoot, 'catalog.json'),
    runtimeCatalogPath: path.join(runtimeRoot, 'catalog.json'),
    runtimeCurrentPath: path.join(runtimeRoot, 'current.json'),
  };
}

function baseDomains() {
  const visualByDomain: Record<RegisteredPeerDomainId, string> = {
    'system-modeling': 'modeling',
    'time-domain-analysis': 'time',
    'stability-analysis': 'stability',
    'frequency-domain-analysis': 'frequency',
    'root-locus': 'root-locus',
    'classical-control-design': 'design',
    'discrete-time-control-analysis': 'discrete',
    'state-space-control-analysis-and-design': 'state-space',
  };
  const names: Record<RegisteredPeerDomainId, string> = {
    'system-modeling': '系统建模',
    'time-domain-analysis': '时域分析',
    'stability-analysis': '稳定性分析',
    'frequency-domain-analysis': '频域分析',
    'root-locus': '根轨迹',
    'classical-control-design': '经典控制设计',
    'discrete-time-control-analysis': '离散时间控制分析',
    'state-space-control-analysis-and-design': '状态空间控制分析与设计',
  };
  return REGISTERED_PEER_DOMAIN_IDS.map((domainId, index) => ({
    domainId,
    order: index + 1,
    displayName: names[domainId],
    summary: `${names[domainId]}领域的审核展示摘要。`,
    presentationRole: 'domain' as const,
    visualRole: visualByDomain[domainId] as
      | 'modeling'
      | 'time'
      | 'stability'
      | 'frequency'
      | 'root-locus'
      | 'design'
      | 'discrete'
      | 'state-space',
  }));
}

function fixtureNodes(): AuthorityNodeEndpoint[] {
  return Object.values(SAMPLE_IDS).map((canonicalId) => ({ canonicalId }));
}

function baseAuthoring(
  overrides: Partial<AuthorityDomainCatalogAuthoring> = {},
): AuthorityDomainCatalogAuthoring {
  return {
    contract: 'act-authority-domain-display-catalog-authoring/v1',
    catalogVersion: '1.0.0-test',
    reviewStatus: 'reviewed',
    authorityBinding: {
      snapshotId: SNAPSHOT_ID,
      snapshotHash: SNAPSHOT_HASH,
      releaseId: RELEASE_ID,
      releaseSetId: RELEASE_SET_ID,
    },
    domains: baseDomains(),
    aggregate: {
      entryId: AGGREGATE_ENTRY_ID,
      order: 0,
      displayName: '控制理论综合',
      summary: '八大领域的全局汇总入口。',
      presentationRole: 'aggregate',
      visualRole: 'aggregate',
    },
    memberships: [
      {
        canonicalId: SAMPLE_IDS.modeling,
        domainIds: ['system-modeling'],
        preferredDomainId: 'system-modeling',
      },
      {
        canonicalId: SAMPLE_IDS.time,
        domainIds: ['time-domain-analysis'],
        preferredDomainId: 'time-domain-analysis',
      },
      {
        canonicalId: SAMPLE_IDS.stability,
        domainIds: ['stability-analysis'],
        preferredDomainId: 'stability-analysis',
      },
      {
        canonicalId: SAMPLE_IDS.frequency,
        domainIds: ['frequency-domain-analysis'],
        preferredDomainId: 'frequency-domain-analysis',
      },
      {
        canonicalId: SAMPLE_IDS.rootLocus,
        domainIds: ['root-locus'],
        preferredDomainId: 'root-locus',
      },
      {
        canonicalId: SAMPLE_IDS.classical,
        domainIds: ['classical-control-design'],
        preferredDomainId: 'classical-control-design',
      },
      {
        canonicalId: SAMPLE_IDS.discrete,
        domainIds: ['discrete-time-control-analysis'],
        preferredDomainId: 'discrete-time-control-analysis',
      },
      {
        canonicalId: SAMPLE_IDS.stateSpace,
        domainIds: ['state-space-control-analysis-and-design'],
        preferredDomainId: 'state-space-control-analysis-and-design',
      },
      {
        canonicalId: SAMPLE_IDS.multiDomain,
        domainIds: ['root-locus', 'classical-control-design'],
        preferredDomainId: 'root-locus',
      },
    ],
    ...overrides,
  };
}

describe('authority domain display catalog contract', () => {
  it('defines exactly eight peer domains and a separate aggregate entry', () => {
    expect(REGISTERED_PEER_DOMAIN_IDS).toEqual([
      'system-modeling',
      'time-domain-analysis',
      'stability-analysis',
      'frequency-domain-analysis',
      'root-locus',
      'classical-control-design',
      'discrete-time-control-analysis',
      'state-space-control-analysis-and-design',
    ]);
    expect(REGISTERED_PEER_DOMAIN_IDS).toHaveLength(8);
    expect(REGISTERED_PEER_DOMAIN_IDS).not.toContain(AGGREGATE_ENTRY_ID);

    const runtime = buildAuthorityDomainCatalog(baseAuthoring(), fixtureNodes());
    expect(runtime.domains.map((d) => d.domainId)).toEqual([...REGISTERED_PEER_DOMAIN_IDS]);
    expect(runtime.aggregate.entryId).toBe(AGGREGATE_ENTRY_ID);
    expect(runtime.aggregate.presentationRole).toBe('aggregate');
    expect(runtime.aggregate.domainCount).toBe(8);
    expect(runtime.domains.some((d) => (d.domainId as string) === AGGREGATE_ENTRY_ID)).toBe(false);
    expect(runtime.domains.every((d) => d.presentationRole === 'domain')).toBe(true);
  });

  it('rebuilds deterministically under semantic-equivalent reordering', () => {
    const authoringA = baseAuthoring();
    const authoringB = baseAuthoring({
      domains: [...baseDomains()].reverse(),
      memberships: [...baseAuthoring().memberships].reverse().map((m) => ({
        ...m,
        domainIds: [...m.domainIds].reverse() as RegisteredPeerDomainId[],
      })),
    });

    const runtimeA = buildAuthorityDomainCatalog(authoringA, fixtureNodes());
    const runtimeB = buildAuthorityDomainCatalog(authoringB, fixtureNodes());

    expect(runtimeA.catalogHash).toBe(runtimeB.catalogHash);
    expect(runtimeA.catalogId).toBe(runtimeB.catalogId);
    expect(runtimeCatalogNormalizedBytes(runtimeA)).toBe(
      runtimeCatalogNormalizedBytes(runtimeB),
    );
    // Presentation order remains reviewed order even when authoring array is reversed.
    expect(runtimeB.domains.map((d) => d.domainId)).toEqual([...REGISTERED_PEER_DOMAIN_IDS]);
    verifyAuthorityDomainCatalogRuntime(runtimeA);
    verifyAuthorityDomainCatalogRuntime(runtimeB);
  });

  it('rejects unregistered domain, missing endpoint, duplicate membership, preferred mismatch and prohibited presentation strings', () => {
    expect(() =>
      validateAuthorityDomainCatalogAuthoring(
        baseAuthoring({
          domains: [
            ...baseDomains().slice(0, 7),
            {
              ...baseDomains()[7]!,
              domainId: 'invented-domain' as RegisteredPeerDomainId,
            },
          ],
        }),
        fixtureNodes(),
      ),
    ).toThrow(DomainCatalogValidationError);

    expect(() =>
      buildAuthorityDomainCatalog(
        baseAuthoring({
          memberships: [
            {
              canonicalId: 'ctc:does-not-exist-in-authority',
              domainIds: ['system-modeling'],
              preferredDomainId: 'system-modeling',
            },
          ],
        }),
        fixtureNodes(),
      ),
    ).toThrow(/not present in the bound Authority selection/i);

    expect(() =>
      buildAuthorityDomainCatalog(
        baseAuthoring({
          memberships: [
            {
              canonicalId: SAMPLE_IDS.modeling,
              domainIds: ['system-modeling'],
              preferredDomainId: 'system-modeling',
            },
            {
              canonicalId: SAMPLE_IDS.modeling,
              domainIds: ['time-domain-analysis'],
              preferredDomainId: 'time-domain-analysis',
            },
          ],
        }),
        fixtureNodes(),
      ),
    ).toThrow(/duplicate membership identity/i);

    expect(() =>
      buildAuthorityDomainCatalog(
        baseAuthoring({
          memberships: [
            {
              canonicalId: SAMPLE_IDS.modeling,
              domainIds: ['system-modeling'],
              preferredDomainId: 'time-domain-analysis',
            },
          ],
        }),
        fixtureNodes(),
      ),
    ).toThrow(/preferredDomainId must be one of its domainIds/i);

    expect(() =>
      buildAuthorityDomainCatalog(
        baseAuthoring({
          domains: baseDomains().map((d, i) =>
            i === 0
              ? {
                  ...d,
                  displayName: 'system-modeling',
                }
              : d,
          ),
        }),
        fixtureNodes(),
      ),
    ).toThrow(/must not contain catalog keys/i);

    expect(() =>
      buildAuthorityDomainCatalog(
        baseAuthoring({
          aggregate: {
            ...baseAuthoring().aggregate,
            summary: `详见 ${SAMPLE_IDS.modeling}`,
          },
        }),
        fixtureNodes(),
      ),
    ).toThrow(/must not contain raw Authority identifiers/i);

    expect(() =>
      buildAuthorityDomainCatalog(
        baseAuthoring({
          aggregate: {
            ...baseAuthoring().aggregate,
            summary: '采用 SystemModel 表示受控对象。',
          },
        }),
        fixtureNodes(),
      ),
    ).toThrow(/must not be a raw enum value/i);

    for (const rawEnum of [
      'association',
      'source_to_target',
      'approved',
      'published',
      'GOLD',
      'gold',
      'silver',
      'CORE',
      'EXTENSION',
    ]) {
      expect(() =>
        buildAuthorityDomainCatalog(
          baseAuthoring({
            aggregate: {
              ...baseAuthoring().aggregate,
              summary: `采用 ${rawEnum} 表达。`,
            },
          }),
          fixtureNodes(),
        ),
      ).toThrow(/must not be a raw enum value/i);
    }

    expect(() =>
      buildAuthorityDomainCatalog(
        baseAuthoring({
          aggregate: {
            ...baseAuthoring().aggregate,
            summary: 'ctm:v11g-6b66a370b1cd788194b0f8ab',
          },
        }),
        fixtureNodes(),
      ),
    ).toThrow(/must not contain raw Authority identifiers/i);

    expect(() =>
      buildAuthorityDomainCatalog(
        baseAuthoring({
          domains: [
            ...baseDomains(),
            {
              domainId: 'system-modeling',
              order: 99,
              displayName: '重复',
              summary: '重复领域',
              presentationRole: 'domain',
              visualRole: 'modeling',
            },
          ],
        }),
        fixtureNodes(),
      ),
    ).toThrow(DomainCatalogBuildError);
  });

  it('preserves multi-domain membership under one canonical identity', () => {
    const runtime = buildAuthorityDomainCatalog(baseAuthoring(), fixtureNodes());
    const multi = runtime.memberships.find((m) => m.canonicalId === SAMPLE_IDS.multiDomain);
    expect(multi).toBeDefined();
    expect(multi?.domainIds).toEqual(['classical-control-design', 'root-locus']);
    expect(multi?.preferredDomainId).toBe('root-locus');

    const resolved = resolvePreferredNavigationDomain(runtime, SAMPLE_IDS.multiDomain);
    expect(resolved).toEqual({
      preferredDomainId: 'root-locus',
      domainIds: ['classical-control-design', 'root-locus'],
    });

    const rootLocus = runtime.domains.find((d) => d.domainId === 'root-locus');
    const classical = runtime.domains.find((d) => d.domainId === 'classical-control-design');
    expect(rootLocus?.memberCount).toBe(2);
    expect(classical?.memberCount).toBe(2);
  });

  it('rejects snapshotId, snapshotHash and releaseId drift plus artifact tamper', () => {
    const paths = tempCatalogPaths();
    writeFileSync(
      paths.authoringCatalogPath,
      `${JSON.stringify(baseAuthoring(), null, 2)}\n`,
      'utf8',
    );
    const runtime = materializeAuthorityDomainCatalogRuntime(paths, fixtureNodes(), {
      activatedAt: '2026-08-13T00:00:00.000Z',
    });
    expect(runtime.catalogHash).toMatch(/^[a-f0-9]{64}$/u);

    const active = {
      snapshotId: SNAPSHOT_ID,
      snapshotHash: SNAPSHOT_HASH,
      releaseId: RELEASE_ID,
    };
    expect(loadAuthorityDomainCatalogRuntime(paths, active).catalogId).toBe(runtime.catalogId);

    expect(() =>
      loadAuthorityDomainCatalogRuntime(paths, {
        ...active,
        snapshotId: `snap-${'a'.repeat(64)}`,
      }),
    ).toThrow(DomainCatalogLoadError);

    expect(() =>
      loadAuthorityDomainCatalogRuntime(paths, {
        ...active,
        snapshotHash: 'b'.repeat(64),
      }),
    ).toThrow(/snapshotHash/i);

    expect(() =>
      loadAuthorityDomainCatalogRuntime(paths, {
        ...active,
        releaseId: 'ctr:release:other',
      }),
    ).toThrow(/releaseId/i);

    // Tamper runtime body while keeping pointer hash stale.
    const onDisk = JSON.parse(readFileSync(paths.runtimeCatalogPath, 'utf8')) as {
      domains: Array<{ displayName: string }>;
      catalogHash: string;
    };
    onDisk.domains[0]!.displayName = '被篡改的名称';
    writeFileSync(paths.runtimeCatalogPath, `${JSON.stringify(onDisk, null, 2)}\n`, 'utf8');
    expect(() => loadAuthorityDomainCatalogRuntime(paths, active)).toThrow(/tamper|hash/i);
  });

  it('loads matching active selection and exposes presentation roots without IDs or topology counts', () => {
    const paths = tempCatalogPaths();
    writeFileSync(
      paths.authoringCatalogPath,
      `${JSON.stringify(baseAuthoring(), null, 2)}\n`,
      'utf8',
    );
    const runtime = materializeAuthorityDomainCatalogRuntime(paths, fixtureNodes());
    const loaded = loadAuthorityDomainCatalogRuntime(paths, {
      snapshotId: SNAPSHOT_ID,
      snapshotHash: SNAPSHOT_HASH,
      releaseId: RELEASE_ID,
    });
    expect(loaded.catalogHash).toBe(runtime.catalogHash);

    const root = buildAuthorityDomainRootPresentation(loaded);
    assertRootPresentationExcludesAuthorityIdentity(root);
    expect(root.kind).toBe('presentation-root-catalog');
    expect(root.domains).toHaveLength(8);
    expect(root.aggregate.kind).toBe('presentation-aggregate');
    expect(root.aggregate.domainCount).toBe(8);
    expect(JSON.stringify(root)).not.toMatch(/canonicalId/);
    expect(JSON.stringify(root)).not.toMatch(/catalogId|navigationKey/);
    expect(JSON.stringify(root)).not.toMatch(/objectCount|relationCount|nodeCount|edgeCount/);
    expect(JSON.stringify(root)).not.toMatch(SNAPSHOT_HASH);
    expect(root.domains.every((d) => d.displayName.length > 0)).toBe(true);
  });
});

describe('committed authority domain display catalog store', () => {
  const storeEnvKeys = [
    'ACT_AUTHORITY_STORE_ROOT',
    'AUTHORITY_STORE_ROOT',
    'ACT_CONSUMER_ACTIVATION_ROOT',
    'CONSUMER_ACTIVATION_ROOT',
  ] as const;
  const previousStoreEnv = new Map<string, string | undefined>();
  let engineeringBytesBefore = '';
  let engineeringHashBefore = '';
  let manifestBytesBefore = '';
  let objectCountBefore = 0;
  let relationCountBefore = 0;

  beforeAll(() => {
    for (const key of storeEnvKeys) {
      previousStoreEnv.set(key, process.env[key]);
      delete process.env[key];
    }

    const engPath = path.join(
      repoRoot,
      'course-content/authoring/knowledge/authority/releases',
      SNAPSHOT_ID,
      'engineering.json',
    );
    const manifestPath = path.join(
      repoRoot,
      'course-content/authoring/knowledge/authority/releases',
      SNAPSHOT_ID,
      'manifest.json',
    );
    engineeringBytesBefore = readFileSync(engPath, 'utf8');
    engineeringHashBefore = createHash('sha256').update(engineeringBytesBefore).digest('hex');
    manifestBytesBefore = readFileSync(manifestPath, 'utf8');
    const eng = JSON.parse(engineeringBytesBefore) as {
      objects: unknown[];
      relations: unknown[];
    };
    objectCountBefore = eng.objects.length;
    relationCountBefore = eng.relations.length;
  });

  afterAll(() => {
    for (const key of storeEnvKeys) {
      const value = previousStoreEnv.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('keeps Git authority/current.json on the predecessor and does not mutate snapshot bytes', () => {
    const paths = resolveAuthorityDomainCatalogPaths(repoRoot);
    expect(existsSync(paths.authoringCatalogPath)).toBe(true);
    expect(existsSync(paths.runtimeCatalogPath)).toBe(true);
    expect(existsSync(paths.runtimeCurrentPath)).toBe(true);

    const gitCurrent = JSON.parse(
      readFileSync(
        path.join(repoRoot, 'course-content/authoring/knowledge/authority/current.json'),
        'utf8',
      ),
    ) as { snapshotId: string; snapshotHash: string; releaseId: string };
    expect(gitCurrent.snapshotId).toBe(SNAPSHOT_ID);
    expect(gitCurrent.snapshotHash).toBe(SNAPSHOT_HASH);
    expect(gitCurrent.releaseId).toBe(RELEASE_ID);

    const resolved = resolveActiveEngineeringGraphAuthority(
      resolveAuthorityStorePaths(resolveConfiguredAuthorityRoot(repoRoot)),
      { repoRoot },
    );
    expect(resolved.status).toBe('ready');
    expect(resolved.activationMode).toBe('use-combination');
    expect(resolved.snapshotId).toBe(SUCCESSOR_SNAPSHOT_ID);
    expect(resolved.snapshotHash).toBe(SUCCESSOR_SNAPSHOT_HASH);
    expect(resolved.releaseId).toBe(SUCCESSOR_RELEASE_ID);

    const activeCatalog = readActiveDomainCatalog();
    expect(activeCatalog.status).toBe('available');
    if (activeCatalog.status === 'available') {
      expect(activeCatalog.catalog.authorityBinding.snapshotId).toBe(SUCCESSOR_SNAPSHOT_ID);
      expect(activeCatalog.catalog.authorityBinding.releaseId).toBe(SUCCESSOR_RELEASE_ID);
    }
    const activeRoot = readActiveDomainRootPresentation();
    expect(activeRoot.status).toBe('available');

    const engPath = path.join(
      repoRoot,
      'course-content/authoring/knowledge/authority/releases',
      SNAPSHOT_ID,
      'engineering.json',
    );
    const manifestPath = path.join(
      repoRoot,
      'course-content/authoring/knowledge/authority/releases',
      SNAPSHOT_ID,
      'manifest.json',
    );
    const engAfter = readFileSync(engPath, 'utf8');
    const manifestAfter = readFileSync(manifestPath, 'utf8');
    expect(engAfter).toBe(engineeringBytesBefore);
    expect(manifestAfter).toBe(manifestBytesBefore);
    expect(createHash('sha256').update(engAfter).digest('hex')).toBe(engineeringHashBefore);
    const eng = JSON.parse(engAfter) as { objects: unknown[]; relations: unknown[] };
    expect(eng.objects.length).toBe(objectCountBefore);
    expect(eng.relations.length).toBe(relationCountBefore);
  });

  it('binds committed runtime catalog to the successor Authority independently of Git current', () => {
    const paths = resolveAuthorityDomainCatalogPaths(repoRoot);
    const successorBinding = {
      snapshotId: SUCCESSOR_SNAPSHOT_ID,
      snapshotHash: SUCCESSOR_SNAPSHOT_HASH,
      releaseId: SUCCESSOR_RELEASE_ID,
    };
    const catalog = loadAuthorityDomainCatalogRuntime(paths, successorBinding);
    expect(catalog.authorityBinding.snapshotId).toBe(SUCCESSOR_SNAPSHOT_ID);
    expect(catalog.authorityBinding.releaseId).toBe(SUCCESSOR_RELEASE_ID);
    expect(catalog.domains).toHaveLength(15);
    expect(catalog.aggregate.entryId).toBe(AGGREGATE_ENTRY_ID);
    expect(catalog.aggregate.domainCount).toBe(15);
    expect(catalog.memberships).toHaveLength(7476);
    expect(catalog.memberships.some((m) => m.domainIds.length > 1)).toBe(true);
    for (const domainId of REGISTERED_PEER_DOMAIN_IDS) {
      expect(catalog.domains.some((d) => d.domainId === domainId)).toBe(true);
      expect(catalog.domains.find((d) => d.domainId === domainId)?.memberCount).toBeGreaterThan(0);
    }

    const root = loadAuthorityDomainRootPresentation(paths, successorBinding);
    assertRootPresentationExcludesAuthorityIdentity(root);
    expect(root.domains).toHaveLength(15);
    expect(JSON.stringify(root)).not.toMatch(/canonicalId/);
    expect(JSON.stringify(root)).not.toMatch(/catalogId|navigationKey/);

    const authoring = JSON.parse(
      readFileSync(paths.authoringCatalogPath, 'utf8'),
    ) as AuthorityDomainCatalogAuthoring;
    expect(authoring.authorityBinding.snapshotId).toBe(SUCCESSOR_SNAPSHOT_ID);
    expect(authoring.authorityBinding.releaseId).toBe(SUCCESSOR_RELEASE_ID);
    expect(authoring.domains).toHaveLength(8);
    expect(authoring.memberships).toHaveLength(10);
  });

  it('does not use authoring as a product runtime fallback when runtime is absent', () => {
    const paths = tempCatalogPaths();
    // Copy only authoring — no runtime.
    copyFileSync(
      path.join(repoRoot, 'course-content/authoring/knowledge/authority-domain-catalog/catalog.json'),
      paths.authoringCatalogPath,
    );
    expect(() =>
      loadAuthorityDomainCatalogRuntime(paths, {
        snapshotId: SNAPSHOT_ID,
        snapshotHash: SNAPSHOT_HASH,
        releaseId: RELEASE_ID,
      }),
    ).toThrow(/runtime domain display catalog is unavailable/i);
  });
});

describe('domain catalog hash stability helpers', () => {
  it('produces stable digests for identical objects with different key insertion order', () => {
    const a = catalogDigest({ b: 1, a: 2, nested: { z: true, y: false } });
    const b = catalogDigest({ a: 2, nested: { y: false, z: true }, b: 1 });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/u);
    // unique so accidental fixture collisions are obvious
    expect(a).not.toBe(createHash('sha256').update(randomUUID()).digest('hex'));
  });
});
