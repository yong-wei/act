import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

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

async function writeBundle(input: {
  root: string;
  name: string;
  bundleId: string;
  sourceCommit: string;
  previous?: { bundleId: string; sumsSha256: string };
  previousHashOverride?: string;
  publicationTag?: string;
}): Promise<string> {
  const bundleDir = path.join(input.root, 'releases', input.name);
  await mkdir(bundleDir, { recursive: true });
  const report = JSON.stringify({ result: 'PASS' });
  await writeFile(path.join(bundleDir, 'validation-report.json'), report);
  const releaseVersion = input.name;
  const manifest = {
    bundle_contract_version: 'actkg-public-bundle/1',
    bundle_digest: sha256(`bundle:${input.bundleId}`),
    bundle_id: input.bundleId,
    bundle_kind: 'aggregate',
    bundle_revision: 1,
    publication: { tag: input.publicationTag ?? `stable-${input.name}` },
    previous_bundle: input.previous
      ? {
          bundle_id: input.previous.bundleId,
          kind: 'legacy_exact',
          sha256sums_sha256:
            input.previousHashOverride ?? input.previous.sumsSha256,
        }
      : null,
    release: {
      release_hash: sha256(`release:${input.bundleId}`),
      release_id: `ctr:release:${releaseVersion}`,
      release_version: releaseVersion,
      source_dataset_hash: sha256(`source:${input.bundleId}`),
    },
    release_stage: 'stable',
    schema: { sha256: sha256('schema'), version: '0.2.0' },
    source_revision: { commit: input.sourceCommit, tag: 'source-v2' },
    statistics: { knowledge_nodes: 1 },
  };
  await writeFile(
    path.join(bundleDir, 'bundle-manifest.json'),
    JSON.stringify(manifest),
  );
  const files = ['bundle-manifest.json', 'validation-report.json'];
  const rows: string[] = [];
  for (const file of files) {
    rows.push(
      `${sha256(await readFile(path.join(bundleDir, file)))}  ${file}`,
    );
  }
  await writeFile(path.join(bundleDir, 'SHA256SUMS'), `${rows.join('\n')}\n`);
  return sha256(await readFile(path.join(bundleDir, 'SHA256SUMS')));
}

async function rewriteSums(bundleDir: string): Promise<void> {
  const files = ['bundle-manifest.json', 'validation-report.json'];
  const rows = [];
  for (const file of files) {
    rows.push(`${sha256(await readFile(path.join(bundleDir, file)))}  ${file}`);
  }
  await writeFile(path.join(bundleDir, 'SHA256SUMS'), `${rows.join('\n')}\n`);
}

async function commitAndTagEndpoint(
  root: string,
  endpointName: string,
): Promise<void> {
  git(root, ['add', 'releases']);
  git(root, ['commit', '-m', 'fixture bundles']);
  git(root, ['tag', `stable-${endpointName}`]);
}

describe('resolveLatestStableAggregate', () => {
  it('selects the unique stable Aggregate chain endpoint', async () => {
    const { root, sourceCommit } = await initRepo();
    const firstSums = await writeBundle({
      root,
      name: 'control-v1',
      bundleId: 'ctb:control-v1:r1',
      sourceCommit,
    });
    await writeBundle({
      root,
      name: 'control-v2',
      bundleId: 'ctb:control-v2:r1',
      sourceCommit,
      previous: {
        bundleId: 'ctb:control-v1:r1',
        sumsSha256: firstSums,
      },
    });
    await commitAndTagEndpoint(root, 'control-v2');

    const result = await resolveLatestStableAggregate({
      actkgRoot: root,
      mainRef: 'main',
    });

    expect(result.releaseVersion).toBe('control-v2');
    expect(result.bundleId).toBe('ctb:control-v2:r1');
    expect(result.sourceCommit).toBe(sourceCommit);
    expect(result.candidateChain).toEqual([
      'ctb:control-v1:r1',
      'ctb:control-v2:r1',
    ]);
    expect(result.candidateChainEndpoints).toEqual(['ctb:control-v2:r1']);
    expect(result.resolutionDigest).toMatch(/^[0-9a-f]{64}$/u);
  });

  it('fails closed when the stable Aggregate graph has two endpoints', async () => {
    const { root, sourceCommit } = await initRepo();
    const firstSums = await writeBundle({
      root,
      name: 'control-v1',
      bundleId: 'ctb:control-v1:r1',
      sourceCommit,
    });
    for (const name of ['control-v2a', 'control-v2b']) {
      await writeBundle({
        root,
        name,
        bundleId: `ctb:${name}:r1`,
        sourceCommit,
        previous: {
          bundleId: 'ctb:control-v1:r1',
          sumsSha256: firstSums,
        },
      });
    }

    await expect(
      resolveLatestStableAggregate({ actkgRoot: root, mainRef: 'main' }),
    ).rejects.toThrow('expected one endpoint, found 2');
  });

  it('fails closed when predecessor SHA256SUMS identity drifts', async () => {
    const { root, sourceCommit } = await initRepo();
    const firstSums = await writeBundle({
      root,
      name: 'control-v1',
      bundleId: 'ctb:control-v1:r1',
      sourceCommit,
    });
    await writeBundle({
      root,
      name: 'control-v2',
      bundleId: 'ctb:control-v2:r1',
      sourceCommit,
      previous: {
        bundleId: 'ctb:control-v1:r1',
        sumsSha256: firstSums,
      },
      previousHashOverride: 'f'.repeat(64),
    });

    await expect(
      resolveLatestStableAggregate({ actkgRoot: root, mainRef: 'main' }),
    ).rejects.toThrow('predecessor SHA256SUMS drift');
  });

  it('fails closed when a declared predecessor is absent from the candidate set', async () => {
    const { root, sourceCommit } = await initRepo();
    await writeBundle({
      root,
      name: 'control-v2',
      bundleId: 'ctb:control-v2:r1',
      sourceCommit,
      previous: {
        bundleId: 'ctb:control-v1:r1',
        sumsSha256: 'f'.repeat(64),
      },
    });

    await expect(
      resolveLatestStableAggregate({ actkgRoot: root, mainRef: 'main' }),
    ).rejects.toThrow('previous_bundle ctb:control-v1:r1 is missing');
  });

  it('fails closed when the stable tag omits the current package SHA256SUMS', async () => {
    const { root, sourceCommit } = await initRepo();
    await writeBundle({
      root,
      name: 'control-v2',
      bundleId: 'ctb:control-v2:r1',
      sourceCommit,
      publicationTag: 'source-v2',
    });

    await expect(
      resolveLatestStableAggregate({ actkgRoot: root, mainRef: 'main' }),
    ).rejects.toThrow('stable tag source-v2 is missing');
  });

  it('fails closed when the stable tag SHA256SUMS bytes drift from the current package', async () => {
    const { root, sourceCommit } = await initRepo();
    await writeBundle({
      root,
      name: 'control-v2',
      bundleId: 'ctb:control-v2:r1',
      sourceCommit,
    });
    await commitAndTagEndpoint(root, 'control-v2');
    const bundleDir = path.join(root, 'releases', 'control-v2');
    await writeFile(path.join(bundleDir, 'validation-report.json'), JSON.stringify({ result: 'PASS', drift: true }));
    await rewriteSums(bundleDir);

    await expect(
      resolveLatestStableAggregate({ actkgRoot: root, mainRef: 'main' }),
    ).rejects.toThrow('SHA256SUMS bytes drift');
  });

  it('fails closed when the stable tag omits a Bundle member listed by SHA256SUMS', async () => {
    const { root, sourceCommit } = await initRepo();
    await writeBundle({
      root,
      name: 'control-v2',
      bundleId: 'ctb:control-v2:r1',
      sourceCommit,
    });
    const bundleDir = path.join(root, 'releases', 'control-v2');
    git(root, ['add', path.join(bundleDir, 'SHA256SUMS')]);
    git(root, ['commit', '-m', 'publish incomplete bundle']);
    git(root, ['tag', 'stable-control-v2']);
    git(root, ['add', 'releases']);
    git(root, ['commit', '-m', 'add omitted bundle members']);

    await expect(
      resolveLatestStableAggregate({ actkgRoot: root, mainRef: 'main' }),
    ).rejects.toThrow('is missing releases/control-v2/bundle-manifest.json');
  });
});
