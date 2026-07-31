import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

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

  const bundleDir = path.join(root, 'releases', 'control-v1');
  await mkdir(bundleDir, { recursive: true });
  await writeFile(path.join(bundleDir, 'validation-report.json'), '{"result":"PASS"}\n');
  const manifest = {
    bundle_contract_version: 'actkg-public-bundle/1',
    bundle_digest: sha256('bundle'),
    bundle_id: 'ctb:control-v1:r1',
    bundle_kind: 'aggregate',
    bundle_revision: 1,
    publication: { tag: 'stable-control-v1' },
    previous_bundle: null,
    release: {
      release_hash: sha256('release'),
      release_id: 'ctr:release:control-v1',
      release_version: 'control-v1',
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
  git(root, ['add', 'releases']);
  git(root, ['commit', '-m', 'fixture stable bundle']);
  git(root, ['tag', 'stable-control-v1']);
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
        releaseId: 'ctr:release:control-v1',
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
        readFile(path.join(outputRoot, 'releases', 'control-v1', 'SHA256SUMS')),
      ).resolves.toBeTruthy();
    } finally {
      await rm(actkgRoot, { recursive: true, force: true });
      await rm(workRoot, { recursive: true, force: true });
    }
  });
});
