import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  AUTHORITY_BUCKET,
  DELIVERY_BUCKET,
  STATIC_HOSTNAME,
  esaPrivacyViolation,
  isEsaAssignedCname,
  objectKeyForDigest,
  planObject,
  qualifyDelivery,
  rejectAuthorityOrigin,
  rollbackPlan,
  type CostReceipt,
  type DnsReceipt,
  type IsolationReceipt,
  type LogReceipt,
  type ObjectReceipt,
  type ServiceRoleReceipt,
  type TransportReceipt,
} from '../static-esa-delivery';
import {
  COST_SCHEMA,
  DNS_SCHEMA,
  ISOLATION_SCHEMA,
  LOG_SCHEMA,
  SERVICE_ROLE_SCHEMA,
  TRANSPORT_SCHEMA,
} from '../static-esa-delivery/types';

const COMMIT = 'a'.repeat(40);
const TREE = 'b'.repeat(40);
const POLICY = 'c'.repeat(64);
const ETAG = 'd'.repeat(64);
const LOG_FP = 'e'.repeat(64);
const ESA_CNAME = 'static.adapt-learn.online.w.kunlunsl.com';
const BYTES = new Uint8Array([103, 108, 84, 70]);

function role(accepted = true, scope: ServiceRoleReceipt['effectiveBucketReadScope'] = 'delivery-bucket-only'): ServiceRoleReceipt {
  return {
    schemaVersion: SERVICE_ROLE_SCHEMA,
    principalClass: 'esa-service-role',
    policyIdentity: POLICY,
    effectiveBucketReadScope: scope,
    accepted,
  };
}

function objectReceipt(overrides: Partial<ObjectReceipt> = {}): ObjectReceipt {
  return {
    ...planObject('public/assets/models-opt/destroyer.glb', BYTES),
    etagFingerprint: ETAG,
    ...overrides,
  };
}

function dns(overrides: Partial<DnsReceipt> = {}): DnsReceipt {
  return {
    schemaVersion: DNS_SCHEMA,
    hostname: STATIC_HOSTNAME,
    recordType: 'CNAME',
    priorValue: null,
    priorTtlSeconds: 600,
    desiredValue: ESA_CNAME,
    assignedValue: ESA_CNAME,
    observedValue: ESA_CNAME,
    applied: true,
    namesChanged: [STATIC_HOSTNAME],
    ...overrides,
  };
}

function transport(object: ObjectReceipt, overrides: Partial<TransportReceipt> = {}): TransportReceipt {
  return {
    schemaVersion: TRANSPORT_SCHEMA,
    https: true,
    certificateHost: STATIC_HOSTNAME,
    fullObjectSha256: object.objectSha256,
    rangeStatus: 206,
    requestRange: 'bytes=0-1',
    contentRange: `bytes 0-1/${object.sizeBytes}`,
    cacheFirst: 'MISS',
    cacheSecond: 'HIT',
    corsOrigin: 'https://act.adapt-learn.online',
    corsMethods: ['GET', 'HEAD'],
    ...overrides,
  };
}

function isolation(overrides: Partial<IsolationReceipt> = {}): IsolationReceipt {
  return {
    schemaVersion: ISOLATION_SCHEMA,
    extraObjectsInBucket: 0,
    probes: [
      { keyClass: 'runtime-blob', served: false, status: 403 },
      { keyClass: 'runtime-release', served: false, status: 403 },
      { keyClass: 'knowledge', served: false, status: 404 },
      { keyClass: 'assessment', served: false, status: 404 },
      { keyClass: 'unlisted', served: false, status: 404 },
    ],
    ...overrides,
  };
}

function cost(overrides: Partial<CostReceipt> = {}): CostReceipt {
  return {
    schemaVersion: COST_SCHEMA,
    ossNetworkOutBytes: 10,
    ossCdnOutBytes: 20,
    esaUsageBytes: 20,
    reportingDelayHours: 0,
    shiftedNotFree: true,
    ...overrides,
  };
}

function logs(overrides: Partial<LogReceipt> = {}): LogReceipt {
  return {
    schemaVersion: LOG_SCHEMA,
    accessPresent: true,
    originPresent: true,
    observedAt: '2026-08-27T00:00:00.000Z',
    accessFingerprint: LOG_FP,
    originFingerprint: LOG_FP,
    edgeMatched: true,
    originBucketMatched: true,
    ...overrides,
  };
}

function qualify(extra: Record<string, unknown> = {}) {
  const object = objectReceipt();
  return qualifyDelivery({
    sourceCommit: COMMIT,
    sourceTree: TREE,
    dirty: false,
    mixedWorktree: false,
    capturedAt: '2026-08-27T00:00:00.000Z',
    originBucket: DELIVERY_BUCKET,
    serviceRole: role(),
    object,
    dns: dns(),
    transport: transport(object),
    isolation: isolation(),
    cost: cost(),
    logs: logs(),
    ...extra,
  });
}

describe('static ESA delivery qualification', () => {
  it('plans a content-addressed Delivery key and rejects the Authority Bucket', () => {
    const planned = planObject('public/assets/models-opt/destroyer.glb', BYTES);
    const digest = createHash('sha256').update(BYTES).digest('hex');
    expect(planned.objectKey).toBe(objectKeyForDigest(digest));
    expect(planned.bucket).toBe(DELIVERY_BUCKET);
    expect(planned.etagFingerprint).toBeNull();
    expect(rejectAuthorityOrigin(AUTHORITY_BUCKET)).toBe('origin-authority-bucket');
    expect(rejectAuthorityOrigin(DELIVERY_BUCKET)).toBeNull();
    expect(isEsaAssignedCname(ESA_CNAME)).toBe(true);
    expect(isEsaAssignedCname('unrelated.example.com')).toBe(false);
  });

  it('qualifies a complete isolated PoC without claiming ESA traffic is free', () => {
    const envelope = qualify();
    expect(envelope.status).toBe('qualified');
    expect(envelope.hostname).toBe(STATIC_HOSTNAME);
    expect(envelope.dnsApplied).toBe(true);
    expect(envelope.blockingReasons).toEqual([]);
    expect(envelope.evidenceFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(cost().shiftedNotFree).toBe(true);
    const otherRole = qualify({ serviceRole: role(true, 'account-wide') });
    expect(otherRole.qualificationId).not.toBe(envelope.qualificationId);
  });

  it('blocks an Authority origin, unaccepted role, overwrite, and out-of-scope DNS', () => {
    expect(qualify({ originBucket: AUTHORITY_BUCKET }).status).toBe('blocked');
    expect(qualify({ originBucket: AUTHORITY_BUCKET }).blockingReasons).toContain('origin-authority-bucket');
    expect(qualify({ serviceRole: role(false) }).blockingReasons).toContain('service-role-unaccepted');
    expect(qualify({ serviceRole: role(true, 'unknown') }).blockingReasons).toContain('service-role-unaccepted');
    expect(qualify({ object: objectReceipt({ overwriteAttempted: true }) }).blockingReasons).toContain('object-overwrite');
    expect(qualify({
      dns: dns({ namesChanged: ['adapt-learn.online'] }),
    }).blockingReasons).toContain('dns-scope-violation');
    expect(qualify({
      dns: dns({ hostname: 'act.adapt-learn.online', namesChanged: ['act.adapt-learn.online'] }),
    }).blockingReasons).toContain('dns-hostname-mismatch');
  });

  it('blocks when the static hostname can serve an Authority object', () => {
    const envelope = qualify({
      isolation: isolation({
        probes: [{ keyClass: 'runtime-blob', served: true, status: 200 }],
      }),
    });
    expect(envelope.status).toBe('blocked');
    expect(envelope.blockingReasons).toContain('isolation-authority-served');
    const plan = rollbackPlan(dns({ priorValue: null, applied: true }));
    expect(plan.hostname).toBe(STATIC_HOSTNAME);
    expect(plan.deletedUnrelatedResources).toBe(false);
    expect(() => rollbackPlan(dns({ hostname: 'act.adapt-learn.online', namesChanged: ['act.adapt-learn.online'] }))).toThrow(
      /rollback-hostname-mismatch/,
    );
  });

  it('stays incomplete when live evidence is missing and blocked when git is dirty', () => {
    const incomplete = qualifyDelivery({
      sourceCommit: COMMIT,
      sourceTree: TREE,
      dirty: false,
      mixedWorktree: false,
      capturedAt: '2026-08-27T00:00:00.000Z',
      originBucket: DELIVERY_BUCKET,
      object: objectReceipt(),
    });
    expect(incomplete.status).toBe('incomplete');
    expect(incomplete.missingEvidence).toEqual(expect.arrayContaining(['service-role', 'transport', 'isolation', 'cost']));
    expect(qualify({ dirty: true }).status).toBe('blocked');
    expect(qualify({ cost: cost({ reportingDelayHours: 24, ossCdnOutBytes: null }) }).status).toBe('incomplete');
    const intercepted = qualifyDelivery({
      sourceCommit: COMMIT,
      sourceTree: TREE,
      dirty: false,
      mixedWorktree: false,
      capturedAt: '2026-08-27T00:00:00.000Z',
      originBucket: DELIVERY_BUCKET,
      object: objectReceipt(),
      dns: dns({ recordType: 'intercepted', applied: false, priorValue: null, desiredValue: null }),
    });
    expect(intercepted.status).toBe('incomplete');
    expect(intercepted.missingEvidence).toContain('dns-trusted-observation');
  });

  it('rejects privacy-unsafe receipts and cache-rule mismatches', () => {
    expect(esaPrivacyViolation('{"path":"/Users/YW/secret"}')).toBe('absolute-path');
    expect(esaPrivacyViolation('url?OSSAccessKeyId=abc&Signature=def')).toBe('signed-query');
    expect(() => qualify({
      object: objectReceipt({ sourcePath: '/Users/YW/destroyer.glb' }),
    })).toThrow(/invalid-object:source-path/);
    expect(qualify({
      object: objectReceipt({ objectKey: 'models/destroyer.glb' }),
    }).blockingReasons).toContain('object-key-mismatch');
    expect(qualify({
      dns: dns({ applied: false, recordType: 'absent', desiredValue: null, assignedValue: null, observedValue: null }),
    }).status).toBe('incomplete');
    expect(qualify({
      transport: transport(objectReceipt(), { contentRange: 'bytes nonsense' }),
    }).blockingReasons).toContain('transport-range');
    expect(qualify({
      isolation: isolation({ probes: [{ keyClass: 'unlisted', served: false, status: 200 }] }),
    }).blockingReasons).toEqual(expect.arrayContaining(['isolation-probes-missing', 'isolation-status-contradiction']));
  });

  it('keeps local object plans and unmatched DNS or Range evidence from becoming qualified', () => {
    expect(qualify({ object: objectReceipt({ etagFingerprint: null }) }).status).toBe('incomplete');
    expect(qualify({ object: objectReceipt({ etagFingerprint: null }) }).missingEvidence).toContain('object-etag');
    expect(qualify({
      dns: dns({ desiredValue: 'unrelated.example.com', assignedValue: 'unrelated.example.com', observedValue: 'unrelated.example.com' }),
    }).blockingReasons).toContain('dns-cname-not-esa');
    expect(qualify({
      transport: transport(objectReceipt(), { requestRange: 'bytes=0-1', contentRange: `bytes 100-200/${BYTES.byteLength}` }),
    }).blockingReasons).toContain('transport-range');
    expect(qualifyDelivery({
      sourceCommit: COMMIT,
      sourceTree: TREE,
      dirty: false,
      mixedWorktree: false,
      capturedAt: '2026-08-27T00:00:00.000Z',
      originBucket: DELIVERY_BUCKET,
      serviceRole: role(),
      object: objectReceipt(),
      dns: dns(),
      transport: transport(objectReceipt()),
      isolation: isolation(),
      cost: cost(),
    }).missingEvidence).toContain('logs');
  });
});
