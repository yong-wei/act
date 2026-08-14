/** Direct v0.9 → v0.18 migration impact evidence.
 *
 * This module deliberately computes from complete snapshots.  The upstream
 * v0.17 → v0.18 release-diff is parsed and retained only as a cross-check.
 */
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  buildVocabulary,
  computeSemanticCollectionDigest,
  computeReleaseSetDelta,
  digestObjectMaterialIdentity,
  digestPayload,
} from './release-set-delta-compute';
import {
  crossCheckUpstreamDiff,
  parseUpstreamReleaseDiff,
} from './release-set-delta-compute';
import type {
  ComputedReleaseSetDelta,
  DeltaEvidenceRef,
  DeltaSemanticSnapshot,
  UpstreamReleaseDiffV1,
} from './release-set-delta-types';
import type { JsonObject, ValidatedActKGBundleV2 } from './public-bundle-types';
import { canonicalJson, sha256 } from './authoritative-release';
import { resolveTrustedCaptureRevision } from './capture-revision';

export const V018_IMPACT_REPORT_PROTOCOL = 'actkg-v0.9-to-v0.18-impact/1' as const;
export const V09_DEFAULT_PATH = 'course-content/authoring/knowledge/releases/control-theory-engineering-v0.9';
const V09_BASELINE_FILES = [
  'bundle-manifest.json',
  'release.json',
  'act-projection.json',
  'projection-link-metadata.jsonl',
  'rag-crosswalk.jsonl',
  'component-releases.json',
] as const;

export interface V018ImpactReport {
  protocol: typeof V018_IMPACT_REPORT_PROTOCOL;
  algorithmVersion: string;
  baseline: {
    releaseId: string;
    releaseVersion: string;
    releaseHash: string;
    sourceDatasetHash: string;
    releaseSetId: string;
    runtimeProjectionId: string | null;
    runtimeProjectionDigest: string | null;
  };
  candidate: {
    releaseId: string;
    releaseVersion: string;
    releaseHash: string;
    sourceDatasetHash: string;
    releaseSetId: string;
    bundleId: string;
    bundleDigest: string;
    runtimeProjectionId: string;
    runtimeProjectionDigest: string;
  };
  counts: {
    baselineReleaseEntries: number;
    candidateReleaseEntries: number;
    baselineRuntimeNodes: number;
    candidateRuntimeNodes: number;
    baselineRuntimeLinks: number;
    candidateRuntimeLinks: number;
    baselineComponents: number;
    candidateComponents: number;
    baselineCrosswalkRows: number;
    candidateCrosswalkRows: number;
  };
  direct: ComputedReleaseSetDelta;
  upstreamCrosscheck: {
    artifactPath: string;
    artifactSha256: string;
    baseReleaseVersion: string;
    targetReleaseVersion: string;
    parsed: UpstreamReleaseDiffV1 | null;
    status: 'AGREED' | 'DISAGREED' | 'PARSE_FAILED' | 'NOT_REQUIRED';
    details: JsonObject;
  };
  reportDigest: string;
}

function fail(message: string): never {
  throw new Error(`ActKG v0.18 impact report rejected: ${message}`);
}

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  return value as JsonObject;
}

function array(value: unknown, label: string): JsonObject[] {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value.map((row, index) => object(row, `${label}[${index}]`));
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) fail(`${label} must be a non-empty string`);
  return value;
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function jsonl(bytes: Buffer, label: string): JsonObject[] {
  return bytes.toString('utf8').split(/\r?\n/u).filter(Boolean).map((line, index) => {
    try {
      return object(JSON.parse(line), `${label}[${index}]`);
    } catch {
      fail(`${label}[${index}] is not valid JSON`);
    }
  });
}

function snapshotDigest(snapshot: Omit<DeltaSemanticSnapshot, 'semanticCollectionDigest'>): DeltaSemanticSnapshot {
  return { ...snapshot, semanticCollectionDigest: computeSemanticCollectionDigest(snapshot) };
}

function snapshotFromV2(bundle: ValidatedActKGBundleV2, releaseSetId: string): DeltaSemanticSnapshot {
  const runtimeNodes = array(bundle.selectedRuntimeProjection.payload.nodes, 'v0.18 runtime nodes');
  const runtimeLinks = array(bundle.selectedRuntimeProjection.payload.links, 'v0.18 runtime links');
  const entries = array(bundle.release.entries, 'v0.18 release entries');
  const entryById = new Map(entries.map((row) => [text(row.entity, 'release entry.entity'), row] as const));
  const metadataById = new Map(bundle.runtimeLinkMetadata.map((row) => [row.relationId, row] as const));
  const objects = runtimeNodes.map((node) => {
    const canonicalId = text(node.entity_id, 'runtime node.entity_id');
    const canonicalType = text(node.entity_type, 'runtime node.entity_type');
    const semanticName = optionalText(node.semantic_name);
    const entry = entryById.get(canonicalId);
    return {
      canonicalId,
      canonicalType,
      releaseTier: text(node.release_tier ?? entry?.release_tier, `runtime node ${canonicalId}.release_tier`),
      semanticName,
      displayName: optionalText(node.display_name),
      materialIdentityDigest: digestObjectMaterialIdentity({ canonicalId, canonicalType, semanticName }),
      payloadDigest: digestPayload(node),
      supersedes: optionalText(node.supersedes),
    };
  });
  const relations = runtimeLinks.map((link) => {
    const relationId = text(link.relation_id, 'runtime link.relation_id');
    const metadata = metadataById.get(relationId);
    const entry = entryById.get(relationId);
    return {
      relationId,
      predicate: text(link.relation_type, `runtime link ${relationId}.relation_type`),
      direction: text(link.direction, `runtime link ${relationId}.direction`),
      releaseTier: text(metadata?.releaseTier ?? entry?.release_tier, `runtime link ${relationId}.release_tier`),
      sourceId: text(link.source_id, `runtime link ${relationId}.source_id`),
      targetId: text(link.target_id, `runtime link ${relationId}.target_id`),
      payloadDigest: digestPayload(link),
    };
  });
  const projections = bundle.preservedProjections.map((row) => ({
    profile: row.identity.profile,
    projectionId: row.identity.projectionId,
    versionDigest: row.identity.versionDigest,
    isRuntime: false,
  }));
  projections.push({
    profile: bundle.selectedRuntimeProjection.identity.profile,
    projectionId: bundle.selectedRuntimeProjection.identity.projectionId,
    versionDigest: bundle.selectedRuntimeProjection.identity.versionDigest,
    isRuntime: true,
  });
  const components = bundle.components.map((row) => ({
    componentReleaseId: row.releaseId,
    releaseHash: row.releaseHash,
    protocol: 'actkg-public-bundle/2',
    referenceKind: 'standard_bundle_v2',
    payloadDigest: digestPayload(row),
  }));
  const crosswalk = bundle.crosswalk.map((row) => ({
    tripleKey: [row.publishedEntityId, row.retrievalChunkId, row.citationTargetId].join('\u001f'),
    ...row,
  }));
  const base = {
    releaseSetId,
    releaseId: bundle.releaseIdentity.releaseId,
    releaseVersion: bundle.releaseIdentity.releaseVersion,
    releaseHash: bundle.releaseIdentity.releaseHash,
    sourceDatasetHash: bundle.releaseIdentity.sourceDatasetHash,
    protocol: 'actkg-public-bundle/2',
    runtimeProjectionId: bundle.selectedRuntimeProjection.identity.projectionId,
    runtimeProjectionDigest: bundle.selectedRuntimeProjection.identity.versionDigest,
    objects,
    relations,
    crosswalk,
    components,
    projections,
    vocabulary: buildVocabulary(objects, relations),
  };
  return snapshotDigest(base);
}

function snapshotFromV09(input: {
  manifest: JsonObject;
  release: JsonObject;
  projection: JsonObject;
  linkMetadata: JsonObject[];
  crosswalk: JsonObject[];
  components: JsonObject[];
  releaseSetId: string;
}): DeltaSemanticSnapshot {
  const entries = array(input.release.entries, 'v0.9 release entries');
  const entryById = new Map(entries.map((row) => [text(row.entity, 'v0.9 release entry.entity'), row] as const));
  const metadataById = new Map(input.linkMetadata.map((row) => [text(row.relation_id, 'v0.9 metadata.relation_id'), row] as const));
  const nodes = array(input.projection.nodes, 'v0.9 runtime nodes');
  const links = array(input.projection.links, 'v0.9 runtime links');
  const objects = nodes.map((node) => {
    const canonicalId = text(node.entity_id, 'v0.9 node.entity_id');
    const canonicalType = text(node.entity_type, `v0.9 node ${canonicalId}.entity_type`);
    const semanticName = optionalText(node.semantic_name);
    return {
      canonicalId,
      canonicalType,
      releaseTier: text(node.release_tier ?? entryById.get(canonicalId)?.release_tier, `v0.9 node ${canonicalId}.release_tier`),
      semanticName,
      displayName: optionalText(node.display_name),
      materialIdentityDigest: digestObjectMaterialIdentity({ canonicalId, canonicalType, semanticName }),
      payloadDigest: digestPayload(node),
      supersedes: optionalText(node.supersedes),
    };
  });
  const relations = links.map((link) => {
    const relationId = text(link.relation_id, 'v0.9 link.relation_id');
    const metadata = metadataById.get(relationId);
    return {
      relationId,
      predicate: text(link.relation_type, `v0.9 link ${relationId}.relation_type`),
      direction: text(link.direction, `v0.9 link ${relationId}.direction`),
      releaseTier: text(metadata?.release_tier ?? entryById.get(relationId)?.release_tier, `v0.9 link ${relationId}.release_tier`),
      sourceId: text(link.source_id, `v0.9 link ${relationId}.source_id`),
      targetId: text(link.target_id, `v0.9 link ${relationId}.target_id`),
      payloadDigest: digestPayload(link),
    };
  });
  const projections = [{
    profile: 'runtime',
    projectionId: text(input.projection.id, 'v0.9 projection.id'),
    versionDigest: text(input.projection.version_digest, 'v0.9 projection.version_digest'),
    isRuntime: true,
  }];
  const components = input.components.map((row) => ({
    componentReleaseId: text(row.release_id, 'v0.9 component.release_id'),
    releaseHash: text(row.release_hash, 'v0.9 component.release_hash'),
    protocol: text(row.reference_kind ?? 'legacy_exact', 'v0.9 component.protocol'),
    referenceKind: optionalText(row.reference_kind),
    payloadDigest: digestPayload(row),
  }));
  const crosswalk = input.crosswalk.map((row) => {
    const publishedEntityId = text(row.published_entity_id, 'v0.9 crosswalk.published_entity_id');
    const retrievalChunkId = text(row.retrieval_chunk_id, 'v0.9 crosswalk.retrieval_chunk_id');
    const citationTargetId = text(row.citation_target_id, 'v0.9 crosswalk.citation_target_id');
    return {
      tripleKey: [publishedEntityId, retrievalChunkId, citationTargetId].join('\u001f'),
      publishedEntityId,
      retrievalChunkId,
      citationTargetId,
    };
  });
  const releaseIdentity = object(input.manifest.release, 'v0.9 manifest.release');
  const base = {
    releaseSetId: input.releaseSetId,
    releaseId: text(releaseIdentity.release_id, 'v0.9 release_id'),
    releaseVersion: text(releaseIdentity.release_version, 'v0.9 release_version'),
    releaseHash: text(releaseIdentity.release_hash, 'v0.9 release_hash'),
    sourceDatasetHash: text(releaseIdentity.source_dataset_hash, 'v0.9 source_dataset_hash'),
    protocol: text(input.manifest.bundle_contract_version, 'v0.9 protocol'),
    runtimeProjectionId: projections[0]!.projectionId,
    runtimeProjectionDigest: projections[0]!.versionDigest,
    objects,
    relations,
    crosswalk,
    components,
    projections,
    vocabulary: buildVocabulary(objects, relations),
  };
  return snapshotDigest(base);
}

function readGitFile(root: string, revision: string, relativePath: string): Buffer {
  try {
    return execFileSync('git', ['show', `${revision}:${relativePath}`], {
      cwd: root,
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    fail(`capture Git tree is missing ${relativePath}`);
  }
}

async function readCapturedFile(root: string, revision: string, relativePath: string): Promise<Buffer> {
  const bytes = await readFile(path.join(root, relativePath));
  const captured = readGitFile(root, revision, relativePath);
  if (!bytes.equals(captured)) fail(`v0.9 baseline drifted from capture Git tree: ${relativePath}`);
  return bytes;
}

function parseJson(bytes: Buffer, relativePath: string): JsonObject {
  try {
    return object(JSON.parse(bytes.toString('utf8')), relativePath);
  } catch {
    fail(`${relativePath} is not valid JSON`);
  }
}

/** Build the complete direct baseline/candidate impact report. */
export async function computeV018ImpactReport(input: {
  repoRoot?: string;
  captureGitRoot?: string;
  v09Root?: string;
  candidate: ValidatedActKGBundleV2;
  candidateReleaseSetId: string;
  captureRevision: string;
}): Promise<V018ImpactReport> {
  if (!/^[a-f0-9]{40}$/u.test(input.captureRevision)) fail('captureRevision must be a Git SHA');
  const repoRoot = path.resolve(input.repoRoot ?? process.cwd());
  const captureGitRoot = path.resolve(input.captureGitRoot ?? repoRoot);
  const v09Root = path.resolve(repoRoot, V09_DEFAULT_PATH);
  if (input.v09Root !== undefined && path.resolve(input.v09Root) !== v09Root) {
    fail('explicit --v09-root must resolve to the tracked v0.9 release directory');
  }
  if (captureGitRoot !== repoRoot) fail('impact captureGitRoot must be the candidate repository root');
  const captureRevision = resolveTrustedCaptureRevision({
    gitRoot: captureGitRoot,
    trackedPaths: [V09_DEFAULT_PATH],
    expectedCaptureRevision: input.captureRevision,
    fail: (reason) => fail(reason),
  });
  if (captureRevision !== input.captureRevision) fail('impact capture revision changed during baseline read');
  const captured = new Map<string, Buffer>();
  for (const relativePath of V09_BASELINE_FILES) {
    captured.set(relativePath, await readCapturedFile(repoRoot, input.captureRevision, `${V09_DEFAULT_PATH}/${relativePath}`));
  }
  const manifest = parseJson(captured.get('bundle-manifest.json')!, 'bundle-manifest.json');
  const release = parseJson(captured.get('release.json')!, 'release.json');
  const projection = parseJson(captured.get('act-projection.json')!, 'act-projection.json');
  const linkMetadata = jsonl(captured.get('projection-link-metadata.jsonl')!, 'v0.9 link metadata');
  const crosswalk = jsonl(captured.get('rag-crosswalk.jsonl')!, 'v0.9 crosswalk');
  const components = array(parseJson(captured.get('component-releases.json')!, 'component-releases.json').components, 'v0.9 components');
  const baseline = snapshotFromV09({
    manifest, release, projection, linkMetadata, crosswalk, components,
    releaseSetId: 'actkg-authority-current-v0.9',
  });
  const candidate = snapshotFromV2(input.candidate, input.candidateReleaseSetId);
  const candidateEvidence: DeltaEvidenceRef = {
    kind: 'standard_bundle',
    releaseSetId: candidate.releaseSetId,
    releaseId: candidate.releaseId,
    releaseVersion: candidate.releaseVersion,
    releaseHash: candidate.releaseHash,
    sourceDatasetHash: candidate.sourceDatasetHash,
    importReceiptId: null,
    bundleReceiptId: `bundle-receipt:v2:${input.candidate.bundleIdentity.bundleDigest}`,
    bundleId: input.candidate.bundleIdentity.bundleId,
    bundleRevision: input.candidate.bundleIdentity.bundleRevision,
    bundleDigest: input.candidate.bundleIdentity.bundleDigest,
    runtimeProjectionId: candidate.runtimeProjectionId,
    runtimeProjectionDigest: candidate.runtimeProjectionDigest,
    evidenceCaptureRevision: input.candidate.captureRevision,
    protocol: 'actkg-public-bundle/2',
    acceptedAt: null,
    semanticSnapshotDigest: candidate.semanticCollectionDigest,
  };
  const baseEvidence: DeltaEvidenceRef = {
    kind: 'standard_bundle',
    releaseSetId: baseline.releaseSetId,
    releaseId: baseline.releaseId,
    releaseVersion: baseline.releaseVersion,
    releaseHash: baseline.releaseHash,
    sourceDatasetHash: baseline.sourceDatasetHash,
    importReceiptId: null,
    bundleReceiptId: null,
    bundleId: typeof manifest.bundle_id === 'string' ? manifest.bundle_id : null,
    bundleRevision: typeof manifest.bundle_revision === 'number' ? manifest.bundle_revision : null,
    bundleDigest: typeof manifest.bundle_digest === 'string' ? manifest.bundle_digest : null,
    runtimeProjectionId: baseline.runtimeProjectionId,
    runtimeProjectionDigest: baseline.runtimeProjectionDigest,
    evidenceCaptureRevision: null,
    protocol: baseline.protocol,
    acceptedAt: null,
    semanticSnapshotDigest: baseline.semanticCollectionDigest,
  };
  const upstreamArtifact = input.candidate.rawArtifacts.find(
    (artifact) => artifact.descriptor.role === 'release_diff',
  );
  let upstreamDiff: UpstreamReleaseDiffV1 | null = null;
  let upstreamParseError: string | null = null;
  if (upstreamArtifact) {
    try {
      upstreamDiff = parseUpstreamReleaseDiff(JSON.parse(upstreamArtifact.bytes.toString('utf8')));
    } catch (error) {
      upstreamParseError = error instanceof Error ? error.message : String(error);
    }
  }
  const direct = computeReleaseSetDelta({
    baseSnapshot: baseline,
    baseEvidence,
    candidateSnapshot: candidate,
    candidateEvidence,
    captureRevision: input.captureRevision,
    upstreamDiff,
    upstreamParseError,
    upstreamRequired: false,
  });
  const upstream = upstreamDiff
    ? crossCheckUpstreamDiff(direct.details, upstreamDiff, {
      baseReleaseId: baseline.releaseId,
      candidateReleaseId: candidate.releaseId,
      baseReleaseVersion: baseline.releaseVersion,
      candidateReleaseVersion: candidate.releaseVersion,
      baseReleaseHash: baseline.releaseHash,
      candidateReleaseHash: candidate.releaseHash,
    })
    : { status: upstreamParseError ? 'PARSE_FAILED' as const : 'NOT_REQUIRED' as const, details: { error: upstreamParseError } };
  const body = {
    protocol: V018_IMPACT_REPORT_PROTOCOL,
    algorithmVersion: direct.algorithmVersion,
    baseline: {
      releaseId: baseline.releaseId,
      releaseVersion: baseline.releaseVersion,
      releaseHash: baseline.releaseHash,
      sourceDatasetHash: baseline.sourceDatasetHash,
      releaseSetId: baseline.releaseSetId,
      runtimeProjectionId: baseline.runtimeProjectionId,
      runtimeProjectionDigest: baseline.runtimeProjectionDigest,
    },
    candidate: {
      releaseId: candidate.releaseId,
      releaseVersion: candidate.releaseVersion,
      releaseHash: candidate.releaseHash,
      sourceDatasetHash: candidate.sourceDatasetHash,
      releaseSetId: candidate.releaseSetId,
      bundleId: input.candidate.bundleIdentity.bundleId,
      bundleDigest: input.candidate.bundleIdentity.bundleDigest,
      runtimeProjectionId: candidate.runtimeProjectionId!,
      runtimeProjectionDigest: candidate.runtimeProjectionDigest!,
    },
    counts: {
      baselineReleaseEntries: array(release.entries, 'v0.9 entries').length,
      candidateReleaseEntries: array(input.candidate.release.entries, 'v0.18 entries').length,
      baselineRuntimeNodes: baseline.objects.length,
      candidateRuntimeNodes: candidate.objects.length,
      baselineRuntimeLinks: baseline.relations.length,
      candidateRuntimeLinks: candidate.relations.length,
      baselineComponents: baseline.components.length,
      candidateComponents: candidate.components.length,
      baselineCrosswalkRows: baseline.crosswalk.length,
      candidateCrosswalkRows: candidate.crosswalk.length,
    },
    direct,
    upstreamCrosscheck: {
      artifactPath: upstreamArtifact?.descriptor.path ?? 'release-diff.json',
      artifactSha256: upstreamArtifact?.descriptor.sha256 ?? sha256(''),
      baseReleaseVersion: upstreamDiff?.baseRelease.releaseVersion ?? 'unknown',
      targetReleaseVersion: upstreamDiff?.targetRelease.releaseVersion ?? 'unknown',
      parsed: upstreamDiff,
      status: upstream.status,
      details: upstream.details,
    },
  };
  return {
    ...body,
    reportDigest: sha256(canonicalJson(body)),
  };
}

export function serializeV018ImpactReport(report: V018ImpactReport): string {
  return `${canonicalJson(report)}\n`;
}
