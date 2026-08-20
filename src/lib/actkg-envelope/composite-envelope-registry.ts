/**
 * Named, qualified composite release envelopes. Runtime selector identities
 * resolve through this registry instead of compiled-in v0.18 constants.
 */

export const COMPOSITE_ENVELOPE_REGISTRY_CONTRACT = 'actkg-composite-envelope-registry/v1' as const;

export interface CompositeEnvelopeRecord {
  name: string;
  qualified: boolean;
  authorityReleaseId: string;
  authoritySnapshotId: string;
  authoritySnapshotHash: string;
  multilingualLabelCount: number | null;
  runtimeProfileSha256: string | null;
  projectionId: string;
  projectionHash: string;
  publicationId: string;
  publicationHash: string;
  catalogId: string;
  catalogHash: string;
  shardSetId: string;
  shardSetHash: string;
  activationId: string;
  activationHash: string | null;
  profileId: string;
}

export const COMPOSITE_ENVELOPE_REGISTRY: readonly CompositeEnvelopeRecord[] = Object.freeze([
  {
    name: 'control-theory-engineering-v0.9',
    qualified: true,
    authorityReleaseId: 'ctr:release:control-theory-engineering-v0.9',
    authoritySnapshotId: 'snap-7f4cdd1084af419a3e83787661e3017662dc253a9ffc864a9bb97a96085cc4c7',
    authoritySnapshotHash: '7f4cdd1084af419a3e83787661e3017662dc253a9ffc864a9bb97a96085cc4c7',
    multilingualLabelCount: null,
    runtimeProfileSha256: null,
    projectionId: 'proj-769b1a832622c0abb898becdf7218535ba6ab970ee7a7828afb067d14701e10d',
    projectionHash: '769b1a832622c0abb898becdf7218535ba6ab970ee7a7828afb067d14701e10d',
    publicationId: 'proj-b8100a7f322e588a620a2869b5fccafa22d501de9a85bb5882a7c56e9528a21b',
    publicationHash: 'b8100a7f322e588a620a2869b5fccafa22d501de9a85bb5882a7c56e9528a21b',
    catalogId: 'adc-dfcf6ef56276dd2d560e430f670087671234fceb0efd2a0b9129f8a43b1ff7f5',
    catalogHash: 'dfcf6ef56276dd2d560e430f670087671234fceb0efd2a0b9129f8a43b1ff7f5',
    shardSetId: 'ads-6328487edecd02ed5da3c7c66b80f458a1bce59e5b26c6cc06a8f611636a6196',
    shardSetHash: '6328487edecd02ed5da3c7c66b80f458a1bce59e5b26c6cc06a8f611636a6196',
    activationId: 'first-cutover-7f4cdd1084af-769b1a832622',
    activationHash: 'e1d353fd1b544b3115dec62f8206b027784e0f50b1c66406c8556049d9e7ecb5',
    profileId: 'ctr:profile:control-theory-engineering-v0.9:runtime-v3',
  },
  {
    name: 'control-theory-engineering-v0.18',
    qualified: true,
    authorityReleaseId: 'ctr:release:control-theory-engineering-v0.18',
    authoritySnapshotId: 'snap-1b64a853dda5668d83d0d2f09cadf72937330ced6aa49611f8027a9d5ec008ed',
    authoritySnapshotHash: '1b64a853dda5668d83d0d2f09cadf72937330ced6aa49611f8027a9d5ec008ed',
    multilingualLabelCount: 1909,
    runtimeProfileSha256: 'a442adfc5a73d9bacba53ce33016238be148917084e057ab979340279737bfe7',
    projectionId: 'proj-17f00f669b22c25126ca4c562e1e019c074a7738502825d2d109a77c47202ba9',
    projectionHash: '17f00f669b22c25126ca4c562e1e019c074a7738502825d2d109a77c47202ba9',
    publicationId: 'proj-0bdda82e1bc922fd8b910a9782dffbb147c64aed176b11d772b43f89eb8b3cf7',
    publicationHash: '0bdda82e1bc922fd8b910a9782dffbb147c64aed176b11d772b43f89eb8b3cf7',
    catalogId: 'adc-45d7ac82f8c36fccc01b0e545444fe5f9a89866449445f23ddf9ff2c7b9fe149',
    catalogHash: '45d7ac82f8c36fccc01b0e545444fe5f9a89866449445f23ddf9ff2c7b9fe149',
    shardSetId: 'ads-30cd92a6be1035c981428d1cb144e2d1dc37578020b6e99b1b02d41f7c2752af',
    shardSetHash: '30cd92a6be1035c981428d1cb144e2d1dc37578020b6e99b1b02d41f7c2752af',
    activationId: 'v018-cutover-1b64a853dda5-17f00f669b22',
    activationHash: 'b88996b578fbb2afaa822cf055af634871b796011efda3ccc0755f7cc0184300',
    profileId: 'ctr:profile:control-theory-engineering-v0.18:runtime-v3',
  },
  {
    name: 'control-theory-engineering-v0.22',
    qualified: true,
    authorityReleaseId: 'ctr:release:control-theory-engineering-v0.22',
    authoritySnapshotId: 'snap-9c4b2c1c2c976b4903bb979889d8b74a8dd306bc718cd4c9d06ac97b14172151',
    authoritySnapshotHash: '9c4b2c1c2c976b4903bb979889d8b74a8dd306bc718cd4c9d06ac97b14172151',
    multilingualLabelCount: 2148,
    runtimeProfileSha256: 'cfc59264a8f214b72d0e6d7840361c701d1f823614b1780b033694ad3d6e9710',
    projectionId: 'proj-1ab3029ae058d5b2cbef11106639623782ffa06f9b9edb043e791c480922a457',
    projectionHash: '1ab3029ae058d5b2cbef11106639623782ffa06f9b9edb043e791c480922a457',
    publicationId: 'proj-1adcc27f4e0e1b35e7b288da1920242fd4552e60e16a4b0aa7742c32891f9421',
    publicationHash: '1adcc27f4e0e1b35e7b288da1920242fd4552e60e16a4b0aa7742c32891f9421',
    catalogId: 'adc-0fde05783781e31126f3cc92efc2d53fc3f0a6360f907eca351cc4736faeba26',
    catalogHash: '0fde05783781e31126f3cc92efc2d53fc3f0a6360f907eca351cc4736faeba26',
    shardSetId: 'ads-4ba16ecc01fae21903c05dec90932de1dc75be401a60facfd2d93e4ba9a0515d',
    shardSetHash: '4ba16ecc01fae21903c05dec90932de1dc75be401a60facfd2d93e4ba9a0515d',
    activationId: 'v022-cutover-9c4b2c1c2c97-1ab3029ae058',
    activationHash: null,
    profileId: 'ctr:profile:control-theory-engineering-v0.22:runtime-v3',
  },
]);

export class CompositeEnvelopeError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'CompositeEnvelopeError';
    this.code = code;
  }
}

function assertNotLatest(value: string): void {
  if (value === 'latest' || value.endsWith('/latest') || value.includes('@latest')) {
    throw new CompositeEnvelopeError('latest-forbidden', 'composite envelope must not resolve latest');
  }
}

export function envelopeByName(name: string): CompositeEnvelopeRecord {
  assertNotLatest(name);
  const match = COMPOSITE_ENVELOPE_REGISTRY.find((row) => row.name === name);
  if (!match || !match.qualified) {
    throw new CompositeEnvelopeError('envelope-unknown', `unknown or unqualified composite envelope: ${name}`);
  }
  return match;
}

export function multilingualLabelCountForRelease(releaseId: string): number | null {
  return COMPOSITE_ENVELOPE_REGISTRY.find((row) => row.authorityReleaseId === releaseId)?.multilingualLabelCount
    ?? null;
}

export function matchCompositeEnvelope(identity: {
  authorityReleaseId: string;
  authoritySnapshotId: string;
  projectionId: string;
  publicationId: string;
  shardSetId: string;
  catalogId: string;
  activationId: string;
}): CompositeEnvelopeRecord {
  for (const value of Object.values(identity)) {
    assertNotLatest(String(value));
  }
  const matches = COMPOSITE_ENVELOPE_REGISTRY.filter((row) => (
    row.authorityReleaseId === identity.authorityReleaseId
    && row.authoritySnapshotId === identity.authoritySnapshotId
    && row.projectionId === identity.projectionId
    && row.publicationId === identity.publicationId
    && row.shardSetId === identity.shardSetId
    && row.catalogId === identity.catalogId
    && row.activationId === identity.activationId
  ));
  if (matches.length !== 1) {
    throw new CompositeEnvelopeError(
      'envelope-mix',
      'selector identities do not resolve one qualified composite envelope',
    );
  }
  return matches[0]!;
}

export type EnvelopePointerComponent =
  | 'authority'
  | 'projection'
  | 'prerequisite'
  | 'authority-domain-shards'
  | 'consumer-activation';

export function pointerIdentitiesForEnvelope(name: string): Record<EnvelopePointerComponent, { id: string; hash: string | null }> {
  const envelope = envelopeByName(name);
  return {
    authority: { id: envelope.authoritySnapshotId, hash: envelope.authoritySnapshotHash },
    projection: { id: envelope.projectionId, hash: envelope.projectionHash },
    prerequisite: { id: envelope.publicationId, hash: envelope.publicationHash },
    'authority-domain-shards': { id: envelope.shardSetId, hash: envelope.shardSetHash },
    'consumer-activation': { id: envelope.activationId, hash: envelope.activationHash },
  };
}
