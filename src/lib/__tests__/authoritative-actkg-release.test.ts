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

const root = process.cwd();
const controlledPath = 'course-content/authoring/knowledge/releases/root-locus-engineering-v0.1';
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
    path.join(root, 'course-content/authoring/knowledge/releases/release-set.lock.json'),
    path.join(fixtureRoot, 'course-content/authoring/knowledge/releases/release-set.lock.json'),
  );
  return fixtureRoot;
}

async function mutateRelease(
  fixtureRoot: string,
  mutate: (release: JsonObject) => void,
  options: { updateCanonicalHash?: boolean; updateContractLock?: boolean } = {},
): Promise<void> {
  const releasePath = path.join(fixtureRoot, controlledPath, 'root-locus-engineering-v0.1.json');
  const lockPath = path.join(fixtureRoot, 'course-content/authoring/knowledge/releases/release-set.lock.json');
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

describe('authoritative ActKG Release admission', () => {
  it('accepts only the pinned current package and preserves released membership', async () => {
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
    expect(runtime).not.toMatch(/Actkg(?:Authoritative|Release|Source|Evidence|Import)/u);
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
