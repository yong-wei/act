/**
 * Runtime loader for materialized Authority domain shards (#1375).
 *
 * Fail closed on missing, mismatched or mixed-version artifacts.
 * Root and domain-default never open engineering.json.
 */

import { join } from 'node:path';

import {
  type DomainVisualRole,
  type RegisteredPeerDomainId,
} from '@/lib/authority-domain-catalog/contracts';

import {
  AUTHORITY_SHARD_COVERAGE_CONTRACT,
  AUTHORITY_SHARD_SET_CONTRACT,
  isEngineeringRelationFamily,
  type AuthorityDomainSearchIndexShard,
  type AuthorityDomainDefaultShard,
  type AuthorityNodeDetailShard,
  type AuthorityNodeNeighborhoodShard,
  type AuthorityRelationFamilyShard,
  type AuthorityRootShard,
  type AuthorityShardObject,
  type AuthorityShardCoverageReceipt,
  type AuthorityShardSetManifest,
  type EngineeringRelationFamily,
} from './contracts';
import { isSha256Hex, shardDigest, shardSha256 } from './hash';
import {
  assertEnvelopeMatchesActive,
  resolveActiveShardIdentity,
  type ResolveActiveShardIdentityOptions,
} from './identity';
import { createTeachingOverlay, teachingCoverageFromState } from './teaching';
import {
  AuthorityShardStoreError,
  defaultShardIo,
  readCurrentShardPointer,
  readJsonViaIo,
  resolveAuthorityDomainShardPaths,
  shardRelativePaths,
  shardSetDir,
  type AuthorityDomainShardPaths,
  type ShardIo,
} from './store';

export interface LoadAuthorityShardOptions extends ResolveActiveShardIdentityOptions {
  shardPaths?: AuthorityDomainShardPaths;
  /** Injected for tests; production resolves the committed active pointers. */
  identity?: ReturnType<typeof resolveActiveShardIdentity>;
}

export interface LoadedAuthorityShardContext {
  identity: ReturnType<typeof resolveActiveShardIdentity>;
  paths: AuthorityDomainShardPaths;
  setDir: string;
  manifest: AuthorityShardSetManifest;
  io: ShardIo;
}

function loadContext(options: LoadAuthorityShardOptions = {}): LoadedAuthorityShardContext {
  const io = options.io ?? defaultShardIo;
  const repoRoot = options.repoRoot ?? process.cwd();
  const paths = options.shardPaths ?? resolveAuthorityDomainShardPaths(repoRoot);
  const identity = options.identity ?? resolveActiveShardIdentity({ ...options, io });
  const pointer = readCurrentShardPointer(paths, io);
  if (
    pointer.snapshotId !== identity.envelope.authority.snapshotId
    || pointer.snapshotHash !== identity.envelope.authority.snapshotHash
    || pointer.releaseId !== identity.envelope.authority.releaseId
    || pointer.catalogId !== identity.envelope.catalog.catalogId
    || pointer.catalogHash !== identity.envelope.catalog.catalogHash
  ) {
    throw new AuthorityShardStoreError(
      'pointer-identity-mismatch',
      'shard current pointer does not match the active Authority/catalog identity',
    );
  }

  const setDir = shardSetDir(paths, pointer.shardSetId);
  const manifestPath = join(setDir, shardRelativePaths({}).manifest);
  if (!io.exists(manifestPath)) {
    throw new AuthorityShardStoreError('shard-set-absent', 'active shard set manifest is unavailable');
  }
  const manifest = readJsonViaIo<AuthorityShardSetManifest>(io, manifestPath);
  if (manifest.contract !== AUTHORITY_SHARD_SET_CONTRACT) {
    throw new AuthorityShardStoreError('manifest-contract-invalid', 'unsupported shard set contract');
  }
  if (manifest.shardSetId !== pointer.shardSetId || manifest.shardSetHash !== pointer.shardSetHash) {
    throw new AuthorityShardStoreError('manifest-pointer-mismatch', 'shard set manifest does not match current pointer');
  }
  if (!isSha256Hex(manifest.shardSetHash)) {
    throw new AuthorityShardStoreError('manifest-hash-invalid', 'shard set hash is not valid sha256');
  }
  if (
    manifest.shardSetId !== `ads-${manifest.shardSetHash}`
    || manifest.shardSetHash !== shardDigest({ envelope: manifest.envelope, files: manifest.files })
  ) {
    throw new AuthorityShardStoreError('manifest-hash-mismatch', 'shard set manifest seal is invalid');
  }
  // The shard set may have been sealed against an older Teaching pointer.
  // Authority/catalog identity is still fail-closed; Teaching is reconciled
  // per shard below so engineering artifacts remain readable during a
  // pointer/artifact cutover.
  assertEnvelopeMatchesActive(identity.envelope, manifest.envelope, {
    requireTeaching: false,
  });
  return { identity, paths, setDir, manifest, io };
}

function teachingEnvelopeMatches(
  expected: AuthorityRootShard['envelope'],
  actual: AuthorityRootShard['envelope'],
): boolean {
  return (
    expected.teaching.status === actual.teaching.status
    && expected.teaching.projectionId === actual.teaching.projectionId
    && expected.teaching.projectionHash === actual.teaching.projectionHash
    && expected.teaching.teachingCacheFamily === actual.teaching.teachingCacheFamily
    && expected.match.teaching === actual.match.teaching
  );
}

function reconcileTeachingEnvelope<T extends {
  envelope: AuthorityRootShard['envelope'];
  shardClass: string;
}>(
  context: LoadedAuthorityShardContext,
  shard: T,
): T {
  if (teachingEnvelopeMatches(context.identity.envelope, shard.envelope)) {
    return shard;
  }

  const envelope = context.identity.envelope;
  if (shard.shardClass === 'domain-default') {
    const domainShard = shard as unknown as AuthorityDomainDefaultShard;
    const teachingPointer = context.identity.teachingPointer;
    const teachingArtifacts = context.identity.teachingArtifacts;
    if (
      envelope.teaching.status === 'available'
      && envelope.match.teaching === true
      && teachingPointer
      && teachingArtifacts
    ) {
      const overlay = createTeachingOverlay(teachingPointer, {
        artifacts: teachingArtifacts,
      });
      const overviewIds = new Set(domainShard.objects.map((object) => object.id));
      const teachingRelations = overlay.relations(domainShard.domainId)
        .filter((relation) => overviewIds.has(relation.sourceId) || overviewIds.has(relation.targetId))
        .sort((left, right) => left.id.localeCompare(right.id));
      const boundaryIds = [...new Set(teachingRelations.flatMap((relation) => [relation.sourceId, relation.targetId]))]
        .filter((id) => !overviewIds.has(id)).sort();
      const teachingBoundaryObjects: AuthorityShardObject[] = boundaryIds.map((canonicalId) => {
        const node = readVerifiedShard<AuthorityNodeDetailShard>(context, shardRelativePaths({ canonicalId }).detail!, 'node-detail').node;
        const membership = context.identity.catalog.memberships.find((row) => row.canonicalId === canonicalId);
        return {
          id: node.id, canonicalType: node.canonicalType, label: node.label,
          aliases: node.aliases ?? [], description: node.description,
          governance: node.governance, semanticSupport: node.semanticSupport,
          richTitle: node.richTitle, richDescription: node.richDescription,
          memberships: (membership?.domainIds ?? []).map((domainId) => ({
            domainId, preferred: domainId === membership?.preferredDomainId,
            visualRole: context.identity.catalog.domains.find((domain) => domain.domainId === domainId)!.visualRole,
          })),
        };
      });
      const teachingBoundaries = teachingBoundaryObjects.map((object) => ({
        canonicalId: object.id, label: object.label, aliases: object.aliases,
        canonicalType: object.canonicalType,
        adjacentDomainIds: object.memberships.map((membership) => membership.domainId),
      }));
      return {
        ...domainShard,
        envelope,
        teachingRelations,
        teachingBoundaryObjects,
        teachingBoundaries,
        teachingCoverage: { ...overlay.coverage(domainShard.domainId), relationCount: teachingRelations.length },
      } as unknown as T;
    }
    return {
      ...domainShard,
      envelope,
      teachingRelations: [],
      teachingBoundaryObjects: [],
      teachingBoundaries: [],
      teachingCoverage: teachingCoverageFromState(domainShard.domainId, 'unavailable'),
    } as unknown as T;
  }

  // Root, engineering-family, neighborhood and detail shards carry no
  // Teaching payload.  They are returned with the live envelope so clients
  // cannot accidentally move the Teaching cache identity backwards.
  return { ...shard, envelope } as T;
}

function readVerifiedShard<T extends { envelope: AuthorityRootShard['envelope']; shardClass: string }>(
  context: LoadedAuthorityShardContext,
  relative: string,
  expectedClass: T['shardClass'],
): T {
  const filePath = join(context.setDir, relative);
  if (!context.io.exists(filePath)) {
    throw new AuthorityShardStoreError('shard-absent', `requested ${expectedClass} shard is unavailable`);
  }
  const raw = context.io.readFile(filePath);
  const declared = context.manifest.files[relative];
  if (!declared || shardSha256(raw) !== declared) {
    throw new AuthorityShardStoreError('shard-tamper', `${relative} does not match the sealed shard set`);
  }
  let shard: T;
  try {
    shard = JSON.parse(raw) as T;
  } catch (error) {
    throw new AuthorityShardStoreError(
      'parse-failed',
      error instanceof Error ? error.message : `failed to parse ${relative}`,
    );
  }
  if (shard.shardClass !== expectedClass) {
    throw new AuthorityShardStoreError('shard-class-mismatch', `${relative} is not a ${expectedClass} shard`);
  }
  assertEnvelopeMatchesActive(context.identity.envelope, shard.envelope, {
    requireTeaching: false,
  });
  return reconcileTeachingEnvelope(context, shard);
}

export function resolveShardDomainKey(
  value: string,
  catalogDomains: ReadonlyArray<{ domainId: RegisteredPeerDomainId; visualRole: Exclude<DomainVisualRole, 'aggregate'> }>,
): RegisteredPeerDomainId {
  const byId = catalogDomains.find((domain) => domain.domainId === value);
  if (byId) return byId.domainId;
  const matched = catalogDomains.find((domain) => domain.visualRole === value);
  if (matched) return matched.domainId;
  throw new AuthorityShardStoreError('domain-unknown', `unknown authority domain ${value}`);
}

export function loadRootShard(
  options: LoadAuthorityShardOptions = {},
): AuthorityRootShard {
  const context = loadContext(options);
  return readVerifiedShard<AuthorityRootShard>(
    context,
    shardRelativePaths({}).root,
    'root',
  );
}

/**
 * Root entry publication gate (#1738): the root shard is only served when the
 * shard-set coverage receipt closes the catalog denominator under the same
 * identity. A deployment or mount that omits the receipt fails closed here
 * instead of exposing clickable domain entries that 404/503 on first click.
 */
export function loadRootShardWithCoverage(
  options: LoadAuthorityShardOptions = {},
): AuthorityRootShard {
  loadShardSetCoverage(options);
  return loadRootShard(options);
}

export function loadDomainDefaultShard(
  domainKey: string,
  options: LoadAuthorityShardOptions = {},
): AuthorityDomainDefaultShard {
  const context = loadContext(options);
  const domainId = resolveShardDomainKey(domainKey, context.identity.catalog.domains);
  return readVerifiedShard<AuthorityDomainDefaultShard>(
    context,
    shardRelativePaths({ domainId }).domainDefault!,
    'domain-default',
  );
}

function emptyRelationFamilyShard(
  context: LoadedAuthorityShardContext,
  domainId: RegisteredPeerDomainId,
  family: EngineeringRelationFamily,
): AuthorityRelationFamilyShard {
  return reconcileTeachingEnvelope(context, {
    shardClass: 'relation-family',
    envelope: context.identity.envelope,
    domainId,
    family,
    objects: [],
    relations: [],
    boundaries: [],
  });
}

export function loadRelationFamilyShard(
  domainKey: string,
  familyKey: string,
  options: LoadAuthorityShardOptions = {},
): AuthorityRelationFamilyShard {
  if (!isEngineeringRelationFamily(familyKey)) {
    throw new AuthorityShardStoreError('family-unknown', `unknown engineering family ${familyKey}`);
  }
  const context = loadContext(options);
  const domainId = resolveShardDomainKey(domainKey, context.identity.catalog.domains);
  const relative = shardRelativePaths({ domainId, family: familyKey }).family!;
  if (!context.manifest.files[relative]) {
    return emptyRelationFamilyShard(context, domainId, familyKey);
  }
  return readVerifiedShard<AuthorityRelationFamilyShard>(
    context,
    relative,
    'relation-family',
  );
}

export function loadNodeNeighborhoodShard(
  nodeId: string,
  options: LoadAuthorityShardOptions = {},
): AuthorityNodeNeighborhoodShard {
  if (!nodeId || nodeId.length > 200) {
    throw new AuthorityShardStoreError('node-id-invalid', 'invalid neighborhood node id');
  }
  const context = loadContext(options);
  const shard = readVerifiedShard<AuthorityNodeNeighborhoodShard>(
    context,
    shardRelativePaths({ canonicalId: nodeId }).neighborhood!,
    'node-neighborhood',
  );
  if (shard.nodeId !== nodeId) {
    throw new AuthorityShardStoreError('node-id-mismatch', 'neighborhood shard does not match requested node');
  }
  return shard;
}

export function loadNodeDetailShard(
  nodeId: string,
  options: LoadAuthorityShardOptions = {},
): AuthorityNodeDetailShard {
  if (!nodeId || nodeId.length > 200) {
    throw new AuthorityShardStoreError('node-id-invalid', 'invalid detail node id');
  }
  const context = loadContext(options);
  const shard = readVerifiedShard<AuthorityNodeDetailShard>(
    context,
    shardRelativePaths({ canonicalId: nodeId }).detail!,
    'node-detail',
  );
  if (shard.node.id !== nodeId) {
    throw new AuthorityShardStoreError('node-id-mismatch', 'detail shard does not match requested node');
  }
  return shard;
}

/**
 * Sealed identity-safe search rows for one domain (#1738). Internal artifact:
 * callers must serve it only through a bounded, paged search projection and
 * never return the complete index to the browser.
 */
export function loadDomainSearchIndexShard(
  domainKey: string,
  options: LoadAuthorityShardOptions = {},
): AuthorityDomainSearchIndexShard {
  const context = loadContext(options);
  const domainId = resolveShardDomainKey(domainKey, context.identity.catalog.domains);
  const shard = readVerifiedShard<AuthorityDomainSearchIndexShard>(
    context,
    shardRelativePaths({ domainId }).searchIndex!,
    'domain-search-index',
  );
  if (shard.domainId !== domainId) {
    throw new AuthorityShardStoreError('domain-id-mismatch', 'search index shard does not match requested domain');
  }
  return shard;
}

/**
 * Sealed coverage receipt for the active shard set (#1738). Root navigation
 * may only expose domains whose default/search/neighborhood/detail closure
 * is recorded here under the same shard-set identity.
 */
export function loadShardSetCoverage(
  options: LoadAuthorityShardOptions = {},
): AuthorityShardCoverageReceipt {
  const context = loadContext(options);
  const coverage = readVerifiedShard<AuthorityShardCoverageReceipt>(
    context,
    shardRelativePaths({}).coverage,
    'coverage-receipt',
  );
  if (coverage.contract !== AUTHORITY_SHARD_COVERAGE_CONTRACT) {
    throw new AuthorityShardStoreError('coverage-contract-invalid', 'unsupported coverage receipt contract');
  }
  if (
    coverage.catalogDomainCount !== coverage.defaultShardCount
    || coverage.catalogDomainCount !== coverage.searchIndexCount
    || !coverage.closure.complete
  ) {
    throw new AuthorityShardStoreError('coverage-denominator-mismatch', 'coverage receipt does not close the catalog denominator');
  }
  return coverage;
}

export function loadActiveShardContext(
  options: LoadAuthorityShardOptions = {},
): LoadedAuthorityShardContext {
  return loadContext(options);
}

export function loadVerifiedShardRelative<T extends {
  envelope: AuthorityRootShard['envelope'];
  shardClass: string;
}>(
  relative: string,
  expectedClass: T['shardClass'],
  options: LoadAuthorityShardOptions | LoadedAuthorityShardContext = {},
): T {
  const context = 'manifest' in options && 'setDir' in options
    ? options
    : loadContext(options);
  return readVerifiedShard<T>(context, relative, expectedClass);
}
