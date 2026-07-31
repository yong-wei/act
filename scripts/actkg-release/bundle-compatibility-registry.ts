import type { MatchedContractIdentity } from './public-bundle-types';

// Reviewed contract identities for actkg-public-bundle/1 + CTKG Schema 0.2.0.
// Compatibility is keyed by compound identity, never by version string alone.

export const PUBLIC_BUNDLE_CONTRACT_VERSION = 'actkg-public-bundle/1';
export const CTKG_SCHEMA_VERSION = '0.2.0';
export const CTKG_SCHEMA_RAW_SHA256 =
  '3598f0c89f1f32ff1812e823454a17502873ccb5e9577656e6485a7e030233de';
export const RELEASE_SET_LOCK_V3 = 'actkg-release-set-lock/v3';
export const MANIFEST_NORMALIZATION = 'canonical-json/rfc8785-subset-v1';

export const CONTRACT_SCHEMA_RAW_HASHES = {
  'bundle-manifest.schema.json':
    '24e493f5ee8f45079993bd1b667ac6d979452b8a10efb9caf6d8fa33d67c4db6',
  'component-manifest.schema.json':
    'b024b51643d54f44afc1a675eb466d2e949a65f31900beb0ee95d826f80df2c8',
  'projection-link-metadata-row.schema.json':
    'c2e3f130450db3198408110f37ba87e707aad8625f93a50e7b56476fefbf9605',
  'rag-crosswalk-row.schema.json':
    '287c3aa272985d309b0721cd90eb633580e42d58e03a5021f45f84e165f9dfee',
  'release-diff.schema.json':
    '1a653a8674cf45376d553b45cffdf873a7dcf3109454c97e3484ea68b10fa3dd',
  'validation-report.schema.json':
    '7e0c6dba8e9e331b36e47ad9b11930ee6dca6deab645fbcef9d4f84c444760e0',
} as const;

export type ArtifactRole =
  | 'release'
  | 'ctkg_schema'
  | 'projection'
  | 'projection_link_metadata'
  | 'rag_crosswalk'
  | 'component_manifest'
  | 'provenance_stubs'
  | 'validation_report'
  | 'release_diff'
  | 'release_notes';

export interface ArtifactContractRegistration {
  role: ArtifactRole | string;
  contractVersion: string;
  requiredForAggregate: boolean;
  enableSemantics: boolean;
  allowedProfiles?: string[];
}

// Required Artifact contracts for aggregate public Bundles under actkg-public-bundle/1.
export const ARTIFACT_CONTRACTS: readonly ArtifactContractRegistration[] = [
  { role: 'release', contractVersion: 'ctkg-release/0.2', requiredForAggregate: true, enableSemantics: true },
  { role: 'ctkg_schema', contractVersion: 'ctkg-json-schema/0.2', requiredForAggregate: true, enableSemantics: true },
  {
    role: 'projection',
    contractVersion: 'ctkg-graph-projection/0.2',
    requiredForAggregate: true,
    enableSemantics: true,
    allowedProfiles: ['runtime', 'domain', 'review', 'act'],
  },
  {
    role: 'projection_link_metadata',
    contractVersion: 'actkg-projection-link-metadata/1',
    requiredForAggregate: true,
    enableSemantics: true,
    allowedProfiles: ['runtime', 'domain', 'review', 'act'],
  },
  {
    role: 'rag_crosswalk',
    contractVersion: 'actkg-rag-crosswalk/1',
    requiredForAggregate: true,
    enableSemantics: true,
  },
  {
    role: 'component_manifest',
    contractVersion: 'actkg-component-manifest/1',
    requiredForAggregate: true,
    enableSemantics: true,
  },
  {
    role: 'validation_report',
    contractVersion: 'actkg-validation-report/1',
    requiredForAggregate: true,
    enableSemantics: true,
  },
  {
    role: 'release_notes',
    contractVersion: 'actkg-release-notes/1',
    requiredForAggregate: true,
    enableSemantics: false,
  },
  {
    role: 'provenance_stubs',
    contractVersion: 'actkg-provenance-stubs/1',
    requiredForAggregate: false,
    enableSemantics: false,
  },
  {
    role: 'release_diff',
    contractVersion: 'actkg-release-diff/1',
    requiredForAggregate: false,
    enableSemantics: false,
  },
] as const;

export const RUNTIME_PROJECTION_PROFILES = new Set(['runtime', 'act']);
export const REQUIRED_AGGREGATE_PROJECTION_PROFILES = ['runtime', 'domain', 'review'] as const;
export const PROJECTION_AGGREGATION_POLICIES = [
  'm1e-v1b-release-tier-preserving',
  'm1f-v1t-release-tier-preserving',
  'm1f-v3e-release-tier-preserving',
  'm1g-v1e-release-tier-preserving',
] as const;
export const PROFILE_ALIASES: Record<string, string> = {
  act: 'runtime',
};

export const FORBIDDEN_PUBLIC_FIELD_TOKENS = [
  '"raw_text"',
  '"exact_quote"',
  '"model_response"',
  '"full_response"',
  '"private_review_draft"',
  '"review_draft"',
] as const;

export const FORBIDDEN_PUBLIC_GLOBAL_TOKENS = [
  '/Users/',
  '/home/',
  'SILICONFLOW_API_KEY',
  'BEGIN PRIVATE KEY',
] as const;

export function findArtifactContract(
  role: string,
  contractVersion: string,
): ArtifactContractRegistration | undefined {
  return ARTIFACT_CONTRACTS.find(
    (entry) => entry.role === role && entry.contractVersion === contractVersion,
  );
}

export function isSchemaIdentitySupported(version: string, rawSha256: string): boolean {
  return version === CTKG_SCHEMA_VERSION && rawSha256 === CTKG_SCHEMA_RAW_SHA256;
}

export function isBundleContractSupported(version: string): boolean {
  return version === PUBLIC_BUNDLE_CONTRACT_VERSION;
}

export function normalizeProjectionProfile(profile: string): string {
  return PROFILE_ALIASES[profile] ?? profile;
}

export function matchedRegistryIdentities(): MatchedContractIdentity[] {
  return [
    {
      kind: 'bundle_contract',
      id: PUBLIC_BUNDLE_CONTRACT_VERSION,
    },
    {
      kind: 'schema',
      id: 'ctkg.schema.json',
      version: CTKG_SCHEMA_VERSION,
      sha256: CTKG_SCHEMA_RAW_SHA256,
    },
    ...ARTIFACT_CONTRACTS.filter((entry) => entry.requiredForAggregate).map((entry) => ({
      kind: 'artifact_contract' as const,
      id: `${entry.role}@${entry.contractVersion}`,
      version: entry.contractVersion,
    })),
  ];
}

export const REVIEWED_V0_3_R2_IDENTITIES = {
  bundleId: 'ctb:control-theory-engineering-v0.3:r2',
  bundleRevision: 2,
  bundleDigest: 'ab6c33fb06d4beefda1c23f8329619caf4e572e252ddd69ba443d2a48364acb9',
  manifestRawSha256: 'e5499fc08da9386dee098a84785b6ae721d3c94cef9b948a2491a80992ebc09a',
  releaseId: 'ctr:release:control-theory-engineering-v0.3',
  releaseVersion: 'control-theory-engineering-v0.3',
  releaseHash: '13fc60a0a4e1706095f4db89f0a0db4cba10525f4cd6e9ec08b7d44acd7a4ffc',
  sourceDatasetHash: '7ada10dbb5862ea1fa0102453bceff31c7b62c9045b2f14a1aba29bf5762911c',
  sourceCommit: '5240c0c16378c4f8aa2bfbf2dd1d73c94f28f718',
  sourceTag: 'control-theory-engineering-v0.3-source',
  publicationTag: 'control-theory-engineering-v0.3-r2',
  upstreamHead: '7f2ff5f154acf7b34a89e67b64867f16ce5b111e',
} as const;
