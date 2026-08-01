import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdtemp,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { canonicalJson } from '../../../scripts/actkg-release/authoritative-release';
import { computeCanonicalReleaseHash } from '../../../scripts/actkg-release/actkg-canonical-digests';
import { CTKG_SCHEMA_RAW_SHA256 } from '../../../scripts/actkg-release/bundle-compatibility-registry';
import {
  resolveLatestStableAggregate,
  resolveLatestStableAggregateWithCandidates,
} from '../../../scripts/actkg-release/latest-stable-aggregate';

const LEGACY_ROOT = 'releases/control-theory-engineering-v0.3';
const LEGACY_ROOT_ID = 'ctb:control-theory-engineering-v0.3:r1';
const CHAIN_HEAD_ID = 'ctb:control-theory-engineering-v0.3:r2';
const CLOSURE_PATH = 'docs/coordination/m1j/v0.3-r1-predecessor-closure.json';
const ADMITTED_ENDPOINT = {
  releaseSetId: 'actkg-authoritative-candidate-v2',
  releaseId: 'control-theory-engineering-v0.2',
  releaseVersion: 'control-theory-engineering-v0.2',
  releaseHash: '1'.repeat(64),
  sourceDatasetHash: '2'.repeat(64),
  candidateState: 'CANDIDATE',
  projectionId: 'ctr:projection:control-theory-engineering-v0.2:act-v2',
  projectionDigest: '3'.repeat(64),
} as const;

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

async function writeLegacyRoot(
  root: string,
  options: { rootPath?: string; filePrefix?: string } = {},
): Promise<string> {
  const rootPath = options.rootPath ?? LEGACY_ROOT;
  const filePrefix = options.filePrefix ?? 'control-theory-engineering-v0.3';
  const directory = path.join(root, rootPath);
  await mkdir(directory, { recursive: true });
  const names = [
    'RELEASE-NOTES.md',
    'component-releases.json',
    `${filePrefix}.act-projection.json`,
    `${filePrefix}.domain-projection.json`,
    `${filePrefix}.projection-link-metadata.jsonl`,
    `${filePrefix}.rag-crosswalk.jsonl`,
    `${filePrefix}.release.json`,
    `${filePrefix}.review-projection.json`,
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
  const releasePayload: Record<string, unknown> = {
    id: releaseId,
    release_version: releaseVersion,
    source_dataset_hash: sha256(`source:${releaseId}`),
    lifecycle_status: 'accepted',
    publication_status: 'published',
    entries: [],
    included_entities: [],
    component_releases: [],
  };
  releasePayload.release_hash = computeCanonicalReleaseHash(releasePayload);
  const artifactBytes: Array<{ role: string; contract_version: string; path: string; media_type: string; bytes: Buffer; profile?: string; profiles?: string[] }> = [
    { role: 'release_notes', contract_version: 'actkg-release-notes/1', path: 'RELEASE-NOTES.md', media_type: 'text/markdown', bytes: Buffer.from('fixture\n') },
    { role: 'projection', contract_version: 'ctkg-graph-projection/0.2', path: 'act-projection.json', profile: 'runtime', media_type: 'application/json', bytes: Buffer.from('{}') },
    { role: 'projection', contract_version: 'ctkg-graph-projection/0.2', path: 'domain-projection.json', profile: 'domain', media_type: 'application/json', bytes: Buffer.from('{}') },
    { role: 'projection', contract_version: 'ctkg-graph-projection/0.2', path: 'review-projection.json', profile: 'review', media_type: 'application/json', bytes: Buffer.from('{}') },
    { role: 'component_manifest', contract_version: 'actkg-component-manifest/1', path: 'component-releases.json', media_type: 'application/json', bytes: Buffer.from('{"components":[]}') },
    { role: 'ctkg_schema', contract_version: 'ctkg-json-schema/0.2', path: 'ctkg.schema.json', media_type: 'application/schema+json', bytes: Buffer.from('{"version":"0.2.0"}') },
    { role: 'projection_link_metadata', contract_version: 'actkg-projection-link-metadata/1', path: 'projection-link-metadata.jsonl', media_type: 'application/x-ndjson', bytes: Buffer.from('{}\n') },
    { role: 'rag_crosswalk', contract_version: 'actkg-rag-crosswalk/1', path: 'rag-crosswalk.jsonl', media_type: 'application/x-ndjson', bytes: Buffer.from('{}\n') },
    { role: 'validation_report', contract_version: 'actkg-validation-report/1', path: 'validation-report.json', media_type: 'application/json', bytes: Buffer.from('{"result":"PASS"}') },
    { role: 'release', contract_version: 'ctkg-release/0.2', path: 'release.json', media_type: 'application/json', bytes: Buffer.from(JSON.stringify(releasePayload)) },
  ];
  for (const artifact of artifactBytes) await writeFile(path.join(bundleDir, artifact.path), artifact.bytes);
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
      release_hash: input.releaseHashOverride ?? String(releasePayload.release_hash),
      release_id: releaseId,
      release_version: releaseVersion,
      source_dataset_hash: sha256(`source:${releaseId}`),
    },
    release_stage: 'stable',
    schema: { sha256: CTKG_SCHEMA_RAW_SHA256, version: '0.2.0' },
    source_revision: { commit: input.sourceCommit, tag: 'source-v2' },
    statistics: { knowledge_nodes: 1 },
    artifacts: artifactBytes.map((artifact) => ({
      role: artifact.role,
      contract_version: artifact.contract_version,
      required: true,
      path: artifact.path,
      media_type: artifact.media_type,
      ...(artifact.profile ? { profile: artifact.profile } : {}),
      ...(artifact.profiles ? { profiles: artifact.profiles } : {}),
      sha256: sha256(artifact.bytes),
      byte_length: artifact.bytes.byteLength,
      record_count: artifact.media_type.includes('ndjson') ? 1 : null,
    })),
  };
  const digestBody = { ...manifest };
  delete digestBody.bundle_digest;
  manifest.bundle_digest = input.bundleDigestOverride
    ?? sha256(canonicalJson(digestBody));
  await writeFile(
    path.join(bundleDir, 'bundle-manifest.json'),
    JSON.stringify(manifest),
  );
  const files = ['bundle-manifest.json', ...artifactBytes.map((artifact) => artifact.path)].sort();
  const rows = await Promise.all(
    files.map(async (file) => (
      `${sha256(await readFile(path.join(bundleDir, file)))}  ${file}`
    )),
  );
  const sums = `${rows.join('\n')}\n`;
  await writeFile(path.join(bundleDir, 'SHA256SUMS'), sums);
  return sha256(sums);
}

async function writeLegacyClosure(root: string, options: {
  legacyRootPath?: string;
  legacyRootId?: string;
  chainHeadPath?: string;
  chainHeadId?: string;
  closurePath?: string;
  releaseVersion?: string;
} = {}): Promise<void> {
  const legacyRootPath = options.legacyRootPath ?? LEGACY_ROOT;
  const legacyRootId = options.legacyRootId ?? LEGACY_ROOT_ID;
  const chainHeadPath = options.chainHeadPath ?? 'releases/control-theory-engineering-v0.3-r2';
  const chainHeadId = options.chainHeadId ?? CHAIN_HEAD_ID;
  const closurePath = options.closurePath ?? CLOSURE_PATH;
  const releaseVersion = options.releaseVersion ?? 'control-theory-engineering-v0.3';
  const legacySums = sha256(
    await readFile(path.join(root, legacyRootPath, 'SHA256SUMS')),
  );
  const consumerPath = path.join(root, chainHeadPath, 'bundle-manifest.json');
  const consumerManifest = await readFile(consumerPath);
  const body = {
    algorithm_version: 'sha256sums-legacy-exact-root/1',
    authority_implementation: 'src/ctkg_schema/section_kg/m1k_v1d_predecessors.py',
    authority_protocol: 'ctkg-m1k-v1d-predecessor-closure/1',
    bundle_id: legacyRootId,
    bundle_path: legacyRootPath,
    consumer_binding: {
      consumer_bundle_id: chainHeadId,
      field: 'previous_bundle',
      manifest_path: `${chainHeadPath}/bundle-manifest.json`,
      manifest_sha256: sha256(consumerManifest),
      value: {
        bundle_id: legacyRootId,
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
    release_version: releaseVersion,
    sha256sums_path: `${legacyRootPath}/SHA256SUMS`,
    sha256sums_raw_sha256: legacySums,
    status: 'PASS',
  };
  await mkdir(path.join(root, path.dirname(closurePath)), { recursive: true });
  await writeFile(
    path.join(root, closurePath),
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

async function rewriteManifest(bundleDir: string, mutate: (manifest: Record<string, any>) => void): Promise<void> {
  const manifestPath = path.join(bundleDir, 'bundle-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, any>;
  mutate(manifest);
  for (const artifact of manifest.artifacts as Array<Record<string, any>>) {
    const bytes = await readFile(path.join(bundleDir, artifact.path));
    artifact.sha256 = sha256(bytes);
    artifact.byte_length = bytes.byteLength;
  }
  const digestBody = { ...manifest };
  delete digestBody.bundle_digest;
  manifest.bundle_digest = sha256(canonicalJson(digestBody));
  await writeFile(manifestPath, JSON.stringify(manifest));
  await rewriteBundleSums(bundleDir);
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
      admittedEndpoint: ADMITTED_ENDPOINT,
      predecessorRootClosurePath: CLOSURE_PATH,
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
    expect(result.admittedEndpoint).toEqual(ADMITTED_ENDPOINT);
    const { resolutionDigest, resolvedAt, ...digestInput } = result;
    expect(resolvedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u,
    );
    expect(resolutionDigest).toMatch(/^[0-9a-f]{64}$/u);
    expect(sha256(canonicalJson(digestInput))).toBe(resolutionDigest);

    const resolved = await resolveLatestStableAggregateWithCandidates({
      actkgRoot: root,
      mainRef: 'main',
      admittedEndpoint: ADMITTED_ENDPOINT,
      predecessorRootClosurePath: CLOSURE_PATH,
    });
    const {
      resolutionDigest: _resolvedDigest,
      resolvedAt: _resolvedAt,
      ...resolvedIdentity
    } = resolved.binding;
    expect(resolvedIdentity).toEqual(digestInput);
    expect(resolved.binding.resolvedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u,
    );
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

  it('discovers and validates a non-v0.3 predecessor root closure', async () => {
    const { root, sourceCommit } = await initRepo();
    const legacyRootPath = 'releases/alternate-legacy-root';
    const legacyRootId = 'ctb:alternate-legacy-root:r1';
    const chainHeadPath = 'releases/alternate-successor-r2';
    const chainHeadId = 'ctb:alternate-successor:r2';
    const closurePath = 'docs/coordination/alternate-predecessor-closure.json';
    const legacySums = await writeLegacyRoot(root, {
      rootPath: legacyRootPath,
      filePrefix: 'alternate-legacy-root',
    });
    await writeBundle({
      root,
      name: 'alternate-successor-r2',
      bundleId: chainHeadId,
      releaseId: 'ctr:release:alternate-successor',
      releaseVersion: 'alternate-successor',
      revision: 2,
      sourceCommit,
      previous: { bundleId: legacyRootId, sumsSha256: legacySums },
    });
    await writeLegacyClosure(root, {
      legacyRootPath,
      legacyRootId,
      chainHeadPath,
      chainHeadId,
      closurePath,
      releaseVersion: 'alternate-legacy-root',
    });
    await commitAndTag(root, ['stable-alternate-successor-r2']);

    const result = await resolveLatestStableAggregate({
      actkgRoot: root,
      mainRef: 'main',
    });
    expect(result.bundleId).toBe(chainHeadId);
    expect(result.predecessorRootClosure).toMatchObject({
      path: closurePath,
      bundleId: legacyRootId,
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
    ).rejects.toThrow('predecessor root closure input is ambiguous or missing');
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

  it('fails closed on an incomplete newer endpoint without falling back to the old endpoint', async () => {
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

  it('rejects an aggregate missing a registry-required Artifact role', async () => {
    const { root, sourceCommit } = await initRepo();
    await writeValidChain(root, sourceCommit);
    const bundleDir = path.join(root, 'releases/control-theory-engineering-v0.3-r2');
    await rewriteManifest(bundleDir, (manifest) => {
      manifest.artifacts = (manifest.artifacts as Array<Record<string, unknown>>)
        .filter((artifact) => artifact.role !== 'release');
    });
    await rm(path.join(bundleDir, 'release.json'));
    await rewriteBundleSums(bundleDir);
    await expect(
      resolveLatestStableAggregate({ actkgRoot: root, mainRef: 'main' }),
    ).rejects.toThrow('required aggregate Artifact missing');
  });

  it('rejects a release that is not formally published and accepted', async () => {
    const { root, sourceCommit } = await initRepo();
    await writeValidChain(root, sourceCommit);
    const bundleDir = path.join(root, 'releases/control-theory-engineering-v0.3-r2');
    const releasePath = path.join(bundleDir, 'release.json');
    const release = JSON.parse(await readFile(releasePath, 'utf8')) as Record<string, unknown>;
    release.publication_status = 'draft';
    release.release_hash = computeCanonicalReleaseHash(release);
    await writeFile(releasePath, JSON.stringify(release));
    await rewriteManifest(bundleDir, (manifest) => {
      const manifestRelease = manifest.release as Record<string, unknown>;
      manifestRelease.release_hash = release.release_hash;
    });
    await expect(
      resolveLatestStableAggregate({ actkgRoot: root, mainRef: 'main' }),
    ).rejects.toThrow('publication_status must be published');
  });

  it('rejects a stable endpoint whose publication tag object is missing', async () => {
    const { root, sourceCommit } = await initRepo();
    await writeValidChain(root, sourceCommit);
    git(root, ['tag', '-d', 'stable-control-theory-engineering-v0.3-r2']);
    await expect(
      resolveLatestStableAggregate({ actkgRoot: root, mainRef: 'main' }),
    ).rejects.toThrow();
  });
});
