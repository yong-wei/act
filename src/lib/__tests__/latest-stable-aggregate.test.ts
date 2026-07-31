import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdtemp,
  mkdir,
  readdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { canonicalJson } from '../../../scripts/actkg-release/authoritative-release';
import { CTKG_SCHEMA_RAW_SHA256 } from '../../../scripts/actkg-release/bundle-compatibility-registry';
import {
  resolveLatestStableAggregate,
  resolveLatestStableAggregateWithCandidates,
} from '../../../scripts/actkg-release/latest-stable-aggregate';

const LEGACY_ROOT = 'releases/control-theory-engineering-v0.3';
const LEGACY_ROOT_ID = 'ctb:control-theory-engineering-v0.3:r1';
const CHAIN_HEAD_ID = 'ctb:control-theory-engineering-v0.3:r2';
const CLOSURE_PATH = 'docs/coordination/m1j/v0.3-r1-predecessor-closure.json';

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function git(root: string, args: string[]): string {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

async function initRepo(): Promise<{ root: string; sourceCommit: string }> {
  const root = await mkdtemp(path.join(tmpdir(), 'act-latest-aggregate-'));
  git(root, ['init', '-b', 'main']);
  git(root, ['config', 'user.email', 'resolver@example.invalid']);
  git(root, ['config', 'user.name', 'Resolver Test']);
  await writeFile(path.join(root, 'README.md'), 'fixture\n');
  git(root, ['add', 'README.md']);
  git(root, ['commit', '-m', 'fixture source']);
  const sourceCommit = git(root, ['rev-parse', 'HEAD']);
  git(root, ['tag', 'source-v2']);
  return { root, sourceCommit };
}

async function writeLegacyRoot(root: string): Promise<string> {
  const directory = path.join(root, LEGACY_ROOT);
  await mkdir(directory, { recursive: true });
  const names = [
    'RELEASE-NOTES.md',
    'component-releases.json',
    'control-theory-engineering-v0.3.act-projection.json',
    'control-theory-engineering-v0.3.domain-projection.json',
    'control-theory-engineering-v0.3.projection-link-metadata.jsonl',
    'control-theory-engineering-v0.3.rag-crosswalk.jsonl',
    'control-theory-engineering-v0.3.release.json',
    'control-theory-engineering-v0.3.review-projection.json',
  ];
  for (const [index, name] of names.entries()) {
    await writeFile(path.join(directory, name), `legacy-${index}\n`);
  }
  const rows = await Promise.all(
    names.map(async (name) => (
      `${sha256(await readFile(path.join(directory, name)))}  ${name}`
    )),
  );
  const sums = `${rows.join('\n')}\n`;
  await writeFile(path.join(directory, 'SHA256SUMS'), sums);
  return sha256(sums);
}

async function writeBundle(input: {
  root: string;
  name: string;
  bundleId: string;
  releaseId?: string;
  releaseVersion?: string;
  revision?: number;
  sourceCommit: string;
  previous?: {
    bundleId: string;
    sumsSha256: string;
    kind?: string;
  };
  previousHashOverride?: string;
  publicationTag?: string;
  releaseHashOverride?: string;
  bundleDigestOverride?: string;
}): Promise<string> {
  const bundleDir = path.join(input.root, 'releases', input.name);
  await mkdir(bundleDir, { recursive: true });
  const releaseVersion = input.releaseVersion ?? input.name;
  const releaseId = input.releaseId ?? `ctr:release:${releaseVersion}`;
  const report = JSON.stringify({ result: 'PASS' });
  await writeFile(path.join(bundleDir, 'validation-report.json'), report);
  const manifest: Record<string, unknown> = {
    bundle_contract_version: 'actkg-public-bundle/1',
    bundle_digest: '',
    bundle_id: input.bundleId,
    bundle_kind: 'aggregate',
    bundle_revision: input.revision ?? 1,
    publication: { tag: input.publicationTag ?? `stable-${input.name}` },
    previous_bundle: input.previous
      ? {
          bundle_id: input.previous.bundleId,
          kind: input.previous.kind ?? 'legacy_exact',
          sha256sums_sha256:
            input.previousHashOverride ?? input.previous.sumsSha256,
        }
      : null,
    release: {
      release_hash: input.releaseHashOverride ?? sha256(`release:${releaseId}`),
      release_id: releaseId,
      release_version: releaseVersion,
      source_dataset_hash: sha256(`source:${releaseId}`),
    },
    release_stage: 'stable',
    schema: { sha256: CTKG_SCHEMA_RAW_SHA256, version: '0.2.0' },
    source_revision: { commit: input.sourceCommit, tag: 'source-v2' },
    statistics: { knowledge_nodes: 1 },
    artifacts: [{
      role: 'validation_report',
      contract_version: 'ctkg-validation-report/0.2',
      required: true,
      path: 'validation-report.json',
      media_type: 'application/json',
      sha256: sha256(report),
      byte_length: Buffer.byteLength(report),
      record_count: null,
    }],
  };
  const digestBody = { ...manifest };
  delete digestBody.bundle_digest;
  manifest.bundle_digest = input.bundleDigestOverride
    ?? sha256(canonicalJson(digestBody));
  await writeFile(
    path.join(bundleDir, 'bundle-manifest.json'),
    JSON.stringify(manifest),
  );
  const files = ['bundle-manifest.json', 'validation-report.json'];
  const rows = await Promise.all(
    files.map(async (file) => (
      `${sha256(await readFile(path.join(bundleDir, file)))}  ${file}`
    )),
  );
  const sums = `${rows.join('\n')}\n`;
  await writeFile(path.join(bundleDir, 'SHA256SUMS'), sums);
  return sha256(sums);
}

async function writeLegacyClosure(root: string): Promise<void> {
  const legacySums = sha256(
    await readFile(path.join(root, LEGACY_ROOT, 'SHA256SUMS')),
  );
  const consumerPath = path.join(
    root,
    'releases/control-theory-engineering-v0.3-r2/bundle-manifest.json',
  );
  const consumerManifest = await readFile(consumerPath);
  const body = {
    algorithm_version: 'sha256sums-legacy-exact-root/1',
    authority_implementation: 'src/ctkg_schema/section_kg/m1k_v1d_predecessors.py',
    authority_protocol: 'ctkg-m1k-v1d-predecessor-closure/1',
    bundle_id: LEGACY_ROOT_ID,
    bundle_path: LEGACY_ROOT,
    consumer_binding: {
      consumer_bundle_id: CHAIN_HEAD_ID,
      field: 'previous_bundle',
      manifest_path: 'releases/control-theory-engineering-v0.3-r2/bundle-manifest.json',
      manifest_sha256: sha256(consumerManifest),
      value: {
        bundle_id: LEGACY_ROOT_ID,
        kind: 'legacy_exact',
        sha256sums_sha256: legacySums,
      },
    },
    contract_version: 'actkg-legacy-predecessor-root-closure/1',
    gates: {
      BUNDLE_ID_BINDING_GATE: 'PASS',
      CONSUMER_PREDECESSOR_BINDING_GATE: 'PASS',
      LEGACY_LAYOUT_GATE: 'PASS',
      MEMBER_CHECKSUM_GATE: 'PASS',
      SHA256SUMS_RAW_BINDING_GATE: 'PASS',
    },
    member_checksum_count: 8,
    reference_kind: 'legacy_exact',
    release_version: 'control-theory-engineering-v0.3',
    sha256sums_path: `${LEGACY_ROOT}/SHA256SUMS`,
    sha256sums_raw_sha256: legacySums,
    status: 'PASS',
  };
  await mkdir(path.join(root, path.dirname(CLOSURE_PATH)), { recursive: true });
  await writeFile(
    path.join(root, CLOSURE_PATH),
    JSON.stringify({ ...body, artifact_hash: sha256(canonicalJson(body)) }),
  );
}

async function commitAndTag(root: string, tags: string[]): Promise<void> {
  git(root, ['add', 'releases', 'docs']);
  git(root, ['commit', '-m', 'fixture bundles']);
  for (const tag of tags) {
    if (!git(root, ['tag', '--list', tag])) git(root, ['tag', tag]);
  }
}

async function rewriteBundleSums(bundleDir: string): Promise<void> {
  const files = (await readdir(bundleDir)).filter((name) => name !== 'SHA256SUMS').sort();
  const rows = await Promise.all(
    files.map(async (name) => `${sha256(await readFile(path.join(bundleDir, name)))}  ${name}`),
  );
  await writeFile(path.join(bundleDir, 'SHA256SUMS'), `${rows.join('\n')}\n`);
}

async function writeValidChain(
  root: string,
  sourceCommit: string,
  options: { successor?: boolean; endpointPublicationTag?: string } = {},
): Promise<{ legacySums: string; endpointName: string }> {
  const legacySums = await writeLegacyRoot(root);
  await writeBundle({
    root,
    name: 'control-theory-engineering-v0.3-r2',
    bundleId: CHAIN_HEAD_ID,
    releaseId: 'ctr:release:control-theory-engineering-v0.3',
    releaseVersion: 'control-theory-engineering-v0.3',
    revision: 2,
    sourceCommit,
    previous: { bundleId: LEGACY_ROOT_ID, sumsSha256: legacySums },
  });
  await writeLegacyClosure(root);
  if (!options.successor) {
    await commitAndTag(root, ['stable-control-theory-engineering-v0.3-r2']);
    return { legacySums, endpointName: 'control-theory-engineering-v0.3-r2' };
  }
  const endpointName = 'control-theory-engineering-v0.4-r2';
  await writeBundle({
    root,
    name: endpointName,
    bundleId: 'ctb:control-theory-engineering-v0.4:r2',
    releaseId: 'ctr:release:control-theory-engineering-v0.4',
    releaseVersion: 'control-theory-engineering-v0.4',
    revision: 2,
    sourceCommit,
    previous: {
      bundleId: CHAIN_HEAD_ID,
      sumsSha256: sha256(
        await readFile(path.join(root, 'releases/control-theory-engineering-v0.3-r2/SHA256SUMS')),
      ),
    },
    publicationTag: options.endpointPublicationTag,
  });
  await commitAndTag(root, [
    'stable-control-theory-engineering-v0.3-r2',
    options.endpointPublicationTag ?? `stable-${endpointName}`,
  ]);
  return { legacySums, endpointName };
}

describe('resolveLatestStableAggregate', () => {
  it('selects the unique stable Aggregate chain endpoint', async () => {
    const { root, sourceCommit } = await initRepo();
    await writeValidChain(root, sourceCommit, { successor: true });

    const result = await resolveLatestStableAggregate({
      actkgRoot: root,
      mainRef: 'main',
    });

    expect(result.releaseVersion).toBe('control-theory-engineering-v0.4');
    expect(result.bundleId).toBe('ctb:control-theory-engineering-v0.4:r2');
    expect(result.bundleRevision).toBe(2);
    expect(result.sourceCommit).toBe(sourceCommit);
    expect(result.candidateChain).toEqual([
      CHAIN_HEAD_ID,
      'ctb:control-theory-engineering-v0.4:r2',
    ]);
    expect(result.candidateChainEndpoints).toEqual([
      'ctb:control-theory-engineering-v0.4:r2',
    ]);
    expect(result.predecessorRootClosure).toMatchObject({
      path: CLOSURE_PATH,
      bundleId: LEGACY_ROOT_ID,
      protocol: 'actkg-legacy-predecessor-root-closure/1',
      algorithm: 'sha256sums-legacy-exact-root/1',
    });
    expect(result.resolutionDigest).toMatch(/^[0-9a-f]{64}$/u);

    const resolved = await resolveLatestStableAggregateWithCandidates({
      actkgRoot: root,
      mainRef: 'main',
    });
    expect(resolved.binding).toEqual(result);
    expect(resolved.activeCandidates.map((candidate) => candidate.bundleId)).toEqual([
      CHAIN_HEAD_ID,
      'ctb:control-theory-engineering-v0.4:r2',
    ]);
    expect(resolved.activeCandidates[1]).toMatchObject({
      bundlePath: 'releases/control-theory-engineering-v0.4-r2',
      releaseVersion: 'control-theory-engineering-v0.4',
      bundleRevision: 2,
      manifestSha256: expect.stringMatching(/^[0-9a-f]{64}$/u),
      sha256sumsSha256: expect.stringMatching(/^[0-9a-f]{64}$/u),
      validationReportSha256: expect.stringMatching(/^[0-9a-f]{64}$/u),
    });
  });

  it('selects the highest revision and excludes the old revision from the chain', async () => {
    const { root, sourceCommit } = await initRepo();
    const legacySums = await writeLegacyRoot(root);
    await writeBundle({
      root,
      name: 'control-theory-engineering-v0.3-r1',
      bundleId: 'ctb:control-theory-engineering-v0.3:r1-old',
      releaseId: 'ctr:release:control-theory-engineering-v0.3',
      releaseVersion: 'control-theory-engineering-v0.3',
      revision: 1,
      sourceCommit,
      previous: { bundleId: LEGACY_ROOT_ID, sumsSha256: legacySums },
    });
    await writeBundle({
      root,
      name: 'control-theory-engineering-v0.3-r2',
      bundleId: CHAIN_HEAD_ID,
      releaseId: 'ctr:release:control-theory-engineering-v0.3',
      releaseVersion: 'control-theory-engineering-v0.3',
      revision: 2,
      sourceCommit,
      previous: { bundleId: LEGACY_ROOT_ID, sumsSha256: legacySums },
    });
    await writeLegacyClosure(root);
    await writeBundle({
      root,
      name: 'control-theory-engineering-v0.4-r2',
      bundleId: 'ctb:control-theory-engineering-v0.4:r2',
      releaseId: 'ctr:release:control-theory-engineering-v0.4',
      releaseVersion: 'control-theory-engineering-v0.4',
      revision: 2,
      sourceCommit,
      previous: {
        bundleId: CHAIN_HEAD_ID,
        sumsSha256: sha256(
          await readFile(path.join(root, 'releases/control-theory-engineering-v0.3-r2/SHA256SUMS')),
        ),
      },
    });
    await commitAndTag(root, [
      'stable-control-theory-engineering-v0.3-r2',
      'stable-control-theory-engineering-v0.4-r2',
    ]);

    const result = await resolveLatestStableAggregate({ actkgRoot: root, mainRef: 'main' });
    expect(result.candidateChain).toEqual([
      CHAIN_HEAD_ID,
      'ctb:control-theory-engineering-v0.4:r2',
    ]);
  });

  it('fails closed on duplicate revisions for one release identity', async () => {
    const { root, sourceCommit } = await initRepo();
    const options = {
      root,
      releaseId: 'ctr:release:duplicate',
      releaseVersion: 'duplicate',
      revision: 1,
      sourceCommit,
    };
    await writeBundle({ ...options, name: 'duplicate-a', bundleId: 'ctb:duplicate:a' });
    await writeBundle({ ...options, name: 'duplicate-b', bundleId: 'ctb:duplicate:b' });

    await expect(
      resolveLatestStableAggregate({ actkgRoot: root, mainRef: 'main' }),
    ).rejects.toThrow('repeats bundle revision 1');
  });

  it('fails closed when the stable Aggregate graph has two endpoints', async () => {
    const { root, sourceCommit } = await initRepo();
    const legacySums = await writeLegacyRoot(root);
    await writeBundle({
      root,
      name: 'control-theory-engineering-v0.3-r2',
      bundleId: CHAIN_HEAD_ID,
      releaseId: 'ctr:release:control-theory-engineering-v0.3',
      releaseVersion: 'control-theory-engineering-v0.3',
      revision: 2,
      sourceCommit,
      previous: { bundleId: LEGACY_ROOT_ID, sumsSha256: legacySums },
    });
    await writeLegacyClosure(root);
    for (const suffix of ['a', 'b']) {
      await writeBundle({
        root,
        name: `control-theory-engineering-v0.4-${suffix}-r2`,
        bundleId: `ctb:control-theory-engineering-v0.4-${suffix}:r2`,
        releaseId: `ctr:release:control-theory-engineering-v0.4-${suffix}`,
        releaseVersion: `control-theory-engineering-v0.4-${suffix}`,
        revision: 2,
        sourceCommit,
        previous: { bundleId: CHAIN_HEAD_ID, sumsSha256: sha256(await readFile(path.join(root, 'releases/control-theory-engineering-v0.3-r2/SHA256SUMS'))) },
      });
    }
    git(root, ['add', 'releases', 'docs']);
    git(root, ['commit', '-m', 'fixture branches']);
    await expect(
      resolveLatestStableAggregate({ actkgRoot: root, mainRef: 'main' }),
    ).rejects.toThrow('expected one endpoint, found 2');
  });

  it('fails closed when an ordinary predecessor is absent', async () => {
    const { root, sourceCommit } = await initRepo();
    await writeBundle({
      root,
      name: 'control-theory-engineering-v0.4-r2',
      bundleId: 'ctb:control-theory-engineering-v0.4:r2',
      releaseId: 'ctr:release:control-theory-engineering-v0.4',
      releaseVersion: 'control-theory-engineering-v0.4',
      revision: 2,
      sourceCommit,
      previous: { bundleId: 'ctb:missing:r2', sumsSha256: 'f'.repeat(64) },
    });

    await expect(
      resolveLatestStableAggregate({ actkgRoot: root, mainRef: 'main' }),
    ).rejects.toThrow('previous_bundle ctb:missing:r2 is missing');
  });

  it('fails closed when predecessor SHA256SUMS identity drifts', async () => {
    const { root, sourceCommit } = await initRepo();
    const legacySums = await writeLegacyRoot(root);
    await writeBundle({
      root,
      name: 'control-theory-engineering-v0.3-r2',
      bundleId: CHAIN_HEAD_ID,
      releaseId: 'ctr:release:control-theory-engineering-v0.3',
      releaseVersion: 'control-theory-engineering-v0.3',
      revision: 2,
      sourceCommit,
      previous: { bundleId: LEGACY_ROOT_ID, sumsSha256: legacySums },
    });
    await writeLegacyClosure(root);
    await writeBundle({
      root,
      name: 'control-theory-engineering-v0.4-r2',
      bundleId: 'ctb:control-theory-engineering-v0.4:r2',
      releaseId: 'ctr:release:control-theory-engineering-v0.4',
      releaseVersion: 'control-theory-engineering-v0.4',
      revision: 2,
      sourceCommit,
      previous: {
        bundleId: CHAIN_HEAD_ID,
        sumsSha256: sha256(await readFile(path.join(root, 'releases/control-theory-engineering-v0.3-r2/SHA256SUMS'))),
      },
      previousHashOverride: 'f'.repeat(64),
    });

    await expect(
      resolveLatestStableAggregate({ actkgRoot: root, mainRef: 'main' }),
    ).rejects.toThrow('predecessor SHA256SUMS drift');
  });

  it('fails closed when the stable tag omits the current package SHA256SUMS', async () => {
    const { root, sourceCommit } = await initRepo();
    await writeValidChain(root, sourceCommit, {
      successor: true,
      endpointPublicationTag: 'source-v2',
    });

    await expect(
      resolveLatestStableAggregate({ actkgRoot: root, mainRef: 'main' }),
    ).rejects.toThrow('stable tag source-v2 is missing');
  });

  it('fails closed when closure artifact_hash drifts', async () => {
    const { root, sourceCommit } = await initRepo();
    await writeValidChain(root, sourceCommit);
    const closurePath = path.join(root, CLOSURE_PATH);
    const closure = JSON.parse(await readFile(closurePath, 'utf8')) as Record<string, unknown>;
    closure.artifact_hash = 'f'.repeat(64);
    await writeFile(closurePath, JSON.stringify(closure));
    git(root, ['add', CLOSURE_PATH]);
    git(root, ['commit', '-m', 'drift closure hash']);

    await expect(
      resolveLatestStableAggregate({ actkgRoot: root, mainRef: 'main' }),
    ).rejects.toThrow('artifact_hash mismatch');
  });

  it('fails closed when a legacy member hash drifts', async () => {
    const { root, sourceCommit } = await initRepo();
    await writeValidChain(root, sourceCommit);
    await writeFile(path.join(root, LEGACY_ROOT, 'RELEASE-NOTES.md'), 'drift\n');

    await expect(
      resolveLatestStableAggregate({ actkgRoot: root, mainRef: 'main' }),
    ).rejects.toThrow('legacy root closure member hash mismatch');
  });

  it('fails closed when closure consumer binding drifts', async () => {
    const { root, sourceCommit } = await initRepo();
    await writeValidChain(root, sourceCommit);
    const closurePath = path.join(root, CLOSURE_PATH);
    const closure = JSON.parse(await readFile(closurePath, 'utf8')) as Record<string, any>;
    closure.consumer_binding.value.bundle_id = 'ctb:wrong:r1';
    const body = { ...closure };
    delete body.artifact_hash;
    closure.artifact_hash = sha256(canonicalJson(body));
    await writeFile(closurePath, JSON.stringify(closure));
    git(root, ['add', CLOSURE_PATH]);
    git(root, ['commit', '-m', 'drift closure consumer']);

    await expect(
      resolveLatestStableAggregate({ actkgRoot: root, mainRef: 'main' }),
    ).rejects.toThrow('consumer previous_bundle value drift');
  });

  it('fails closed when the stable tag SHA256SUMS bytes drift from the current package', async () => {
    const { root, sourceCommit } = await initRepo();
    await writeValidChain(root, sourceCommit, { successor: true });
    const bundleDir = path.join(root, 'releases/control-theory-engineering-v0.4-r2');
    await writeFile(path.join(bundleDir, 'validation-report.json'), JSON.stringify({ result: 'PASS', drift: true }));
    await rewriteBundleSums(bundleDir);

    await expect(
      resolveLatestStableAggregate({ actkgRoot: root, mainRef: 'main' }),
    ).rejects.toThrow(/Artifact hash drift|SHA256SUMS bytes drift/u);
  });

  it('fails closed when the stable tag omits a Bundle member listed by SHA256SUMS', async () => {
    const { root, sourceCommit } = await initRepo();
    const legacySums = await writeLegacyRoot(root);
    await writeBundle({
      root,
      name: 'control-theory-engineering-v0.3-r2',
      bundleId: CHAIN_HEAD_ID,
      releaseId: 'ctr:release:control-theory-engineering-v0.3',
      releaseVersion: 'control-theory-engineering-v0.3',
      revision: 2,
      sourceCommit,
      previous: { bundleId: LEGACY_ROOT_ID, sumsSha256: legacySums },
    });
    await writeLegacyClosure(root);
    const bundleDir = path.join(root, 'releases/control-theory-engineering-v0.3-r2');
    git(root, ['add', LEGACY_ROOT, CLOSURE_PATH, path.join(bundleDir, 'SHA256SUMS')]);
    git(root, ['commit', '-m', 'publish incomplete bundle']);
    git(root, ['tag', 'stable-control-theory-engineering-v0.3-r2']);
    git(root, ['add', 'releases']);
    git(root, ['commit', '-m', 'add omitted bundle members']);

    await expect(
      resolveLatestStableAggregate({ actkgRoot: root, mainRef: 'main' }),
    ).rejects.toThrow(/Bundle member set drift|is missing releases\/control-theory-engineering-v0\.3-r2\/bundle-manifest\.json/u);
  });

  it('rejects self-consistent SHA256SUMS when bundle_digest is not recomputable', async () => {
    const { root, sourceCommit } = await initRepo();
    await writeValidChain(root, sourceCommit);
    const bundleDir = path.join(root, 'releases/control-theory-engineering-v0.3-r2');
    const manifestPath = path.join(bundleDir, 'bundle-manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
    manifest.bundle_digest = 'f'.repeat(64);
    await writeFile(manifestPath, JSON.stringify(manifest));
    await rewriteBundleSums(bundleDir);

    await expect(
      resolveLatestStableAggregate({ actkgRoot: root, mainRef: 'main' }),
    ).rejects.toThrow('bundle_digest mismatch');
  });

  it('rejects a self-consistent package with an unregistered Bundle contract', async () => {
    const { root, sourceCommit } = await initRepo();
    await writeValidChain(root, sourceCommit);
    const bundleDir = path.join(root, 'releases/control-theory-engineering-v0.3-r2');
    const manifestPath = path.join(bundleDir, 'bundle-manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
    manifest.bundle_contract_version = 'actkg-public-bundle/999';
    const digestBody = { ...manifest };
    delete digestBody.bundle_digest;
    manifest.bundle_digest = sha256(canonicalJson(digestBody));
    await writeFile(manifestPath, JSON.stringify(manifest));
    await rewriteBundleSums(bundleDir);

    await expect(
      resolveLatestStableAggregate({ actkgRoot: root, mainRef: 'main' }),
    ).rejects.toThrow('unregistered bundle contract');
  });
});
