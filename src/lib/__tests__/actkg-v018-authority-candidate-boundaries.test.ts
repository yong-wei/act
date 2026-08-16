import { execFileSync } from 'node:child_process';
import { chmod, cp, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildV018DeltaProjections,
  computeV018ImpactReport,
} from '../../../scripts/actkg-release/actkg-v018-impact';
import {
  assertGitDirectoryMatchesWorkingTree,
  PUBLIC_BUNDLE_V2_ADAPTER_CAPTURE_PATHS,
  resolveTrustedCaptureRevision,
} from '../../../scripts/actkg-release/capture-revision';
import { loadAndValidatePublicBundleV2 } from '../../../scripts/actkg-release/public-bundle-v2';
import {
  V018_ACT_CONTROLLED_PATH,
  type ActkgV018MirrorReceipt,
} from '../../../scripts/actkg-release/actkg-v018-release-mirror';
import { acquireV2ImportLocks } from '../../../scripts/actkg-release/public-bundle-v2-import';
import {
  assertV018CandidateBundleCounts,
  assertV018CandidateEvidenceCaptureContract,
  assertGitFileMatchesWorkingTree,
  assertV018MirrorReceiptMatchesCapture,
  verifyV018CandidateEvidence,
  writeV018CandidateReceiptAfterCaptureCheck,
  V018_CANDIDATE_CAPTURE_PATHS,
  V018_CANDIDATE_MIGRATIONS_PATH,
  V018_MIRROR_RECEIPT_PATH,
  type V018AuthorityCandidateReceipt,
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

async function withRegisteredBundle<T>(run: (bundle: ValidatedActKGBundleV2) => T | Promise<T>): Promise<T> {
  const capture = await createRegisteredBundleCaptureFixture();
  try {
    const bundle = await loadAndValidatePublicBundleV2({
      root: process.cwd(),
      bundlePath: V018_ACT_CONTROLLED_PATH,
      gitRoot: capture.root,
      captureRevision: capture.head,
    });
    return await run(bundle);
  } finally {
    await rm(capture.root, { recursive: true, force: true });
  }
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
  const mirrorReceipt = path.join(root, V018_MIRROR_RECEIPT_PATH);
  await mkdir(path.dirname(mirrorReceipt), { recursive: true });
  await cp(path.join(process.cwd(), V018_MIRROR_RECEIPT_PATH), mirrorReceipt);
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'actkg-v018-boundary@example.invalid']);
  git(root, ['config', 'user.name', 'actkg-v018-boundary']);
  git(root, ['add', '.']);
  git(root, ['commit', '-qm', 'v0.9 capture fixture']);
  return { root, head: git(root, ['rev-parse', 'HEAD']) };
}

async function createEvidenceContractFixture(): Promise<{
  root: string;
  base: string;
  capture: string;
  generation: string;
  unrelated: string;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'actkg-v018-evidence-contract-'));
  await mkdir(path.join(root, 'source'), { recursive: true });
  await writeFile(path.join(root, 'source/input.txt'), 'stable source\n');
  await writeFile(path.join(root, 'source/tool.sh'), '#!/bin/sh\nprintf stable\n');
  await chmod(path.join(root, 'source/tool.sh'), 0o755);
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'actkg-evidence@example.invalid']);
  git(root, ['config', 'user.name', 'actkg-evidence']);
  git(root, ['add', '.']);
  git(root, ['commit', '-qm', 'base source']);
  const base = git(root, ['rev-parse', 'HEAD']);

  await writeFile(path.join(root, 'source/input.txt'), 'captured source\n');
  git(root, ['add', 'source/input.txt']);
  git(root, ['commit', '-qm', 'stable capture']);
  const capture = git(root, ['rev-parse', 'HEAD']);

  await mkdir(path.join(root, 'derived'), { recursive: true });
  await writeFile(path.join(root, 'derived/evidence.json'), '{"ok":true}\n');
  git(root, ['add', 'derived/evidence.json']);
  git(root, ['commit', '-qm', 'derived evidence']);
  const generation = git(root, ['rev-parse', 'HEAD']);

  git(root, ['checkout', '-qb', 'unrelated', base]);
  await writeFile(path.join(root, 'source/input.txt'), 'unrelated source\n');
  git(root, ['add', 'source/input.txt']);
  git(root, ['commit', '-qm', 'unrelated history']);
  const unrelated = git(root, ['rev-parse', 'HEAD']);
  git(root, ['checkout', '-q', generation]);
  return { root, base, capture, generation, unrelated };
}

async function createDefaultEvidenceContractFixture(): Promise<{
  root: string;
  capture: string;
  generation: string;
  outputRoot: string;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'actkg-v018-default-evidence-contract-'));
  for (const sourcePath of V018_CANDIDATE_CAPTURE_PATHS) {
    const target = path.join(root, sourcePath);
    if (sourcePath === V018_MIRROR_RECEIPT_PATH) {
      await mkdir(path.dirname(target), { recursive: true });
      await cp(path.join(process.cwd(), sourcePath), target);
    } else if (sourcePath === V018_ACT_CONTROLLED_PATH) {
      await mkdir(target, { recursive: true });
      await writeFile(path.join(target, 'bundle-manifest.json'), '{"fixture":"controlled"}\n');
      await writeFile(path.join(target, 'release.json'), '{"fixture":"controlled-release"}\n');
    } else if (sourcePath.endsWith('/migrations')) {
      const migration = path.join(target, '20260101000000_fixture', 'migration.sql');
      await mkdir(path.dirname(migration), { recursive: true });
      await writeFile(migration, 'CREATE TABLE "fixture" ("id" TEXT);\n');
    } else if (sourcePath.includes('/schemas/')) {
      await mkdir(target, { recursive: true });
      await writeFile(path.join(target, 'fixture.json'), '{"type":"object"}\n');
    } else if (sourcePath.endsWith('/control-theory-engineering-v0.9')) {
      await mkdir(target, { recursive: true });
      await writeFile(path.join(target, 'bundle-manifest.json'), '{"fixture":"v09"}\n');
    } else {
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, `export const fixture = ${JSON.stringify(sourcePath)};\n`);
    }
  }

  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'actkg-v018-default-evidence@example.invalid']);
  git(root, ['config', 'user.name', 'actkg-v018-default-evidence']);
  git(root, ['add', '.']);
  git(root, ['commit', '-qm', 'default source capture']);
  const capture = git(root, ['rev-parse', 'HEAD']);

  const outputRoot = path.join(root, 'candidate-output');
  await mkdir(outputRoot, { recursive: true });
  await writeFile(path.join(outputRoot, 'impact-report.json'), '{"ok":true}\n');
  const mirror = JSON.parse(
    (await readFile(path.join(root, V018_MIRROR_RECEIPT_PATH))).toString('utf8'),
  ) as ActkgV018MirrorReceipt;
  const captureContract = await assertV018CandidateEvidenceCaptureContract({
    repoRoot: root,
    captureRevision: capture,
    generationRevision: capture,
    derivedPaths: ['candidate-output'],
    allowUncommittedDerived: true,
  });
  await writeV018CandidateReceiptAfterCaptureCheck({
    repoRoot: root,
    captureRevision: capture,
    expectedMirrorReceipt: mirror,
    outputRoot,
    captureContract,
    allowUncommittedDerived: true,
    receipt: {
      captureRevision: capture,
      generationRevision: capture,
      sourceContractVersion: captureContract.sourceContractVersion,
      sourceManifestDigest: captureContract.sourceManifestDigest,
      sourceEntries: captureContract.sourceEntries,
      outputs: captureContract.outputs,
      mirror,
    } as V018AuthorityCandidateReceipt,
  });
  git(root, ['add', 'candidate-output']);
  git(root, ['commit', '-qm', 'derived candidate evidence']);
  return { root, capture, generation: git(root, ['rev-parse', 'HEAD']), outputRoot };
}

const emptyCandidate = {} as ValidatedActKGBundleV2;

describe('ActKG v0.18 candidate capture boundaries', () => {
  it('accepts exact-head and output-only ancestor captures with a source manifest', async () => {
    const fixture = await createEvidenceContractFixture();
    try {
      const ancestor = await assertV018CandidateEvidenceCaptureContract({
        repoRoot: fixture.root,
        captureRevision: fixture.capture,
        generationRevision: fixture.generation,
        sourcePaths: ['source'],
        derivedPaths: ['derived'],
      });
      expect(ancestor.captureRevision).toBe(fixture.capture);
      expect(ancestor.generationRevision).toBe(fixture.generation);
      expect(ancestor.sourceContractVersion).toBe('actkg-v018-authority-candidate/source/1');
      expect(ancestor.sourceEntries.map((entry) => entry.path)).toEqual([
        'source/input.txt',
        'source/tool.sh',
      ]);
      expect(ancestor.outputs).toEqual([expect.objectContaining({
        path: 'derived/evidence.json',
        mode: '100644',
        digestScope: 'bytes',
      })]);

      git(fixture.root, ['checkout', '-q', fixture.capture]);
      await mkdir(path.join(fixture.root, 'derived'), { recursive: true });
      await writeFile(path.join(fixture.root, 'derived/evidence.json'), '{"ok":true}\n');
      git(fixture.root, ['add', 'derived/evidence.json']);
      git(fixture.root, ['commit', '-qm', 'exact-head derived evidence']);
      const exactHead = git(fixture.root, ['rev-parse', 'HEAD']);
      const exact = await assertV018CandidateEvidenceCaptureContract({
        repoRoot: fixture.root,
        captureRevision: exactHead,
        generationRevision: exactHead,
        sourcePaths: ['source'],
        derivedPaths: ['derived'],
      });
      expect(exact.captureRevision).toBe(exactHead);
      expect(exact.generationRevision).toBe(exactHead);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it('allows generation preflight to rebuild missing E-derived outputs but keeps verification strict', async () => {
    const fixture = await createEvidenceContractFixture();
    const derivedRoot = path.join(fixture.root, 'derived');
    try {
      await rm(derivedRoot, { recursive: true, force: true });
      await expect(stat(derivedRoot)).rejects.toBeDefined();
      await expect(assertV018CandidateEvidenceCaptureContract({
        repoRoot: fixture.root,
        captureRevision: fixture.generation,
        generationRevision: fixture.generation,
        sourcePaths: ['source'],
        derivedPaths: ['derived'],
        allowUncommittedDerived: true,
      })).resolves.toMatchObject({
        captureRevision: fixture.generation,
        generationRevision: fixture.generation,
        outputs: [],
      });
      await expect(verifyV018CandidateEvidence({
        repoRoot: fixture.root,
        captureRevision: fixture.generation,
        generationRevision: fixture.generation,
        outputRoot: derivedRoot,
        sourcePaths: ['source'],
      })).rejects.toThrow(/missing from the working tree/u);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it('uses the default controlled Bundle source root and rejects ignored extras after F', async () => {
    const fixture = await createDefaultEvidenceContractFixture();
    const controlledFile = path.join(fixture.root, V018_ACT_CONTROLLED_PATH, 'bundle-manifest.json');
    const receiptPath = path.join(fixture.outputRoot, 'candidate-receipt.json');
    try {
      const receipt = JSON.parse((await readFile(receiptPath)).toString('utf8')) as V018AuthorityCandidateReceipt;
      expect(receipt.sourceEntries).toEqual(expect.arrayContaining([
        expect.objectContaining({
          path: `${V018_ACT_CONTROLLED_PATH}/bundle-manifest.json`,
          objectType: 'blob',
        }),
        expect.objectContaining({
          path: `${V018_ACT_CONTROLLED_PATH}/release.json`,
          objectType: 'blob',
        }),
      ]));

      await writeFile(path.join(fixture.root, '.git/info/exclude'), '\ncontrolled-extra.json\n', { flag: 'a' });
      await writeFile(path.join(path.dirname(controlledFile), 'controlled-extra.json'), '{"ignored":true}\n');
      await expect(verifyV018CandidateEvidence({
        repoRoot: fixture.root,
        captureRevision: fixture.capture,
        generationRevision: fixture.generation,
        outputRoot: fixture.outputRoot,
      })).rejects.toThrow(/source working tree path set drift/u);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it('rejects non-output ancestor diffs, non-ancestor revisions, and generation mismatch', async () => {
    const fixture = await createEvidenceContractFixture();
    try {
      await writeFile(path.join(fixture.root, 'source/input.txt'), 'ordinary drift\n');
      git(fixture.root, ['add', 'source/input.txt']);
      git(fixture.root, ['commit', '-qm', 'ordinary source drift']);
      const nonOutputGeneration = git(fixture.root, ['rev-parse', 'HEAD']);
      await expect(assertV018CandidateEvidenceCaptureContract({
        repoRoot: fixture.root,
        captureRevision: fixture.capture,
        generationRevision: nonOutputGeneration,
        sourcePaths: ['source'],
        derivedPaths: ['derived'],
      })).rejects.toThrow(/non-derived path/u);

      git(fixture.root, ['checkout', '-q', fixture.unrelated]);
      await expect(assertV018CandidateEvidenceCaptureContract({
        repoRoot: fixture.root,
        captureRevision: fixture.capture,
        generationRevision: fixture.unrelated,
        sourcePaths: ['source'],
        derivedPaths: ['derived'],
      })).rejects.toThrow(/not an ancestor/u);

      git(fixture.root, ['checkout', '-q', fixture.generation]);
      await expect(assertV018CandidateEvidenceCaptureContract({
        repoRoot: fixture.root,
        captureRevision: fixture.capture,
        generationRevision: fixture.capture,
        sourcePaths: ['source'],
        derivedPaths: ['derived'],
      })).rejects.toThrow(/current Git HEAD/u);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it('rejects source content, mode, extra-input, symlink, and source/derived overlap drift', async () => {
    const fixture = await createEvidenceContractFixture();
    try {
      await writeFile(path.join(fixture.root, 'source/input.txt'), 'changed source\n');
      await expect(assertV018CandidateEvidenceCaptureContract({
        repoRoot: fixture.root,
        captureRevision: fixture.capture,
        generationRevision: fixture.generation,
        sourcePaths: ['source'],
        derivedPaths: ['derived'],
      })).rejects.toThrow(/source working tree drift/u);

      await writeFile(path.join(fixture.root, 'source/input.txt'), 'captured source\n');
      await chmod(path.join(fixture.root, 'source/input.txt'), 0o755);
      await expect(assertV018CandidateEvidenceCaptureContract({
        repoRoot: fixture.root,
        captureRevision: fixture.capture,
        generationRevision: fixture.generation,
        sourcePaths: ['source'],
        derivedPaths: ['derived'],
      })).rejects.toThrow(/source working tree drift/u);
      await chmod(path.join(fixture.root, 'source/input.txt'), 0o644);

      await writeFile(path.join(fixture.root, 'source/extra.txt'), 'undeclared\n');
      await expect(assertV018CandidateEvidenceCaptureContract({
        repoRoot: fixture.root,
        captureRevision: fixture.capture,
        generationRevision: fixture.generation,
        sourcePaths: ['source'],
        derivedPaths: ['derived'],
      })).rejects.toThrow(/path set drift/u);
      await rm(path.join(fixture.root, 'source/extra.txt'));

      await chmod(path.join(fixture.root, 'derived/evidence.json'), 0o755);
      await expect(assertV018CandidateEvidenceCaptureContract({
        repoRoot: fixture.root,
        captureRevision: fixture.capture,
        generationRevision: fixture.generation,
        sourcePaths: ['source'],
        derivedPaths: ['derived'],
      })).rejects.toThrow(/derived output drift/u);
      await chmod(path.join(fixture.root, 'derived/evidence.json'), 0o644);

      await symlink('input.txt', path.join(fixture.root, 'source/link.txt'));
      await expect(assertV018CandidateEvidenceCaptureContract({
        repoRoot: fixture.root,
        captureRevision: fixture.capture,
        generationRevision: fixture.generation,
        sourcePaths: ['source'],
        derivedPaths: ['derived'],
      })).rejects.toThrow(/symlink/u);
      await rm(path.join(fixture.root, 'source/link.txt'));

      await expect(assertV018CandidateEvidenceCaptureContract({
        repoRoot: fixture.root,
        captureRevision: fixture.capture,
        generationRevision: fixture.generation,
        sourcePaths: ['source'],
        derivedPaths: ['source/derived'],
      })).rejects.toThrow(/source\/derived path overlap/u);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

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

  it('merges the selected runtime already present in preserved V2 projections', async () => {
    await withRegisteredBundle((bundle) => {
      expect(bundle.preservedProjections.some(
        (row) => row.identity.profile === bundle.selectedRuntimeProjection.identity.profile,
      )).toBe(true);
      const projections = buildV018DeltaProjections(bundle);
      expect(projections).toHaveLength(new Set(
        bundle.preservedProjections.map((row) => row.identity.profile),
      ).size);
      expect(new Set(projections.map((row) => row.profile)).size).toBe(projections.length);
      expect(projections.filter((row) => row.isRuntime)).toHaveLength(1);
      expect(projections.find((row) => row.isRuntime)).toMatchObject({
        profile: bundle.selectedRuntimeProjection.identity.profile,
        projectionId: bundle.selectedRuntimeProjection.identity.projectionId,
        versionDigest: bundle.selectedRuntimeProjection.identity.versionDigest,
      });
    });
  });

  it('computes the impact report for the registered Bundle without a duplicate runtime identity', async () => {
    await withRegisteredBundle(async (bundle) => {
      const baseline = await createV09CaptureFixture();
      try {
        const report = await computeV018ImpactReport({
          repoRoot: baseline.root,
          captureGitRoot: baseline.root,
          candidate: bundle,
          candidateReleaseSetId: 'candidate-v018',
          captureRevision: baseline.head,
        });
        const runtimeProfile = bundle.selectedRuntimeProjection.identity.profile;
        expect(report.direct.details.projections.addedProfiles).toEqual(
          expect.arrayContaining(
            bundle.preservedProjections
              .map((row) => row.identity.profile)
              .filter((profile) => profile !== runtimeProfile),
          ),
        );
        expect(report.direct.details.projections.addedProfiles).not.toContain(runtimeProfile);
        expect(report.direct.details.projections.digestChanged).not.toContain(
          expect.objectContaining({ profile: runtimeProfile }),
        );
      } finally {
        await rm(baseline.root, { recursive: true, force: true });
      }
    });
  });

  it('adds the selected runtime exactly once when preserved V2 projections omit it', async () => {
    await withRegisteredBundle((bundle) => {
      const runtimeProfile = bundle.selectedRuntimeProjection.identity.profile;
      const withoutRuntime = {
        ...bundle,
        preservedProjections: bundle.preservedProjections.filter(
          (row) => row.identity.profile !== runtimeProfile,
        ),
      };
      const projections = buildV018DeltaProjections(withoutRuntime);
      expect(projections.filter((row) => row.profile === runtimeProfile)).toHaveLength(1);
      expect(projections.filter((row) => row.isRuntime)).toHaveLength(1);
      expect(projections).toEqual(expect.arrayContaining([{
        profile: runtimeProfile,
        projectionId: bundle.selectedRuntimeProjection.identity.projectionId,
        versionDigest: bundle.selectedRuntimeProjection.identity.versionDigest,
        isRuntime: true,
      }]));
    });
  });

  it('rejects a selected-runtime identity conflict under the same profile', async () => {
    await withRegisteredBundle((bundle) => {
      const runtimeProfile = bundle.selectedRuntimeProjection.identity.profile;
      const preservedRuntime = bundle.preservedProjections.find(
        (row) => row.identity.profile === runtimeProfile,
      );
      if (!preservedRuntime) throw new Error('registered bundle is missing preserved runtime projection');
      const conflict = {
        ...bundle,
        preservedProjections: bundle.preservedProjections.map((row) => (
          row === preservedRuntime
            ? { ...row, identity: { ...row.identity, projectionId: `${row.identity.projectionId}-conflict` } }
            : row
        )),
      };
      expect(() => buildV018DeltaProjections(conflict)).toThrow(
        /conflicting normalized projection identity.*runtime/u,
      );
    });
  });

  it('rejects conflicting duplicate preserved identities for one profile', async () => {
    await withRegisteredBundle((bundle) => {
      const preserved = bundle.preservedProjections.find(
        (row) => row.identity.profile !== bundle.selectedRuntimeProjection.identity.profile,
      );
      if (!preserved) throw new Error('registered bundle is missing a non-runtime projection');
      const conflict = {
        ...bundle,
        preservedProjections: [
          ...bundle.preservedProjections,
          { ...preserved, identity: { ...preserved.identity, versionDigest: 'f'.repeat(64) } },
        ],
      };
      expect(() => buildV018DeltaProjections(conflict)).toThrow(
        new RegExp(`conflicting normalized projection identity.*${preserved.identity.profile}`, 'u'),
      );
    });
  });

  it('deterministically merges identical duplicate identities regardless of order', async () => {
    await withRegisteredBundle((bundle) => {
      const preservedRuntime = bundle.preservedProjections.find(
        (row) => row.identity.profile === bundle.selectedRuntimeProjection.identity.profile,
      );
      if (!preservedRuntime) throw new Error('registered bundle is missing preserved runtime projection');
      const baseline = buildV018DeltaProjections(bundle);
      const duplicated = {
        ...bundle,
        preservedProjections: [preservedRuntime, ...bundle.preservedProjections],
      };
      const reversed = {
        ...bundle,
        preservedProjections: [...bundle.preservedProjections].reverse(),
      };
      expect(buildV018DeltaProjections(duplicated)).toEqual(baseline);
      expect(buildV018DeltaProjections(reversed)).toEqual(baseline);
    });
  });

  it('projects V2 advisory locks to a supported boolean result while preserving order and bindings', async () => {
    const queries: unknown[][] = [];
    const tx = {
      $queryRaw: async (...args: unknown[]) => {
        queries.push(args);
        return [{ acquired: true }];
      },
    };
    await acquireV2ImportLocks(tx as unknown as Parameters<typeof acquireV2ImportLocks>[0], {
      releaseIdentity: { releaseId: 'release-v018' },
      bundleIdentity: { bundleDigest: 'b'.repeat(64) },
    } as ValidatedActKGBundleV2);

    expect(queries).toHaveLength(3);
    const sql = queries.map(([template]) => (
      Array.isArray(template) ? (template as readonly string[]).join('?') : ''
    ));
    expect(sql).toHaveLength(3);
    expect(sql.every((statement) => statement.includes('IS NULL) AS "acquired"'))).toBe(true);
    expect(queries[1]?.[1]).toBe('actkg-v2-import:release:release-v018');
    expect(queries[2]?.[1]).toBe(`actkg-v2-import:bundle:${'b'.repeat(64)}`);
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
      V018_ACT_CONTROLLED_PATH,
      V018_MIRROR_RECEIPT_PATH,
    ]));
    expect(new Set(V018_CANDIDATE_CAPTURE_PATHS).size).toBe(V018_CANDIDATE_CAPTURE_PATHS.length);
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

  it('binds the mirror receipt to exact capture bytes and mode before publication', async () => {
    const fixture = await createV09CaptureFixture();
    const receiptPath = path.join(fixture.root, V018_MIRROR_RECEIPT_PATH);
    const originalBytes = await readFile(receiptPath);
    const expected = JSON.parse(originalBytes.toString('utf8')) as ActkgV018MirrorReceipt;
    const fail = (message: string): never => { throw new Error(message); };
    const assertReceipt = () => assertV018MirrorReceiptMatchesCapture({
      gitRoot: fixture.root,
      revision: fixture.head,
      expected,
      fail,
    });
    try {
      await expect(assertReceipt()).resolves.toEqual(expected);

      await writeFile(receiptPath, `${JSON.stringify(expected, null, 2)}\n`);
      await expect(assertReceipt()).rejects.toThrow(/content drift/u);

      await writeFile(receiptPath, originalBytes);
      await chmod(receiptPath, 0o755);
      await expect(assertReceipt()).rejects.toThrow(/mode drift/u);

      await chmod(receiptPath, 0o644);
      await rm(receiptPath);
      await expect(assertReceipt()).rejects.toThrow(/missing from working tree/u);

      const newReceiptPath = `${V018_MIRROR_RECEIPT_PATH}.new`;
      await writeFile(path.join(fixture.root, newReceiptPath), originalBytes);
      await expect(assertGitFileMatchesWorkingTree({
        gitRoot: fixture.root,
        revision: fixture.head,
        relativePath: newReceiptPath,
        fail,
      })).rejects.toThrow(/Git file is missing/u);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it('rechecks receipt drift at closeout and removes partial replay output', async () => {
    const fixture = await createV09CaptureFixture();
    const receiptPath = path.join(fixture.root, V018_MIRROR_RECEIPT_PATH);
    const originalBytes = await readFile(receiptPath);
    const expected = JSON.parse(originalBytes.toString('utf8')) as ActkgV018MirrorReceipt;
    const fail = (message: string): never => { throw new Error(message); };
    const outputRoot = path.join(fixture.root, 'candidate-output');
    const candidateReceiptPath = path.join(outputRoot, 'candidate-receipt.json');
    try {
      await expect(assertV018MirrorReceiptMatchesCapture({
        gitRoot: fixture.root,
        revision: fixture.head,
        expected,
        fail,
      })).resolves.toEqual(expected);

      await writeFile(receiptPath, `${JSON.stringify(expected, null, 2)}\n`);
      await mkdir(outputRoot, { recursive: true });
      await writeFile(path.join(outputRoot, 'replay-1.partial'), 'replay artifact\n');
      await expect(writeV018CandidateReceiptAfterCaptureCheck({
        repoRoot: fixture.root,
        captureRevision: fixture.head,
        expectedMirrorReceipt: expected,
        outputRoot,
        receipt: {} as V018AuthorityCandidateReceipt,
      })).rejects.toThrow(/content drift/u);
      await expect(stat(candidateReceiptPath)).rejects.toBeDefined();
      await expect(stat(outputRoot)).rejects.toBeDefined();
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it('rejects a receipt whose capture/generation fields do not match the verified contract', async () => {
    const fixture = await createV09CaptureFixture();
    const outputRoot = path.join(fixture.root, 'candidate-output');
    try {
      await mkdir(outputRoot, { recursive: true });
      await writeFile(path.join(outputRoot, 'impact-report.json'), '{"ok":true}\n');
      const captureContract = await assertV018CandidateEvidenceCaptureContract({
        repoRoot: fixture.root,
        captureRevision: fixture.head,
        generationRevision: fixture.head,
        sourcePaths: [V018_MIRROR_RECEIPT_PATH],
        derivedPaths: ['candidate-output'],
        allowUncommittedDerived: true,
      });
      const mirror = JSON.parse(
        (await readFile(path.join(fixture.root, V018_MIRROR_RECEIPT_PATH))).toString('utf8'),
      ) as ActkgV018MirrorReceipt;
      await expect(writeV018CandidateReceiptAfterCaptureCheck({
        repoRoot: fixture.root,
        captureRevision: fixture.head,
        expectedMirrorReceipt: mirror,
        outputRoot,
        captureContract,
        allowUncommittedDerived: true,
        receipt: {
          captureRevision: fixture.head,
          generationRevision: '0'.repeat(40),
          sourceContractVersion: captureContract.sourceContractVersion,
          sourceManifestDigest: captureContract.sourceManifestDigest,
        } as V018AuthorityCandidateReceipt,
      })).rejects.toThrow(/capture contract does not match/u);
      await expect(stat(outputRoot)).rejects.toBeDefined();
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it('verifies a committed derived-only candidate without inventing its final SHA', async () => {
    const fixture = await createV09CaptureFixture();
    const outputRoot = path.join(fixture.root, 'candidate-output');
    try {
      await mkdir(outputRoot, { recursive: true });
      await writeFile(path.join(outputRoot, 'impact-report.json'), '{"ok":true}\n');
      const captureContract = await assertV018CandidateEvidenceCaptureContract({
        repoRoot: fixture.root,
        captureRevision: fixture.head,
        generationRevision: fixture.head,
        sourcePaths: [V018_MIRROR_RECEIPT_PATH],
        derivedPaths: ['candidate-output'],
        allowUncommittedDerived: true,
      });
      const mirror = JSON.parse(
        (await readFile(path.join(fixture.root, V018_MIRROR_RECEIPT_PATH))).toString('utf8'),
      ) as ActkgV018MirrorReceipt;
      await writeV018CandidateReceiptAfterCaptureCheck({
        repoRoot: fixture.root,
        captureRevision: fixture.head,
        expectedMirrorReceipt: mirror,
        outputRoot,
        captureContract,
        allowUncommittedDerived: true,
        receipt: {
          captureRevision: fixture.head,
          generationRevision: fixture.head,
          sourceContractVersion: captureContract.sourceContractVersion,
          sourceManifestDigest: captureContract.sourceManifestDigest,
          sourceEntries: captureContract.sourceEntries,
          outputs: captureContract.outputs,
          mirror,
        } as V018AuthorityCandidateReceipt,
      });
      git(fixture.root, ['add', 'candidate-output']);
      git(fixture.root, ['commit', '-qm', 'candidate derived evidence']);
      const generationRevision = git(fixture.root, ['rev-parse', 'HEAD']);
      await expect(verifyV018CandidateEvidence({
        repoRoot: fixture.root,
        captureRevision: fixture.head,
        generationRevision,
        outputRoot,
        sourcePaths: [V018_MIRROR_RECEIPT_PATH],
      })).resolves.toMatchObject({
        captureRevision: fixture.head,
        generationRevision,
      });
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
