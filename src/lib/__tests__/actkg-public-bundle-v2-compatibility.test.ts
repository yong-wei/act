import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { canonicalJson, sha256 } from '../../../scripts/actkg-release/authoritative-release';
import {
  CTKG_SCHEMA_V2_RAW_SHA256,
  CTKG_SCHEMA_V2_VERSION,
  PUBLIC_BUNDLE_V2_CONTRACT_VERSION,
  REVIEWED_V0_18_EXPECTED_COUNTS,
  REVIEWED_V0_18_IDENTITIES,
  REVIEWED_V0_18_V2_REGISTRY,
  type PublicBundleV2Registry,
} from '../../../scripts/actkg-release/bundle-compatibility-registry-v2';
import {
  CTKG_SCHEMA_VERSION,
  PUBLIC_BUNDLE_CONTRACT_VERSION,
} from '../../../scripts/actkg-release/bundle-compatibility-registry';
import {
  PUBLIC_BUNDLE_ADAPTER_CAPTURE_PATHS,
  PUBLIC_BUNDLE_V2_ADAPTER_CAPTURE_PATHS,
} from '../../../scripts/actkg-release/capture-revision';
import { admitPublicBundleV2 } from '../../../scripts/actkg-release/public-bundle-v2-admission';
import {
  buildAcceptedV2MiniBundle,
  MINI_ENTITIES,
  V2_EXACT_DIR,
} from '../../../scripts/actkg-release/fixtures/public-bundle-v2/build-v2-mini-bundle';
import {
  decidePublicBundleRoute,
  parseDeclaredPublicBundleProtocol,
  routeAndValidatePublicBundle,
} from '../../../scripts/actkg-release/public-bundle-router';
import type { JsonObject } from '../../../scripts/actkg-release/public-bundle-types';
import { PublicBundleRejection, loadAndValidatePublicBundleV1 } from '../../../scripts/actkg-release/public-bundle-v1';
import {
  assertPinnedV2ManifestIdentities,
  loadAndValidatePublicBundleV2,
  loadAndValidateRegisteredPublicBundleV2,
} from '../../../scripts/actkg-release/public-bundle-v2';

const root = process.cwd();
const ACTKG_V018_REPOSITORY = process.env.ACTKG_PUBLIC_BUNDLE_V2_REPOSITORY
  ?? '/Users/YW/Documents/Project/ActKG';
const R2_PATH = 'course-content/authoring/knowledge/releases/control-theory-engineering-v0.3-r2';
const V02_PATH = 'course-content/authoring/knowledge/releases/control-theory-engineering-v0.2';

async function expectRejection(
  run: () => Promise<unknown>,
  code: string,
  pattern?: RegExp,
): Promise<PublicBundleRejection> {
  try {
    await run();
    throw new Error('expected rejection');
  } catch (error) {
    expect(error).toBeInstanceOf(PublicBundleRejection);
    const rejection = error as PublicBundleRejection;
    expect(rejection.assessment.code).toBe(code);
    if (pattern) {
      expect(rejection.assessment.reasons.join(' | ')).toMatch(pattern);
    }
    return rejection;
  }
}

async function writeJson(filePath: string, value: unknown): Promise<Buffer> {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await writeFile(filePath, bytes);
  return bytes;
}

async function createCaptureWorkspace(
  parent: string,
  capturePaths: readonly string[],
): Promise<{ root: string; revision: string }> {
  const captureRoot = path.join(parent, '.capture');
  for (const capturePath of capturePaths) {
    await mkdir(path.dirname(path.join(captureRoot, capturePath)), { recursive: true });
    await cp(path.join(root, capturePath), path.join(captureRoot, capturePath), { recursive: true });
  }
  execFileSync('git', ['init', '-q'], { cwd: captureRoot });
  execFileSync('git', ['config', 'user.email', 'actkg-v2-capture@example.invalid'], { cwd: captureRoot });
  execFileSync('git', ['config', 'user.name', 'actkg-v2-capture'], { cwd: captureRoot });
  execFileSync('git', ['add', '.'], { cwd: captureRoot });
  execFileSync('git', ['commit', '-qm', 'capture fixture'], { cwd: captureRoot });
  return {
    root: captureRoot,
    revision: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: captureRoot,
      encoding: 'utf8',
    }).trim(),
  };
}

async function rewriteSha256Sums(bundleDir: string): Promise<void> {
  const { lstat, readdir } = await import('node:fs/promises');
  const files: string[] = [];
  async function walk(currentDir: string, prefix: string): Promise<void> {
    for (const name of await readdir(currentDir)) {
      const relative = prefix ? `${prefix}/${name}` : name;
      const full = path.join(currentDir, name);
      const info = await lstat(full);
      if (info.isDirectory()) {
        await walk(full, relative);
        continue;
      }
      if (relative !== 'SHA256SUMS') files.push(relative);
    }
  }
  await walk(bundleDir, '');
  files.sort();
  const lines = [];
  for (const relative of files) {
    const bytes = await readFile(path.join(bundleDir, ...relative.split('/')));
    lines.push(`${sha256(bytes)}  ${relative}`);
  }
  await writeFile(path.join(bundleDir, 'SHA256SUMS'), `${lines.join('\n')}\n`);
}

async function rewriteManifestDigest(
  bundleDir: string,
  format: 'pretty' | 'compact' = 'pretty',
): Promise<JsonObject> {
  const manifestPath = path.join(bundleDir, 'bundle-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as JsonObject;
  const body = structuredClone(manifest);
  delete body.bundle_digest;
  manifest.bundle_digest = sha256(canonicalJson(body));
  if (format === 'compact') {
    await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);
  } else {
    await writeJson(manifestPath, manifest);
  }
  await rewriteSha256Sums(bundleDir);
  return manifest;
}

async function prepareMiniWorkspace(): Promise<{
  dir: string;
  bundlePath: string;
  bundleDir: string;
  registry: Awaited<ReturnType<typeof buildAcceptedV2MiniBundle>>['registry'];
  captureRoot: string;
  captureRevision: string;
}> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'actkg-public-bundle-v2-'));
  const capture = await createCaptureWorkspace(dir, PUBLIC_BUNDLE_V2_ADAPTER_CAPTURE_PATHS);
  const built = await buildAcceptedV2MiniBundle(dir);
  return { dir, ...built, captureRoot: capture.root, captureRevision: capture.revision };
}

async function registryForCurrentManifest(
  workspace: Awaited<ReturnType<typeof prepareMiniWorkspace>>,
): Promise<Awaited<ReturnType<typeof buildAcceptedV2MiniBundle>>['registry']> {
  const manifestPath = path.join(workspace.bundleDir, 'bundle-manifest.json');
  const sumsPath = path.join(workspace.bundleDir, 'SHA256SUMS');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as JsonObject;
  return {
    ...workspace.registry,
    bundleDigest: String(manifest.bundle_digest),
    manifestRawSha256: sha256(await readFile(manifestPath)),
    sha256sumsRawSha256: sha256(await readFile(sumsPath)),
  };
}

async function expectManifestIdentityRejection(
  mutate: (manifest: JsonObject) => void,
  code: string,
  pattern: RegExp,
): Promise<void> {
  const workspace = await prepareMiniWorkspace();
  try {
    const manifestPath = path.join(workspace.bundleDir, 'bundle-manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as JsonObject;
    mutate(manifest);
    await writeJson(manifestPath, manifest);
    await rewriteManifestDigest(workspace.bundleDir);
    const registry = await registryForCurrentManifest(workspace);
    await expectRejection(
      () => loadAndValidateRegisteredPublicBundleV2({
        root: workspace.dir,
        bundlePath: workspace.bundlePath,
        gitRoot: workspace.captureRoot,
        captureRevision: workspace.captureRevision,
        registry,
      }),
      code,
      pattern,
    );
  } finally {
    await rm(workspace.dir, { recursive: true, force: true });
  }
}

async function prepareUpstreamV018Workspace(): Promise<{
  dir: string;
  bundlePath: string;
  captureRevision: string;
}> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'actkg-public-bundle-v2-upstream-'));
  try {
    for (const adapterPath of PUBLIC_BUNDLE_V2_ADAPTER_CAPTURE_PATHS) {
      await mkdir(path.dirname(path.join(dir, adapterPath)), { recursive: true });
      await cp(path.join(root, adapterPath), path.join(dir, adapterPath), { recursive: true });
    }
    const archive = execFileSync(
      'git',
      [
        '-C',
        ACTKG_V018_REPOSITORY,
        'archive',
        'control-theory-engineering-v0.18',
        'releases/control-theory-engineering-v0.18',
      ],
      { maxBuffer: 100 * 1024 * 1024 },
    );
    execFileSync('tar', ['-x', '-C', dir], { input: archive });
    const manifestPath = path.join(dir, 'releases/control-theory-engineering-v0.18', 'bundle-manifest.json');
    const originalManifest = JSON.parse(await readFile(manifestPath, 'utf8')) as JsonObject;
    expect(originalManifest.publication_revision).toBeUndefined();
    execFileSync('git', ['init', '-q'], { cwd: dir });
    execFileSync('git', ['config', 'user.email', 'actkg-v2-test@example.invalid'], { cwd: dir });
    execFileSync('git', ['config', 'user.name', 'actkg-v2-test'], { cwd: dir });
    execFileSync('git', ['add', '.'], { cwd: dir });
    execFileSync('git', ['commit', '-qm', 'upstream v0.18 fixture'], { cwd: dir });
    const captureRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: dir,
      encoding: 'utf8',
    }).trim();
    return {
      dir,
      bundlePath: 'releases/control-theory-engineering-v0.18',
      captureRevision,
    };
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
}

describe('ActKG public Bundle v2 identities', () => {
  it('pins the reviewed v0.18 compound identities', () => {
    expect(Object.isFrozen(REVIEWED_V0_18_V2_REGISTRY)).toBe(true);
    expect(Object.isFrozen(REVIEWED_V0_18_V2_REGISTRY.upstreamRepository)).toBe(true);
    expect(Object.isFrozen(REVIEWED_V0_18_V2_REGISTRY.components)).toBe(true);
    expect(Object.isFrozen(REVIEWED_V0_18_V2_REGISTRY.projectionProfiles)).toBe(true);
    expect(Object.isFrozen(REVIEWED_V0_18_V2_REGISTRY.artifactContracts)).toBe(true);
    expect(REVIEWED_V0_18_V2_REGISTRY.publicationTag).toBe('control-theory-engineering-v0.18');
    expect(REVIEWED_V0_18_V2_REGISTRY.publicationCommit).toBe(
      'f7b9155114b8449542f4f15335cfbed30570aef8',
    );
    expect(REVIEWED_V0_18_V2_REGISTRY.sourceTag).toBe('control-theory-engineering-v0.18-source-r1');
    expect(REVIEWED_V0_18_V2_REGISTRY.sourceCommit).toBe(
      '08f732c50450d991841f382edf75394433b00f53',
    );
    expect(REVIEWED_V0_18_V2_REGISTRY.bundleId).toBe('ctb:control-theory-engineering-v0.18:r1');
    expect(REVIEWED_V0_18_V2_REGISTRY.bundleDigest).toBe(
      '9caf1083ae7a13c5122546e7ff7cbf8b6b0f463438444088d9c80227624866cd',
    );
    expect(REVIEWED_V0_18_V2_REGISTRY.manifestRawSha256).toBe(
      '4da43f92e44f122b98b8dc93021e02c0b8d146440f7c155392fa7cc234e076ae',
    );
    expect(REVIEWED_V0_18_V2_REGISTRY.sha256sumsRawSha256).toBe(
      '2e4a97d7586931176c480eb544ec18fab46b8c07beda8fcc21e7418b5428f903',
    );
    expect(REVIEWED_V0_18_V2_REGISTRY.schemaVersion).toBe(CTKG_SCHEMA_V2_VERSION);
    expect(REVIEWED_V0_18_V2_REGISTRY.schemaRawSha256).toBe(CTKG_SCHEMA_V2_RAW_SHA256);
    expect(REVIEWED_V0_18_V2_REGISTRY.releaseHash).toBe(
      '73fdb59ccf8748e3d4a8625d3e4d1499de14d7182804d18c4e6c9b6eb54b7c60',
    );
    expect(REVIEWED_V0_18_V2_REGISTRY.expectedCounts).toEqual(REVIEWED_V0_18_EXPECTED_COUNTS);
    expect(REVIEWED_V0_18_EXPECTED_COUNTS).toEqual({
      releaseNodes: 7061,
      runtimeProjectionNodes: 6843,
      publishedRuntimeRelations: 2811,
      terminologyAssertions: 1909,
    });
  });

  it('accepts the exact mirrored v0.18 Manifest identities before semantic validation', async () => {
    const manifest = JSON.parse(
      await readFile(path.join(root, V2_EXACT_DIR, 'bundle-manifest.json'), 'utf8'),
    ) as JsonObject;
    expect(sha256(await readFile(path.join(root, V2_EXACT_DIR, 'bundle-manifest.json')))).toBe(
      REVIEWED_V0_18_IDENTITIES.manifestRawSha256,
    );
    expect(sha256(await readFile(path.join(root, V2_EXACT_DIR, 'ctkg.schema.json')))).toBe(
      CTKG_SCHEMA_V2_RAW_SHA256,
    );
    expect(sha256(await readFile(path.join(root, V2_EXACT_DIR, 'projection-profiles.json')))).toBe(
      REVIEWED_V0_18_IDENTITIES.projectionProfilesArtifactSha256,
    );
    expect(manifest.publication_revision).toBeUndefined();
    expect(manifest.source_revision).toEqual({
      commit: REVIEWED_V0_18_IDENTITIES.sourceCommit,
      tag: REVIEWED_V0_18_IDENTITIES.sourceTag,
    });
    expect(() => assertPinnedV2ManifestIdentities(manifest)).not.toThrow();
  });

  it('rejects a matching version string when any compound identity drifts', async () => {
    const manifest = JSON.parse(
      await readFile(path.join(root, V2_EXACT_DIR, 'bundle-manifest.json'), 'utf8'),
    ) as JsonObject;
    manifest.bundle_digest = '0'.repeat(64);
    expect(() => assertPinnedV2ManifestIdentities(manifest)).toThrow(PublicBundleRejection);
    try {
      assertPinnedV2ManifestIdentities(manifest);
    } catch (error) {
      expect(error).toBeInstanceOf(PublicBundleRejection);
      expect((error as PublicBundleRejection).assessment.code).toBe('ADAPTER_UPDATE_REQUIRED');
      expect((error as PublicBundleRejection).assessment.reasons.join(' ')).toMatch(/bundle_digest/u);
    }
  });
});

describe('ActKG public Bundle v2 routing', () => {
  it('dispatches a declared v2 Manifest to the v2 adapter only', async () => {
    const workspace = await prepareMiniWorkspace();
    try {
      const route = await decidePublicBundleRoute({
        root: workspace.dir,
        controlledPath: workspace.bundlePath,
      });
      expect(route.kind).toBe(PUBLIC_BUNDLE_V2_CONTRACT_VERSION);
      expect(await parseDeclaredPublicBundleProtocol({
        root: workspace.dir,
        controlledPath: workspace.bundlePath,
      })).toBe(PUBLIC_BUNDLE_V2_CONTRACT_VERSION);

      const routed = await routeAndValidatePublicBundle({
        root: workspace.dir,
        controlledPath: workspace.bundlePath,
        captureRevision: workspace.captureRevision,
        gitRoot: workspace.captureRoot,
      }).catch((error) => error);
      // Production router uses the pinned v0.18 registry, so the mini package
      // is a declared v2 route that fails closed instead of becoming v1.
      expect(routed).toBeInstanceOf(PublicBundleRejection);
      expect((routed as PublicBundleRejection).assessment.code).toMatch(
        /ADAPTER_UPDATE_REQUIRED|INTEGRITY_REJECTED|SCHEMA_REVIEW_REQUIRED/u,
      );
    } finally {
      await rm(workspace.dir, { recursive: true, force: true });
    }
  });

  it('rejects an unknown protocol without guessing v1 or v2', async () => {
    const workspace = await prepareMiniWorkspace();
    try {
      const manifestPath = path.join(workspace.bundleDir, 'bundle-manifest.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as JsonObject;
      manifest.bundle_contract_version = 'actkg-public-bundle/9';
      await writeJson(manifestPath, manifest);
      await expectRejection(
        () => decidePublicBundleRoute({
          root: workspace.dir,
          controlledPath: workspace.bundlePath,
        }),
        'ADAPTER_UPDATE_REQUIRED',
        /actkg-public-bundle\/9/u,
      );
      await expectRejection(
        () => routeAndValidatePublicBundle({
          root: workspace.dir,
          controlledPath: workspace.bundlePath,
          captureRevision: workspace.captureRevision,
          gitRoot: workspace.captureRoot,
        }),
        'ADAPTER_UPDATE_REQUIRED',
        /actkg-public-bundle\/9/u,
      );
    } finally {
      await rm(workspace.dir, { recursive: true, force: true });
    }
  });
});

describe('ActKG public Bundle v2 semantic validation', () => {
  const hasUpstreamV018 = existsSync(path.join(ACTKG_V018_REPOSITORY, '.git'));

  it('rejects source revision drift and any injected publication field', async () => {
    await expectManifestIdentityRejection(
      (manifest) => {
        (manifest.source_revision as JsonObject).tag = 'control-theory-engineering-v0.18-source-drift';
      },
      'ADAPTER_UPDATE_REQUIRED',
      /source_revision/u,
    );
    await expectManifestIdentityRejection(
      (manifest) => {
        (manifest.source_revision as JsonObject).commit = 'c'.repeat(40);
      },
      'ADAPTER_UPDATE_REQUIRED',
        /source_revision/u,
    );
    await expectManifestIdentityRejection(
      (manifest) => {
        delete manifest.source_revision;
      },
      'INTEGRITY_REJECTED',
      /source_revision/u,
    );
    await expectManifestIdentityRejection(
      (manifest) => {
        manifest.publication_revision = {
          commit: REVIEWED_V0_18_IDENTITIES.publicationCommit,
          tag: REVIEWED_V0_18_IDENTITIES.publicationTag,
        };
      },
      'INTEGRITY_REJECTED',
      /additionalProperties|bundle-manifest/u,
    );
  });

  it('rejects a raw Manifest byte mutation before parsing or semantic validation', async () => {
    const workspace = await prepareMiniWorkspace();
    try {
      const manifestPath = path.join(workspace.bundleDir, 'bundle-manifest.json');
      const bytes = await readFile(manifestPath);
      await writeFile(manifestPath, Buffer.concat([bytes, Buffer.from(' ', 'utf8')]));
      await expectRejection(
        () => loadAndValidateRegisteredPublicBundleV2({
          root: workspace.dir,
          bundlePath: workspace.bundlePath,
          gitRoot: workspace.captureRoot,
          captureRevision: workspace.captureRevision,
          registry: workspace.registry,
        }),
        'ADAPTER_UPDATE_REQUIRED',
        /Manifest raw SHA-256/u,
      );
    } finally {
      await rm(workspace.dir, { recursive: true, force: true });
    }
  });

  it.skipIf(!hasUpstreamV018)('validates the complete upstream v0.18 tag as the positive case', async () => {
    const workspace = await prepareUpstreamV018Workspace();
    try {
      const validated = await loadAndValidatePublicBundleV2({
        root: workspace.dir,
        gitRoot: workspace.dir,
        bundlePath: workspace.bundlePath,
        captureRevision: workspace.captureRevision,
        contractSchemaDir: path.join(
          workspace.dir,
          'scripts/actkg-release/schemas/public-bundle-v2',
        ),
      });
      expect(validated.registeredAdmissionBinding).toMatchObject({
        provenance: 'registry',
        verificationScope: 'admission-time',
        verifiedDuringLoad: false,
        publicationRevision: {
          tag: 'control-theory-engineering-v0.18',
          commit: REVIEWED_V0_18_IDENTITIES.publicationCommit,
        },
      });
      expect(validated.bundleIdentity.manifestRawSha256).toBe(
        '4da43f92e44f122b98b8dc93021e02c0b8d146440f7c155392fa7cc234e076ae',
      );
      expect(validated.bundleIdentity.sha256sumsRawSha256).toBe(
        '2e4a97d7586931176c480eb544ec18fab46b8c07beda8fcc21e7418b5428f903',
      );
      expect(validated.manifestSourceRevision).toEqual({
        tag: REVIEWED_V0_18_IDENTITIES.sourceTag,
        commit: REVIEWED_V0_18_IDENTITIES.sourceCommit,
      });
      expect(validated.registeredAdmissionBinding.verifiedDuringLoad).toBe(false);
      expect(validated.statistics).toMatchObject({
        releaseNodes: 7061,
        projectionNodes: 6843,
        publishedRelations: 2811,
        terminologyAssertions: 1909,
      });
      expect(validated.multilingualLabels).toHaveLength(1909);
      expect(validated.components).toHaveLength(17);
    } finally {
      await rm(workspace.dir, { recursive: true, force: true });
    }
  });

  it.skipIf(!hasUpstreamV018)('loads an exact upstream export from a bare directory without upstream Git', async () => {
    const workspace = await prepareUpstreamV018Workspace();
    const bareRoot = await mkdtemp(path.join(os.tmpdir(), 'actkg-public-bundle-v2-bare-'));
    const captureParent = await mkdtemp(path.join(os.tmpdir(), 'actkg-public-bundle-v2-capture-'));
    try {
      await mkdir(path.join(bareRoot, 'releases'), { recursive: true });
      await cp(
        path.join(workspace.dir, workspace.bundlePath),
        path.join(bareRoot, workspace.bundlePath),
        { recursive: true },
      );
      const capture = await createCaptureWorkspace(captureParent, PUBLIC_BUNDLE_V2_ADAPTER_CAPTURE_PATHS);
      expect(existsSync(path.join(bareRoot, '.git'))).toBe(false);
      const validated = await loadAndValidatePublicBundleV2({
        root: bareRoot,
        gitRoot: capture.root,
        bundlePath: workspace.bundlePath,
        captureRevision: capture.revision,
        contractSchemaDir: path.join(capture.root, 'scripts/actkg-release/schemas/public-bundle-v2'),
      });
      expect(validated.bundleIdentity.bundleDigest).toBe(
        '9caf1083ae7a13c5122546e7ff7cbf8b6b0f463438444088d9c80227624866cd',
      );
      expect(validated.manifestSourceRevision).toEqual({
        tag: 'control-theory-engineering-v0.18-source-r1',
        commit: '08f732c50450d991841f382edf75394433b00f53',
      });
      expect(validated.registeredAdmissionBinding.verifiedDuringLoad).toBe(false);
    } finally {
      await rm(workspace.dir, { recursive: true, force: true });
      await rm(bareRoot, { recursive: true, force: true });
      await rm(captureParent, { recursive: true, force: true });
    }
  });

  it('accepts a bounded fixture and preserves typed v2 output', async () => {
    const workspace = await prepareMiniWorkspace();
    try {
      const validated = await loadAndValidateRegisteredPublicBundleV2({
        root: workspace.dir,
        bundlePath: workspace.bundlePath,
        gitRoot: workspace.captureRoot,
        captureRevision: workspace.captureRevision,
        registry: workspace.registry,
      });
      expect(validated.protocol).toBe(PUBLIC_BUNDLE_V2_CONTRACT_VERSION);
      expect(validated.captureRevision).toBe(workspace.captureRevision);
      expect(validated.registeredAdmissionBinding.publicationRevision).toEqual({
        tag: workspace.registry.publicationTag,
        commit: workspace.registry.publicationCommit,
      });
      expect(validated.manifestSourceRevision).toEqual({
        tag: workspace.registry.sourceTag,
        commit: workspace.registry.sourceCommit,
      });
      expect(validated.registeredAdmissionBinding).toMatchObject({
        provenance: 'registry',
        verificationScope: 'admission-time',
        verifiedDuringLoad: false,
      });
      expect(validated.selectedRuntimeProjection.identity.projectionProfile).toBe(
        'ctr:profile:control-theory-engineering-v0.18:runtime-v3',
      );
      expect(validated.projectionProfiles.map((profile) => profile.profileId).sort()).toEqual([
        'ctr:profile:control-theory-engineering-v0.18:domain-v3',
        'ctr:profile:control-theory-engineering-v0.18:review-v3',
        'ctr:profile:control-theory-engineering-v0.18:runtime-v3',
      ].sort());
      expect(validated.multilingualLabels).toEqual([
        expect.objectContaining({
          entityId: MINI_ENTITIES.nodeA,
          language: 'zh-CN',
          terminologyAssertionId: MINI_ENTITIES.assertion,
        }),
      ]);
      expect(validated.statistics.releaseNodes).toBe(2);
      expect(validated.statistics.projectionNodes).toBe(2);
      expect(validated.statistics.publishedRelations).toBe(1);
      expect(validated.statistics.terminologyAssertions).toBe(1);
      expect(validated.rawArtifacts.some((artifact) => artifact.descriptor.role === 'bundle_manifest')).toBe(true);
      expect(validated.rawArtifacts.some((artifact) => artifact.descriptor.role === 'projection_profiles')).toBe(true);

      const manifest = JSON.parse(
        await readFile(path.join(workspace.bundleDir, 'bundle-manifest.json'), 'utf8'),
      ) as JsonObject & { artifacts: JsonObject[]; components: JsonObject[] };
      const sourceRevision = manifest.source_revision as JsonObject;
      expect(manifest.publication_revision).toBeUndefined();
      expect(validated.manifestSourceRevision).toEqual(sourceRevision);
      const expectedRawPaths = [
        'bundle-manifest.json',
        'SHA256SUMS',
        ...manifest.artifacts.map((artifact) => String(artifact.path)),
        ...manifest.components.map((component) => String(component.component_path)),
      ].sort();
      expect(validated.rawArtifacts).toHaveLength(expectedRawPaths.length);
      expect(validated.rawArtifacts.map((artifact) => artifact.descriptor.path).sort()).toEqual(expectedRawPaths);
      for (const component of manifest.components) {
        const raw = validated.rawArtifacts.find(
          (artifact) => artifact.descriptor.path === component.component_path,
        );
        expect(raw).toMatchObject({
          descriptor: {
            role: 'component_release',
            contractVersion: 'ctkg-release/0.3',
            required: true,
            mediaType: 'application/json',
            sha256: component.component_sha256,
            byteLength: expect.any(Number),
            recordCount: null,
            known: true,
            semanticsEnabled: true,
          },
        });
        expect(raw?.bytes.byteLength).toBe(raw?.descriptor.byteLength);
      }
    } finally {
      await rm(workspace.dir, { recursive: true, force: true });
    }
  });

  it('uses a separate admission gate for tag pins and leaves the loader offline', async () => {
    const workspace = await prepareMiniWorkspace();
    try {
      const upstreamRoot = path.join(workspace.dir, 'upstream-git');
      const releaseSubtree = path.join(upstreamRoot, 'releases', 'control-theory-engineering-v0.18-mini');
      await mkdir(releaseSubtree, { recursive: true });
      await writeFile(path.join(releaseSubtree, 'release-subtree.txt'), 'retained release subtree\n');
      execFileSync('git', ['init', '-q'], { cwd: upstreamRoot });
      execFileSync('git', ['config', 'user.email', 'actkg-v2-upstream@example.invalid'], { cwd: upstreamRoot });
      execFileSync('git', ['config', 'user.name', 'actkg-v2-upstream'], { cwd: upstreamRoot });
      execFileSync('git', ['add', '.'], { cwd: upstreamRoot });
      execFileSync('git', ['commit', '-qm', 'source revision'], { cwd: upstreamRoot });
      const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: upstreamRoot,
        encoding: 'utf8',
      }).trim();
      execFileSync('git', ['tag', 'mini-source'], { cwd: upstreamRoot });
      await writeFile(path.join(releaseSubtree, 'publication-marker.txt'), 'publication revision\n');
      execFileSync('git', ['add', '.'], { cwd: upstreamRoot });
      execFileSync('git', ['commit', '-qm', 'publication revision'], { cwd: upstreamRoot });
      const publicationCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: upstreamRoot,
        encoding: 'utf8',
      }).trim();
      execFileSync('git', ['tag', 'mini-publication'], { cwd: upstreamRoot });

      const manifestPath = path.join(workspace.bundleDir, 'bundle-manifest.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as JsonObject;
      manifest.source_revision = { tag: 'mini-source', commit: sourceCommit };
      const reportPath = path.join(workspace.bundleDir, 'validation-report.json');
      const report = JSON.parse(await readFile(reportPath, 'utf8')) as JsonObject;
      report.source_revision = { tag: 'mini-source', commit: sourceCommit };
      const reportBytes = await writeJson(reportPath, report);
      const reportArtifact = (manifest.artifacts as JsonObject[]).find(
        (artifact) => artifact.role === 'validation_report',
      )!;
      reportArtifact.sha256 = sha256(reportBytes);
      reportArtifact.byte_length = reportBytes.byteLength;
      await writeJson(manifestPath, manifest);
      await rewriteManifestDigest(workspace.bundleDir);
      const registry = {
        ...await registryForCurrentManifest(workspace),
        registryIdentity: 'actkg-public-bundle-v2-fixture:admission-mini:r1',
        upstreamRepository: {
          repositoryId: 'fixture/admission-mini',
          remoteUrl: 'https://github.com/yong-wei/ActKG.git',
        },
        publicationTag: 'mini-publication',
        publicationCommit,
        sourceTag: 'mini-source',
        sourceCommit,
      } satisfies PublicBundleV2Registry;
      execFileSync('git', ['remote', 'add', 'origin', registry.upstreamRepository.remoteUrl], {
        cwd: upstreamRoot,
      });
      const evidence = admitPublicBundleV2({ upstreamGitRoot: upstreamRoot, registry });
      expect(evidence).toMatchObject({ status: 'PASS' });
      const validated = await loadAndValidateRegisteredPublicBundleV2({
        root: workspace.dir,
        bundlePath: workspace.bundlePath,
        gitRoot: workspace.captureRoot,
        captureRevision: workspace.captureRevision,
        registry,
      });
      expect(validated.registeredAdmissionBinding.publicationRevision).toEqual({
        tag: 'mini-publication',
        commit: publicationCommit,
      });
      expect(validated.manifestSourceRevision).toEqual({
        tag: 'mini-source',
        commit: sourceCommit,
      });
      expect(validated.registeredAdmissionBinding.verifiedDuringLoad).toBe(false);

      await writeFile(path.join(upstreamRoot, 'unrelated.txt'), 'same release subtree, later publication commit\n');
      execFileSync('git', ['add', '.'], { cwd: upstreamRoot });
      execFileSync('git', ['commit', '-qm', 'unrelated later commit'], { cwd: upstreamRoot });
      execFileSync('git', ['tag', '-f', 'mini-publication'], { cwd: upstreamRoot });
      expect(() => admitPublicBundleV2({ upstreamGitRoot: upstreamRoot, registry })).toThrow(
        /publication tag mini-publication points/u,
      );
      expect(
        execFileSync('git', ['show', `${publicationCommit}:releases/control-theory-engineering-v0.18-mini/release-subtree.txt`], {
          cwd: upstreamRoot,
          encoding: 'utf8',
        }),
      ).toBe('retained release subtree\n');

      // The offline loader is intentionally unaffected by the later Git tag
      // retarget because it does not consult upstreamGitRoot.
      const offline = await loadAndValidateRegisteredPublicBundleV2({
        root: workspace.dir,
        bundlePath: workspace.bundlePath,
        gitRoot: workspace.captureRoot,
        captureRevision: workspace.captureRevision,
        registry,
      });
      expect(offline.registeredAdmissionBinding.verifiedDuringLoad).toBe(false);
    } finally {
      await rm(workspace.dir, { recursive: true, force: true });
    }
  });

  it('fails closed for wrong repository, missing tags, and either tag target drift', async () => {
    const workspace = await prepareMiniWorkspace();
    try {
      const upstreamRoot = path.join(workspace.dir, 'admission-negative-git');
      await mkdir(path.join(upstreamRoot, 'releases', 'control-theory-engineering-v0.18-mini'), {
        recursive: true,
      });
      await writeFile(
        path.join(upstreamRoot, 'releases/control-theory-engineering-v0.18-mini/subtree.txt'),
        'stable subtree\n',
      );
      execFileSync('git', ['init', '-q'], { cwd: upstreamRoot });
      execFileSync('git', ['config', 'user.email', 'actkg-v2-admission-negative@example.invalid'], {
        cwd: upstreamRoot,
      });
      execFileSync('git', ['config', 'user.name', 'actkg-v2-admission-negative'], { cwd: upstreamRoot });
      execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/yong-wei/ActKG.git'], {
        cwd: upstreamRoot,
      });
      execFileSync('git', ['add', '.'], { cwd: upstreamRoot });
      execFileSync('git', ['commit', '-qm', 'source'], { cwd: upstreamRoot });
      const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: upstreamRoot,
        encoding: 'utf8',
      }).trim();
      execFileSync('git', ['tag', 'mini-source'], { cwd: upstreamRoot });
      await writeFile(
        path.join(upstreamRoot, 'releases/control-theory-engineering-v0.18-mini/publication.txt'),
        'publication\n',
      );
      execFileSync('git', ['add', '.'], { cwd: upstreamRoot });
      execFileSync('git', ['commit', '-qm', 'publication'], { cwd: upstreamRoot });
      const publicationCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: upstreamRoot,
        encoding: 'utf8',
      }).trim();
      execFileSync('git', ['tag', 'mini-publication'], { cwd: upstreamRoot });
      const registry = {
        ...workspace.registry,
        registryIdentity: 'actkg-public-bundle-v2-fixture:admission-negative:r1',
        upstreamRepository: {
          repositoryId: 'fixture/admission-negative',
          remoteUrl: 'https://github.com/yong-wei/ActKG.git',
        },
        publicationTag: 'mini-publication',
        publicationCommit,
        sourceTag: 'mini-source',
        sourceCommit,
      } satisfies PublicBundleV2Registry;

      const expectAdmissionFailure = (candidate: PublicBundleV2Registry, pattern: RegExp) => {
        expect(() => admitPublicBundleV2({ upstreamGitRoot: upstreamRoot, registry: candidate }))
          .toThrow(pattern);
      };
      expectAdmissionFailure(
        { ...registry, publicationCommit: '0'.repeat(40) },
        /publication tag mini-publication points/u,
      );
      expectAdmissionFailure(
        { ...registry, sourceCommit: '1'.repeat(40) },
        /source tag mini-source points/u,
      );
      expectAdmissionFailure(
        { ...registry, publicationTag: 'missing-publication-tag' },
        /git rev-parse.*could not be resolved/u,
      );
      execFileSync('git', ['remote', 'set-url', 'origin', 'https://example.invalid/wrong.git'], {
        cwd: upstreamRoot,
      });
      expectAdmissionFailure(registry, /upstream repository identity/u);
    } finally {
      await rm(workspace.dir, { recursive: true, force: true });
    }
  });

  it('rejects missing required v2 roles and count drift', async () => {
    const workspace = await prepareMiniWorkspace();
    try {
      const driftedCounts = {
        ...workspace.registry,
        expectedCounts: {
          ...workspace.registry.expectedCounts,
          releaseNodes: 7061,
        },
      };
      await expectRejection(
        () => loadAndValidateRegisteredPublicBundleV2({
          root: workspace.dir,
          bundlePath: workspace.bundlePath,
          gitRoot: workspace.captureRoot,
          captureRevision: workspace.captureRevision,
          registry: driftedCounts,
        }),
        'INTEGRITY_REJECTED',
        /recomputed v2 counts/u,
      );

      const manifestPath = path.join(workspace.bundleDir, 'bundle-manifest.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as JsonObject & {
        artifacts: Array<JsonObject>;
      };
      manifest.artifacts = manifest.artifacts.filter((artifact) => artifact.role !== 'multilingual_label_index');
      await writeJson(manifestPath, manifest);
      await rm(path.join(workspace.bundleDir, 'multilingual-label-index.jsonl'));
      const rewritten = await rewriteManifestDigest(workspace.bundleDir);
      const missingLabelRegistry = {
        ...workspace.registry,
        bundleDigest: String(rewritten.bundle_digest),
        manifestRawSha256: sha256(await readFile(manifestPath)),
        sha256sumsRawSha256: sha256(await readFile(path.join(workspace.bundleDir, 'SHA256SUMS'))),
      };
      await expectRejection(
        () => loadAndValidateRegisteredPublicBundleV2({
          root: workspace.dir,
          bundlePath: workspace.bundlePath,
          gitRoot: workspace.captureRoot,
          captureRevision: workspace.captureRevision,
          registry: missingLabelRegistry,
        }),
        'ADAPTER_UPDATE_REQUIRED',
        /multilingual_label_index/u,
      );
    } finally {
      await rm(workspace.dir, { recursive: true, force: true });
    }
  });

  it('rejects caller-supplied admission, proof, and registry fields', async () => {
    const workspace = await prepareMiniWorkspace();
    try {
      const spoofed = {
        root: workspace.dir,
        bundlePath: workspace.bundlePath,
        gitRoot: workspace.captureRoot,
        captureRevision: workspace.captureRevision,
        admissionEvidence: {
          status: 'PASS',
          publicationRevision: { tag: 'spoofed', commit: '0'.repeat(40) },
        },
      } as any;
      await expectRejection(
        () => loadAndValidatePublicBundleV2(spoofed),
        'INTEGRITY_REJECTED',
        /caller-controlled admissionEvidence/u,
      );
      await expectRejection(
        () => loadAndValidatePublicBundleV2({
          root: workspace.dir,
          bundlePath: workspace.bundlePath,
          gitRoot: workspace.captureRoot,
          captureRevision: workspace.captureRevision,
          proof: { status: 'PASS' },
        } as any),
        'INTEGRITY_REJECTED',
        /caller-controlled proof/u,
      );
      await expectRejection(
        () => loadAndValidatePublicBundleV2({
          root: workspace.dir,
          bundlePath: workspace.bundlePath,
          gitRoot: workspace.captureRoot,
          captureRevision: workspace.captureRevision,
          registry: workspace.registry,
        } as any),
        'INTEGRITY_REJECTED',
        /caller-controlled registry/u,
      );
      await expectRejection(
        () => routeAndValidatePublicBundle({
          root: workspace.dir,
          controlledPath: workspace.bundlePath,
          captureRevision: workspace.captureRevision,
          gitRoot: workspace.captureRoot,
          admissionEvidence: { status: 'PASS' },
        } as any),
        'INTEGRITY_REJECTED',
        /caller-controlled admissionEvidence/u,
      );
    } finally {
      await rm(workspace.dir, { recursive: true, force: true });
    }
  });

  it('derives a frozen registration binding copy from the module registry', async () => {
    const workspace = await prepareMiniWorkspace();
    try {
      const validated = await loadAndValidateRegisteredPublicBundleV2({
        root: workspace.dir,
        bundlePath: workspace.bundlePath,
        gitRoot: workspace.captureRoot,
        captureRevision: workspace.captureRevision,
        registry: workspace.registry,
      });
      const binding = validated.registeredAdmissionBinding;
      expect(Object.isFrozen(binding)).toBe(true);
      expect(Object.isFrozen(binding.registryIdentity)).toBe(true);
      expect(Object.isFrozen(binding.publicationRevision)).toBe(true);
      expect(Object.isFrozen(binding.sourceRevision)).toBe(true);
      expect(Object.isFrozen(binding.bundleIdentity)).toBe(true);
      expect(binding).not.toBe(workspace.registry);
      expect(binding.provenance).toBe('registry');
      expect(binding.verificationScope).toBe('admission-time');
      expect(binding.verifiedDuringLoad).toBe(false);
      expect('status' in binding).toBe(false);
      expect(binding.bundleIdentity.bundleId).toBe(workspace.registry.bundleId);
    } finally {
      await rm(workspace.dir, { recursive: true, force: true });
    }
  });

  it('rejects label, profile, and runtime membership closure failures', async () => {
    const workspace = await prepareMiniWorkspace();
    try {
      const labelsPath = path.join(workspace.bundleDir, 'multilingual-label-index.jsonl');
      await writeFile(
        labelsPath,
        `${JSON.stringify({
          entity_id: 'ctc:missing-runtime-node',
          language: 'zh-CN',
          label: '失踪',
          label_type: 'canonical_preferred',
          terminology_assertion_id: 'ctt:missing',
        })}\n`,
      );
      const manifestPath = path.join(workspace.bundleDir, 'bundle-manifest.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as JsonObject & {
        artifacts: Array<JsonObject>;
        statistics: JsonObject;
      };
      const labelArtifact = manifest.artifacts.find((artifact) => artifact.role === 'multilingual_label_index')!;
      const labelBytes = await readFile(labelsPath);
      labelArtifact.sha256 = sha256(labelBytes);
      labelArtifact.byte_length = labelBytes.byteLength;
      labelArtifact.record_count = 1;
      await rewriteManifestDigest(workspace.bundleDir);
      const driftedLabelRegistry = {
        ...workspace.registry,
        bundleDigest: String((JSON.parse(await readFile(manifestPath, 'utf8')) as JsonObject).bundle_digest),
        manifestRawSha256: sha256(await readFile(manifestPath)),
        sha256sumsRawSha256: sha256(await readFile(path.join(workspace.bundleDir, 'SHA256SUMS'))),
      };
      await expectRejection(
        () => loadAndValidateRegisteredPublicBundleV2({
          root: workspace.dir,
          bundlePath: workspace.bundlePath,
          gitRoot: workspace.captureRoot,
          captureRevision: workspace.captureRevision,
          registry: driftedLabelRegistry,
        }),
        'INTEGRITY_REJECTED',
        /does not resolve to a runtime projection entity|Artifact SHA mismatch/u,
      );
    } finally {
      await rm(workspace.dir, { recursive: true, force: true });
    }
  });

  it('rejects runtime profile drift from the registered v0.18 v3 profile', async () => {
    const workspace = await prepareMiniWorkspace();
    try {
      const profilesPath = path.join(workspace.bundleDir, 'projection-profiles.json');
      const profiles = JSON.parse(await readFile(profilesPath, 'utf8')) as {
        profiles: Array<JsonObject>;
        profile_sha256: Record<string, string>;
      };
      const runtime = profiles.profiles.find((profile) => String(profile.id).includes('runtime-v3'))!;
      runtime.id = 'ctr:profile:control-theory-engineering-v0.18:runtime-v9';
      await writeJson(profilesPath, profiles);
      const manifestPath = path.join(workspace.bundleDir, 'bundle-manifest.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as JsonObject & {
        artifacts: Array<JsonObject>;
      };
      const artifact = manifest.artifacts.find((row) => row.role === 'projection_profiles')!;
      const bytes = await readFile(profilesPath);
      artifact.sha256 = sha256(bytes);
      artifact.byte_length = bytes.byteLength;
      await rewriteManifestDigest(workspace.bundleDir);
      const driftedProfileRegistry = {
        ...workspace.registry,
        bundleDigest: String((JSON.parse(await readFile(manifestPath, 'utf8')) as JsonObject).bundle_digest),
        manifestRawSha256: sha256(await readFile(manifestPath)),
        sha256sumsRawSha256: sha256(await readFile(path.join(workspace.bundleDir, 'SHA256SUMS'))),
      };
      await expectRejection(
        () => loadAndValidateRegisteredPublicBundleV2({
          root: workspace.dir,
          bundlePath: workspace.bundlePath,
          gitRoot: workspace.captureRoot,
          captureRevision: workspace.captureRevision,
          registry: driftedProfileRegistry,
        }),
        'INTEGRITY_REJECTED',
        /projection profile|Artifact SHA mismatch/u,
      );
    } finally {
      await rm(workspace.dir, { recursive: true, force: true });
    }
  });
});

describe('ActKG public Bundle v2 fail-closed behavior', () => {
  it('never falls back to the v1 adapter after a failed v2 route', async () => {
    const workspace = await prepareMiniWorkspace();
    try {
      const routed = await expectRejection(
        () => routeAndValidatePublicBundle({
          root: workspace.dir,
          controlledPath: workspace.bundlePath,
          captureRevision: workspace.captureRevision,
          gitRoot: workspace.captureRoot,
        }),
        'ADAPTER_UPDATE_REQUIRED',
      );
      expect(routed.assessment.reasons.join(' ')).not.toMatch(/actkg-public-bundle\/1/u);

      const production = await expectRejection(
        () => loadAndValidatePublicBundleV2({
          root: workspace.dir,
          bundlePath: workspace.bundlePath,
          gitRoot: workspace.captureRoot,
          captureRevision: workspace.captureRevision,
        }),
        'ADAPTER_UPDATE_REQUIRED',
      );
      expect(production.assessment.reasons.join(' ')).toMatch(/registered v0\.18 publication|bundle_id|bundle_digest|SHA-256/u);
    } finally {
      await rm(workspace.dir, { recursive: true, force: true });
    }
  });

  it('binds capture revision to the new v2 adapter and schema paths', () => {
    expect(PUBLIC_BUNDLE_V2_ADAPTER_CAPTURE_PATHS).toContain('scripts/actkg-release/public-bundle-v2.ts');
    expect(PUBLIC_BUNDLE_V2_ADAPTER_CAPTURE_PATHS).toContain(
      'scripts/actkg-release/bundle-compatibility-registry-v2.ts',
    );
    expect(PUBLIC_BUNDLE_V2_ADAPTER_CAPTURE_PATHS).toContain(
      'scripts/actkg-release/schemas/public-bundle-v2',
    );
  });
});

describe('ActKG public Bundle v1 outcomes stay unchanged', () => {
  it('still routes historical v1 packages only to the v1 adapter', async () => {
    expect(PUBLIC_BUNDLE_CONTRACT_VERSION).toBe('actkg-public-bundle/1');
    expect(CTKG_SCHEMA_VERSION).toBe('0.2.0');
    const v1Route = await decidePublicBundleRoute({ root, controlledPath: R2_PATH });
    expect(v1Route.kind).toBe('actkg-public-bundle/1');
    expect(await parseDeclaredPublicBundleProtocol({ root, controlledPath: R2_PATH })).toBe(
      'actkg-public-bundle/1',
    );
    const legacyRoute = await decidePublicBundleRoute({ root, controlledPath: V02_PATH });
    expect(legacyRoute.kind).toBe('legacy-exact-v0.2');
  });

  it('still accepts the reviewed v1 package through the v1 adapter', async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), 'actkg-public-bundle-v1-capture-'));
    try {
      const capture = await createCaptureWorkspace(parent, PUBLIC_BUNDLE_ADAPTER_CAPTURE_PATHS);
      const validated = await loadAndValidatePublicBundleV1({
        root,
        gitRoot: capture.root,
        captureRevision: capture.revision,
      });
      expect(validated.bundleIdentity.bundleContractVersion).toBe('actkg-public-bundle/1');
      expect(validated.schemaIdentity.version).toBe('0.2.0');
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });
});
