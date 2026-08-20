/** Isolated five-selector activate/rollback rehearsal. */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { emptyTeachingSelectorFingerprint } from '../../authoritative-knowledge/authority-snapshot';
import type {
  AuthorityEngineeringBody,
  AuthoritySnapshotManifest,
} from '../../authoritative-knowledge/authority-snapshot';
import {
  activateAuthoritySnapshot,
  readCurrentAuthorityPointer,
  resolveAuthorityStorePaths,
  type AuthorityStorePaths,
} from '../../authoritative-knowledge/authority-store';
import {
  buildAuthorityDomainCatalog,
  resolveAuthorityDomainCatalogPaths,
  type AuthorityDomainCatalogAuthoring,
  type AuthorityDomainCatalogRuntime,
} from '../../authority-domain-catalog';
import {
  AUTHORITY_SHARD_ENVELOPE_CONTRACT,
  buildAuthorityDomainShards,
  createTeachingOverlay,
  loadActiveShardContext,
  readCurrentShardPointer,
  resolveAuthorityDomainShardPaths,
  writeAuthorityDomainShards,
  writeJsonFile,
  type AuthorityDomainShardPaths,
  type LoadedAuthorityShardContext,
} from '../../authority-domain-shards';
import {
  createAuthorityLabelResolverContext,
  resolveAuthorityLabel,
} from '../../authority-domain-shards/labels';
import {
  activatePrerequisitePublication,
  readCurrentPrerequisitePointer,
  resolvePrerequisiteStorePaths,
  type PrerequisiteStorePaths,
} from '../prerequisites/store';
import {
  activateTeachingProjection,
  readCurrentTeachingProjectionPointer,
  resolveTeachingProjectionStorePaths,
  type TeachingProjectionStorePaths,
} from '../store';
import {
  activateConsumerActivation,
  readCurrentConsumerActivationPointer,
  resolveConsumerActivationStorePaths,
  stageConsumerActivation,
  type ConsumerActivationStorePaths,
} from '../../versioned-knowledge-activation';

import { V022QualificationError } from './v022-qualify-error';
import {
  CATALOG_CANDIDATE_RELATIVE,
  TEACHING_CANDIDATE_RELATIVE,
  V022_RELEASE_ID,
  V022_SNAPSHOT,
  V09_ACTIVATION,
  V09_PREREQUISITE,
  V09_PROJECTION,
  V09_RELEASE_ID,
  V09_SHARD_SET,
  V09_SNAPSHOT,
  asRecord,
  readJson,
  shaFile,
  writeCanonical,
} from './v022-shared';

export interface IsolatedSelectorState {
  path: string;
  advanced: boolean;
  restored: boolean;
  advancedIdentity: string | null;
  restoredSha256: string | null;
}

export interface IsolatedRehearsal {
  advanced: boolean;
  restored: boolean;
  selectors: Record<string, IsolatedSelectorState>;
  catalog: AuthorityDomainCatalogRuntime | null;
  shardContext: LoadedAuthorityShardContext | null;
  shardPaths: AuthorityDomainShardPaths | null;
  authorityPaths: AuthorityStorePaths;
  activationPaths: ConsumerActivationStorePaths;
  prerequisitePaths: PrerequisiteStorePaths;
  blockers: string[];
}

const SELECTOR_KEYS = [
  'authority',
  'projection',
  'prerequisites',
  'authority-domain-shards',
  'consumer-activation',
] as const;

function copyTree(fromPath: string, toPath: string): void {
  if (!existsSync(fromPath)) {
    throw new V022QualificationError('isolated-source-missing', `missing ${fromPath}`);
  }
  mkdirSync(path.dirname(toPath), { recursive: true });
  cpSync(fromPath, toPath, { recursive: true });
}

function writeBytes(filePath: string, bytes: Buffer): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, bytes);
}

function reboundAuthoring(
  authoring: AuthorityDomainCatalogAuthoring,
  authorityManifest: AuthoritySnapshotManifest,
): AuthorityDomainCatalogAuthoring {
  return {
    ...authoring,
    authorityBinding: {
      snapshotId: authorityManifest.snapshotId,
      snapshotHash: authorityManifest.snapshotHash,
      releaseId: authorityManifest.releaseId,
      releaseSetId: authorityManifest.releaseSetId,
    },
  };
}

export function rehearseIsolatedFiveSelectorActivation(input: {
  repoRoot: string;
  outputRoot: string;
  authorityManifest: AuthoritySnapshotManifest;
  engineering: AuthorityEngineeringBody;
  projectionId: string;
  publicationId: string;
  projectionHash: string;
  publicationHash: string;
  captureRevision: string;
  projectionFileHashes: Record<string, string>;
  projectionReleaseDir: string;
  authorityArtifactPaths: Record<string, string>;
  authorityArtifactHashes: Record<string, string>;
  onAdvanced?: (context: {
    catalog: AuthorityDomainCatalogRuntime | null;
    shardContext: LoadedAuthorityShardContext | null;
    shardPaths: AuthorityDomainShardPaths;
    authorityPaths: AuthorityStorePaths;
    activationPaths: ConsumerActivationStorePaths;
    projectionPaths: TeachingProjectionStorePaths;
    prerequisitePaths: PrerequisiteStorePaths;
  }) => void;
}): IsolatedRehearsal {
  const isolated = path.join(input.outputRoot, 'isolated-control-root');
  rmSync(isolated, { recursive: true, force: true });
  const authorityRoot = path.join(isolated, 'authority');
  const projectionRoot = path.join(isolated, 'projection');
  const prerequisiteRoot = path.join(isolated, 'prerequisites');
  const shardRoot = path.join(isolated, 'authority-domain-shards');
  const activationRoot = path.join(isolated, 'consumer-activation');
  const catalogAuthoringRel = 'catalog-authoring';
  const catalogRuntimeRel = 'catalog-runtime';
  const blockers: string[] = [];

  const productionSelectors = {
    authority: path.join(input.repoRoot, 'course-content/authoring/knowledge/authority/current.json'),
    projection: path.join(input.repoRoot, 'course-content/runtime/knowledge/projection/current.json'),
    prerequisites: path.join(input.repoRoot, 'course-content/runtime/knowledge/prerequisites/current.json'),
    'authority-domain-shards': path.join(input.repoRoot, 'course-content/runtime/knowledge/authority-domain-shards/current.json'),
    'consumer-activation': path.join(input.repoRoot, 'course-content/runtime/knowledge/consumer-activation/current.json'),
  };
  const originalBytes = Object.fromEntries(
    SELECTOR_KEYS.map((key) => [key, readFileSync(productionSelectors[key])]),
  ) as Record<(typeof SELECTOR_KEYS)[number], Buffer>;

  copyTree(productionSelectors.authority, path.join(authorityRoot, 'current.json'));
  copyTree(path.join(input.repoRoot, `course-content/authoring/knowledge/authority/releases/${V09_SNAPSHOT}`), path.join(authorityRoot, 'releases', V09_SNAPSHOT));
  copyTree(
    path.join(input.repoRoot, `course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.22/replay-1/authority/releases/${V022_SNAPSHOT}`),
    path.join(authorityRoot, 'releases', V022_SNAPSHOT),
  );
  copyTree(productionSelectors.projection, path.join(projectionRoot, 'current.json'));
  copyTree(path.join(input.repoRoot, `course-content/runtime/knowledge/projection/releases/${V09_PROJECTION}`), path.join(projectionRoot, 'releases', V09_PROJECTION));
  copyTree(
    path.join(input.repoRoot, `${TEACHING_CANDIDATE_RELATIVE}/projection/releases/${input.projectionId}`),
    path.join(projectionRoot, 'releases', input.projectionId),
  );
  copyTree(productionSelectors.prerequisites, path.join(prerequisiteRoot, 'current.json'));
  copyTree(path.join(input.repoRoot, `course-content/runtime/knowledge/prerequisites/releases/${V09_PREREQUISITE}`), path.join(prerequisiteRoot, 'releases', V09_PREREQUISITE));
  copyTree(
    path.join(input.repoRoot, `${TEACHING_CANDIDATE_RELATIVE}/prerequisites/releases/${input.publicationId}`),
    path.join(prerequisiteRoot, 'releases', input.publicationId),
  );
  copyTree(productionSelectors['authority-domain-shards'], path.join(shardRoot, 'current.json'));
  copyTree(
    path.join(input.repoRoot, `course-content/runtime/knowledge/authority-domain-shards/sets/${V09_SHARD_SET}`),
    path.join(shardRoot, 'sets', V09_SHARD_SET),
  );
  copyTree(productionSelectors['consumer-activation'], path.join(activationRoot, 'current.json'));
  copyTree(
    path.join(input.repoRoot, `course-content/runtime/knowledge/consumer-activation/releases/${V09_ACTIVATION}`),
    path.join(activationRoot, 'releases', V09_ACTIVATION),
  );

  const authorityPaths = resolveAuthorityStorePaths(authorityRoot);
  const projectionPaths = resolveTeachingProjectionStorePaths(projectionRoot);
  const prerequisitePaths = resolvePrerequisiteStorePaths(prerequisiteRoot);
  const shardPaths = resolveAuthorityDomainShardPaths(isolated, {
    runtimeRelative: path.relative(isolated, shardRoot),
  });
  const activationPaths = resolveConsumerActivationStorePaths(activationRoot);

  const advancedAuthority = activateAuthoritySnapshot(authorityPaths, {
    snapshotId: V022_SNAPSHOT,
    teachingSelectors: emptyTeachingSelectorFingerprint(),
    activationReceiptId: 'qualification-isolated-v022-authority',
  });
  const advancedProjection = activateTeachingProjection(projectionPaths, {
    projectionId: input.projectionId,
  });
  const advancedPrerequisite = activatePrerequisitePublication(prerequisitePaths, input.publicationId);

  let catalog: AuthorityDomainCatalogRuntime | null = null;
  let shardContext: LoadedAuthorityShardContext | null = null;
  let shardAdvanced = false;
  try {
    const isolatedCatalogPaths = resolveAuthorityDomainCatalogPaths(isolated, {
      authoringRelative: catalogAuthoringRel,
      runtimeRelative: catalogRuntimeRel,
    });
    const candidateAuthoring = reboundAuthoring(
      readJson(path.join(input.repoRoot, CATALOG_CANDIDATE_RELATIVE, 'catalog.json')) as unknown as AuthorityDomainCatalogAuthoring,
      input.authorityManifest,
    );
    if (candidateAuthoring.authorityBinding.releaseId !== input.authorityManifest.releaseId
      || candidateAuthoring.authorityBinding.snapshotId !== input.authorityManifest.snapshotId) {
      throw new V022QualificationError('isolated-catalog-authority-mix', 'candidate catalog is not bound to the v0.22 envelope');
    }
    const labelContext = createAuthorityLabelResolverContext({
      snapshot: {
        snapshotId: input.authorityManifest.snapshotId,
        snapshotHash: input.authorityManifest.snapshotHash,
        releaseId: input.authorityManifest.releaseId,
      },
      objects: input.engineering.objects,
      v2Evidence: input.engineering.v2Evidence,
    });
    const labeledIds = new Set(
      input.engineering.objects
        .filter((row) => {
          const resolved = resolveAuthorityLabel(labelContext, row.canonicalId);
          return resolved.status === 'available' && Boolean(resolved.label);
        })
        .map((row) => row.canonicalId),
    );
    const shardEngineering: AuthorityEngineeringBody = {
      ...input.engineering,
      objects: input.engineering.objects.filter((row) => labeledIds.has(row.canonicalId)),
      relations: input.engineering.relations.filter((row) => (
        labeledIds.has(row.sourceId) && labeledIds.has(row.targetId)
      )),
    };
    const labeledMemberships = candidateAuthoring.memberships.filter((row) => labeledIds.has(row.canonicalId));
    const perDomain = new Map<string, number>();
    const boundedMemberships = [...labeledMemberships]
      .sort((left, right) => left.canonicalId.localeCompare(right.canonicalId))
      .filter((row) => {
        const domainId = row.preferredDomainId;
        const count = perDomain.get(domainId) ?? 0;
        if (count >= 80) return false;
        perDomain.set(domainId, count + 1);
        return true;
      });
    const shardAuthoring: AuthorityDomainCatalogAuthoring = {
      ...candidateAuthoring,
      memberships: boundedMemberships,
    };
    writeJsonFile(isolatedCatalogPaths.authoringCatalogPath, shardAuthoring);
    catalog = buildAuthorityDomainCatalog(
      shardAuthoring,
      shardEngineering.objects.map((row) => ({ canonicalId: row.canonicalId })),
    );
    writeJsonFile(isolatedCatalogPaths.runtimeCatalogPath, catalog);
    writeJsonFile(isolatedCatalogPaths.runtimeCurrentPath, {
      contract: 'act-authority-domain-display-catalog-current/v1',
      catalogId: catalog.catalogId,
      catalogHash: catalog.catalogHash,
      snapshotId: catalog.authorityBinding.snapshotId,
      snapshotHash: catalog.authorityBinding.snapshotHash,
      releaseId: catalog.authorityBinding.releaseId,
      activatedAt: '1970-01-01T00:00:00.000Z',
    });
    const envelope = {
      contract: AUTHORITY_SHARD_ENVELOPE_CONTRACT,
      authority: {
        snapshotId: input.authorityManifest.snapshotId,
        snapshotHash: input.authorityManifest.snapshotHash,
        releaseId: input.authorityManifest.releaseId,
        releaseSetId: input.authorityManifest.releaseSetId,
        activationId: 'qualification-isolated-v022-authority',
        activationHash: shaFile(path.join(authorityRoot, 'current.json')),
        projectionId: null,
        projectionHash: null,
      },
      catalog: {
        catalogId: catalog.catalogId,
        catalogHash: catalog.catalogHash,
        catalogVersion: catalog.catalogVersion,
      },
      teaching: {
        status: 'unavailable' as const,
        projectionId: null,
        projectionHash: null,
        teachingCacheFamily: null,
      },
      match: {
        authority: true as const,
        catalog: true as const,
        teaching: null,
      },
    };
    const materialized = buildAuthorityDomainShards({
      envelope,
      catalog,
      engineering: shardEngineering,
      teaching: createTeachingOverlay(null),
      activatedAt: '1970-01-01T00:00:00.000Z',
    });
    const rematerialized = buildAuthorityDomainShards({
      envelope,
      catalog,
      engineering: shardEngineering,
      teaching: createTeachingOverlay(null),
      activatedAt: '1970-01-01T00:00:00.000Z',
    });
    if (materialized.manifest.shardSetHash !== rematerialized.manifest.shardSetHash
      || materialized.manifest.shardSetId !== rematerialized.manifest.shardSetId) {
      throw new V022QualificationError('shard-rebuild-drift', 'two Authority domain shard rebuilds diverged');
    }
    writeAuthorityDomainShards(shardPaths, materialized);
    shardContext = loadActiveShardContext({
      shardPaths,
      catalogPaths: isolatedCatalogPaths,
      identity: {
        envelope: materialized.manifest.envelope,
        catalog,
        teachingPointer: null,
        teachingArtifacts: null,
      },
    });
    shardAdvanced = readCurrentShardPointer(shardPaths).snapshotId === V022_SNAPSHOT;
  } catch (error) {
    blockers.push(error instanceof Error ? `isolated-shard:${error.message}` : 'isolated-shard-failed');
  }

  let activationAdvanced = false;
  try {
    const prior = readJson(path.join(activationRoot, 'releases', V09_ACTIVATION, 'activation.json'));
    const priorConsumers = Array.isArray(prior.consumers)
      ? prior.consumers.map((row) => {
          const rec = asRecord(row);
          return {
            consumerId: rec.consumerId as 'engineering-graph',
            combination: asRecord(rec.combination) as {
              authorityReleaseId: string | null;
              authoritySnapshotId: string | null;
              authoritySnapshotHash: string | null;
              projectionId: string | null;
              projectionHash: string | null;
              scopeId: string | null;
              captureRevision: string | null;
            },
            status: rec.status as 'READY',
          };
        })
      : [];
    const priorPointer = readCurrentConsumerActivationPointer(activationPaths);
    const staged = stageConsumerActivation(activationPaths, {
      artifacts: {
        captureRevision: input.captureRevision,
        authority: {
          present: true,
          releaseId: input.authorityManifest.releaseId,
          snapshotId: input.authorityManifest.snapshotId,
          snapshotHash: input.authorityManifest.snapshotHash,
          captureRevision: input.captureRevision,
          artifactHashes: input.authorityArtifactHashes,
          artifactPaths: input.authorityArtifactPaths,
        },
        projection: {
          present: true,
          projectionId: input.projectionId,
          projectionHash: input.projectionHash,
          authorityReleaseId: input.authorityManifest.releaseId,
          captureRevision: input.captureRevision,
          gatePassed: true,
          artifactHashes: input.projectionFileHashes,
          artifactPaths: Object.fromEntries(
            Object.keys(input.projectionFileHashes).map((name) => [
              name,
              path.join(input.projectionReleaseDir, name),
            ]),
          ),
          hasResources: true,
          hasCardsIndex: true,
          hasPrerequisites: true,
          hasImpactReport: true,
        },
      },
      priorConsumers,
      priorActivationId: priorPointer?.activationId ?? V09_ACTIVATION,
      priorActivationHash: priorPointer?.activationHash ?? '',
      activationId: 'qualification-isolated-v022-consumers',
      stagedAt: '1970-01-01T00:00:00.000Z',
    });
    const activated = activateConsumerActivation(activationPaths, {
      activationId: staged.activationId,
      activationReceiptId: 'qualification-isolated-v022-consumers-receipt',
      activatedAt: '1970-01-01T00:00:00.000Z',
    });
    activationAdvanced = activated.status === 'activated'
      && readCurrentConsumerActivationPointer(activationPaths)?.activationId === staged.activationId;
    if (!activationAdvanced) {
      blockers.push(`isolated-activation:${activated.receipt.reasons.join(',') || activated.status}`);
    }
  } catch (error) {
    blockers.push(error instanceof Error ? `isolated-activation:${error.message}` : 'isolated-activation-failed');
  }

  const advanced = advancedAuthority.status === 'activated'
    && advancedProjection.status === 'activated'
    && advancedPrerequisite.publicationId === input.publicationId
    && readCurrentAuthorityPointer(authorityPaths)?.snapshotId === V022_SNAPSHOT
    && readCurrentTeachingProjectionPointer(projectionPaths)?.projectionId === input.projectionId
    && readCurrentPrerequisitePointer(prerequisitePaths)?.publicationId === input.publicationId
    && shardAdvanced
    && activationAdvanced;

  const isolatedSelectors = {
    authority: path.join(authorityRoot, 'current.json'),
    projection: path.join(projectionRoot, 'current.json'),
    prerequisites: path.join(prerequisiteRoot, 'current.json'),
    'authority-domain-shards': path.join(shardRoot, 'current.json'),
    'consumer-activation': path.join(activationRoot, 'current.json'),
  };
  const advancedIdentities = {
    authority: readCurrentAuthorityPointer(authorityPaths)?.snapshotId ?? null,
    projection: readCurrentTeachingProjectionPointer(projectionPaths)?.projectionId ?? null,
    prerequisites: readCurrentPrerequisitePointer(prerequisitePaths)?.publicationId ?? null,
    'authority-domain-shards': existsSync(isolatedSelectors['authority-domain-shards'])
      ? readCurrentShardPointer(shardPaths).snapshotId
      : null,
    'consumer-activation': existsSync(isolatedSelectors['consumer-activation'])
      ? readCurrentConsumerActivationPointer(activationPaths)?.activationId ?? null
      : null,
  };

  try {
    input.onAdvanced?.({
      catalog,
      shardContext,
      shardPaths,
      authorityPaths,
      activationPaths,
      projectionPaths,
      prerequisitePaths,
    });
  } catch (error) {
    blockers.push(error instanceof Error ? `isolated-consumer-read:${error.message}` : 'isolated-consumer-read-failed');
  }

  for (const key of SELECTOR_KEYS) {
    writeBytes(isolatedSelectors[key], originalBytes[key]);
  }

  const expectedAdvanced: Record<(typeof SELECTOR_KEYS)[number], string> = {
    authority: V022_SNAPSHOT,
    projection: input.projectionId,
    prerequisites: input.publicationId,
    'authority-domain-shards': V022_SNAPSHOT,
    'consumer-activation': advancedIdentities['consumer-activation'] ?? '',
  };
  const selectors = Object.fromEntries(SELECTOR_KEYS.map((key) => {
    const restoredSha = shaFile(isolatedSelectors[key]);
    const originalSha = shaFile(productionSelectors[key]);
    const identity = advancedIdentities[key];
    const advancedOk = key === 'consumer-activation'
      ? Boolean(identity && identity !== V09_ACTIVATION)
      : identity === expectedAdvanced[key];
    return [key, {
      path: `isolated-control-root/${key}/current.json`,
      advanced: advancedOk,
      restored: restoredSha === originalSha,
      advancedIdentity: identity,
      restoredSha256: restoredSha,
    } satisfies IsolatedSelectorState];
  })) as Record<string, IsolatedSelectorState>;

  const restored = SELECTOR_KEYS.every((key) => selectors[key].restored);
  if (!advanced) blockers.push('isolated-activation-failed');
  if (!restored) blockers.push('isolated-rollback-drift');

  writeCanonical(path.join(isolated, 'isolated-rollback.json'), {
    advanced,
    restored,
    selectors,
    v022SnapshotId: V022_SNAPSHOT,
    v09SnapshotId: V09_SNAPSHOT,
    v09ReleaseId: V09_RELEASE_ID,
    v022ReleaseId: V022_RELEASE_ID,
  });
  rmSync(authorityRoot, { recursive: true, force: true });
  rmSync(projectionRoot, { recursive: true, force: true });
  rmSync(prerequisiteRoot, { recursive: true, force: true });
  rmSync(shardRoot, { recursive: true, force: true });
  rmSync(activationRoot, { recursive: true, force: true });
  rmSync(path.join(isolated, catalogAuthoringRel), { recursive: true, force: true });
  rmSync(path.join(isolated, catalogRuntimeRel), { recursive: true, force: true });

  return {
    advanced,
    restored,
    selectors,
    catalog,
    shardContext,
    shardPaths,
    authorityPaths,
    activationPaths,
    prerequisitePaths,
    blockers,
  };
}
