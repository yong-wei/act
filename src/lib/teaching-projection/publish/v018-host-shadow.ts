/** Evaluate host/shadow evidence for the v0.18 runtime publication. */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

import { V018_NAMED_CONSUMERS } from '../qualify/v018-qualify-contract';
import {
  V09_ACTIVATION,
  V09_PREREQUISITE,
  V09_PROJECTION,
  V09_RELEASE_ID,
  V09_SNAPSHOT,
} from '../qualify/v018-shared';

export const V018_HOST_SHADOW_CONTRACT = 'actkg-v018-host-shadow/v1' as const;
export const V018_FROZEN_IMAGE_TAG = 'localhost/act-obe-platform:v018-94d585ae63a6';
export const V018_FROZEN_APPLICATION_REVISION =
  '94d585ae63a6f1839ce611c7f8a1271df945933f';
export const V018_SEALED_IMAGE_TAR_SHA256 =
  'bda84f7e312356a503abb751119823493f144d60594709436885a9ba075ed024';
export const V018_SEALED_IMAGE_CONFIG_SHA256 =
  'd2ee9cf73397ab6a6edb994c23f695259f96dc1f056510bbf8b2599d292186d2';
export const V018_STAGED_AUTHORITY_RECEIPT_SHA256 =
  'c2f22672cc4c188dfd607183eca35e74e9c727207b0439512f3180ffed130cd3';
export const V018_STAGED_QUALIFICATION_SHA256 =
  '1444318cc2a62b10bc1c5f358592da59d2c6706d0677c898c7bc54486c5cc3b1';
export const V09_PRODUCTION_AUTHORITY_SHA256 =
  '868c233461d89c6ae1267eca50e80383ef94e36cc769d91cf14532bf8d37af0d';
export const V09_HOST_POINTER_HASHES = {
  authority: V09_PRODUCTION_AUTHORITY_SHA256,
  projection: 'cf553630400a297d678a2927940e011e300e756aa59cd46bccac8489dd6ac703',
  prerequisites: 'a040258e8efef848de45b7b933e0231519d416bd0d9b7c8a3ebb433abb1e6e0e',
  shards: '9613304cbaee9c3e41908f1a73a0a76b886608638ec992c7ad074e656711783c',
  activation: 'e73ac1abd0d691c615308b215f1941ca5bea9b125cb98b844a0b5d969c6fbc0b',
} as const;

export interface HostShadowObservation {
  appImage?: string;
  appImageId?: string;
  workerImage?: string;
  workerImageId?: string;
  workerHealth?: string;
  readyz?: { app?: boolean; db?: boolean; redis?: boolean };
  publicReadyzStatus?: number;
  authorityReleaseId?: string;
  authoritySnapshotId?: string;
  authoritySha256?: string;
  projectionId?: string;
  projectionSha256?: string;
  prerequisitePublicationId?: string;
  prerequisiteSha256?: string;
  activationId?: string;
  activationSha256?: string;
  shardSha256?: string;
  shardCurrentPresent?: boolean;
  stagedAuthorityReceiptSha256?: string;
  stagedAuthorityMountedSha256?: string;
  stagedQualificationSha256?: string;
  activeGraphReleaseId?: string;
  activeGraphSnapshotId?: string;
  consumerStatuses?: ReadonlyArray<{ consumerId: string; status: string }>;
  consumerShadowSource?: 'deployed-image-staged-candidate' | 'local-qualification';
  pointersUnchangedAfterStage?: boolean;
}

const HOST_POINTER_PATHS = {
  authority: 'course-content/authoring/knowledge/authority/current.json',
  projection: 'course-content/runtime/knowledge/projection/current.json',
  prerequisites: 'course-content/runtime/knowledge/prerequisites/current.json',
  shards: 'course-content/runtime/knowledge/authority-domain-shards/current.json',
  activation: 'course-content/runtime/knowledge/consumer-activation/current.json',
} as const;

export function expectedHostPointerHashes(): Record<string, string> {
  return {
    [HOST_POINTER_PATHS.authority]: V09_HOST_POINTER_HASHES.authority,
    [HOST_POINTER_PATHS.projection]: V09_HOST_POINTER_HASHES.projection,
    [HOST_POINTER_PATHS.prerequisites]: V09_HOST_POINTER_HASHES.prerequisites,
    [HOST_POINTER_PATHS.shards]: V09_HOST_POINTER_HASHES.shards,
    [HOST_POINTER_PATHS.activation]: V09_HOST_POINTER_HASHES.activation,
  };
}

export function loadHostShadowVerificationReport(filePath: string): {
  digest: string | null;
  status: 'READY' | 'BLOCKED';
  blockers: string[];
  pointerHashes: Record<string, string>;
  observedAppImage: string | null;
  observedWorkerImage: string | null;
} {
  if (!existsSync(filePath)) {
    return {
      digest: null,
      status: 'BLOCKED',
      blockers: ['host-shadow-verification-incomplete'],
      pointerHashes: {},
      observedAppImage: null,
      observedWorkerImage: null,
    };
  }
  const bytes = readFileSync(filePath);
  const digest = createHash('sha256').update(bytes).digest('hex');
  let record: Record<string, unknown> = {};
  try {
    record = JSON.parse(bytes.toString('utf8')) as Record<string, unknown>;
  } catch {
    return {
      digest,
      status: 'BLOCKED',
      blockers: ['host-shadow-report-unreadable'],
      pointerHashes: {},
      observedAppImage: null,
      observedWorkerImage: null,
    };
  }
  const blockers: string[] = [];
  if (record.contract !== V018_HOST_SHADOW_CONTRACT) blockers.push('host-shadow-contract-mismatch');
  const rawHashes = record.pointerHashes && typeof record.pointerHashes === 'object'
    ? record.pointerHashes as Record<string, unknown>
    : {};
  const pointerHashes: Record<string, string> = {};
  const expected = expectedHostPointerHashes();
  for (const [pathKey, expectedHash] of Object.entries(expected)) {
    const actual = rawHashes[pathKey];
    if (typeof actual === 'string' && /^[a-f0-9]{64}$/u.test(actual)) {
      pointerHashes[pathKey] = actual;
      if (actual !== expectedHash) blockers.push('host-pointer-hash-mismatch');
    }
  }
  if (Object.keys(pointerHashes).length !== Object.keys(expected).length) {
    blockers.push('host-pointer-hashes-incomplete');
  }
  let observedAppImage: string | null = null;
  let observedWorkerImage: string | null = null;
  if (record.observation && typeof record.observation === 'object') {
    const observation = record.observation as HostShadowObservation;
    observedAppImage = typeof observation.appImage === 'string' ? observation.appImage : null;
    observedWorkerImage = typeof observation.workerImage === 'string' ? observation.workerImage : null;
    const derived = hostPointerHashesFromObservation(observation);
    const derivedKeys = Object.keys(derived).sort();
    const sealedKeys = Object.keys(pointerHashes).sort();
    if (derivedKeys.join(',') !== sealedKeys.join(',')
      || derivedKeys.some((key) => derived[key] !== pointerHashes[key])) {
      blockers.push('host-pointer-hash-observation-drift');
    }
    blockers.push(...evaluateV018HostShadow(observation).blockers);
  } else {
    blockers.push('host-shadow-observation-missing');
  }
  const fileBlockers = Array.isArray(record.blockers)
    ? record.blockers.filter((value): value is string => typeof value === 'string')
    : [];
  blockers.push(...fileBlockers);
  const unique = [...new Set(blockers)].sort();
  const status = record.status === 'READY' && unique.length === 0 ? 'READY' as const : 'BLOCKED' as const;
  return { digest, status, blockers: unique, pointerHashes, observedAppImage, observedWorkerImage };
}

export function hostPointerHashesFromObservation(
  observation: HostShadowObservation,
): Record<string, string> {
  const hashes: Record<string, string> = {};
  if (observation.authoritySha256) {
    hashes['course-content/authoring/knowledge/authority/current.json'] = observation.authoritySha256;
  }
  if (observation.projectionSha256) {
    hashes['course-content/runtime/knowledge/projection/current.json'] = observation.projectionSha256;
  }
  if (observation.prerequisiteSha256) {
    hashes['course-content/runtime/knowledge/prerequisites/current.json'] = observation.prerequisiteSha256;
  }
  if (observation.shardSha256) {
    hashes['course-content/runtime/knowledge/authority-domain-shards/current.json'] = observation.shardSha256;
  }
  if (observation.activationSha256) {
    hashes['course-content/runtime/knowledge/consumer-activation/current.json'] = observation.activationSha256;
  }
  return hashes;
}

export function evaluateV018HostShadow(observation: HostShadowObservation): {
  status: 'READY' | 'BLOCKED';
  blockers: string[];
} {
  const blockers: string[] = [];
  if (observation.appImage !== V018_FROZEN_IMAGE_TAG) blockers.push('host-app-image-mismatch');
  if (observation.workerImage !== V018_FROZEN_IMAGE_TAG) blockers.push('host-worker-image-mismatch');
  const appImageId = (observation.appImageId ?? '').replace(/^sha256:/, '');
  const workerImageId = (observation.workerImageId ?? '').replace(/^sha256:/, '');
  if (appImageId !== V018_SEALED_IMAGE_CONFIG_SHA256) blockers.push('host-app-image-digest-mismatch');
  if (workerImageId !== V018_SEALED_IMAGE_CONFIG_SHA256) blockers.push('host-worker-image-digest-mismatch');
  if (observation.workerHealth !== 'healthy') blockers.push('host-worker-unhealthy');
  if (observation.readyz?.app !== true || observation.readyz.db !== true || observation.readyz.redis !== true) {
    blockers.push('host-readyz-incomplete');
  }
  if (observation.publicReadyzStatus !== 200) blockers.push('public-readyz-unhealthy');
  if (observation.authorityReleaseId !== V09_RELEASE_ID || observation.authoritySnapshotId !== V09_SNAPSHOT) {
    blockers.push('host-v09-authority-drift');
  }
  if (observation.projectionId !== V09_PROJECTION) blockers.push('host-v09-projection-drift');
  if (observation.prerequisitePublicationId !== V09_PREREQUISITE) blockers.push('host-v09-prerequisite-drift');
  if (observation.activationId !== V09_ACTIVATION) blockers.push('host-v09-activation-drift');
  if (observation.authoritySha256 !== V09_HOST_POINTER_HASHES.authority) {
    blockers.push(observation.authoritySha256 ? 'host-v09-authority-hash-drift' : 'host-v09-authority-selector-missing');
  }
  if (observation.projectionSha256 !== V09_HOST_POINTER_HASHES.projection) {
    blockers.push(observation.projectionSha256 ? 'host-v09-projection-hash-drift' : 'host-v09-projection-selector-missing');
  }
  if (observation.prerequisiteSha256 !== V09_HOST_POINTER_HASHES.prerequisites) {
    blockers.push(observation.prerequisiteSha256 ? 'host-v09-prerequisite-hash-drift' : 'host-v09-prerequisite-selector-missing');
  }
  if (observation.activationSha256 !== V09_HOST_POINTER_HASHES.activation) {
    blockers.push(observation.activationSha256 ? 'host-v09-activation-hash-drift' : 'host-v09-activation-selector-missing');
  }
  if (observation.shardSha256 !== V09_HOST_POINTER_HASHES.shards) {
    blockers.push(observation.shardSha256 ? 'host-v09-shard-hash-drift' : 'host-v09-shard-selector-missing');
  }
  if (observation.stagedAuthorityReceiptSha256 !== V018_STAGED_AUTHORITY_RECEIPT_SHA256) {
    blockers.push('host-v018-authority-stage-drift');
  }
  if (observation.stagedAuthorityMountedSha256 !== V018_STAGED_AUTHORITY_RECEIPT_SHA256) {
    blockers.push('host-v018-authority-not-mounted-in-sidecar');
  }
  if (observation.stagedQualificationSha256 !== V018_STAGED_QUALIFICATION_SHA256) {
    blockers.push('host-v018-qualification-stage-drift');
  }
  const pointersMatch = observation.authoritySha256 === V09_HOST_POINTER_HASHES.authority
    && observation.projectionSha256 === V09_HOST_POINTER_HASHES.projection
    && observation.prerequisiteSha256 === V09_HOST_POINTER_HASHES.prerequisites
    && observation.activationSha256 === V09_HOST_POINTER_HASHES.activation
    && observation.shardSha256 === V09_HOST_POINTER_HASHES.shards;
  if (observation.pointersUnchangedAfterStage !== true || !pointersMatch) {
    blockers.push('host-pointer-changed-during-stage');
  }
  if (observation.activeGraphReleaseId !== V09_RELEASE_ID) blockers.push('host-active-graph-not-v09');
  if (observation.activeGraphSnapshotId !== V09_SNAPSHOT) blockers.push('host-active-graph-snapshot-drift');
  const consumers = observation.consumerStatuses ?? [];
  const readyIds = consumers
    .filter((row) => row.status === 'READY')
    .map((row) => row.consumerId)
    .sort();
  if (observation.consumerShadowSource !== 'deployed-image-staged-candidate') {
    blockers.push('host-v018-shadow-not-executed-on-deployed-image');
  }
  if (readyIds.join(',') !== [...V018_NAMED_CONSUMERS].sort().join(',')) {
    blockers.push('host-v018-consumer-shadow-incomplete');
  }
  const unique = [...new Set(blockers)].sort();
  return {
    status: unique.length === 0 ? 'READY' : 'BLOCKED',
    blockers: unique,
  };
}
