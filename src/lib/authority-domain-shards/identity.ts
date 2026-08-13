/**
 * Composite Authority + catalog + optional teaching identity.
 *
 * Resolved only from active pointers and the small snapshot manifest.
 * Never opens, parses or serializes engineering.json.
 */

import { join } from 'node:path';

import {
  loadAuthorityDomainCatalogRuntime,
  resolveAuthorityDomainCatalogPaths,
  type AuthorityDomainCatalogPaths,
  type AuthorityDomainCatalogRuntime,
} from '@/lib/authority-domain-catalog';
import {
  resolveConfiguredAuthorityRoot,
} from '@/lib/authoritative-knowledge/engineering-authority-consumers';
import {
  resolveAuthorityStorePaths,
  type AuthorityStorePaths,
} from '@/lib/authoritative-knowledge/authority-store';
import type { AuthoritySnapshotManifest } from '@/lib/authoritative-knowledge/authority-snapshot';
import {
  resolveEngineeringGraphProductionSelection,
  type ConsumerActivationStorePaths,
  type ConsumerProductionSelection,
} from '@/lib/versioned-knowledge-activation';

import {
  AUTHORITY_SHARD_ENVELOPE_CONTRACT,
  type AuthorityShardEnvelope,
  type AuthorityShardTeachingIdentity,
} from './contracts';
import { envelopesShareAuthorityAndCatalog, teachingIdentityMatches } from './envelope';
import {
  AuthorityShardStoreError,
  defaultShardIo,
  readJsonViaIo,
  type ShardIo,
} from './store';
import {
  loadOptionalDomainTeachingPointer,
  type DomainTeachingRuntimePointer,
} from './teaching';

export { envelopesShareAuthorityAndCatalog, teachingIdentityMatches };

export class AuthorityShardIdentityError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AuthorityShardIdentityError';
    this.code = code;
  }
}

export interface ActiveShardIdentity {
  envelope: AuthorityShardEnvelope;
  catalog: AuthorityDomainCatalogRuntime;
  teachingPointer: DomainTeachingRuntimePointer | null;
}

export interface ResolveActiveShardIdentityOptions {
  repoRoot?: string;
  authorityPaths?: AuthorityStorePaths;
  catalogPaths?: AuthorityDomainCatalogPaths;
  activationPaths?: ConsumerActivationStorePaths;
  activationSelection?: ConsumerProductionSelection;
  io?: ShardIo;
  teachingPointer?: DomainTeachingRuntimePointer | null;
}

function fail(code: string, message: string): never {
  throw new AuthorityShardIdentityError(code, message);
}

function readSnapshotManifest(
  authorityPaths: AuthorityStorePaths,
  snapshotId: string,
  io: ShardIo,
): AuthoritySnapshotManifest {
  const manifestPath = join(authorityPaths.releasesDir, snapshotId, 'manifest.json');
  if (!io.exists(manifestPath)) {
    fail('snapshot-manifest-absent', 'active Authority snapshot manifest is unavailable');
  }
  return readJsonViaIo<AuthoritySnapshotManifest>(io, manifestPath);
}

export function resolveActiveShardIdentity(
  options: ResolveActiveShardIdentityOptions = {},
): ActiveShardIdentity {
  const repoRoot = options.repoRoot ?? process.cwd();
  const io = options.io ?? defaultShardIo;
  const authorityPaths = options.authorityPaths
    ?? resolveAuthorityStorePaths(resolveConfiguredAuthorityRoot(repoRoot));
  const selection = options.activationSelection
    ?? resolveEngineeringGraphProductionSelection({
      repoRoot,
      activationPaths: options.activationPaths,
    });

  if (selection.consumerId !== 'engineering-graph') {
    fail('consumer-id-mismatch', 'active shard identity requires engineering-graph');
  }
  if (selection.mode !== 'use-combination') {
    fail(
      selection.mode === 'absent'
        ? 'activation-absent'
        : 'consumer-not-ready',
      selection.mode === 'absent'
        ? 'engineering-graph activation is absent'
        : 'engineering-graph consumer is not READY',
    );
  }
  if (selection.resolved.consumerStatus !== 'READY') {
    fail('consumer-not-ready', 'engineering-graph consumer is not READY');
  }

  const combination = selection.combination;
  if (
    !combination
    || !combination.authoritySnapshotId
    || !combination.authoritySnapshotHash
    || !combination.authorityReleaseId
  ) {
    fail('authority-identity-missing', 'active Authority identity is incomplete');
  }
  if (combination.projectionId !== null || combination.projectionHash !== null) {
    fail('projection-must-be-null', 'engineering-graph projectionId must remain null');
  }
  if (!selection.resolved.activationId || !selection.resolved.activationHash) {
    fail('activation-identity-missing', 'engineering-graph activation identity is incomplete');
  }

  const manifest = readSnapshotManifest(
    authorityPaths,
    combination.authoritySnapshotId,
    io,
  );
  if (
    manifest.snapshotId !== combination.authoritySnapshotId
    || manifest.snapshotHash !== combination.authoritySnapshotHash
    || manifest.releaseId !== combination.authorityReleaseId
  ) {
    fail('authority-identity-mismatch', 'snapshot manifest does not match the active pointer');
  }
  if (!manifest.releaseSetId) {
    fail('authority-identity-missing', 'snapshot manifest is missing releaseSetId');
  }

  let catalog: AuthorityDomainCatalogRuntime;
  try {
    catalog = loadAuthorityDomainCatalogRuntime(
      options.catalogPaths ?? resolveAuthorityDomainCatalogPaths(repoRoot),
      {
        snapshotId: combination.authoritySnapshotId,
        snapshotHash: combination.authoritySnapshotHash,
        releaseId: combination.authorityReleaseId,
        releaseSetId: manifest.releaseSetId,
      },
    );
  } catch (error) {
    fail(
      'catalog-unavailable',
      error instanceof Error ? error.message : 'reviewed domain catalog is unavailable',
    );
  }

  const teachingPointer = options.teachingPointer !== undefined
    ? options.teachingPointer
    : loadOptionalDomainTeachingPointer(repoRoot, io);

  const teaching: AuthorityShardTeachingIdentity = teachingPointer
    ? {
        status: 'available',
        projectionId: teachingPointer.projectionId,
        projectionHash: teachingPointer.projectionHash,
        teachingCacheFamily: teachingPointer.teachingCacheFamily,
      }
    : {
        status: 'unavailable',
        projectionId: null,
        projectionHash: null,
        teachingCacheFamily: null,
      };

  const envelope: AuthorityShardEnvelope = {
    contract: AUTHORITY_SHARD_ENVELOPE_CONTRACT,
    authority: {
      snapshotId: combination.authoritySnapshotId,
      snapshotHash: combination.authoritySnapshotHash,
      releaseId: combination.authorityReleaseId,
      releaseSetId: manifest.releaseSetId,
      activationId: selection.resolved.activationId,
      activationHash: selection.resolved.activationHash,
      projectionId: null,
      projectionHash: null,
    },
    catalog: {
      catalogId: catalog.catalogId,
      catalogHash: catalog.catalogHash,
      catalogVersion: catalog.catalogVersion,
    },
    teaching,
    match: {
      authority: true,
      catalog: true,
      teaching: teachingPointer ? true : null,
    },
  };

  return { envelope, catalog, teachingPointer };
}

export function assertEnvelopeMatchesActive(
  expected: AuthorityShardEnvelope,
  actual: AuthorityShardEnvelope,
): void {
  const authorityKeys: Array<keyof AuthorityShardEnvelope['authority']> = [
    'snapshotId',
    'snapshotHash',
    'releaseId',
    'releaseSetId',
    'activationId',
    'activationHash',
    'projectionId',
    'projectionHash',
  ];
  for (const key of authorityKeys) {
    if (expected.authority[key] !== actual.authority[key]) {
      throw new AuthorityShardStoreError(
        'authority-identity-mismatch',
        `shard authority.${key} does not match the active pointer`,
      );
    }
  }
  if (
    expected.catalog.catalogId !== actual.catalog.catalogId
    || expected.catalog.catalogHash !== actual.catalog.catalogHash
    || expected.catalog.catalogVersion !== actual.catalog.catalogVersion
  ) {
    throw new AuthorityShardStoreError(
      'catalog-identity-mismatch',
      'shard catalog identity does not match the active pointer',
    );
  }
  if (
    expected.teaching.status !== actual.teaching.status
    || expected.teaching.projectionId !== actual.teaching.projectionId
    || expected.teaching.projectionHash !== actual.teaching.projectionHash
    || expected.teaching.teachingCacheFamily !== actual.teaching.teachingCacheFamily
    || expected.match.teaching !== actual.match.teaching
  ) {
    throw new AuthorityShardStoreError(
      'teaching-identity-mismatch',
      'shard teaching identity does not match the active pointer',
    );
  }
  if (actual.authority.projectionId !== null || actual.authority.projectionHash !== null) {
    throw new AuthorityShardStoreError(
      'projection-must-be-null',
      'engineering-graph projectionId must remain null',
    );
  }
}
