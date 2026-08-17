import {
  ARTIFACT_CONTRACTS_V2,
  CTKG_SCHEMA_V2_RAW_SHA256,
  CTKG_SCHEMA_V2_VERSION,
  PUBLIC_BUNDLE_V2_CONTRACT_VERSION,
  type PublicBundleV2Registry,
  type ReviewedV2ComponentIdentity,
  type ReviewedV2ProjectionProfileIdentity,
} from './bundle-compatibility-registry-v2';

export type { PublicBundleV2Registry };

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

export const REVIEWED_V0_22_COMPONENTS = [
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
    releaseId: 'ctr:release:time-domain-analysis-engineering-v0.2',
    releaseVersion: 'time-domain-analysis-engineering-v0.2',
    releaseHash: '84ca6e893d06b1eb088e811c099c3ab937e62a15123f7783c5d33990cfc997dd',
    componentRole: 'module',
  },
  {
    releaseId: 'ctr:release:stability-analysis-engineering-v0.1',
    releaseVersion: 'stability-analysis-engineering-v0.1',
    releaseHash: '70fd22fba92301085e73055caa4c98e1428762eb954610abaeceb0b4bf333ece',
    componentRole: 'module',
  },
  {
    releaseId: 'ctr:release:frequency-domain-analysis-engineering-v0.4',
    releaseVersion: 'frequency-domain-analysis-engineering-v0.4',
    releaseHash: '2f97539dae0bf0a99d9f2d47fdd7e51fbc7fb2c0ab481e9dc22991b0f303c978',
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
    releaseId: 'ctr:release:control-theory-integration-v0.20',
    releaseVersion: 'control-theory-integration-v0.20',
    releaseHash: 'd43c7317454cd4d727eb69ad3358b9c7f545446bbeafddceb11d18cf5647c353',
    componentRole: 'integration',
  },
  {
    releaseId: 'ctr:release:control-theory-zh-cn-terminology-v0.5',
    releaseVersion: 'control-theory-zh-cn-terminology-v0.5',
    releaseHash: '0a7fb47b27c3bc1f3ad582e5cd26ac4a6577d01077d8038bba41ed61345d5bd0',
    componentRole: 'terminology',
  },
] as const satisfies readonly ReviewedV2ComponentIdentity[];

export const REVIEWED_V0_22_PROJECTION_PROFILES = [
  {
    key: 'act',
    manifestProfile: 'runtime',
    profileId: 'ctr:profile:control-theory-engineering-v0.22:runtime-v3',
    profileSha256: 'cfc59264a8f214b72d0e6d7840361c701d1f823614b1780b033694ad3d6e9710',
    projectionKind: 'act_runtime_graph',
  },
  {
    key: 'domain',
    manifestProfile: 'domain',
    profileId: 'ctr:profile:control-theory-engineering-v0.22:domain-v3',
    profileSha256: '7470a0a889e427a8070dc3b907fff65fc8ddc7f7e9e4c4f86cf5557d1590692b',
    projectionKind: 'domain_graph',
  },
  {
    key: 'review',
    manifestProfile: 'review',
    profileId: 'ctr:profile:control-theory-engineering-v0.22:review-v3',
    profileSha256: '81649359b9831f3730dc7f8be9b8af204cb9b592806992bd1d09f728e731fd26',
    projectionKind: 'review_graph',
  },
] as const satisfies readonly ReviewedV2ProjectionProfileIdentity[];

export const REVIEWED_V0_22_IDENTITIES = {
  publicationTag: 'control-theory-engineering-v0.22-r2',
  publicationCommit: 'e7fb253afa475b1eb24891b872ddcd52e90be3d5',
  sourceTag: 'control-theory-engineering-v0.22-source-r5',
  sourceCommit: '49a258bef35d72c6d0793436118940e91cf50ef9',
  bundleId: 'ctb:control-theory-engineering-v0.22:r2',
  bundleRevision: 2,
  bundleDigest: '76c7855172ffcc709e9992dd48af6a6b53b29c5d2bc0ad901058b5f28a4c023f',
  manifestRawSha256: '92fbd3fb03c3cd9a3f24a4641db4f953d29803399f04f5eb4ff300d5d9a424d5',
  sha256sumsRawSha256: 'e684a4b3856ca9371ee810d2bae26e01c1a59e1efce395767be054a41e6b2f69',
  releaseId: 'ctr:release:control-theory-engineering-v0.22',
  releaseVersion: 'control-theory-engineering-v0.22',
  releaseHash: '3b858d5a36c3d3c1f2d073d63cfd815da8eea77c574b2523a4ac487bd916d8ac',
  sourceDatasetHash: '7619597423adfb1efb9c10ca0b781e007fdefebf27b94981dd020105371311af',
} as const;

export const REVIEWED_V0_22_V2_REGISTRY: PublicBundleV2Registry = deepFreeze({
  bundleContractVersion: PUBLIC_BUNDLE_V2_CONTRACT_VERSION,
  registryIdentity: 'actkg-public-bundle-v2:control-theory-engineering-v0.22:r2',
  upstreamRepository: {
    repositoryId: 'github.com/yong-wei/ActKG',
    remoteUrl: 'https://github.com/yong-wei/ActKG.git',
  },
  publicationTag: REVIEWED_V0_22_IDENTITIES.publicationTag,
  publicationCommit: REVIEWED_V0_22_IDENTITIES.publicationCommit,
  sourceTag: REVIEWED_V0_22_IDENTITIES.sourceTag,
  sourceCommit: REVIEWED_V0_22_IDENTITIES.sourceCommit,
  bundleId: REVIEWED_V0_22_IDENTITIES.bundleId,
  bundleRevision: REVIEWED_V0_22_IDENTITIES.bundleRevision,
  bundleDigest: REVIEWED_V0_22_IDENTITIES.bundleDigest,
  manifestRawSha256: REVIEWED_V0_22_IDENTITIES.manifestRawSha256,
  sha256sumsRawSha256: REVIEWED_V0_22_IDENTITIES.sha256sumsRawSha256,
  releaseId: REVIEWED_V0_22_IDENTITIES.releaseId,
  releaseVersion: REVIEWED_V0_22_IDENTITIES.releaseVersion,
  releaseHash: REVIEWED_V0_22_IDENTITIES.releaseHash,
  sourceDatasetHash: REVIEWED_V0_22_IDENTITIES.sourceDatasetHash,
  schemaVersion: CTKG_SCHEMA_V2_VERSION,
  schemaRawSha256: CTKG_SCHEMA_V2_RAW_SHA256,
  discoverCounts: true,
  expectedCounts: {
    releaseNodes: 0,
    runtimeProjectionNodes: 0,
    publishedRuntimeRelations: 0,
    terminologyAssertions: 0,
  },
  components: REVIEWED_V0_22_COMPONENTS,
  projectionProfiles: REVIEWED_V0_22_PROJECTION_PROFILES,
  artifactContracts: ARTIFACT_CONTRACTS_V2,
});
