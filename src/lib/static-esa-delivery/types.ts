export const TOOL_VERSION = 'static-esa-delivery/1' as const;
export const PREFLIGHT_SCHEMA = 'act-esa-delivery-preflight/v1' as const;
export const SERVICE_ROLE_SCHEMA = 'act-esa-delivery-service-role/v1' as const;
export const OBJECT_SCHEMA = 'act-esa-delivery-object/v1' as const;
export const DNS_SCHEMA = 'act-esa-delivery-dns/v1' as const;
export const TRANSPORT_SCHEMA = 'act-esa-delivery-transport/v1' as const;
export const ISOLATION_SCHEMA = 'act-esa-delivery-isolation/v1' as const;
export const COST_SCHEMA = 'act-esa-delivery-cost/v1' as const;
export const QUALIFICATION_SCHEMA = 'act-esa-delivery-qualification/v1' as const;
export const ROLLBACK_SCHEMA = 'act-esa-delivery-rollback/v1' as const;

export const STATIC_HOSTNAME = 'static.adapt-learn.online';
export const ACT_ORIGIN = 'https://act.adapt-learn.online';
export const DELIVERY_BUCKET = 'act-course-delivery';
export const AUTHORITY_BUCKET = 'act-course-assets';
export const OBJECT_BASENAME = 'destroyer.glb';
export const CACHE_RULE = '/assets/*';
export const CORS_METHODS = ['GET', 'HEAD'] as const;
export const CACHE_TTL_DAYS = 30;
export const DEFAULT_SOURCE_PATH = 'public/assets/models-opt/destroyer.glb';
export const MEDIA_TYPE = 'model/gltf-binary';

export const QUALIFICATION_STATUSES = ['qualified', 'incomplete', 'blocked'] as const;
export type QualificationStatus = (typeof QUALIFICATION_STATUSES)[number];

export const SERVICE_ROLE_SCOPES = ['delivery-bucket-only', 'account-wide', 'unknown'] as const;
export type ServiceRoleScope = (typeof SERVICE_ROLE_SCOPES)[number];

export const SHA256 = /^[a-f0-9]{64}$/;
export const GIT_SHA = /^[a-f0-9]{40}$/;

export interface GitCapture {
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly dirty: boolean;
  readonly mixedWorktree: boolean;
}

export interface ServiceRoleReceipt {
  readonly schemaVersion: typeof SERVICE_ROLE_SCHEMA;
  readonly principalClass: 'esa-service-role';
  readonly policyIdentity: string;
  readonly effectiveBucketReadScope: ServiceRoleScope;
  readonly accepted: boolean;
}

export interface ObjectReceipt {
  readonly schemaVersion: typeof OBJECT_SCHEMA;
  readonly sourcePath: string;
  readonly sourceSha256: string;
  readonly objectSha256: string;
  readonly sizeBytes: number;
  readonly mediaType: typeof MEDIA_TYPE;
  readonly objectKey: string;
  readonly bucket: string;
  readonly publicAcl: boolean;
  readonly overwriteAttempted: boolean;
  readonly etagFingerprint: string | null;
}

export interface DnsReceipt {
  readonly schemaVersion: typeof DNS_SCHEMA;
  readonly hostname: string;
  readonly recordType: 'CNAME' | 'A' | 'AAAA' | 'absent' | 'intercepted';
  readonly priorValue: string | null;
  readonly priorTtlSeconds: number | null;
  readonly desiredValue: string | null;
  readonly applied: boolean;
  readonly namesChanged: readonly string[];
}

export interface TransportReceipt {
  readonly schemaVersion: typeof TRANSPORT_SCHEMA;
  readonly https: boolean;
  readonly certificateHost: string;
  readonly fullObjectSha256: string;
  readonly rangeStatus: number;
  readonly contentRange: string;
  readonly cacheFirst: 'MISS' | 'HIT' | 'unknown';
  readonly cacheSecond: 'MISS' | 'HIT' | 'unknown';
  readonly corsOrigin: string;
  readonly corsMethods: readonly string[];
}

export interface IsolationProbe {
  readonly keyClass: 'runtime-blob' | 'runtime-release' | 'knowledge' | 'assessment' | 'unlisted';
  readonly served: boolean;
  readonly status: number;
}

export interface IsolationReceipt {
  readonly schemaVersion: typeof ISOLATION_SCHEMA;
  readonly extraObjectsInBucket: number;
  readonly probes: readonly IsolationProbe[];
}

export interface CostReceipt {
  readonly schemaVersion: typeof COST_SCHEMA;
  readonly ossNetworkOutBytes: number | null;
  readonly ossCdnOutBytes: number | null;
  readonly esaUsageBytes: number | null;
  readonly reportingDelayHours: number | null;
  readonly shiftedNotFree: true;
}

export interface QualificationEnvelope {
  readonly schemaVersion: typeof QUALIFICATION_SCHEMA;
  readonly qualificationId: string;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly dirty: boolean;
  readonly mixedWorktree: boolean;
  readonly toolVersion: typeof TOOL_VERSION;
  readonly capturedAt: string;
  readonly status: QualificationStatus;
  readonly hostname: typeof STATIC_HOSTNAME;
  readonly deliveryBucket: typeof DELIVERY_BUCKET;
  readonly objectKey: string | null;
  readonly blockingReasons: readonly string[];
  readonly missingEvidence: readonly string[];
  readonly serviceRoleAccepted: boolean;
  readonly dnsApplied: boolean;
  readonly originBucket: string | null;
  readonly evidenceFingerprint: string;
  readonly evidence: {
    readonly serviceRole: ServiceRoleReceipt | null;
    readonly object: ObjectReceipt | null;
    readonly dns: DnsReceipt | null;
    readonly transport: TransportReceipt | null;
    readonly isolation: IsolationReceipt | null;
    readonly cost: CostReceipt | null;
  };
}

export interface RollbackReceipt {
  readonly schemaVersion: typeof ROLLBACK_SCHEMA;
  readonly hostname: typeof STATIC_HOSTNAME;
  readonly restoredValue: string | null;
  readonly deletedUnrelatedResources: false;
  readonly retainedDeliveryBucket: true;
  readonly retainedObject: true;
}
