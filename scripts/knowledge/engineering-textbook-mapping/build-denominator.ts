#!/usr/bin/env tsx
/**
 * #2043 task 1.1 — build the engineering-textbook mapping denominator.
 *
 * Groups every object of the active v0.37 Authority snapshot by its catalog
 * preferred domain (15 runtime catalog domains) into the immutable mapping
 * denominator ledger.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { resolveActiveShardIdentity } from '@/lib/authority-domain-shards';
import { resolveConfiguredAuthorityRoot } from '@/lib/authoritative-knowledge/engineering-authority-consumers';
import { resolveAuthorityStorePaths } from '@/lib/authoritative-knowledge/authority-store';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MAPPING_DENOMINATOR_CONTRACT,
  mappingArtifactPath,
} from '@/lib/engineering-textbook-mapping';

const ROOT = process.cwd();

function main(): void {
  const identity = resolveActiveShardIdentity({ repoRoot: ROOT });
  const authorityPaths = resolveAuthorityStorePaths(resolveConfiguredAuthorityRoot(ROOT));
  const engineeringPath = join(
    authorityPaths.releasesDir,
    identity.envelope.authority.snapshotId,
    'engineering.json',
  );
  const engineering = JSON.parse(readFileSync(engineeringPath, 'utf8')) as {
    objects: Array<{ canonicalId: string }>;
  };

  const byDomain = new Map<string, string[]>();
  const snapshotIds = new Set(engineering.objects.map((object) => object.canonicalId));
  for (const membership of identity.catalog.memberships) {
    if (!snapshotIds.has(membership.canonicalId)) continue;
    const domainId = membership.preferredDomainId;
    const list = byDomain.get(domainId) ?? [];
    list.push(membership.canonicalId);
    byDomain.set(domainId, list);
  }

  const unassigned = [...snapshotIds].filter(
    (id) => !identity.catalog.memberships.some((row) => row.canonicalId === id),
  );
  if (unassigned.length > 0) {
    throw new Error(`denominator incomplete: ${unassigned.length} snapshot objects absent from catalog memberships`);
  }

  const domains = [...byDomain.entries()]
    .map(([domainId, canonicalIds]) => ({
      domainId,
      objectCount: canonicalIds.length,
      canonicalIds: [...canonicalIds].sort(),
    }))
    .sort((left, right) => left.domainId.localeCompare(right.domainId));

  const denominator = {
    contract: MAPPING_DENOMINATOR_CONTRACT,
    authorityReleaseId: identity.envelope.authority.releaseId,
    snapshotId: identity.envelope.authority.snapshotId,
    catalogId: identity.catalog.catalogId,
    generatorVersion: 'engineering-textbook-denominator/v1',
    totalObjects: snapshotIds.size,
    domains,
  };

  const outPath = mappingArtifactPath(ROOT, 'denominator.json');
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(denominator, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    totalObjects: denominator.totalObjects,
    domains: domains.map((domain) => `${domain.domainId}=${domain.objectCount}`),
  }, null, 2)}\n`);
}

main();
