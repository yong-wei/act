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
): AuthorityShardPublicEnvelope {
  return {
    contract: envelope.contract,
    authorityCatalogVersion: `acv-${shardDigest({
      authority: envelope.authority,
      catalog: envelope.catalog,
    })}`,
    teachingVersion: envelope.teaching.projectionId
      ? `atv-${shardDigest(envelope.teaching)}`
      : null,
    match: { ...envelope.match },
  };
}

export function projectAuthorityLearnerShard<T extends AuthorityLearnerShard>(
  shard: T,
): PublicAuthorityShard<T> {
  return {
    ...shard,
    envelope: publicAuthorityShardEnvelope(shard.envelope),
  };
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
