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
  loadSourcesInput,
  MAPPING_SOURCES_INPUT_CONTRACT,
  verifyCoverageLedgerBinding,
  loadCoverage,
} from '@/lib/engineering-textbook-mapping';
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
  const coverage = loadCoverage(repoRoot);
  verifyCoverageLedgerBinding({ coverage, repoRoot });
  const sourceCitations = loadSourcesInput(repoRoot);
  if (sourceCitations.contract !== MAPPING_SOURCES_INPUT_CONTRACT) {
    throw new Error(`sources-input contract mismatch: ${sourceCitations.contract}`);
  }
  if (sourceCitations.authorityReleaseId !== identity.envelope.authority.releaseId) {
    throw new Error(
      `sources-input pinned to ${sourceCitations.authorityReleaseId} but active release is ${identity.envelope.authority.releaseId}`,
    );
  }
  if (sourceCitations.coverageDigest === '') {
    throw new Error('sources-input coverageDigest is empty; governed coverage receipt required');
  }
  const materialized = buildAuthorityDomainShards({
    envelope: identity.envelope,
    catalog: identity.catalog,
    engineering,
    teaching: createTeachingOverlay(identity.teachingPointer, {
      artifacts: identity.teachingArtifacts,
    }),
    sourceCitations: new Map(
      sourceCitations.entries.map((entry) => [entry.nodeId, entry.sources]),
    ),
    sourceCitationsContract: sourceCitations.contract,
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
