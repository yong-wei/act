import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { canonicalJson } from '../../../scripts/actkg-release/authoritative-release';
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

async function fixtureRepo(): Promise<string> {
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
  const manifest = {
    bundle_contract_version: 'actkg-public-bundle/1',
    bundle_digest: sha256('bundle'),
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
      release_version: 'control-theory-engineering-v0.3',
      source_dataset_hash: sha256('source-dataset'),
    },
    release_stage: 'stable',
    schema: { sha256: sha256('schema'), version: '0.2.0' },
    source_revision: { commit: sourceCommit, tag: 'source-v1' },
    statistics: { knowledge_nodes: 0 },
    components: [],
  };
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
    } finally {
      await rm(actkgRoot, { recursive: true, force: true });
      await rm(workRoot, { recursive: true, force: true });
    }
  });
});
