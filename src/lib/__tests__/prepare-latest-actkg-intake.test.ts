import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { canonicalJson } from '../../../scripts/actkg-release/authoritative-release';
import { CTKG_SCHEMA_RAW_SHA256 } from '../../../scripts/actkg-release/bundle-compatibility-registry';
import { prepareLatestActkgIntake } from '../../../scripts/knowledge-cutover/prepare-latest-actkg-intake';
import { resolveLatestStableAggregate } from '../../../scripts/actkg-release/latest-stable-aggregate';

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function git(root: string, args: string[]): string {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

async function fixtureRepo(options?: {
  aggregateReleaseVersion?: string;
  componentReleaseVersion?: string;
}): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'act-intake-'));
  git(root, ['init', '-b', 'main']);
  git(root, ['config', 'user.email', 'intake@example.invalid']);
  git(root, ['config', 'user.name', 'Intake Test']);
  await writeFile(path.join(root, 'README.md'), 'fixture\n');
  git(root, ['add', 'README.md']);
  git(root, ['commit', '-m', 'fixture source']);
  const sourceCommit = git(root, ['rev-parse', 'HEAD']);
  git(root, ['tag', 'source-v1']);

  const legacyDir = path.join(root, 'releases', 'control-theory-engineering-v0.3');
  await mkdir(legacyDir, { recursive: true });
  await writeFile(path.join(legacyDir, 'legacy.txt'), 'legacy\n');
  const legacySums = `${sha256(await readFile(path.join(legacyDir, 'legacy.txt')))}  legacy.txt\n`;
  await writeFile(path.join(legacyDir, 'SHA256SUMS'), legacySums);

  const bundleDir = path.join(root, 'releases', 'control-theory-engineering-v0.3-r2');
  await mkdir(bundleDir, { recursive: true });
  await writeFile(path.join(bundleDir, 'validation-report.json'), '{"result":"PASS"}\n');
  const componentDir = path.join(root, 'releases', 'component-v1');
  await mkdir(componentDir, { recursive: true });
  await writeFile(path.join(componentDir, 'component.json'), '{"component":true}\n');
  const componentManifest: Record<string, unknown> = {
    bundle_contract_version: 'actkg-public-bundle/1',
    bundle_digest: '',
    bundle_id: 'ctb:component:v1',
    bundle_kind: 'course',
    bundle_revision: 1,
    publication: { tag: 'stable-component-v1' },
    release: {
      release_hash: sha256('component-release'),
      release_id: 'ctr:release:component-v1',
      release_version: options?.componentReleaseVersion ?? 'component-v1',
      source_dataset_hash: sha256('component-source'),
    },
    release_stage: 'stable',
    schema: { sha256: CTKG_SCHEMA_RAW_SHA256, version: '0.2.0' },
    source_revision: { commit: sourceCommit, tag: 'source-v1' },
    statistics: { knowledge_nodes: 0 },
    components: [],
    artifacts: [{
      role: 'release',
      contract_version: 'ctkg-release/0.2',
      required: true,
      path: 'component.json',
      media_type: 'application/json',
      sha256: sha256('{"component":true}\n'),
      byte_length: Buffer.byteLength('{"component":true}\n'),
      record_count: null,
    }],
  };
  const componentDigestBody = { ...componentManifest };
  delete componentDigestBody.bundle_digest;
  componentManifest.bundle_digest = sha256(canonicalJson(componentDigestBody));
  const componentManifestBytes = Buffer.from(`${JSON.stringify(componentManifest)}\n`);
  await writeFile(path.join(componentDir, 'bundle-manifest.json'), componentManifestBytes);
  const componentSums = (await Promise.all(
    ['bundle-manifest.json', 'component.json']
      .map(async (name) => `${sha256(await readFile(path.join(componentDir, name)))}  ${name}`),
  )).join('\n');
  await writeFile(path.join(componentDir, 'SHA256SUMS'), `${componentSums}\n`);
  const manifest: Record<string, unknown> = {
    bundle_contract_version: 'actkg-public-bundle/1',
    bundle_digest: '',
    bundle_id: 'ctb:control-theory-engineering-v0.3:r2',
    bundle_kind: 'aggregate',
    bundle_revision: 2,
    publication: { tag: 'stable-control-theory-engineering-v0.3-r2' },
    previous_bundle: {
      bundle_id: 'ctb:control-theory-engineering-v0.3:r1',
      kind: 'legacy_exact',
      sha256sums_sha256: sha256(legacySums),
    },
    release: {
      release_hash: sha256('release'),
      release_id: 'ctr:release:control-theory-engineering-v0.3',
      release_version: options?.aggregateReleaseVersion ?? 'control-theory-engineering-v0.3',
      source_dataset_hash: sha256('source-dataset'),
    },
    release_stage: 'stable',
    schema: { sha256: CTKG_SCHEMA_RAW_SHA256, version: '0.2.0' },
    source_revision: { commit: sourceCommit, tag: 'source-v1' },
    statistics: { knowledge_nodes: 0 },
    components: [{
      reference_kind: 'standard_bundle',
      release_id: 'ctr:release:component-v1',
      bundle_id: componentManifest.bundle_id,
      bundle_digest: componentManifest.bundle_digest,
      manifest_sha256: sha256(componentManifestBytes),
    }],
  };
  const digestBody = { ...manifest };
  delete digestBody.bundle_digest;
  manifest.bundle_digest = sha256(canonicalJson(digestBody));
  await writeFile(
    path.join(bundleDir, 'bundle-manifest.json'),
    `${JSON.stringify(manifest)}\n`,
  );
  const sums = (await Promise.all(
    ['bundle-manifest.json', 'validation-report.json']
      .map(async (name) => `${sha256(await readFile(path.join(bundleDir, name)))}  ${name}`),
  )).join('\n');
  await writeFile(path.join(bundleDir, 'SHA256SUMS'), `${sums}\n`);
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
      manifest_sha256: sha256(await readFile(path.join(bundleDir, 'bundle-manifest.json'))),
      value: manifest.previous_bundle,
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
    sha256sums_raw_sha256: sha256(legacySums),
    status: 'PASS',
  };
  await mkdir(path.join(root, 'docs/coordination/m1j'), { recursive: true });
  await writeFile(
    path.join(root, 'docs/coordination/m1j/v0.3-r1-predecessor-closure.json'),
    JSON.stringify({ ...closureBody, artifact_hash: sha256(canonicalJson(closureBody)) }),
  );
  git(root, ['add', 'releases', 'docs']);
  git(root, ['commit', '-m', 'fixture stable bundle']);
  git(root, ['tag', 'stable-control-theory-engineering-v0.3-r2']);
  return root;
}

describe('prepareLatestActkgIntake', () => {
  it('rejects a standard component that fails the shared formal boundary validator', async () => {
    const actkgRoot = await fixtureRepo();
    const workRoot = await mkdtemp(path.join(tmpdir(), 'act-intake-output-'));
    const bindingPath = path.join(workRoot, 'binding.json');
    try {
      const binding = await resolveLatestStableAggregate({ actkgRoot, mainRef: 'main' });
      await writeFile(bindingPath, `${JSON.stringify(binding, null, 2)}\n`);
      await writeFile(
        path.join(actkgRoot, 'releases', 'component-v1', 'undeclared.json'),
        '{}\n',
      );
      await expect(prepareLatestActkgIntake({
        actkgRoot,
        bindingPath,
        outputRoot: path.join(workRoot, 'attempt-invalid'),
        mainRef: 'main',
      })).rejects.toThrow(/component file set does not close over Manifest artifacts: ctb:component:v1/u);
    } finally {
      await rm(actkgRoot, { recursive: true, force: true });
      await rm(workRoot, { recursive: true, force: true });
    }
  });

  it('rejects component bytes whose rewritten SHA256SUMS disagrees with the Manifest', async () => {
    const actkgRoot = await fixtureRepo();
    const workRoot = await mkdtemp(path.join(tmpdir(), 'act-intake-output-'));
    const bindingPath = path.join(workRoot, 'binding.json');
    const componentDir = path.join(actkgRoot, 'releases', 'component-v1');
    try {
      const binding = await resolveLatestStableAggregate({ actkgRoot, mainRef: 'main' });
      await writeFile(bindingPath, `${JSON.stringify(binding, null, 2)}\n`);
      await writeFile(path.join(componentDir, 'component.json'), '{"component":true}\n\n');
      const rewrittenSums = (await Promise.all(
        ['bundle-manifest.json', 'component.json']
          .map(async (name) => `${sha256(await readFile(path.join(componentDir, name)))}  ${name}`),
      )).join('\n');
      await writeFile(path.join(componentDir, 'SHA256SUMS'), `${rewrittenSums}\n`);
      await expect(prepareLatestActkgIntake({
        actkgRoot,
        bindingPath,
        outputRoot: path.join(workRoot, 'attempt-artifact-drift'),
        mainRef: 'main',
      })).rejects.toThrow(/component Artifact hash drift: ctb:component:v1\/component\.json/u);
    } finally {
      await rm(actkgRoot, { recursive: true, force: true });
      await rm(workRoot, { recursive: true, force: true });
    }
  });

  it.each([
    ['aggregate', { aggregateReleaseVersion: '../../escaped' }],
    ['standard component', { componentReleaseVersion: '../../escaped' }],
  ])('rejects an unsafe %s release_version before constructing targets', async (_label, options) => {
    const actkgRoot = await fixtureRepo(options);
    const workRoot = await mkdtemp(path.join(tmpdir(), 'act-intake-output-'));
    const bindingPath = path.join(workRoot, 'binding.json');
    try {
      const binding = await resolveLatestStableAggregate({ actkgRoot, mainRef: 'main' });
      await writeFile(bindingPath, `${JSON.stringify(binding, null, 2)}\n`);
      const outputRoot = path.join(workRoot, 'attempt-invalid-path');
      await expect(prepareLatestActkgIntake({
        actkgRoot,
        bindingPath,
        outputRoot,
        mainRef: 'main',
      })).rejects.toThrow(/must be a single safe path segment/u);
      await expect(lstat(outputRoot)).rejects.toMatchObject({ code: 'ENOENT' });
      await expect(lstat(path.join(workRoot, 'escaped'))).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await rm(actkgRoot, { recursive: true, force: true });
      await rm(workRoot, { recursive: true, force: true });
    }
  });

  it('creates a fresh immutable attempt and rejects reruns', async () => {
    const actkgRoot = await fixtureRepo();
    const workRoot = await mkdtemp(path.join(tmpdir(), 'act-intake-output-'));
    const outputRoot = path.join(workRoot, 'attempt-1');
    const bindingPath = path.join(workRoot, 'binding.json');
    try {
      const binding = await resolveLatestStableAggregate({
        actkgRoot,
        mainRef: 'main',
      });
      await writeFile(bindingPath, `${JSON.stringify(binding, null, 2)}\n`);

      const receipt = await prepareLatestActkgIntake({
        actkgRoot,
        bindingPath,
        outputRoot,
        mainRef: 'main',
      });
      expect(receipt).toMatchObject({
        protocol: 'act-latest-stable-aggregate-intake/1',
        releaseId: 'ctr:release:control-theory-engineering-v0.3',
      });
      await expect(
        prepareLatestActkgIntake({
          actkgRoot,
          bindingPath,
          outputRoot,
          mainRef: 'main',
        }),
      ).rejects.toThrow('intake output root already exists');
      await expect(
        readFile(path.join(outputRoot, 'releases', 'control-theory-engineering-v0.3', 'SHA256SUMS')),
      ).resolves.toBeTruthy();
      await expect(
        readFile(path.join(outputRoot, 'releases', 'component-v1', 'bundle-manifest.json')),
      ).resolves.toBeTruthy();
    } finally {
      await rm(actkgRoot, { recursive: true, force: true });
      await rm(workRoot, { recursive: true, force: true });
    }
  });
});
