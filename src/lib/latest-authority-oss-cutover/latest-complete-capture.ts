/**
 * Execution-time latest-complete Authority capture helpers.
 *
 * These inspect a sealed ActKG checkout and a public-bundle directory. They
 * never hardcode a bundle revision. Incomplete component closure, a dirty
 * worktree, or an adapter-incompatible public contract fail closed.
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  AUTHORITY_COMPONENT_KINDS,
  LatestAuthorityCutoverError,
  type AuthorityComponentIdentity,
  type CapturedPublicContract,
  type SupportedPublicContract,
} from './contracts';

export interface BundleComponentSource {
  readonly bundleDir: string;
  readonly lineagePath: string;
  readonly registrySummaryPath: string;
}

function sha256Bytes(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
}

export interface SealedBundleIdentity {
  readonly bundleDir: string;
  readonly bundleId: string;
  readonly bundleDigest: string;
  readonly bundleRevision: number;
  readonly sourceCommit: string;
  readonly sourceTag: string;
  readonly releaseId: string;
  readonly releaseVersion: string;
  readonly schemaVersion: string;
  readonly schemaSha256: string;
  readonly manifestSha256: string;
  readonly sha256sumsSha256: string;
  readonly validationReportSha256: string;
  readonly predecessorBundleId: string | null;
  readonly stableTag: string;
}

export function readSealedBundleIdentity(bundleDir: string): SealedBundleIdentity {
  const manifestPath = path.join(bundleDir, 'bundle-manifest.json');
  const manifestBytes = readFileSync(manifestPath);
  const manifest = requireObject(JSON.parse(manifestBytes.toString('utf8')), 'bundle-manifest');
  if (manifest.bundle_kind !== 'aggregate' || manifest.release_stage !== 'stable') {
    throw new LatestAuthorityCutoverError(
      'capture-bundle-invalid',
      `${bundleDir} is not a stable aggregate public bundle.`,
    );
  }
  const release = requireObject(manifest.release, 'release');
  const source = requireObject(manifest.source_revision, 'source_revision');
  const schema = requireObject(manifest.schema, 'schema');
  const previous = manifest.previous_bundle;
  const predecessorBundleId =
    previous && typeof previous === 'object' && !Array.isArray(previous)
      ? requireString(
          (previous as Record<string, unknown>).bundle_id,
          'previous_bundle.bundle_id',
        )
      : null;
  const stableTag =
    manifest.publication && typeof manifest.publication === 'object'
      ? requireString(
          (manifest.publication as Record<string, unknown>).tag,
          'publication.tag',
        )
      : path.basename(bundleDir);
  return {
    bundleDir,
    bundleId: requireString(manifest.bundle_id, 'bundle_id'),
    bundleDigest: requireString(manifest.bundle_digest, 'bundle_digest'),
    bundleRevision: Number(manifest.bundle_revision),
    sourceCommit: requireString(source.commit, 'source_revision.commit'),
    sourceTag: requireString(source.tag, 'source_revision.tag'),
    releaseId: requireString(release.release_id, 'release.release_id'),
    releaseVersion: requireString(release.release_version, 'release.release_version'),
    schemaVersion: requireString(schema.version, 'schema.version'),
    schemaSha256: requireString(schema.sha256, 'schema.sha256'),
    manifestSha256: sha256Bytes(manifestBytes),
    sha256sumsSha256: sha256Bytes(readFileSync(path.join(bundleDir, 'SHA256SUMS'))),
    validationReportSha256: sha256Bytes(
      readFileSync(path.join(bundleDir, 'validation-report.json')),
    ),
    predecessorBundleId,
    stableTag,
  };
}

export function discoverLatestCompleteAggregate(actkgRoot: string): SealedBundleIdentity {
  const releasesRoot = path.join(actkgRoot, 'releases');
  const identities: SealedBundleIdentity[] = [];
  for (const entry of readdirSync(releasesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!/^control-theory-engineering-v0\.\d+(-r\d+)?$/u.test(entry.name)) continue;
    const bundleDir = path.join(releasesRoot, entry.name);
    try {
      identities.push(readSealedBundleIdentity(bundleDir));
    } catch {
      continue;
    }
  }
  if (identities.length === 0) {
    throw new LatestAuthorityCutoverError(
      'capture-bundle-invalid',
      'No complete stable aggregate public bundle was found.',
    );
  }
  identities.sort((left, right) => {
    const leftVersion = parseAggregateVersion(left.releaseVersion);
    const rightVersion = parseAggregateVersion(right.releaseVersion);
    if (rightVersion[0] !== leftVersion[0]) return rightVersion[0] - leftVersion[0];
    if (rightVersion[1] !== leftVersion[1]) return rightVersion[1] - leftVersion[1];
    return right.bundleRevision - left.bundleRevision;
  });
  return identities[0]!;
}

function parseAggregateVersion(version: string): [number, number] {
  const match = /v(\d+)\.(\d+)/u.exec(version);
  if (!match) return [0, 0];
  return [Number(match[1]), Number(match[2])];
}

export function inspectActkgWorktreeDirty(actkgRoot: string): boolean {
  const output = execFileSync('git', ['-C', actkgRoot, 'status', '--porcelain'], {
    encoding: 'utf8',
  });
  return output.trim().length > 0;
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new LatestAuthorityCutoverError(
      'capture-bundle-invalid',
      `${label} must be an object.`,
    );
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new LatestAuthorityCutoverError(
      'capture-bundle-invalid',
      `${label} must be a non-empty string.`,
    );
  }
  return value;
}

/**
 * Build the six-kind component closure from the captured bundle plus the
 * public Coverage / Overlay / Registry pointers that live beside it in the
 * sealed ActKG tree. Missing kinds fail closed; they are never invented.
 */
export function parseSixKindComponentClosure(
  source: BundleComponentSource,
): AuthorityComponentIdentity[] {
  const bundleDir = source.bundleDir;
  const manifest = readJson(path.join(bundleDir, 'bundle-manifest.json'));
  const componentsFile = readJson(path.join(bundleDir, 'component-releases.json'));
  const components = componentsFile.components;
  if (!Array.isArray(components) || components.length === 0) {
    throw new LatestAuthorityCutoverError(
      'capture-components-incomplete',
      'component-releases.json declares no components.',
    );
  }
  const byRole = new Map<string, Record<string, unknown>[]>();
  for (const row of components) {
    const item = requireObject(row, 'component-releases.components[]');
    const role = requireString(item.component_role, 'component_role');
    const list = byRole.get(role) ?? [];
    list.push(item);
    byRole.set(role, list);
  }
  const identities: AuthorityComponentIdentity[] = [];

  const moduleRows = byRole.get('module') ?? [];
  if (moduleRows.length === 0) {
    throw new LatestAuthorityCutoverError(
      'capture-components-incomplete',
      'Component closure is missing the declared module component.',
    );
  }
  identities.push({
    kind: 'module',
    componentId: 'actkg-module-set',
    version: requireString(manifest.release && requireObject(manifest.release, 'release').release_version, 'release.release_version'),
    sha256: sha256Bytes(
      moduleRows
        .map((row) => requireString(row.component_sha256, 'module.component_sha256'))
        .sort()
        .join('|'),
    ),
  });

  const terminology = (byRole.get('terminology') ?? [])[0];
  if (!terminology) {
    throw new LatestAuthorityCutoverError(
      'capture-components-incomplete',
      'Component closure is missing the declared terminology component.',
    );
  }
  identities.push({
    kind: 'terminology',
    componentId: requireString(terminology.release_id, 'terminology.release_id'),
    version: requireString(terminology.release_version, 'terminology.release_version'),
    sha256: requireString(terminology.component_sha256, 'terminology.component_sha256'),
  });

  const integration = (byRole.get('integration') ?? [])[0];
  if (!integration) {
    throw new LatestAuthorityCutoverError(
      'capture-components-incomplete',
      'Component closure is missing the declared integration component.',
    );
  }
  identities.push({
    kind: 'integration',
    componentId: requireString(integration.release_id, 'integration.release_id'),
    version: requireString(integration.release_version, 'integration.release_version'),
    sha256: requireString(integration.component_sha256, 'integration.component_sha256'),
  });

  const coverage = requireObject(manifest.coverage, 'bundle-manifest.coverage');
  identities.push({
    kind: 'coverage',
    componentId: requireString(coverage.coverage_version, 'coverage.coverage_version'),
    version: requireString(coverage.coverage_version, 'coverage.coverage_version'),
    sha256: requireString(coverage.matrix_sha256, 'coverage.matrix_sha256'),
  });

  let overlayId = 'overlay';
  let overlayVersion = 'unknown';
  let overlaySha = '';
  try {
    const lineage = readJson(source.lineagePath);
    overlayId = requireString(lineage.overlay, 'lineage.overlay');
    overlayVersion = overlayId;
    overlaySha = sha256Bytes(readFileSync(source.lineagePath));
  } catch {
    throw new LatestAuthorityCutoverError(
      'capture-components-incomplete',
      'Component closure is missing the declared overlay component.',
    );
  }
  identities.push({
    kind: 'overlay',
    componentId: overlayId,
    version: overlayVersion,
    sha256: overlaySha,
  });

  try {
    const registry = readJson(source.registrySummaryPath);
    identities.push({
      kind: 'registry',
      componentId: requireString(registry.artifact_type, 'registry.artifact_type'),
      version: 'v14',
      sha256: requireString(registry.artifact_hash, 'registry.artifact_hash'),
    });
  } catch {
    throw new LatestAuthorityCutoverError(
      'capture-components-incomplete',
      'Component closure is missing the declared registry component.',
    );
  }

  const seen = new Set(identities.map((item) => item.kind));
  for (const kind of AUTHORITY_COMPONENT_KINDS) {
    if (!seen.has(kind)) {
      throw new LatestAuthorityCutoverError(
        'capture-components-incomplete',
        `Component closure is missing the declared ${kind} component.`,
      );
    }
  }
  return identities;
}

/**
 * Read the captured public-contract surface from the bundle itself. The
 * adapter support surface is supplied separately so compatibility is not
 * self-certified by copying adapter members back onto the capture.
 */
export function capturedPublicContractFromBundle(
  bundleDir: string,
  representativeParse: CapturedPublicContract['representativeParse'],
): CapturedPublicContract {
  const manifest = readJson(path.join(bundleDir, 'bundle-manifest.json'));
  const schema = requireObject(manifest.schema, 'schema');
  const artifacts = manifest.artifacts;
  if (!Array.isArray(artifacts)) {
    throw new LatestAuthorityCutoverError(
      'capture-bundle-invalid',
      'bundle-manifest.artifacts must be an array.',
    );
  }
  const requiredMembers = artifacts
    .map((row) => requireObject(row, 'artifact'))
    .filter((row) => row.required === true)
    .map((row) => requireString(row.role, 'artifact.role'));
  const profilesFile = readJson(path.join(bundleDir, 'projection-profiles.json'));
  const profiles = Array.isArray(profilesFile.profiles)
    ? profilesFile.profiles.map((row) => {
        const profile = requireObject(row, 'profile');
        const kind = requireString(
          profile.projection_kind ?? profile.id,
          'profile.projection_kind',
        );
        if (kind.includes('runtime') || kind === 'act' || kind.includes('act_')) {
          return 'runtime';
        }
        if (kind.includes('domain')) return 'domain';
        if (kind.includes('review')) return 'review';
        return kind;
      })
    : [];
  return {
    schemaVersion: requireString(schema.version, 'schema.version'),
    schemaSha256: requireString(schema.sha256, 'schema.sha256'),
    contractVersion: requireString(manifest.bundle_contract_version, 'bundle_contract_version'),
    requiredMembers,
    profiles: [...new Set(profiles)],
    representativeParse,
  };
}

export function adapterSupportsPublicBundle3(
  supported: SupportedPublicContract,
  schemaVersion: string,
  schemaSha256: string,
): SupportedPublicContract {
  const expected = supported.schemaIdentities[schemaVersion];
  if (expected !== schemaSha256) return supported;
  const versions = new Set(supported.contractVersions);
  versions.add('actkg-public-bundle/3');
  return {
    ...supported,
    contractVersions: [...versions],
  };
}
