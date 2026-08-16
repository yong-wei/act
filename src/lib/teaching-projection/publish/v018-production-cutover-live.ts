/** Live store materialization and activate* backend for v0.18 cutover. */

import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { emptyTeachingSelectorFingerprint } from '../../authoritative-knowledge/authority-snapshot';
import {
  activateAuthoritySnapshot,
  resolveAuthorityStorePaths,
} from '../../authoritative-knowledge/authority-store';
import {
  buildAuthorityDomainCatalog,
  loadAuthorityDomainCatalogAuthoring,
  resolveAuthorityDomainCatalogPaths,
} from '../../authority-domain-catalog';
import {
  AUTHORITY_SHARD_ENVELOPE_CONTRACT,
  buildAuthorityDomainShards,
  createTeachingOverlay,
  resolveAuthorityDomainShardPaths,
  shardSetDir,
  writeJsonFile,
} from '../../authority-domain-shards';
import {
  activatePrerequisitePublication,
  resolvePrerequisiteStorePaths,
} from '../prerequisites/store';
import {
  activateTeachingProjection,
  resolveTeachingProjectionStorePaths,
} from '../store';
import {
  activateConsumerActivation,
  readCurrentConsumerActivationPointer,
  resolveConsumerActivationStorePaths,
  stageConsumerActivation,
} from '../../versioned-knowledge-activation';
import {
  AUTHORITY_CANDIDATE_RELATIVE,
  TEACHING_CANDIDATE_RELATIVE,
  V018_SNAPSHOT,
  asRecord,
  readJson,
  shaFile,
} from '../qualify/v018-shared';
import {
  pointerIdentityFromBytes,
  V018_CUTOVER_POINTER_PATHS,
  V018_PRODUCTION_ACTIVATION_ID,
  V018_PROJECTION_ID,
  V018_PUBLICATION_ID,
  V018_SHARD_SET_ID,
  V018_TARGET_IDENTITIES,
  type CutoverPointerBackend,
  type PointerIdentity,
  type V018CutoverComponent,
} from './v018-production-cutover';

function copyIfMissing(fromPath: string, toPath: string): void {
  if (!existsSync(fromPath)) {
    throw new Error(`missing source tree: ${fromPath}`);
  }
  if (existsSync(toPath)) return;
  mkdirSync(path.dirname(toPath), { recursive: true });
  cpSync(fromPath, toPath, { recursive: true });
}

export function materializeV018CutoverTrees(input: {
  repoRoot: string;
  candidateRoot?: string;
}): { shardSetId: string; shardSetHash: string; activationId: string } {
  const candidateRoot = input.candidateRoot ?? input.repoRoot;
  const authorityRelease = path.join(
    candidateRoot,
    AUTHORITY_CANDIDATE_RELATIVE,
    'replay-1/authority/releases',
    V018_SNAPSHOT,
  );
  process.stderr.write('materialize: copy authority\n');
  copyIfMissing(
    authorityRelease,
    path.join(input.repoRoot, 'course-content/authoring/knowledge/authority/releases', V018_SNAPSHOT),
  );
  process.stderr.write('materialize: copy projection\n');
  copyIfMissing(
    path.join(candidateRoot, TEACHING_CANDIDATE_RELATIVE, 'projection/releases', V018_PROJECTION_ID),
    path.join(input.repoRoot, 'course-content/runtime/knowledge/projection/releases', V018_PROJECTION_ID),
  );
  process.stderr.write('materialize: copy prerequisites\n');
  copyIfMissing(
    path.join(candidateRoot, TEACHING_CANDIDATE_RELATIVE, 'prerequisites/releases', V018_PUBLICATION_ID),
    path.join(input.repoRoot, 'course-content/runtime/knowledge/prerequisites/releases', V018_PUBLICATION_ID),
  );

  const authorityManifest = readJson(path.join(
    input.repoRoot,
    'course-content/authoring/knowledge/authority/releases',
    V018_SNAPSHOT,
    'manifest.json',
  ));
  const engineering = readJson(path.join(
    input.repoRoot,
    'course-content/authoring/knowledge/authority/releases',
    V018_SNAPSHOT,
    'engineering.json',
  ));
  process.stderr.write('materialize: build catalog\n');
  const catalogPaths = resolveAuthorityDomainCatalogPaths(input.repoRoot);
  const catalog = buildAuthorityDomainCatalog(
    {
      ...loadAuthorityDomainCatalogAuthoring(catalogPaths),
      authorityBinding: {
        snapshotId: String(authorityManifest.snapshotId),
        snapshotHash: String(authorityManifest.snapshotHash),
        releaseId: String(authorityManifest.releaseId),
        releaseSetId: String(authorityManifest.releaseSetId),
      },
    },
    (Array.isArray(engineering.objects) ? engineering.objects : []).map((row) => ({
      canonicalId: String(asRecord(row).canonicalId ?? ''),
    })),
  );
  process.stderr.write('materialize: write runtime catalog\n');
  const catalogCurrent = {
    contract: 'act-authority-domain-display-catalog-current/v1',
    catalogId: catalog.catalogId,
    catalogHash: catalog.catalogHash,
    snapshotId: catalog.authorityBinding.snapshotId,
    snapshotHash: catalog.authorityBinding.snapshotHash,
    releaseId: catalog.authorityBinding.releaseId,
    activatedAt: '2026-08-16T00:00:00.000Z',
  };
  replacePointerFile(catalogPaths.runtimeCatalogPath, Buffer.from(`${JSON.stringify(catalog)}\n`));
  replacePointerFile(catalogPaths.runtimeCurrentPath, Buffer.from(`${JSON.stringify(catalogCurrent)}\n`));

  process.stderr.write('materialize: stage consumer activation\n');
  const activationPaths = resolveConsumerActivationStorePaths(
    path.join(input.repoRoot, 'course-content/runtime/knowledge/consumer-activation'),
  );
  const priorPointer = readCurrentConsumerActivationPointer(activationPaths);
  const projectionReleaseDir = path.join(
    input.repoRoot,
    'course-content/runtime/knowledge/projection/releases',
    V018_PROJECTION_ID,
  );
  const projectionFiles = [
    'projection-manifest.json',
    'resources.jsonl',
    'bindings.jsonl',
    'cards-index.json',
    'prerequisites.jsonl',
    'core-nodes.json',
    'impact-report.json',
    'gate.json',
  ];
  const projectionFileHashes = Object.fromEntries(
    projectionFiles
      .filter((name) => existsSync(path.join(projectionReleaseDir, name)))
      .map((name) => [name, shaFile(path.join(projectionReleaseDir, name))]),
  );
  const authorityReleaseDir = path.join(
    input.repoRoot,
    'course-content/authoring/knowledge/authority/releases',
    V018_SNAPSHOT,
  );
  stageConsumerActivation(activationPaths, {
    artifacts: {
      captureRevision: String(authorityManifest.captureRevision ?? '34e4d9da22b68957371bd2ba760ba9f85b886f3e'),
      authority: {
        present: true,
        releaseId: String(authorityManifest.releaseId),
        snapshotId: V018_SNAPSHOT,
        snapshotHash: V018_TARGET_IDENTITIES.authority.hash!,
        captureRevision: String(authorityManifest.captureRevision ?? '34e4d9da22b68957371bd2ba760ba9f85b886f3e'),
        artifactHashes: {
          'manifest.json': shaFile(path.join(authorityReleaseDir, 'manifest.json')),
          'engineering.json': shaFile(path.join(authorityReleaseDir, 'engineering.json')),
        },
        artifactPaths: {
          'manifest.json': path.join(authorityReleaseDir, 'manifest.json'),
          'engineering.json': path.join(authorityReleaseDir, 'engineering.json'),
        },
      },
      projection: {
        present: true,
        projectionId: V018_PROJECTION_ID,
        projectionHash: V018_TARGET_IDENTITIES.projection.hash!,
        authorityReleaseId: String(authorityManifest.releaseId),
        captureRevision: String(authorityManifest.captureRevision ?? '34e4d9da22b68957371bd2ba760ba9f85b886f3e'),
        gatePassed: true,
        artifactHashes: projectionFileHashes,
        artifactPaths: Object.fromEntries(
          Object.keys(projectionFileHashes).map((name) => [name, path.join(projectionReleaseDir, name)]),
        ),
        hasResources: true,
        hasCardsIndex: true,
        hasPrerequisites: true,
        hasImpactReport: true,
      },
    },
    priorConsumers: [],
    priorActivationId: priorPointer?.activationId,
    priorActivationHash: priorPointer?.activationHash,
    activationId: V018_PRODUCTION_ACTIVATION_ID,
    stagedAt: '2026-08-16T00:00:00.000Z',
  });
  const stagedActivation = readJson(path.join(
    input.repoRoot,
    'course-content/runtime/knowledge/consumer-activation/releases',
    V018_PRODUCTION_ACTIVATION_ID,
    'activation.json',
  ));
  process.stderr.write('materialize: build shards bound to staged activation\n');
  const shardPaths = resolveAuthorityDomainShardPaths(input.repoRoot);
  const materialized = buildAuthorityDomainShards({
    envelope: {
      contract: AUTHORITY_SHARD_ENVELOPE_CONTRACT,
      authority: {
        snapshotId: String(authorityManifest.snapshotId),
        snapshotHash: String(authorityManifest.snapshotHash),
        releaseId: String(authorityManifest.releaseId),
        releaseSetId: String(authorityManifest.releaseSetId),
        activationId: V018_PRODUCTION_ACTIVATION_ID,
        activationHash: String(stagedActivation.activationHash ?? ''),
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
      match: { authority: true as const, catalog: true as const, teaching: null },
    },
    catalog,
    engineering: engineering as never,
    teaching: createTeachingOverlay(null),
    activatedAt: '2026-08-16T00:00:00.000Z',
  });
  const target = shardSetDir(shardPaths, materialized.manifest.shardSetId);
  for (const [relative, value] of Object.entries(materialized.files)) {
    writeJsonFile(path.join(target, relative), value);
  }

  return {
    shardSetId: materialized.manifest.shardSetId,
    shardSetHash: String(materialized.manifest.shardSetHash ?? materialized.manifest.shardSetId.replace(/^ads-/, '')),
    activationId: V018_PRODUCTION_ACTIVATION_ID,
  };
}

function unlinkIfSymlink(filePath: string): void {
  try {
    if (lstatSync(filePath).isSymbolicLink()) unlinkSync(filePath);
  } catch {
    // missing pointer is fine
  }
}

function replacePointerFile(filePath: string, bytes: Buffer): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  writeFileSync(tmp, bytes);
  renameSync(tmp, filePath);
}

function readLive(root: string, component: V018CutoverComponent): PointerIdentity | null {
  const filePath = path.join(root, V018_CUTOVER_POINTER_PATHS[component]);
  if (!existsSync(filePath)) return null;
  return pointerIdentityFromBytes(component, readFileSync(filePath));
}

export function createLivePointerBackend(root: string): CutoverPointerBackend {
  return {
    read(component) {
      return readLive(root, component);
    },
    apply(component, targetId) {
      unlinkIfSymlink(path.join(root, V018_CUTOVER_POINTER_PATHS[component]));
      if (component === 'authority') {
        const result = activateAuthoritySnapshot(
          resolveAuthorityStorePaths(path.join(root, 'course-content/authoring/knowledge/authority')),
          {
            snapshotId: targetId,
            teachingSelectors: emptyTeachingSelectorFingerprint(),
            activationReceiptId: 'v018-cutover-authority',
            activatedAt: '2026-08-16T00:00:00.000Z',
          },
        );
        if (result.status !== 'activated') {
          throw new Error(`authority activate failed: ${result.receipt.reasons.join(',')}`);
        }
      } else if (component === 'projection') {
        const result = activateTeachingProjection(
          resolveTeachingProjectionStorePaths(path.join(root, 'course-content/runtime/knowledge/projection')),
          { projectionId: targetId, activatedAt: '2026-08-16T00:00:00.000Z' },
        );
        if (result.status !== 'activated') {
          throw new Error(`projection activate failed: ${result.reasons.join(',')}`);
        }
      } else if (component === 'prerequisite') {
        activatePrerequisitePublication(
          resolvePrerequisiteStorePaths(path.join(root, 'course-content/runtime/knowledge/prerequisites')),
          targetId,
        );
      } else if (component === 'authority-domain-shards') {
        const shardPaths = resolveAuthorityDomainShardPaths(root);
        const pointerPath = path.join(root, V018_CUTOVER_POINTER_PATHS[component]);
        const manifest = readJson(path.join(shardSetDir(shardPaths, targetId), 'manifest.json'));
        const catalogCurrent = readJson(path.join(
          root,
          'course-content/runtime/knowledge/authority-domain-catalog/current.json',
        ));
        replacePointerFile(pointerPath, Buffer.from(`${JSON.stringify({
          contract: 'act-authority-domain-shard-current/v1',
          shardSetId: targetId,
          shardSetHash: String(manifest.shardSetHash ?? V018_TARGET_IDENTITIES['authority-domain-shards'].hash),
          snapshotId: V018_SNAPSHOT,
          snapshotHash: V018_TARGET_IDENTITIES.authority.hash,
          releaseId: 'ctr:release:control-theory-engineering-v0.18',
          catalogId: catalogCurrent.catalogId,
          catalogHash: catalogCurrent.catalogHash,
          teachingProjectionId: V018_PROJECTION_ID,
          teachingProjectionHash: V018_TARGET_IDENTITIES.projection.hash,
          activatedAt: '2026-08-16T00:00:00.000Z',
        })}\n`));
      } else {
        const result = activateConsumerActivation(
          resolveConsumerActivationStorePaths(
            path.join(root, 'course-content/runtime/knowledge/consumer-activation'),
          ),
          {
            activationId: targetId,
            activationReceiptId: 'v018-cutover-consumers',
            activatedAt: '2026-08-16T00:00:00.000Z',
          },
        );
        if (result.status !== 'activated') {
          throw new Error(`consumer activate failed: ${result.receipt.reasons.join(',')}`);
        }
      }
      const applied = readLive(root, component);
      if (!applied) throw new Error(`${component} pointer missing after apply`);
      return applied;
    },
    restore(component, predecessor) {
      replacePointerFile(path.join(root, V018_CUTOVER_POINTER_PATHS[component]), predecessor.bytes);
      return pointerIdentityFromBytes(component, predecessor.bytes);
    },
  };
}

export { V018_SHARD_SET_ID };
