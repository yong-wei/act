import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { computeV018ImpactReport } from '../../../scripts/actkg-release/actkg-v018-impact';
import {
  assertGitDirectoryMatchesWorkingTree,
  PUBLIC_BUNDLE_V2_ADAPTER_CAPTURE_PATHS,
  resolveTrustedCaptureRevision,
} from '../../../scripts/actkg-release/capture-revision';
import { loadAndValidatePublicBundleV2 } from '../../../scripts/actkg-release/public-bundle-v2';
import { V018_ACT_CONTROLLED_PATH } from '../../../scripts/actkg-release/actkg-v018-release-mirror';
import {
  assertV018CandidateBundleCounts,
  V018_CANDIDATE_CAPTURE_PATHS,
  V018_CANDIDATE_MIGRATIONS_PATH,
} from '../../../scripts/knowledge-cutover/prepare-actkg-v018-authority-candidate';
import type { ValidatedActKGBundleV2 } from '../../../scripts/actkg-release/public-bundle-types';

const V09_PATH = 'course-content/authoring/knowledge/releases/control-theory-engineering-v0.9';
const HASH = 'a'.repeat(64);

async function createRegisteredBundleCaptureFixture(): Promise<{ root: string; head: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'actkg-v018-counts-capture-'));
  for (const capturePath of PUBLIC_BUNDLE_V2_ADAPTER_CAPTURE_PATHS) {
    const source = path.join(process.cwd(), capturePath);
    const destination = path.join(root, capturePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(source, destination, { recursive: true });
  }
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'actkg-v018-counts@example.invalid']);
  git(root, ['config', 'user.name', 'actkg-v018-counts']);
  git(root, ['add', '.']);
  git(root, ['commit', '-qm', 'registered v0.18 count capture']);
  return { root, head: git(root, ['rev-parse', 'HEAD']) };
}

function git(root: string, args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

async function createV09CaptureFixture(): Promise<{ root: string; head: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'actkg-v018-impact-capture-'));
  const bundleRoot = path.join(root, V09_PATH);
  await mkdir(bundleRoot, { recursive: true });
  await writeFile(path.join(bundleRoot, 'bundle-manifest.json'), JSON.stringify({
    bundle_contract_version: 'actkg-public-bundle/1',
    bundle_id: 'v09-fixture',
    bundle_revision: 1,
    bundle_digest: HASH,
    release: {
      release_id: 'release-v09',
      release_version: 'v0.9',
      release_hash: HASH,
      source_dataset_hash: HASH,
    },
  }));
  await writeFile(path.join(bundleRoot, 'release.json'), JSON.stringify({
    entries: [{ entity: 'node-v09', release_tier: 'core' }],
  }));
  await writeFile(path.join(bundleRoot, 'act-projection.json'), JSON.stringify({
    id: 'projection-v09',
    version_digest: HASH,
    nodes: [{
      entity_id: 'node-v09',
      entity_type: 'DomainConcept',
      release_tier: 'core',
      semantic_name: 'fixture',
      display_name: 'fixture',
    }],
    links: [],
  }));
  await writeFile(path.join(bundleRoot, 'projection-link-metadata.jsonl'), '');
  await writeFile(path.join(bundleRoot, 'rag-crosswalk.jsonl'), '');
  await writeFile(path.join(bundleRoot, 'component-releases.json'), JSON.stringify({ components: [] }));
  const migrationRoot = path.join(root, V018_CANDIDATE_MIGRATIONS_PATH, '20260101000000_fixture');
  await mkdir(migrationRoot, { recursive: true });
  await writeFile(path.join(migrationRoot, 'migration.sql'), 'CREATE TABLE "fixture" ("id" TEXT);\n');
  await writeFile(
    path.join(root, '.gitignore'),
    'prisma/migrations/ignored-migration/\n',
  );
  for (const relativePath of [
    'prisma.config.ts',
    'src/lib/prisma-client.ts',
    'scripts/knowledge-cutover/admit-latest-actkg-aggregate.ts',
  ]) {
    const absolutePath = path.join(root, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, `export const fixture = ${JSON.stringify(relativePath)};\n`);
  }
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'actkg-v018-boundary@example.invalid']);
  git(root, ['config', 'user.name', 'actkg-v018-boundary']);
  git(root, ['add', '.']);
  git(root, ['commit', '-qm', 'v0.9 capture fixture']);
  return { root, head: git(root, ['rev-parse', 'HEAD']) };
}

const emptyCandidate = {} as ValidatedActKGBundleV2;

describe('ActKG v0.18 candidate capture boundaries', () => {
  it('accepts the registered V2 bundle statistics and rejects a projection count drift', async () => {
    const capture = await createRegisteredBundleCaptureFixture();
    try {
      const bundle = await loadAndValidatePublicBundleV2({
        root: process.cwd(),
        bundlePath: V018_ACT_CONTROLLED_PATH,
        gitRoot: capture.root,
        captureRevision: capture.head,
      });
      expect(() => assertV018CandidateBundleCounts(bundle)).not.toThrow();
      const tampered = {
        ...bundle,
        statistics: {
          ...bundle.statistics,
          projectionNodes: bundle.statistics.projectionNodes - 1,
        },
      };
      expect(() => assertV018CandidateBundleCounts(tampered)).toThrow(/projectionNodes=6842 != 6843/u);
    } finally {
      await rm(capture.root, { recursive: true, force: true });
    }
  });

  it('protects the complete v0.9 and implementation dependency closure', () => {
    expect(V018_CANDIDATE_CAPTURE_PATHS).toEqual(expect.arrayContaining([
      V09_PATH,
      'package.json',
      'package-lock.json',
      'prisma.config.ts',
      'prisma/schema.prisma',
      'prisma/migrations',
      'src/lib/prisma-client.ts',
      'scripts/knowledge-cutover/admit-latest-actkg-aggregate.ts',
      'scripts/knowledge-cutover/prepare-actkg-cutover-authority-candidate.ts',
      'scripts/actkg-release/public-bundle-v2-import.ts',
      'scripts/actkg-release/capture-revision.ts',
      'scripts/actkg-release/public-bundle-v2.ts',
      'scripts/actkg-release/public-bundle-types.ts',
      'scripts/actkg-release/public-bundle-v2-admission.ts',
      'scripts/actkg-release/bundle-compatibility-registry-v2.ts',
      'scripts/actkg-release/schemas/public-bundle-v2',
      'scripts/actkg-release/actkg-v018-impact.ts',
      'src/lib/authoritative-knowledge/contracts.ts',
      'src/lib/authoritative-knowledge/repository.ts',
      'src/lib/authoritative-knowledge/authority-snapshot.ts',
      'scripts/knowledge-cutover/prepare-actkg-v018-authority-candidate.ts',
    ]));
  });

  it('accepts a clean migration tree and rejects old-file, deletion, and new-file drift', async () => {
    const fixture = await createV09CaptureFixture();
    const migrationFile = path.join(
      fixture.root,
      V018_CANDIDATE_MIGRATIONS_PATH,
      '20260101000000_fixture',
      'migration.sql',
    );
    try {
      await expect(assertGitDirectoryMatchesWorkingTree({
        gitRoot: fixture.root,
        revision: fixture.head,
        relativeDirectory: V018_CANDIDATE_MIGRATIONS_PATH,
        fail: (message) => { throw new Error(message); },
      })).resolves.toBeUndefined();

      await writeFile(migrationFile, 'CREATE TABLE "fixture" ("id" TEXT, "drift" TEXT);\n');
      await expect(assertGitDirectoryMatchesWorkingTree({
        gitRoot: fixture.root,
        revision: fixture.head,
        relativeDirectory: V018_CANDIDATE_MIGRATIONS_PATH,
        fail: (message) => { throw new Error(message); },
      })).rejects.toThrow(/content drift/u);

      await writeFile(migrationFile, 'CREATE TABLE "fixture" ("id" TEXT);\n');
      await rm(migrationFile);
      await expect(assertGitDirectoryMatchesWorkingTree({
        gitRoot: fixture.root,
        revision: fixture.head,
        relativeDirectory: V018_CANDIDATE_MIGRATIONS_PATH,
        fail: (message) => { throw new Error(message); },
      })).rejects.toThrow(/file is missing/u);

      await writeFile(migrationFile, 'CREATE TABLE "fixture" ("id" TEXT);\n');
      await mkdir(path.join(fixture.root, 'prisma/migrations/ignored-migration'), { recursive: true });
      await writeFile(
        path.join(fixture.root, 'prisma/migrations/ignored-migration/migration.sql'),
        'CREATE TABLE "ignored" ("id" TEXT);\n',
      );
      await expect(assertGitDirectoryMatchesWorkingTree({
        gitRoot: fixture.root,
        revision: fixture.head,
        relativeDirectory: V018_CANDIDATE_MIGRATIONS_PATH,
        fail: (message) => { throw new Error(message); },
      })).rejects.toThrow(/undeclared file/u);

      await rm(path.join(fixture.root, 'prisma/migrations/ignored-migration'), {
        recursive: true,
        force: true,
      });
      await mkdir(path.join(fixture.root, 'prisma/migrations/new-migration'), { recursive: true });
      await writeFile(
        path.join(fixture.root, 'prisma/migrations/new-migration/migration.sql'),
        'CREATE TABLE "new" ("id" TEXT);\n',
      );
      await expect(assertGitDirectoryMatchesWorkingTree({
        gitRoot: fixture.root,
        revision: fixture.head,
        relativeDirectory: V018_CANDIDATE_MIGRATIONS_PATH,
        fail: (message) => { throw new Error(message); },
      })).rejects.toThrow(/undeclared file/u);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it('rejects admission helper and Prisma client dependency drift at capture preflight', async () => {
    const fixture = await createV09CaptureFixture();
    const protectedPaths = [
      V018_CANDIDATE_MIGRATIONS_PATH,
      'prisma.config.ts',
      'src/lib/prisma-client.ts',
      'scripts/knowledge-cutover/admit-latest-actkg-aggregate.ts',
    ];
    try {
      await writeFile(
        path.join(fixture.root, 'scripts/knowledge-cutover/admit-latest-actkg-aggregate.ts'),
        'export const fixture = "helper-drift";\n',
      );
      expect(() => resolveTrustedCaptureRevision({
        gitRoot: fixture.root,
        trackedPaths: protectedPaths,
        expectedCaptureRevision: fixture.head,
        fail: (message) => { throw new Error(message); },
      })).toThrow(/clean protected Git inputs/u);

      await writeFile(
        path.join(fixture.root, 'scripts/knowledge-cutover/admit-latest-actkg-aggregate.ts'),
        'export const fixture = "admit-latest-actkg-aggregate.ts";\n',
      );
      await writeFile(
        path.join(fixture.root, 'src/lib/prisma-client.ts'),
        'export const fixture = "dependency-drift";\n',
      );
      expect(() => resolveTrustedCaptureRevision({
        gitRoot: fixture.root,
        trackedPaths: protectedPaths,
        expectedCaptureRevision: fixture.head,
        fail: (message) => { throw new Error(message); },
      })).toThrow(/clean protected Git inputs/u);

      await writeFile(
        path.join(fixture.root, 'src/lib/prisma-client.ts'),
        'export const fixture = "src/lib/prisma-client.ts";\n',
      );
      await writeFile(
        path.join(fixture.root, 'prisma.config.ts'),
        'export const fixture = "config-drift";\n',
      );
      expect(() => resolveTrustedCaptureRevision({
        gitRoot: fixture.root,
        trackedPaths: protectedPaths,
        expectedCaptureRevision: fixture.head,
        fail: (message) => { throw new Error(message); },
      })).toThrow(/clean protected Git inputs/u);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it('rejects an explicitly external v0.9 root before reading candidate input', async () => {
    const fixture = await createV09CaptureFixture();
    try {
      await expect(computeV018ImpactReport({
        repoRoot: fixture.root,
        captureGitRoot: fixture.root,
        v09Root: path.join(fixture.root, 'external-v0.9'),
        candidate: emptyCandidate,
        candidateReleaseSetId: 'candidate-v018',
        captureRevision: fixture.head,
      })).rejects.toThrow(/tracked v0\.9 release directory/u);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it('rejects v0.9 working-tree tampering even when the capture SHA is unchanged', async () => {
    const fixture = await createV09CaptureFixture();
    try {
      await writeFile(
        path.join(fixture.root, V09_PATH, 'release.json'),
        JSON.stringify({ entries: [{ entity: 'tampered', release_tier: 'core' }] }),
      );
      await expect(computeV018ImpactReport({
        repoRoot: fixture.root,
        captureGitRoot: fixture.root,
        candidate: emptyCandidate,
        candidateReleaseSetId: 'candidate-v018',
        captureRevision: fixture.head,
      })).rejects.toThrow(/clean protected Git inputs/u);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });
});
