import type {
  MatchedContractIdentity,
  RegisteredAdmissionBinding,
  PublicBundleV2RegistryIdentity,
  PublicBundleV2UpstreamRepositoryIdentity,
} from './public-bundle-types';

// Reviewed contract identities for actkg-public-bundle/2 + CTKG Schema 0.3.0.
// Compatibility is keyed by compound identity, never by version string alone.

export const PUBLIC_BUNDLE_V2_CONTRACT_VERSION = 'actkg-public-bundle/2';
export const CTKG_SCHEMA_V2_VERSION = '0.3.0';
export const CTKG_SCHEMA_V2_RAW_SHA256 =
  '4850ed2e4887f7b6a4f2a08f3eb786f82ef757170befef0f3f2dbf6dc9f6cb28';

export const V2_CONTRACT_SCHEMA_RAW_HASHES = {
  'bundle-manifest.schema.json':
    '8b210ce21ab78cc7e8cca8f4f897fb99d2252525b580406cb9b2cdb469dd9701',
  'component-manifest.schema.json':
    '50e9fc1f9383a0af35a502377a9b856c86943488aa45d1ce0f8903bb2e836aec',
  'multilingual-label-index-row.schema.json':
    'a1511b8a119525b7bbf69c8db2fb45d4a6b896a00656082846373008a7700847',
  'projection-link-metadata-row.schema.json':
    'c2e3f130450db3198408110f37ba87e707aad8625f93a50e7b56476fefbf9605',
  'projection-profiles.schema.json':
    '6dbbb8ce2e5962ac765ac016c3130f972e2a77102523511786786031befbce96',
  'rag-crosswalk-row.schema.json':
    '287c3aa272985d309b0721cd90eb633580e42d58e03a5021f45f84e165f9dfee',
  'release-diff.schema.json':
    '1a653a8674cf45376d553b45cffdf873a7dcf3109454c97e3484ea68b10fa3dd',
  'validation-report.schema.json':
    '7e0c6dba8e9e331b36e47ad9b11930ee6dca6deab645fbcef9d4f84c444760e0',
} as const;

export type ArtifactRoleV2 =
  | 'release'
  | 'ctkg_schema'
  | 'projection'
  | 'projection_link_metadata'
  | 'rag_crosswalk'
  | 'component_manifest'
  | 'multilingual_label_index'
  | 'projection_profiles'
  | 'validation_report'
  | 'release_diff'
  | 'release_notes';

export interface ArtifactContractRegistrationV2 {
  role: ArtifactRoleV2 | string;
  contractVersion: string;
  requiredForAggregate: boolean;
  enableSemantics: boolean;
  allowedProfiles?: string[];
}

export const ARTIFACT_CONTRACTS_V2: readonly ArtifactContractRegistrationV2[] = [
  { role: 'release', contractVersion: 'ctkg-release/0.3', requiredForAggregate: true, enableSemantics: true },
  { role: 'ctkg_schema', contractVersion: 'ctkg-json-schema/0.3', requiredForAggregate: true, enableSemantics: true },
  {
    role: 'projection',
    contractVersion: 'ctkg-graph-projection/0.3',
    requiredForAggregate: true,
    enableSemantics: true,
    allowedProfiles: ['runtime', 'domain', 'review'],
  },
  {
    role: 'projection_link_metadata',
    contractVersion: 'actkg-projection-link-metadata/1',
    requiredForAggregate: true,
    enableSemantics: true,
    allowedProfiles: ['runtime', 'domain', 'review'],
  },
  {
    role: 'rag_crosswalk',
    contractVersion: 'actkg-rag-crosswalk/1',
    requiredForAggregate: true,
    enableSemantics: true,
  },
  {
    role: 'component_manifest',
    contractVersion: 'actkg-component-manifest/2',
    requiredForAggregate: true,
    enableSemantics: true,
  },
  {
    role: 'multilingual_label_index',
    contractVersion: 'actkg-multilingual-label-index/1',
    requiredForAggregate: true,
    enableSemantics: true,
  },
  {
    role: 'projection_profiles',
    contractVersion: 'ctkg-projection-profiles/1',
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
    role: 'release_diff',
    contractVersion: 'actkg-release-diff/1',
    requiredForAggregate: false,
    enableSemantics: false,
  },
] as const;

export const REQUIRED_V2_AGGREGATE_PROJECTION_PROFILES = ['runtime', 'domain', 'review'] as const;
export const V2_LABEL_INDEX_CONTRACT = 'actkg-multilingual-label-index/1';
export const V2_PROJECTION_PROFILE_CONTRACT = 'ctkg-projection-profiles/1';
export const V2_MAPPING_CONTRACT = 'ctkg-graph-projection-v3';
export const V2_PROFILE_VERSION = '3.0.0';

export interface ReviewedV2ComponentIdentity {
  releaseId: string;
  releaseVersion: string;
  releaseHash: string;
  componentRole: 'module' | 'integration' | 'terminology';
}

export interface ReviewedV2ProjectionProfileIdentity {
  key: 'act' | 'domain' | 'review';
  manifestProfile: 'runtime' | 'domain' | 'review';
  profileId: string;
  profileSha256: string;
  projectionKind: 'act_runtime_graph' | 'domain_graph' | 'review_graph';
}

export interface PublicBundleV2ExpectedCounts {
  releaseNodes: number;
  runtimeProjectionNodes: number;
  publishedRuntimeRelations: number;
  terminologyAssertions: number;
}

export interface PublicBundleV2Registry {
  bundleContractVersion: typeof PUBLIC_BUNDLE_V2_CONTRACT_VERSION;
  registryIdentity: string;
  upstreamRepository: PublicBundleV2UpstreamRepositoryIdentity;
  publicationTag: string;
  publicationCommit: string;
  sourceTag: string;
  sourceCommit: string;
  bundleId: string;
  bundleRevision: number;
  bundleDigest: string;
  manifestRawSha256: string;
  sha256sumsRawSha256: string;
  releaseId: string;
  releaseVersion: string;
  releaseHash: string;
  sourceDatasetHash: string;
  schemaVersion: typeof CTKG_SCHEMA_V2_VERSION;
  schemaRawSha256: typeof CTKG_SCHEMA_V2_RAW_SHA256;
  expectedCounts: PublicBundleV2ExpectedCounts;
  discoverCounts?: boolean;
  components: readonly ReviewedV2ComponentIdentity[];
  projectionProfiles: readonly ReviewedV2ProjectionProfileIdentity[];
  artifactContracts: readonly ArtifactContractRegistrationV2[];
}

export const REVIEWED_V0_18_PROJECTION_PROFILES = [
  {
    key: 'act',
    manifestProfile: 'runtime',
    profileId: 'ctr:profile:control-theory-engineering-v0.18:runtime-v3',
    profileSha256: 'a442adfc5a73d9bacba53ce33016238be148917084e057ab979340279737bfe7',
    projectionKind: 'act_runtime_graph',
  },
  {
    key: 'domain',
    manifestProfile: 'domain',
    profileId: 'ctr:profile:control-theory-engineering-v0.18:domain-v3',
    profileSha256: '3cc80a25631c7584e12f2a21d5397541d7bd1cddf062b8776591b956415cf375',
    projectionKind: 'domain_graph',
  },
  {
    key: 'review',
    manifestProfile: 'review',
    profileId: 'ctr:profile:control-theory-engineering-v0.18:review-v3',
    profileSha256: 'c474dacaa427d6f447d71787f4f586955718f9a2ab2aee87754fb9bb14513ec3',
    projectionKind: 'review_graph',
  },
] as const satisfies readonly ReviewedV2ProjectionProfileIdentity[];

export const REVIEWED_V0_18_COMPONENTS = [
  {
    releaseId: 'ctr:root-locus-engineering-v0.1',
    releaseVersion: 'root-locus-engineering-v0.1',
    releaseHash: '8b1e3832f10d4142db0c395c3b6b2188af6f400faab56f0870502e39c9493e74',
    componentRole: 'module',
  },
  {
    releaseId: 'ctr:release:system-modeling-engineering-v0.1',
    releaseVersion: 'system-modeling-engineering-v0.1',
    releaseHash: '90746513ec47be545e3b7c011450d0fc6542781998a7779797b825e91e17775b',
    componentRole: 'module',
  },
  {
    releaseId: 'ctr:release:time-domain-analysis-engineering-v0.1',
    releaseVersion: 'time-domain-analysis-engineering-v0.1',
    releaseHash: '52da8d2147f44749d4e1f8ffd99090f5e0d8c6ba6a8915433041d163cb51aff6',
    componentRole: 'module',
  },
  {
    releaseId: 'ctr:release:stability-analysis-engineering-v0.1',
    releaseVersion: 'stability-analysis-engineering-v0.1',
    releaseHash: '70fd22fba92301085e73055caa4c98e1428762eb954610abaeceb0b4bf333ece',
    componentRole: 'module',
  },
  {
    releaseId: 'ctr:release:frequency-domain-analysis-engineering-v0.1',
    releaseVersion: 'frequency-domain-analysis-engineering-v0.1',
    releaseHash: 'd414043e0ce1f11281064bffca511cf83d6e5d98232e4aad157b0237c258d26a',
    componentRole: 'module',
  },
  {
    releaseId: 'ctr:release:classical-control-design-engineering-v0.2',
    releaseVersion: 'classical-control-design-engineering-v0.2',
    releaseHash: '0fd756c79812fb85a0249dd58bf54b4e94d00a02b116d7f22c596e7e521de565',
    componentRole: 'module',
  },
  {
    releaseId: 'ctr:release:discrete-time-control-analysis-engineering-v0.1',
    releaseVersion: 'discrete-time-control-analysis-engineering-v0.1',
    releaseHash: 'b96b97d71e6844eeab9b5a00e9d14fb97dff786389256714f3f76e91581b1259',
    componentRole: 'module',
  },
  {
    releaseId: 'ctr:release:state-space-control-analysis-and-design-engineering-v0.1',
    releaseVersion: 'state-space-control-analysis-and-design-engineering-v0.1',
    releaseHash: '024690347810267c95c27a985c11be06967c15d4368a24532953ab6235a07aca',
    componentRole: 'module',
  },
  {
    releaseId: 'ctr:release:nonlinear-system-analysis-engineering-v0.1',
    releaseVersion: 'nonlinear-system-analysis-engineering-v0.1',
    releaseHash: '809e979b826ee2fc4ec79ca8a21a7268c5e5a391e9b1b8ca1b53451c1aa543f5',
    componentRole: 'module',
  },
  {
    releaseId: 'ctr:release:lyapunov-stability-engineering-v0.1',
    releaseVersion: 'lyapunov-stability-engineering-v0.1',
    releaseHash: '2c50523b9a012d94f2358ab5a3132af77c98eca7f59e935a77c79ff021af016a',
    componentRole: 'module',
  },
  {
    releaseId: 'ctr:release:discrete-time-control-design-engineering-v0.1',
    releaseVersion: 'discrete-time-control-design-engineering-v0.1',
    releaseHash: 'f699d3e121c13bf356260531bc42c8ddc05cf86ee91d3c5655bcc222fdcd8ca1',
    componentRole: 'module',
  },
  {
    releaseId: 'ctr:release:robustness-sensitivity-analysis-engineering-v0.1',
    releaseVersion: 'robustness-sensitivity-analysis-engineering-v0.1',
    releaseHash: 'c079c714354f0677ba67bf0a4465e6f301ed59850b412d00ae14907653ea5358',
    componentRole: 'module',
  },
  {
    releaseId: 'ctr:release:optimal-control-foundations-and-linear-quadratic-design-engineering-v0.1',
    releaseVersion: 'optimal-control-foundations-and-linear-quadratic-design-engineering-v0.1',
    releaseHash: '445bd3c106ccfaeeeafd5e96a8529573124d59004cb5872a7e1b62890aeafa39',
    componentRole: 'module',
  },
  {
    releaseId: 'ctr:release:robust-control-analysis-and-design-engineering-v0.1',
    releaseVersion: 'robust-control-analysis-and-design-engineering-v0.1',
    releaseHash: 'fa8376b46ee1a44739c979b0e5ab8cfa5ab79515815d71e9dc9b9ba5174811ee',
    componentRole: 'module',
  },
  {
    releaseId: 'ctr:release:nonlinear-control-design-engineering-v0.1',
    releaseVersion: 'nonlinear-control-design-engineering-v0.1',
    releaseHash: '8cfb43290b494427fdfac52badb6e7022aa6fdb918ebfc86f0694730f8a73e61',
    componentRole: 'module',
  },
  {
    releaseId: 'ctr:release:control-theory-integration-v0.15',
    releaseVersion: 'control-theory-integration-v0.15',
    releaseHash: '3f128e48ac5b2b8717bc8b661c5feb19f40227153b539800b99bc7fb1efed5b1',
    componentRole: 'integration',
  },
  {
    releaseId: 'ctr:release:control-theory-zh-cn-terminology-v0.1',
    releaseVersion: 'control-theory-zh-cn-terminology-v0.1',
    releaseHash: 'cb7c2273b16469afdb2fdf04175d6369f29e98a8a2c0fafdaf268225f58c0ae2',
    componentRole: 'terminology',
  },
] as const satisfies readonly ReviewedV2ComponentIdentity[];

export const REVIEWED_V0_18_IDENTITIES = {
  publicationTag: 'control-theory-engineering-v0.18',
  publicationCommit: 'f7b9155114b8449542f4f15335cfbed30570aef8',
  sourceTag: 'control-theory-engineering-v0.18-source-r1',
  sourceCommit: '08f732c50450d991841f382edf75394433b00f53',
  bundleId: 'ctb:control-theory-engineering-v0.18:r1',
  bundleRevision: 1,
  bundleDigest: '9caf1083ae7a13c5122546e7ff7cbf8b6b0f463438444088d9c80227624866cd',
  manifestRawSha256: '4da43f92e44f122b98b8dc93021e02c0b8d146440f7c155392fa7cc234e076ae',
  sha256sumsRawSha256: '2e4a97d7586931176c480eb544ec18fab46b8c07beda8fcc21e7418b5428f903',
  releaseId: 'ctr:release:control-theory-engineering-v0.18',
  releaseVersion: 'control-theory-engineering-v0.18',
  releaseHash: '73fdb59ccf8748e3d4a8625d3e4d1499de14d7182804d18c4e6c9b6eb54b7c60',
  sourceDatasetHash: '1763943f26b4d120d342556096d9de38de6e6d1ceb2eb91254764b56ee8624e0',
  projectionProfilesArtifactSha256:
    'd499de1173299aef3f47a7abb2865d2af6ccb26e2ef3e9b572c0781f8bbc4344',
} as const;

export const REVIEWED_V0_18_EXPECTED_COUNTS = {
  releaseNodes: 7061,
  runtimeProjectionNodes: 6843,
  publishedRuntimeRelations: 2811,
  terminologyAssertions: 1909,
} as const satisfies PublicBundleV2ExpectedCounts;

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (!value || typeof value !== 'object') return value;
  const objectValue = value as object;
  if (seen.has(objectValue)) return value;
  seen.add(objectValue);
  for (const child of Object.values(objectValue)) {
    deepFreeze(child, seen);
  }
  return Object.freeze(value);
}

export const REVIEWED_V0_18_V2_REGISTRY: PublicBundleV2Registry = deepFreeze({
  bundleContractVersion: PUBLIC_BUNDLE_V2_CONTRACT_VERSION,
  registryIdentity: 'actkg-public-bundle-v2:control-theory-engineering-v0.18:r1',
  upstreamRepository: {
    repositoryId: 'github.com/yong-wei/ActKG',
    remoteUrl: 'https://github.com/yong-wei/ActKG.git',
  },
  publicationTag: REVIEWED_V0_18_IDENTITIES.publicationTag,
  publicationCommit: REVIEWED_V0_18_IDENTITIES.publicationCommit,
  sourceTag: REVIEWED_V0_18_IDENTITIES.sourceTag,
  sourceCommit: REVIEWED_V0_18_IDENTITIES.sourceCommit,
  bundleId: REVIEWED_V0_18_IDENTITIES.bundleId,
  bundleRevision: REVIEWED_V0_18_IDENTITIES.bundleRevision,
  bundleDigest: REVIEWED_V0_18_IDENTITIES.bundleDigest,
  manifestRawSha256: REVIEWED_V0_18_IDENTITIES.manifestRawSha256,
  sha256sumsRawSha256: REVIEWED_V0_18_IDENTITIES.sha256sumsRawSha256,
  releaseId: REVIEWED_V0_18_IDENTITIES.releaseId,
  releaseVersion: REVIEWED_V0_18_IDENTITIES.releaseVersion,
  releaseHash: REVIEWED_V0_18_IDENTITIES.releaseHash,
  sourceDatasetHash: REVIEWED_V0_18_IDENTITIES.sourceDatasetHash,
  schemaVersion: CTKG_SCHEMA_V2_VERSION,
  schemaRawSha256: CTKG_SCHEMA_V2_RAW_SHA256,
  expectedCounts: REVIEWED_V0_18_EXPECTED_COUNTS,
  components: REVIEWED_V0_18_COMPONENTS,
  projectionProfiles: REVIEWED_V0_18_PROJECTION_PROFILES,
  artifactContracts: ARTIFACT_CONTRACTS_V2,
});

/** Return an independently frozen snapshot of a reviewed registry object. */
export function freezePublicBundleV2Registry(
  registry: PublicBundleV2Registry,
): PublicBundleV2Registry {
  return deepFreeze(structuredClone(registry));
}

export function publicBundleV2RegistryIdentity(
  registry: PublicBundleV2Registry = REVIEWED_V0_18_V2_REGISTRY,
): PublicBundleV2RegistryIdentity {
  return {
    registryId: registry.registryIdentity,
    bundleContractVersion: registry.bundleContractVersion,
    bundleId: registry.bundleId,
    bundleRevision: registry.bundleRevision,
    bundleDigest: registry.bundleDigest,
    manifestRawSha256: registry.manifestRawSha256,
    sha256sumsRawSha256: registry.sha256sumsRawSha256,
    releaseId: registry.releaseId,
    releaseVersion: registry.releaseVersion,
    releaseHash: registry.releaseHash,
    schemaVersion: registry.schemaVersion,
    schemaRawSha256: registry.schemaRawSha256,
  };
}

/**
 * Build the loader's registration provenance from the module-controlled
 * registry. This is intentionally not an admission result and never carries
 * a PASS/status field or claims that loading executed Git.
 */
export function registeredAdmissionBinding(
  registry: PublicBundleV2Registry = REVIEWED_V0_18_V2_REGISTRY,
): RegisteredAdmissionBinding {
  return deepFreeze({
    provenance: 'registry' as const,
    verificationScope: 'admission-time' as const,
    verifiedDuringLoad: false as const,
    registryIdentity: publicBundleV2RegistryIdentity(registry),
    upstreamRepository: { ...registry.upstreamRepository },
    publicationRevision: {
      tag: registry.publicationTag,
      commit: registry.publicationCommit,
    },
    sourceRevision: {
      tag: registry.sourceTag,
      commit: registry.sourceCommit,
    },
    bundleIdentity: {
      bundleContractVersion: registry.bundleContractVersion,
      bundleId: registry.bundleId,
      bundleRevision: registry.bundleRevision,
      bundleDigest: registry.bundleDigest,
    },
  });
}

export function findArtifactContractV2(
  role: string,
  contractVersion: string,
  registry: PublicBundleV2Registry = REVIEWED_V0_18_V2_REGISTRY,
): ArtifactContractRegistrationV2 | undefined {
  return registry.artifactContracts.find(
    (entry) => entry.role === role && entry.contractVersion === contractVersion,
  );
}

export function isBundleContractV2(version: string): boolean {
  return version === PUBLIC_BUNDLE_V2_CONTRACT_VERSION;
}

export function isSchemaIdentityV2Supported(version: string, rawSha256: string): boolean {
  return version === CTKG_SCHEMA_V2_VERSION && rawSha256 === CTKG_SCHEMA_V2_RAW_SHA256;
}

export function matchedV2RegistryIdentities(
  registry: PublicBundleV2Registry = REVIEWED_V0_18_V2_REGISTRY,
): MatchedContractIdentity[] {
  return [
    {
      kind: 'bundle_contract',
      id: registry.bundleContractVersion,
    },
    {
      kind: 'schema',
      id: 'ctkg.schema.json',
      version: registry.schemaVersion,
      sha256: registry.schemaRawSha256,
    },
    {
      kind: 'bundle',
      id: registry.bundleId,
      version: String(registry.bundleRevision),
      sha256: registry.bundleDigest,
    },
    {
      kind: 'release',
      id: registry.releaseId,
      sha256: registry.releaseHash,
    },
    ...registry.artifactContracts
      .filter((entry) => entry.requiredForAggregate)
      .map((entry) => ({
        kind: 'artifact_contract' as const,
        id: `${entry.role}@${entry.contractVersion}`,
        version: entry.contractVersion,
      })),
  ];
}
