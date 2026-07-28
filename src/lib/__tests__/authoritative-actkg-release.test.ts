import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  canonicalJson,
  loadAndValidateRelease,
  sha256,
  type LineageClaims,
} from '../../../scripts/actkg-release/authoritative-release';
import {
  AGGREGATE_RELEASE_SET_LOCK_PATH,
  loadAndValidateAggregateRelease,
  type AggregateLineageClaims,
} from '../../../scripts/actkg-release/ctkg-0-2-aggregate-release';

const root = process.cwd();
const controlledPath = 'course-content/authoring/knowledge/releases/root-locus-engineering-v0.1';
const historicalLockPath = 'scripts/actkg-release/fixtures/release-set-lock-root-locus-engineering-v0.1.json';
const sourceReleaseRoot = path.join(root, controlledPath);
const captureRevision = 'a'.repeat(40);

type JsonObject = Record<string, unknown>;

function load(options: Parameters<typeof loadAndValidateRelease>[0] = {}) {
  return loadAndValidateRelease({ captureRevision, ...options });
}

async function fixture(): Promise<string> {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'actkg-release-'));
  const target = path.join(fixtureRoot, controlledPath);
  await cp(sourceReleaseRoot, target, { recursive: true });
  await cp(
    path.join(root, historicalLockPath),
    path.join(fixtureRoot, historicalLockPath),
  );
  return fixtureRoot;
}

async function mutateRelease(
  fixtureRoot: string,
  mutate: (release: JsonObject) => void,
  options: { updateCanonicalHash?: boolean; updateContractLock?: boolean } = {},
): Promise<void> {
  const releasePath = path.join(fixtureRoot, controlledPath, 'root-locus-engineering-v0.1.json');
  const lockPath = path.join(fixtureRoot, historicalLockPath);
  const release = JSON.parse(await readFile(releasePath, 'utf8')) as JsonObject;
  mutate(release);
  const lock = JSON.parse(await readFile(lockPath, 'utf8')) as {
    releases: Array<Record<string, string>>;
  };
  if (options.updateCanonicalHash) {
    const withoutHash = structuredClone(release);
    delete withoutHash.release_hash;
    const releaseHash = sha256(canonicalJson(withoutHash));
    release.release_hash = releaseHash;
    lock.releases[0]!.release_hash = releaseHash;
  }
  if (options.updateContractLock) {
    lock.releases[0]!.contract_hash = String(release.contract_hash);
  }
  const bytes = Buffer.from(`${JSON.stringify(release, null, 2)}\n`);
  lock.releases[0]!.release_json_raw_sha256 = sha256(bytes);
  await writeFile(releasePath, bytes);
  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
}

describe('authoritative ActKG Release admission (historical CTKG 0.1)', () => {
  it('accepts only the pinned historical package and preserves released membership', async () => {
    const validated = await load({ root });
    expect(validated.entry.release_hash).toBe('8b1e3832f10d4142db0c395c3b6b2188af6f400faab56f0870502e39c9493e74');
    expect((validated.release.canonical_nodes as JsonObject[])).toHaveLength(103);
    expect((validated.release.source_mappings as JsonObject[])).toHaveLength(125);
    expect((validated.release.gold_relations as JsonObject[])).toHaveLength(38);
    expect((validated.release.silver_relations as JsonObject[])).toHaveLength(3);
    expect((validated.release.source_object_stubs as JsonObject[])).toHaveLength(1165);
    expect((validated.release.evidence_segment_stubs as JsonObject[])).toHaveLength(2753);
    expect((validated.release.canonical_nodes as JsonObject[]).every((node) => (
      node.publication_status === 'unpublished'
    ))).toBe(true);
    expect(sha256(canonicalJson(validated.normalizedWithoutHash))).toBe(validated.entry.release_hash);
  });

  it('reads the only available lineage from RELEASE-NOTES and rejects fabricated lineage', async () => {
    const validated = await load({ root });
    expect(validated.captureRevision).toBe(captureRevision);
    expect(validated.lockRawHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(validated.sourceRun).toBe('v14p-fd0216551aa62debe2ef6209');
    expect(validated.sourceImplementationCommit).toBe('52fc3ef1e03b991cbac0d534497736c2d51633d6');
    for (const claims of [
      { ctkgDatasetHash: 'a'.repeat(64) },
      { ctkgDatasetPublicationIdentity: 'fabricated' },
      { ctkgDatasetResolvableLocation: 'fabricated' },
      { revisionRegistryVersion: 'v1' },
      { revisionRegistryHash: 'b'.repeat(64) },
    ] satisfies LineageClaims[]) {
      await expect(load({ root, lineageClaims: claims })).rejects.toThrow(
        /does not carry CTKGDataset or RevisionProposalRegistry lineage/u,
      );
    }
    await expect(load({ root, captureRevision: 'not-a-git-revision' })).rejects.toThrow(
      /ACT capture Git revision is invalid/u,
    );
  });

  it('rejects unlocked paths and raw-byte drift', async () => {
    const fixtureRoot = await fixture();
    const unlocked = path.join(fixtureRoot, 'unlocked-copy');
    await cp(path.join(fixtureRoot, controlledPath), unlocked, { recursive: true });
    await expect(load({ root: fixtureRoot, releasePath: unlocked })).rejects.toThrow(
      /not the controlled locked path/u,
    );
    await writeFile(
      path.join(fixtureRoot, controlledPath, 'RELEASE-NOTES.md'),
      `${await readFile(path.join(fixtureRoot, controlledPath, 'RELEASE-NOTES.md'), 'utf8')}\n`,
    );
    await expect(load({ root: fixtureRoot })).rejects.toThrow(/RELEASE-NOTES raw-byte hash drift/u);
  });

  it('fails closed on future contracts, missing endpoints and inconsistent duplicate IDs', async () => {
    const futureRoot = await fixture();
    await mutateRelease(futureRoot, (release) => {
      release.contract_hash = 'f'.repeat(64);
    }, { updateCanonicalHash: true, updateContractLock: true });
    await expect(load({ root: futureRoot })).rejects.toThrow(/lock contract_hash is not adapted/u);

    const endpointRoot = await fixture();
    await mutateRelease(endpointRoot, (release) => {
      ((release.gold_relations as JsonObject[])[0]!).source_id = 'ctc:missing';
    }, { updateCanonicalHash: true });
    await expect(load({ root: endpointRoot })).rejects.toThrow(/missing endpoint/u);

    const duplicateRoot = await fixture();
    await mutateRelease(duplicateRoot, (release) => {
      const nodes = release.canonical_nodes as JsonObject[];
      nodes.push({ ...nodes[0], description: 'conflicting duplicate' });
    }, { updateCanonicalHash: true });
    await expect(load({ root: duplicateRoot })).rejects.toThrow(/inconsistent duplicate identity/u);
  });

  it('rejects current-contract schema violations even after every Release hash is recomputed', async () => {
    const invalidConceptKind = await fixture();
    await mutateRelease(invalidConceptKind, (release) => {
      ((release.canonical_nodes as JsonObject[])[0]!).concept_kind = 'invented_kind';
    }, { updateCanonicalHash: true });
    await expect(load({ root: invalidConceptKind })).rejects.toThrow(/violates pinned current Schema contract/u);

    const invalidLabels = await fixture();
    await mutateRelease(invalidLabels, (release) => {
      ((release.canonical_nodes as JsonObject[])[0]!).preferred_labels = 'not-an-array';
    }, { updateCanonicalHash: true });
    await expect(load({ root: invalidLabels })).rejects.toThrow(/violates pinned current Schema contract/u);

    const missingRequired = await fixture();
    await mutateRelease(missingRequired, (release) => {
      delete ((release.canonical_nodes as JsonObject[])[0]!).concept_kind;
    }, { updateCanonicalHash: true });
    await expect(load({ root: missingRequired })).rejects.toThrow(/violates pinned current Schema contract/u);
  });
});

const AGGREGATE_PATH = 'course-content/authoring/knowledge/releases/control-theory-engineering-v0.2';
const COMPONENT_PATH = 'course-content/authoring/knowledge/releases/system-modeling-engineering-v0.1';

function loadAggregate(options: Parameters<typeof loadAndValidateAggregateRelease>[0] = {}) {
  return loadAndValidateAggregateRelease({ captureRevision, ...options });
}

interface AggregateFixtureLock {
  releases: Array<{
    release_hash: string;
    artifacts: Array<{ path: string; media_type: string; sha256: string }>;
  }>;
}

async function aggregateFixture(): Promise<string> {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'actkg-aggregate-'));
  await cp(
    path.join(root, 'course-content/authoring/knowledge/releases'),
    path.join(fixtureRoot, 'course-content/authoring/knowledge/releases'),
    { recursive: true },
  );
  return fixtureRoot;
}

async function rewriteAggregateArtifact(
  fixtureRoot: string,
  relativePath: string,
  bytes: Buffer,
  options: { recomputeReleaseHash?: boolean } = {},
): Promise<void> {
  const packageDir = path.join(fixtureRoot, AGGREGATE_PATH);
  const lockPath = path.join(fixtureRoot, AGGREGATE_RELEASE_SET_LOCK_PATH);
  const lock = JSON.parse(await readFile(lockPath, 'utf8')) as AggregateFixtureLock;
  await writeFile(path.join(packageDir, relativePath), bytes);
  if (options.recomputeReleaseHash) {
    const releasePath = path.join(packageDir, relativePath);
    const release = JSON.parse(await readFile(releasePath, 'utf8')) as JsonObject;
    const withoutHash = structuredClone(release);
    delete withoutHash.release_hash;
    const releaseHash = sha256(canonicalJson(withoutHash));
    release.release_hash = releaseHash;
    const releaseBytes = Buffer.from(`${JSON.stringify(release, null, 2)}\n`);
    await writeFile(releasePath, releaseBytes);
    bytes = releaseBytes;
    lock.releases[0]!.release_hash = releaseHash;
  }
  const artifact = lock.releases[0]!.artifacts.find((candidate) => candidate.path === relativePath)!;
  artifact.sha256 = sha256(bytes);
  if (relativePath !== 'SHA256SUMS') {
    const sumsPath = path.join(packageDir, 'SHA256SUMS');
    const sums = (await readFile(sumsPath, 'utf8'))
      .split('\n')
      .map((line) => {
        const match = /^([a-f0-9]{64}) {2}(\S+)$/u.exec(line);
        if (!match) return line;
        return match[2] === relativePath ? `${sha256(bytes)}  ${match[2]}` : line;
      })
      .join('\n');
    const sumsBytes = Buffer.from(sums);
    await writeFile(sumsPath, sumsBytes);
    lock.releases[0]!.artifacts.find((candidate) => candidate.path === 'SHA256SUMS')!.sha256 = sha256(sumsBytes);
  }
  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
}

async function mutateAggregateJson(
  fixtureRoot: string,
  relativePath: string,
  mutate: (value: JsonObject) => void,
  options: { recomputeReleaseHash?: boolean } = {},
): Promise<void> {
  const current = JSON.parse(
    await readFile(path.join(fixtureRoot, AGGREGATE_PATH, relativePath), 'utf8'),
  ) as JsonObject;
  mutate(current);
  await rewriteAggregateArtifact(
    fixtureRoot,
    relativePath,
    Buffer.from(`${JSON.stringify(current, null, 2)}\n`),
    options,
  );
}

describe('authoritative ActKG aggregate Release contract fixture (CTKG 0.2)', () => {
  it('pins the reviewed upstream lineage, Schema snapshot and artifact hashes', async () => {
    const validated = await loadAggregate({ root });
    expect(validated.lock.lock_version).toBe('actkg-release-set-lock/v2');
    expect(validated.lock.release_set_id).toBe('actkg-authoritative-candidate-v2');
    expect(validated.lock.releases).toHaveLength(1);
    expect(validated.lock.upstream).toEqual({
      publication_commit: '7ab6041201f3c23963a8ddb2685256a5418ad532',
      closed_commit: 'f5f442e99324af731e0b5226a22b0973e838621b',
    });
    expect(validated.lock.consumer_contract).toEqual({
      schema_version: '0.2.0',
      schema_raw_sha256: '3598f0c89f1f32ff1812e823454a17502873ccb5e9577656e6485a7e030233de',
      schema_controlled_path: `${AGGREGATE_PATH}/ctkg.schema.json`,
      normalization: 'canonical-json/rfc8785-subset-v1',
    });
    expect(validated.schema.version).toBe('0.2.0');
    expect(validated.entry.release_hash).toBe('3a897438ad8ff2ea5154befb1f8b6c783d843b430a39a128c654ebfa10ac2ffd');
    expect(validated.entry.source_dataset_hash).toBe('0468a685d93ea6a727444ff1464b8c3472dc18014d4c4f6a834e33218c2dae6c');
    expect(validated.entry.projection_id).toBe('ctr:projection:control-theory-engineering-v0.2:domain-v2');
    expect(validated.entry.projection_digest).toBe('f324255fd77cf5bf3bacf4cc55a7a082faca3339fff2b8410ddca37a00226255');
    expect(validated.entry.upstream_release_id).toBe('ctr:release:control-theory-engineering-v0.2');
    expect(sha256(canonicalJson(validated.normalizedReleaseWithoutHash))).toBe(validated.entry.release_hash);
    const artifactHashes = Object.fromEntries(
      validated.artifacts.map((artifact) => [artifact.relativePath, artifact.sha256]),
    );
    expect(artifactHashes).toEqual({
      'RELEASE-NOTES.md': '13e93fe9dda5f7e7ef40821d1c621fcfbecea7def59398341e970a92eeaee1eb',
      'SHA256SUMS': '920764005d3d2117b6b80020df3b893d6e6db4134db3acd3f920dfc316a28e35',
      'component-releases.json': '4634b241ff851e6e717faa6db212a22ef96237e73ae5424d3a6cf257d7a18654',
      'control-theory-engineering-v0.2.projection.json': '0f5b4d6de86a66e637f2a664e3d74fa9f4ecc3d02a41b6101e2c36ede82dd97b',
      'control-theory-engineering-v0.2.rag-crosswalk.jsonl': 'd1e806defe9742774ed8851532fd5b1dd23290e39b5fcb02225912a3d12fdb7c',
      'control-theory-engineering-v0.2.release.json': '38cdeb7afcfbdc561308653fd86475c2b60a57de8c418b7d5080daf5dffa6dcc',
      'ctkg.schema.json': '3598f0c89f1f32ff1812e823454a17502873ccb5e9577656e6485a7e030233de',
    });
  });

  it('fails closed when the lock identity diverges from the pinned CTKG 0.2 aggregate contract', async () => {
    const mutateLock = async (
      fixtureRoot: string,
      mutate: (lock: JsonObject) => void,
    ): Promise<void> => {
      const lockPath = path.join(fixtureRoot, AGGREGATE_RELEASE_SET_LOCK_PATH);
      const lock = JSON.parse(await readFile(lockPath, 'utf8')) as JsonObject;
      mutate(lock);
      await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
    };

    const setIdRoot = await aggregateFixture();
    await mutateLock(setIdRoot, (lock) => {
      lock.release_set_id = 'actkg-authoritative-candidate-v3';
    });
    await expect(loadAggregate({ root: setIdRoot })).rejects.toThrow(
      /not the pinned CTKG 0\.2 candidate ReleaseSet/u,
    );

    // 协调修改 member id 与请求参数也不能绕过固定 member 门禁。
    const memberRoot = await aggregateFixture();
    await mutateLock(memberRoot, (lock) => {
      (lock.releases as JsonObject[])[0]!.release_id = 'control-theory-engineering-v0.3';
    });
    await expect(loadAggregate({
      root: memberRoot,
      releaseId: 'control-theory-engineering-v0.3',
    })).rejects.toThrow(/not the pinned CTKG 0\.2 Release/u);

    const publicationRoot = await aggregateFixture();
    await mutateLock(publicationRoot, (lock) => {
      (lock.upstream as JsonObject).publication_commit =
        '0ab6041201f3c23963a8ddb2685256a5418ad532';
    });
    await expect(loadAggregate({ root: publicationRoot })).rejects.toThrow(
      /publication commit is not the pinned/u,
    );

    const closedRoot = await aggregateFixture();
    await mutateLock(closedRoot, (lock) => {
      (lock.upstream as JsonObject).closed_commit =
        '05f442e99324af731e0b5226a22b0973e838621b';
    });
    await expect(loadAggregate({ root: closedRoot })).rejects.toThrow(
      /closed commit is not the pinned/u,
    );

    const schemaHashRoot = await aggregateFixture();
    await mutateLock(schemaHashRoot, (lock) => {
      (lock.consumer_contract as JsonObject).schema_raw_sha256 = '0'.repeat(64);
    });
    await expect(loadAggregate({ root: schemaHashRoot })).rejects.toThrow(
      /Schema hash is not the pinned/u,
    );

    // 协调修改 lock 与 artifact hash 联动也不能绕过固定身份门禁。
    const coordinatedRoot = await aggregateFixture();
    await mutateLock(coordinatedRoot, (lock) => {
      lock.release_set_id = 'actkg-authoritative-candidate-v3';
    });
    await rewriteAggregateArtifact(
      coordinatedRoot,
      'RELEASE-NOTES.md',
      Buffer.from('coordinated artifact rewrite\n'),
    );
    await expect(loadAggregate({ root: coordinatedRoot })).rejects.toThrow(
      /not the pinned CTKG 0\.2 candidate ReleaseSet/u,
    );
  });

  it('asserts 841 entries, 744 nodes, 97 links, 1302 crosswalk rows and nine predicates', async () => {
    const validated = await loadAggregate({ root });
    expect(validated.entries).toHaveLength(841);
    expect(validated.nodes).toHaveLength(744);
    expect(validated.links).toHaveLength(97);
    expect(validated.crosswalk).toHaveLength(1302);
    expect(new Set(validated.crosswalk.map((row) => canonicalJson(row)))).toHaveProperty('size', 1302);
    const predicates = new Set(validated.links.map((link) => link.relation_type));
    expect([...predicates].sort()).toEqual([
      'applies_to',
      'association',
      'derived_from',
      'has_component',
      'has_formula',
      'has_representation',
      'is_a',
      'part_of',
      'used_to_analyze',
    ]);
    const tiers = { gold: 0, silver: 0 } as Record<string, number>;
    for (const entry of validated.entries) tiers[String(entry.release_tier)]! += 1;
    expect(tiers).toEqual({ gold: 192, silver: 649 });
    const roles = { knowledge_object: 0, relation: 0 } as Record<string, number>;
    for (const entry of validated.entries) roles[String(entry.entity_role)]! += 1;
    expect(roles).toEqual({ knowledge_object: 744, relation: 97 });
  });

  it('closes the projection over aggregate membership and preserves opaque identifiers', async () => {
    const validated = await loadAggregate({ root });
    const membership = new Set(validated.entries.map((entry) => String(entry.entity)));
    const relationEntries = new Set(
      validated.entries.filter((entry) => entry.entity_role === 'relation').map((entry) => String(entry.entity)),
    );
    const nodeIds = new Set(validated.nodes.map((node) => String(node.id)));
    for (const node of validated.nodes) {
      expect(membership.has(String(node.entity_id))).toBe(true);
    }
    for (const link of validated.links) {
      expect(nodeIds.has(String(link.source_id))).toBe(true);
      expect(nodeIds.has(String(link.target_id))).toBe(true);
      expect(relationEntries.has(String(link.relation_id))).toBe(true);
    }
    for (const row of validated.crosswalk) {
      expect(membership.has(row.publishedEntityId)).toBe(true);
      expect(row.retrievalChunkId.length).toBeGreaterThan(0);
      expect(row.citationTargetId.length).toBeGreaterThan(0);
    }
    const rawLines = (await readFile(
      path.join(root, AGGREGATE_PATH, 'control-theory-engineering-v0.2.rag-crosswalk.jsonl'),
      'utf8',
    )).split('\n').filter((line) => line.trim());
    expect(canonicalJson(validated.crosswalk)).toBe(canonicalJson(rawLines.map((line) => {
      const row = JSON.parse(line) as Record<string, string>;
      return {
        publishedEntityId: row.published_entity_id,
        retrievalChunkId: row.retrieval_chunk_id,
        citationTargetId: row.citation_target_id,
      };
    })));
  });

  it('verifies both component lineage records without parallel membership', async () => {
    const validated = await loadAggregate({ root });
    expect(validated.components).toHaveLength(2);
    const [rootLocus, systemModeling] = validated.components;
    expect(rootLocus!.componentReleaseId).toBe('ctr:root-locus-engineering-v0.1');
    expect(rootLocus!.releaseHash).toBe('8b1e3832f10d4142db0c395c3b6b2188af6f400faab56f0870502e39c9493e74');
    expect(rootLocus!.protocol).toBe('ctkg-m1c-v14p-root-locus-engineering-release-v1');
    expect(systemModeling!.componentReleaseId).toBe('ctr:release:system-modeling-engineering-v0.1');
    expect(systemModeling!.releaseHash).toBe('90746513ec47be545e3b7c011450d0fc6542781998a7779797b825e91e17775b');
    expect(systemModeling!.protocol).toBe('ctkg-0.2-release');
    expect(validated.release.component_releases).toEqual([
      'ctr:root-locus-engineering-v0.1',
      'ctr:release:system-modeling-engineering-v0.1',
    ]);
    await expect(loadAggregate({ root, releaseId: 'root-locus-engineering-v0.1' })).rejects.toThrow(
      /is not the locked aggregate member/u,
    );
  });

  it('rejects fabricated private lineage and invalid capture revisions', async () => {
    for (const claims of [
      { ctkgDatasetHash: 'a'.repeat(64) },
      { ctkgDatasetPublicationIdentity: 'fabricated' },
      { ctkgDatasetResolvableLocation: 'fabricated' },
      { revisionRegistryVersion: 'v1' },
      { revisionRegistryHash: 'b'.repeat(64) },
    ] satisfies AggregateLineageClaims[]) {
      await expect(loadAggregate({ root, lineageClaims: claims })).rejects.toThrow(
        /does not carry CTKGDataset or RevisionProposalRegistry lineage/u,
      );
    }
    await expect(loadAggregate({ root, captureRevision: 'not-a-git-revision' })).rejects.toThrow(
      /ACT capture Git revision is invalid/u,
    );
  });

  it('fails closed on parallel component membership and artifact drift', async () => {
    const parallelRoot = await aggregateFixture();
    const lockPath = path.join(parallelRoot, AGGREGATE_RELEASE_SET_LOCK_PATH);
    const lock = JSON.parse(await readFile(lockPath, 'utf8')) as { releases: JsonObject[] };
    lock.releases.push(structuredClone(lock.releases[0]!));
    await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
    await expect(loadAggregate({ root: parallelRoot })).rejects.toThrow(
      /exactly one current member/u,
    );

    const driftRoot = await aggregateFixture();
    const notesPath = path.join(driftRoot, AGGREGATE_PATH, 'RELEASE-NOTES.md');
    await writeFile(notesPath, `${await readFile(notesPath, 'utf8')}\n`);
    await expect(loadAggregate({ root: driftRoot })).rejects.toThrow(/raw-byte hash drift/u);

    const componentDriftRoot = await aggregateFixture();
    const componentReleasePath = path.join(
      componentDriftRoot,
      COMPONENT_PATH,
      'system-modeling-engineering-v0.1.release.json',
    );
    await writeFile(componentReleasePath, `${await readFile(componentReleasePath, 'utf8')}\n`);
    await expect(loadAggregate({ root: componentDriftRoot })).rejects.toThrow(
      /component ctr:release:system-modeling-engineering-v0.1 Release JSON raw-byte hash drift/u,
    );
  });

  it('fails closed on unknown Schema versions and vendored Schema drift', async () => {
    const futureRoot = await aggregateFixture();
    await mutateAggregateJson(
      futureRoot,
      'control-theory-engineering-v0.2.release.json',
      (release) => {
        release.schema_version = '0.3.0';
      },
      { recomputeReleaseHash: true },
    );
    await expect(loadAggregate({ root: futureRoot })).rejects.toThrow(/unadapted Schema version/u);

    const schemaDriftRoot = await aggregateFixture();
    const schemaPath = path.join(schemaDriftRoot, AGGREGATE_PATH, 'ctkg.schema.json');
    await writeFile(schemaPath, `${await readFile(schemaPath, 'utf8')}\n`);
    await expect(loadAggregate({ root: schemaDriftRoot })).rejects.toThrow(/raw-byte hash drift/u);
  });

  it('fails closed on projection contract conflicts and missing endpoints', async () => {
    const directionRoot = await aggregateFixture();
    await mutateAggregateJson(
      directionRoot,
      'control-theory-engineering-v0.2.projection.json',
      (projection) => {
        ((projection.links as JsonObject[])[0]!).direction = 'sideways';
      },
    );
    await expect(loadAggregate({ root: directionRoot })).rejects.toThrow(
      /violates the pinned CTKG 0.2 Schema/u,
    );

    const familyRoot = await aggregateFixture();
    await mutateAggregateJson(
      familyRoot,
      'control-theory-engineering-v0.2.projection.json',
      (projection) => {
        ((projection.links as JsonObject[])[0]!).relation_family = 'invented_family';
      },
    );
    await expect(loadAggregate({ root: familyRoot })).rejects.toThrow(
      /relation family invented_family is outside the pinned Schema vocabulary/u,
    );

    // 字段各自合法但组合违反固定九谓词合同时失败关闭：association 必须 unordered，
    // 其余谓词必须 source_to_target，全部 relation_family 必须 domain_semantic。
    const directedAssociationRoot = await aggregateFixture();
    await mutateAggregateJson(
      directedAssociationRoot,
      'control-theory-engineering-v0.2.projection.json',
      (projection) => {
        ((projection.links as JsonObject[])[0]!).direction = 'source_to_target';
      },
    );
    await expect(loadAggregate({ root: directedAssociationRoot })).rejects.toThrow(
      /predicate combination .* is outside the pinned CTKG 0\.2 contract/u,
    );

    const courseSequenceRoot = await aggregateFixture();
    await mutateAggregateJson(
      courseSequenceRoot,
      'control-theory-engineering-v0.2.projection.json',
      (projection) => {
        ((projection.links as JsonObject[])[0]!).relation_family = 'course_sequence';
      },
    );
    await expect(loadAggregate({ root: courseSequenceRoot })).rejects.toThrow(
      /predicate combination .* is outside the pinned CTKG 0\.2 contract/u,
    );

    const outsidePredicateRoot = await aggregateFixture();
    await mutateAggregateJson(
      outsidePredicateRoot,
      'control-theory-engineering-v0.2.projection.json',
      (projection) => {
        const link = (projection.links as JsonObject[])[0]!;
        link.relation_type = 'contains';
        link.direction = 'source_to_target';
      },
    );
    await expect(loadAggregate({ root: outsidePredicateRoot })).rejects.toThrow(
      /predicate combination .* is outside the pinned CTKG 0\.2 contract/u,
    );

    const endpointRoot = await aggregateFixture();
    await mutateAggregateJson(
      endpointRoot,
      'control-theory-engineering-v0.2.projection.json',
      (projection) => {
        ((projection.links as JsonObject[])[0]!).source_id = 'ctc:missing-endpoint';
      },
    );
    await expect(loadAggregate({ root: endpointRoot })).rejects.toThrow(/missing endpoint/u);

    const tierRoot = await aggregateFixture();
    await mutateAggregateJson(
      tierRoot,
      'control-theory-engineering-v0.2.projection.json',
      (projection) => {
        ((projection.nodes as JsonObject[])[0]!).release_tier = 'support';
      },
    );
    await expect(loadAggregate({ root: tierRoot })).rejects.toThrow(/release tier diverges/u);
  });

  it('fails closed on malformed, duplicated or out-of-membership crosswalk rows', async () => {
    const duplicateRoot = await aggregateFixture();
    const crosswalkPath = path.join(
      duplicateRoot,
      AGGREGATE_PATH,
      'control-theory-engineering-v0.2.rag-crosswalk.jsonl',
    );
    const lines = (await readFile(crosswalkPath, 'utf8')).split('\n').filter((line) => line.trim());
    await rewriteAggregateArtifact(
      duplicateRoot,
      'control-theory-engineering-v0.2.rag-crosswalk.jsonl',
      Buffer.from(`${[lines[0], ...lines].join('\n')}\n`),
    );
    await expect(loadAggregate({ root: duplicateRoot })).rejects.toThrow(/repeats a crosswalk triple/u);

    const outsideRoot = await aggregateFixture();
    const mutated = lines.map((line, index) => {
      if (index !== 0) return line;
      const row = JSON.parse(line) as Record<string, string>;
      row.published_entity_id = 'ctc:outside-membership';
      return JSON.stringify(row);
    });
    await rewriteAggregateArtifact(
      outsideRoot,
      'control-theory-engineering-v0.2.rag-crosswalk.jsonl',
      Buffer.from(`${mutated.join('\n')}\n`),
    );
    await expect(loadAggregate({ root: outsideRoot })).rejects.toThrow(/outside aggregate membership/u);

    const malformedRoot = await aggregateFixture();
    const malformed = lines.map((line, index) => {
      if (index !== 0) return line;
      const row = JSON.parse(line) as Record<string, string>;
      delete row.citation_target_id;
      return JSON.stringify(row);
    });
    await rewriteAggregateArtifact(
      malformedRoot,
      'control-theory-engineering-v0.2.rag-crosswalk.jsonl',
      Buffer.from(`${malformed.join('\n')}\n`),
    );
    await expect(loadAggregate({ root: malformedRoot })).rejects.toThrow(/exactly the three pinned fields/u);
  });

  it('keeps authoritative content outside runtime mutation routes', async () => {
    const appRoot = path.join(root, 'src/app');
    const files: string[] = [];
    async function collect(directory: string): Promise<void> {
      const entries = await import('node:fs/promises').then(({ readdir }) => readdir(directory, { withFileTypes: true }));
      for (const entry of entries) {
        const resolved = path.join(directory, entry.name);
        if (entry.isDirectory()) await collect(resolved);
        else if (/\.(?:ts|tsx)$/u.test(entry.name)) files.push(resolved);
      }
    }
    await collect(appRoot);
    const runtime = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
    expect(runtime).not.toMatch(/Actkg(?:Authoritative|Release|Source|Evidence|Import|Projection|Upstream)/u);
    const productionImporter = await readFile(
      path.join(root, 'scripts/db/import-authoritative-actkg-release.ts'),
      'utf8',
    );
    expect(productionImporter).toContain(
      'const captureRevision = existing?.captureRevision ?? await imageRevision();',
    );
    expect(productionImporter).toContain(
      'captureRevision ? { captureRevision } : {},',
    );
  });
});
