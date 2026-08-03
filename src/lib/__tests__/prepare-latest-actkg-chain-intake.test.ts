import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { canonicalJson } from '../../../scripts/actkg-release/authoritative-release';
import { computeCanonicalReleaseHash } from '../../../scripts/actkg-release/actkg-canonical-digests';
import { CTKG_SCHEMA_RAW_SHA256 } from '../../../scripts/actkg-release/bundle-compatibility-registry';
import {
  resolveLatestStableAggregate,
} from '../../../scripts/actkg-release/latest-stable-aggregate';
import {
  prepareLatestActkgChainIntake,
  validateBundleDirectory,
  validateReleaseVersionSegment,
} from '../../../scripts/knowledge-cutover/prepare-latest-actkg-chain-intake';

const ADMITTED_ENDPOINT = {
  releaseSetId: 'actkg-authoritative-candidate-v2',
  releaseId: 'control-theory-engineering-v0.2',
  releaseVersion: 'control-theory-engineering-v0.2',
  releaseHash: '1'.repeat(64),
  sourceDatasetHash: '2'.repeat(64),
  candidateState: 'CANDIDATE',
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

async function writeSums(directory: string, names: string[]): Promise<string> {
  const rows = await Promise.all(names.sort().map(async (name) => (
    `${sha256(await readFile(path.join(directory, name)))}  ${name}`
  )));
  const bytes = Buffer.from(`${rows.join('\n')}\n`);
  await writeFile(path.join(directory, 'SHA256SUMS'), bytes);
  return sha256(bytes);
}

async function fixtureActkg(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'act-chain-fixture-'));
  git(root, ['init', '-b', 'main']);
  git(root, ['config', 'user.email', 'chain@example.invalid']);
  git(root, ['config', 'user.name', 'Chain Fixture']);
  await writeFile(path.join(root, 'README.md'), 'fixture\n');
  git(root, ['add', 'README.md']);
  git(root, ['commit', '-m', 'source']);
  const sourceCommit = git(root, ['rev-parse', 'HEAD']);
  for (let version = 3; version <= 8; version += 1) {
    git(root, ['tag', `source-v0.${version}`]);
  }

  const sharedDir = path.join(root, 'releases', 'shared-component-v0.1');
  await mkdir(sharedDir, { recursive: true });
  const sharedReportBytes = Buffer.from('{"result":"PASS"}\n');
  const sharedManifest = {
    bundle_contract_version: 'actkg-public-bundle/1',
    bundle_digest: '',
    bundle_id: 'ctb:shared-component-v0.1:r1',
    bundle_kind: 'module',
    bundle_revision: 1,
    publication: { tag: 'shared-component-v0.1' },
    release: {
      release_hash: sha256('shared-release'),
      release_id: 'ctr:release:shared-component-v0.1',
      release_version: 'shared-component-v0.1',
      source_dataset_hash: sha256('shared-source'),
    },
    release_stage: 'stable',
    schema: { sha256: CTKG_SCHEMA_RAW_SHA256, version: '0.2.0' },
    source_revision: { commit: sourceCommit, tag: 'source-v1' },
    artifacts: [{
      role: 'validation_report',
      contract_version: 'ctkg-validation-report/0.2',
      required: true,
      path: 'validation-report.json',
      media_type: 'application/json',
      sha256: sha256(sharedReportBytes),
      byte_length: sharedReportBytes.byteLength,
      record_count: null,
    }],
  };
  const sharedDigestBody = { ...sharedManifest } as Record<string, unknown>;
  delete sharedDigestBody.bundle_digest;
  sharedManifest.bundle_digest = sha256(canonicalJson(sharedDigestBody));
  await writeFile(path.join(sharedDir, 'bundle-manifest.json'), JSON.stringify(sharedManifest));
  await writeFile(path.join(sharedDir, 'validation-report.json'), sharedReportBytes);
  const sharedManifestSha = sha256(await readFile(path.join(sharedDir, 'bundle-manifest.json')));
  const sharedDigest = sharedManifest.bundle_digest;
  await writeSums(sharedDir, ['bundle-manifest.json', 'validation-report.json']);

  const legacyRoot = path.join(root, 'releases', 'control-theory-engineering-v0.3');
  await mkdir(legacyRoot, { recursive: true });
  await writeFile(path.join(legacyRoot, 'legacy.txt'), 'legacy\n');
  const legacySums = await writeSums(legacyRoot, ['legacy.txt']);

  let previousId = 'ctb:control-theory-engineering-v0.3:r1';
  let previousSums = legacySums;
  const aggregateManifests: Array<{ directory: string; manifestBytes: Buffer; sums: string }> = [];
  for (let version = 3; version <= 8; version += 1) {
    const name = `control-theory-engineering-v0.${version}-r2`;
    const directory = path.join(root, 'releases', name);
    await mkdir(directory, { recursive: true });
    const bundleId = `ctb:control-theory-engineering-v0.${version}:r2`;
    const releaseVersion = `control-theory-engineering-v0.${version}`;
    const releaseId = `ctr:release:${releaseVersion}`;
    const releasePayload: Record<string, unknown> = {
      id: releaseId,
      release_version: releaseVersion,
      source_dataset_hash: sha256(`dataset-${version}`),
      lifecycle_status: 'accepted',
      publication_status: 'published',
      entries: [],
      included_entities: [],
      component_releases: [],
    };
    releasePayload.release_hash = computeCanonicalReleaseHash(releasePayload);
    const releaseBytes = Buffer.from(JSON.stringify(releasePayload));
    const aggregateReportBytes = Buffer.from('{"result":"PASS"}');
    const projectionBytes = Buffer.from('{}');
    const ndjsonBytes = Buffer.from('{}\n');
    const artifactBytes = [
      { role: 'release_notes', contract_version: 'actkg-release-notes/1', path: 'RELEASE-NOTES.md', media_type: 'text/markdown', bytes: Buffer.from('fixture\n') },
      { role: 'projection', contract_version: 'ctkg-graph-projection/0.2', path: 'act-projection.json', media_type: 'application/json', bytes: projectionBytes },
      { role: 'projection', contract_version: 'ctkg-graph-projection/0.2', path: 'domain-projection.json', media_type: 'application/json', bytes: projectionBytes },
      { role: 'projection', contract_version: 'ctkg-graph-projection/0.2', path: 'review-projection.json', media_type: 'application/json', bytes: projectionBytes },
      { role: 'component_manifest', contract_version: 'actkg-component-manifest/1', path: 'component-releases.json', media_type: 'application/json', bytes: Buffer.from('{"components":[]}') },
      { role: 'ctkg_schema', contract_version: 'ctkg-json-schema/0.2', path: 'ctkg.schema.json', media_type: 'application/schema+json', bytes: Buffer.from('{"version":"0.2.0"}') },
      { role: 'projection_link_metadata', contract_version: 'actkg-projection-link-metadata/1', path: 'projection-link-metadata.jsonl', media_type: 'application/x-ndjson', bytes: ndjsonBytes },
      { role: 'rag_crosswalk', contract_version: 'actkg-rag-crosswalk/1', path: 'rag-crosswalk.jsonl', media_type: 'application/x-ndjson', bytes: ndjsonBytes },
      { role: 'validation_report', contract_version: 'actkg-validation-report/1', path: 'validation-report.json', media_type: 'application/json', bytes: aggregateReportBytes },
      { role: 'release', contract_version: 'ctkg-release/0.2', path: 'release.json', media_type: 'application/json', bytes: releaseBytes },
    ];
    for (const artifact of artifactBytes) {
      await writeFile(path.join(directory, artifact.path), artifact.bytes);
    }
    const manifest = {
      bundle_contract_version: 'actkg-public-bundle/1',
      bundle_digest: '',
      bundle_id: bundleId,
      bundle_kind: 'aggregate',
      bundle_revision: 2,
      components: version === 3 ? [] : [{
        bundle_digest: sharedDigest,
        bundle_id: 'ctb:shared-component-v0.1:r1',
        component_role: 'module',
        manifest_sha256: sharedManifestSha,
        reference_kind: 'standard_bundle',
        release_hash: sharedManifest.release.release_hash,
        release_id: sharedManifest.release.release_id,
        release_version: sharedManifest.release.release_version,
      }],
      previous_bundle: {
        bundle_id: previousId,
        kind: version === 3 ? 'legacy_exact' : 'aggregate',
        sha256sums_sha256: previousSums,
      },
      publication: { tag: name },
      release: {
        release_hash: releasePayload.release_hash,
        release_id: releaseId,
        release_version: releaseVersion,
        source_dataset_hash: releasePayload.source_dataset_hash,
      },
      release_stage: 'stable',
      schema: { sha256: CTKG_SCHEMA_RAW_SHA256, version: '0.2.0' },
      source_revision: { commit: sourceCommit, tag: `source-v0.${version}` },
      statistics: {},
      artifacts: artifactBytes.map((artifact) => ({
        role: artifact.role,
        contract_version: artifact.contract_version,
        required: true,
        path: artifact.path,
        media_type: artifact.media_type,
        sha256: sha256(artifact.bytes),
        byte_length: artifact.bytes.byteLength,
        record_count: artifact.media_type.includes('ndjson') ? 1 : null,
      })),
    };
    const digestBody = { ...manifest } as Record<string, unknown>;
    delete digestBody.bundle_digest;
    manifest.bundle_digest = sha256(canonicalJson(digestBody));
    const manifestBytes = Buffer.from(JSON.stringify(manifest));
    await writeFile(path.join(directory, 'bundle-manifest.json'), manifestBytes);
    const sums = await writeSums(directory, ['bundle-manifest.json', ...artifactBytes.map((artifact) => artifact.path)]);
    aggregateManifests.push({ directory, manifestBytes, sums });
    previousId = bundleId;
    previousSums = sums;
  }

  const closureBody = {
    algorithm_version: 'sha256sums-legacy-exact-root/1',
    authority_implementation: 'fixture',
    authority_protocol: 'ctkg-m1k-v1d-predecessor-closure/1',
    bundle_id: 'ctb:control-theory-engineering-v0.3:r1',
    bundle_path: 'releases/control-theory-engineering-v0.3',
    consumer_binding: {
      consumer_bundle_id: 'ctb:control-theory-engineering-v0.3:r2',
      field: 'previous_bundle',
      manifest_path: 'releases/control-theory-engineering-v0.3-r2/bundle-manifest.json',
      manifest_sha256: sha256(aggregateManifests[0]!.manifestBytes),
      value: {
        bundle_id: 'ctb:control-theory-engineering-v0.3:r1',
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
    member_checksum_count: 1,
    reference_kind: 'legacy_exact',
    release_version: 'control-theory-engineering-v0.3',
    sha256sums_path: 'releases/control-theory-engineering-v0.3/SHA256SUMS',
    sha256sums_raw_sha256: legacySums,
    status: 'PASS',
  };
  const closurePath = path.join(root, 'docs/coordination/m1j/v0.3-r1-predecessor-closure.json');
  await mkdir(path.dirname(closurePath), { recursive: true });
  await writeFile(closurePath, JSON.stringify({
    ...closureBody,
    artifact_hash: sha256(canonicalJson(closureBody)),
  }));
  git(root, ['add', 'releases', 'docs']);
  git(root, ['commit', '-m', 'stable chain']);
  for (let version = 3; version <= 8; version += 1) {
    git(root, ['tag', `control-theory-engineering-v0.${version}-r2`]);
  }
  return root;
}

async function makeBinding(
  actkgRoot: string,
  workRoot: string,
  admittedEndpoint?: typeof ADMITTED_ENDPOINT,
): Promise<string> {
  const binding = await resolveLatestStableAggregate({
    actkgRoot,
    mainRef: 'main',
    ...(admittedEndpoint ? { admittedEndpoint, predecessorRootClosurePath: 'docs/coordination/m1j/v0.3-r1-predecessor-closure.json' } : {}),
  });
  const bindingPath = path.join(workRoot, 'binding.json');
  await writeFile(bindingPath, `${JSON.stringify(binding, null, 2)}\n`);
  return bindingPath;
}

describe('prepareLatestActkgChainIntake', () => {
  it('rejects a checksummed component whose canonical bundle digest is wrong', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'act-component-digest-'));
    const manifest = {
      bundle_contract_version: 'actkg-public-bundle/1',
      bundle_digest: 'f'.repeat(64),
      bundle_id: 'ctb:component-digest-test:r1',
      bundle_kind: 'module',
      bundle_revision: 1,
      publication: { tag: 'component-digest-test' },
      release: {
        release_hash: sha256('release'),
        release_id: 'ctr:release:component-digest-test',
        release_version: 'component-digest-test',
        source_dataset_hash: sha256('source'),
      },
      release_stage: 'stable',
      schema: { sha256: CTKG_SCHEMA_RAW_SHA256, version: '0.2.0' },
      source_revision: { commit: 'a'.repeat(40), tag: 'source' },
    };
    try {
      await writeFile(path.join(directory, 'bundle-manifest.json'), JSON.stringify(manifest));
      await writeFile(path.join(directory, 'validation-report.json'), '{"result":"PASS"}\n');
      await writeSums(directory, ['bundle-manifest.json', 'validation-report.json']);
      await expect(validateBundleDirectory(directory, {
        bundleId: manifest.bundle_id,
        bundleDigest: manifest.bundle_digest,
      })).rejects.toThrow(/bundle_digest cannot be recomputed/u);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rejects aggregate and component release_version path escapes', () => {
    expect(() => validateReleaseVersionSegment(
      '../aggregate',
      'aggregate.release_version',
    )).toThrow('aggregate.release_version must be a single safe path segment');
    expect(() => validateReleaseVersionSegment(
      'C:\\component',
      'component.release_version',
    )).toThrow('component.release_version must be a single safe path segment');
    expect(() => validateReleaseVersionSegment(
      '/absolute',
      'component.release_version',
    )).toThrow('component.release_version must be a single safe path segment');
    expect(validateReleaseVersionSegment('control-theory-engineering-v0.8')).toBe(
      'control-theory-engineering-v0.8',
    );
  });

  it('stages the complete chain, deduplicates shared components, and rejects reruns', async () => {
    const actkgRoot = await fixtureActkg();
    const repoRoot = await mkdtemp(path.join(tmpdir(), 'act-chain-repo-'));
    const admittedEndpointPath = path.join(repoRoot, 'admitted-endpoint.json');
    await writeFile(admittedEndpointPath, `${JSON.stringify(ADMITTED_ENDPOINT)}\n`);
    const bindingPath = await makeBinding(actkgRoot, repoRoot, ADMITTED_ENDPOINT);
    const outputRoot = path.join(repoRoot, 'course-content/authoring/knowledge/chain');
    try {
      const receipt = await prepareLatestActkgChainIntake({
        actkgRoot,
        mainRef: 'main',
        bindingPath,
        repoRoot,
        outputRoot,
        admittedEndpointPath,
        predecessorRootClosurePath: 'docs/coordination/m1j/v0.3-r1-predecessor-closure.json',
      });
      expect(receipt.chain).toHaveLength(6);
      const entries = receipt.chain as Array<Record<string, string | number>>;
      expect(entries.map((entry) => entry.releaseVersion)).toEqual([
        'control-theory-engineering-v0.3',
        'control-theory-engineering-v0.4',
        'control-theory-engineering-v0.5',
        'control-theory-engineering-v0.6',
        'control-theory-engineering-v0.7',
        'control-theory-engineering-v0.8',
      ]);
      expect(entries[0]).toMatchObject({
        bundleId: 'ctb:control-theory-engineering-v0.3:r2',
        releaseVersion: 'control-theory-engineering-v0.3',
      });
      expect(new Set(entries.map((entry) => entry.releaseSetId)).size).toBe(6);
      for (const entry of entries) {
        expect(entry.lockPath).toMatch(/^course-content\/authoring\/knowledge\/chain\/release-set\.lock\.v3\..+-r2\.json$/u);
        const lock = JSON.parse(await readFile(path.join(repoRoot, String(entry.lockPath)), 'utf8'));
        expect(lock.bundle.controlled_path).toMatch(/^course-content\/authoring\/knowledge\/chain\//u);
        if (entry.releaseVersion === 'control-theory-engineering-v0.3') {
          expect(lock.components).toEqual([]);
        } else {
          expect(lock.components[0].controlled_path).toBe(
            'course-content/authoring/knowledge/chain/releases/shared-component-v0.1',
          );
        }
      }
      await expect(prepareLatestActkgChainIntake({
        actkgRoot,
        mainRef: 'main',
        bindingPath,
        repoRoot,
        outputRoot,
        admittedEndpointPath,
        predecessorRootClosurePath: 'docs/coordination/m1j/v0.3-r1-predecessor-closure.json',
      })).rejects.toThrow('outputRoot already exists');
    } finally {
      await rm(actkgRoot, { recursive: true, force: true });
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it('rejects outputRoot escape and frozen binding drift before creating an attempt', async () => {
    const actkgRoot = await fixtureActkg();
    const repoRoot = await mkdtemp(path.join(tmpdir(), 'act-chain-repo-'));
    const bindingPath = await makeBinding(actkgRoot, repoRoot);
    try {
      await expect(prepareLatestActkgChainIntake({
        actkgRoot,
        mainRef: 'main',
        bindingPath,
        repoRoot,
        outputRoot: path.join(repoRoot, '..', 'escaped-chain'),
      })).rejects.toThrow('outputRoot must be inside repoRoot');
      const binding = JSON.parse(await readFile(bindingPath, 'utf8'));
      binding.resolutionDigest = 'f'.repeat(64);
      await writeFile(bindingPath, JSON.stringify(binding));
      const outputRoot = path.join(repoRoot, 'course-content/authoring/knowledge/drift');
      await expect(prepareLatestActkgChainIntake({
        actkgRoot,
        mainRef: 'main',
        bindingPath,
        repoRoot,
        outputRoot,
      })).rejects.toThrow('live ActKG resolution no longer matches the frozen binding');
    } finally {
      await rm(actkgRoot, { recursive: true, force: true });
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it('fails closed when an admitted endpoint bundleId is not an active candidate', async () => {
    const actkgRoot = await fixtureActkg();
    const repoRoot = await mkdtemp(path.join(tmpdir(), 'act-chain-repo-'));
    const outputRoot = path.join(repoRoot, 'course-content/authoring/knowledge/missing-endpoint');
    const endpoint = {
      ...ADMITTED_ENDPOINT,
      bundleId: 'ctb:missing-admitted-endpoint:r2',
    };
    const bindingPath = await makeBinding(actkgRoot, repoRoot, endpoint);
    try {
      await expect(prepareLatestActkgChainIntake({
        actkgRoot,
        mainRef: 'main',
        bindingPath,
        repoRoot,
        outputRoot,
      })).rejects.toThrow('admitted endpoint bundleId is not an active candidate');
      await expect(lstat(outputRoot)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await rm(actkgRoot, { recursive: true, force: true });
      await rm(repoRoot, { recursive: true, force: true });
    }
  });
});
