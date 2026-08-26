import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { canonicalJson, sha256 } from '../../../scripts/actkg-release/authoritative-release';
import {
  PUBLIC_BUNDLE_V2_ADAPTER_CAPTURE_PATHS,
} from '../../../scripts/actkg-release/capture-revision';
import { REVIEWED_V0_18_IDENTITIES } from '../../../scripts/actkg-release/bundle-compatibility-registry-v2';
import {
  loadAndValidatePublicBundleV2,
} from '../../../scripts/actkg-release/public-bundle-v2';
import type { JsonObject } from '../../../scripts/actkg-release/public-bundle-types';

const root = process.cwd();
const upstreamRepository = process.env.ACTKG_PUBLIC_BUNDLE_V2_REPOSITORY;

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

async function prepareUpstreamV018Workspace(): Promise<{
  dir: string;
  bundlePath: string;
  captureRevision: string;
}> {
  if (!upstreamRepository || !existsSync(path.join(upstreamRepository, '.git'))) {
    throw new Error('ACTKG_PUBLIC_BUNDLE_V2_REPOSITORY must point to the upstream v0.18 Git repository');
  }
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
        upstreamRepository,
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

describe('ActKG public Bundle v2 upstream real smoke', () => {
  it('validates the complete upstream v0.18 tag as the positive case', async () => {
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
      expect(validated.multilingualLabels[0]).toMatchObject({
        entityId: 'ctc:modeling-00d2998755974a1329049aac',
        language: 'zh-CN',
        label: '增益',
        labelType: 'canonical_preferred',
        terminologyAssertionId: 'ctt:zh-cn-assertion-8db4ed0140ed5313f26035c0',
      });
      expect(validated.multilingualLabels.at(-1)).toMatchObject({
        entityId: 'ctkg:v3e-object-fffc8da83a5258ec01126edc',
        language: 'zh-CN',
        label: '全维状态观测器设计中的被控对象动态方程',
        labelType: 'alternative',
        terminologyAssertionId: 'ctt:zh-cn-assertion-a7023afbbfc881b3a93d67a8',
      });
      expect(sha256(canonicalJson(validated.multilingualLabels))).toBe(
        '896a13b1f03cdc738472805526489aa52f69b08fa99b3dafe804cb6d0cd2f9cf',
      );
      expect(validated.components).toHaveLength(17);
    } finally {
      await rm(workspace.dir, { recursive: true, force: true });
    }
  }, 180_000);

  it('loads an exact upstream export from a bare directory without upstream Git', async () => {
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
  }, 180_000);
});
