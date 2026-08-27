import { serializeDeterministic, sha256Text } from '@/lib/architecture-census/serialize';

import { matchesCacheRule, objectUrlPath, rejectAuthorityOrigin } from './object';
import { assertPortable } from './privacy';
import {
  ACT_ORIGIN,
  CORS_METHODS,
  COST_SCHEMA,
  DELIVERY_BUCKET,
  DNS_SCHEMA,
  ISOLATION_SCHEMA,
  OBJECT_SCHEMA,
  QUALIFICATION_SCHEMA,
  QUALIFICATION_STATUSES,
  ROLLBACK_SCHEMA,
  SERVICE_ROLE_SCHEMA,
  SERVICE_ROLE_SCOPES,
  GIT_SHA,
  SHA256,
  STATIC_HOSTNAME,
  TOOL_VERSION,
  TRANSPORT_SCHEMA,
  type CostReceipt,
  type DnsReceipt,
  type GitCapture,
  type IsolationReceipt,
  type ObjectReceipt,
  type QualificationEnvelope,
  type QualificationStatus,
  type RollbackReceipt,
  type ServiceRoleReceipt,
  type TransportReceipt,
} from './types';

export interface QualifyInput extends GitCapture {
  readonly capturedAt: string;
  readonly serviceRole?: unknown;
  readonly object?: unknown;
  readonly dns?: unknown;
  readonly transport?: unknown;
  readonly isolation?: unknown;
  readonly cost?: unknown;
  readonly originBucket?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireExactKeys(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`invalid-${label}:not-object`);
  const actual = Object.keys(value).sort().join(',');
  const expected = [...keys].sort().join(',');
  if (actual !== expected) throw new Error(`invalid-${label}:fields`);
  return value;
}

function requireSha(value: unknown, label: string): string {
  if (typeof value !== 'string' || !SHA256.test(value)) throw new Error(`invalid-${label}:sha256`);
  return value;
}

function requireSafeInt(value: unknown, label: string, allowNull = false): number | null {
  if (allowNull && value === null) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`invalid-${label}:integer`);
  }
  return value;
}

export function parseServiceRole(raw: unknown): ServiceRoleReceipt {
  const value = requireExactKeys(raw, [
    'schemaVersion', 'principalClass', 'policyIdentity', 'effectiveBucketReadScope', 'accepted',
  ], 'service-role');
  if (value.schemaVersion !== SERVICE_ROLE_SCHEMA) throw new Error('invalid-service-role:schema');
  if (value.principalClass !== 'esa-service-role') throw new Error('invalid-service-role:principal');
  const scope = value.effectiveBucketReadScope;
  if (typeof scope !== 'string' || !SERVICE_ROLE_SCOPES.includes(scope as ServiceRoleReceipt['effectiveBucketReadScope'])) {
    throw new Error('invalid-service-role:scope');
  }
  if (typeof value.accepted !== 'boolean') throw new Error('invalid-service-role:accepted');
  const receipt: ServiceRoleReceipt = {
    schemaVersion: SERVICE_ROLE_SCHEMA,
    principalClass: 'esa-service-role',
    policyIdentity: requireSha(value.policyIdentity, 'service-role-policy'),
    effectiveBucketReadScope: scope as ServiceRoleReceipt['effectiveBucketReadScope'],
    accepted: value.accepted,
  };
  assertPortable(receipt, 'service-role');
  return receipt;
}

export function parseObject(raw: unknown): ObjectReceipt {
  const value = requireExactKeys(raw, [
    'schemaVersion', 'sourcePath', 'sourceSha256', 'objectSha256', 'sizeBytes', 'mediaType',
    'objectKey', 'bucket', 'publicAcl', 'overwriteAttempted', 'etagFingerprint',
  ], 'object');
  if (value.schemaVersion !== OBJECT_SCHEMA) throw new Error('invalid-object:schema');
  if (typeof value.sourcePath !== 'string' || value.sourcePath.includes('..') || value.sourcePath.startsWith('/')) {
    throw new Error('invalid-object:source-path');
  }
  if (value.mediaType !== 'model/gltf-binary') throw new Error('invalid-object:media-type');
  if (typeof value.publicAcl !== 'boolean' || typeof value.overwriteAttempted !== 'boolean') {
    throw new Error('invalid-object:flags');
  }
  if (value.etagFingerprint !== null && (typeof value.etagFingerprint !== 'string' || !SHA256.test(value.etagFingerprint))) {
    throw new Error('invalid-object:etag');
  }
  const receipt: ObjectReceipt = {
    schemaVersion: OBJECT_SCHEMA,
    sourcePath: value.sourcePath,
    sourceSha256: requireSha(value.sourceSha256, 'object-source'),
    objectSha256: requireSha(value.objectSha256, 'object-digest'),
    sizeBytes: requireSafeInt(value.sizeBytes, 'object-size') ?? 0,
    mediaType: 'model/gltf-binary',
    objectKey: String(value.objectKey),
    bucket: String(value.bucket),
    publicAcl: value.publicAcl,
    overwriteAttempted: value.overwriteAttempted,
    etagFingerprint: value.etagFingerprint,
  };
  assertPortable(receipt, 'object');
  return receipt;
}

export function parseDns(raw: unknown): DnsReceipt {
  const value = requireExactKeys(raw, [
    'schemaVersion', 'hostname', 'recordType', 'priorValue', 'priorTtlSeconds',
    'desiredValue', 'applied', 'namesChanged',
  ], 'dns');
  if (value.schemaVersion !== DNS_SCHEMA) throw new Error('invalid-dns:schema');
  if (!Array.isArray(value.namesChanged) || !value.namesChanged.every((item) => typeof item === 'string')) {
    throw new Error('invalid-dns:names');
  }
  if (typeof value.applied !== 'boolean') throw new Error('invalid-dns:applied');
  const receipt: DnsReceipt = {
    schemaVersion: DNS_SCHEMA,
    hostname: String(value.hostname),
    recordType: value.recordType as DnsReceipt['recordType'],
    priorValue: value.priorValue === null ? null : String(value.priorValue),
    priorTtlSeconds: requireSafeInt(value.priorTtlSeconds, 'dns-ttl', true),
    desiredValue: value.desiredValue === null ? null : String(value.desiredValue),
    applied: value.applied,
    namesChanged: value.namesChanged,
  };
  assertPortable(receipt, 'dns');
  return receipt;
}

export function parseTransport(raw: unknown): TransportReceipt {
  const value = requireExactKeys(raw, [
    'schemaVersion', 'https', 'certificateHost', 'fullObjectSha256', 'rangeStatus',
    'contentRange', 'cacheFirst', 'cacheSecond', 'corsOrigin', 'corsMethods',
  ], 'transport');
  if (value.schemaVersion !== TRANSPORT_SCHEMA) throw new Error('invalid-transport:schema');
  if (!Array.isArray(value.corsMethods) || !value.corsMethods.every((item) => typeof item === 'string')) {
    throw new Error('invalid-transport:cors');
  }
  const receipt: TransportReceipt = {
    schemaVersion: TRANSPORT_SCHEMA,
    https: value.https === true,
    certificateHost: String(value.certificateHost),
    fullObjectSha256: requireSha(value.fullObjectSha256, 'transport-hash'),
    rangeStatus: requireSafeInt(value.rangeStatus, 'transport-range') ?? 0,
    contentRange: String(value.contentRange),
    cacheFirst: value.cacheFirst as TransportReceipt['cacheFirst'],
    cacheSecond: value.cacheSecond as TransportReceipt['cacheSecond'],
    corsOrigin: String(value.corsOrigin),
    corsMethods: value.corsMethods,
  };
  assertPortable(receipt, 'transport');
  return receipt;
}

export function parseIsolation(raw: unknown): IsolationReceipt {
  const value = requireExactKeys(raw, ['schemaVersion', 'extraObjectsInBucket', 'probes'], 'isolation');
  if (value.schemaVersion !== ISOLATION_SCHEMA) throw new Error('invalid-isolation:schema');
  if (!Array.isArray(value.probes)) throw new Error('invalid-isolation:probes');
  const probes = value.probes.map((probe, index) => {
    const item = requireExactKeys(probe, ['keyClass', 'served', 'status'], `isolation-probe-${index}`);
    return {
      keyClass: String(item.keyClass) as IsolationReceipt['probes'][number]['keyClass'],
      served: item.served === true,
      status: requireSafeInt(item.status, `isolation-status-${index}`) ?? 0,
    };
  });
  const receipt: IsolationReceipt = {
    schemaVersion: ISOLATION_SCHEMA,
    extraObjectsInBucket: requireSafeInt(value.extraObjectsInBucket, 'isolation-extra') ?? 0,
    probes,
  };
  assertPortable(receipt, 'isolation');
  return receipt;
}

export function parseCost(raw: unknown): CostReceipt {
  const value = requireExactKeys(raw, [
    'schemaVersion', 'ossNetworkOutBytes', 'ossCdnOutBytes', 'esaUsageBytes',
    'reportingDelayHours', 'shiftedNotFree',
  ], 'cost');
  if (value.schemaVersion !== COST_SCHEMA) throw new Error('invalid-cost:schema');
  if (value.shiftedNotFree !== true) throw new Error('invalid-cost:shifted-not-free');
  const receipt: CostReceipt = {
    schemaVersion: COST_SCHEMA,
    ossNetworkOutBytes: requireSafeInt(value.ossNetworkOutBytes, 'cost-network', true),
    ossCdnOutBytes: requireSafeInt(value.ossCdnOutBytes, 'cost-cdn', true),
    esaUsageBytes: requireSafeInt(value.esaUsageBytes, 'cost-esa', true),
    reportingDelayHours: requireSafeInt(value.reportingDelayHours, 'cost-delay', true),
    shiftedNotFree: true,
  };
  assertPortable(receipt, 'cost');
  return receipt;
}

export function validContentRange(contentRange: string, sizeBytes: number | null): boolean {
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/u.exec(contentRange);
  if (!match) return false;
  const start = Number(match[1]);
  const end = Number(match[2]);
  const total = Number(match[3]);
  if (![start, end, total].every((value) => Number.isSafeInteger(value))) return false;
  if (start < 0 || end < start || total < 1 || end >= total) return false;
  if (sizeBytes !== null && total !== sizeBytes) return false;
  return true;
}

export function rollbackPlan(dns: DnsReceipt): RollbackReceipt {
  if (dns.hostname !== STATIC_HOSTNAME) throw new Error('rollback-hostname-mismatch');
  if (dns.namesChanged.some((name) => name !== STATIC_HOSTNAME && name !== `${STATIC_HOSTNAME}.`)) {
    throw new Error('rollback-refuses-unrelated-names');
  }
  const receipt: RollbackReceipt = {
    schemaVersion: ROLLBACK_SCHEMA,
    hostname: STATIC_HOSTNAME,
    restoredValue: dns.priorValue,
    deletedUnrelatedResources: false,
    retainedDeliveryBucket: true,
    retainedObject: true,
  };
  assertPortable(receipt, 'rollback');
  return receipt;
}

export function qualifyDelivery(input: QualifyInput): QualificationEnvelope {
  if (!GIT_SHA.test(input.sourceCommit) || !GIT_SHA.test(input.sourceTree)) {
    throw new Error('invalid-git-identity');
  }
  const blockingReasons: string[] = [];
  const missingEvidence: string[] = [];
  if (input.dirty) blockingReasons.push('dirty-worktree');
  if (input.mixedWorktree) blockingReasons.push('mixed-worktree');

  const originBucket = typeof input.originBucket === 'string' ? input.originBucket : null;
  if (originBucket) {
    const originError = rejectAuthorityOrigin(originBucket);
    if (originError) blockingReasons.push(originError);
  } else {
    missingEvidence.push('origin-bucket');
  }

  let serviceRole: ServiceRoleReceipt | null = null;
  if (input.serviceRole === undefined) missingEvidence.push('service-role');
  else {
    serviceRole = parseServiceRole(input.serviceRole);
    if (!serviceRole.accepted || serviceRole.effectiveBucketReadScope === 'unknown') {
      blockingReasons.push('service-role-unaccepted');
    }
  }

  let object: ObjectReceipt | null = null;
  if (input.object === undefined) missingEvidence.push('object');
  else {
    object = parseObject(input.object);
    const originError = rejectAuthorityOrigin(object.bucket);
    if (originError) blockingReasons.push(originError);
    if (object.publicAcl) blockingReasons.push('object-public-acl');
    if (object.overwriteAttempted) blockingReasons.push('object-overwrite');
    if (object.sourceSha256 !== object.objectSha256) blockingReasons.push('object-digest-mismatch');
    if (object.objectKey !== `assets/${object.objectSha256}/destroyer.glb`) blockingReasons.push('object-key-mismatch');
    if (!matchesCacheRule(objectUrlPath(object.objectSha256))) blockingReasons.push('cache-rule-mismatch');
  }

  let dns: DnsReceipt | null = null;
  if (input.dns === undefined) missingEvidence.push('dns');
  else {
    dns = parseDns(input.dns);
    if (dns.hostname !== STATIC_HOSTNAME) blockingReasons.push('dns-hostname-mismatch');
    if (dns.namesChanged.some((name) => name !== STATIC_HOSTNAME && name !== `${STATIC_HOSTNAME}.`)) {
      blockingReasons.push('dns-scope-violation');
    }
    if (dns.recordType === 'intercepted') {
      if (dns.applied) blockingReasons.push('dns-observation-intercepted');
      else missingEvidence.push('dns-trusted-observation');
    } else if (!dns.applied || dns.recordType !== 'CNAME' || !dns.desiredValue) {
      missingEvidence.push('dns-cutover');
    }
  }

  let transport: TransportReceipt | null = null;
  if (input.transport === undefined) missingEvidence.push('transport');
  else {
    transport = parseTransport(input.transport);
    if (!transport.https) blockingReasons.push('transport-https');
    if (transport.certificateHost !== STATIC_HOSTNAME) blockingReasons.push('transport-certificate-host');
    if (object && transport.fullObjectSha256 !== object.objectSha256) blockingReasons.push('transport-hash-mismatch');
    if (transport.rangeStatus !== 206 || !validContentRange(transport.contentRange, object?.sizeBytes ?? null)) {
      blockingReasons.push('transport-range');
    }
    if (transport.cacheFirst !== 'MISS' || transport.cacheSecond !== 'HIT') blockingReasons.push('transport-cache');
    if (transport.corsOrigin !== ACT_ORIGIN) blockingReasons.push('transport-cors-origin');
    if (CORS_METHODS.some((method) => !transport!.corsMethods.includes(method))) blockingReasons.push('transport-cors-methods');
  }

  let isolation: IsolationReceipt | null = null;
  if (input.isolation === undefined) missingEvidence.push('isolation');
  else {
    isolation = parseIsolation(input.isolation);
    if (isolation.extraObjectsInBucket !== 0) blockingReasons.push('isolation-extra-objects');
    if (isolation.probes.some((probe) => probe.served)) blockingReasons.push('isolation-authority-served');
    if (isolation.probes.some((probe) => !probe.served && probe.status < 400)) {
      blockingReasons.push('isolation-status-contradiction');
    }
    const requiredClasses = ['runtime-blob', 'runtime-release', 'knowledge', 'assessment', 'unlisted'] as const;
    const seen = new Set(isolation.probes.map((probe) => probe.keyClass));
    if (requiredClasses.some((keyClass) => !seen.has(keyClass))) {
      blockingReasons.push('isolation-probes-missing');
    }
  }

  let cost: CostReceipt | null = null;
  if (input.cost === undefined) missingEvidence.push('cost');
  else {
    cost = parseCost(input.cost);
    if (cost.ossNetworkOutBytes === null || cost.ossCdnOutBytes === null || cost.esaUsageBytes === null) {
      missingEvidence.push('cost-plane');
    }
    if (cost.reportingDelayHours !== null && cost.reportingDelayHours > 0) missingEvidence.push('cost-delayed');
  }

  if (dns?.applied && (!serviceRole?.accepted || serviceRole.effectiveBucketReadScope === 'unknown')) {
    blockingReasons.push('dns-applied-without-role-acceptance');
  }

  let status: QualificationStatus = 'qualified';
  if (blockingReasons.length > 0) status = 'blocked';
  else if (missingEvidence.length > 0) status = 'incomplete';
  if (!QUALIFICATION_STATUSES.includes(status)) status = 'blocked';

  const body = {
    schemaVersion: QUALIFICATION_SCHEMA,
    sourceCommit: input.sourceCommit,
    sourceTree: input.sourceTree,
    dirty: input.dirty,
    mixedWorktree: input.mixedWorktree,
    toolVersion: TOOL_VERSION,
    capturedAt: input.capturedAt,
    status,
    hostname: STATIC_HOSTNAME,
    deliveryBucket: DELIVERY_BUCKET,
    objectKey: object?.objectKey ?? null,
    blockingReasons: [...new Set(blockingReasons)].sort(),
    missingEvidence: [...new Set(missingEvidence)].sort(),
    serviceRoleAccepted: serviceRole?.accepted === true && serviceRole.effectiveBucketReadScope !== 'unknown',
    dnsApplied: dns?.applied === true,
    originBucket: originBucket ?? object?.bucket ?? null,
  };
  const evidence = { serviceRole, object, dns, transport, isolation, cost };
  const evidenceFingerprint = sha256Text(serializeDeterministic({ capturedAt: input.capturedAt, evidence }));
  const envelope = {
    ...body,
    evidence,
    evidenceFingerprint,
    qualificationId: sha256Text(serializeDeterministic({
      sourceCommit: body.sourceCommit,
      sourceTree: body.sourceTree,
      status: body.status,
      blockingReasons: body.blockingReasons,
      missingEvidence: body.missingEvidence,
      objectKey: body.objectKey,
      evidenceFingerprint,
    })),
  } as QualificationEnvelope;
  assertPortable(envelope, 'qualification');
  return envelope;
}

export function summarizeQualification(envelope: QualificationEnvelope): string {
  const lines = [
    '# static ESA Delivery PoC',
    '',
    `- status: \`${envelope.status}\``,
    `- hostname: \`${envelope.hostname}\``,
    `- bucket: \`${envelope.deliveryBucket}\``,
    `- objectKey: \`${envelope.objectKey ?? 'none'}\``,
    `- sourceCommit: \`${envelope.sourceCommit}\``,
    `- dnsApplied: ${envelope.dnsApplied}`,
    `- serviceRoleAccepted: ${envelope.serviceRoleAccepted}`,
    '',
    'Blocking reasons:',
    ...(envelope.blockingReasons.length ? envelope.blockingReasons.map((item) => `- ${item}`) : ['- none']),
    '',
    'Missing evidence:',
    ...(envelope.missingEvidence.length ? envelope.missingEvidence.map((item) => `- ${item}`) : ['- none']),
    '',
    'This receipt does not change ACT application URLs, Runtime selectors, or main-domain DNS.',
    '',
  ];
  return `${lines.join('\n')}\n`;
}
