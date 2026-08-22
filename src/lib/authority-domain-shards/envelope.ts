/**
 * Browser-safe envelope comparison for Authority shards (#1375).
 */

import type {
  AuthorityLearnerShard,
  AuthorityShardEnvelope,
  AuthorityShardPublicEnvelope,
  PublicAuthorityLearnerShard,
  PublicAuthorityShard,
} from './contracts';
import { shardDigest } from './hash';
import {
  historicalZhCnLocaleBinding,
  localeProfileVersion,
  type LocaleProfileBinding,
} from '@/lib/authority-locale-readiness/cache';
import type { PublicLocaleCapability } from '@/lib/authority-locale-readiness/contracts';
import { historicalLocaleCapability } from '@/lib/authority-locale-readiness/presentation-state';

export function envelopesShareAuthorityAndCatalog(
  left: AuthorityShardEnvelope,
  right: AuthorityShardEnvelope,
): boolean {
  return (
    left.authority.snapshotId === right.authority.snapshotId
    && left.authority.snapshotHash === right.authority.snapshotHash
    && left.authority.releaseId === right.authority.releaseId
    && left.authority.releaseSetId === right.authority.releaseSetId
    && left.authority.activationId === right.authority.activationId
    && left.authority.activationHash === right.authority.activationHash
    && left.catalog.catalogId === right.catalog.catalogId
    && left.catalog.catalogHash === right.catalog.catalogHash
  );
}

export function teachingIdentityMatches(
  left: AuthorityShardEnvelope,
  right: AuthorityShardEnvelope,
): boolean {
  return (
    left.teaching.projectionId === right.teaching.projectionId
    && left.teaching.projectionHash === right.teaching.projectionHash
    && left.teaching.teachingCacheFamily === right.teaching.teachingCacheFamily
  );
}

export function publicAuthorityShardEnvelope(
  envelope: AuthorityShardEnvelope,
  localeBinding?: LocaleProfileBinding,
): AuthorityShardPublicEnvelope {
  const authorityCatalogVersion = `acv-${shardDigest({
    authority: envelope.authority,
    catalog: envelope.catalog,
  })}`;
  const binding = localeBinding ?? historicalZhCnLocaleBinding(authorityCatalogVersion);
  return {
    contract: envelope.contract,
    authorityCatalogVersion,
    teachingVersion: envelope.teaching.projectionId
      ? `atv-${shardDigest(envelope.teaching)}`
      : null,
    localeProfileVersion: localeProfileVersion({
      ...binding,
      authorityCatalogVersion,
    }),
    match: { ...envelope.match },
  };
}

export function projectAuthorityLearnerShard<T extends AuthorityLearnerShard>(
  shard: T,
  options: {
    localeBinding?: LocaleProfileBinding;
    localeCapability?: PublicLocaleCapability;
  } = {},
): PublicAuthorityShard<T> {
  const projected = {
    ...shard,
    envelope: publicAuthorityShardEnvelope(shard.envelope, options.localeBinding),
  };
  if (shard.shardClass === 'root') {
    return {
      ...projected,
      localeCapability: options.localeCapability ?? historicalLocaleCapability(),
    } as unknown as PublicAuthorityShard<T>;
  }
  return projected as unknown as PublicAuthorityShard<T>;
}

export function publicEnvelopesShareAuthorityAndCatalog(
  left: AuthorityShardPublicEnvelope,
  right: AuthorityShardPublicEnvelope,
): boolean {
  return (
    left.contract === right.contract
    && left.authorityCatalogVersion === right.authorityCatalogVersion
    && left.match.authority === true
    && left.match.catalog === true
    && right.match.authority === true
    && right.match.catalog === true
  );
}

export function publicEnvelopesShareLocaleProfile(
  left: AuthorityShardPublicEnvelope,
  right: AuthorityShardPublicEnvelope,
): boolean {
  return left.localeProfileVersion === right.localeProfileVersion;
}

export function publicTeachingIdentityMatches(
  left: AuthorityShardPublicEnvelope,
  right: AuthorityShardPublicEnvelope,
): boolean {
  return (
    left.teachingVersion === right.teachingVersion
    && left.match.teaching === right.match.teaching
  );
}

export function isPublicAuthorityLearnerShard(
  value: unknown,
): value is PublicAuthorityLearnerShard {
  if (!value || typeof value !== 'object') return false;
  const record = value as { envelope?: unknown; shardClass?: unknown };
  const envelope = record.envelope as Partial<AuthorityShardPublicEnvelope> | undefined;
  if (!envelope) return false;
  return (
    typeof record.shardClass === 'string'
    && envelope.contract === 'act-authority-shard-envelope/v1'
    && typeof envelope.authorityCatalogVersion === 'string'
    && envelope.authorityCatalogVersion.length > 0
    && typeof envelope.localeProfileVersion === 'string'
    && envelope.localeProfileVersion.startsWith('alp-')
    && (typeof envelope.teachingVersion === 'string' || envelope.teachingVersion === null)
    && envelope.match?.authority === true
    && envelope.match?.catalog === true
    && (
      envelope.match?.teaching === true
      || envelope.match?.teaching === false
      || envelope.match?.teaching === null
    )
  );
}
