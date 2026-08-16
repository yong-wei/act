import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  computeCanonicalReleaseHash,
  computeProjectionVersionDigest,
} from '../../actkg-canonical-digests';
import { canonicalJson, sha256 } from '../../authoritative-release';
import {
  ARTIFACT_CONTRACTS_V2,
  CTKG_SCHEMA_V2_RAW_SHA256,
  CTKG_SCHEMA_V2_VERSION,
  PUBLIC_BUNDLE_V2_CONTRACT_VERSION,
  REVIEWED_V0_18_IDENTITIES,
  REVIEWED_V0_18_PROJECTION_PROFILES,
  type PublicBundleV2Registry,
  type ReviewedV2ComponentIdentity,
} from '../../bundle-compatibility-registry-v2';
import type { JsonObject } from '../../public-bundle-types';

export const V2_FIXTURE_ROOT = 'scripts/actkg-release/fixtures/public-bundle-v2';
export const V2_EXACT_DIR = `${V2_FIXTURE_ROOT}/exact`;
export const MINI_BUNDLE_PATH = 'releases/control-theory-engineering-v0.18-mini';

const ZERO = '0'.repeat(64);
const SOURCE_COMMIT = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

type MiniRelease = JsonObject & {
  id: string;
  release_version: string;
  source_dataset_hash: string;
};

export interface MiniBundleEntities {
  nodeA: string;
  nodeB: string;
  relation: string;
  assertion: string;
}

export const MINI_ENTITIES: MiniBundleEntities = {
  nodeA: 'ctc:mini-gain',
  nodeB: 'ctc:mini-state-variable',
  relation: 'ctkg:mini-relation-associates',
  assertion: 'ctt:mini-assertion-gain',
};

const MINI_COMPONENTS: readonly ReviewedV2ComponentIdentity[] = [
  {
    releaseId: 'ctr:release:mini-module-v1',
    releaseVersion: 'mini-module-v1',
    releaseHash: '1111111111111111111111111111111111111111111111111111111111111111',
    componentRole: 'module',
  },
  {
    releaseId: 'ctr:release:mini-terminology-v1',
    releaseVersion: 'mini-terminology-v1',
    releaseHash: '2222222222222222222222222222222222222222222222222222222222222222',
    componentRole: 'terminology',
  },
];

function pretty(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function ndjson(rows: JsonObject[]): Buffer {
  return Buffer.from(`${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8');
}

function projectedNode(entityId: string, displayName: string, assertionIds: string[]): JsonObject {
  return {
    id: entityId,
    entity_id: entityId,
    entity_type: 'DomainConcept',
    display_name: displayName,
    release_tier: 'gold',
    review_status: 'approved',
    publication_status: 'published',
    source_coverage_count: 1,
    candidate: false,
    terminology_assertion_ids: assertionIds,
  };
}

async function writeSha256Sums(bundleDir: string, files: string[]): Promise<Buffer> {
  const lines: string[] = [];
  for (const relative of [...files].sort()) {
    const bytes = await readFile(path.join(bundleDir, ...relative.split('/')));
    lines.push(`${sha256(bytes)}  ${relative}`);
  }
  const body = Buffer.from(`${lines.join('\n')}\n`, 'utf8');
  await writeFile(path.join(bundleDir, 'SHA256SUMS'), body);
  return body;
}

export async function buildAcceptedV2MiniBundle(destinationRoot: string): Promise<{
  bundlePath: string;
  bundleDir: string;
  registry: PublicBundleV2Registry;
}> {
  const bundlePath = MINI_BUNDLE_PATH;
  const bundleDir = path.join(destinationRoot, bundlePath);
  await mkdir(path.join(bundleDir, 'components'), { recursive: true });
  await cp(
    path.join(process.cwd(), V2_EXACT_DIR, 'ctkg.schema.json'),
    path.join(bundleDir, 'ctkg.schema.json'),
  );
  await cp(
    path.join(process.cwd(), V2_EXACT_DIR, 'projection-profiles.json'),
    path.join(bundleDir, 'projection-profiles.json'),
  );

  const profiles = JSON.parse(
    await readFile(path.join(bundleDir, 'projection-profiles.json'), 'utf8'),
  ) as { profiles: JsonObject[] };
  const profileByKind = new Map(
    profiles.profiles.map((profile) => [String(profile.projection_kind), profile]),
  );

  const componentFiles = [
    {
      relative: 'components/mini-module-v1.release.json',
      identity: MINI_COMPONENTS[0]!,
    },
    {
      relative: 'components/mini-terminology-v1.release.json',
      identity: MINI_COMPONENTS[1]!,
    },
  ];
  for (const file of componentFiles) {
    await writeFile(path.join(bundleDir, file.relative), pretty({
      id: file.identity.releaseId,
      release_version: file.identity.releaseVersion,
      release_hash: file.identity.releaseHash,
    }));
  }

  const releaseEntries = [
    {
      entity: MINI_ENTITIES.nodeA,
      entity_role: 'knowledge_object',
      inclusion_reason: 'mini runtime member',
      release_tier: 'gold',
    },
    {
      entity: MINI_ENTITIES.nodeB,
      entity_role: 'knowledge_object',
      inclusion_reason: 'mini runtime member',
      release_tier: 'gold',
    },
    {
      entity: MINI_ENTITIES.relation,
      entity_role: 'relation',
      inclusion_reason: 'mini published relation',
      release_tier: 'gold',
    },
  ];
  const releaseWithoutHash: MiniRelease = {
    id: 'ctr:release:control-theory-engineering-v0.18-mini',
    release_version: 'control-theory-engineering-v0.18-mini',
    schema_version: CTKG_SCHEMA_V2_VERSION,
    lifecycle_status: 'accepted',
    publication_status: 'published',
    released_at: '2026-08-14T00:00:00+08:00',
    validation_report_uri: 'urn:ctkg:validation:control-theory-engineering-v0.18-mini',
    source_dataset_hash: '3333333333333333333333333333333333333333333333333333333333333333',
    component_releases: MINI_COMPONENTS.map((component) => component.releaseId),
    included_entities: releaseEntries.map((entry) => entry.entity),
    entries: releaseEntries,
  };
  const releaseHash = computeCanonicalReleaseHash(releaseWithoutHash);
  const release: MiniRelease = { ...releaseWithoutHash, release_hash: releaseHash };
  await writeFile(path.join(bundleDir, 'release.json'), pretty(release));

  const nodes = [
    projectedNode(MINI_ENTITIES.nodeA, '增益', [MINI_ENTITIES.assertion]),
    projectedNode(MINI_ENTITIES.nodeB, '状态变量', []),
  ];
  const links = [
    {
      id: 'ctr:projection-link:mini:1',
      relation_id: MINI_ENTITIES.relation,
      source_id: MINI_ENTITIES.nodeA,
      target_id: MINI_ENTITIES.nodeB,
      relation_type: 'association',
      relation_family: 'domain_semantic',
      direction: 'unordered',
      evidence_state: 'available',
    },
  ];

  const projectionSpecs = [
    { file: 'act-projection.json', profile: 'runtime', kind: 'act_runtime_graph', suffix: 'runtime-v3' },
    { file: 'domain-projection.json', profile: 'domain', kind: 'domain_graph', suffix: 'domain-v3' },
    { file: 'review-projection.json', profile: 'review', kind: 'review_graph', suffix: 'review-v3' },
  ] as const;
  for (const spec of projectionSpecs) {
    const profileRecord = profileByKind.get(spec.kind)!;
    const projection: JsonObject = {
      id: `ctr:projection:control-theory-engineering-v0.18-mini:${spec.suffix}`,
      projection_profile: String(profileRecord.id),
      schema_version: CTKG_SCHEMA_V2_VERSION,
      lifecycle_status: 'accepted',
      source_release: String(release.id),
      source_release_hash: releaseHash,
      source_dataset_hash: String(release.source_dataset_hash),
      nodes,
      links,
      hidden_entities: [],
      version_digest: ZERO,
    };
    projection.version_digest = computeProjectionVersionDigest(projection, profileRecord, spec.profile);
    await writeFile(path.join(bundleDir, spec.file), pretty(projection));
  }

  await writeFile(path.join(bundleDir, 'multilingual-label-index.jsonl'), ndjson([
    {
      entity_id: MINI_ENTITIES.nodeA,
      language: 'zh-CN',
      label: '增益',
      label_type: 'canonical_preferred',
      terminology_assertion_id: MINI_ENTITIES.assertion,
    },
  ]));
  await writeFile(path.join(bundleDir, 'projection-link-metadata.jsonl'), ndjson([
    {
      relation_id: MINI_ENTITIES.relation,
      release_tier: 'gold',
      evidence_refs: ['cte:mini-evidence:1'],
      relation_component_release: MINI_COMPONENTS[0]!.releaseId,
      source_component_release: MINI_COMPONENTS[0]!.releaseId,
      target_component_release: MINI_COMPONENTS[0]!.releaseId,
      source_release: String(release.id),
      source_release_hash: releaseHash,
    },
  ]));
  await writeFile(path.join(bundleDir, 'rag-crosswalk.jsonl'), ndjson([
    {
      published_entity_id: MINI_ENTITIES.nodeA,
      retrieval_chunk_id: 'ctr:retrieval:mini-1',
      citation_target_id: 'ctr:citation:mini-1',
    },
  ]));
  await writeFile(path.join(bundleDir, 'release-diff.json'), pretty({
    contract_version: 'actkg-release-diff/1',
    base_release: {
      release_id: 'ctr:release:control-theory-engineering-v0.17',
      release_version: 'control-theory-engineering-v0.17',
      release_hash: '27180b7682018bef5a5bad1c9550cef40fcdf216b93c09674c255470c308e1bc',
    },
    target_release: {
      release_id: String(release.id),
      release_version: String(release.release_version),
      release_hash: releaseHash,
    },
    objects: { added: [], changed: [], removed: [] },
    relations: { added: [], changed: [], removed: [] },
    crosswalk: { added_count: 0, removed_count: 0 },
    components: { added: [MINI_COMPONENTS[1]!.releaseId], removed: [] },
  }));
  await writeFile(
    path.join(bundleDir, 'RELEASE-NOTES.md'),
    '# mini v2 fixture\n\nBounded semantic fixture for Bundle v2 adapter tests.\n',
  );

  const manifestComponents = await Promise.all(componentFiles.map(async (file) => ({
    release_id: file.identity.releaseId,
    release_version: file.identity.releaseVersion,
    release_hash: file.identity.releaseHash,
    component_role: file.identity.componentRole,
    component_path: file.relative,
    component_sha256: sha256(await readFile(path.join(bundleDir, file.relative))),
    source_release_hash: file.identity.releaseHash,
    source_revision: { commit: SOURCE_COMMIT },
  })));
  await writeFile(path.join(bundleDir, 'component-releases.json'), pretty({
    contract_version: 'actkg-component-manifest/2',
    components: manifestComponents,
  }));

  const artifactSpecs: Array<{
    role: string;
    contract: string;
    required: boolean;
    path: string;
    mediaType: string;
    profile?: string;
    profiles?: string[];
  }> = [
    { role: 'release', contract: 'ctkg-release/0.3', required: true, path: 'release.json', mediaType: 'application/json' },
    { role: 'ctkg_schema', contract: 'ctkg-json-schema/0.3', required: true, path: 'ctkg.schema.json', mediaType: 'application/schema+json' },
    { role: 'component_manifest', contract: 'actkg-component-manifest/2', required: true, path: 'component-releases.json', mediaType: 'application/json' },
    { role: 'multilingual_label_index', contract: 'actkg-multilingual-label-index/1', required: true, path: 'multilingual-label-index.jsonl', mediaType: 'application/x-ndjson' },
    { role: 'projection', contract: 'ctkg-graph-projection/0.3', required: true, path: 'act-projection.json', mediaType: 'application/json', profile: 'runtime' },
    { role: 'projection', contract: 'ctkg-graph-projection/0.3', required: true, path: 'domain-projection.json', mediaType: 'application/json', profile: 'domain' },
    { role: 'projection', contract: 'ctkg-graph-projection/0.3', required: true, path: 'review-projection.json', mediaType: 'application/json', profile: 'review' },
    { role: 'projection_profiles', contract: 'ctkg-projection-profiles/1', required: true, path: 'projection-profiles.json', mediaType: 'application/json' },
    {
      role: 'projection_link_metadata',
      contract: 'actkg-projection-link-metadata/1',
      required: true,
      path: 'projection-link-metadata.jsonl',
      mediaType: 'application/x-ndjson',
      profiles: ['runtime', 'domain', 'review'],
    },
    { role: 'rag_crosswalk', contract: 'actkg-rag-crosswalk/1', required: true, path: 'rag-crosswalk.jsonl', mediaType: 'application/x-ndjson' },
    { role: 'release_diff', contract: 'actkg-release-diff/1', required: false, path: 'release-diff.json', mediaType: 'application/json' },
    { role: 'release_notes', contract: 'actkg-release-notes/1', required: true, path: 'RELEASE-NOTES.md', mediaType: 'text/markdown' },
  ];

  const artifacts = [];
  for (const spec of artifactSpecs) {
    const bytes = await readFile(path.join(bundleDir, spec.path));
    artifacts.push({
      role: spec.role,
      contract_version: spec.contract,
      required: spec.required,
      path: spec.path,
      media_type: spec.mediaType,
      sha256: sha256(bytes),
      byte_length: bytes.byteLength,
      record_count: spec.mediaType.includes('ndjson')
        ? bytes.toString('utf8').split(/\r?\n/u).filter((line) => line.length > 0).length
        : null,
      ...(spec.profile ? { profile: spec.profile } : {}),
      ...(spec.profiles ? { profiles: spec.profiles } : {}),
    });
  }

  const report = {
    contract_version: 'actkg-validation-report/1',
    bundle_id: 'ctb:control-theory-engineering-v0.18-mini:r1',
    release: {
      release_id: String(release.id),
      release_version: String(release.release_version),
      release_hash: releaseHash,
      source_dataset_hash: String(release.source_dataset_hash),
    },
    schema_version: '0.2.0',
    source_revision: {
      commit: SOURCE_COMMIT,
      tag: 'control-theory-engineering-v0.18-mini-source',
    },
    gates: { PRIVACY_SCAN_GATE: 'PASS' },
    statistics: {
      release_entries: 3,
      knowledge_nodes: 2,
      published_relations: 1,
      projection_nodes: 2,
      projection_links: 1,
      rag_crosswalk_rows: 1,
      component_count: 2,
      relation_type_count: 1,
    },
    artifact_validation: artifacts.map((artifact) => ({
      path: artifact.path,
      sha256: artifact.sha256,
      byte_length: artifact.byte_length,
      record_count: artifact.record_count,
      result: 'PASS',
    })),
    component_validation: manifestComponents.map((component) => ({
      release_id: component.release_id,
      reference_kind: 'legacy_exact',
      release_raw_sha256: component.component_sha256,
      result: 'PASS',
    })),
    projection_validation: [{ check: 'profile_binding', result: 'PASS' }],
    privacy_validation: [{ check: 'forbidden_public_content', result: 'PASS' }],
    reproducibility_validation: [{ check: 'canonical_serialization', result: 'PASS' }],
    result: 'PASS',
  };
  await writeFile(path.join(bundleDir, 'validation-report.json'), pretty(report));
  const reportBytes = await readFile(path.join(bundleDir, 'validation-report.json'));
  artifacts.push({
    role: 'validation_report',
    contract_version: 'actkg-validation-report/1',
    required: true,
    path: 'validation-report.json',
    media_type: 'application/json',
    sha256: sha256(reportBytes),
    byte_length: reportBytes.byteLength,
    record_count: null,
  });
  report.artifact_validation = artifacts
    .filter((artifact) => artifact.role !== 'validation_report')
    .map((artifact) => ({
      path: artifact.path,
      sha256: artifact.sha256,
      byte_length: artifact.byte_length,
      record_count: artifact.record_count,
      result: 'PASS',
    }));
  await writeFile(path.join(bundleDir, 'validation-report.json'), pretty(report));
  const finalReportBytes = await readFile(path.join(bundleDir, 'validation-report.json'));
  const reportArtifact = artifacts.find((artifact) => artifact.role === 'validation_report')!;
  reportArtifact.sha256 = sha256(finalReportBytes);
  reportArtifact.byte_length = finalReportBytes.byteLength;

  const manifest: JsonObject = {
    bundle_contract_version: PUBLIC_BUNDLE_V2_CONTRACT_VERSION,
    bundle_id: 'ctb:control-theory-engineering-v0.18-mini:r1',
    bundle_revision: 1,
    bundle_kind: 'aggregate',
    release_stage: 'stable',
    schema: { version: CTKG_SCHEMA_V2_VERSION, sha256: CTKG_SCHEMA_V2_RAW_SHA256 },
    release: {
      release_id: String(release.id),
      release_version: String(release.release_version),
      release_hash: releaseHash,
      source_dataset_hash: String(release.source_dataset_hash),
    },
    source_revision: {
      commit: SOURCE_COMMIT,
      tag: 'control-theory-engineering-v0.18-mini-source',
    },
    coverage: {
      coverage_version: 'mini-coverage-v1',
      matrix_sha256: '4444444444444444444444444444444444444444444444444444444444444444',
      binding_sha256: '5555555555555555555555555555555555555555555555555555555555555555',
    },
    artifacts,
    components: manifestComponents,
    statistics: {
      knowledge_nodes: 2,
      published_relations: 1,
      terminology_assertions: 1,
    },
    bundle_digest: ZERO,
  };
  const digestBody = structuredClone(manifest);
  delete digestBody.bundle_digest;
  manifest.bundle_digest = sha256(canonicalJson(digestBody));
  await writeFile(path.join(bundleDir, 'bundle-manifest.json'), pretty(manifest));
  const sumsBytes = await writeSha256Sums(bundleDir, [
    'bundle-manifest.json',
    ...artifacts.map((artifact) => artifact.path),
    ...componentFiles.map((file) => file.relative),
  ]);

  const registry: PublicBundleV2Registry = {
    bundleContractVersion: PUBLIC_BUNDLE_V2_CONTRACT_VERSION,
    registryIdentity: 'actkg-public-bundle-v2-fixture:control-theory-engineering-v0.18-mini:r1',
    upstreamRepository: {
      repositoryId: 'github.com/yong-wei/ActKG',
      remoteUrl: 'https://github.com/yong-wei/ActKG.git',
    },
    publicationTag: 'control-theory-engineering-v0.18-mini',
    publicationCommit: SOURCE_COMMIT,
    sourceTag: 'control-theory-engineering-v0.18-mini-source',
    sourceCommit: SOURCE_COMMIT,
    bundleId: String(manifest.bundle_id),
    bundleRevision: 1,
    bundleDigest: String(manifest.bundle_digest),
    manifestRawSha256: sha256(await readFile(path.join(bundleDir, 'bundle-manifest.json'))),
    sha256sumsRawSha256: sha256(sumsBytes),
    releaseId: String(release.id),
    releaseVersion: String(release.release_version),
    releaseHash,
    sourceDatasetHash: String(release.source_dataset_hash),
    schemaVersion: CTKG_SCHEMA_V2_VERSION,
    schemaRawSha256: CTKG_SCHEMA_V2_RAW_SHA256,
    expectedCounts: {
      releaseNodes: 2,
      runtimeProjectionNodes: 2,
      publishedRuntimeRelations: 1,
      terminologyAssertions: 1,
    },
    components: MINI_COMPONENTS,
    projectionProfiles: REVIEWED_V0_18_PROJECTION_PROFILES,
    artifactContracts: ARTIFACT_CONTRACTS_V2,
  };

  return { bundlePath, bundleDir, registry };
}

export { REVIEWED_V0_18_IDENTITIES };
