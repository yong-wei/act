/** Evaluate host/shadow evidence for the v0.18 runtime publication. */

import { V018_NAMED_CONSUMERS } from '../qualify/v018-qualify-contract';
import {
  V09_ACTIVATION,
  V09_PREREQUISITE,
  V09_PROJECTION,
  V09_RELEASE_ID,
  V09_SNAPSHOT,
} from '../qualify/v018-shared';
import { V09_POINTER_HASHES } from './v018-runtime-release';

export const V018_HOST_SHADOW_CONTRACT = 'actkg-v018-host-shadow/v1' as const;
export const V018_FROZEN_IMAGE_TAG = 'localhost/act-obe-platform:v018-94d585ae63a6';
export const V018_STAGED_AUTHORITY_RECEIPT_SHA256 =
  'c2f22672cc4c188dfd607183eca35e74e9c727207b0439512f3180ffed130cd3';
export const V018_STAGED_QUALIFICATION_SHA256 =
  '1444318cc2a62b10bc1c5f358592da59d2c6706d0677c898c7bc54486c5cc3b1';
export const V09_PRODUCTION_AUTHORITY_SHA256 =
  '868c233461d89c6ae1267eca50e80383ef94e36cc769d91cf14532bf8d37af0d';
export const V09_HOST_POINTER_HASHES = {
  authority: V09_PRODUCTION_AUTHORITY_SHA256,
  projection: V09_POINTER_HASHES['course-content/runtime/knowledge/projection/current.json'],
  prerequisites: V09_POINTER_HASHES['course-content/runtime/knowledge/prerequisites/current.json'],
  shards: V09_POINTER_HASHES['course-content/runtime/knowledge/authority-domain-shards/current.json'],
  activation: V09_POINTER_HASHES['course-content/runtime/knowledge/consumer-activation/current.json'],
} as const;

export interface HostShadowObservation {
  appImage?: string;
  workerImage?: string;
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

export function evaluateV018HostShadow(observation: HostShadowObservation): {
  status: 'READY' | 'BLOCKED';
  blockers: string[];
} {
  const blockers: string[] = [];
  if (observation.appImage !== V018_FROZEN_IMAGE_TAG) blockers.push('host-app-image-mismatch');
  if (observation.workerImage !== V018_FROZEN_IMAGE_TAG) blockers.push('host-worker-image-mismatch');
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
