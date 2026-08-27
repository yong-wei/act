#!/usr/bin/env tsx
/**
 * Materialize the already staged r4-c4 runtime selector set in the source
 * release tree. This is intentionally local-only: production sees these
 * pointers only when the resulting immutable Runtime release is selected.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { AuthorityDomainCatalogRuntime } from '@/lib/authority-domain-catalog/contracts';
import type { AuthorityDomainCatalogCurrentPointer } from '@/lib/authority-domain-catalog/contracts';
import type { AuthorityShardCurrentPointer } from '@/lib/authority-domain-shards/contracts';
import {
  loadStagedTeachingProjection,
  type TeachingProjectionCurrentPointer,
} from '@/lib/teaching-projection/store';
import {
  loadPrerequisitePublication,
  type PrerequisiteCurrentPointer,
} from '@/lib/teaching-projection/prerequisites/store';
import {
  loadStagedConsumerActivation,
  resolveConsumerActivationStorePaths,
} from '@/lib/versioned-knowledge-activation/store';
import type {
  ConsumerActivationCurrentPointer,
  ConsumerActivationManifest,
  ConsumerActivationReceipt,
} from '@/lib/versioned-knowledge-activation/contracts';
import { projectionDigest } from '@/lib/teaching-projection/hash';

const ROOT = process.cwd();
const LEGACY_CANDIDATE_ROOT = 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c4';
const LEGACY_PROJECTION_ID = 'proj-f090374308ccb75e719afd0b1fb4e439e532db60e7a0096596b6c0684247b556';
const LEGACY_PREREQUISITE_ID = 'proj-ff5a3cd77ae7316acc7f7dde88b0ba1143da8ab9e4eb262ebf66e91c767c2f10';
const LEGACY_ACTIVATION_RECEIPT_ID = 'coordinated-r4-c4-consumers-v022';

function absolute(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(absolute(filePath), 'utf8')) as T;
}

function sha256File(filePath: string): string {
  return createHash('sha256').update(readFileSync(absolute(filePath))).digest('hex');
}

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

function requireArgs(): {
  activatedAt: string;
  apply: boolean;
  candidateRoot: string;
  domainShardRoot: string;
  projectionId: string;
  prerequisiteId: string;
  activationReceiptId: string;
  productionPredecessor: string;
} {
  if (!process.argv.includes('--apply')) {
    throw new Error('usage: --apply --activated-at <millisecond RFC3339 UTC timestamp>');
  }
  const activatedAt = option('--activated-at', '');
  if (!activatedAt || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(activatedAt)) {
    throw new Error('--activated-at must be a millisecond RFC3339 UTC timestamp');
  }
  const candidateRoot = option('--candidate-root', LEGACY_CANDIDATE_ROOT);
  return {
    activatedAt,
    apply: true,
    candidateRoot,
    domainShardRoot: option('--domain-shard-root', `${candidateRoot}/domain-shards-v022-predecessor`),
    projectionId: option('--projection-id', LEGACY_PROJECTION_ID),
    prerequisiteId: option('--prerequisite-id', LEGACY_PREREQUISITE_ID),
    activationReceiptId: option('--activation-receipt-id', LEGACY_ACTIVATION_RECEIPT_ID),
    productionPredecessor: option(
      '--production-predecessor',
      `${candidateRoot}/active-baseline/production-v022-consumer-activation.json`,
    ),
  };
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  const target = absolute(filePath);
  mkdirSync(path.dirname(target), { recursive: true });
  const body = `${JSON.stringify(value, null, 2)}\n`;
  const temporary = `${target}.${process.pid}.tmp`;
  writeFileSync(temporary, body, 'utf8');
  renameSync(temporary, target);
}

function main(): void {
  const args = requireArgs();
  const catalog = readJson<AuthorityDomainCatalogRuntime>(`${args.candidateRoot}/domain-catalog/catalog.json`);
  const catalogPointer = readJson<AuthorityDomainCatalogCurrentPointer>(`${args.candidateRoot}/domain-catalog/current.json`);
  const shardPointer = readJson<AuthorityShardCurrentPointer>(`${args.domainShardRoot}/current.json`);
  const scope = readJson<{
    courseId: string;
    scopeHash: string;
    authority: {
      snapshotId: string;
      snapshotHash: string;
      releaseId: string;
      releaseSetId: string;
    };
  }>(`${args.candidateRoot}/domain-catalog/scope.json`);
  if (
    catalogPointer.catalogId !== catalog.catalogId
    || catalogPointer.catalogHash !== catalog.catalogHash
    || shardPointer.catalogId !== catalog.catalogId
    || shardPointer.catalogHash !== catalog.catalogHash
  ) {
    throw new Error('r4 coordinated catalog and shard selector identities are not closed');
  }

  const projectionRoot = absolute('course-content/runtime/knowledge/projection');
  const projection = loadStagedTeachingProjection(
    { root: projectionRoot, currentPointer: path.join(projectionRoot, 'current.json'), releasesDir: path.join(projectionRoot, 'releases') },
    args.projectionId,
  );
  if (
    !projection.artifacts.gate.passed
    || projection.artifacts.manifest.gatePassed === false
    || projection.artifacts.manifest.authoritySnapshotId !== catalog.authorityBinding.snapshotId
    || projection.artifacts.manifest.authoritySnapshotHash !== catalog.authorityBinding.snapshotHash
    || projection.artifacts.manifest.scopeId !== scope.courseId
    || projection.artifacts.manifest.authoritySnapshotId !== scope.authority.snapshotId
    || projection.artifacts.manifest.authoritySnapshotHash !== scope.authority.snapshotHash
  ) {
    throw new Error('r4 coordinated Teaching Projection does not close over the selected course scope and Authority snapshot');
  }
  const projectionManifestPath = `course-content/runtime/knowledge/projection/releases/${projection.projectionId}/projection-manifest.json`;
  const projectionScopeBindingInput = {
    contract: 'r4-coordinated-teaching-projection-scope-binding/v1',
    courseId: scope.courseId,
    scopeHash: scope.scopeHash,
    projectionId: projection.projectionId,
    projectionHash: projection.projectionHash,
    projectionManifestSha256: sha256File(projectionManifestPath),
    authority: {
      snapshotId: projection.artifacts.manifest.authoritySnapshotId,
      snapshotHash: projection.artifacts.manifest.authoritySnapshotHash,
      releaseId: projection.artifacts.manifest.authorityReleaseId,
      releaseSetId: projection.artifacts.manifest.authorityReleaseSetId,
    },
  };
  const projectionScopeBinding = {
    ...projectionScopeBindingInput,
    bindingHash: projectionDigest(projectionScopeBindingInput),
  };
  const projectionPointer: TeachingProjectionCurrentPointer = {
    contract: 'act-teaching-projection-current/v1',
    projectionId: projection.projectionId,
    projectionHash: projection.projectionHash,
    authorityReleaseId: projection.artifacts.manifest.authorityReleaseId,
    activatedAt: args.activatedAt,
  };

  const prerequisiteRoot = absolute('course-content/runtime/knowledge/prerequisites');
  const prerequisite = loadPrerequisitePublication(
    { root: prerequisiteRoot, currentPointer: path.join(prerequisiteRoot, 'current.json'), releasesDir: path.join(prerequisiteRoot, 'releases') },
    args.prerequisiteId,
  );
  if (
    !prerequisite.gate.passed
    || prerequisite.gate.status !== 'PUBLISHED'
    || prerequisite.manifest.projectionCaptureId !== projection.projectionId
  ) {
    throw new Error('r4 coordinated prerequisite publication does not close over the selected Teaching Projection');
  }
  const prerequisitePointer: PrerequisiteCurrentPointer = {
    contract: 'act-teaching-prerequisite-current/v1',
    publicationId: prerequisite.manifest.publicationId,
    publicationHash: prerequisite.manifest.publicationHash,
    authorityReleaseId: prerequisite.manifest.authorityReleaseId,
    activatedAt: args.activatedAt,
  };

  const activationPaths = resolveConsumerActivationStorePaths(
    absolute('course-content/runtime/knowledge/consumer-activation'),
  );
  const activationStage = readJson<{
    readonly successor: { readonly activationId: string; readonly activationHash: string };
  }>(`${args.candidateRoot}/consumer-activation-stage.json`);
  const activation = loadStagedConsumerActivation(activationPaths, activationStage.successor.activationId);
  if (activation.activationHash !== activationStage.successor.activationHash) {
    throw new Error('r4 coordinated activation stage receipt does not match its staged manifest');
  }
  if (activation.manifest.impact.readyConsumerIds.length !== 6) {
    throw new Error('r4 coordinated activation does not make all six consumers READY');
  }
  const productionPredecessor = readJson<ConsumerActivationManifest>(
    args.productionPredecessor,
  );
  if (
    activation.manifest.priorActivationId !== productionPredecessor.activationId
    || activation.manifest.priorActivationHash !== productionPredecessor.activationHash
  ) {
    throw new Error('r4 coordinated activation does not bind the captured production v0.22 predecessor');
  }
  const candidate = {
    contract: 'r4-coordinated-runtime-selector-set/v2',
    activatedAt: args.activatedAt,
    selectors: {
      projection: projectionPointer,
      projectionScopeBinding: {
        projectionHash: projectionScopeBinding.projectionHash,
        scopeHash: projectionScopeBinding.scopeHash,
        bindingHash: projectionScopeBinding.bindingHash,
      },
      prerequisite: prerequisitePointer,
      catalog: catalogPointer,
      shards: shardPointer,
      consumerActivation: {
        activationId: activation.activationId,
        activationHash: activation.activationHash,
        activationReceiptId: args.activationReceiptId,
      },
    },
    selectorHash: '',
  };
  const { selectorHash: ignoredSelectorHash, ...selectorHashInput } = candidate;
  void ignoredSelectorHash;
  const selectorSet = { ...candidate, selectorHash: projectionDigest(selectorHashInput) };
  if (!args.apply) {
    process.stdout.write(`${JSON.stringify({ ...selectorSet, applied: false }, null, 2)}\n`);
    return;
  }

  // This tree is an immutable Runtime candidate, not the live production
  // selector store. Its pointer/receipt explicitly bind the captured v0.22
  // predecessor; the stopped-service production transaction rechecks that
  // predecessor before the Runtime release can be selected.
  const consumerPointer: ConsumerActivationCurrentPointer = {
    contract: 'act-versioned-knowledge-consumer-activation-current/v1',
    activationId: activation.activationId,
    activationHash: activation.activationHash,
    activationReceiptId: args.activationReceiptId,
    activatedAt: args.activatedAt,
  };
  const consumerReceipt: ConsumerActivationReceipt = {
    contract: 'act-versioned-knowledge-consumer-activation-receipt/v1',
    receiptId: args.activationReceiptId,
    activationId: activation.activationId,
    activationHash: activation.activationHash,
    previousActivationId: productionPredecessor.activationId,
    previousActivationHash: productionPredecessor.activationHash,
    activatedAt: args.activatedAt,
    status: 'activated',
    advancedConsumerIds: activation.manifest.impact.readyConsumerIds,
    pinnedConsumerIds: activation.manifest.impact.pinnedConsumerIds,
    blockedConsumerIds: activation.manifest.impact.blockedConsumerIds,
    shadowConsumerIds: activation.manifest.impact.shadowConsumerIds,
    reasons: ['coordinated-runtime-candidate-selector'],
  };
  writeJsonAtomic('course-content/runtime/knowledge/projection/current.json', projectionPointer);
  writeJsonAtomic('course-content/runtime/knowledge/prerequisites/current.json', prerequisitePointer);
  writeJsonAtomic('course-content/runtime/knowledge/authority-domain-catalog/catalog.json', catalog);
  writeJsonAtomic('course-content/runtime/knowledge/authority-domain-catalog/current.json', catalogPointer);
  writeJsonAtomic('course-content/runtime/knowledge/authority-domain-shards/current.json', shardPointer);
  writeJsonAtomic('course-content/runtime/knowledge/consumer-activation/current.json', consumerPointer);
  writeJsonAtomic(`${args.candidateRoot}/projection-scope-binding.json`, projectionScopeBinding);
  writeJsonAtomic(
    `course-content/runtime/knowledge/consumer-activation/activations/${args.activationReceiptId}.json`,
    consumerReceipt,
  );
  writeJsonAtomic(`${args.candidateRoot}/runtime-selector-set.json`, {
    ...selectorSet,
    appliedToSourceTree: true,
    sourceSelectorHashes: {
      projection: sha256File('course-content/runtime/knowledge/projection/current.json'),
      prerequisite: sha256File('course-content/runtime/knowledge/prerequisites/current.json'),
      catalog: sha256File('course-content/runtime/knowledge/authority-domain-catalog/current.json'),
      shards: sha256File('course-content/runtime/knowledge/authority-domain-shards/current.json'),
      consumerActivation: sha256File('course-content/runtime/knowledge/consumer-activation/current.json'),
    },
  });
  process.stdout.write(`${JSON.stringify({ selectorHash: selectorSet.selectorHash, applied: true }, null, 2)}\n`);
}

main();
