/** Evaluate host/shadow evidence for the v0.22 runtime publication. */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

import { envelopeByName } from '../../../src/lib/actkg-envelope/composite-envelope-registry';
import { V022_NAMED_CONSUMERS } from '../qualify/v022-qualify-contract';

export const V022_HOST_SHADOW_CONTRACT = 'actkg-v022-host-shadow/v1' as const;
export const CURRENT_PUBLIC_DOMAIN_LABELS = [
  '系统建模',
  '时域分析',
  '稳定性分析',
  '频域分析',
  '根轨迹',
  '经典控制设计',
  '离散时间控制分析',
  '状态空间控制分析与设计',
] as const;

export const V09_LOCAL_POINTER_HASHES = {
  authority: '086f14793fbf2aa3afc8fba471503042242645122425c3018b6526e8ab2835f2',
  projection: 'cf553630400a297d678a2927940e011e300e756aa59cd46bccac8489dd6ac703',
  prerequisites: 'a040258e8efef848de45b7b933e0231519d416bd0d9b7c8a3ebb433abb1e6e0e',
  shards: '9613304cbaee9c3e41908f1a73a0a76b886608638ec992c7ad074e656711783c',
  activation: 'e73ac1abd0d691c615308b215f1941ca5bea9b125cb98b844a0b5d969c6fbc0b',
} as const;

export const V018_HOST_POINTER_HASHES = {
  authority: 'd0a3dd3de9f176cdd185302d91a67d2c3406fdfb271fea75bd583c3127e8cd9d',
  projection: '53cc566e0e590b4127b121291aceeb847e38aa16449767d3c8db3e951f79e812',
  prerequisites: 'ee266789e779bce9c7bec07d87809f550fb241deebecffb25f250e2467df6db2',
  shards: 'b128456356799c4382d8e4ccd4c13b28ec7b95f40079389e728fad017892b3b6',
  activation: '8e0a7a69124afcd9d9d6baa324db297c4f4e479bbeca6cc658881fe5b353e881',
} as const;

export interface V022HostShadowObservation {
  boundEnvelopeName?: string;
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
  shardSetId?: string;
  shardSha256?: string;
  catalogId?: string;
  activationId?: string;
  activationSha256?: string;
  pointersUnchangedAfterStage?: boolean;
  publicCurrentLabels?: readonly string[];
  publicTeachingHttpStatus?: number;
  publicTeachingDomainId?: string;
  stagedQualificationSha256?: string;
  shadowCatalogMembershipCount?: number;
  expectedCatalogMembershipCount?: number;
  consumerStatuses?: ReadonlyArray<{ consumerId: string; status: string }>;
}

const HOST_POINTER_PATHS = {
  authority: 'course-content/authoring/knowledge/authority/current.json',
  projection: 'course-content/runtime/knowledge/projection/current.json',
  prerequisites: 'course-content/runtime/knowledge/prerequisites/current.json',
  shards: 'course-content/runtime/knowledge/authority-domain-shards/current.json',
  activation: 'course-content/runtime/knowledge/consumer-activation/current.json',
} as const;

export function expectedPointerHashesForEnvelope(
  name: string,
  source: 'local' | 'host' = 'local',
): Record<string, string> {
  if (name === 'control-theory-engineering-v0.9') {
    const hashes = V09_LOCAL_POINTER_HASHES;
    return {
      [HOST_POINTER_PATHS.authority]: hashes.authority,
      [HOST_POINTER_PATHS.projection]: hashes.projection,
      [HOST_POINTER_PATHS.prerequisites]: hashes.prerequisites,
      [HOST_POINTER_PATHS.shards]: hashes.shards,
      [HOST_POINTER_PATHS.activation]: hashes.activation,
    };
  }
  if (name === 'control-theory-engineering-v0.18' && source === 'host') {
    const hashes = V018_HOST_POINTER_HASHES;
    return {
      [HOST_POINTER_PATHS.authority]: hashes.authority,
      [HOST_POINTER_PATHS.projection]: hashes.projection,
      [HOST_POINTER_PATHS.prerequisites]: hashes.prerequisites,
      [HOST_POINTER_PATHS.shards]: hashes.shards,
      [HOST_POINTER_PATHS.activation]: hashes.activation,
    };
  }
  return {};
}

export function evaluateV022HostShadow(observation: V022HostShadowObservation): {
  status: 'READY' | 'BLOCKED';
  blockers: string[];
} {
  const blockers: string[] = [];
  const boundName = observation.boundEnvelopeName ?? 'control-theory-engineering-v0.9';
  let envelope;
  try {
    envelope = envelopeByName(boundName);
  } catch (error) {
    return {
      status: 'BLOCKED',
      blockers: [error instanceof Error ? error.message : 'bound-envelope-invalid'],
    };
  }
  if (observation.authorityReleaseId !== envelope.authorityReleaseId
    || observation.authoritySnapshotId !== envelope.authoritySnapshotId) {
    blockers.push('host-authority-envelope-drift');
  }
  if (observation.projectionId !== envelope.projectionId) blockers.push('host-projection-envelope-drift');
  if (observation.prerequisitePublicationId !== envelope.publicationId) blockers.push('host-prerequisite-envelope-drift');
  if (!observation.shardSetId || observation.shardSetId !== envelope.shardSetId) blockers.push('host-shard-envelope-drift');
  if (!observation.catalogId || observation.catalogId !== envelope.catalogId) blockers.push('host-catalog-envelope-drift');
  if (observation.activationId !== envelope.activationId) blockers.push('host-activation-envelope-drift');
  if (observation.workerHealth && observation.workerHealth !== 'healthy') blockers.push('host-worker-unhealthy');
  if (observation.readyz && (observation.readyz.app !== true || observation.readyz.db !== true || observation.readyz.redis !== true)) {
    blockers.push('host-readyz-incomplete');
  }
  if (observation.publicReadyzStatus != null && observation.publicReadyzStatus !== 200) {
    blockers.push('public-readyz-unhealthy');
  }
  if (observation.pointersUnchangedAfterStage !== true) blockers.push('host-pointer-changed-during-stage');
  if (observation.publicCurrentLabels) {
    const observed = [...observation.publicCurrentLabels].sort();
    const expected = [...CURRENT_PUBLIC_DOMAIN_LABELS].sort();
    if (observed.join('\n') !== expected.join('\n')) blockers.push('host-public-label-query-failed');
  }
  if (
    observation.publicTeachingHttpStatus != null
    && (observation.publicTeachingHttpStatus !== 200 || observation.publicTeachingDomainId !== 'system-modeling')
  ) {
    blockers.push('host-public-teaching-query-failed');
  }
  if (
    observation.expectedCatalogMembershipCount != null
    && observation.shadowCatalogMembershipCount !== observation.expectedCatalogMembershipCount
  ) {
    blockers.push('v022-shadow-membership-shortfall');
  }
  const consumers = observation.consumerStatuses ?? [];
  const readyIds = consumers.filter((row) => row.status === 'READY').map((row) => row.consumerId).sort();
  if (readyIds.join(',') !== [...V022_NAMED_CONSUMERS].sort().join(',')) {
    blockers.push('host-consumers-not-ready');
  }
  const unique = [...new Set(blockers)].sort();
  return { status: unique.length === 0 ? 'READY' : 'BLOCKED', blockers: unique };
}

export function loadV022HostShadowVerificationReport(filePath: string): {
  digest: string | null;
  status: 'READY' | 'BLOCKED';
  blockers: string[];
} {
  if (!existsSync(filePath)) {
    return {
      digest: null,
      status: 'BLOCKED',
      blockers: ['host-shadow-verification-incomplete'],
    };
  }
  const bytes = readFileSync(filePath);
  const digest = createHash('sha256').update(bytes).digest('hex');
  let record: Record<string, unknown> = {};
  try {
    record = JSON.parse(bytes.toString('utf8')) as Record<string, unknown>;
  } catch {
    return { digest, status: 'BLOCKED', blockers: ['host-shadow-report-unreadable'] };
  }
  const blockers: string[] = [];
  if (record.contract !== V022_HOST_SHADOW_CONTRACT) blockers.push('host-shadow-contract-mismatch');
  if (record.status !== 'READY') blockers.push('host-shadow-not-ready');
  if (record.observation && typeof record.observation === 'object') {
    blockers.push(...evaluateV022HostShadow(record.observation as V022HostShadowObservation).blockers);
  } else {
    blockers.push('host-shadow-observation-missing');
  }
  const fileBlockers = Array.isArray(record.blockers)
    ? record.blockers.filter((value): value is string => typeof value === 'string')
    : [];
  blockers.push(...fileBlockers);
  const unique = [...new Set(blockers)].sort();
  return {
    digest,
    status: record.status === 'READY' && unique.length === 0 ? 'READY' : 'BLOCKED',
    blockers: unique,
  };
}
