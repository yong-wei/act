import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  computeCanonicalReleaseHash,
  computeProjectionVersionDigest,
} from '../../../scripts/actkg-release/actkg-canonical-digests';
import { canonicalJson, sha256 } from '../../../scripts/actkg-release/authoritative-release';
import {
  CTKG_SCHEMA_RAW_SHA256,
  CTKG_SCHEMA_VERSION,
  PUBLIC_BUNDLE_CONTRACT_VERSION,
  REVIEWED_V0_3_R2_IDENTITIES,
} from '../../../scripts/actkg-release/bundle-compatibility-registry';
import {
  decidePublicBundleRoute,
  routeAndValidatePublicBundle,
} from '../../../scripts/actkg-release/public-bundle-router';
import {
  DEFAULT_PUBLIC_BUNDLE_LOCK_PATH,
  PublicBundleRejection,
  loadAndValidatePublicBundleV1,
} from '../../../scripts/actkg-release/public-bundle-v1';
import type { JsonObject, ReleaseSetLockV3 } from '../../../scripts/actkg-release/public-bundle-types';

const root = process.cwd();
const R2_PATH = 'course-content/authoring/knowledge/releases/control-theory-engineering-v0.3-r2';
const V02_PATH = 'course-content/authoring/knowledge/releases/control-theory-engineering-v0.2';
const LOCK_V3 = DEFAULT_PUBLIC_BUNDLE_LOCK_PATH;
const UNFIXED = 'scripts/actkg-release/fixtures/control-theory-engineering-v0.3-unfixed';
const COMPONENT_PATHS = [
  'course-content/authoring/knowledge/releases/root-locus-engineering-v0.1',
  'course-content/authoring/knowledge/releases/system-modeling-engineering-v0.1',
  'course-content/authoring/knowledge/releases/control-theory-integration-v0.1',
] as const;

/** Real Git HEAD of the repository; never a fabricated digest. */
function realGitHead(cwd: string = root): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
}

/**
 * Public loader options for isolated content fixtures.
 * Capture binding always uses real process Git on `gitRoot` (repository root).
 * Success requires a clean protected worktree — no runner injection seam.
 */
function fixtureLoadOptions(
  fixture: string,
  extra: {
    lockPath?: string;
    bundlePath?: string;
    allowCandidateBundle?: boolean;
  } = {},
): {
  root: string;
  lockPath: string;
  captureRevision: string;
  gitRoot: string;
  bundlePath?: string;
  allowCandidateBundle?: boolean;
} {
  return {
    root: fixture,
    lockPath: extra.lockPath ?? LOCK_V3,
    captureRevision: realGitHead(),
    gitRoot: root,
    ...(extra.bundlePath ? { bundlePath: extra.bundlePath } : {}),
    ...(extra.allowCandidateBundle !== undefined
      ? { allowCandidateBundle: extra.allowCandidateBundle }
      : {}),
  };
}

/** Production-root loads with optional expected captureRevision equality only. */
function rootLoadOptions(extra: { captureRevision?: string } = {}): {
  root: string;
  captureRevision?: string;
} {
  return {
    root,
    ...(extra.captureRevision !== undefined
      ? { captureRevision: extra.captureRevision }
      : { captureRevision: realGitHead() }),
  };
}

type Manifest = JsonObject & {
  artifacts: Array<JsonObject>;
  components: Array<JsonObject>;
  statistics: JsonObject;
  bundle_digest: string;
  bundle_id: string;
  bundle_revision: number;
  release: JsonObject;
  schema: JsonObject;
};

async function copyTree(sourceRelative: string, destinationRoot: string, destinationRelative: string): Promise<void> {
  await cp(path.join(root, sourceRelative), path.join(destinationRoot, destinationRelative), { recursive: true });
}

async function fixtureRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'actkg-public-bundle-'));
  await copyTree(R2_PATH, dir, R2_PATH);
  await copyTree(LOCK_V3, dir, LOCK_V3);
  for (const component of COMPONENT_PATHS) {
    await copyTree(component, dir, component);
  }
  await copyTree(V02_PATH, dir, V02_PATH);
  await copyTree(
    'course-content/authoring/knowledge/releases/release-set.lock.json',
    dir,
    'course-content/authoring/knowledge/releases/release-set.lock.json',
  );
  await copyTree(UNFIXED, dir, UNFIXED);
  await copyTree(
    'scripts/actkg-release/schemas/public-bundle',
    dir,
    'scripts/actkg-release/schemas/public-bundle',
  );
  return dir;
}

async function readManifest(fixture: string): Promise<Manifest> {
  return JSON.parse(await readFile(path.join(fixture, R2_PATH, 'bundle-manifest.json'), 'utf8')) as Manifest;
}

async function writeJson(filePath: string, value: unknown): Promise<Buffer> {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await writeFile(filePath, bytes);
  return bytes;
}

function recomputeDigest(manifest: Manifest): string {
  const body = structuredClone(manifest) as JsonObject;
  delete body.bundle_digest;
  return sha256(canonicalJson(body));
}

/** List all regular files under a Bundle as POSIX relative paths (includes hidden names). */
async function listFixtureRegularFiles(bundleDir: string): Promise<string[]> {
  const { lstat, readdir } = await import('node:fs/promises');
  const files: string[] = [];
  async function walk(currentDir: string, relativePrefix: string): Promise<void> {
    for (const name of await readdir(currentDir)) {
      const relative = relativePrefix ? `${relativePrefix}/${name}` : name;
      const full = path.join(currentDir, name);
      const info = await lstat(full);
      if (info.isSymbolicLink()) {
        throw new Error(`test fixture must not contain symbolic links: ${relative}`);
      }
      if (info.isFile()) {
        files.push(relative);
        continue;
      }
      if (info.isDirectory()) {
        await walk(full, relative);
        continue;
      }
      throw new Error(`test fixture contains non-regular entry: ${relative}`);
    }
  }
  await walk(bundleDir, '');
  return files.sort();
}

async function rewriteSha256Sums(bundleDir: string): Promise<void> {
  const names = (await listFixtureRegularFiles(bundleDir)).filter((name) => name !== 'SHA256SUMS');
  const lines: string[] = [];
  for (const name of names) {
    const digest = sha256(await readFile(path.join(bundleDir, ...name.split('/'))));
    lines.push(`${digest}  ${name}`);
  }
  await writeFile(path.join(bundleDir, 'SHA256SUMS'), `${lines.join('\n')}\n`);
}

async function finalizeBundle(
  fixture: string,
  mutate: (manifest: Manifest, bundleDir: string) => Promise<void> | void,
  options: {
    updateLock?: boolean;
    mutateLock?: (lock: ReleaseSetLockV3, fixtureRoot: string) => void | Promise<void>;
  } = {},
): Promise<void> {
  const bundleDir = path.join(fixture, R2_PATH);
  const manifest = await readManifest(fixture);
  await mutate(manifest, bundleDir);
  manifest.bundle_digest = recomputeDigest(manifest);
  const manifestBytes = await writeJson(path.join(bundleDir, 'bundle-manifest.json'), manifest);
  await rewriteSha256Sums(bundleDir);
  if (options.updateLock !== false) {
    const lockPath = path.join(fixture, LOCK_V3);
    const lock = JSON.parse(await readFile(lockPath, 'utf8')) as ReleaseSetLockV3;
    lock.bundle.bundle_id = String(manifest.bundle_id);
    lock.bundle.bundle_revision = Number(manifest.bundle_revision);
    lock.bundle.bundle_digest = String(manifest.bundle_digest);
    lock.bundle.manifest_raw_sha256 = sha256(manifestBytes);
    lock.release.release_id = String(manifest.release.release_id);
    lock.release.release_version = String(manifest.release.release_version);
    lock.release.release_hash = String(manifest.release.release_hash);
    lock.release.source_dataset_hash = String(manifest.release.source_dataset_hash);
    lock.compatibility.schema_version = String(manifest.schema.version);
    lock.compatibility.schema_sha256 = String(manifest.schema.sha256);
    if (options.mutateLock) await options.mutateLock(lock, fixture);
    await writeJson(lockPath, lock);
  }
}

function recomputeReleaseHash(release: JsonObject): string {
  return computeCanonicalReleaseHash(release);
}

function recomputeProjectionDigest(projection: JsonObject, manifestProfile: string): string {
  return computeProjectionVersionDigest(projection, null, manifestProfile);
}

async function writeTrackedArtifact(
  manifest: Manifest,
  bundleDir: string,
  relativePath: string,
  bytes: Buffer,
): Promise<void> {
  await writeFile(path.join(bundleDir, relativePath), bytes);
  const artifact = manifest.artifacts.find((item) => item.path === relativePath);
  if (!artifact) return;
  artifact.sha256 = sha256(bytes);
  artifact.byte_length = bytes.byteLength;
  if (relativePath.endsWith('.jsonl')) {
    artifact.record_count = bytes.toString('utf8').split(/\r?\n/u).filter((line) => line.length > 0).length;
  }
}

async function writeTrackedJson(
  manifest: Manifest,
  bundleDir: string,
  relativePath: string,
  value: unknown,
): Promise<void> {
  const bytes = await writeJson(path.join(bundleDir, relativePath), value);
  const artifact = manifest.artifacts.find((item) => item.path === relativePath);
  if (!artifact) return;
  artifact.sha256 = sha256(bytes);
  artifact.byte_length = bytes.byteLength;
  if (!relativePath.endsWith('.jsonl')) artifact.record_count = null;
}

function projectionPaths(manifest: Manifest): Record<'runtime' | 'domain' | 'review', string> {
  const byProfile = {
    runtime: String(manifest.artifacts.find((item) => item.role === 'projection' && item.profile === 'runtime')!.path),
    domain: String(manifest.artifacts.find((item) => item.role === 'projection' && item.profile === 'domain')!.path),
    review: String(manifest.artifacts.find((item) => item.role === 'projection' && item.profile === 'review')!.path),
  };
  return byProfile;
}

async function syncValidationReport(
  manifest: Manifest,
  bundleDir: string,
  options: {
    bundleId?: string;
    release?: JsonObject;
    statistics?: JsonObject;
  } = {},
): Promise<void> {
  const reportArtifact = manifest.artifacts.find((item) => item.role === 'validation_report')!;
  const reportPath = path.join(bundleDir, String(reportArtifact.path));
  const report = JSON.parse(await readFile(reportPath, 'utf8')) as JsonObject;
  if (options.bundleId) report.bundle_id = options.bundleId;
  if (options.release) report.release = options.release;
  if (options.statistics) report.statistics = options.statistics;
  report.result = 'PASS';
  const gates = objectOrEmpty(report.gates);
  for (const key of Object.keys(gates)) gates[key] = 'PASS';
  report.gates = gates;
  report.artifact_validation = manifest.artifacts
    .filter((artifact) => artifact.role !== 'validation_report')
    .map((artifact) => ({
      path: artifact.path,
      sha256: artifact.sha256,
      byte_length: artifact.byte_length,
      record_count: artifact.record_count ?? null,
      result: 'PASS',
    }));
  report.component_validation = manifest.components.map((component) => ({
    release_id: component.release_id,
    reference_kind: component.reference_kind,
    // Validation Report reuses release_raw_sha256 for both kinds: legacy Release
    // JSON hash, or standard_bundle Manifest raw hash.
    release_raw_sha256: component.reference_kind === 'standard_bundle'
      ? component.manifest_sha256
      : component.release_raw_sha256,
    result: 'PASS',
  }));
  await writeTrackedJson(manifest, bundleDir, String(reportArtifact.path), report);
}

async function writeMinimalStandardBundleComponent(options: {
  fixture: string;
  controlledPath: string;
  releaseId: string;
  releaseVersion: string;
  /** Ignored when omitted; always recomputed from the release payload self-hash. */
  releaseHash?: string;
  bundleId: string;
  sourceDatasetHash?: string;
  /**
   * Optional mutation applied after the release self-hash is sealed — used by
   * negative tests to leave a stale declared hash or alter identity fields.
   */
  mutateReleaseAfterSeal?: (release: JsonObject) => void;
  omitReleaseArtifact?: boolean;
  duplicateReleaseArtifact?: boolean;
}): Promise<{
  bundleDigest: string;
  manifestSha256: string;
  releaseHash: string;
  releasePath: string;
}> {
  const dir = path.join(options.fixture, options.controlledPath);
  await mkdir(dir, { recursive: true });
  const notes = Buffer.from(`# ${options.releaseVersion}\nstandard_bundle fixture\n`, 'utf8');
  await writeFile(path.join(dir, 'RELEASE-NOTES.md'), notes);

  const sourceDatasetHash = options.sourceDatasetHash ?? 'd'.repeat(64);
  const releasePayload: JsonObject = {
    id: options.releaseId,
    release_version: options.releaseVersion,
    source_dataset_hash: sourceDatasetHash,
    // Must match Manifest/Lock registered Schema identity for standard_bundle closure.
    schema_version: CTKG_SCHEMA_VERSION,
    entries: [],
    included_entities: [],
    component_releases: [],
  };
  const releaseHash = computeCanonicalReleaseHash(releasePayload);
  releasePayload.release_hash = releaseHash;
  if (options.mutateReleaseAfterSeal) {
    options.mutateReleaseAfterSeal(releasePayload);
  }
  const releasePath = 'component-release.json';
  const releaseBytes = options.omitReleaseArtifact
    ? null
    : await writeJson(path.join(dir, releasePath), releasePayload);

  const artifacts: Manifest['artifacts'] = [
    {
      role: 'release_notes',
      contract_version: 'actkg-release-notes/1',
      required: true,
      path: 'RELEASE-NOTES.md',
      media_type: 'text/markdown',
      sha256: sha256(notes),
      byte_length: notes.byteLength,
      record_count: null,
    },
  ];
  if (releaseBytes) {
    artifacts.push({
      role: 'release',
      contract_version: 'ctkg-release/0.2',
      required: true,
      path: releasePath,
      media_type: 'application/json',
      sha256: sha256(releaseBytes),
      byte_length: releaseBytes.byteLength,
      record_count: null,
    });
    if (options.duplicateReleaseArtifact) {
      const dupPath = 'component-release-dup.json';
      await writeFile(path.join(dir, dupPath), releaseBytes);
      artifacts.push({
        role: 'release',
        contract_version: 'ctkg-release/0.2',
        required: true,
        path: dupPath,
        media_type: 'application/json',
        sha256: sha256(releaseBytes),
        byte_length: releaseBytes.byteLength,
        record_count: null,
      });
    }
  }

  const declaredReleaseHash = typeof releasePayload.release_hash === 'string'
    ? String(releasePayload.release_hash)
    : releaseHash;

  const manifest: Manifest = {
    bundle_contract_version: PUBLIC_BUNDLE_CONTRACT_VERSION,
    bundle_id: options.bundleId,
    bundle_revision: 1,
    bundle_kind: 'module',
    release_stage: 'stable',
    normalization: 'canonical-json/rfc8785-subset-v1',
    schema: {
      version: CTKG_SCHEMA_VERSION,
      sha256: CTKG_SCHEMA_RAW_SHA256,
    },
    release: {
      release_id: options.releaseId,
      release_version: options.releaseVersion,
      release_hash: declaredReleaseHash,
      source_dataset_hash: sourceDatasetHash,
    },
    source_revision: {
      commit: 'c'.repeat(40),
      tag: options.releaseVersion,
    },
    publication: { tag: options.releaseVersion },
    previous_bundle: {
      bundle_id: `${options.bundleId}-seed`,
      kind: 'legacy_exact',
      sha256sums_sha256: 'e'.repeat(64),
    },
    artifacts,
    components: [],
    statistics: {
      release_entries: 0,
      knowledge_nodes: 0,
      published_relations: 0,
      projection_nodes: 0,
      projection_links: 0,
      rag_crosswalk_rows: 0,
      component_count: 0,
      relation_type_count: 0,
    },
    bundle_digest: '0'.repeat(64),
  };
  manifest.bundle_digest = recomputeDigest(manifest);
  const manifestBytes = await writeJson(path.join(dir, 'bundle-manifest.json'), manifest);
  // Component packages must publish a closed SHA256SUMS like any public Bundle.
  await rewriteSha256Sums(dir);
  return {
    bundleDigest: String(manifest.bundle_digest),
    manifestSha256: sha256(manifestBytes),
    releaseHash: declaredReleaseHash,
    releasePath,
  };
}

function objectOrEmpty(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as JsonObject;
}

function markContentBundleRevision(manifest: Manifest, suffix: string): void {
  manifest.bundle_id = `ctb:control-theory-engineering-${suffix}:r1`;
  manifest.bundle_revision = 1;
}

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

describe('ActKG public bundle compatibility (actkg-public-bundle/1)', () => {
  it('records reviewed contract identities and admits the vendored v0.3 r2 package', async () => {
    const validated = await loadAndValidatePublicBundleV1(rootLoadOptions());
    expect(validated.captureRevision).toBe(realGitHead());
    expect(validated.bundleIdentity.bundleContractVersion).toBe(PUBLIC_BUNDLE_CONTRACT_VERSION);
    expect(validated.schemaIdentity).toEqual({
      version: CTKG_SCHEMA_VERSION,
      rawSha256: CTKG_SCHEMA_RAW_SHA256,
    });
    expect(validated.bundleIdentity.bundleId).toBe(REVIEWED_V0_3_R2_IDENTITIES.bundleId);
    expect(validated.bundleIdentity.bundleDigest).toBe(REVIEWED_V0_3_R2_IDENTITIES.bundleDigest);
    expect(validated.bundleIdentity.manifestRawSha256).toBe(REVIEWED_V0_3_R2_IDENTITIES.manifestRawSha256);
    expect(validated.releaseIdentity.releaseHash).toBe(REVIEWED_V0_3_R2_IDENTITIES.releaseHash);
    expect(validated.compatibility.code).toMatch(/COMPATIBLE_/u);
    expect(validated.selectedRuntimeProjection.identity.profile).toBe('runtime');
    expect(validated.preservedProjections.map((item) => item.identity.profile).sort()).toEqual([
      'domain',
      'review',
      'runtime',
    ]);
    expect(validated.components).toHaveLength(3);
    expect(validated.statistics.releaseEntries).toBe(966);
    expect(validated.statistics.projectionNodes).toBe(744);
    expect(validated.statistics.projectionLinks).toBe(130);
    expect(validated.statistics.ragCrosswalkRows).toBe(1361);
    expect(validated.runtimeLinkMetadata).toHaveLength(130);
    expect(validated.crosswalk).toHaveLength(1361);
    // storage-independent: no database side effects are performed by validation
    expect(validated.releaseSetIdentity.lockVersion).toBe('actkg-release-set-lock/v3');
  });

  it('keeps the historical v0.2 package on the exact adapter and never fabricates a Manifest route', async () => {
    const captureRevision = realGitHead();
    expect(captureRevision).toMatch(/^[0-9a-f]{40}$/u);
    const route = await decidePublicBundleRoute({ root, controlledPath: V02_PATH });
    expect(route).toEqual({
      kind: 'legacy-exact-v0.2',
      controlledPath: V02_PATH,
      hasManifest: false,
      reason: 'no bundle-manifest.json; only the frozen historical exact adapter may apply',
    });
    // Capture binding uses real process Git; requires clean protected inputs on gitRoot.
    const routed = await routeAndValidatePublicBundle({
      root,
      controlledPath: V02_PATH,
      captureRevision,
    });
    expect(routed.kind).toBe('legacy-exact-v0.2');
    if (routed.kind === 'legacy-exact-v0.2') {
      expect(routed.validated.entry.release_id).toBe('control-theory-engineering-v0.2');
      expect(routed.validated.captureRevision).toBe(captureRevision);
    }
  });

  it('routes Manifest packages to the standard adapter and never falls back after failure', async () => {
    const route = await decidePublicBundleRoute({ root, controlledPath: R2_PATH });
    expect(route.kind).toBe('actkg-public-bundle/1');
    const fixture = await fixtureRoot();
    await finalizeBundle(fixture, async (manifest, bundleDir) => {
      manifest.bundle_digest = '0'.repeat(64);
      await writeFile(path.join(bundleDir, 'extra-unlocked.txt'), 'nope\n');
    }, { updateLock: false });
    const head = realGitHead();
    await expectRejection(
      () => routeAndValidatePublicBundle({
        root: fixture,
        controlledPath: R2_PATH,
        lockPath: LOCK_V3,
        captureRevision: head,
        gitRoot: root,
      }),
      'INTEGRITY_REJECTED',
    );
    // Still no historical fallback: the package keeps its Manifest.
    const failedRoute = await decidePublicBundleRoute({ root: fixture, controlledPath: R2_PATH });
    expect(failedRoute.kind).toBe('actkg-public-bundle/1');
  });

  it('rejects the unfixed v0.3 package that lacks complete component identity and Manifest', async () => {
    const captureRevision = realGitHead();
    const route = await decidePublicBundleRoute({ root, controlledPath: UNFIXED });
    expect(route.hasManifest).toBe(false);
    // Without a Manifest the historical adapter is selected and rejects the unpinned package.
    await expect(
      routeAndValidatePublicBundle({
        root,
        controlledPath: UNFIXED,
        captureRevision,
      }),
    ).rejects.toThrow(/ActKG aggregate Release rejected|not the pinned/u);

    const components = JSON.parse(
      await readFile(path.join(root, UNFIXED, 'component-releases.json'), 'utf8'),
    ) as { components: Array<Record<string, unknown>> };
    expect(components.components.some((component) => !component.release_id)).toBe(true);
  });

  it('rejects an unknown no-Manifest package without falling into standard acceptance', async () => {
    const fixture = await fixtureRoot();
    const captureRevision = realGitHead();
    const unknownPath = 'course-content/authoring/knowledge/releases/unknown-no-manifest-v9';
    await cp(
      path.join(fixture, V02_PATH),
      path.join(fixture, unknownPath),
      { recursive: true },
    );
    // Ensure no Manifest exists for this unknown package.
    await expect(
      readFile(path.join(fixture, unknownPath, 'bundle-manifest.json')).catch(() => null),
    ).resolves.toBeNull();
    const route = await decidePublicBundleRoute({ root: fixture, controlledPath: unknownPath });
    // No Manifest → historical route only; never standard acceptance.
    expect(route.kind).toBe('legacy-exact-v0.2');
    expect(route.hasManifest).toBe(false);
    await expect(
      routeAndValidatePublicBundle({
        root: fixture,
        controlledPath: unknownPath,
        captureRevision,
        gitRoot: root,
      }),
    ).rejects.toThrow(
      // Unified capture fail-closed for untracked synthetic paths is correct;
      // legacy aggregate/pinned/path errors remain acceptable outcomes too.
      /ActKG public Bundle rejected \(INTEGRITY_REJECTED\).*same Git HEAD|ActKG aggregate Release rejected|not the pinned|not the controlled locked path/u,
    );
    // Re-assert routing so a standard-adapter success path cannot slip through.
    expect(route.kind).not.toBe('actkg-public-bundle/1');
  });

  it('loads a required artifact from a safe non-default top-level path declared by the Manifest', async () => {
    const fixture = await fixtureRoot();
    await finalizeBundle(fixture, async (manifest, bundleDir) => {
      const release = manifest.artifacts.find((artifact) => artifact.role === 'release')!;
      const oldPath = String(release.path);
      const newPath = 'release-envelope.json';
      await cp(path.join(bundleDir, oldPath), path.join(bundleDir, newPath));
      await (await import('node:fs/promises')).unlink(path.join(bundleDir, oldPath));
      const bytes = await readFile(path.join(bundleDir, newPath));
      release.path = newPath;
      release.sha256 = sha256(bytes);
      release.byte_length = bytes.byteLength;
      await syncValidationReport(manifest, bundleDir);
    });
    const validated = await loadAndValidatePublicBundleV1(fixtureLoadOptions(fixture));
    expect(
      validated.rawArtifacts.some((artifact) => (
        artifact.descriptor.role === 'release' && artifact.descriptor.path === 'release-envelope.json'
      )),
    ).toBe(true);
  });

  it('loads a required artifact from a safe nested relative path declared by the Manifest', async () => {
    const fixture = await fixtureRoot();
    await finalizeBundle(fixture, async (manifest, bundleDir) => {
      const release = manifest.artifacts.find((artifact) => artifact.role === 'release')!;
      const oldPath = String(release.path);
      const newPath = 'artifacts/release-envelope.json';
      await mkdir(path.join(bundleDir, 'artifacts'), { recursive: true });
      await cp(path.join(bundleDir, oldPath), path.join(bundleDir, ...newPath.split('/')));
      await unlink(path.join(bundleDir, oldPath));
      const bytes = await readFile(path.join(bundleDir, ...newPath.split('/')));
      release.path = newPath;
      release.sha256 = sha256(bytes);
      release.byte_length = bytes.byteLength;
      await syncValidationReport(manifest, bundleDir);
    });
    const validated = await loadAndValidatePublicBundleV1(fixtureLoadOptions(fixture));
    expect(
      validated.rawArtifacts.some((artifact) => (
        artifact.descriptor.role === 'release'
        && artifact.descriptor.path === 'artifacts/release-envelope.json'
      )),
    ).toBe(true);
  });

  it('classifies unknown optional artifacts as COMPATIBLE_OPTIONAL_EXTENSION without enabling semantics', async () => {
    const fixture = await fixtureRoot();
    await finalizeBundle(fixture, async (manifest, bundleDir) => {
      const extra = Buffer.from('{"note":"optional"}\n', 'utf8');
      await writeFile(path.join(bundleDir, 'future-optional.json'), extra);
      manifest.artifacts.push({
        role: 'future_analytics',
        contract_version: 'actkg-future-analytics/1',
        required: false,
        path: 'future-optional.json',
        media_type: 'application/json',
        sha256: sha256(extra),
        byte_length: extra.byteLength,
        record_count: null,
      });
      await syncValidationReport(manifest, bundleDir);
    });
    const validated = await loadAndValidatePublicBundleV1(fixtureLoadOptions(fixture));
    expect(validated.compatibility.code).toBe('COMPATIBLE_OPTIONAL_EXTENSION');
    expect(validated.unknownOptionalArtifacts).toHaveLength(1);
    expect(validated.unknownOptionalArtifacts[0]!.semanticsEnabled).toBe(false);
  });

  it('returns ADAPTER_UPDATE_REQUIRED for unknown required roles/contracts', async () => {
    const fixture = await fixtureRoot();
    await finalizeBundle(fixture, async (manifest, bundleDir) => {
      const bytes = Buffer.from('required-future\n', 'utf8');
      await writeFile(path.join(bundleDir, 'future-required.bin'), bytes);
      manifest.artifacts.push({
        role: 'future_required_role',
        contract_version: 'actkg-future/1',
        required: true,
        path: 'future-required.bin',
        media_type: 'application/octet-stream',
        sha256: sha256(bytes),
        byte_length: bytes.byteLength,
        record_count: null,
      });
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(fixture)),
      'ADAPTER_UPDATE_REQUIRED',
      /unknown required Artifact/u,
    );
  });

  it('returns SCHEMA_REVIEW_REQUIRED for an unregistered Schema identity with a familiar version string', async () => {
    const fixture = await fixtureRoot();
    await finalizeBundle(fixture, async (manifest) => {
      manifest.schema = {
        version: '0.2.0',
        sha256: 'a'.repeat(64),
      };
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(fixture)),
      'SCHEMA_REVIEW_REQUIRED',
      /Schema identity/u,
    );
  });

  it('rejects path traversal, case-fold collisions, extra files, hash drift and privacy leaks', async () => {
    const traversal = await fixtureRoot();
    await finalizeBundle(traversal, async (manifest) => {
      manifest.artifacts[0]!.path = '../escape.json';
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(traversal)),
      'INTEGRITY_REJECTED',
      /confined POSIX|escapes|must match pattern|unsafe|path/u,
    );

    const caseFold = await fixtureRoot();
    await finalizeBundle(caseFold, async (manifest, bundleDir) => {
      const notes = manifest.artifacts.find((artifact) => artifact.role === 'release_notes')!;
      const clone = structuredClone(notes);
      clone.path = String(notes.path).toUpperCase() === String(notes.path)
        ? 'release-notes.md'
        : String(notes.path).toUpperCase();
      // Ensure the uppercase path is declared while a colliding folded path already exists.
      if (caseFoldPathCollision(String(notes.path), String(clone.path))) {
        manifest.artifacts.push(clone);
      } else {
        manifest.artifacts.push({
          ...clone,
          path: 'Release-Notes.md',
        });
      }
      void bundleDir;
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(caseFold)),
      'INTEGRITY_REJECTED',
      /case folding|file set|missing/u,
    );

    const extra = await fixtureRoot();
    await writeFile(path.join(extra, R2_PATH, 'not-in-manifest.bin'), 'x');
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(extra)),
      'INTEGRITY_REJECTED',
      /file set/u,
    );

    // Hidden (dot-prefixed) undeclared files must enter the closure set so they
    // cannot bypass Manifest/SHA256SUMS equality or privacy scanning.
    const hiddenExtra = await fixtureRoot();
    await writeFile(
      path.join(hiddenExtra, R2_PATH, '.env'),
      'raw_text=secret-should-not-escape-closure\n',
    );
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(hiddenExtra)),
      'INTEGRITY_REJECTED',
      /file set/u,
    );

    const nestedExtra = await fixtureRoot();
    await mkdir(path.join(nestedExtra, R2_PATH, 'smuggle'), { recursive: true });
    await writeFile(path.join(nestedExtra, R2_PATH, 'smuggle', 'not-in-manifest.bin'), 'x');
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(nestedExtra)),
      'INTEGRITY_REJECTED',
      /file set/u,
    );

    const nestedSymlink = await fixtureRoot();
    await mkdir(path.join(nestedSymlink, R2_PATH, 'nested'), { recursive: true });
    await symlink('/etc/passwd', path.join(nestedSymlink, R2_PATH, 'nested', 'escaped-link'));
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(nestedSymlink)),
      'INTEGRITY_REJECTED',
      /symbolic link|file set/u,
    );

    const hashDrift = await fixtureRoot();
    await writeFile(
      path.join(hashDrift, R2_PATH, 'RELEASE-NOTES.md'),
      `${await readFile(path.join(hashDrift, R2_PATH, 'RELEASE-NOTES.md'), 'utf8')}\n`,
    );
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(hashDrift)),
      'INTEGRITY_REJECTED',
      /hash|SHA|digest|file set|byte length/u,
    );

    const privacy = await fixtureRoot();
    await finalizeBundle(privacy, async (manifest, bundleDir) => {
      const notes = manifest.artifacts.find((artifact) => artifact.role === 'release_notes')!;
      const bytes = Buffer.from('public note with "exact_quote" leak\n', 'utf8');
      await writeFile(path.join(bundleDir, String(notes.path)), bytes);
      notes.sha256 = sha256(bytes);
      notes.byte_length = bytes.byteLength;
      await syncValidationReport(manifest, bundleDir);
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(privacy)),
      'INTEGRITY_REJECTED',
      /privacy/u,
    );

    const privateDraft = await fixtureRoot();
    await finalizeBundle(privateDraft, async (manifest, bundleDir) => {
      const notes = manifest.artifacts.find((artifact) => artifact.role === 'release_notes')!;
      const bytes = Buffer.from('public note with "private_review_draft" leak\n', 'utf8');
      await writeFile(path.join(bundleDir, String(notes.path)), bytes);
      notes.sha256 = sha256(bytes);
      notes.byte_length = bytes.byteLength;
      await syncValidationReport(manifest, bundleDir);
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(privateDraft)),
      'INTEGRITY_REJECTED',
      /privacy/u,
    );

    const symlinkFixture = await fixtureRoot();
    await symlink('/etc/passwd', path.join(symlinkFixture, R2_PATH, 'escaped-link'));
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(symlinkFixture)),
      'INTEGRITY_REJECTED',
      /symbolic link|file set/u,
    );
  });

  it('rejects when the controlled Bundle root directory is a symbolic link', async () => {
    // Pre-fix, realpath() of the controlled path would follow a root symlink to a
    // complete external package and admit it; the root link itself never entered
    // the recursive file-set walk.
    const fixture = await fixtureRoot();
    const controlledAbs = path.join(fixture, R2_PATH);
    const aliasAbs = path.join(
      fixture,
      'course-content/authoring/knowledge/releases/aliased-complete-r2-bundle',
    );
    await cp(controlledAbs, aliasAbs, { recursive: true });
    await rm(controlledAbs, { recursive: true, force: true });
    await symlink(aliasAbs, controlledAbs);

    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(fixture)),
      'INTEGRITY_REJECTED',
      /symbolic link/u,
    );

    // Same attack with an absolute target outside the intake root.
    const outsideRoot = await mkdtemp(path.join(os.tmpdir(), 'actkg-bundle-root-escape-'));
    const outsideBundle = path.join(outsideRoot, 'complete-r2');
    await cp(aliasAbs, outsideBundle, { recursive: true });
    await rm(controlledAbs, { recursive: true, force: true });
    await symlink(outsideBundle, controlledAbs);
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(fixture)),
      'INTEGRITY_REJECTED',
      /symbolic link/u,
    );
  });

  it('rejects incomplete component identity and cross-set disagreement', async () => {
    const incomplete = await fixtureRoot();
    await finalizeBundle(incomplete, async (manifest) => {
      delete manifest.components[0]!.release_id;
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(incomplete)),
      'INTEGRITY_REJECTED',
      /component/u,
    );

    const disagree = await fixtureRoot();
    await finalizeBundle(disagree, async (manifest, bundleDir) => {
      const componentFile = path.join(bundleDir, 'component-releases.json');
      const payload = JSON.parse(await readFile(componentFile, 'utf8')) as {
        components: Array<JsonObject>;
      };
      payload.components = payload.components.slice(0, 2);
      const bytes = await writeJson(componentFile, payload);
      const artifact = manifest.artifacts.find((item) => item.role === 'component_manifest')!;
      artifact.sha256 = sha256(bytes);
      artifact.byte_length = bytes.byteLength;
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(disagree)),
      'INTEGRITY_REJECTED',
      /component identity sets differ/u,
    );
  });

  it('rejects projection endpoint, metadata, and crosswalk closure failures', async () => {
    const endpoint = await fixtureRoot();
    await finalizeBundle(endpoint, async (manifest, bundleDir) => {
      const projection = manifest.artifacts.find((artifact) => artifact.profile === 'runtime')!;
      const filePath = path.join(bundleDir, String(projection.path));
      const payload = JSON.parse(await readFile(filePath, 'utf8')) as JsonObject;
      const links = payload.links as JsonObject[];
      links[0]!.source_id = 'ctc:missing-endpoint';
      // Keep version_digest authoritative so validation proceeds to endpoint closure.
      payload.version_digest = recomputeProjectionDigest(payload, 'runtime');
      const bytes = await writeJson(filePath, payload);
      projection.sha256 = sha256(bytes);
      projection.byte_length = bytes.byteLength;
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(endpoint)),
      'INTEGRITY_REJECTED',
      /missing endpoint/u,
    );

    const metadata = await fixtureRoot();
    await finalizeBundle(metadata, async (manifest, bundleDir) => {
      const meta = manifest.artifacts.find((artifact) => artifact.role === 'projection_link_metadata')!;
      const filePath = path.join(bundleDir, String(meta.path));
      const lines = (await readFile(filePath, 'utf8')).split('\n').filter(Boolean);
      lines.pop();
      const bytes = Buffer.from(`${lines.join('\n')}\n`, 'utf8');
      await writeFile(filePath, bytes);
      meta.sha256 = sha256(bytes);
      meta.byte_length = bytes.byteLength;
      meta.record_count = lines.length;
      manifest.statistics.projection_links = 130;
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(metadata)),
      'INTEGRITY_REJECTED',
      /metadata|one-to-one|closed/u,
    );

    const crosswalk = await fixtureRoot();
    await finalizeBundle(crosswalk, async (manifest, bundleDir) => {
      const artifact = manifest.artifacts.find((item) => item.role === 'rag_crosswalk')!;
      const filePath = path.join(bundleDir, String(artifact.path));
      const lines = (await readFile(filePath, 'utf8')).split('\n').filter(Boolean);
      const row = JSON.parse(lines[0]!) as JsonObject;
      row.published_entity_id = 'ctc:not-a-member';
      lines[0] = JSON.stringify(row);
      const bytes = Buffer.from(`${lines.join('\n')}\n`, 'utf8');
      await writeFile(filePath, bytes);
      artifact.sha256 = sha256(bytes);
      artifact.byte_length = bytes.byteLength;
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(crosswalk)),
      'INTEGRITY_REJECTED',
      /outside release membership/u,
    );

    const duplicate = await fixtureRoot();
    await finalizeBundle(duplicate, async (manifest, bundleDir) => {
      const artifact = manifest.artifacts.find((item) => item.role === 'rag_crosswalk')!;
      const filePath = path.join(bundleDir, String(artifact.path));
      const lines = (await readFile(filePath, 'utf8')).split('\n').filter(Boolean);
      lines.push(lines[0]!);
      const bytes = Buffer.from(`${lines.join('\n')}\n`, 'utf8');
      await writeFile(filePath, bytes);
      artifact.sha256 = sha256(bytes);
      artifact.byte_length = bytes.byteLength;
      artifact.record_count = lines.length;
      manifest.statistics.rag_crosswalk_rows = lines.length;
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(duplicate)),
      'INTEGRITY_REJECTED',
      /repeats a crosswalk triple|statistics/u,
    );
  });

  it('accepts a relation-only content update through the same adapter', async () => {
    const fixture = await fixtureRoot();
    let expectedLinks = 0;
    let expectedEntries = 0;
    await finalizeBundle(fixture, async (manifest, bundleDir) => {
      const releaseArtifact = manifest.artifacts.find((item) => item.role === 'release')!;
      const metaArtifact = manifest.artifacts.find((item) => item.role === 'projection_link_metadata')!;
      const paths = projectionPaths(manifest);

      const release = JSON.parse(
        await readFile(path.join(bundleDir, String(releaseArtifact.path)), 'utf8'),
      ) as JsonObject;
      const projections: Record<string, JsonObject> = {};
      for (const profile of ['runtime', 'domain', 'review'] as const) {
        projections[profile] = JSON.parse(
          await readFile(path.join(bundleDir, paths[profile]), 'utf8'),
        ) as JsonObject;
      }
      const runtimeLinks = projections.runtime.links as JsonObject[];
      const removed = runtimeLinks[runtimeLinks.length - 1]!;
      const removedRelationId = String(removed.relation_id);

      for (const profile of ['runtime', 'domain', 'review'] as const) {
        const payload = projections[profile]!;
        payload.links = (payload.links as JsonObject[]).filter(
          (link) => link.relation_id !== removedRelationId,
        );
      }

      const metaLines = (await readFile(path.join(bundleDir, String(metaArtifact.path)), 'utf8'))
        .split(/\r?\n/u)
        .filter(Boolean)
        .filter((line) => JSON.parse(line).relation_id !== removedRelationId);

      const entries = (release.entries as JsonObject[]).filter(
        (entry) => entry.entity !== removedRelationId,
      );
      const included = (release.included_entities as string[]).filter(
        (entity) => entity !== removedRelationId,
      );
      release.entries = entries;
      release.included_entities = included;
      release.release_hash = recomputeReleaseHash(release);
      expectedLinks = (projections.runtime.links as JsonObject[]).length;
      expectedEntries = entries.length;

      for (const profile of ['runtime', 'domain', 'review'] as const) {
        const payload = projections[profile]!;
        payload.source_release_hash = release.release_hash;
        payload.version_digest = recomputeProjectionDigest(payload, profile);
        await writeTrackedJson(manifest, bundleDir, paths[profile], payload);
      }

      const updatedMeta = metaLines.map((line) => {
        const row = JSON.parse(line) as JsonObject;
        row.source_release_hash = release.release_hash;
        return JSON.stringify(row);
      });
      await writeTrackedArtifact(
        manifest,
        bundleDir,
        String(metaArtifact.path),
        Buffer.from(`${updatedMeta.join('\n')}\n`, 'utf8'),
      );

      // Relation entities are also published_entity_id values in the RAG crosswalk.
      const crosswalkArtifact = manifest.artifacts.find((item) => item.role === 'rag_crosswalk')!;
      const crosswalkLines = (await readFile(path.join(bundleDir, String(crosswalkArtifact.path)), 'utf8'))
        .split(/\r?\n/u)
        .filter(Boolean)
        .filter((line) => JSON.parse(line).published_entity_id !== removedRelationId);
      await writeTrackedArtifact(
        manifest,
        bundleDir,
        String(crosswalkArtifact.path),
        Buffer.from(`${crosswalkLines.join('\n')}\n`, 'utf8'),
      );
      await writeTrackedJson(manifest, bundleDir, String(releaseArtifact.path), release);

      manifest.release = {
        release_id: String(release.id),
        release_version: String(release.release_version),
        release_hash: String(release.release_hash),
        source_dataset_hash: String(release.source_dataset_hash),
      };
      manifest.statistics = {
        ...manifest.statistics,
        release_entries: expectedEntries,
        published_relations: expectedLinks,
        projection_links: expectedLinks,
        rag_crosswalk_rows: crosswalkLines.length,
      };
      markContentBundleRevision(manifest, 'v0.4-relation-only');
      await syncValidationReport(manifest, bundleDir, {
        bundleId: String(manifest.bundle_id),
        release: manifest.release,
        statistics: manifest.statistics,
      });
    });

    const validated = await loadAndValidatePublicBundleV1(fixtureLoadOptions(fixture));
    expect(validated.statistics.projectionLinks).toBe(expectedLinks);
    expect(validated.statistics.projectionLinks).toBe(129);
    expect(validated.statistics.projectionNodes).toBe(744);
    expect(validated.statistics.releaseEntries).toBe(expectedEntries);
    expect(validated.runtimeLinkMetadata).toHaveLength(expectedLinks);
    expect(validated.compatibility.code).toBe('COMPATIBLE_CONTENT_UPDATE');
  });

  it('accepts a new-component addition through the same adapter', async () => {
    const fixture = await fixtureRoot();
    const syntheticPath = 'course-content/authoring/knowledge/releases/synthetic-extra-module-v0.1';
    const syntheticReleaseName = 'synthetic-extra-module-v0.1.release.json';
    await finalizeBundle(fixture, async (manifest, bundleDir) => {
      const sourceComponent = path.join(
        fixture,
        'course-content/authoring/knowledge/releases/control-theory-integration-v0.1',
      );
      const targetComponent = path.join(fixture, syntheticPath);
      await cp(sourceComponent, targetComponent, { recursive: true });
      const sourceRelease = path.join(
        targetComponent,
        'control-theory-integration-v0.1.release.json',
      );
      const targetRelease = path.join(targetComponent, syntheticReleaseName);
      const releasePayload = JSON.parse(await readFile(sourceRelease, 'utf8')) as JsonObject;
      releasePayload.id = 'ctr:release:synthetic-extra-module-v0.1';
      releasePayload.release_version = 'synthetic-extra-module-v0.1';
      releasePayload.release_hash = recomputeReleaseHash(releasePayload);
      const releaseBytes = await writeJson(targetRelease, releasePayload);
      const releaseRawSha256 = sha256(releaseBytes);

      const releaseArtifact = manifest.artifacts.find((item) => item.role === 'release')!;
      const componentArtifact = manifest.artifacts.find((item) => item.role === 'component_manifest')!;
      const release = JSON.parse(
        await readFile(path.join(bundleDir, String(releaseArtifact.path)), 'utf8'),
      ) as JsonObject;
      const componentIds = release.component_releases as string[];
      componentIds.push('ctr:release:synthetic-extra-module-v0.1');
      release.component_releases = componentIds;
      release.release_hash = recomputeReleaseHash(release);

      const paths = projectionPaths(manifest);
      for (const profile of ['runtime', 'domain', 'review'] as const) {
        const projection = JSON.parse(
          await readFile(path.join(bundleDir, paths[profile]), 'utf8'),
        ) as JsonObject;
        projection.source_release_hash = release.release_hash;

        projection.version_digest = recomputeProjectionDigest(projection, profile);

        await writeTrackedJson(manifest, bundleDir, paths[profile], projection);
      }

      const metaArtifact = manifest.artifacts.find((item) => item.role === 'projection_link_metadata')!;
      const metaLines = (await readFile(path.join(bundleDir, String(metaArtifact.path)), 'utf8'))
        .split(/\r?\n/u)
        .filter(Boolean)
        .map((line) => {
          const row = JSON.parse(line) as JsonObject;
          row.source_release_hash = release.release_hash;
          return JSON.stringify(row);
        });
      await writeTrackedArtifact(
        manifest,
        bundleDir,
        String(metaArtifact.path),
        Buffer.from(`${metaLines.join('\n')}\n`, 'utf8'),
      );
      await writeTrackedJson(manifest, bundleDir, String(releaseArtifact.path), release);

      const componentManifest = JSON.parse(
        await readFile(path.join(bundleDir, String(componentArtifact.path)), 'utf8'),
      ) as { components: JsonObject[] };
      componentManifest.components.push({
        component_role: 'module',
        release_hash: String(releasePayload.release_hash),
        release_id: 'ctr:release:synthetic-extra-module-v0.1',
        release_version: 'synthetic-extra-module-v0.1',
      });
      await writeTrackedJson(manifest, bundleDir, String(componentArtifact.path), componentManifest);

      manifest.components.push({
        component_path: `${syntheticPath}/${syntheticReleaseName}`,
        component_role: 'module',
        reference_kind: 'legacy_exact',
        release_hash: String(releasePayload.release_hash),
        release_id: 'ctr:release:synthetic-extra-module-v0.1',
        release_raw_sha256: releaseRawSha256,
        release_version: 'synthetic-extra-module-v0.1',
        source_revision: { commit: 'b'.repeat(40) },
      });
      manifest.release = {
        release_id: String(release.id),
        release_version: String(release.release_version),
        release_hash: String(release.release_hash),
        source_dataset_hash: String(release.source_dataset_hash),
      };
      manifest.statistics = {
        ...manifest.statistics,
        component_count: 4,
      };
      markContentBundleRevision(manifest, 'v0.4-new-component');
      await syncValidationReport(manifest, bundleDir, {
        bundleId: String(manifest.bundle_id),
        release: manifest.release,
        statistics: manifest.statistics,
      });
    }, {
      mutateLock: (lock) => {
        lock.components = [
          {
            release_id: 'ctr:root-locus-engineering-v0.1',
            controlled_path: 'course-content/authoring/knowledge/releases/root-locus-engineering-v0.1',
            release_json_name: 'root-locus-engineering-v0.1.json',
            release_raw_sha256: '9a88ce87b4b728c36291b923f69e0647722f1e191501306c33c2c1fed2654eae',
          },
          {
            release_id: 'ctr:release:system-modeling-engineering-v0.1',
            controlled_path: 'course-content/authoring/knowledge/releases/system-modeling-engineering-v0.1',
            release_json_name: 'system-modeling-engineering-v0.1.release.json',
            release_raw_sha256: 'b94417c7598982f144612496114d4c205dc797f622c556e931c64d26cb6974de',
          },
          {
            release_id: 'ctr:release:control-theory-integration-v0.1',
            controlled_path: 'course-content/authoring/knowledge/releases/control-theory-integration-v0.1',
            release_json_name: 'control-theory-integration-v0.1.release.json',
            release_raw_sha256: '8d3ea123c3a1b85b899d6687a097181c652c21e589d533ab48ea2eb92ec161c4',
          },
          {
            release_id: 'ctr:release:synthetic-extra-module-v0.1',
            controlled_path: syntheticPath,
            release_json_name: syntheticReleaseName,
            release_raw_sha256: '', // filled below after mutate reads manifest components
          },
        ];
      },
    });

    // Fill synthetic raw hash after finalize wrote the updated manifest components.
    const lockPath = path.join(fixture, LOCK_V3);
    const lock = JSON.parse(await readFile(lockPath, 'utf8')) as ReleaseSetLockV3;
    const finalManifest = await readManifest(fixture);
    const synthetic = finalManifest.components.find(
      (component) => component.release_id === 'ctr:release:synthetic-extra-module-v0.1',
    )!;
    const lockSynthetic = lock.components.find(
      (component) => component.release_id === 'ctr:release:synthetic-extra-module-v0.1',
    )!;
    if (lockSynthetic.reference_kind === 'standard_bundle') {
      throw new Error('expected legacy_exact lock component for synthetic module');
    }
    lockSynthetic.release_raw_sha256 = String(synthetic.release_raw_sha256);
    await writeJson(lockPath, lock);

    const validated = await loadAndValidatePublicBundleV1(fixtureLoadOptions(fixture));
    expect(validated.components).toHaveLength(4);
    expect(validated.statistics.componentCount).toBe(4);
    expect(
      validated.components.some((component) => component.releaseId === 'ctr:release:synthetic-extra-module-v0.1'),
    ).toBe(true);
    expect(validated.compatibility.code).toBe('COMPATIBLE_CONTENT_UPDATE');
    const admittedSynthetic = validated.components.find(
      (component) => component.releaseId === 'ctr:release:synthetic-extra-module-v0.1',
    )!;
    expect(admittedSynthetic.releaseVersion).toBe('synthetic-extra-module-v0.1');
    expect(admittedSynthetic.releaseHash).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('rejects component package content identity disagreement', async () => {
    const fixture = await fixtureRoot();
    await finalizeBundle(fixture, async (manifest, bundleDir) => {
      // Keep lists and raw hashes, but change declared release_hash so package content disagrees.
      const target = manifest.components.find(
        (component) => component.release_id === 'ctr:release:control-theory-integration-v0.1',
      )!;
      target.release_hash = 'c'.repeat(64);
      const componentArtifact = manifest.artifacts.find((item) => item.role === 'component_manifest')!;
      const componentManifest = JSON.parse(
        await readFile(path.join(bundleDir, String(componentArtifact.path)), 'utf8'),
      ) as { components: JsonObject[] };
      const fileComponent = componentManifest.components.find(
        (component) => component.release_id === 'ctr:release:control-theory-integration-v0.1',
      )!;
      fileComponent.release_hash = 'c'.repeat(64);
      await writeTrackedJson(manifest, bundleDir, String(componentArtifact.path), componentManifest);
      await syncValidationReport(manifest, bundleDir);
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(fixture)),
      'INTEGRITY_REJECTED',
      /component package release_hash disagrees|component identity mismatch/u,
    );
  });

  it('rejects component package with tampered content that keeps a stale semantic release_hash', async () => {
    // Negative: mutate component body, recompute/sync raw hashes through Manifest/lock/report,
    // but leave the declared semantic release_hash unchanged so canonical recompute drifts.
    const fixture = await fixtureRoot();
    const componentReleaseId = 'ctr:release:control-theory-integration-v0.1';
    const controlledPath = 'course-content/authoring/knowledge/releases/control-theory-integration-v0.1';
    const releaseJsonName = 'control-theory-integration-v0.1.release.json';
    let staleReleaseHash = '';

    await finalizeBundle(fixture, async (manifest) => {
      const packagePath = path.join(fixture, controlledPath, releaseJsonName);
      const packageRelease = JSON.parse(await readFile(packagePath, 'utf8')) as JsonObject;
      staleReleaseHash = String(packageRelease.release_hash);
      // Tamper content while preserving the stale semantic release_hash field.
      packageRelease.validation_report_uri = 'tampered://stale-semantic-hash';
      const packageBytes = await writeJson(packagePath, packageRelease);
      const newRawSha = sha256(packageBytes);

      const target = manifest.components.find(
        (component) => component.release_id === componentReleaseId,
      )!;
      target.release_raw_sha256 = newRawSha;
      // Intentionally keep target.release_hash === staleReleaseHash.

      const componentArtifact = manifest.artifacts.find((item) => item.role === 'component_manifest')!;
      const componentManifest = JSON.parse(
        await readFile(
          path.join(fixture, R2_PATH, String(componentArtifact.path)),
          'utf8',
        ),
      ) as { components: JsonObject[] };
      const fileComponent = componentManifest.components.find(
        (component) => component.release_id === componentReleaseId,
      )!;
      fileComponent.release_hash = staleReleaseHash;
      await writeTrackedJson(
        manifest,
        path.join(fixture, R2_PATH),
        String(componentArtifact.path),
        componentManifest,
      );
      await syncValidationReport(manifest, path.join(fixture, R2_PATH));
    }, {
      mutateLock: (lock) => {
        const locked = lock.components.find((component) => component.release_id === componentReleaseId)!;
        // Raw hash is filled from the updated manifest component after finalize writes it.
        void locked;
      },
    });

    // Keep lock raw hashes closed over the tampered package bytes.
    const lockPath = path.join(fixture, LOCK_V3);
    const lock = JSON.parse(await readFile(lockPath, 'utf8')) as ReleaseSetLockV3;
    const finalManifest = await readManifest(fixture);
    const target = finalManifest.components.find(
      (component) => component.release_id === componentReleaseId,
    )!;
    const locked = lock.components.find((component) => component.release_id === componentReleaseId)!;
    if (locked.reference_kind === 'standard_bundle') {
      throw new Error('expected legacy_exact lock component for integration package');
    }
    locked.release_raw_sha256 = String(target.release_raw_sha256);
    await writeJson(lockPath, lock);

    // Sanity: raw hash and declared semantic hash inventory remain self-consistent.
    expect(String(target.release_hash)).toBe(staleReleaseHash);
    expect(String(target.release_raw_sha256)).toMatch(/^[a-f0-9]{64}$/u);

    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(fixture)),
      'INTEGRITY_REJECTED',
      /component package canonical release_hash drift/u,
    );
  });

  it('rejects Validation Report artifact_validation that does not close over Manifest artifacts', async () => {
    const fixture = await fixtureRoot();
    await finalizeBundle(fixture, async (manifest, bundleDir) => {
      const reportArtifact = manifest.artifacts.find((item) => item.role === 'validation_report')!;
      const report = JSON.parse(
        await readFile(path.join(bundleDir, String(reportArtifact.path)), 'utf8'),
      ) as JsonObject;
      report.artifact_validation = (report.artifact_validation as JsonObject[]).slice(0, 1);
      await writeTrackedJson(manifest, bundleDir, String(reportArtifact.path), report);
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(fixture)),
      'INTEGRITY_REJECTED',
      /artifact_validation/u,
    );
  });

  it('rejects Validation Report top-level PASS when nested evidence checks are FAIL', async () => {
    const fixture = await fixtureRoot();
    await finalizeBundle(fixture, async (manifest, bundleDir) => {
      const reportArtifact = manifest.artifacts.find((item) => item.role === 'validation_report')!;
      const report = JSON.parse(
        await readFile(path.join(bundleDir, String(reportArtifact.path)), 'utf8'),
      ) as JsonObject;
      report.result = 'PASS';
      const gates = objectOrEmpty(report.gates);
      for (const key of Object.keys(gates)) gates[key] = 'PASS';
      report.gates = gates;
      // Keep inventory evidence PASS, but flip nested section evidence to FAIL.
      const projectionChecks = report.projection_validation as JsonObject[];
      projectionChecks[0]!.result = 'FAIL';
      const privacyChecks = report.privacy_validation as JsonObject[];
      privacyChecks[0]!.result = 'FAIL';
      const reproducibilityChecks = report.reproducibility_validation as JsonObject[];
      reproducibilityChecks[0]!.result = 'FAIL';
      await writeTrackedJson(manifest, bundleDir, String(reportArtifact.path), report);
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(fixture)),
      'INTEGRITY_REJECTED',
      /projection_validation check .* is FAIL while top-level result is PASS|privacy_validation check .* is FAIL while top-level result is PASS|reproducibility_validation check .* is FAIL while top-level result is PASS/u,
    );
  });

  it('rejects Validation Report artifact_validation and component_validation duplicates and FAIL rows', async () => {
    const passThenFail = await fixtureRoot();
    await finalizeBundle(passThenFail, async (manifest, bundleDir) => {
      const reportArtifact = manifest.artifacts.find((item) => item.role === 'validation_report')!;
      const report = JSON.parse(
        await readFile(path.join(bundleDir, String(reportArtifact.path)), 'utf8'),
      ) as JsonObject;
      const rows = report.artifact_validation as JsonObject[];
      const seed = structuredClone(rows[0]!) as JsonObject;
      seed.result = 'FAIL';
      report.artifact_validation = [...rows, seed];
      await writeTrackedJson(manifest, bundleDir, String(reportArtifact.path), report);
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(passThenFail)),
      'INTEGRITY_REJECTED',
      /artifact_validation repeats path|artifact_validation path .* is FAIL/u,
    );

    const passThenPass = await fixtureRoot();
    await finalizeBundle(passThenPass, async (manifest, bundleDir) => {
      const reportArtifact = manifest.artifacts.find((item) => item.role === 'validation_report')!;
      const report = JSON.parse(
        await readFile(path.join(bundleDir, String(reportArtifact.path)), 'utf8'),
      ) as JsonObject;
      const rows = report.artifact_validation as JsonObject[];
      report.artifact_validation = [...rows, structuredClone(rows[0]!)];
      await writeTrackedJson(manifest, bundleDir, String(reportArtifact.path), report);
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(passThenPass)),
      'INTEGRITY_REJECTED',
      /artifact_validation repeats path/u,
    );

    const componentDup = await fixtureRoot();
    await finalizeBundle(componentDup, async (manifest, bundleDir) => {
      const reportArtifact = manifest.artifacts.find((item) => item.role === 'validation_report')!;
      const report = JSON.parse(
        await readFile(path.join(bundleDir, String(reportArtifact.path)), 'utf8'),
      ) as JsonObject;
      const rows = report.component_validation as JsonObject[];
      const seed = structuredClone(rows[0]!) as JsonObject;
      seed.result = 'FAIL';
      report.component_validation = [...rows, seed];
      await writeTrackedJson(manifest, bundleDir, String(reportArtifact.path), report);
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(componentDup)),
      'INTEGRITY_REJECTED',
      /component_validation repeats release_id|component_validation release_id .* is FAIL/u,
    );
  });

  it('rejects Manifest projection profile labels that disagree with payload.projection_profile', async () => {
    const fixture = await fixtureRoot();
    await finalizeBundle(fixture, async (manifest, bundleDir) => {
      const runtime = manifest.artifacts.find(
        (item) => item.role === 'projection' && item.profile === 'runtime',
      )!;
      // Swap label only: payload remains act-v2, Manifest claims domain.
      runtime.profile = 'domain';
      await syncValidationReport(manifest, bundleDir);
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(fixture)),
      'INTEGRITY_REJECTED',
      /projection profile mismatch|duplicate projection profile/u,
    );
  });

  it('rejects Release/Projection schema_version that is not the registered Schema identity', async () => {
    const fixture = await fixtureRoot();
    await finalizeBundle(fixture, async (manifest, bundleDir) => {
      const releaseArtifact = manifest.artifacts.find((item) => item.role === 'release')!;
      const release = JSON.parse(
        await readFile(path.join(bundleDir, String(releaseArtifact.path)), 'utf8'),
      ) as JsonObject;
      release.schema_version = '0.9.9';
      release.release_hash = recomputeReleaseHash(release);
      await writeTrackedJson(manifest, bundleDir, String(releaseArtifact.path), release);

      const paths = projectionPaths(manifest);
      for (const profile of ['runtime', 'domain', 'review'] as const) {
        const projection = JSON.parse(
          await readFile(path.join(bundleDir, paths[profile]), 'utf8'),
        ) as JsonObject;
        projection.source_release_hash = release.release_hash;
        projection.version_digest = recomputeProjectionDigest(projection, profile);
        await writeTrackedJson(manifest, bundleDir, paths[profile], projection);
      }
      const metaArtifact = manifest.artifacts.find((item) => item.role === 'projection_link_metadata')!;
      const metaLines = (await readFile(path.join(bundleDir, String(metaArtifact.path)), 'utf8'))
        .split(/\r?\n/u)
        .filter(Boolean)
        .map((line) => {
          const row = JSON.parse(line) as JsonObject;
          row.source_release_hash = release.release_hash;
          return JSON.stringify(row);
        });
      await writeTrackedArtifact(
        manifest,
        bundleDir,
        String(metaArtifact.path),
        Buffer.from(`${metaLines.join('\n')}\n`, 'utf8'),
      );
      manifest.release = {
        ...manifest.release,
        release_hash: String(release.release_hash),
      };
      await syncValidationReport(manifest, bundleDir, {
        release: manifest.release,
      });
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(fixture)),
      'SCHEMA_REVIEW_REQUIRED',
      /schema_version 0\.9\.9 is not the registered Schema identity/u,
    );
  });

  it('rejects absolute filesystem path leaks beyond /Users and /home prefixes', async () => {
    const fixture = await fixtureRoot();
    await finalizeBundle(fixture, async (manifest, bundleDir) => {
      const notes = manifest.artifacts.find((artifact) => artifact.role === 'release_notes')!;
      const bytes = Buffer.from('notes with leak path /tmp/private/out/bundle.json\n', 'utf8');
      await writeFile(path.join(bundleDir, String(notes.path)), bytes);
      notes.sha256 = sha256(bytes);
      notes.byte_length = bytes.byteLength;
      await syncValidationReport(manifest, bundleDir);
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(fixture)),
      'INTEGRITY_REJECTED',
      /privacy|absolute-path|\/tmp\//u,
    );

    const windows = await fixtureRoot();
    await finalizeBundle(windows, async (manifest, bundleDir) => {
      const notes = manifest.artifacts.find((artifact) => artifact.role === 'release_notes')!;
      const bytes = Buffer.from('windows leak C:\\Users\\yw\\secret.txt\n', 'utf8');
      await writeFile(path.join(bundleDir, String(notes.path)), bytes);
      notes.sha256 = sha256(bytes);
      notes.byte_length = bytes.byteLength;
      await syncValidationReport(manifest, bundleDir);
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(windows)),
      'INTEGRITY_REJECTED',
      /privacy|absolute-path|C:/u,
    );
  });

  it('rejects when a required aggregate Artifact is deleted even after hash/file-set sync', async () => {
    const fixture = await fixtureRoot();
    await finalizeBundle(fixture, async (manifest, bundleDir) => {
      const notes = manifest.artifacts.find((item) => item.role === 'release_notes')!;
      await unlink(path.join(bundleDir, String(notes.path)));
      manifest.artifacts = manifest.artifacts.filter((item) => item.role !== 'release_notes');
      await syncValidationReport(manifest, bundleDir);
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(fixture)),
      'INTEGRITY_REJECTED',
      /required aggregate Artifact missing: release_notes@actkg-release-notes\/1/u,
    );
  });

  it('rejects when a core required aggregate Artifact declares required:false', async () => {
    const fixture = await fixtureRoot();
    await finalizeBundle(fixture, async (manifest, bundleDir) => {
      const release = manifest.artifacts.find((item) => item.role === 'release')!;
      release.required = false;
      await syncValidationReport(manifest, bundleDir);
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(fixture)),
      'INTEGRITY_REJECTED',
      /required aggregate Artifact must declare required:true: release@ctkg-release\/0\.2/u,
    );
  });

  it('rejects missing or duplicate Link Metadata coverage for preserved Projection profiles', async () => {
    const missingDomain = await fixtureRoot();
    await finalizeBundle(missingDomain, async (manifest, bundleDir) => {
      const shared = manifest.artifacts.find((item) => item.role === 'projection_link_metadata')!;
      const sharedPath = String(shared.path);
      const sharedBytes = await readFile(path.join(bundleDir, sharedPath));
      await unlink(path.join(bundleDir, sharedPath));
      manifest.artifacts = manifest.artifacts.filter((item) => item.role !== 'projection_link_metadata');
      for (const profile of ['runtime', 'review'] as const) {
        const pathName = `projection-link-metadata.${profile}.jsonl`;
        await writeFile(path.join(bundleDir, pathName), sharedBytes);
        manifest.artifacts.push({
          role: 'projection_link_metadata',
          contract_version: 'actkg-projection-link-metadata/1',
          required: true,
          path: pathName,
          media_type: 'application/x-ndjson',
          sha256: sha256(sharedBytes),
          byte_length: sharedBytes.byteLength,
          record_count: shared.record_count,
          profiles: [profile],
        });
      }
      await syncValidationReport(manifest, bundleDir);
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(missingDomain)),
      'INTEGRITY_REJECTED',
      /domain.*lacks link metadata coverage|required aggregate projection profile domain lacks link metadata coverage/u,
    );

    const duplicate = await fixtureRoot();
    await finalizeBundle(duplicate, async (manifest, bundleDir) => {
      const shared = manifest.artifacts.find((item) => item.role === 'projection_link_metadata')!;
      const sharedPath = String(shared.path);
      const sharedBytes = await readFile(path.join(bundleDir, sharedPath));
      // Keep the shared multi-profile metadata and add a second domain cover.
      const pathName = 'projection-link-metadata.domain-duplicate.jsonl';
      await writeFile(path.join(bundleDir, pathName), sharedBytes);
      manifest.artifacts.push({
        role: 'projection_link_metadata',
        contract_version: 'actkg-projection-link-metadata/1',
        required: true,
        path: pathName,
        media_type: 'application/x-ndjson',
        sha256: sha256(sharedBytes),
        byte_length: sharedBytes.byteLength,
        record_count: shared.record_count,
        profiles: ['domain'],
      });
      await syncValidationReport(manifest, bundleDir);
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(duplicate)),
      'INTEGRITY_REJECTED',
      /domain has duplicate link metadata coverage/u,
    );
  });

  it('rejects Validation Report source_revision that diverges from Manifest/Lock', async () => {
    const fixture = await fixtureRoot();
    await finalizeBundle(fixture, async (manifest, bundleDir) => {
      const reportArtifact = manifest.artifacts.find((item) => item.role === 'validation_report')!;
      const report = JSON.parse(
        await readFile(path.join(bundleDir, String(reportArtifact.path)), 'utf8'),
      ) as JsonObject;
      report.source_revision = {
        commit: 'f'.repeat(40),
        tag: 'mismatched-source-tag',
      };
      await writeTrackedJson(manifest, bundleDir, String(reportArtifact.path), report);
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(fixture)),
      'INTEGRITY_REJECTED',
      /Validation Report source_revision does not match Manifest\/Lock/u,
    );
  });

  it('accepts a legal standard_bundle component reference through the same adapter', async () => {
    const fixture = await fixtureRoot();
    const syntheticPath = 'course-content/authoring/knowledge/releases/synthetic-standard-bundle-v0.1';
    const releaseId = 'ctr:release:synthetic-standard-bundle-v0.1';
    const releaseVersion = 'synthetic-standard-bundle-v0.1';
    const bundleId = 'ctb:synthetic-standard-bundle-v0.1:r1';
    const written = await writeMinimalStandardBundleComponent({
      fixture,
      controlledPath: syntheticPath,
      releaseId,
      releaseVersion,
      bundleId,
    });
    const releaseHash = written.releaseHash;

    await finalizeBundle(fixture, async (manifest, bundleDir) => {
      const releaseArtifact = manifest.artifacts.find((item) => item.role === 'release')!;
      const componentArtifact = manifest.artifacts.find((item) => item.role === 'component_manifest')!;
      const release = JSON.parse(
        await readFile(path.join(bundleDir, String(releaseArtifact.path)), 'utf8'),
      ) as JsonObject;
      const componentIds = release.component_releases as string[];
      componentIds.push(releaseId);
      release.component_releases = componentIds;
      release.release_hash = recomputeReleaseHash(release);

      const paths = projectionPaths(manifest);
      for (const profile of ['runtime', 'domain', 'review'] as const) {
        const projection = JSON.parse(
          await readFile(path.join(bundleDir, paths[profile]), 'utf8'),
        ) as JsonObject;
        projection.source_release_hash = release.release_hash;

        projection.version_digest = recomputeProjectionDigest(projection, profile);

        await writeTrackedJson(manifest, bundleDir, paths[profile], projection);
      }

      const metaArtifact = manifest.artifacts.find((item) => item.role === 'projection_link_metadata')!;
      const metaLines = (await readFile(path.join(bundleDir, String(metaArtifact.path)), 'utf8'))
        .split(/\r?\n/u)
        .filter(Boolean)
        .map((line) => {
          const row = JSON.parse(line) as JsonObject;
          row.source_release_hash = release.release_hash;
          return JSON.stringify(row);
        });
      await writeTrackedArtifact(
        manifest,
        bundleDir,
        String(metaArtifact.path),
        Buffer.from(`${metaLines.join('\n')}\n`, 'utf8'),
      );
      await writeTrackedJson(manifest, bundleDir, String(releaseArtifact.path), release);

      const componentManifest = JSON.parse(
        await readFile(path.join(bundleDir, String(componentArtifact.path)), 'utf8'),
      ) as { components: JsonObject[] };
      componentManifest.components.push({
        component_role: 'module',
        release_hash: releaseHash,
        release_id: releaseId,
        release_version: releaseVersion,
      });
      await writeTrackedJson(manifest, bundleDir, String(componentArtifact.path), componentManifest);

      manifest.components.push({
        reference_kind: 'standard_bundle',
        release_id: releaseId,
        release_version: releaseVersion,
        release_hash: releaseHash,
        component_role: 'module',
        bundle_id: bundleId,
        bundle_digest: written.bundleDigest,
        manifest_sha256: written.manifestSha256,
      });
      manifest.release = {
        release_id: String(release.id),
        release_version: String(release.release_version),
        release_hash: String(release.release_hash),
        source_dataset_hash: String(release.source_dataset_hash),
      };
      manifest.statistics = {
        ...manifest.statistics,
        component_count: 4,
      };
      markContentBundleRevision(manifest, 'v0.4-standard-bundle-component');
      await syncValidationReport(manifest, bundleDir, {
        bundleId: String(manifest.bundle_id),
        release: manifest.release,
        statistics: manifest.statistics,
      });
    }, {
      mutateLock: (lock) => {
        lock.components = [
          ...lock.components,
          {
            reference_kind: 'standard_bundle',
            release_id: releaseId,
            controlled_path: syntheticPath,
            bundle_id: bundleId,
            bundle_digest: written.bundleDigest,
            manifest_raw_sha256: written.manifestSha256,
          },
        ];
      },
    });

    const validated = await loadAndValidatePublicBundleV1(fixtureLoadOptions(fixture));
    expect(validated.components).toHaveLength(4);
    const admitted = validated.components.find((component) => component.releaseId === releaseId)!;
    expect(admitted.referenceKind).toBe('standard_bundle');
    expect(admitted.bundleId).toBe(bundleId);
    expect(admitted.bundleDigest).toBe(written.bundleDigest);
    expect(admitted.manifestSha256).toBe(written.manifestSha256);
    expect(admitted.controlledPath).toBe(syntheticPath);
    expect(admitted.releaseJsonName).toBeUndefined();
    expect(validated.compatibility.code).toBe('COMPATIBLE_CONTENT_UPDATE');
  });

  it('rejects standard_bundle component identity tampering for bundle_id, digest, and manifest hash', async () => {
    const cases: Array<{
      label: string;
      mutate: (component: JsonObject, written: { bundleDigest: string; manifestSha256: string }) => void;
      pattern: RegExp;
    }> = [
      {
        label: 'bundle_id',
        mutate: (component) => {
          component.bundle_id = 'ctb:tampered-standard-bundle:r1';
        },
        pattern: /bundle_id does not match the lock|Manifest bundle_id disagrees/u,
      },
      {
        label: 'bundle_digest',
        mutate: (component) => {
          component.bundle_digest = '1'.repeat(64);
        },
        pattern: /bundle_digest does not match the lock|bundle_digest disagrees/u,
      },
      {
        label: 'manifest_sha256',
        mutate: (component) => {
          component.manifest_sha256 = '2'.repeat(64);
        },
        pattern: /manifest_sha256 does not match the lock|Manifest raw hash mismatch/u,
      },
    ];

    for (const testCase of cases) {
      const fixture = await fixtureRoot();
      const syntheticPath = 'course-content/authoring/knowledge/releases/synthetic-standard-bundle-v0.1';
      const releaseId = 'ctr:release:synthetic-standard-bundle-v0.1';
      const releaseVersion = 'synthetic-standard-bundle-v0.1';
      const bundleId = 'ctb:synthetic-standard-bundle-v0.1:r1';
      const written = await writeMinimalStandardBundleComponent({
        fixture,
        controlledPath: syntheticPath,
        releaseId,
        releaseVersion,
        bundleId,
      });
      const releaseHash = written.releaseHash;

      await finalizeBundle(fixture, async (manifest, bundleDir) => {
        const releaseArtifact = manifest.artifacts.find((item) => item.role === 'release')!;
        const componentArtifact = manifest.artifacts.find((item) => item.role === 'component_manifest')!;
        const release = JSON.parse(
          await readFile(path.join(bundleDir, String(releaseArtifact.path)), 'utf8'),
        ) as JsonObject;
        (release.component_releases as string[]).push(releaseId);
        release.release_hash = recomputeReleaseHash(release);

        const paths = projectionPaths(manifest);
        for (const profile of ['runtime', 'domain', 'review'] as const) {
          const projection = JSON.parse(
            await readFile(path.join(bundleDir, paths[profile]), 'utf8'),
          ) as JsonObject;
          projection.source_release_hash = release.release_hash;

          projection.version_digest = recomputeProjectionDigest(projection, profile);

          await writeTrackedJson(manifest, bundleDir, paths[profile], projection);
        }
        const metaArtifact = manifest.artifacts.find((item) => item.role === 'projection_link_metadata')!;
        const metaLines = (await readFile(path.join(bundleDir, String(metaArtifact.path)), 'utf8'))
          .split(/\r?\n/u)
          .filter(Boolean)
          .map((line) => {
            const row = JSON.parse(line) as JsonObject;
            row.source_release_hash = release.release_hash;
            return JSON.stringify(row);
          });
        await writeTrackedArtifact(
          manifest,
          bundleDir,
          String(metaArtifact.path),
          Buffer.from(`${metaLines.join('\n')}\n`, 'utf8'),
        );
        await writeTrackedJson(manifest, bundleDir, String(releaseArtifact.path), release);

        const componentManifest = JSON.parse(
          await readFile(path.join(bundleDir, String(componentArtifact.path)), 'utf8'),
        ) as { components: JsonObject[] };
        componentManifest.components.push({
          component_role: 'module',
          release_hash: releaseHash,
          release_id: releaseId,
          release_version: releaseVersion,
        });
        await writeTrackedJson(manifest, bundleDir, String(componentArtifact.path), componentManifest);

        const componentRef: JsonObject = {
          reference_kind: 'standard_bundle',
          release_id: releaseId,
          release_version: releaseVersion,
          release_hash: releaseHash,
          component_role: 'module',
          bundle_id: bundleId,
          bundle_digest: written.bundleDigest,
          manifest_sha256: written.manifestSha256,
        };
        testCase.mutate(componentRef, written);
        manifest.components.push(componentRef);
        manifest.release = {
          release_id: String(release.id),
          release_version: String(release.release_version),
          release_hash: String(release.release_hash),
          source_dataset_hash: String(release.source_dataset_hash),
        };
        manifest.statistics = {
          ...manifest.statistics,
          component_count: 4,
        };
        markContentBundleRevision(manifest, `v0.4-std-tamper-${testCase.label}`);
        await syncValidationReport(manifest, bundleDir, {
          bundleId: String(manifest.bundle_id),
          release: manifest.release,
          statistics: manifest.statistics,
        });
      }, {
        mutateLock: (lock) => {
          // Lock keeps honest standard_bundle identities; Manifest is tampered.
          lock.components = [
            ...lock.components,
            {
              reference_kind: 'standard_bundle',
              release_id: releaseId,
              controlled_path: syntheticPath,
              bundle_id: bundleId,
              bundle_digest: written.bundleDigest,
              manifest_raw_sha256: written.manifestSha256,
            },
          ];
        },
      });

      await expectRejection(
        () => loadAndValidatePublicBundleV1(fixtureLoadOptions(fixture)),
        'INTEGRITY_REJECTED',
        testCase.pattern,
      );
    }
  });

  it('rejects standard_bundle release payload that disagrees with declared release_hash or role closure', async () => {
    async function admitWithComponent(
      writeOptions: Parameters<typeof writeMinimalStandardBundleComponent>[0] extends infer T
        ? Omit<T, 'fixture' | 'controlledPath' | 'releaseId' | 'releaseVersion' | 'bundleId'>
        : never,
    ): Promise<string> {
      const fixture = await fixtureRoot();
      const syntheticPath = 'course-content/authoring/knowledge/releases/synthetic-standard-bundle-v0.1';
      const releaseId = 'ctr:release:synthetic-standard-bundle-v0.1';
      const releaseVersion = 'synthetic-standard-bundle-v0.1';
      const bundleId = 'ctb:synthetic-standard-bundle-v0.1:r1';
      const written = await writeMinimalStandardBundleComponent({
        fixture,
        controlledPath: syntheticPath,
        releaseId,
        releaseVersion,
        bundleId,
        ...writeOptions,
      });
      const releaseHash = written.releaseHash;

      await finalizeBundle(fixture, async (manifest, bundleDir) => {
        const releaseArtifact = manifest.artifacts.find((item) => item.role === 'release')!;
        const componentArtifact = manifest.artifacts.find((item) => item.role === 'component_manifest')!;
        const release = JSON.parse(
          await readFile(path.join(bundleDir, String(releaseArtifact.path)), 'utf8'),
        ) as JsonObject;
        (release.component_releases as string[]).push(releaseId);
        release.release_hash = recomputeReleaseHash(release);

        const paths = projectionPaths(manifest);
        for (const profile of ['runtime', 'domain', 'review'] as const) {
          const projection = JSON.parse(
            await readFile(path.join(bundleDir, paths[profile]), 'utf8'),
          ) as JsonObject;
          projection.source_release_hash = release.release_hash;
          projection.version_digest = recomputeProjectionDigest(projection, profile);
          await writeTrackedJson(manifest, bundleDir, paths[profile], projection);
        }

        const metaArtifact = manifest.artifacts.find((item) => item.role === 'projection_link_metadata')!;
        const metaLines = (await readFile(path.join(bundleDir, String(metaArtifact.path)), 'utf8'))
          .split(/\r?\n/u)
          .filter(Boolean)
          .map((line) => {
            const row = JSON.parse(line) as JsonObject;
            row.source_release_hash = release.release_hash;
            return JSON.stringify(row);
          });
        await writeTrackedArtifact(
          manifest,
          bundleDir,
          String(metaArtifact.path),
          Buffer.from(`${metaLines.join('\n')}\n`, 'utf8'),
        );
        await writeTrackedJson(manifest, bundleDir, String(releaseArtifact.path), release);

        const componentManifest = JSON.parse(
          await readFile(path.join(bundleDir, String(componentArtifact.path)), 'utf8'),
        ) as { components: JsonObject[] };
        componentManifest.components.push({
          component_role: 'module',
          release_hash: releaseHash,
          release_id: releaseId,
          release_version: releaseVersion,
        });
        await writeTrackedJson(manifest, bundleDir, String(componentArtifact.path), componentManifest);

        manifest.components.push({
          reference_kind: 'standard_bundle',
          release_id: releaseId,
          release_version: releaseVersion,
          release_hash: releaseHash,
          component_role: 'module',
          bundle_id: bundleId,
          bundle_digest: written.bundleDigest,
          manifest_sha256: written.manifestSha256,
        });
        manifest.release = {
          release_id: String(release.id),
          release_version: String(release.release_version),
          release_hash: String(release.release_hash),
          source_dataset_hash: String(release.source_dataset_hash),
        };
        manifest.statistics = {
          ...manifest.statistics,
          component_count: 4,
        };
        markContentBundleRevision(manifest, 'v0.4-standard-bundle-release-bind');
        await syncValidationReport(manifest, bundleDir, {
          bundleId: String(manifest.bundle_id),
          release: manifest.release,
          statistics: manifest.statistics,
        });
      }, {
        mutateLock: (lock) => {
          lock.components = [
            ...lock.components,
            {
              reference_kind: 'standard_bundle',
              release_id: releaseId,
              controlled_path: syntheticPath,
              bundle_id: bundleId,
              bundle_digest: written.bundleDigest,
              manifest_raw_sha256: written.manifestSha256,
            },
          ];
        },
      });
      return fixture;
    }

    // Stale release_hash left on payload after mutating sealed content.
    const stale = await admitWithComponent({
      mutateReleaseAfterSeal: (release) => {
        release.entries = [{ entity: 'ctc:stale', release_tier: 'core' }];
        // Intentionally leave release_hash as the pre-mutation self-hash.
      },
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(stale)),
      'INTEGRITY_REJECTED',
      /release_hash does not match payload self-hash|release Artifact/u,
    );

    // Wrong release identity in payload.
    const wrongId = await admitWithComponent({
      mutateReleaseAfterSeal: (release) => {
        release.id = 'ctr:release:someone-else';
        release.release_hash = computeCanonicalReleaseHash(release);
      },
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(wrongId)),
      'INTEGRITY_REJECTED',
      /release Artifact id disagrees|release_hash disagrees/u,
    );

    const missingRelease = await admitWithComponent({ omitReleaseArtifact: true });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(missingRelease)),
      'INTEGRITY_REJECTED',
      /exactly one role=release Artifact/u,
    );

    const duplicateRelease = await admitWithComponent({ duplicateReleaseArtifact: true });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(duplicateRelease)),
      'INTEGRITY_REJECTED',
      /exactly one role=release Artifact/u,
    );
  });

  it('rejects projections whose version_digest is stale after nodes/links/hidden_entities change', async () => {
    const fixture = await fixtureRoot();
    await finalizeBundle(fixture, async (manifest, bundleDir) => {
      const paths = projectionPaths(manifest);
      const runtime = JSON.parse(await readFile(path.join(bundleDir, paths.runtime), 'utf8')) as JsonObject;
      const nodes = runtime.nodes as JsonObject[];
      // Mutate projected graph payload while keeping the declared digest stale.
      nodes[0] = { ...nodes[0]!, display_name: `${String(nodes[0]!.display_name)}-tampered` };
      runtime.nodes = nodes;
      // Do not recompute version_digest.
      await writeTrackedJson(manifest, bundleDir, paths.runtime, runtime);
      await syncValidationReport(manifest, bundleDir);
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(fixture)),
      'INTEGRITY_REJECTED',
      /version_digest mismatch/u,
    );

    const hidden = await fixtureRoot();
    await finalizeBundle(hidden, async (manifest, bundleDir) => {
      const paths = projectionPaths(manifest);
      const domain = JSON.parse(await readFile(path.join(bundleDir, paths.domain), 'utf8')) as JsonObject;
      // Schema-valid HiddenEntityRecord (entity_id + reason); keep stale version_digest.
      const seedNode = (domain.nodes as JsonObject[])[0]!;
      domain.hidden_entities = [
        {
          entity_id: String(seedNode.entity_id ?? seedNode.id),
          reason: 'profile-omitted-for-digest-staleness-test',
        },
      ];
      await writeTrackedJson(manifest, bundleDir, paths.domain, domain);
      await syncValidationReport(manifest, bundleDir);
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(hidden)),
      'INTEGRITY_REJECTED',
      /version_digest mismatch/u,
    );

    const links = await fixtureRoot();
    await finalizeBundle(links, async (manifest, bundleDir) => {
      const paths = projectionPaths(manifest);
      const review = JSON.parse(await readFile(path.join(bundleDir, paths.review), 'utf8')) as JsonObject;
      // Schema-valid link mutation: change a non-identity evidence field, keep stale digest.
      const reviewLinks = review.links as JsonObject[];
      reviewLinks[0] = {
        ...reviewLinks[0]!,
        evidence_state: reviewLinks[0]!.evidence_state === 'available' ? 'unavailable' : 'available',
      };
      review.links = reviewLinks;
      await writeTrackedJson(manifest, bundleDir, paths.review, review);
      await syncValidationReport(manifest, bundleDir);
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(links)),
      'INTEGRITY_REJECTED',
      /version_digest mismatch/u,
    );
  });

  it('accepts distinct Projection membership sets with profile-specific metadata', async () => {
    const fixture = await fixtureRoot();
    await finalizeBundle(fixture, async (manifest, bundleDir) => {
      const paths = projectionPaths(manifest);
      const metaArtifact = manifest.artifacts.find((item) => item.role === 'projection_link_metadata')!;
      const sharedPath = String(metaArtifact.path);
      const sharedLines = (await readFile(path.join(bundleDir, sharedPath), 'utf8'))
        .split(/\r?\n/u)
        .filter(Boolean);
      const removedRelationId = String(JSON.parse(sharedLines[sharedLines.length - 1]!).relation_id);

      const domain = JSON.parse(await readFile(path.join(bundleDir, paths.domain), 'utf8')) as JsonObject;
      domain.links = (domain.links as JsonObject[]).filter(
        (link) => link.relation_id !== removedRelationId,
      );
      domain.version_digest = recomputeProjectionDigest(domain, 'domain');
      await writeTrackedJson(manifest, bundleDir, paths.domain, domain);

      await (await import('node:fs/promises')).unlink(path.join(bundleDir, sharedPath));
      manifest.artifacts = manifest.artifacts.filter((item) => item.role !== 'projection_link_metadata');

      for (const profile of ['runtime', 'domain', 'review'] as const) {
        const lines = profile === 'domain'
          ? sharedLines.filter((line) => JSON.parse(line).relation_id !== removedRelationId)
          : sharedLines;
        const pathName = `projection-link-metadata.${profile}.jsonl`;
        const bytes = Buffer.from(`${lines.join('\n')}\n`, 'utf8');
        await writeFile(path.join(bundleDir, pathName), bytes);
        manifest.artifacts.push({
          role: 'projection_link_metadata',
          contract_version: 'actkg-projection-link-metadata/1',
          required: true,
          path: pathName,
          media_type: 'application/x-ndjson',
          sha256: sha256(bytes),
          byte_length: bytes.byteLength,
          record_count: lines.length,
          profiles: [profile],
        });
      }

      markContentBundleRevision(manifest, 'v0.4-distinct-projections');
      await syncValidationReport(manifest, bundleDir, {
        bundleId: String(manifest.bundle_id),
      });
    });

    const validated = await loadAndValidatePublicBundleV1(fixtureLoadOptions(fixture));
    const byProfile = Object.fromEntries(
      validated.preservedProjections.map((item) => [item.identity.profile, item.identity.linkCount]),
    );
    expect(byProfile.runtime).toBe(130);
    expect(byProfile.review).toBe(130);
    expect(byProfile.domain).toBe(129);
    expect(validated.allLinkMetadata).toHaveLength(3);
    expect(validated.runtimeLinkMetadata).toHaveLength(130);
    expect(validated.statistics.projectionLinks).toBe(130);
    expect(validated.compatibility.code).toBe('COMPATIBLE_CONTENT_UPDATE');
  });

  it('accepts a future-compatible content package with different dynamic counts through the same adapter', async () => {
    const fixture = await fixtureRoot();
    let expectedCrosswalk = 0;
    await finalizeBundle(fixture, async (manifest, bundleDir) => {
      // Content-compatible revision: drop one crosswalk row and recompute stats/hashes.
      const artifact = manifest.artifacts.find((item) => item.role === 'rag_crosswalk')!;
      const filePath = path.join(bundleDir, String(artifact.path));
      const lines = (await readFile(filePath, 'utf8')).split('\n').filter(Boolean);
      lines.pop();
      expectedCrosswalk = lines.length;
      const bytes = Buffer.from(`${lines.join('\n')}\n`, 'utf8');
      await writeFile(filePath, bytes);
      artifact.sha256 = sha256(bytes);
      artifact.byte_length = bytes.byteLength;
      artifact.record_count = expectedCrosswalk;
      manifest.statistics.rag_crosswalk_rows = expectedCrosswalk;
      markContentBundleRevision(manifest, 'v0.4');
      await syncValidationReport(manifest, bundleDir, {
        bundleId: String(manifest.bundle_id),
        statistics: manifest.statistics,
      });
    });

    const validated = await loadAndValidatePublicBundleV1(fixtureLoadOptions(fixture));
    expect(validated.statistics.ragCrosswalkRows).toBe(expectedCrosswalk);
    expect(validated.statistics.ragCrosswalkRows).not.toBe(1361);
    expect(validated.compatibility.code).toBe('COMPATIBLE_CONTENT_UPDATE');
    expect(validated.bundleIdentity.bundleId).toBe('ctb:control-theory-engineering-v0.4:r1');
  });

  it('preserves three projection identities even when their current records are equal and selects only runtime', async () => {
    const validated = await loadAndValidatePublicBundleV1(rootLoadOptions());
    const digests = validated.preservedProjections.map((item) => item.identity.versionDigest);
    expect(new Set(digests).size).toBe(validated.preservedProjections.length);
    expect(validated.selectedRuntimeProjection.identity.profile).toBe('runtime');
    expect(validated.preservedProjections).toHaveLength(3);
  });

  it('classifies the r2 packaging revision as COMPATIBLE_PACKAGING_REVISION for the same semantic Release', async () => {
    const validated = await loadAndValidatePublicBundleV1(rootLoadOptions());
    expect(validated.compatibility.code).toBe('COMPATIBLE_PACKAGING_REVISION');
    expect(validated.releaseIdentity.releaseId).toBe(REVIEWED_V0_3_R2_IDENTITIES.releaseId);
    expect(validated.bundleIdentity.bundleRevision).toBe(2);
  });

  it('accepts profile-specific link metadata files that each close one-to-one over their projection', async () => {
    const fixture = await fixtureRoot();
    await finalizeBundle(fixture, async (manifest, bundleDir) => {
      const shared = manifest.artifacts.find((artifact) => artifact.role === 'projection_link_metadata')!;
      const sharedPath = String(shared.path);
      const sharedBytes = await readFile(path.join(bundleDir, sharedPath));
      await (await import('node:fs/promises')).unlink(path.join(bundleDir, sharedPath));
      manifest.artifacts = manifest.artifacts.filter((artifact) => artifact.role !== 'projection_link_metadata');
      for (const profile of ['runtime', 'domain', 'review'] as const) {
        const pathName = `projection-link-metadata.${profile}.jsonl`;
        await writeFile(path.join(bundleDir, pathName), sharedBytes);
        manifest.artifacts.push({
          role: 'projection_link_metadata',
          contract_version: 'actkg-projection-link-metadata/1',
          required: true,
          path: pathName,
          media_type: 'application/x-ndjson',
          sha256: sha256(sharedBytes),
          byte_length: sharedBytes.byteLength,
          record_count: shared.record_count,
          profiles: [profile],
        });
      }
      await syncValidationReport(manifest, bundleDir);
    });
    const validated = await loadAndValidatePublicBundleV1(fixtureLoadOptions(fixture));
    expect(validated.allLinkMetadata).toHaveLength(3);
    expect(validated.runtimeLinkMetadata).toHaveLength(130);
    expect(validated.compatibility.code).toBe('COMPATIBLE_PACKAGING_REVISION');
  });

  it('emits one deterministic ValidatedActKGBundle without selector or database coupling', async () => {
    const first = await loadAndValidatePublicBundleV1(rootLoadOptions());
    const second = await loadAndValidatePublicBundleV1(rootLoadOptions());
    expect(first.captureRevision).toBe(second.captureRevision);
    expect(first.bundleIdentity).toEqual(second.bundleIdentity);
    expect(first.releaseIdentity).toEqual(second.releaseIdentity);
    expect(first.statistics).toEqual(second.statistics);
    expect(first.compatibility.code).toEqual(second.compatibility.code);
    expect(first.rawArtifacts.map((item) => item.descriptor.sha256)).toEqual(
      second.rawArtifacts.map((item) => item.descriptor.sha256),
    );
    // Explicit non-coupling markers
    expect('db' in first).toBe(false);
    expect(Object.keys(first)).not.toContain('selector');
  });

  it('public loader and router reject untrusted capture revisions via real Git only', async () => {
    // Invalid format is rejected before cleanliness (always runnable).
    await expectRejection(
      () => loadAndValidatePublicBundleV1({
        root,
        captureRevision: 'not-a-git-revision',
      }),
      'INTEGRITY_REJECTED',
      /invalid/u,
    );
    await expectRejection(
      () => routeAndValidatePublicBundle({
        root,
        controlledPath: V02_PATH,
        captureRevision: 'not-a-git-revision',
      }),
      'INTEGRITY_REJECTED',
      /invalid/u,
    );

    // Fabricated 40-hex never authorizes admission:
    // - dirty protected tree → clean check fails first
    // - clean tree → equality against real HEAD fails
    // Either way the public API fail-closes before trusting the SHA.
    await expectRejection(
      () => loadAndValidatePublicBundleV1({
        root,
        captureRevision: 'a'.repeat(40),
      }),
      'INTEGRITY_REJECTED',
      /clean protected Git inputs|expected captureRevision must equal the current Git HEAD/u,
    );
    await expectRejection(
      () => routeAndValidatePublicBundle({
        root,
        controlledPath: V02_PATH,
        captureRevision: 'a'.repeat(40),
      }),
      'INTEGRITY_REJECTED',
      /clean protected Git inputs|expected captureRevision must equal the current Git HEAD/u,
    );
  });

  it('public validation APIs do not expose a captureGit runner injection seam', async () => {
    const v1Source = await readFile(
      path.join(root, 'scripts/actkg-release/public-bundle-v1.ts'),
      'utf8',
    );
    const routerSource = await readFile(
      path.join(root, 'scripts/actkg-release/public-bundle-router.ts'),
      'utf8',
    );
    const captureSource = await readFile(
      path.join(root, 'scripts/actkg-release/capture-revision.ts'),
      'utf8',
    );
    expect(v1Source).not.toMatch(/captureGit/u);
    expect(v1Source).not.toMatch(/CaptureGitRunner/u);
    expect(routerSource).not.toMatch(/captureGit/u);
    expect(routerSource).not.toMatch(/CaptureGitRunner/u);
    // Public resolve API must not accept a runner option either.
    expect(captureSource).toMatch(/export function resolveTrustedCaptureRevision/u);
    expect(captureSource).not.toMatch(/git\?:/u);
    expect(captureSource).not.toMatch(/export (type|interface) CaptureGitRunner/u);
  });

  it('rejects Unicode-escaped private field names after JSON decode', async () => {
    const fixture = await fixtureRoot();
    await finalizeBundle(fixture, async (manifest, bundleDir) => {
      // Key is raw_text after JSON.parse, but not the literal "raw_text" in UTF-8 text.
      const payload = `{"\\u0072aw_text":"secret-source"}\n`;
      const bytes = Buffer.from(payload, 'utf8');
      expect(bytes.toString('utf8')).not.toContain('"raw_text"');
      await writeFile(path.join(bundleDir, 'future-optional.json'), bytes);
      manifest.artifacts.push({
        role: 'future_analytics',
        contract_version: 'actkg-future-analytics/1',
        required: false,
        path: 'future-optional.json',
        media_type: 'application/json',
        sha256: sha256(bytes),
        byte_length: bytes.byteLength,
        record_count: null,
      });
      await syncValidationReport(manifest, bundleDir);
    });
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(fixture)),
      'INTEGRITY_REJECTED',
      /privacy|raw_text/u,
    );
  });

  it('counts NDJSON records by verified media_type, not filename suffix', async () => {
    const fixture = await fixtureRoot();
    await finalizeBundle(fixture, async (manifest, bundleDir) => {
      const crosswalk = manifest.artifacts.find((artifact) => artifact.role === 'rag_crosswalk')!;
      const oldPath = String(crosswalk.path);
      const newPath = 'artifacts/crosswalk.ndjson';
      await mkdir(path.join(bundleDir, 'artifacts'), { recursive: true });
      await cp(path.join(bundleDir, oldPath), path.join(bundleDir, ...newPath.split('/')));
      await unlink(path.join(bundleDir, oldPath));
      const bytes = await readFile(path.join(bundleDir, ...newPath.split('/')));
      crosswalk.path = newPath;
      crosswalk.media_type = 'application/x-ndjson';
      crosswalk.sha256 = sha256(bytes);
      crosswalk.byte_length = bytes.byteLength;
      crosswalk.record_count = bytes.toString('utf8').split(/\r?\n/u).filter((line) => line.length > 0).length;
      await syncValidationReport(manifest, bundleDir);
    });
    const validated = await loadAndValidatePublicBundleV1(fixtureLoadOptions(fixture));
    const artifact = validated.rawArtifacts.find((item) => item.descriptor.role === 'rag_crosswalk')!;
    expect(artifact.descriptor.path).toBe('artifacts/crosswalk.ndjson');
    expect(artifact.descriptor.mediaType).toBe('application/x-ndjson');
    expect(artifact.descriptor.recordCount).toBe(validated.statistics.ragCrosswalkRows);
  });

  it('rejects standard_bundle component packages that fail public package boundary closure', async () => {
    const buildSynthetic = async () => {
      const fixture = await fixtureRoot();
      const syntheticPath = 'course-content/authoring/knowledge/releases/synthetic-standard-bundle-v0.1';
      const releaseId = 'ctr:release:synthetic-standard-bundle-v0.1';
      const releaseVersion = 'synthetic-standard-bundle-v0.1';
      const bundleId = 'ctb:synthetic-standard-bundle-v0.1:r1';
      const written = await writeMinimalStandardBundleComponent({
        fixture,
        controlledPath: syntheticPath,
        releaseId,
        releaseVersion,
        bundleId,
      });
      const releaseHash = written.releaseHash;
      await finalizeBundle(fixture, async (manifest, bundleDir) => {
        const releaseArtifact = manifest.artifacts.find((item) => item.role === 'release')!;
        const componentArtifact = manifest.artifacts.find((item) => item.role === 'component_manifest')!;
        const release = JSON.parse(
          await readFile(path.join(bundleDir, String(releaseArtifact.path)), 'utf8'),
        ) as JsonObject;
        const componentIds = release.component_releases as string[];
        componentIds.push(releaseId);
        release.component_releases = componentIds;
        release.release_hash = recomputeReleaseHash(release);

        const paths = projectionPaths(manifest);
        for (const profile of ['runtime', 'domain', 'review'] as const) {
          const projection = JSON.parse(
            await readFile(path.join(bundleDir, paths[profile]), 'utf8'),
          ) as JsonObject;
          projection.source_release_hash = release.release_hash;

          projection.version_digest = recomputeProjectionDigest(projection, profile);

          await writeTrackedJson(manifest, bundleDir, paths[profile], projection);
        }

        const metaArtifact = manifest.artifacts.find((item) => item.role === 'projection_link_metadata')!;
        const metaLines = (await readFile(path.join(bundleDir, String(metaArtifact.path)), 'utf8'))
          .split(/\r?\n/u)
          .filter(Boolean)
          .map((line) => {
            const row = JSON.parse(line) as JsonObject;
            row.source_release_hash = release.release_hash;
            return JSON.stringify(row);
          });
        await writeTrackedArtifact(
          manifest,
          bundleDir,
          String(metaArtifact.path),
          Buffer.from(`${metaLines.join('\n')}\n`, 'utf8'),
        );
        await writeTrackedJson(manifest, bundleDir, String(releaseArtifact.path), release);

        const componentManifest = JSON.parse(
          await readFile(path.join(bundleDir, String(componentArtifact.path)), 'utf8'),
        ) as { components: JsonObject[] };
        componentManifest.components.push({
          component_role: 'module',
          release_hash: releaseHash,
          release_id: releaseId,
          release_version: releaseVersion,
        });
        await writeTrackedJson(manifest, bundleDir, String(componentArtifact.path), componentManifest);

        manifest.components.push({
          reference_kind: 'standard_bundle',
          release_id: releaseId,
          release_version: releaseVersion,
          release_hash: releaseHash,
          component_role: 'module',
          bundle_id: bundleId,
          bundle_digest: written.bundleDigest,
          manifest_sha256: written.manifestSha256,
        });
        manifest.release = {
          release_id: String(release.id),
          release_version: String(release.release_version),
          release_hash: String(release.release_hash),
          source_dataset_hash: String(release.source_dataset_hash),
        };
        manifest.statistics = {
          ...manifest.statistics,
          component_count: 4,
        };
        markContentBundleRevision(manifest, 'v0.4-standard-bundle-boundary');
        await syncValidationReport(manifest, bundleDir, {
          bundleId: String(manifest.bundle_id),
          release: manifest.release,
          statistics: manifest.statistics,
        });
      }, {
        mutateLock: (lock) => {
          lock.components = [
            ...lock.components,
            {
              reference_kind: 'standard_bundle',
              release_id: releaseId,
              controlled_path: syntheticPath,
              bundle_id: bundleId,
              bundle_digest: written.bundleDigest,
              manifest_raw_sha256: written.manifestSha256,
            },
          ];
        },
      });
      return { fixture, syntheticPath, releaseId };
    };

    const extraFile = await buildSynthetic();
    await writeFile(
      path.join(extraFile.fixture, extraFile.syntheticPath, 'undeclared-component.bin'),
      'x',
    );
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(extraFile.fixture)),
      'INTEGRITY_REJECTED',
      /standard_bundle component|file set/u,
    );

    const missingSums = await buildSynthetic();
    await unlink(path.join(missingSums.fixture, missingSums.syntheticPath, 'SHA256SUMS'));
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(missingSums.fixture)),
      'INTEGRITY_REJECTED',
      /standard_bundle component|SHA256SUMS|file set/u,
    );

    const rootLink = await buildSynthetic();
    const controlledAbs = path.join(rootLink.fixture, rootLink.syntheticPath);
    const aliasAbs = path.join(
      rootLink.fixture,
      'course-content/authoring/knowledge/releases/synthetic-standard-bundle-alias',
    );
    await cp(controlledAbs, aliasAbs, { recursive: true });
    await rm(controlledAbs, { recursive: true, force: true });
    await symlink(aliasAbs, controlledAbs);
    await expectRejection(
      () => loadAndValidatePublicBundleV1(fixtureLoadOptions(rootLink.fixture)),
      'INTEGRITY_REJECTED',
      /symbolic link/u,
    );
  });

  it('retains opaque retrieval/citation identifiers without treating them as closure failures', async () => {
    const validated = await loadAndValidatePublicBundleV1(rootLoadOptions());
    expect(validated.crosswalk[0]!.retrievalChunkId).toMatch(/^ctr:/u);
    expect(validated.crosswalk[0]!.citationTargetId).toMatch(/^ctr:/u);
    // no attempt is made to resolve these inside the bundle; presence alone is sufficient
    expect(validated.crosswalk.every((row) => row.retrievalChunkId && row.citationTargetId)).toBe(true);
  });
});

function caseFoldPathCollision(left: string, right: string): boolean {
  return left.normalize('NFKC').toLocaleLowerCase('en-US') === right.normalize('NFKC').toLocaleLowerCase('en-US');
}
