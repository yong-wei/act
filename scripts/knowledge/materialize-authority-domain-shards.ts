/**
 * Materialize the committed Authority/catalog shard set for #1375.
 *
 * Reads engineering.json only during this publish-time step.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { AuthorityEngineeringBody } from '@/lib/authoritative-knowledge/authority-snapshot';
import {
  resolveConfiguredAuthorityRoot,
} from '@/lib/authoritative-knowledge/engineering-authority-consumers';
import { resolveAuthorityStorePaths } from '@/lib/authoritative-knowledge/authority-store';
import {
  createTeachingOverlay,
  resolveActiveShardIdentity,
  resolveAuthorityDomainShardPaths,
  buildAuthorityDomainShards,
  writeAuthorityDomainShards,
} from '@/lib/authority-domain-shards';

export function materializeCommittedAuthorityDomainShards(
  repoRoot = process.cwd(),
): ReturnType<typeof buildAuthorityDomainShards> {
  const identity = resolveActiveShardIdentity({ repoRoot });
  const authorityPaths = resolveAuthorityStorePaths(resolveConfiguredAuthorityRoot(repoRoot));
  const engineeringPath = join(
    authorityPaths.releasesDir,
    identity.envelope.authority.snapshotId,
    'engineering.json',
  );
  const engineering = JSON.parse(
    readFileSync(engineeringPath, 'utf8'),
  ) as AuthorityEngineeringBody;
  const materialized = buildAuthorityDomainShards({
    envelope: identity.envelope,
    catalog: identity.catalog,
    engineering,
    teaching: createTeachingOverlay(identity.teachingPointer),
    activatedAt: '2026-08-13T00:00:00.000Z',
  });
  writeAuthorityDomainShards(resolveAuthorityDomainShardPaths(repoRoot), materialized);
  return materialized;
}

if (process.argv[1]?.includes('materialize-authority-domain-shards')) {
  const materialized = materializeCommittedAuthorityDomainShards();
  process.stdout.write(
    `${JSON.stringify({
      shardSetId: materialized.manifest.shardSetId,
      shardSetHash: materialized.manifest.shardSetHash,
      counts: materialized.manifest.counts,
      teaching: materialized.pointer.teachingProjectionId,
    }, null, 2)}\n`,
  );
}
