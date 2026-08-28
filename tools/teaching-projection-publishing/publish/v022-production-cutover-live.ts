/** Live store materialization and activate* backend for v0.22 cutover. */

import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { envelopeByName } from '../../../src/lib/actkg-envelope/composite-envelope-registry';
import { emptyTeachingSelectorFingerprint } from '../../../src/lib/authoritative-knowledge/authority-snapshot';
import {
  activateAuthoritySnapshot,
  resolveAuthorityStorePaths,
} from '../../../src/lib/authoritative-knowledge/authority-store';
import {
  resolveAuthorityDomainCatalogPaths,
} from '../../../src/lib/authority-domain-catalog';
import {
  AUTHORITY_SHARD_ENVELOPE_CONTRACT,
  buildAuthorityDomainShards,
  createTeachingOverlay,
  resolveAuthorityDomainShardPaths,
  shardSetDir,
  writeJsonFile,
} from '../../../src/lib/authority-domain-shards';
import {
  activatePrerequisitePublication,
  resolvePrerequisiteStorePaths,
} from '../../../src/lib/teaching-projection/prerequisites/store';
import {
  activateTeachingProjection,
  resolveTeachingProjectionStorePaths,
} from '../../../src/lib/teaching-projection/store';
import {
  activateConsumerActivation,
  readCurrentConsumerActivationPointer,
  resolveConsumerActivationStorePaths,
  stageConsumerActivation,
} from '../../../src/lib/versioned-knowledge-activation';
import {
  AUTHORITY_CANDIDATE_RELATIVE,
  CATALOG_CANDIDATE_RELATIVE,
  TEACHING_CANDIDATE_RELATIVE,
  asRecord,
  readJson,
  shaFile,
} from '../qualify/v022-shared';
import {
  pointerIdentityFromBytes,
  V022_CUTOVER_POINTER_PATHS,
  V022_PRODUCTION_ACTIVATION_ID,
  V022_PROJECTION_ID,
  V022_PUBLICATION_ID,
  V022_SNAPSHOT,
  V022_TARGET_IDENTITIES,
  type CutoverPointerBackend,
  type PointerIdentity,
  type V022CutoverComponent,
} from './v022-production-cutover';

const V022_ENVELOPE = envelopeByName('control-theory-engineering-v0.22');

function copyIfMissing(fromPath: string, toPath: string): void {
  if (!existsSync(fromPath)) {
    throw new Error(`missing source tree: ${fromPath}`);
  }
  if (existsSync(toPath)) return;
  mkdirSync(path.dirname(toPath), { recursive: true });
  cpSync(fromPath, toPath, { recursive: true });
}

function replacePointerFile(filePath: string, bytes: Buffer): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  writeFileSync(tmp, bytes);
  renameSync(tmp, filePath);
}

function unlinkIfSymlink(filePath: string): void {
  try {
    if (lstatSync(filePath).isSymbolicLink()) unlinkSync(filePath);
  } catch {
    // missing pointer is fine
  }
}

export function materializeV022CutoverTrees(input: {
  repoRoot: string;
  candidateRoot?: string;
}): { shardSetId: string; shardSetHash: string; activationId: string } {
  const candidateRoot = input.candidateRoot ?? input.repoRoot;
  copyIfMissing(
    path.join(candidateRoot, AUTHORITY_CANDIDATE_RELATIVE, 'replay-1/authority/releases', V022_SNAPSHOT),
    path.join(input.repoRoot, 'course-content/authoring/knowledge/authority/releases', V022_SNAPSHOT),
  );
  copyIfMissing(
    path.join(candidateRoot, TEACHING_CANDIDATE_RELATIVE, 'projection/releases', V022_PROJECTION_ID),
    path.join(input.repoRoot, 'course-content/runtime/knowledge/projection/releases', V022_PROJECTION_ID),
  );
  copyIfMissing(
    path.join(candidateRoot, TEACHING_CANDIDATE_RELATIVE, 'prerequisites/releases', V022_PUBLICATION_ID),
    path.join(input.repoRoot, 'course-content/runtime/knowledge/prerequisites/releases', V022_PUBLICATION_ID),
  );

  const sealedCatalogPath = path.join(candidateRoot, CATALOG_CANDIDATE_RELATIVE, 'runtime.json');
  const catalog = readJson(sealedCatalogPath);
  if (String(catalog.catalogId) !== V022_ENVELOPE.catalogId) {
    throw new Error(`sealed v0.22 catalog identity drifted: ${String(catalog.catalogId)}`);
  }

  const authorityManifest = readJson(path.join(
    input.repoRoot,
    'course-content/authoring/knowledge/authority/releases',
    V022_SNAPSHOT,
    'manifest.json',
  ));
  const engineering = readJson(path.join(
    input.repoRoot,
    'course-content/authoring/knowledge/authority/releases',
    V022_SNAPSHOT,
    'engineering.json',
  ));
  const catalogMemberships = Array.isArray(catalog.memberships) ? catalog.memberships : [];
  const snapshotObjects = Array.isArray(engineering.objects)
    ? engineering.objects as Array<Record<string, unknown>>
    : [];
  const snapshotIds = new Set(snapshotObjects.map((row) => String(row.canonicalId ?? '')));
  const missingCatalogMembers = catalogMemberships
    .map((row) => asRecord(row))
    .filter((row) => {
      const canonicalId = String(row.canonicalId ?? '');
      return canonicalId.length > 0 && !snapshotIds.has(canonicalId);
    })
    .map((row, index) => ({
      canonicalId: String(row.canonicalId),
      ordinal: snapshotObjects.length + index,
      canonicalType: 'DomainConcept',
      semanticName: null,
      reviewStatus: null,
      publicationStatus: null,
      lifecycleStatus: null,
      payload: { displayName: '暂不可用' },
    }));
  const shardEngineering = {
    ...engineering,
    objects: [...snapshotObjects, ...missingCatalogMembers],
  };
  const activationPaths = resolveConsumerActivationStorePaths(
    path.join(input.repoRoot, 'course-content/runtime/knowledge/consumer-activation'),
  );
  const priorPointer = readCurrentConsumerActivationPointer(activationPaths);
  const projectionReleaseDir = path.join(
    input.repoRoot,
    'course-content/runtime/knowledge/projection/releases',
    V022_PROJECTION_ID,
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
    V022_SNAPSHOT,
  );
  stageConsumerActivation(activationPaths, {
    artifacts: {
      captureRevision: String(authorityManifest.captureRevision ?? ''),
      authority: {
        present: true,
        releaseId: String(authorityManifest.releaseId),
        snapshotId: V022_SNAPSHOT,
        snapshotHash: V022_TARGET_IDENTITIES.authority.hash!,
        captureRevision: String(authorityManifest.captureRevision ?? ''),
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
        projectionId: V022_PROJECTION_ID,
        projectionHash: V022_TARGET_IDENTITIES.projection.hash!,
        authorityReleaseId: String(authorityManifest.releaseId),
        captureRevision: String(authorityManifest.captureRevision ?? ''),
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
    activationId: V022_PRODUCTION_ACTIVATION_ID,
    stagedAt: '2026-08-20T00:00:00.000Z',
  });
  const stagedActivation = readJson(path.join(
    input.repoRoot,
    'course-content/runtime/knowledge/consumer-activation/releases',
    V022_PRODUCTION_ACTIVATION_ID,
    'activation.json',
  ));
  const shardPaths = resolveAuthorityDomainShardPaths(input.repoRoot);
  const materialized = buildAuthorityDomainShards({
    envelope: {
      contract: AUTHORITY_SHARD_ENVELOPE_CONTRACT,
      authority: {
        snapshotId: String(authorityManifest.snapshotId),
        snapshotHash: String(authorityManifest.snapshotHash),
        releaseId: String(authorityManifest.releaseId),
        releaseSetId: String(authorityManifest.releaseSetId),
        activationId: V022_PRODUCTION_ACTIVATION_ID,
        activationHash: String(stagedActivation.activationHash ?? ''),
        projectionId: null,
        projectionHash: null,
      },
      catalog: {
        catalogId: String(catalog.catalogId),
        catalogHash: String(catalog.catalogHash),
        catalogVersion: String(catalog.catalogVersion ?? ''),
      },
      teaching: {
        status: 'unavailable' as const,
        projectionId: null,
        projectionHash: null,
        teachingCacheFamily: null,
      },
      match: { authority: true as const, catalog: true as const, teaching: null },
    },
    catalog: catalog as never,
    engineering: shardEngineering as never,
    teaching: createTeachingOverlay(null),
    activatedAt: '2026-08-20T00:00:00.000Z',
  });
  const target = shardSetDir(shardPaths, materialized.manifest.shardSetId);
  for (const [relative, value] of Object.entries(materialized.files)) {
    writeJsonFile(path.join(target, relative), value);
  }
  return {
    shardSetId: materialized.manifest.shardSetId,
    shardSetHash: String(materialized.manifest.shardSetHash ?? materialized.manifest.shardSetId.replace(/^ads-/, '')),
    activationId: V022_PRODUCTION_ACTIVATION_ID,
  };
}

export function applyLiveV022Catalog(root: string, candidateRoot = root): void {
  const catalogPaths = resolveAuthorityDomainCatalogPaths(root);
  const sealedCatalogPath = path.join(candidateRoot, CATALOG_CANDIDATE_RELATIVE, 'runtime.json');
  const catalog = readJson(sealedCatalogPath);
  if (String(catalog.catalogId) !== V022_ENVELOPE.catalogId) {
    throw new Error(`sealed v0.22 catalog identity drifted: ${String(catalog.catalogId)}`);
  }
  mkdirSync(path.dirname(catalogPaths.runtimeCatalogPath), { recursive: true });
  cpSync(sealedCatalogPath, catalogPaths.runtimeCatalogPath);
  replacePointerFile(catalogPaths.runtimeCurrentPath, Buffer.from(`${JSON.stringify({
    contract: 'act-authority-domain-display-catalog-current/v1',
    catalogId: V022_ENVELOPE.catalogId,
    catalogHash: V022_ENVELOPE.catalogHash,
    snapshotId: V022_ENVELOPE.authoritySnapshotId,
    snapshotHash: V022_ENVELOPE.authoritySnapshotHash,
    releaseId: V022_ENVELOPE.authorityReleaseId,
    activatedAt: '2026-08-20T00:00:00.000Z',
  })}\n`));
}

function readLive(root: string, component: V022CutoverComponent): PointerIdentity | null {
  const filePath = path.join(root, V022_CUTOVER_POINTER_PATHS[component]);
  if (!existsSync(filePath)) return null;
  return pointerIdentityFromBytes(component, readFileSync(filePath));
}

export function createV022LivePointerBackend(root: string): CutoverPointerBackend {
  return {
    read(component) {
      return readLive(root, component);
    },
    apply(component, targetId) {
      unlinkIfSymlink(path.join(root, V022_CUTOVER_POINTER_PATHS[component]));
      if (component === 'authority') {
        const result = activateAuthoritySnapshot(
          resolveAuthorityStorePaths(path.join(root, 'course-content/authoring/knowledge/authority')),
          {
            snapshotId: targetId,
            teachingSelectors: emptyTeachingSelectorFingerprint(),
            activationReceiptId: 'v022-cutover-authority',
            activatedAt: '2026-08-20T00:00:00.000Z',
          },
        );
        if (result.status !== 'activated') {
          throw new Error(`authority activate failed: ${result.receipt.reasons.join(',')}`);
        }
      } else if (component === 'projection') {
        const result = activateTeachingProjection(
          resolveTeachingProjectionStorePaths(path.join(root, 'course-content/runtime/knowledge/projection')),
          { projectionId: targetId, activatedAt: '2026-08-20T00:00:00.000Z' },
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
        applyLiveV022Catalog(root);
        const shardPaths = resolveAuthorityDomainShardPaths(root);
        const pointerPath = path.join(root, V022_CUTOVER_POINTER_PATHS[component]);
        const manifest = readJson(path.join(shardSetDir(shardPaths, targetId), 'manifest.json'));
        const catalogCurrent = readJson(path.join(
          root,
          'course-content/runtime/knowledge/authority-domain-catalog/current.json',
        ));
        replacePointerFile(pointerPath, Buffer.from(`${JSON.stringify({
          contract: 'act-authority-domain-shard-current/v1',
          shardSetId: targetId,
          shardSetHash: String(manifest.shardSetHash ?? V022_TARGET_IDENTITIES['authority-domain-shards'].hash),
          snapshotId: V022_SNAPSHOT,
          snapshotHash: V022_TARGET_IDENTITIES.authority.hash,
          releaseId: V022_ENVELOPE.authorityReleaseId,
          catalogId: catalogCurrent.catalogId,
          catalogHash: catalogCurrent.catalogHash,
          teachingProjectionId: V022_PROJECTION_ID,
          teachingProjectionHash: V022_TARGET_IDENTITIES.projection.hash,
          activatedAt: '2026-08-20T00:00:00.000Z',
        })}\n`));
      } else {
        const result = activateConsumerActivation(
          resolveConsumerActivationStorePaths(
            path.join(root, 'course-content/runtime/knowledge/consumer-activation'),
          ),
          {
            activationId: targetId,
            activationReceiptId: 'v022-cutover-consumers',
            activatedAt: '2026-08-20T00:00:00.000Z',
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
      replacePointerFile(path.join(root, V022_CUTOVER_POINTER_PATHS[component]), predecessor.bytes);
      return pointerIdentityFromBytes(component, predecessor.bytes);
    },
  };
}
