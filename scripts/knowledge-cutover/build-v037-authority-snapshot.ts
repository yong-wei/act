#!/usr/bin/env tsx
/**
 * Build a v0.37 Authority Snapshot for the coordinated cutover (#1509
 * gap C). Bundle identity comes from a sealed latest-complete capture
 * receipt; this producer never hardcodes a bundle revision.
 *
 * The snapshot is staged candidate-only: no current.json selector is
 * written, and the output reopens cleanly through
 * verifyMaterializedSnapshot before the script exits.
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  authorityDigest,
  materializeAuthoritySnapshot,
  verifyMaterializedSnapshot,
} from '@/lib/authoritative-knowledge/authority-snapshot';
import type {
  AuthoritativeBundleReceiptRecord,
  AuthoritativeKnowledgeSnapshot,
  AuthoritativeProjectionLinkMetadataRecord,
  AuthoritativeProjectionIdentityRecord,
  AuthoritativeProjectionLinkRecord,
  AuthoritativeProjectionNodeRecord,
  AuthoritativeReleaseComponentRecord,
  AuthoritativeReleaseEntryRecord,
  AuthoritativeReleaseRecord,
  AuthoritativeReleaseSetRecord,
  AuthoritativeV2Evidence,
  AuthoritativeV2MultilingualLabelRecord,
  AuthoritativeV2ProjectionProfileRecord,
} from '@/lib/authoritative-knowledge/contracts';
import {
  resolveAuthorityStorePaths,
  stageAuthoritySnapshot,
} from '@/lib/authoritative-knowledge/authority-store';

const ROOT = process.cwd();
const AUTHORITY_ROOT = 'course-content/authoring/knowledge/authority';
const PREDECESSOR_RELEASE_ID_DEFAULT = 'ctr:release:control-theory-engineering-v0.22';
const CAPTURE_REVISION = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString().trim();
const STAGED_AT_DEFAULT = '2026-08-25T12:00:00.000Z';

type CaptureReceiptLite = {
  readonly bundleId: string;
  readonly sourceCommit: string;
  readonly sourceTag: string;
  readonly stableTag: string;
  readonly releaseId: string;
  readonly releaseVersion: string;
  readonly bundleDigest: string;
  readonly compatibility: { readonly classification: string };
};

function parseBuilderArgs(argv: string[]): {
  capturePath: string;
  bundleDir?: string;
  predecessorReleaseId: string;
  stagedAt: string;
  authorityRoot: string;
} {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || !value) {
      throw new Error('build-v037-authority-snapshot requires --capture <authority-capture.json>');
    }
    values.set(key, value);
  }
  const capturePath = values.get('--capture');
  if (!capturePath) {
    throw new Error('build-v037-authority-snapshot requires --capture <authority-capture.json> from the latest-complete capture; it does not hardcode a bundle revision.');
  }
  return {
    capturePath,
    bundleDir: values.get('--bundle-dir'),
    predecessorReleaseId: values.get('--predecessor-release-id') ?? PREDECESSOR_RELEASE_ID_DEFAULT,
    stagedAt: values.get('--staged-at') ?? STAGED_AT_DEFAULT,
    authorityRoot: values.get('--authority-root') ?? AUTHORITY_ROOT,
  };
}

function bundleDirFromId(bundleId: string): string {
  return `course-content/authoring/knowledge/releases/${bundleId.replace(/^ctb:/u, '').replaceAll(':', '-')}`;
}

type ProjectionNodeRow = {
  readonly id: string;
  readonly entity_id: string;
  readonly entity_type: string;
  readonly display_name: string;
  readonly semantic_name: string | null;
  readonly review_status: string | null;
  readonly publication_status: string | null;
  readonly release_tier: string;
  readonly candidate: boolean;
  readonly source_coverage_count: number | null;
};

type ProjectionLinkRow = {
  readonly id: string;
  readonly relation_id: string;
  readonly source_id: string;
  readonly target_id: string;
  readonly relation_type: string;
  readonly relation_family: string;
  readonly direction: string;
  readonly evidence_state: string;
};

type ReleaseEntryRow = {
  readonly entity: string;
  readonly entity_role: string;
  readonly inclusion_reason: string;
  readonly release_tier: string;
};

type ProfileRow = {
  readonly id: string;
  readonly projection_kind: string;
  readonly profile_version: string;
  readonly mapping_contract_version: string;
  readonly aggregation_policy: string;
};

type MultilingualLabelRow = {
  readonly entity_id: string;
  readonly label: string;
  readonly label_type: string;
  readonly language: string;
  readonly terminology_assertion_id: string;
};

type LocalizedNameRow = {
  readonly id: string;
  readonly target_id: string;
  readonly locale: string;
  readonly field_path: string;
  readonly review_status: string;
  readonly content_hash: string;
  readonly value: string;
};

type BundleArtifact = {
  readonly path: string;
  readonly role: string;
  readonly contract_version: string;
  readonly sha256: string;
  readonly required: boolean;
};

type LinkMetadataRow = {
  readonly relation_id: string;
  readonly release_tier: string;
  readonly source_release: string;
  readonly source_release_hash: string;
  readonly evidence_refs: readonly string[];
  readonly source_component_release: string;
  readonly target_component_release: string;
  readonly relation_component_release: string;
};

type ComponentRow = {
  readonly release_id: string;
  readonly release_version: string;
  readonly component_path: string;
  readonly component_role: string;
  readonly component_sha256: string;
  readonly release_hash: string;
  readonly source_release_hash: string;
};

function absolute(relativePath: string): string {
  return path.isAbsolute(relativePath) ? relativePath : path.join(ROOT, relativePath);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(absolute(filePath), 'utf8')) as T;
}

function sha256File(filePath: string): string {
  return createHash('sha256').update(readFileSync(absolute(filePath))).digest('hex');
}

function sha256Text(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
}

function requireText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function readJsonl<T>(filePath: string): T[] {
  return readFileSync(absolute(filePath), 'utf8')
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line) as T;
      } catch (error) {
        throw new Error(`${filePath} line ${index + 1} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
}

function manifestArtifacts(manifest: { readonly artifacts?: readonly BundleArtifact[] }): Map<string, BundleArtifact> {
  if (!Array.isArray(manifest.artifacts)) throw new Error('bundle manifest artifacts must be an array');
  const rows = new Map<string, BundleArtifact>();
  for (const artifact of manifest.artifacts) {
    if (!artifact || typeof artifact !== 'object') throw new Error('bundle manifest contains an invalid artifact');
    const artifactPath = requireText(artifact.path, 'bundle artifact path');
    if (rows.has(artifactPath)) throw new Error(`bundle manifest duplicates artifact ${artifactPath}`);
    if (!isSha256(artifact.sha256)) throw new Error(`bundle manifest artifact ${artifactPath} lacks a SHA-256 digest`);
    rows.set(artifactPath, artifact);
  }
  return rows;
}

function requireBundleArtifact(
  artifacts: ReadonlyMap<string, BundleArtifact>,
  filePath: string,
  role: string,
  contract: string,
  bundleDir: string,
): BundleArtifact {
  const artifact = artifacts.get(filePath);
  if (!artifact
    || artifact.required !== true
    || artifact.role !== role
    || artifact.contract_version !== contract
    || artifact.sha256 !== sha256File(`${bundleDir}/${filePath}`)) {
    throw new Error(`required ${role} artifact ${filePath} is missing, incompatible, or drifted`);
  }
  return artifact;
}

function profileKeyFor(row: ProfileRow): { profileKey: string; manifestProfile: string } {
  if (row.projection_kind === 'act_runtime_graph') return { profileKey: 'act', manifestProfile: 'runtime' };
  if (row.projection_kind === 'domain_graph') return { profileKey: 'domain', manifestProfile: 'domain' };
  if (row.projection_kind === 'review_graph') return { profileKey: 'review', manifestProfile: 'review' };
  throw new Error(`unsupported r4 projection kind ${row.projection_kind}`);
}

function buildR4LabelEvidence(input: {
  readonly releaseId: string;
  readonly bundleReceiptId: string;
  readonly bundleId: string;
  readonly bundleDigest: string;
  readonly manifestSha256: string;
  readonly sourceCommit: string;
  readonly sourceTag: string;
  readonly stableTag: string;
  readonly bundleRevision: number;
  readonly bundleDir: string;
  readonly manifestArtifacts: ReadonlyMap<string, BundleArtifact>;
  readonly profiles: readonly ProfileRow[];
  readonly nodes: readonly ProjectionNodeRow[];
}): AuthoritativeV2Evidence {
  const labelArtifact = requireBundleArtifact(
    input.manifestArtifacts,
    'multilingual-label-index.jsonl',
    'multilingual_label_index',
    'actkg-multilingual-label-index/1',
    input.bundleDir,
  );
  const localizedArtifact = requireBundleArtifact(
    input.manifestArtifacts,
    'localized-content-index.jsonl',
    'localized_content',
    'ctkg-localized-content/1',
    input.bundleDir,
  );
  const projectionArtifact = requireBundleArtifact(
    input.manifestArtifacts,
    'domain-projection.json',
    'projection',
    'ctkg-graph-projection/0.3',
    input.bundleDir,
  );
  const profilesArtifact = requireBundleArtifact(
    input.manifestArtifacts,
    'projection-profiles.json',
    'projection_profiles',
    'ctkg-projection-profiles/1',
    input.bundleDir,
  );
  const localeArtifact = requireBundleArtifact(
    input.manifestArtifacts,
    'locale-manifest.json',
    'locale_manifest',
    'ctkg-locale-manifest/1',
    input.bundleDir,
  );
  const localeManifest = readJson<{
    readonly contract: string;
    readonly capabilities: {
      readonly default_locale: string;
      readonly fallback_policy: string;
      readonly production_ready: boolean;
      readonly supported_locales: readonly string[];
    };
  }>(`${input.bundleDir}/locale-manifest.json`);
  if (localeManifest.contract !== 'ctkg-locale-manifest/1'
    || localeManifest.capabilities.default_locale !== 'zh-CN'
    || localeManifest.capabilities.fallback_policy !== 'forbidden'
    || localeManifest.capabilities.production_ready !== true
    || !localeManifest.capabilities.supported_locales.includes('zh-CN')) {
    throw new Error('r4 locale manifest does not declare a production zh-CN presentation contract');
  }

  const profileHashes = readJson<{ readonly contract_version: string; readonly profile_sha256: Record<string, string> }>(
    `${input.bundleDir}/projection-profiles.json`,
  );
  if (profileHashes.contract_version !== 'ctkg-projection-profiles/1') {
    throw new Error('r4 projection profile contract mismatch');
  }
  const profiles: AuthoritativeV2ProjectionProfileRecord[] = input.profiles.map((row) => {
    const { profileKey, manifestProfile } = profileKeyFor(row);
    const profileSha256 = profileHashes.profile_sha256[profileKey];
    if (!isSha256(profileSha256)
      || !row.id
      || !row.profile_version
      || !row.mapping_contract_version
      || !row.aggregation_policy) {
      throw new Error(`r4 projection profile ${profileKey} is incomplete`);
    }
    return {
      releaseId: input.releaseId,
      profileKey,
      manifestProfile,
      profileId: row.id,
      profileSha256,
      projectionKind: row.projection_kind,
      profileVersion: row.profile_version,
      mappingContractVersion: row.mapping_contract_version,
      aggregationPolicy: row.aggregation_policy,
      payload: {
        contract: 'actkg-r4-sealed-profile-evidence/v1',
        sourceArtifact: 'projection-profiles.json',
        sourceArtifactSha256: profilesArtifact.sha256,
        profile: row,
      },
    };
  }).sort((left, right) => left.profileKey.localeCompare(right.profileKey));
  if (profiles.length !== 3 || new Set(profiles.map((row) => row.profileKey)).size !== 3) {
    throw new Error('r4 must admit exactly one runtime, domain, and review projection profile');
  }

  const nodeIds = new Set(input.nodes.map((node) => node.entity_id));
  if (nodeIds.size !== input.nodes.length) throw new Error('r4 domain projection repeats an entity id');
  const indexedLabels = new Map<string, MultilingualLabelRow>();
  const indexedAliases = new Map<string, MultilingualLabelRow[]>();
  for (const row of readJsonl<MultilingualLabelRow>(`${input.bundleDir}/multilingual-label-index.jsonl`)) {
    if (!nodeIds.has(row.entity_id)) throw new Error(`r4 terminology label references unknown object ${row.entity_id}`);
    if (row.language !== 'zh-CN' || row.label_type !== 'canonical_preferred') {
      // Governed aliases (r6 U5): zh-CN alternative rows ride along with the
      // same node-scope guarantee; other locales stay with the locale bundle.
      if (row.language === 'zh-CN' && row.label_type === 'alternative') {
        if (!row.label.trim() || !row.terminology_assertion_id) {
          throw new Error(`r4 terminology index has an invalid alternative label for ${row.entity_id}`);
        }
        const rows = indexedAliases.get(row.entity_id) ?? [];
        rows.push(row);
        indexedAliases.set(row.entity_id, rows);
      }
      continue;
    }
    if (!row.label.trim() || !row.terminology_assertion_id || indexedLabels.has(row.entity_id)) {
      throw new Error(`r4 terminology index has an invalid or duplicate canonical label for ${row.entity_id}`);
    }
    indexedLabels.set(row.entity_id, row);
  }
  const localizedNames = new Map<string, LocalizedNameRow>();
  const localizedAliases = new Map<string, LocalizedNameRow[]>();
  for (const row of readJsonl<LocalizedNameRow>(`${input.bundleDir}/localized-content-index.jsonl`)) {
    if (row.locale !== 'zh-CN' || row.review_status !== 'approved') continue;
    if (row.field_path === 'name') {
      if (!nodeIds.has(row.target_id)) continue;
      if (!row.id || !row.value.trim() || !isSha256(row.content_hash) || localizedNames.has(row.target_id)) {
        throw new Error(`r4 localized name index has an invalid or duplicate approved label for ${row.target_id}`);
      }
      localizedNames.set(row.target_id, row);
      continue;
    }
    if (row.field_path === 'alias') {
      // Governed alias rows (r6 U5, zh/en symmetric upstream; only the zh-CN
      // base locale enters the snapshot evidence).
      if (!nodeIds.has(row.target_id)) {
        throw new Error(`r4 localized alias references unknown object ${row.target_id}`);
      }
      if (!row.id || !row.value.trim() || !isSha256(row.content_hash)) {
        throw new Error(`r4 localized alias index has an invalid approved alias for ${row.target_id}`);
      }
      const rows = localizedAliases.get(row.target_id) ?? [];
      rows.push(row);
      localizedAliases.set(row.target_id, rows);
    }
  }

  const sourceCounts = {
    terminology: 0,
    localizedName: 0,
    projectionDisplayName: 0,
    terminologyAlias: 0,
    localizedAlias: 0,
  };
  const multilingualLabels: AuthoritativeV2MultilingualLabelRecord[] = input.nodes
    .slice()
    .sort((left, right) => left.entity_id.localeCompare(right.entity_id))
    .map((node, ordinal) => {
      const indexed = indexedLabels.get(node.entity_id);
      const localized = localizedNames.get(node.entity_id);
      const source = indexed
        ? {
          kind: 'multilingual-label-index',
          artifact: labelArtifact,
          recordId: indexed.terminology_assertion_id,
          recordHash: authorityDigest(indexed),
          label: indexed.label,
        }
        : localized
          ? {
            kind: 'localized-content-name',
            artifact: localizedArtifact,
            recordId: localized.id,
            recordHash: localized.content_hash,
            label: localized.value,
          }
          : {
            kind: 'domain-projection-display-name',
            artifact: projectionArtifact,
            recordId: node.entity_id,
            recordHash: authorityDigest(node),
            label: node.display_name,
          };
      if (!source.label || source.label.trim().length === 0) {
        throw new Error(`r4 has no usable zh-CN label source for ${node.entity_id}`);
      }
      if (source.kind === 'multilingual-label-index') sourceCounts.terminology += 1;
      else if (source.kind === 'localized-content-name') sourceCounts.localizedName += 1;
      else sourceCounts.projectionDisplayName += 1;
      return {
        releaseId: input.releaseId,
        ordinal,
        entityId: node.entity_id,
        language: 'zh-CN',
        label: source.label,
        labelType: 'canonical_preferred',
        terminologyAssertionId: indexed?.terminology_assertion_id
          ?? `ctt:r4-projection-label-${sha256Text(`${source.kind}\u0000${node.entity_id}\u0000${source.label}`).slice(0, 40)}`,
        payload: {
          contract: 'actkg-r4-sealed-presentation-label/v1',
          source: source.kind,
          entityId: node.entity_id,
          labelSha256: sha256Text(source.label),
          sourceArtifact: source.artifact.path,
          sourceArtifactSha256: source.artifact.sha256,
          sourceRecordId: source.recordId,
          sourceRecordHash: source.recordHash,
          bundleDigest: input.bundleDigest,
          manifestSha256: input.manifestSha256,
        },
      } satisfies AuthoritativeV2MultilingualLabelRecord;
    });
  const preferredCount = multilingualLabels.length;
  if (preferredCount !== input.nodes.length) throw new Error('r4 label evidence does not cover every projection object');
  // Governed aliases append after the preferred rows; each alias row binds the
  // same sealed bundle artifacts and stays scoped to admitted nodes.
  const aliasRows = input.nodes
    .slice()
    .sort((left, right) => left.entity_id.localeCompare(right.entity_id))
    .flatMap((node) => {
      const terminology = indexedAliases.get(node.entity_id) ?? [];
      const localized = localizedAliases.get(node.entity_id) ?? [];
      return [
        ...terminology.map((row) => ({
          entityId: node.entity_id,
          label: row.label,
          artifact: labelArtifact,
          recordId: row.terminology_assertion_id,
          recordHash: authorityDigest(row),
          source: 'multilingual-label-index-alias' as const,
        })),
        ...localized.map((row) => ({
          entityId: node.entity_id,
          label: row.value,
          artifact: localizedArtifact,
          recordId: row.id,
          recordHash: row.content_hash,
          source: 'localized-content-alias' as const,
        })),
      ];
    });
  let aliasOrdinal = preferredCount;
  for (const row of aliasRows) {
    sourceCounts[row.source === 'multilingual-label-index-alias' ? 'terminologyAlias' : 'localizedAlias'] += 1;
    multilingualLabels.push({
      releaseId: input.releaseId,
      ordinal: aliasOrdinal,
      entityId: row.entityId,
      language: 'zh-CN',
      label: row.label,
      labelType: 'alternative',
      terminologyAssertionId: row.recordId,
      payload: {
        contract: 'actkg-r4-sealed-presentation-label/v1',
        source: row.source,
        entityId: row.entityId,
        labelSha256: sha256Text(row.label),
        sourceArtifact: row.artifact.path,
        sourceArtifactSha256: row.artifact.sha256,
        sourceRecordId: row.recordId,
        sourceRecordHash: row.recordHash,
        bundleDigest: input.bundleDigest,
        manifestSha256: input.manifestSha256,
      },
    } satisfies AuthoritativeV2MultilingualLabelRecord);
    aliasOrdinal += 1;
  }
  const bindingPayload = {
    provenance: 'registry',
    verificationScope: 'admission-time',
    verifiedDuringLoad: false,
    registryIdentity: {
      adapter: 'actkg-r4-sealed-presentation-evidence/v1',
      bundleContractVersion: 'actkg-public-bundle/3',
      manifestSha256: input.manifestSha256,
      requiredArtifacts: {
        multilingualLabelIndex: labelArtifact.sha256,
        localizedContent: localizedArtifact.sha256,
        domainProjection: projectionArtifact.sha256,
        projectionProfiles: profilesArtifact.sha256,
        localeManifest: localeArtifact.sha256,
      },
      sourceCounts,
      objectCount: input.nodes.length,
    },
    upstreamRepository: { sourceCommit: input.sourceCommit, sourceTag: input.sourceTag },
    publicationRevision: { stableTag: input.stableTag, bundleRevision: input.bundleRevision },
    sourceRevision: { sourceCommit: input.sourceCommit, sourceTag: input.sourceTag },
    bundleIdentity: {
      bundleId: input.bundleId,
      bundleDigest: input.bundleDigest,
      manifestSha256: input.manifestSha256,
    },
  } as const;
  return {
    protocol: 'actkg-public-bundle/2',
    profiles,
    multilingualLabels,
    admissionBinding: {
      releaseId: input.releaseId,
      bundleReceiptId: input.bundleReceiptId,
      protocol: 'actkg-public-bundle/2',
      ...bindingPayload,
      bindingDigest: authorityDigest(bindingPayload),
    },
  };
}

function main(): void {
  const args = parseBuilderArgs(process.argv.slice(2));
  const capture = readJson<CaptureReceiptLite>(args.capturePath);
  if (capture.compatibility.classification !== 'COMPATIBLE') {
    throw new Error('refusing to materialize a snapshot from an ADAPTATION_REQUIRED capture');
  }
  const BUNDLE_DIR = args.bundleDir ?? bundleDirFromId(capture.bundleId);
  const RELEASE_ID = capture.releaseId;
  const RELEASE_VERSION = capture.releaseVersion;
  const RELEASE_SET_ID = `actkg-authoritative-candidate-${capture.stableTag}`;
  const PREDECESSOR_RELEASE_ID = args.predecessorReleaseId;
  const ACTKG_SOURCE_COMMIT = capture.sourceCommit;
  const SOURCE_TAG = capture.sourceTag;
  const STAGED_AT = args.stagedAt;
  const bundleRoot = absolute(BUNDLE_DIR);
  const authorityRoot = args.authorityRoot;

  // 1. Re-verify the bundle integrity before consuming it.
  const sums = readFileSync(path.join(bundleRoot, 'SHA256SUMS'), 'utf8');
  for (const line of sums.split('\n')) {
    if (!line.trim()) continue;
    const [expected, name] = line.trim().split(/\s+/u);
    const actual = sha256File(path.join(BUNDLE_DIR, name));
    if (actual !== expected) {
      throw new Error(`bundle artifact ${name} drifted: ${actual.slice(0, 12)} != ${expected.slice(0, 12)}`);
    }
  }

  const releaseFile = readJson<{
    readonly release_hash: string;
    readonly source_dataset_hash: string;
    readonly schema_version: string;
    readonly entries: readonly (ReleaseEntryRow | string)[];
  }>(`${BUNDLE_DIR}/release.json`);
  // The bundle lists two m3-v2u source-object entities as shorthand string
  // rows; expand them into the standard entry shape with an explicit note.
  const release = {
    ...releaseFile,
    entries: releaseFile.entries.map((row): ReleaseEntryRow => typeof row === 'string'
      ? {
        entity: row,
        entity_role: 'source_object',
        release_tier: 'bronze',
        inclusion_reason: 'Source-object entity of the v0.37 m3-v2u mapping layer (expanded from a shorthand bundle row).',
      }
      : row),
  };
  const domainProjection = readJson<{
    readonly id: string;
    readonly version_digest: string;
    readonly source_release: string;
    readonly source_release_hash: string;
    readonly source_dataset_hash: string;
    readonly nodes: readonly ProjectionNodeRow[];
    readonly links: readonly ProjectionLinkRow[];
  }>(`${BUNDLE_DIR}/domain-projection.json`);
  const profilesFile = readJson<{ readonly profiles: readonly ProfileRow[] }>(`${BUNDLE_DIR}/projection-profiles.json`);
  const components = readJson<{ readonly components: readonly ComponentRow[] }>(`${BUNDLE_DIR}/component-releases.json`).components;
  const linkMetadata = readFileSync(path.join(bundleRoot, 'projection-link-metadata.jsonl'), 'utf8')
    .split('\n')
    .filter((line): line is string => line.trim().length > 0)
    .map((line) => JSON.parse(line) as LinkMetadataRow);

  const bundleManifestIdentity = readJson<{ readonly bundle_id: string; readonly bundle_digest: string; readonly bundle_revision: number }>(`${BUNDLE_DIR}/bundle-manifest.json`);
  if (bundleManifestIdentity.bundle_id !== capture.bundleId) {
    throw new Error(`bundle_id ${bundleManifestIdentity.bundle_id} does not match capture ${capture.bundleId}`);
  }
  if (bundleManifestIdentity.bundle_digest !== capture.bundleDigest) {
    throw new Error('bundle_digest does not match the sealed latest-complete capture');
  }

  const schemaSha = sha256File(`${BUNDLE_DIR}/ctkg.schema.json`);
  const releaseRawSha = sha256File(`${BUNDLE_DIR}/release.json`);
  const sumsSha = sha256File(`${BUNDLE_DIR}/SHA256SUMS`);
  const manifestSha = sha256File(`${BUNDLE_DIR}/bundle-manifest.json`);
  const bundleManifest = readJson<{ readonly artifacts?: readonly BundleArtifact[] }>(`${BUNDLE_DIR}/bundle-manifest.json`);
  const bundleArtifacts = manifestArtifacts(bundleManifest);
  const runtimeProfile = profilesFile.profiles.find((row) => row.projection_kind === 'runtime')
    ?? profilesFile.profiles[0];
  if (!runtimeProfile) throw new Error('bundle declares no projection profile');

  // 2. Assemble the repository-view snapshot record.
  const releaseSet: AuthoritativeReleaseSetRecord = {
    id: RELEASE_SET_ID,
    controlledPath: BUNDLE_DIR,
    lockVersion: capture.stableTag,
    candidateState: 'ACCEPTED_CANDIDATE',
  };
  const releaseRecord: AuthoritativeReleaseRecord = {
    id: RELEASE_ID,
    releaseSetId: RELEASE_SET_ID,
    releaseVersion: RELEASE_VERSION,
    releaseStatus: 'published',
    protocol: 'ctkg-release/0.3',
    authority: 'control-theory-engineering',
    scope: 'control-theory',
    contractHash: schemaSha,
    releaseHash: release.release_hash,
    schemaRawHash: schemaSha,
    releaseRawHash: releaseRawSha,
    notesRawHash: sumsSha,
    captureRevision: CAPTURE_REVISION,
    lockRawHash: sumsSha,
    schemaVersion: release.schema_version,
    projectionId: domainProjection.id,
    projectionDigest: domainProjection.version_digest,
    sourceDatasetHash: release.source_dataset_hash,
  };
  const bundleReceipt: AuthoritativeBundleReceiptRecord = {
    id: `bundle-receipt:${capture.bundleDigest}`,
    bundleId: capture.bundleId,
    bundleRevision: bundleManifestIdentity.bundle_revision,
    // The Bundle receipt identifies the sealed packaging artifact, not the
    // canonical release payload nested inside it. Keeping these identities
    // distinct makes the staged Authority snapshot close over the same
    // bundleDigest that the execution-time capture verified.
    bundleDigest: capture.bundleDigest,
    bundleKind: 'composite',
    releaseStage: 'published',
    bundleContractVersion: 'ctkg-release/0.3',
    controlledPath: BUNDLE_DIR,
    manifestRawSha256: manifestSha,
    normalization: 'canonical-json/rfc8785-subset-v1',
    publicationTag: capture.stableTag,
    sourceCommit: ACTKG_SOURCE_COMMIT,
    sourceTag: SOURCE_TAG,
    releaseSetId: RELEASE_SET_ID,
    releaseId: RELEASE_ID,
    releaseHash: release.release_hash,
    sourceDatasetHash: release.source_dataset_hash,
    schemaVersion: release.schema_version,
    schemaRawSha256: schemaSha,
    lockVersion: capture.stableTag,
    lockPath: `${BUNDLE_DIR}/SHA256SUMS`,
    lockRawSha256: sumsSha,
    captureRevision: CAPTURE_REVISION,
    candidateState: 'ACCEPTED_CANDIDATE',
    compatibilityCode: 'COMPATIBLE',
    runtimeProjectionId: domainProjection.id,
    runtimeProjectionProfile: runtimeProfile.id,
    runtimeProjectionDigest: domainProjection.version_digest,
    artifactCount: bundleManifest.artifacts?.length ?? 0,
    statistics: { nodes: domainProjection.nodes.length, links: domainProjection.links.length, entries: release.entries.length },
    importedAt: new Date(STAGED_AT),
  };

  const projectionNodes: AuthoritativeProjectionNodeRecord[] = domainProjection.nodes.map((node, index) => ({
    releaseId: RELEASE_ID,
    nodeId: node.id,
    ordinal: index,
    entityId: node.entity_id,
    entityType: node.entity_type,
    displayName: node.display_name,
    releaseTier: node.release_tier,
    reviewStatus: node.review_status ?? '',
    publicationStatus: node.publication_status ?? '',
    semanticName: node.semantic_name,
    sourceCoverageCount: node.source_coverage_count ?? 0,
    candidate: node.candidate,
    payload: node,
  }));
  const projectionLinks: AuthoritativeProjectionLinkRecord[] = domainProjection.links.map((link, index) => ({
    releaseId: RELEASE_ID,
    linkId: link.id,
    ordinal: index,
    relationId: link.relation_id,
    sourceId: link.source_id,
    targetId: link.target_id,
    relationType: link.relation_type,
    relationFamily: link.relation_family,
    direction: link.direction,
    evidenceState: link.evidence_state,
    payload: link,
  }));
  const releaseEntries: AuthoritativeReleaseEntryRecord[] = release.entries.map((entry, index) => ({
    releaseId: RELEASE_ID,
    entityId: entry.entity,
    ordinal: index,
    releaseTier: entry.release_tier,
    entityRole: entry.entity_role,
    inclusionReason: entry.inclusion_reason,
    payload: entry,
  }));
  const releaseComponents: AuthoritativeReleaseComponentRecord[] = components.map((component, index) => ({
    releaseId: RELEASE_ID,
    ordinal: index,
    componentReleaseId: component.release_id,
    releaseVersion: component.release_version,
    protocol: 'ctkg-release/0.3',
    controlledPath: `${BUNDLE_DIR}/${component.component_path}`,
    releaseHash: component.release_hash,
    releaseRawSha256: component.component_sha256,
    sha256sumsSha256: null,
    referenceKind: null,
    componentRole: component.component_role,
    componentBundleId: null,
    componentBundleDigest: null,
    componentManifestSha256: component.component_sha256,
    payload: component,
  }));
  const projectionIdentities: AuthoritativeProjectionIdentityRecord[] = profilesFile.profiles.map((profile, index) => ({
    releaseId: RELEASE_ID,
    projectionId: profile.id,
    ordinal: index,
    profile: profile.projection_kind,
    projectionProfile: profile.id,
    versionDigest: domainProjection.version_digest,
    sourceRelease: domainProjection.source_release,
    sourceReleaseHash: domainProjection.source_release_hash,
    sourceDatasetHash: domainProjection.source_dataset_hash,
    nodeCount: domainProjection.nodes.length,
    linkCount: domainProjection.links.length,
    artifactPath: `${BUNDLE_DIR}/domain-projection.json`,
    artifactSha256: sha256File(`${BUNDLE_DIR}/domain-projection.json`),
    isRuntime: profile.projection_kind === 'runtime',
    bundleReceiptId: bundleReceipt.id,
  }));
  const linkMetadataRecords: AuthoritativeProjectionLinkMetadataRecord[] = linkMetadata.map((row, index) => ({
    releaseId: RELEASE_ID,
    relationId: row.relation_id,
    ordinal: index,
    releaseTier: row.release_tier,
    sourceRelease: row.source_release,
    sourceReleaseHash: row.source_release_hash,
    evidenceRefs: row.evidence_refs,
    sourceComponentRelease: row.source_component_release,
    targetComponentRelease: row.target_component_release,
    relationComponentRelease: row.relation_component_release,
    profiles: [runtimeProfile.id],
    payload: row,
    bundleReceiptId: bundleReceipt.id,
  }));
  const v2Evidence = buildR4LabelEvidence({
    releaseId: RELEASE_ID,
    bundleReceiptId: bundleReceipt.id,
    bundleId: capture.bundleId,
    bundleDigest: capture.bundleDigest,
    manifestSha256: manifestSha,
    sourceCommit: ACTKG_SOURCE_COMMIT,
    sourceTag: SOURCE_TAG,
    stableTag: capture.stableTag,
    bundleRevision: bundleManifestIdentity.bundle_revision,
    bundleDir: BUNDLE_DIR,
    manifestArtifacts: bundleArtifacts,
    profiles: profilesFile.profiles,
    nodes: domainProjection.nodes,
  });

  const snapshot: AuthoritativeKnowledgeSnapshot = {
    authorityState: 'candidate',
    productionAuthoritative: false,
    historical: false,
    releaseSet,
    release: releaseRecord,
    receipt: null,
    objects: [],
    relations: [],
    sourceMappings: [],
    sourceObjects: [],
    evidence: [],
    releaseEntries,
    projectionNodes,
    projectionLinks,
    upstreamRagReferences: [],
    releaseComponents,
    projectionIdentities,
    linkMetadata: linkMetadataRecords,
    bundleReceipt,
    v2Evidence,
  };

  // 3. Materialize and stage (writes snap-<hash>/ but never current.json).
  const paths = resolveAuthorityStorePaths(absolute(authorityRoot));
  const staged = stageAuthoritySnapshot(paths, {
    snapshot,
    predecessorReleaseId: PREDECESSOR_RELEASE_ID,
    stagedAt: STAGED_AT,
    captureRevision: CAPTURE_REVISION,
  }, {
    stagedAt: STAGED_AT,
    receiptId: `stage-${capture.stableTag}-${release.release_hash.slice(0, 12)}`,
  });

  // 4. Reopen the staged files and verify them end-to-end.
  const reopenedManifest = readJson<Parameters<typeof verifyMaterializedSnapshot>[0]['manifest']>(
    `${authorityRoot}/releases/${staged.snapshotId}/manifest.json`,
  );
  const reopenedEngineering = readJson<Parameters<typeof verifyMaterializedSnapshot>[0]['engineering']>(
    `${authorityRoot}/releases/${staged.snapshotId}/engineering.json`,
  );
  verifyMaterializedSnapshot({ manifest: reopenedManifest, engineering: reopenedEngineering });
  if (
    reopenedManifest.bundleDigest !== capture.bundleDigest
    || reopenedManifest.bundleReceiptId !== `bundle-receipt:${capture.bundleDigest}`
  ) {
    throw new Error('staged snapshot does not preserve the sealed Bundle identity');
  }

  console.log(JSON.stringify({
    snapshotId: staged.snapshotId,
    snapshotHash: staged.snapshotHash.slice(0, 16),
    releaseId: RELEASE_ID,
    objects: reopenedEngineering.objects.length,
    relations: reopenedEngineering.relations.length,
    releaseEntries: reopenedEngineering.releaseEntries.length,
    releaseComponents: reopenedEngineering.releaseComponents.length,
    projectionIdentities: reopenedEngineering.projectionIdentities.length,
    linkMetadata: reopenedEngineering.linkMetadata.length,
    labelEvidence: {
      labels: reopenedEngineering.v2Evidence?.multilingualLabels.length ?? 0,
      profiles: reopenedEngineering.v2Evidence?.profiles.length ?? 0,
    },
    verified: true,
    selectorWritten: false,
  }, null, 2));
}

main();
