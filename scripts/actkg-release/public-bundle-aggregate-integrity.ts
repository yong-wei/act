import { createHash } from 'node:crypto';

import { computeCanonicalReleaseHash } from './actkg-canonical-digests';
import { canonicalJson } from './authoritative-release';
import {
  ARTIFACT_CONTRACTS,
  isBundleContractSupported,
} from './bundle-compatibility-registry';

export type AggregateIntegrityJsonObject = Record<string, unknown>;

export interface AggregateIntegrityArtifactDescriptor {
  role: string;
  contractVersion: string;
  required: boolean;
  path: string;
  mediaType?: string;
  sha256?: string;
  byteLength?: number;
  recordCount?: number | null;
}

export interface AggregateIntegrityArtifact {
  descriptor: AggregateIntegrityArtifactDescriptor;
  bytes: Buffer;
}

export interface AggregateManifestIdentity {
  release_id: string;
  release_version: string;
  release_hash: string;
  source_dataset_hash: string;
}

export interface AggregateManifestIntegrityInput {
  manifest: AggregateIntegrityJsonObject;
  manifestBytes?: Buffer;
  artifacts: readonly AggregateIntegrityArtifact[];
  /** Public-bundle-v1 passes its lock identity; resolver passes Manifest identity. */
  expectedRelease?: Partial<AggregateManifestIdentity>;
  requireStable?: boolean;
}

export interface AggregateManifestIntegrityResult {
  release: AggregateIntegrityJsonObject;
  releaseArtifact: AggregateIntegrityArtifact;
  byRole: ReadonlyMap<string, readonly AggregateIntegrityArtifact[]>;
}

const SHA256 = /^[a-f0-9]{64}$/u;

function fail(message: string): never {
  throw new Error(`Aggregate public Bundle integrity failed: ${message}`);
}

function object(value: unknown, label: string): AggregateIntegrityJsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value as AggregateIntegrityJsonObject;
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) fail(`${label} must be a non-empty string`);
  return value;
}

function hash(value: unknown, label: string): string {
  const resolved = string(value, label);
  if (!SHA256.test(resolved)) fail(`${label} must be a lowercase SHA-256`);
  return resolved;
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function parseRelease(bytes: Buffer, label: string): AggregateIntegrityJsonObject {
  let value: unknown;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail(`${label} is not valid JSON`);
  }
  return object(value, label);
}

function assertReleaseIdentity(
  release: AggregateIntegrityJsonObject,
  manifestRelease: AggregateManifestIdentity,
  expectedRelease: Partial<AggregateManifestIdentity> | undefined,
): void {
  const payloadReleaseId = typeof release.id === 'string'
    ? release.id
    : string(release.release_id, 'release.release_id');
  const payloadReleaseVersion = string(release.release_version, 'release.release_version');
  const payloadReleaseHash = hash(release.release_hash, 'release.release_hash');
  const payloadDatasetHash = hash(release.source_dataset_hash, 'release.source_dataset_hash');

  if (
    payloadReleaseId !== manifestRelease.release_id
    || payloadReleaseVersion !== manifestRelease.release_version
    || payloadReleaseHash !== manifestRelease.release_hash
    || payloadDatasetHash !== manifestRelease.source_dataset_hash
  ) {
    fail('Manifest and Release identities differ');
  }
  if (expectedRelease) {
    for (const [key, expected] of Object.entries(expectedRelease)) {
      if (expected === undefined) continue;
      const actual = manifestRelease[key as keyof AggregateManifestIdentity];
      if (actual !== expected) fail(`Manifest release identity differs from expected ${key}`);
    }
  }
  if (computeCanonicalReleaseHash(release) !== payloadReleaseHash) {
    fail('canonical Release hash drift');
  }
  if (release.lifecycle_status !== 'accepted') {
    fail('Release lifecycle_status must be accepted');
  }
  if (release.publication_status !== 'published') {
    fail('Release publication_status must be published');
  }
}

/**
 * Validate the storage-independent portion of an aggregate public Bundle.
 *
 * Directory traversal, symlink handling, SHA256SUMS closure and deep CTKG
 * semantic checks remain in each caller. This helper owns the shared contract
 * registry, Bundle identity and Release self-hash/status boundary so the
 * resolver and public-bundle-v1 cannot drift apart.
 */
export function validateAggregateManifestIntegrity(
  input: AggregateManifestIntegrityInput,
): AggregateManifestIntegrityResult {
  const manifest = input.manifest;
  if (!isBundleContractSupported(string(manifest.bundle_contract_version, 'bundle_contract_version'))) {
    fail(`unregistered bundle contract ${String(manifest.bundle_contract_version)}`);
  }
  if (manifest.bundle_kind !== 'aggregate') fail('bundle_kind must be aggregate');
  if (input.requireStable && manifest.release_stage !== 'stable') {
    fail('release_stage must be stable');
  }
  if (!input.requireStable && manifest.release_stage !== 'stable' && manifest.release_stage !== 'candidate') {
    fail('release_stage is invalid');
  }

  const digestBody = structuredClone(manifest);
  delete digestBody.bundle_digest;
  const declaredBundleDigest = hash(manifest.bundle_digest, 'bundle_digest');
  const recomputedBundleDigest = sha256(canonicalJson(digestBody));
  if (declaredBundleDigest !== recomputedBundleDigest) {
    fail(`bundle_digest mismatch: declared ${declaredBundleDigest}, recomputed ${recomputedBundleDigest}`);
  }
  const manifestReleaseRaw = object(manifest.release, 'manifest.release');
  const manifestRelease: AggregateManifestIdentity = {
    release_id: string(manifestReleaseRaw.release_id, 'manifest.release.release_id'),
    release_version: string(manifestReleaseRaw.release_version, 'manifest.release.release_version'),
    release_hash: hash(manifestReleaseRaw.release_hash, 'manifest.release.release_hash'),
    source_dataset_hash: hash(
      manifestReleaseRaw.source_dataset_hash,
    'manifest.release.source_dataset_hash',
    ),
  };

  const byRole = new Map<string, AggregateIntegrityArtifact[]>();
  for (const artifact of input.artifacts) {
    const descriptor = artifact.descriptor;
    const registration = ARTIFACT_CONTRACTS.find(
      (entry) => entry.role === descriptor.role && entry.contractVersion === descriptor.contractVersion,
    );
    if (descriptor.required && !registration) {
      fail(`unknown required Artifact role/contract ${descriptor.role}@${descriptor.contractVersion}`);
    }
    const list = byRole.get(descriptor.role) ?? [];
    list.push(artifact);
    byRole.set(descriptor.role, list);
  }

  for (const registration of ARTIFACT_CONTRACTS) {
    if (!registration.requiredForAggregate) continue;
    const matches = input.artifacts.filter(
      ({ descriptor }) => (
        descriptor.role === registration.role
        && descriptor.contractVersion === registration.contractVersion
      ),
    );
    if (matches.length === 0) {
      fail(`required aggregate Artifact missing: ${registration.role}@${registration.contractVersion}`);
    }
    if (matches.some(({ descriptor }) => !descriptor.required)) {
      fail(`required aggregate Artifact must declare required:true: ${registration.role}@${registration.contractVersion}`);
    }
  }

  const releaseArtifacts = byRole.get('release') ?? [];
  if (releaseArtifacts.length !== 1) fail('Bundle must contain exactly one release Artifact');
  const releaseArtifact = releaseArtifacts[0]!;
  const release = parseRelease(releaseArtifact.bytes, `release Artifact ${releaseArtifact.descriptor.path}`);
  assertReleaseIdentity(release, manifestRelease, input.expectedRelease);

  return {
    release,
    releaseArtifact,
    byRole,
  };
}
