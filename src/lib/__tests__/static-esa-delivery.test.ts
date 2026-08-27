import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  AUTHORITY_BUCKET,
  DELIVERY_BUCKET,
  STATIC_HOSTNAME,
  esaPrivacyViolation,
  objectKeyForDigest,
  planObject,
  qualifyDelivery,
  rejectAuthorityOrigin,
  rollbackPlan,
  type CostReceipt,
  type DnsReceipt,
  type IsolationReceipt,
  type ObjectReceipt,
  type ServiceRoleReceipt,
  type TransportReceipt,
} from '../static-esa-delivery';
import {
  COST_SCHEMA,
  DNS_SCHEMA,
  ISOLATION_SCHEMA,
  SERVICE_ROLE_SCHEMA,
  TRANSPORT_SCHEMA,
} from '../static-esa-delivery/types';

const COMMIT = 'a'.repeat(40);
const TREE = 'b'.repeat(40);
const POLICY = 'c'.repeat(64);
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
  return { ...planObject('public/assets/models-opt/destroyer.glb', BYTES), ...overrides };
}

function dns(overrides: Partial<DnsReceipt> = {}): DnsReceipt {
  return {
    schemaVersion: DNS_SCHEMA,
    hostname: STATIC_HOSTNAME,
    recordType: 'CNAME',
    priorValue: null,
    priorTtlSeconds: 600,
    desiredValue: 'example.esa.aliyuncs.com',
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
      { keyClass: 'knowledge', served: false, status: 404 },
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
    ...extra,
  });
}

describe('static ESA delivery qualification', () => {
  it('plans a content-addressed Delivery key and rejects the Authority Bucket', () => {
    const planned = planObject('public/assets/models-opt/destroyer.glb', BYTES);
    const digest = createHash('sha256').update(BYTES).digest('hex');
    expect(planned.objectKey).toBe(objectKeyForDigest(digest));
    expect(planned.bucket).toBe(DELIVERY_BUCKET);
    expect(rejectAuthorityOrigin(AUTHORITY_BUCKET)).toBe('origin-authority-bucket');
    expect(rejectAuthorityOrigin(DELIVERY_BUCKET)).toBeNull();
  });

  it('qualifies a complete isolated PoC without claiming ESA traffic is free', () => {
    const envelope = qualify();
    expect(envelope.status).toBe('qualified');
    expect(envelope.hostname).toBe(STATIC_HOSTNAME);
    expect(envelope.dnsApplied).toBe(true);
    expect(envelope.blockingReasons).toEqual([]);
    expect(cost().shiftedNotFree).toBe(true);
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
  });
});
