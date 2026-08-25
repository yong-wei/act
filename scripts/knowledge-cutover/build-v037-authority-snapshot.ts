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
  const bundleManifest = readJson<{ readonly artifacts?: readonly unknown[] }>(`${BUNDLE_DIR}/bundle-manifest.json`);
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
  };

  // 3. Materialize and stage (writes snap-<hash>/ but never current.json).
  const paths = resolveAuthorityStorePaths(absolute(AUTHORITY_ROOT));
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
    `${AUTHORITY_ROOT}/releases/${staged.snapshotId}/manifest.json`,
  );
  const reopenedEngineering = readJson<Parameters<typeof verifyMaterializedSnapshot>[0]['engineering']>(
    `${AUTHORITY_ROOT}/releases/${staged.snapshotId}/engineering.json`,
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
    verified: true,
    selectorWritten: false,
  }, null, 2));
}

main();
